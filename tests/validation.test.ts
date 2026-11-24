// Unit tests for Kazi Invariants & Validation Schemas
import { describe, it, expect } from 'vitest';
import {
  validateApplicationSubmission,
  validateDualConfirmation,
  validateAssignmentCapacity,
  validateScheduleAntiOverlap,
} from '../src/modules/recruitment/service';
import {
  GABON_PHONE_REGEX,
  CompanyRegistrationSchema,
  StaffingRequestCreateSchema,
} from '../src/modules/recruitment/validation';

describe('Recruitment Invariants (KZ06, KZ08, KZ09)', () => {
  it('KZ06: Rejects duplicate applications when application is already submitted', () => {
    const result = validateApplicationSubmission('OPEN', 'SUBMITTED');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('APPLICATION_EXISTS');
  });

  it('KZ06: Allows application if previous application was withdrawn', () => {
    const result = validateApplicationSubmission('OPEN', 'WITHDRAWN');
    expect(result.valid).toBe(true);
  });

  it('KZ06: Rejects application if mission is closed', () => {
    const result = validateApplicationSubmission('CLOSED_TO_APPLICATIONS');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('MISSION_CLOSED');
  });

  it('KZ08: Rejects finalization if company has not accepted', () => {
    const futureExpiry = new Date(Date.now() + 3600000).toISOString();
    const result = validateDualConfirmation('PENDING', 'CONFIRMED', 1, 1, futureExpiry);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('COMPANY_NOT_ACCEPTED');
  });

  it('KZ08: Rejects finalization if worker has not confirmed', () => {
    const futureExpiry = new Date(Date.now() + 3600000).toISOString();
    const result = validateDualConfirmation('ACCEPTED', 'PENDING', 1, 1, futureExpiry);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('WORKER_NOT_CONFIRMED');
  });

  it('KZ08: Rejects finalization if 24h window is expired', () => {
    const pastExpiry = new Date(Date.now() - 3600000).toISOString();
    const result = validateDualConfirmation('ACCEPTED', 'CONFIRMED', 1, 1, pastExpiry);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('CONFIRMATION_EXPIRED');
  });

  it('KZ08: Rejects finalization if terms revision does not match', () => {
    const futureExpiry = new Date(Date.now() + 3600000).toISOString();
    const result = validateDualConfirmation('ACCEPTED', 'CONFIRMED', 1, 2, futureExpiry);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('TERMS_CHANGED');
  });

  it('KZ09: Rejects finalization if capacity is full', () => {
    const result = validateAssignmentCapacity(10, 10);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('CAPACITY_FULL');
  });

  it('KZ09: Allows finalization if capacity is available', () => {
    const result = validateAssignmentCapacity(10, 9);
    expect(result.valid).toBe(true);
  });

  it('KZ09: Detects overlapping worker schedules to prevent double booking', () => {
    const existing = [
      {
        workerId: 'worker-01',
        startsAt: '2026-12-01T07:00:00Z',
        endsAt: '2026-12-03T16:00:00Z',
      },
    ];

    // Overlapping case
    const overlapResult = validateScheduleAntiOverlap(
      'worker-01',
      '2026-12-02T07:00:00Z',
      '2026-12-04T16:00:00Z',
      existing
    );
    expect(overlapResult.valid).toBe(false);
    expect(overlapResult.errorCode).toBe('WORKER_OVERLAP');

    // Non-overlapping case
    const nonOverlapResult = validateScheduleAntiOverlap(
      'worker-01',
      '2026-12-05T07:00:00Z',
      '2026-12-07T16:00:00Z',
      existing
    );
    expect(nonOverlapResult.valid).toBe(true);
  });
});

describe('Gabon Boundary Validations', () => {
  it('validates Gabon phone number format (+241)', () => {
    expect(GABON_PHONE_REGEX.test('+24107901122')).toBe(true);
    expect(GABON_PHONE_REGEX.test('+24106123456')).toBe(true);
    expect(GABON_PHONE_REGEX.test('+33612345678')).toBe(false); // French number rejected for GA local phone
    expect(GABON_PHONE_REGEX.test('07901122')).toBe(false); // Missing country code prefix
  });

  it('validates company registration schema', () => {
    const validCompany = {
      legalName: 'BTP Gabon SARL',
      tradeSector: 'Construction',
      registrationReference: 'RG/FCV 2026 B 100',
      taxReference: '123456-A',
      areaCode: 'libreville',
      address: 'Zone Industrielle Oloumi, Libreville',
      contactEmail: 'direction@btp-gabon.ga',
      contactPhone: '+24107451234',
    };

    const parsed = CompanyRegistrationSchema.safeParse(validCompany);
    expect(parsed.success).toBe(true);
  });

  it('validates minimum wage threshold in staffing requests', () => {
    const invalidRequest = {
      tradeCode: 'Coffreur',
      headcount: 5,
      siteName: 'Chantier Bord de Mer',
      commune: 'Libreville',
      startsAt: '2026-12-01',
      endsAt: '2026-12-03',
      dailyHours: '07h30 - 16h30',
      dayPayXAF: 3000, // Below minimum 5000 FCFA
      equipmentRequirements: 'Casque et chaussures coquées',
    };

    const parsed = StaffingRequestCreateSchema.safeParse(invalidRequest);
    expect(parsed.success).toBe(false);
  });
});
