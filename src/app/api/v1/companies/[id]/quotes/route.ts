// Company Quotes Scoped Handler (GET /api/v1/companies/[id]/quotes)
// Company member views own service quotes and revisions (API.md line 68)

import { NextResponse } from 'next/server';
import { authenticateRequest, requireCompanyScope } from '@/server/auth/rbac';
import { listCompanyQuotes } from '@/modules/billing/service';

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

    const quotes = listCompanyQuotes(companyId);

    return NextResponse.json({
      data: quotes,
      meta: { requestId: `req_${Date.now()}`, count: quotes.length },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération des devis.' } },
      { status: 500 }
    );
  }
}
