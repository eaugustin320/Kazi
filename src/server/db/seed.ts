// Kazi Development Database Seed Script
// Populates durable development SQLite database with test accounts and baseline fixtures
// Strictly implements I2 and I5 from BUILD_CORRECTION.md

import { getDatabaseConnection, initDatabase } from './database';
import { hashPassword } from '../auth/passwords';
import { seedWorker, seedMission } from '../../modules/applications/service';

export function seedDevDatabase(): void {
  const db = getDatabaseConnection();
  initDatabase(db);

  const nowIso = new Date().toISOString();
  const defaultPasswordHash = hashPassword('Password123!');

  console.log('[Seed] Seeding durable database with accounts and reference data...');

  // 1. Staff Accounts
  const staffAccounts = [
    { id: 'usr_staff_recruiter', email: 'recruiter@kazi.ga', name: 'Recruteur Kazi', caps: ['RECRUITER'] },
    { id: 'usr_staff_finance', email: 'finance@kazi.ga', name: 'Finance Kazi', caps: ['FINANCE'] },
    { id: 'usr_staff_admin', email: 'admin@kazi.ga', name: 'Administrateur Kazi', caps: ['RECRUITER', 'FINANCE', 'SUPER_ADMIN'] },
  ];

  for (const staff of staffAccounts) {
    db.prepare(
      `INSERT INTO auth_users (id, name, email, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash;`
    ).run(staff.id, staff.name, staff.email, defaultPasswordHash, nowIso, nowIso);

    for (const cap of staff.caps) {
      db.prepare(
        `INSERT INTO staff_grants (id, user_id, country_code, capability, status, version, created_at, updated_at)
         VALUES (?, ?, 'GA', ?, 'ACTIVE', 1, ?, ?)
         ON CONFLICT(id) DO NOTHING;`
      ).run(`grant_${staff.id}_${cap}`, staff.id, cap, nowIso, nowIso);
    }
  }

  // 2. Company Accounts & Profiles
  const companyId = 'company-a';
  const companyUserId = 'usr_company_btp';
  const companyEmail = 'contact@btphorizon.ga';

  db.prepare(
    `INSERT INTO auth_users (id, name, email, password_hash, created_at, updated_at)
     VALUES (?, 'Marc Ndong', ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash;`
  ).run(companyUserId, companyEmail, defaultPasswordHash, nowIso, nowIso);

  db.prepare(
    `INSERT INTO companies (id, country_code, legal_name, trade_sector, registration_reference, tax_reference, area_code, address, contact_email, verification_status, created_at, updated_at)
     VALUES (?, 'GA', 'BTP Horizon Gabon', 'Génie Civil & BTP', 'RG/FCV 2021 B 1409', '098432-A', 'libreville', 'Zone Industrielle Oloumi', ?, 'VERIFIED', ?, ?)
     ON CONFLICT(id) DO UPDATE SET verification_status = 'VERIFIED';`
  ).run(companyId, companyEmail, nowIso, nowIso);

  db.prepare(
    `INSERT INTO company_memberships (id, company_id, user_id, role, status, created_at, updated_at)
     VALUES ('mem_btp_owner', ?, ?, 'OWNER', 'ACTIVE', ?, ?)
     ON CONFLICT(id) DO NOTHING;`
  ).run(companyId, companyUserId, nowIso, nowIso);

  // 3. Worker Accounts & Profiles
  const worker1 = {
    id: 'wp_worker-01',
    userId: 'usr_worker_01',
    phone: '+24101000000',
    fullName: 'Paul Mba',
    tradeCodes: ['coffreur', 'ferrailleur'],
    areaCode: 'libreville',
    experienceYears: 6,
    verificationStatus: 'VERIFIED' as const,
  };

  const worker2 = {
    id: 'wp_worker-02',
    userId: 'usr_worker_02',
    phone: '+24102000000',
    fullName: 'Aimé Obame',
    tradeCodes: ['manoeuvre'],
    areaCode: 'owendo',
    experienceYears: 3,
    verificationStatus: 'VERIFIED' as const,
  };

  seedWorker(worker1);
  seedWorker(worker2);

  // 4. Initial Mission
  const mission1 = {
    id: 'mission-01',
    requestId: 'req-01',
    companyId: 'company-a',
    countryCode: 'GA',
    currentTermsId: 'terms-01',
    currentTermsRevision: 1,
    status: 'OPEN' as const,
    tradeCode: 'coffreur',
    title: 'Coffrage voiles béton armé - Chantier Bord de Mer',
    description: 'Pose de banches métalliques et coulage de voiles béton armé sur bâtiment R+3.',
    siteName: 'Chantier Résidence Bord de Mer',
    areaCode: 'libreville',
    siteAddress: 'Boulevard Triomphal, Libreville',
    meetingInstructions: 'Présentation au poste de garde à 07h00 avec EPI complet.',
    headcountNeeded: 3,
    headcountAssigned: 0,
    dayPayXAF: 15000,
    startsAt: '2026-12-01',
    endsAt: '2026-12-05',
    version: 1,
    createdAt: Date.now(),
  };

  seedMission(mission1);

  // 5. Baseline Assignment, Assignment Days & Daily Attendance Records (KZ10)
  // Ensure parent mission, terms, and worker profile exist in SQLite before seeding dependent records
  db.prepare(
    `INSERT INTO recruitment_requests (id, company_id, country_code, trade_code, headcount, proposed_terms, status, submitted_by, created_at, updated_at)
     VALUES ('req-01', 'company-a', 'GA', 'coffreur', 3, '{}', 'APPROVED', 'usr_company_btp', ?, ?)
     ON CONFLICT DO NOTHING;`
  ).run(nowIso, nowIso);

  db.prepare(
    `INSERT INTO missions (id, request_id, company_id, country_code, current_terms_id, status, version, created_at, updated_at)
     VALUES ('mission-01', 'req-01', 'company-a', 'GA', 'terms-01', 'OPEN', 1, ?, ?)
     ON CONFLICT DO NOTHING;`
  ).run(nowIso, nowIso);

  const activeMissionRow = (db
    .prepare("SELECT id FROM missions WHERE id = 'mission-01' OR company_id = 'company-a' ORDER BY created_at ASC LIMIT 1;")
    .get() as { id: string } | undefined) || { id: 'mission-01' };
  const seedMissionId = activeMissionRow.id;

  db.prepare(
    `INSERT INTO mission_terms (
       id, mission_id, revision, trade_code, title, description,
       site_name, area_code, site_address, headcount, pay_amount,
       pay_currency, currency_exponent, pay_unit, payment_timing,
       payment_method, equipment_text, timezone, starts_at, ends_at,
       schedule_summary, created_at
     ) VALUES ('terms-01', ?, 1, 'coffreur', 'Coffrage voiles béton armé - Chantier Bord de Mer', 'Pose de banches métalliques', 'Chantier Résidence Bord de Mer', 'libreville', 'Boulevard Triomphal', 3, 15000, 'XAF', 0, 'DAY', 'UPON_COMPLETION', 'DIRECT_COMPANY_PAYMENT', 'EPI', 'Africa/Libreville', '2026-12-01', '2026-12-05', '5 jours', ?)
     ON CONFLICT DO NOTHING;`
  ).run(seedMissionId, nowIso);

  const activeTermsRow = (db
    .prepare("SELECT id FROM mission_terms WHERE id = 'terms-01' OR mission_id = ? LIMIT 1;")
    .get(seedMissionId) as { id: string } | undefined) || { id: 'terms-01' };
  const seedTermsId = activeTermsRow.id;

  const activeWorkerRow = (db
    .prepare("SELECT id FROM worker_profiles WHERE id = 'wp_worker-01' OR display_name = 'Paul Mba' LIMIT 1;")
    .get() as { id: string } | undefined) || { id: 'wp_worker-01' };
  const seedWorkerId = activeWorkerRow.id;

  db.prepare(
    `INSERT INTO applications (id, mission_id, worker_id, terms_id, status, submitted_at, version)
     VALUES ('app-seed-01', ?, ?, ?, 'ASSIGNED', ?, 1)
     ON CONFLICT DO NOTHING;`
  ).run(seedMissionId, seedWorkerId, seedTermsId, nowIso);

  const seedApp = db
    .prepare('SELECT id FROM applications WHERE mission_id = ? AND worker_id = ? LIMIT 1;')
    .get(seedMissionId, seedWorkerId) as { id: string } | undefined;
  const seedAppId = seedApp?.id || 'app-seed-01';

  db.prepare(
    `INSERT INTO proposals (id, application_id, terms_id, proposed_by, company_decision, worker_decision, company_decided_at, worker_decided_at, status, version, created_at)
     VALUES ('prop-seed-01', ?, ?, 'usr_staff_recruiter', 'ACCEPTED', 'CONFIRMED', ?, ?, 'FINALIZED', 1, ?)
     ON CONFLICT DO NOTHING;`
  ).run(seedAppId, seedTermsId, nowIso, nowIso, nowIso);

  const seedProp = db
    .prepare("SELECT id FROM proposals WHERE id = 'prop-seed-01' OR application_id = ? LIMIT 1;")
    .get(seedAppId) as { id: string } | undefined;
  const seedPropId = seedProp?.id || 'prop-seed-01';

  db.prepare(
    `INSERT INTO assignments (id, proposal_id, mission_id, worker_id, terms_id, status, confirmed_by, confirmed_at, version)
     VALUES ('assign-01', ?, ?, ?, ?, 'CONFIRMED', 'usr_staff_recruiter', ?, 1)
     ON CONFLICT DO NOTHING;`
  ).run(seedPropId, seedMissionId, seedWorkerId, seedTermsId, nowIso);

  const seedAssign = db
    .prepare("SELECT id FROM assignments WHERE id = 'assign-01' OR proposal_id = ? LIMIT 1;")
    .get(seedPropId) as { id: string } | undefined;
  const seedAssignId = seedAssign?.id || 'assign-01';

  db.prepare(
    `INSERT INTO mission_days (id, terms_id, local_date, starts_at, ends_at, break_minutes)
     VALUES ('mday-01', ?, '2026-12-01', '2026-12-01T07:30:00Z', '2026-12-01T16:30:00Z', 60)
     ON CONFLICT DO NOTHING;`
  ).run(seedTermsId);

  db.prepare(
    `INSERT INTO mission_days (id, terms_id, local_date, starts_at, ends_at, break_minutes)
     VALUES ('mday-02', ?, '2026-12-02', '2026-12-02T07:30:00Z', '2026-12-02T16:30:00Z', 60)
     ON CONFLICT DO NOTHING;`
  ).run(seedTermsId);

  const mday1 = (db.prepare("SELECT id FROM mission_days WHERE id = 'mday-01' OR (terms_id = ? AND local_date = '2026-12-01') LIMIT 1;").get(seedTermsId) as { id: string } | undefined)?.id || 'mday-01';
  const mday2 = (db.prepare("SELECT id FROM mission_days WHERE id = 'mday-02' OR (terms_id = ? AND local_date = '2026-12-02') LIMIT 1;").get(seedTermsId) as { id: string } | undefined)?.id || 'mday-02';

  db.prepare(
    `INSERT INTO assignment_days (id, assignment_id, mission_day_id, worker_id, starts_at, ends_at, coverage_status)
     VALUES ('day-01', ?, ?, ?, '2026-12-01T07:30:00Z', '2026-12-01T16:30:00Z', 'ACTIVE')
     ON CONFLICT DO NOTHING;`
  ).run(seedAssignId, mday1, seedWorkerId);

  db.prepare(
    `INSERT INTO assignment_days (id, assignment_id, mission_day_id, worker_id, starts_at, ends_at, coverage_status)
     VALUES ('day-02', ?, ?, ?, '2026-12-02T07:30:00Z', '2026-12-02T16:30:00Z', 'ACTIVE')
     ON CONFLICT DO NOTHING;`
  ).run(seedAssignId, mday2, seedWorkerId);

  const day1 = (db.prepare("SELECT id FROM assignment_days WHERE id = 'day-01' OR (assignment_id = ? AND mission_day_id = ?) LIMIT 1;").get(seedAssignId, mday1) as { id: string } | undefined)?.id || 'day-01';
  const day2 = (db.prepare("SELECT id FROM assignment_days WHERE id = 'day-02' OR (assignment_id = ? AND mission_day_id = ?) LIMIT 1;").get(seedAssignId, mday2) as { id: string } | undefined)?.id || 'day-02';

  db.prepare(
    `INSERT INTO attendance (id, assignment_day_id, declared_status, worked_minutes, declared_by, declaration_revision, worker_decision, worker_confirmed_revision, resolution_status, reason, version, created_at, updated_at)
     VALUES ('att-01', ?, 'PRESENT', 480, 'company-a', 1, 'PENDING', NULL, 'UNRESOLVED', 'Ponctuel, coffrage conforme au plan.', 1, ?, ?)
     ON CONFLICT DO NOTHING;`
  ).run(day1, nowIso, nowIso);

  db.prepare(
    `INSERT INTO attendance (id, assignment_day_id, declared_status, worked_minutes, declared_by, declaration_revision, worker_decision, worker_confirmed_revision, resolution_status, reason, version, created_at, updated_at)
     VALUES ('att-02', ?, 'PARTIAL', 300, 'company-a', 1, 'DISPUTED', NULL, 'UNRESOLVED', 'J’ai travaillé jusqu’à 15h30 avec le chef d’équipe François.', 2, ?, ?)
     ON CONFLICT DO NOTHING;`
  ).run(day2, nowIso, nowIso);

  // 6. Baseline Service Quote & SAMPLE Invoice (KZ14 / ADR-D0-04)
  const quoteLines = JSON.stringify([
    {
      description: 'Prestation de sélection & mise à disposition Coffreur BTP (Chantier Bord de Mer)',
      quantity: 1,
      unitAmount: 45000,
      taxAmount: 8100,
      lineTotal: 53100,
    },
  ]);
  const expiresIso = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  db.prepare(
    `INSERT INTO quotes (id, company_id, mission_id, country_code, revision, status, currency, currency_exponent, service_amount, tax_amount, total_amount, commercial_snapshot, expires_at, accepted_by, accepted_at, version, created_at)
     VALUES ('quote-seed-01', 'company-a', ?, 'GA', 1, 'ACCEPTED', 'XAF', 0, 45000, 8100, 53100, ?, ?, 'company-a', ?, 2, ?)
     ON CONFLICT DO NOTHING;`
  ).run(seedMissionId, quoteLines, expiresIso, nowIso, nowIso);

  const partyTaxSnapshot = JSON.stringify({
    rccm: 'RG/FCV 2021 B 1409',
    nif: '098432-A',
    legalName: 'BTP Horizon Gabon',
    billingAddress: 'Zone Industrielle Oloumi, Libreville',
  });
  db.prepare(
    `INSERT INTO invoices (id, quote_id, company_id, country_code, invoice_number, status, currency, currency_exponent, subtotal_amount, tax_amount, total_amount, party_tax_snapshot, issued_at, due_at, version, created_at)
     VALUES ('inv-seed-01', 'quote-seed-01', 'company-a', 'GA', 'KZ-SAMPLE-GA-2026-0042', 'SAMPLE', 'XAF', 0, 45000, 8100, 53100, ?, ?, ?, 1, ?)
     ON CONFLICT DO NOTHING;`
  ).run(partyTaxSnapshot, nowIso, expiresIso, nowIso);

  // 7. Baseline Support Case & Messages with STAFF_ONLY internal note
  db.prepare(
    `INSERT INTO support_cases (id, country_code, company_id, worker_id, mission_id, assignment_id, reporter_user_id, category, subject, status, version, created_at, updated_at)
     VALUES ('ticket-01', 'GA', 'company-a', ?, ?, ?, 'usr_worker_01', 'CHANTIER', 'Confirmation de mission & point de ramassage', 'OPEN', 1, ?, ?)
     ON CONFLICT DO NOTHING;`
  ).run(seedWorkerId, seedMissionId, seedAssignId, nowIso, nowIso);

  db.prepare(
    `INSERT INTO case_messages (id, case_id, author_id, visibility, body, event_at)
     VALUES ('msg-seed-01', 'ticket-01', 'usr_worker_01', 'PUBLIC_TO_CASE', 'Bonjour Kazi, y a-t-il un bus de ramassage prévu au rond-point des Charbonnages lundi matin ?', ?)
     ON CONFLICT(id) DO NOTHING;`
  ).run(nowIso);

  db.prepare(
    `INSERT INTO case_messages (id, case_id, author_id, visibility, body, event_at)
     VALUES ('msg-seed-02', 'ticket-01', 'usr_staff_recruiter', 'PUBLIC_TO_CASE', 'Bonjour Paul, l’entreprise BTP Horizon met en place une navette à 06h20 précises aux Charbonnages. Casque obligatoire.', ?)
     ON CONFLICT(id) DO NOTHING;`
  ).run(nowIso);

  db.prepare(
    `INSERT INTO case_messages (id, case_id, author_id, visibility, body, event_at)
     VALUES ('msg-seed-03', 'ticket-01', 'usr_staff_recruiter', 'STAFF_ONLY', '[NOTE INTERNE STAFF] Vérifier avec Marc Ndong si la navette dessert aussi Owendo.', ?)
     ON CONFLICT(id) DO NOTHING;`
  ).run(nowIso);

  // 8. Baseline In-App Notifications
  db.prepare(
    `INSERT INTO notifications (id, user_id, event_id, template_key, payload, read_at, created_at)
     VALUES ('notif-seed-w1', 'usr_worker_01', 'evt-seed-w1', 'ASSIGNMENT_CONFIRMED', '{"title":"Affectation confirmée","message":"Votre mission Coffrage voiles béton armé débute le 01/12/2026 à 07h30."}', NULL, ?)
     ON CONFLICT(id) DO NOTHING;`
  ).run(nowIso);

  db.prepare(
    `INSERT INTO notifications (id, user_id, event_id, template_key, payload, read_at, created_at)
     VALUES ('notif-seed-c1', 'usr_company_btp', 'evt-seed-c1', 'INVOICE_SAMPLE_ISSUED', '{"title":"Facture de service Kazi (SAMPLE)","message":"La facture KZ-SAMPLE-GA-2026-0042 (53 100 FCFA TTC) est disponible."}', NULL, ?)
     ON CONFLICT(id) DO NOTHING;`
  ).run(nowIso);

  console.log('[Seed] Seed completed successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDevDatabase();
}
