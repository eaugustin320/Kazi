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
import { get } from '@/server/db/database';

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

      // Resolve actual worker display name from DB if not cached on record
      let workerName = r.workerName;
      if (!workerName && r.workerId) {
        try {
          const wp = get<{ display_name: string }>(
            'SELECT display_name FROM worker_profiles WHERE id = ? LIMIT 1;',
            [r.workerId]
          );
          workerName = wp?.display_name;
        } catch {}
      }

      return {
        id: r.id,
        assignmentDayId: r.assignmentDayId,
        missionId: r.missionId,
        missionTitle: r.missionTitle,
        companyId: r.companyId,
        assignmentId: r.assignmentId,
        workerId: r.workerId,
        workerName: workerName || r.workerId,
        date: r.localDate,
        companyStatus: (r.declaredStatus === 'NOT_RECORDED' ? 'PRESENT' : r.declaredStatus) as any,
        declaredStatus: r.declaredStatus,
        hoursWorked: r.workedMinutes != null ? Math.round((r.workedMinutes / 60) * 10) / 10 : 8,
        companyNote: r.reason || '',
        workerAgreed:
          r.workerDecision === 'CONFIRMED'
            ? true
            : r.workerDecision === 'DISPUTED'
            ? false
            : null,
        workerDisputeNote: r.workerDecision === 'DISPUTED' ? r.reason : undefined,
        reviewState: reviewState as any,
        staffResolutionNote: r.resolutionStatus === 'RESOLVED_BY_STAFF' ? r.reason : undefined,
        declarationRevision: r.declarationRevision,
        version: r.version,
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
