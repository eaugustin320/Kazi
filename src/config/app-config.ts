// Kazi Typed Country and Theme Configuration Resolver
// Complies with THEMING_AND_COUNTRIES.md, VERSIONING.md, and config/

import registryJson from '../../config/registry.json';
import gaCountryJson from '../../config/countries/GA-1.0.0.json';
import designSystemJson from '../../config/design-system.json';
import gabonPremiumJson from '../../config/themes/gabon-premium-1.0.0.json';
import forestPremiumJson from '../../config/themes/forest-premium-1.0.0.json';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  controlBorder: string;
  primary: string;
  onPrimary: string;
  primaryHover: string;
  accent: string;
  onAccent: string;
  infoSurface: string;
  infoText: string;
  successSurface: string;
  successText: string;
  warningSurface: string;
  warningText: string;
  dangerSurface: string;
  dangerText: string;
  focusRing: string;
  focusRingOnDark: string;
  sidebar: string;
  onSidebar: string;
}

export interface ThemeConfig {
  schemaVersion: number;
  themeId: string;
  themeVersion: string;
  mode: string;
  notes: string;
  colors: ThemeColors;
}

export interface CountryConfig {
  schemaVersion: number;
  countryCode: string;
  configVersion: string;
  launchStatus: string;
  productionEnabled: boolean;
  defaultLocale: string;
  supportedLocales: string[];
  currency: {
    code: string;
    displayLabel: string;
    minorUnitExponent: number;
  };
  timezone: string;
  phone: {
    region: string;
    callingPrefix: string;
  };
  serviceAreas: Array<{
    code: string;
    label: string;
    enabledForDesign: boolean;
    enabledForProduction: boolean;
  }>;
  defaultThemeId: string;
  fallbackThemeId: string;
}

export const REGISTERED_THEMES: Record<string, ThemeConfig> = {
  'gabon-premium@1.0.0': gabonPremiumJson as ThemeConfig,
  'forest-premium@1.0.0': forestPremiumJson as ThemeConfig,
};

export const REGISTERED_COUNTRIES: Record<string, CountryConfig> = {
  'GA@1.0.0': gaCountryJson as CountryConfig,
};

export const DESIGN_SYSTEM_CONSTANTS = designSystemJson;

/**
 * Resolves the active country configuration and its associated theme.
 * Enforces safe fallback to Gabon baseline if an unconfigured country is requested.
 */
export function resolveCountryConfig(countryCode: string = 'GA'): {
  country: CountryConfig;
  theme: ThemeConfig;
} {
  const activeVersion = registryJson.activeCountryConfig[countryCode as keyof typeof registryJson.activeCountryConfig];
  const country = (activeVersion && REGISTERED_COUNTRIES[activeVersion]) || REGISTERED_COUNTRIES['GA@1.0.0'];

  const themeId = country.defaultThemeId;
  const theme = REGISTERED_THEMES[themeId] || REGISTERED_THEMES['gabon-premium@1.0.0'];

  return { country, theme };
}

/**
 * Validates whether a given theme ID is registered and valid.
 */
export function isRegisteredTheme(themeId: string): boolean {
  return themeId in REGISTERED_THEMES;
}
