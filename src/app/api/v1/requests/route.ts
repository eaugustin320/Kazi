// Requests Collection Handler (GET / POST /api/v1/requests)
// Allows companies to list/draft staffing needs; staff to review requests (API.md KZ03)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireCompanyScope, requireStaffCapability } from '@/server/auth/rbac';
import { createDraftRequest, listRequests } from '@/modules/requests/service';

const CreateRequestSchema = z.object({
  tradeCode: z.string().min(2),
  headcount: z.number().int().min(1),
  siteName: z.string().min(2),
  commune: z.string().min(2),
  siteAddress: z.string().min(3),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
  dailyHours: z.string().min(2),
  dayPayXAF: z.number().int().min(5000, 'Le salaire journalier minimum est de 5 000 FCFA'),
  equipmentRequirements: z.string().min(2),
  specialInstructions: z.string().optional(),
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

    if (session.user.role === 'COMPANY') {
      const companyId = session.user.companyId;
      if (!companyId) {
        return NextResponse.json(
          { error: { code: 'NO_COMPANY_MEMBERSHIP', message: 'Aucune entreprise associée.' } },
          { status: 403 }
        );
      }
      const requests = listRequests({ companyId });
      return NextResponse.json({
        data: requests,
        meta: { requestId: `req_${Date.now()}`, limit: 20 },
      });
    }

    if (session.user.role === 'STAFF') {
      const auth = requireStaffCapability(session, 'RECRUITER');
      if (!auth.authorized) {
        return NextResponse.json(
          { error: { code: auth.errorCode, message: auth.errorMessage } },
          { status: auth.statusCode }
        );
      }
      const requests = listRequests({ countryCode: 'GA' });
      return NextResponse.json({
        data: requests,
        meta: { requestId: `req_${Date.now()}`, limit: 20 },
      });
    }

    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Rôle non autorisé à lister les demandes.' } },
      { status: 403 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération des demandes.' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = authenticateRequest(request);
    if (!session || session.user.role !== 'COMPANY' || !session.user.companyId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED_COMPANY', message: 'Seule une entreprise authentifiée peut créer une demande.' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = CreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const draft = createDraftRequest(session.user.companyId, session.user.userId, parsed.data);

    return NextResponse.json(
      {
        data: draft,
        meta: { requestId: `req_${Date.now()}`, message: 'Brouillon de demande créé avec succès.' },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la création de la demande.' } },
      { status: 500 }
    );
  }
}
