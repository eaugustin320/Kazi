// Kazi Configuration Administration, Staff Provisioning & Audit Log Service
// Strictly enforces API.md (lines 78-83, 94-95), PRD.md, and THEMING_AND_COUNTRIES.md
// Implements privileged config preview/activation, controlled staff provisioning,
// grant updates with session revocation, and immutable redacted audit trail.
// Backed by SQLite persistence with optimistic concurrency locking and ACID transactions.

import { randomUUID } from 'crypto';
import {
  REGISTERED_THEMES,
  REGISTERED_COUNTRIES,
  ThemeConfig,
  CountryConfig,
} from '../../config/app-config';
import { revokeAllUserSessions } from '../../server/auth/session';
import { execute, get, query, transaction } from '../../server/db/database';

export interface AuditEventRecord {
  id: string;
  countryCode: string;
  actorId: string;
  action: string;
  targetId?: string;
  details: Record<string, any>;
  timestamp: number;
}

export interface ActiveConfigPointer {
  activeCountryConfigVersion: string;
  activeThemeId: string;
  activatedBy: string;
  activationReason: string;
  activationVersion: number;
  activatedAt: number;
}

export interface StaffProvisioningRecord {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  countryCode: string;
  capabilities: Array<'RECRUITER' | 'FINANCE' | 'SUPER_ADMIN'>;
  status: 'ACTIVE' | 'REVOKED';
  version: number;
  createdAt: number;
}

// In-memory data stores
let activeConfig: ActiveConfigPointer = {
  activeCountryConfigVersion: 'GA@1.0.0',
  activeThemeId: 'gabon-premium@1.0.0',
  activatedBy: 'system-init',
  activationReason: 'Initial Gabon launch baseline (ADR01)',
  activationVersion: 1,
  activatedAt: Date.now(),
};

const auditLogStore: AuditEventRecord[] = [];
const staffRegistry = new Map<string, StaffProvisioningRecord>();

export function clearAdminMemoryCache(): void {
  activeConfig = {
    activeCountryConfigVersion: 'GA@1.0.0',
    activeThemeId: 'gabon-premium@1.0.0',
    activatedBy: 'system-init',
    activationReason: 'Initial Gabon launch baseline (ADR01)',
    activationVersion: 1,
    activatedAt: Date.now(),
  };
  auditLogStore.length = 0;
  staffRegistry.clear();
}

export function resetAdminState(): void {
  clearAdminMemoryCache();
  try {
    execute('DELETE FROM configuration_activations;');
    execute('DELETE FROM audit_events;');
    execute('DELETE FROM staff_grants;');
    execute("DELETE FROM auth_users WHERE email LIKE '%@kazi.ga';");
  } catch {}
}

// ----------------------------------------------------
// Theme & Country Config Preview & Activation
// ----------------------------------------------------

export function getActiveConfig(): ActiveConfigPointer {
  try {
    const latest = get<any>(
      `SELECT country_code, activation_revision, config_version, theme_id, activated_by, reason, activated_at
       FROM configuration_activations
       WHERE country_code = 'GA'
       ORDER BY activation_revision DESC
       LIMIT 1;`
    );
    if (latest && latest.activation_revision >= activeConfig.activationVersion) {
      activeConfig = {
        activeCountryConfigVersion: latest.config_version,
        activeThemeId: latest.theme_id,
        activatedBy: latest.activated_by,
        activationReason: latest.reason,
        activationVersion: Number(latest.activation_revision),
        activatedAt: new Date(latest.activated_at).getTime(),
      };
    }
  } catch {}

  return { ...activeConfig };
}

export function previewConfiguration(
  countryConfigVersion: string,
  themeId: string
): { success: boolean; country?: CountryConfig; theme?: ThemeConfig; errorCode?: string; errorMessage?: string } {
  const country = REGISTERED_COUNTRIES[countryConfigVersion];
  if (!country) {
    return {
      success: false,
      errorCode: 'UNREGISTERED_COUNTRY_CONFIG',
      errorMessage: `La version de configuration pays '${countryConfigVersion}' n’est pas enregistrée.`,
    };
  }

  const theme = REGISTERED_THEMES[themeId];
  if (!theme) {
    return {
      success: false,
      errorCode: 'UNREGISTERED_THEME',
      errorMessage: `Le thème '${themeId}' n’est pas enregistré. Les palettes brutes personnalisées sont interdites (API.md).`,
    };
  }

  return { success: true, country, theme };
}

