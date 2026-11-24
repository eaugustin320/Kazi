// Kazi Company Verification & Profile Service
// Implements PRD.md KZ02 and WORKFLOWS.md rules
// Backed by SQLite persistence with optimistic concurrency locking

import { execute, get, query } from '../../server/db/database';

export interface CompanyRecord {
  id: string;
  countryCode: string;
  legalName: string;
  tradeSector?: string;
  registrationReference?: string; // RCCM
  taxReference?: string;          // NIF
  areaCode: string;
  address?: string;
  contactEmail: string;
  contactPhone?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'CHANGES_REQUESTED';
  version: number;
}

// In-memory cache for fast lookups
const companyStore = new Map<string, CompanyRecord>();

export function getCompanyById(companyId: string): CompanyRecord | null {
  // 1. Check cache
  if (companyStore.has(companyId)) {
    return companyStore.get(companyId)!;
  }

  // 2. Query SQLite database
  try {
    const row = get<{
      id: string;
      country_code: string;
      legal_name: string;
      trade_sector?: string;
      registration_reference?: string;
      tax_reference?: string;
      area_code: string;
      address?: string;
      contact_email: string;
      contact_phone?: string;
      verification_status: 'PENDING' | 'VERIFIED' | 'CHANGES_REQUESTED';
      version: number;
    }>('SELECT * FROM companies WHERE id = ?;', [companyId]);

    if (!row) return null;

    const company: CompanyRecord = {
      id: row.id,
      countryCode: row.country_code,
      legalName: row.legal_name,
      tradeSector: row.trade_sector ?? undefined,
      registrationReference: row.registration_reference ?? undefined,
      taxReference: row.tax_reference ?? undefined,
      areaCode: row.area_code,
      address: row.address ?? undefined,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone ?? undefined,
      verificationStatus: row.verification_status,
      version: row.version,
    };

    companyStore.set(companyId, company);
    return company;
  } catch {
    return null;
  }
}

export function saveCompany(company: CompanyRecord): void {
  companyStore.set(company.id, company);
  const nowIso = new Date().toISOString();

  try {
    execute(
      `INSERT INTO companies (
         id, country_code, legal_name, trade_sector, registration_reference,
         tax_reference, area_code, address, contact_email, contact_phone,
         verification_status, version, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         country_code = excluded.country_code,
         legal_name = excluded.legal_name,
         trade_sector = excluded.trade_sector,
         registration_reference = excluded.registration_reference,
         tax_reference = excluded.tax_reference,
         area_code = excluded.area_code,
         address = excluded.address,
         contact_email = excluded.contact_email,
         contact_phone = excluded.contact_phone,
         verification_status = excluded.verification_status,
         version = excluded.version,
         updated_at = excluded.updated_at;`,
      [
        company.id,
        company.countryCode || 'GA',
        company.legalName,
        company.tradeSector ?? null,
        company.registrationReference ?? null,
        company.taxReference ?? null,
        company.areaCode || 'libreville',
        company.address ?? null,
        company.contactEmail,
        company.contactPhone ?? null,
        company.verificationStatus,
        company.version,
        nowIso,
        nowIso,
      ]
    );
  } catch {}
}

/**
 * Updates company profile with optimistic locking.
 * Material changes (e.g. RCCM, legal name) reset verificationStatus from VERIFIED to PENDING.
 */
export function updateCompanyProfile(
  companyId: string,
  updates: Partial<Pick<CompanyRecord, 'legalName' | 'tradeSector' | 'address' | 'contactPhone' | 'registrationReference' | 'taxReference'>>,
  expectedVersion: number
): { success: boolean; company?: CompanyRecord; errorCode?: string; errorMessage?: string } {
  const company = getCompanyById(companyId);
  if (!company) {
    return { success: false, errorCode: 'COMPANY_NOT_FOUND', errorMessage: 'Entreprise introuvable.' };
  }

  if (company.version !== expectedVersion) {
    return {
      success: false,
      errorCode: 'VERSION_CONFLICT',
      errorMessage: 'Conflit de version : l’entreprise a été modifiée par un autre utilisateur. Veuillez actualiser.',
    };
  }

  // Material change check
  const isMaterialChange =
    (updates.legalName !== undefined && updates.legalName !== company.legalName) ||
    (updates.registrationReference !== undefined && updates.registrationReference !== company.registrationReference) ||
    (updates.taxReference !== undefined && updates.taxReference !== company.taxReference);

  const updated: CompanyRecord = {
    ...company,
    ...updates,
    verificationStatus: isMaterialChange && company.verificationStatus === 'VERIFIED' ? 'PENDING' : company.verificationStatus,
    version: company.version + 1,
  };

  saveCompany(updated);
  return { success: true, company: updated };
}

/**
 * Staff review of company legal profile (KZ02).
 */
export function staffReviewCompany(
  companyId: string,
  staffId: string,
  decision: 'APPROVE' | 'REQUEST_CORRECTIONS',
  reason: string,
  expectedVersion: number
): { success: boolean; company?: CompanyRecord; errorCode?: string; errorMessage?: string } {
  const company = getCompanyById(companyId);
  if (!company) {
    return { success: false, errorCode: 'COMPANY_NOT_FOUND', errorMessage: 'Entreprise introuvable.' };
  }

  if (company.version !== expectedVersion) {
    return {
      success: false,
      errorCode: 'VERSION_CONFLICT',
      errorMessage: 'Conflit de version sur l’entreprise.',
    };
  }

  const updated: CompanyRecord = {
    ...company,
    verificationStatus: decision === 'APPROVE' ? 'VERIFIED' : 'CHANGES_REQUESTED',
    version: company.version + 1,
  };

  saveCompany(updated);
  return { success: true, company: updated };
}

export function resetCompanyStore(): void {
  companyStore.clear();
  try {
    execute('DELETE FROM companies WHERE id NOT LIKE "comp_fixture%";');
  } catch {}
}
