import { describe, expect, it } from 'vitest';
import { parseIngredient, parseQuantity, UNIT_ALIASES } from '../src/logic/parseIngredient';
import { UNITS } from '../src/model/types';

describe('parseQuantity', () => {
  it('reads whole numbers and decimals with a point or a comma', () => {
    expect(parseQuantity('2 eggs')).toEqual({ qty: 2, rest: 'eggs' });
    expect(parseQuantity('1.5 l')).toEqual({ qty: 1.5, rest: 'l' });
    expect(parseQuantity('1,5 l')).toEqual({ qty: 1.5, rest: 'l' });
    expect(parseQuantity('250')).toEqual({ qty: 250, rest: '' });
  });

  it('reads fractions and mixed numbers', () => {
    expect(parseQuantity('1/2 cup')).toEqual({ qty: 0.5, rest: 'cup' });
    expect(parseQuantity('1 1/2 cups')).toEqual({ qty: 1.5, rest: 'cups' });
    expect(parseQuantity('3/4 tsp')).toEqual({ qty: 0.75, rest: 'tsp' });
  });

  it('reads Unicode fractions, alone or after a whole number', () => {
    expect(parseQuantity('½ tsp')).toEqual({ qty: 0.5, rest: 'tsp' });
    expect(parseQuantity('1½ tbsp')).toEqual({ qty: 1.5, rest: 'tbsp' });
    expect(parseQuantity('2 ¼ cups')).toEqual({ qty: 2.25, rest: 'cups' });
    expect(parseQuantity('⅛ tsp')).toEqual({ qty: 0.125, rest: 'tsp' });
  });

  it('takes the first number of a range', () => {
    expect(parseQuantity('2-3 tomatoes')).toEqual({ qty: 2, rest: 'tomatoes' });
    expect(parseQuantity('2 – 3 tomatoes')).toEqual({ qty: 2, rest: 'tomatoes' });
    expect(parseQuantity('1½–2 cups')).toEqual({ qty: 1.5, rest: 'cups' });
  });

  it('leaves a unit glued to the number at the start of the rest', () => {
    expect(parseQuantity('200g flour')).toEqual({ qty: 200, rest: 'g flour' });
    expect(parseQuantity('2EL Öl')).toEqual({ qty: 2, rest: 'EL Öl' });
  });

  it('is null when the text does not start with a number', () => {
    expect(parseQuantity('salt')).toBeNull();
    expect(parseQuantity('a pinch of salt')).toBeNull();
    expect(parseQuantity('')).toBeNull();
  });

  it('does not divide by zero', () => {
    expect(parseQuantity('1/0 cup')).toEqual({ qty: 1, rest: '/0 cup' });
  });
});

describe('UNIT_ALIASES', () => {
  it('only maps to real units', () => {
    for (const unit of Object.values(UNIT_ALIASES)) expect(UNITS).toContain(unit);
  });

  it('holds the multi-word units as plain phrases', () => {
    expect(UNIT_ALIASES['yemek kaşığı']).toBe('tbsp');
    expect(UNIT_ALIASES['çay kaşığı']).toBe('tsp');
    expect(UNIT_ALIASES['tatlı kaşığı']).toBe('tsp');
    expect(UNIT_ALIASES['su bardağı']).toBe('cup');
    expect(UNIT_ALIASES['fl oz']).toBe('floz');
    expect(UNIT_ALIASES['fluid ounces']).toBe('floz');
  });

  it('is all lower case', () => {
    for (const key of Object.keys(UNIT_ALIASES)) expect(key).toBe(key.toLowerCase());
  });
});

