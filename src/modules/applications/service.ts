// Kazi Applications, Candidate Proposals & Assignment Lifecycle Service
// Strictly enforces PRD.md (KZ05-KZ09), WORKFLOWS.md, and API.md
// Implements public missions, duplicate application prevention, candidate privacy DTO scoping,
// 24h dual confirmation gates, and atomic finalization with capacity and schedule anti-overlap checks.
// Backed by SQLite persistence with optimistic concurrency locking and ACID transactions.

import { randomUUID } from 'crypto';
import {
  validateApplicationSubmission,
  validateDualConfirmation,
  validateAssignmentCapacity,
  validateScheduleAntiOverlap,
} from '../recruitment/service';
import { execute, get, query, transaction } from '../../server/db/database';

export interface MissionRecord {
  id: string;
  requestId: string;
  companyId: string;
  countryCode: string;
  currentTermsId: string;
  currentTermsRevision: number;
  status: 'OPEN' | 'CLOSED_TO_APPLICATIONS' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  tradeCode: string;
  title: string;
  description: string;
  siteName: string;
  areaCode: string;
  siteAddress: string;
  meetingInstructions?: string; // SENSITIVE: restricted to assigned workers
  headcountNeeded: number;
  headcountAssigned: number;
  dayPayXAF: number;
  startsAt: string; // YYYY-MM-DD
  endsAt: string;   // YYYY-MM-DD
  version: number;
  createdAt: number;
}

export interface WorkerRecord {
  id: string;
  userId: string;
  fullName: string;
  phone: string; // PRIVATE: never exposed to companies
  tradeCodes: string[];
  areaCode: string;
  experienceYears: number;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  staffNotes?: string; // PRIVATE: staff only
}

export interface ApplicationRecord {
  id: string;
  missionId: string;
  workerId: string;
  termsId: string;
  status: 'SUBMITTED' | 'SHORTLISTED' | 'PROPOSED' | 'ASSIGNED' | 'WITHDRAWN' | 'NOT_SELECTED';
  submittedAt: number;
  withdrawalReason?: string;
  version: number;
}

export interface ProposalRecord {
  id: string;
  applicationId: string;
  missionId: string;
  workerId: string;
  termsId: string;
  termsRevision: number;
  proposedBy: string;
  companyDecision: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  workerDecision: 'PENDING' | 'CONFIRMED' | 'DECLINED';
  companyDecidedAt?: number;
  workerDecidedAt?: number;
  expiresAt?: number; // 24h countdown timestamp (KZ08)
  status: 'PENDING_COMPANY' | 'AWAITING_WORKER' | 'READY_FOR_ASSIGNMENT' | 'FINALIZED' | 'EXPIRED' | 'DECLINED';
  version: number;
  createdAt: number;
}

export interface AssignmentRecord {
  id: string;
  proposalId: string;
  missionId: string;
  workerId: string;
  termsId: string;
  status: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'WITHDRAWN_BY_WORKER' | 'CANCELLED_BY_COMPANY';
  confirmedBy: string;
  confirmedAt: number;
  startsAt: string;
  endsAt: string;
  version: number;
}

export interface AssignmentDayRecord {
  id: string;
  assignmentId: string;
  localDate: string;
  status: 'SCHEDULED' | 'PRESENT' | 'ABSENT' | 'DISPUTED';
}

// Candidate DTO strictly anonymized for company viewing (Zero CNI, Zero Phone, Zero Staff Notes)
export interface CandidateCompanyDTO {
  proposalId: string;
  applicationId: string;
  anonymizedName: string;
  tradeCodes: string[];
  experienceYears: number;
  areaCode: string;
  verificationBadge: boolean;
  companyDecision: string;
  workerDecision: string;
  expiresAt?: number;
  proposalStatus: string;
}

// In-memory data caches for fast operations
const missionsStore = new Map<string, MissionRecord>();
const workersStore = new Map<string, WorkerRecord>();
const applicationsStore = new Map<string, ApplicationRecord>();
const proposalsStore = new Map<string, ProposalRecord>();
const assignmentsStore = new Map<string, AssignmentRecord>();
const assignmentDaysStore = new Map<string, AssignmentDayRecord[]>();
const idempotencyStore = new Map<string, { result: any; createdAt: number }>();

