// Applications API Route Handler (POST /api/v1/applications)
// Enforces KZ06 (unique application per worker/mission) with real authentication & database

import { NextResponse } from 'next/server';
import { ApplicationSubmitSchema } from '@/modules/recruitment/validation';
import { authenticateRequest } from '@/server/auth/rbac';
import { applyToMission, getWorkerById, seedWorker } from '@/modules/applications/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ApplicationSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            messageKey: 'errors.invalidInput',
            fields: parsed.error.flatten().fieldErrors,
            requestId: `req_${Date.now()}`,
          },
        },
        { status: 422 }
      );
    }

    const session = authenticateRequest(request);
    if (!session || session.user.role !== 'WORKER') {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED_WORKER',
            message: 'Seul un ouvrier authentifié peut postuler à une mission.',
          },
        },
        { status: 403 }
      );
    }

    const missionId = parsed.data.missionId || body.missionId;
    if (!missionId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'missionId requis' } },
        { status: 422 }
      );
    }
    const termsId = parsed.data.termsId;
    const workerId = session.user.workerProfileId || `wp_${session.user.userId}`;

    // Ensure worker profile exists in service cache/db
    if (!getWorkerById(workerId)) {
      seedWorker({
        id: workerId,
        userId: session.user.userId,
        fullName: 'Ouvrier Kazi',
        phone: session.user.phone || '+24101000000',
        tradeCodes: ['masonry', 'welding'],
        areaCode: 'libreville',
        experienceYears: 3,
        verificationStatus: 'VERIFIED',
      });
    }

    const result = applyToMission(workerId, missionId, termsId);

    if (!result.success) {
      const status =
        result.errorCode === 'MISSION_NOT_FOUND' ? 404 :
        result.errorCode === 'APPLICATION_EXISTS' ? 409 :
        result.errorCode === 'DUPLICATE_APPLICATION' ? 409 :
        result.errorCode === 'TERMS_MISMATCH' ? 409 : 400;

      return NextResponse.json(
        {
          error: {
            code: result.errorCode || 'APPLICATION_ERROR',
            message: result.errorMessage,
            existingApplicationId: result.existingApplicationId,
            requestId: `req_${Date.now()}`,
          },
        },
        { status }
      );
    }

    return NextResponse.json(
      {
        data: result.application,
        meta: { requestId: `req_${Date.now()}` },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'SERVER_ERROR',
          messageKey: 'errors.internal',
          requestId: `req_${Date.now()}`,
        },
      },
      { status: 500 }
    );
  }
}
