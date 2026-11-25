import { describe, expect, it } from 'vitest';
import {
  cleanText,
  extractJsonLd,
  findRecipeNode,
  importFromHtml,
  parseDuration,
  parseInstructions,
  parseYield,
} from '../src/logic/importRecipe';

/** A page as recipe sites publish it: the recipe inside an @graph, next to other things. */
const SOUP_PAGE = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Linsensuppe &amp; Brot – Mein Blog</title>
  <script src="/analytics.js"></script>
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite"},{"@type":["Recipe"],"name":"Linsensuppe &amp; Brot","description":"<p>Eine einfache Suppe.</p>","recipeYield":"4 Portionen","prepTime":"PT10M","cookTime":"PT30M","recipeCategory":"Suppe","recipeIngredient":["200 g rote Linsen","1 Zwiebel, gewürfelt","1 EL Tomatenmark"],"recipeInstructions":[{"@type":"HowToStep","text":"Zwiebel anbraten."},{"@type":"HowToSection","name":"Kochen","itemListElement":[{"@type":"HowToStep","text":"Linsen zugeben."},{"@type":"HowToStep","text":"30 Minuten köcheln."}]}]}]}</script>
</head>
<body><h1>Linsensuppe &amp; Brot</h1></body>
</html>`;

const SOUP_URL = 'https://example.com/linsensuppe';

const ldScript = (json: string, attributes = 'type="application/ld+json"') => `<script ${attributes}>${json}</script>`;

describe('importFromHtml', () => {
  it('reads a whole recipe page into a draft', () => {
    expect(importFromHtml(SOUP_PAGE, SOUP_URL)).toEqual({
      kind: 'food',
      category: 'soup',
      title: 'Linsensuppe & Brot',
      summary: 'Eine einfache Suppe.',
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 30,
      difficulty: 1,
      ingredients: [
        { qty: 200, unit: 'g', name: 'rote Linsen' },
        { qty: 1, unit: null, name: 'Zwiebel', note: 'gewürfelt' },
        { qty: 1, unit: 'tbsp', name: 'Tomatenmark' },
      ],
      steps: [{ text: 'Zwiebel anbraten.' }, { text: 'Linsen zugeben.' }, { text: '30 Minuten köcheln.' }],
      tags: [],
      source: SOUP_URL,
    });
  });

  it('reads a cocktail as a drink and takes its only time from totalTime', () => {
    const page = ldScript(
      JSON.stringify({
        '@type': 'Recipe',
        name: 'Negroni',
        recipeCategory: 'Cocktail',
        totalTime: 'PT5M',
        recipeYield: 1,
        recipeIngredient: ['3 cl gin', '3 cl Campari', '3 cl sweet vermouth'],
        recipeInstructions: 'Stir with ice and strain.',
      }),
    );
    const draft = importFromHtml(page, 'https://example.com/negroni');
    expect(draft).toMatchObject({
      kind: 'drink',
      category: 'cocktail',
      prepMinutes: 0,
      cookMinutes: 5,
      servings: 1,
      steps: [{ text: 'Stir with ice and strain.' }],
    });
    expect(draft?.ingredients[1]).toEqual({ qty: 3, unit: 'cl', name: 'Campari' });
  });

  it('gives cooking the rest of the total when only prep and total are given', () => {
    const page = ldScript(JSON.stringify({ '@type': 'Recipe', name: 'Stew', prepTime: 'PT20M', totalTime: 'PT2H' }));
    expect(importFromHtml(page, 'u')).toMatchObject({ prepMinutes: 20, cookMinutes: 100 });
  });

  it('finds drinks from keywords, as a string or a list', () => {
    const coffee = ldScript(JSON.stringify({ '@type': 'Recipe', name: 'Flat white', keywords: 'Kaffee, Frühstück' }));
    expect(importFromHtml(coffee, 'u')).toMatchObject({ kind: 'drink', category: 'coffee' });
    const tea = ldScript(JSON.stringify({ '@type': 'Recipe', name: 'Pfefferminz', keywords: ['Getränke', 'Eistee'] }));
    expect(importFromHtml(tea, 'u')).toMatchObject({ kind: 'drink', category: 'tea' });
    const smoothie = ldScript(JSON.stringify({ '@type': 'Recipe', name: 'Green', recipeCategory: ['Smoothie'] }));
    expect(importFromHtml(smoothie, 'u')).toMatchObject({ kind: 'drink', category: 'cold' });
  });

  it('reads Turkish categories', () => {
    const tea = ldScript(JSON.stringify({ '@type': 'Recipe', name: 'Demlik', recipeCategory: 'Sıcak İçecekler, Çay' }));
    expect(importFromHtml(tea, 'u')).toMatchObject({ kind: 'drink', category: 'tea' });
    const soup = ldScript(JSON.stringify({ '@type': 'Recipe', name: 'Mercimek Çorbası' }));
    expect(importFromHtml(soup, 'u')).toMatchObject({ kind: 'food', category: 'soup' });
  });

  it('does not take a steak or cayenne for tea', () => {
    const page = ldScript(JSON.stringify({ '@type': 'Recipe', name: 'Pepper steak', keywords: 'steak, cayenne, dinner' }));
    expect(importFromHtml(page, 'u')).toMatchObject({ kind: 'food', category: 'main' });
  });

  it('picks the food category from category, keywords or name, in the order of the list', () => {
    const category = (data: object) => importFromHtml(ldScript(JSON.stringify({ '@type': 'Recipe', ...data })), 'u')?.category;
    expect(category({ name: 'Kartoffelsalat' })).toBe('salad');
    expect(category({ name: 'Käsekuchen' })).toBe('baking');
    expect(category({ name: 'Bananenbrot' })).toBe('baking');
    expect(category({ name: 'Sütlaç', recipeCategory: 'Tatlılar' })).toBe('dessert');
    expect(category({ name: 'Menemen', keywords: 'kahvaltı' })).toBe('breakfast');
    expect(category({ name: 'Haydari', recipeCategory: 'Meze' })).toBe('side');
    expect(category({ name: 'Brownies', recipeCategory: 'Dessert, Cake' })).toBe('dessert');
    expect(category({ name: 'Roast chicken' })).toBe('main');
  });

  it('cuts a long description at a word boundary with an ellipsis', () => {
    const summaryOf = (description: string) =>
      String(importFromHtml(ldScript(JSON.stringify({ '@type': 'Recipe', name: 'x', description })), 'u')?.summary);

    // 80 × "word " + "end" is 403 characters. The first 299 are 60 whole words with a
    // space right after them, so all 60 stay and the ellipsis makes it 300.
    expect(summaryOf(`${'word '.repeat(80)}end`)).toBe(`${'word '.repeat(60).trim()}…`);

    // One character more in front and character 299 falls inside the 60th word,
    // which is dropped rather than cut in half.
    const shifted = summaryOf(`x${'word '.repeat(80)}`);
    expect(shifted).toBe(`x${'word '.repeat(59).trim()}…`);
    expect(shifted.length).toBe(1 + 59 * 4 + 58 + 1); // x, 59 words, 58 spaces, …
  });

  it('keeps a description of exactly 300 characters whole', () => {
    const description = 'a'.repeat(300);
    const draft = importFromHtml(ldScript(JSON.stringify({ '@type': 'Recipe', name: 'x', description })), 'u');
    expect(draft?.summary).toBe(description);
  });

  it('fills sensible defaults when the recipe says almost nothing', () => {
    const draft = importFromHtml(ldScript('{"@type":"Recipe","name":"Toast"}'), 'https://example.com/t');
    expect(draft).toEqual({
      kind: 'food',
      category: 'main',
      title: 'Toast',
      summary: '',
      servings: 1,
      prepMinutes: 0,
      cookMinutes: 0,
      difficulty: 1,
      ingredients: [],
      steps: [],
      tags: [],
      source: 'https://example.com/t',
    });
  });

  it('cleans ingredient lines before parsing them', () => {
    const page = ldScript(
      JSON.stringify({ '@type': 'Recipe', name: 'x', recipeIngredient: ['<b>2</b> cups&nbsp;flour', '1 &frac12; tsp salt', ''] }),
    );
    expect(importFromHtml(page, 'u')?.ingredients).toEqual([
      { qty: 2, unit: 'cup', name: 'flour' },
      { qty: 1.5, unit: 'tsp', name: 'salt' },
    ]);
  });

  it('is null for a page without recipe data', () => {
    expect(importFromHtml('<html><body>Hello</body></html>', 'u')).toBeNull();
    expect(importFromHtml(ldScript('{"@type":"Article","name":"News"}'), 'u')).toBeNull();
  });
});

describe('extractJsonLd', () => {
  it('skips a block that is not valid JSON and reads the next one', () => {
    const html = ldScript('{"@type": "Recipe", "name": ') + ldScript('{"@type":"Recipe","name":"Second"}');
    expect(extractJsonLd(html)).toEqual([{ '@type': 'Recipe', name: 'Second' }]);
    expect(importFromHtml(html, 'u')?.title).toBe('Second');
  });

  it('opens up a top-level array', () => {
    const html = ldScript('[{"@type":"BreadcrumbList"},{"@type":"Recipe","name":"Pide"}]');
    expect(extractJsonLd(html)).toEqual([{ '@type': 'BreadcrumbList' }, { '@type': 'Recipe', name: 'Pide' }]);
  });

  it('opens up an @graph and drops its bare wrapper', () => {
    const html = ldScript('{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Börek"}]}');
    expect(extractJsonLd(html)).toEqual([{ '@type': 'WebPage' }, { '@type': 'Recipe', name: 'Börek' }]);
  });

  it('finds the script tag whatever the quoting, case and attribute order', () => {
    const json = '{"@type":"Recipe","name":"X"}';
    const variants = [
      `type='application/ld+json'`,
      `TYPE="APPLICATION/LD+JSON"`,
      `type=application/ld+json`,
      `id="schema" class="yoast-schema-graph" type="application/ld+json"`,
      `type = "application/ld+json" nonce="abc"`,
      `type=" application/ld+json "`,
    ];
    for (const attributes of variants) {
      expect(extractJsonLd(`<SCRIPT ${attributes}>\n${json}\n</SCRIPT >`)).toEqual([{ '@type': 'Recipe', name: 'X' }]);
    }
  });

  it('ignores scripts of other types, including a data-type attribute that looks right', () => {
    const json = '{"@type":"Recipe","name":"X"}';
    const html = `<script>var a = ${json};</script><script type="text/javascript">${json}</script><script data-type="application/ld+json">${json}</script>`;
    expect(extractJsonLd(html)).toEqual([]);
  });

  it('reads JSON with raw line breaks inside strings, as some plugins write it', () => {
    const html = ldScript('{"@type":"Recipe","name":"Two\nlines"}');
    expect(extractJsonLd(html)).toEqual([{ '@type': 'Recipe', name: 'Two lines' }]);
  });

  it('reads a block wrapped in CDATA', () => {
    const html = ldScript('//<![CDATA[\n{"@type":"Recipe","name":"Old"}\n//]]>');
    expect(extractJsonLd(html)).toEqual([{ '@type': 'Recipe', name: 'Old' }]);
  });

  it('drops values that are not objects and empty blocks', () => {
    expect(extractJsonLd(ldScript('42') + ldScript('') + ldScript('["a", null]'))).toEqual([]);
  });
});

describe('findRecipeNode', () => {
  it('finds a type given as a string or inside a list', () => {
    const recipe = { '@type': ['Recipe', 'NewsArticle'], name: 'R' };
    expect(findRecipeNode([{ '@type': 'WebSite' }, recipe])).toBe(recipe);
    const plain = { '@type': 'Recipe' };
    expect(findRecipeNode([null, 'x', plain])).toBe(plain);
  });

  it('takes the first recipe when there are several', () => {
    const first = { '@type': 'Recipe', name: 'first' };
    expect(findRecipeNode([first, { '@type': 'Recipe', name: 'second' }])).toBe(first);
  });

  it('accepts a fully written schema.org type', () => {
    const recipe = { '@type': 'http://schema.org/Recipe' };
    expect(findRecipeNode([recipe])).toBe(recipe);
  });

  it('looks inside a page whose main entity is the recipe', () => {
    const recipe = { '@type': 'Recipe', name: 'Inner' };
    expect(findRecipeNode([{ '@type': 'WebPage', mainEntity: recipe }])).toBe(recipe);
  });

  it('is null when nothing is a recipe', () => {
    expect(findRecipeNode([{ '@type': 'WebSite' }, { '@type': 'RecipeCollection' }, {}])).toBeNull();
    expect(findRecipeNode([])).toBeNull();
  });
});

describe('parseDuration', () => {
  it('reads minutes, hours, days and seconds', () => {
    expect(parseDuration('PT30M')).toBe(30);
    expect(parseDuration('PT1H')).toBe(60);
    expect(parseDuration('PT1H30M')).toBe(90);
    expect(parseDuration('P1DT2H')).toBe(1560);
    expect(parseDuration('P0DT0H45M')).toBe(45);
    expect(parseDuration('pt20m')).toBe(20);
  });

  it('rounds a total under a minute up to one, and anything else to the nearest minute', () => {
    expect(parseDuration('PT45S')).toBe(1);
    expect(parseDuration('PT1M29S')).toBe(1);
    expect(parseDuration('PT1M30S')).toBe(2);
    expect(parseDuration('PT0.5H')).toBe(30);
  });

  it('is 0 for anything that is not a duration', () => {
    for (const value of ['', 'PT', 'P', '30 minutes', 'PT30', 'T30M', 'PT0M', undefined, null, 30, {}]) {
      expect(parseDuration(value)).toBe(0);
    }
  });
});

describe('parseYield', () => {
  it('takes the first positive whole number', () => {
    expect(parseYield(4)).toBe(4);
    expect(parseYield('4')).toBe(4);
    expect(parseYield('Serves 6')).toBe(6);
    expect(parseYield('4-6 servings')).toBe(4);
    expect(parseYield(['8 slices', '8'])).toBe(8);
    expect(parseYield('0 or 2')).toBe(2);
    expect(parseYield({ '@type': 'QuantitativeValue', value: 12 })).toBe(12);
  });

  it('falls back to 1', () => {
    for (const value of [undefined, null, '', 'a loaf', 0, -3, NaN, [], ['some']]) {
      expect(parseYield(value)).toBe(1);
    }
  });
});

describe('cleanText', () => {
  it('decodes named and numeric entities', () => {
    expect(cleanText('Fish &amp; chips')).toBe('Fish & chips');
    expect(cleanText('&lt;3 &gt; &quot;x&quot; &#39;y&#39; &apos;z&apos;')).toBe('<3 > "x" \'y\' \'z\'');
    expect(cleanText('Mum&#8217;s and Dad&#x2019;s')).toBe('Mum’s and Dad’s');
    expect(cleanText('a&nbsp;b')).toBe('a b');
  });

  it('decodes only once', () => {
    expect(cleanText('&amp;lt;')).toBe('&lt;');
  });

  it('strips tags, keeping words apart where a block ended', () => {
    expect(cleanText('<p>One</p><p>Two <b>bold</b>.</p>')).toBe('One Two bold.');
    expect(cleanText('Line<br/>break')).toBe('Line break');
  });

  it('strips tags that arrived escaped', () => {
    expect(cleanText('&lt;p&gt;Eine Suppe.&lt;/p&gt;')).toBe('Eine Suppe.');
  });

  it('keeps a lone less-than sign', () => {
    expect(cleanText('Bake at < 200 °C')).toBe('Bake at < 200 °C');
  });

  it('tidies whitespace and turns non-text into nothing', () => {
    expect(cleanText('  a \n\t b  ')).toBe('a b');
    expect(cleanText(12)).toBe('12');
    expect(cleanText(undefined)).toBe('');
    expect(cleanText({ text: 'x' })).toBe('');
  });
});

describe('parseInstructions', () => {
  it('splits a single string on line breaks', () => {
    expect(parseInstructions('Mix.\n\nBake.\r\nCool.')).toEqual(['Mix.', 'Bake.', 'Cool.']);
  });

  it('splits a single line on numbered markers', () => {
    expect(parseInstructions('1. Mix. 2. Bake.')).toEqual(['Mix.', 'Bake.']);
    expect(parseInstructions('1) Mix. 2) Bake. 3) Eat.')).toEqual(['Mix.', 'Bake.', 'Eat.']);
  });

  it('does not split a sentence that merely contains a number and a full stop', () => {
    expect(parseInstructions('Bake for 1.5 hours, then add 2. Serve.')).toEqual(['Bake for 1.5 hours, then add 2. Serve.']);
  });

  it('drops numbering in front of lines', () => {
    expect(parseInstructions('1. Mix.\n2. Bake.')).toEqual(['Mix.', 'Bake.']);
  });

  it('splits on HTML line breaks and paragraphs', () => {
    expect(parseInstructions('<p>Mix.</p><p>Bake.</p>')).toEqual(['Mix.', 'Bake.']);
  });

  it('reads an array of strings', () => {
    expect(parseInstructions(['Mix.', ' ', 'Bake &amp; cool.'])).toEqual(['Mix.', 'Bake & cool.']);
  });

  it('reads HowToStep objects by text, falling back to name', () => {
    expect(
      parseInstructions([
        { '@type': 'HowToStep', text: 'Mix.', name: 'Mix' },
        { '@type': 'HowToStep', name: 'Bake.' },
        { '@type': 'HowToStep', text: '' },
      ]),
    ).toEqual(['Mix.', 'Bake.']);
  });

  it('flattens sections without turning their headings into steps', () => {
    expect(
      parseInstructions([
        { '@type': 'HowToSection', name: 'Dough', itemListElement: [{ '@type': 'HowToStep', text: 'Knead.' }] },
        { '@type': 'HowToSection', name: 'Filling', itemListElement: [{ text: 'Stir.' }, { text: 'Fill.' }] },
      ]),
    ).toEqual(['Knead.', 'Stir.', 'Fill.']);
  });

  it('reads a single step object', () => {
    expect(parseInstructions({ '@type': 'HowToStep', text: 'Only step.' })).toEqual(['Only step.']);
  });

  it('is empty for nothing usable', () => {
    expect(parseInstructions(undefined)).toEqual([]);
    expect(parseInstructions('')).toEqual([]);
    expect(parseInstructions(42)).toEqual([]);
  });
});