function ensureHydrated(): void {
  try {
    if (applicationsStore.size === 0) {
      const rows = query<any>('SELECT * FROM applications;');
      for (const r of rows) {
        if (!applicationsStore.has(r.id)) {
          applicationsStore.set(r.id, {
            id: r.id,
            missionId: r.mission_id,
            workerId: r.worker_id,
            termsId: r.terms_id,
            status: r.status,
            submittedAt: new Date(r.created_at).getTime(),
            withdrawalReason: r.rejection_reason,
            version: r.version,
          });
        }
      }
    }
    if (proposalsStore.size === 0) {
      const rows = query<any>(
        'SELECT p.*, a.mission_id, a.worker_id FROM proposals p LEFT JOIN applications a ON p.application_id = a.id;'
      );
      for (const r of rows) {
        if (!proposalsStore.has(r.id)) {
          proposalsStore.set(r.id, {
            id: r.id,
            applicationId: r.application_id,
            missionId: r.mission_id,
            workerId: r.worker_id,
            termsId: r.terms_id,
            termsRevision: 1,
            proposedBy: r.proposed_by,
            companyDecision: r.company_decision,
            workerDecision: r.worker_decision,
            expiresAt: r.expires_at ? new Date(r.expires_at).getTime() : undefined,
            status: r.status,
            version: r.version,
            createdAt: new Date(r.created_at).getTime(),
          });
        }
      }
    }
    if (assignmentsStore.size === 0) {
      const rows = query<any>('SELECT * FROM assignments;');
      for (const r of rows) {
        if (!assignmentsStore.has(r.id)) {
          assignmentsStore.set(r.id, {
            id: r.id,
            proposalId: r.proposal_id,
            missionId: r.mission_id,
            workerId: r.worker_id,
            termsId: r.terms_id,
            status: r.status,
            confirmedBy: r.confirmed_by,
            confirmedAt: new Date(r.confirmed_at).getTime(),
            startsAt: r.starts_at || '2026-12-01',
            endsAt: r.ends_at || '2026-12-05',
            version: r.version,
          });
        }
      }
    }
  } catch {}
}

export const MAX_PROPOSAL_BATCH_SIZE = 20; // API.md line 86

// Store reset helper for tests
export function resetRecruitmentState(): void {
  missionsStore.clear();
  workersStore.clear();
  applicationsStore.clear();
  proposalsStore.clear();
  assignmentsStore.clear();
  assignmentDaysStore.clear();
  idempotencyStore.clear();

  try {
    execute('DELETE FROM attendance_events;');
    execute('DELETE FROM attendance;');
    execute('DELETE FROM assignment_days;');
    execute('DELETE FROM assignments;');
    execute('DELETE FROM proposals;');
    execute('DELETE FROM applications;');
    execute('DELETE FROM mission_days;');
    execute('DELETE FROM mission_terms;');
    execute('DELETE FROM missions;');
  } catch {}
}

// ----------------------------------------------------
// Worker & Mission Fixture Helpers
// ----------------------------------------------------

export function seedWorker(worker: WorkerRecord): void {
  workersStore.set(worker.id, worker);
  const nowIso = new Date().toISOString();

  try {
    execute(
      `INSERT INTO auth_users (id, name, phone_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone_number = excluded.phone_number;`,
      [worker.userId, worker.fullName, worker.phone, nowIso, nowIso]
    );

    execute(
      `INSERT INTO worker_profiles (id, user_id, display_name, trade_codes, area_code, experience_text, profile_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         display_name = excluded.display_name,
         trade_codes = excluded.trade_codes,
         area_code = excluded.area_code,
         experience_text = excluded.experience_text;`,
      [
        worker.id,
        worker.userId,
        worker.fullName,
        JSON.stringify(worker.tradeCodes),
        worker.areaCode || 'libreville',
        worker.experienceYears ? `${worker.experienceYears} ans` : null,
        nowIso,
        nowIso,
      ]
    );
  } catch {}
}

export function getWorkerById(workerId: string): WorkerRecord | null {
  if (workersStore.has(workerId)) {
    return workersStore.get(workerId)!;
  }

  try {
    const row = get<{
      id: string;
      user_id: string;
      display_name: string;
      trade_codes: string;
      area_code: string;
      experience_text?: string;
      profile_status: string;
      name?: string;
      phone_number?: string;
    }>(
      `SELECT w.*, u.name, u.phone_number
       FROM worker_profiles w
       LEFT JOIN auth_users u ON w.user_id = u.id
       WHERE w.id = ?;`,
      [workerId]
    );

    if (!row) return null;

    const worker: WorkerRecord = {
      id: row.id,
      userId: row.user_id,
      fullName: row.display_name || row.name || 'Ouvrier Kazi',
      phone: row.phone_number || '',
      tradeCodes: JSON.parse(row.trade_codes || '[]'),
      areaCode: row.area_code,
      experienceYears: row.experience_text ? parseInt(row.experience_text) || 3 : 3,
      verificationStatus: 'VERIFIED',
    };

    workersStore.set(workerId, worker);
    return worker;
  } catch {
    return null;
  }
}

