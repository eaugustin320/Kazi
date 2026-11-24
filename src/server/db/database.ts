// Kazi Database Persistence Engine
// Powered by Node.js built-in node:sqlite (DatabaseSync)
// Strictly implements DATABASE.md, PRD.md, and WORKFLOWS.md
// Provides WAL mode, foreign key enforcement, transactions, and real disk persistence

import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

let defaultDbInstance: DatabaseSync | null = null;
let customDbPath: string | null = null;

export const DEFAULT_DB_DIR = path.resolve(process.cwd(), 'data');
export const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, 'kazi_dev.sqlite');

/**
 * Configure a custom database file path (e.g. for testing).
 */
export function setDatabasePath(filePath: string | null): void {
  if (defaultDbInstance) {
    defaultDbInstance.close();
    defaultDbInstance = null;
  }
  customDbPath = filePath;
}

/**
 * Loads and returns the singleton SQLite database instance.
 */
export function getDatabaseConnection(overridePath?: string): DatabaseSync {
  if (defaultDbInstance && !overridePath) {
    return defaultDbInstance;
  }

  const workerSuffix = process.env.VITEST_POOL_ID ? `_worker_${process.env.VITEST_POOL_ID}` : '';
  const defaultPath = process.env.VITEST_POOL_ID
    ? path.join(DEFAULT_DB_DIR, `kazi_test${workerSuffix}.sqlite`)
    : DEFAULT_DB_PATH;

  const targetPath = overridePath ?? customDbPath ?? process.env.KAZI_DB_PATH ?? defaultPath;

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);

  // Enforce WAL mode and strict relational integrity
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // Initialize schema if not present
  initDatabase(db);

  if (!overridePath) {
    defaultDbInstance = db;
  }

  return db;
}

/**
 * Initializes the database schema using schema.sql.
 */
export function initDatabase(db?: DatabaseSync): void {
  const activeDb = db ?? getDatabaseConnection();
  let schemaPath = path.resolve(process.cwd(), 'src/server/db/schema.sql');
  if (!fs.existsSync(schemaPath)) {
    try {
      const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
      schemaPath = path.resolve(dir, 'schema.sql');
    } catch {}
  }
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    activeDb.exec(schemaSql);
  }

  // Safe migrations for table alterations
  try {
    activeDb.exec("ALTER TABLE support_cases ADD COLUMN subject TEXT NOT NULL DEFAULT '';");
  } catch {}

  try {
    const tableSql = activeDb.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='service_receipts'").get() as { sql: string } | undefined;
    if (tableSql && tableSql.sql.includes('amount > 0')) {
      activeDb.exec('DROP TABLE IF EXISTS service_receipts;');
      activeDb.exec(`
        CREATE TABLE IF NOT EXISTS service_receipts (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL CHECK (amount != 0),
          currency TEXT NOT NULL DEFAULT 'XAF',
          currency_exponent INTEGER NOT NULL DEFAULT 0,
          external_reference TEXT NOT NULL,
          received_at TEXT NOT NULL,
          recorded_by TEXT NOT NULL,
          reverses_receipt_id TEXT REFERENCES service_receipts(id) ON DELETE SET NULL,
          note TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(invoice_id, external_reference)
        );
      `);
    }
  } catch {}
}

/**
 * Executes a SELECT query returning all matching rows as an array of type T.
 */
export function query<T>(sql: string, params: unknown[] = [], db?: DatabaseSync): T[] {
  const activeDb = db ?? getDatabaseConnection();
  const stmt = activeDb.prepare(sql);
  return stmt.all(...(params as any[])) as T[];
}

/**
 * Executes a SELECT query returning the first matching row or null.
 */
export function get<T>(sql: string, params: unknown[] = [], db?: DatabaseSync): T | null {
  const activeDb = db ?? getDatabaseConnection();
  const stmt = activeDb.prepare(sql);
  const row = stmt.get(...(params as any[]));
  return (row as T) ?? null;
}

/**
 * Executes an INSERT, UPDATE, or DELETE query returning changes count and lastInsertRowid.
 */
export function execute(
  sql: string,
  params: unknown[] = [],
  db?: DatabaseSync
): { changes: number | bigint; lastInsertRowid: number | bigint } {
  const activeDb = db ?? getDatabaseConnection();
  const stmt = activeDb.prepare(sql);
  const res = stmt.run(...(params as any[]));
  return {
    changes: res.changes,
    lastInsertRowid: res.lastInsertRowid,
  };
}

/**
 * Executes a function within an ACID transaction.
 * Automatically issues COMMIT on success or ROLLBACK on error.
 */
export function transaction<T>(fn: (db: DatabaseSync) => T, db?: DatabaseSync): T {
  const activeDb = db ?? getDatabaseConnection();
  activeDb.exec('BEGIN TRANSACTION;');
  try {
    const result = fn(activeDb);
    activeDb.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      activeDb.exec('ROLLBACK;');
    } catch {
      // rollback may fail if already aborted
    }
    throw err;
  }
}

/**
 * Closes the active database connection.
 */
export function closeDatabase(): void {
  if (defaultDbInstance) {
    try {
      defaultDbInstance.close();
    } catch {
      // ignore if already closed
    }
    defaultDbInstance = null;
  }
}

/**
 * Resets database state by closing connection and unlinking file if on disk.
 */
export function resetDatabase(): void {
  closeDatabase();
  const targetPath = customDbPath ?? process.env.KAZI_DB_PATH ?? DEFAULT_DB_PATH;
  if (targetPath !== ':memory:' && fs.existsSync(targetPath)) {
    try {
      fs.unlinkSync(targetPath);
      const walPath = `${targetPath}-wal`;
      const shmPath = `${targetPath}-shm`;
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    } catch {
      // ignore
    }
  }
}
