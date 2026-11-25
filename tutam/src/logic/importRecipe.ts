/**
 * Importing a recipe from a web page.
 *
 * Almost every recipe site embeds its recipe as schema.org JSON-LD for search
 * engines, so that is what is read — not the page layout, which changes every
 * redesign. The data is written by many different plugins and is messy in
 * predictable ways: the recipe hides in an "@graph", instructions come in four
 * shapes, text carries HTML and entities. Each function below absorbs one of
 * those. No network code here: the caller fetches the page.
 */

import type { Category, Ingredient, Kind, Recipe } from '../model/types';
import { parseIngredient } from './parseIngredient';

/** A recipe as read from a page: plain strings (one language), no id yet. */
export type RecipeDraft = Omit<Recipe, 'id' | 'starter' | 'favourite' | 'createdAt' | 'updatedAt'>;

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const DURATION =
  /^P(?:(\d+(?:[.,]\d+)?)W)?(?:(\d+(?:[.,]\d+)?)D)?(?:T(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+(?:[.,]\d+)?)M)?(?:(\d+(?:[.,]\d+)?)S)?)?$/i;

/** A schema.org time ("PT1H30M") in whole minutes; 0 when missing or unreadable. */
export function parseDuration(iso: unknown): number {
  if (typeof iso !== 'string') return 0;
  const text = iso.trim();
  const m = DURATION.exec(text);
  // "P" and "PT" alone match the pattern but say nothing.
  if (!m || !/\d/.test(text) || /T$/i.test(text)) return 0;

  const num = (part: string | undefined) => (part ? Number(part.replace(',', '.')) : 0);
  const seconds =
    num(m[1]) * 7 * 86400 + num(m[2]) * 86400 + num(m[3]) * 3600 + num(m[4]) * 60 + num(m[5]);
  if (seconds <= 0) return 0;
  // Under a minute still takes a minute; otherwise to the nearest minute.
  return seconds < 60 ? 1 : Math.round(seconds / 60);
}

function firstPositiveInteger(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 1 ? Math.floor(value) : null;
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\d+/g)) {
      const n = Number(match[0]);
      if (n > 0) return n;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const n = firstPositiveInteger(item);
      if (n !== null) return n;
    }
    return null;
  }
  // A QuantitativeValue: { "@type": "QuantitativeValue", "value": 4 }.
  if (isObject(value)) return firstPositiveInteger(value.value);
  return null;
}

/** How many servings a recipe yield means: "Serves 6" -> 6, "4-6 servings" -> 4; 1 when it says nothing usable. */
export function parseYield(value: unknown): number {
  return firstPositiveInteger(value) ?? 1;
}

function flattenJsonLd(value: unknown, into: unknown[]): void {
  if (Array.isArray(value)) {
    for (const item of value) flattenJsonLd(item, into);
    return;
  }
  if (!isObject(value)) return;
  const graph = value['@graph'];
  if (graph !== undefined) {
    // The wrapper itself is only worth keeping if it is a thing of its own.
    if (value['@type'] !== undefined) into.push(value);
    flattenJsonLd(graph, into);
    return;
  }
  into.push(value);
}

function parseJsonBlock(source: string): unknown {
  const text = source
    .trim()
    // Old pages wrap scripts in HTML comments or CDATA sections.
    .replace(/^(?:\/\/\s*)?<!\[CDATA\[|(?:\/\/\s*)?\]\]>$/g, '')
    .replace(/^<!--|-->$/g, '')
    .trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    // A common fault: raw line breaks or tabs inside string values. Outside strings they are only whitespace.
    try {
      return JSON.parse(text.replace(/[\u0000-\u001f]+/g, ' '));
    } catch {
      return undefined;
    }
  }
}

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const TYPE_ATTRIBUTE = /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/** Every JSON-LD object on a page, with arrays and "@graph" containers opened up; broken blocks are skipped. */
export function extractJsonLd(html: string): unknown[] {
  const nodes: unknown[] = [];
  for (const [, attributes = '', body = ''] of html.matchAll(SCRIPT)) {
    const type = TYPE_ATTRIBUTE.exec(attributes);
    const value = type ? (type[1] ?? type[2] ?? type[3] ?? '') : '';
    if (value.trim().toLowerCase() !== 'application/ld+json') continue;
    const parsed = parseJsonBlock(body);
    if (parsed !== undefined) flattenJsonLd(parsed, nodes);
  }
  return nodes;
}