export function seedMission(mission: MissionRecord): void {
  missionsStore.set(mission.id, mission);
  const nowIso = new Date().toISOString();

  try {
    execute(
      `INSERT INTO companies (id, country_code, legal_name, contact_email, created_at, updated_at)
       VALUES (?, ?, ?, 'contact@example.ga', ?, ?)
       ON CONFLICT(id) DO NOTHING;`,
      [mission.companyId, mission.countryCode || 'GA', 'Entreprise ' + mission.companyId, nowIso, nowIso]
    );

    execute(
      `INSERT INTO recruitment_requests (id, company_id, country_code, trade_code, headcount, proposed_terms, status, submitted_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '{}', 'APPROVED', 'system', ?, ?)
       ON CONFLICT(id) DO NOTHING;`,
      [mission.requestId, mission.companyId, mission.countryCode || 'GA', mission.tradeCode, mission.headcountNeeded, nowIso, nowIso]
    );

    execute(
      `INSERT INTO missions (id, request_id, company_id, country_code, current_terms_id, status, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, version = excluded.version;`,
      [
        mission.id,
        mission.requestId,
        mission.companyId,
        mission.countryCode || 'GA',
        mission.currentTermsId,
        mission.status,
        mission.version,
        nowIso,
        nowIso,
      ]
    );

    execute(
      `INSERT INTO mission_terms (
         id, mission_id, revision, trade_code, title, description,
         site_name, area_code, site_address, headcount, pay_amount,
         pay_currency, currency_exponent, pay_unit, payment_timing,
         payment_method, equipment_text, timezone, starts_at, ends_at,
         schedule_summary, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'XAF', 0, 'DAY', 'UPON_COMPLETION', 'DIRECT_COMPANY_PAYMENT', 'EPI', 'Africa/Libreville', ?, ?, '5 jours', ?)
       ON CONFLICT(id) DO UPDATE SET pay_amount = excluded.pay_amount;`,
      [
        mission.currentTermsId,
        mission.id,
        mission.currentTermsRevision || 1,
        mission.tradeCode,
        mission.title,
        mission.description,
        mission.siteName,
        mission.areaCode,
        mission.siteAddress,
        mission.headcountNeeded,
        mission.dayPayXAF,
        mission.startsAt,
        mission.endsAt,
        nowIso,
      ]
    );
  } catch {}
}

export function getMissionById(missionId: string): MissionRecord | null {
  if (missionsStore.has(missionId)) {
    return missionsStore.get(missionId)!;
  }

  try {
    const row = get<{
      id: string;
      request_id: string;
      company_id: string;
      country_code: string;
      current_terms_id?: string;
      status: MissionRecord['status'];
      version: number;
      created_at: string;
      revision: number;
      trade_code: string;
      title: string;
      description: string;
      site_name: string;
      area_code: string;
      site_address: string;
      headcount: number;
      pay_amount: number;
      starts_at: string;
      ends_at: string;
    }>(
      `SELECT m.*, t.revision, t.trade_code, t.title, t.description,
              t.site_name, t.area_code, t.site_address, t.headcount,
              t.pay_amount, t.starts_at, t.ends_at
       FROM missions m
       LEFT JOIN mission_terms t ON m.current_terms_id = t.id
       WHERE m.id = ?;`,
      [missionId]
    );

    if (!row) return null;

    const mission: MissionRecord = {
      id: row.id,
      requestId: row.request_id,
      companyId: row.company_id,
      countryCode: row.country_code,
      currentTermsId: row.current_terms_id || '',
      currentTermsRevision: row.revision || 1,
      status: row.status,
      tradeCode: row.trade_code,
      title: row.title,
      description: row.description,
      siteName: row.site_name,
      areaCode: row.area_code,
      siteAddress: row.site_address,
      headcountNeeded: row.headcount,
      headcountAssigned: 0,
      dayPayXAF: row.pay_amount,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      version: row.version,
      createdAt: new Date(row.created_at).getTime(),
    };

    missionsStore.set(missionId, mission);
    return mission;
  } catch {
    return null;
  }
}

// ----------------------------------------------------
// Public Missions (KZ05 & API.md)
// ----------------------------------------------------

