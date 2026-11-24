// Request Submit Handler (POST /api/v1/requests/[id]/submit)
// Submits a draft request for Kazi recruiter review (DRAFT -> SUBMITTED)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireCompanyScope } from '@/server/auth/rbac';
import { submitRequest } from '@/modules/requests/service';

const SubmitSchema = z.object({
  expectedVersion: z.number().int().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    if (!session || session.user.role !== 'COMPANY' || !session.user.companyId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED_COMPANY', message: 'Seule une entreprise authentifiée peut soumettre une demande.' } },
        { status: 403 }
      );
    }

    const { id: requestId } = await params;
    let expectedVersion = 1;
    try {
      const body = await request.json();
      if (typeof body?.expectedVersion === 'number') {
        expectedVersion = body.expectedVersion;
      }
    } catch {}

    const result = submitRequest(requestId, session.user.companyId, expectedVersion);

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
        message: 'Demande soumise aux équipes de recrutement Kazi avec succès.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la soumission de la demande.' } },
      { status: 500 }
    );
  }
}
