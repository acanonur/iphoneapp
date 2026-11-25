# Tutam's design

The visual system, and where each decision lives in the code.

## The name and the mark

*Tutam* is Turkish for "a pinch": the measure every recipe ends with, for a
soup as much as for a cocktail. It is short, has no characters that need a
Turkish keyboard, and reads the same to an English or German speaker who has
never seen it.

The logo is a table from above: a cream ring for a plate, a saffron disc for a
glass sitting over the plate's rim, and a pinch of paprika — three grains —
scattered beside them, on a bottle-green cloth (`#1f3d2f`). Circles only, no
gradient, so it reads at the smallest icon size and survives the phone tinting
or flattening it.

It is drawn by [`scripts/make-icons.py`](../scripts/make-icons.py), which
writes the icon, the Android adaptive foreground and its monochrome layer, the
splash, the favicon and `assets/logo.svg`.

## The idea

Recipe apps are usually built around photographs, which makes a recipe you
typed in yourself look unfinished next to the ones that came with the app.
Tutam has no photographs. Every recipe gets a **tile in the colour of its
category with a drawn glyph** — saffron and a steaming bowl for soups, leaf
green for salads, aubergine and a cocktail glass for cocktails — so your
grandmother's recipe and a starter recipe look equally at home.

The one verified fact the market research turned up about design in this
category points the same way: the drink app Mixel builds its identity on
hand-made illustrations instead of photography.

## Tokens

All in [`src/ui/theme.ts`](../src/ui/theme.ts).

| Token | Light | Dark | Used for |
|---|---|---|---|
| `bg` | `#fbf7ee` | `#111a15` | the ground |
| `surface` | `#ffffff` | `#1a2620` | cards, inputs |
| `surfaceAlt` | `#f1ebdc` | `#24332b` | chips, segmented track, quiet buttons |
| `text` | `#1c2a22` | `#f3efe4` | text, the selected filter chip |
| `textMuted` | `#58665d` | `#a9b5ac` | secondary text |
| `accent` (bottle green) | `#24573f` | `#6fc496` | the primary action |
| `mark` (saffron) | `#c98a0b` | `#f0b84a` | favourites, timers, what you have |
| `danger` | `#b93a2e` | `#f07b72` | delete, hide |

Thirteen category colours (`categoryColors`) each pair a fill with an ink for
the glyph, in both themes.

Type is **Bricolage Grotesque** (600 / 700) for titles — it has enough
character to carry a screen with no imagery — and **Inter** (400 / 600 / 700)
for everything read or tapped, because quantities and fractions need a face
that stays out of the way. Cook mode sets step text at 24 pt, to be read from
arm's length.

Radii are 8 for small things, 14 for inputs, 22 for cards, and full pills for
buttons and chips. There is one soft shadow, under cards in light mode.

Light and dark follow the phone and are read once at launch (`scheme`), because
screens import tokens as plain values. A change made while the app is open
applies at the next launch.

## Icons

[`src/ui/icons.tsx`](../src/ui/icons.tsx) holds two sets drawn for this app on
one 24 × 24 grid with a round 1.9 stroke: about twenty interface icons, and one
glyph per category. They are built from circles, lines and arcs so the family
shares one hand; nothing is taken from an icon library.

## Components

[`src/ui/components.tsx`](../src/ui/components.tsx): `Screen`, `Header`,
`Card`, `Button` (primary, quiet, ghost, danger), `IconButton`, `Chip` and
`ChipRow`, `Seg`, `Field`, `Tick`, `Stepper`, `CategoryTile`, `EmptyState`.
Selected filter chips are solid ink; chips for things you *have* (favourites,
pantry items) are saffron, so the two meanings never share a colour.

## Screens

- **Recipes** — title and count, a search field, All / Food / Drinks, then
  chips for favourites, "under 30 min" and the categories actually present.
- **Recipe** — the category band, the facts in one row, tags, then ingredients
  with the servings stepper and the metric / US switch directly above them,
  the method, notes. The one primary action, *Start cooking*, is pinned to the
  bottom.
- **Cook mode** — full screen, one step, progress bar, ingredients on demand,
  a timer where the step has one.
- **Make** — the ingredient picker as saffron chips, then *Ready to make* and
  *One or two things short*, then the best next purchase.
- **Shopping** and **Settings** — plain lists.

## Language

Interface strings live in `src/i18n/{en,tr,de}.ts`; the `Strings` type makes a
missing key a compile error. Turkish uses a neutral polite register, German the
informal *du*. Units are written the way each language writes them
(`src/logic/units.ts`): `tbsp` / `yemek kaşığı` / `EL`, and a counted item
needs no unit word in English or German ("1 onion", "1 Zwiebel") but does in
Turkish ("1 adet soğan").

Worth a native speaker's second look, as flagged by the editing pass: Turkish
tab and button wording ("Hazırla" for the Make tab, "Elimde var", "Hemen
yapılabilir"), German "Einkauf" and "Sofort machbar", the shopper's names
chosen for Bergkäse and for rice in the Turkish recipes, and whether brand and
proper names in ingredient lists (Prosecco, Campari) should stay capitalised.

## Not done

- A layered icon for Apple's Icon Composer; `assets/logo.svg` has one shape per
  colour to start from.
- Photographs.
- Live theme switching without a relaunch.
