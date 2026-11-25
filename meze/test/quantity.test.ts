import { describe, expect, it } from 'vitest';
import {
  baseFactor,
  convertAmount,
  displayQuantity,
  formatMinutes,
  formatNumber,
  roundAmount,
  scaleFactor,
  unitFamily,
  usesFractions,
} from '../src/logic/quantity';
import { UNITS } from '../src/model/types';

describe('unitFamily and baseFactor', () => {
  it('sorts every unit into a family', () => {
    const families = Object.fromEntries(UNITS.map((u) => [u, unitFamily(u)]));
    expect(families).toMatchObject({
      g: 'weight', kg: 'weight', oz: 'weight', lb: 'weight',
      ml: 'volume', cl: 'volume', l: 'volume', tsp: 'volume', tbsp: 'volume', cup: 'volume', floz: 'volume',
      piece: 'count', clove: 'count', slice: 'count', bunch: 'count', sprig: 'count',
      leaf: 'count', pinch: 'count', dash: 'count', can: 'count', stick: 'count',
    });
  });

  it('gives grams and millilitres per unit, and nothing for counts', () => {
    expect(baseFactor('kg')).toBe(1000);
    expect(baseFactor('cl')).toBe(10);
    expect(baseFactor('cup')).toBe(240);
    expect(baseFactor('piece')).toBeNull();
  });
});

describe('scaleFactor', () => {
  it('is wanted over original', () => {
    expect(scaleFactor(4, 6)).toBe(1.5);
    expect(scaleFactor(4, 2)).toBe(0.5);
  });

  it('falls back to 1 for anything that is not a positive number', () => {
    for (const [a, b] of [[0, 4], [4, 0], [-2, 4], [4, -1], [NaN, 4], [4, Infinity]] as const) {
      expect(scaleFactor(a, b)).toBe(1);
    }
  });
});

describe('convertAmount', () => {
  it('normalises metric weights', () => {
    expect(convertAmount({ qty: 200, unit: 'g' }, 'metric')).toEqual({ qty: 200, unit: 'g' });
    expect(convertAmount({ qty: 1500, unit: 'g' }, 'metric')).toEqual({ qty: 1.5, unit: 'kg' });
    expect(convertAmount({ qty: 0.4, unit: 'kg' }, 'metric')).toEqual({ qty: 400, unit: 'g' });
  });

  it('turns grams into ounces, and pounds from 16 oz up', () => {
    const small = convertAmount({ qty: 200, unit: 'g' }, 'us');
    expect(small.unit).toBe('oz');
    expect(small.qty).toBeCloseTo(7.05, 2);

    const large = convertAmount({ qty: 500, unit: 'g' }, 'us');
    expect(large.unit).toBe('lb');
    expect(large.qty).toBeCloseTo(1.1, 2);
  });

  it('brings US weights back to grams', () => {
    const grams = convertAmount({ qty: 8, unit: 'oz' }, 'metric');
    expect(grams.unit).toBe('g');
    expect(grams.qty).toBeCloseTo(226.8, 1);
  });

  it('normalises metric volumes', () => {
    expect(convertAmount({ qty: 250, unit: 'ml' }, 'metric')).toEqual({ qty: 250, unit: 'ml' });
    expect(convertAmount({ qty: 0.25, unit: 'l' }, 'metric')).toEqual({ qty: 250, unit: 'ml' });
    expect(convertAmount({ qty: 1500, unit: 'ml' }, 'metric')).toEqual({ qty: 1.5, unit: 'l' });
    expect(convertAmount({ qty: 2, unit: 'cup' }, 'metric')).toEqual({ qty: 480, unit: 'ml' });
  });

  it('keeps centilitres in metric and pours them as fluid ounces in US', () => {
    expect(convertAmount({ qty: 5, unit: 'cl' }, 'metric')).toEqual({ qty: 5, unit: 'cl' });
    const us = convertAmount({ qty: 5, unit: 'cl' }, 'us');
    expect(us.unit).toBe('floz');
    expect(us.qty).toBeCloseTo(1.69, 2);
  });

  it('uses fluid ounces under 60 ml and cups from there', () => {
    const shot = convertAmount({ qty: 30, unit: 'ml' }, 'us');
    expect(shot.unit).toBe('floz');
    expect(shot.qty).toBeCloseTo(1.01, 2);

    const glass = convertAmount({ qty: 250, unit: 'ml' }, 'us');
    expect(glass.unit).toBe('cup');
    expect(glass.qty).toBeCloseTo(1.04, 2);

    expect(convertAmount({ qty: 1.2, unit: 'l' }, 'us')).toEqual({ qty: 5, unit: 'cup' });
  });

  it('never converts spoons or counts', () => {
    for (const system of ['metric', 'us'] as const) {
      expect(convertAmount({ qty: 1, unit: 'tbsp' }, system)).toEqual({ qty: 1, unit: 'tbsp' });
      expect(convertAmount({ qty: 0.5, unit: 'tsp' }, system)).toEqual({ qty: 0.5, unit: 'tsp' });
      expect(convertAmount({ qty: 3, unit: 'piece' }, system)).toEqual({ qty: 3, unit: 'piece' });
    }
  });
});

