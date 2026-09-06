package com.knitstudio.engine

import kotlin.math.PI
import kotlin.math.abs

/** Warnings every calculator should raise when the inputs look wrong. */
object CalculatorSupport {
    fun gaugeWarnings(gauge: Gauge): List<String> {
        val warnings = mutableListOf<String>()
        if (!gauge.looksPlausible) {
            warnings += "That gauge is unusual for knitted fabric — double-check the swatch was " +
                "measured over 10 cm and counted in the same direction."
        }
        if (gauge.rowsPer10cm < gauge.stitchesPer10cm) {
            warnings += "Fewer rows than stitches per 10 cm is rare in stockinette. If you meant " +
                "garter stitch that is fine; otherwise the numbers may be swapped."
        }
        return warnings
    }

    fun cm(value: Double, units: UnitSystem): String = units.formatLength(value)
}

/** Scarves and blankets: a plain rectangle with optional garter edges. */
object FlatPieceCalculator {
    fun plan(
        kind: PatternKind,
        gauge: Gauge,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem,
    ): ProjectPlan {
        val width = maxOf(1.0, options.width)
        val length = maxOf(1.0, options.length)
        val edge = maxOf(0, options.edgeStitches)

        val bodyStitches = Shaping.roundToMultiple(
            gauge.stitchesForWidth(width) - edge * 2,
            options.stitchMultiple,
            options.stitchOffset,
        )
        val castOn = bodyStitches + edge * 2
        val rows = maxOf(1, gauge.rowsForLength(length).swiftRoundedToInt())

        val actualWidth = gauge.widthForStitches(castOn.toDouble())
        val actualLength = gauge.lengthForRows(rows.toDouble())

        val steps = mutableListOf(
            PlanStep("Cast on $castOn sts.", stitchCount = castOn, isMilestone = true),
        )
        if (edge > 0) {
            steps += PlanStep(
                "Work $edge sts in garter at each side on every row; these edges stop the " +
                    "fabric curling and are not counted in the pattern repeat.",
            )
        }
        steps += PlanStep(
            "Work $rows rows in ${structure.displayName.lowercase()}.",
            stitchCount = castOn, rows = rows,
        )
        steps += PlanStep("Bind off loosely in pattern.", isMilestone = true)

        val facts = mutableListOf(
            PlanFact(
                "Cast on", "$castOn sts",
                if (edge > 0) "$bodyStitches pattern sts + ${edge * 2} edge sts" else null,
            ),
            PlanFact("Rows", "$rows"),
            PlanFact("Finished width", CalculatorSupport.cm(actualWidth, units)),
            PlanFact("Finished length", CalculatorSupport.cm(actualLength, units)),
        )
        if (options.stitchMultiple > 1) {
            facts += PlanFact(
                "Stitch repeat",
                "multiple of ${options.stitchMultiple}" +
                    if (options.stitchOffset > 0) " + ${options.stitchOffset}" else "",
            )
        }

        val notes = mutableListOf(
            "Blocking usually relaxes a flat piece by a few percent. If the exact " +
                "finished size matters, block your swatch before measuring the gauge.",
        )
        if (kind == PatternKind.BLANKET) {
            notes += "A blanket this size is heavy on one circular needle — use an 80–100 cm " +
                "cable and count your stitches every twenty rows or so."
        }

        return ProjectPlan(
            title = kind.displayName,
            gauge = gauge,
            facts = facts,
            sections = listOf(PlanSection(kind.displayName, steps = steps)),
            blocks = listOf(
                StitchBlock("Body", (castOn * rows).toDouble(), structure),
            ),
            notes = notes,
            warnings = CalculatorSupport.gaugeWarnings(gauge),
        )
    }
}

