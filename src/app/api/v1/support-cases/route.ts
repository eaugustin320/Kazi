// Support Cases Collection Handler (GET / POST /api/v1/support-cases)
// Creates or lists scoped support cases (API.md line 62)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/server/auth/rbac';
import { createSupportCase, listUserCases, CaseCategory } from '@/modules/support/service';

const CreateCaseSchema = z.object({
  category: z.enum(['CHANTIER', 'PAIEMENT', 'POINTAGE', 'ACCES']),
  subject: z.string().min(3).max(200),
  initialMessage: z.string().min(5).max(4000),
  missionId: z.string().optional(),
  assignmentId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    const cases = listUserCases({
      userId: session.user.userId,
      role: session.user.role,
      companyId: session.user.companyId,
      workerId: session.user.workerProfileId,
    });

    return NextResponse.json({
      data: cases,
      meta: { requestId: `req_${Date.now()}`, limit: 20 },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération des dossiers de support.' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = CreateCaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = createSupportCase({
      reporterUserId: session.user.userId,
      role: session.user.role,
      companyId: session.user.companyId,
      workerId: session.user.workerProfileId,
      missionId: parsed.data.missionId,
      assignmentId: parsed.data.assignmentId,
      category: parsed.data.category as CaseCategory,
      subject: parsed.data.subject,
      initialMessage: parsed.data.initialMessage,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        data: result.caseRecord,
        meta: {
          requestId: `req_${Date.now()}`,
          message: 'Dossier d’assistance ouvert avec succès. Un agent Kazi prendra contact sous peu.',
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la création du dossier.' } },
      { status: 500 }
    );
  }
}