describe('roundAmount', () => {
  it('rounds grams and millilitres by size', () => {
    expect(roundAmount(283.495, 'g')).toBe(285);
    expect(roundAmount(42.4, 'g')).toBe(42);
    expect(roundAmount(7.46, 'ml')).toBe(7.5);
  });

  it('keeps two decimals for the big units', () => {
    expect(roundAmount(2.2999, 'kg')).toBe(2.3);
    expect(roundAmount(1.2345, 'l')).toBe(1.23);
    expect(roundAmount(1.1023, 'lb')).toBe(1.1);
  });

  it('rounds centilitres to halves', () => {
    expect(roundAmount(4.4, 'cl')).toBe(4.5);
    expect(roundAmount(5.2, 'cl')).toBe(5);
  });

  it('rounds ounces to quarters, then halves from 10 up', () => {
    expect(roundAmount(7.05, 'oz')).toBe(7);
    expect(roundAmount(1.69, 'floz')).toBe(1.75);
    expect(roundAmount(10.58, 'oz')).toBe(10.5);
  });

  it('rounds spoons and cups to eighths below one and quarters above', () => {
    expect(roundAmount(0.3, 'tsp')).toBe(0.25);
    expect(roundAmount(0.4, 'tbsp')).toBe(0.375);
    expect(roundAmount(1.04, 'cup')).toBe(1);
    expect(roundAmount(1.6, 'cup')).toBe(1.5);
  });

  it('rounds counts to quarters, and pinches to whole ones', () => {
    expect(roundAmount(0.5, 'piece')).toBe(0.5);
    expect(roundAmount(1.3, 'clove')).toBe(1.25);
    expect(roundAmount(2.4, null)).toBe(2.5);
    expect(roundAmount(1.4, 'pinch')).toBe(1);
  });

  it('never rounds a real amount away to nothing', () => {
    expect(roundAmount(0.01, 'pinch')).toBe(1);
    expect(roundAmount(0.04, 'tsp')).toBe(0.125);
    expect(roundAmount(0.02, 'g')).toBe(0.1);
    expect(roundAmount(0, 'g')).toBe(0);
  });
});

