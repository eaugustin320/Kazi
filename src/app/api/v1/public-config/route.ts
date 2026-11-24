// Public Config API Route Handler (GET /api/v1/public-config?country=GA)
// Complies with API.md

import { NextResponse } from 'next/server';
import { resolveCountryConfig } from '@/config/app-config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const countryParam = searchParams.get('country') || 'GA';

  const { country, theme } = resolveCountryConfig(countryParam);

  return NextResponse.json({
    data: {
      countryCode: country.countryCode,
      defaultLocale: country.defaultLocale,
      supportedLocales: country.supportedLocales,
      currency: country.currency,
      timezone: country.timezone,
      phonePrefix: country.phone.callingPrefix,
      activeTheme: {
        themeId: theme.themeId,
        themeVersion: theme.themeVersion,
        mode: theme.mode,
        colors: theme.colors,
      },
      serviceAreas: country.serviceAreas.filter((a) => a.enabledForDesign),
    },
    meta: {
      requestId: `req_${Date.now()}`,
      version: '1.0.0',
    },
  });
}
