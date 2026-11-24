// Staff Request Review Handler (POST /api/v1/staff/requests/[id]/review)
// Recruiter reviews submitted staffing request (APPROVE or REQUEST_CORRECTIONS)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { staffReviewRequest } from '@/modules/requests/service';

const ReviewRequestSchema = z.object({
  decision: z.enum(['APPROVE', 'REQUEST_CORRECTIONS']),
  reason: z.string().min(3),
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

    const { id: requestId } = await params;
    const body = await request.json();
    const parsed = ReviewRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = staffReviewRequest(
      requestId,
      session!.user.userId,
      parsed.data.decision,
      parsed.data.reason,
      parsed.data.expectedVersion
    );

    if (!result.success) {
      const status =
        result.errorCode === 'REQUEST_NOT_FOUND' ? 404 :
        result.errorCode === 'VERSION_CONFLICT' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: result.request,
      meta: {
        requestId: `req_${Date.now()}`,
        message: `Demande ${parsed.data.decision === 'APPROVE' ? 'approuvée' : 'renvoyée pour corrections'}.`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la modération de la demande.' } },
      { status: 500 }
    );
  }
}