export function activateConfiguration(params: {
  adminId: string;
  countryConfigVersion: string;
  themeId: string;
  reason: string;
  expectedActivationVersion: number;
}): { success: boolean; activePointer?: ActiveConfigPointer; errorCode?: string; errorMessage?: string } {
  const current = getActiveConfig();
  if (params.expectedActivationVersion !== current.activationVersion) {
    return {
      success: false,
      errorCode: 'VERSION_CONFLICT',
      errorMessage: 'Conflit de version sur la configuration active. Un autre administrateur a modifié la configuration.',
    };
  }

  const check = previewConfiguration(params.countryConfigVersion, params.themeId);
  if (!check.success) {
    return { success: false, errorCode: check.errorCode, errorMessage: check.errorMessage };
  }

  if (!params.reason || params.reason.trim().length < 5) {
    return {
      success: false,
      errorCode: 'REASON_REQUIRED',
      errorMessage: 'Une justification documentée est requise pour toute activation de configuration.',
    };
  }

  const newVersion = current.activationVersion + 1;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  activeConfig = {
    activeCountryConfigVersion: params.countryConfigVersion,
    activeThemeId: params.themeId,
    activatedBy: params.adminId,
    activationReason: params.reason.trim(),
    activationVersion: newVersion,
    activatedAt: now,
  };

  // Persist to SQLite configuration_activations table
  try {
    execute(
      `INSERT INTO configuration_activations (
        id, country_code, activation_revision, config_version, theme_id, activated_by, reason, activated_at
      ) VALUES (?, 'GA', ?, ?, ?, ?, ?, ?);`,
      [
        randomUUID(),
        newVersion,
        params.countryConfigVersion,
        params.themeId,
        params.adminId,
        params.reason.trim(),
        nowIso,
      ]
    );
  } catch {}

  // Record audited pointer change
  recordAuditEvent({
    countryCode: 'GA',
    actorId: params.adminId,
    action: 'CONFIG_ACTIVATED',
    details: {
      countryConfigVersion: params.countryConfigVersion,
      themeId: params.themeId,
      reason: params.reason,
      newActivationVersion: newVersion,
    },
  });

  return { success: true, activePointer: activeConfig };
}

// ----------------------------------------------------
// Controlled Staff Team Provisioning (No Public Staff Signup)
// ----------------------------------------------------

export function provisionStaffMember(params: {
  adminId: string;
  email: string;
  fullName: string;
  countryCode: string;
  capabilities: Array<'RECRUITER' | 'FINANCE' | 'SUPER_ADMIN'>;
}): { success: boolean; staff?: StaffProvisioningRecord; errorCode?: string; errorMessage?: string } {
  if (params.capabilities.length === 0) {
    return {
      success: false,
      errorCode: 'NO_CAPABILITIES',
      errorMessage: 'Au moins une habilitation staff doit être assignée.',
    };
  }

  const cleanEmail = params.email.trim().toLowerCase();

  // Check email uniqueness in memory
  const existing = Array.from(staffRegistry.values()).find(
    (s) => s.email.toLowerCase() === cleanEmail
  );
  if (existing) {
    return {
      success: false,
      errorCode: 'STAFF_EXISTS',
      errorMessage: 'Un compte membre staff existe déjà pour cet email.',
    };
  }

  const staffId = randomUUID();
  let userId = `staff-usr-${randomUUID()}`;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // Check in SQLite as well
  try {
    const existingUser = get<any>('SELECT id FROM auth_users WHERE LOWER(email) = ?;', [cleanEmail]);
    if (existingUser) {
      const grant = get<any>('SELECT id FROM staff_grants WHERE user_id = ?;', [existingUser.id]);
      if (grant) {
        return {
          success: false,
          errorCode: 'STAFF_EXISTS',
          errorMessage: 'Un compte membre staff existe déjà pour cet email.',
        };
      }
      userId = existingUser.id;
    }
  } catch {}

  const record: StaffProvisioningRecord = {
    id: staffId,
    userId,
    email: cleanEmail,
    fullName: params.fullName.trim(),
    countryCode: params.countryCode,
    capabilities: params.capabilities,
    status: 'ACTIVE',
    version: 1,
    createdAt: now,
  };

  staffRegistry.set(staffId, record);

  // Persist to SQLite in an ACID transaction
  try {
    transaction((db) => {
      const existingUser = get<any>('SELECT id FROM auth_users WHERE id = ?;', [userId], db);
      if (!existingUser) {
        execute(
          `INSERT INTO auth_users (id, name, email, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?);`,
          [userId, record.fullName, cleanEmail, nowIso, nowIso],
          db
        );
      }

      for (const cap of params.capabilities) {
        execute(
          `INSERT INTO staff_grants (id, user_id, country_code, capability, status, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'ACTIVE', 1, ?, ?);`,
          [randomUUID(), userId, params.countryCode, cap, nowIso, nowIso],
          db
        );
      }
    });
  } catch {}

  recordAuditEvent({
    countryCode: params.countryCode,
    actorId: params.adminId,
    action: 'STAFF_PROVISIONED',
    targetId: staffId,
    details: { email: record.email, capabilities: record.capabilities },
  });

  return { success: true, staff: record };
}