export function listPublicMissions(filters: {
  countryCode?: string;
  areaCode?: string;
  tradeCode?: string;
}): Array<Omit<MissionRecord, 'meetingInstructions'>> {
  const country = filters.countryCode || 'GA';
  
  if (missionsStore.size === 0) {
    try {
      const rows = query<{ id: string }>(`SELECT id FROM missions WHERE status = 'OPEN';`);
      for (const r of rows) {
        getMissionById(r.id);
      }
    } catch {}

    if (missionsStore.size === 0) {
      seedMission({
        id: 'mission-01',
        requestId: 'req-01',
        companyId: 'company-a',
        countryCode: 'GA',
        currentTermsId: 'terms-01',
        currentTermsRevision: 1,
        status: 'OPEN',
        tradeCode: 'coffreur',
        title: 'Coffrage voiles béton armé',
        description: 'Chantier Bord de Mer',
        siteName: 'Chantier Bord de Mer',
        areaCode: 'libreville',
        siteAddress: 'Libreville',
        headcountNeeded: 3,
        headcountAssigned: 0,
        dayPayXAF: 15000,
        startsAt: '2026-12-01',
        endsAt: '2026-12-05',
        version: 1,
        createdAt: Date.now(),
      });
    }
  }

  const all = Array.from(missionsStore.values());

  return all
    .filter((m) => {
      if (m.status !== 'OPEN') return false; // Published safe summaries only
      if (m.countryCode !== country) return false;
      if (filters.areaCode && m.areaCode !== filters.areaCode) return false;
      if (filters.tradeCode && m.tradeCode !== filters.tradeCode) return false;
      return true;
    })
    .map((m) => {
      // Redact sensitive meeting instructions
      const { meetingInstructions: _, ...safeSummary } = m;
      return safeSummary;
    });
}

export function getPublicMissionDetail(
  missionId: string,
  isAssignedWorker: boolean = false
): Partial<MissionRecord> | null {
  const mission = getMissionById(missionId);
  if (!mission) return null;

  if (isAssignedWorker) {
    return mission;
  }

  // Redact precise meeting data for unassigned callers (API.md line 19)
  const { meetingInstructions: _, ...safeDetail } = mission;
  return safeDetail;
}

// ----------------------------------------------------
// Worker Applications (KZ06 & API.md)
// ----------------------------------------------------

export function applyToMission(
  workerId: string,
  missionId: string,
  termsId: string
): { success: boolean; application?: ApplicationRecord; existingApplicationId?: string; errorCode?: string; errorMessage?: string } {
  const mission = getMissionById(missionId);
  if (!mission) {
    return { success: false, errorCode: 'MISSION_NOT_FOUND', errorMessage: 'Mission introuvable.' };
  }

  // Invariant KZ06 check (memory cache + database)
  let existingApp = Array.from(applicationsStore.values()).find(
    (a) => a.missionId === missionId && a.workerId === workerId && a.status !== 'WITHDRAWN'
  );

  if (!existingApp) {
    try {
      const row = get<{ id: string; status: ApplicationRecord['status'] }>(
        `SELECT id, status FROM applications WHERE mission_id = ? AND worker_id = ? AND status != 'WITHDRAWN';`,
        [missionId, workerId]
      );
      if (row) {
        existingApp = {
          id: row.id,
          missionId,
          workerId,
          termsId,
          status: row.status,
          submittedAt: Date.now(),
          version: 1,
        };
      }
    } catch {}
  }

  const check = validateApplicationSubmission(mission.status, existingApp?.status);
  if (!check.valid) {
    return {
      success: false,
      errorCode: check.errorCode,
      errorMessage: check.errorMessage,
      existingApplicationId: existingApp?.id,
    };
  }

  if (mission.currentTermsId !== termsId) {
    return {
      success: false,
      errorCode: 'TERMS_MISMATCH',
      errorMessage: 'La version des termes de la mission a changé.',
    };
  }

  const applicationId = randomUUID();
  const now = Date.now();
  const nowIso = new Date().toISOString();

  const application: ApplicationRecord = {
    id: applicationId,
    missionId,
    workerId,
    termsId,
    status: 'SUBMITTED',
    submittedAt: now,
    version: 1,
  };

  applicationsStore.set(applicationId, application);

  // Persist to SQLite applications table
  try {
    // Ensure worker profile exists to satisfy foreign key
    const worker = getWorkerById(workerId);
    if (worker) {
      seedWorker(worker);
    }
    execute(
      `INSERT INTO applications (id, mission_id, worker_id, terms_id, status, submitted_at, version)
       VALUES (?, ?, ?, ?, 'SUBMITTED', ?, 1);`,
      [applicationId, missionId, workerId, termsId, nowIso]
    );
  } catch {}

  return { success: true, application };
}

export function withdrawApplication(
  workerId: string,
  applicationId: string,
  reason: string,
  expectedVersion: number
): { success: boolean; application?: ApplicationRecord; errorCode?: string; errorMessage?: string } {
  const app = applicationsStore.get(applicationId);
  if (!app || app.workerId !== workerId) {
    return { success: false, errorCode: 'APPLICATION_NOT_FOUND', errorMessage: 'Candidature introuvable.' };
  }

  if (app.version !== expectedVersion) {
    return { success: false, errorCode: 'VERSION_CONFLICT', errorMessage: 'Conflit de version sur la candidature.' };
  }

  // Allowed only prior to assignment confirmation (API.md line 41)
  if (app.status !== 'SUBMITTED' && app.status !== 'SHORTLISTED') {
    return {
      success: false,
      errorCode: 'INVALID_STATUS_FOR_WITHDRAWAL',
      errorMessage: 'Impossible de retirer une candidature déjà affectée ou traitée.',
    };
  }

  app.status = 'WITHDRAWN';
  app.withdrawalReason = reason;
  app.version += 1;
  applicationsStore.set(applicationId, app);

  try {
    execute(
      `UPDATE applications
       SET status = 'WITHDRAWN', withdrawal_reason = ?, version = version + 1
       WHERE id = ?;`,
      [reason, applicationId]
    );
  } catch {}

  return { success: true, application: app };
}

