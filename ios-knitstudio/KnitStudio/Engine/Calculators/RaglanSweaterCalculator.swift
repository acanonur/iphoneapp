import Foundation

/// A seamless top-down raglan: cast on at the neck, increase at four raglan
/// lines to the underarm, split off the sleeves, then work body and sleeves down.
enum RaglanSweaterCalculator {

    static func plan(
        gauge: Gauge,
        measurements: BodyMeasurements,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem
    ) -> ProjectPlan {
        let raglanSts = max(1, options.raglanStitches)
        let chest = max(40, measurements.chest)
        let finishedChest = chest * (1 + options.ease)

        let bodyTarget = Shaping.roundToMultiple(gauge.stitches(forWidth: finishedChest), multiple: 4)
        let neckCastOn = Shaping.roundToMultiple(
            gauge.stitches(forWidth: max(20, measurements.neckCircumference)), multiple: 4)

        // Split the neck between back, front and two sleeves. `available` is a
        // multiple of 4, so front and back come out equal by construction.
        let raglanTotal = raglanSts * 4
        let available = max(4, neckCastOn - raglanTotal)
        let sleeveStart = max(1, Int((Double(available) * 0.16).rounded()))
        let front = (available - sleeveStart * 2) / 2
        let back = available - front - sleeveStart * 2

        // Stitches cast on under each arm, roughly 5% of the chest.
        let underarmCastOn = Shaping.roundToMultiple(gauge.stitches(forWidth: chest * 0.05), multiple: 2)

        // Body and sleeves need different amounts of growth, so this is a
        // compound raglan: on a "full" round all 8 increases are worked, and on
        // a body-only round the M1s are placed on the body side of each raglan
        // line alone (4 sts). Growing both at one rate is what gives plain
        // raglans their famously oversized sleeves.
        let bodyHalfTarget = (bodyTarget - 2 * underarmCastOn) / 2
        let bodyIncreaseRounds = max(0, (bodyHalfTarget - front) / 2)

        let upperArmStitches = Shaping.roundToMultiple(
            gauge.stitches(forWidth: max(15, measurements.upperArm)), multiple: 2)
        let sleeveTargetAtSplit = max(sleeveStart, upperArmStitches - underarmCastOn)
        let sleeveIncreaseRounds = max(0, (sleeveTargetAtSplit - sleeveStart) / 2)

        let fullIncreaseRounds = min(bodyIncreaseRounds, sleeveIncreaseRounds)
        let bodyOnlyRounds = bodyIncreaseRounds - fullIncreaseRounds
        let sleeveOnlyRounds = sleeveIncreaseRounds - fullIncreaseRounds
        let increaseRounds = max(bodyIncreaseRounds, sleeveIncreaseRounds)

        // The yoke must end up as deep as the armhole. Increasing every other
        // round is the default; if that overshoots, some increase rounds are
        // worked back-to-back, and if it undershoots, plain rounds are added.
        let targetArmhole = chest * 0.21
        let targetYokeRounds = max(increaseRounds, Int((targetArmhole / gauge.rowHeight).rounded()))
        let everyRoundIncreases = min(increaseRounds, max(0, 2 * increaseRounds - targetYokeRounds))
        let alternatingIncreases = increaseRounds - everyRoundIncreases
        let increaseSpan = alternatingIncreases * 2 + everyRoundIncreases
        let extraPlainRounds = max(0, targetYokeRounds - increaseSpan)
        let yokeRounds = increaseSpan + extraPlainRounds
        let yokeDepth = Double(yokeRounds) * gauge.rowHeight

        let backEnd = back + 2 * bodyIncreaseRounds
        let frontEnd = front + 2 * bodyIncreaseRounds
        let sleeveEnd = sleeveStart + 2 * sleeveIncreaseRounds
        let bodyStitches = frontEnd + backEnd + 2 * underarmCastOn
        let sleeveStitches = sleeveEnd + underarmCastOn

        // MARK: Body below the underarm

        let bodyBelow = max(0, measurements.bodyLength - yokeDepth)
        let bodyRoundsTotal = max(0, Int(gauge.rows(forLength: bodyBelow).rounded()))
        let hemRounds = min(bodyRoundsTotal, max(0, Int(gauge.rows(forLength: options.ribDepth).rounded())))
        let bodyPlainRounds = bodyRoundsTotal - hemRounds

        // MARK: Sleeves

        let cuffStitches = Shaping.roundToMultiple(
            gauge.stitches(forWidth: max(10, measurements.wrist) * 1.1), multiple: 2)
        let sleeveRoundsTotal = max(1, Int(gauge.rows(forLength: measurements.sleeveLength).rounded()))
        let cuffRounds = min(sleeveRoundsTotal, max(0, Int(gauge.rows(forLength: options.cuffDepth).rounded())))
        let sleeveTaperRounds = sleeveRoundsTotal - cuffRounds
        let sleeveDecreaseRounds = max(0, (sleeveStitches - cuffStitches) / 2)
        let sleeveRhythm = Shaping.rhythm(
            events: sleeveDecreaseRounds, over: sleeveTaperRounds, unit: "round")

        // MARK: Steps

        let yokeEndStitches = neckCastOn + 8 * fullIncreaseRounds
            + 4 * bodyOnlyRounds + 4 * sleeveOnlyRounds

        var yokeSteps: [PlanStep] = [
            PlanStep(
                "Cast on \(neckCastOn) sts and join to work in the round.",
                stitchCount: neckCastOn, isMilestone: true),
            PlanStep(
                "Place markers: \(back) back sts, \(raglanSts) raglan, \(sleeveStart) sleeve sts, "
                + "\(raglanSts) raglan, \(front) front sts, \(raglanSts) raglan, "
                + "\(sleeveStart) sleeve sts, \(raglanSts) raglan.",
                stitchCount: neckCastOn),
            PlanStep(
                "Full increase round: [knit to 1 st before marker, M1R, k\(raglanSts), M1L] "
                + "4 times — 8 sts added, 2 to every section."),
        ]
        if bodyOnlyRounds > 0 {
            yokeSteps.append(PlanStep(
                "Body-only increase round: [knit to 1 st before marker, M1R, k\(raglanSts)] at the "
                + "two back raglans and [k\(raglanSts), M1L] at the two front raglans — 4 sts "
                + "added to the body, none to the sleeves."))
        }
        if sleeveOnlyRounds > 0 {
            yokeSteps.append(PlanStep(
                "Sleeve-only increase round: place both M1s on the sleeve side of each raglan "
                + "line — 4 sts added to the sleeves, none to the body."))
        }
        yokeSteps.append(PlanStep(
            "Work \(fullIncreaseRounds) full increase rounds, "
            + (bodyOnlyRounds > 0
               ? "then \(bodyOnlyRounds) body-only increase rounds."
               : (sleeveOnlyRounds > 0
                  ? "then \(sleeveOnlyRounds) sleeve-only increase rounds."
                  : "which is every increase round.")),
            stitchCount: yokeEndStitches, isMilestone: true))

        let rhythmNote: String
        if everyRoundIncreases > 0 && alternatingIncreases > 0 {
            rhythmNote = "Work the first \(alternatingIncreases) increase rounds every other round, "
                + "then the remaining \(everyRoundIncreases) on every round."
        } else if everyRoundIncreases > 0 {
            rhythmNote = "Work every increase round back-to-back, on every round."
        } else {
            rhythmNote = "Work an increase round every other round throughout."
        }
        yokeSteps.append(PlanStep(rhythmNote, rows: increaseSpan))

        if extraPlainRounds > 0 {
            yokeSteps.append(PlanStep(
                "Work \(extraPlainRounds) rounds even until the yoke measures "
                + "\(CalculatorSupport.cm(yokeDepth, units)) from the cast-on edge.",
                stitchCount: yokeEndStitches,
                rows: extraPlainRounds))
        }
        yokeSteps.append(PlanStep(
            "Yoke complete: \(backEnd) back, \(frontEnd) front, \(sleeveEnd) sts each sleeve.",
            stitchCount: yokeEndStitches, isMilestone: true))

        let splitSteps: [PlanStep] = [
            PlanStep(
                "Knit across the back. Slip the next \(sleeveEnd) sleeve sts onto waste yarn, "
                + "cast on \(underarmCastOn) sts under the arm.", isMilestone: true),
            PlanStep(
                "Knit across the front. Slip the second \(sleeveEnd) sleeve sts onto waste yarn, "
                + "cast on \(underarmCastOn) sts under the arm."),
            PlanStep(
                "Body now joined in the round.", stitchCount: bodyStitches, isMilestone: true),
        ]

        let bodySteps: [PlanStep] = [
            PlanStep(
                "Work \(bodyPlainRounds) rounds in \(structure.name.lowercased()) until the body "
                + "measures \(CalculatorSupport.cm(bodyBelow - options.ribDepth, units)) from the underarm.",
                stitchCount: bodyStitches, rows: bodyPlainRounds),
            PlanStep(
                "Work \(hemRounds) rounds in 2×2 rib.", stitchCount: bodyStitches, rows: hemRounds),
            PlanStep("Bind off loosely in rib.", isMilestone: true),
        ]

        var sleeveSteps: [PlanStep] = [
            PlanStep(
                "Return \(sleeveEnd) held sts to the needle and pick up \(underarmCastOn) sts "
                + "across the underarm.", stitchCount: sleeveStitches, isMilestone: true),
        ]
        if sleeveDecreaseRounds > 0 {
            sleeveSteps.append(PlanStep(
                "Decrease round: k1, k2tog, knit to last 3 sts, ssk, k1. Work it "
                + "\(sleeveRhythm), \(sleeveDecreaseRounds) decrease rounds in all.",
                stitchCount: cuffStitches, rows: sleeveTaperRounds))
        } else {
            sleeveSteps.append(PlanStep(
                "Work \(sleeveTaperRounds) rounds even — no sleeve taper is needed at this size.",
                stitchCount: sleeveStitches, rows: sleeveTaperRounds))
        }
        sleeveSteps.append(PlanStep(
            "Work \(cuffRounds) rounds in 2×2 rib, then bind off loosely in rib.",
            stitchCount: cuffStitches, rows: cuffRounds))
        sleeveSteps.append(PlanStep("Work the second sleeve the same way.", isMilestone: true))

        // MARK: Yarn accounting

        let yokeAverage = Double(neckCastOn + yokeEndStitches) / 2
        let sleeveAverage = Double(sleeveStitches + cuffStitches) / 2

        let blocks = [
            StitchBlock("Yoke", stitches: yokeAverage * Double(yokeRounds), structure: structure),
            StitchBlock("Body", stitches: Double(bodyStitches * bodyPlainRounds), structure: structure),
            StitchBlock("Hem rib", stitches: Double(bodyStitches * hemRounds), structure: .ribbing),
            StitchBlock("Sleeves", stitches: sleeveAverage * Double(sleeveTaperRounds) * 2, structure: structure),
            StitchBlock("Cuffs", stitches: Double(cuffStitches * cuffRounds * 2), structure: .ribbing),
        ]

        // MARK: Fit checks

        var warnings = CalculatorSupport.gaugeWarnings(gauge)
        let sleeveDifference = Double(sleeveStitches - upperArmStitches)
        if abs(sleeveDifference) > Double(upperArmStitches) * 0.12 {
            let actual = gauge.width(forStitches: Double(sleeveStitches))
            warnings.append(
                "The yoke cannot reach your upper arm measurement from this neck opening: it "
                + "gives \(CalculatorSupport.cm(actual, units)) against the "
                + "\(CalculatorSupport.cm(measurements.upperArm, units)) you entered. "
                + (sleeveDifference > 0
                   ? "Cast on fewer neck stitches."
                   : "Cast on more neck stitches, or add sleeve increases after the split."))
        }
        if bodyBelow <= 0 {
            warnings.append(
                "The yoke alone is longer than the body length you entered — check the body "
                + "measurement, it should be shoulder to hem.")
        }
        if sleeveIncreaseRounds == 0 && bodyIncreaseRounds > 0 {
            warnings.append(
                "The neck cast-on already gives sleeves as wide as your upper arm, so the sleeves "
                + "never increase. A smaller neck opening would give a better-shaped raglan line.")
        }

        var notes = [
            "Body and sleeves need different amounts of growth, so this is a compound raglan: "
            + "\(fullIncreaseRounds) rounds increase all 8 points, and "
            + "\(bodyOnlyRounds + sleeveOnlyRounds) increase only "
            + (bodyOnlyRounds >= sleeveOnlyRounds ? "the body" : "the sleeves") + ". "
            + "Growing both at one rate is what leaves plain raglans with balloon sleeves.",
            "Try the sweater on at the split — that is the last easy moment to change your mind "
            + "about the armhole depth.",
        ]
        if everyRoundIncreases > 0 {
            let plainYoke = Double(increaseRounds * 2) * gauge.rowHeight
            notes.append(
                "\(everyRoundIncreases) of the increase rounds are worked back-to-back. Spacing "
                + "them all every other round would make the yoke "
                + "\(CalculatorSupport.cm(plainYoke - yokeDepth, units)) deeper than the armhole needs.")
        }

        // MARK: Finished measurements

        // Taken from the stitch and round counts, so the schematic shows the
        // sweater that gets knitted. The body length runs hem to neck, yoke included.
        var metrics = PlanMetrics()
        metrics.castOnStitches = neckCastOn
        metrics.neckCircumference = gauge.width(forStitches: Double(neckCastOn))
        metrics.chestCircumference = gauge.width(forStitches: Double(bodyStitches))
        metrics.upperArmCircumference = gauge.width(forStitches: Double(sleeveStitches))
        metrics.cuffCircumference = gauge.width(forStitches: Double(cuffStitches))
        metrics.yokeDepth = yokeDepth
        metrics.bodyLength = yokeDepth + gauge.length(forRows: Double(bodyRoundsTotal))
        metrics.sleeveLength = gauge.length(forRows: Double(sleeveRoundsTotal))
        metrics.ribDepth = gauge.length(forRows: Double(hemRounds))

        return ProjectPlan(
            title: "Top-down raglan sweater",
            gauge: gauge,
            facts: [
                PlanFact("Neck cast-on", "\(neckCastOn) sts"),
                PlanFact("Increase rounds", "\(increaseRounds)",
                         detail: "\(fullIncreaseRounds) full, \(bodyOnlyRounds) body-only, \(sleeveOnlyRounds) sleeve-only"),
                PlanFact("Increase rhythm", "\(alternatingIncreases) alternating + \(everyRoundIncreases) back-to-back"),
                PlanFact("Body at underarm", "\(bodyStitches) sts",
                         detail: CalculatorSupport.cm(gauge.width(forStitches: Double(bodyStitches)), units)),
                PlanFact("Sleeve at underarm", "\(sleeveStitches) sts",
                         detail: CalculatorSupport.cm(gauge.width(forStitches: Double(sleeveStitches)), units)),
                PlanFact("Yoke depth", CalculatorSupport.cm(yokeDepth, units),
                         detail: "armhole target \(CalculatorSupport.cm(targetArmhole, units))"),
                PlanFact("Finished chest", CalculatorSupport.cm(finishedChest, units),
                         detail: "\(Int(options.ease * 100))% ease"),
            ],
            sections: [
                PlanSection("Yoke", detail: "Neck to underarm", steps: yokeSteps),
                PlanSection("Separate the sleeves", steps: splitSteps),
                PlanSection("Body", detail: "Underarm to hem", steps: bodySteps),
                PlanSection("Sleeves", detail: "Worked one at a time in the round", steps: sleeveSteps),
            ],
            blocks: blocks,
            notes: notes,
            warnings: warnings,
            metrics: metrics
        )
    }
}
