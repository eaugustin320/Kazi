// Application Withdrawal Handler (POST /api/v1/applications/[id]/withdraw)
// Worker withdraws preassignment application (API.md line 41)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/server/auth/rbac';
import { withdrawApplication } from '@/modules/applications/service';

const WithdrawSchema = z.object({
  reason: z.string().min(2, 'Motif de désistement requis'),
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
        { error: { code: 'UNAUTHORIZED_WORKER', message: 'Seul un ouvrier authentifié peut retirer sa candidature.' } },
        { status: 403 }
      );
    }

    const { id: applicationId } = await params;
    const body = await request.json();
    const parsed = WithdrawSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const workerId = session.user.workerProfileId || session.user.userId;
    const result = withdrawApplication(
      workerId,
      applicationId,
      parsed.data.reason,
      parsed.data.expectedVersion
    );

    if (!result.success) {
      const status =
        result.errorCode === 'APPLICATION_NOT_FOUND' ? 404 :
        result.errorCode === 'VERSION_CONFLICT' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: result.application,
      meta: {
        requestId: `req_${Date.now()}`,
        message: 'Candidature retirée avec succès.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors du retrait de candidature.' } },
      { status: 500 }
    );
  }
}
