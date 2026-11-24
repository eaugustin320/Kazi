// Staff Invoice Receipts Recording Handler (POST /api/v1/staff/invoices/[id]/receipts)
// Finance records verified external payment receipt (API.md line 74)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { recordInvoiceReceipt } from '@/modules/billing/service';

const ReceiptSchema = z.object({
  amount: z.number().int().min(1),
  externalReference: z.string().min(3),
  receivedAt: z.number().int().min(1),
  note: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'FINANCE');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const { id: invoiceId } = await params;
    const body = await request.json();
    const parsed = ReceiptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = recordInvoiceReceipt({
      staffId: session!.user.userId,
      invoiceId,
      amount: parsed.data.amount,
      externalReference: parsed.data.externalReference,
      receivedAt: parsed.data.receivedAt,
      note: parsed.data.note,
    });

    if (!result.success) {
      const status =
        result.errorCode === 'INVOICE_NOT_FOUND' ? 404 :
        result.errorCode === 'DUPLICATE_RECEIPT_REFERENCE' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json(
      {
        data: {
          receipt: result.receipt,
          invoice: result.invoice,
        },
        meta: {
          requestId: `req_${Date.now()}`,
          message: 'Paiement enregistré avec succès.',
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de l’enregistrement du reçu.' } },
      { status: 500 }
    );
  }
}
