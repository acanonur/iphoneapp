import Foundation

/// Mittens worked in the round from the cuff up, with a thumb gusset.
enum MittenCalculator {

    static func plan(
        gauge: Gauge,
        measurements: BodyMeasurements,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem
    ) -> ProjectPlan {
        let negativeEase = min(0.15, abs(options.ease) == 0 ? 0.05 : abs(options.ease))
        let handCirc = max(10, measurements.handCircumference)
        let handLength = max(10, measurements.handLength)
        let mittenCirc = handCirc * (1 - negativeEase)

        let castOn = Shaping.roundToMultiple(gauge.stitches(forWidth: mittenCirc), multiple: 4)
        let cuffRounds = max(1, Int(gauge.rows(forLength: options.ribDepth).rounded()))

        // The thumb takes roughly a quarter of the hand circumference.
        let thumbStitches = Shaping.roundToMultiple(Double(castOn) * 0.26, multiple: 2)
        let gussetIncreaseRounds = max(1, (thumbStitches - 2) / 2)
        let gussetLength = handLength * 0.28
        let gussetRounds = max(gussetIncreaseRounds, Int(gauge.rows(forLength: gussetLength).rounded()))
        let gussetRhythm = Shaping.rhythm(events: gussetIncreaseRounds, over: gussetRounds, unit: "round")

        // Top shaping closes over about a quarter of the mitten width.
        let topEndStitches = Shaping.roundToMultiple(Double(castOn) * 0.25, multiple: 4)
        let topDecreaseRounds = max(1, (castOn - topEndStitches) / 4)
        let topLength = Double(topDecreaseRounds) * gauge.rowHeight

        let cuffLength = Double(cuffRounds) * gauge.rowHeight
        let gussetActual = Double(gussetRounds) * gauge.rowHeight
        let handPlainLength = max(0, handLength - cuffLength - gussetActual - topLength)
        let handRounds = max(0, Int(gauge.rows(forLength: handPlainLength).rounded()))

        let cuffSteps: [PlanStep] = [
            PlanStep(
                "Cast on \(castOn) sts, join in the round.", stitchCount: castOn, isMilestone: true),
            PlanStep("Work \(cuffRounds) rounds in 2×2 rib.", stitchCount: castOn, rows: cuffRounds),
        ]

        let gussetSteps: [PlanStep] = [
            PlanStep(
                "Place a marker for the thumb gusset. Increase round: M1L, knit the gusset sts, "
                + "M1R — 2 sts added.", stitchCount: castOn + 2),
            PlanStep(
                "Work the increase round \(gussetRhythm), \(gussetIncreaseRounds) increase rounds "
                + "in all, over \(gussetRounds) rounds.",
                stitchCount: castOn + gussetIncreaseRounds * 2, rows: gussetRounds, isMilestone: true),
            PlanStep(
                "Slip the \(thumbStitches) gusset sts onto waste yarn, cast on 2 sts over the gap "
                + "and carry on around.", stitchCount: castOn, isMilestone: true),
        ]

        let handSteps: [PlanStep] = [
            PlanStep(
                "Work \(handRounds) rounds even until the mitten reaches the top of your little "
                + "finger, about \(CalculatorSupport.cm(handLength - topLength, units)) from the cast-on.",
                stitchCount: castOn, rows: handRounds),
            PlanStep(
                "Top shaping: decrease 4 sts every round \(topDecreaseRounds) times "
                + "(k1, ssk at the start and k2tog, k1 at the end of each half).",
                stitchCount: topEndStitches, rows: topDecreaseRounds, isMilestone: true),
            PlanStep(
                "Graft the remaining \(topEndStitches) sts, or thread the yarn through and cinch.",
                isMilestone: true),
        ]

        let thumbRounds = max(1, Int(gauge.rows(forLength: handLength * 0.28).rounded()))
        let thumbTotal = thumbStitches + 2
        let thumbSteps: [PlanStep] = [
            PlanStep(
                "Return the \(thumbStitches) held sts to the needle and pick up 2 sts across the "
                + "gap.", stitchCount: thumbTotal, isMilestone: true),
            PlanStep(
                "Work \(thumbRounds) rounds even, then decrease 2 sts every round until "
                + "\(max(4, thumbTotal / 3)) sts remain and cinch closed.",
                stitchCount: thumbTotal, rows: thumbRounds),
            PlanStep(
                "Knit the second mitten, mirroring the gusset to the other side of the hand.",
                isMilestone: true),
        ]

        // Per mitten, then doubled for the pair.
        let gussetAverage = Double(castOn) + Double(gussetIncreaseRounds)
        let perMitten: [StitchBlock] = [
            StitchBlock("Cuff", stitches: Double(castOn * cuffRounds), structure: .ribbing),
            StitchBlock("Gusset", stitches: gussetAverage * Double(gussetRounds), structure: structure),
            StitchBlock("Hand", stitches: Double(castOn * handRounds), structure: structure),
            StitchBlock("Top", stitches: Double(castOn + topEndStitches) / 2 * Double(topDecreaseRounds), structure: structure),
            StitchBlock("Thumb", stitches: Double(thumbTotal * thumbRounds), structure: structure),
        ]
        let blocks = perMitten.map {
            StitchBlock($0.name, stitches: $0.stitches * 2, structure: $0.structure)
        }

        // The thumb measurement the schematic wants is how far the gusset runs up
        // the hand, not the length of the finished thumb tube.
        var metrics = PlanMetrics()
        metrics.castOnStitches = castOn
        metrics.circumference = mittenCirc
        metrics.handLength = handLength
        metrics.thumbLength = gussetActual
        metrics.ribDepth = cuffLength

        return ProjectPlan(
            title: "Mittens",
            gauge: gauge,
            facts: [
                PlanFact("Cast on", "\(castOn) sts"),
                PlanFact("Mitten circumference", CalculatorSupport.cm(mittenCirc, units),
                         detail: "\(Int(negativeEase * 100))% negative ease"),
                PlanFact("Thumb gusset", "\(thumbStitches) sts",
                         detail: "\(gussetIncreaseRounds) increase rounds"),
                PlanFact("Top shaping", "\(topDecreaseRounds) rounds"),
                PlanFact("Yarn shown for", "a pair"),
            ],
            sections: [
                PlanSection("Cuff", steps: cuffSteps),
                PlanSection("Thumb gusset", steps: gussetSteps),
                PlanSection("Hand", steps: handSteps),
                PlanSection("Thumb", steps: thumbSteps),
            ],
            blocks: blocks,
            notes: [
                "Try the mitten on before the top shaping — the tip should start at the top of "
                + "your little finger, not at your fingertips.",
                "Mittens are the classic stranded colourwork project: the fabric is doubled by "
                + "the floats, which is exactly what you want in the cold.",
            ],
            warnings: CalculatorSupport.gaugeWarnings(gauge),
            metrics: metrics
        )
    }
}

