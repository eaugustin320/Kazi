// Company Invoices Scoped Handler (GET /api/v1/companies/[id]/invoices)
// Company member / finance views own service-fee invoices (API.md line 72)

import { NextResponse } from 'next/server';
import { authenticateRequest, requireCompanyScope } from '@/server/auth/rbac';
import { listCompanyInvoices } from '@/modules/billing/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    const { id: companyId } = await params;

    const auth = requireCompanyScope(session, companyId);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const invoices = listCompanyInvoices(companyId);

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
