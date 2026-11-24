// Kazi Password Hashing & Crypto Utilities
// Uses Node.js crypto PBKDF2 with unique salts and timing-safe comparison

import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha512';

/**
 * Hashes a plain-text password with a randomly generated salt.
 * Returns salt:hash format.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a plain-text password against a stored salt:hash string.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;

  const hashToVerify = pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  const originalBuffer = Buffer.from(originalHash, 'hex');
  const verifyBuffer = Buffer.from(hashToVerify, 'hex');

  if (originalBuffer.length !== verifyBuffer.length) return false;
  return timingSafeEqual(originalBuffer, verifyBuffer);
}
