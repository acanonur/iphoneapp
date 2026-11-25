/**
 * "What can I make?" — the user ticks off what is at home, in the kitchen or
 * behind the bar, and the app says which recipes are possible now and which
 * are one or two ingredients away.
 *
 * Ingredients are compared by a key, not by their text, so that "Fresh mint",
 * "mint" and "Nane" (whose English is "mint") are the same thing.
 */

import type { Ingredient, Lang, Recipe } from '../model/types';
import { fold } from './search';
import { localise } from './text';

/** Words that describe the state of an ingredient rather than what it is. */
// Words that describe an ingredient without making it a different thing to buy:
// "extra virgin olive oil" and "olive oil" are one bottle, "caster sugar" is
// sugar, and crushed ice is still ice.
const DESCRIPTIVE = new Set([
  'fresh', 'dried', 'ground', 'chopped', 'large', 'small', 'ripe', 'cold', 'hot', 'warm',
  'extra', 'virgin', 'plain', 'caster', 'granulated', 'flat-leaf', 'crushed', 'ice-cold', 'boiling', 'cube', 'cubes',
]);

function singular(word: string): string {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  // leaves -> leaf, loaves -> loaf, halves -> half; but olives, chives and cloves keep their e.
  if (/(?:ea|oa|l)ves$/.test(word)) return `${word.slice(0, -3)}f`;
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

/** The same key for an ingredient in every language and however it is written: "Ripe Avocados" -> "avocado". */
export function ingredientKey(name: Ingredient['name']): string {
  const text = typeof name === 'string' ? name : name.en || name.tr || name.de;
  const words = fold(text).split(' ').filter(Boolean);
  const kept = words.filter((word) => !DESCRIPTIVE.has(word));
  // "Hot" alone is still something; keep it rather than end up with no key.
  const core = kept.length > 0 ? kept : words;
  const last = core[core.length - 1];
  if (last === undefined) return '';
  return [...core.slice(0, -1), singular(last)].join(' ');
}

/** Things every kitchen has, which never count as missing. */
export const STAPLE_KEYS: ReadonlySet<string> = new Set(
  ['water', 'ice', 'salt', 'black pepper', 'pepper'].map((name) => ingredientKey(name)),
);

export interface MakeStatus {
  recipeId: string;
  /** Keys of ingredients the recipe needs that are not in the pantry (staples excluded), without duplicates, in recipe order. */
  missing: string[];
  /** How many distinct non-staple ingredient keys the recipe needs. */
  needed: number;
  /** needed - missing.length */
  have: number;
}

/** The distinct keys a recipe needs that a kitchen does not always have, in recipe order. */
function neededKeys(recipe: Recipe): string[] {
  const keys = recipe.ingredients.map((ingredient) => ingredientKey(ingredient.name));
  return [...new Set(keys)].filter((key) => key !== '' && !STAPLE_KEYS.has(key));
}

/** What one recipe needs against what is in the pantry. */
export function makeStatus(recipe: Recipe, pantry: ReadonlySet<string>): MakeStatus {
  const needed = neededKeys(recipe);
  const missing = needed.filter((key) => !pantry.has(key));
  return { recipeId: recipe.id, missing, needed: needed.length, have: needed.length - missing.length };
}

/**
 * Recipes worth showing for what is at home, closest first: fewest missing,
 * then the bigger dish, then the order given. Drops recipes missing more than
 * `maxMissing` (default 2) and those that need nothing but staples.
 */
export function whatCanIMake(
  recipes: readonly Recipe[],
  pantry: ReadonlySet<string>,
  options: { maxMissing?: number } = {},
): MakeStatus[] {
  const maxMissing = options.maxMissing ?? 2;
  return recipes
    .map((recipe) => makeStatus(recipe, pantry))
    .filter((status) => status.needed > 0 && status.missing.length <= maxMissing)
    .sort((a, b) => a.missing.length - b.missing.length || b.needed - a.needed);
}

/**
 * Every ingredient worth asking about in the "I have…" picker, with a name in
 * the app's language and how many recipes use it; most used first.
 */
export function pantryCatalogue(recipes: readonly Recipe[], lang: Lang): { key: string; name: string; count: number }[] {
  const entries = new Map<string, { key: string; name: string; count: number }>();
  for (const recipe of recipes) {
    const seen = new Set<string>();
    for (const ingredient of recipe.ingredients) {
      const key = ingredientKey(ingredient.name);
      if (key === '' || STAPLE_KEYS.has(key) || seen.has(key)) continue;
      seen.add(key);
      const entry = entries.get(key);
      if (entry) entry.count += 1;
      else entries.set(key, { key, name: localise(ingredient.name, lang), count: 1 });
    }
  }
  return [...entries.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, lang));
}

/**
 * The one thing to buy that would make the most more recipes possible, and
 * which recipes those are; null when no single purchase completes any recipe.
 */
export function bestNextBuy(recipes: readonly Recipe[], pantry: ReadonlySet<string>): { key: string; unlocks: string[] } | null {
  const unlocks = new Map<string, string[]>();
  for (const recipe of recipes) {
    const { missing } = makeStatus(recipe, pantry);
    const only = missing[0];
    if (missing.length !== 1 || only === undefined) continue;
    const ids = unlocks.get(only) ?? [];
    if (!ids.includes(recipe.id)) ids.push(recipe.id);
    unlocks.set(only, ids);
  }

  let best: { key: string; unlocks: string[] } | null = null;
  // Map order is first appearance, and only a strictly larger count replaces the leader.
  for (const [key, ids] of unlocks) {
    if (!best || ids.length > best.unlocks.length) best = { key, unlocks: ids };
  }
  return best;
}