/** A cowl: a tube worked in the round. */
object CowlCalculator {
    fun plan(
        gauge: Gauge,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem,
    ): ProjectPlan {
        val circumference = maxOf(1.0, options.cowlCircumference)
        val height = maxOf(1.0, options.cowlHeight)

        val castOn = Shaping.roundToMultiple(
            gauge.stitchesForWidth(circumference),
            maxOf(1, options.stitchMultiple),
            options.stitchOffset,
        )
        val rounds = maxOf(1, gauge.rowsForLength(height).swiftRoundedToInt())
        val ribRounds = maxOf(0, gauge.rowsForLength(options.ribDepth).swiftRoundedToInt())
        val bodyRounds = maxOf(0, rounds - ribRounds * 2)

        val steps = mutableListOf(
            PlanStep(
                "Cast on $castOn sts. Join to work in the round, being careful not to twist.",
                stitchCount = castOn, isMilestone = true,
            ),
        )
        if (ribRounds > 0) {
            steps += PlanStep("Work $ribRounds rounds in 2×2 rib.", stitchCount = castOn, rows = ribRounds)
        }
        steps += PlanStep(
            "Work $bodyRounds rounds in ${structure.displayName.lowercase()}.",
            stitchCount = castOn, rows = bodyRounds,
        )
        if (ribRounds > 0) {
            steps += PlanStep("Work $ribRounds rounds in 2×2 rib.", stitchCount = castOn, rows = ribRounds)
        }
        steps += PlanStep("Bind off loosely in rib.", isMilestone = true)

        val warnings = CalculatorSupport.gaugeWarnings(gauge).toMutableList()
        if (circumference < 50) {
            warnings += "A cowl under 50 cm around has to stretch over the head — work it in rib or " +
                "use a very stretchy bind-off."
        }

        return ProjectPlan(
            title = "Cowl",
            gauge = gauge,
            facts = listOf(
                PlanFact("Cast on", "$castOn sts"),
                PlanFact("Rounds", "$rounds"),
                PlanFact(
                    "Finished circumference",
                    CalculatorSupport.cm(gauge.widthForStitches(castOn.toDouble()), units),
                ),
                PlanFact("Finished height", CalculatorSupport.cm(height, units)),
            ),
            sections = listOf(PlanSection("Cowl", steps = steps)),
            blocks = listOf(
                StitchBlock("Ribbed edges", (castOn * ribRounds * 2).toDouble(), FabricStructure.RIBBING),
                StitchBlock("Body", (castOn * bodyRounds).toDouble(), structure),
            ),
            notes = listOf(
                "Worked in the round there is no wrong side, so stockinette will not curl at " +
                    "the edges the way a flat scarf does — but a few rounds of rib still sit flatter.",
            ),
            warnings = warnings,
        )
    }
}

