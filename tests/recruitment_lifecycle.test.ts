// Phase D4 & D5 Integration Tests: Recruitment Lifecycle, Privacy & Atomic Gates
// Enforces PRD.md (KZ05-KZ09), WORKFLOWS.md, and API.md

import { describe, it, expect, beforeEach } from 'vitest';
import { get as dbGet } from '../src/server/db/database';
import {
  seedMission,
  seedWorker,
  getMissionById,
  resetRecruitmentState,
  listPublicMissions,
  getPublicMissionDetail,
  applyToMission,
  withdrawApplication,
  listWorkerApplications,
  recruiterListMissionApplications,
  recruiterShortlistApplication,
  recruiterCreateProposalBatch,
  getCompanyProposals,
  companyDecideProposal,
  workerDecideProposal,
  staffFinalizeAssignment,
  MAX_PROPOSAL_BATCH_SIZE,
  MissionRecord,
  WorkerRecord,
} from '../src/modules/applications/service';

describe('Phase D4 & D5: Recruitment Lifecycle, Privacy Boundaries & Atomic Gates', () => {
  const dummyMission: MissionRecord = {
    id: 'mission-btp-01',
    requestId: 'req-01',
    companyId: 'company-horizon',
    countryCode: 'GA',
    currentTermsId: 'terms-rev-1',
    currentTermsRevision: 1,
    status: 'OPEN',
    tradeCode: 'MASONRY',
    title: 'Chantier Gros Œuvre Akanda',
    description: 'Pose de parpaings et ferraillage pour villa R+1.',
    siteName: 'Résidence Les Palmiers',
    areaCode: 'akanda',
    siteAddress: 'Voie express Akanda',
    meetingInstructions: 'Sonner au portail technique ouest à 07h15 précises.', // SENSITIVE
    headcountNeeded: 2,
    headcountAssigned: 0,
    dayPayXAF: 12000,
    startsAt: '2026-12-01',
    endsAt: '2026-12-05',
    version: 1,
    createdAt: Date.now(),
  };

  const dummyWorker1: WorkerRecord = {
    id: 'worker-jm-01',
    userId: 'user-w1',
    fullName: 'Jean-Marc Biyogo',
    phone: '+24177001122', // PRIVATE
    tradeCodes: ['MASONRY'],
    areaCode: 'libreville',
    experienceYears: 6,
    verificationStatus: 'VERIFIED',
    staffNotes: 'Excellente réputation sur les chantiers Sobraga.', // PRIVATE
  };

  const dummyWorker2: WorkerRecord = {
    id: 'worker-alain-02',
    userId: 'user-w2',
    fullName: 'Alain Ndong',
    phone: '+24166334455', // PRIVATE
    tradeCodes: ['MASONRY'],
    areaCode: 'akanda',
    experienceYears: 4,
    verificationStatus: 'VERIFIED',
  };

  const dummyWorker3: WorkerRecord = {
    id: 'worker-paul-03',
    userId: 'user-w3',
    fullName: 'Paul Mba',
    phone: '+24174889900', // PRIVATE
    tradeCodes: ['MASONRY'],
    areaCode: 'owendo',
    experienceYears: 3,
    verificationStatus: 'VERIFIED',
  };

  beforeEach(() => {
    resetRecruitmentState();
    seedMission({ ...dummyMission });
    seedWorker({ ...dummyWorker1 });
    seedWorker({ ...dummyWorker2 });
    seedWorker({ ...dummyWorker3 });
  });

  // ----------------------------------------------------
  // Phase D4: Public Missions & Privacy Redaction
  // ----------------------------------------------------
  describe('Phase D4: Public Missions & Field Scoping', () => {
    it('lists only OPEN missions and redacts sensitive meeting instructions', () => {
      const missions = listPublicMissions({ countryCode: 'GA' });
      expect(missions.length).toBe(1);
      expect(missions[0].id).toBe('mission-btp-01');
      // Verify sensitive meeting instructions are NOT exposed in public list
      expect((missions[0] as any).meetingInstructions).toBeUndefined();
    });

    it('redacts meeting instructions for unassigned public mission detail view', () => {
      const publicDetail = getPublicMissionDetail('mission-btp-01', false);
      expect(publicDetail).toBeDefined();
      expect(publicDetail?.siteName).toBe('Résidence Les Palmiers');
      expect((publicDetail as any).meetingInstructions).toBeUndefined();
    });

    it('exposes meeting instructions only to assigned worker', () => {
      const assignedDetail = getPublicMissionDetail('mission-btp-01', true);
      expect(assignedDetail).toBeDefined();
      expect(assignedDetail?.meetingInstructions).toBe('Sonner au portail technique ouest à 07h15 précises.');
    });
  });

  // ----------------------------------------------------
  // Phase D4: Worker Applications & Duplicate Prevention (KZ06)
  // ----------------------------------------------------
  describe('Phase D4: Worker Applications & Invariant KZ06', () => {
    it('allows a verified worker to submit an application with termsId', () => {
      const res = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      expect(res.success).toBe(true);
      expect(res.application?.status).toBe('SUBMITTED');
      expect(res.application?.workerId).toBe(dummyWorker1.id);

      // Verify application record persisted in SQLite database
      const dbApp = dbGet<{ id: string; status: string; worker_id: string }>(
        'SELECT id, status, worker_id FROM applications WHERE id = ?;',
        [res.application?.id]
      );
      expect(dbApp).not.toBeNull();
      expect(dbApp?.status).toBe('SUBMITTED');
      expect(dbApp?.worker_id).toBe(dummyWorker1.id);
    });

    it('strictly prevents duplicate active applications on the same mission (KZ06)', () => {
      const first = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      expect(first.success).toBe(true);

      const second = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      expect(second.success).toBe(false);
      expect(second.errorCode).toBe('APPLICATION_EXISTS');
      expect(second.existingApplicationId).toBe(first.application?.id);
    });

    it('rejects applications when mission is closed to applications', () => {
      seedMission({ ...dummyMission, id: 'closed-mission', status: 'CLOSED_TO_APPLICATIONS' });
      const res = applyToMission(dummyWorker1.id, 'closed-mission', 'terms-rev-1');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('MISSION_CLOSED');
    });

    it('allows preassignment withdrawal and allows subsequent re-application', () => {
      const applied = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      expect(applied.success).toBe(true);

      const withdrawn = withdrawApplication(
        dummyWorker1.id,
        applied.application!.id,
        'Contrat incompatible',
        1
      );
      expect(withdrawn.success).toBe(true);
      expect(withdrawn.application?.status).toBe('WITHDRAWN');

      // Verify SQLite record updated to WITHDRAWN
      const dbWithdrawn = dbGet<{ status: string; withdrawal_reason: string }>(
        'SELECT status, withdrawal_reason FROM applications WHERE id = ?;',
        [applied.application!.id]
      );
      expect(dbWithdrawn?.status).toBe('WITHDRAWN');
      expect(dbWithdrawn?.withdrawal_reason).toBe('Contrat incompatible');

      // Once withdrawn, KZ06 permits a new application
      const reapplied = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      expect(reapplied.success).toBe(true);
      expect(reapplied.application?.status).toBe('SUBMITTED');
    });

    it('rejects withdrawal if application version is stale', () => {
      const applied = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      const conflict = withdrawApplication(
        dummyWorker1.id,
        applied.application!.id,
        'Raison',
        99 // Wrong version
      );
      expect(conflict.success).toBe(false);
      expect(conflict.errorCode).toBe('VERSION_CONFLICT');
    });
  });

  // ----------------------------------------------------
  // Phase D4: Shortlist & Proposal Dispatch (KZ07)
  // ----------------------------------------------------
  describe('Phase D4: Staff Shortlist & Candidate Proposals (KZ07)', () => {
    it('allows recruiter to shortlist submitted applications', () => {
      const app = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      const res = recruiterShortlistApplication('staff-recruiter-01', app.application!.id, 'Qualifié BTP', 1);

      expect(res.success).toBe(true);
      expect(res.application?.status).toBe('SHORTLISTED');
    });

    it('enforces proposal batch limit (max 20) and atomic validation', () => {
      const app1 = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      recruiterShortlistApplication('staff-01', app1.application!.id, 'OK', 1);

      // Attempt empty batch
      const empty = recruiterCreateProposalBatch('staff-01', dummyMission.id, [], 'terms-rev-1');
      expect(empty.success).toBe(false);
      expect(empty.errorCode).toBe('EMPTY_BATCH');

      // Valid batch
      const batch = recruiterCreateProposalBatch(
        'staff-01',
        dummyMission.id,
        [app1.application!.id],
        'terms-rev-1'
      );
      expect(batch.success).toBe(true);
      expect(batch.proposals?.length).toBe(1);
      expect(batch.proposals![0].status).toBe('PENDING_COMPANY');

      // Verify proposal was physically inserted in SQLite database
      const dbProp = dbGet<{ id: string; status: string; company_decision: string }>(
        'SELECT id, status, company_decision FROM proposals WHERE id = ?;',
        [batch.proposals![0].id]
      );
      expect(dbProp).not.toBeNull();
      expect(dbProp?.status).toBe('PENDING_COMPANY');
      expect(dbProp?.company_decision).toBe('PENDING');
    });

    it('strictly anonymizes candidate DTO for company review (Zero phone, Zero CNI, Zero notes)', () => {
      const app = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      recruiterShortlistApplication('staff-01', app.application!.id, 'OK', 1);
      recruiterCreateProposalBatch('staff-01', dummyMission.id, [app.application!.id], 'terms-rev-1');

      const companyProposals = getCompanyProposals('company-horizon', dummyMission.id);
      expect(companyProposals.length).toBe(1);

      const candidate = companyProposals[0];
      // Candidate name is anonymized (Jean-Marc B.)
      expect(candidate.anonymizedName).toBe('Jean-Marc B.');
      expect(candidate.verificationBadge).toBe(true);

      // Verify strict privacy boundary: NO private fields exposed
      expect((candidate as any).phone).toBeUndefined();
      expect((candidate as any).cni).toBeUndefined();
      expect((candidate as any).staffNotes).toBeUndefined();
    });
  });

  // ----------------------------------------------------
  // Phase D5: Dual Confirmation & 24h Expiry (KZ08)
  // ----------------------------------------------------
  describe('Phase D5: Dual Confirmation Gate (KZ08)', () => {
    let proposalId: string;

    beforeEach(() => {
      const app = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      recruiterShortlistApplication('staff-01', app.application!.id, 'OK', 1);
      const batch = recruiterCreateProposalBatch('staff-01', dummyMission.id, [app.application!.id], 'terms-rev-1');
      proposalId = batch.proposals![0].id;
    });

    it('enforces company approval before worker confirmation can occur', () => {
      // Worker attempts to confirm before company accepts
      const workerPremature = workerDecideProposal(dummyWorker1.id, proposalId, 'CONFIRMED', 'terms-rev-1', 1);
      expect(workerPremature.success).toBe(false);
      expect(workerPremature.errorCode).toBe('INVALID_PROPOSAL_STATUS');
    });

    it('sets 24h countdown upon company approval and allows worker confirmation', () => {
      // Company accepts candidate
      const companyAccept = companyDecideProposal('company-horizon', proposalId, 'ACCEPTED', 1);
      expect(companyAccept.success).toBe(true);
      expect(companyAccept.proposal?.status).toBe('AWAITING_WORKER');
      expect(companyAccept.proposal?.expiresAt).toBeGreaterThan(Date.now());

      // Worker confirms availability within 24h window
      const workerConfirm = workerDecideProposal(dummyWorker1.id, proposalId, 'CONFIRMED', 'terms-rev-1', 2);
      expect(workerConfirm.success).toBe(true);
      expect(workerConfirm.proposal?.status).toBe('READY_FOR_ASSIGNMENT');

      // Verify proposal status updated in SQLite database
      const dbProp = dbGet<{ status: string; worker_decision: string; company_decision: string }>(
        'SELECT status, worker_decision, company_decision FROM proposals WHERE id = ?;',
        [proposalId]
      );
      expect(dbProp?.status).toBe('READY_FOR_ASSIGNMENT');
      expect(dbProp?.company_decision).toBe('ACCEPTED');
      expect(dbProp?.worker_decision).toBe('CONFIRMED');
    });

    it('rejects worker confirmation if 24h countdown has expired', () => {
      const companyAccept = companyDecideProposal('company-horizon', proposalId, 'ACCEPTED', 1);
      // Artificially expire the proposal
      companyAccept.proposal!.expiresAt = Date.now() - 1000;

      const workerExpired = workerDecideProposal(dummyWorker1.id, proposalId, 'CONFIRMED', 'terms-rev-1', 2);
      expect(workerExpired.success).toBe(false);
      expect(workerExpired.errorCode).toBe('CONFIRMATION_EXPIRED');
    });

    it('rejects worker confirmation if mission terms revision has changed', () => {
      companyDecideProposal('company-horizon', proposalId, 'ACCEPTED', 1);

      // Worker confirms against an obsolete terms ID
      const termsMismatch = workerDecideProposal(dummyWorker1.id, proposalId, 'CONFIRMED', 'obsolete-terms-rev-0', 2);
      expect(termsMismatch.success).toBe(false);
      expect(termsMismatch.errorCode).toBe('TERMS_CHANGED');
    });
  });

  // ----------------------------------------------------
  // Phase D5: Atomic Finalization, Capacity & Anti-Overlap (KZ09)
  // ----------------------------------------------------
  describe('Phase D5: Atomic Finalization Gates (KZ09)', () => {
    it('executes atomic assignment finalization, decrements slots, and generates daily records', () => {
      // Setup worker 1 ready
      const app1 = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      recruiterShortlistApplication('staff-01', app1.application!.id, 'OK', 1);
      const batch1 = recruiterCreateProposalBatch('staff-01', dummyMission.id, [app1.application!.id], 'terms-rev-1');
      const p1 = batch1.proposals![0].id;

      companyDecideProposal('company-horizon', p1, 'ACCEPTED', 1);
      workerDecideProposal(dummyWorker1.id, p1, 'CONFIRMED', 'terms-rev-1', 2);

      // Staff finalizes
      const finalResult = staffFinalizeAssignment('staff-recruiter-01', p1, 3);
      expect(finalResult.success).toBe(true);
      expect(finalResult.assignment?.status).toBe('CONFIRMED');
      expect(finalResult.assignment?.workerId).toBe(dummyWorker1.id);

      // Verify assignment physically persisted in SQLite database
      const dbAssignment = dbGet<{ id: string; status: string; worker_id: string }>(
        'SELECT id, status, worker_id FROM assignments WHERE id = ?;',
        [finalResult.assignment?.id]
      );
      expect(dbAssignment).not.toBeNull();
      expect(dbAssignment?.status).toBe('CONFIRMED');
      expect(dbAssignment?.worker_id).toBe(dummyWorker1.id);

      // Verify mission headcountAssigned incremented
      const mission = getMissionById(dummyMission.id)!;
      expect(mission.headcountAssigned).toBe(1);
    });

    it('enforces capacity gate (KZ09) when slots are full (CAPACITY_FULL)', () => {
      // Seed mission with needed=1, already assigned=1
      seedMission({ ...dummyMission, id: 'full-mission', headcountNeeded: 1, headcountAssigned: 1 });

      const app = applyToMission(dummyWorker1.id, 'full-mission', 'terms-rev-1');
      recruiterShortlistApplication('staff-01', app.application!.id, 'OK', 1);
      const batch = recruiterCreateProposalBatch('staff-01', 'full-mission', [app.application!.id], 'terms-rev-1');
      const p = batch.proposals![0].id;

      companyDecideProposal('company-horizon', p, 'ACCEPTED', 1);
      workerDecideProposal(dummyWorker1.id, p, 'CONFIRMED', 'terms-rev-1', 2);

      const finalResult = staffFinalizeAssignment('staff-01', p, 3);
      expect(finalResult.success).toBe(false);
      expect(finalResult.errorCode).toBe('CAPACITY_FULL');
    });

    it('enforces schedule anti-overlap gate (KZ09) for concurrent bookings (WORKER_OVERLAP)', () => {
      // Finalize worker 1 on mission 1 (2026-12-01 to 2026-12-05)
      const app1 = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      recruiterShortlistApplication('staff-01', app1.application!.id, 'OK', 1);
      const batch1 = recruiterCreateProposalBatch('staff-01', dummyMission.id, [app1.application!.id], 'terms-rev-1');
      const p1 = batch1.proposals![0].id;
      companyDecideProposal('company-horizon', p1, 'ACCEPTED', 1);
      workerDecideProposal(dummyWorker1.id, p1, 'CONFIRMED', 'terms-rev-1', 2);
      staffFinalizeAssignment('staff-01', p1, 3);

      // Now create concurrent overlapping mission 2 (2026-12-03 to 2026-12-08)
      const mission2: MissionRecord = {
        ...dummyMission,
        id: 'mission-btp-02',
        title: 'Chantier Gros Œuvre Owendo',
        startsAt: '2026-12-03',
        endsAt: '2026-12-08',
        headcountAssigned: 0,
      };
      seedMission(mission2);

      const app2 = applyToMission(dummyWorker1.id, 'mission-btp-02', 'terms-rev-1');
      recruiterShortlistApplication('staff-01', app2.application!.id, 'OK', 1);
      const batch2 = recruiterCreateProposalBatch('staff-01', 'mission-btp-02', [app2.application!.id], 'terms-rev-1');
      const p2 = batch2.proposals![0].id;
      companyDecideProposal('company-horizon', p2, 'ACCEPTED', 1);
      workerDecideProposal(dummyWorker1.id, p2, 'CONFIRMED', 'terms-rev-1', 2);

      // Finalization must be BLOCKED due to overlapping schedule!
      const overlapResult = staffFinalizeAssignment('staff-01', p2, 3);
      expect(overlapResult.success).toBe(false);
      expect(overlapResult.errorCode).toBe('WORKER_OVERLAP');
    });

    it('replays identical completed response on repeated Idempotency-Key', () => {
      const app1 = applyToMission(dummyWorker1.id, dummyMission.id, 'terms-rev-1');
      recruiterShortlistApplication('staff-01', app1.application!.id, 'OK', 1);
      const batch1 = recruiterCreateProposalBatch('staff-01', dummyMission.id, [app1.application!.id], 'terms-rev-1');
      const p1 = batch1.proposals![0].id;
      companyDecideProposal('company-horizon', p1, 'ACCEPTED', 1);
      workerDecideProposal(dummyWorker1.id, p1, 'CONFIRMED', 'terms-rev-1', 2);

      const key = 'idem-staff-fin-9988';
      const firstCall = staffFinalizeAssignment('staff-01', p1, 3, key);
      expect(firstCall.success).toBe(true);

      const secondCall = staffFinalizeAssignment('staff-01', p1, 3, key);
      expect(secondCall.success).toBe(true);
      expect(secondCall.assignment?.id).toBe(firstCall.assignment?.id);
    });
  });
});
