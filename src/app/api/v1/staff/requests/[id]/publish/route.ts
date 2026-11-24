// Staff Request Publication Handler (POST /api/v1/staff/requests/[id]/publish)
// Atomically publishes approved staffing request into an OPEN mission (KZ04)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { publishRequestToMission } from '@/modules/requests/service';

const PublishRequestSchema = z.object({
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
    const parsed = PublishRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const publishResult = publishRequestToMission(
      requestId,
      session!.user.userId,
      parsed.data.expectedVersion
    );

    if (!publishResult.success) {
      const status = publishResult.errorCode === 'VERSION_CONFLICT' ? 409 : 400;
      return NextResponse.json(
        { error: { code: publishResult.errorCode, message: publishResult.errorMessage } },
        { status }
      );
    }

    return NextResponse.json(
      {
        data: publishResult.missionData,
        meta: {
          requestId: `req_${Date.now()}`,
          message: 'Mission créée et ouverte aux candidatures de manière atomique (KZ04).',
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la publication de la mission.' } },
      { status: 500 }
    );
  }
}
