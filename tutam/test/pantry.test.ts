import { describe, expect, it } from 'vitest';
import { bestNextBuy, ingredientKey, makeStatus, pantryCatalogue, STAPLE_KEYS, whatCanIMake } from '../src/logic/pantry';
import type { Ingredient, Recipe } from '../src/model/types';

function recipe(id: string, names: Ingredient['name'][]): Recipe {
  return {
    id,
    kind: 'food',
    category: 'main',
    title: id,
    summary: '',
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 10,
    difficulty: 1,
    ingredients: names.map((name) => ({ qty: 1, unit: null, name })),
    steps: [],
    tags: [],
  };
}

const pantry = (...keys: string[]) => new Set(keys);

describe('ingredientKey', () => {
  it('treats a described ingredient as the thing you would buy', () => {
    expect(ingredientKey('extra virgin olive oil')).toBe('olive oil');
    expect(ingredientKey('caster sugar')).toBe('sugar');
    expect(ingredientKey('plain flour')).toBe('flour');
    expect(ingredientKey('flat-leaf parsley')).toBe('parsley');
  });

  it('sees every kind of ice and water as the staples they are', () => {
    for (const name of ['ice cubes', 'crushed ice', 'ice-cold water', 'boiling water']) {
      expect(STAPLE_KEYS.has(ingredientKey(name))).toBe(true);
    }
    // Soda water is something you have to buy.
    expect(STAPLE_KEYS.has(ingredientKey('soda water'))).toBe(false);
  });

  it('uses the English version of a localised name', () => {
    expect(ingredientKey({ en: 'Fresh Mint', tr: 'Taze nane', de: 'Frische Minze' })).toBe('mint');
    expect(ingredientKey({ en: 'Lemons', tr: 'Limon', de: 'Zitronen' })).toBe('lemon');
  });

  it('folds a plain name', () => {
    expect(ingredientKey('Sarımsak')).toBe('sarimsak');
    expect(ingredientKey('  Crème  fraîche ')).toBe('creme fraiche');
  });

  it('drops words that only describe the state of the ingredient', () => {
    expect(ingredientKey('Hot Water')).toBe('water');
    expect(ingredientKey('fresh mint')).toBe('mint');
    expect(ingredientKey('Ripe Avocados')).toBe('avocado');
    expect(ingredientKey('large dried ground chopped small ripe cold warm chilli')).toBe('chilli');
  });

  it('keeps a descriptive word that is the whole name', () => {
    expect(ingredientKey('Hot')).toBe('hot');
  });

  it('only drops descriptive words when they stand alone', () => {
    expect(ingredientKey('hotdog sausages')).toBe('hotdog sausage');
  });

  it('makes the last word singular', () => {
    expect(ingredientKey('tomatoes')).toBe('tomato');
    expect(ingredientKey('bay leaves')).toBe('bay leaf');
    expect(ingredientKey('berries')).toBe('berry');
    expect(ingredientKey('eggs')).toBe('egg');
    expect(ingredientKey('lemons')).toBe('lemon');
    expect(ingredientKey('peas')).toBe('pea');
  });

  it('leaves other words, short words and double s alone', () => {
    expect(ingredientKey('eggs whites')).toBe('eggs white');
    expect(ingredientKey('glass')).toBe('glass');
    expect(ingredientKey('gin')).toBe('gin');
    expect(ingredientKey('gas')).toBe('gas');
  });

  it('matches olives, chives and cloves with their singular', () => {
    // A literal "ves" -> "f" would turn these into "olif", "chif" and "clof".
    expect(ingredientKey('olives')).toBe(ingredientKey('olive'));
    expect(ingredientKey('chives')).toBe('chive');
    expect(ingredientKey('garlic cloves')).toBe('garlic clove');
    expect(ingredientKey('loaves')).toBe('loaf');
  });

  it('is empty for an empty name', () => {
    expect(ingredientKey('')).toBe('');
  });
});

