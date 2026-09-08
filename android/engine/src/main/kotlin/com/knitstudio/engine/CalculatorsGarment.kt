package com.knitstudio.engine

import kotlin.math.abs
import kotlin.math.ceil

/**
 * A seamless top-down raglan: cast on at the neck, increase at four raglan
 * lines to the underarm, split off the sleeves, then work body and sleeves down.
 */
object RaglanSweaterCalculator {
    fun plan(
        gauge: Gauge,
        measurements: BodyMeasurements,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem,
    ): ProjectPlan {
        val raglanSts = maxOf(1, options.raglanStitches)
        val chest = maxOf(40.0, measurements.chest)
        val finishedChest = chest * (1 + options.ease)

        val bodyTarget = Shaping.roundToMultiple(gauge.stitchesForWidth(finishedChest), 4)
        val neckCastOn = Shaping.roundToMultiple(
            gauge.stitchesForWidth(maxOf(20.0, measurements.neckCircumference)), 4,
        )

        // `available` is a multiple of 4, so front and back come out equal.
        val raglanTotal = raglanSts * 4
        val available = maxOf(4, neckCastOn - raglanTotal)
        val sleeveStart = maxOf(1, (available * 0.16).swiftRoundedToInt())
        val front = (available - sleeveStart * 2) / 2
        val back = available - front - sleeveStart * 2

        // Stitches cast on under each arm, roughly 5% of the chest.
        val underarmCastOn = Shaping.roundToMultiple(gauge.stitchesForWidth(chest * 0.05), 2)

        // Body and sleeves need different amounts of growth, so this is a
        // compound raglan: on a "full" round all 8 increases are worked, and on
        // a body-only round the M1s are placed on the body side of each raglan
        // line alone (4 sts). Growing both at one rate is what gives plain
        // raglans their famously oversized sleeves.
        val bodyHalfTarget = (bodyTarget - 2 * underarmCastOn) / 2
        val bodyIncreaseRounds = maxOf(0, (bodyHalfTarget - front) / 2)

        val upperArmStitches =
            Shaping.roundToMultiple(gauge.stitchesForWidth(maxOf(15.0, measurements.upperArm)), 2)
        val sleeveTargetAtSplit = maxOf(sleeveStart, upperArmStitches - underarmCastOn)
        val sleeveIncreaseRounds = maxOf(0, (sleeveTargetAtSplit - sleeveStart) / 2)

        val fullIncreaseRounds = minOf(bodyIncreaseRounds, sleeveIncreaseRounds)
        val bodyOnlyRounds = bodyIncreaseRounds - fullIncreaseRounds
        val sleeveOnlyRounds = sleeveIncreaseRounds - fullIncreaseRounds
        val increaseRounds = maxOf(bodyIncreaseRounds, sleeveIncreaseRounds)

        // The yoke must end up as deep as the armhole. Increasing every other
        // round is the default; if that overshoots, some increase rounds are
        // worked back-to-back, and if it undershoots, plain rounds are added.
        val targetArmhole = chest * 0.21
        val targetYokeRounds =
            maxOf(increaseRounds, (targetArmhole / gauge.rowHeight).swiftRoundedToInt())
        val everyRoundIncreases =
            minOf(increaseRounds, maxOf(0, 2 * increaseRounds - targetYokeRounds))
        val alternatingIncreases = increaseRounds - everyRoundIncreases
        val increaseSpan = alternatingIncreases * 2 + everyRoundIncreases
        val extraPlainRounds = maxOf(0, targetYokeRounds - increaseSpan)
        val yokeRounds = increaseSpan + extraPlainRounds
        val yokeDepth = yokeRounds * gauge.rowHeight

        val backEnd = back + 2 * bodyIncreaseRounds
        val frontEnd = front + 2 * bodyIncreaseRounds
        val sleeveEnd = sleeveStart + 2 * sleeveIncreaseRounds
        val bodyStitches = frontEnd + backEnd + 2 * underarmCastOn
        val sleeveStitches = sleeveEnd + underarmCastOn

        // Body below the underarm.
        val bodyBelow = maxOf(0.0, measurements.bodyLength - yokeDepth)
        val bodyRoundsTotal = maxOf(0, gauge.rowsForLength(bodyBelow).swiftRoundedToInt())
        val hemRounds =
            minOf(bodyRoundsTotal, maxOf(0, gauge.rowsForLength(options.ribDepth).swiftRoundedToInt()))
        val bodyPlainRounds = bodyRoundsTotal - hemRounds

        // Sleeves.
        val cuffStitches =
            Shaping.roundToMultiple(gauge.stitchesForWidth(maxOf(10.0, measurements.wrist) * 1.1), 2)
        val sleeveRoundsTotal =
            maxOf(1, gauge.rowsForLength(measurements.sleeveLength).swiftRoundedToInt())
        val cuffRounds =
            minOf(sleeveRoundsTotal, maxOf(0, gauge.rowsForLength(options.cuffDepth).swiftRoundedToInt()))
        val sleeveTaperRounds = sleeveRoundsTotal - cuffRounds
        val sleeveDecreaseRounds = maxOf(0, (sleeveStitches - cuffStitches) / 2)
        val sleeveRhythm = Shaping.rhythm(sleeveDecreaseRounds, sleeveTaperRounds, "round")

        val yokeEndStitches =
            neckCastOn + 8 * fullIncreaseRounds + 4 * bodyOnlyRounds + 4 * sleeveOnlyRounds

        val yokeSteps = mutableListOf(
            PlanStep("Cast on $neckCastOn sts and join to work in the round.", stitchCount = neckCastOn, isMilestone = true),
            PlanStep(
                "Place markers: $back back sts, $raglanSts raglan, $sleeveStart sleeve sts, " +
                    "$raglanSts raglan, $front front sts, $raglanSts raglan, " +
                    "$sleeveStart sleeve sts, $raglanSts raglan.",
                stitchCount = neckCastOn,
            ),
            PlanStep(
                "Full increase round: [knit to 1 st before marker, M1R, k$raglanSts, M1L] " +
                    "4 times — 8 sts added, 2 to every section.",
            ),
        )
        if (bodyOnlyRounds > 0) {
            yokeSteps += PlanStep(
                "Body-only increase round: [knit to 1 st before marker, M1R, k$raglanSts] at the " +
                    "two back raglans and [k$raglanSts, M1L] at the two front raglans — 4 sts " +
                    "added to the body, none to the sleeves.",
            )
        }
        if (sleeveOnlyRounds > 0) {
            yokeSteps += PlanStep(
                "Sleeve-only increase round: place both M1s on the sleeve side of each raglan " +
                    "line — 4 sts added to the sleeves, none to the body.",
            )
        }
        yokeSteps += PlanStep(
            "Work $fullIncreaseRounds full increase rounds, " + when {
                bodyOnlyRounds > 0 -> "then $bodyOnlyRounds body-only increase rounds."
                sleeveOnlyRounds > 0 -> "then $sleeveOnlyRounds sleeve-only increase rounds."
                else -> "which is every increase round."
            },
            stitchCount = yokeEndStitches, isMilestone = true,
        )
        val rhythmNote = when {
            everyRoundIncreases > 0 && alternatingIncreases > 0 ->
                "Work the first $alternatingIncreases increase rounds every other round, " +
                    "then the remaining $everyRoundIncreases on every round."
            everyRoundIncreases > 0 -> "Work every increase round back-to-back, on every round."
            else -> "Work an increase round every other round throughout."
        }
        yokeSteps += PlanStep(rhythmNote, rows = increaseSpan)
        if (extraPlainRounds > 0) {
            yokeSteps += PlanStep(
                "Work $extraPlainRounds rounds even until the yoke measures " +
                    "${CalculatorSupport.cm(yokeDepth, units)} from the cast-on edge.",
                stitchCount = yokeEndStitches, rows = extraPlainRounds,
            )
        }
        yokeSteps += PlanStep(
            "Yoke complete: $backEnd back, $frontEnd front, $sleeveEnd sts each sleeve.",
            stitchCount = yokeEndStitches, isMilestone = true,
        )

        val splitSteps = listOf(
            PlanStep(
                "Knit across the back. Slip the next $sleeveEnd sleeve sts onto waste yarn, " +
                    "cast on $underarmCastOn sts under the arm.",
                isMilestone = true,
            ),
            PlanStep(
                "Knit across the front. Slip the second $sleeveEnd sleeve sts onto waste yarn, " +
                    "cast on $underarmCastOn sts under the arm.",
            ),
            PlanStep("Body now joined in the round.", stitchCount = bodyStitches, isMilestone = true),
        )

        val bodySteps = listOf(
            PlanStep(
                "Work $bodyPlainRounds rounds in ${structure.displayName.lowercase()} until the body " +
                    "measures ${CalculatorSupport.cm(bodyBelow - options.ribDepth, units)} from the underarm.",
                stitchCount = bodyStitches, rows = bodyPlainRounds,
            ),
            PlanStep("Work $hemRounds rounds in 2×2 rib.", stitchCount = bodyStitches, rows = hemRounds),
            PlanStep("Bind off loosely in rib.", isMilestone = true),
        )

        val sleeveSteps = mutableListOf(
            PlanStep(
                "Return $sleeveEnd held sts to the needle and pick up $underarmCastOn sts " +
                    "across the underarm.",
                stitchCount = sleeveStitches, isMilestone = true,
            ),
        )
        sleeveSteps += if (sleeveDecreaseRounds > 0) {
            PlanStep(
                "Decrease round: k1, k2tog, knit to last 3 sts, ssk, k1. Work it " +
                    "$sleeveRhythm, $sleeveDecreaseRounds decrease rounds in all.",
                stitchCount = cuffStitches, rows = sleeveTaperRounds,
            )
        } else {
            PlanStep(
                "Work $sleeveTaperRounds rounds even — no sleeve taper is needed at this size.",
                stitchCount = sleeveStitches, rows = sleeveTaperRounds,
            )
        }
        sleeveSteps += PlanStep(
            "Work $cuffRounds rounds in 2×2 rib, then bind off loosely in rib.",
            stitchCount = cuffStitches, rows = cuffRounds,
        )
        sleeveSteps += PlanStep("Work the second sleeve the same way.", isMilestone = true)

        val yokeAverage = (neckCastOn + yokeEndStitches) / 2.0
        val sleeveAverage = (sleeveStitches + cuffStitches) / 2.0

        val warnings = CalculatorSupport.gaugeWarnings(gauge).toMutableList()
        val sleeveDifference = (sleeveStitches - upperArmStitches).toDouble()
        if (abs(sleeveDifference) > upperArmStitches * 0.12) {
            warnings += "The yoke cannot reach your upper arm measurement from this neck opening: it " +
                "gives ${CalculatorSupport.cm(gauge.widthForStitches(sleeveStitches.toDouble()), units)} " +
                "against the ${CalculatorSupport.cm(measurements.upperArm, units)} you entered. " +
                if (sleeveDifference > 0) "Cast on fewer neck stitches."
                else "Cast on more neck stitches, or add sleeve increases after the split."
        }
        if (bodyBelow <= 0) {
            warnings += "The yoke alone is longer than the body length you entered — check the body " +
                "measurement, it should be shoulder to hem."
        }
        if (sleeveIncreaseRounds == 0 && bodyIncreaseRounds > 0) {
            warnings += "The neck cast-on already gives sleeves as wide as your upper arm, so the sleeves " +
                "never increase. A smaller neck opening would give a better-shaped raglan line."
        }

        val notes = mutableListOf(
            "Body and sleeves need different amounts of growth, so this is a compound raglan: " +
                "$fullIncreaseRounds rounds increase all 8 points, and " +
                "${bodyOnlyRounds + sleeveOnlyRounds} increase only " +
                (if (bodyOnlyRounds >= sleeveOnlyRounds) "the body" else "the sleeves") + ". " +
                "Growing both at one rate is what leaves plain raglans with balloon sleeves.",
            "Try the sweater on at the split — that is the last easy moment to change your mind " +
                "about the armhole depth.",
        )
        if (everyRoundIncreases > 0) {
            val plainYoke = increaseRounds * 2 * gauge.rowHeight
            notes += "$everyRoundIncreases of the increase rounds are worked back-to-back. Spacing " +
                "them all every other round would make the yoke " +
                "${CalculatorSupport.cm(plainYoke - yokeDepth, units)} deeper than the armhole needs."
        }

        return ProjectPlan(
            title = "Top-down raglan sweater",
            gauge = gauge,
            facts = listOf(
                PlanFact("Neck cast-on", "$neckCastOn sts"),
                PlanFact(
                    "Increase rounds", "$increaseRounds",
                    "$fullIncreaseRounds full, $bodyOnlyRounds body-only, $sleeveOnlyRounds sleeve-only",
                ),
                PlanFact(
                    "Increase rhythm",
                    "$alternatingIncreases alternating + $everyRoundIncreases back-to-back",
                ),
                PlanFact(
                    "Body at underarm", "$bodyStitches sts",
                    CalculatorSupport.cm(gauge.widthForStitches(bodyStitches.toDouble()), units),
                ),
                PlanFact(
                    "Sleeve at underarm", "$sleeveStitches sts",
                    CalculatorSupport.cm(gauge.widthForStitches(sleeveStitches.toDouble()), units),
                ),
                PlanFact(
                    "Yoke depth", CalculatorSupport.cm(yokeDepth, units),
                    "armhole target ${CalculatorSupport.cm(targetArmhole, units)}",
                ),
                PlanFact(
                    "Finished chest", CalculatorSupport.cm(finishedChest, units),
                    "${(options.ease * 100).toInt()}% ease",
                ),
            ),
            sections = listOf(
                PlanSection("Yoke", "Neck to underarm", yokeSteps),
                PlanSection("Separate the sleeves", steps = splitSteps),
                PlanSection("Body", "Underarm to hem", bodySteps),
                PlanSection("Sleeves", "Worked one at a time in the round", sleeveSteps),
            ),
            blocks = listOf(
                StitchBlock("Yoke", yokeAverage * yokeRounds, structure),
                StitchBlock("Body", (bodyStitches * bodyPlainRounds).toDouble(), structure),
                StitchBlock("Hem rib", (bodyStitches * hemRounds).toDouble(), FabricStructure.RIBBING),
                StitchBlock("Sleeves", sleeveAverage * sleeveTaperRounds * 2, structure),
                StitchBlock("Cuffs", (cuffStitches * cuffRounds * 2).toDouble(), FabricStructure.RIBBING),
            ),
            notes = notes,
            warnings = warnings,
        )
    }
}

