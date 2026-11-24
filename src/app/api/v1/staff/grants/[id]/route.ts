// Staff Grant Update Handler (PATCH /api/v1/staff/grants/[id])
// Updates staff member capability status and revokes sessions on status revocation (API.md line 82)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { updateStaffMemberGrant } from '@/modules/admin/service';

const UpdateGrantSchema = z.object({
  status: z.enum(['ACTIVE', 'REVOKED']),
  capabilities: z.array(z.enum(['RECRUITER', 'FINANCE', 'SUPER_ADMIN'])).optional(),
  reason: z.string().min(5),
  expectedVersion: z.number().int().min(1),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'SUPER_ADMIN');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const { id: staffId } = await params;
    const body = await request.json();
    const parsed = UpdateGrantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = updateStaffMemberGrant({
      adminId: session!.user.userId,
      staffId,
      status: parsed.data.status,
      capabilities: parsed.data.capabilities,
      reason: parsed.data.reason,
      expectedVersion: parsed.data.expectedVersion,
    });

    if (!result.success) {
      const status =
        result.errorCode === 'STAFF_NOT_FOUND' ? 404 :
        result.errorCode === 'VERSION_CONFLICT' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: result.staff,
      meta: { requestId: `req_${Date.now()}`, message: 'Habilitation staff mise à jour avec audit.' },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la modification des habilitations.' } },
      { status: 500 }
    );
  }
}
