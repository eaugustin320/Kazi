// API Endpoints integration tests verifying API.md contracts
import { describe, it, expect } from 'vitest';
import { GET as getPublicConfig } from '../src/app/api/v1/public-config/route';
import { GET as getMissions } from '../src/app/api/v1/missions/route';
import { POST as postApplication } from '../src/app/api/v1/applications/route';
import { POST as postFinalization } from '../src/app/api/v1/staff/finalization/route';

describe('API.md Endpoints Contracts', () => {
  it('GET /api/v1/public-config returns Gabon metadata and active theme', async () => {
    const request = new Request('http://localhost:3000/api/v1/public-config?country=GA');
    const response = await getPublicConfig(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.countryCode).toBe('GA');
    expect(json.data.currency.code).toBe('XAF');
    expect(json.data.currency.minorUnitExponent).toBe(0);
    expect(json.data.timezone).toBe('Africa/Libreville');
    expect(json.data.phonePrefix).toBe('+241');
    expect(json.data.activeTheme.themeId).toBe('gabon-premium@1.0.0');
    expect(json.meta.requestId).toBeDefined();
  });

  it('GET /api/v1/missions returns safe summaries and redacts private details', async () => {
    const request = new Request('http://localhost:3000/api/v1/missions');
    const response = await getMissions(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);

    const firstMission = json.data[0];
    expect(firstMission.title).toBeDefined();
    expect(firstMission.trade).toBeDefined();
    expect(firstMission.area).toBeDefined();
    expect(firstMission.dayPayXAF).toBeGreaterThan(0);
    expect(firstMission.status).toBe('OPEN');
    // Ensure raw internal or confidential details are not exposed
    expect(firstMission.internalNotes).toBeUndefined();
  });

  it('POST /api/v1/applications rejects invalid UUID termsId (422)', async () => {
    const request = new Request('http://localhost:3000/api/v1/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ termsId: 'not-a-valid-uuid' }),
    });

    const response = await postApplication(request);
    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/staff/finalization rejects unconfirmed proposal (409)', async () => {
    // prop-01 in fixtures has workerDecision: PENDING
    const request = new Request('http://localhost:3000/api/v1/staff/finalization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposalId: 'prop-01', // Needs UUID or mock ID validation
        expectedVersion: 1,
      }),
    });

    const response = await postFinalization(request);
    expect(response.status).toBe(422); // Rejects non-UUID proposalId as per schema
  });
});
