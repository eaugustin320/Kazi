// Worker Attendance Decision / Dispute Handler (POST /api/v1/attendance/[id]/worker-decision)
// Worker confirms or disputes company attendance declaration (API.md line 56 KZ10)
// Strictly requires declarationRevision for optimistic concurrency against pointage revisions.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/server/auth/rbac';
import { workerDecideAttendance } from '@/modules/attendance/service';

const DecisionSchema = z.object({
  decision: z.enum(['CONFIRM', 'DISPUTE']),
  declarationRevision: z.number().int().min(1),
  disputeReason: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    if (!session || session.user.role !== 'WORKER') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED_WORKER', message: 'Seul l’ouvrier assigné peut statuer sur son pointage.' } },
        { status: 403 }
      );
    }

    const { id: attendanceId } = await params;
    const body = await request.json();
    const parsed = DecisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const workerId = session.user.workerProfileId || session.user.userId;
    const result = workerDecideAttendance(
      workerId,
      attendanceId,
      parsed.data.decision,
      parsed.data.declarationRevision,
      parsed.data.disputeReason
    );

    if (!result.success) {
      const status =
        result.errorCode === 'ATTENDANCE_NOT_FOUND'
          ? 404
          : result.errorCode === 'FORBIDDEN'
          ? 403
          : result.errorCode === 'REVISION_MISMATCH'
          ? 409
          : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: result.attendance,
      meta: {
        requestId: `req_${Date.now()}`,
        message:
          parsed.data.decision === 'CONFIRM'
            ? 'Pointage confirmé par l’ouvrier.'
            : 'Contestation de pointage enregistrée.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la décision sur le pointage.' } },
      { status: 500 }
    );
  }
}
