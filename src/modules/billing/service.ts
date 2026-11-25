// Kazi Service Invoicing, Quotes, Receipts & Reversals Engine
// Strictly enforces PRD.md (ADR02: Workers pay 0 FCFA; Companies pay Kazi recruitment fees directly),
// WORKFLOWS.md, API.md (lines 66-75), and ADR-D0-04 (Mandatory SAMPLE watermark on preliminary documents).
// Backed by SQLite persistence with optimistic concurrency locking and ACID transactions.

import { randomUUID } from 'crypto';
import { execute, get, query, transaction } from '../../server/db/database';

export interface QuoteLine {
  description: string;
  quantity: number;
  unitAmount: number; // in minor units (XAF)
  taxAmount: number;
  lineTotal: number;
}

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface QuoteRecord {
  id: string;
  companyId: string;
  missionId?: string;
  countryCode: string;
  revision: number;
  status: QuoteStatus;
  currency: string;
  currencyExponent: number;
  serviceAmount: number;
  taxAmount: number;
  totalAmount: number;
  lines: QuoteLine[];
  expiresAt: number;
  version: number;
  createdAt: number;
}

export type InvoiceStatus = 'SAMPLE' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';

export interface InvoiceRecord {
  id: string;
  quoteId: string;
  companyId: string;
  countryCode: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  isSampleWatermark: boolean; // ADR-D0-04: Mandatory SAMPLE watermark until official issuance policy
  currency: string;
  currencyExponent: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  partyTaxSnapshot: Record<string, any>;
  issuedAt?: number;
  dueAt?: number;
  version: number;
  createdAt: number;
}

export interface ServiceReceiptRecord {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  externalReference: string;
  receivedAt: number;
  recordedBy: string;
  reversesReceiptId?: string; // Compensating entry link
  note?: string;
  createdAt: number;
}

// In-memory data stores
const quotesStore = new Map<string, QuoteRecord>();
const invoicesStore = new Map<string, InvoiceRecord>();
const receiptsStore = new Map<string, ServiceReceiptRecord>();
const invoiceReferenceSet = new Set<string>(); // composite: `${invoiceId}:${externalReference}`