function isRecipeType(type: unknown): boolean {
  const one = (t: unknown) => typeof t === 'string' && /^(?:https?:\/\/schema\.org\/|schema:)?recipe$/i.test(t.trim());
  return Array.isArray(type) ? type.some(one) : one(type);
}

/** The recipe among a page's JSON-LD objects, or null when there is none. */
export function findRecipeNode(nodes: readonly unknown[]): Record<string, unknown> | null {
  for (const node of nodes) {
    if (isObject(node) && isRecipeType(node['@type'])) return node;
  }
  // Some sites describe the page and put the recipe inside it as its main entity.
  for (const node of nodes) {
    if (!isObject(node)) continue;
    const inner = [node.mainEntity].flat().find((item) => isObject(item) && isRecipeType(item['@type']));
    if (isObject(inner)) return inner;
  }
  return null;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  deg: '°', frac12: '½', frac14: '¼', frac34: '¾', times: '×',
};

function decodeEntities(text: string): string {
  // One pass, so "&amp;lt;" becomes "&lt;" and not "<".
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (entity, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

// Tags that separate words when they are removed; inline ones (<b>, <a>) do not.
const BLOCK_TAG = /<\/?(?:br|p|div|li|ul|ol|h[1-6]|tr|td)\b[^>]*>/gi;
const ANY_TAG = /<\/?[a-z][^>]*>/gi;

/** Page text as plain text: no HTML tags, entities decoded, whitespace tidied. */
export function cleanText(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const stripTags = (text: string) => text.replace(BLOCK_TAG, ' ').replace(ANY_TAG, '');
  // Tags again after decoding, for sites that escape their HTML ("&lt;p&gt;").
  return stripTags(decodeEntities(stripTags(String(value))))
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1. Mix. 2. Bake." -> ["Mix.", "Bake."]; only when the markers count up from 1, so "Add 2. …" survives. */
function splitNumbered(text: string): string[] | null {
  const start = /^\s*1[.)]\s+/.exec(text);
  if (!start) return null;
  const steps: string[] = [];
  let rest = text.slice(start[0].length);
  for (let n = 2; ; n++) {
    const next = new RegExp(`\\s${n}[.)]\\s+`).exec(rest);
    if (!next) break;
    steps.push(rest.slice(0, next.index));
    rest = rest.slice(next.index + next[0].length);
  }
  if (steps.length === 0) return null;
  steps.push(rest);
  return steps;
}

function stepsFromString(text: string): string[] {
  const lines = text
    .replace(/<br\s*\/?>|<\/(?:p|li|div)>/gi, '\n')
    .split(/\r?\n|\r/)
    .map(cleanText)
    .filter(Boolean);
  if (lines.length === 1) {
    const numbered = splitNumbered(lines[0]!);
    if (numbered) return numbered.map(cleanText).filter(Boolean);
  }
  // The app numbers steps itself, so "1." / "2)" in front of a line goes.
  return lines.map((line) => line.replace(/^\d+[.)]\s+/, '')).filter(Boolean);
}

/** A recipe's instructions in any of the shapes sites publish them, as a flat list of steps. */
export function parseInstructions(value: unknown): string[] {
  if (typeof value === 'string') return stepsFromString(value);
  if (Array.isArray(value)) return value.flatMap(parseInstructions);
  if (!isObject(value)) return [];
  // A HowToSection: its name is a heading, not a step.
  if (value.itemListElement !== undefined) return parseInstructions(value.itemListElement);
  const text = cleanText(value.text) || cleanText(value.name);
  return text ? [text] : [];
}

/** Lower-case words of the given values (strings or arrays of strings), Turkish İ included. */
function wordsOf(...values: unknown[]): string[] {
  return values
    .flat()
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .replace(/İ/g, 'i')
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
}

/**
 * A term counts when a word starts with it ("cocktails", "çorbası") or ends with
 * it (German compounds: "Linsensuppe", "Eistee"). Whole-word matching would
 * miss both; plain substring matching would make "steak" a tea.
 */
function mentions(words: readonly string[], terms: readonly string[]): boolean {
  return words.some((word) => terms.some((term) => word.startsWith(term) || word.endsWith(term)));
}

const DRINK_WORDS = ['drink', 'beverage', 'cocktail', 'getränk', 'içecek', 'kokteyl', 'smoothie', 'coffee', 'kaffee', 'kahve', 'tea', 'tee', 'çay'];

const DRINK_CATEGORY: readonly (readonly [Category, readonly string[]])[] = [
  ['cocktail', ['cocktail', 'kokteyl']],
  ['coffee', ['coffee', 'kaffee', 'kahve']],
  ['tea', ['tea', 'tee', 'çay']],
];

const FOOD_CATEGORY: readonly (readonly [Category, readonly string[]])[] = [
  ['soup', ['soup', 'suppe', 'çorba']],
  ['salad', ['salad', 'salat', 'salata']],
  ['dessert', ['dessert', 'nachtisch', 'tatlı']],
  ['breakfast', ['breakfast', 'frühstück', 'kahvaltı']],
  ['baking', ['bread', 'cake', 'baking', 'kuchen', 'brot', 'kek', 'ekmek']],
  ['side', ['side', 'beilage', 'meze']],
];

/** "…" cut at a word boundary, the whole thing at most `max` characters. */
function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  let head = text.slice(0, max - 1);
  const next = text[max - 1];
  if (next !== undefined && !/\s/.test(next)) {
    const space = head.lastIndexOf(' ');
    if (space > 0) head = head.slice(0, space);
  }
  return `${head.replace(/[\s,;:.–—-]+$/, '')}…`;
}

