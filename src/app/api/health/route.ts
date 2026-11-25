// Kazi Application Health & Database Readiness Handler (GET /api/health)

import { NextResponse } from 'next/server';
import { getDatabaseConnection } from '@/server/db/database';

export async function GET() {
  try {
    const db = getDatabaseConnection();
    const check = db.prepare('SELECT 1 as ok;').get() as { ok: number } | undefined;
    return NextResponse.json({
      status: 'ok',
      version: '1.0.0',
      database: check?.ok === 1 ? 'connected' : 'error',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', error: err.message },
      { status: 500 }
    );
  }
}
