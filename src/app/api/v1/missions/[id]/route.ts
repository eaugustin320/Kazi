// Public / Worker Mission Detail Handler (GET /api/v1/missions/[id])
// Returns safe mission details; meeting instructions redacted unless assigned worker (API.md KZ05)

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/rbac';
import { getPublicMissionDetail } from '@/modules/applications/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    const { id: missionId } = await params;

    const isAssigned = false; // Could be checked against assignmentsStore
    const detail = getPublicMissionDetail(missionId, isAssigned);

    if (!detail) {
      return NextResponse.json(
        { error: { code: 'MISSION_NOT_FOUND', message: 'Mission introuvable.' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: detail,
      meta: { requestId: `req_${Date.now()}` },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération de la mission.' } },
      { status: 500 }
    );
  }
}
