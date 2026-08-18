# KnitStudio 🧶

An app for knitting: a technique guide, a pattern calculator that works out every row
from your own gauge, chart tools that turn a picture into colourwork, and a shopping
list that tells you how many balls to buy.

Runs on **iPhone, iPad and Mac** from one codebase — the Mac build is native SwiftUI
with a sidebar, not a stretched-up phone app. Everything runs on-device: no backend, no
account, no network access.

> **Android:** this is Swift and SwiftUI, which are Apple-only. Android needs a port, not
> a build setting. [`docs/platforms-and-release.md`](../docs/platforms-and-release.md)
> §5 sets out the four realistic options with effort estimates.

## What it does

### 1. Learn — the technique guide

Around fifty techniques with step-by-step instructions, organised the way knitting
actually divides up: cast-ons, basic stitches, increases, decreases, cables, lace,
colourwork, short rows, working in the round, finishing, and fixing mistakes. Each one
says what it is, when to reach for it, how to do it, and what tends to go wrong. Plus a
searchable glossary of pattern abbreviations.

### 2. Patterns — pick one or draw one

Twelve ready-made patterns (first scarf, classic beanie, top-down raglan, vanilla socks,
colourwork mittens, triangle shawl…) that fill in the calculator with sensible defaults.
Six built-in colourwork charts, and a chart editor for drawing your own.

### 3. Calculate — the plan

Enter your gauge and measurements and the app produces the whole pattern: cast-on count,
every shaping row with its stitch count, section by section, with the reasoning shown.

Eight project types: scarf, blanket, cowl, hat, top-down raglan sweater, socks, mittens,
triangle shawl.

Nothing is looked up in a size table. It is all derived from your swatch — see
[`docs/knitstudio.md`](../docs/knitstudio.md) for the maths, including the loop-length
yarn model and the compound raglan that stops sleeves coming out as balloons.

### 4. Import — bring outside patterns in

- **An image** becomes a colourwork chart: reduced to the number of yarn colours you
  want, sampled with real stitch proportions so the knitting is not squashed, and
  optionally snapped to the colours already in your stash.
- **A written pattern** (PDF or text) is read row by row and checked: the app threads the
  stitch count through from the cast-on and tells you exactly which row stops adding up.

### 5. Shop — the list

Per colour: metres, grams, and how many balls to buy, including a margin you control.
Colour proportions come from the chart when there is one, so the split is exact rather
than guessed. Plus the needles and notions the project actually needs.

## Building

```bash
brew install xcodegen          # 2.35 or newer
cd ios-knitstudio
xcodegen generate
open KnitStudio.xcodeproj
```

iOS 17+ and macOS 14+. Pick the destination in Xcode's toolbar — *My Mac* builds the
desktop app. Run the tests with **⌘U**.

For shipping it, see [how to release](../docs/platforms-and-release.md): what kind of
project this is, App Store and Mac App Store steps, and what Android would take.

## Layout

```
KnitStudio/
  Engine/         gauge, shaping, yarn model, one file per calculator
  Content/        technique guide, abbreviations, built-in patterns and charts
  Import/         image → chart, written pattern parser, file loading
  Platform/       the only file that knows iOS from macOS
  Views/          SwiftUI screens
  App/            entry point, store, persistence
KnitStudioTests/  engine, calculators, charts, parser, shopping list
```

The engine is plain Foundation with no UI imports, so it can be tested on its own — and
that is what made the Mac build cheap and would make an Android port tractable.
