// Quote Decision Handler (POST /api/v1/quotes/[id]/decision)
// Company accepts or declines Kazi service quote (API.md line 69)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/server/auth/rbac';
import { decideQuote } from '@/modules/billing/service';

const DecisionSchema = z.object({
  decision: z.enum(['ACCEPT', 'DECLINE']),
  expectedVersion: z.number().int().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    if (!session || session.user.role !== 'COMPANY' || !session.user.companyId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED_COMPANY', message: 'Seule l’entreprise cliente peut statuer sur un devis.' } },
        { status: 403 }
      );
    }

    const { id: quoteId } = await params;
    const body = await request.json();
    const parsed = DecisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = decideQuote(
      session.user.companyId,
      quoteId,
      parsed.data.decision,
      parsed.data.expectedVersion
    );

    if (!result.success) {
      const status =
        result.errorCode === 'QUOTE_NOT_FOUND' ? 404 :
        result.errorCode === 'QUOTE_EXPIRED' ? 410 :
        result.errorCode === 'VERSION_CONFLICT' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: result.quote,
      meta: {
        requestId: `req_${Date.now()}`,
        message: parsed.data.decision === 'ACCEPT' ? 'Devis accepté avec succès.' : 'Devis décliné.',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la prise de décision sur le devis.' } },
      { status: 500 }
    );
  }
}
