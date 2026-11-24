// Staff Redacted Audit Log Handler (GET /api/v1/staff/audit)
// Returns country-scoped redacted audit list (API.md line 83)

import { NextResponse } from 'next/server';
import { authenticateRequest, requireStaffCapability } from '@/server/auth/rbac';
import { listAuditEvents } from '@/modules/admin/service';

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

    const events = listAuditEvents('GA');

    return NextResponse.json({
      data: events,
      meta: {
        requestId: `req_${Date.now()}`,
        count: events.length,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération du journal d’audit.' } },
      { status: 500 }
    );
  }
}
