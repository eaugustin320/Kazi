// User Notification Read Timestamp Handler (POST /api/v1/me/notifications/[id]/read)
// Idempotently records read timestamp for user notification (API.md line 77)

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/rbac';
import { markNotificationAsRead } from '@/modules/support/service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    const { id: notificationId } = await params;
    const ok = markNotificationAsRead(session.user.userId, notificationId);

    if (!ok) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Notification introuvable.' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: { id: notificationId, read: true },
      meta: { requestId: `req_${Date.now()}` },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la mise à jour de la notification.' } },
      { status: 500 }
    );
  }
}
