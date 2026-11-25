// Staff Attendance Dispute Resolution Handler (POST /api/v1/staff/attendance/[id]/resolve)
// Recruiter arbitrates disputed daily attendance (API.md line 57 KZ10)
// Strictly requires expectedVersion for optimistic concurrency control.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { staffResolveAttendance } from '@/modules/attendance/service';

const ResolveSchema = z.object({
  resolution: z.enum(['PRESENT', 'ABSENT', 'PARTIAL']),
  reason: z.string().min(5, 'Une justification détaillée est requise'),
  workedMinutes: z.number().int().min(1).optional(),
  expectedVersion: z.number().int().min(1),
});

export async function POST(
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

    const { id: attendanceId } = await params;
    const body = await request.json();
    const parsed = ResolveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = staffResolveAttendance(
      session!.user.userId,
      attendanceId,
      parsed.data.resolution,
      parsed.data.reason,
      parsed.data.workedMinutes,
      parsed.data.expectedVersion
    );

    if (!result.success) {
      const status =
        result.errorCode === 'ATTENDANCE_NOT_FOUND'
          ? 404
          : result.errorCode === 'VERSION_CONFLICT'
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
        message: 'Litige de pointage résolu par le recruteur Kazi.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la résolution du litige.' } },
      { status: 500 }
    );
  }
}
