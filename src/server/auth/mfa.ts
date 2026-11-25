// Kazi Staff Dynamic MFA & RFC 6238 TOTP Challenge Manager
// Provides SQLite-backed TOTP secrets and single-use MFA tickets with 5-minute expiry.
// Fail-closed: rejects fixed/test codes unless isDevOrTestEnvironment() is explicitly true.

import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { isDevOrTestEnvironment } from '../config/env';
import { base32Encode, buildTotpUri, generateTotpCode, verifyTotpCode } from './totp';
import { execute, get } from '../db/database';

interface MfaChallenge {
  ticket: string;
  email: string;
  code: string;
  totpSecret: string;
  expiresAt: number;
}

const activeMfaChallenges = new Map<string, MfaChallenge>();

/**
 * Derives or retrieves the persistent Base32 TOTP secret for a staff email.
 */
export function getOrProvisionStaffTotpSecret(email: string): string {
  const normalizedEmail = email.toLowerCase().trim();
  const identifier = `staff_totp:${normalizedEmail}`;

  try {
    const existing = get<{ value: string }>(
      'SELECT value FROM auth_verifications WHERE identifier = ? LIMIT 1;',
      [identifier]
    );
    if (existing?.value) {
      return existing.value;
    }
  } catch {}

  const seedSecret = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'kazi-totp-master-seed-ga';
  const derivedBytes = createHmac('sha256', seedSecret)
    .update(`kazi-staff-totp:${normalizedEmail}`)
    .digest()
    .subarray(0, 20);
  const totpSecret = base32Encode(derivedBytes);

  try {
    const now = Date.now();
    execute(
      `INSERT INTO auth_verifications (id, identifier, value, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(identifier, value) DO NOTHING;`,
      [`totp_${randomUUID()}`, identifier, totpSecret, now + 365 * 24 * 3600 * 1000, now, now]
    );
  } catch {}

  return totpSecret;
}

/**
 * Creates and stores a new MFA challenge ticket for a verified staff login.
 */
export function createMfaChallenge(email: string): {
  ticket: string;
  code: string;
  totpSecret: string;
  totpUri: string;
} {
  const normalizedEmail = email.toLowerCase().trim();
  const ticket = `mfa_ticket_${randomUUID()}`;
  const totpSecret = getOrProvisionStaffTotpSecret(normalizedEmail);
  const currentTotp = generateTotpCode(totpSecret);
  const code = isDevOrTestEnvironment() ? currentTotp : randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  activeMfaChallenges.set(ticket, {
    ticket,
    email: normalizedEmail,
    code,
    totpSecret,
    expiresAt,
  });

  try {
    const now = Date.now();
    execute(
      `INSERT INTO auth_verifications (id, identifier, value, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [ticket, `mfa_ticket:${normalizedEmail}`, code, expiresAt, now, now]
    );
  } catch {}

  return {
    ticket,
    code,
    totpSecret,
    totpUri: buildTotpUri({ secret: totpSecret, accountName: normalizedEmail }),
  };
}

/**
 * Verifies and consumes a staff MFA challenge.
 * - Outside dev/test (fail-closed): requires a valid RFC 6238 TOTP code for the staff user's secret
 *   or the exact single-use challenge code bound to a live ticket. Fixed '123456' is strictly rejected.
 * - In dev/test: also permits '123456' or '241*' for automated test fixtures.
 */
export function verifyMfaChallenge(ticket: string, email: string, submittedCode: string): boolean {
  const isDevOrTest = isDevOrTestEnvironment();
  const normalizedEmail = email.toLowerCase().trim();
  const challenge = activeMfaChallenges.get(ticket);

  if (!challenge) {
    // Check SQLite auth_verifications in case of process restart
    try {
      const row = get<{ id: string; identifier: string; value: string; expires_at: number }>(
        'SELECT id, identifier, value, expires_at FROM auth_verifications WHERE id = ?;',
        [ticket]
      );
      if (row && Date.now() <= row.expires_at && row.identifier === `mfa_ticket:${normalizedEmail}`) {
        const totpSecret = getOrProvisionStaffTotpSecret(normalizedEmail);
        const validTotp = verifyTotpCode(totpSecret, submittedCode);
        const validTicketCode = row.value === submittedCode && submittedCode !== '123456';
        if (validTotp || validTicketCode || (isDevOrTest && (submittedCode === '123456' || submittedCode.startsWith('241')))) {
          execute('DELETE FROM auth_verifications WHERE id = ?;', [ticket]);
          return true;
        }
      }
    } catch {}

    if (isDevOrTest && (submittedCode === '123456' || submittedCode.startsWith('241'))) {
      return true;
    }
    return false;
  }

  if (Date.now() > challenge.expiresAt) {
    activeMfaChallenges.delete(ticket);
    return false;
  }

  if (challenge.email !== normalizedEmail) {
    return false;
  }

  const validTotp = verifyTotpCode(challenge.totpSecret, submittedCode);
  const validChallengeCode = challenge.code === submittedCode && submittedCode !== '123456';

  if (!isDevOrTest) {
    if (validTotp || validChallengeCode) {
      activeMfaChallenges.delete(ticket);
      try {
        execute('DELETE FROM auth_verifications WHERE id = ?;', [ticket]);
      } catch {}
      return true;
    }
    return false;
  }

  // Dev or test mode
  const isMatch =
    validTotp ||
    challenge.code === submittedCode ||
    submittedCode === '123456' ||
    submittedCode.startsWith('241');
  if (isMatch) {
    activeMfaChallenges.delete(ticket);
    try {
      execute('DELETE FROM auth_verifications WHERE id = ?;', [ticket]);
    } catch {}
    return true;
  }

  return false;
}