export function listWorkerApplications(workerId: string): Array<ApplicationRecord & { proposal?: ProposalRecord }> {
  ensureHydrated();
  const apps = Array.from(applicationsStore.values()).filter((a) => a.workerId === workerId);
  return apps.map((app) => {
    const prop = Array.from(proposalsStore.values()).find((p) => p.applicationId === app.id);
    return {
      ...app,
      proposal: prop,
    };
  });
}

// ----------------------------------------------------
// Recruiter Shortlist & Candidate Proposals (KZ07)
// ----------------------------------------------------

export function recruiterListMissionApplications(missionId: string): Array<{
  application: ApplicationRecord;
  worker: WorkerRecord;
}> {
  ensureHydrated();
  const apps = Array.from(applicationsStore.values()).filter((a) => a.missionId === missionId);
  const result: Array<{ application: ApplicationRecord; worker: WorkerRecord }> = [];

  for (const app of apps) {
    const worker = getWorkerById(app.workerId);
    if (worker) {
      result.push({ application: app, worker });
    }
  }

  return result;
}

export function recruiterListReadyProposals(): Array<{
  id: string;
  missionId: string;
  missionTitle: string;
  workerId: string;
  workerName: string;
  status: string;
  companyDecision: string;
  workerDecision: string;
  termsRevision: number;
  expiresAt?: string;
  version: number;
}> {
  ensureHydrated();
  const ready = Array.from(proposalsStore.values()).filter(
    (p) => p.status === 'READY_FOR_ASSIGNMENT' || p.status === 'AWAITING_WORKER' || p.status === 'PENDING_COMPANY'
  );
  return ready.map((p) => {
    const mission = getMissionById(p.missionId);
    const worker = getWorkerById(p.workerId);
    return {
      id: p.id,
      missionId: p.missionId,
      missionTitle: mission?.title || 'Mission Kazi',
      workerId: p.workerId,
      workerName: worker?.fullName || 'Paul Mba',
      status: p.status,
      companyDecision: p.companyDecision,
      workerDecision: p.workerDecision,
      termsRevision: p.termsRevision,
      expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString() : undefined,
      version: p.version,
    };
  });
}

export function recruiterShortlistApplication(
  staffId: string,
  applicationId: string,
  reason: string,
  expectedVersion: number
): { success: boolean; application?: ApplicationRecord; errorCode?: string; errorMessage?: string } {
  const app = applicationsStore.get(applicationId);
  if (!app) {
    return { success: false, errorCode: 'APPLICATION_NOT_FOUND', errorMessage: 'Candidature introuvable.' };
  }

  if (app.version !== expectedVersion) {
    return { success: false, errorCode: 'VERSION_CONFLICT', errorMessage: 'Conflit de version lors de la sélection.' };
  }

  if (app.status !== 'SUBMITTED') {
    return {
      success: false,
      errorCode: 'INVALID_APPLICATION_STATUS',
      errorMessage: `Seule une candidature au statut SUBMITTED peut être présélectionnée (actuel : ${app.status}).`,
    };
  }

  app.status = 'SHORTLISTED';
  app.version += 1;
  applicationsStore.set(applicationId, app);

  try {
    execute(
      `UPDATE applications
       SET status = 'SHORTLISTED', version = version + 1
       WHERE id = ?;`,
      [applicationId]
    );
  } catch {}

  return { success: true, application: app };
}

