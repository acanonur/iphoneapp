# Ortak in Modernist

The app's visual system, and how the Claude Design handoff maps onto the code.

The design was made in [Claude Design](https://claude.ai/design) on the
**Modernist** system and handed off as HTML prototypes. Those prototypes are not
in this repo — they were mockups, not source. This is the record of what they
specified and where each decision now lives.

## The system in one paragraph

Ink on warm paper. Archivo throughout — 800 for anything structural, 400 for
body. **One red** (`#ec3013`) carries every emphasis, so there is no green for
success or amber for warning. **Zero radius** everywhere. Structure comes from
**rules** — 2px between sections, 1px between rows — rather than from cards,
borders or shadows. Everything is **flush left**, including button labels, with
icons pushed to the far edge.

Tokens live in [`mobile/src/ui/theme.ts`](../mobile/src/ui/theme.ts); the
components built from them are in
[`mobile/src/ui/components.tsx`](../mobile/src/ui/components.tsx).

## What changed, and why

| Before | Now | Reason |
|---|---|---|
| Dark palette, 12px radii | Light ground, zero radius | The system's ground and geometry |
| System font | Archivo (400 / 600 / 800) | The typeface *is* the identity here |
| Emoji tab icons | Lucide, drawn as SVG | Matching stroke weight to the 2px rule |
| Bordered rounded cards for every row | Ruled rows inside ruled sections | Modernist organises by alignment, not containers |
| Round avatars | Squares of solid ink | Nothing is rounded |
| Round tick circles | Squares that fill with the accent | Same |
| Pill chips for two modes | Segmented control | The system's own control for exclusive modes |
| Pill chips for many filters | Flush-left text tabs, 2px accent underline | Reads as a ledger heading rather than a toolbar |
| Coloured borders for notices | Surface panel with an accent kicker | The system has one red and no semantic palette |
| Blue / coral member colours | Ink and accent | Two people are the system's two inks |

Semantic colours were folded into the single accent: `danger` and `warning` both
became the red, and `success` became plain ink. That is a real loss of signal —
a mono palette cannot distinguish "done" from "urgent" by hue — so the screens
lean on weight, position and the kicker label instead.

## Screens

The handoff specified three screens in full, and they are built to match:

- **Calendar** — labelled quick-add with a hint line, calendar sets as text
  tabs, ruled day groups with a time column, member square per row.
  [`app/(tabs)/calendar.tsx`](../mobile/app/(tabs)/calendar.tsx)
- **Lists** — segmented To do / Shopping, buckets as underline tabs with counts,
  square tick at the left, overdue as a kicker card. Ticking draws a 2px accent
  rule through the title rather than fading it.
  [`app/(tabs)/lists.tsx`](../mobile/app/(tabs)/lists.tsx)
- **Notes** — filter field paired with a 44px square primary button, nested tags
  as system tags, pinned and exported marks.
  [`app/(tabs)/notes.tsx`](../mobile/app/(tabs)/notes.tsx)

Today, Archive and Trips were explicitly left for a later round. They were **not**
replaced with the prototype's "not in this round" placeholder — they work, and
removing working screens to match a mockup would be a regression. They inherit
the new tokens and components, so they are consistent but not individually
recomposed.

## The open decision

The handoff flags this itself, and it is worth repeating:

> Light ground is a real change: `theme.ts` keeps the app dark for one-handed
> use in a shop or in bed.

The redesign is light, and that is what is built. Whether a shared shopping list
should be light when you are using it in a dim supermarket at 8pm is a genuine
question the design leaves open. A dark Modernist variant is a natural next
round — the tokens are already centralised, so it is a `theme.ts` change plus a
pass over the few places that assume a light ground.

## Variations not built

The handoff offered four interaction variations alongside the by-the-book
screens. The by-the-book versions are what shipped; these remain available:

- **Quick-add as parsed tokens** — show what the parser understood as tags
  (kind · when · where) with an Add button, instead of the hint line.
- **Tick on the thumb side** — a 44px target on the right for one-handed use.
- **Tick the whole row** — no box at all; tap the to-do, `···` for dates.
- **Day strip on the calendar** — 08:00–22:00 per day with shared plans in ink,
  the other person's busy time in grey and free time hatched.