/** A cuff-down sock: ribbed cuff, leg, heel flap, heel turn, gusset, foot, toe. */
object SockCalculator {
    fun plan(
        gauge: Gauge,
        measurements: BodyMeasurements,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem,
    ): ProjectPlan {
        // Socks are always worked with negative ease so they stay up.
        val negativeEase = minOf(0.2, if (abs(options.ease) == 0.0) 0.10 else abs(options.ease))
        val footCirc = maxOf(10.0, measurements.footCircumference)
        val footLength = maxOf(10.0, measurements.footLength)
        val sockCirc = footCirc * (1 - negativeEase)

        val castOn = Shaping.roundToMultiple(gauge.stitchesForWidth(sockCirc), 4)
        val heelStitches = castOn / 2
        val instepStitches = castOn - heelStitches

        val cuffRounds = maxOf(1, gauge.rowsForLength(options.cuffDepth).swiftRoundedToInt())
        val legRounds = maxOf(
            0,
            gauge.rowsForLength(maxOf(0.0, options.legLength - options.cuffDepth)).swiftRoundedToInt(),
        )

        // A square heel flap: as many rows as there are heel stitches.
        val heelFlapRows = heelStitches
        val heelTurnRows = maxOf(2, heelStitches / 2)
        val heelTurnStitches = heelStitches / 2 + 2

        // One stitch picked up for every two flap rows, plus one in the corner.
        val gussetPickUp = heelFlapRows / 2 + 1
        val afterPickUp = heelTurnStitches + 2 * gussetPickUp + instepStitches
        val gussetDecreaseRounds = maxOf(0, ceil((afterPickUp - castOn) / 2.0).toInt())

        // Wedge toe: 4 sts out per decrease round.
        val toeEndStitches = Shaping.roundToMultiple((castOn / 4).toDouble(), 4)
        val toeDecreaseRounds = maxOf(1, (castOn - toeEndStitches) / 4)
        val toeRows = toeDecreaseRounds * 2 - toeDecreaseRounds / 3
        val toeLength = toeRows * gauge.rowHeight

        val gussetLength = gussetDecreaseRounds * 2 * gauge.rowHeight
        val footPlainLength = maxOf(0.0, footLength - toeLength - gussetLength)
        val footRounds = maxOf(0, gauge.rowsForLength(footPlainLength).swiftRoundedToInt())

        val cuffSteps = listOf(
            PlanStep(
                "Cast on $castOn sts with a stretchy cast-on. Join in the round and divide " +
                    "over your needles: $heelStitches heel sts and $instepStitches instep sts.",
                stitchCount = castOn, isMilestone = true,
            ),
            PlanStep("Work $cuffRounds rounds in 1×1 or 2×2 rib.", stitchCount = castOn, rows = cuffRounds),
            PlanStep(
                "Work $legRounds rounds in ${structure.displayName.lowercase()} for the leg.",
                stitchCount = castOn, rows = legRounds,
            ),
        )

        val heelSteps = listOf(
            PlanStep(
                "Heel flap, worked flat on $heelStitches sts over $heelFlapRows rows. " +
                    "RS: [sl1, k1] to end. WS: sl1, purl to end. The slipped stitches make the " +
                    "double-thick fabric that takes the wear.",
                stitchCount = heelStitches, rows = heelFlapRows, isMilestone = true,
            ),
            PlanStep(
                "Turn the heel with short rows: work past the centre, ssk (or p2tog), turn, " +
                    "and repeat, taking in one more stitch each side every row until all the flap " +
                    "stitches are used.",
                stitchCount = heelTurnStitches, rows = heelTurnRows, isMilestone = true,
            ),
            PlanStep("Pick up $gussetPickUp sts along each side of the flap.", stitchCount = afterPickUp),
            PlanStep(
                "Gusset: decrease 2 sts every other round $gussetDecreaseRounds times " +
                    "(k to 3 sts before the instep, k2tog, k1 — and k1, ssk after it) until " +
                    "$castOn sts remain.",
                stitchCount = castOn, rows = gussetDecreaseRounds * 2, isMilestone = true,
            ),
        )

        val footSteps = listOf(
            PlanStep(
                "Work $footRounds rounds even until the foot measures " +
                    "${CalculatorSupport.cm(footLength - toeLength, units)} from the back of the heel — " +
                    "that is ${CalculatorSupport.cm(toeLength, units)} short of the end of your toes.",
                stitchCount = castOn, rows = footRounds,
            ),
        )

        val toeSteps = listOf(
            PlanStep(
                "Toe: decrease 4 sts per decrease round (k to 3 sts before the end of each half, " +
                    "k2tog, k1; k1, ssk at the start of the next half). Work $toeDecreaseRounds " +
                    "decrease rounds over $toeRows rounds — every other round at first, then " +
                    "every round for the last third.",
                stitchCount = toeEndStitches, rows = toeRows, isMilestone = true,
            ),
            PlanStep(
                "Graft the remaining $toeEndStitches sts with Kitchener stitch.",
                isMilestone = true,
            ),
            PlanStep("Knit the second sock the same way.", isMilestone = true),
        )

        val gussetAverage = (afterPickUp + castOn) / 2.0
        // Per sock, then doubled — a pair is what anyone actually knits.
        val perSock = listOf(
            StitchBlock("Cuff", (castOn * cuffRounds).toDouble(), FabricStructure.RIBBING),
            StitchBlock("Leg", (castOn * legRounds).toDouble(), structure),
            StitchBlock("Heel flap", (heelStitches * heelFlapRows).toDouble(), FabricStructure.MOSAIC),
            StitchBlock("Heel turn", (heelStitches * heelTurnRows).toDouble(), structure),
            StitchBlock("Gusset", gussetAverage * gussetDecreaseRounds * 2, structure),
            StitchBlock("Foot", (castOn * footRounds).toDouble(), structure),
            StitchBlock("Toe", (castOn + toeEndStitches) / 2.0 * toeRows, structure),
        )

        val warnings = CalculatorSupport.gaugeWarnings(gauge).toMutableList()
        if (gauge.stitchesPer10cm < 24) {
            warnings += "Socks knitted looser than about 24 sts / 10 cm wear through quickly. A firmer " +
                "fabric on smaller needles lasts far longer."
        }
        if (footPlainLength <= 0) {
            warnings += "The gusset and toe already fill the whole foot length — this foot is very short " +
                "for this gauge. Check the foot length measurement."
        }

        return ProjectPlan(
            title = "Socks",
            gauge = gauge,
            facts = listOf(
                PlanFact("Cast on", "$castOn sts", "$heelStitches heel + $instepStitches instep"),
                PlanFact(
                    "Sock circumference", CalculatorSupport.cm(sockCirc, units),
                    "${(negativeEase * 100).toInt()}% negative ease",
                ),
                PlanFact("Heel flap", "$heelFlapRows rows"),
                PlanFact("Gusset pick-up", "$gussetPickUp sts each side"),
                PlanFact(
                    "Toe", "$toeDecreaseRounds decrease rounds",
                    CalculatorSupport.cm(toeLength, units),
                ),
                PlanFact("Yarn shown for", "a pair"),
            ),
            sections = listOf(
                PlanSection("Cuff and leg", steps = cuffSteps),
                PlanSection("Heel", "Flap, turn and gusset", heelSteps),
                PlanSection("Foot", steps = footSteps),
                PlanSection("Toe", steps = toeSteps),
            ),
            blocks = perSock.map { it.copy(stitches = it.stitches * 2) },
            notes = listOf(
                "The heel flap is worked back and forth on half the stitches while the instep " +
                    "stitches wait — nothing is bound off.",
                "Measure the foot length against the sock as you go; it is the one number that " +
                    "cannot be fixed afterwards.",
            ),
            warnings = warnings,
        )
    }
}

