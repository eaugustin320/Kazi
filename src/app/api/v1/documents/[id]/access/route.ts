// Document Access Handler (GET /api/v1/documents/[id]/access)
// Generates a short-lived private download link (5 min expiry) after scope and scan checks (API.md)

import { NextResponse } from 'next/server';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { generateDocumentAccessLink } from '@/server/storage/documents';

export async function GET(
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

    const { id: documentId } = await params;

    let isStaffRecruiter = false;
    if (session.user.role === 'STAFF') {
      const auth = requireStaffCapability(session, 'RECRUITER');
      isStaffRecruiter = auth.authorized;
    }

    const result = generateDocumentAccessLink(documentId, {
      role: session.user.role,
      ownerId: session.user.companyId || session.user.userId,
      isStaffRecruiter,
    });

    if (!result.success) {
      const status =
        result.errorCode === 'DOCUMENT_NOT_FOUND' ? 404 :
        result.errorCode === 'ACCESS_DENIED' ? 404 : // Non-disclosure of private document existence
        result.errorCode === 'DOCUMENT_IN_QUARANTINE' ? 423 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: {
        accessUrl: result.accessUrl,
        expiresInSeconds: result.expiresInSeconds,
      },
      meta: {
        requestId: `req_${Date.now()}`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la génération du lien d’accès.' } },
      { status: 500 }
    );
  }
}
