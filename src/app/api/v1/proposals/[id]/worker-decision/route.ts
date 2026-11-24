// Worker Proposal Confirmation Handler (POST /api/v1/proposals/[id]/worker-decision)
// Worker confirms or declines assignment availability within 24h window (API.md line 49 KZ08)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/server/auth/rbac';
import { workerDecideProposal } from '@/modules/applications/service';

const WorkerDecisionSchema = z.object({
  decision: z.enum(['CONFIRMED', 'DECLINED']),
  termsId: z.string().min(1),
  expectedVersion: z.number().int().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    if (!session || session.user.role !== 'WORKER') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED_WORKER', message: 'Seul l’ouvrier concerné peut confirmer sa disponibilité.' } },
        { status: 403 }
      );
    }

    const { id: proposalId } = await params;
    const body = await request.json();
    const parsed = WorkerDecisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const workerId = session.user.workerProfileId || session.user.userId;
    const result = workerDecideProposal(
      workerId,
      proposalId,
      parsed.data.decision,
      parsed.data.termsId,
      parsed.data.expectedVersion
    );

    if (!result.success) {
      const status =
        result.errorCode === 'PROPOSAL_NOT_FOUND' ? 404 :
        result.errorCode === 'CONFIRMATION_EXPIRED' ? 410 :
        result.errorCode === 'TERMS_CHANGED' ? 409 :
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
          parsed.data.decision === 'CONFIRMED'
            ? 'Disponibilité confirmée avec succès. En attente de finalisation staff (KZ08).'
            : 'Proposition déclinée par l’ouvrier.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la confirmation ouvrier.' } },
      { status: 500 }
    );
  }
}