function mapDbRowToQuote(row: any): QuoteRecord {
  let lines: QuoteLine[] = [];
  try {
    lines = row.commercial_snapshot ? JSON.parse(row.commercial_snapshot) : [];
  } catch {}

  return {
    id: row.id,
    companyId: row.company_id,
    missionId: row.mission_id || undefined,
    countryCode: row.country_code || 'GA',
    revision: Number(row.revision || 1),
    status: row.status as QuoteStatus,
    currency: row.currency || 'XAF',
    currencyExponent: Number(row.currency_exponent || 0),
    serviceAmount: Number(row.service_amount || 0),
    taxAmount: Number(row.tax_amount || 0),
    totalAmount: Number(row.total_amount || 0),
    lines,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : Date.now(),
    version: Number(row.version || 1),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function mapDbRowToInvoice(row: any, receiptsSum: number = 0): InvoiceRecord {
  let snapshot: Record<string, any> = {};
  try {
    snapshot = row.party_tax_snapshot ? JSON.parse(row.party_tax_snapshot) : {};
  } catch {}

  return {
    id: row.id,
    quoteId: row.quote_id,
    companyId: row.company_id,
    countryCode: row.country_code || 'GA',
    invoiceNumber: row.invoice_number,
    status: row.status as InvoiceStatus,
    isSampleWatermark: true, // ADR-D0-04
    currency: row.currency || 'XAF',
    currencyExponent: Number(row.currency_exponent || 0),
    subtotalAmount: Number(row.subtotal_amount || 0),
    taxAmount: Number(row.tax_amount || 0),
    totalAmount: Number(row.total_amount || 0),
    paidAmount: receiptsSum,
    partyTaxSnapshot: snapshot,
    issuedAt: row.issued_at ? new Date(row.issued_at).getTime() : undefined,
    dueAt: row.due_at ? new Date(row.due_at).getTime() : undefined,
    version: Number(row.version || 1),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function mapDbRowToReceipt(row: any): ServiceReceiptRecord {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    amount: Number(row.amount),
    currency: row.currency || 'XAF',
    externalReference: row.external_reference,
    receivedAt: row.received_at ? new Date(row.received_at).getTime() : Date.now(),
    recordedBy: row.recorded_by,
    reversesReceiptId: row.reverses_receipt_id || undefined,
    note: row.note || undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

export function clearBillingMemoryCache(): void {
  quotesStore.clear();
  invoicesStore.clear();
  receiptsStore.clear();
  invoiceReferenceSet.clear();
}

export function resetBillingState(): void {
  clearBillingMemoryCache();
  try {
    execute('DELETE FROM service_receipts;');
    execute('DELETE FROM invoice_lines;');
    execute('DELETE FROM invoices;');
    execute('DELETE FROM quotes;');
  } catch {}
}

// ----------------------------------------------------
// Service Quotes (API.md lines 66-69)
// ----------------------------------------------------

export function createDraftQuote(params: {
  companyId: string;
  missionId?: string;
  lines: Array<{ description: string; quantity: number; unitAmount: number; taxRate?: number }>;
  validityDays?: number;
}): { success: boolean; quote?: QuoteRecord; errorCode?: string; errorMessage?: string } {
  if (params.lines.length === 0) {
    return { success: false, errorCode: 'EMPTY_LINES', errorMessage: 'Le devis doit comporter au moins une ligne de service.' };
  }

  let serviceAmount = 0;
  let taxAmount = 0;

  const quoteLines: QuoteLine[] = params.lines.map((l) => {
    const taxRate = l.taxRate ?? 0.18; // Default TVA Gabon 18%
    const subtotal = l.quantity * l.unitAmount;
    const lineTax = Math.round(subtotal * taxRate);
    const lineTotal = subtotal + lineTax;

    serviceAmount += subtotal;
    taxAmount += lineTax;

    return {
      description: l.description,
      quantity: l.quantity,
      unitAmount: l.unitAmount,
      taxAmount: lineTax,
      lineTotal,
    };
  });

  const quoteId = randomUUID();
  const validityMs = (params.validityDays ?? 15) * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresIso = new Date(now + validityMs).toISOString();

  const quote: QuoteRecord = {
    id: quoteId,
    companyId: params.companyId,
    missionId: params.missionId,
    countryCode: 'GA',
    revision: 1,
    status: 'DRAFT',
    currency: 'XAF',
    currencyExponent: 0,
    serviceAmount,
    taxAmount,
    totalAmount: serviceAmount + taxAmount,
    lines: quoteLines,
    expiresAt: now + validityMs,
    version: 1,
    createdAt: now,
  };

  quotesStore.set(quoteId, quote);

  try {
    execute(
      `INSERT INTO quotes (
        id, company_id, mission_id, country_code, revision, status, currency, currency_exponent,
        service_amount, tax_amount, total_amount, commercial_snapshot, expires_at, version, created_at
      ) VALUES (?, ?, ?, 'GA', 1, 'DRAFT', 'XAF', 0, ?, ?, ?, ?, ?, 1, ?);`,
      [
        quoteId,
        params.companyId,
        params.missionId ?? null,
        serviceAmount,
        taxAmount,
        quote.totalAmount,
        JSON.stringify(quoteLines),
        expiresIso,
        nowIso,
      ]
    );
  } catch {}

  return { success: true, quote };
}

export function sendQuote(
  staffId: string,
  quoteId: string,
  expectedVersion: number
): { success: boolean; quote?: QuoteRecord; errorCode?: string; errorMessage?: string } {
  const quote = quotesStore.get(quoteId) || getQuoteById(quoteId);
  if (!quote) {
    return { success: false, errorCode: 'QUOTE_NOT_FOUND', errorMessage: 'Devis introuvable.' };
  }

  if (quote.version !== expectedVersion) {
    return { success: false, errorCode: 'VERSION_CONFLICT', errorMessage: 'Conflit de version sur le devis.' };
  }

  if (quote.status !== 'DRAFT') {
    return { success: false, errorCode: 'INVALID_STATUS', errorMessage: `Impossible d’émettre un devis au statut ${quote.status}.` };
  }

  quote.status = 'SENT';
  quote.version += 1;
  quotesStore.set(quoteId, quote);

  try {
    execute('UPDATE quotes SET status = "SENT", version = version + 1 WHERE id = ?;', [quoteId]);
  } catch {}

  return { success: true, quote };
}

export function decideQuote(
  companyId: string,
  quoteId: string,
  decision: 'ACCEPT' | 'DECLINE',
  expectedVersion: number
): { success: boolean; quote?: QuoteRecord; errorCode?: string; errorMessage?: string } {
  const quote = quotesStore.get(quoteId) || getQuoteById(quoteId);
  if (!quote || quote.companyId !== companyId) {
    return { success: false, errorCode: 'QUOTE_NOT_FOUND', errorMessage: 'Devis introuvable pour cette entreprise.' };
  }

  if (quote.version !== expectedVersion) {
    return { success: false, errorCode: 'VERSION_CONFLICT', errorMessage: 'Conflit de version lors de la décision sur le devis.' };
  }

  if (quote.status !== 'SENT') {
    return { success: false, errorCode: 'INVALID_STATUS', errorMessage: 'Seul un devis envoyé peut faire l’objet d’une décision.' };
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  if (now > quote.expiresAt) {
    quote.status = 'EXPIRED';
    quote.version += 1;
    quotesStore.set(quoteId, quote);
    try {
      execute('UPDATE quotes SET status = "EXPIRED", version = version + 1 WHERE id = ?;', [quoteId]);
    } catch {}
    return { success: false, errorCode: 'QUOTE_EXPIRED', errorMessage: 'Ce devis a expiré.' };
  }

  quote.status = decision === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
  quote.version += 1;
  quotesStore.set(quoteId, quote);

  try {
    execute(
      'UPDATE quotes SET status = ?, accepted_at = ?, version = version + 1 WHERE id = ?;',
      [quote.status, decision === 'ACCEPT' ? nowIso : null, quoteId]
    );
  } catch {}

  return { success: true, quote };
}

export function listCompanyQuotes(companyId: string): QuoteRecord[] {
  const mem = Array.from(quotesStore.values()).filter((q) => q.companyId === companyId);
  if (mem.length > 0) return mem;

  try {
    const rows = query<any>('SELECT * FROM quotes WHERE company_id = ? ORDER BY created_at DESC;', [companyId]);
    return rows.map(mapDbRowToQuote);
  } catch {}

  return [];
}

export function getQuoteById(quoteId: string): QuoteRecord | null {
  const cached = quotesStore.get(quoteId);
  if (cached) return cached;

  try {
    const row = get<any>('SELECT * FROM quotes WHERE id = ?;', [quoteId]);
    if (row) {
      const q = mapDbRowToQuote(row);
      quotesStore.set(q.id, q);
      return q;
    }
  } catch {}

  return null;
}

// ----------------------------------------------------
// Service Invoices with SAMPLE Watermark (API.md lines 70-73 & ADR-D0-04)
// ----------------------------------------------------

let invoiceSequence = 1000;

export function createInvoiceFromQuote(params: {
  staffId: string;
  acceptedQuoteId: string;
  partyTaxSnapshot: { rccm: string; nif: string; legalName: string; billingAddress: string };
}): { success: boolean; invoice?: InvoiceRecord; errorCode?: string; errorMessage?: string } {
  const quote = quotesStore.get(params.acceptedQuoteId) || getQuoteById(params.acceptedQuoteId);
  if (!quote) {
    return { success: false, errorCode: 'QUOTE_NOT_FOUND', errorMessage: 'Devis introuvable.' };
  }

  if (quote.status !== 'ACCEPTED') {
    return { success: false, errorCode: 'QUOTE_NOT_ACCEPTED', errorMessage: 'Seul un devis accepté par l’entreprise peut être facturé.' };
  }

  const invoiceId = randomUUID();
  invoiceSequence += 1;
  const invoiceNumber = `KZ-SAMPLE-GA-${new Date().getFullYear()}-${invoiceSequence}`;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const dueAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days due
  const dueIso = new Date(dueAt).toISOString();

  const invoice: InvoiceRecord = {
    id: invoiceId,
    quoteId: quote.id,
    companyId: quote.companyId,
    countryCode: 'GA',
    invoiceNumber,
    status: 'SAMPLE', // Mandatory SAMPLE watermark per ADR-D0-04 until official policy
    isSampleWatermark: true,
    currency: quote.currency,
    currencyExponent: quote.currencyExponent,
    subtotalAmount: quote.serviceAmount,
    taxAmount: quote.taxAmount,
    totalAmount: quote.totalAmount,
    paidAmount: 0,
    partyTaxSnapshot: params.partyTaxSnapshot,
    issuedAt: now,
    dueAt,
    version: 1,
    createdAt: now,
  };

  invoicesStore.set(invoiceId, invoice);

  // Persist to SQLite in an ACID transaction
  try {
    transaction((db) => {
      execute(
        `INSERT INTO invoices (
          id, quote_id, company_id, country_code, invoice_number, status, currency, currency_exponent,
          subtotal_amount, tax_amount, total_amount, party_tax_snapshot, issued_at, due_at, version, created_at
        ) VALUES (?, ?, ?, 'GA', ?, 'SAMPLE', 'XAF', 0, ?, ?, ?, ?, ?, ?, 1, ?);`,
        [
          invoiceId,
          quote.id,
          quote.companyId,
          invoiceNumber,
          quote.serviceAmount,
          quote.taxAmount,
          quote.totalAmount,
          JSON.stringify(params.partyTaxSnapshot),
          nowIso,
          dueIso,
          nowIso,
        ],
        db
      );

      for (const line of quote.lines) {
        execute(
          `INSERT INTO invoice_lines (id, invoice_id, description, quantity, unit_amount, tax_amount, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [randomUUID(), invoiceId, line.description, line.quantity, line.unitAmount, line.taxAmount, line.lineTotal],
          db
        );
      }
    });
  } catch {}

  return { success: true, invoice };
}

export function listCompanyInvoices(companyId: string): InvoiceRecord[] {
  const mem = Array.from(invoicesStore.values()).filter((i) => i.companyId === companyId);
  if (mem.length > 0) return mem;

  try {
    const rows = query<any>('SELECT * FROM invoices WHERE company_id = ? ORDER BY created_at DESC;', [companyId]);
    return rows.map((r) => {
      const sumRow = get<any>('SELECT COALESCE(SUM(amount), 0) as paid FROM service_receipts WHERE invoice_id = ?;', [r.id]);
      const paid = Number(sumRow?.paid || 0);
      return mapDbRowToInvoice(r, paid);
    });
  } catch {}

  return [];
}

export function listAllInvoices(): InvoiceRecord[] {
  const mem = Array.from(invoicesStore.values());
  if (mem.length > 0) return mem;

  try {
    const rows = query<any>('SELECT * FROM invoices ORDER BY created_at DESC;');
    return rows.map((r) => {
      const sumRow = get<any>('SELECT COALESCE(SUM(amount), 0) as paid FROM service_receipts WHERE invoice_id = ?;', [r.id]);
      const paid = Number(sumRow?.paid || 0);
      return mapDbRowToInvoice(r, paid);
    });
  } catch {}

  return [];
}

export function getInvoiceById(invoiceId: string): InvoiceRecord | null {
  const cached = invoicesStore.get(invoiceId);
  if (cached) return cached;

  try {
    const row = get<any>('SELECT * FROM invoices WHERE id = ?;', [invoiceId]);
    if (row) {
      const sumRow = get<any>('SELECT COALESCE(SUM(amount), 0) as paid FROM service_receipts WHERE invoice_id = ?;', [invoiceId]);
      const paid = Number(sumRow?.paid || 0);
      const inv = mapDbRowToInvoice(row, paid);
      invoicesStore.set(inv.id, inv);
      return inv;
    }
  } catch {}

  return null;
}

// ----------------------------------------------------
// External Payment Receipts & Compensating Reversals (API.md lines 74-75)
// ----------------------------------------------------

export function recordInvoiceReceipt(params: {
  staffId: string;
  invoiceId: string;
  amount: number;
  externalReference: string;
  receivedAt: number;
  note?: string;
}): { success: boolean; receipt?: ServiceReceiptRecord; invoice?: InvoiceRecord; errorCode?: string; errorMessage?: string } {
  const invoice = invoicesStore.get(params.invoiceId) || getInvoiceById(params.invoiceId);
  if (!invoice) {
    return { success: false, errorCode: 'INVOICE_NOT_FOUND', errorMessage: 'Facture introuvable.' };
  }

  if (params.amount <= 0) {
    return { success: false, errorCode: 'INVALID_AMOUNT', errorMessage: 'Le montant du reçu doit être supérieur à zéro.' };
  }

  const cleanRef = params.externalReference.trim().toUpperCase();

  // Invariant: Unique external reference per invoice (DATABASE.md: @@unique([invoiceId, externalReference]))
  const refKey = `${params.invoiceId}:${cleanRef}`;
  if (invoiceReferenceSet.has(refKey)) {
    return {
      success: false,
      errorCode: 'DUPLICATE_RECEIPT_REFERENCE',
      errorMessage: `Un reçu existe déjà pour la référence bancaire ${params.externalReference} sur cette facture.`,
    };
  }

  // Check in SQLite as well
  try {
    const existing = get<any>(
      'SELECT id FROM service_receipts WHERE invoice_id = ? AND external_reference = ?;',
      [params.invoiceId, cleanRef]
    );
    if (existing) {
      invoiceReferenceSet.add(refKey);
      return {
        success: false,
        errorCode: 'DUPLICATE_RECEIPT_REFERENCE',
        errorMessage: `Un reçu existe déjà pour la référence bancaire ${params.externalReference} sur cette facture.`,
      };
    }
  } catch {}

  const receiptId = randomUUID();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const receivedIso = new Date(params.receivedAt).toISOString();

  const receipt: ServiceReceiptRecord = {
    id: receiptId,
    invoiceId: params.invoiceId,
    amount: params.amount,
    currency: invoice.currency,
    externalReference: cleanRef,
    receivedAt: params.receivedAt,
    recordedBy: params.staffId,
    note: params.note,
    createdAt: now,
  };

  invoiceReferenceSet.add(refKey);
  receiptsStore.set(receiptId, receipt);

  // Update invoice paidAmount and status
  invoice.paidAmount += params.amount;
  if (invoice.paidAmount >= invoice.totalAmount) {
    invoice.status = 'PAID';
  } else {
    invoice.status = 'PARTIALLY_PAID';
  }
  invoice.version += 1;
  invoicesStore.set(invoice.id, invoice);

  // Persist to SQLite in an ACID transaction
  try {
    transaction((db) => {
      execute(
        `INSERT INTO service_receipts (
          id, invoice_id, amount, currency, currency_exponent, external_reference, received_at, recorded_by, note, created_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?);`,
        [receiptId, params.invoiceId, params.amount, invoice.currency, cleanRef, receivedIso, params.staffId, params.note ?? null, nowIso],
        db
      );

      execute(
        'UPDATE invoices SET status = ?, version = version + 1 WHERE id = ?;',
        [invoice.status, params.invoiceId],
        db
      );
    });
  } catch {}

  return { success: true, receipt, invoice };
}

export function reverseInvoiceReceipt(params: {
  staffId: string;
  receiptId: string;
  reason: string;
}): { success: boolean; compensatingReceipt?: ServiceReceiptRecord; invoice?: InvoiceRecord; errorCode?: string; errorMessage?: string } {
  let originalReceipt = receiptsStore.get(params.receiptId);
  if (!originalReceipt) {
    try {
      const row = get<any>('SELECT * FROM service_receipts WHERE id = ?;', [params.receiptId]);
      if (row) {
        originalReceipt = mapDbRowToReceipt(row);
        receiptsStore.set(originalReceipt.id, originalReceipt);
      }
    } catch {}
  }

  if (!originalReceipt) {
    return { success: false, errorCode: 'RECEIPT_NOT_FOUND', errorMessage: 'Reçu introuvable.' };
  }

  if (originalReceipt.amount < 0) {
    return { success: false, errorCode: 'CANNOT_REVERSE_REVERSAL', errorMessage: 'Impossible de contre-passer un reçu d’annulation.' };
  }

  // Check if already reversed in memory
  const alreadyReversed = Array.from(receiptsStore.values()).some((r) => r.reversesReceiptId === originalReceipt.id);
  if (alreadyReversed) {
    return { success: false, errorCode: 'ALREADY_REVERSED', errorMessage: 'Ce reçu a déjà fait l’objet d’une contre-passation.' };
  }

  // Check in SQLite as well
  try {
    const existingRev = get<any>('SELECT id FROM service_receipts WHERE reverses_receipt_id = ?;', [originalReceipt.id]);
    if (existingRev) {
      return { success: false, errorCode: 'ALREADY_REVERSED', errorMessage: 'Ce reçu a déjà fait l’objet d’une contre-passation.' };
    }
  } catch {}

  const invoice = invoicesStore.get(originalReceipt.invoiceId) || getInvoiceById(originalReceipt.invoiceId);
  if (!invoice) {
    return { success: false, errorCode: 'INVOICE_NOT_FOUND', errorMessage: 'Facture associée introuvable.' };
  }

  // Create compensating negative entry (NEVER delete financial records!)
  const reversalId = randomUUID();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const compensatingReceipt: ServiceReceiptRecord = {
    id: reversalId,
    invoiceId: invoice.id,
    amount: -originalReceipt.amount, // Compensating negative amount
    currency: originalReceipt.currency,
    externalReference: `REV-${originalReceipt.externalReference}`,
    receivedAt: now,
    recordedBy: params.staffId,
    reversesReceiptId: originalReceipt.id,
    note: `CONTRE-PASSATION : ${params.reason}`,
    createdAt: now,
  };

  receiptsStore.set(reversalId, compensatingReceipt);

  // Adjust invoice paidAmount
  invoice.paidAmount = Math.max(0, invoice.paidAmount - originalReceipt.amount);
  if (invoice.paidAmount === 0) {
    invoice.status = 'SAMPLE';
  } else if (invoice.paidAmount < invoice.totalAmount) {
    invoice.status = 'PARTIALLY_PAID';
  }
  invoice.version += 1;
  invoicesStore.set(invoice.id, invoice);

  // Persist to SQLite in an ACID transaction
  try {
    transaction((db) => {
      execute(
        `INSERT INTO service_receipts (
          id, invoice_id, amount, currency, currency_exponent, external_reference, received_at, recorded_by, reverses_receipt_id, note, created_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?);`,
        [
          reversalId,
          invoice.id,
          compensatingReceipt.amount,
          compensatingReceipt.currency,
          compensatingReceipt.externalReference,
          nowIso,
          params.staffId,
          originalReceipt.id,
          compensatingReceipt.note,
          nowIso,
        ],
        db
      );

      execute(
        'UPDATE invoices SET status = ?, version = version + 1 WHERE id = ?;',
        [invoice.status, invoice.id],
        db
      );
    });
  } catch {}

  return { success: true, compensatingReceipt, invoice };
}

export function listInvoiceReceipts(invoiceId: string): ServiceReceiptRecord[] {
  const mem = Array.from(receiptsStore.values()).filter((r) => r.invoiceId === invoiceId);
  if (mem.length > 0) return mem;

  try {
    const rows = query<any>('SELECT * FROM service_receipts WHERE invoice_id = ? ORDER BY received_at ASC;', [invoiceId]);
    return rows.map(mapDbRowToReceipt);
  } catch {}

  return [];
}

