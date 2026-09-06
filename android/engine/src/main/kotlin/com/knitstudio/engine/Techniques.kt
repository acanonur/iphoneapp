package com.knitstudio.engine

import kotlinx.serialization.Serializable

enum class TechniqueCategory(val displayName: String, val blurb: String) {
    GETTING_STARTED("Getting started", "Needles, yarn, and reading what a pattern is telling you."),
    CAST_ON("Cast-ons", "Every project starts here. The right one matters more than people expect."),
    BASIC_STITCHES("Basic stitches", "Knit and purl, and the fabrics they make between them."),
    INCREASES("Increases", "Adding stitches, and which way each one leans."),
    DECREASES("Decreases", "Taking stitches away so the lean matches the shaping."),
    TEXTURE("Texture", "Fabric made by where you put the knits and purls."),
    CABLES("Cables", "Crossing stitches over each other to make ropes and braids."),
    LACE("Lace", "Deliberate holes, paired with decreases that keep the count."),
    COLOURWORK("Colourwork", "More than one colour in a row, and how to carry the others."),
    SHORT_ROWS("Short rows", "Extra rows in part of the fabric, to shape it in three dimensions."),
    IN_THE_ROUND("Working in the round", "Knitting a tube: no seams, no purling back."),
    FINISHING("Finishing", "Bind-offs, seams and blocking — where a project is won or lost."),
    FIXING("Fixing mistakes", "Dropped, twisted, miscounted. All of it is recoverable."),
}

/** One technique in the guide. */
@Serializable
data class Technique(
    /** Stable slug so favourites survive updates. */
    val id: String,
    val displayName: String,
    val category: TechniqueCategory,
    val difficulty: Difficulty,
    /** One line: what it is. */
    val summary: String,
    /** When a knitter should reach for it. */
    val whenToUse: String,
    val steps: List<String>,
    val tips: List<String> = emptyList(),
    val alsoKnownAs: List<String> = emptyList(),
    val abbreviations: List<String> = emptyList(),
) {
    val searchText: String
        get() = (listOf(displayName, summary, whenToUse) + alsoKnownAs + abbreviations)
            .joinToString(" ").lowercase()
}

/** A pattern abbreviation and what it means. */
data class Abbreviation(
    val short: String,
    val full: String,
    val meaning: String,
    val techniqueId: String? = null,
)

object TechniqueLibrary {

    private fun t(
        id: String, name: String, category: TechniqueCategory, difficulty: Difficulty,
        summary: String, whenToUse: String, steps: List<String>,
        tips: List<String> = emptyList(), aka: List<String> = emptyList(),
        abbr: List<String> = emptyList(),
    ) = Technique(id, name, category, difficulty, summary, whenToUse, steps, tips, aka, abbr)

