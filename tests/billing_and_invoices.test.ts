// Phase D8 Integration Tests: Service Quotes, Invoicing with SAMPLE Watermark & Receipts
// Enforces PRD.md (ADR02: Workers pay 0 FCFA; Companies pay Kazi service fees),
// WORKFLOWS.md, API.md (lines 66-75), and ADR-D0-04 (SAMPLE watermark policy).

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDraftQuote,
  sendQuote,
  decideQuote,
  createInvoiceFromQuote,
  recordInvoiceReceipt,
  reverseInvoiceReceipt,
  listCompanyQuotes,
  listCompanyInvoices,
  resetBillingState,
  clearBillingMemoryCache,
  getQuoteById,
  getInvoiceById,
  listInvoiceReceipts,
} from '../src/modules/billing/service';
import { execute, get, query, initDatabase, getDatabaseConnection } from '../src/server/db/database';

describe('Phase D8: Service Quotes, SAMPLE Invoices, Receipts & Reversals', () => {
  beforeEach(() => {
    resetBillingState();
  });

  // ----------------------------------------------------
  // Service Quotes Lifecycle (API.md lines 66-69)
  // ----------------------------------------------------
  describe('Service Quotes Lifecycle', () => {
    it('drafts a recruitment service quote with TVA and line totals', () => {
      const res = createDraftQuote({
        companyId: 'company-horizon',
        missionId: 'mission-btp-01',
        lines: [
          { description: 'Frais de sélection & mise à disposition maçon (x2)', quantity: 2, unitAmount: 35000, taxRate: 0.18 },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.quote?.status).toBe('DRAFT');
      expect(res.quote?.currency).toBe('XAF');
      expect(res.quote?.serviceAmount).toBe(70000);
      expect(res.quote?.taxAmount).toBe(12600); // 18% of 70000
      expect(res.quote?.totalAmount).toBe(82600);
    });

    it('sends quote to client company and enforces versioning', () => {
      const draft = createDraftQuote({
        companyId: 'company-horizon',
        lines: [{ description: 'Sélection Kazi', quantity: 1, unitAmount: 50000 }],
      });

      const sent = sendQuote('staff-fin-01', draft.quote!.id, 1);
      expect(sent.success).toBe(true);
      expect(sent.quote?.status).toBe('SENT');
      expect(sent.quote?.version).toBe(2);

      // Conflict on stale version
      const conflict = sendQuote('staff-fin-01', draft.quote!.id, 1);
      expect(conflict.success).toBe(false);
      expect(conflict.errorCode).toBe('VERSION_CONFLICT');
    });

    it('allows company to accept quote and rejects decisions after expiration', () => {
      const draft = createDraftQuote({
        companyId: 'company-horizon',
        lines: [{ description: 'Service Kazi', quantity: 1, unitAmount: 25000 }],
      });
      sendQuote('staff-fin-01', draft.quote!.id, 1);

      // Company accepts quote
      const accept = decideQuote('company-horizon', draft.quote!.id, 'ACCEPT', 2);
      expect(accept.success).toBe(true);
      expect(accept.quote?.status).toBe('ACCEPTED');

      // Attempt decision on expired quote
      const draft2 = createDraftQuote({
        companyId: 'company-horizon',
        lines: [{ description: 'Service Kazi 2', quantity: 1, unitAmount: 25000 }],
      });
      sendQuote('staff-fin-01', draft2.quote!.id, 1);
      draft2.quote!.expiresAt = Date.now() - 1000; // artificially expired

      const expiredDecision = decideQuote('company-horizon', draft2.quote!.id, 'ACCEPT', 2);
      expect(expiredDecision.success).toBe(false);
      expect(expiredDecision.errorCode).toBe('QUOTE_EXPIRED');
    });
  });

  // ----------------------------------------------------
  // Invoices & Mandatory SAMPLE Watermark (ADR-D0-04)
  // ----------------------------------------------------
  describe('Invoices with SAMPLE Watermark', () => {
    let acceptedQuoteId: string;

    beforeEach(() => {
      const draft = createDraftQuote({
        companyId: 'company-horizon',
        lines: [{ description: 'Recrutement 2 Maçons', quantity: 2, unitAmount: 40000, taxRate: 0.18 }],
      });
      sendQuote('staff-fin-01', draft.quote!.id, 1);
      decideQuote('company-horizon', draft.quote!.id, 'ACCEPT', 2);
      acceptedQuoteId = draft.quote!.id;
    });

    it('generates invoice with mandatory SAMPLE status and watermark flag', () => {
      const res = createInvoiceFromQuote({
        staffId: 'staff-fin-01',
        acceptedQuoteId,
        partyTaxSnapshot: {
          rccm: 'GA-LIB-2023-B-1122',
          nif: '0987654A',
          legalName: 'BTP Horizon SARL',
          billingAddress: 'Zone Industrielle Oloumi, Libreville',
        },
      });

      expect(res.success).toBe(true);
      expect(res.invoice?.status).toBe('SAMPLE');
      expect(res.invoice?.isSampleWatermark).toBe(true);
      expect(res.invoice?.invoiceNumber).toContain('KZ-SAMPLE-GA-');
      expect(res.invoice?.totalAmount).toBe(94400); // 80000 + 14400
    });

    it('strictly prevents invoicing quotes that have not been accepted', () => {
      const draft = createDraftQuote({
        companyId: 'company-horizon',
        lines: [{ description: 'Non accepté', quantity: 1, unitAmount: 10000 }],
      });

      const res = createInvoiceFromQuote({
        staffId: 'staff-fin-01',
        acceptedQuoteId: draft.quote!.id,
        partyTaxSnapshot: { rccm: 'RCCM', nif: 'NIF', legalName: 'Nom', billingAddress: 'Adr' },
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('QUOTE_NOT_ACCEPTED');
    });
  });

  // ----------------------------------------------------
  // Payment Receipts & Non-Destructive Reversals
  // ----------------------------------------------------
  describe('Payment Receipts & Reversals', () => {
    let invoiceId: string;

    beforeEach(() => {
      const draft = createDraftQuote({
        companyId: 'company-horizon',
        lines: [{ description: 'Prestation', quantity: 1, unitAmount: 100000, taxRate: 0.18 }],
      });
      sendQuote('staff-01', draft.quote!.id, 1);
      decideQuote('company-horizon', draft.quote!.id, 'ACCEPT', 2);

      const inv = createInvoiceFromQuote({
        staffId: 'staff-01',
        acceptedQuoteId: draft.quote!.id,
        partyTaxSnapshot: { rccm: 'RCCM', nif: 'NIF', legalName: 'BTP', billingAddress: 'Libreville' },
      });
      invoiceId = inv.invoice!.id;
    });

    it('records partial and full payment receipts updating invoice status', () => {
      // Partial receipt of 50 000 XAF
      const partial = recordInvoiceReceipt({
        staffId: 'staff-fin-01',
        invoiceId,
        amount: 50000,
        externalReference: 'BGFI-TRANS-001',
        receivedAt: Date.now(),
        note: 'Acompte par virement BGFI',
      });

      expect(partial.success).toBe(true);
      expect(partial.invoice?.paidAmount).toBe(50000);
      expect(partial.invoice?.status).toBe('PARTIALLY_PAID');

      // Second receipt completing the balance (total is 118 000)
      const full = recordInvoiceReceipt({
        staffId: 'staff-fin-01',
        invoiceId,
        amount: 68000,
        externalReference: 'BGFI-TRANS-002',
        receivedAt: Date.now(),
      });

      expect(full.success).toBe(true);
      expect(full.invoice?.paidAmount).toBe(118000);
      expect(full.invoice?.status).toBe('PAID');
    });

    it('rejects duplicate external reference on the same invoice (idempotency/uniqueness)', () => {
      recordInvoiceReceipt({
        staffId: 'staff-fin-01',
        invoiceId,
        amount: 20000,
        externalReference: 'ORABANK-REF-777',
        receivedAt: Date.now(),
      });

      const duplicate = recordInvoiceReceipt({
        staffId: 'staff-fin-01',
        invoiceId,
        amount: 20000,
        externalReference: 'ORABANK-REF-777',
        receivedAt: Date.now(),
      });

      expect(duplicate.success).toBe(false);
      expect(duplicate.errorCode).toBe('DUPLICATE_RECEIPT_REFERENCE');
    });

    it('executes compensating reversal without deleting records and adjusts invoice balance', () => {
      const receiptRes = recordInvoiceReceipt({
        staffId: 'staff-fin-01',
        invoiceId,
        amount: 50000,
        externalReference: 'ERRONEOUS-REF-123',
        receivedAt: Date.now(),
      });

      const receiptId = receiptRes.receipt!.id;

      // Reverse receipt
      const reversalRes = reverseInvoiceReceipt({
        staffId: 'staff-fin-01',
        receiptId,
        reason: 'Erreur d’imputation bancaire, virement destiné à un autre compte.',
      });

      expect(reversalRes.success).toBe(true);
      // Verify compensating negative entry
      expect(reversalRes.compensatingReceipt?.amount).toBe(-50000);
      expect(reversalRes.compensatingReceipt?.reversesReceiptId).toBe(receiptId);

      // Verify invoice paid amount reverted
      expect(reversalRes.invoice?.paidAmount).toBe(0);
      expect(reversalRes.invoice?.status).toBe('SAMPLE');

      // Attempt to reverse again: must be rejected
      const doubleReversal = reverseInvoiceReceipt({
        staffId: 'staff-fin-01',
        receiptId,
        reason: 'Deuxième tentative',
      });
      expect(doubleReversal.success).toBe(false);
      expect(doubleReversal.errorCode).toBe('ALREADY_REVERSED');
    });
  });

  // ----------------------------------------------------
  // SQLite Persistence & Recovery (Phase D8)
  // ----------------------------------------------------
  describe('SQLite Persistence & Recovery (Phase D8)', () => {
    const pCompanyId = 'comp-persist-billing-1';

    beforeEach(() => {
      const db = getDatabaseConnection();
      initDatabase(db);
      const nowIso = new Date().toISOString();

      // Seed company
      execute('DELETE FROM companies WHERE id = ?;', [pCompanyId]);
      execute(
        `INSERT INTO companies (id, legal_name, contact_email, verification_status, created_at, updated_at)
         VALUES (?, 'Entreprise Facturee S.A.', 'finance@facturee.ga', 'VERIFIED', ?, ?);`,
        [pCompanyId, nowIso, nowIso]
      );
    });

    it('persists quote, invoice lines, receipts and compensating reversals into SQLite tables', () => {
      // 1. Create quote
      const quoteRes = createDraftQuote({
        companyId: pCompanyId,
        lines: [
          { description: 'Mise à disposition électricien', quantity: 2, unitAmount: 30000, taxRate: 0.18 },
        ],
      });
      expect(quoteRes.success).toBe(true);
      const quoteId = quoteRes.quote!.id;

      // Verify quote in SQLite
      const dbQuote1 = get<any>('SELECT * FROM quotes WHERE id = ?;', [quoteId]);
      expect(dbQuote1).not.toBeNull();
      expect(dbQuote1.status).toBe('DRAFT');
      expect(dbQuote1.service_amount).toBe(60000);
      expect(dbQuote1.tax_amount).toBe(10800);
      expect(dbQuote1.total_amount).toBe(70800);

      // Send & accept quote
      sendQuote('staff-fin-01', quoteId, 1);
      decideQuote(pCompanyId, quoteId, 'ACCEPT', 2);

      const dbQuote2 = get<any>('SELECT * FROM quotes WHERE id = ?;', [quoteId]);
      expect(dbQuote2.status).toBe('ACCEPTED');

      // 2. Generate Invoice with SAMPLE watermark
      const invRes = createInvoiceFromQuote({
        staffId: 'staff-fin-01',
        acceptedQuoteId: quoteId,
        partyTaxSnapshot: {
          legalName: 'Entreprise Facturee S.A.',
          nif: '7654321B',
          rccm: 'GA-LIB-2024-B-9988',
          billingAddress: 'Zone Portuaire Owendo, Libreville',
        },
      });
      expect(invRes.success).toBe(true);
      const invoiceId = invRes.invoice!.id;

      // Verify invoice & lines in SQLite
      const dbInvoice = get<any>('SELECT * FROM invoices WHERE id = ?;', [invoiceId]);
      expect(dbInvoice).not.toBeNull();
      expect(dbInvoice.status).toBe('SAMPLE');
      expect(dbInvoice.invoice_number).toContain('KZ-SAMPLE-GA-');
      expect(dbInvoice.total_amount).toBe(70800);

      const dbLines = query<any>('SELECT * FROM invoice_lines WHERE invoice_id = ?;', [invoiceId]);
      expect(dbLines.length).toBe(1);
      expect(dbLines[0].description).toBe('Mise à disposition électricien');

      // 3. Record partial receipt
      const rec1 = recordInvoiceReceipt({
        staffId: 'staff-fin-01',
        invoiceId,
        amount: 35400,
        externalReference: 'UBA-TR-001',
        receivedAt: Date.now(),
      });
      expect(rec1.success).toBe(true);

      const dbRec1 = get<any>('SELECT * FROM service_receipts WHERE id = ?;', [rec1.receipt!.id]);
      expect(dbRec1).not.toBeNull();
      expect(dbRec1.amount).toBe(35400);

      const dbInvAfterRec1 = get<any>('SELECT status FROM invoices WHERE id = ?;', [invoiceId]);
      expect(dbInvAfterRec1.status).toBe('PARTIALLY_PAID');

      // 4. Record compensating reversal
      const revRes = reverseInvoiceReceipt({
        staffId: 'staff-fin-01',
        receiptId: rec1.receipt!.id,
        reason: 'Erreur compte émetteur',
      });
      expect(revRes.success).toBe(true);

      const dbReversal = get<any>('SELECT * FROM service_receipts WHERE id = ?;', [revRes.compensatingReceipt!.id]);
      expect(dbReversal).not.toBeNull();
      expect(dbReversal.amount).toBe(-35400);
      expect(dbReversal.reverses_receipt_id).toBe(rec1.receipt!.id);

      const dbInvAfterRev = get<any>('SELECT status FROM invoices WHERE id = ?;', [invoiceId]);
      expect(dbInvAfterRev.status).toBe('SAMPLE');
    });

    it('recovers quotes, invoices, lines and receipts from SQLite after memory cache purge', () => {
      // Setup quote, invoice and receipt
      const q = createDraftQuote({
        companyId: pCompanyId,
        lines: [{ description: 'Prestation Peinture', quantity: 1, unitAmount: 50000, taxRate: 0.18 }],
      });
      sendQuote('staff-fin-01', q.quote!.id, 1);
      decideQuote(pCompanyId, q.quote!.id, 'ACCEPT', 2);

      const inv = createInvoiceFromQuote({
        staffId: 'staff-fin-01',
        acceptedQuoteId: q.quote!.id,
        partyTaxSnapshot: { legalName: 'Persist Co', nif: 'NIF-1', rccm: 'RCCM-1', billingAddress: 'Libreville' },
      });

      recordInvoiceReceipt({
        staffId: 'staff-fin-01',
        invoiceId: inv.invoice!.id,
        amount: 59000,
        externalReference: 'BICIG-REF-100',
        receivedAt: Date.now(),
      });

      // Clear memory cache completely
      clearBillingMemoryCache();

      // Retrieve quote from DB
      const restoredQuote = getQuoteById(q.quote!.id);
      expect(restoredQuote).not.toBeNull();
      expect(restoredQuote?.status).toBe('ACCEPTED');
      expect(restoredQuote?.lines.length).toBe(1);

      // Retrieve invoice from DB
      const restoredInvoice = getInvoiceById(inv.invoice!.id);
      expect(restoredInvoice).not.toBeNull();
      expect(restoredInvoice?.status).toBe('PAID');
      expect(restoredInvoice?.paidAmount).toBe(59000);

      // Retrieve receipts from DB
      const restoredReceipts = listInvoiceReceipts(inv.invoice!.id);
      expect(restoredReceipts.length).toBe(1);
      expect(restoredReceipts[0].externalReference).toBe('BICIG-REF-100');
    });
  });
});
