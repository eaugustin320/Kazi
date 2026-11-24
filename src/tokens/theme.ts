// Kazi Semantic Token Resolver & Design System Definition
// Complies with THEMING_AND_COUNTRIES.md and DESIGN.md

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

export interface ThemeDefinition {
  schemaVersion: number;
  themeId: string;
  themeVersion: string;
  mode: 'light' | 'dark';
  notes: string;
  colors: ThemeColors;
}

export const GABON_PREMIUM_THEME: ThemeDefinition = {
  schemaVersion: 1,
  themeId: 'gabon-premium@1.0.0',
  themeVersion: '1.0.0',
  mode: 'light',
  notes: 'Proposed Gabon launch design; deep green actions, warm surfaces, restrained gold accents.',
  colors: {
    background: '#F7F7F2',
    surface: '#FFFFFF',
    text: '#17251D',
    textMuted: '#53645D',
    border: '#DCE4DE',
    controlBorder: '#6F7F75',
    primary: '#0B5D3B',
    onPrimary: '#FFFFFF',
    primaryHover: '#08482E',
    accent: '#F2C94C',
    onAccent: '#27351C',
    infoSurface: '#EAF2FF',
    infoText: '#174EA6',
    successSurface: '#E8F4EC',
    successText: '#155C34',
    warningSurface: '#FFF4D0',
    warningText: '#744300',
    dangerSurface: '#FDECEE',
    dangerText: '#9B1C1C',
    focusRing: '#174EA6',
    focusRingOnDark: '#FFD166',
    sidebar: '#123E32',
    onSidebar: '#FFFFFF',
  },
};

export const FOREST_PREMIUM_THEME: ThemeDefinition = {
  schemaVersion: 1,
  themeId: 'forest-premium@1.0.0',
  themeVersion: '1.0.0',
  mode: 'light',
  notes: 'Previous forest and orange design direction retained as comparison preset.',
  colors: {
    background: '#F7F7F2',
    surface: '#FFFFFF',
    text: '#17251D',
    textMuted: '#53645D',
    border: '#DCE4DE',
    controlBorder: '#6F7F75',
    primary: '#F27B43',
    onPrimary: '#17251D',
    primaryHover: '#E96B33',
    accent: '#123E32',
    onAccent: '#FFFFFF',
    infoSurface: '#EAF2FF',
    infoText: '#174EA6',
    successSurface: '#E8F4EC',
    successText: '#155C34',
    warningSurface: '#FFF4D0',
    warningText: '#744300',
    dangerSurface: '#FDECEE',
    dangerText: '#9B1C1C',
    focusRing: '#174EA6',
    focusRingOnDark: '#FFD166',
    sidebar: '#123E32',
    onSidebar: '#FFFFFF',
  },
};

export const REGISTERED_THEMES: Record<string, ThemeDefinition> = {
  'gabon-premium@1.0.0': GABON_PREMIUM_THEME,
  'forest-premium@1.0.0': FOREST_PREMIUM_THEME,
};

export const GABON_COUNTRY_CONFIG = {
  schemaVersion: 1,
  countryCode: 'GA',
  countryName: 'Gabon',
  configVersion: '1.0.0',
  launchStatus: 'DESIGN_BASELINE',
  productionEnabled: false,
  defaultLocale: 'fr-GA',
  supportedLocales: ['fr-GA'],
  currency: {
    code: 'XAF',
    displayLabel: 'FCFA',
    minorUnitExponent: 0,
  },
  timezone: 'Africa/Libreville',
  phone: {
    region: 'GA',
    callingPrefix: '+241',
  },
  serviceAreas: [
    { code: 'libreville', label: 'Libreville', enabledForDesign: true, enabledForProduction: false },
    { code: 'akanda', label: 'Akanda', enabledForDesign: true, enabledForProduction: false },
    { code: 'owendo', label: 'Owendo', enabledForDesign: true, enabledForProduction: false },
  ],
  defaultThemeId: 'gabon-premium@1.0.0',
  fallbackThemeId: 'gabon-premium@1.0.0',
};