describe('STAPLE_KEYS', () => {
  it('holds the things every kitchen has', () => {
    expect([...STAPLE_KEYS].sort()).toEqual(['black pepper', 'ice', 'pepper', 'salt', 'water']);
  });
});

describe('makeStatus', () => {
  it('lists what is missing in recipe order and counts what is needed', () => {
    const shakshuka = recipe('shakshuka', ['eggs', 'tomatoes', 'onion', 'cumin']);
    expect(makeStatus(shakshuka, pantry('egg', 'onion'))).toEqual({
      recipeId: 'shakshuka',
      missing: ['tomato', 'cumin'],
      needed: 4,
      have: 2,
    });
  });

  it('never counts staples as needed or missing', () => {
    const pasta = recipe('pasta', ['Salt', 'Hot water', 'Black pepper', 'Ice', 'pepper', 'spaghetti']);
    expect(makeStatus(pasta, pantry())).toEqual({ recipeId: 'pasta', missing: ['spaghetti'], needed: 1, have: 0 });
  });

  it('counts an ingredient used twice in one recipe once', () => {
    const cake = recipe('cake', ['eggs', 'flour', 'Egg', { en: 'eggs', tr: 'yumurta', de: 'Eier' }, 'sugar']);
    expect(makeStatus(cake, pantry('flour'))).toEqual({ recipeId: 'cake', missing: ['egg', 'sugar'], needed: 3, have: 1 });
  });

  it('matches a localised ingredient against a plain one by its English name', () => {
    const tea = recipe('tea', [{ en: 'Fresh mint', tr: 'Taze nane', de: 'Frische Minze' }]);
    expect(makeStatus(tea, pantry(ingredientKey('mint'))).missing).toEqual([]);
  });
});

describe('whatCanIMake', () => {
  const omelette = recipe('omelette', ['eggs', 'butter', 'salt']);
  const salad = recipe('salad', ['tomatoes', 'cucumber', 'onion', 'parsley', 'lemons', 'olive oil']);
  const toast = recipe('toast', ['bread', 'butter']);
  const pancake = recipe('pancake', ['eggs', 'flour', 'milk', 'butter']);
  const iceWater = recipe('ice-water', ['ice', 'water']);

  it('orders by fewest missing, then by the bigger dish, then by the order given', () => {
    const have = pantry('egg', 'butter', 'tomato', 'cucumber', 'onion', 'parsley', 'lemon', 'olive oil', 'bread');
    const result = whatCanIMake([omelette, toast, salad, pancake], have);
    expect(result.map((s) => [s.recipeId, s.missing.length, s.needed])).toEqual([
      ['salad', 0, 6],
      ['omelette', 0, 2],
      ['toast', 0, 2],
      ['pancake', 2, 4],
    ]);
  });

  it('keeps input order between equally close recipes of the same size', () => {
    const have = pantry('egg', 'butter', 'bread');
    expect(whatCanIMake([toast, omelette], have).map((s) => s.recipeId)).toEqual(['toast', 'omelette']);
    expect(whatCanIMake([omelette, toast], have).map((s) => s.recipeId)).toEqual(['omelette', 'toast']);
  });

  it('drops recipes missing more than two ingredients by default', () => {
    // The salad misses all six, the pancake misses flour and milk.
    const result = whatCanIMake([salad, pancake], pantry('egg', 'butter'));
    expect(result.map((s) => s.recipeId)).toEqual(['pancake']);
  });

  it('takes a different limit', () => {
    expect(whatCanIMake([salad, pancake], pantry('egg', 'butter'), { maxMissing: 0 })).toEqual([]);
    expect(whatCanIMake([salad, pancake], pantry('egg', 'butter'), { maxMissing: 6 }).map((s) => s.recipeId)).toEqual([
      'pancake',
      'salad',
    ]);
  });

  it('drops recipes that need nothing but staples', () => {
    expect(whatCanIMake([iceWater, toast], pantry('bread', 'butter')).map((s) => s.recipeId)).toEqual(['toast']);
  });

  it('is empty with no recipes', () => {
    expect(whatCanIMake([], pantry('egg'))).toEqual([]);
  });
});

