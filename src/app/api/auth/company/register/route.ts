// Company Registration Route Handler (POST /api/auth/company/register)
// Creates user credentials and company membership atomically

import { NextResponse } from 'next/server';
import { CompanyRegistrationSchema } from '@/modules/recruitment/validation';
import { hashPassword } from '@/server/auth/passwords';
import { createSession } from '@/server/auth/session';
import { execute, get, transaction } from '@/server/db/database';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const FullCompanyRegisterSchema = CompanyRegistrationSchema.extend({
  password: z.string().min(8, 'Le mot de passe doit comporter au moins 8 caractères'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = FullCompanyRegisterSchema.safeParse(body);

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

    const { legalName, contactEmail, password, contactPhone, tradeSector, registrationReference, taxReference, address } = parsed.data;

    // Hash password securely
    const _hashed = hashPassword(password);

    const userId = `usr_company_${Date.now()}`;
    const companyId = `comp_${Date.now()}`;
    const nowIso = new Date().toISOString();
    let effectiveUserId = userId;

    // Persist company owner, company profile, and owner membership atomically
    transaction((db) => {
      const existingUser = get<{ id: string }>(
        'SELECT id FROM auth_users WHERE email = ? OR (phone_number IS NOT NULL AND phone_number = ?);',
        [contactEmail, contactPhone ?? null],
        db
      );

      if (existingUser) {
        effectiveUserId = existingUser.id;
        execute(
          'UPDATE auth_users SET password_hash = ?, updated_at = ? WHERE id = ?;',
          [_hashed, nowIso, effectiveUserId],
          db
        );
      } else {
        execute(
          `INSERT INTO auth_users (id, name, email, phone_number, password_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [userId, legalName, contactEmail, contactPhone ?? null, _hashed, nowIso, nowIso],
          db
        );
      }

      execute(
        `INSERT INTO companies (id, country_code, legal_name, trade_sector, registration_reference, tax_reference, area_code, address, contact_email, contact_phone, verification_status, created_at, updated_at)
         VALUES (?, 'GA', ?, ?, ?, ?, 'libreville', ?, ?, ?, 'PENDING', ?, ?);`,
        [companyId, legalName, tradeSector ?? null, registrationReference ?? null, taxReference ?? null, address ?? null, contactEmail, contactPhone ?? null, nowIso, nowIso],
        db
      );

      execute(
        `INSERT INTO company_memberships (id, company_id, user_id, role, status, created_at, updated_at)
         VALUES (?, ?, ?, 'OWNER', 'ACTIVE', ?, ?);`,
        [randomUUID(), companyId, effectiveUserId, nowIso, nowIso],
        db
      );
    });

    // Create session for the company owner
    const session = createSession({
      userId: effectiveUserId,
      role: 'COMPANY',
      countryCode: 'GA',
      email: contactEmail,
      phone: contactPhone,
      companyId,
    });

    const response = NextResponse.json(
      {
        data: {
          sessionToken: session.token,
          user: {
            id: userId,
            email: contactEmail,
            role: 'COMPANY',
            companyId,
          },
          company: {
            id: companyId,
            legalName,
            tradeSector,
            registrationReference,
            taxReference,
            address,
            verificationStatus: 'PENDING',
          },
        },
        meta: { message: 'Compte entreprise créé avec succès (en attente de validation documentaire)' },
      },
      { status: 201 }
    );

    response.cookies.set('kazi_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    });

    return response;
  } catch (err) {
    console.error('COMPANY REGISTER ERROR:', err);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de l’inscription entreprise' } },
      { status: 500 }
    );
  }
}
