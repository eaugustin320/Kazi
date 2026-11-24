// Phase D9 & D10 Integration Tests: Theme/Country Administration, Staff Grants & Audit Trail
// Enforces API.md (lines 78-83, 94-95), THEMING_AND_COUNTRIES.md, and OPERATIONS_AND_SECURITY.md

import { describe, it, expect, beforeEach } from 'vitest';
import {
  previewConfiguration,
  activateConfiguration,
  getActiveConfig,
  provisionStaffMember,
  updateStaffMemberGrant,
  listStaffTeam,
  listAuditEvents,
  recordAuditEvent,
  resetAdminState,
  clearAdminMemoryCache,
} from '../src/modules/admin/service';
import { createSession, getSession } from '../src/server/auth/session';
import { execute, get, query, initDatabase, getDatabaseConnection } from '../src/server/db/database';

describe('Phase D9 & D10: Theme/Country Admin, Staff Grants & Redacted Audit', () => {
  beforeEach(() => {
    resetAdminState();
  });

  // ----------------------------------------------------
  // Configuration Preview & Activation (API.md lines 78-79, 94)
  // ----------------------------------------------------
  describe('Config Preview & Activation', () => {
    it('previews registered country and theme configuration without persistent mutation', () => {
      const res = previewConfiguration('GA@1.0.0', 'forest-premium@1.0.0');
      expect(res.success).toBe(true);
      expect(res.theme?.themeId).toBe('forest-premium@1.0.0');
      expect(res.country?.countryCode).toBe('GA');

      // Verify active pointer is untouched
      const active = getActiveConfig();
      expect(active.activeThemeId).toBe('gabon-premium@1.0.0');
    });

    it('strictly rejects unregisterd themes or raw user-supplied palettes', () => {
      const res = previewConfiguration('GA@1.0.0', 'custom-raw-hex-palette');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('UNREGISTERED_THEME');
    });

    it('activates registered theme configuration with audited pointer change', () => {
      const initial = getActiveConfig();
      const res = activateConfiguration({
        adminId: 'super-admin-01',
        countryConfigVersion: 'GA@1.0.0',
        themeId: 'forest-premium@1.0.0',
        reason: 'Passage en thème Forêt Tropicale pour validation utilisateur.',
        expectedActivationVersion: initial.activationVersion,
      });

      expect(res.success).toBe(true);
      expect(res.activePointer?.activeThemeId).toBe('forest-premium@1.0.0');
      expect(res.activePointer?.activationVersion).toBe(2);

      // Verify audit log has the pointer change recorded
      const audits = listAuditEvents('GA');
      expect(audits.length).toBe(1);
      expect(audits[0].action).toBe('CONFIG_ACTIVATED');
      expect(audits[0].details.themeId).toBe('forest-premium@1.0.0');
    });

    it('rejects concurrent activation on version conflict', () => {
      const conflict = activateConfiguration({
        adminId: 'super-admin-01',
        countryConfigVersion: 'GA@1.0.0',
        themeId: 'forest-premium@1.0.0',
        reason: 'Mise à jour concurrente',
        expectedActivationVersion: 999, // Stale version
      });

      expect(conflict.success).toBe(false);
      expect(conflict.errorCode).toBe('VERSION_CONFLICT');
    });
  });

  // ----------------------------------------------------
  // Controlled Staff Provisioning & Grant Updates (API.md lines 80-82)
  // ----------------------------------------------------
  describe('Controlled Staff Team Provisioning', () => {
    it('provisions staff account with specific country capabilities', () => {
      const res = provisionStaffMember({
        adminId: 'super-admin-01',
        email: 'recruteur.btp@kazi.ga',
        fullName: 'Marcelle Ondo',
        countryCode: 'GA',
        capabilities: ['RECRUITER'],
      });

      expect(res.success).toBe(true);
      expect(res.staff?.email).toBe('recruteur.btp@kazi.ga');
      expect(res.staff?.capabilities).toEqual(['RECRUITER']);
      expect(res.staff?.status).toBe('ACTIVE');

      const team = listStaffTeam('GA');
      expect(team.length).toBe(1);
    });

    it('rejects duplicate staff email registration', () => {
      provisionStaffMember({
        adminId: 'super-admin-01',
        email: 'finance@kazi.ga',
        fullName: 'Patrick Nguema',
        countryCode: 'GA',
        capabilities: ['FINANCE'],
      });

      const duplicate = provisionStaffMember({
        adminId: 'super-admin-01',
        email: 'finance@kazi.ga',
        fullName: 'Patrick Nguema',
        countryCode: 'GA',
        capabilities: ['FINANCE'],
      });

      expect(duplicate.success).toBe(false);
      expect(duplicate.errorCode).toBe('STAFF_EXISTS');
    });

    it('revoking staff grant terminates active user sessions immediately', () => {
      const provision = provisionStaffMember({
        adminId: 'super-admin-01',
        email: 'agent.depart@kazi.ga',
        fullName: 'Agent Temporaire',
        countryCode: 'GA',
        capabilities: ['RECRUITER'],
      });

      const staffUserId = provision.staff!.userId;

      // Create active session for this staff user
      const session = createSession({
        userId: staffUserId,
        role: 'STAFF',
        countryCode: 'GA',
        capabilities: ['RECRUITER'],
      });

      // Verify session is active
      expect(getSession(session.token)).not.toBeNull();

      // Super admin revokes staff member
      const updateRes = updateStaffMemberGrant({
        adminId: 'super-admin-01',
        staffId: provision.staff!.id,
        status: 'REVOKED',
        reason: 'Fin de contrat de prestation.',
        expectedVersion: 1,
      });

      expect(updateRes.success).toBe(true);
      expect(updateRes.staff?.status).toBe('REVOKED');

      // Verify active session was automatically revoked!
      expect(getSession(session.token)).toBeNull();
    });
  });

  // ----------------------------------------------------
  // Immutable Redacted Audit Trail (API.md line 83)
  // ----------------------------------------------------
  describe('Immutable Redacted Audit Trail', () => {
    it('records audit events and automatically redacts sensitive secrets and passwords', () => {
      recordAuditEvent({
        countryCode: 'GA',
        actorId: 'admin-01',
        action: 'USER_PASSWORD_RESET',
        details: {
          targetUserId: 'worker-01',
          tempPassword: 'SuperSecretPassword123!',
          apiSecretKey: 'kazi_live_secret_key',
          otpToken: '987654',
          cniDocumentNumber: '1029384756',
          safeNote: 'Réinitialisation demandée au guichet',
        },
      });

      const audits = listAuditEvents('GA');
      expect(audits.length).toBe(1);

      const event = audits[0];
      expect(event.action).toBe('USER_PASSWORD_RESET');
      expect(event.details.tempPassword).toBe('[REDACTED]');
      expect(event.details.apiSecretKey).toBe('[REDACTED]');
      expect(event.details.otpToken).toBe('[REDACTED]');
      expect(event.details.cniDocumentNumber).toBe('[REDACTED]');
      expect(event.details.safeNote).toBe('Réinitialisation demandée au guichet');
    });
  });

  // ----------------------------------------------------
  // SQLite Persistence & Recovery (Phase D9)
  // ----------------------------------------------------
  describe('SQLite Persistence & Recovery (Phase D9)', () => {
    beforeEach(() => {
      const db = getDatabaseConnection();
      initDatabase(db);
    });

    it('persists configuration activations, staff grants, and audit events to SQLite tables', () => {
      // 1. Activate configuration
      const actRes = activateConfiguration({
        adminId: 'super-admin-db',
        countryConfigVersion: 'GA@1.0.0',
        themeId: 'forest-premium@1.0.0',
        reason: 'Migration vers thème forêt tropicale',
        expectedActivationVersion: 1,
      });
      expect(actRes.success).toBe(true);

      const dbAct = get<any>(
        'SELECT * FROM configuration_activations WHERE country_code = \'GA\' ORDER BY activation_revision DESC LIMIT 1;'
      );
      expect(dbAct).not.toBeNull();
      expect(dbAct.theme_id).toBe('forest-premium@1.0.0');
      expect(dbAct.activation_revision).toBe(2);

      // 2. Provision staff member
      const provRes = provisionStaffMember({
        adminId: 'super-admin-db',
        email: 'recruteur.persist@kazi.ga',
        fullName: 'Recruteur Persist',
        countryCode: 'GA',
        capabilities: ['RECRUITER'],
      });
      expect(provRes.success).toBe(true);

      const dbGrant = get<any>(
        'SELECT * FROM staff_grants WHERE user_id = ?;',
        [provRes.staff!.userId]
      );
      expect(dbGrant).not.toBeNull();
      expect(dbGrant.capability).toBe('RECRUITER');
      expect(dbGrant.status).toBe('ACTIVE');

      // 3. Verify audit log entry in SQLite
      const dbAudits = query<any>('SELECT * FROM audit_events WHERE country_code = \'GA\';');
      expect(dbAudits.length).toBeGreaterThanOrEqual(2);
    });

    it('recovers active configuration and staff team from SQLite after memory cache purge', () => {
      // Activate configuration
      activateConfiguration({
        adminId: 'admin-10',
        countryConfigVersion: 'GA@1.0.0',
        themeId: 'forest-premium@1.0.0',
        reason: 'Activation permanente',
        expectedActivationVersion: 1,
      });

      // Provision staff
      provisionStaffMember({
        adminId: 'admin-10',
        email: 'recruteur.team@kazi.ga',
        fullName: 'Team Recruteur',
        countryCode: 'GA',
        capabilities: ['RECRUITER'],
      });

      // Purge in-memory state
      clearAdminMemoryCache();

      // Retrieve active config from DB
      const restoredConfig = getActiveConfig();
      expect(restoredConfig.activeThemeId).toBe('forest-premium@1.0.0');
      expect(restoredConfig.activationVersion).toBe(2);

      // Retrieve staff team from DB
      const restoredTeam = listStaffTeam('GA');
      expect(restoredTeam.length).toBeGreaterThanOrEqual(1);
      expect(restoredTeam.some((s) => s.email === 'recruteur.team@kazi.ga')).toBe(true);
    });
  });
});
