// Staff Proposals Batch Dispatch Handler (POST /api/v1/staff/missions/[id]/proposals)
// Recruiter proposes shortlisted candidates to company; atomic batch <= 20 (API.md line 46)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { recruiterCreateProposalBatch } from '@/modules/applications/service';

const ProposalBatchSchema = z.object({
  applicationIds: z.array(z.string()).min(1).max(20),
  termsId: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'RECRUITER');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const { id: missionId } = await params;
    const body = await request.json();
    const parsed = ProposalBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = recruiterCreateProposalBatch(
      session!.user.userId,
      missionId,
      parsed.data.applicationIds,
      parsed.data.termsId
    );

    if (!result.success) {
      const status =
        result.errorCode === 'MISSION_NOT_FOUND' ? 404 :
        result.errorCode === 'APPLICATION_NOT_FOUND' ? 404 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json(
      {
        data: result.proposals,
        meta: {
          requestId: `req_${Date.now()}`,
          message: 'Lot de candidats proposé à l’entreprise avec succès (KZ07).',
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de l’envoi des propositions.' } },
      { status: 500 }
    );
  }
}
