// Staff Config Preview Handler (POST /api/v1/staff/config/preview)
// Administrator previews registered country/theme configuration without activation (API.md line 78)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { previewConfiguration } from '@/modules/admin/service';

const PreviewSchema = z.object({
  countryConfigVersion: z.string().min(1),
  themeId: z.string().min(1),
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
    const parsed = PreviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = previewConfiguration(parsed.data.countryConfigVersion, parsed.data.themeId);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data: {
        country: result.country,
        theme: result.theme,
      },
      meta: {
        requestId: `req_${Date.now()}`,
        notice: 'Aperçu sans activation persistante. Les valeurs d’aperçu ne modifient pas les règles métier.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la prévisualisation.' } },
      { status: 500 }
    );
  }
}
