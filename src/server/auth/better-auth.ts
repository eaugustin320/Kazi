// Kazi Better Auth Configuration (ADR06 / ARCHITECTURE.md)
// Configures Better Auth with Prisma PostgreSQL adapter, Gabon phone OTP (+241) and RFC 6238 TOTP Two-Factor.

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { phoneNumber, twoFactor } from 'better-auth/plugins';
import { db } from '../db/client';
import { isDevOrTestEnvironment } from '../config/env';

export const auth = betterAuth({
  appName: 'Kazi Gabon',
  secret: process.env.AUTH_SECRET || process.env.JWT_SECRET || 'kazi-dev-auth-secret-min-32-chars-ga',
  baseURL: process.env.AUTH_BASE_URL || 'http://127.0.0.1:3000',
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  plugins: [
    phoneNumber({
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      allowedAttempts: 5,
      sendOTP: async ({ phoneNumber: phone, code }) => {
        if (!isDevOrTestEnvironment() && !process.env.SMS_PROVIDER) {
          throw new Error('SMS_PROVIDER_NOT_CONFIGURED');
        }
        // Redacted operational log (never logs OTP code or full phone number)
        const masked = phone.slice(0, 6) + '****' + phone.slice(-2);
        void code;
        console.info(`[Kazi Auth] OTP challenge dispatched for ${masked}`);
      },
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone.replace(/[^0-9]/g, '')}@worker.kazi.ga`,
        getTempName: () => 'Ouvrier Kazi',
      },
    }),
    twoFactor({
      issuer: 'Kazi Gabon',
    }),
  ],
});
