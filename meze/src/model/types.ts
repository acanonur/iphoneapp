/**
 * What a recipe is.
 *
 * One shape covers a pot of soup and a Negroni, because the things a cook and
 * a bartender need from a recipe are the same: what goes in, how much, in what
 * order, and how long to wait. The differences — a glass instead of a pan,
 * centilitres instead of grams — are fields, not a second model.
 *
 * Text comes in two forms. The starter recipes that ship with the app are
 * written in all three languages, so their text is a `{ en, tr, de }` object.
 * A recipe you write yourself is written once, in whatever language you cook
 * in, so its text is a plain string. `Text` is either, and `localise()` in
 * `logic/text.ts` turns both into something to show.
 */

export const LANGS = ['en', 'tr', 'de'] as const;
export type Lang = (typeof LANGS)[number];

export type Localised = Record<Lang, string>;
export type Text = string | Localised;

export type Kind = 'food' | 'drink';

export const FOOD_CATEGORIES = ['breakfast', 'soup', 'salad', 'main', 'side', 'dessert', 'baking'] as const;
export const DRINK_CATEGORIES = ['coffee', 'tea', 'cocktail', 'mocktail', 'cold', 'hot'] as const;
export const CATEGORIES = [...FOOD_CATEGORIES, ...DRINK_CATEGORIES] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Units a quantity can be written in.
 *
 * Weight and volume units convert between metric and US; the rest are counts
 * and are only ever scaled.
 */
export const UNITS = [
  // weight
  'g', 'kg', 'oz', 'lb',
  // volume
  'ml', 'cl', 'l', 'tsp', 'tbsp', 'cup', 'floz',
  // counts
  'piece', 'clove', 'slice', 'bunch', 'sprig', 'leaf', 'pinch', 'dash', 'can', 'stick',
] as const;
export type Unit = (typeof UNITS)[number];

export interface Ingredient {
  /** Null for "to taste" — salt, a garnish, ice. */
  qty: number | null;
  unit: Unit | null;
  name: Text;
  /** "finely chopped", "at room temperature". */
  note?: Text;
}

export interface Step {
  text: Text;
  /** When the step is mostly waiting, how long — it becomes a timer in cook mode. */
  timerMinutes?: number;
}

export type Glass = 'rocks' | 'highball' | 'coupe' | 'wine' | 'flute' | 'mug' | 'cup' | 'tea' | 'shot';

export interface Recipe {
  id: string;
  kind: Kind;
  category: Category;
  title: Text;
  /** One or two sentences: what it is and why you would make it. */
  summary: Text;
  /** Portions for food, glasses for drinks. */
  servings: number;
  /** Hands-on time. */
  prepMinutes: number;
  /** Time on the heat, in the oven, chilling or steeping. Zero for most drinks. */
  cookMinutes: number;
  /** 1 anyone, 2 some practice, 3 a project. */
  difficulty: 1 | 2 | 3;
  ingredients: Ingredient[];
  steps: Step[];
  /** A tip, a variation, how it keeps. */
  notes?: Text;
  /** Lower-case English keys: "vegetarian", "vegan", "quick", "gluten-free", "turkish", "german". */
  tags: string[];

  // Drinks only.
  glass?: Glass;
  alcoholic?: boolean;

  /** Where it came from: a URL for an imported recipe, a name for a family one. */
  source?: string;
  /** True for the recipes that ship with the app. */
  starter?: boolean;
  favourite?: boolean;
  createdAt?: number;
  updatedAt?: number;
}
