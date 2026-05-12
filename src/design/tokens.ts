export const P = {
  bg: '#1E2547',
  text: '#F7F2EA',
  muted: '#B8B6C8',
  surface: '#2D3460',
  surfaceHi: '#3A4278',
  surfaceCream: '#F7F2EA',
  border: 'rgba(247,242,234,0.18)',
  primary: '#FFD966',
  primaryDark: '#D4AF37',
  primaryGlow: 'rgba(255,217,102,0.35)',
  accent: '#F5A623',
  accentHot: '#FF6B47',
  green: '#5EE0A8',
  star: '#FFE066',
  purple: '#8B7ED8',
  blue: '#6FA9E8',
} as const;

export const spacing = {
  '2xs': 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 20,
  card: 14,
  sheet: 20,
  full: 9999,
} as const;

export const touch = {
  child: 48,
  parent: 44,
  cta: 56,
} as const;

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 8,
  },
  glow: {
    shadowColor: P.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;
