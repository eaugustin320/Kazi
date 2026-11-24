// Staff Mission Applications List Handler (GET /api/v1/staff/missions/[id]/applications)
// Recruiter reviews country-scoped applicants for a mission (API.md line 42)

import { NextResponse } from 'next/server';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { recruiterListMissionApplications } from '@/modules/applications/service';

export async function GET(
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
    const applicants = recruiterListMissionApplications(missionId);

    return NextResponse.json({
      data: applicants,
      meta: {
        requestId: `req_${Date.now()}`,
        count: applicants.length,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération des candidats.' } },
      { status: 500 }
    );
  }
}
