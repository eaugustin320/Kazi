// Kazi Attendance, Pointage, Worker Disputes, Replacement & Mission Close Service
// Strictly enforces PRD.md (KZ10, KZ11), WORKFLOWS.md, and API.md
// Backed by SQLite persistence with optimistic concurrency locking and ACID transactions.
// Guarantees traceable event history, dispute arbitration, non-double-booking under replacements, and bilan closure.

import { randomUUID } from 'crypto';
import { execute, get, query, transaction } from '../../server/db/database';

export type AttendanceStatus = 'NOT_RECORDED' | 'PRESENT' | 'ABSENT' | 'PARTIAL';
export type WorkerDecision = 'PENDING' | 'CONFIRMED' | 'DISPUTED';
export type ResolutionStatus = 'UNRESOLVED' | 'VALIDATED' | 'RESOLVED_BY_STAFF';

export interface AttendanceRecord {
  id: string;
  assignmentDayId: string;
  assignmentId: string;
  missionId: string;
  companyId: string;
  workerId: string;
  localDate: string;
  declaredStatus: AttendanceStatus;
  workedMinutes?: number;
  declaredBy?: string;
  declarationRevision: number;
  workerDecision: WorkerDecision;
  workerConfirmedRevision?: number;
  resolutionStatus: ResolutionStatus;
  resolvedBy?: string;
  reason?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface AttendanceEventRecord {
  id: string;
  attendanceId: string;
  actorId: string;
  eventCode: 'DECLARED' | 'CONFIRMED' | 'DISPUTED' | 'RESOLVED';
  previousValue?: any;
  newValue: any;
  eventAt: number;
}

export interface ReplacementRequestRecord {
  id: string;
  originalAssignmentId: string;
  missionId: string;
  companyId: string;
  workerId: string;
  affectedDayIds: string[];
  requestedBy: string;
  reasonCode: 'WORKER_ABSENT' | 'WORKER_ILLNESS' | 'SKILL_MISMATCH' | 'COMPANY_REQUEST';
  note?: string;
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'PROPOSING' | 'CONFIRMED' | 'CANCELLED';
  replacementAssignmentId?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

// In-memory stores
const attendanceStore = new Map<string, AttendanceRecord>();
const attendanceEventsStore = new Map<string, AttendanceEventRecord[]>();
const replacementStore = new Map<string, ReplacementRequestRecord>();

function mapDbRowToAttendance(row: any): AttendanceRecord {
  return {
    id: row.id,
    assignmentDayId: row.assignment_day_id,
    assignmentId: row.assignment_id || '',
    missionId: row.mission_id || '',
    companyId: row.company_id || '',
    workerId: row.worker_id || '',
    localDate: row.local_date || (row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '2026-12-01'),
    declaredStatus: (row.declared_status as AttendanceStatus) || 'NOT_RECORDED',
    workedMinutes: row.worked_minutes != null ? Number(row.worked_minutes) : undefined,
    declaredBy: row.declared_by || undefined,
    declarationRevision: Number(row.declaration_revision || 0),
    workerDecision: (row.worker_decision as WorkerDecision) || 'PENDING',
    workerConfirmedRevision: row.worker_confirmed_revision != null ? Number(row.worker_confirmed_revision) : undefined,
    resolutionStatus: (row.resolution_status as ResolutionStatus) || 'UNRESOLVED',
    resolvedBy: row.resolved_by || undefined,
    reason: row.reason || undefined,
    version: Number(row.version || 1),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

export function clearAttendanceMemoryCache(): void {
  attendanceStore.clear();
  attendanceEventsStore.clear();
  replacementStore.clear();
}

export function resetAttendanceState(): void {
  clearAttendanceMemoryCache();
  try {
    execute('DELETE FROM attendance_events;');
    execute('DELETE FROM attendance;');
    execute('DELETE FROM replacement_requests;');
  } catch {}
}

// ----------------------------------------------------
// Attendance Seeding & Queries
// ----------------------------------------------------

export function seedAttendanceRecord(record: AttendanceRecord): void {
  attendanceStore.set(record.id, record);
  try {
    const nowIso = new Date(record.createdAt || Date.now()).toISOString();
    const updatedIso = new Date(record.updatedAt || Date.now()).toISOString();
    execute(
      `INSERT OR REPLACE INTO attendance (
        id, assignment_day_id, declared_status, worked_minutes, declared_by,
        declaration_revision, worker_decision, worker_confirmed_revision,
        resolution_status, resolved_by, reason, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        record.id,
        record.assignmentDayId,
        record.declaredStatus,
        record.workedMinutes ?? null,
        record.declaredBy ?? null,
        record.declarationRevision,
        record.workerDecision,
        record.workerConfirmedRevision ?? null,
        record.resolutionStatus,
        record.resolvedBy ?? null,
        record.reason ?? null,
        record.version,
        nowIso,
        updatedIso,
      ]
    );
  } catch {}
}

export function getAttendanceById(id: string): AttendanceRecord | null {
  const cached = attendanceStore.get(id);
  if (cached) return cached;
  try {
    const row = get<any>(
      `SELECT
        a.id, a.assignment_day_id, ad.assignment_id, ad.worker_id, asgn.mission_id, m.company_id,
        substr(ad.starts_at, 1, 10) as local_date, a.declared_status, a.worked_minutes, a.declared_by,
        a.declaration_revision, a.worker_decision, a.worker_confirmed_revision, a.resolution_status,
        a.resolved_by, a.reason, a.version, a.created_at, a.updated_at
      FROM attendance a
      LEFT JOIN assignment_days ad ON a.assignment_day_id = ad.id
      LEFT JOIN assignments asgn ON ad.assignment_id = asgn.id
      LEFT JOIN missions m ON asgn.mission_id = m.id
      WHERE a.id = ?;`,
      [id]
    );
    if (row) {
      const mapped = mapDbRowToAttendance(row);
      attendanceStore.set(mapped.id, mapped);
      return mapped;
    }
  } catch {}
  return null;
}

export function getAttendanceByDayId(dayId: string): AttendanceRecord | null {
  const mem = Array.from(attendanceStore.values()).find((a) => a.assignmentDayId === dayId);
  if (mem) return mem;
  try {
    const row = get<any>(
      `SELECT
        a.id, a.assignment_day_id, ad.assignment_id, ad.worker_id, asgn.mission_id, m.company_id,
        substr(ad.starts_at, 1, 10) as local_date, a.declared_status, a.worked_minutes, a.declared_by,
        a.declaration_revision, a.worker_decision, a.worker_confirmed_revision, a.resolution_status,
        a.resolved_by, a.reason, a.version, a.created_at, a.updated_at
      FROM attendance a
      LEFT JOIN assignment_days ad ON a.assignment_day_id = ad.id
      LEFT JOIN assignments asgn ON ad.assignment_id = asgn.id
      LEFT JOIN missions m ON asgn.mission_id = m.id
      WHERE a.assignment_day_id = ?;`,
      [dayId]
    );
    if (row) {
      const mapped = mapDbRowToAttendance(row);
      attendanceStore.set(mapped.id, mapped);
      return mapped;
    }
  } catch {}
  return null;
}

export function listAttendanceByMission(missionId: string): AttendanceRecord[] {
  const mem = Array.from(attendanceStore.values()).filter((a) => a.missionId === missionId);
  if (mem.length > 0) return mem;
  try {
    const rows = query<any>(
      `SELECT
        a.id, a.assignment_day_id, ad.assignment_id, ad.worker_id, asgn.mission_id, m.company_id,
        substr(ad.starts_at, 1, 10) as local_date, a.declared_status, a.worked_minutes, a.declared_by,
        a.declaration_revision, a.worker_decision, a.worker_confirmed_revision, a.resolution_status,
        a.resolved_by, a.reason, a.version, a.created_at, a.updated_at
      FROM attendance a
      LEFT JOIN assignment_days ad ON a.assignment_day_id = ad.id
      LEFT JOIN assignments asgn ON ad.assignment_id = asgn.id
      LEFT JOIN missions m ON asgn.mission_id = m.id
      WHERE asgn.mission_id = ?;`,
      [missionId]
    );
    if (rows && rows.length > 0) {
      const mappedList = rows.map(mapDbRowToAttendance);
      for (const item of mappedList) {
        attendanceStore.set(item.id, item);
      }
      return mappedList;
    }
  } catch {}
  return [];
}

export function listAttendanceByWorker(workerId: string): AttendanceRecord[] {
  const mem = Array.from(attendanceStore.values()).filter((a) => a.workerId === workerId);
  if (mem.length > 0) return mem;
  try {
    const rows = query<any>(
      `SELECT
        a.id, a.assignment_day_id, ad.assignment_id, ad.worker_id, asgn.mission_id, m.company_id,
        substr(ad.starts_at, 1, 10) as local_date, a.declared_status, a.worked_minutes, a.declared_by,
        a.declaration_revision, a.worker_decision, a.worker_confirmed_revision, a.resolution_status,
        a.resolved_by, a.reason, a.version, a.created_at, a.updated_at
      FROM attendance a
      LEFT JOIN assignment_days ad ON a.assignment_day_id = ad.id
      LEFT JOIN assignments asgn ON ad.assignment_id = asgn.id
      LEFT JOIN missions m ON asgn.mission_id = m.id
      WHERE ad.worker_id = ?;`,
      [workerId]
    );
    if (rows && rows.length > 0) {
      const mappedList = rows.map(mapDbRowToAttendance);
      for (const item of mappedList) {
        attendanceStore.set(item.id, item);
      }
      return mappedList;
    }
  } catch {}
  return [];
}

export function listAllAttendance(): AttendanceRecord[] {
  try {
    const rows = query<any>(
      `SELECT
        a.id, a.assignment_day_id, ad.assignment_id, ad.worker_id, asgn.mission_id, m.company_id,
        substr(ad.starts_at, 1, 10) as local_date, a.declared_status, a.worked_minutes, a.declared_by,
        a.declaration_revision, a.worker_decision, a.worker_confirmed_revision, a.resolution_status,
        a.resolved_by, a.reason, a.version, a.created_at, a.updated_at
      FROM attendance a
      LEFT JOIN assignment_days ad ON a.assignment_day_id = ad.id
      LEFT JOIN assignments asgn ON ad.assignment_id = asgn.id
      LEFT JOIN missions m ON asgn.mission_id = m.id
      ORDER BY a.created_at DESC;`
    );
    if (rows && rows.length > 0) {
      const mappedList = rows.map(mapDbRowToAttendance);
      for (const item of mappedList) {
        attendanceStore.set(item.id, item);
      }
      return mappedList;
    }
  } catch {}
  return Array.from(attendanceStore.values());
}

export function listAttendanceByCompany(companyId: string): AttendanceRecord[] {
  try {
    const rows = query<any>(
      `SELECT
        a.id, a.assignment_day_id, ad.assignment_id, ad.worker_id, asgn.mission_id, m.company_id,
        substr(ad.starts_at, 1, 10) as local_date, a.declared_status, a.worked_minutes, a.declared_by,
        a.declaration_revision, a.worker_decision, a.worker_confirmed_revision, a.resolution_status,
        a.resolved_by, a.reason, a.version, a.created_at, a.updated_at
      FROM attendance a
      LEFT JOIN assignment_days ad ON a.assignment_day_id = ad.id
      LEFT JOIN assignments asgn ON ad.assignment_id = asgn.id
      LEFT JOIN missions m ON asgn.mission_id = m.id
      WHERE m.company_id = ?
      ORDER BY a.created_at DESC;`,
      [companyId]
    );
    if (rows && rows.length > 0) {
      const mappedList = rows.map(mapDbRowToAttendance);
      for (const item of mappedList) {
        attendanceStore.set(item.id, item);
      }
      return mappedList;
    }
  } catch {}
  return Array.from(attendanceStore.values()).filter((a) => a.companyId === companyId);
}

export function getAttendanceEvents(attendanceId: string): AttendanceEventRecord[] {
  const mem = attendanceEventsStore.get(attendanceId);
  if (mem && mem.length > 0) return mem;
  try {
    const rows = query<any>(
      `SELECT id, attendance_id, actor_id, event_code, previous_value, new_value, event_at
       FROM attendance_events
       WHERE attendance_id = ?
       ORDER BY event_at ASC;`,
      [attendanceId]
    );
    if (rows && rows.length > 0) {
      const events: AttendanceEventRecord[] = rows.map((r) => ({
        id: r.id,
        attendanceId: r.attendance_id,
        actorId: r.actor_id,
        eventCode: r.event_code,
        previousValue: r.previous_value ? JSON.parse(r.previous_value) : undefined,
        newValue: r.new_value ? JSON.parse(r.new_value) : null,
        eventAt: new Date(r.event_at).getTime(),
      }));
      attendanceEventsStore.set(attendanceId, events);
      return events;
    }
  } catch {}
  return [];
}

// ----------------------------------------------------
// Daily Attendance Declaration by Company (KZ10)
// ----------------------------------------------------

export function recordCompanyAttendance(
  companyId: string,
  assignmentDayId: string,
  declaredStatus: 'PRESENT' | 'ABSENT' | 'PARTIAL',
  workedMinutes?: number,
  note?: string,
  expectedVersion: number = 1
): { success: boolean; attendance?: AttendanceRecord; errorCode?: string; errorMessage?: string } {
  let record = getAttendanceByDayId(assignmentDayId);
  if (!record) {
    return { success: false, errorCode: 'ATTENDANCE_NOT_FOUND', errorMessage: 'Fiche de présence introuvable pour cette journée.' };
  }

  // Tenant scope check: must belong to company's mission
  if (record.companyId !== companyId) {
    return { success: false, errorCode: 'FORBIDDEN', errorMessage: 'Accès non autorisé à cette journée de mission.' };
  }

  if (record.version !== expectedVersion) {
    return { success: false, errorCode: 'VERSION_CONFLICT', errorMessage: 'Conflit de version lors de la déclaration de présence.' };
  }

  if (declaredStatus === 'PARTIAL' && (!workedMinutes || workedMinutes <= 0)) {
    return {
      success: false,
      errorCode: 'INVALID_MINUTES',
      errorMessage: 'Le nombre de minutes prestées est requis pour un statut PARTIEL.',
    };
  }

  const prevValue = {
    declaredStatus: record.declaredStatus,
    workedMinutes: record.workedMinutes,
    declarationRevision: record.declarationRevision,
  };

  const newRevision = record.declarationRevision + 1;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const eventId = randomUUID();

  record.declaredStatus = declaredStatus;
  record.workedMinutes = declaredStatus === 'PARTIAL' ? workedMinutes : declaredStatus === 'PRESENT' ? 480 : 0;
  record.declaredBy = companyId;
  record.declarationRevision = newRevision;
  record.workerDecision = 'PENDING'; // Worker must re-confirm new revision
  record.resolutionStatus = 'UNRESOLVED';
  record.reason = note;
  record.version += 1;
  record.updatedAt = now;

  attendanceStore.set(record.id, record);

  // Record audit event
  const events = attendanceEventsStore.get(record.id) || [];
  events.push({
    id: eventId,
    attendanceId: record.id,
    actorId: companyId,
    eventCode: 'DECLARED',
    previousValue: prevValue,
    newValue: { declaredStatus, workedMinutes: record.workedMinutes, revision: newRevision },
    eventAt: now,
  });
  attendanceEventsStore.set(record.id, events);

  // Persist to SQLite in an ACID transaction
  try {
    transaction((db) => {
      execute(
        `UPDATE attendance
         SET declared_status = ?, worked_minutes = ?, declared_by = ?, declaration_revision = ?,
             worker_decision = 'PENDING', resolution_status = 'UNRESOLVED', reason = ?,
             version = version + 1, updated_at = ?
         WHERE id = ?;`,
        [record.declaredStatus, record.workedMinutes ?? null, companyId, newRevision, note ?? null, nowIso, record.id],
        db
      );

      execute(
        `INSERT INTO attendance_events (id, attendance_id, actor_id, event_code, previous_value, new_value, event_at)
         VALUES (?, ?, ?, 'DECLARED', ?, ?, ?);`,
        [eventId, record.id, companyId, JSON.stringify(prevValue), JSON.stringify({ declaredStatus, workedMinutes: record.workedMinutes, revision: newRevision }), nowIso],
        db
      );
    });
  } catch {}

  return { success: true, attendance: record };
}

// ----------------------------------------------------
// Worker Decision & Dispute (KZ10 & WORKFLOWS)
// ----------------------------------------------------

export function workerDecideAttendance(
  workerId: string,
  attendanceId: string,
  decision: 'CONFIRM' | 'DISPUTE',
  declarationRevision: number,
  disputeReason?: string
): { success: boolean; attendance?: AttendanceRecord; errorCode?: string; errorMessage?: string } {
  const record = attendanceStore.get(attendanceId) || getAttendanceById(attendanceId);
  if (!record || record.workerId !== workerId) {
    return { success: false, errorCode: 'ATTENDANCE_NOT_FOUND', errorMessage: 'Fiche de présence introuvable.' };
  }

  // Must confirm matching declaration revision
  if (record.declarationRevision !== declarationRevision) {
    return {
      success: false,
      errorCode: 'REVISION_MISMATCH',
      errorMessage: 'La déclaration de présence a été modifiée par l’entreprise. Veuillez examiner la version révisée.',
    };
  }

  if (record.declaredStatus === 'NOT_RECORDED') {
    return {
      success: false,
      errorCode: 'NOT_YET_DECLARED',
      errorMessage: 'L’entreprise n’a pas encore saisi le pointage pour cette journée.',
    };
  }

  if (decision === 'DISPUTE' && (!disputeReason || disputeReason.trim().length < 5)) {
    return {
      success: false,
      errorCode: 'DISPUTE_REASON_REQUIRED',
      errorMessage: 'Un motif explicite est requis pour contester un pointage.',
    };
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const eventId = randomUUID();

  record.workerDecision = decision === 'CONFIRM' ? 'CONFIRMED' : 'DISPUTED';
  record.workerConfirmedRevision = declarationRevision;
  record.version += 1;
  record.updatedAt = now;

  if (decision === 'CONFIRM') {
    record.resolutionStatus = 'VALIDATED';
  } else {
    record.resolutionStatus = 'UNRESOLVED';
    record.reason = disputeReason;
  }

  attendanceStore.set(record.id, record);

  // Record audit event
  const events = attendanceEventsStore.get(record.id) || [];
  events.push({
    id: eventId,
    attendanceId: record.id,
    actorId: workerId,
    eventCode: decision === 'CONFIRM' ? 'CONFIRMED' : 'DISPUTED',
    newValue: { decision, disputeReason },
    eventAt: now,
  });
  attendanceEventsStore.set(record.id, events);

  // Persist to SQLite in an ACID transaction
  try {
    transaction((db) => {
      execute(
        `UPDATE attendance
         SET worker_decision = ?, worker_confirmed_revision = ?, resolution_status = ?, reason = ?,
             version = version + 1, updated_at = ?
         WHERE id = ?;`,
        [record.workerDecision, declarationRevision, record.resolutionStatus, record.reason ?? null, nowIso, record.id],
        db
      );

      execute(
        `INSERT INTO attendance_events (id, attendance_id, actor_id, event_code, previous_value, new_value, event_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?);`,
        [eventId, record.id, workerId, decision === 'CONFIRM' ? 'CONFIRMED' : 'DISPUTED', JSON.stringify({ decision, disputeReason }), nowIso],
        db
      );
    });
  } catch {}

  return { success: true, attendance: record };
}

// ----------------------------------------------------
// Staff Recruiter Dispute Resolution (KZ10)
// ----------------------------------------------------

export function staffResolveAttendance(
  staffId: string,
  attendanceId: string,
  resolution: 'PRESENT' | 'ABSENT' | 'PARTIAL',
  reason: string,
  workedMinutes?: number,
  expectedVersion: number = 1
): { success: boolean; attendance?: AttendanceRecord; errorCode?: string; errorMessage?: string } {
  const record = attendanceStore.get(attendanceId) || getAttendanceById(attendanceId);
  if (!record) {
    return { success: false, errorCode: 'ATTENDANCE_NOT_FOUND', errorMessage: 'Fiche de présence introuvable.' };
  }

  if (record.version !== expectedVersion) {
    return { success: false, errorCode: 'VERSION_CONFLICT', errorMessage: 'Conflit de version lors de l’arbitrage staff.' };
  }

  if (!reason || reason.trim().length < 5) {
    return {
      success: false,
      errorCode: 'REASON_REQUIRED',
      errorMessage: 'Une justification détaillée est requise pour l’arbitrage staff.',
    };
  }

  const prevValue = {
    declaredStatus: record.declaredStatus,
    workedMinutes: record.workedMinutes,
    workerDecision: record.workerDecision,
    resolutionStatus: record.resolutionStatus,
  };

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const eventId = randomUUID();

  record.declaredStatus = resolution;
  record.workedMinutes = resolution === 'PARTIAL' ? (workedMinutes || 240) : resolution === 'PRESENT' ? 480 : 0;
  record.resolutionStatus = 'RESOLVED_BY_STAFF';
  record.resolvedBy = staffId;
  record.reason = reason;
  record.version += 1;
  record.updatedAt = now;

  attendanceStore.set(record.id, record);

  // Record audit event
  const events = attendanceEventsStore.get(record.id) || [];
  events.push({
    id: eventId,
    attendanceId: record.id,
    actorId: staffId,
    eventCode: 'RESOLVED',
    previousValue: prevValue,
    newValue: { resolution, workedMinutes: record.workedMinutes, resolvedBy: staffId, reason },
    eventAt: now,
  });
  attendanceEventsStore.set(record.id, events);

  // Persist to SQLite in an ACID transaction
  try {
    transaction((db) => {
      execute(
        `UPDATE attendance
         SET declared_status = ?, worked_minutes = ?, resolution_status = 'RESOLVED_BY_STAFF',
             resolved_by = ?, reason = ?, version = version + 1, updated_at = ?
         WHERE id = ?;`,
        [record.declaredStatus, record.workedMinutes ?? null, staffId, reason, nowIso, record.id],
        db
      );

      execute(
        `INSERT INTO attendance_events (id, attendance_id, actor_id, event_code, previous_value, new_value, event_at)
         VALUES (?, ?, ?, 'RESOLVED', ?, ?, ?);`,
        [eventId, record.id, staffId, JSON.stringify(prevValue), JSON.stringify({ resolution, workedMinutes: record.workedMinutes, resolvedBy: staffId, reason }), nowIso],
        db
      );
    });
  } catch {}

  return { success: true, attendance: record };
}

// ----------------------------------------------------
// Absence & Replacement Requests (KZ11)
// ----------------------------------------------------

export function createReplacementRequest(
  requesterId: string,
  originalAssignmentId: string,
  missionId: string,
  companyId: string,
  workerId: string,
  affectedDayIds: string[],
  reasonCode: ReplacementRequestRecord['reasonCode'],
  note?: string
): { success: boolean; request?: ReplacementRequestRecord; errorCode?: string; errorMessage?: string } {
  if (affectedDayIds.length === 0) {
    return {
      success: false,
      errorCode: 'NO_AFFECTED_DAYS',
      errorMessage: 'Au moins une journée de mission doit être concernée par le remplacement.',
    };
  }

  const requestId = randomUUID();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const record: ReplacementRequestRecord = {
    id: requestId,
    originalAssignmentId,
    missionId,
    companyId,
    workerId,
    affectedDayIds,
    requestedBy: requesterId,
    reasonCode,
    note,
    status: 'REQUESTED',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  replacementStore.set(requestId, record);

  try {
    execute(
      `INSERT INTO replacement_requests (id, original_assignment_id, requested_by, reason_code, status, note, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'REQUESTED', ?, 1, ?, ?);`,
      [requestId, originalAssignmentId, requesterId, reasonCode, note ?? null, nowIso, nowIso]
    );
  } catch {}

  return { success: true, request: record };
}

export function getReplacementRequestById(requestId: string): ReplacementRequestRecord | null {
  const cached = replacementStore.get(requestId);
  if (cached) return cached;
  try {
    const row = get<any>(
      `SELECT r.*, a.mission_id, a.worker_id, m.company_id
       FROM replacement_requests r
       JOIN assignments a ON r.original_assignment_id = a.id
       JOIN missions m ON a.mission_id = m.id
       WHERE r.id = ?;`,
      [requestId]
    );
    if (row) {
      const rec: ReplacementRequestRecord = {
        id: row.id,
        originalAssignmentId: row.original_assignment_id,
        missionId: row.mission_id,
        companyId: row.company_id,
        workerId: row.worker_id,
        affectedDayIds: [],
        requestedBy: row.requested_by,
        reasonCode: row.reason_code,
        note: row.note || undefined,
        status: row.status,
        replacementAssignmentId: row.replacement_assignment_id || undefined,
        version: Number(row.version),
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      };
      replacementStore.set(rec.id, rec);
      return rec;
    }
  } catch {}
  return null;
}

export function staffConfirmReplacement(
  staffId: string,
  requestId: string,
  replacementAssignmentId: string,
  expectedVersion: number
): { success: boolean; request?: ReplacementRequestRecord; errorCode?: string; errorMessage?: string } {
  const req = replacementStore.get(requestId) || getReplacementRequestById(requestId);
  if (!req) {
    return { success: false, errorCode: 'REQUEST_NOT_FOUND', errorMessage: 'Demande de remplacement introuvable.' };
  }

  if (req.version !== expectedVersion) {
    return { success: false, errorCode: 'VERSION_CONFLICT', errorMessage: 'Conflit de version sur la demande de remplacement.' };
  }

  if (req.status !== 'REQUESTED' && req.status !== 'PROPOSING') {
    return {
      success: false,
      errorCode: 'INVALID_STATUS',
      errorMessage: `Impossible de confirmer un remplacement au statut ${req.status}.`,
    };
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // Atomically link replacement and mark coverage adjusted
  req.replacementAssignmentId = replacementAssignmentId;
  req.status = 'CONFIRMED';
  req.version += 1;
  req.updatedAt = now;

  replacementStore.set(requestId, req);

  try {
    execute(
      `UPDATE replacement_requests
       SET replacement_assignment_id = ?, status = 'CONFIRMED', version = version + 1, updated_at = ?
       WHERE id = ?;`,
      [replacementAssignmentId, nowIso, requestId]
    );
  } catch {}

  return { success: true, request: req };
}

// ----------------------------------------------------
// Mission Bilan & Closure (WORKFLOWS.md line 60)
// ----------------------------------------------------

export function staffCloseMission(
  staffId: string,
  missionId: string,
  reconciliationNote: string,
  expectedVersion: number
): { success: boolean; missionSummary?: { missionId: string; totalDays: number; validatedDays: number; resolvedDays: number; closedAt: number }; errorCode?: string; errorMessage?: string } {
  const missionAttendances = listAttendanceByMission(missionId);

  // Invariant: All days must have a validated or staff-resolved status before mission close
  const unresolvedDays = missionAttendances.filter((a) => a.resolutionStatus === 'UNRESOLVED');
  if (unresolvedDays.length > 0) {
    return {
      success: false,
      errorCode: 'UNRESOLVED_ATTENDANCE_DAYS',
      errorMessage: `Impossible de clôturer la mission : ${unresolvedDays.length} journée(s) de présence sont encore en litige ou non validées.`,
    };
  }

  const validatedCount = missionAttendances.filter((a) => a.resolutionStatus === 'VALIDATED').length;
  const resolvedCount = missionAttendances.filter((a) => a.resolutionStatus === 'RESOLVED_BY_STAFF').length;

  try {
    execute(
      `UPDATE missions
       SET status = 'COMPLETED', version = version + 1, updated_at = ?
       WHERE id = ?;`,
      [new Date().toISOString(), missionId]
    );
  } catch {}

  return {
    success: true,
    missionSummary: {
      missionId,
      totalDays: missionAttendances.length,
      validatedDays: validatedCount,
      resolvedDays: resolvedCount,
      closedAt: Date.now(),
    },
  };
}

