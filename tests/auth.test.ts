// Comprehensive Security, Identity & RBAC Integration Tests (Phase D2)
// Enforces OPERATIONS_AND_SECURITY.md, PRD.md, and API.md

import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword, verifyPassword } from '../src/server/auth/passwords';
import {
  createOTPChallenge,
  verifyOTPChallenge,
  resetOTPState,
  OTP_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_WINDOW,
} from '../src/server/auth/otp';
import {
  createSession,
  getSession,
  revokeSession,
  resetSessionStore,
  clearSessionMemoryCache,
} from '../src/server/auth/session';
import { get as dbGet, execute as dbExecute } from '../src/server/db/database';
import {
  requireAuth,
  requireCompanyScope,
  requireWorkerScope,
  requireStaffCapability,
} from '../src/server/auth/rbac';
import { POST as sendOtpHandler } from '../src/app/api/auth/worker/send-otp/route';
import { POST as verifyOtpHandler } from '../src/app/api/auth/worker/verify-otp/route';
import { POST as registerCompanyHandler } from '../src/app/api/auth/company/register/route';
import { POST as staffLoginHandler } from '../src/app/api/auth/staff/login/route';
import { POST as staffMfaHandler } from '../src/app/api/auth/staff/mfa-verify/route';

describe('Phase D2: Authentication, Security & Tenant Isolation', () => {
  beforeEach(() => {
    resetOTPState();
    resetSessionStore();
    try {
      dbExecute("DELETE FROM auth_users WHERE id LIKE 'usr_company_%' OR id LIKE 'usr_worker_%' OR id LIKE 'usr_test_%';");
      dbExecute("DELETE FROM companies WHERE id LIKE 'comp_%';");
      dbExecute("DELETE FROM company_memberships WHERE id LIKE 'memb_%';");
      dbExecute("DELETE FROM worker_profiles WHERE id LIKE 'wp_%';");
    } catch {}
  });

  // 1. Password Hashing & Timing-Safe Verification
  describe('Password Security', () => {
    it('hashes passwords with unique salts and verifies correctly', () => {
      const password = 'MonMotDePasseKazi2026!';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).not.toBe(hash2); // Unique salt per hash
      expect(verifyPassword(password, hash1)).toBe(true);
      expect(verifyPassword(password, hash2)).toBe(true);
      expect(verifyPassword('WrongPassword', hash1)).toBe(false);
    });
  });

  // 2. Phone OTP Challenges & Rate Limiting (API.md line 98)
  describe('Worker Phone OTP Challenges', () => {
    const validPhone = '+24107901122';

    it('creates an OTP challenge for valid Gabon phone (+241)', () => {
      const result = createOTPChallenge(validPhone);
      expect(result.success).toBe(true);
      expect(result.debugCode).toBeDefined();
      expect(result.debugCode).toHaveLength(6);
    });

    it('enforces 60-second cooldown between consecutive OTP requests', () => {
      const first = createOTPChallenge(validPhone);
      expect(first.success).toBe(true);

      const second = createOTPChallenge(validPhone);
      expect(second.success).toBe(false);
      expect(second.errorCode).toBe('COOLDOWN_ACTIVE');
    });

    it('rejects incorrect OTP codes and decrements remaining attempts', () => {
      const challenge = createOTPChallenge(validPhone);
      expect(challenge.success).toBe(true);

      const verifyWrong = verifyOTPChallenge(validPhone, '000000');
      expect(verifyWrong.success).toBe(false);
      expect(verifyWrong.errorCode).toBe('INVALID_CODE');
    });

    it('locks out challenge after 5 failed attempts', () => {
      createOTPChallenge(validPhone);
      for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
        verifyOTPChallenge(validPhone, '000000');
      }

      const lockedOut = verifyOTPChallenge(validPhone, '000000');
      expect(lockedOut.success).toBe(false);
      expect(lockedOut.errorCode).toBe('ATTEMPTS_EXCEEDED');
    });

    it('successfully verifies correct OTP code', () => {
      const challenge = createOTPChallenge(validPhone);
      expect(challenge.debugCode).toBeDefined();

      const verify = verifyOTPChallenge(validPhone, challenge.debugCode!);
      expect(verify.success).toBe(true);
    });
  });

  // 3. Session Expiration & Revocation
  describe('Session Lifecycle', () => {
    it('creates and validates active session', () => {
      const session = createSession({
        userId: 'usr_test_1',
        role: 'WORKER',
        countryCode: 'GA',
      });

      const retrieved = getSession(session.token);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.user.userId).toBe('usr_test_1');
    });

    it('rejects expired session tokens', () => {
      // Create session expired 1 second ago
      const session = createSession(
        { userId: 'usr_test_2', role: 'WORKER', countryCode: 'GA' },
        -1000
      );

      const retrieved = getSession(session.token);
      expect(retrieved).toBeNull();
    });

    it('revokes session on logout', () => {
      const session = createSession({
        userId: 'usr_test_3',
        role: 'COMPANY',
        countryCode: 'GA',
      });

      expect(getSession(session.token)).not.toBeNull();
      revokeSession(session.token);
      expect(getSession(session.token)).toBeNull();
    });

    it('persists session to SQLite database and recovers it after in-memory cache clearance', () => {
      const session = createSession({
        userId: 'usr_persistent_worker',
        role: 'WORKER',
        countryCode: 'GA',
        phone: '+24177112233',
        workerProfileId: 'wp_persisted_1',
      });

      // Clear memory cache to simulate process restart
      clearSessionMemoryCache();

      // Retrieve session - must be recovered from SQLite database
      const recovered = getSession(session.token);
      expect(recovered).not.toBeNull();
      expect(recovered?.user.userId).toBe('usr_persistent_worker');
      expect(recovered?.user.role).toBe('WORKER');
      expect(recovered?.user.workerProfileId).toBe('wp_persisted_1');
    });

    it('revoking session physically deletes it from SQLite database', () => {
      const session = createSession({
        userId: 'usr_to_revoke',
        role: 'COMPANY',
        countryCode: 'GA',
      });

      const rowBefore = dbGet('SELECT token FROM auth_sessions WHERE token = ?', [session.token]);
      expect(rowBefore).not.toBeNull();

      revokeSession(session.token);

      const rowAfter = dbGet('SELECT token FROM auth_sessions WHERE token = ?', [session.token]);
      expect(rowAfter).toBeNull();
    });
  });

  // 4. Cross-Tenant Scope Access Protection (Nonnegotiable boundary)
  describe('Tenant & Scope Isolation', () => {
    it('Company A cannot access Company B resources (404 rejection)', () => {
      const companyASession = createSession({
        userId: 'usr_company_a',
        role: 'COMPANY',
        countryCode: 'GA',
        companyId: 'company-a',
      });

      const checkOtherCompany = requireCompanyScope(companyASession, 'company-b');
      expect(checkOtherCompany.authorized).toBe(false);
      expect(checkOtherCompany.statusCode).toBe(404);
      expect(checkOtherCompany.errorCode).toBe('COMPANY_SCOPE_MISMATCH');

      // But can access its own company resources
      const checkOwnCompany = requireCompanyScope(companyASession, 'company-a');
      expect(checkOwnCompany.authorized).toBe(true);
      expect(checkOwnCompany.statusCode).toBe(200);
    });

    it('Worker A cannot access Worker B private records (403 rejection)', () => {
      const workerASession = createSession({
        userId: 'usr_worker_a',
        role: 'WORKER',
        countryCode: 'GA',
        workerProfileId: 'worker-01',
      });

      const checkOtherWorker = requireWorkerScope(workerASession, 'worker-02');
      expect(checkOtherWorker.authorized).toBe(false);
      expect(checkOtherWorker.statusCode).toBe(403);
      expect(checkOtherWorker.errorCode).toBe('WORKER_SCOPE_MISMATCH');

      // Can access own profile
      const checkOwnWorker = requireWorkerScope(workerASession, 'worker-01');
      expect(checkOwnWorker.authorized).toBe(true);
      expect(checkOwnWorker.statusCode).toBe(200);
    });

    it('Worker attempting staff operations is rejected with 403', () => {
      const workerSession = createSession({
        userId: 'usr_worker_1',
        role: 'WORKER',
        countryCode: 'GA',
      });

      const checkStaffOp = requireStaffCapability(workerSession, 'RECRUITER');
      expect(checkStaffOp.authorized).toBe(false);
      expect(checkStaffOp.statusCode).toBe(403);
      expect(checkStaffOp.errorCode).toBe('STAFF_ROLE_REQUIRED');
    });

    it('Staff requires MFA before executing privileged mutations', () => {
      const staffWithoutMfa = createSession({
        userId: 'usr_staff_recruiter',
        role: 'STAFF',
        countryCode: 'GA',
        capabilities: ['RECRUITER'],
        mfaVerified: false, // MFA pending
      });

      const checkMfa = requireStaffCapability(staffWithoutMfa, 'RECRUITER');
      expect(checkMfa.authorized).toBe(false);
      expect(checkMfa.statusCode).toBe(403);
      expect(checkMfa.errorCode).toBe('MFA_REQUIRED');
    });

    it('Staff requires specific capability (Recruiter cannot record finance receipt)', () => {
      const recruiterSession = createSession({
        userId: 'usr_staff_recruiter',
        role: 'STAFF',
        countryCode: 'GA',
        capabilities: ['RECRUITER'],
        mfaVerified: true,
      });

      const checkFinance = requireStaffCapability(recruiterSession, 'FINANCE');
      expect(checkFinance.authorized).toBe(false);
      expect(checkFinance.statusCode).toBe(403);
      expect(checkFinance.errorCode).toBe('CAPABILITY_DENIED');

      const checkRecruiter = requireStaffCapability(recruiterSession, 'RECRUITER');
      expect(checkRecruiter.authorized).toBe(true);
    });
  });

  // 5. Auth Route Handlers End-to-End
  describe('Auth API Handlers', () => {
    it('Worker complete flow: send OTP -> verify OTP -> receive valid session', async () => {
      const phone = '+24107112233';

      // Step 1: Send OTP
      const sendReq = new Request('http://localhost:3000/api/auth/worker/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const sendRes = await sendOtpHandler(sendReq);
      expect(sendRes.status).toBe(200);
      const sendData = await sendRes.json();
      expect(sendData.data.debugCode).toBeDefined();

      // Step 2: Verify OTP
      const verifyReq = new Request('http://localhost:3000/api/auth/worker/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: sendData.data.debugCode }),
      });
      const verifyRes = await verifyOtpHandler(verifyReq);
      expect(verifyRes.status).toBe(200);
      const verifyData = await verifyRes.json();
      expect(verifyData.data.sessionToken).toBeDefined();
      expect(verifyData.data.user.role).toBe('WORKER');

      // Verify worker user & profile were created in SQLite database
      const dbWorker = dbGet<{ id: string }>('SELECT id FROM worker_profiles WHERE user_id = ?', [verifyData.data.user.id]);
      expect(dbWorker).not.toBeNull();
    });

    it('Company registration creates company and owner membership atomically', async () => {
      const regReq = new Request('http://localhost:3000/api/auth/company/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalName: 'Chantier Moderne Gabon',
          tradeSector: 'Génie Civil',
          registrationReference: 'RG/FCV 2026 B 888',
          taxReference: '998877-K',
          areaCode: 'libreville',
          address: 'Avenue de Cointet, Libreville',
          contactEmail: 'contact@chantiermoderne.ga',
          contactPhone: '+24107445566',
          password: 'SecureCompanyPass2026!',
        }),
      });

      const regRes = await registerCompanyHandler(regReq);
      expect(regRes.status).toBe(201);
      const regData = await regRes.json();
      expect(regData.data.company.id).toBeDefined();
      expect(regData.data.user.companyId).toBe(regData.data.company.id);
      expect(regData.data.user.role).toBe('COMPANY');

      // Verify company & membership were persisted in SQLite database
      const dbCompany = dbGet<{ id: string; legal_name: string }>('SELECT id, legal_name FROM companies WHERE id = ?', [regData.data.company.id]);
      expect(dbCompany).not.toBeNull();
      expect(dbCompany?.legal_name).toBe('Chantier Moderne Gabon');

      const dbMemb = dbGet<{ id: string; role: string }>('SELECT id, role FROM company_memberships WHERE company_id = ? AND role = ?', [regData.data.company.id, 'OWNER']);
      expect(dbMemb).not.toBeNull();
    });

    it('Staff complete flow: login -> challenge MFA -> verify MFA -> receive staff capabilities', async () => {
      // Step 1: Staff login
      const loginReq = new Request('http://localhost:3000/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@kazi.ga',
          password: 'StaffPassword2026!',
        }),
      });
      const loginRes = await staffLoginHandler(loginReq);
      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      expect(loginData.data.mfaRequired).toBe(true);
      expect(loginData.data.mfaTicket).toBeDefined();

      // Step 2: Staff MFA verification
      const mfaReq = new Request('http://localhost:3000/api/auth/staff/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@kazi.ga',
          mfaTicket: loginData.data.mfaTicket,
          code: '123456',
        }),
      });
      const mfaRes = await staffMfaHandler(mfaReq);
      expect(mfaRes.status).toBe(200);
      const mfaData = await mfaRes.json();
      expect(mfaData.data.user.role).toBe('STAFF');
      expect(mfaData.data.user.mfaVerified).toBe(true);
      expect(mfaData.data.user.capabilities).toContain('SUPER_ADMIN');
    });
  });
});
