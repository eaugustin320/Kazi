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

  console.log('[Seed] Seed completed successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDevDatabase();
}
