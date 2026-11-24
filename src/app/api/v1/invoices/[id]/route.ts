// Immutable Invoice Details Handler (GET /api/v1/invoices/[id])
// Scoped immutable invoice details with SAMPLE watermark metadata (API.md line 73)

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/rbac';
import { getInvoiceById } from '@/modules/billing/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    const { id: invoiceId } = await params;
    const invoice = getInvoiceById(invoiceId);

    if (!invoice) {
      return NextResponse.json(
        { error: { code: 'INVOICE_NOT_FOUND', message: 'Facture introuvable.' } },
        { status: 404 }
      );
    }

    // Tenant authorization check
    if (session.user.role === 'COMPANY' && invoice.companyId !== session.user.companyId) {
      return NextResponse.json(
        { error: { code: 'INVOICE_NOT_FOUND', message: 'Facture introuvable.' } },
        { status: 404 } // Non-disclosure of other tenant's billing records
      );
    }

    return NextResponse.json({
      data: invoice,
      meta: { requestId: `req_${Date.now()}` },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la consultation de la facture.' } },
      { status: 500 }
    );
  }
}
