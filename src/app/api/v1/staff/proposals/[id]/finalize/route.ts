// Staff Proposal Finalization Handler (POST /api/v1/staff/proposals/[id]/finalize)
// Recruiter executes atomic finalization: dual confirmation, capacity & schedule anti-overlap checks (API.md line 50 KZ09)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { staffFinalizeAssignment } from '@/modules/applications/service';

const FinalizeSchema = z.object({
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

    const { id: proposalId } = await params;
    const body = await request.json();
    const parsed = FinalizeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const idempotencyKey = request.headers.get('Idempotency-Key') || undefined;
    const result = staffFinalizeAssignment(
      session!.user.userId,
      proposalId,
      parsed.data.expectedVersion,
      idempotencyKey
    );

    if (!result.success) {
      const status =
        result.errorCode === 'PROPOSAL_NOT_FOUND' ? 404 :
        result.errorCode === 'CAPACITY_FULL' ? 409 :
        result.errorCode === 'WORKER_OVERLAP' ? 409 :
        result.errorCode === 'CONFIRMATION_EXPIRED' ? 410 :
        result.errorCode === 'VERSION_CONFLICT' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json(
      {
        data: result.assignment,
        meta: {
          requestId: `req_${Date.now()}`,
          message: 'Affectation finalisée avec succès (KZ09). Capacité et calendrier validés de manière atomique.',
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la finalisation de l’affectation.' } },
      { status: 500 }
    );
  }
}
