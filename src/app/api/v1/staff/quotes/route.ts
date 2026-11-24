// Staff Quotes Handler (POST /api/v1/staff/quotes)
// Finance staff drafts recruitment service quote (API.md line 66)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { createDraftQuote } from '@/modules/billing/service';

const CreateQuoteSchema = z.object({
  companyId: z.string().min(1),
  missionId: z.string().optional(),
  lines: z.array(
    z.object({
      description: z.string().min(3),
      quantity: z.number().int().min(1),
      unitAmount: z.number().int().min(1),
      taxRate: z.number().min(0).max(1).optional(),
    })
  ).min(1),
  validityDays: z.number().int().min(1).max(90).optional(),
});

export async function GET(request: Request) {
  try {
    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'FINANCE');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const { getDatabaseConnection } = await import('@/server/db/database');
    const db = getDatabaseConnection();
    const quotes = db.prepare('SELECT * FROM quotes ORDER BY created_at DESC;').all();

    return NextResponse.json({
      data: quotes,
      meta: { requestId: `req_${Date.now()}`, count: quotes.length },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération des devis.' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'FINANCE');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const body = await request.json();
    const parsed = CreateQuoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = createDraftQuote(parsed.data);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        data: result.quote,
        meta: { requestId: `req_${Date.now()}`, message: 'Brouillon de devis de service Kazi créé.' },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la création du devis.' } },
      { status: 500 }
    );
  }
}