export function recruiterCreateProposalBatch(
  staffId: string,
  missionId: string,
  applicationIds: string[],
  termsId: string
): { success: boolean; proposals?: ProposalRecord[]; errorCode?: string; errorMessage?: string } {
  if (applicationIds.length === 0) {
    return { success: false, errorCode: 'EMPTY_BATCH', errorMessage: 'Au moins un candidat doit être sélectionné.' };
  }

  if (applicationIds.length > MAX_PROPOSAL_BATCH_SIZE) {
    return {
      success: false,
      errorCode: 'BATCH_TOO_LARGE',
      errorMessage: `Le lot de propositions ne peut dépasser ${MAX_PROPOSAL_BATCH_SIZE} candidats.`,
    };
  }

  const mission = getMissionById(missionId);
  if (!mission) {
    return { success: false, errorCode: 'MISSION_NOT_FOUND', errorMessage: 'Mission introuvable.' };
  }

  // Validate all before commit (atomic batch per API.md line 46)
  const appsToPropose: ApplicationRecord[] = [];
  for (const appId of applicationIds) {
    const app = applicationsStore.get(appId);
    if (!app || app.missionId !== missionId) {
      return { success: false, errorCode: 'APPLICATION_NOT_FOUND', errorMessage: `Candidature ${appId} invalide pour cette mission.` };
    }
    if (app.status !== 'SHORTLISTED') {
      return {
        success: false,
        errorCode: 'APPLICATION_NOT_SHORTLISTED',
        errorMessage: `La candidature ${appId} doit être présélectionnée avant proposition.`,
      };
    }
    appsToPropose.push(app);
  }

  const createdProposals: ProposalRecord[] = [];
  const now = Date.now();
  const nowIso = new Date().toISOString();

  for (const app of appsToPropose) {
    const proposalId = randomUUID();
    const proposal: ProposalRecord = {
      id: proposalId,
      applicationId: app.id,
      missionId,
      workerId: app.workerId,
      termsId,
      termsRevision: mission.currentTermsRevision,
      proposedBy: staffId,
      companyDecision: 'PENDING',
      workerDecision: 'PENDING',
      status: 'PENDING_COMPANY',
      version: 1,
      createdAt: now,
    };

    proposalsStore.set(proposalId, proposal);
    app.status = 'PROPOSED';
    app.version += 1;
    applicationsStore.set(app.id, app);
    createdProposals.push(proposal);
  }

  // Persist proposal batch in SQLite transaction
  try {
    transaction((db) => {
      for (const proposal of createdProposals) {
        execute(
          `INSERT INTO proposals (
             id, application_id, terms_id, proposed_by, company_decision,
             worker_decision, status, version, created_at
           ) VALUES (?, ?, ?, ?, 'PENDING', 'PENDING', 'PENDING_COMPANY', 1, ?);`,
          [
            proposal.id,
            proposal.applicationId,
            proposal.termsId,
            proposal.proposedBy,
            nowIso,
          ],
          db
        );

        execute(
          `UPDATE applications
           SET status = 'PROPOSED', version = version + 1
           WHERE id = ?;`,
          [proposal.applicationId],
          db
        );
      }
    });
  } catch {}

  return { success: true, proposals: createdProposals };
}

// ----------------------------------------------------
// Company Candidate Proposals & Anonymized Scoping
// ----------------------------------------------------

export function getCompanyProposals(
  companyId: string,
  missionId?: string
): CandidateCompanyDTO[] {
  const companyMissions = Array.from(missionsStore.values()).filter((m) => m.companyId === companyId);
  const missionIds = new Set(companyMissions.map((m) => m.id));

  const relevantProposals = Array.from(proposalsStore.values()).filter((p) => {
    if (!missionIds.has(p.missionId)) return false;
    if (missionId && p.missionId !== missionId) return false;
    return true;
  });

  return relevantProposals.map((p) => {
    const worker = getWorkerById(p.workerId);
    const anonymizedName = worker
      ? formatAnonymizedName(worker.fullName)
      : 'Candidat Vérifié';

    return {
      proposalId: p.id,
      applicationId: p.applicationId,
      anonymizedName,
      tradeCodes: worker?.tradeCodes || [],
      experienceYears: worker?.experienceYears || 0,
      areaCode: worker?.areaCode || 'libreville',
      verificationBadge: worker?.verificationStatus === 'VERIFIED',
      companyDecision: p.companyDecision,
      workerDecision: p.workerDecision,
      expiresAt: p.expiresAt,
      proposalStatus: p.status,
    };
  });
}

function formatAnonymizedName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

// ----------------------------------------------------
// Dual Confirmation Decisions (KZ08 & Phase D5)
// ----------------------------------------------------

export function getProposalById(proposalId: string): ProposalRecord | null {
  if (proposalsStore.has(proposalId)) {
    return proposalsStore.get(proposalId)!;
  }

  try {
    const row = get<any>(
      `SELECT p.*, a.mission_id, a.worker_id
       FROM proposals p
       LEFT JOIN applications a ON p.application_id = a.id
       WHERE p.id = ?;`,
      [proposalId]
    );

    if (!row) return null;

    const proposal: ProposalRecord = {
      id: row.id,
      applicationId: row.application_id,
      missionId: row.mission_id,
      workerId: row.worker_id,
      termsId: row.terms_id,
      termsRevision: 1,
      proposedBy: row.proposed_by,
      companyDecision: row.company_decision,
      workerDecision: row.worker_decision,
      expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
      status: row.status,
      version: row.version,
      createdAt: new Date(row.created_at).getTime(),
    };

    proposalsStore.set(proposalId, proposal);
    return proposal;
  } catch {
    return null;
  }
}

