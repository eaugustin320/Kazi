// Phase D3 Integration Tests: Documents, Verification, Requests & Atomic Publication
// Enforces PRD.md (KZ01-KZ04), WORKFLOWS.md, and API.md

import { describe, it, expect, beforeEach } from 'vitest';
import { get as dbGet, query as dbQuery } from '../src/server/db/database';
import {
  createUploadIntent,
  completeDocumentUpload,
  generateDocumentAccessLink,
  staffReviewDocument,
  resetDocumentStore,
  MAX_DOCUMENT_SIZE_BYTES,
} from '../src/server/storage/documents';
import {
  saveCompany,
  getCompanyById,
  updateCompanyProfile,
  staffReviewCompany,
  resetCompanyStore,
} from '../src/modules/companies/service';
import {
  createDraftRequest,
  submitRequest,
  staffReviewRequest,
  publishRequestToMission,
  resetRequestStore,
  ProposedTerms,
} from '../src/modules/requests/service';

describe('Phase D3: Verification Documents & Staffing Requests Lifecycle', () => {
  beforeEach(() => {
    resetDocumentStore();
    resetCompanyStore();
    resetRequestStore();
  });

  // 1. Document Upload Intents & Private Object Security
  describe('Verification Documents Pipeline', () => {
    it('creates upload intent in quarantine for valid PDF', () => {
      const intent = createUploadIntent({
        ownerType: 'COMPANY',
        ownerId: 'company-a',
        purpose: 'COMPANY_RCCM',
        fileName: 'rccm_btp_horizon.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 500, // 500 KB
      });

      expect(intent.success).toBe(true);
      expect(intent.documentId).toBeDefined();
      expect(intent.uploadTarget?.objectKey).toContain('quarantine/company/company-a/');
    });

    it('rejects executable or unsupported file formats', () => {
      const intent = createUploadIntent({
        ownerType: 'COMPANY',
        ownerId: 'company-a',
        purpose: 'COMPANY_RCCM',
        fileName: 'script.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1000,
      });

      expect(intent.success).toBe(false);
      expect(intent.errorCode).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects documents exceeding 5 MiB size limit', () => {
      const intent = createUploadIntent({
        ownerType: 'WORKER',
        ownerId: 'worker-01',
        purpose: 'WORKER_CNI',
        fileName: 'heavy_scan.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: MAX_DOCUMENT_SIZE_BYTES + 1,
      });

      expect(intent.success).toBe(false);
      expect(intent.errorCode).toBe('FILE_TOO_LARGE');
    });

    it('refuses access to documents in quarantine before scan completion', () => {
      const intent = createUploadIntent({
        ownerType: 'COMPANY',
        ownerId: 'company-a',
        purpose: 'COMPANY_RCCM',
        fileName: 'rccm.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10000,
      });

      const access = generateDocumentAccessLink(intent.documentId!, {
        role: 'COMPANY',
        ownerId: 'company-a',
      });

      expect(access.success).toBe(false);
      expect(access.errorCode).toBe('DOCUMENT_IN_QUARANTINE');
    });

    it('enforces tenant scope isolation: Company B cannot access Company A document', () => {
      const intent = createUploadIntent({
        ownerType: 'COMPANY',
        ownerId: 'company-a',
        purpose: 'COMPANY_RCCM',
        fileName: 'rccm.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10000,
      });

      // Scan completes successfully
      completeDocumentUpload(intent.documentId!, 'company-a');

      // Company B attempts access -> ACCESS_DENIED
      const accessB = generateDocumentAccessLink(intent.documentId!, {
        role: 'COMPANY',
        ownerId: 'company-b',
      });
      expect(accessB.success).toBe(false);
      expect(accessB.errorCode).toBe('ACCESS_DENIED');

      // Owning Company A accesses -> SUCCESS
      const accessA = generateDocumentAccessLink(intent.documentId!, {
        role: 'COMPANY',
        ownerId: 'company-a',
      });
      expect(accessA.success).toBe(true);
      expect(accessA.accessUrl).toBeDefined();

      // Staff Recruiter accesses -> SUCCESS
      const accessStaff = generateDocumentAccessLink(intent.documentId!, {
        role: 'STAFF',
        isStaffRecruiter: true,
      });
      expect(accessStaff.success).toBe(true);
    });
  });

  // 2. Company Verification Workflow
  describe('Company Verification & Profile Lifecycle (KZ02)', () => {
    it('material changes reset VERIFIED status to PENDING until re-approved', () => {
      saveCompany({
        id: 'company-a',
        countryCode: 'GA',
        legalName: 'BTP Horizon Gabon',
        tradeSector: 'Génie Civil',
        registrationReference: 'RG/FCV 2021 B 1409',
        taxReference: '098432-A',
        areaCode: 'libreville',
        address: 'Boulevard Triomphal, Libreville',
        contactEmail: 'contact@btphorizon.ga',
        contactPhone: '+24107451234',
        verificationStatus: 'VERIFIED',
        version: 1,
      });

      // Non-material change: phone update preserves VERIFIED status
      const nonMaterial = updateCompanyProfile('company-a', { contactPhone: '+24107998877' }, 1);
      expect(nonMaterial.success).toBe(true);
      expect(nonMaterial.company?.verificationStatus).toBe('VERIFIED');
      expect(nonMaterial.company?.version).toBe(2);

      // Material change: RCCM modification resets to PENDING
      const material = updateCompanyProfile(
        'company-a',
        { registrationReference: 'RG/FCV 2026 B 9999' },
        2
      );
      expect(material.success).toBe(true);
      expect(material.company?.verificationStatus).toBe('PENDING');
      expect(material.company?.version).toBe(3);
    });

    it('enforces optimistic locking on company profile updates', () => {
      saveCompany({
        id: 'company-a',
        countryCode: 'GA',
        legalName: 'BTP Horizon',
        tradeSector: 'BTP',
        registrationReference: 'RCCM-01',
        taxReference: 'NIF-01',
        areaCode: 'libreville',
        address: 'Libreville',
        contactEmail: 'info@btp.ga',
        contactPhone: '+24107000000',
        verificationStatus: 'VERIFIED',
        version: 1,
      });

      // Submit with stale expectedVersion 99
      const staleUpdate = updateCompanyProfile('company-a', { contactPhone: '+24107111111' }, 99);
      expect(staleUpdate.success).toBe(false);
      expect(staleUpdate.errorCode).toBe('VERSION_CONFLICT');
    });
  });

  // 3. Staffing Request & Atomic Mission Publication (KZ03, KZ04)
  describe('Staffing Request & Atomic Publication (KZ03, KZ04)', () => {
    const validTerms: ProposedTerms = {
      tradeCode: 'Coffreur',
      headcount: 4,
      siteName: 'Chantier Le Méridien',
      commune: 'Libreville',
      siteAddress: 'Boulevard Bord de Mer, Libreville',
      startsAt: '2026-12-01',
      endsAt: '2026-12-05',
      dailyHours: '07h30 - 16h30',
      dayPayXAF: 15000,
      equipmentRequirements: 'Chaussures de sécurité coquées',
    };

    it('follows request lifecycle: DRAFT -> SUBMITTED -> APPROVED', () => {
      const draft = createDraftRequest('company-a', 'usr_owner_1', validTerms);
      expect(draft.status).toBe('DRAFT');
      expect(draft.version).toBe(1);

      // Submit to Kazi review
      const submitted = submitRequest(draft.id, 'company-a', 1);
      expect(submitted.success).toBe(true);
      expect(submitted.request?.status).toBe('SUBMITTED');
      expect(submitted.request?.version).toBe(2);

      // Staff recruiter approves
      const approved = staffReviewRequest(
        draft.id,
        'staff-recruiter-01',
        'APPROVE',
        'Conditions et rémunération validées.',
        2
      );
      expect(approved.success).toBe(true);
      expect(approved.request?.status).toBe('APPROVED');
      expect(approved.request?.version).toBe(3);
    });

    it('rejects submission if daily wage is below 5 000 FCFA', () => {
      const underpaidTerms = { ...validTerms, dayPayXAF: 4000 };
      const draft = createDraftRequest('company-a', 'usr_owner_1', underpaidTerms);

      const submit = submitRequest(draft.id, 'company-a', 1);
      expect(submit.success).toBe(false);
      expect(submit.errorCode).toBe('PAY_BELOW_MINIMUM');
    });

    it('KZ04 Invariant: Rejects publication if request is not approved', () => {
      const draft = createDraftRequest('company-a', 'usr_owner_1', validTerms);
      // Still in DRAFT
      const pub = publishRequestToMission(draft.id, 'staff-01', 1);
      expect(pub.success).toBe(false);
      expect(pub.errorCode).toBe('REQUEST_NOT_APPROVED');
    });

    it('KZ04 Invariant: Rejects publication if company is not VERIFIED', () => {
      // Company is PENDING
      saveCompany({
        id: 'company-unverified',
        countryCode: 'GA',
        legalName: 'Société Non Vérifiée',
        tradeSector: 'BTP',
        registrationReference: 'RCCM-99',
        taxReference: 'NIF-99',
        areaCode: 'libreville',
        address: 'Libreville',
        contactEmail: 'contact@nonverif.ga',
        contactPhone: '+24107001122',
        verificationStatus: 'PENDING',
        version: 1,
      });

      const draft = createDraftRequest('company-unverified', 'usr_owner_2', validTerms);
      submitRequest(draft.id, 'company-unverified', 1);
      staffReviewRequest(draft.id, 'staff-01', 'APPROVE', 'Demande OK mais entreprise en attente', 2);

      // Attempt publication
      const pub = publishRequestToMission(draft.id, 'staff-01', 3);
      expect(pub.success).toBe(false);
      expect(pub.errorCode).toBe('COMPANY_NOT_VERIFIED');
    });

    it('KZ04 Invariant: Successfully publishes when request is APPROVED and company is VERIFIED', () => {
      saveCompany({
        id: 'company-verified',
        countryCode: 'GA',
        legalName: 'BTP Horizon Gabon',
        tradeSector: 'Génie Civil',
        registrationReference: 'RG/FCV 2021 B 1409',
        taxReference: '098432-A',
        areaCode: 'libreville',
        address: 'Libreville',
        contactEmail: 'contact@btphorizon.ga',
        contactPhone: '+24107451234',
        verificationStatus: 'VERIFIED',
        version: 1,
      });

      const draft = createDraftRequest('company-verified', 'usr_owner_1', validTerms);
      submitRequest(draft.id, 'company-verified', 1);
      staffReviewRequest(draft.id, 'staff-01', 'APPROVE', 'Conforme aux termes', 2);

      // Atomic publication
      const pub = publishRequestToMission(draft.id, 'staff-01', 3);
      expect(pub.success).toBe(true);
      expect(pub.missionData?.status).toBe('OPEN');
      expect(pub.missionData?.termsRevision).toBe(1);
      expect(pub.missionData?.daysCount).toBe(5);

      // Verify mission, terms, and days were persisted in SQLite database
      const dbMission = dbGet<{ id: string; status: string }>('SELECT id, status FROM missions WHERE id = ?;', [pub.missionData?.missionId]);
      expect(dbMission).not.toBeNull();
      expect(dbMission?.status).toBe('OPEN');

      const dbTerms = dbGet<{ id: string; pay_amount: number }>('SELECT id, pay_amount FROM mission_terms WHERE id = ?;', [pub.missionData?.termsId]);
      expect(dbTerms).not.toBeNull();
      expect(dbTerms?.pay_amount).toBe(15000);

      const dbDays = dbQuery('SELECT id FROM mission_days WHERE terms_id = ?;', [pub.missionData?.termsId]);
      expect(dbDays.length).toBe(5);

      // Re-publication attempt is rejected
      const doublePub = publishRequestToMission(draft.id, 'staff-01', 4);
      expect(doublePub.success).toBe(false);
      expect(doublePub.errorCode).toBe('ALREADY_PUBLISHED');
    });

    it('persists verification document to SQLite database', () => {
      const intent = createUploadIntent({
        ownerType: 'COMPANY',
        ownerId: 'company-a',
        purpose: 'COMPANY_RCCM',
        fileName: 'rccm_persisted.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
      });

      const docRow = dbGet<{ id: string; file_name: string; scan_status: string }>(
        'SELECT id, file_name, scan_status FROM verification_documents WHERE id = ?;',
        [intent.documentId]
      );
      expect(docRow).not.toBeNull();
      expect(docRow?.file_name).toBe('rccm_persisted.pdf');
      expect(docRow?.scan_status).toBe('PENDING');
    });
  });
});
