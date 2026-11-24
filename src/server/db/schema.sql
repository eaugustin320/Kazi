-- Kazi Database Schema DDL
-- Strictly implements DATABASE.md and prisma/schema.prisma
-- Target: SQLite (Development/Sandbox) & PostgreSQL compatible logical schema

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. Identity, Profiles & Permissions
CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  email_verified INTEGER DEFAULT 0,
  phone_number TEXT UNIQUE,
  phone_verified INTEGER DEFAULT 0,
  password_hash TEXT,
  image TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  role TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'GA',
  mfa_verified INTEGER DEFAULT 0,
  company_id TEXT,
  worker_profile_id TEXT,
  capabilities TEXT, -- JSON array of strings
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  expires_at INTEGER,
  password TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider_id, account_id)
);

CREATE TABLE IF NOT EXISTS auth_verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(identifier, value)
);

CREATE TABLE IF NOT EXISTS auth_otp_codes (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at INTEGER NOT NULL,
  verified INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'GA',
  display_name TEXT NOT NULL,
  trade_codes TEXT NOT NULL, -- JSON array
  area_code TEXT NOT NULL DEFAULT 'libreville',
  experience_text TEXT,
  availability_code TEXT NOT NULL DEFAULT 'AVAILABLE',
  profile_status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
  notification_preferences TEXT NOT NULL DEFAULT '{}', -- JSON
  preferred_locale TEXT NOT NULL DEFAULT 'fr-GA',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL DEFAULT 'GA',
  legal_name TEXT NOT NULL,
  trade_sector TEXT,
  registration_reference TEXT, -- RCCM
  tax_reference TEXT,          -- NIF
  area_code TEXT NOT NULL DEFAULT 'libreville',
  address TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  verification_status TEXT NOT NULL DEFAULT 'PENDING',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_memberships (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'OWNER',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(company_id, user_id)
);

CREATE TABLE IF NOT EXISTS staff_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'GA',
  capability TEXT NOT NULL, -- RECRUITER, FINANCE, SUPER_ADMIN
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, country_code, capability)
);