/** A hat worked in the round from the brim up, with a wedge-decreased crown. */
object HatCalculator {
    fun plan(
        gauge: Gauge,
        measurements: BodyMeasurements,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem,
    ): ProjectPlan {
        val sections = maxOf(4, options.crownSections)
        // A hat has to grip, so ease is negative here regardless of sign.
        val negativeEase = minOf(0.2, abs(options.ease))
        val headCirc = maxOf(20.0, measurements.headCircumference)
        val brimCirc = headCirc * (1 - negativeEase)

        val castOn = Shaping.roundToMultiple(gauge.stitchesForWidth(brimCirc), sections * 2)
        val stitchesPerSection = castOn / sections

        // The closed crown caps a circle of radius r = circumference / 2pi.
        // A knitted crown sits between a flat disc (depth r) and a hemisphere
        // (depth pi/2 · r); 1.15·r matches the hats people actually wear.
        val crownRadius = brimCirc / (2 * PI)
        val targetCrownRounds = (crownRadius * 1.15 / gauge.rowHeight).swiftRoundedToInt()

        // One decrease round per stitch per section, and never more than one
        // plain round between decreases.
        val decreaseRounds = maxOf(1, stitchesPerSection - 1)
        val plainRounds = minOf(decreaseRounds, maxOf(0, targetCrownRounds - decreaseRounds))
        val crownRounds = decreaseRounds + plainRounds
        val crownDepth = crownRounds * gauge.rowHeight

        val ribDepth =
            if (options.hatStyle == HatStyle.FOLDED_BRIM) options.ribDepth * 2 else options.ribDepth
        val ribRounds = maxOf(0, gauge.rowsForLength(ribDepth).swiftRoundedToInt())
        val totalHeight = options.hatStyle.height
        val bodyDepth = maxOf(0.0, totalHeight - crownDepth - ribDepth)
        val bodyRounds = maxOf(0, gauge.rowsForLength(bodyDepth).swiftRoundedToInt())

        val brimSteps = listOf(
            PlanStep(
                "Cast on $castOn sts with a stretchy cast-on (long-tail is fine). " +
                    "Join to work in the round, being careful not to twist.",
                stitchCount = castOn, isMilestone = true,
            ),
            PlanStep(
                "Work $ribRounds rounds in 2×2 rib (k2, p2 to end).",
                stitchCount = castOn, rows = ribRounds,
            ),
        )

        val bodySteps = listOf(
            PlanStep(
                "Work $bodyRounds rounds in ${structure.displayName.lowercase()} with no shaping, " +
                    "until the hat measures ${CalculatorSupport.cm(ribDepth + bodyDepth, units)} " +
                    "from the cast-on edge.",
                stitchCount = castOn, rows = bodyRounds,
            ),
        )

        val crownSteps = mutableListOf(
            PlanStep(
                "Place a marker every $stitchesPerSection sts — $sections markers in all. " +
                    "Each decrease round takes one stitch out of every section.",
                stitchCount = castOn, isMilestone = true,
            ),
        )
        // Plain rounds go into the earliest gaps so the dome starts gently and
        // tightens towards the top, which is how a crown should sit.
        for (index in 1..decreaseRounds) {
            val knitCount = stitchesPerSection - index + 1 - 2
            val remaining = castOn - index * sections
            val repeatText =
                if (knitCount > 0) "[k$knitCount, k2tog] $sections times" else "[k2tog] $sections times"
            crownSteps += PlanStep("Decrease round $index: $repeatText.", stitchCount = remaining, rows = 1)
            if (index <= plainRounds) {
                crownSteps += PlanStep("Knit one round even.", stitchCount = remaining, rows = 1)
            }
        }
        crownSteps += PlanStep(
            "Break the yarn leaving a 20 cm tail, thread it through the remaining " +
                "$sections sts, pull tight and fasten off on the inside.",
            stitchCount = sections, isMilestone = true,
        )

        // The crown tapers linearly from the full count down to one stitch per
        // section, so its average stitch count is the mean of the two.
        val crownAverage = (castOn + sections) / 2.0

        val warnings = CalculatorSupport.gaugeWarnings(gauge).toMutableList()
        if (bodyRounds == 0) {
            warnings += "The crown and brim already fill the whole hat height. Shorten the brim, " +
                "pick a taller style, or use more crown sections."
        }
        if (stitchesPerSection < 5) {
            warnings += "Only $stitchesPerSection sts per section — the crown will decrease very " +
                "abruptly. Try ${maxOf(4, sections - 2)} sections instead."
        }

        return ProjectPlan(
            title = options.hatStyle.displayName,
            gauge = gauge,
            facts = listOf(
                PlanFact("Cast on", "$castOn sts", "$sections sections of $stitchesPerSection"),
                PlanFact(
                    "Brim circumference", CalculatorSupport.cm(brimCirc, units),
                    "${(negativeEase * 100).toInt()}% negative ease",
                ),
                PlanFact("Total height", CalculatorSupport.cm(totalHeight, units)),
                PlanFact("Crown", "$crownRounds rounds", CalculatorSupport.cm(crownDepth, units)),
                PlanFact("Total rounds", "${ribRounds + bodyRounds + crownRounds}"),
            ),
            sections = listOf(
                PlanSection("Brim", "Ribbing that grips the head", brimSteps),
                PlanSection("Body", "Straight tube to the crown", bodySteps),
                PlanSection("Crown", "$decreaseRounds decrease rounds", crownSteps),
            ),
            blocks = listOf(
                StitchBlock("Brim", (castOn * ribRounds).toDouble(), FabricStructure.RIBBING),
                StitchBlock("Body", (castOn * bodyRounds).toDouble(), structure),
                StitchBlock("Crown", crownAverage * crownRounds, structure),
            ),
            notes = listOf(
                "Hats are worn with negative ease — the brim measures less than the head so " +
                    "it stays on. ${(negativeEase * 100).toInt()}% is the usual amount.",
                "Switch to double-pointed needles or magic loop once the crown gets too small " +
                    "for your circular needle, usually around ${sections * 4} sts.",
            ),
            warnings = warnings,
        )
    }
}
