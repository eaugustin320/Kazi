// Company Attendance Declaration Handler (PUT /api/v1/assignment-days/[id]/attendance)
// Company declares daily attendance for an assignment day (API.md line 55 KZ10)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/server/auth/rbac';
import { recordCompanyAttendance } from '@/modules/attendance/service';

const AttendanceSchema = z.object({
  declaredStatus: z.enum(['PRESENT', 'ABSENT', 'PARTIAL']),
  workedMinutes: z.number().int().min(1).optional(),
  note: z.string().optional(),
  expectedVersion: z.number().int().min(1),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    if (!session || session.user.role !== 'COMPANY' || !session.user.companyId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED_COMPANY', message: 'Seule l’entreprise cliente peut déclarer le pointage.' } },
        { status: 403 }
      );
    }

    const { id: assignmentDayId } = await params;
    const body = await request.json();
    const parsed = AttendanceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = recordCompanyAttendance(
      session.user.companyId,
      assignmentDayId,
      parsed.data.declaredStatus,
      parsed.data.workedMinutes,
      parsed.data.note,
      parsed.data.expectedVersion
    );

    if (!result.success) {
      const status =
        result.errorCode === 'ATTENDANCE_NOT_FOUND' ? 404 :
        result.errorCode === 'FORBIDDEN' ? 404 : // Non-disclosure of other tenant's assignment
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
        message: 'Pointage journalier enregistré avec succès (KZ10). En attente de confirmation ouvrier.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la déclaration du pointage.' } },
      { status: 500 }
    );
  }
}
