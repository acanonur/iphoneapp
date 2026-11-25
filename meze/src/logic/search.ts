/**
 * Finding recipes, and turning a few of them into a shopping list.
 *
 * Search has to forgive the way people type on a phone: "mercimek corbasi"
 * must find "Mercimek Çorbası" and "kasespatzle" must find "Käsespätzle".
 * Everything that is compared goes through `fold()` first.
 */

import { CATEGORIES, type Category, type Kind, type Lang, type Recipe, type Unit } from '../model/types';
import { allVersions, localise } from './text';

/**
 * Text reduced to what people actually type: lower case, no Turkish or German
 * special letters, no accents, single spaces. "Mercimek Çorbası" -> "mercimek corbasi".
 */
export function fold(text: string): string {
  return (
    text
      // Turkish i's first: 'İ'.toLowerCase() is "i" plus a combining dot, and 'I' must not become 'ı'.
      .replace(/[İIı]/g, 'i')
      .toLowerCase()
      .replace(/ß/g, 'ss')
      .replace(/æ/g, 'ae')
      .replace(/œ/g, 'oe')
      .replace(/ø/g, 'o')
      .replace(/ł/g, 'l')
      // ç ğ ö ş ü ä é â … are a base letter plus a combining mark once decomposed.
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export interface RecipeFilter {
  /** Free text. */
  query?: string;
  kind?: Kind | null;
  category?: Category | null;
  favouritesOnly?: boolean;
  /** prepMinutes + cookMinutes must be at most this. */
  maxMinutes?: number | null;
  /** An exact tag. */
  tag?: string | null;
  /** Only applied to drinks; food always passes. */
  alcoholic?: boolean | null;
}

/** How long a recipe takes from start to finish. */
export function totalMinutes(recipe: Pick<Recipe, 'prepMinutes' | 'cookMinutes'>): number {
  return recipe.prepMinutes + recipe.cookMinutes;
}

/** Everything a search looks through, folded into one string. */
function haystack(recipe: Recipe): string {
  const parts = [
    ...allVersions(recipe.title),
    ...allVersions(recipe.summary),
    ...recipe.ingredients.flatMap((ingredient) => allVersions(ingredient.name)),
    ...recipe.tags,
    recipe.category,
  ];
  // Query words never contain a space, so joining with one cannot create a false match across fields.
  return fold(parts.join(' '));
}

/** True when a recipe matches what was typed in the search box, in any of its languages. */
export function matchesQuery(recipe: Recipe, query: string): boolean {
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const text = haystack(recipe);
  return words.every((word) => text.includes(word));
}

function passes(recipe: Recipe, filter: RecipeFilter): boolean {
  if (filter.kind != null && recipe.kind !== filter.kind) return false;
  if (filter.category != null && recipe.category !== filter.category) return false;
  if (filter.favouritesOnly && !recipe.favourite) return false;
  if (filter.maxMinutes != null && totalMinutes(recipe) > filter.maxMinutes) return false;
  if (filter.tag != null && !recipe.tags.includes(filter.tag)) return false;
  if (filter.alcoholic != null && recipe.kind === 'drink' && Boolean(recipe.alcoholic) !== filter.alcoholic) {
    return false;
  }
  if (filter.query !== undefined && !matchesQuery(recipe, filter.query)) return false;
  return true;
}

/**
 * The recipes to show for a set of filters, best first: title matches for the
 * query, then favourites, then alphabetical in the app's language.
 */
export function filterRecipes(recipes: readonly Recipe[], filter: RecipeFilter, lang: Lang): Recipe[] {
  const query = fold(filter.query ?? '');
  const titleMatches = (recipe: Recipe) =>
    query !== '' && allVersions(recipe.title).some((title) => fold(title).includes(query));

  return recipes
    .filter((recipe) => passes(recipe, filter))
    .map((recipe) => ({ recipe, titleMatch: titleMatches(recipe), title: localise(recipe.title, lang) }))
    .sort(
      (a, b) =>
        Number(b.titleMatch) - Number(a.titleMatch) ||
        Number(Boolean(b.recipe.favourite)) - Number(Boolean(a.recipe.favourite)) ||
        a.title.localeCompare(b.title, lang),
    )
    .map(({ recipe }) => recipe);
}

/** The categories worth offering as filter chips: those that occur, in the usual order. */
export function categoriesIn(recipes: readonly Recipe[]): Category[] {
  const present = new Set(recipes.map((recipe) => recipe.category));
  return CATEGORIES.filter((category) => present.has(category));
}

export interface ShoppingLine {
  /** fold(name in lang) + '|' + (unit ?? ''). */
  key: string;
  /** Display name in `lang`, from the first recipe that had it. */
  name: string;
  /** Summed; null when no recipe gave a quantity. */
  qty: number | null;
  unit: Unit | null;
  /** Which recipes need it, no duplicates, in input order. */
  recipeIds: string[];
}

/**
 * The shopping list for a set of recipes, each scaled by its own factor: one
 * line per ingredient and unit, quantities added up, in the order first needed.
 */
export function buildShoppingLines(
  entries: readonly { recipe: Recipe; factor: number }[],
  lang: Lang,
): ShoppingLine[] {
  const lines = new Map<string, ShoppingLine>();

  for (const { recipe, factor } of entries) {
    for (const ingredient of recipe.ingredients) {
      const name = localise(ingredient.name, lang);
      // "Salt, to taste" has no amount to add up, so it does not sort by unit either.
      const unit = ingredient.qty === null ? null : ingredient.unit;
      const key = `${fold(name)}|${unit ?? ''}`;

      let line = lines.get(key);
      if (!line) {
        line = { key, name, qty: null, unit, recipeIds: [] };
        lines.set(key, line);
      }
      if (ingredient.qty !== null) line.qty = (line.qty ?? 0) + ingredient.qty * factor;
      if (!line.recipeIds.includes(recipe.id)) line.recipeIds.push(recipe.id);
    }
  }

  return [...lines.values()];
}
