package com.knitstudio.engine

import kotlinx.serialization.Serializable

/**
 * A ready-made starting point the knitter can pick instead of filling in a
 * blank form. Selecting one pre-fills the whole calculator.
 */
data class PatternPreset(
    val id: String,
    val displayName: String,
    val kind: PatternKind,
    val structure: FabricStructure,
    val options: ProjectOptions,
    val suggestedWeight: YarnWeight,
    val blurb: String,
    /** Identifier of a built-in colourwork chart, when the preset uses one. */
    val chartId: String? = null,
)

object BuiltInPatterns {

    fun palette(weight: YarnWeight): List<Yarn> = listOf(
        Yarn(name = "Main", colourName = "Undyed cream", hex = "F0E9DA", weight = weight),
        Yarn(name = "Contrast", colourName = "Deep indigo", hex = "2E4272", weight = weight),
        Yarn(name = "Contrast", colourName = "Rust", hex = "B5533C", weight = weight),
        Yarn(name = "Contrast", colourName = "Moss", hex = "6B7A43", weight = weight),
        Yarn(name = "Contrast", colourName = "Charcoal", hex = "3A3A3C", weight = weight),
        Yarn(name = "Contrast", colourName = "Mustard", hex = "D6A32E", weight = weight),
    )

    val all: List<PatternPreset> = listOf(
        PatternPreset(
            "first-scarf", "First scarf", PatternKind.SCARF, FabricStructure.GARTER,
            ProjectOptions(ribDepth = 0.0, width = 20.0, length = 150.0, edgeStitches = 0),
            YarnWeight.MEDIUM,
            "Garter stitch, no shaping, no seams. The project that teaches your hands the knit stitch.",
        ),
        PatternPreset(
            "seed-scarf", "Seed stitch scarf", PatternKind.SCARF, FabricStructure.SEED,
            ProjectOptions(width = 25.0, length = 170.0, edgeStitches = 2, stitchMultiple = 2),
            YarnWeight.LIGHT,
            "Reversible, lies flat, and quietly more interesting than garter.",
        ),
        PatternPreset(
            "chunky-blanket", "Chunky throw", PatternKind.BLANKET, FabricStructure.STOCKINETTE,
            ProjectOptions(width = 120.0, length = 150.0, edgeStitches = 6),
            YarnWeight.BULKY,
            "A big rectangle in bulky yarn. Fast to knit, but budget the yarn before you start.",
        ),
        PatternPreset(
            "classic-beanie", "Classic beanie", PatternKind.HAT, FabricStructure.STOCKINETTE,
            ProjectOptions(ease = 0.09, hatStyle = HatStyle.CLASSIC, crownSections = 8, ribDepth = 5.0),
            YarnWeight.MEDIUM,
            "Ribbed brim, plain body, eight-section crown. One skein, one evening.",
        ),
        PatternPreset(
            "slouchy-hat", "Slouchy hat", PatternKind.HAT, FabricStructure.STOCKINETTE,
            ProjectOptions(ease = 0.06, hatStyle = HatStyle.SLOUCHY, crownSections = 8, ribDepth = 6.0),
            YarnWeight.LIGHT,
            "Extra length in the body so it drapes at the back.",
        ),
        PatternPreset(
            "colourwork-hat", "Stranded colourwork hat", PatternKind.HAT,
            FabricStructure.STRANDED_COLOURWORK,
            ProjectOptions(ease = 0.10, hatStyle = HatStyle.FOLDED_BRIM, crownSections = 8, ribDepth = 4.0),
            YarnWeight.LIGHT,
            "A folded brim and a charted band around the head. Warmer than plain knitting.",
            chartId = "fair-isle-band",
        ),
        PatternPreset(
            "rib-cowl", "2×2 rib cowl", PatternKind.COWL, FabricStructure.RIBBING,
            ProjectOptions(ribDepth = 0.0, cowlCircumference = 62.0, cowlHeight = 28.0, stitchMultiple = 4),
            YarnWeight.MEDIUM,
            "Squashy, reversible and completely mindless. Good television knitting.",
        ),
        PatternPreset(
            "raglan-pullover", "Top-down raglan pullover", PatternKind.RAGLAN_SWEATER,
            FabricStructure.STOCKINETTE,
            ProjectOptions(ease = 0.08, ribDepth = 6.0, cuffDepth = 6.0, raglanStitches = 2),
            YarnWeight.LIGHT,
            "Seamless, tried on as you go, and the sleeves are fitted rather than balloons.",
        ),
        PatternPreset(
            "cabled-sweater", "Cabled pullover", PatternKind.RAGLAN_SWEATER, FabricStructure.CABLES,
            ProjectOptions(ease = 0.10, ribDepth = 7.0, cuffDepth = 6.0, raglanStitches = 2),
            YarnWeight.MEDIUM,
            "Same construction, cabled fabric. Cables pull in, so it needs more yarn and more ease.",
        ),
        PatternPreset(
            "vanilla-socks", "Vanilla socks", PatternKind.SOCK, FabricStructure.STOCKINETTE,
            ProjectOptions(ease = 0.10, cuffDepth = 4.0, legLength = 15.0),
            YarnWeight.SUPER_FINE,
            "Cuff down, heel flap and gusset, wedge toe. The sock everyone learns first.",
        ),
        PatternPreset(
            "colourwork-mittens", "Colourwork mittens", PatternKind.MITTEN,
            FabricStructure.STRANDED_COLOURWORK,
            ProjectOptions(ease = 0.05, ribDepth = 6.0),
            YarnWeight.LIGHT,
            "Stranded floats double the fabric — the warmest thing you can knit for hands.",
            chartId = "zigzag",
        ),
        PatternPreset(
            "triangle-shawl", "Garter triangle shawl", PatternKind.SHAWL, FabricStructure.GARTER,
            ProjectOptions(wingspan = 180.0, increasesPerRightSideRow = 4),
            YarnWeight.SUPER_FINE,
            "Starts at nine stitches and grows. Blocking is what turns it into a shawl.",
        ),
    )

