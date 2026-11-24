// Staff Support Case Transition Handler (POST /api/v1/staff/support-cases/[id]/transition)
// Staff updates case status with optimistic locking (API.md line 65)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { transitionCaseStatus } from '@/modules/support/service';

const TransitionSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_PARTY', 'RESOLVED']),
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

    const { id: caseId } = await params;
    const body = await request.json();
    const parsed = TransitionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = transitionCaseStatus(
      session!.user.userId,
      caseId,
      parsed.data.status,
      parsed.data.expectedVersion
    );

    if (!result.success) {
      const status =
        result.errorCode === 'CASE_NOT_FOUND' ? 404 :
        result.errorCode === 'VERSION_CONFLICT' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: result.caseRecord,
      meta: {
        requestId: `req_${Date.now()}`,
        message: `Statut du dossier mis à jour vers ${parsed.data.status}.`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors du changement de statut.' } },
      { status: 500 }
    );
  }
}
