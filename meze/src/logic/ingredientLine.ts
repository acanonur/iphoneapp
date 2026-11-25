import type { Ingredient, Lang } from '../model/types';
import { displayQuantity, type UnitSystem } from './quantity';
import { localise } from './text';
import { unitLabel } from './units';

export interface IngredientLine {
  /** "300 g", "1½ cups", "2", or "" for "to taste". */
  amount: string;
  name: string;
  note: string;
  /** The scaled, converted quantity behind `amount`, for the shopping list. */
  qty: number | null;
  unit: Ingredient['unit'];
}

/** One ingredient as it should be read: scaled to the servings, in the chosen units and language. */
export function ingredientLine(
  ingredient: Ingredient,
  options: { factor: number; system: UnitSystem; lang: Lang },
): IngredientLine {
  const shown = displayQuantity(ingredient, options);
  const label = unitLabel(shown.unit, shown.qty, options.lang);
  return {
    amount: [shown.text, label].filter(Boolean).join(' '),
    name: localise(ingredient.name, options.lang),
    note: localise(ingredient.note, options.lang),
    qty: shown.qty,
    unit: shown.unit,
  };
}

/** A recipe as plain text, for sharing into a message. */
export function ingredientText(line: IngredientLine): string {
  return [line.amount, line.name].filter(Boolean).join(' ') + (line.note ? `, ${line.note}` : '');
}
