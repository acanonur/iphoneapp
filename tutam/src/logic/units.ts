import type { Lang, Unit } from '../model/types';

/**
 * How each unit is written in each language: [one, many].
 *
 * Measured units are abbreviations and do not change with the number. Counted
 * ones are words, and English and German need a plural. Turkish never
 * pluralises after a number ("2 diş sarımsak"), so both forms are the same.
 *
 * `piece` is empty in English and German on purpose — "1 onion", "1 Zwiebel" —
 * while Turkish says "1 adet soğan".
 */
const LABELS: Record<Lang, Record<Unit, readonly [string, string]>> = {
  en: {
    g: ['g', 'g'], kg: ['kg', 'kg'], oz: ['oz', 'oz'], lb: ['lb', 'lb'],
    ml: ['ml', 'ml'], cl: ['cl', 'cl'], l: ['l', 'l'],
    tsp: ['tsp', 'tsp'], tbsp: ['tbsp', 'tbsp'], cup: ['cup', 'cups'], floz: ['fl oz', 'fl oz'],
    piece: ['', ''], clove: ['clove', 'cloves'], slice: ['slice', 'slices'], bunch: ['bunch', 'bunches'],
    sprig: ['sprig', 'sprigs'], leaf: ['leaf', 'leaves'], pinch: ['pinch', 'pinches'], dash: ['dash', 'dashes'],
    can: ['can', 'cans'], stick: ['stick', 'sticks'],
  },
  tr: {
    g: ['g', 'g'], kg: ['kg', 'kg'], oz: ['oz', 'oz'], lb: ['lb', 'lb'],
    ml: ['ml', 'ml'], cl: ['cl', 'cl'], l: ['l', 'l'],
    tsp: ['çay kaşığı', 'çay kaşığı'], tbsp: ['yemek kaşığı', 'yemek kaşığı'],
    cup: ['su bardağı', 'su bardağı'], floz: ['fl oz', 'fl oz'],
    piece: ['adet', 'adet'], clove: ['diş', 'diş'], slice: ['dilim', 'dilim'], bunch: ['demet', 'demet'],
    sprig: ['dal', 'dal'], leaf: ['yaprak', 'yaprak'], pinch: ['tutam', 'tutam'], dash: ['damla', 'damla'],
    can: ['kutu', 'kutu'], stick: ['çubuk', 'çubuk'],
  },
  de: {
    g: ['g', 'g'], kg: ['kg', 'kg'], oz: ['oz', 'oz'], lb: ['lb', 'lb'],
    ml: ['ml', 'ml'], cl: ['cl', 'cl'], l: ['l', 'l'],
    tsp: ['TL', 'TL'], tbsp: ['EL', 'EL'], cup: ['Tasse', 'Tassen'], floz: ['fl oz', 'fl oz'],
    piece: ['', ''], clove: ['Zehe', 'Zehen'], slice: ['Scheibe', 'Scheiben'], bunch: ['Bund', 'Bund'],
    sprig: ['Zweig', 'Zweige'], leaf: ['Blatt', 'Blätter'], pinch: ['Prise', 'Prisen'], dash: ['Spritzer', 'Spritzer'],
    can: ['Dose', 'Dosen'], stick: ['Stange', 'Stangen'],
  },
};

/** The unit as written after a quantity: "g", "cloves", "EL", "su bardağı". */
export function unitLabel(unit: Unit | null, qty: number | null, lang: Lang): string {
  if (!unit) return '';
  const [one, many] = LABELS[lang][unit];
  return qty !== null && qty > 1 ? many : one;
}
