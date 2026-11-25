// Staff Replacement Confirmation Handler (POST /api/v1/staff/replacements/[id]/confirm)
// Recruiter confirms a replacement assignment without fabricating bookings (KZ11)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { staffConfirmReplacement } from '@/modules/attendance/service';

const ConfirmReplacementSchema = z.object({
  replacementAssignmentId: z.string().min(1),
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
    const parsed = ConfirmReplacementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = staffConfirmReplacement(
      session!.user.userId,
      requestId,
      parsed.data.replacementAssignmentId,
      parsed.data.expectedVersion
    );

    if (!result.success) {
      const status =
        result.errorCode === 'REQUEST_NOT_FOUND'
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
      data: result.request,
      meta: { message: 'Remplacement confirmé par le recruteur Kazi.' },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la confirmation du remplacement.' } },
      { status: 500 }
    );
  }
}
