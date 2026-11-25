// Staff Invoices Creation Handler (POST /api/v1/staff/invoices)
// Finance staff generates invoice from accepted quote; marks with SAMPLE watermark (API.md line 70 ADR-D0-04)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { createInvoiceFromQuote, listAllInvoices } from '@/modules/billing/service';

const CreateInvoiceSchema = z.object({
  acceptedQuoteId: z.string().min(1),
  partyTaxSnapshot: z.object({
    rccm: z.string().min(2),
    nif: z.string().min(2),
    legalName: z.string().min(2),
    billingAddress: z.string().min(3),
  }),
});

export async function GET(request: Request) {
  try {
    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'FINANCE');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const invoices = listAllInvoices();

    return NextResponse.json({
      data: invoices,
      meta: { requestId: `req_${Date.now()}`, count: invoices.length },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération des factures.' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'FINANCE');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const body = await request.json();
    const parsed = CreateInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = createInvoiceFromQuote({
      staffId: session!.user.userId,
      acceptedQuoteId: parsed.data.acceptedQuoteId,
      partyTaxSnapshot: parsed.data.partyTaxSnapshot,
    });

    if (!result.success) {
      const status =
        result.errorCode === 'QUOTE_NOT_FOUND' ? 404 :
        result.errorCode === 'QUOTE_NOT_ACCEPTED' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json(
      {
        data: result.invoice,
        meta: {
          requestId: `req_${Date.now()}`,
          message: 'Facture préliminaire générée avec filigrane SAMPLE (ADR-D0-04).',
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la création de la facture.' } },
      { status: 500 }
    );
  }
}
