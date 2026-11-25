// Kazi Phone OTP Challenge & Rate Limiting Manager
// Implements API.md limits: max 3 sends / 15 min, max 5 attempts, 5-minute expiry, 60s cooldown
// Persistent SQLite backing matching DATABASE.md and prisma/schema.prisma

import { randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { execute, get, query } from '../db/database';
import { isDevOrTestEnvironment } from '../config/env';

export interface OTPChallenge {
  phone: string;
  code: string;
  expiresAt: number; // timestamp ms
  attemptsRemaining: number;
  createdAt: number;
}

// In-memory challenge store for instant lookup
const activeChallenges = new Map<string, OTPChallenge>();
const sendHistory = new Map<string, number[]>(); // phone -> timestamps ms

export const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_WINDOW = 3;
export const OTP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export interface SendOTPResult {
  success: boolean;
  errorCode?: 'COOLDOWN_ACTIVE' | 'RATE_LIMIT_EXCEEDED' | 'INVALID_PHONE';
  errorMessage?: string;
  cooldownSeconds?: number;
  debugCode?: string; // Provided only in development/test environments
}

export interface VerifyOTPResult {
  success: boolean;
  errorCode?: 'EXPIRED' | 'ATTEMPTS_EXCEEDED' | 'INVALID_CODE' | 'NOT_FOUND';
  errorMessage?: string;
}

/**
 * Sends/generates an OTP challenge for a Gabon phone (+241...).
 */
export function createOTPChallenge(phone: string): SendOTPResult {
  const now = Date.now();

  // 1. Clean send history older than 15 min
  const history = (sendHistory.get(phone) || []).filter((t) => now - t < OTP_WINDOW_MS);
  sendHistory.set(phone, history);

  // Check rate limit: max 3 per 15 minutes
  if (history.length >= OTP_MAX_SENDS_PER_WINDOW) {
    return {
      success: false,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      errorMessage: 'Trop de demandes de code. Veuillez patienter 15 minutes.',
    };
  }

  // Check cooldown: 60 seconds between resends
  const lastSend = history[history.length - 1];
  if (lastSend && now - lastSend < OTP_COOLDOWN_MS) {
    const remainingSec = Math.ceil((OTP_COOLDOWN_MS - (now - lastSend)) / 1000);
    return {
      success: false,
      errorCode: 'COOLDOWN_ACTIVE',
      errorMessage: `Veuillez patienter ${remainingSec} secondes avant de renvoyer un code.`,
      cooldownSeconds: remainingSec,
    };
  }

  // Generate 6-digit code
  const code = randomInt(100000, 999999).toString();
  const expiresAt = now + OTP_EXPIRY_MS;

  activeChallenges.set(phone, {
    phone,
    code,
    expiresAt,
    attemptsRemaining: OTP_MAX_ATTEMPTS,
    createdAt: now,
  });

  history.push(now);
  sendHistory.set(phone, history);

  // Persist OTP record in SQLite database
  try {
    execute(
      `INSERT INTO auth_otp_codes (id, phone_number, code_hash, attempts, expires_at, verified, created_at)
       VALUES (?, ?, ?, 0, ?, 0, ?);`,
      [randomUUID(), phone, code, expiresAt, now]
    );
  } catch {}

  return {
    success: true,
    debugCode: isDevOrTestEnvironment() ? code : undefined,
  };
}

/**
 * Verifies a submitted OTP code.
 */
export function verifyOTPChallenge(phone: string, submittedCode: string): VerifyOTPResult {
  const challenge = activeChallenges.get(phone);
  const now = Date.now();

  if (!challenge) {
    // Attempt fallback from SQLite database
    try {
      const row = get<{
        id: string;
        code_hash: string;
        attempts: number;
        expires_at: number;
        verified: number;
      }>(
        `SELECT id, code_hash, attempts, expires_at, verified
         FROM auth_otp_codes
         WHERE phone_number = ? AND verified = 0
         ORDER BY created_at DESC LIMIT 1;`,
        [phone]
      );

      if (!row) {
        return {
          success: false,
          errorCode: 'NOT_FOUND',
          errorMessage: 'Aucun code actif pour ce numéro.',
        };
      }

      if (now > row.expires_at) {
        return {
          success: false,
          errorCode: 'EXPIRED',
          errorMessage: 'Le code a expiré. Veuillez en demander un nouveau.',
        };
      }

      if (row.attempts >= OTP_MAX_ATTEMPTS) {
        return {
          success: false,
          errorCode: 'ATTEMPTS_EXCEEDED',
          errorMessage: 'Nombre maximal de tentatives dépassé.',
        };
      }

      const isMatch = timingSafeStringEqual(submittedCode, row.code_hash);
      if (isMatch) {
        execute(`UPDATE auth_otp_codes SET verified = 1 WHERE id = ?;`, [row.id]);
        return { success: true };
      } else {
        const newAttempts = row.attempts + 1;
        execute(`UPDATE auth_otp_codes SET attempts = ? WHERE id = ?;`, [newAttempts, row.id]);
        if (newAttempts >= OTP_MAX_ATTEMPTS) {
          return {
            success: false,
            errorCode: 'ATTEMPTS_EXCEEDED',
            errorMessage: 'Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.',
          };
        }
        return {
          success: false,
          errorCode: 'INVALID_CODE',
          errorMessage: `Code incorrect. Tentatives restantes : ${OTP_MAX_ATTEMPTS - newAttempts}`,
        };
      }
    } catch {
      return {
        success: false,
        errorCode: 'NOT_FOUND',
        errorMessage: 'Aucun code actif pour ce numéro.',
      };
    }
  }

  // Check expiry
  if (now > challenge.expiresAt) {
    activeChallenges.delete(phone);
    return {
      success: false,
      errorCode: 'EXPIRED',
      errorMessage: 'Le code a expiré. Veuillez en demander un nouveau.',
    };
  }

  // Check attempts lockout
  if (challenge.attemptsRemaining <= 0) {
    return {
      success: false,
      errorCode: 'ATTEMPTS_EXCEEDED',
      errorMessage: 'Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.',
    };
  }

  // Timing-safe code comparison
  const isMatch = timingSafeStringEqual(submittedCode, challenge.code);

  if (isMatch) {
    activeChallenges.delete(phone);
    try {
      execute(
        `UPDATE auth_otp_codes SET verified = 1 WHERE phone_number = ? AND code_hash = ?;`,
        [phone, challenge.code]
      );
    } catch {}
    return { success: true };
  } else {
    challenge.attemptsRemaining -= 1;
    try {
      execute(
        `UPDATE auth_otp_codes SET attempts = attempts + 1 WHERE phone_number = ? AND code_hash = ?;`,
        [phone, challenge.code]
      );
    } catch {}

    if (challenge.attemptsRemaining <= 0) {
      return {
        success: false,
        errorCode: 'ATTEMPTS_EXCEEDED',
        errorMessage: 'Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.',
      };
    }

    return {
      success: false,
      errorCode: 'INVALID_CODE',
      errorMessage: `Code incorrect. Tentatives restantes : ${challenge.attemptsRemaining}`,
    };
  }
}

/**
 * Timing-safe string equality to prevent side-channel timing analysis.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}

/**
 * Resets all in-memory and database OTP state (for tests).
 */
export function resetOTPState(): void {
  activeChallenges.clear();
  sendHistory.clear();
  try {
    execute('DELETE FROM auth_otp_codes;');
  } catch {}
}