    val all: List<Technique> = listOf(

        // ── Getting started ───────────────────────────────────────────────
        t(
            "holding-yarn", "Holding the yarn", TechniqueCategory.GETTING_STARTED, Difficulty.BEGINNER,
            "The two mainstream styles, English and Continental, and why it matters.",
            "Before anything else. Whichever you pick, consistency is what makes even fabric.",
            listOf(
                "English (‘throwing’): hold the working yarn in your right hand and wrap it around the right needle for each stitch.",
                "Continental (‘picking’): hold the working yarn in your left hand, tensioned over the index finger, and scoop it through with the right needle.",
                "Run the yarn over one finger and under the next to add friction — that tension, not your grip, is what evens out your stitches.",
                "Work a few rows each way before deciding. Neither is faster in the abstract; the one your hands settle into is faster for you.",
            ),
            listOf(
                "Continental makes ribbing and purling quicker because the yarn moves less.",
                "English gives many knitters more even tension in stranded colourwork.",
                "Holding one colour in each hand is the reason many colourwork knitters learn both.",
            ),
            listOf("throwing", "picking", "English style", "Continental style"),
        ),
        t(
            "gauge-swatch", "Knitting a gauge swatch", TechniqueCategory.GETTING_STARTED, Difficulty.BEGINNER,
            "The measurement every calculation in this app depends on.",
            "Before casting on anything that has to fit. Skipping it is the single most common reason a sweater comes out the wrong size.",
            listOf(
                "Cast on enough stitches for at least 15 cm of fabric — roughly 1.5× the pattern's stated stitch count over 10 cm.",
                "Work in the stitch pattern you will actually use, for at least 15 cm.",
                "Add a few garter or seed stitches at each edge so the swatch lies flat and does not curl.",
                "Bind off loosely, then wash and block the swatch exactly as you will treat the finished piece. Let it dry fully.",
                "Lay it flat without stretching. Measure 10 cm across the middle and count the stitches, including partial ones.",
                "Measure 10 cm vertically and count the rows the same way.",
                "Enter both numbers in the calculator. If your stitch count is higher than the pattern's, go up a needle size; lower, go down.",
            ),
            listOf(
                "Measure in the middle, never at the edges — edge stitches are always distorted.",
                "Swatch in the round for a project knitted in the round. Most people purl at a different tension than they knit, so a flat swatch lies about your gauge.",
                "Row gauge matters more than knitters expect: it sets every length, every shaping interval and the depth of every yoke.",
            ),
            listOf("tension square", "swatching"), listOf("st", "sts"),
        ),
        t(
            "reading-charts", "Reading a chart", TechniqueCategory.GETTING_STARTED, Difficulty.EASY,
            "Charts are a picture of the right side of the fabric, read from the bottom up.",
            "Colourwork, lace and cables are all far easier charted than written out.",
            listOf(
                "Start at the bottom right. Row 1 is the bottom row — the first one you knit.",
                "Right-side rows read right to left, the direction your stitches travel.",
                "Wrong-side rows read left to right, and every symbol is worked as its opposite: a knit symbol is purled.",
                "Worked in the round there are no wrong-side rows, so every round reads right to left.",
                "Bold lines mark the pattern repeat: work the stitches inside them over and over across the row.",
                "Check the legend before you start — symbols are conventional but not standardised.",
            ),
            listOf(
                "A magnetic board or a sticky note under the current row saves more mistakes than any other habit.",
                "Put the note above the row you are on, so you can see the rows you have already worked and check against them.",
            ),
        ),

        // ── Cast-ons ──────────────────────────────────────────────────────
        t(
            "long-tail-cast-on", "Long-tail cast-on", TechniqueCategory.CAST_ON, Difficulty.BEGINNER,
            "The default cast-on: fast, tidy, moderately stretchy.",
            "Almost anything. If a pattern does not say otherwise, use this one.",
            listOf(
                "Estimate the tail: about three times the width of your cast-on edge, plus a bit. For 100 stitches, roughly a metre.",
                "Make a slip knot at that point and put it on the needle. It counts as your first stitch.",
                "Hold both strands in your left hand, tail over the thumb and working yarn over the index finger, with both anchored in the palm — the ‘slingshot’.",
                "Bring the needle up through the loop on your thumb.",
                "Take it over the top of the index-finger strand and catch that strand.",
                "Bring it back down through the thumb loop, then let the thumb loop drop.",
                "Pull the tail gently to snug the new stitch against the needle. Repeat.",
            ),
            listOf(
                "Ran out of tail? Cast on from both ends of a centre-pull ball and never estimate again.",
                "Cast on over one needle, not two — the ‘two needles’ advice makes a sloppy edge. If your cast-on is tight, use a needle one size up instead.",
                "The tail end must be the one over your thumb. Swap them and the edge comes out inside out.",
            ),
            listOf("double cast-on", "slingshot cast-on"), listOf("CO"),
        ),
        t(
            "german-twisted-cast-on", "German twisted cast-on", TechniqueCategory.CAST_ON, Difficulty.EASY,
            "Long-tail with an extra twist, giving a noticeably stretchier edge.",
            "Sock cuffs, hat brims, mitten cuffs — anywhere the edge has to stretch and spring back.",
            listOf(
                "Set up exactly as for a long-tail cast-on, tail over the thumb.",
                "Bring the needle under both strands of the thumb loop, then back down into the loop from above — that is the extra twist.",
                "Catch the index-finger strand as usual.",
                "Draw it back through the thumb loop and drop the thumb loop.",
                "Snug up and repeat.",
            ),
            listOf("Worth learning the day you knit your first sock. A long-tail cuff that will not stretch over a heel is a wasted sock."),
            listOf("old Norwegian cast-on", "twisted German cast-on"), listOf("CO"),
        ),
        t(
            "cable-cast-on", "Cable cast-on", TechniqueCategory.CAST_ON, Difficulty.EASY,
            "A firm, corded edge worked between stitches rather than into them.",
            "Buttonhole edges, underarm cast-ons, and anywhere you want a sturdy non-stretchy edge.",
            listOf(
                "Cast on two stitches by any method.",
                "Insert the right needle between the first two stitches on the left needle, not into a stitch.",
                "Wrap the yarn and pull a loop through that gap.",
                "Place the loop on the left needle.",
                "Repeat, always working between the two newest stitches.",
            ),
            listOf(
                "This is the cast-on for the underarm stitches of a top-down sweater — firm enough not to sag.",
                "Too firm for a hem or cuff that has to stretch over a body part.",
            ),
            abbr = listOf("CO"),
        ),
        t(
            "provisional-cast-on", "Provisional cast-on", TechniqueCategory.CAST_ON, Difficulty.INTERMEDIATE,
            "A temporary cast-on that leaves live stitches you can come back to.",
            "Anywhere you need to knit in both directions from one starting line, or graft an edge later.",
            listOf(
                "With smooth waste yarn in a contrasting colour, crochet a chain a few stitches longer than you need.",
                "With the main yarn and a needle, pick up and knit one stitch into the back bump of each chain.",
                "Work your project from there.",
                "When you need the live stitches, undo the crochet chain from its last-made end and catch each freed loop on a needle.",
            ),
            listOf(
                "Use slippery cotton waste yarn. Anything grabby makes the chain a misery to unzip.",
                "Count as you free the stitches — it is easy to gain or lose one at the very end.",
            ),
            abbr = listOf("CO"),
        ),
        t(
            "judys-magic-cast-on", "Judy's magic cast-on", TechniqueCategory.CAST_ON, Difficulty.INTERMEDIATE,
            "Casts on two sets of live stitches back to back, with a closed edge and no seam.",
            "Toe-up socks, mitten tips, the closed end of a bag — anything starting as a seamless pocket.",
            listOf(
                "Hold two needle tips together, one above the other. Drape the yarn over the top needle with the tail hanging towards you.",
                "Bring the tail under and over the bottom needle to make a stitch there.",
                "Bring the working yarn under and over the top needle to make a stitch there.",
                "Keep alternating until each needle carries half the stitches.",
                "Turn the work and knit the top needle's stitches, being careful with the very first one.",
                "Rotate and knit the second needle. From here you are working in the round.",
            ),
            listOf("The first round is fiddly and every round after is easy. Push through it."),
            listOf("magic cast-on"), listOf("CO"),
        ),
        t(
            "tubular-cast-on", "Tubular cast-on", TechniqueCategory.CAST_ON, Difficulty.ADVANCED,
            "An invisible, rounded edge that flows seamlessly into 1×1 rib.",
            "The most professional finish for a ribbed cuff, hem or neckband.",
            listOf(
                "With waste yarn, provisionally cast on half the final stitch count.",
                "Change to the main yarn and work four rows: knit a row, purl a row, knit a row, purl a row.",
                "Fold the fabric so the waste-yarn edge sits behind the needle.",
                "Undo the provisional cast-on and put the freed live stitches on a spare needle.",
                "Knit across, alternating one stitch from the front needle with one from the back needle — you now have the full count in 1×1 rib.",
                "Carry on in rib.",
            ),
            listOf(
                "Pairs with the tubular bind-off for a garment where both edges match.",
                "Slow the first time and quick the fifth. Practise on a swatch before a garment neckline.",
            ),
            listOf("invisible cast-on", "Italian cast-on"), listOf("CO"),
        ),

        // ── Basic stitches ────────────────────────────────────────────────
        t(
            "knit-stitch", "Knit stitch", TechniqueCategory.BASIC_STITCHES, Difficulty.BEGINNER,
            "The stitch everything else is built from.", "Everywhere.",
            listOf(
                "Hold the needle with the stitches in your left hand, working yarn at the back.",
                "Push the right needle into the front of the first stitch, from left to right — the needles cross behind.",
                "Wrap the working yarn anticlockwise around the right needle.",
                "Bring that wrap back through the stitch towards you, catching it on the right needle.",
                "Slide the old stitch off the left needle. One knit stitch made.",
            ),
            listOf(
                "The new stitch lives on the right needle. If your stitch count is growing, you are probably not dropping the old stitch off.",
                "Work into the stitch, not into the gap between stitches — that is the other way counts creep up.",
            ),
            abbr = listOf("k"),
        ),
        t(
            "purl-stitch", "Purl stitch", TechniqueCategory.BASIC_STITCHES, Difficulty.BEGINNER,
            "The knit stitch worked backwards — the reverse side of the same loop.",
            "Every wrong-side row of stockinette, and half of all ribbing.",
            listOf(
                "Bring the working yarn to the front of the work.",
                "Push the right needle into the front of the first stitch from right to left — the needles cross in front.",
                "Wrap the yarn anticlockwise around the right needle.",
                "Push that wrap back through the stitch away from you.",
                "Slide the old stitch off. One purl made.",
            ),
            listOf(
                "Moving the yarn front and back between knits and purls is what makes ribbing slow. Keep the movement small — go between the needle tips, not around them.",
                "A purl is a knit seen from the other side. Purl a whole row and turn the work: it is a knit row.",
            ),
            abbr = listOf("p"),
        ),
        t(
            "stockinette", "Stockinette stitch", TechniqueCategory.BASIC_STITCHES, Difficulty.BEGINNER,
            "Knit on the right side, purl on the wrong side. The smooth V-shaped fabric.",
            "The default fabric for sweaters, hats, socks and colourwork.",
            listOf(
                "Flat: knit every right-side row, purl every wrong-side row.",
                "In the round: knit every round.",
                "The right side shows columns of Vs; the wrong side shows bumpy purl ridges.",
            ),
            listOf(
                "It curls. The edges roll to the front at top and bottom, and to the back at the sides. This is physics, not a mistake — plan an edging or a seam.",
                "Reverse stockinette is the same fabric used purl side out.",
            ),
            listOf("stocking stitch"), listOf("St st", "k", "p"),
        ),
        t(
            "garter-stitch", "Garter stitch", TechniqueCategory.BASIC_STITCHES, Difficulty.BEGINNER,
            "Knit every row. Ridged, squashy, and completely flat.",
            "Scarves, blanket borders, shawl edges, and any beginner's first project.",
            listOf(
                "Flat: knit every row, both sides.",
                "In the round: alternate a knit round with a purl round.",
                "Two rows make one visible ridge.",
            ),
            listOf(
                "It does not curl, which is why it borders so many things.",
                "It is much shorter row-for-row than stockinette — roughly twice the rows for the same length. Do not reuse a stockinette row gauge for it.",
                "It stretches widthways far more than lengthways.",
            ),
            abbr = listOf("k"),
        ),
        t(
            "ribbing", "Ribbing", TechniqueCategory.BASIC_STITCHES, Difficulty.BEGINNER,
            "Columns of knits and purls that pull the fabric in and let it spring back.",
            "Cuffs, hems, brims, necklines — anywhere the fabric has to hug and recover.",
            listOf(
                "1×1 rib: *k1, p1* to the end. On the next row, knit the knits and purl the purls as they face you.",
                "2×2 rib: *k2, p2* to the end, again working the stitches as they present.",
                "Worked in the round, every round is the same: k1, p1 (or k2, p2) all the way.",
                "Cast on a multiple of 2 for 1×1, or of 4 for 2×2, so the pattern meets itself.",
            ),
            listOf(
                "1×1 is the stretchiest; 2×2 pulls in more strongly and looks bolder.",
                "Rib is normally worked on needles one size smaller than the body of the piece.",
                "Bind off rib loosely, or in a stretchy bind-off — a tight rib edge defeats the whole point of the rib.",
            ),
            abbr = listOf("k", "p"),
        ),
        t(
            "seed-stitch", "Seed stitch", TechniqueCategory.TEXTURE, Difficulty.EASY,
            "Alternating knits and purls that never stack, giving an even bobbled texture.",
            "Flat, reversible borders and whole garments with quiet texture.",
            listOf(
                "Row 1: *k1, p1* to the end.",
                "Row 2: purl the knits and knit the purls — the opposite of what faces you.",
                "Repeat those two rows.",
            ),
            listOf(
                "The rule is simply: never let a knit sit on a knit.",
                "Lies perfectly flat and looks the same on both sides, which makes it excellent for scarves.",
                "Slower than stockinette because the yarn moves on every stitch.",
            ),
            listOf("moss stitch"), listOf("k", "p"),
        ),
    ) + TechniqueLibraryPartTwo.more