describe('parseIngredient in English', () => {
  it('reads weight with or without a space', () => {
    expect(parseIngredient('200 g flour')).toEqual({ qty: 200, unit: 'g', name: 'flour' });
    expect(parseIngredient('200g flour')).toEqual({ qty: 200, unit: 'g', name: 'flour' });
    expect(parseIngredient('250ml milk')).toEqual({ qty: 250, unit: 'ml', name: 'milk' });
  });

  it('reads spoons and cups with fractions', () => {
    expect(parseIngredient('1 1/2 cups milk')).toEqual({ qty: 1.5, unit: 'cup', name: 'milk' });
    expect(parseIngredient('½ tsp salt')).toEqual({ qty: 0.5, unit: 'tsp', name: 'salt' });
    expect(parseIngredient('1½ tbsp olive oil')).toEqual({ qty: 1.5, unit: 'tbsp', name: 'olive oil' });
  });

  it('accepts capitals and a full stop after the unit', () => {
    expect(parseIngredient('2 Tbsp. honey')).toEqual({ qty: 2, unit: 'tbsp', name: 'honey' });
    expect(parseIngredient('1 Cup rice')).toEqual({ qty: 1, unit: 'cup', name: 'rice' });
  });

  it('drops "of" and "of the" after the unit', () => {
    expect(parseIngredient('2 cups of sugar')).toEqual({ qty: 2, unit: 'cup', name: 'sugar' });
    expect(parseIngredient('1 pinch of the good salt')).toEqual({ qty: 1, unit: 'pinch', name: 'good salt' });
  });

  it('does not strip "of" from the middle of a word', () => {
    expect(parseIngredient('100 g offal')).toEqual({ qty: 100, unit: 'g', name: 'offal' });
  });

  it('reads two-word units before one-word ones', () => {
    expect(parseIngredient('2 fl oz gin')).toEqual({ qty: 2, unit: 'floz', name: 'gin' });
    expect(parseIngredient('1 fluid ounce lime juice')).toEqual({ qty: 1, unit: 'floz', name: 'lime juice' });
  });

  it('reads bar and pantry units', () => {
    expect(parseIngredient('5 cl gin')).toEqual({ qty: 5, unit: 'cl', name: 'gin' });
    expect(parseIngredient('1 can chickpeas')).toEqual({ qty: 1, unit: 'can', name: 'chickpeas' });
    expect(parseIngredient('2 dashes Angostura bitters')).toEqual({ qty: 2, unit: 'dash', name: 'Angostura bitters' });
  });

  it('counts things that have no unit', () => {
    expect(parseIngredient('2 eggs')).toEqual({ qty: 2, unit: null, name: 'eggs' });
    expect(parseIngredient('2-3 tomatoes')).toEqual({ qty: 2, unit: null, name: 'tomatoes' });
  });

  it('keeps a line without a number whole', () => {
    expect(parseIngredient('salt')).toEqual({ qty: null, unit: null, name: 'salt' });
    expect(parseIngredient('Ice cubes')).toEqual({ qty: null, unit: null, name: 'Ice cubes' });
  });

  it('treats a unit word with nothing after it as the ingredient', () => {
    expect(parseIngredient('2 cloves')).toEqual({ qty: 2, unit: null, name: 'cloves' });
    expect(parseIngredient('3 Leaves')).toEqual({ qty: 3, unit: null, name: 'Leaves' });
  });
});

describe('parseIngredient notes', () => {
  it('strips a bullet and takes everything after the first comma as the note', () => {
    expect(parseIngredient('- 1 onion, finely chopped')).toEqual({ qty: 1, unit: null, name: 'onion', note: 'finely chopped' });
    expect(parseIngredient('• 2 carrots, peeled, grated')).toEqual({ qty: 2, unit: null, name: 'carrots', note: 'peeled, grated' });
    expect(parseIngredient('* 1 lemon')).toEqual({ qty: 1, unit: null, name: 'lemon' });
    expect(parseIngredient('– 1 lime')).toEqual({ qty: 1, unit: null, name: 'lime' });
  });

  it('takes a closing bracket as the note', () => {
    expect(parseIngredient('400 g tomatoes (canned)')).toEqual({ qty: 400, unit: 'g', name: 'tomatoes', note: 'canned' });
  });

  it('does not split on a comma inside brackets', () => {
    expect(parseIngredient('400 g tomatoes (canned, chopped)')).toEqual({
      qty: 400,
      unit: 'g',
      name: 'tomatoes',
      note: 'canned, chopped',
    });
  });

  it('keeps both a bracket and a comma note', () => {
    expect(parseIngredient('400 g tomatoes (canned), drained')).toEqual({
      qty: 400,
      unit: 'g',
      name: 'tomatoes',
      note: 'canned, drained',
    });
  });

  it('finds a note on a line without a quantity', () => {
    expect(parseIngredient('salt, to taste')).toEqual({ qty: null, unit: null, name: 'salt', note: 'to taste' });
  });

  it('keeps the note when the unit word turns out to be the ingredient', () => {
    expect(parseIngredient('2 cloves (crushed)')).toEqual({ qty: 2, unit: null, name: 'cloves', note: 'crushed' });
  });

  it('collapses stray whitespace', () => {
    expect(parseIngredient('   200   g    plain   flour  ')).toEqual({ qty: 200, unit: 'g', name: 'plain flour' });
  });

  it('copes with an empty line', () => {
    expect(parseIngredient('')).toEqual({ qty: null, unit: null, name: '' });
  });
});