/** Mittens worked in the round from the cuff up, with a thumb gusset. */
object MittenCalculator {
    fun plan(
        gauge: Gauge,
        measurements: BodyMeasurements,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem,
    ): ProjectPlan {
        val negativeEase = minOf(0.15, if (abs(options.ease) == 0.0) 0.05 else abs(options.ease))
        val handCirc = maxOf(10.0, measurements.handCircumference)
        val handLength = maxOf(10.0, measurements.handLength)
        val mittenCirc = handCirc * (1 - negativeEase)

        val castOn = Shaping.roundToMultiple(gauge.stitchesForWidth(mittenCirc), 4)
        val cuffRounds = maxOf(1, gauge.rowsForLength(options.ribDepth).swiftRoundedToInt())

        // The thumb takes roughly a quarter of the hand circumference.
        val thumbStitches = Shaping.roundToMultiple(castOn * 0.26, 2)
        val gussetIncreaseRounds = maxOf(1, (thumbStitches - 2) / 2)
        val gussetRounds =
            maxOf(gussetIncreaseRounds, gauge.rowsForLength(handLength * 0.28).swiftRoundedToInt())
        val gussetRhythm = Shaping.rhythm(gussetIncreaseRounds, gussetRounds, "round")

        // Top shaping closes over about a quarter of the mitten width.
        val topEndStitches = Shaping.roundToMultiple(castOn * 0.25, 4)
        val topDecreaseRounds = maxOf(1, (castOn - topEndStitches) / 4)
        val topLength = topDecreaseRounds * gauge.rowHeight

        val cuffLength = cuffRounds * gauge.rowHeight
        val gussetActual = gussetRounds * gauge.rowHeight
        val handPlainLength = maxOf(0.0, handLength - cuffLength - gussetActual - topLength)
        val handRounds = maxOf(0, gauge.rowsForLength(handPlainLength).swiftRoundedToInt())

        val thumbRounds = maxOf(1, gauge.rowsForLength(handLength * 0.28).swiftRoundedToInt())
        val thumbTotal = thumbStitches + 2

        val cuffSteps = listOf(
            PlanStep("Cast on $castOn sts, join in the round.", stitchCount = castOn, isMilestone = true),
            PlanStep("Work $cuffRounds rounds in 2×2 rib.", stitchCount = castOn, rows = cuffRounds),
        )
        val gussetSteps = listOf(
            PlanStep(
                "Place a marker for the thumb gusset. Increase round: M1L, knit the gusset sts, " +
                    "M1R — 2 sts added.",
                stitchCount = castOn + 2,
            ),
            PlanStep(
                "Work the increase round $gussetRhythm, $gussetIncreaseRounds increase rounds " +
                    "in all, over $gussetRounds rounds.",
                stitchCount = castOn + gussetIncreaseRounds * 2, rows = gussetRounds, isMilestone = true,
            ),
            PlanStep(
                "Slip the $thumbStitches gusset sts onto waste yarn, cast on 2 sts over the gap " +
                    "and carry on around.",
                stitchCount = castOn, isMilestone = true,
            ),
        )
        val handSteps = listOf(
            PlanStep(
                "Work $handRounds rounds even until the mitten reaches the top of your little " +
                    "finger, about ${CalculatorSupport.cm(handLength - topLength, units)} from the cast-on.",
                stitchCount = castOn, rows = handRounds,
            ),
            PlanStep(
                "Top shaping: decrease 4 sts every round $topDecreaseRounds times " +
                    "(k1, ssk at the start and k2tog, k1 at the end of each half).",
                stitchCount = topEndStitches, rows = topDecreaseRounds, isMilestone = true,
            ),
            PlanStep(
                "Graft the remaining $topEndStitches sts, or thread the yarn through and cinch.",
                isMilestone = true,
            ),
        )
        val thumbSteps = listOf(
            PlanStep(
                "Return the $thumbStitches held sts to the needle and pick up 2 sts across the gap.",
                stitchCount = thumbTotal, isMilestone = true,
            ),
            PlanStep(
                "Work $thumbRounds rounds even, then decrease 2 sts every round until " +
                    "${maxOf(4, thumbTotal / 3)} sts remain and cinch closed.",
                stitchCount = thumbTotal, rows = thumbRounds,
            ),
            PlanStep(
                "Knit the second mitten, mirroring the gusset to the other side of the hand.",
                isMilestone = true,
            ),
        )

        val gussetAverage = castOn + gussetIncreaseRounds.toDouble()
        val perMitten = listOf(
            StitchBlock("Cuff", (castOn * cuffRounds).toDouble(), FabricStructure.RIBBING),
            StitchBlock("Gusset", gussetAverage * gussetRounds, structure),
            StitchBlock("Hand", (castOn * handRounds).toDouble(), structure),
            StitchBlock("Top", (castOn + topEndStitches) / 2.0 * topDecreaseRounds, structure),
            StitchBlock("Thumb", (thumbTotal * thumbRounds).toDouble(), structure),
        )

        return ProjectPlan(
            title = "Mittens",
            gauge = gauge,
            facts = listOf(
                PlanFact("Cast on", "$castOn sts"),
                PlanFact(
                    "Mitten circumference", CalculatorSupport.cm(mittenCirc, units),
                    "${(negativeEase * 100).toInt()}% negative ease",
                ),
                PlanFact("Thumb gusset", "$thumbStitches sts", "$gussetIncreaseRounds increase rounds"),
                PlanFact("Top shaping", "$topDecreaseRounds rounds"),
                PlanFact("Yarn shown for", "a pair"),
            ),
            sections = listOf(
                PlanSection("Cuff", steps = cuffSteps),
                PlanSection("Thumb gusset", steps = gussetSteps),
                PlanSection("Hand", steps = handSteps),
                PlanSection("Thumb", steps = thumbSteps),
            ),
            blocks = perMitten.map { it.copy(stitches = it.stitches * 2) },
            notes = listOf(
                "Try the mitten on before the top shaping — the tip should start at the top of " +
                    "your little finger, not at your fingertips.",
                "Mittens are the classic stranded colourwork project: the fabric is doubled by " +
                    "the floats, which is exactly what you want in the cold.",
            ),
            warnings = CalculatorSupport.gaugeWarnings(gauge),
        )
    }
}

