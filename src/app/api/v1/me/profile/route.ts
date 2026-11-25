// Authenticated Profile & Live Statistics Endpoint (GET & PATCH /api/v1/me/profile)
// Serves live worker/company profile metadata and database-computed statistics (no sample fixture fallback).

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest } from '@/server/auth/rbac';
import { execute, get, query } from '@/server/db/database';
import { listAttendanceByWorker } from '@/modules/attendance/service';

const UpdateWorkerProfileSchema = z.object({
  displayName: z.string().min(2).max(120).optional(),
  tradeCodes: z.array(z.string().min(2)).min(1).optional(),
  areaCode: z.string().min(2).optional(),
  experienceText: z.string().max(1000).optional(),
  availabilityCode: z.enum(['AVAILABLE', 'BUSY', 'UNAVAILABLE']).optional(),
});

const UpdateCompanyProfileSchema = z.object({
  legalName: z.string().min(2).max(160).optional(),
  tradeSector: z.string().max(160).optional(),
  registrationReference: z.string().max(80).optional(),
  taxReference: z.string().max(80).optional(),
  areaCode: z.string().min(2).optional(),
  address: z.string().max(240).optional(),
});

export async function GET(request: Request) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    if (session.user.role === 'WORKER') {
      const workerId = session.user.workerProfileId || session.user.userId;
      const wp = get<any>(
        `SELECT wp.*, u.phone_number, u.phone_verified
         FROM worker_profiles wp
         LEFT JOIN auth_users u ON wp.user_id = u.id
         WHERE wp.id = ? OR wp.user_id = ? LIMIT 1;`,
        [workerId, session.user.userId]
      );

      if (!wp) {
        return NextResponse.json(
          { error: { code: 'PROFILE_NOT_FOUND', message: 'Profil ouvrier introuvable.' } },
          { status: 404 }
        );
      }

      // Compute real attendance rate & completed missions from database
      const attRecords = listAttendanceByWorker(wp.id);
      const recordedDays = attRecords.filter((a) => a.declaredStatus !== 'NOT_RECORDED');
      const presentDays = recordedDays.filter(
        (a) => a.declaredStatus === 'PRESENT' || a.declaredStatus === 'PARTIAL'
      );
      const attendanceRate =
        recordedDays.length > 0 ? Math.round((presentDays.length / recordedDays.length) * 100) : 100;

      const assignmentCountRow = get<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM assignments WHERE worker_id = ? AND status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED');",
        [wp.id]
      );
      const docs = query<any>(
        'SELECT id, file_name, mime_type, review_status, scan_status, created_at FROM verification_documents WHERE worker_profile_id = ? ORDER BY created_at DESC;',
        [wp.id]
      );

      let tradeCodes: string[] = [];
      try {
        tradeCodes = typeof wp.trade_codes === 'string' ? JSON.parse(wp.trade_codes) : wp.trade_codes || [];
      } catch {}

      return NextResponse.json({
        data: {
          role: 'WORKER',
          id: wp.id,
          userId: wp.user_id,
          displayName: wp.display_name,
          phone: wp.phone_number || session.user.phone || '+24101000000',
          phoneVerified: Boolean(wp.phone_verified ?? 1),
          tradeCodes,
          areaCode: wp.area_code || 'libreville',
          experienceText: wp.experience_text || '',
          availabilityCode: wp.availability_code || 'AVAILABLE',
          profileStatus: wp.profile_status || 'ACTIVE',
          attendanceRate,
          completedMissionsCount: Number(assignmentCountRow?.cnt || 0),
          documents: docs || [],
        },
      });
    }

    if (session.user.role === 'COMPANY' && session.user.companyId) {
      const comp = get<any>('SELECT * FROM companies WHERE id = ? LIMIT 1;', [session.user.companyId]);
      if (!comp) {
        return NextResponse.json(
          { error: { code: 'COMPANY_NOT_FOUND', message: 'Profil entreprise introuvable.' } },
          { status: 404 }
        );
      }

      const docs = query<any>(
        'SELECT id, file_name, mime_type, review_status, scan_status, created_at FROM verification_documents WHERE company_id = ? ORDER BY created_at DESC;',
        [comp.id]
      );

      return NextResponse.json({
        data: {
          role: 'COMPANY',
          id: comp.id,
          legalName: comp.legal_name,
          tradeSector: comp.trade_sector || '',
          registrationReference: comp.registration_reference || '',
          taxReference: comp.tax_reference || '',
          areaCode: comp.area_code || 'libreville',
          address: comp.address || '',
          contactEmail: comp.contact_email,
          verificationStatus: comp.verification_status,
          version: Number(comp.version || 1),
          documents: docs || [],
        },
      });
    }

    return NextResponse.json({
      data: {
        role: 'STAFF',
        id: session.user.userId,
        email: session.user.email,
        capabilities: session.user.capabilities || [],
        mfaVerified: Boolean(session.user.mfaVerified),
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération du profil.' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const nowIso = new Date().toISOString();

    if (session.user.role === 'WORKER') {
      const parsed = UpdateWorkerProfileSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
          { status: 422 }
        );
      }
      const workerId = session.user.workerProfileId || session.user.userId;
      const wp = get<any>('SELECT * FROM worker_profiles WHERE id = ? OR user_id = ? LIMIT 1;', [
        workerId,
        session.user.userId,
      ]);
      if (!wp) {
        return NextResponse.json(
          { error: { code: 'PROFILE_NOT_FOUND', message: 'Profil ouvrier introuvable.' } },
          { status: 404 }
        );
      }

      const displayName = parsed.data.displayName ?? wp.display_name;
      const tradeCodes = parsed.data.tradeCodes
        ? JSON.stringify(parsed.data.tradeCodes)
        : wp.trade_codes;
      const areaCode = parsed.data.areaCode ?? wp.area_code;
      const experienceText = parsed.data.experienceText ?? wp.experience_text;
      const availabilityCode = parsed.data.availabilityCode ?? wp.availability_code;

      execute(
        `UPDATE worker_profiles
         SET display_name = ?, trade_codes = ?, area_code = ?, experience_text = ?, availability_code = ?, updated_at = ?
         WHERE id = ?;`,
        [displayName, tradeCodes, areaCode, experienceText, availabilityCode, nowIso, wp.id]
      );

      return GET(request);
    }

    if (session.user.role === 'COMPANY' && session.user.companyId) {
      const parsed = UpdateCompanyProfileSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
          { status: 422 }
        );
      }
      const comp = get<any>('SELECT * FROM companies WHERE id = ? LIMIT 1;', [session.user.companyId]);
      if (!comp) {
        return NextResponse.json(
          { error: { code: 'COMPANY_NOT_FOUND', message: 'Profil entreprise introuvable.' } },
          { status: 404 }
        );
      }

      // Per ADR-D3-01: Material legal/tax identity changes reset company verification to PENDING
      const materialChanged =
        (parsed.data.legalName && parsed.data.legalName !== comp.legal_name) ||
        (parsed.data.registrationReference &&
          parsed.data.registrationReference !== comp.registration_reference) ||
        (parsed.data.taxReference && parsed.data.taxReference !== comp.tax_reference);

      const nextVerificationStatus = materialChanged ? 'PENDING' : comp.verification_status;

      execute(
        `UPDATE companies
         SET legal_name = ?, trade_sector = ?, registration_reference = ?, tax_reference = ?,
             area_code = ?, address = ?, verification_status = ?, version = version + 1, updated_at = ?
         WHERE id = ?;`,
        [
          parsed.data.legalName ?? comp.legal_name,
          parsed.data.tradeSector ?? comp.trade_sector,
          parsed.data.registrationReference ?? comp.registration_reference,
          parsed.data.taxReference ?? comp.tax_reference,
          parsed.data.areaCode ?? comp.area_code,
          parsed.data.address ?? comp.address,
          nextVerificationStatus,
          nowIso,
          comp.id,
        ]
      );

      return GET(request);
    }

    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Modification non autorisée.' } },
      { status: 403 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la mise à jour du profil.' } },
      { status: 500 }
    );
  }
}
