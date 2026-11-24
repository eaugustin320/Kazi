// User Notifications Collection Handler (GET /api/v1/me/notifications)
// Retrieves authenticated user's notifications (API.md line 76)

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/auth/rbac';
import { listUserNotifications } from '@/modules/support/service';

export async function GET(request: Request) {
  try {
    const session = authenticateRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentification requise.' } },
        { status: 401 }
      );
    }

    const notifications = listUserNotifications(session.user.userId);

    return NextResponse.json({
      data: notifications,
      meta: {
        requestId: `req_${Date.now()}`,
        count: notifications.length,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Erreur lors de la récupération des notifications.' } },
      { status: 500 }
    );
  }
}
