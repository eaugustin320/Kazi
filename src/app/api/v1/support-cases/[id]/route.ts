// Support Case Thread Handler (GET /api/v1/support-cases/[id])
// Retrieves case details and thread with mandatory STAFF_ONLY internal note filter (API.md line 63)

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/rbac';
import { getCaseThread } from '@/modules/support/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    const { id: caseId } = await params;
    const isStaff = session.user.role === 'STAFF';

    const thread = getCaseThread(caseId, isStaff);
    if (!thread) {
      return NextResponse.json(
        { error: { code: 'CASE_NOT_FOUND', message: 'Dossier introuvable.' } },
        { status: 404 }
      );
    }

    // Tenant / party authorization check
    if (!isStaff) {
      const { caseRecord } = thread;
      const isOwnerWorker = session.user.role === 'WORKER' && (caseRecord.workerId === session.user.workerProfileId || caseRecord.reporterUserId === session.user.userId);
      const isOwnerCompany = session.user.role === 'COMPANY' && caseRecord.companyId === session.user.companyId;

      if (!isOwnerWorker && !isOwnerCompany) {
        return NextResponse.json(
          { error: { code: 'CASE_NOT_FOUND', message: 'Dossier introuvable.' } },
          { status: 404 } // Non-disclosure of other tenant's support cases
        );
      }
    }

    return NextResponse.json({
      data: {
        case: thread.caseRecord,
        messages: thread.messages, // Strictly filtered for non-staff
      },
      meta: {
        requestId: `req_${Date.now()}`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération du dossier.' } },
      { status: 500 }
    );
  }
}
