// Phase D7 Integration Tests: Support Cases, Thread Privacy Scoping & Notifications Outbox
// Enforces PRD.md, WORKFLOWS.md, and API.md (lines 62-65, 76-77, 86)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSupportCase,
  postCaseMessage,
  getCaseThread,
  transitionCaseStatus,
  listUserCases,
  sendInAppNotification,
  listUserNotifications,
  markNotificationAsRead,
  enqueueOutboxEvent,
  processPendingOutboxEvents,
  resetSupportState,
  clearSupportMemoryCache,
  getCaseById,
  MAX_MESSAGE_LENGTH,
} from '../src/modules/support/service';
import { execute, get, query, initDatabase, getDatabaseConnection } from '../src/server/db/database';

describe('Phase D7: Support Cases, Privacy Scoping & Notification Outbox', () => {
  beforeEach(() => {
    resetSupportState();
  });

  // ----------------------------------------------------
  // Support Case Creation & Thread Scoping
  // ----------------------------------------------------
  describe('Support Case Creation & Validation', () => {
    it('creates support case with valid parameters and initial message', () => {
      const res = createSupportCase({
        reporterUserId: 'worker-user-01',
        role: 'WORKER',
        workerId: 'worker-01',
        category: 'CHANTIER',
        subject: 'Équipement de sécurité manquant',
        initialMessage: 'Sur le chantier d’Akanda, les casques de sécurité n’ont pas été distribués ce matin.',
      });

      expect(res.success).toBe(true);
      expect(res.caseRecord?.status).toBe('OPEN');
      expect(res.caseRecord?.category).toBe('CHANTIER');
      expect(res.initialMessageRecord?.visibility).toBe('PUBLIC_TO_CASE');
    });

    it('rejects message exceeding 4000 characters limit', () => {
      const longMessage = 'A'.repeat(MAX_MESSAGE_LENGTH + 1);
      const res = createSupportCase({
        reporterUserId: 'worker-user-01',
        role: 'WORKER',
        category: 'CHANTIER',
        subject: 'Sujet valide',
        initialMessage: longMessage,
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('MESSAGE_TOO_LONG');
    });

    it('lists cases scoped by role (worker sees only own; staff sees all)', () => {
      // Case 1 by Worker A
      createSupportCase({
        reporterUserId: 'user-w1',
        role: 'WORKER',
        workerId: 'worker-01',
        category: 'PAIEMENT',
        subject: 'Retard virement',
        initialMessage: 'Paiement attendu.',
      });

      // Case 2 by Company B
      createSupportCase({
        reporterUserId: 'user-c1',
        role: 'COMPANY',
        companyId: 'company-01',
        category: 'POINTAGE',
        subject: 'Correction pointage',
        initialMessage: 'Erreur sur le pointage du 2 déc.',
      });

      // Worker A query
      const workerCases = listUserCases({ userId: 'user-w1', role: 'WORKER', workerId: 'worker-01' });
      expect(workerCases.length).toBe(1);
      expect(workerCases[0].subject).toBe('Retard virement');

      // Staff query
      const staffCases = listUserCases({ userId: 'staff-01', role: 'STAFF' });
      expect(staffCases.length).toBe(2);
    });
  });

  // ----------------------------------------------------
  // Thread Privacy: STAFF_ONLY Internal Notes Filter
  // ----------------------------------------------------
  describe('Thread Privacy & STAFF_ONLY Notes', () => {
    let caseId: string;

    beforeEach(() => {
      const res = createSupportCase({
        reporterUserId: 'user-w1',
        role: 'WORKER',
        workerId: 'worker-01',
        category: 'POINTAGE',
        subject: 'Litige sur pointage',
        initialMessage: 'Mon pointage a été marqué absent à tort.',
      });
      caseId = res.caseRecord!.id;
    });

    it('prevents non-staff from posting STAFF_ONLY notes', () => {
      const res = postCaseMessage({
        caseId,
        authorId: 'user-w1',
        authorRole: 'WORKER',
        authorName: 'Jean-Marc B.',
        body: 'Tentative de note interne',
        visibility: 'STAFF_ONLY',
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('FORBIDDEN_VISIBILITY');
    });

    it('allows staff to post STAFF_ONLY notes and filters them for workers', () => {
      // Staff posts public reply to worker
      postCaseMessage({
        caseId,
        authorId: 'staff-01',
        authorRole: 'STAFF',
        authorName: 'Support Kazi',
        body: 'Nous avons bien reçu votre signalement et contactons le chef de chantier.',
        visibility: 'PUBLIC_TO_CASE',
      });

      // Staff posts confidential internal note
      postCaseMessage({
        caseId,
        authorId: 'staff-01',
        authorRole: 'STAFF',
        authorName: 'Support Kazi (Note Interne)',
        body: 'NOTE CONFIDENTIELLE : L’entreprise a un historique de contestations abusives. À vérifier en priorité.',
        visibility: 'STAFF_ONLY',
      });

      // Worker retrieves thread: must NOT see the STAFF_ONLY note!
      const workerThread = getCaseThread(caseId, false);
      expect(workerThread?.messages.length).toBe(2); // Initial + public staff reply
      const staffNotesExposed = workerThread?.messages.some((m) => m.visibility === 'STAFF_ONLY');
      expect(staffNotesExposed).toBe(false);

      // Staff retrieves thread: sees all 3 messages
      const staffThread = getCaseThread(caseId, true);
      expect(staffThread?.messages.length).toBe(3);
    });

    it('allows staff to transition case status with optimistic locking', () => {
      const res = transitionCaseStatus('staff-01', caseId, 'IN_PROGRESS', 1);
      expect(res.success).toBe(true);
      expect(res.caseRecord?.status).toBe('IN_PROGRESS');

      // Stale version conflict
      const conflict = transitionCaseStatus('staff-01', caseId, 'RESOLVED', 1);
      expect(conflict.success).toBe(false);
      expect(conflict.errorCode).toBe('VERSION_CONFLICT');
    });
  });

  // ----------------------------------------------------
  // In-App Notifications & Outbox Pattern
  // ----------------------------------------------------
  describe('In-App Notifications & Outbox Delivery', () => {
    it('creates in-app notification and idempotently records read timestamp', () => {
      const notif = sendInAppNotification({
        userId: 'user-01',
        templateKey: 'assignment.confirmed',
        payload: { missionTitle: 'Chantier Akanda', startsAt: '2026-12-01' },
      });

      expect(notif.readAt).toBeUndefined();

      const list = listUserNotifications('user-01');
      expect(list.length).toBe(1);

      // Mark read
      const ok = markNotificationAsRead('user-01', notif.id);
      expect(ok).toBe(true);

      const updatedList = listUserNotifications('user-01');
      expect(updatedList[0].readAt).toBeDefined();
    });

    it('processes outbox events with retry and dead-letter on persistent failure', () => {
      enqueueOutboxEvent({
        eventKey: 'sms.otp.dispatch',
        aggregateId: 'user-w1',
        payload: { phone: '+24177001122', code: '123456' },
      });

      // 1. Success scenario
      let res = processPendingOutboxEvents(() => true);
      expect(res.delivered).toBe(1);

      // 2. Failure with retry & dead-letter scenario
      const failingEvent = enqueueOutboxEvent({
        eventKey: 'email.quote.sent',
        aggregateId: 'company-01',
        payload: { email: 'invalid@example.com' },
      });

      // Simulate 5 consecutive failures
      for (let i = 0; i < 5; i++) {
        failingEvent.nextAttemptAt = Date.now() - 10; // artificially fast-forward backoff
        processPendingOutboxEvents(() => false);
      }

      // 5th failure moves to DEAD_LETTER
      expect(failingEvent.status).toBe('DEAD_LETTER');
    });
  });

  // ----------------------------------------------------
  // SQLite Persistence & Recovery
  // ----------------------------------------------------
  describe('SQLite Persistence & Recovery (Phase D7)', () => {
    beforeEach(() => {
      const db = getDatabaseConnection();
      initDatabase(db);
    });

    it('persists support case, messages, notifications and outbox to SQLite tables', () => {
      // 1. Create support case
      const res = createSupportCase({
        reporterUserId: 'worker-u-persist',
        role: 'WORKER',
        category: 'CHANTIER',
        subject: 'Équipement détérioré',
        initialMessage: 'Mes gants de protection sont troués et inutilisables.',
      });
      expect(res.success).toBe(true);
      const caseId = res.caseRecord!.id;

      // Verify case in SQLite
      const dbCase = get<any>('SELECT * FROM support_cases WHERE id = ?;', [caseId]);
      expect(dbCase).not.toBeNull();
      expect(dbCase.subject).toBe('Équipement détérioré');
      expect(dbCase.status).toBe('OPEN');

      // Verify initial message in SQLite
      const dbMsg = get<any>('SELECT * FROM case_messages WHERE case_id = ?;', [caseId]);
      expect(dbMsg).not.toBeNull();
      expect(dbMsg.visibility).toBe('PUBLIC_TO_CASE');
      expect(dbMsg.body).toContain('gants de protection');

      // Verify outbox event queued in SQLite
      const dbOutbox = get<any>('SELECT * FROM outbox_events WHERE aggregate_id = ?;', [caseId]);
      expect(dbOutbox).not.toBeNull();
      expect(dbOutbox.event_key).toBe('support.case.opened');

      // 2. Post staff internal note
      const staffNoteRes = postCaseMessage({
        caseId,
        authorId: 'staff-99',
        authorRole: 'STAFF',
        authorName: 'Support Staff',
        body: 'CONFIDENTIEL : Renouvellement EPI pris en charge par l’agence.',
        visibility: 'STAFF_ONLY',
      });
      expect(staffNoteRes.success).toBe(true);

      const dbStaffMsg = get<any>('SELECT * FROM case_messages WHERE case_id = ? AND visibility = \'STAFF_ONLY\';', [caseId]);
      expect(dbStaffMsg).not.toBeNull();
      expect(dbStaffMsg.visibility).toBe('STAFF_ONLY');

      // 3. Send in-app notification & mark read
      const notif = sendInAppNotification({
        userId: 'worker-u-persist',
        templateKey: 'support.reply.received',
        payload: { caseId, summary: 'Nouvelle réponse du support' },
      });

      const dbNotif1 = get<any>('SELECT * FROM notifications WHERE id = ?;', [notif.id]);
      expect(dbNotif1).not.toBeNull();
      expect(dbNotif1.read_at).toBeNull();

      markNotificationAsRead('worker-u-persist', notif.id);
      const dbNotif2 = get<any>('SELECT * FROM notifications WHERE id = ?;', [notif.id]);
      expect(dbNotif2.read_at).not.toBeNull();
    });

    it('recovers thread and preserves STAFF_ONLY privacy filter from SQLite after cache purge', () => {
      // Create case + public reply + staff note
      const res = createSupportCase({
        reporterUserId: 'worker-u-persist-2',
        role: 'WORKER',
        category: 'PAIEMENT',
        subject: 'Demande d’acompte',
        initialMessage: 'Bonjour, est-il possible d’avoir un acompte ?',
      });
      const caseId = res.caseRecord!.id;

      postCaseMessage({
        caseId,
        authorId: 'staff-01',
        authorRole: 'STAFF',
        authorName: 'Support Kazi',
        body: 'Bonjour, les acomptes sont traités chaque jeudi.',
        visibility: 'PUBLIC_TO_CASE',
      });

      postCaseMessage({
        caseId,
        authorId: 'staff-01',
        authorRole: 'STAFF',
        authorName: 'Support Kazi (Note)',
        body: 'NOTE INTERNE : Vérifier le nombre d’heures cumulées cette semaine.',
        visibility: 'STAFF_ONLY',
      });

      // Clear memory cache completely
      clearSupportMemoryCache();

      // Retrieve case by ID from SQLite
      const restoredCase = getCaseById(caseId);
      expect(restoredCase).not.toBeNull();
      expect(restoredCase?.subject).toBe('Demande d’acompte');

      // Worker retrieves thread: must NOT see STAFF_ONLY message
      const workerThread = getCaseThread(caseId, false);
      expect(workerThread?.messages.length).toBe(2);
      expect(workerThread?.messages.some((m) => m.visibility === 'STAFF_ONLY')).toBe(false);

      // Staff retrieves thread: sees all 3 messages
      const staffThread = getCaseThread(caseId, true);
      expect(staffThread?.messages.length).toBe(3);
    });
  });
});
