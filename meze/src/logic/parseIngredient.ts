/**
 * Reading an ingredient line as a cook writes it — "1½ tbsp olive oil",
 * "2 EL Olivenöl", "1 yemek kaşığı domates salçası" — into quantity, unit,
 * name and note.
 *
 * Used for lines typed into the editor and for every ingredient of an
 * imported recipe, so it has to cope with English, Turkish and German.
 */

import type { Unit } from '../model/types';

export interface ParsedIngredient {
  qty: number | null;
  unit: Unit | null;
  name: string;
  note?: string;
}

/** Unit words in English, Turkish and German, lower-case, mapped to a Unit. Exported for tests. */
export const UNIT_ALIASES: Readonly<Record<string, Unit>> = {
  // weight
  g: 'g', gr: 'g', gram: 'g', grams: 'g', gramm: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', kilogramm: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb', pfund: 'lb',
  // volume
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', mililitre: 'ml',
  cl: 'cl', centiliter: 'cl', centilitre: 'cl',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', tl: 'tsp', teelöffel: 'tsp',
  'çay kaşığı': 'tsp', 'tatlı kaşığı': 'tsp',
  tbsp: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', el: 'tbsp', esslöffel: 'tbsp',
  'yemek kaşığı': 'tbsp',
  cup: 'cup', cups: 'cup', tasse: 'cup', tassen: 'cup', 'su bardağı': 'cup', bardak: 'cup',
  'fl oz': 'floz', floz: 'floz', 'fl. oz': 'floz', 'fluid ounce': 'floz', 'fluid ounces': 'floz',
  // counts
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece', stück: 'piece', stk: 'piece', adet: 'piece', tane: 'piece',
  clove: 'clove', cloves: 'clove', zehe: 'clove', zehen: 'clove', diş: 'clove',
  slice: 'slice', slices: 'slice', scheibe: 'slice', scheiben: 'slice', dilim: 'slice',
  bunch: 'bunch', bunches: 'bunch', bund: 'bunch', demet: 'bunch',
  sprig: 'sprig', sprigs: 'sprig', zweig: 'sprig', zweige: 'sprig', dal: 'sprig',
  leaf: 'leaf', leaves: 'leaf', blatt: 'leaf', blätter: 'leaf', yaprak: 'leaf',
  pinch: 'pinch', pinches: 'pinch', prise: 'pinch', prisen: 'pinch', tutam: 'pinch',
  dash: 'dash', dashes: 'dash', spritzer: 'dash', schuss: 'dash',
  can: 'can', cans: 'can', dose: 'can', dosen: 'can', kutu: 'can',
  stick: 'stick', sticks: 'stick', stange: 'stick', stangen: 'stick', çubuk: 'stick',
};

const VULGAR: Readonly<Record<string, number>> = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4,
  '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5, '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
};
const VULGAR_CLASS = '[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]';

// One number in any form a recipe writes it, longest form first:
// "1 1/2", "1 ½", "1½", "1/2", "1.5", "1,5", "½", "2". "⁄" is the Unicode fraction slash.
const NUMBER = new RegExp(
  `^(?:(\\d+)\\s+(\\d+)\\s*[/⁄]\\s*(\\d+)|(\\d+)\\s*(${VULGAR_CLASS})|(\\d+)\\s*[/⁄]\\s*(\\d+)|(\\d+(?:[.,]\\d+)?)|(${VULGAR_CLASS}))`,
);
// The second half of a range: "-3", " – 3", "—3".
const RANGE_TAIL = /^\s*[-–—]\s*/;

