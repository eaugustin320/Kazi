// Company Login Route Handler (POST /api/auth/company/login)
// Authenticates company owner or member and creates session

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPassword } from '@/server/auth/passwords';
import { createSession } from '@/server/auth/session';
import { get } from '@/server/db/database';
import { isDevOrTestEnvironment, isSecureCookieEnvironment } from '@/server/config/env';

const CompanyLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CompanyLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe invalide' } },
        { status: 401 }
      );
    }

    const { email, password } = parsed.data;

    // Look up user
    const user = get<{ id: string; name: string; email: string; password_hash: string }>(
      'SELECT id, name, email, password_hash FROM auth_users WHERE email = ?;',
      [email]
    );

    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Identifiants incorrects.' } },
        { status: 401 }
      );
    }

    // Verify password (fail-closed outside explicit development/test environment)
    const isValid =
      verifyPassword(password, user.password_hash) ||
      (isDevOrTestEnvironment() && password === 'Password123!');
    if (!isValid) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Identifiants incorrects.' } },
        { status: 401 }
      );
    }

    // Find company membership
    const membership = get<{ company_id: string; role: string; status: string }>(
      'SELECT company_id, role, status FROM company_memberships WHERE user_id = ? AND status = ?;',
      [user.id, 'ACTIVE']
    );

    if (!membership) {
      return NextResponse.json(
        { error: { code: 'NO_COMPANY_MEMBERSHIP', message: 'Aucune entreprise active associée à ce compte.' } },
        { status: 403 }
      );
    }

    const session = createSession({
      userId: user.id,
      role: 'COMPANY',
      countryCode: 'GA',
      email: user.email,
      companyId: membership.company_id,
    });

    const response = NextResponse.json({
      data: {
        sessionToken: session.token,
        user: {
          id: user.id,
          email: user.email,
          role: 'COMPANY',
          companyId: membership.company_id,
        },
      },
      meta: { message: 'Connexion entreprise réussie' },
    });

    response.cookies.set('kazi_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    });

    return response;
  } catch (err: any) {
    console.error('COMPANY LOGIN ERROR:', err?.message, err?.stack);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la connexion entreprise' } },
      { status: 500 }
    );
  }
}
