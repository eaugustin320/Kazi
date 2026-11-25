// Attendance Collection Handler (GET /api/v1/attendance)
// Scoped listing of daily attendance and review status (KZ10)

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/rbac';
import {
  listAllAttendance,
  listAttendanceByWorker,
  listAttendanceByCompany,
  AttendanceRecord as ServiceAttendanceRecord,
} from '@/modules/attendance/service';

export async function GET(request: Request) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    let records: ServiceAttendanceRecord[] = [];
    if (session.user.role === 'STAFF') {
      records = listAllAttendance();
    } else if (session.user.role === 'COMPANY' && session.user.companyId) {
      records = listAttendanceByCompany(session.user.companyId);
    } else if (session.user.role === 'WORKER') {
      const workerId = session.user.workerProfileId || session.user.userId;
      records = listAttendanceByWorker(workerId);
    }

    // Map ServiceAttendanceRecord to UI AttendanceRecord format
    const mapped = records.map((r) => {
      let reviewState = 'NOT_RECORDED';
      if (r.resolutionStatus === 'RESOLVED_BY_STAFF') {
        reviewState = 'RESOLVED_BY_STAFF';
      } else if (r.workerDecision === 'DISPUTED') {
        reviewState = 'DISPUTED';
      } else if (r.workerDecision === 'CONFIRMED') {
        reviewState = 'CONFIRMED';
      } else if (r.declarationRevision > 0) {
        reviewState = 'SUBMITTED_BY_COMPANY';
      }

      return {
        id: r.id,
        missionId: r.missionId || 'mission-demo-01',
        assignmentId: r.assignmentId || 'assign-01',
        workerId: r.workerId || 'worker-01',
        workerName: 'Paul Mba',
        date: r.localDate || '2026-11-23',
        companyStatus: (r.declaredStatus === 'NOT_RECORDED' ? 'PRESENT' : r.declaredStatus) as any,
        hoursWorked: r.workedMinutes ? Math.round((r.workedMinutes / 60) * 10) / 10 : 8,
        companyNote: r.reason || '',
        workerAgreed: r.workerDecision === 'CONFIRMED' ? true : r.workerDecision === 'DISPUTED' ? false : null,
        workerDisputeNote: r.workerDecision === 'DISPUTED' ? r.reason : undefined,
        reviewState: reviewState as any,
        staffResolutionNote: r.resolutionStatus === 'RESOLVED_BY_STAFF' ? r.reason : undefined,
      };
    });

    return NextResponse.json({
      data: mapped,
      meta: { count: mapped.length },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération des pointages.' } },
      { status: 500 }
    );
  }
}
