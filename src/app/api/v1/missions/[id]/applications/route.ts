// Worker Application Submission Handler (POST /api/v1/missions/[id]/applications)
// Worker applies with termsId; enforces duplicate check KZ06 (API.md line 39)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/server/auth/rbac';
import { applyToMission } from '@/modules/applications/service';

const ApplySchema = z.object({
  termsId: z.string().min(1, 'termsId requis'),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    if (!session || session.user.role !== 'WORKER') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED_WORKER', message: 'Seul un ouvrier authentifié peut postuler à une mission.' } },
        { status: 403 }
      );
    }

    const { id: missionId } = await params;
    const body = await request.json();
    const parsed = ApplySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const workerId = session.user.workerProfileId || session.user.userId;
    const result = applyToMission(workerId, missionId, parsed.data.termsId);

    if (!result.success) {
      const status =
        result.errorCode === 'APPLICATION_EXISTS' ? 409 :
        result.errorCode === 'MISSION_NOT_FOUND' ? 404 :
        result.errorCode === 'MISSION_CLOSED' ? 400 : 400;

      return NextResponse.json(
        {
          error: {
            code: result.errorCode,
            message: result.errorMessage,
            existingApplicationId: result.existingApplicationId,
          },
        },
        { status }
      );
    }

    return NextResponse.json(
      {
        data: result.application,
        meta: {
          requestId: `req_${Date.now()}`,
          message: 'Candidature enregistrée avec succès (KZ06).',
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors du dépôt de candidature.' } },
      { status: 500 }
    );
  }
}
