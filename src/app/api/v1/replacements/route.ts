// Replacement Requests Handler (GET & POST /api/v1/replacements)
// Strictly enforces KZ11 and tenant/role authorization without fabricating assignments.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import {
  createReplacementRequest,
  listReplacementRequests,
  listAllAttendance,
} from '@/modules/attendance/service';
import { get } from '@/server/db/database';

const CreateReplacementSchema = z.object({
  assignmentId: z.string().min(1),
  missionId: z.string().min(1),
  workerId: z.string().min(1),
  affectedDayIds: z.array(z.string()).min(1),
  reasonCode: z.enum(['WORKER_ABSENT', 'WORKER_ILLNESS', 'SKILL_MISMATCH', 'COMPANY_REQUEST']),
  note: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    if (session.user.role === 'STAFF') {
      const staffAuth = requireStaffCapability(session, 'RECRUITER');
      if (!staffAuth.authorized) {
        return NextResponse.json(
          { error: { code: staffAuth.errorCode, message: staffAuth.errorMessage } },
          { status: staffAuth.statusCode }
        );
      }
      const list = listReplacementRequests();
      return NextResponse.json({ data: list, meta: { count: list.length } });
    }

    if (session.user.role === 'COMPANY' && session.user.companyId) {
      const list = listReplacementRequests(session.user.companyId);
      return NextResponse.json({ data: list, meta: { count: list.length } });
    }

    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Accès non autorisé aux demandes de remplacement.' } },
      { status: 403 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération des remplacements.' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    // Workers cannot create replacement requests
    if (session.user.role !== 'COMPANY' && session.user.role !== 'STAFF') {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Seuls l’entreprise cliente ou un recruteur Kazi peuvent demander un remplacement.',
          },
        },
        { status: 403 }
      );
    }

    if (session.user.role === 'STAFF') {
      const staffAuth = requireStaffCapability(session, 'RECRUITER');
      if (!staffAuth.authorized) {
        return NextResponse.json(
          { error: { code: staffAuth.errorCode, message: staffAuth.errorMessage } },
          { status: staffAuth.statusCode }
        );
      }
    }

    const body = await request.json();
    const parsed = CreateReplacementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const { assignmentId, missionId, workerId, affectedDayIds, reasonCode, note } = parsed.data;

    // Resolve authoritative company ownership from database or seeded attendance records
    let assignmentCompanyId: string | undefined;
    try {
      const dbOwner = get<{ company_id: string }>(
        `SELECT m.company_id
         FROM assignments a
         JOIN missions m ON a.mission_id = m.id
         WHERE a.id = ? LIMIT 1;`,
        [assignmentId]
      );
      if (dbOwner?.company_id) {
        assignmentCompanyId = dbOwner.company_id;
      } else {
        const missionOwner = get<{ company_id: string }>(
          'SELECT company_id FROM missions WHERE id = ? LIMIT 1;',
          [missionId]
        );
        if (missionOwner?.company_id) {
          assignmentCompanyId = missionOwner.company_id;
        }
      }
    } catch {}

    if (!assignmentCompanyId) {
      const attMatch = listAllAttendance().find(
        (a) => a.assignmentId === assignmentId || a.missionId === missionId
      );
      if (attMatch?.companyId) {
        assignmentCompanyId = attMatch.companyId;
      }
    }

    if (session.user.role === 'COMPANY') {
      if (!session.user.companyId) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Portée entreprise manquante.' } },
          { status: 403 }
        );
      }
      if (assignmentCompanyId && assignmentCompanyId !== session.user.companyId) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Affectation introuvable.' } },
          { status: 404 }
        );
      }
      assignmentCompanyId = session.user.companyId;
    }

    if (!assignmentCompanyId) {
      return NextResponse.json(
        { error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Affectation ou mission introuvable.' } },
        { status: 404 }
      );
    }

    const result = createReplacementRequest(
      session.user.userId,
      assignmentId,
      missionId,
      assignmentCompanyId,
      workerId,
      affectedDayIds,
      reasonCode,
      note
    );

    if (!result.success) {
      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data: result.request,
      meta: { message: 'Demande de remplacement enregistrée avec succès.' },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la création de la demande de remplacement.' } },
      { status: 500 }
    );
  }
}
