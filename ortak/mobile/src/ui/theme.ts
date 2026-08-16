/**
 * One dark palette, used everywhere.
 *
 * Fixed rather than following the system: the app is mostly used one-handed in
 * a shop or in bed, and a single well-tuned dark scheme keeps every screen
 * consistent without doubling the styling work.
 */

export const colors = {
  bg: '#0F1117',
  surface: '#171A22',
  surfaceRaised: '#1F2430',
  border: '#2A3040',

  text: '#ECEFF6',
  textMuted: '#9AA2B5',
  textFaint: '#6B7387',

  accent: '#6C8AE4',
  accentSoft: '#2A3352',
  success: '#4FB477',
  warning: '#E0A85C',
  danger: '#E4796C',

  /** Distinct hues for the two (or more) members. */
  members: ['#6C8AE4', '#E4796C', '#4FB477', '#C87DD6', '#E0A85C', '#5BB8C4'],
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  subheading: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text },
  small: { fontSize: 13, fontWeight: '400' as const, color: colors.textMuted },
  tiny: { fontSize: 11, fontWeight: '500' as const, color: colors.textFaint },
} as const;

/** Formats a timestamp the way a person would say it. */
export function relativeDay(ms: number, now = Date.now()): string {
  const day = 24 * 3600_000;
  const startOf = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const diff = Math.round((startOf(ms) - startOf(now)) / day);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) {
    return new Date(ms).toLocaleDateString(undefined, { weekday: 'long' });
  }
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: new Date(ms).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
  });
}

export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function shortDateTime(ms: number): string {
  return `${relativeDay(ms)}, ${clockTime(ms)}`;
}

/** Initials for an avatar bubble. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}
