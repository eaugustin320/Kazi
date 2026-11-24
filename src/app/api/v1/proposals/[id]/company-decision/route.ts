// Company Proposal Decision Handler (POST /api/v1/proposals/[id]/company-decision)
// Company accepts or declines candidate; triggers 24h worker availability window (API.md line 48)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/server/auth/rbac';
import { companyDecideProposal } from '@/modules/applications/service';

const DecisionSchema = z.object({
  decision: z.enum(['ACCEPTED', 'DECLINED']),
  expectedVersion: z.number().int().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    if (!session || session.user.role !== 'COMPANY' || !session.user.companyId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED_COMPANY', message: 'Seule l’entreprise cliente peut statuer sur une proposition.' } },
        { status: 403 }
      );
    }

    const { id: proposalId } = await params;
    const body = await request.json();
    const parsed = DecisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = companyDecideProposal(
      session.user.companyId,
      proposalId,
      parsed.data.decision,
      parsed.data.expectedVersion
    );

    if (!result.success) {
      const status =
        result.errorCode === 'PROPOSAL_NOT_FOUND' ? 404 :
        result.errorCode === 'VERSION_CONFLICT' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: result.proposal,
      meta: {
        requestId: `req_${Date.now()}`,
        message:
          parsed.data.decision === 'ACCEPTED'
            ? 'Candidat accepté. Délai de confirmation ouvrier de 24h enclenché (KZ08).'
            : 'Proposition de candidat déclinée.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la prise de décision entreprise.' } },
      { status: 500 }
    );
  }
}