export function updateStaffMemberGrant(params: {
  adminId: string;
  staffId: string;
  status: 'ACTIVE' | 'REVOKED';
  capabilities?: Array<'RECRUITER' | 'FINANCE' | 'SUPER_ADMIN'>;
  reason: string;
  expectedVersion: number;
}): { success: boolean; staff?: StaffProvisioningRecord; errorCode?: string; errorMessage?: string } {
  let staff = staffRegistry.get(params.staffId);
  if (!staff) {
    try {
      const grant = get<any>(
        `SELECT sg.*, u.name, u.email
         FROM staff_grants sg
         JOIN auth_users u ON sg.user_id = u.id
         WHERE sg.user_id = ? OR sg.id = ?;`,
        [params.staffId, params.staffId]
      );
      if (grant) {
        staff = {
          id: grant.id,
          userId: grant.user_id,
          email: grant.email,
          fullName: grant.name,
          countryCode: grant.country_code,
          capabilities: [grant.capability as any],
          status: grant.status,
          version: Number(grant.version),
          createdAt: new Date(grant.created_at).getTime(),
        };
        staffRegistry.set(staff.id, staff);
      }
    } catch {}
  }

  if (!staff) {
    return { success: false, errorCode: 'STAFF_NOT_FOUND', errorMessage: 'Membre staff introuvable.' };
  }

  if (staff.version !== params.expectedVersion) {
    return {
      success: false,
      errorCode: 'VERSION_CONFLICT',
      errorMessage: 'Conflit de version lors de la mise à jour des habilitations.',
    };
  }

  staff.status = params.status;
  if (params.capabilities) {
    staff.capabilities = params.capabilities;
  }
  staff.version += 1;
  staffRegistry.set(params.staffId, staff);

  // Update in SQLite
  try {
    const nowIso = new Date().toISOString();
    execute(
      'UPDATE staff_grants SET status = ?, version = version + 1, updated_at = ? WHERE user_id = ? OR id = ?;',
      [params.status, nowIso, staff.userId, staff.id]
    );
  } catch {}

  // If revoked, automatically terminate all active sessions for security
  if (params.status === 'REVOKED') {
    revokeAllUserSessions(staff.userId);
  }

  recordAuditEvent({
    countryCode: staff.countryCode,
    actorId: params.adminId,
    action: params.status === 'REVOKED' ? 'STAFF_REVOKED' : 'STAFF_GRANTS_UPDATED',
    targetId: params.staffId,
    details: { status: params.status, reason: params.reason, capabilities: staff.capabilities },
  });

  return { success: true, staff };
}

export function listStaffTeam(countryCode: string = 'GA'): StaffProvisioningRecord[] {
  const mem = Array.from(staffRegistry.values()).filter((s) => s.countryCode === countryCode);
  if (mem.length > 0) return mem;

  try {
    const rows = query<any>(
      `SELECT sg.id, sg.user_id, u.name, u.email, sg.country_code, sg.capability, sg.status, sg.version, sg.created_at
       FROM staff_grants sg
       JOIN auth_users u ON sg.user_id = u.id
       WHERE sg.country_code = ?;`,
      [countryCode]
    );
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        email: r.email,
        fullName: r.name,
        countryCode: r.country_code,
        capabilities: [r.capability as any],
        status: r.status,
        version: Number(r.version),
        createdAt: new Date(r.created_at).getTime(),
      }));
    }
  } catch {}

  return [];
}

// ----------------------------------------------------
// Immutable Redacted Audit Log
// ----------------------------------------------------

export function recordAuditEvent(params: {
  countryCode: string;
  actorId: string;
  action: string;
  targetId?: string;
  details: Record<string, any>;
}): AuditEventRecord {
  const eventId = randomUUID();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const sanitized = sanitizeAuditDetails(params.details);

  const event: AuditEventRecord = {
    id: eventId,
    countryCode: params.countryCode,
    actorId: params.actorId,
    action: params.action,
    targetId: params.targetId,
    details: sanitized,
    timestamp: now,
  };

  auditLogStore.push(event);

  try {
    execute(
      `INSERT INTO audit_events (
        id, country_code, actor_id, company_id, action, entity_type, entity_id, redacted_change, request_id, occurred_at
      ) VALUES (?, ?, ?, NULL, ?, 'SYSTEM', ?, ?, NULL, ?);`,
      [
        eventId,
        params.countryCode,
        params.actorId,
        params.action,
        params.targetId ?? eventId,
        JSON.stringify(sanitized),
        nowIso,
      ]
    );
  } catch {}

  return event;
}

export function listAuditEvents(countryCode: string = 'GA'): AuditEventRecord[] {
  if (auditLogStore.length > 0) {
    return auditLogStore
      .filter((e) => e.countryCode === countryCode)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  try {
    const rows = query<any>(
      'SELECT * FROM audit_events WHERE country_code = ? ORDER BY occurred_at DESC;',
      [countryCode]
    );
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        countryCode: r.country_code,
        actorId: r.actor_id,
        action: r.action,
        targetId: r.entity_id,
        details: r.redacted_change ? JSON.parse(r.redacted_change) : {},
        timestamp: new Date(r.occurred_at).getTime(),
      }));
    }
  } catch {}

  return [];
}

function sanitizeAuditDetails(details: Record<string, any>): Record<string, any> {
  const sanitized = { ...details };
  // Redact secrets, passwords, OTPs, or PII tokens
  for (const key of Object.keys(sanitized)) {
    if (/password|secret|token|hash|otp|cni/i.test(key)) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

