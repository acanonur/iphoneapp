/**
 * The Hane design system — "Two Inks" — as tokens.
 *
 * *Hane* is Turkish for "household", and the system is built around the people
 * in one. Everyone gets an ink: **coral** for the first person to join,
 * **teal** for the second, then plum, gold, blue and rose. Everything shared
 * sits on a warm neutral ground between them. The system is named for the first
 * two because they also carry the interface — coral acts, teal answers — and
 * the logo is those two inks making one letter: an **h** whose coral stem and
 * teal arch stand like a doorway.
 *
 *  - **Warm ground, soft cards.** Oat paper with white cards floating a step
 *    above it. Things you can touch are rounded; nothing is boxed in by rules.
 *  - **Coral acts, teal answers.** Coral is the primary action; teal is every
 *    secondary highlight. Because people have colours of their own, colour can
 *    carry *who*, which a single accent never could.
 *  - **Meaning has its own colours again.** Green for done, amber for due soon,
 *    red for overdue or destructive. They are never used as decoration.
 *  - **A serif for the headline, a sans for the work.** Fraunces sets titles —
 *    it is what makes the app feel like a household notebook rather than a
 *    dashboard — and DM Sans sets everything you read or tap.
 *  - **Light and dark.** The palette follows the phone's appearance setting,
 *    read once at launch (see `scheme` below).
 */

import { Appearance } from 'react-native';

/**
 * The appearance the app launched in.
 *
 * Read once, at module load, on purpose: every screen builds its styles from
 * these tokens as plain values, so they can be imported anywhere without a hook
 * or a provider. The cost is that flipping the phone between light and dark
 * while the app is open takes effect the next time it launches.
 */
export const scheme: 'light' | 'dark' = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

const light = {
  bg: '#faf6ef',
  /** Cards and inputs — one step above the ground. */
  surface: '#ffffff',
  /** Quiet fills: the tab bar pill, segmented track, pressed states. */
  surfaceAlt: '#f1eadf',
  text: '#231f2b',
  textMuted: '#655e70',
  textFaint: '#787183',

  /** Coral. The primary action, and the first person's ink. */
  accent: '#c9432a',
  /** Teal. The second ink. */
  accent2: '#167a78',
  /** What sits on top of `accent` and `accent2`. */
  onAccent: '#ffffff',

  success: '#2a744a',
  successSoft: '#e2f1e7',
  warning: '#925809',
  warningSoft: '#fbeed4',
  danger: '#bf3030',
  dangerSoft: '#fbe4e1',

  divider: 'rgba(35, 31, 43, 0.14)',
  dividerSoft: 'rgba(35, 31, 43, 0.07)',

  neutral100: '#f6f1e8',
  neutral200: '#ece5d9',
  neutral300: '#ddd5c8',
  neutral400: '#c2bab0',
  neutral500: '#a19aa0',
  neutral600: '#817a88',
  neutral700: '#655e70',
  neutral800: '#453f50',
  neutral900: '#2e2937',

  accent100: '#fdeee8',
  accent200: '#fbdbd0',
  accent300: '#f6bba9',
  accent400: '#ee8f75',
  accent500: '#e2623f',
  accent600: '#c9432a',
  accent700: '#ae3a22',
  accent800: '#862d1b',
  accent900: '#5a2014',

  teal100: '#e1f2f0',
  teal200: '#c3e4e1',
  teal700: '#136865',
  teal800: '#0f4f4d',
} as const;

type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  bg: '#16131c',
  surface: '#211d2a',
  surfaceAlt: '#2b2636',
  text: '#f4efe8',
  textMuted: '#b0a9bb',
  textFaint: '#8a8395',

  accent: '#f0704f',
  accent2: '#4cb7b1',
  onAccent: '#1b1210',

  success: '#6cc48e',
  successSoft: '#1d3327',
  warning: '#e3a94a',
  warningSoft: '#3a2c14',
  danger: '#f07b72',
  dangerSoft: '#3d1f1f',

  divider: 'rgba(244, 239, 232, 0.16)',
  dividerSoft: 'rgba(244, 239, 232, 0.08)',

  // The neutral ramp runs the other way in the dark: 100 is still "the
  // quietest fill" and 900 still "nearly text", so call sites read the same.
  neutral100: '#262231',
  neutral200: '#2f2a3b',
  neutral300: '#3b3549',
  neutral400: '#514a60',
  neutral500: '#746d82',
  neutral600: '#948da1',
  neutral700: '#b0a9bb',
  neutral800: '#cfc9d6',
  neutral900: '#e8e3ea',

  accent100: '#3a211b',
  accent200: '#4d2a21',
  accent300: '#6e392b',
  accent400: '#a34d37',
  accent500: '#d95f41',
  accent600: '#f0704f',
  accent700: '#f6937a',
  accent800: '#fab7a5',
  accent900: '#fddcd2',

  teal100: '#17302f',
  teal200: '#1e4442',
  teal700: '#7bcec9',
  teal800: '#a9e0dc',
};

const palette: Palette = scheme === 'dark' ? dark : light;

export const colors = {
  ...palette,
  /**
   * Member inks, by the order people joined: coral, teal, plum, gold, blue,
   * rose. Friends who exist only on a ledger continue the same sequence.
   */
  members:
    scheme === 'dark'
      ? ['#f0704f', '#4cb7b1', '#b49bf0', '#e3a94a', '#7fb8ee', '#e58bb5']
      : ['#c9432a', '#167a78', '#6b4fb3', '#925809', '#2c6fb0', '#b0457a'],
} as const;

/** The ink for the nth member, wrapping for unusually large households. */
export function memberInk(index: number): string {
  const inks = colors.members;
  return inks[((index % inks.length) + inks.length) % inks.length]!;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  /** Tags, tick boxes, small chips. */
  sm: 8,
  /** Inputs and buttons. */
  md: 14,
  /** Cards. */
  lg: 20,
  pill: 999,
} as const;

/** Hairlines. Sections are separated by space now, rows by a soft line. */
export const rules = {
  section: 1,
  row: 1,
} as const;

/** The one shadow in the system: a card lifting a step off the ground. */
export const elevation = {
  card:
    scheme === 'dark'
      ? {}
      : {
          shadowColor: '#3b2a1a',
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 1,
        },
} as const;

export const fonts = {
  /** Fraunces 600 — screen titles and the big numbers. */
  display: 'Fraunces_600SemiBold',
  /** DM Sans 700 — headings, button labels, anything structural. */
  heading: 'DMSans_700Bold',
  headingSemi: 'DMSans_600SemiBold',
  body: 'DMSans_400Regular',
} as const;

export const typography = {
  /** The screen title, in the serif. */
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: colors.text,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
  },
  /** Card titles and note titles. */
  subheading: {
    fontFamily: fonts.headingSemi,
    fontSize: 16,
    lineHeight: 21,
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
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.textMuted,
  },
  /**
   * Section labels: small, semi-bold and muted, in sentence case. They name a
   * group without shouting over what is in it.
   */
  kicker: {
    fontFamily: fonts.headingSemi,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.1,
    color: colors.textMuted,
  },
} as const;

// ---------------------------------------------------------------------------
// Formatting helpers (they shape words, not pixels)
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

/** Initials for a member avatar. Two letters, upper case. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}
