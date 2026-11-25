# Hane in Two Inks

The app's visual system, and where each decision lives in the code.

## The name and the mark

The app was called Ortak (Turkish: "shared"). It is now Hane — Turkish for
"household". It was briefly Ikimiz, "the two of us", which was dropped because
a household is not always two people.

The logo is a lowercase h in the app's two inks: a coral stem and a teal arch
on a dark plum ground (`#231f2b`). Two inks making one letter, in a shape that
stands like a doorway.

It is drawn by a script, [`scripts/make-icons.py`](../scripts/make-icons.py),
not kept as an opaque binary. Run it to regenerate `mobile/assets/`: the icon,
the Android adaptive foreground and its monochrome layer, the splash, the
favicon and `logo.svg`. The same geometry is drawn in-app by
[`mobile/src/ui/Logo.tsx`](../mobile/src/ui/Logo.tsx).

The mark is two solid shapes with no gradient, so it stays recognisable when
the OS tints or desaturates icons.

## The system in one paragraph

A warm oat ground (`#faf6ef`) with white rounded cards a step above it. Every
member has an ink, and the first two carry the interface: coral (`#c9432a`) is
the primary action and the first person; teal (`#167a78`) is the second person
and the secondary highlight. Fraunces 600, a
soft serif, sets screen titles; DM Sans (400 / 600 / 700) sets everything else.
Radii are 8 for chips, 14 for inputs, 20 for cards and full pills for buttons.
Semantic colours exist again: green for done, amber for due soon, red for
overdue and destructive. There is one soft shadow, under cards in light mode,
and none in dark.

Tokens live in [`mobile/src/ui/theme.ts`](../mobile/src/ui/theme.ts); the
components built from them are in
[`mobile/src/ui/components.tsx`](../mobile/src/ui/components.tsx).

## Palette

| Token | Light | Dark | Used for |
|---|---|---|---|
| `bg` | `#faf6ef` | `#16131c` | the ground |
| `surface` | `#ffffff` | `#211d2a` | cards, inputs |
| `surfaceAlt` | `#f1eadf` | `#2b2636` | segmented track, quiet buttons, chips |
| `text` | `#231f2b` | `#f4efe8` | text, and the active chip |
| `textMuted` | `#655e70` | `#b0a9bb` | secondary text |
| `accent` (coral) | `#c9432a` | `#f0704f` | primary button, first member |
| `accent2` (teal) | `#167a78` | `#4cb7b1` | second member |
| `success` | `#2a744a` | `#6cc48e` | ticked items, money you are owed |
| `warning` | `#925809` | `#e3a94a` | due soon |
| `danger` | `#bf3030` | `#f07b72` | overdue, delete |

Contrast was computed against WCAG AA for the light palette: body text on the
ground is 15:1, muted text 5.8:1, coral 4.5:1 and teal 4.8:1 on the ground, and
white on the coral button 4.9:1. The dark palette's text and inks are all above
5:1 on their grounds.

## Light and dark

The palette follows the phone's appearance setting. It is read once at launch
(`scheme` in `theme.ts`), because every screen imports tokens as plain values
with no provider or hook. The consequence, stated honestly: switching the phone
between light and dark while the app is open takes effect the next time the app
is launched.

This answers the question the previous design left open — whether a shopping
list should be light in a dim supermarket at 8pm.

## What changed from Modernist, and why

| Before | Now | Reason |
|---|---|---|
| Zero radius, 2px rules | Rounded cards, hairlines | "Busy, too many options" is the complaint that turned up in the market research; grouping by card is calmer than a ruled ledger |
| One red for everything | An ink per person, plus semantic colours | People need colours of their own, and a single accent could not tell "done" from "urgent" |
| Archivo 800, uppercase kickers | Fraunces titles, sentence-case labels | Warmer; reads as a household notebook rather than a form |
| Square member tiles in ink and red | Round avatars in coral and teal | A member's colour now means the same person on every screen |
| Six tabs | Five tabs | The chat archive moved under Notes; fewer destinations |
| Trips tab | Money tab | Everyday shared costs as well as holidays |
| Light only | Light and dark | See above |

## Navigation

Five tabs: Today, Calendar, Lists, Notes, Money. The tab bar is a rounded bar
floating above the bottom edge; the active tab is a coral-tinted pill. Lists has
three segments: To do, Chores, Shopping. The chat archive opens from the archive
icon in the Notes header, and its messages still turn up in Search.

## Member colours

Colours are assigned by join order on the phone (`memberInk` in `theme.ts`,
applied in the store), not taken from the server, so both phones and both themes
agree: first to join is coral, second is teal, then plum, gold, blue and rose.
Friends who exist only on a ledger continue the same sequence after the first
two.

## Not done

- Live theme switching without a relaunch.
- A layered icon file for Apple's Icon Composer. The flat icon is accepted by
  the App Store, but a layered one renders better in the tinted and clear icon
  modes; `mobile/assets/logo.svg` has the mark as one shape per ink to start
  from.
- Screens beyond the shared components were not individually recomposed. They
  take the new tokens and components, so they are consistent, but Calendar,
  Notes and the ledger detail keep the row structure they had.
- Widgets, which need native targets.
