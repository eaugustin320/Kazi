// Mission Bilan & Closure Handler (POST /api/v1/staff/missions/[id]/close)
// Recruiter closes mission after all daily attendance records are validated/resolved (API.md line 61)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { staffCloseMission } from '@/modules/attendance/service';

const CloseMissionSchema = z.object({
  reconciliationNote: z.string().optional(),
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

    const { id: missionId } = await params;
    const body = await request.json();
    const parsed = CloseMissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = staffCloseMission(
      session!.user.userId,
      missionId,
      parsed.data.reconciliationNote || 'Bilan de fin de mission validé',
      parsed.data.expectedVersion
    );

    if (!result.success) {
      const status =
        result.errorCode === 'UNRESOLVED_ATTENDANCE_DAYS' ? 409 :
        result.errorCode === 'VERSION_CONFLICT' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: result.missionSummary,
      meta: {
        requestId: `req_${Date.now()}`,
        message: 'Mission réconciliée et clôturée avec succès. Bilan disponible.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la clôture de la mission.' } },
      { status: 500 }
    );
  }
}
