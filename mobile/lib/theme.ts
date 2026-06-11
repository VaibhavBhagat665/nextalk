// ══════════════════════════════════════════════════════════════
// NexTalk Mobile — Complete Design System (Taupe Edition)
// Mirrors the web CSS variables exactly
// ══════════════════════════════════════════════════════════════

export interface ThemeColors {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  bgSurface: string;
  bgHover: string;
  bgActive: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;

  // Borders
  borderPrimary: string;
  borderSecondary: string;
  borderGlow: string;

  // Accents
  accentGold: string;
  accentBrass: string;
  accentGoldDim: string;
  accentCyan: string;
  accentEmerald: string;
  accentRose: string;
  accentAmber: string;
  accentPurple: string;

  // Shadows (used as overlay colors on RN)
  shadowColor: string;
  glowColor: string;

  // Status
  statusOnline: string;
  statusOffline: string;
  statusDnd: string;

  // Misc
  cardBg: string;
  inputBg: string;
  shimmerBase: string;
  shimmerHighlight: string;
}

export const darkTheme: ThemeColors = {
  bgPrimary: '#1A1714',
  bgSecondary: '#231F1B',
  bgTertiary: '#2C2722',
  bgElevated: '#342E28',
  bgSurface: '#1E1B17',
  bgHover: 'rgba(139, 125, 107, 0.08)',
  bgActive: 'rgba(139, 125, 107, 0.14)',

  textPrimary: '#F2EDE7',
  textSecondary: '#C8BFAC',
  textTertiary: '#8C8070',
  textMuted: '#5A5045',

  borderPrimary: 'rgba(139, 125, 107, 0.14)',
  borderSecondary: 'rgba(139, 125, 107, 0.07)',
  borderGlow: 'rgba(139, 125, 107, 0.35)',

  accentGold: '#8B7D6B',
  accentBrass: '#A6967E',
  accentGoldDim: 'rgba(139, 125, 107, 0.12)',
  accentCyan: '#7BAFB8',
  accentEmerald: '#7DBF96',
  accentRose: '#C48A8A',
  accentAmber: '#C4A87A',
  accentPurple: '#A885F7',

  shadowColor: 'rgba(26, 23, 20, 0.55)',
  glowColor: 'rgba(139, 125, 107, 0.12)',

  statusOnline: '#7DBF96',
  statusOffline: '#5A5045',
  statusDnd: '#C48A8A',

  cardBg: '#231F1B',
  inputBg: '#2C2722',
  shimmerBase: '#2C2722',
  shimmerHighlight: '#342E28',
};

export const lightTheme: ThemeColors = {
  bgPrimary: '#F5F0E8',
  bgSecondary: '#EDE7DD',
  bgTertiary: '#E2DAD0',
  bgElevated: '#FDFAF5',
  bgSurface: '#F9F5EE',
  bgHover: 'rgba(107, 95, 78, 0.06)',
  bgActive: 'rgba(107, 95, 78, 0.11)',

  textPrimary: '#2C2420',
  textSecondary: '#4A3F36',
  textTertiary: '#7A6E62',
  textMuted: '#A89E94',

  borderPrimary: 'rgba(44, 36, 32, 0.09)',
  borderSecondary: 'rgba(44, 36, 32, 0.05)',
  borderGlow: 'rgba(107, 95, 78, 0.30)',

  accentGold: '#6B5F4E',
  accentBrass: '#7E7060',
  accentGoldDim: 'rgba(107, 95, 78, 0.10)',
  accentCyan: '#4A949E',
  accentEmerald: '#4FAA74',
  accentRose: '#B0686E',
  accentAmber: '#B09060',
  accentPurple: '#9B6EE0',

  shadowColor: 'rgba(44, 36, 32, 0.10)',
  glowColor: 'rgba(107, 95, 78, 0.08)',

  statusOnline: '#4FAA74',
  statusOffline: '#A89E94',
  statusDnd: '#B0686E',

  cardBg: '#FDFAF5',
  inputBg: '#EDE7DD',
  shimmerBase: '#E2DAD0',
  shimmerHighlight: '#FDFAF5',
};

// ── Spacing & Radius tokens ──
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  '2xl': 28,
  full: 9999,
} as const;

// ── Typography ──
export const typography = {
  heading: {
    fontFamily: 'Fredoka-Bold',
    fontSize: 28,
    lineHeight: 34,
  },
  headingSm: {
    fontFamily: 'Fredoka-SemiBold',
    fontSize: 20,
    lineHeight: 26,
  },
  body: {
    fontFamily: 'ComicNeue-Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  bodyBold: {
    fontFamily: 'ComicNeue-Bold',
    fontSize: 16,
    lineHeight: 22,
  },
  caption: {
    fontFamily: 'ComicNeue-Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  captionBold: {
    fontFamily: 'ComicNeue-Bold',
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    fontFamily: 'Fredoka-Medium',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
  },
  mono: {
    fontFamily: 'JetBrainsMono-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
} as const;
