// Replacement Requests Handler (POST /api/v1/replacements)
// Strictly enforces KZ11 without fabricating assignments

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/server/auth/rbac';
import { createReplacementRequest } from '@/modules/attendance/service';

const CreateReplacementSchema = z.object({
  assignmentId: z.string().min(1),
  missionId: z.string().min(1),
  workerId: z.string().min(1),
  affectedDayIds: z.array(z.string()).min(1),
  reasonCode: z.enum(['WORKER_ABSENT', 'WORKER_ILLNESS', 'SKILL_MISMATCH', 'COMPANY_REQUEST']),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = CreateReplacementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const { assignmentId, missionId, workerId, affectedDayIds, reasonCode, note } = parsed.data;
    const requestedBy = session.user.userId;
    const companyId = session.user.companyId || 'company-a';

    const result = createReplacementRequest(
      requestedBy,
      assignmentId,
      missionId,
      companyId,
      workerId,
      affectedDayIds,
      reasonCode,
      note
    );

    if (!result.success) {
      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data: result.request,
      meta: { message: 'Demande de remplacement enregistrée avec succès.' },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la création de la demande de remplacement.' } },
      { status: 500 }
    );
  }
}
