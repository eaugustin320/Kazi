// Staff Assignment Finalization API Route Handler (POST /api/v1/staff/finalization)
// Enforces KZ08 (dual confirmation) and KZ09 (atomic capacity & schedule check)

import { NextResponse } from 'next/server';
import { AssignmentFinalizeSchema } from '@/modules/recruitment/validation';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { staffFinalizeAssignment, recruiterListReadyProposals } from '@/modules/applications/service';

export async function GET(request: Request) {
  try {
    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'RECRUITER');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const proposals = recruiterListReadyProposals();
    return NextResponse.json({
      data: proposals,
      meta: { requestId: `req_${Date.now()}` },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération des propositions.' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = AssignmentFinalizeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            messageKey: 'errors.invalidInput',
            fields: parsed.error.flatten().fieldErrors,
            requestId: `req_${Date.now()}`,
          },
        },
        { status: 422 }
      );
    }

    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'RECRUITER');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const idempotencyKey = request.headers.get('Idempotency-Key') || undefined;
    const result = staffFinalizeAssignment(
      session!.user.userId,
      parsed.data.proposalId,
      parsed.data.expectedVersion || 1,
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
        meta: { requestId: `req_${Date.now()}` },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'SERVER_ERROR',
          messageKey: 'errors.internal',
          requestId: `req_${Date.now()}`,
        },
      },
      { status: 500 }
    );
  }
}
