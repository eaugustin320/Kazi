// Staff Team Provisioning Handler (GET / POST /api/v1/staff/team)
// Controlled staff team provisioning by administrator; no public staff signup (API.md lines 80-81)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { listStaffTeam, provisionStaffMember } from '@/modules/admin/service';

const ProvisionSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  countryCode: z.string().length(2).default('GA'),
  capabilities: z.array(z.enum(['RECRUITER', 'FINANCE', 'SUPER_ADMIN'])).min(1),
});

export async function GET(request: Request) {
  try {
    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'SUPER_ADMIN');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const team = listStaffTeam('GA');
    return NextResponse.json({
      data: team,
      meta: { requestId: `req_${Date.now()}`, count: team.length },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération de l’équipe.' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = authenticateRequest(request);
    const auth = requireStaffCapability(session, 'SUPER_ADMIN');
    if (!auth.authorized) {
      return NextResponse.json(
        { error: { code: auth.errorCode, message: auth.errorMessage } },
        { status: auth.statusCode }
      );
    }

    const body = await request.json();
    const parsed = ProvisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      );
    }

    const result = provisionStaffMember({
      adminId: session!.user.userId,
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      countryCode: parsed.data.countryCode,
      capabilities: parsed.data.capabilities,
    });

    if (!result.success) {
      const status = result.errorCode === 'STAFF_EXISTS' ? 409 : 400;
      return NextResponse.json(
        { error: { code: result.errorCode, message: result.errorMessage } },
        { status }
      );
    }

    return NextResponse.json(
      {
        data: result.staff,
        meta: { requestId: `req_${Date.now()}`, message: 'Compte staff provisionné avec succès.' },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors du provisionnement staff.' } },
      { status: 500 }
    );
  }
}
