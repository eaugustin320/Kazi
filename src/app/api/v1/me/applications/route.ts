// Worker Applications List Handler (GET /api/v1/me/applications)
// Returns authenticated worker's applications (API.md line 40)

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/rbac';
import { listWorkerApplications } from '@/modules/applications/service';

export async function GET(request: Request) {
  try {
    const session = authenticateRequest(request);
    if (!session || session.user.role !== 'WORKER') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED_WORKER', message: 'Seul un ouvrier authentifié peut consulter ses candidatures.' } },
        { status: 403 }
      );
    }

    const workerId = session.user.workerProfileId || session.user.userId;
    const applications = listWorkerApplications(workerId);

    return NextResponse.json({
      data: applications,
      meta: {
        requestId: `req_${Date.now()}`,
        limit: 20,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération des candidatures.' } },
      { status: 500 }
    );
  }
}
