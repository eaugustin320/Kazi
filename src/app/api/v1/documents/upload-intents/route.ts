// Document Upload Intent Route Handler (POST /api/v1/documents/upload-intents)
// Enforces API.md rules: purpose, declared type/size and scoped owner; returns quarantine upload target

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/server/auth/rbac';
import { createUploadIntent, MAX_DOCUMENT_SIZE_BYTES, ALLOWED_MIME_TYPES } from '@/server/storage/documents';

const UploadIntentSchema = z.object({
  purpose: z.enum(['COMPANY_RCCM', 'COMPANY_FICHE_CIRCUIT', 'WORKER_CNI']),
  fileName: z.string().min(1).max(150),
  mimeType: z.string(),
  sizeBytes: z.number().int().min(1).max(MAX_DOCUMENT_SIZE_BYTES),
});

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
    const parsed = UploadIntentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const { purpose, fileName, mimeType, sizeBytes } = parsed.data;

    // Scoped owner resolution
    const ownerType = purpose === 'WORKER_CNI' ? 'WORKER' : 'COMPANY';
    const ownerId =
      ownerType === 'WORKER' ? session.user.workerProfileId : session.user.companyId;

    if (!ownerId) {
      return NextResponse.json(
        { error: { code: 'MISSING_OWNER_SCOPE', message: 'Profil ou entreprise introuvable dans votre session.' } },
        { status: 403 }
      );
    }

    const intent = createUploadIntent({
      ownerType,
      ownerId,
      purpose,
      fileName,
      mimeType,
      sizeBytes,
    });

    if (!intent.success) {
      return NextResponse.json(
        { error: { code: intent.errorCode, message: intent.errorMessage } },
        { status: intent.errorCode === 'UNSUPPORTED_MEDIA_TYPE' ? 415 : 400 }
      );
    }

    return NextResponse.json(
      {
        data: {
          documentId: intent.documentId,
          uploadTarget: intent.uploadTarget,
        },
        meta: {
          requestId: `req_${Date.now()}`,
          message: 'Cible de téléversement en zone de quarantaine générée.',
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la création de l’intention de téléversement.' } },
      { status: 500 }
    );
  }
}
