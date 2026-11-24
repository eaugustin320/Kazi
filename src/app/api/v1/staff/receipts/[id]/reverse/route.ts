// Staff Receipt Reversal Handler (POST /api/v1/staff/receipts/[id]/reverse)
// Finance reverses external receipt via compensating entry (API.md line 75)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { reverseInvoiceReceipt } from '@/modules/billing/service';

const ReversalSchema = z.object({
  reason: z.string().min(5, 'Motif d’annulation requis'),
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

    const { id: receiptId } = await params;
    const body = await request.json();
    const parsed = ReversalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = reverseInvoiceReceipt({
      staffId: session!.user.userId,
      receiptId,
      reason: parsed.data.reason,
    });

    if (!result.success) {
      const status =
        result.errorCode === 'RECEIPT_NOT_FOUND' ? 404 :
        result.errorCode === 'ALREADY_REVERSED' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: {
        compensatingReceipt: result.compensatingReceipt,
        invoice: result.invoice,
      },
      meta: {
        requestId: `req_${Date.now()}`,
        message: 'Contre-passation enregistrée avec succès (écriture compensatoire, non destructive).',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la contre-passation du reçu.' } },
      { status: 500 }
    );
  }
}
