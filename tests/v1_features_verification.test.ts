// Kazi v1 Features & Multi-Session Refresh Verification Suite
// Verifies Attendance, Disputes, Replacements, Support, Notifications, Profiles, Billing & Multi-Session Persistence

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { startServer } from '../src/server/server';
import { getDatabaseConnection, initDatabase, setDatabasePath } from '../src/server/db/database';
import { hashPassword } from '../src/server/auth/passwords';
import { createSession } from '../src/server/auth/session';
import { createSupportCase, sendInAppNotification } from '../src/modules/support/service';
import { createDraftQuote, sendQuote, decideQuote, createInvoiceFromQuote } from '../src/modules/billing/service';
import { seedAttendanceRecord } from '../src/modules/attendance/service';

const TEST_PORT = 3109;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_DB_PATH = path.resolve(process.cwd(), 'data/kazi_test_v1_features.sqlite');

let server: http.Server;

describe('v1 Features: Attendance, Disputes, Replacements, Support, Notifications, Profiles & Billing', () => {
  let workerToken: string;
  let companyToken: string;
  let staffToken: string;

  const companyId = 'comp_v1_test';
  const workerUserId = 'usr_worker_v1';
  const workerProfileId = 'wp_worker_v1';
  const missionId = 'mission_v1_test';
  const assignmentId = 'asgn_v1_test';
  const assignmentDayId = 'day_v1_test';
  const attendanceId = 'att_v1_test';

  beforeAll(async () => {
    // Configure isolated SQLite database
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch {}
    }
    setDatabasePath(TEST_DB_PATH);
    const db = getDatabaseConnection(TEST_DB_PATH);
    initDatabase(db);

    const nowIso = new Date().toISOString();
    const pwdHash = hashPassword('Password123!');

    // 1. Seed Company
    db.prepare(`
      INSERT INTO auth_users (id, name, email, password_hash, created_at, updated_at)
      VALUES ('usr_company_v1', 'Directrice BTP', 'contact@btpv1.ga', ?, ?, ?);
    `).run(pwdHash, nowIso, nowIso);

    db.prepare(`
      INSERT INTO companies (id, country_code, legal_name, trade_sector, registration_reference, tax_reference, area_code, address, contact_email, verification_status, created_at, updated_at)
      VALUES (?, 'GA', 'BTP Horizon Gabon V1', 'Bâtiment & Travaux Publics', 'RG/LBV 2024 B 9999', 'NIF-998877-A', 'libreville', 'Zone Oloumi', 'contact@btpv1.ga', 'VERIFIED', ?, ?);
    `).run(companyId, nowIso, nowIso);

    db.prepare(`
      INSERT INTO company_memberships (id, company_id, user_id, role, status, created_at, updated_at)
      VALUES ('mem_comp_v1', ?, 'usr_company_v1', 'OWNER', 'ACTIVE', ?, ?);
    `).run(companyId, nowIso, nowIso);

    // 2. Seed Worker
    db.prepare(`
      INSERT INTO auth_users (id, name, email, phone_number, phone_verified, created_at, updated_at)
      VALUES (?, 'Paul Mba V1', 'paul@kazi.ga', '+24177001122', 1, ?, ?);
    `).run(workerUserId, nowIso, nowIso);

    db.prepare(`
      INSERT INTO worker_profiles (id, user_id, display_name, trade_codes, area_code, experience_text, created_at, updated_at)
      VALUES (?, ?, 'Paul Mba', '["coffreur", "ferrailleur"]', 'libreville', '6 ans d’expérience en gros œuvre', ?, ?);
    `).run(workerProfileId, workerUserId, nowIso, nowIso);

    // 3. Seed Staff
    db.prepare(`
      INSERT INTO auth_users (id, name, email, password_hash, created_at, updated_at)
      VALUES ('usr_staff_v1', 'Recruteur Staff V1', 'recruiter_v1@kazi.ga', ?, ?, ?);
    `).run(pwdHash, nowIso, nowIso);

    db.prepare(`
      INSERT INTO staff_grants (id, user_id, country_code, capability, status, version, created_at, updated_at)
      VALUES ('grant_v1_recruiter', 'usr_staff_v1', 'GA', 'RECRUITER', 'ACTIVE', 1, ?, ?);
    `).run(nowIso, nowIso);

    db.prepare(`
      INSERT INTO staff_grants (id, user_id, country_code, capability, status, version, created_at, updated_at)
      VALUES ('grant_v1_finance', 'usr_staff_v1', 'GA', 'FINANCE', 'ACTIVE', 1, ?, ?);
    `).run(nowIso, nowIso);

    // 4. Seed Relational Mission & Assignment for Attendance
    seedAttendanceRecord({
      id: attendanceId,
      assignmentDayId,
      assignmentId,
      missionId,
      companyId,
      workerId: workerProfileId,
      localDate: '2026-12-01',
      declaredStatus: 'NOT_RECORDED',
      declarationRevision: 0,
      workerDecision: 'PENDING',
      resolutionStatus: 'UNRESOLVED',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create Authenticated Sessions
    const workerSession = createSession({
      userId: workerUserId,
      role: 'WORKER',
      countryCode: 'GA',
      phone: '+24177001122',
      workerProfileId,
    });
    workerToken = workerSession.token;

    const companySession = createSession({
      userId: 'usr_company_v1',
      role: 'COMPANY',
      countryCode: 'GA',
      email: 'contact@btpv1.ga',
      companyId,
    });
    companyToken = companySession.token;

    const staffSession = createSession({
      userId: 'usr_staff_v1',
      role: 'STAFF',
      countryCode: 'GA',
      email: 'recruiter_v1@kazi.ga',
      mfaVerified: true,
      capabilities: ['RECRUITER', 'FINANCE'],
    });
    staffToken = staffSession.token;

    // Start test server
    server = startServer(TEST_PORT);
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    setDatabasePath(null);
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    } catch {}
  });

  // -------------------------------------------------------------------------
  // 1. Attendance Pointage & Listing
  // -------------------------------------------------------------------------
  it('Attendance Pointage: Company records daily attendance and retrieves persistent record', async () => {
    const putRes = await fetch(`${BASE_URL}/api/v1/assignment-days/${assignmentDayId}/attendance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${companyToken}`,
      },
      body: JSON.stringify({
        declaredStatus: 'PRESENT',
        workedMinutes: 480,
        note: 'Présent à l’heure, travail soigné',
        expectedVersion: 1,
      }),
    });

    expect(putRes.status).toBe(200);
    const putData = await putRes.json();
    expect(putData.data.declaredStatus).toBe('PRESENT');

    // Query attendance via GET /api/v1/attendance
    const listRes = await fetch(`${BASE_URL}/api/v1/attendance`, {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(Array.isArray(listData.data)).toBe(true);

    const target = listData.data.find((a: any) => a.id === attendanceId);
    expect(target).toBeDefined();
    expect(target.companyStatus).toBe('PRESENT');
    expect(target.hoursWorked).toBe(8);
  });

  // -------------------------------------------------------------------------
  // 2. Attendance Disputes & Staff Arbitration
  // -------------------------------------------------------------------------
  it('Disputes & Resolution: Worker contests pointage and Staff arbitrates resolution', async () => {
    // Worker disputes
    const disputeRes = await fetch(`${BASE_URL}/api/v1/attendance/${attendanceId}/worker-decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerToken}`,
      },
      body: JSON.stringify({
        decision: 'DISPUTED',
        reason: 'J’ai travaillé jusqu’à 17h au lieu de 16h avec le chef d’équipe.',
        expectedVersion: 1,
      }),
    });

    expect(disputeRes.status).toBe(200);
    const disputeData = await disputeRes.json();
    expect(disputeData.data.workerDecision).toBe('DISPUTED');

    // Staff resolves dispute
    const resolveRes = await fetch(`${BASE_URL}/api/v1/staff/attendance/${attendanceId}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        decision: 'CONFIRMED_PRESENT',
        resolutionNotes: 'Arbitrage Kazi : Pointage confirmé après vérification du cahier de chantier.',
        expectedVersion: 3,
      }),
    });

    expect(resolveRes.status).toBe(200);
    const resolveData = await resolveRes.json();
    expect(resolveData.data.resolutionStatus).toBe('RESOLVED_BY_STAFF');
  });

  // -------------------------------------------------------------------------
  // 3. Replacements Workflow (KZ11)
  // -------------------------------------------------------------------------
  it('Replacements: Records replacement request without fabricating assignments', async () => {
    const repRes = await fetch(`${BASE_URL}/api/v1/replacements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${companyToken}`,
      },
      body: JSON.stringify({
        assignmentId,
        missionId,
        workerId: workerProfileId,
        affectedDayIds: [assignmentDayId],
        reasonCode: 'WORKER_ABSENT',
        note: 'Absence imprévue pour raisons familiales',
      }),
    });

    expect(repRes.status).toBe(200);
    const repData = await repRes.json();
    expect(repData.data.status).toBe('REQUESTED');
    expect(repData.data.replacementAssignmentId).toBeUndefined(); // KZ11: No fabricated assignment
  });

  // -------------------------------------------------------------------------
  // 4. Support Cases & Thread Privacy Filter (STAFF_ONLY)
  // -------------------------------------------------------------------------
  it('Support & Messaging: Creates case, posts messages and strictly enforces STAFF_ONLY privacy filter', async () => {
    // 1. Worker creates support case
    const caseRes = await fetch(`${BASE_URL}/api/v1/support-cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerToken}`,
      },
      body: JSON.stringify({
        category: 'CHANTIER',
        subject: 'Équipement de protection individuel manquant',
        initialMessage: 'Les gants de manutention n’ont pas été fournis ce matin sur le chantier.',
      }),
    });

    expect([200, 201]).toContain(caseRes.status);
    const caseData = await caseRes.json();
    const caseId = caseData.data.id;
    expect(caseId).toBeDefined();

    // 2. Staff posts an internal note (STAFF_ONLY)
    const noteRes = await fetch(`${BASE_URL}/api/v1/support-cases/${caseId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        bodyText: '[NOTE INTERNE STAFF] Contacter le responsable sécurité de BTP Horizon.',
        isInternalNote: true,
      }),
    });
    expect([200, 201]).toContain(noteRes.status);

    // 3. Worker queries thread: internal note MUST NOT be visible
    const workerThreadRes = await fetch(`${BASE_URL}/api/v1/support-cases/${caseId}`, {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    expect(workerThreadRes.status).toBe(200);
    const workerThreadData = await workerThreadRes.json();
    const workerMessages = workerThreadData.data.messages;
    const hasInternalNote = workerMessages.some((m: any) => m.visibility === 'STAFF_ONLY');
    expect(hasInternalNote).toBe(false);

    // 4. Staff queries thread: internal note IS visible
    const staffThreadRes = await fetch(`${BASE_URL}/api/v1/support-cases/${caseId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    expect(staffThreadRes.status).toBe(200);
    const staffThreadData = await staffThreadRes.json();
    const staffMessages = staffThreadData.data.messages;
    const staffSeesInternal = staffMessages.some((m: any) => m.visibility === 'STAFF_ONLY');
    expect(staffSeesInternal).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. In-App Notifications
  // -------------------------------------------------------------------------
  it('Notifications: Retrieves user notifications and marks as read', async () => {
    // Send in-app notification to worker
    sendInAppNotification({
      userId: workerUserId,
      templateKey: 'MISSION_APPLICATION_SHORTLISTED',
      payload: { missionTitle: 'Coffrage voiles béton armé' },
    });

    // Worker fetches notifications
    const notifRes = await fetch(`${BASE_URL}/api/v1/me/notifications`, {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    expect(notifRes.status).toBe(200);
    const notifData = await notifRes.json();
    expect(notifData.data.length).toBeGreaterThan(0);

    const notifId = notifData.data[0].id;

    // Worker marks notification as read
    const readRes = await fetch(`${BASE_URL}/api/v1/me/notifications/${notifId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    expect(readRes.status).toBe(200);
    const readData = await readRes.json();
    expect(readData.data.read).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 6. Profiles & Verification Status
  // -------------------------------------------------------------------------
  it('Profiles: Enforces complete profile metadata and verification status in SQLite', async () => {
    const db = getDatabaseConnection(TEST_DB_PATH);

    // Check worker profile
    const wp = db.prepare('SELECT * FROM worker_profiles WHERE id = ?;').get(workerProfileId) as any;
    expect(wp).toBeDefined();
    expect(wp.profile_status).toBe('ACTIVE');
    expect(JSON.parse(wp.trade_codes)).toContain('coffreur');
    expect(wp.experience_text).toContain('6 ans');

    // Check company profile
    const cp = db.prepare('SELECT * FROM companies WHERE id = ?;').get(companyId) as any;
    expect(cp).toBeDefined();
    expect(cp.verification_status).toBe('VERIFIED');
    expect(cp.trade_sector).toBe('Bâtiment & Travaux Publics');
    expect(cp.registration_reference).toBe('RG/LBV 2024 B 9999');
  });

  // -------------------------------------------------------------------------
  // 7. Kazi Service Billing (Quotes, SAMPLE Invoices, Offline Receipts)
  // -------------------------------------------------------------------------
  it('Kazi Service Billing: Quotes, SAMPLE Invoices and Offline Receipts persist in SQLite', async () => {
    // 1. Staff creates quote
    const quoteRes = createDraftQuote({
      companyId,
      missionId,
      lines: [{ description: 'Frais de recrutement & suivi de mission', quantity: 1, unitAmount: 40000 }],
    });
    expect(quoteRes.success).toBe(true);
    const quoteId = quoteRes.quote!.id;

    // 2. Staff sends quote
    const sent = sendQuote('usr_staff_v1', quoteId, 1);
    expect(sent.success).toBe(true);

    // 3. Company accepts quote
    const accept = decideQuote(companyId, quoteId, 'ACCEPT', 2);
    expect(accept.success).toBe(true);

    // 4. Staff generates invoice from accepted quote
    const invRes = createInvoiceFromQuote({
      staffId: 'usr_staff_v1',
      acceptedQuoteId: quoteId,
      partyTaxSnapshot: {
        rccm: 'RG/LBV 2024 B 9999',
        nif: 'NIF-998877-A',
        legalName: 'BTP Horizon Gabon V1',
        billingAddress: 'Zone Oloumi, Libreville',
      },
    });
    expect(invRes.success).toBe(true);
    const invoiceId = invRes.invoice!.id;
    expect(invRes.invoice?.isSampleWatermark).toBe(true); // ADR-D0-04: Mandatory SAMPLE watermark

    // 5. Query company invoices via HTTP
    const compInvsRes = await fetch(`${BASE_URL}/api/v1/companies/${companyId}/invoices`, {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    expect(compInvsRes.status).toBe(200);
    const compInvsData = await compInvsRes.json();
    expect(compInvsData.data.some((i: any) => i.id === invoiceId)).toBe(true);

    // 6. Staff records an offline receipt
    const receiptRes = await fetch(`${BASE_URL}/api/v1/staff/invoices/${invoiceId}/receipts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        amount: 20000,
        externalReference: 'VIR-BGFI-2026-9901',
      }),
    });
    expect([200, 201]).toContain(receiptRes.status);

    // 7. Re-query invoice: verify paidAmount updated in SQLite
    const updatedInvRes = await fetch(`${BASE_URL}/api/v1/invoices/${invoiceId}`, {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    expect(updatedInvRes.status).toBe(200);
    const updatedInvData = await updatedInvRes.json();
    expect(updatedInvData.data.paidAmount).toBe(20000);
    expect(updatedInvData.data.status).toBe('PARTIALLY_PAID');
  });

  // -------------------------------------------------------------------------
  // 8. Multi-Session Refresh & Cross-Session Persistence
  // -------------------------------------------------------------------------
  it('Multi-Session Refresh: Existing records are recovered accurately across sessions and roles', async () => {
    // 1. Query as Worker
    const workerAppsRes = await fetch(`${BASE_URL}/api/v1/me/applications`, {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    expect(workerAppsRes.status).toBe(200);

    const workerAttRes = await fetch(`${BASE_URL}/api/v1/attendance`, {
      headers: { Authorization: `Bearer ${workerToken}` },
    });
    expect(workerAttRes.status).toBe(200);
    const workerAtt = await workerAttRes.json();
    expect(workerAtt.data.length).toBeGreaterThan(0);

    // 2. Query as Company
    const compMissionsRes = await fetch(`${BASE_URL}/api/v1/missions`, {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    expect(compMissionsRes.status).toBe(200);

    const compInvsRes = await fetch(`${BASE_URL}/api/v1/companies/${companyId}/invoices`, {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    expect(compInvsRes.status).toBe(200);
    const compInvs = await compInvsRes.json();
    expect(compInvs.data.length).toBeGreaterThan(0);

    // 3. Query as Staff
    const staffAttRes = await fetch(`${BASE_URL}/api/v1/attendance`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    expect(staffAttRes.status).toBe(200);
    const staffAtt = await staffAttRes.json();
    expect(staffAtt.data.length).toBeGreaterThan(0);

    const staffInvsRes = await fetch(`${BASE_URL}/api/v1/staff/invoices`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    expect(staffInvsRes.status).toBe(200);
    const staffInvs = await staffInvsRes.json();
    expect(staffInvs.data.length).toBeGreaterThan(0);
  });
});