describe('formatNumber', () => {
  it('writes fractions the way a cookbook does', () => {
    const fr = (n: number) => formatNumber(n, 'en', { fractions: true });
    expect(fr(0.5)).toBe('½');
    expect(fr(1.5)).toBe('1½');
    expect(fr(0.25)).toBe('¼');
    expect(fr(0.75)).toBe('¾');
    expect(fr(2.25)).toBe('2¼');
    expect(fr(0.125)).toBe('⅛');
    expect(fr(1 / 3)).toBe('⅓');
    expect(fr(2 / 3)).toBe('⅔');
    expect(fr(3)).toBe('3');
    expect(fr(2.999)).toBe('3');
  });

  it('falls back to a decimal when no fraction fits', () => {
    expect(formatNumber(1.2, 'en', { fractions: true })).toBe('1.2');
    expect(formatNumber(1.2, 'de', { fractions: true })).toBe('1,2');
  });

  it('uses a decimal comma in Turkish and German, and trims zeros', () => {
    expect(formatNumber(1.5, 'en')).toBe('1.5');
    expect(formatNumber(1.5, 'tr')).toBe('1,5');
    expect(formatNumber(1.5, 'de')).toBe('1,5');
    expect(formatNumber(1.25, 'de')).toBe('1,25');
    expect(formatNumber(2, 'tr')).toBe('2');
    expect(formatNumber(1200, 'en')).toBe('1200');
    expect(formatNumber(0.333333, 'en')).toBe('0.33');
  });
});

describe('usesFractions', () => {
  it('is true for spoons, cups and counts, false for measured units', () => {
    for (const unit of ['tsp', 'tbsp', 'cup', 'piece', 'clove', null] as const) expect(usesFractions(unit)).toBe(true);
    for (const unit of ['g', 'kg', 'ml', 'cl', 'l', 'oz', 'floz'] as const) expect(usesFractions(unit)).toBe(false);
  });
});

describe('displayQuantity', () => {
  const metric = { factor: 1, system: 'metric', lang: 'en' } as const;

  it('scales a weight', () => {
    expect(displayQuantity({ qty: 200, unit: 'g' }, { ...metric, factor: 1.5 })).toEqual({ text: '300', qty: 300, unit: 'g' });
  });

  it('halves a whole item into a fraction', () => {
    expect(displayQuantity({ qty: 1, unit: 'piece' }, { ...metric, factor: 0.5 })).toEqual({ text: '½', qty: 0.5, unit: 'piece' });
  });

  it('is empty for "to taste"', () => {
    expect(displayQuantity({ qty: null, unit: null }, metric)).toEqual({ text: '', qty: null, unit: null });
  });

  it('scales a bare count', () => {
    expect(displayQuantity({ qty: 2, unit: null }, { ...metric, factor: 2 })).toEqual({ text: '4', qty: 4, unit: null });
  });

  it('formats in the reader’s language', () => {
    expect(displayQuantity({ qty: 1.2, unit: 'l' }, { ...metric, lang: 'de' })).toEqual({ text: '1,2', qty: 1.2, unit: 'l' });
  });

  it('converts, then rounds, for US units', () => {
    expect(displayQuantity({ qty: 200, unit: 'g' }, { ...metric, system: 'us' })).toEqual({ text: '7', qty: 7, unit: 'oz' });
    expect(displayQuantity({ qty: 250, unit: 'ml' }, { ...metric, system: 'us' })).toEqual({ text: '1', qty: 1, unit: 'cup' });
    expect(displayQuantity({ qty: 5, unit: 'cl' }, { ...metric, system: 'us' })).toEqual({ text: '1.75', qty: 1.75, unit: 'floz' });
    expect(displayQuantity({ qty: 360, unit: 'ml' }, { ...metric, system: 'us' })).toEqual({ text: '1½', qty: 1.5, unit: 'cup' });
  });

  it('grows grams into kilograms when scaled far enough', () => {
    expect(displayQuantity({ qty: 400, unit: 'g' }, { ...metric, factor: 3, lang: 'tr' })).toEqual({ text: '1,2', qty: 1.2, unit: 'kg' });
  });
});

describe('formatMinutes', () => {
  it.each([[0, ''], [-5, ''], [25, '25 min'], [60, '1 h'], [90, '1 h 30 min'], [135, '2 h 15 min']])(
    '%i minutes reads as "%s"',
    (minutes, text) => {
      expect(formatMinutes(minutes)).toBe(text);
    },
  );
});
