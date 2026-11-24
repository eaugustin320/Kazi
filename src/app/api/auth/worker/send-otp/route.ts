// Worker OTP Request Route Handler (POST /api/auth/worker/send-otp)
// Enforces Gabon phone format (+241...) and rate limiting (max 3 per 15 min, 60s cooldown)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GABON_PHONE_REGEX } from '@/modules/recruitment/validation';
import { createOTPChallenge } from '@/server/auth/otp';

const SendOTPSchema = z.object({
  phone: z.string().regex(GABON_PHONE_REGEX, 'Format téléphone gabonais requis (+241...)'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = SendOTPSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_PHONE_FORMAT',
            message: 'Numéro de téléphone gabonais invalide (+241...)',
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    const result = createOTPChallenge(parsed.data.phone);

    if (!result.success) {
      const status = result.errorCode === 'RATE_LIMIT_EXCEEDED' ? 429 : 400;
      return NextResponse.json(
        {
          error: {
            code: result.errorCode,
            message: result.errorMessage,
            cooldownSeconds: result.cooldownSeconds,
          },
        },
        { status }
      );
    }

    return NextResponse.json({
      data: {
        sent: true,
        phone: parsed.data.phone,
        debugCode: result.debugCode, // Only present in development
      },
      meta: {
        message: 'Code SMS transmis avec succès',
        expiresInSeconds: 300,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de l’envoi du code SMS' } },
      { status: 500 }
    );
  }
}
