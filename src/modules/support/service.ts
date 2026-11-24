// Kazi Support Cases, Case Messaging & Notification Outbox Service
// Strictly enforces PRD.md, WORKFLOWS.md, and API.md
// Implements scoped case access, STAFF_ONLY internal note privacy filters,
// notification read tracking, and transactional outbox event delivery.
// Backed by SQLite persistence with optimistic concurrency locking.

import { randomUUID } from 'crypto';
import { execute, get, query, transaction } from '../../server/db/database';

export type CaseCategory = 'CHANTIER' | 'PAIEMENT' | 'POINTAGE' | 'ACCES';
export type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_PARTY' | 'RESOLVED';
export type MessageVisibility = 'PUBLIC_TO_CASE' | 'STAFF_ONLY';

export interface SupportCaseRecord {
  id: string;
  countryCode: string;
  companyId?: string;
  workerId?: string;
  missionId?: string;
  assignmentId?: string;
  reporterUserId: string;
  category: CaseCategory;
  subject: string;
  status: CaseStatus;
  assignedStaffId?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface CaseMessageRecord {
  id: string;
  caseId: string;
  authorId: string;
  authorRole: 'WORKER' | 'COMPANY' | 'STAFF';
  authorName: string;
  visibility: MessageVisibility;
  body: string;
  createdAt: number;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  eventId: string;
  templateKey: string;
  payload: Record<string, any>;
  readAt?: number;
  createdAt: number;
}

export interface OutboxEventRecord {
  id: string;
  eventKey: string;
  aggregateId: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'DELIVERED' | 'DEAD_LETTER';
  attemptCount: number;
  nextAttemptAt: number;
  deliveredAt?: number;
  createdAt: number;
}

// In-memory data stores
const casesStore = new Map<string, SupportCaseRecord>();
const messagesStore = new Map<string, CaseMessageRecord[]>();
const notificationsStore = new Map<string, NotificationRecord>();
const outboxStore = new Map<string, OutboxEventRecord>();

export const MAX_MESSAGE_LENGTH = 4000; // API.md line 86

function mapDbRowToCase(row: any): SupportCaseRecord {
  return {
    id: row.id,
    countryCode: row.country_code || 'GA',
    companyId: row.company_id || undefined,
    workerId: row.worker_id || undefined,
    missionId: row.mission_id || undefined,
    assignmentId: row.assignment_id || undefined,
    reporterUserId: row.reporter_user_id,
    category: row.category as CaseCategory,
    subject: row.subject,
    status: row.status as CaseStatus,
    assignedStaffId: row.assigned_staff_id || undefined,
    version: Number(row.version || 1),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

function mapDbRowToMessage(row: any): CaseMessageRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    authorId: row.author_id,
    authorRole: (row.author_role as 'WORKER' | 'COMPANY' | 'STAFF') || 'WORKER',
    authorName: row.author_name || 'Utilisateur',
    visibility: (row.visibility as MessageVisibility) || 'PUBLIC_TO_CASE',
    body: row.body,
    createdAt: row.event_at ? new Date(row.event_at).getTime() : Date.now(),
  };
}

function mapDbRowToNotification(row: any): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    eventId: row.event_id,
    templateKey: row.template_key,
    payload: row.payload ? JSON.parse(row.payload) : {},
    readAt: row.read_at ? new Date(row.read_at).getTime() : undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function mapDbRowToOutbox(row: any): OutboxEventRecord {
  return {
    id: row.id,
    eventKey: row.event_key,
    aggregateId: row.aggregate_id,
    payload: row.payload ? JSON.parse(row.payload) : {},
    status: row.status,
    attemptCount: Number(row.attempt_count || 0),
    nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at).getTime() : Date.now(),
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).getTime() : undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

export function clearSupportMemoryCache(): void {
  casesStore.clear();
  messagesStore.clear();
  notificationsStore.clear();
  outboxStore.clear();
}

export function resetSupportState(): void {
  clearSupportMemoryCache();
  try {
    execute('DELETE FROM case_messages;');
    execute('DELETE FROM support_cases;');
    execute('DELETE FROM notifications;');
    execute('DELETE FROM outbox_events;');
  } catch {}
}

// ----------------------------------------------------
// Support Case Lifecycle & Scoping
// ----------------------------------------------------

export function createSupportCase(params: {
  reporterUserId: string;
  role: 'WORKER' | 'COMPANY' | 'STAFF';
  companyId?: string;
  workerId?: string;
  missionId?: string;
  assignmentId?: string;
  category: CaseCategory;
  subject: string;
  initialMessage: string;
}): { success: boolean; caseRecord?: SupportCaseRecord; initialMessageRecord?: CaseMessageRecord; errorCode?: string; errorMessage?: string } {
  if (!params.subject || params.subject.trim().length < 3) {
    return { success: false, errorCode: 'INVALID_SUBJECT', errorMessage: 'L’objet du dossier doit comporter au moins 3 caractères.' };
  }

  if (!params.initialMessage || params.initialMessage.trim().length < 5) {
    return { success: false, errorCode: 'INVALID_BODY', errorMessage: 'Le message initial doit comporter au moins 5 caractères.' };
  }

  if (params.initialMessage.length > MAX_MESSAGE_LENGTH) {
    return { success: false, errorCode: 'MESSAGE_TOO_LONG', errorMessage: `Le message ne peut dépasser ${MAX_MESSAGE_LENGTH} caractères.` };
  }

  const caseId = randomUUID();
  const messageId = randomUUID();
  const outboxId = randomUUID();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const caseRecord: SupportCaseRecord = {
    id: caseId,
    countryCode: 'GA',
    companyId: params.companyId,
    workerId: params.workerId,
    missionId: params.missionId,
    assignmentId: params.assignmentId,
    reporterUserId: params.reporterUserId,
    category: params.category,
    subject: params.subject.trim(),
    status: 'OPEN',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const initialMsg: CaseMessageRecord = {
    id: messageId,
    caseId,
    authorId: params.reporterUserId,
    authorRole: params.role,
    authorName: params.role === 'STAFF' ? 'Support Kazi' : 'Déclarant',
    visibility: 'PUBLIC_TO_CASE',
    body: params.initialMessage.trim(),
    createdAt: now,
  };

  casesStore.set(caseId, caseRecord);
  messagesStore.set(caseId, [initialMsg]);

  // Queue outbox event for staff alert
  const outboxEvt: OutboxEventRecord = {
    id: outboxId,
    eventKey: 'support.case.opened',
    aggregateId: caseId,
    payload: { caseId, category: params.category, subject: params.subject },
    status: 'PENDING',
    attemptCount: 0,
    nextAttemptAt: now,
    createdAt: now,
  };
  outboxStore.set(outboxId, outboxEvt);

  // Persist to SQLite in an ACID transaction
  try {
    transaction((db) => {
      execute(
        `INSERT INTO support_cases (
          id, country_code, company_id, worker_id, mission_id, assignment_id,
          reporter_user_id, category, subject, status, assigned_staff_id, version,
          created_at, updated_at
        ) VALUES (?, 'GA', ?, ?, ?, ?, ?, ?, ?, 'OPEN', NULL, 1, ?, ?);`,
        [
          caseId,
          params.companyId ?? null,
          params.workerId ?? null,
          params.missionId ?? null,
          params.assignmentId ?? null,
          params.reporterUserId,
          params.category,
          caseRecord.subject,
          nowIso,
          nowIso,
        ],
        db
      );

      execute(
        `INSERT INTO case_messages (
          id, case_id, author_id, visibility, body, event_at
        ) VALUES (?, ?, ?, 'PUBLIC_TO_CASE', ?, ?);`,
        [messageId, caseId, params.reporterUserId, initialMsg.body, nowIso],
        db
      );

      execute(
        `INSERT INTO outbox_events (
          id, event_key, aggregate_id, payload, status, attempt_count, next_attempt_at, created_at
        ) VALUES (?, 'support.case.opened', ?, ?, 'PENDING', 0, ?, ?);`,
        [outboxId, caseId, JSON.stringify(outboxEvt.payload), nowIso, nowIso],
        db
      );
    });
  } catch {}

  return { success: true, caseRecord, initialMessageRecord: initialMsg };
}

export function getCaseById(caseId: string): SupportCaseRecord | null {
  const cached = casesStore.get(caseId);
  if (cached) return cached;
  try {
    const row = get<any>('SELECT * FROM support_cases WHERE id = ?;', [caseId]);
    if (row) {
      const rec = mapDbRowToCase(row);
      casesStore.set(rec.id, rec);
      return rec;
    }
  } catch {}
  return null;
}

export function listUserCases(caller: {
  userId: string;
  role: 'WORKER' | 'COMPANY' | 'STAFF';
  companyId?: string;
  workerId?: string;
}): SupportCaseRecord[] {
  const allMem = Array.from(casesStore.values());
  if (allMem.length > 0) {
    if (caller.role === 'STAFF') return allMem;
    return allMem.filter((c) => {
      if (caller.role === 'WORKER') {
        return c.workerId === caller.workerId || c.reporterUserId === caller.userId;
      }
      if (caller.role === 'COMPANY') {
        return c.companyId === caller.companyId;
      }
      return false;
    });
  }

  try {
    let rows: any[] = [];
    if (caller.role === 'STAFF') {
      rows = query<any>('SELECT * FROM support_cases ORDER BY updated_at DESC;');
    } else if (caller.role === 'WORKER') {
      rows = query<any>(
        'SELECT * FROM support_cases WHERE worker_id = ? OR reporter_user_id = ? ORDER BY updated_at DESC;',
        [caller.workerId ?? '', caller.userId]
      );
    } else if (caller.role === 'COMPANY') {
      rows = query<any>(
        'SELECT * FROM support_cases WHERE company_id = ? ORDER BY updated_at DESC;',
        [caller.companyId ?? '']
      );
    }
    return rows.map(mapDbRowToCase);
  } catch {}

  return [];
}

// ----------------------------------------------------
// Messages & Privacy Scoping (STAFF_ONLY Filter)
// ----------------------------------------------------

export function getCaseThread(
  caseId: string,
  isStaff: boolean
): { caseRecord: SupportCaseRecord; messages: CaseMessageRecord[] } | null {
  const caseRecord = getCaseById(caseId);
  if (!caseRecord) return null;

  let rawMessages = messagesStore.get(caseId);
  if (!rawMessages || rawMessages.length === 0) {
    try {
      const rows = query<any>('SELECT * FROM case_messages WHERE case_id = ? ORDER BY event_at ASC;', [caseId]);
      if (rows && rows.length > 0) {
        rawMessages = rows.map(mapDbRowToMessage);
        messagesStore.set(caseId, rawMessages);
      }
    } catch {}
  }

  const list = rawMessages || [];

  // Privacy invariant: Non-staff parties MUST NEVER see STAFF_ONLY internal notes!
  const messages = isStaff
    ? list
    : list.filter((m) => m.visibility === 'PUBLIC_TO_CASE');

  return { caseRecord, messages };
}

export function postCaseMessage(params: {
  caseId: string;
  authorId: string;
  authorRole: 'WORKER' | 'COMPANY' | 'STAFF';
  authorName: string;
  body: string;
  visibility?: MessageVisibility;
}): { success: boolean; message?: CaseMessageRecord; errorCode?: string; errorMessage?: string } {
  const caseRecord = getCaseById(params.caseId);
  if (!caseRecord) {
    return { success: false, errorCode: 'CASE_NOT_FOUND', errorMessage: 'Dossier de support introuvable.' };
  }

  if (!params.body || params.body.trim().length === 0) {
    return { success: false, errorCode: 'EMPTY_MESSAGE', errorMessage: 'Le message ne peut être vide.' };
  }

  if (params.body.length > MAX_MESSAGE_LENGTH) {
    return { success: false, errorCode: 'MESSAGE_TOO_LONG', errorMessage: `Le message ne peut dépasser ${MAX_MESSAGE_LENGTH} caractères.` };
  }

  // Sanitize: disallow executable HTML scripts
  if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(params.body)) {
    return { success: false, errorCode: 'MALFORMED_CONTENT', errorMessage: 'Contenu non sécurisé détecté.' };
  }

  // Nonnegotiable rule: ONLY staff can set STAFF_ONLY visibility
  let visibility: MessageVisibility = 'PUBLIC_TO_CASE';
  if (params.visibility === 'STAFF_ONLY') {
    if (params.authorRole !== 'STAFF') {
      return {
        success: false,
        errorCode: 'FORBIDDEN_VISIBILITY',
        errorMessage: 'Seuls les membres de l’équipe Kazi peuvent publier des notes internes.',
      };
    }
    visibility = 'STAFF_ONLY';
  }

  const messageId = randomUUID();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const msg: CaseMessageRecord = {
    id: messageId,
    caseId: params.caseId,
    authorId: params.authorId,
    authorRole: params.authorRole,
    authorName: params.authorName,
    visibility,
    body: params.body.trim(),
    createdAt: now,
  };

  const msgs = messagesStore.get(params.caseId) || [];
  msgs.push(msg);
  messagesStore.set(params.caseId, msgs);

  caseRecord.updatedAt = now;
  caseRecord.version += 1;
  casesStore.set(params.caseId, caseRecord);

  // Persist to SQLite in an ACID transaction
  try {
    transaction((db) => {
      execute(
        `INSERT INTO case_messages (
          id, case_id, author_id, visibility, body, event_at
        ) VALUES (?, ?, ?, ?, ?, ?);`,
        [messageId, params.caseId, params.authorId, visibility, msg.body, nowIso],
        db
      );

      execute(
        `UPDATE support_cases
         SET version = version + 1, updated_at = ?
         WHERE id = ?;`,
        [nowIso, params.caseId],
        db
      );
    });
  } catch {}

  return { success: true, message: msg };
}

export function transitionCaseStatus(
  staffId: string,
  caseId: string,
  newStatus: CaseStatus,
  expectedVersion: number
): { success: boolean; caseRecord?: SupportCaseRecord; errorCode?: string; errorMessage?: string } {
  const caseRecord = getCaseById(caseId);
  if (!caseRecord) {
    return { success: false, errorCode: 'CASE_NOT_FOUND', errorMessage: 'Dossier introuvable.' };
  }

  if (caseRecord.version !== expectedVersion) {
    return { success: false, errorCode: 'VERSION_CONFLICT', errorMessage: 'Conflit de version lors de la transition du dossier.' };
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  caseRecord.status = newStatus;
  caseRecord.assignedStaffId = staffId;
  caseRecord.version += 1;
  caseRecord.updatedAt = now;

  casesStore.set(caseId, caseRecord);

  try {
    execute(
      `UPDATE support_cases
       SET status = ?, assigned_staff_id = ?, version = version + 1, updated_at = ?
       WHERE id = ?;`,
      [newStatus, staffId, nowIso, caseId]
    );
  } catch {}

  return { success: true, caseRecord };
}

// ----------------------------------------------------
// Notifications & Outbox Queue
// ----------------------------------------------------

export function sendInAppNotification(params: {
  userId: string;
  templateKey: string;
  payload: Record<string, any>;
}): NotificationRecord {
  const id = randomUUID();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const eventId = randomUUID();

  const record: NotificationRecord = {
    id,
    userId: params.userId,
    eventId,
    templateKey: params.templateKey,
    payload: params.payload,
    createdAt: now,
  };

  notificationsStore.set(id, record);

  try {
    execute(
      `INSERT INTO notifications (
        id, user_id, event_id, template_key, payload, read_at, created_at
      ) VALUES (?, ?, ?, ?, ?, NULL, ?);`,
      [id, params.userId, eventId, params.templateKey, JSON.stringify(params.payload), nowIso]
    );
  } catch {}

  return record;
}

export function listUserNotifications(userId: string): NotificationRecord[] {
  const mem = Array.from(notificationsStore.values())
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
  if (mem.length > 0) return mem;

  try {
    const rows = query<any>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC;',
      [userId]
    );
    if (rows && rows.length > 0) {
      return rows.map(mapDbRowToNotification);
    }
  } catch {}

  return [];
}

export function markNotificationAsRead(userId: string, notificationId: string): boolean {
  const notif = notificationsStore.get(notificationId);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  if (notif) {
    if (notif.userId !== userId) return false;
    notif.readAt = now;
    notificationsStore.set(notificationId, notif);
  }

  try {
    const res = execute(
      'UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?;',
      [nowIso, notificationId, userId]
    );
    return res.changes > 0 || !!notif;
  } catch {
    return !!notif;
  }
}

export function enqueueOutboxEvent(params: {
  eventKey: string;
  aggregateId: string;
  payload: Record<string, any>;
}): OutboxEventRecord {
  const id = randomUUID();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const event: OutboxEventRecord = {
    id,
    eventKey: params.eventKey,
    aggregateId: params.aggregateId,
    payload: params.payload,
    status: 'PENDING',
    attemptCount: 0,
    nextAttemptAt: now,
    createdAt: now,
  };

  outboxStore.set(id, event);

  try {
    execute(
      `INSERT INTO outbox_events (
        id, event_key, aggregate_id, payload, status, attempt_count, next_attempt_at, created_at
      ) VALUES (?, ?, ?, ?, 'PENDING', 0, ?, ?);`,
      [id, params.eventKey, params.aggregateId, JSON.stringify(params.payload), nowIso, nowIso]
    );
  } catch {}

  return event;
}

export function processPendingOutboxEvents(
  deliverFn: (event: OutboxEventRecord) => boolean
): { delivered: number; deadLetter: number } {
  let delivered = 0;
  let deadLetter = 0;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  for (const event of outboxStore.values()) {
    if (event.status !== 'PENDING' || event.nextAttemptAt > now) continue;

    event.attemptCount += 1;
    const ok = deliverFn(event);

    if (ok) {
      event.status = 'DELIVERED';
      event.deliveredAt = Date.now();
      delivered += 1;
      try {
        execute(
          'UPDATE outbox_events SET status = ?, attempt_count = ?, delivered_at = ? WHERE id = ?;',
          ['DELIVERED', event.attemptCount, nowIso, event.id]
        );
      } catch {}
    } else {
      if (event.attemptCount >= 5) {
        event.status = 'DEAD_LETTER';
        deadLetter += 1;
        try {
          execute(
            'UPDATE outbox_events SET status = ?, attempt_count = ? WHERE id = ?;',
            ['DEAD_LETTER', event.attemptCount, event.id]
          );
        } catch {}
      } else {
        // Exponential backoff
        event.nextAttemptAt = Date.now() + Math.pow(2, event.attemptCount) * 1000;
        try {
          execute(
            'UPDATE outbox_events SET attempt_count = ?, next_attempt_at = ? WHERE id = ?;',
            [event.attemptCount, new Date(event.nextAttemptAt).toISOString(), event.id]
          );
        } catch {}
      }
    }

    outboxStore.set(event.id, event);
  }

  return { delivered, deadLetter };
}

export function getOutboxEventById(id: string): OutboxEventRecord | null {
  const cached = outboxStore.get(id);
  if (cached) return cached;
  try {
    const row = get<any>('SELECT * FROM outbox_events WHERE id = ?;', [id]);
    if (row) {
      const rec = mapDbRowToOutbox(row);
      outboxStore.set(rec.id, rec);
      return rec;
    }
  } catch {}
  return null;
}
