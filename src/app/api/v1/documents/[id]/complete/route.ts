// Document Upload Complete Handler (POST /api/v1/documents/[id]/complete)
// Verifies upload metadata, queues scan; never self-approves a document (API.md rule)

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/rbac';
import { completeDocumentUpload } from '@/server/storage/documents';

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

    const { id: documentId } = await params;
    const ownerId = session.user.role === 'WORKER' ? session.user.workerProfileId : session.user.companyId;

    if (!ownerId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED_SCOPE', message: 'Portée introuvable.' } },
        { status: 403 }
      );
    }

    const result = completeDocumentUpload(documentId, ownerId);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status: result.errorCode === 'DOCUMENT_NOT_FOUND' ? 404 : 403 }
      );
    }

    return NextResponse.json({
      data: {
        documentId,
        scanStatus: result.document?.scanStatus,
        reviewStatus: result.document?.reviewStatus,
      },
      meta: {
        requestId: `req_${Date.now()}`,
        message: 'Téléversement finalisé. Document mis en file d’analyse antivirus.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la finalisation du document.' } },
      { status: 500 }
    );
  }
}
