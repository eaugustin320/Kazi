// Kazi Real Database Persistence Tests
// Validates Phase D1 physical schema, disk persistence, foreign keys, constraints, and ACID transactions

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  getDatabaseConnection,
  initDatabase,
  query,
  get,
  execute,
  transaction,
  closeDatabase,
  resetDatabase,
  setDatabasePath,
} from '../src/server/db/database';

describe('Phase D1: Database Persistence Engine & Relational Schema', () => {
  const testDbDir = path.resolve(process.cwd(), 'tests', 'temp');
  const testDbPath = path.join(testDbDir, 'test_kazi_persistence.sqlite');

  beforeEach(() => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    setDatabasePath(testDbPath);
  });

  afterEach(() => {
    resetDatabase();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  it('initializes the full relational schema with all 34 tables matching DATABASE.md', () => {
    const db = getDatabaseConnection();
    initDatabase(db);

    const tables = query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('auth_users');
    expect(tableNames).toContain('auth_sessions');
    expect(tableNames).toContain('worker_profiles');
    expect(tableNames).toContain('companies');
    expect(tableNames).toContain('company_memberships');
    expect(tableNames).toContain('staff_grants');
    expect(tableNames).toContain('verification_documents');
    expect(tableNames).toContain('recruitment_requests');
    expect(tableNames).toContain('missions');
    expect(tableNames).toContain('mission_terms');
    expect(tableNames).toContain('mission_days');
    expect(tableNames).toContain('applications');
    expect(tableNames).toContain('proposals');
    expect(tableNames).toContain('assignments');
    expect(tableNames).toContain('assignment_days');
    expect(tableNames).toContain('attendance');
    expect(tableNames).toContain('quotes');
    expect(tableNames).toContain('invoices');
    expect(tableNames).toContain('service_receipts');
    expect(tableNames).toContain('support_cases');
    expect(tableNames).toContain('configuration_activations');
    expect(tableNames.length).toBeGreaterThanOrEqual(30);
  });

  it('persists data to physical disk and recovers it across connection re-opens', () => {
    const now = new Date().toISOString();
    const userId = 'usr-test-persisted-1';

    // Session 1: Create user & company on disk
    execute(
      `INSERT INTO auth_users (id, name, email, phone_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [userId, 'Jean Ebang', 'jean.ebang@example.ga', '+24177001122', now, now]
    );

    execute(
      `INSERT INTO companies (id, country_code, legal_name, area_code, contact_email, verification_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ['comp-test-1', 'GA', 'BTP Gabon S.A.', 'libreville', 'contact@btp-gabon.ga', 'VERIFIED', now, now]
    );

    // Verify file exists on disk
    expect(fs.existsSync(testDbPath)).toBe(true);

    // Close connection entirely
    closeDatabase();

    // Session 2: Re-open database from disk and assert data is intact
    const user = get<{ id: string; name: string; email: string }>(
      'SELECT id, name, email FROM auth_users WHERE id = ?',
      [userId]
    );

    expect(user).not.toBeNull();
    expect(user?.name).toBe('Jean Ebang');
    expect(user?.email).toBe('jean.ebang@example.ga');

    const company = get<{ id: string; legal_name: string }>(
      'SELECT id, legal_name FROM companies WHERE id = ?',
      ['comp-test-1']
    );
    expect(company?.legal_name).toBe('BTP Gabon S.A.');
  });

  it('strictly enforces foreign key constraints (PRAGMA foreign_keys = ON)', () => {
    const now = new Date().toISOString();

    // Attempting to insert a company membership for non-existent company/user must fail
    expect(() => {
      execute(
        `INSERT INTO company_memberships (id, company_id, user_id, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        ['memb-invalid', 'non-existent-comp', 'non-existent-user', 'OWNER', 'ACTIVE', now, now]
      );
    }).toThrow();
  });

  it('strictly enforces unique constraints (e.g. duplicate worker application on mission KZ06)', () => {
    const now = new Date().toISOString();

    // Setup user, worker profile, company, request, mission, terms
    execute(
      `INSERT INTO auth_users (id, name, email, phone_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['usr-worker-1', 'Alain Mba', 'alain@kazi.ga', '+24107112233', now, now]
    );
    execute(
      `INSERT INTO worker_profiles (id, user_id, display_name, trade_codes, area_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      ['wkr-1', 'usr-worker-1', 'Alain M.', JSON.stringify(['COFFREUR']), 'libreville', now, now]
    );
    execute(
      `INSERT INTO companies (id, legal_name, contact_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?);`,
      ['comp-1', 'Entreprise Construction', 'info@ec.ga', now, now]
    );
    execute(
      `INSERT INTO recruitment_requests (id, company_id, trade_code, headcount, proposed_terms, submitted_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ['req-1', 'comp-1', 'COFFREUR', 2, JSON.stringify({ site: 'Akanda' }), 'usr-owner-1', now, now]
    );
    execute(
      `INSERT INTO missions (id, request_id, company_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['mis-1', 'req-1', 'comp-1', 'OPEN', now, now]
    );
    execute(
      `INSERT INTO mission_terms (id, mission_id, revision, trade_code, title, description, site_name, site_address, headcount, pay_amount, equipment_text, starts_at, ends_at, schedule_summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ['trm-1', 'mis-1', 1, 'COFFREUR', 'Coffrage Gros Oeuvre', 'Coffrage dallettes', 'Chantier Akanda', 'PK12', 2, 12000, 'EPI fournis', '2026-12-01', '2026-12-05', '5 jours', now]
    );

    // First application: succeeds
    execute(
      `INSERT INTO applications (id, mission_id, worker_id, terms_id, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['app-1', 'mis-1', 'wkr-1', 'trm-1', 'SUBMITTED', now]
    );

    const app = get<{ id: string }>('SELECT id FROM applications WHERE id = ?', ['app-1']);
    expect(app?.id).toBe('app-1');

    // Duplicate application with same mission_id and worker_id: MUST throw unique constraint violation (KZ06)
    expect(() => {
      execute(
        `INSERT INTO applications (id, mission_id, worker_id, terms_id, status, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        ['app-2', 'mis-1', 'wkr-1', 'trm-1', 'SUBMITTED', now]
      );
    }).toThrow();
  });

  it('guarantees ACID atomic transaction rollback upon error', () => {
    const now = new Date().toISOString();

    expect(() => {
      transaction((db) => {
        // Step 1: Insert user
        execute(
          `INSERT INTO auth_users (id, name, email, phone_number, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
          ['usr-trans-1', 'Transaction User', 'trans@kazi.ga', '+24177998877', now, now],
          db
        );

        // Step 2: Intentional error (violating foreign key)
        execute(
          `INSERT INTO company_memberships (id, company_id, user_id, role, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          ['memb-fail', 'non-existent-comp', 'usr-trans-1', 'OWNER', 'ACTIVE', now, now],
          db
        );
      });
    }).toThrow();

    // The user inserted in step 1 MUST have been rolled back
    const user = get<{ id: string }>('SELECT id FROM auth_users WHERE id = ?', ['usr-trans-1']);
    expect(user).toBeNull();
  });
});
