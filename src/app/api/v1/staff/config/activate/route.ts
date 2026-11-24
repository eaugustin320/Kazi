// Staff Config Activation Handler (POST /api/v1/staff/config/activate)
// Administrator activates registered versions with audited pointer change (API.md line 79)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { activateConfiguration } from '@/modules/admin/service';

const ActivateSchema = z.object({
  countryConfigVersion: z.string().min(1),
  themeId: z.string().min(1),
  reason: z.string().min(5),
  expectedActivationVersion: z.number().int().min(1),
});

export async function POST(request: Request) {
  try {
    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'SUPER_ADMIN');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const body = await request.json();
    const parsed = ActivateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = activateConfiguration({
      adminId: session!.user.userId,
      countryConfigVersion: parsed.data.countryConfigVersion,
      themeId: parsed.data.themeId,
      reason: parsed.data.reason,
      expectedActivationVersion: parsed.data.expectedActivationVersion,
    });

    if (!result.success) {
      const status = result.errorCode === 'VERSION_CONFLICT' ? 409 : 400;
      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: result.activePointer,
      meta: {
        requestId: `req_${Date.now()}`,
        message: 'Configuration active mise à jour et auditée avec succès.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de l’activation de la configuration.' } },
      { status: 500 }
    );
  }
}