function ingredientLines(node: Json): string[] {
  // "ingredients" is the property's old schema.org name, still used by some sites.
  const raw = node.recipeIngredient ?? node.ingredients;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  return list.map(cleanText).filter(Boolean);
}

function toIngredient(line: string): Ingredient {
  const parsed = parseIngredient(line);
  const ingredient: Ingredient = { qty: parsed.qty, unit: parsed.unit, name: parsed.name };
  if (parsed.note) ingredient.note = parsed.note;
  return ingredient;
}

/** A recipe draft from the HTML of a recipe page, or null when the page carries no recipe data. */
export function importFromHtml(html: string, url: string): RecipeDraft | null {
  const node = findRecipeNode(extractJsonLd(html));
  if (!node) return null;

  const title = cleanText(node.name);
  const prepMinutes = parseDuration(node.prepTime);
  let cookMinutes = parseDuration(node.cookTime);
  const total = parseDuration(node.totalTime);
  if (prepMinutes === 0 && cookMinutes === 0) cookMinutes = total;
  // Only prep and a total given: the rest of the total is the cooking.
  else if (cookMinutes === 0 && total > prepMinutes) cookMinutes = total - prepMinutes;

  const kindWords = wordsOf(node.recipeCategory, node.keywords);
  const kind: Kind = mentions(kindWords, DRINK_WORDS) ? 'drink' : 'food';
  const categoryWords = [...kindWords, ...wordsOf(title)];
  const table = kind === 'drink' ? DRINK_CATEGORY : FOOD_CATEGORY;
  const category: Category =
    table.find(([, terms]) => mentions(categoryWords, terms))?.[0] ?? (kind === 'drink' ? 'cold' : 'main');

  return {
    kind,
    category,
    title,
    summary: shorten(cleanText(node.description), 300),
    servings: parseYield(node.recipeYield),
    prepMinutes,
    cookMinutes,
    difficulty: 1,
    ingredients: ingredientLines(node).map(toIngredient),
    steps: parseInstructions(node.recipeInstructions).map((text) => ({ text })),
    tags: [],
    source: url,
  };
}