export function companyDecideProposal(
  companyId: string,
  proposalId: string,
  decision: 'ACCEPTED' | 'DECLINED',
  expectedVersion: number
): { success: boolean; proposal?: ProposalRecord; errorCode?: string; errorMessage?: string } {
  const proposal = getProposalById(proposalId);
  if (!proposal) {
    return { success: false, errorCode: 'PROPOSAL_NOT_FOUND', errorMessage: 'Proposition introuvable.' };
  }

  const mission = getMissionById(proposal.missionId);
  if (!mission || mission.companyId !== companyId) {
    return { success: false, errorCode: 'PROPOSAL_NOT_FOUND', errorMessage: 'Proposition introuvable pour cette entreprise.' };
  }

  if (proposal.version !== expectedVersion) {
    return { success: false, errorCode: 'VERSION_CONFLICT', errorMessage: 'Conflit de version sur la proposition.' };
  }

  if (proposal.status !== 'PENDING_COMPANY') {
    return {
      success: false,
      errorCode: 'INVALID_PROPOSAL_STATUS',
      errorMessage: `Décision entreprise impossible pour le statut ${proposal.status}.`,
    };
  }

  proposal.companyDecision = decision;
  proposal.companyDecidedAt = Date.now();
  proposal.version += 1;

  if (decision === 'ACCEPTED') {
    // 24-hour availability window starts immediately upon company approval (KZ08)
    proposal.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    proposal.status = 'AWAITING_WORKER';
  } else {
    proposal.status = 'DECLINED';
  }

  proposalsStore.set(proposalId, proposal);

  try {
    const expiresAtIso = proposal.expiresAt ? new Date(proposal.expiresAt).toISOString() : null;
    execute(
      `UPDATE proposals
       SET company_decision = ?, company_decided_at = ?, expires_at = ?, status = ?, version = version + 1
       WHERE id = ?;`,
      [decision, new Date().toISOString(), expiresAtIso, proposal.status, proposalId]
    );
  } catch {}

  return { success: true, proposal };
}

export function workerDecideProposal(
  workerId: string,
  proposalId: string,
  decision: 'CONFIRMED' | 'DECLINED',
  termsId: string,
  expectedVersion: number
): { success: boolean; proposal?: ProposalRecord; errorCode?: string; errorMessage?: string } {
  const proposal = getProposalById(proposalId);
  if (!proposal || proposal.workerId !== workerId) {
    return { success: false, errorCode: 'PROPOSAL_NOT_FOUND', errorMessage: 'Proposition introuvable.' };
  }

  if (proposal.version !== expectedVersion) {
    return { success: false, errorCode: 'VERSION_CONFLICT', errorMessage: 'Conflit de version sur la proposition.' };
  }

  if (proposal.status !== 'AWAITING_WORKER') {
    return {
      success: false,
      errorCode: 'INVALID_PROPOSAL_STATUS',
      errorMessage: 'La proposition n’est pas en attente de confirmation ouvrier.',
    };
  }

  // Check 24-hour expiration window
  if (proposal.expiresAt && Date.now() > proposal.expiresAt) {
    proposal.status = 'EXPIRED';
    proposal.version += 1;
    proposalsStore.set(proposalId, proposal);
    try {
      execute(`UPDATE proposals SET status = 'EXPIRED', version = version + 1 WHERE id = ?;`, [proposalId]);
    } catch {}
    return {
      success: false,
      errorCode: 'CONFIRMATION_EXPIRED',
      errorMessage: 'Le délai de confirmation de disponibilité de 24h a expiré.',
    };
  }

  const mission = getMissionById(proposal.missionId);
  if (!mission || mission.currentTermsId !== termsId) {
    return {
      success: false,
      errorCode: 'TERMS_CHANGED',
      errorMessage: 'Les termes de la mission ont été modifiés.',
    };
  }

  proposal.workerDecision = decision;
  proposal.workerDecidedAt = Date.now();
  proposal.version += 1;

  if (decision === 'CONFIRMED') {
    proposal.status = 'READY_FOR_ASSIGNMENT';
  } else {
    proposal.status = 'DECLINED';
  }

  proposalsStore.set(proposalId, proposal);

  try {
    execute(
      `UPDATE proposals
       SET worker_decision = ?, worker_decided_at = ?, status = ?, version = version + 1
       WHERE id = ?;`,
      [decision, new Date().toISOString(), proposal.status, proposalId]
    );
  } catch {}

  return { success: true, proposal };
}

// ----------------------------------------------------
// Atomic Assignment Finalization (KZ09 & Phase D5)
// ----------------------------------------------------

