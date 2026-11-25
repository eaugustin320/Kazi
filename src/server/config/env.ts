// Kazi Server Environment & Security Mode Resolver
// Fail-closed: development/test helpers are active ONLY when explicitly in 'development' or 'test'.
// If NODE_ENV is unset (without --dev), 'staging', or 'production', all debug/test bypasses are disabled.

export function isDevOrTestEnvironment(): boolean {
  const env = process.env.NODE_ENV as string | undefined;
  if (env === 'production' || env === 'staging') {
    return false;
  }
  return (
    env === 'development' ||
    env === 'test' ||
    Boolean(process.env.VITEST) ||
    process.argv.includes('--dev')
  );
}

export function isSecureCookieEnvironment(): boolean {
  return !isDevOrTestEnvironment();
}
