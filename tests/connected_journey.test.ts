// Kazi Connected Journey & Multi-Role Integration Test
// Strictly implements I3, I5, and I6 from BUILD_CORRECTION.md
// Tests all 8 vertical slice steps through actual HTTP server, authentic sessions, and SQLite database
// Proves tenant isolation, 24h confirmation, atomic capacity contention, and restart persistence

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { startServer } from '../src/server/server';
import { setDatabasePath, getDatabaseConnection, initDatabase } from '../src/server/db/database';
import { seedDevDatabase } from '../src/server/db/seed';
import { seedMission } from '../src/modules/applications/service';

const TEST_PORT = 3105;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_DB_PATH = path.resolve(process.cwd(), 'data', 'kazi_test_e2e_journey.sqlite');

let serverInstance: http.Server;

describe('I3–I6: Complete Connected Journey & Persistence Verification', () => {
  beforeAll(async () => {
    // Isolate test database
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch {}
    }
    setDatabasePath(TEST_DB_PATH);
    const db = getDatabaseConnection(TEST_DB_PATH);
    initDatabase(db);
    seedDevDatabase();

    // Start HTTP server on isolated port
    serverInstance = startServer(TEST_PORT);
    await new Promise((resolve) => setTimeout(resolve, 300));
  });

  afterAll(async () => {
    if (serverInstance) {
      serverInstance.close();
    }
    setDatabasePath(null);
  });

  // Track journey state across steps
  let companyCookie: string;
  let recruiterCookie: string;
  let workerCookie: string;
  let companyBCookie: string;

  let createdRequestId: string;
  let publishedMissionId: string;
  let workerApplicationId: string;
  let createdProposalId: string;
  let finalizedAssignmentId: string;

  it('Step 0: Health check endpoint returns 200 with database connected (I1)', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    expect(body.version).toBe('1.0.0');
  });

  it('Step 1: Company signs in and submits staffing request to SQLite (I3.1)', async () => {
    // Login as Company A
    const loginRes = await fetch(`${BASE_URL}/api/auth/company/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'contact@btphorizon.ga', password: 'Password123!' }),
    });
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    companyCookie = setCookie!.split(';')[0];

    // Create Draft Request
    const createReqRes = await fetch(`${BASE_URL}/api/v1/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: companyCookie,
      },
      body: JSON.stringify({
        tradeCode: 'coffreur',
        headcount: 2,
        siteName: 'Chantier Résidence Bord de Mer',
        commune: 'Libreville',
        siteAddress: 'Boulevard Triomphal, Libreville',
        startsAt: '2026-12-10',
        endsAt: '2026-12-14',
        dailyHours: '07h30 - 16h30',
        dayPayXAF: 15000,
        equipmentRequirements: 'Chaussures de sécurité coquées',
        specialInstructions: 'Briefing sécurité à 07h00',
      }),
    });
    expect(createReqRes.status).toBe(201);
    const createJson = await createReqRes.json();
    expect(createJson.data.id).toBeDefined();
    createdRequestId = createJson.data.id;
    expect(createJson.data.status).toBe('DRAFT');

    // Submit Request
    const submitReqRes = await fetch(`${BASE_URL}/api/v1/requests/${createdRequestId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: companyCookie,
      },
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    expect(submitReqRes.status).toBe(200);
    const submitJson = await submitReqRes.json();
    expect(submitJson.data.status).toBe('SUBMITTED');

    // Verify persisted in SQLite
    const db = getDatabaseConnection(TEST_DB_PATH);
    const row = db.prepare('SELECT status, trade_code, headcount FROM recruitment_requests WHERE id = ?').get(createdRequestId) as any;
    expect(row).toBeDefined();
    expect(row.status).toBe('SUBMITTED');
    expect(row.trade_code).toBe('coffreur');
    expect(row.headcount).toBe(2);
  });

  it('Step 2: Recruiter in separate context reviews and publishes mission (I3.2)', async () => {
    // Authenticate Recruiter Staff
    const loginStaffRes = await fetch(`${BASE_URL}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'recruiter@kazi.ga', password: 'Password123!' }),
    });
    expect(loginStaffRes.status).toBe(200);
    const staffChallenge = await loginStaffRes.json();
    expect(staffChallenge.data.mfaTicket).toBeDefined();

    const mfaRes = await fetch(`${BASE_URL}/api/auth/staff/mfa-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'recruiter@kazi.ga',
        mfaTicket: staffChallenge.data.mfaTicket,
        code: '123456',
      }),
    });
    expect(mfaRes.status).toBe(200);
    const setCookie = mfaRes.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    recruiterCookie = setCookie!.split(';')[0];

    // 1. Review and Approve request (KZ04)
    const reviewRes = await fetch(`${BASE_URL}/api/v1/staff/requests/${createdRequestId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recruiterCookie,
      },
      body: JSON.stringify({ decision: 'APPROVE', reason: 'Demande conforme aux critères', expectedVersion: 2 }),
    });
    expect(reviewRes.status).toBe(200);

    // 2. Publish request into OPEN mission (KZ04)
    const publishRes = await fetch(`${BASE_URL}/api/v1/staff/requests/${createdRequestId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recruiterCookie,
      },
      body: JSON.stringify({ expectedVersion: 3 }),
    });
    expect(publishRes.status).toBe(201);
    const publishJson = await publishRes.json();
    expect(publishJson.data.missionId).toBeDefined();
    publishedMissionId = publishJson.data.missionId;

    // Verify mission in SQLite
    const db = getDatabaseConnection(TEST_DB_PATH);
    const missionRow = db.prepare('SELECT status, current_terms_id FROM missions WHERE id = ?').get(publishedMissionId) as any;
    expect(missionRow).toBeDefined();
    expect(missionRow.status).toBe('OPEN');
  });

  it('Step 3: Worker in separate context discovers mission and applies (I3.3)', async () => {
    // Authenticate Worker Paul Mba
    const sendOtpRes = await fetch(`${BASE_URL}/api/auth/worker/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+24101000000' }),
    });
    expect(sendOtpRes.status).toBe(200);
    const otpJson = await sendOtpRes.json();
    const code = otpJson.data.debugCode || '123456';

    const verifyOtpRes = await fetch(`${BASE_URL}/api/auth/worker/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+24101000000', code }),
    });
    expect(verifyOtpRes.status).toBe(200);
    const setCookie = verifyOtpRes.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    workerCookie = setCookie!.split(';')[0];

    // View public missions
    const missionsRes = await fetch(`${BASE_URL}/api/v1/missions`);
    expect(missionsRes.status).toBe(200);
    const missionsJson = await missionsRes.json();
    expect(missionsJson.data.length).toBeGreaterThan(0);

    // Apply to published mission
    const db = getDatabaseConnection(TEST_DB_PATH);
    const termsRow = db.prepare('SELECT current_terms_id FROM missions WHERE id = ?').get(publishedMissionId) as any;
    const termsId = termsRow.current_terms_id;

    const applyRes = await fetch(`${BASE_URL}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: workerCookie,
      },
      body: JSON.stringify({ missionId: publishedMissionId, termsId }),
    });
    expect(applyRes.status).toBe(201);
    const applyJson = await applyRes.json();
    expect(applyJson.data.id).toBeDefined();
    workerApplicationId = applyJson.data.id;
    expect(applyJson.data.status).toBe('SUBMITTED');

    // Duplicate application rejection invariant (KZ06)
    const dupRes = await fetch(`${BASE_URL}/api/v1/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: workerCookie,
      },
      body: JSON.stringify({ missionId: publishedMissionId, termsId }),
    });
    expect(dupRes.status).toBe(409);
  });

  it('Step 4: Recruiter shortlists and proposes worker to company (I3.4)', async () => {
    // Shortlist application
    const shortlistRes = await fetch(`${BASE_URL}/api/v1/staff/applications/${workerApplicationId}/shortlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recruiterCookie,
      },
      body: JSON.stringify({ reason: 'Ouvrier expérimenté', expectedVersion: 1 }),
    });
    expect(shortlistRes.status).toBe(200);

    // Create proposal batch (KZ07)
    const db = getDatabaseConnection(TEST_DB_PATH);
    const termsRow = db.prepare('SELECT current_terms_id FROM missions WHERE id = ?').get(publishedMissionId) as any;

    const propBatchRes = await fetch(`${BASE_URL}/api/v1/staff/missions/${publishedMissionId}/proposals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recruiterCookie,
      },
      body: JSON.stringify({
        applicationIds: [workerApplicationId],
        termsId: termsRow.current_terms_id,
      }),
    });
    expect(propBatchRes.status).toBe(201);
    const propBatchJson = await propBatchRes.json();
    expect(propBatchJson.data.length).toBe(1);
    createdProposalId = propBatchJson.data[0].id;
    expect(propBatchJson.data[0].status).toBe('PENDING_COMPANY');
  });

  it('Step 5: Company views candidate with zero privacy leakage and accepts (I3.5)', async () => {
    // List company proposals
    const listPropRes = await fetch(`${BASE_URL}/api/v1/companies/company-a/proposals`, {
      headers: { Cookie: companyCookie },
    });
    expect(listPropRes.status).toBe(200);
    const propsJson = await listPropRes.json();
    expect(propsJson.data.length).toBeGreaterThan(0);

    const candidate = propsJson.data.find((p: any) => p.proposalId === createdProposalId);
    expect(candidate).toBeDefined();
    // Zero privacy leakage assertion
    expect(candidate.phone).toBeUndefined();
    expect(candidate.cniNumber).toBeUndefined();
    expect(candidate.staffNotes).toBeUndefined();

    // Company accepts candidate
    const acceptRes = await fetch(`${BASE_URL}/api/v1/proposals/${createdProposalId}/company-decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: companyCookie,
      },
      body: JSON.stringify({ decision: 'ACCEPTED', expectedVersion: 1 }),
    });
    expect(acceptRes.status).toBe(200);
    const acceptJson = await acceptRes.json();
    expect(acceptJson.data.status).toBe('AWAITING_WORKER');
    expect(acceptJson.data.expiresAt).toBeDefined();
  });

  it('Step 6: Worker confirms terms within 24h window (I3.6)', async () => {
    const db = getDatabaseConnection(TEST_DB_PATH);
    const termsRow = db.prepare('SELECT current_terms_id FROM missions WHERE id = ?').get(publishedMissionId) as any;

    const confirmRes = await fetch(`${BASE_URL}/api/v1/proposals/${createdProposalId}/worker-decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: workerCookie,
      },
      body: JSON.stringify({
        decision: 'CONFIRMED',
        termsId: termsRow.current_terms_id,
        expectedVersion: 2,
      }),
    });
    expect(confirmRes.status).toBe(200);
    const confirmJson = await confirmRes.json();
    expect(confirmJson.data.status).toBe('READY_FOR_ASSIGNMENT');
  });

  it('Step 7: Recruiter finalizes assignment with capacity and anti-overlap locks (I3.7)', async () => {
    const finalizeRes = await fetch(`${BASE_URL}/api/v1/staff/proposals/${createdProposalId}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: recruiterCookie,
      },
      body: JSON.stringify({ expectedVersion: 3 }),
    });
    expect(finalizeRes.status).toBe(201);
    const finalizeJson = await finalizeRes.json();
    expect(finalizeJson.data.id).toBeDefined();
    finalizedAssignmentId = finalizeJson.data.id;
    expect(finalizeJson.data.status).toBe('CONFIRMED');

    // Verify atomic state in SQLite
    const db = getDatabaseConnection(TEST_DB_PATH);
    const assignRow = db.prepare('SELECT status, worker_id, mission_id FROM assignments WHERE id = ?').get(finalizedAssignmentId) as any;
    expect(assignRow).toBeDefined();
    expect(assignRow.status).toBe('CONFIRMED');

    const propRow = db.prepare('SELECT status FROM proposals WHERE id = ?').get(createdProposalId) as any;
    expect(propRow.status).toBe('FINALIZED');
  });

  it('Step 8: Persistence survives server restart and preserves exact committed state (I3.8)', async () => {
    // 1. Close current running server
    serverInstance.close();
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 2. Restart server on same database
    serverInstance = startServer(TEST_PORT);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 3. Verify health
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    expect(healthRes.status).toBe(200);

    // 4. Verify request, mission, application, and assignment in SQLite after restart
    const db = getDatabaseConnection(TEST_DB_PATH);
    const req = db.prepare('SELECT id, status FROM recruitment_requests WHERE id = ?').get(createdRequestId) as any;
    expect(req.status).toBe('APPROVED');

    const mission = db.prepare('SELECT id, status FROM missions WHERE id = ?').get(publishedMissionId) as any;
    expect(mission.status).toBe('OPEN');

    const assignCount = db.prepare('SELECT count(*) as count FROM assignments WHERE mission_id = ?').get(publishedMissionId) as any;
    expect(assignCount.count).toBe(1);

    const assign = db.prepare('SELECT id, status FROM assignments WHERE id = ?').get(finalizedAssignmentId) as any;
    expect(assign.status).toBe('CONFIRMED');
  });

  it('Security Boundary: Tenant isolation prevents Company B from viewing Company A data', async () => {
    // Register Company B
    const compBRes = await fetch(`${BASE_URL}/api/auth/company/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legalName: 'Entreprise B Gabon',
        tradeSector: 'Transport',
        registrationReference: 'RG/FCV 2024 B 9999',
        taxReference: '999999-B',
        address: 'Zone Portuaire, Owendo',
        contactEmail: 'contact@compb.ga',
        contactPhone: '+24106208899',
        password: 'Password123!',
      }),
    });
    expect(compBRes.status).toBe(201);
    const setCookie = compBRes.headers.get('set-cookie');
    companyBCookie = setCookie!.split(';')[0];

    // Company B tries to view Company A's candidate proposals
    const unauthorizedAccessRes = await fetch(`${BASE_URL}/api/v1/companies/company-a/proposals`, {
      headers: { Cookie: companyBCookie },
    });
    // PRD security invariant: return 404 to avoid revealing another company's resources
    expect(unauthorizedAccessRes.status).toBe(404);
  });

  it('Security Boundary: Worker cannot access staff or publish missions', async () => {
    const workerForbiddenRes = await fetch(`${BASE_URL}/api/v1/staff/requests/${createdRequestId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: workerCookie,
      },
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    expect(workerForbiddenRes.status).toBe(403);
  });

  it('Contention Safety: Concurrent finalization for the last available slot on the SAME database (I6)', async () => {
    // 1. Seed a single-slot mission directly into the active test database
    const singleSlotMissionId = 'mission_single_slot_contention';
    const singleSlotTermsId = 'terms_single_slot_contention';
    const nowIso = new Date().toISOString();

    seedMission({
      id: singleSlotMissionId,
      requestId: 'req_single_slot',
      companyId: 'company-a',
      countryCode: 'GA',
      currentTermsId: singleSlotTermsId,
      currentTermsRevision: 1,
      status: 'OPEN',
      tradeCode: 'coffreur',
      title: 'Mission 1 Place',
      description: 'Test contention',
      siteName: 'Chantier',
      areaCode: 'libreville',
      siteAddress: 'Libreville',
      headcountNeeded: 1,
      headcountAssigned: 0,
      dayPayXAF: 15000,
      startsAt: '2026-12-20',
      endsAt: '2026-12-22',
      version: 1,
      createdAt: Date.now(),
    });

    const db = getDatabaseConnection(TEST_DB_PATH);

    // Seed two competing proposals in READY_FOR_ASSIGNMENT state
    const prop1Id = 'prop_contention_1';
    const prop2Id = 'prop_contention_2';
    const futureExpires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    // Create applications for foreign keys
    db.prepare(`INSERT INTO applications (id, mission_id, worker_id, terms_id, status, submitted_at, version) VALUES ('app_c1', ?, 'wp_worker-01', ?, 'SHORTLISTED', ?, 1);`).run(singleSlotMissionId, singleSlotTermsId, nowIso);
    db.prepare(`INSERT INTO applications (id, mission_id, worker_id, terms_id, status, submitted_at, version) VALUES ('app_c2', ?, 'wp_worker-02', ?, 'SHORTLISTED', ?, 1);`).run(singleSlotMissionId, singleSlotTermsId, nowIso);

    db.prepare(
      `INSERT INTO proposals (id, application_id, terms_id, proposed_by, company_decision, worker_decision, status, version, expires_at, created_at)
       VALUES (?, 'app_c1', ?, 'recruiter', 'ACCEPTED', 'CONFIRMED', 'READY_FOR_ASSIGNMENT', 1, ?, ?);`
    ).run(prop1Id, singleSlotTermsId, futureExpires, nowIso);

    db.prepare(
      `INSERT INTO proposals (id, application_id, terms_id, proposed_by, company_decision, worker_decision, status, version, expires_at, created_at)
       VALUES (?, 'app_c2', ?, 'recruiter', 'ACCEPTED', 'CONFIRMED', 'READY_FOR_ASSIGNMENT', 1, ?, ?);`
    ).run(prop2Id, singleSlotTermsId, futureExpires, nowIso);

    // Fire concurrent finalizations against the SAME mission and SAME database
    const [res1, res2] = await Promise.all([
      fetch(`${BASE_URL}/api/v1/staff/proposals/${prop1Id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: recruiterCookie },
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
      fetch(`${BASE_URL}/api/v1/staff/proposals/${prop2Id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: recruiterCookie },
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
    ]);

    const statuses = [res1.status, res2.status];
    // Exactly one must succeed (201) and one must be rejected (409 CAPACITY_FULL)
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    // Verify in database: exactly 1 assignment created for this mission
    const totalAssignments = db.prepare('SELECT count(*) as count FROM assignments WHERE mission_id = ?').get(singleSlotMissionId) as any;
    expect(totalAssignments.count).toBe(1);
  });

  it('Contention Safety: Duplicate finalization and anti-overlap collision prevention (I6)', async () => {
    // 1. Re-finalizing an already finalized proposal is rejected
    const dupFinalizeRes = await fetch(`${BASE_URL}/api/v1/staff/proposals/${createdProposalId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: recruiterCookie },
      body: JSON.stringify({ expectedVersion: 3 }),
    });
    // Rejects with 409 (version conflict or status invalid)
    expect(dupFinalizeRes.status).toBe(409);

    // 2. Schedule anti-overlap: worker wp_worker-01 is already assigned to 2026-12-10..2026-12-14
    // Attempting to finalize an overlapping assignment for the same worker
    const overlapPropId = 'prop_overlap_test';
    const overlapMissionId = 'mission_overlap_test';
    const overlapTermsId = 'terms_overlap_test';
    const nowIso = new Date().toISOString();
    const futureExpires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    seedMission({
      id: overlapMissionId,
      requestId: 'req_overlap',
      companyId: 'company-a',
      countryCode: 'GA',
      currentTermsId: overlapTermsId,
      currentTermsRevision: 1,
      status: 'OPEN',
      tradeCode: 'coffreur',
      title: 'Mission Chevauchante',
      description: 'Test overlap',
      siteName: 'Chantier',
      areaCode: 'libreville',
      siteAddress: 'Libreville',
      headcountNeeded: 2,
      headcountAssigned: 0,
      dayPayXAF: 15000,
      startsAt: '2026-12-12',
      endsAt: '2026-12-16',
      version: 1,
      createdAt: Date.now(),
    });

    const db = getDatabaseConnection(TEST_DB_PATH);

    db.prepare(`INSERT INTO applications (id, mission_id, worker_id, terms_id, status, submitted_at, version) VALUES ('app_overlap', ?, 'wp_worker-01', ?, 'SHORTLISTED', ?, 1);`).run(overlapMissionId, overlapTermsId, nowIso);

    db.prepare(
      `INSERT INTO proposals (id, application_id, terms_id, proposed_by, company_decision, worker_decision, status, version, expires_at, created_at)
       VALUES (?, 'app_overlap', ?, 'recruiter', 'ACCEPTED', 'CONFIRMED', 'READY_FOR_ASSIGNMENT', 1, ?, ?);`
    ).run(overlapPropId, overlapTermsId, futureExpires, nowIso);

    const overlapRes = await fetch(`${BASE_URL}/api/v1/staff/proposals/${overlapPropId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: recruiterCookie },
      body: JSON.stringify({ expectedVersion: 1 }),
    });

    // Invariant: rejected with 409 WORKER_OVERLAP
    expect(overlapRes.status).toBe(409);
    const overlapJson = await overlapRes.json();
    expect(overlapJson.error.code).toBe('WORKER_OVERLAP');
  });
});
