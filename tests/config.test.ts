// Unit tests for Kazi Configuration & Theming Resolution
import { describe, it, expect } from 'vitest';
import {
  resolveCountryConfig,
  isRegisteredTheme,
  REGISTERED_THEMES,
} from '../src/config/app-config';

describe('Kazi Configuration Resolver', () => {
  it('resolves Gabon (GA) as launch country baseline', () => {
    const { country, theme } = resolveCountryConfig('GA');

    expect(country.countryCode).toBe('GA');
    expect(country.currency.code).toBe('XAF');
    expect(country.currency.minorUnitExponent).toBe(0);
    expect(country.timezone).toBe('Africa/Libreville');
    expect(country.phone.callingPrefix).toBe('+241');
    expect(country.defaultLocale).toBe('fr-GA');
    expect(theme.themeId).toBe('gabon-premium@1.0.0');
  });

  it('safely falls back to Gabon baseline if an unconfigured country code is requested', () => {
    const { country, theme } = resolveCountryConfig('XX');
    expect(country.countryCode).toBe('GA');
    expect(theme.themeId).toBe('gabon-premium@1.0.0');
  });

  it('validates registered immutable themes', () => {
    expect(isRegisteredTheme('gabon-premium@1.0.0')).toBe(true);
    expect(isRegisteredTheme('forest-premium@1.0.0')).toBe(true);
    expect(isRegisteredTheme('unregistered-theme@2.0.0')).toBe(false);
  });

  it('preserves all required semantic tokens in theme presets', () => {
    const requiredTokens = [
      'background',
      'surface',
      'text',
      'textMuted',
      'border',
      'controlBorder',
      'primary',
      'onPrimary',
      'primaryHover',
      'accent',
      'onAccent',
      'infoSurface',
      'infoText',
      'successSurface',
      'successText',
      'warningSurface',
      'warningText',
      'dangerSurface',
      'dangerText',
      'focusRing',
      'focusRingOnDark',
      'sidebar',
      'onSidebar',
    ];

    for (const themeId of ['gabon-premium@1.0.0', 'forest-premium@1.0.0']) {
      const theme = REGISTERED_THEMES[themeId];
      expect(theme).toBeDefined();
      for (const token of requiredTokens) {
        expect(theme.colors[token as keyof typeof theme.colors]).toBeDefined();
        expect(theme.colors[token as keyof typeof theme.colors]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});
