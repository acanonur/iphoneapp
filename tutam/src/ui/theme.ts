/**
 * The Tutam design system, as tokens.
 *
 * *Tutam* is Turkish for "a pinch" — the smallest measure in any kitchen, and
 * the one no recipe can do without. The look follows from the table rather
 * than from photography: a cream ground, white cards, and colour that comes
 * from the food. Every recipe has a tile in the colour of its category —
 * saffron for soups, leaf green for salads, aubergine for cocktails — with a
 * drawn glyph instead of a photograph, so a recipe you typed in yourself looks
 * as finished as one that shipped with the app.
 *
 *  - **Bottle green acts.** One brand colour for every primary action.
 *  - **Saffron marks.** Favourites, timers, the thing that is happening now.
 *  - **Bricolage Grotesque for titles, Inter for reading.** The display face
 *    has enough character to carry a screen with no imagery; the text face
 *    stays out of the way of quantities and fractions.
 *  - **Light and dark**, read once at launch (see `scheme`).
 */

import { Appearance } from 'react-native';
import type { Category } from '../model/types';

/** The appearance the app launched in. A change applies at the next launch. */
export const scheme: 'light' | 'dark' = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
const dark = scheme === 'dark';

export const colors = {
  bg: dark ? '#111a15' : '#fbf7ee',
  surface: dark ? '#1a2620' : '#ffffff',
  surfaceAlt: dark ? '#24332b' : '#f1ebdc',
  text: dark ? '#f3efe4' : '#1c2a22',
  textMuted: dark ? '#a9b5ac' : '#58665d',
  textFaint: dark ? '#7f8c83' : '#7b877f',

  /** Bottle green: the primary action. */
  accent: dark ? '#6fc496' : '#24573f',
  onAccent: dark ? '#0e1a13' : '#ffffff',
  accentSoft: dark ? '#1d3a2b' : '#e1efe6',
  accentText: dark ? '#8fd6ae' : '#1f4d38',

  /** Saffron: favourites, timers, "now". */
  mark: dark ? '#f0b84a' : '#c98a0b',
  markSoft: dark ? '#3a2e14' : '#fbefd2',
  onMark: '#1c1606',

  success: dark ? '#6cc48e' : '#2a744a',
  danger: dark ? '#f07b72' : '#b93a2e',
  dangerSoft: dark ? '#3d1f1f' : '#fbe4e1',

  divider: dark ? 'rgba(243, 239, 228, 0.16)' : 'rgba(28, 42, 34, 0.14)',
  dividerSoft: dark ? 'rgba(243, 239, 228, 0.08)' : 'rgba(28, 42, 34, 0.07)',
} as const;

/**
 * A tile colour per category: `bg` fills the tile, `ink` draws the glyph.
 * Chosen from the food itself, and checked so the glyph reads on the fill in
 * both themes.
 */
export const categoryColors: Record<Category, { bg: string; ink: string }> = dark
  ? {
      breakfast: { bg: '#4a3c12', ink: '#f6d36b' },
      soup: { bg: '#4d3210', ink: '#f3b257' },
      salad: { bg: '#1f3f24', ink: '#8fd596' },
      main: { bg: '#4b2318', ink: '#f29a7d' },
      side: { bg: '#3b3a1c', ink: '#d6d07a' },
      dessert: { bg: '#4a2233', ink: '#f2a3c0' },
      baking: { bg: '#45321c', ink: '#e6bf88' },
      coffee: { bg: '#3a2a20', ink: '#d9b08c' },
      tea: { bg: '#48300f', ink: '#f0b35a' },
      cocktail: { bg: '#3a2247', ink: '#cfa3ea' },
      mocktail: { bg: '#2a401b', ink: '#b5dc7c' },
      cold: { bg: '#17394a', ink: '#84c9e8' },
      hot: { bg: '#472a1c', ink: '#eaa27b' },
    }
  : {
      breakfast: { bg: '#fbe9a8', ink: '#6b5200' },
      soup: { bg: '#f8d9a0', ink: '#7a4a06' },
      salad: { bg: '#cfe8c6', ink: '#1f5a2a' },
      main: { bg: '#f6cdbd', ink: '#8a2f17' },
      side: { bg: '#e6e3b0', ink: '#55500f' },
      dessert: { bg: '#f7cfdd', ink: '#8a2550' },
      baking: { bg: '#ecd9b8', ink: '#6a4514' },
      coffee: { bg: '#e2d0c0', ink: '#5a3a22' },
      tea: { bg: '#f6d8a3', ink: '#7a4d05' },
      cocktail: { bg: '#e0cdee', ink: '#5a2a7a' },
      mocktail: { bg: '#d9ebb5', ink: '#3f5a10' },
      cold: { bg: '#c9e4f1', ink: '#16506b' },
      hot: { bg: '#f1d2c2', ink: '#7a3a1c' },
    };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const elevation = {
  card: dark
    ? {}
    : {
        shadowColor: '#3a2f14',
        shadowOpacity: 0.07,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      },
} as const;

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  bold: 'Inter_700Bold',
  semi: 'Inter_600SemiBold',
  body: 'Inter_400Regular',
} as const;

export const type = {
  /** The screen title. */
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.6, color: colors.text },
  /** A recipe's name on its own page. */
  hero: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.4, color: colors.text },
  heading: { fontFamily: fonts.displaySemi, fontSize: 20, lineHeight: 24, letterSpacing: -0.2, color: colors.text },
  subheading: { fontFamily: fonts.semi, fontSize: 16, lineHeight: 21, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  label: { fontFamily: fonts.semi, fontSize: 13, lineHeight: 17, color: colors.textMuted },
  /** Step text in cook mode: read from arm's length, with flour on your hands. */
  cook: { fontFamily: fonts.body, fontSize: 24, lineHeight: 34, color: colors.text },
} as const;
