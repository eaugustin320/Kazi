// Kazi Recruitment Domain Invariant Service
// Implements PRD.md, WORKFLOWS.md invariants KZ06, KZ07, KZ08, KZ09

export interface ValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Validates whether an application can be submitted (KZ06).
 * Invariant: Mission must be OPEN and worker cannot have an existing non-withdrawn application.
 */
export function validateApplicationSubmission(
  missionStatus: string,
  existingApplicationStatus?: string
): ValidationResult {
  if (missionStatus !== 'OPEN') {
    return {
      valid: false,
      errorCode: 'MISSION_CLOSED',
      errorMessage: 'La mission n’accepte plus de candidatures.',
    };
  }

  if (existingApplicationStatus && existingApplicationStatus !== 'WITHDRAWN') {
    return {
      valid: false,
      errorCode: 'APPLICATION_EXISTS',
      errorMessage: 'Une candidature existe déjà pour cet ouvrier sur cette mission (KZ06).',
    };
  }

  return { valid: true };
}

/**
 * Validates Dual Confirmation gate (KZ08).
 * Invariant: Proposal requires both Company ACCEPTED and Worker CONFIRMED on the same terms revision.
 */
export function validateDualConfirmation(
  companyDecision: string,
  workerDecision: string,
  proposalTermsRevision: number,
  missionTermsRevision: number,
  expiresAt: Date | string | number
): ValidationResult {
  // Check terms revision match
  if (proposalTermsRevision !== missionTermsRevision) {
    return {
      valid: false,
      errorCode: 'TERMS_CHANGED',
      errorMessage: 'Les termes de la mission ont été révisés depuis la proposition.',
    };
  }

  // Check 24-hour expiration window
  const expiry = new Date(expiresAt).getTime();
  if (Date.now() > expiry) {
    return {
      valid: false,
      errorCode: 'CONFIRMATION_EXPIRED',
      errorMessage: 'Le délai de confirmation de disponibilité de 24h a expiré.',
    };
  }

  // Check company decision
  if (companyDecision !== 'ACCEPTED') {
    return {
      valid: false,
      errorCode: 'COMPANY_NOT_ACCEPTED',
      errorMessage: 'L’entreprise n’a pas accepté la proposition de candidat.',
    };
  }

  // Check worker decision
  if (workerDecision !== 'CONFIRMED') {
    return {
      valid: false,
      errorCode: 'WORKER_NOT_CONFIRMED',
      errorMessage: 'L’ouvrier n’a pas encore confirmé sa disponibilité.',
    };
  }

  return { valid: true };
}

/**
 * Validates Atomic Assignment Capacity (KZ09).
 * Invariant: Headcount assigned must strictly be less than headcount needed.
 */
export function validateAssignmentCapacity(
  headcountNeeded: number,
  headcountAssigned: number
): ValidationResult {
  if (headcountAssigned >= headcountNeeded) {
    return {
      valid: false,
      errorCode: 'CAPACITY_FULL',
      errorMessage: 'La capacité maximale d’ouvriers affectés pour cette mission est déjà atteinte.',
    };
  }

  return { valid: true };
}

/**
 * Validates Schedule Anti-Overlap (KZ09 & DATABASE.md).
 * Invariant: No two active confirmed coverage intervals overlap for one worker.
 */
export function validateScheduleAntiOverlap(
  workerId: string,
  newStartsAt: Date | string,
  newEndsAt: Date | string,
  existingIntervals: Array<{ workerId: string; startsAt: Date | string; endsAt: Date | string }>
): ValidationResult {
  const start = new Date(newStartsAt).getTime();
  const end = new Date(newEndsAt).getTime();

  for (const interval of existingIntervals) {
    if (interval.workerId !== workerId) continue;
    const existingStart = new Date(interval.startsAt).getTime();
    const existingEnd = new Date(interval.endsAt).getTime();

    // Overlap condition: (StartA < EndB) and (EndA > StartB)
    if (start < existingEnd && end > existingStart) {
      return {
        valid: false,
        errorCode: 'WORKER_OVERLAP',
        errorMessage: 'L’ouvrier est déjà engagé sur un autre chantier durant cette période.',
      };
    }
  }

  return { valid: true };
}
