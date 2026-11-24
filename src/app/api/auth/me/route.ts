// Session Inspection Route Handler (GET /api/auth/me)

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/rbac';

export async function GET(request: Request) {
  const session = authenticateRequest(request);

  if (!session) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Aucune session active' } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    data: {
      userId: session.user.userId,
      role: session.user.role,
      countryCode: session.user.countryCode,
      email: session.user.email,
      phone: session.user.phone,
      companyId: session.user.companyId,
      workerProfileId: session.user.workerProfileId,
      capabilities: session.user.capabilities,
      mfaVerified: session.user.mfaVerified,
      expiresAt: new Date(session.expiresAt).toISOString(),
    },
    meta: {
      requestId: `req_${Date.now()}`,
    },
  });
}
