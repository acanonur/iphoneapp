/**
 * The Modernist design system, as tokens.
 *
 * Ported from the Claude Design handoff (`_ds/modernist-…/styles.css`). The
 * character of the system is worth stating, because it decides a lot of small
 * calls further down:
 *
 *  - **A light ground.** Ink on warm paper, not a dark surface.
 *  - **One red.** A single accent carries every emphasis; there is no palette
 *    of semantic colours, so "overdue" and "active" and "primary" all use it.
 *  - **Zero radius.** Nothing is rounded. Not the buttons, not the tick boxes,
 *    not the avatars — those become squares.
 *  - **Rules, not cards.** Structure comes from 2px rules between sections and
 *    1px between rows. Nothing floats on a shadow.
 *  - **Flush left.** Labels, buttons and tab items all align to the same edge;
 *    button icons are pushed to the far side rather than centred with the text.
 *
 * The two household members are the two inks of the system rather than two
 * arbitrary hues: you are ink, the other person is the accent.
 */

export const colors = {
  bg: '#f3f2f2',
  surface: '#eae9e9',
  text: '#201e1d',
  accent: '#ec3013',
  accent2: '#e15b47',

  /**
   * 40% ink. Written out rather than composed at runtime because React Native
   * has no color-mix(), and every rule in the app uses it.
   */
  divider: 'rgba(32, 30, 29, 0.4)',
  /** A lighter rule for rows inside a section, where 40% would shout. */
  dividerSoft: 'rgba(32, 30, 29, 0.16)',

  neutral100: '#f8f4f4',
  neutral200: '#eae7e7',
  neutral300: '#d7d3d3',
  neutral400: '#bab6b6',
  neutral500: '#9b9797',
  neutral600: '#7d7979',
  neutral700: '#605d5d',
  neutral800: '#444141',
  neutral900: '#2d2b2b',

  accent100: '#fff2ef',
  accent200: '#ffe0d9',
  accent300: '#ffc4b8',
  accent400: '#ff9783',
  accent500: '#ff563c',
  accent600: '#dd2b0f',
  accent700: '#ae1800',
  accent800: '#7c1405',
  accent900: '#4d170e',

  /** Muted body text — the system's `--color-neutral-700`. */
  textMuted: '#605d5d',
  textFaint: '#7d7979',

  /**
   * Member inks. First member is ink, second is the accent — Modernist is a
   * mono red palette, so a third or fourth person borrows from the neutral
   * ramp rather than inventing new hues.
   */
  members: ['#201e1d', '#ec3013', '#605d5d', '#ae1800', '#9b9797', '#7c1405'],
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Zero, everywhere. Kept as a named export so the intent is explicit at use sites. */
export const radius = {
  sm: 0,
  md: 0,
  lg: 0,
  pill: 0,
} as const;

/** Rule weights: 2px separates sections, 1px separates rows within one. */
export const rules = {
  section: 2,
  row: 1,
} as const;

export const fonts = {
  /** Archivo 800 — every heading, and anything that has to read as a label. */
  heading: 'Archivo_800ExtraBold',
  headingSemi: 'Archivo_600SemiBold',
  body: 'Archivo_400Regular',
} as const;

export const typography = {
  /** h3 in the system: 25px/1.12, -0.015em. The screen title. */
  title: {
    fontFamily: fonts.heading,
    fontSize: 25,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: colors.text,
  },
  /** h5. */
  heading: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 21,
    color: colors.text,
  },
  /** Card titles and note titles. */
  subheading: {
    fontFamily: fonts.headingSemi,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  small: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  tiny: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
  /**
   * The system's h6: uppercase, tracked out. Used for day headings and section
   * labels, which is what gives the screens their ruled-ledger feel.
   */
  kicker: {
    fontFamily: fonts.heading,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.text,
  },
} as const;

// ---------------------------------------------------------------------------
// Formatting helpers (unchanged by the redesign — they shape words, not pixels)
// ---------------------------------------------------------------------------

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

/** "Tue 8 Sep" — the secondary date shown beside a day heading. */
export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function shortDateTime(ms: number): string {
  return `${relativeDay(ms)}, ${clockTime(ms)}`;
}

/** Initials for a member square. Two letters, upper case. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}
