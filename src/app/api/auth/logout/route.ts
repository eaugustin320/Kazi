// Session Revocation Route Handler (POST /api/auth/logout)

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/rbac';
import { revokeSession } from '@/server/auth/session';

export async function POST(request: Request) {
  const session = authenticateRequest(request);

  if (session) {
    revokeSession(session.token);
  }

  const response = NextResponse.json({
    data: { success: true },
    meta: { message: 'Session révoquée avec succès' },
  });

  response.cookies.set('kazi_session', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });

  return response;
}