function readNumber(text: string): { value: number; length: number } | null {
  const m = NUMBER.exec(text);
  if (!m) return null;
  const [all, mixedWhole, mixedTop, mixedBottom, wholeBeforeVulgar, vulgarAfterWhole, top, bottom, decimal, vulgar] = m;
  let value: number | undefined;
  if (mixedWhole !== undefined && Number(mixedBottom) > 0) {
    value = Number(mixedWhole) + Number(mixedTop) / Number(mixedBottom);
  } else if (wholeBeforeVulgar !== undefined && vulgarAfterWhole !== undefined) {
    value = Number(wholeBeforeVulgar) + (VULGAR[vulgarAfterWhole] ?? 0);
  } else if (top !== undefined && Number(bottom) > 0) {
    value = Number(top) / Number(bottom);
  } else if (decimal !== undefined) {
    value = Number(decimal.replace(',', '.'));
  } else if (vulgar !== undefined) {
    value = VULGAR[vulgar];
  }
  if (value === undefined) {
    // A fraction over zero ("1/0"): read just the whole number in front of it.
    const whole = /^\d+/.exec(text);
    return whole ? { value: Number(whole[0]), length: whole[0].length } : null;
  }
  return { value, length: all.length };
}

/** Reads the amount at the start of an ingredient line, and returns what follows it. Null when the line does not start with a number. */
export function parseQuantity(text: string): { qty: number; rest: string } | null {
  const start = text.trimStart();
  const first = readNumber(start);
  if (!first) return null;

  let rest = start.slice(first.length);
  // "2-3 tomatoes": buy for the first number, skip the rest of the range.
  const dash = RANGE_TAIL.exec(rest);
  if (dash) {
    const second = readNumber(rest.slice(dash[0].length));
    if (second) rest = rest.slice(dash[0].length + second.length);
  }
  return { qty: first.value, rest: rest.trimStart() };
}

/** A word or phrase as a unit, or null: "Tbsp." -> tbsp, "YEMEK KAŞIĞI" -> tbsp. */
function lookUpUnit(words: readonly string[]): Unit | null {
  const phrase = words.join(' ').replace(/\.$/, '');
  // Plain lower-casing turns Turkish "I" into "i", so also try the Turkish rules ("KAŞIĞI" -> "kaşığı").
  return UNIT_ALIASES[phrase.toLowerCase()] ?? UNIT_ALIASES[phrase.toLocaleLowerCase('tr')] ?? null;
}

/** Index of the first comma that is not inside parentheses, or -1. */
function firstTopLevelComma(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) return i;
  }
  return -1;
}

/** Splits "onion, finely chopped" and "tomatoes (canned)" into name and note. */
function splitNote(text: string): { name: string; note?: string } {
  let name = text;
  const notes: string[] = [];

  const comma = firstTopLevelComma(name);
  if (comma !== -1) {
    notes.push(name.slice(comma + 1).trim());
    name = name.slice(0, comma).trim();
  }
  const paren = /^(.*?)\s*\(([^()]*)\)$/.exec(name);
  if (paren) {
    // "tomatoes (canned), drained": the bracket is a note too, and comes first.
    notes.unshift(paren[2]!.trim());
    name = paren[1]!.trim();
  }

  const note = notes.filter(Boolean).join(', ');
  return note ? { name, note } : { name };
}

/** Reads one ingredient line — typed, pasted or imported — into quantity, unit, name and note. */
export function parseIngredient(line: string): ParsedIngredient {
  const text = line
    .trim()
    .replace(/^[-•*–—·]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  const quantity = parseQuantity(text);
  if (!quantity) return { qty: null, unit: null, ...splitNote(text) };

  // The unit is the next one, two or three words, longest first. "200g" and
  // "2EL" need nothing special: parseQuantity already returns "g flour" / "EL Olivenöl".
  const words = quantity.rest.split(' ').filter(Boolean);
  let unit: Unit | null = null;
  let unitWords = 0;
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    unit = lookUpUnit(words.slice(0, n));
    if (unit) {
      unitWords = n;
      break;
    }
  }

  const afterUnit = words.slice(unitWords).join(' ').replace(/^of (the )?/i, '');
  const { name, note } = splitNote(afterUnit);

  // "2 cloves": the word was the ingredient, not a unit.
  if (unit && !name) {
    const word = words.slice(0, unitWords).join(' ');
    return note ? { qty: quantity.qty, unit: null, name: word, note } : { qty: quantity.qty, unit: null, name: word };
  }
  return note ? { qty: quantity.qty, unit, name, note } : { qty: quantity.qty, unit, name };
}
