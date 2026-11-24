// Staff Quote Send Handler (POST /api/v1/staff/quotes/[id]/send)
// Finance staff sends service quote snapshot to client company (API.md line 67)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { sendQuote } from '@/modules/billing/service';

const SendSchema = z.object({
  expectedVersion: z.number().int().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'FINANCE');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const { id: quoteId } = await params;
    const body = await request.json();
    const parsed = SendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = sendQuote(session!.user.userId, quoteId, parsed.data.expectedVersion);

    if (!result.success) {
      const status =
        result.errorCode === 'QUOTE_NOT_FOUND' ? 404 :
        result.errorCode === 'VERSION_CONFLICT' ? 409 : 400;

      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json({
      data: result.quote,
      meta: { requestId: `req_${Date.now()}`, message: 'Devis envoyé à l’entreprise.' },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de l’envoi du devis.' } },
      { status: 500 }
    );
  }
}