// WCAG 2.2 AA Contrast Calculations
export function getLuminance(hex: string): number {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const transform = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export interface ContrastCheckResult {
  fgKey: keyof ThemeColors;
  bgKey: keyof ThemeColors;
  fgColor: string;
  bgColor: string;
  ratio: number;
  minRequired: number;
  pass: boolean;
}

export function checkThemeContrasts(theme: ThemeDefinition): ContrastCheckResult[] {
  const pairs: Array<{ fg: keyof ThemeColors; bg: keyof ThemeColors; min: number }> = [
    { fg: 'text', bg: 'background', min: 4.5 },
    { fg: 'text', bg: 'surface', min: 4.5 },
    { fg: 'textMuted', bg: 'background', min: 4.5 },
    { fg: 'textMuted', bg: 'surface', min: 4.5 },
    { fg: 'onPrimary', bg: 'primary', min: 4.5 },
    { fg: 'onPrimary', bg: 'primaryHover', min: 4.5 },
    { fg: 'onAccent', bg: 'accent', min: 4.5 },
    { fg: 'onSidebar', bg: 'sidebar', min: 4.5 },
    { fg: 'infoText', bg: 'infoSurface', min: 4.5 },
    { fg: 'successText', bg: 'successSurface', min: 4.5 },
    { fg: 'warningText', bg: 'warningSurface', min: 4.5 },
    { fg: 'dangerText', bg: 'dangerSurface', min: 4.5 },
    { fg: 'controlBorder', bg: 'surface', min: 3.0 },
    { fg: 'controlBorder', bg: 'background', min: 3.0 },
    { fg: 'focusRing', bg: 'surface', min: 3.0 },
    { fg: 'focusRing', bg: 'background', min: 3.0 },
    { fg: 'focusRingOnDark', bg: 'sidebar', min: 3.0 },
  ];

  return pairs.map(({ fg, bg, min }) => {
    const fgColor = theme.colors[fg];
    const bgColor = theme.colors[bg];
    const ratio = getContrastRatio(fgColor, bgColor);
    return {
      fgKey: fg,
      bgKey: bg,
      fgColor,
      bgColor,
      ratio,
      minRequired: min,
      pass: ratio >= min,
    };
  });
}

export function applyThemeToDOM(theme: ThemeDefinition, rootElement: HTMLElement = document.documentElement): void {
  const c = theme.colors;
  rootElement.style.setProperty('--color-background', c.background);
  rootElement.style.setProperty('--color-surface', c.surface);
  rootElement.style.setProperty('--color-text', c.text);
  rootElement.style.setProperty('--color-text-muted', c.textMuted);
  rootElement.style.setProperty('--color-border', c.border);
  rootElement.style.setProperty('--color-control-border', c.controlBorder);
  rootElement.style.setProperty('--color-primary', c.primary);
  rootElement.style.setProperty('--color-on-primary', c.onPrimary);
  rootElement.style.setProperty('--color-primary-hover', c.primaryHover);
  rootElement.style.setProperty('--color-accent', c.accent);
  rootElement.style.setProperty('--color-on-accent', c.onAccent);
  rootElement.style.setProperty('--color-info-surface', c.infoSurface);
  rootElement.style.setProperty('--color-info-text', c.infoText);
  rootElement.style.setProperty('--color-success-surface', c.successSurface);
  rootElement.style.setProperty('--color-success-text', c.successText);
  rootElement.style.setProperty('--color-warning-surface', c.warningSurface);
  rootElement.style.setProperty('--color-warning-text', c.warningText);
  rootElement.style.setProperty('--color-danger-surface', c.dangerSurface);
  rootElement.style.setProperty('--color-danger-text', c.dangerText);
  rootElement.style.setProperty('--color-focus-ring', c.focusRing);
  rootElement.style.setProperty('--color-focus-ring-on-dark', c.focusRingOnDark);
  rootElement.style.setProperty('--color-sidebar', c.sidebar);
  rootElement.style.setProperty('--color-on-sidebar', c.onSidebar);
}
