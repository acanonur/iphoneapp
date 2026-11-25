import { describe, expect, it } from 'vitest';
import {
  buildShoppingLines,
  categoriesIn,
  filterRecipes,
  fold,
  matchesQuery,
  totalMinutes,
} from '../src/logic/search';
import type { Recipe } from '../src/model/types';

function recipe(over: Partial<Recipe>): Recipe {
  return {
    id: 'r',
    kind: 'food',
    category: 'main',
    title: 'Untitled',
    summary: '',
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 20,
    difficulty: 1,
    ingredients: [],
    steps: [],
    tags: [],
    ...over,
  };
}

const ids = (recipes: Recipe[]) => recipes.map((r) => r.id);

const lentilSoup = recipe({
  id: 'lentil',
  category: 'soup',
  title: { en: 'Red lentil soup', tr: 'Mercimek Çorbası', de: 'Rote Linsensuppe' },
  summary: { en: 'Velvety and lemony.', tr: 'Kadife gibi, limonlu.', de: 'Samtig und zitronig.' },
  ingredients: [
    { qty: 200, unit: 'g', name: { en: 'red lentils', tr: 'kırmızı mercimek', de: 'rote Linsen' } },
    { qty: 1, unit: 'tsp', name: { en: 'cumin', tr: 'kimyon', de: 'Kreuzkümmel' } },
  ],
  tags: ['vegan', 'turkish'],
});

describe('fold', () => {
  it('drops Turkish letters', () => {
    expect(fold('Mercimek Çorbası')).toBe('mercimek corbasi');
    expect(fold('Şiş köfte, ağır ateşte')).toBe('sis kofte, agir ateste');
  });

  it('treats every Turkish i as a plain i, whatever its case', () => {
    expect(fold('İMAM')).toBe('imam');
    expect(fold('IŞIK')).toBe('isik');
    expect(fold('ılık')).toBe('ilik');
  });

  it('drops German umlauts and spells ß as ss', () => {
    expect(fold('Käsespätzle')).toBe('kasespatzle');
    expect(fold('Straße')).toBe('strasse');
    expect(fold('ÖL')).toBe('ol');
  });

  it('drops accents and tidies whitespace', () => {
    expect(fold('  Crème   Brûlée ')).toBe('creme brulee');
    expect(fold('Jalapeño\tpiña')).toBe('jalapeno pina');
  });

  it('folds blank text to nothing', () => {
    expect(fold('')).toBe('');
    expect(fold('   ')).toBe('');
  });
});

describe('totalMinutes', () => {
  it('adds hands-on time and time on the heat', () => {
    expect(totalMinutes({ prepMinutes: 15, cookMinutes: 40 })).toBe(55);
    expect(totalMinutes({ prepMinutes: 5, cookMinutes: 0 })).toBe(5);
  });
});

describe('matchesQuery', () => {
  it('finds a Turkish title typed without Turkish letters', () => {
    expect(matchesQuery(lentilSoup, 'mercimek corbasi')).toBe(true);
    expect(matchesQuery(lentilSoup, 'ÇORBA')).toBe(true);
  });

  it('finds the German and English titles', () => {
    expect(matchesQuery(lentilSoup, 'linsensuppe')).toBe(true);
    expect(matchesQuery(lentilSoup, 'lentil')).toBe(true);
  });

  it('finds an ingredient in any language', () => {
    expect(matchesQuery(lentilSoup, 'kimyon')).toBe(true);
    expect(matchesQuery(lentilSoup, 'kreuzkummel')).toBe(true);
  });

  it('finds the summary, a tag and the category', () => {
    expect(matchesQuery(lentilSoup, 'zitronig')).toBe(true);
    expect(matchesQuery(lentilSoup, 'vegan')).toBe(true);
    expect(matchesQuery(lentilSoup, 'soup')).toBe(true);
  });

  it('needs every word, but in any order and from different fields', () => {
    expect(matchesQuery(lentilSoup, 'kimyon mercimek')).toBe(true);
    expect(matchesQuery(lentilSoup, 'vegan   cumin soup')).toBe(true);
    expect(matchesQuery(lentilSoup, 'mercimek chicken')).toBe(false);
  });

  it('rejects a recipe that has none of the words', () => {
    expect(matchesQuery(lentilSoup, 'negroni')).toBe(false);
  });

  it('does not match across the boundary between two fields', () => {
    // The tags "vegan" and "turkish" side by side must not produce "vegantur".
    expect(matchesQuery(lentilSoup, 'vegantur')).toBe(false);
  });

  it('lets an empty or blank query match everything', () => {
    expect(matchesQuery(lentilSoup, '')).toBe(true);
    expect(matchesQuery(lentilSoup, '   ')).toBe(true);
  });

  it('works on recipes written in one language as plain strings', () => {
    const own = recipe({ title: 'Omas Käsekuchen', ingredients: [{ qty: 500, unit: 'g', name: 'Quark' }] });
    expect(matchesQuery(own, 'kasekuchen quark')).toBe(true);
  });
});