/// A top-down triangle shawl worked from a garter tab.
enum ShawlCalculator {

    static func plan(
        gauge: Gauge,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem
    ) -> ProjectPlan {
        let wingspan = max(20, options.wingspan)
        let increasesPerRow = max(2, options.increasesPerRightSideRow)
        let castOn = 3

        let finalStitches = Shaping.roundToMultiple(gauge.stitches(forWidth: wingspan), multiple: 2)
        let rightSideRows = max(1, Int((Double(finalStitches - castOn) / Double(increasesPerRow)).rounded(.up)))
        let rows = rightSideRows * 2
        let depth = Double(rows) * gauge.rowHeight

        let steps: [PlanStep] = [
            PlanStep(
                "Garter tab: cast on 3 sts, knit 6 rows, then pick up 3 sts along the side and "
                + "3 from the cast-on edge — 9 sts. This gives a top edge with no lumpy corner.",
                stitchCount: 9, isMilestone: true),
            PlanStep(
                "Set-up: k3 (border), place marker, k1 (spine), place marker, k3 (border)."),
            PlanStep(
                "Increase row (RS): k3, yo, knit to marker, yo, k1 (spine), yo, knit to last 3 sts, "
                + "yo, k3 — \(increasesPerRow) sts added."),
            PlanStep("Wrong-side rows: k3, purl to last 3 sts, k3."),
            PlanStep(
                "Repeat those two rows \(rightSideRows) times in all, until you have "
                + "\(finalStitches) sts.",
                stitchCount: finalStitches, rows: rows, isMilestone: true),
            PlanStep(
                "Bind off very loosely — a shawl bind-off must stretch as far as the fabric. "
                + "Use a needle two sizes larger, or a lace bind-off.", isMilestone: true),
        ]

        var warnings = CalculatorSupport.gaugeWarnings(gauge)
        if depth < wingspan * 0.35 {
            warnings.append(
                "This shawl comes out shallow for its wingspan. Rows are shorter than stitches "
                + "are wide at this gauge — check the row gauge if that is unexpected.")
        }

        var metrics = PlanMetrics()
        metrics.castOnStitches = castOn
        metrics.wingspan = wingspan
        metrics.depth = depth

        return ProjectPlan(
            title: "Triangle shawl",
            gauge: gauge,
            facts: [
                PlanFact("Cast on", "\(castOn) sts", detail: "garter tab to 9 sts"),
                PlanFact("Final stitches", "\(finalStitches)"),
                PlanFact("Rows", "\(rows)", detail: "\(rightSideRows) increase rows"),
                PlanFact("Wingspan", CalculatorSupport.cm(wingspan, units)),
                PlanFact("Depth at the spine", CalculatorSupport.cm(depth, units)),
            ],
            sections: [PlanSection("Shawl", steps: steps)],
            blocks: [
                StitchBlock(
                    "Shawl",
                    stitches: Double(castOn + finalStitches) / 2 * Double(rows),
                    structure: structure)
            ],
            notes: [
                "Stitch count grows every right-side row, so the last few rows take as long as "
                + "the first fifty put together. Budget your yarn for the end, not the middle.",
                "Blocking a shawl is not optional — it is what opens the fabric out to the "
                + "measurements above.",
            ],
            warnings: warnings,
            metrics: metrics
        )
    }
}
