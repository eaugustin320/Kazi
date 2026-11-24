// Kazi Role-Based Access Control (RBAC) & Tenant Scope Isolation
// Enforces OPERATIONS_AND_SECURITY.md, PRD.md, and API.md invariants

import { ActiveSession, getSession } from './session';

export interface AuthorizationResult {
  authorized: boolean;
  statusCode: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Extracts and validates session from request Authorization header or Cookie.
 */
export function authenticateRequest(request: Request): ActiveSession | null {
  // Check Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    return getSession(token);
  }

  // Check Cookie: kazi_session=<token>
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/kazi_session=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return getSession(match[1]);
    }
  }

  return null;
}

/**
 * Enforces authenticated session.
 */
export function requireAuth(session: ActiveSession | null): AuthorizationResult {
  if (!session) {
    return {
      authorized: false,
      statusCode: 401,
      errorCode: 'UNAUTHENTICATED',
      errorMessage: 'Authentification requise pour accéder à cette ressource.',
    };
  }
  return { authorized: true, statusCode: 200 };
}

/**
 * Enforces company tenant scope isolation.
 * Invariant: Caller must be an active member of the requested companyId.
 * Rejects cross-tenant access with 404 (preventing existence probing) or 403.
 */
export function requireCompanyScope(
  session: ActiveSession | null,
  requestedCompanyId: string
): AuthorizationResult {
  const auth = requireAuth(session);
  if (!auth.authorized) return auth;

  // Staff with RECRUITER or SUPER_ADMIN can inspect company scopes
  if (
    session!.user.role === 'STAFF' &&
    (session!.user.capabilities?.includes('RECRUITER') ||
      session!.user.capabilities?.includes('SUPER_ADMIN'))
  ) {
    return { authorized: true, statusCode: 200 };
  }

  // Company member must own/belong to the exact companyId
  if (session!.user.role !== 'COMPANY' || session!.user.companyId !== requestedCompanyId) {
    return {
      authorized: false,
      statusCode: 404, // PRD rule: return 404 to avoid revealing another company's resources
      errorCode: 'COMPANY_SCOPE_MISMATCH',
      errorMessage: 'Ressource introuvable ou accès non autorisé à cette entreprise.',
    };
  }

  return { authorized: true, statusCode: 200 };
}

/**
 * Enforces worker scope isolation.
 * Invariant: Worker can only view and mutate their own profile, applications, and assignments.
 */
export function requireWorkerScope(
  session: ActiveSession | null,
  targetWorkerId: string
): AuthorizationResult {
  const auth = requireAuth(session);
  if (!auth.authorized) return auth;

  // Staff with RECRUITER can inspect worker details
  if (
    session!.user.role === 'STAFF' &&
    (session!.user.capabilities?.includes('RECRUITER') ||
      session!.user.capabilities?.includes('SUPER_ADMIN'))
  ) {
    return { authorized: true, statusCode: 200 };
  }

  if (session!.user.role !== 'WORKER' || session!.user.workerProfileId !== targetWorkerId) {
    return {
      authorized: false,
      statusCode: 403,
      errorCode: 'WORKER_SCOPE_MISMATCH',
      errorMessage: 'Vous ne pouvez pas accéder aux données d’un autre ouvrier.',
    };
  }

  return { authorized: true, statusCode: 200 };
}

/**
 * Enforces staff capability and MFA requirement.
 * Invariants:
 * 1. Role must be STAFF.
 * 2. Country code must match the staff scope.
 * 3. Required capability (e.g. RECRUITER, FINANCE) must be granted.
 * 4. MFA must be completed (mfaVerified: true).
 */
export function requireStaffCapability(
  session: ActiveSession | null,
  requiredCapability: 'RECRUITER' | 'FINANCE' | 'SUPER_ADMIN',
  targetCountryCode: string = 'GA'
): AuthorizationResult {
  const auth = requireAuth(session);
  if (!auth.authorized) return auth;

  if (session!.user.role !== 'STAFF') {
    return {
      authorized: false,
      statusCode: 403,
      errorCode: 'STAFF_ROLE_REQUIRED',
      errorMessage: 'Privilèges administration requis.',
    };
  }

  // MFA check (OPERATIONS_AND_SECURITY.md)
  if (!session!.user.mfaVerified) {
    return {
      authorized: false,
      statusCode: 403,
      errorCode: 'MFA_REQUIRED',
      errorMessage: 'Validation du second facteur MFA obligatoire pour les opérations staff.',
    };
  }

  // Country scope check
  if (session!.user.countryCode !== targetCountryCode) {
    return {
      authorized: false,
      statusCode: 403,
      errorCode: 'COUNTRY_SCOPE_MISMATCH',
      errorMessage: `Portée non autorisée pour le pays ${targetCountryCode}.`,
    };
  }

  // Capability check
  const caps = session!.user.capabilities || [];
  if (!caps.includes(requiredCapability) && !caps.includes('SUPER_ADMIN')) {
    return {
      authorized: false,
      statusCode: 403,
      errorCode: 'CAPABILITY_DENIED',
      errorMessage: `Capacité requise non accordée : ${requiredCapability}`,
    };
  }

  return { authorized: true, statusCode: 200 };
}
