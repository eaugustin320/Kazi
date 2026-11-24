// Company Proposals Scoped List Handler (GET /api/v1/companies/[id]/proposals)
// Company member reviews proposed candidates; strictly scoped and anonymized (API.md line 47)

import { NextResponse } from 'next/server';
import { authenticateRequest, requireCompanyScope } from '@/server/auth/rbac';
import { getCompanyProposals } from '@/modules/applications/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    const { id: companyId } = await params;

    // Strict tenant scope check: non-member gets 404 to prevent existence probing
    const scopeAuth = requireCompanyScope(session, companyId);
    if (!scopeAuth.authorized) {
      return NextResponse.json(
        { error: { code: scopeAuth.errorCode, message: scopeAuth.errorMessage } },
        { status: scopeAuth.statusCode }
      );
    }

    const url = new URL(request.url);
    const missionId = url.searchParams.get('missionId') || undefined;

    // Strict candidate DTO scoping: NO phone, NO CNI, NO staff notes!
    const proposals = getCompanyProposals(companyId, missionId);

    return NextResponse.json({
      data: proposals,
      meta: {
        requestId: `req_${Date.now()}`,
        limit: 20,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération des propositions.' } },
      { status: 500 }
    );
  }
}