/** A top-down triangle shawl worked from a garter tab. */
object ShawlCalculator {
    fun plan(
        gauge: Gauge,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem,
    ): ProjectPlan {
        val wingspan = maxOf(20.0, options.wingspan)
        val increasesPerRow = maxOf(2, options.increasesPerRightSideRow)
        val castOn = 3

        val finalStitches = Shaping.roundToMultiple(gauge.stitchesForWidth(wingspan), 2)
        val rightSideRows =
            maxOf(1, ceil((finalStitches - castOn).toDouble() / increasesPerRow).toInt())
        val rows = rightSideRows * 2
        val depth = rows * gauge.rowHeight

        val steps = listOf(
            PlanStep(
                "Garter tab: cast on 3 sts, knit 6 rows, then pick up 3 sts along the side and " +
                    "3 from the cast-on edge — 9 sts. This gives a top edge with no lumpy corner.",
                stitchCount = 9, isMilestone = true,
            ),
            PlanStep("Set-up: k3 (border), place marker, k1 (spine), place marker, k3 (border)."),
            PlanStep(
                "Increase row (RS): k3, yo, knit to marker, yo, k1 (spine), yo, knit to last 3 sts, " +
                    "yo, k3 — $increasesPerRow sts added.",
            ),
            PlanStep("Wrong-side rows: k3, purl to last 3 sts, k3."),
            PlanStep(
                "Repeat those two rows $rightSideRows times in all, until you have $finalStitches sts.",
                stitchCount = finalStitches, rows = rows, isMilestone = true,
            ),
            PlanStep(
                "Bind off very loosely — a shawl bind-off must stretch as far as the fabric. " +
                    "Use a needle two sizes larger, or a lace bind-off.",
                isMilestone = true,
            ),
        )

        val warnings = CalculatorSupport.gaugeWarnings(gauge).toMutableList()
        if (depth < wingspan * 0.35) {
            warnings += "This shawl comes out shallow for its wingspan. Rows are shorter than stitches " +
                "are wide at this gauge — check the row gauge if that is unexpected."
        }

        return ProjectPlan(
            title = "Triangle shawl",
            gauge = gauge,
            facts = listOf(
                PlanFact("Cast on", "$castOn sts", "garter tab to 9 sts"),
                PlanFact("Final stitches", "$finalStitches"),
                PlanFact("Rows", "$rows", "$rightSideRows increase rows"),
                PlanFact("Wingspan", CalculatorSupport.cm(wingspan, units)),
                PlanFact("Depth at the spine", CalculatorSupport.cm(depth, units)),
            ),
            sections = listOf(PlanSection("Shawl", steps = steps)),
            blocks = listOf(
                StitchBlock("Shawl", (castOn + finalStitches) / 2.0 * rows, structure),
            ),
            notes = listOf(
                "Stitch count grows every right-side row, so the last few rows take as long as " +
                    "the first fifty put together. Budget your yarn for the end, not the middle.",
                "Blocking a shawl is not optional — it is what opens the fabric out to the " +
                    "measurements above.",
            ),
            warnings = warnings,
        )
    }
}