describe('parseIngredient in German', () => {
  it('reads Esslöffel and Teelöffel abbreviations, glued or not', () => {
    expect(parseIngredient('2 EL Olivenöl')).toEqual({ qty: 2, unit: 'tbsp', name: 'Olivenöl' });
    expect(parseIngredient('2EL Olivenöl')).toEqual({ qty: 2, unit: 'tbsp', name: 'Olivenöl' });
    expect(parseIngredient('1 TL Salz')).toEqual({ qty: 1, unit: 'tsp', name: 'Salz' });
  });

  it('reads counted units', () => {
    expect(parseIngredient('1 Prise Zucker')).toEqual({ qty: 1, unit: 'pinch', name: 'Zucker' });
    expect(parseIngredient('3 Zehen Knoblauch')).toEqual({ qty: 3, unit: 'clove', name: 'Knoblauch' });
    expect(parseIngredient('1 Dose Kichererbsen')).toEqual({ qty: 1, unit: 'can', name: 'Kichererbsen' });
    expect(parseIngredient('2 Blätter Gelatine')).toEqual({ qty: 2, unit: 'leaf', name: 'Gelatine' });
  });

  it('reads a decimal comma', () => {
    expect(parseIngredient('1,5 l Wasser')).toEqual({ qty: 1.5, unit: 'l', name: 'Wasser' });
  });

  it('leaves a line without a number as written', () => {
    expect(parseIngredient('Salz und Pfeffer')).toEqual({ qty: null, unit: null, name: 'Salz und Pfeffer' });
  });
});

describe('parseIngredient in Turkish', () => {
  it('reads the two-word spoon and glass units', () => {
    expect(parseIngredient('1 yemek kaşığı domates salçası')).toEqual({ qty: 1, unit: 'tbsp', name: 'domates salçası' });
    expect(parseIngredient('2 su bardağı un')).toEqual({ qty: 2, unit: 'cup', name: 'un' });
    expect(parseIngredient('1 çay kaşığı kimyon')).toEqual({ qty: 1, unit: 'tsp', name: 'kimyon' });
    expect(parseIngredient('1 tatlı kaşığı pul biber')).toEqual({ qty: 1, unit: 'tsp', name: 'pul biber' });
  });

  it('reads Turkish units written in capitals', () => {
    expect(parseIngredient('1 YEMEK KAŞIĞI tereyağı')).toEqual({ qty: 1, unit: 'tbsp', name: 'tereyağı' });
  });

  it('reads counted units', () => {
    expect(parseIngredient('2 diş sarımsak')).toEqual({ qty: 2, unit: 'clove', name: 'sarımsak' });
    expect(parseIngredient('1 demet maydanoz')).toEqual({ qty: 1, unit: 'bunch', name: 'maydanoz' });
    expect(parseIngredient('3 adet yumurta')).toEqual({ qty: 3, unit: 'piece', name: 'yumurta' });
  });

  it('reads the one-word glass without mistaking the next word', () => {
    expect(parseIngredient('1 bardak süt')).toEqual({ qty: 1, unit: 'cup', name: 'süt' });
  });

  it('reads a decimal comma with a note', () => {
    expect(parseIngredient('1,5 kg kuzu eti, kuşbaşı')).toEqual({ qty: 1.5, unit: 'kg', name: 'kuzu eti', note: 'kuşbaşı' });
  });
});
