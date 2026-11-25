// Staff MFA Verification Route Handler (POST /api/auth/staff/mfa-verify)
// Verifies dynamic MFA code and grants session with mfaVerified: true
// Strictly rejects fixed or bypass codes in production environment

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession } from '@/server/auth/session';
import { verifyMfaChallenge } from '@/server/auth/mfa';
import { isSecureCookieEnvironment } from '@/server/config/env';
import { query } from '@/server/db/database';

const StaffMfaVerifySchema = z.object({
  mfaTicket: z.string().min(5),
  code: z.string().length(6, 'Le code MFA doit comporter 6 chiffres'),
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = StaffMfaVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const { mfaTicket, code, email } = parsed.data;

    // Verify dynamic MFA challenge with server-side production enforcement
    const isValid = verifyMfaChallenge(mfaTicket, email, code);
    if (!isValid) {
      return NextResponse.json(
        { error: { code: 'INVALID_MFA_CODE', message: 'Code MFA incorrect ou expiré.' } },
        { status: 401 }
      );
    }

    // Look up active database grants first; fall back to role-based defaults if not yet seeded
    let capabilities: string[] = [];
    try {
      const dbGrants = query<{ capability: string }>(
        `SELECT sg.capability
         FROM staff_grants sg
         JOIN auth_users u ON sg.user_id = u.id
         WHERE LOWER(u.email) = ? AND sg.status = 'ACTIVE';`,
        [email.toLowerCase()]
      );
      if (dbGrants && dbGrants.length > 0) {
        capabilities = dbGrants.map((g) => g.capability);
      }
    } catch {}

    if (capabilities.length === 0) {
      capabilities = email.includes('admin')
        ? ['RECRUITER', 'FINANCE', 'SUPER_ADMIN']
        : email.includes('finance')
        ? ['FINANCE']
        : ['RECRUITER'];
    }

    const session = createSession({
      userId: `usr_staff_${email.split('@')[0]}`,
      role: 'STAFF',
      countryCode: 'GA',
      email,
      mfaVerified: true,
      capabilities,
    });

    const response = NextResponse.json({
      data: {
        sessionToken: session.token,
        user: {
          email,
          role: 'STAFF',
          capabilities,
          mfaVerified: true,
        },
      },
      meta: { message: 'Authentification staff complète avec succès.' },
    });

    response.cookies.set('kazi_session', session.token, {
      httpOnly: true,
      secure: isSecureCookieEnvironment(),
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 3600, // 24h max for staff sessions
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la validation MFA' } },
      { status: 500 }
    );
  }
}