describe('pantryCatalogue', () => {
  const menemen = recipe('menemen', [
    { en: 'eggs', tr: 'yumurta', de: 'Eier' },
    { en: 'tomatoes', tr: 'domates', de: 'Tomaten' },
    { en: 'salt', tr: 'tuz', de: 'Salz' },
  ]);
  const shakshuka = recipe('shakshuka', [
    { en: 'tomatoes', tr: 'domates', de: 'Tomaten' },
    { en: 'Eggs', tr: 'Yumurta', de: 'Eier' },
    { en: 'cumin', tr: 'kimyon', de: 'Kreuzkümmel' },
    { en: 'tomatoes', tr: 'domates', de: 'Tomaten' },
  ]);
  const own = recipe('own', ['Eggs', 'Apfel']);

  it('counts each ingredient once per recipe and leaves out staples', () => {
    expect(pantryCatalogue([menemen, shakshuka], 'en')).toEqual([
      { key: 'egg', name: 'eggs', count: 2 },
      { key: 'tomato', name: 'tomatoes', count: 2 },
      { key: 'cumin', name: 'cumin', count: 1 },
    ]);
  });

  it('names ingredients in the language asked for, from the first recipe that uses them', () => {
    expect(pantryCatalogue([shakshuka, menemen], 'tr')).toEqual([
      { key: 'tomato', name: 'domates', count: 2 },
      { key: 'egg', name: 'Yumurta', count: 2 },
      { key: 'cumin', name: 'kimyon', count: 1 },
    ]);
  });

  it('sorts by count, then by name in that language', () => {
    // Eggs are in all three recipes, tomatoes in two; Apfel and Kreuzkümmel tie on one and go alphabetically.
    expect(pantryCatalogue([menemen, shakshuka, own], 'de').map((e) => [e.name, e.count])).toEqual([
      ['Eier', 3],
      ['Tomaten', 2],
      ['Apfel', 1],
      ['Kreuzkümmel', 1],
    ]);
  });

  it('shows plain names as written', () => {
    expect(pantryCatalogue([own], 'tr')).toEqual([
      { key: 'apfel', name: 'Apfel', count: 1 },
      { key: 'egg', name: 'Eggs', count: 1 },
    ]);
  });
});

describe('bestNextBuy', () => {
  it('picks the ingredient that completes the most recipes', () => {
    const recipes = [
      recipe('1', ['bread', 'tomato']),
      recipe('2', ['bread', 'butter']),
      recipe('3', ['tomatoes', 'cucumber', 'mozzarella']),
      recipe('4', ['bread', 'butter', 'jam']),
    ];
    // Butter completes 2 and 4. Tomato completes only 1: recipe 3 also lacks mozzarella.
    expect(bestNextBuy(recipes, pantry('bread', 'cucumber', 'jam'))).toEqual({ key: 'butter', unlocks: ['2', '4'] });
  });

  it('breaks a tie by which ingredient came first', () => {
    const recipes = [recipe('a', ['gin', 'tonic']), recipe('b', ['gin', 'vermouth'])];
    expect(bestNextBuy(recipes, pantry('gin'))).toEqual({ key: 'tonic', unlocks: ['a'] });
  });

  it('is null when every recipe is two or more ingredients away', () => {
    const recipes = [recipe('1', ['eggs', 'flour', 'milk']), recipe('2', ['rice', 'beans'])];
    expect(bestNextBuy(recipes, pantry('egg'))).toBeNull();
  });

  it('ignores recipes that can already be made', () => {
    const recipes = [recipe('1', ['salt', 'tomato']), recipe('2', ['salt', 'basil', 'tomato'])];
    expect(bestNextBuy(recipes, pantry('tomato'))).toEqual({ key: 'basil', unlocks: ['2'] });
    expect(bestNextBuy([recipes[0]!], pantry('tomato'))).toBeNull();
  });

  it('never suggests buying a staple', () => {
    expect(bestNextBuy([recipe('1', ['salt', 'water'])], pantry())).toBeNull();
  });
});
