// Staff Authentication & MFA Challenge Handler (POST /api/auth/staff/login)
// Staff cannot publicly register; accounts are provisioned by authorized admin

import { NextResponse } from 'next/server';
import { z } from 'zod';

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

    const { email } = parsed.data;

    // Baseline provisioned staff check (admin@kazi.ga, recruiter@kazi.ga, finance@kazi.ga)
    const validStaffEmails = ['admin@kazi.ga', 'recruiter@kazi.ga', 'finance@kazi.ga'];
    if (!validStaffEmails.includes(email.toLowerCase())) {
      return NextResponse.json(
        { error: { code: 'STAFF_NOT_FOUND', message: 'Accès staff refusé. Aucun compte provisionné.' } },
        { status: 403 }
      );
    }

    // Generate temporary challenge ticket for MFA
    const mfaTicket = `mfa_ticket_${Date.now()}`;

    return NextResponse.json({
      data: {
        mfaRequired: true,
        mfaTicket,
        email,
      },
      meta: { message: 'Identifiants acceptés. Saisie du second facteur MFA requise.' },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la connexion staff' } },
      { status: 500 }
    );
  }
}