CREATE TABLE IF NOT EXISTS verification_documents (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  worker_profile_id TEXT REFERENCES worker_profiles(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  scan_status TEXT NOT NULL DEFAULT 'PENDING',
  review_status TEXT NOT NULL DEFAULT 'PENDING',
  reviewed_by TEXT,
  review_reason TEXT,
  retention_until TEXT,
  created_at TEXT NOT NULL
);

-- 2. Recruitment & Mission Delivery
CREATE TABLE IF NOT EXISTS recruitment_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'GA',
  trade_code TEXT NOT NULL,
  headcount INTEGER NOT NULL CHECK (headcount > 0),
  proposed_terms TEXT NOT NULL, -- JSON
  status TEXT NOT NULL DEFAULT 'DRAFT',
  submitted_by TEXT NOT NULL,
  reviewed_by TEXT,
  review_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_requests_company ON recruitment_requests(company_id, status, created_at);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES recruitment_requests(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'GA',
  current_terms_id TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_missions_country_status ON missions(country_code, status, created_at);

CREATE TABLE IF NOT EXISTS mission_terms (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  trade_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  site_name TEXT NOT NULL,
  area_code TEXT NOT NULL DEFAULT 'libreville',
  site_address TEXT NOT NULL,
  headcount INTEGER NOT NULL CHECK (headcount > 0),
  pay_amount INTEGER NOT NULL CHECK (pay_amount >= 0),
  pay_currency TEXT NOT NULL DEFAULT 'XAF',
  currency_exponent INTEGER NOT NULL DEFAULT 0,
  pay_unit TEXT NOT NULL DEFAULT 'DAY',
  payment_timing TEXT NOT NULL DEFAULT 'UPON_COMPLETION',
  payment_method TEXT NOT NULL DEFAULT 'DIRECT_COMPANY_PAYMENT',
  equipment_text TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Africa/Libreville',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  schedule_summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(mission_id, revision)
);

CREATE TABLE IF NOT EXISTS mission_days (
  id TEXT PRIMARY KEY,
  terms_id TEXT NOT NULL REFERENCES mission_terms(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 60,
  UNIQUE(terms_id, local_date)
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  terms_id TEXT NOT NULL REFERENCES mission_terms(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  submitted_at TEXT NOT NULL,
  withdrawal_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(mission_id, worker_id)
);
CREATE INDEX IF NOT EXISTS idx_applications_worker ON applications(worker_id, submitted_at);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  terms_id TEXT NOT NULL REFERENCES mission_terms(id) ON DELETE CASCADE,
  proposed_by TEXT NOT NULL,
  company_decision TEXT NOT NULL DEFAULT 'PENDING',
  worker_decision TEXT NOT NULL DEFAULT 'PENDING',
  company_decided_at TEXT,
  worker_decided_at TEXT,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_COMPANY',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE REFERENCES proposals(id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  terms_id TEXT NOT NULL REFERENCES mission_terms(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  confirmed_by TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  supersedes_assignment_id TEXT REFERENCES assignments(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS assignment_days (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  mission_day_id TEXT NOT NULL REFERENCES mission_days(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  coverage_status TEXT NOT NULL DEFAULT 'ACTIVE',
  UNIQUE(assignment_id, mission_day_id)
);
CREATE INDEX IF NOT EXISTS idx_assignment_days_worker ON assignment_days(worker_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  assignment_day_id TEXT NOT NULL UNIQUE REFERENCES assignment_days(id) ON DELETE CASCADE,
  declared_status TEXT NOT NULL DEFAULT 'NOT_RECORDED',
  worked_minutes INTEGER CHECK (worked_minutes IS NULL OR worked_minutes >= 0),
  declared_by TEXT,
  declaration_revision INTEGER NOT NULL DEFAULT 0,
  worker_decision TEXT NOT NULL DEFAULT 'PENDING',
  worker_confirmed_revision INTEGER,
  resolution_status TEXT NOT NULL DEFAULT 'UNRESOLVED',
  resolved_by TEXT,
  reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_events (
  id TEXT PRIMARY KEY,
  attendance_id TEXT NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  event_code TEXT NOT NULL,
  previous_value TEXT, -- JSON
  new_value TEXT NOT NULL, -- JSON
  event_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS replacement_requests (
  id TEXT PRIMARY KEY,
  original_assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  replacement_assignment_id TEXT,
  note TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. Commercial, Invoicing & Support Records
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL,
  country_code TEXT NOT NULL DEFAULT 'GA',
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  currency TEXT NOT NULL DEFAULT 'XAF',
  currency_exponent INTEGER NOT NULL DEFAULT 0,
  service_amount INTEGER NOT NULL CHECK (service_amount >= 0),
  tax_amount INTEGER NOT NULL CHECK (tax_amount >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  commercial_snapshot TEXT NOT NULL, -- JSON
  expires_at TEXT NOT NULL,
  accepted_by TEXT,
  accepted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'GA',
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'SAMPLE',
  currency TEXT NOT NULL DEFAULT 'XAF',
  currency_exponent INTEGER NOT NULL DEFAULT 0,
  subtotal_amount INTEGER NOT NULL CHECK (subtotal_amount >= 0),
  tax_amount INTEGER NOT NULL CHECK (tax_amount >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  party_tax_snapshot TEXT NOT NULL, -- JSON
  issued_at TEXT,
  due_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoices_company_status ON invoices(company_id, status, due_at);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_amount INTEGER NOT NULL CHECK (unit_amount >= 0),
  tax_amount INTEGER NOT NULL CHECK (tax_amount >= 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE IF NOT EXISTS service_receipts (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount != 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  currency_exponent INTEGER NOT NULL DEFAULT 0,
  external_reference TEXT NOT NULL,
  received_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  reverses_receipt_id TEXT UNIQUE REFERENCES service_receipts(id) ON DELETE SET NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(invoice_id, external_reference)
);

CREATE TABLE IF NOT EXISTS support_cases (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL DEFAULT 'GA',
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  worker_id TEXT REFERENCES worker_profiles(id) ON DELETE SET NULL,
  mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE SET NULL,
  reporter_user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'OPEN',
  assigned_staff_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cases_country_status ON support_cases(country_code, status, updated_at);

CREATE TABLE IF NOT EXISTS case_messages (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'PUBLIC_TO_CASE',
  body TEXT NOT NULL,
  event_at TEXT NOT NULL
);

-- 4. Notifications, Outbox, Audit & Config
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  template_key TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON
  read_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, event_id, template_key)
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload TEXT NOT NULL, -- JSON
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  leased_until TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS provider_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  processed_at TEXT,
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  country_code TEXT NOT NULL DEFAULT 'GA',
  company_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  redacted_change TEXT NOT NULL, -- JSON
  request_id TEXT,
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_country_time ON audit_events(country_code, occurred_at);

CREATE TABLE IF NOT EXISTS idempotency_records (
  id TEXT PRIMARY KEY,
  actor_scope TEXT NOT NULL,
  route_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_code INTEGER NOT NULL,
  response_body TEXT NOT NULL, -- JSON
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(actor_scope, route_key, idempotency_key)
);

CREATE TABLE IF NOT EXISTS configuration_activations (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  activation_revision INTEGER NOT NULL,
  config_version TEXT NOT NULL,
  theme_id TEXT NOT NULL,
  activated_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  UNIQUE(country_code, activation_revision)
);
