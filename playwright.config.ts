// Kazi Playwright Browser Verification Config (ARCHITECTURE.md)
// Uses system Chromium/Edge/Chrome channel against the live operational server on port 4173.

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    channel: 'msedge',
    viewport: { width: 1440, height: 900 },
  },
});
