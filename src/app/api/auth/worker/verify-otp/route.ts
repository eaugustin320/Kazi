// Worker OTP Verification Route Handler (POST /api/auth/worker/verify-otp)
// Verifies 6-digit challenge, creates session, and sets secure HttpOnly cookie

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GABON_PHONE_REGEX } from '@/modules/recruitment/validation';
import { verifyOTPChallenge } from '@/server/auth/otp';
import { createSession } from '@/server/auth/session';
import { execute, get, transaction } from '@/server/db/database';

const VerifyOTPSchema = z.object({
  phone: z.string().regex(GABON_PHONE_REGEX),
  code: z.string().length(6, 'Le code doit comporter 6 chiffres'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = VerifyOTPSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 422 }
      );
    }

    const verify = verifyOTPChallenge(parsed.data.phone, parsed.data.code);

    if (!verify.success) {
      return NextResponse.json(
        {
          error: {
            code: verify.errorCode,
            message: verify.errorMessage,
          },
        },
        { status: 401 }
      );
    }

    // Provision/find worker user
    let userId = `usr_worker_${parsed.data.phone.replace(/[^0-9]/g, '')}`;
    const nowIso = new Date().toISOString();

    transaction((db) => {
      const existingUser = get<{ id: string }>(
        'SELECT id FROM auth_users WHERE phone_number = ?;',
        [parsed.data.phone],
        db
      );

      if (existingUser) {
        userId = existingUser.id;
        execute(
          `UPDATE auth_users SET phone_verified = 1, updated_at = ? WHERE id = ?;`,
          [nowIso, userId],
          db
        );
      } else {
        execute(
          `INSERT INTO auth_users (id, phone_number, phone_verified, created_at, updated_at)
           VALUES (?, ?, 1, ?, ?);`,
          [userId, parsed.data.phone, nowIso, nowIso],
          db
        );
      }

      const existingProfile = get<{ id: string }>(
        'SELECT id FROM worker_profiles WHERE user_id = ?;',
        [userId],
        db
      );
      const workerProfileId = existingProfile ? existingProfile.id : `wp_${userId}`;

      if (!existingProfile) {
        execute(
          `INSERT INTO worker_profiles (id, user_id, display_name, trade_codes, area_code, created_at, updated_at)
           VALUES (?, ?, 'Ouvrier Kazi', '[]', 'libreville', ?, ?);`,
          [workerProfileId, userId, nowIso, nowIso],
          db
        );
      }
    });

    const existingProfile = get<{ id: string }>(
      'SELECT id FROM worker_profiles WHERE user_id = ?;',
      [userId]
    );
    const workerProfileId = existingProfile ? existingProfile.id : `wp_${userId}`;

    const session = createSession({
      userId,
      role: 'WORKER',
      countryCode: 'GA',
      phone: parsed.data.phone,
      workerProfileId,
    });

    const response = NextResponse.json({
      data: {
        sessionToken: session.token,
        user: {
          id: userId,
          role: 'WORKER',
          countryCode: 'GA',
          phone: parsed.data.phone,
          workerProfileId,
        },
      },
      meta: { message: 'Connexion ouvrier réussie' },
    });

    // Set HttpOnly SameSite cookie
    response.cookies.set('kazi_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    });

    return response;
  } catch (err: any) {
    console.error('VERIFY OTP ERROR:', err?.message, err?.stack);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la vérification' } },
      { status: 500 }
    );
  }
}
