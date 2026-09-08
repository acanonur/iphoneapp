# KnitStudio — how the numbers are worked out

Every figure the app shows is derived from one input: **your gauge**. Nothing is looked
up in a table of standard sizes, because no table knows how tightly you knit.

## Gauge

A gauge is stored as stitches and rows per 10 cm, whatever units it was entered in.

```
stitch width = 10 / stitches per 10 cm      (cm)
row height   = 10 / rows per 10 cm          (cm)
```

Row gauge matters more than knitters expect: it sets every length, every shaping
interval, and the depth of every yoke and crown.

## Yarn estimate

Yarn is not estimated from a lookup table. It comes from **loop length** — how much yarn
one stitch actually consumes — using Munden's relaxed plain-knit relations for weft
knitting:

```
courses per unit length = Kc / l
wales   per unit length = Kw / l
```

where `l` is the loop length and `Kc = 5.0`, `Kw = 3.8` for dry-relaxed plain knit.
Solving each for `l` gives two independent estimates from the knitter's own swatch, and
the app averages them:

```
l = ( Kw / (sts per cm)  +  Kc / (rows per cm) ) / 2
```

The point of deriving `l` from the swatch is that it is **self-calibrating**: a knitter
with a tight gauge gets a shorter loop length and a correspondingly different yardage,
without anyone having to guess a yarn category.

Total yarn is then just the stitch count, weighted by what the fabric is doing:

```
metres = Σ (stitches × fabric factor) × l / 100
grams  = metres ÷ (ball metres ÷ ball grams)
balls  = ceil( metres × (1 + margin) ÷ ball metres )
```

### Fabric factors

Relative to stockinette at the same measured gauge:

| Fabric | Factor | Why |
|---|---|---|
| Stockinette | 1.00 | The baseline. |
| Garter | 1.00 | Its extra yarn already shows up in the row gauge. |
| Ribbing, seed | 1.05 | Pulls in, so more yarn per finished cm. |
| Mosaic / slip stitch | 1.10 | Slipped stitches carry yarn over two rows. |
| Stranded colourwork | 1.18 | Floats across the back. |
| Cables | 1.25 | Crossings compress the fabric. |
| Lace | 0.90 | Yarn-overs are holes, not yarn. |
| Brioche | 1.85 | Every row is worked twice. |

### Does it agree with reality?

The model was checked against published yardage ranges before being written, at four
yarn weights. Adult size M pullover, 100 cm chest:

| Yarn | Model | Commonly published |
|---|---|---|
| Fingering | 313 g | 300–400 g |
| DK | 400 g | 400–500 g |
| Worsted | 412 g | 400–500 g |
| Aran | ~460 g | 450–550 g |

Cross-checks that are asserted in the test suite:

- **Areal density** (g/m² of fabric) lands between 300 and 580 g/m² across yarn weights,
  and bulky fabric is clearly heavier per square metre than fingering.
- **Loop length is 3–4.6× the stitch width** at every yarn weight — a knitted loop is
  always several times longer than the stitch is wide.
- An adult beanie comes out at 35–90 g, and a pair of socks at 60–105 g.

## Garment shaping

### Hat crown

The crown caps a circle of radius `r = brim circumference / 2π`. A knitted crown sits
between a flat disc (depth `r`) and a hemisphere (depth `πr/2`); the app targets `1.15r`
and derives the schedule from it:

```
decrease rounds = stitches per section − 1
plain rounds    = min(decrease rounds, target rounds − decrease rounds)
```

Capping plain rounds at one per decrease round is what real crown schedules do. At a
worsted gauge on a 56 cm head this falls out as *decrease every other round* — exactly
the classic instruction — without that being hard-coded anywhere.

### Compound raglan

A plain top-down raglan grows the body and the sleeves at the same rate, because every
increase round adds two stitches to every section. That is why plain raglans are famous
for balloon sleeves: at a DK gauge, a 100 cm chest gives a **47 cm** upper sleeve for a
34 cm arm.

KnitStudio works out the two requirements separately:

```
body increase rounds   = (body half target − front) / 2
sleeve increase rounds = (upper arm target − underarm CO − sleeve start) / 2
```

Rounds where both are needed are worked as full 8-stitch increase rounds. The surplus is
worked as **body-only** rounds (both M1s placed on the body side of each raglan line, 4
stitches) or **sleeve-only** rounds. The sleeve then lands within 1.5 cm of the measured
upper arm at every gauge tested, and the body hits the requested chest exactly.

The yoke depth is reconciled against the armhole separately. Increasing every other round
is the default; if that would make the yoke too deep, some increase rounds are worked
back-to-back, and if too shallow, plain rounds are added. The yoke lands within one row
of `chest × 0.21` at every gauge tested.

### Socks

Cuff down, with a square heel flap (as many rows as heel stitches), a short-row heel
turn, one gusset stitch picked up per two flap rows, and a wedge toe that decreases every
other round at first and every round for the last third.

## Importing

### Image → colourwork chart

1. The image is drawn down to the grid size with high-quality interpolation, which
   area-averages each cell. Drawing the `UIImage` rather than its `CGImage` applies the
   orientation, so sideways photos are not rotated.
2. Colours are reduced by **median cut** seeding, refined by **k-means** (Lloyd's
   algorithm). Distance is weighted 0.30/0.59/0.11 across R/G/B, since green dominates
   perceived brightness.
3. Optional Floyd–Steinberg dithering preserves gradients.
4. The palette is sorted by usage, so index 0 is the main colour.
5. Colours can snap to the nearest yarn in your stash.

**Row count matters.** A knit stitch is wider than it is tall, so a square image needs
more rows than stitches or the knitted result comes out squashed:

```
rows = (image height / image width) × stitches × stitch width / row height
```

At a DK gauge a square image at 40 stitches wide needs 55 rows, not 40.

### Written pattern → checked rows

The parser reads patterns written as `Row 1 (RS): k2, p2…`, expands bracket repeats
(`[k10, k2tog] 8 times`) and star repeats (`*p2, k2; rep from * to last 3 sts, k3`), and
threads the stitch count through every row from the cast-on. It reports:

- rows whose repeat does not divide evenly into the stitches available,
- rows that use more or fewer stitches than are on the needle,
- rows where the pattern's own stated count disagrees with its instructions,
- terms it did not recognise.

`to last N sts` describes the same stitches the following instructions work, so it is
treated as a consistency check rather than an extra deduction — getting that wrong
miscounts every shaping and lace row.

Scanned PDFs are images of a pattern rather than text, and the importer says so instead
of returning nothing.

## Building it

```bash
brew install xcodegen
cd ios-knitstudio
xcodegen generate
open KnitStudio.xcodeproj
```

Targets iOS 17. There is no backend and no network access — everything is on-device.

Run the tests with **⌘U**. They cover the gauge and yarn model, every calculator against
verified reference values, chart geometry, the written-pattern parser, and the shopping
list.
