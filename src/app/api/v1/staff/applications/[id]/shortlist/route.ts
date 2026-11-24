// Staff Application Shortlist Handler (POST /api/v1/staff/applications/[id]/shortlist)
// Recruiter shortlists eligible candidate application (API.md line 45)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { recruiterShortlistApplication } from '@/modules/applications/service';

const ShortlistSchema = z.object({
  reason: z.string().min(2, 'Motif de sélection requis'),
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

    const { id: applicationId } = await params;
    const body = await request.json();
    const parsed = ShortlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = recruiterShortlistApplication(
      session!.user.userId,
      applicationId,
      parsed.data.reason,
      parsed.data.expectedVersion
    );

    if (!result.success) {
      const status =
        result.errorCode === 'APPLICATION_NOT_FOUND' ? 404 :
        result.errorCode === 'VERSION_CONFLICT' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: result.application,
      meta: {
        requestId: `req_${Date.now()}`,
        message: 'Candidat présélectionné avec succès pour la mission (KZ07).',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la présélection.' } },
      { status: 500 }
    );
  }
}
