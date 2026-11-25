// Kazi RFC 6238 TOTP (Time-Based One-Time Password) Authenticator Engine
// Zero external dependencies; uses Node.js built-in crypto HMAC-SHA1 and Base32 (RFC 4648).
// Enables real Authenticator App (Google Authenticator / Authy / 1Password) MFA for Kazi Staff.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(byteLength: number = 20): string {
  return base32Encode(randomBytes(byteLength));
}

export function buildTotpUri(params: {
  secret: string;
  accountName: string;
  issuer?: string;
  digits?: number;
  period?: number;
}): string {
  const issuer = params.issuer || 'Kazi Gabon';
  const digits = params.digits || 6;
  const period = params.period || 30;
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(params.accountName)}`;
  const query = new URLSearchParams({
    secret: params.secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

export function generateTotpCode(
  secretBase32: string,
  timestampMs: number = Date.now(),
  stepSeconds: number = 30,
  digits: number = 6
): string {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);

  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter), 0);

  const hmac = createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

export function verifyTotpCode(
  secretBase32: string,
  submittedCode: string,
  windowSteps: number = 1,
  timestampMs: number = Date.now(),
  stepSeconds: number = 30
): boolean {
  if (!/^\d{6}$/.test(submittedCode)) {
    return false;
  }
  const submittedBuf = Buffer.from(submittedCode, 'utf8');

  for (let w = -windowSteps; w <= windowSteps; w++) {
    const candidate = generateTotpCode(
      secretBase32,
      timestampMs + w * stepSeconds * 1000,
      stepSeconds,
      6
    );
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (
      candidateBuf.length === submittedBuf.length &&
      timingSafeEqual(candidateBuf, submittedBuf)
    ) {
      return true;
    }
  }
  return false;
}
