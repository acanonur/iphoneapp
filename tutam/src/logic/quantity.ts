/**
 * Quantities: scaling a recipe, converting its units, and writing numbers the
 * way a cookbook does.
 *
 * Three decisions run through this file:
 *
 *  - **Spoons stay spoons.** A teaspoon is a teaspoon in Berlin, Istanbul and
 *    Boston, so tsp and tbsp are never converted — only weights and the larger
 *    volumes are.
 *  - **Centilitres stay centilitres** in metric, because that is the unit a bar
 *    measure is marked in; they become fluid ounces in US units.
 *  - **Round to what can be measured.** 283.495 g is not a quantity anyone can
 *    weigh out. After scaling and converting, amounts are rounded to steps a
 *    kitchen scale, a measuring jug or a spoon set actually has.
 */

import type { Ingredient, Lang, Unit } from '../model/types';

export type UnitSystem = 'metric' | 'us';
export type UnitFamily = 'weight' | 'volume' | 'count';

const GRAMS: Partial<Record<Unit, number>> = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
const MILLILITRES: Partial<Record<Unit, number>> = {
  ml: 1,
  cl: 10,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
  floz: 29.5735,
};

/** Whether a unit measures weight, volume, or just counts things. */
export function unitFamily(unit: Unit): UnitFamily {
  if (unit in GRAMS) return 'weight';
  if (unit in MILLILITRES) return 'volume';
  return 'count';
}

/** Grams per unit for weights, millilitres per unit for volumes, null for counts. */
export function baseFactor(unit: Unit): number | null {
  return GRAMS[unit] ?? MILLILITRES[unit] ?? null;
}

/** What to multiply every quantity by to go from the written servings to the wanted ones. */
export function scaleFactor(originalServings: number, wantedServings: number): number {
  const valid = (n: number) => Number.isFinite(n) && n > 0;
  return valid(originalServings) && valid(wantedServings) ? wantedServings / originalServings : 1;
}

export interface Amount {
  qty: number;
  unit: Unit;
}

/** An amount in the unit a cook using that system would reach for. */
export function convertAmount(amount: Amount, system: UnitSystem): Amount {
  const { qty, unit } = amount;
  if (unit === 'tsp' || unit === 'tbsp') return amount;

  const grams = GRAMS[unit];
  if (grams !== undefined) {
    const total = qty * grams;
    if (system === 'metric') return total >= 1000 ? { qty: total / 1000, unit: 'kg' } : { qty: total, unit: 'g' };
    const ounces = total / 28.3495;
    return ounces >= 16 ? { qty: ounces / 16, unit: 'lb' } : { qty: ounces, unit: 'oz' };
  }

  const millilitres = MILLILITRES[unit];
  if (millilitres !== undefined) {
    const total = qty * millilitres;
    if (system === 'metric') {
      if (unit === 'cl') return amount;
      return total >= 1000 ? { qty: total / 1000, unit: 'l' } : { qty: total, unit: 'ml' };
    }
    return total < 60 ? { qty: total / 29.5735, unit: 'floz' } : { qty: total / 240, unit: 'cup' };
  }

  return amount;
}

function toStep(qty: number, step: number): number {
  // Never round a real quantity away to nothing.
  // Rounded again to shed binary noise: 230 × 0.01 is 2.3000000000000003.
  return Math.round(Math.max(step, Math.round(qty / step) * step) * 1000) / 1000;
}

/** A quantity rounded to something a scale, a jug or a spoon set can measure. */
export function roundAmount(qty: number, unit: Unit | null): number {
  if (!(qty > 0)) return 0;
  switch (unit) {
    case 'g':
    case 'ml':
      if (qty >= 100) return toStep(qty, 5);
      if (qty >= 10) return toStep(qty, 1);
      return toStep(qty, 0.1);
    case 'kg':
    case 'l':
    case 'lb':
      return toStep(qty, 0.01);
    case 'cl':
      return toStep(qty, 0.5);
    case 'oz':
    case 'floz':
      return qty < 10 ? toStep(qty, 0.25) : toStep(qty, 0.5);
    case 'tsp':
    case 'tbsp':
    case 'cup':
      return qty < 1 ? toStep(qty, 0.125) : toStep(qty, 0.25);
    case 'pinch':
    case 'dash':
      return toStep(qty, 1);
    default:
      // Counts: half an onion and a quarter of a cabbage both survive.
      return toStep(qty, 0.25);
  }
}

const FRACTIONS: readonly (readonly [number, string])[] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
];

function decimal(value: number, lang: Lang): string {
  const text = String(Math.round(value * 100) / 100);
  return lang === 'en' ? text : text.replace('.', ',');
}

/** A number as a cookbook prints it: "1½" where fractions are wanted, "1,5" in Turkish and German. */
export function formatNumber(value: number, lang: Lang, options: { fractions?: boolean } = {}): string {
  if (!options.fractions) return decimal(value, lang);

  const whole = Math.floor(value + 1e-9);
  const rest = value - whole;
  if (rest < 0.02) return String(whole);
  if (rest > 0.98) return String(whole + 1);

  const match = FRACTIONS.find(([fraction]) => Math.abs(rest - fraction) < 0.02);
  if (!match) return decimal(value, lang);
  return whole === 0 ? match[1] : `${whole}${match[1]}`;
}

/** True for units whose quantities read best as fractions: spoons, cups and anything counted. */
export function usesFractions(unit: Unit | null): boolean {
  if (unit === null) return true;
  return unit === 'tsp' || unit === 'tbsp' || unit === 'cup' || unitFamily(unit) === 'count';
}

/** An ingredient's quantity — scaled, converted, rounded and formatted. Empty for "to taste". */
export function displayQuantity(
  ingredient: Pick<Ingredient, 'qty' | 'unit'>,
  options: { factor: number; system: UnitSystem; lang: Lang },
): { text: string; qty: number | null; unit: Unit | null } {
  if (ingredient.qty === null) return { text: '', qty: null, unit: null };

  const scaled = ingredient.qty * options.factor;
  const converted =
    ingredient.unit === null
      ? { qty: scaled, unit: null }
      : convertAmount({ qty: scaled, unit: ingredient.unit }, options.system);
  const qty = roundAmount(converted.qty, converted.unit);

  return {
    text: formatNumber(qty, options.lang, { fractions: usesFractions(converted.unit) }),
    qty,
    unit: converted.unit,
  };
}

/** "25 min", "1 h", "1 h 30 min". Empty for nothing. */
export function formatMinutes(minutes: number): string {
  if (!(minutes > 0)) return '';
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