    fun preset(id: String): PatternPreset? = all.firstOrNull { it.id == id }

    /** Charts written as text art. The first line is the top of the chart. */
    data class Motif(val id: String, val displayName: String, val colours: Int, val art: String)

    val motifs: List<Motif> = listOf(
        Motif(
            "fair-isle-band", "Fair Isle band", 2,
            art = """
            ..XX..XX..XX..XX
            .X..XX..XX..XX..
            X..XX..XX..XX..X
            ..XX..XX..XX..XX
            .XXXX..XXXX..XXX
            X..XX..XX..XX..X
            ..X..XX..XX..XX.
            .XX..XX..XX..XX.
            """.trimIndent(),
        ),
        Motif(
            "zigzag", "Zigzag", 2,
            art = """
            X......XX......X
            .X....X..X....X.
            ..X..X....X..X..
            ...XX......XX...
            ..X..X....X..X..
            .X....X..X....X.
            X......XX......X
            .......XX.......
            """.trimIndent(),
        ),
        Motif(
            "checkerboard", "Checkerboard", 2,
            art = """
            XXXX....XXXX....
            XXXX....XXXX....
            XXXX....XXXX....
            XXXX....XXXX....
            ....XXXX....XXXX
            ....XXXX....XXXX
            ....XXXX....XXXX
            ....XXXX....XXXX
            """.trimIndent(),
        ),
        Motif(
            "snowflake", "Snowflake", 2,
            art = """
            ...X.......X....
            .X.X.X...X.X.X..
            ..XXX.....XXX...
            XXXXXXX.XXXXXXX.
            ..XXX.....XXX...
            .X.X.X...X.X.X..
            ...X.......X....
            ................
            """.trimIndent(),
        ),
        Motif(
            "hearts", "Hearts", 2,
            art = """
            ................
            .XX..XX..XX..XX.
            XXXXXXXXXXXXXXXX
            XXXXXXXXXXXXXXXX
            .XXXXXX..XXXXXX.
            ..XXXX....XXXX..
            ...XX......XX...
            ................
            """.trimIndent(),
        ),
        Motif(
            "diamonds", "Diamonds", 3,
            art = """
            .......XX.......
            ......XooX......
            .....XooooX.....
            ....XooooooX....
            .....XooooX.....
            ......XooX......
            .......XX.......
            ................
            """.trimIndent(),
        ),
    )

    fun chart(id: String, weight: YarnWeight = YarnWeight.LIGHT): ColourChart? {
        val motif = motifs.firstOrNull { it.id == id } ?: return null
        return ColourChart.fromArt(
            motif.displayName, motif.art, palette(weight).take(motif.colours),
        )
    }
}

/** A project the knitter has set up and can come back to. */
@Serializable
data class SavedProject(
    val id: String = java.util.UUID.randomUUID().toString(),
    val name: String,
    val kind: PatternKind,
    val structure: FabricStructure = FabricStructure.STOCKINETTE,
    val gauge: Gauge,
    val measurements: BodyMeasurements = BodyMeasurements(),
    val options: ProjectOptions = ProjectOptions(),
    val allocations: List<ColourAllocation> = emptyList(),
    val chart: ColourChart? = null,
    val rowsCompleted: Int = 0,
    val notes: String = "",
) {
    fun plan(units: UnitSystem = UnitSystem.METRIC): ProjectPlan =
        kind.makePlan(gauge, measurements, options, structure, units)

    /**
     * Colour shares come from the chart when there is one, since that is the
     * only place the real proportions are known.
     */
    val effectiveAllocations: List<ColourAllocation>
        get() = when {
            chart != null && chart.palette.size > 1 -> ColourAllocation.fromChart(chart)
            allocations.isEmpty() -> ColourAllocation.single(
                Yarn(name = "Main yarn", hex = "9EB7C4", weight = YarnWeight.matching(gauge)),
            )
            else -> allocations
        }

    fun shoppingList(): ShoppingList = ShoppingListBuilder.build(
        plan(), kind, effectiveAllocations, structure, options,
    )

    companion object {
        fun fromPreset(preset: PatternPreset, gauge: Gauge? = null): SavedProject {
            val resolved = gauge ?: preset.suggestedWeight.nominalGauge
            val chart = preset.chartId?.let { BuiltInPatterns.chart(it, preset.suggestedWeight) }
            return SavedProject(
                name = preset.displayName,
                kind = preset.kind,
                structure = preset.structure,
                gauge = resolved,
                options = preset.options,
                allocations = chart?.let { ColourAllocation.fromChart(it) }
                    ?: ColourAllocation.single(BuiltInPatterns.palette(preset.suggestedWeight)[0]),
                chart = chart,
            )
        }
    }
}
