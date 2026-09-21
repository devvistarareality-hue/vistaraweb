export const COLORS = {
  // Palette (shared with the Labour ledger design)
  blue:       '#A2D2FF',
  blueStrong: 'var(--accent)',
  blueSoft:   'var(--accent-soft)',
  green:      '#A4F5A6',
  greenStrong:'var(--success)',
  greenSoft:  'var(--success-soft)',
  peach:      '#FFD89D',
  peachStrong:'var(--warning)',
  peachSoft:  'var(--warning-soft)',
  grey:       'var(--surface-3)',
  ink:        'var(--text)',

  // Backgrounds
  screenBg:  'var(--surface-2)',
  cardBg:    '#FFFFFF',

  // Text
  textPrimary:   'var(--text)',
  textSecondary: 'var(--muted)',

  // Brand
  navy:       'var(--text)',
  powderBlue: '#A2D2FF',
  gold:       'var(--warning-2)',

  // Interactive
  link: 'var(--accent)',

  // Semantic
  error:   'var(--danger)',
  success: 'var(--success)',

  // Legacy aliases
  primary:    'var(--text)',
  accent:     'var(--warning-2)',
  secondary:  'var(--accent)',
  white:      '#FFFFFF',
  background: 'var(--surface-2)',
  text:       'var(--text)',
  lightGray:  'var(--border)',
};

export const CARD_SHADOW = '0 1px 2px rgba(var(--ink-rgb),0.04), 0 8px 24px rgba(60,90,130,0.07)';

export const MODULE_ACCENT = {
  HR:          { bg: 'var(--accent-soft)', icon: 'var(--accent)' },
  Sales:       { bg: 'var(--warning-soft)', icon: 'var(--warning-2)' },
  Execution:   { bg: 'var(--success-soft)', icon: 'var(--success)' },
  Purchase:    { bg: 'var(--warning-soft)', icon: 'var(--warning-2)' },
  Land:        { bg: 'var(--accent-soft)', icon: 'var(--accent-deep)' },
  'Accounts & Finance': { bg: 'var(--success-soft)', icon: 'var(--success)' },
  AR:          { bg: 'var(--accent-soft)', icon: 'var(--accent)' },
  'Club 1000': { bg: 'var(--green)', icon: 'var(--success)' },
  Reports:     { bg: 'var(--success-soft)', icon: 'var(--success)' },
  Settings:    { bg: 'var(--accent-soft)', icon: 'var(--accent-deep)' },
  Admin:       { bg: 'var(--accent-soft)', icon: 'var(--accent)' },
  Projects:    { bg: 'var(--success-soft)', icon: 'var(--success)' },
  Sites:       { bg: 'var(--success-soft)', icon: 'var(--success)' },
  Contractors: { bg: 'var(--warning-soft)', icon: 'var(--warning-2)' },
  Inventory:   { bg: 'var(--warning-soft)', icon: 'var(--warning-2)' },
  Payments:    { bg: 'var(--success-soft)', icon: 'var(--success)' },
  Clients:     { bg: 'var(--accent-soft)', icon: 'var(--accent)' },
  'Channel Partner': { bg: 'var(--danger-soft)', icon: 'var(--danger)' },
};
