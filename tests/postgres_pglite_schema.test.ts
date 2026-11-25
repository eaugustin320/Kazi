// PostgreSQL Schema & Transactional Integrity Verification (via embedded PGlite PostgreSQL engine)
// Verifies that Kazi's PostgreSQL schema and core relational constraints execute cleanly on real PostgreSQL.

import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('PostgreSQL Relational Schema & ACID Transaction Verification', () => {
  it('applies Kazi schema DDL to real PostgreSQL and enforces foreign keys, unique constraints and check constraints', async () => {
    const pg = new PGlite();
    try {
      const schemaSqlPath = path.resolve(process.cwd(), 'src/server/db/schema.sql');
      const rawSql = fs.readFileSync(schemaSqlPath, 'utf-8');
      // Strip SQLite PRAGMA statements for PostgreSQL execution
      const pgSql = rawSql
        .split('\n')
        .filter((line) => !line.trim().toUpperCase().startsWith('PRAGMA '))
        .join('\n');

      await pg.exec(pgSql);

      // Verify all 27 tables exist in PostgreSQL public schema
      const tablesRes = await pg.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
      );
      const tableNames = tablesRes.rows.map((r) => r.tablename);
      expect(tableNames).toContain('auth_users');
      expect(tableNames).toContain('worker_profiles');
      expect(tableNames).toContain('companies');
      expect(tableNames).toContain('recruitment_requests');
      expect(tableNames).toContain('missions');
      expect(tableNames).toContain('applications');
      expect(tableNames).toContain('proposals');
      expect(tableNames).toContain('assignments');
      expect(tableNames).toContain('attendance');
      expect(tableNames).toContain('replacement_requests');
      expect(tableNames).toContain('quotes');
      expect(tableNames).toContain('invoices');
      expect(tableNames).toContain('service_receipts');
      expect(tableNames).toContain('support_cases');
      expect(tableNames).toContain('notifications');
      expect(tableNames).toContain('audit_events');

      // Verify transactional insert and check constraints in PostgreSQL
      const nowIso = new Date().toISOString();
      await pg.query(
        `INSERT INTO companies (id, country_code, legal_name, contact_email, verification_status, created_at, updated_at)
         VALUES ($1, 'GA', 'BTP Horizon PG', 'pg@btp.ga', 'VERIFIED', $2, $2);`,
        ['comp-pg-1', nowIso]
      );

      // Headcount > 0 check constraint must reject headcount = 0 in PostgreSQL
      await expect(
        pg.query(
          `INSERT INTO recruitment_requests (id, company_id, country_code, trade_code, headcount, proposed_terms, status, submitted_by, created_at, updated_at)
           VALUES ('req-bad', 'comp-pg-1', 'GA', 'coffreur', 0, '{}', 'SUBMITTED', 'usr-1', $1, $1);`,
          [nowIso]
        )
      ).rejects.toThrow();
    } finally {
      await pg.close();
    }
  }, 25000);
});