describe('filterRecipes', () => {
  const porridge = recipe({ id: 'porridge', category: 'breakfast', title: 'Porridge', prepMinutes: 5, cookMinutes: 10, tags: ['quick'] });
  const stew = recipe({ id: 'stew', title: 'Beef stew', prepMinutes: 20, cookMinutes: 120, favourite: true });
  const espresso = recipe({ id: 'espresso', kind: 'drink', category: 'coffee', title: 'Espresso', prepMinutes: 2, cookMinutes: 0, alcoholic: false });
  const negroni = recipe({ id: 'negroni', kind: 'drink', category: 'cocktail', title: 'Negroni', prepMinutes: 3, cookMinutes: 0, alcoholic: true });
  const lemonade = recipe({ id: 'lemonade', kind: 'drink', category: 'cold', title: 'Lemonade', prepMinutes: 10, cookMinutes: 0 });
  const all = [porridge, stew, espresso, negroni, lemonade];

  it('filters by kind', () => {
    expect(ids(filterRecipes(all, { kind: 'drink' }, 'en'))).toEqual(['espresso', 'lemonade', 'negroni']);
    expect(ids(filterRecipes(all, { kind: null }, 'en'))).toHaveLength(5);
  });

  it('filters by category', () => {
    expect(ids(filterRecipes(all, { category: 'coffee' }, 'en'))).toEqual(['espresso']);
  });

  it('keeps only favourites when asked', () => {
    expect(ids(filterRecipes(all, { favouritesOnly: true }, 'en'))).toEqual(['stew']);
  });

  it('keeps recipes that take at most the given minutes, counting prep and cooking', () => {
    // Porridge is 5 + 10 = 15, exactly the limit; lemonade is 10.
    expect(ids(filterRecipes(all, { kind: 'food', maxMinutes: 15 }, 'en'))).toEqual(['porridge']);
    expect(ids(filterRecipes(all, { maxMinutes: 14 }, 'en'))).toEqual(['espresso', 'lemonade', 'negroni']);
  });

  it('filters by an exact tag', () => {
    expect(ids(filterRecipes(all, { tag: 'quick' }, 'en'))).toEqual(['porridge']);
    expect(ids(filterRecipes(all, { tag: 'qui' }, 'en'))).toEqual([]);
  });

  it('with alcoholic false, drops alcoholic drinks but keeps food and soft drinks', () => {
    expect(ids(filterRecipes(all, { alcoholic: false }, 'en'))).toEqual(['stew', 'espresso', 'lemonade', 'porridge']);
  });

  it('with alcoholic true, keeps only alcoholic drinks — and all the food', () => {
    expect(ids(filterRecipes(all, { alcoholic: true }, 'en'))).toEqual(['stew', 'negroni', 'porridge']);
  });

  it('applies the query together with the other filters', () => {
    expect(ids(filterRecipes([lentilSoup, ...all], { query: 'kimyon', kind: 'food' }, 'en'))).toEqual(['lentil']);
    expect(ids(filterRecipes([lentilSoup, ...all], { query: 'kimyon', kind: 'drink' }, 'en'))).toEqual([]);
  });

  it('puts recipes whose title contains the query before those that only mention it', () => {
    const tomatoSoup = recipe({ id: 'tomato-soup', title: 'Tomato soup', favourite: true });
    const salad = recipe({
      id: 'salad',
      title: 'Shepherd salad',
      ingredients: [{ qty: 2, unit: null, name: 'tomato' }],
    });
    const result = filterRecipes([tomatoSoup, salad], { query: 'tomato' }, 'en');
    expect(ids(result)).toEqual(['tomato-soup', 'salad']);
    // A title match beats a favourite.
    const favouriteSalad = { ...salad, favourite: true };
    const plainSoup = { ...tomatoSoup, favourite: false };
    expect(ids(filterRecipes([favouriteSalad, plainSoup], { query: 'tomato' }, 'en'))).toEqual(['tomato-soup', 'salad']);
  });

  it('counts a title match in any language', () => {
    const ayran = recipe({ id: 'ayran', title: { en: 'Salted yoghurt drink', tr: 'Ayran', de: 'Ayran' } });
    const bowl = recipe({ id: 'bowl', title: 'Breakfast bowl', ingredients: [{ qty: 1, unit: 'cup', name: 'ayran' }] });
    expect(ids(filterRecipes([bowl, ayran], { query: 'ayran' }, 'en'))).toEqual(['ayran', 'bowl']);
  });

  it('puts favourites first, then sorts by title', () => {
    expect(ids(filterRecipes([porridge, negroni, stew], {}, 'en'))).toEqual(['stew', 'negroni', 'porridge']);
  });

  it('sorts alphabetically in the language being shown', () => {
    const a = recipe({ id: 'cheese', title: { en: 'Cheesecake', tr: 'Peynirli kek', de: 'Käsekuchen' } });
    const b = recipe({ id: 'apple', title: { en: 'Apple pie', tr: 'Elmalı turta', de: 'Apfelkuchen' } });
    const c = recipe({ id: 'carrot', title: { en: 'Carrot cake', tr: 'Havuçlu kek', de: 'Rüblitorte' } });
    expect(ids(filterRecipes([a, b, c], {}, 'en'))).toEqual(['apple', 'carrot', 'cheese']);
    expect(ids(filterRecipes([a, b, c], {}, 'tr'))).toEqual(['apple', 'carrot', 'cheese']);
    expect(ids(filterRecipes([a, b, c], {}, 'de'))).toEqual(['apple', 'cheese', 'carrot']);
  });

  it('sorts Turkish letters where Turkish puts them', () => {
    // English files Ç with C; Turkish puts it after every C.
    const tea = recipe({ id: 'tea', title: 'Çay' });
    const cake = recipe({ id: 'cake', title: 'Cevizli kek' });
    expect(ids(filterRecipes([cake, tea], {}, 'en'))).toEqual(['tea', 'cake']);
    expect(ids(filterRecipes([tea, cake], {}, 'tr'))).toEqual(['cake', 'tea']);
  });

  it('does not change the array it was given', () => {
    const input = [porridge, stew, espresso];
    const copy = [...input];
    const result = filterRecipes(input, {}, 'en');
    expect(input).toEqual(copy);
    expect(result).not.toBe(input);
  });
});

