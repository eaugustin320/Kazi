// Missions API Route Handler (GET /api/v1/missions)
// Complies with API.md & KZ05: Returns safe published mission summaries from database

import { NextResponse } from 'next/server';
import { listPublicMissions } from '@/modules/applications/service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trade = searchParams.get('trade') || undefined;
  const area = searchParams.get('area') || undefined;

  const safeSummaries = listPublicMissions({
    countryCode: 'GA',
    areaCode: area,
    tradeCode: trade,
  }).map((m: any) => ({
    ...m,
    trade: m.tradeCode || m.trade,
    area: m.areaCode || m.area,
  }));

  return NextResponse.json({
    data: safeSummaries,
    meta: {
      requestId: `req_${Date.now()}`,
      count: safeSummaries.length,
      limit: 20,
    },
  });
}
