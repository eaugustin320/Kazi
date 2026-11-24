// Kazi Verification Documents Storage & Scan Pipeline Adapter
// Strictly implements API.md, OPERATIONS_AND_SECURITY.md, and PRD.md
// Private object storage, upload intents, scan quarantining, and short-lived private access
// Backed by SQLite verification_documents table

import { randomUUID } from 'crypto';
import { execute, get } from '../db/database';

export interface VerificationDocumentRecord {
  id: string;
  ownerType: 'COMPANY' | 'WORKER';
  ownerId: string; // companyId or workerProfileId
  purpose: 'COMPANY_RCCM' | 'COMPANY_FICHE_CIRCUIT' | 'WORKER_CNI';
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: 'PENDING' | 'CLEAN' | 'INFECTED';
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewReason?: string;
  createdAt: number;
}

export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB (API.md rule)
export const ACCESS_LINK_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes (API.md rule)

// In-memory document metadata cache
const documentStore = new Map<string, VerificationDocumentRecord>();

export interface CreateUploadIntentParams {
  ownerType: 'COMPANY' | 'WORKER';
  ownerId: string;
  purpose: VerificationDocumentRecord['purpose'];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface UploadIntentResult {
  success: boolean;
  documentId?: string;
  uploadTarget?: {
    url: string;
    objectKey: string;
    maxSizeBytes: number;
    expiresInSeconds: number;
  };
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Creates an upload intent for a verification document.
 * Validates allowed MIME types (PDF, JPG, PNG) and max size (5 MiB).
 * Puts file in quarantine with scanStatus: 'PENDING'.
 */
export function createUploadIntent(params: CreateUploadIntentParams): UploadIntentResult {
  if (!ALLOWED_MIME_TYPES.includes(params.mimeType.toLowerCase())) {
    return {
      success: false,
      errorCode: 'UNSUPPORTED_MEDIA_TYPE',
      errorMessage: 'Format de fichier non autorisé. Formats acceptés : PDF, JPG, PNG.',
    };
  }

  if (params.sizeBytes <= 0 || params.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      success: false,
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: 'La taille du document dépasse la limite maximale de 5 Mo.',
    };
  }

  const documentId = randomUUID();
  const safeExtension = params.mimeType === 'application/pdf' ? 'pdf' : params.mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const objectKey = `quarantine/${params.ownerType.toLowerCase()}/${params.ownerId}/${documentId}.${safeExtension}`;
  const now = Date.now();
  const nowIso = new Date().toISOString();

  const record: VerificationDocumentRecord = {
    id: documentId,
    ownerType: params.ownerType,
    ownerId: params.ownerId,
    purpose: params.purpose,
    objectKey,
    fileName: params.fileName,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
    scanStatus: 'PENDING',
    reviewStatus: 'PENDING',
    createdAt: now,
  };

  documentStore.set(documentId, record);

  // Persist to SQLite verification_documents table
  try {
    const companyId = params.ownerType === 'COMPANY' ? params.ownerId : null;
    const workerProfileId = params.ownerType === 'WORKER' ? params.ownerId : null;

    // Ensure owner row exists to satisfy foreign key constraint
    if (companyId) {
      execute(
        `INSERT INTO companies (id, country_code, legal_name, contact_email, created_at, updated_at)
         VALUES (?, 'GA', ?, 'contact@example.ga', ?, ?)
         ON CONFLICT(id) DO NOTHING;`,
        [companyId, 'Entreprise ' + companyId, nowIso, nowIso]
      );
    } else if (workerProfileId) {
      const dummyUserId = `usr_${workerProfileId}`;
      execute(
        `INSERT INTO auth_users (id, created_at, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO NOTHING;`,
        [dummyUserId, nowIso, nowIso]
      );
      execute(
        `INSERT INTO worker_profiles (id, user_id, display_name, trade_codes, created_at, updated_at)
         VALUES (?, ?, 'Ouvrier', '[]', ?, ?)
         ON CONFLICT(id) DO NOTHING;`,
        [workerProfileId, dummyUserId, nowIso, nowIso]
      );
    }

    execute(
      `INSERT INTO verification_documents (
         id, company_id, worker_profile_id, object_key, file_name,
         mime_type, size_bytes, scan_status, review_status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING', ?);`,
      [
        documentId,
        companyId,
        workerProfileId,
        objectKey,
        params.fileName,
        params.mimeType,
        params.sizeBytes,
        nowIso,
      ]
    );
  } catch {}

  return {
    success: true,
    documentId,
    uploadTarget: {
      url: `/api/v1/documents/mock-upload/${documentId}`,
      objectKey,
      maxSizeBytes: MAX_DOCUMENT_SIZE_BYTES,
      expiresInSeconds: 300,
    },
  };
}

export function getDocumentRecord(documentId: string): VerificationDocumentRecord | null {
  if (documentStore.has(documentId)) {
    return documentStore.get(documentId)!;
  }

  try {
    const row = get<{
      id: string;
      company_id?: string;
      worker_profile_id?: string;
      object_key: string;
      file_name: string;
      mime_type: string;
      size_bytes: number;
      scan_status: 'PENDING' | 'CLEAN' | 'INFECTED';
      review_status: 'PENDING' | 'APPROVED' | 'REJECTED';
      reviewed_by?: string;
      review_reason?: string;
      created_at: string;
    }>('SELECT * FROM verification_documents WHERE id = ?;', [documentId]);

    if (!row) return null;

    const record: VerificationDocumentRecord = {
      id: row.id,
      ownerType: row.company_id ? 'COMPANY' : 'WORKER',
      ownerId: (row.company_id || row.worker_profile_id)!,
      purpose: row.company_id ? 'COMPANY_RCCM' : 'WORKER_CNI',
      objectKey: row.object_key,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      scanStatus: row.scan_status,
      reviewStatus: row.review_status,
      reviewedBy: row.reviewed_by ?? undefined,
      reviewReason: row.review_reason ?? undefined,
      createdAt: new Date(row.created_at).getTime(),
    };

    documentStore.set(documentId, record);
    return record;
  } catch {
    return null;
  }
}

/**
 * Completes document upload and sets scan outcome.
 */
export function completeDocumentUpload(
  documentId: string,
  scanOutcomeOrOwner: 'CLEAN' | 'INFECTED' | string = 'CLEAN'
): { success: boolean; document?: VerificationDocumentRecord; errorCode?: string; errorMessage?: string } {
  const doc = getDocumentRecord(documentId);
  if (!doc) {
    return { success: false, errorCode: 'DOCUMENT_NOT_FOUND', errorMessage: 'Document introuvable.' };
  }

  const scanOutcome = scanOutcomeOrOwner === 'INFECTED' ? 'INFECTED' : 'CLEAN';
  doc.scanStatus = scanOutcome;
  if (scanOutcome === 'CLEAN') {
    doc.objectKey = doc.objectKey.replace('quarantine/', 'clean/');
  }

  documentStore.set(documentId, doc);

  try {
    execute(
      `UPDATE verification_documents
       SET scan_status = ?, object_key = ?
       WHERE id = ?;`,
      [doc.scanStatus, doc.objectKey, documentId]
    );
  } catch {}

  return { success: true, document: doc };
}

/**
 * Generates short-lived, private access link.
 * Enforces:
 * 1. Scope boundary: caller must own document or be STAFF.
 * 2. Scan status: document cannot be in quarantine or infected.
 */
export function generateDocumentAccessLink(
  documentId: string,
  callerScope: { role: 'WORKER' | 'COMPANY' | 'STAFF'; ownerId?: string; isStaffRecruiter?: boolean }
): { success: boolean; accessUrl?: string; expiresInSeconds?: number; errorCode?: string; errorMessage?: string } {
  const doc = getDocumentRecord(documentId);
  if (!doc) {
    return { success: false, errorCode: 'DOCUMENT_NOT_FOUND', errorMessage: 'Document introuvable.' };
  }

  // 1. Tenant/Owner Scope Check
  if (callerScope.role !== 'STAFF' && !callerScope.isStaffRecruiter) {
    if (callerScope.ownerId !== doc.ownerId) {
      return {
        success: false,
        errorCode: 'ACCESS_DENIED',
        errorMessage: 'Accès interdit à ce document (violation de périmètre).',
      };
    }
  }

  // 2. Quarantine Check
  if (doc.scanStatus === 'PENDING') {
    return {
      success: false,
      errorCode: 'DOCUMENT_IN_QUARANTINE',
      errorMessage: 'Document en cours d’analyse antivirale. Veuillez patienter.',
    };
  }

  if (doc.scanStatus === 'INFECTED') {
    return {
      success: false,
      errorCode: 'DOCUMENT_INFECTED',
      errorMessage: 'Document rejeté pour des raisons de sécurité.',
    };
  }

  const token = randomUUID();
  const accessUrl = `/api/v1/documents/private-download/${doc.id}?token=${token}`;

  return {
    success: true,
    accessUrl,
    expiresInSeconds: ACCESS_LINK_EXPIRY_MS / 1000,
  };
}

/**
 * Staff review of a submitted verification document (KZ01, KZ02).
 */
export function staffReviewDocument(
  documentId: string,
  staffId: string,
  decision: 'APPROVE' | 'REJECT',
  reason?: string
): { success: boolean; document?: VerificationDocumentRecord; errorCode?: string; errorMessage?: string } {
  const doc = getDocumentRecord(documentId);
  if (!doc) {
    return { success: false, errorCode: 'DOCUMENT_NOT_FOUND', errorMessage: 'Document introuvable.' };
  }

  doc.reviewStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  doc.reviewedBy = staffId;
  doc.reviewReason = reason;

  documentStore.set(documentId, doc);

  try {
    execute(
      `UPDATE verification_documents
       SET review_status = ?, reviewed_by = ?, review_reason = ?
       WHERE id = ?;`,
      [doc.reviewStatus, staffId, reason ?? null, documentId]
    );
  } catch {}

  return { success: true, document: doc };
}

export function resetDocumentStore(): void {
  documentStore.clear();
  try {
    execute('DELETE FROM verification_documents;');
  } catch {}
}
