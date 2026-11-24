// Phase D6 Integration Tests: Attendance Pointage, Disputes, Replacement & Mission Close
// Enforces PRD.md (KZ10, KZ11), WORKFLOWS.md, and API.md

import { describe, it, expect, beforeEach } from 'vitest';
import {
  seedAttendanceRecord,
  resetAttendanceState,
  clearAttendanceMemoryCache,
  recordCompanyAttendance,
  workerDecideAttendance,
  staffResolveAttendance,
  createReplacementRequest,
  staffConfirmReplacement,
  staffCloseMission,
  getAttendanceById,
  getAttendanceEvents,
  getReplacementRequestById,
  AttendanceRecord,
} from '../src/modules/attendance/service';
import { execute, get, query, initDatabase, getDatabaseConnection } from '../src/server/db/database';

describe('Phase D6: Attendance Pointage, Disputes, Replacement & Mission Close', () => {
  const dummyAttendance: AttendanceRecord = {
    id: 'att-day-1',
    assignmentDayId: 'day-01',
    assignmentId: 'assign-01',
    missionId: 'mission-01',
    companyId: 'company-btp',
    workerId: 'worker-01',
    localDate: '2026-12-01',
    declaredStatus: 'NOT_RECORDED',
    declarationRevision: 0,
    workerDecision: 'PENDING',
    resolutionStatus: 'UNRESOLVED',
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    resetAttendanceState();
    seedAttendanceRecord({ ...dummyAttendance });
  });

  // ----------------------------------------------------
  // Company Daily Pointage (KZ10)
  // ----------------------------------------------------
  describe('Daily Pointage Declarations', () => {
    it('allows company to record PRESENT status with 480 minutes default', () => {
      const res = recordCompanyAttendance('company-btp', 'day-01', 'PRESENT', undefined, 'Arrivé à l’heure', 1);
      expect(res.success).toBe(true);
      expect(res.attendance?.declaredStatus).toBe('PRESENT');
      expect(res.attendance?.workedMinutes).toBe(480);
      expect(res.attendance?.declarationRevision).toBe(1);
      expect(res.attendance?.workerDecision).toBe('PENDING');

      // Check event history
      const events = getAttendanceEvents(dummyAttendance.id);
      expect(events.length).toBe(1);
      expect(events[0].eventCode).toBe('DECLARED');
    });

    it('requires workedMinutes when declared status is PARTIAL', () => {
      const missingMinutes = recordCompanyAttendance('company-btp', 'day-01', 'PARTIAL', undefined, 'Demi-journée', 1);
      expect(missingMinutes.success).toBe(false);
      expect(missingMinutes.errorCode).toBe('INVALID_MINUTES');

      const validPartial = recordCompanyAttendance('company-btp', 'day-01', 'PARTIAL', 240, 'Matinée seulement', 1);
      expect(validPartial.success).toBe(true);
      expect(validPartial.attendance?.workedMinutes).toBe(240);
    });

    it('rejects attendance pointage from an unauthorized company (tenant isolation)', () => {
      const unauthorized = recordCompanyAttendance('other-company', 'day-01', 'PRESENT', undefined, '', 1);
      expect(unauthorized.success).toBe(false);
      expect(unauthorized.errorCode).toBe('FORBIDDEN');
    });

    it('rejects update on version conflict', () => {
      const conflict = recordCompanyAttendance('company-btp', 'day-01', 'PRESENT', undefined, '', 99);
      expect(conflict.success).toBe(false);
      expect(conflict.errorCode).toBe('VERSION_CONFLICT');
    });
  });

  // ----------------------------------------------------
  // Worker Decision & Disputes (KZ10)
  // ----------------------------------------------------
  describe('Worker Decision & Disputes', () => {
    beforeEach(() => {
      // Company declares attendance first
      recordCompanyAttendance('company-btp', 'day-01', 'PRESENT', undefined, '', 1);
    });

    it('allows worker to confirm attendance matching current revision', () => {
      const res = workerDecideAttendance('worker-01', dummyAttendance.id, 'CONFIRM', 1);
      expect(res.success).toBe(true);
      expect(res.attendance?.workerDecision).toBe('CONFIRMED');
      expect(res.attendance?.resolutionStatus).toBe('VALIDATED');

      const events = getAttendanceEvents(dummyAttendance.id);
      expect(events.length).toBe(2); // DECLARED + CONFIRMED
      expect(events[1].eventCode).toBe('CONFIRMED');
    });

    it('rejects worker confirmation when declaration revision is superseded', () => {
      // Company updates declaration to ABSENT (revision 2)
      recordCompanyAttendance('company-btp', 'day-01', 'ABSENT', undefined, 'Non venu', 2);

      // Worker attempts to confirm obsolete revision 1
      const staleConfirm = workerDecideAttendance('worker-01', dummyAttendance.id, 'CONFIRM', 1);
      expect(staleConfirm.success).toBe(false);
      expect(staleConfirm.errorCode).toBe('REVISION_MISMATCH');
    });

    it('allows worker to dispute attendance and requires a dispute reason', () => {
      // Worker disputes without reason
      const emptyReason = workerDecideAttendance('worker-01', dummyAttendance.id, 'DISPUTE', 1, '');
      expect(emptyReason.success).toBe(false);
      expect(emptyReason.errorCode).toBe('DISPUTE_REASON_REQUIRED');

      // Worker disputes with valid reason
      const validDispute = workerDecideAttendance(
        'worker-01',
        dummyAttendance.id,
        'DISPUTE',
        1,
        'J’étais bien présent de 08h à 17h, validé par le chef de chantier.'
      );
      expect(validDispute.success).toBe(true);
      expect(validDispute.attendance?.workerDecision).toBe('DISPUTED');
      expect(validDispute.attendance?.resolutionStatus).toBe('UNRESOLVED');
    });
  });

  // ----------------------------------------------------
  // Staff Recruiter Arbitration (KZ10)
  // ----------------------------------------------------
  describe('Staff Recruiter Arbitration', () => {
    beforeEach(() => {
      recordCompanyAttendance('company-btp', 'day-01', 'ABSENT', undefined, 'Absent', 1);
      workerDecideAttendance('worker-01', dummyAttendance.id, 'DISPUTE', 1, 'J’étais présent');
    });

    it('allows staff recruiter to resolve dispute with audited reason', () => {
      const current = getAttendanceById(dummyAttendance.id)!;
      const res = staffResolveAttendance(
        'staff-recruiter-01',
        dummyAttendance.id,
        'PRESENT',
        'Vérification effectuée auprès du chef de chantier : ouvrier présent.',
        480,
        current.version
      );

      expect(res.success).toBe(true);
      expect(res.attendance?.resolutionStatus).toBe('RESOLVED_BY_STAFF');
      expect(res.attendance?.declaredStatus).toBe('PRESENT');
      expect(res.attendance?.workedMinutes).toBe(480);

      const events = getAttendanceEvents(dummyAttendance.id);
      expect(events[events.length - 1].eventCode).toBe('RESOLVED');
    });
  });

  // ----------------------------------------------------
  // Absence & Replacement Requests (KZ11)
  // ----------------------------------------------------
  describe('Absence & Replacement (KZ11)', () => {
    it('creates replacement request without fabricating assignments', () => {
      const res = createReplacementRequest(
        'company-btp',
        'assign-01',
        'mission-01',
        'company-btp',
        'worker-01',
        ['day-02', 'day-03'],
        'WORKER_ILLNESS',
        'Ouvrier souffrant, remplacement souhaité pour les 2 derniers jours.'
      );

      expect(res.success).toBe(true);
      expect(res.request?.status).toBe('REQUESTED');
      expect(res.request?.affectedDayIds).toEqual(['day-02', 'day-03']);
      expect(res.request?.replacementAssignmentId).toBeUndefined(); // No fabricated assignment
    });

    it('allows staff recruiter to confirm replacement and link assignment', () => {
      const req = createReplacementRequest(
        'company-btp',
        'assign-01',
        'mission-01',
        'company-btp',
        'worker-01',
        ['day-02'],
        'WORKER_ABSENT'
      );

      const confirmRes = staffConfirmReplacement(
        'staff-01',
        req.request!.id,
        'replacement-assign-99',
        1
      );

      expect(confirmRes.success).toBe(true);
      expect(confirmRes.request?.status).toBe('CONFIRMED');
      expect(confirmRes.request?.replacementAssignmentId).toBe('replacement-assign-99');
    });
  });

  // ----------------------------------------------------
  // Mission Bilan & Close
  // ----------------------------------------------------
  describe('Mission Bilan & Close', () => {
    it('prevents mission close when unresolved attendance days remain', () => {
      // Day is NOT_RECORDED / UNRESOLVED
      const closeBlocked = staffCloseMission('staff-01', 'mission-01', 'Clôture normale', 1);
      expect(closeBlocked.success).toBe(false);
      expect(closeBlocked.errorCode).toBe('UNRESOLVED_ATTENDANCE_DAYS');
    });

    it('allows mission close when all days are validated or resolved by staff', () => {
      // Validate day 1
      recordCompanyAttendance('company-btp', 'day-01', 'PRESENT', undefined, '', 1);
      workerDecideAttendance('worker-01', dummyAttendance.id, 'CONFIRM', 1);

      const closeSuccess = staffCloseMission('staff-01', 'mission-01', 'Mission terminée, bilan complet', 1);
      expect(closeSuccess.success).toBe(true);
      expect(closeSuccess.missionSummary?.validatedDays).toBe(1);
      expect(closeSuccess.missionSummary?.totalDays).toBe(1);
    });
  });

  // ----------------------------------------------------
  // SQLite Persistence & Recovery
  // ----------------------------------------------------
  describe('SQLite Persistence & Recovery (Phase D6)', () => {
    const pWorkerUserId = 'usr-att-worker-1';
    const pWorkerProfileId = 'wkr-att-profile-1';
    const pCompanyId = 'comp-att-persist-1';
    const pRequestId = 'req-att-persist-1';
    const pMissionId = 'msn-att-persist-1';
    const pTermsId = 'terms-att-persist-1';
    const pMissionDayId = 'mday-att-persist-1';
    const pApplicationId = 'app-att-persist-1';
    const pProposalId = 'prop-att-persist-1';
    const pAssignmentId = 'asgn-att-persist-1';
    const pAssignmentDayId = 'aday-att-persist-1';
    const pAttendanceId = 'att-persisted-1';

    beforeEach(() => {
      const db = getDatabaseConnection();
      initDatabase(db);
      const nowIso = new Date().toISOString();

      // Ensure clean state for relational hierarchy
      execute('DELETE FROM attendance_events WHERE attendance_id = ?;', [pAttendanceId]);
      execute('DELETE FROM attendance WHERE id = ?;', [pAttendanceId]);
      execute('DELETE FROM replacement_requests WHERE original_assignment_id = ?;', [pAssignmentId]);
      execute('DELETE FROM assignment_days WHERE id = ?;', [pAssignmentDayId]);
      execute('DELETE FROM assignments WHERE id = ?;', [pAssignmentId]);
      execute('DELETE FROM proposals WHERE id = ?;', [pProposalId]);
      execute('DELETE FROM applications WHERE id = ?;', [pApplicationId]);
      execute('DELETE FROM mission_days WHERE id = ?;', [pMissionDayId]);
      execute('DELETE FROM mission_terms WHERE id = ?;', [pTermsId]);
      execute('DELETE FROM missions WHERE id = ?;', [pMissionId]);
      execute('DELETE FROM recruitment_requests WHERE id = ?;', [pRequestId]);
      execute('DELETE FROM companies WHERE id = ?;', [pCompanyId]);
      execute('DELETE FROM worker_profiles WHERE id = ?;', [pWorkerProfileId]);
      execute('DELETE FROM auth_users WHERE id = ?;', [pWorkerUserId]);

      // Seed relational parents
      execute(
        `INSERT INTO auth_users (id, name, email, phone_number, created_at, updated_at)
         VALUES (?, 'Ouvrier Test', 'ouvrier@kazi.ga', '+24177998877', ?, ?);`,
        [pWorkerUserId, nowIso, nowIso]
      );
      execute(
        `INSERT INTO worker_profiles (id, user_id, display_name, trade_codes, area_code, created_at, updated_at)
         VALUES (?, ?, 'Ouvrier T.', '["MACON"]', 'libreville', ?, ?);`,
        [pWorkerProfileId, pWorkerUserId, nowIso, nowIso]
      );
      execute(
        `INSERT INTO companies (id, legal_name, contact_email, created_at, updated_at)
         VALUES (?, 'Entreprise Persist S.A.', 'contact@persist.ga', ?, ?);`,
        [pCompanyId, nowIso, nowIso]
      );
      execute(
        `INSERT INTO recruitment_requests (id, company_id, trade_code, headcount, proposed_terms, submitted_by, created_at, updated_at)
         VALUES (?, ?, 'MACON', 1, '{}', 'owner-1', ?, ?);`,
        [pRequestId, pCompanyId, nowIso, nowIso]
      );
      execute(
        `INSERT INTO missions (id, request_id, company_id, country_code, status, created_at, updated_at)
         VALUES (?, ?, ?, 'GA', 'IN_PROGRESS', ?, ?);`,
        [pMissionId, pRequestId, pCompanyId, nowIso, nowIso]
      );
      execute(
        `INSERT INTO mission_terms (
           id, mission_id, revision, trade_code, title, description, site_name, area_code,
           site_address, headcount, pay_amount, pay_currency, currency_exponent,
           pay_unit, payment_timing, payment_method, equipment_text, timezone, starts_at, ends_at, schedule_summary, created_at
         ) VALUES (?, ?, 1, 'MACON', 'Maçon coffreur', 'Gros oeuvre', 'Chantier Akanda', 'libreville', 'Akanda', 1, 15000, 'XAF', 0, 'DAY', 'UPON_COMPLETION', 'DIRECT_COMPANY_PAYMENT', 'Bottes et gants', 'Africa/Libreville', '2026-12-05T08:00:00Z', '2026-12-05T17:00:00Z', '1 jour', ?);`,
        [pTermsId, pMissionId, nowIso]
      );
      execute(
        `INSERT INTO mission_days (id, terms_id, local_date, starts_at, ends_at, break_minutes)
         VALUES (?, ?, '2026-12-05', '2026-12-05T08:00:00Z', '2026-12-05T17:00:00Z', 60);`,
        [pMissionDayId, pTermsId]
      );
      execute(
        `INSERT INTO applications (id, mission_id, worker_id, terms_id, status, submitted_at, version)
         VALUES (?, ?, ?, ?, 'ASSIGNED', ?, 1);`,
        [pApplicationId, pMissionId, pWorkerProfileId, pTermsId, nowIso]
      );
      execute(
        `INSERT INTO proposals (id, application_id, terms_id, proposed_by, status, created_at)
         VALUES (?, ?, ?, 'staff-1', 'FINALIZED', ?);`,
        [pProposalId, pApplicationId, pTermsId, nowIso]
      );
      execute(
        `INSERT INTO assignments (id, proposal_id, mission_id, worker_id, terms_id, status, confirmed_by, confirmed_at, version)
         VALUES (?, ?, ?, ?, ?, 'CONFIRMED', 'staff-1', ?, 1);`,
        [pAssignmentId, pProposalId, pMissionId, pWorkerProfileId, pTermsId, nowIso]
      );
      execute(
        `INSERT INTO assignment_days (id, assignment_id, mission_day_id, worker_id, starts_at, ends_at)
         VALUES (?, ?, ?, ?, '2026-12-05T08:00:00Z', '2026-12-05T17:00:00Z');`,
        [pAssignmentDayId, pAssignmentId, pMissionDayId, pWorkerProfileId]
      );

      // Seed initial attendance record
      seedAttendanceRecord({
        id: pAttendanceId,
        assignmentDayId: pAssignmentDayId,
        assignmentId: pAssignmentId,
        missionId: pMissionId,
        companyId: pCompanyId,
        workerId: pWorkerProfileId,
        localDate: '2026-12-05',
        declaredStatus: 'NOT_RECORDED',
        declarationRevision: 0,
        workerDecision: 'PENDING',
        resolutionStatus: 'UNRESOLVED',
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    it('persists pointage declaration, worker dispute, staff arbitration, and events to SQLite tables', () => {
      // 1. Company declares PRESENT (480 minutes)
      const declRes = recordCompanyAttendance(pCompanyId, pAssignmentDayId, 'PRESENT', undefined, 'Présent sur site', 1);
      expect(declRes.success).toBe(true);

      const dbAtt1 = get<any>('SELECT * FROM attendance WHERE id = ?;', [pAttendanceId]);
      expect(dbAtt1).not.toBeNull();
      expect(dbAtt1.declared_status).toBe('PRESENT');
      expect(dbAtt1.worked_minutes).toBe(480);
      expect(dbAtt1.declaration_revision).toBe(1);
      expect(dbAtt1.worker_decision).toBe('PENDING');

      // 2. Worker disputes attendance declaration
      const dispRes = workerDecideAttendance(
        pWorkerProfileId,
        pAttendanceId,
        'DISPUTE',
        1,
        'Départ anticipé autorisé par le chef d’équipe à 15h'
      );
      expect(dispRes.success).toBe(true);

      const dbAtt2 = get<any>('SELECT * FROM attendance WHERE id = ?;', [pAttendanceId]);
      expect(dbAtt2.worker_decision).toBe('DISPUTED');
      expect(dbAtt2.resolution_status).toBe('UNRESOLVED');
      expect(dbAtt2.reason).toBe('Départ anticipé autorisé par le chef d’équipe à 15h');

      // 3. Staff resolves dispute with PARTIAL (420 minutes)
      const resRes = staffResolveAttendance(
        'staff-recruiter-99',
        pAttendanceId,
        'PARTIAL',
        'Vérifié avec le contremaître : 7h prestées.',
        420,
        dbAtt2.version
      );
      expect(resRes.success).toBe(true);

      const dbAtt3 = get<any>('SELECT * FROM attendance WHERE id = ?;', [pAttendanceId]);
      expect(dbAtt3.declared_status).toBe('PARTIAL');
      expect(dbAtt3.worked_minutes).toBe(420);
      expect(dbAtt3.resolution_status).toBe('RESOLVED_BY_STAFF');
      expect(dbAtt3.resolved_by).toBe('staff-recruiter-99');

      // 4. Check audit events persisted to attendance_events table
      const dbEvents = query<any>('SELECT * FROM attendance_events WHERE attendance_id = ? ORDER BY event_at ASC;', [pAttendanceId]);
      expect(dbEvents.length).toBe(3);
      expect(dbEvents[0].event_code).toBe('DECLARED');
      expect(dbEvents[1].event_code).toBe('DISPUTED');
      expect(dbEvents[2].event_code).toBe('RESOLVED');

      // 5. Create and confirm replacement request
      const repReq = createReplacementRequest(
        pCompanyId,
        pAssignmentId,
        pMissionId,
        pCompanyId,
        pWorkerProfileId,
        [pAssignmentDayId],
        'WORKER_ABSENT',
        'Remplacement pour imprévu'
      );
      expect(repReq.success).toBe(true);

      const dbRep1 = get<any>('SELECT * FROM replacement_requests WHERE id = ?;', [repReq.request!.id]);
      expect(dbRep1).not.toBeNull();
      expect(dbRep1.status).toBe('REQUESTED');

      const confRep = staffConfirmReplacement('staff-99', repReq.request!.id, 'asgn-replacement-1', 1);
      expect(confRep.success).toBe(true);

      const dbRep2 = get<any>('SELECT * FROM replacement_requests WHERE id = ?;', [repReq.request!.id]);
      expect(dbRep2.status).toBe('CONFIRMED');
      expect(dbRep2.replacement_assignment_id).toBe('asgn-replacement-1');

      // 6. Close mission bilan and verify mission status in SQLite
      const closeRes = staffCloseMission('staff-99', pMissionId, 'Bilan validé', 1);
      expect(closeRes.success).toBe(true);

      const dbMission = get<any>('SELECT status FROM missions WHERE id = ?;', [pMissionId]);
      expect(dbMission.status).toBe('COMPLETED');
    });

    it('recovers attendance records and events from SQLite after in-memory cache clear', () => {
      // Setup and record attendance
      recordCompanyAttendance(pCompanyId, pAssignmentDayId, 'PRESENT', undefined, 'Sur chantier', 1);
      workerDecideAttendance(pWorkerProfileId, pAttendanceId, 'CONFIRM', 1);

      // Verify attendance exists in memory
      expect(getAttendanceById(pAttendanceId)).not.toBeNull();
      expect(getAttendanceEvents(pAttendanceId).length).toBe(2);

      // Purge in-memory state WITHOUT deleting database rows
      clearAttendanceMemoryCache();

      // Re-query from DB via getAttendanceById
      const restored = getAttendanceById(pAttendanceId);
      expect(restored).not.toBeNull();
      expect(restored?.id).toBe(pAttendanceId);
      expect(restored?.declaredStatus).toBe('PRESENT');
      expect(restored?.workerDecision).toBe('CONFIRMED');
      expect(restored?.resolutionStatus).toBe('VALIDATED');

      // Re-query events from DB
      const restoredEvents = getAttendanceEvents(pAttendanceId);
      expect(restoredEvents.length).toBe(2);
      expect(restoredEvents[0].eventCode).toBe('DECLARED');
      expect(restoredEvents[1].eventCode).toBe('CONFIRMED');
    });
  });
});