    fun technique(id: String): Technique? = all.firstOrNull { it.id == id }

    fun inCategory(category: TechniqueCategory): List<Technique> = all.filter { it.category == category }

    val categoriesInOrder: List<TechniqueCategory>
        get() = TechniqueCategory.entries.filter { inCategory(it).isNotEmpty() }

    fun search(query: String): List<Technique> {
        val trimmed = query.trim().lowercase()
        if (trimmed.isEmpty()) return all
        return all.filter { it.searchText.contains(trimmed) }
    }

    /** Techniques a given project will actually need. */
    fun recommended(kind: PatternKind, structure: FabricStructure): List<Technique> {
        val ids = mutableListOf("gauge-swatch", "long-tail-cast-on", "knit-stitch", "purl-stitch")
        when (kind) {
            PatternKind.SCARF, PatternKind.BLANKET ->
                ids += listOf("garter-stitch", "standard-bind-off", "weaving-in-ends", "blocking")
            PatternKind.COWL ->
                ids += listOf("join-in-round", "magic-loop", "stretchy-bind-off", "blocking")
            PatternKind.HAT ->
                ids += listOf("join-in-round", "ribbing", "k2tog", "magic-loop", "gathered-crown")
            PatternKind.RAGLAN_SWEATER ->
                ids += listOf("join-in-round", "m1l", "m1r", "ribbing", "picking-up-stitches", "stretchy-bind-off", "blocking")
            PatternKind.SOCK ->
                ids += listOf("join-in-round", "magic-loop", "heel-flap", "short-row-heel-turn", "picking-up-stitches", "ssk", "k2tog", "kitchener-stitch")
            PatternKind.MITTEN ->
                ids += listOf("join-in-round", "magic-loop", "m1l", "m1r", "kitchener-stitch")
            PatternKind.SHAWL ->
                ids += listOf("garter-tab", "yarn-over", "ssk", "k2tog", "stretchy-bind-off", "blocking")
        }
        when (structure) {
            FabricStructure.CABLES -> ids += listOf("cable-cross", "cable-without-needle")
            FabricStructure.LACE -> ids += listOf("yarn-over", "lifeline", "reading-charts")
            FabricStructure.STRANDED_COLOURWORK -> ids += listOf("stranded-colourwork", "catching-floats", "reading-charts")
            FabricStructure.INTARSIA -> ids += "intarsia"
            FabricStructure.MOSAIC -> ids += "mosaic-knitting"
            FabricStructure.BRIOCHE -> ids += "brioche"
            FabricStructure.RIBBING -> ids += "ribbing"
            FabricStructure.SEED -> ids += "seed-stitch"
            FabricStructure.GARTER -> ids += "garter-stitch"
            FabricStructure.STOCKINETTE -> ids += "stockinette"
        }
        return ids.distinct().mapNotNull { technique(it) }
    }
}
