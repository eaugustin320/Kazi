// Support Case Message Handler (POST /api/v1/support-cases/[id]/messages)
// Appends message to thread; only staff can post STAFF_ONLY visibility (API.md line 64)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/server/auth/rbac';
import { postCaseMessage, getCaseById } from '@/modules/support/service';

const PostMessageSchema = z.object({
  body: z.string().max(4000).optional(),
  bodyText: z.string().max(4000).optional(),
  visibility: z.enum(['PUBLIC_TO_CASE', 'STAFF_ONLY']).optional(),
  isInternalNote: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    const { id: caseId } = await params;
    const caseRecord = getCaseById(caseId);
    if (!caseRecord) {
      return NextResponse.json(
        { error: { code: 'CASE_NOT_FOUND', message: 'Dossier introuvable.' } },
        { status: 404 }
      );
    }

    // Party authorization check
    const isStaff = session.user.role === 'STAFF';
    if (!isStaff) {
      const isOwnerWorker = session.user.role === 'WORKER' && (caseRecord.workerId === session.user.workerProfileId || caseRecord.reporterUserId === session.user.userId);
      const isOwnerCompany = session.user.role === 'COMPANY' && caseRecord.companyId === session.user.companyId;

      if (!isOwnerWorker && !isOwnerCompany) {
        return NextResponse.json(
          { error: { code: 'CASE_NOT_FOUND', message: 'Dossier introuvable.' } },
          { status: 404 }
        );
      }
    }

    const body = await request.json();
    const parsed = PostMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const content = parsed.data.body || parsed.data.bodyText;
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Le message ne peut être vide' } },
        { status: 422 }
      );
    }

    const visibility = parsed.data.visibility || (parsed.data.isInternalNote ? 'STAFF_ONLY' : 'PUBLIC_TO_CASE');

    const result = postCaseMessage({
      caseId,
      authorId: session.user.userId,
      authorRole: session.user.role,
      authorName: session.user.role === 'STAFF' ? 'Support Kazi' : session.user.email || 'Utilisateur',
      body: content,
      visibility,
    });

    if (!result.success) {
      const status = result.errorCode === 'FORBIDDEN_VISIBILITY' ? 403 : 400;
      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json(
      {
        data: result.message,
        meta: { requestId: `req_${Date.now()}` },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de l’envoi du message.' } },
      { status: 500 }
    );
  }
}