describe('categoriesIn', () => {
  it('lists each category once, in the canonical order rather than the order seen', () => {
    const recipes = [
      recipe({ category: 'cocktail' }),
      recipe({ category: 'dessert' }),
      recipe({ category: 'soup' }),
      recipe({ category: 'dessert' }),
      recipe({ category: 'breakfast' }),
    ];
    expect(categoriesIn(recipes)).toEqual(['breakfast', 'soup', 'dessert', 'cocktail']);
  });

  it('is empty for no recipes', () => {
    expect(categoriesIn([])).toEqual([]);
  });
});

describe('buildShoppingLines', () => {
  const bread = recipe({
    id: 'bread',
    ingredients: [
      { qty: 500, unit: 'g', name: { en: 'flour', tr: 'un', de: 'Mehl' } },
      { qty: 1, unit: 'tsp', name: { en: 'salt', tr: 'tuz', de: 'Salz' } },
    ],
  });
  const pancakes = recipe({
    id: 'pancakes',
    ingredients: [
      { qty: 200, unit: 'g', name: { en: 'Flour', tr: 'Un', de: 'Mehl' } },
      { qty: 2, unit: null, name: { en: 'eggs', tr: 'yumurta', de: 'Eier' } },
      { qty: 1, unit: 'cup', name: { en: 'flour', tr: 'un', de: 'Mehl' } },
    ],
  });

  it('adds up the same ingredient in the same unit, after scaling each recipe', () => {
    const lines = buildShoppingLines([{ recipe: bread, factor: 2 }, { recipe: pancakes, factor: 0.5 }], 'en');
    // 500 g × 2 + 200 g × 0.5 = 1100 g
    expect(lines[0]).toEqual({ key: 'flour|g', name: 'flour', qty: 1100, unit: 'g', recipeIds: ['bread', 'pancakes'] });
  });

  it('keeps different units apart and keeps the order ingredients were first needed', () => {
    const lines = buildShoppingLines([{ recipe: bread, factor: 1 }, { recipe: pancakes, factor: 1 }], 'en');
    expect(lines.map((l) => l.key)).toEqual(['flour|g', 'salt|tsp', 'eggs|', 'flour|cup']);
    expect(lines[3]).toEqual({ key: 'flour|cup', name: 'flour', qty: 1, unit: 'cup', recipeIds: ['pancakes'] });
  });

  it('names lines in the language asked for', () => {
    const lines = buildShoppingLines([{ recipe: bread, factor: 1 }], 'de');
    expect(lines.map((l) => [l.key, l.name])).toEqual([['mehl|g', 'Mehl'], ['salz|tsp', 'Salz']]);
  });

  it('keeps the name from the first recipe that had it', () => {
    const lines = buildShoppingLines([{ recipe: pancakes, factor: 1 }, { recipe: bread, factor: 1 }], 'tr');
    expect(lines[0]).toMatchObject({ key: 'un|g', name: 'Un', qty: 700 });
  });

  it('gives a to-taste ingredient a line without a quantity, and joins it with others like it', () => {
    const a = recipe({ id: 'a', ingredients: [{ qty: null, unit: null, name: 'Black pepper' }] });
    const b = recipe({ id: 'b', ingredients: [{ qty: null, unit: null, name: 'black pepper' }] });
    expect(buildShoppingLines([{ recipe: a, factor: 3 }, { recipe: b, factor: 1 }], 'en')).toEqual([
      { key: 'black pepper|', name: 'Black pepper', qty: null, unit: null, recipeIds: ['a', 'b'] },
    ]);
  });

  it('joins a to-taste ingredient onto a counted line of the same name and keeps the count', () => {
    const a = recipe({ id: 'a', ingredients: [{ qty: null, unit: null, name: 'lemon' }] });
    const b = recipe({ id: 'b', ingredients: [{ qty: 2, unit: null, name: 'lemon' }] });
    expect(buildShoppingLines([{ recipe: a, factor: 1 }, { recipe: b, factor: 1 }], 'en')).toEqual([
      { key: 'lemon|', name: 'lemon', qty: 2, unit: null, recipeIds: ['a', 'b'] },
    ]);
  });

  it('files a to-taste ingredient under no unit even if one was set', () => {
    const a = recipe({ id: 'a', ingredients: [{ qty: null, unit: 'pinch', name: 'salt' }] });
    expect(buildShoppingLines([{ recipe: a, factor: 1 }], 'en')).toEqual([
      { key: 'salt|', name: 'salt', qty: null, unit: null, recipeIds: ['a'] },
    ]);
  });

  it('lists a recipe once per line even when it uses the ingredient twice or is added twice', () => {
    const syrup = recipe({
      id: 'syrup',
      ingredients: [
        { qty: 100, unit: 'g', name: 'sugar' },
        { qty: 50, unit: 'g', name: 'sugar' },
      ],
    });
    const lines = buildShoppingLines([{ recipe: syrup, factor: 1 }, { recipe: syrup, factor: 1 }], 'en');
    expect(lines).toEqual([{ key: 'sugar|g', name: 'sugar', qty: 300, unit: 'g', recipeIds: ['syrup'] }]);
  });

  it('is empty for no recipes', () => {
    expect(buildShoppingLines([], 'en')).toEqual([]);
  });

  it('does not change the recipes it was given', () => {
    const before = JSON.stringify(bread);
    buildShoppingLines([{ recipe: bread, factor: 3 }], 'en');
    expect(JSON.stringify(bread)).toBe(before);
  });
});