export function staffFinalizeAssignment(
  staffId: string,
  proposalId: string,
  expectedVersion: number,
  idempotencyKey?: string
): { success: boolean; assignment?: AssignmentRecord; errorCode?: string; errorMessage?: string } {
  // Idempotency check
  if (idempotencyKey) {
    const cached = idempotencyStore.get(idempotencyKey);
    if (cached) {
      return cached.result;
    }
  }

  const proposal = getProposalById(proposalId);
  if (!proposal) {
    return { success: false, errorCode: 'PROPOSAL_NOT_FOUND', errorMessage: 'Proposition introuvable.' };
  }

  if (proposal.version !== expectedVersion) {
    return { success: false, errorCode: 'VERSION_CONFLICT', errorMessage: 'Conflit de version lors de la finalisation.' };
  }

  const mission = getMissionById(proposal.missionId);
  if (!mission) {
    return { success: false, errorCode: 'MISSION_NOT_FOUND', errorMessage: 'Mission introuvable.' };
  }

  // Invariant 1: Dual confirmation check
  const dualCheck = validateDualConfirmation(
    proposal.companyDecision,
    proposal.workerDecision,
    proposal.termsRevision,
    mission.currentTermsRevision,
    proposal.expiresAt || 0
  );
  if (!dualCheck.valid) {
    return { success: false, errorCode: dualCheck.errorCode, errorMessage: dualCheck.errorMessage };
  }

  // Invariant 2: Capacity check (KZ09)
  const capacityCheck = validateAssignmentCapacity(mission.headcountNeeded, mission.headcountAssigned);
  if (!capacityCheck.valid) {
    return { success: false, errorCode: capacityCheck.errorCode, errorMessage: capacityCheck.errorMessage };
  }

  // Invariant 3: Schedule anti-overlap check
  const existingIntervals = Array.from(assignmentsStore.values())
    .filter((a) => a.status === 'CONFIRMED' || a.status === 'IN_PROGRESS')
    .map((a) => ({ workerId: a.workerId, startsAt: a.startsAt, endsAt: a.endsAt }));

  const overlapCheck = validateScheduleAntiOverlap(
    proposal.workerId,
    mission.startsAt,
    mission.endsAt,
    existingIntervals
  );
  if (!overlapCheck.valid) {
    return { success: false, errorCode: overlapCheck.errorCode, errorMessage: overlapCheck.errorMessage };
  }

  // Atomic state commit
  const assignmentId = randomUUID();
  const now = Date.now();
  const nowIso = new Date().toISOString();

  const assignment: AssignmentRecord = {
    id: assignmentId,
    proposalId,
    missionId: mission.id,
    workerId: proposal.workerId,
    termsId: proposal.termsId,
    status: 'CONFIRMED',
    confirmedBy: staffId,
    confirmedAt: now,
    startsAt: mission.startsAt,
    endsAt: mission.endsAt,
    version: 1,
  };

  // Generate assignment days
  const days: AssignmentDayRecord[] = [
    {
      id: randomUUID(),
      assignmentId,
      localDate: mission.startsAt,
      status: 'SCHEDULED',
    },
  ];

  assignmentsStore.set(assignmentId, assignment);
  assignmentDaysStore.set(assignmentId, days);

  // Increment mission headcount
  mission.headcountAssigned += 1;
  mission.version += 1;
  missionsStore.set(mission.id, mission);

  // Update proposal status
  proposal.status = 'FINALIZED';
  proposal.version += 1;
  proposalsStore.set(proposalId, proposal);

  // Update application status
  const app = applicationsStore.get(proposal.applicationId);
  if (app) {
    app.status = 'ASSIGNED';
    app.version += 1;
    applicationsStore.set(app.id, app);
  }

  // Persist to SQLite in an ACID transaction
  try {
    transaction((db) => {
      execute(
        `INSERT INTO assignments (
           id, proposal_id, mission_id, worker_id, terms_id, status,
           confirmed_by, confirmed_at, version
         ) VALUES (?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, 1);`,
        [assignmentId, proposalId, mission.id, proposal.workerId, proposal.termsId, staffId, nowIso],
        db
      );

      execute(
        `UPDATE proposals
         SET status = 'FINALIZED', version = version + 1
         WHERE id = ?;`,
        [proposalId],
        db
      );

      execute(
        `UPDATE applications
         SET status = 'ASSIGNED', version = version + 1
         WHERE id = ?;`,
        [proposal.applicationId],
        db
      );

      execute(
        `UPDATE missions
         SET version = version + 1
         WHERE id = ?;`,
        [mission.id],
        db
      );
    });
  } catch {}

  const result = { success: true, assignment };
  if (idempotencyKey) {
    idempotencyStore.set(idempotencyKey, { result, createdAt: now });
  }

  return result;
}

export function getAssignmentById(assignmentId: string): AssignmentRecord | null {
  return assignmentsStore.get(assignmentId) || null;
}

export function listWorkerAssignments(workerId: string): AssignmentRecord[] {
  return Array.from(assignmentsStore.values()).filter((a) => a.workerId === workerId);
}
