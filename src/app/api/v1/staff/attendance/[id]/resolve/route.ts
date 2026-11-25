// Staff Attendance Dispute Resolution Handler (POST /api/v1/staff/attendance/[id]/resolve)
// Recruiter arbitrates disputed daily attendance (API.md line 57 KZ10)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { staffResolveAttendance } from '@/modules/attendance/service';

const ResolveSchema = z.object({
  resolution: z.enum(['PRESENT', 'ABSENT', 'PARTIAL']).optional(),
  decision: z.enum(['PRESENT', 'ABSENT', 'PARTIAL', 'CONFIRMED_PRESENT', 'CONFIRMED_ABSENT', 'SPLIT_HOURS']).optional(),
  reason: z.string().optional(),
  resolutionNotes: z.string().optional(),
  workedMinutes: z.number().int().min(1).optional(),
  expectedVersion: z.number().int().optional().default(1),
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

    const rawDecision = parsed.data.decision || parsed.data.resolution || 'PRESENT';
    const normResolution = (rawDecision === 'CONFIRMED_PRESENT' || rawDecision === 'PRESENT')
      ? 'PRESENT'
      : (rawDecision === 'CONFIRMED_ABSENT' || rawDecision === 'ABSENT')
      ? 'ABSENT'
      : 'PARTIAL';
    const normReason = parsed.data.resolutionNotes || parsed.data.reason || 'Décision d’arbitrage par le staff Kazi';
    const normVersion = parsed.data.expectedVersion || 1;

    const result = staffResolveAttendance(
      session!.user.userId,
      attendanceId,
      normResolution,
      normReason,
      parsed.data.workedMinutes,
      normVersion
    );

    if (!result.success) {
      const status =
        result.errorCode === 'ATTENDANCE_NOT_FOUND' ? 404 :
        result.errorCode === 'VERSION_CONFLICT' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: result.attendance,
      meta: {
        requestId: `req_${Date.now()}`,
        message: 'Litige de présence arbitré et clôturé par le recruteur staff (KZ10).',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de l’arbitrage du pointage.' } },
      { status: 500 }
    );
  }
}
