// Staff Authentication & MFA Challenge Handler (POST /api/auth/staff/login)
// Staff cannot publicly register; accounts are provisioned by authorized admin.
// Strictly verifies credentials and issues RFC 6238 TOTP / single-use MFA challenge tickets.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { get } from '@/server/db/database';
import { verifyPassword } from '@/server/auth/passwords';
import { createMfaChallenge } from '@/server/auth/mfa';
import { isDevOrTestEnvironment } from '@/server/config/env';

const StaffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = StaffLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect' } },
        { status: 401 }
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check provisioned staff accounts in database or baseline staff list
    const user = get<{ id: string; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM auth_users WHERE LOWER(email) = ?;',
      [normalizedEmail]
    );
    const grant = user
      ? get<{ id: string }>(
          "SELECT id FROM staff_grants WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1;",
          [user.id]
        )
      : null;

    const baselineStaffEmails = ['admin@kazi.ga', 'recruiter@kazi.ga', 'finance@kazi.ga'];
    const isProvisionedStaff = Boolean(grant) || baselineStaffEmails.includes(normalizedEmail);

    if (!isProvisionedStaff) {
      return NextResponse.json(
        { error: { code: 'STAFF_NOT_FOUND', message: 'Accès staff refusé. Aucun compte provisionné.' } },
        { status: 403 }
      );
    }

    const isDevOrTest = isDevOrTestEnvironment();

    if (!isDevOrTest) {
      // Fail-closed outside development/test: require database password hash match
      if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
        return NextResponse.json(
          { error: { code: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect' } },
          { status: 401 }
        );
      }
    } else {
      // In development/test: always verify password (stored hash or known dev fixture password)
      const matchesStoredHash = Boolean(user?.password_hash && verifyPassword(password, user.password_hash));
      const matchesDevPassword = password === 'Password123!' || password === 'StaffPassword2026!';
      if (!matchesStoredHash && !matchesDevPassword) {
        return NextResponse.json(
          { error: { code: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect' } },
          { status: 401 }
        );
      }
    }

    const mfa = createMfaChallenge(normalizedEmail);

    return NextResponse.json({
      data: {
        mfaRequired: true,
        mfaTicket: mfa.ticket,
        email: normalizedEmail,
        totpConfigured: true,
        ...(isDevOrTest
          ? {
              debugMfaCode: mfa.code,
              totpUri: mfa.totpUri,
            }
          : {}),
      },
      meta: { message: 'Identifiants acceptés. Saisie du code TOTP / MFA requise.' },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la connexion staff' } },
      { status: 500 }
    );
  }
}
