import Foundation

/// A hat worked in the round from the brim up, with a wedge-decreased crown.
enum HatCalculator {

    static func plan(
        gauge: Gauge,
        measurements: BodyMeasurements,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem
    ) -> ProjectPlan {
        let sections = max(4, options.crownSections)
        // A hat has to grip, so ease is negative here regardless of sign.
        let negativeEase = min(0.2, abs(options.ease))
        let headCirc = max(20, measurements.headCircumference)
        let brimCirc = headCirc * (1 - negativeEase)

        let castOn = Shaping.roundToMultiple(
            gauge.stitches(forWidth: brimCirc), multiple: sections * 2)
        let stitchesPerSection = castOn / sections

        // The closed crown caps a circle of radius r = circumference / 2pi.
        // A knitted crown sits between a flat disc (depth r) and a hemisphere
        // (depth pi/2 · r); 1.15·r matches the hats people actually wear.
        let crownRadius = brimCirc / (2 * Double.pi)
        let targetCrownDepth = crownRadius * 1.15
        let targetCrownRounds = Int((targetCrownDepth / gauge.rowHeight).rounded())

        // One decrease round per stitch per section, and never more than one
        // plain round between decreases.
        let decreaseRounds = max(1, stitchesPerSection - 1)
        let plainRounds = min(decreaseRounds, max(0, targetCrownRounds - decreaseRounds))
        let crownRounds = decreaseRounds + plainRounds
        let crownDepth = Double(crownRounds) * gauge.rowHeight

        let ribDepth = options.hatStyle == .foldedBrim ? options.ribDepth * 2 : options.ribDepth
        let ribRounds = max(0, Int(gauge.rows(forLength: ribDepth).rounded()))
        let totalHeight = options.hatStyle.height
        let bodyDepth = max(0, totalHeight - crownDepth - ribDepth)
        let bodyRounds = max(0, Int(gauge.rows(forLength: bodyDepth).rounded()))

        // MARK: Sections

        let brimSteps: [PlanStep] = [
            PlanStep(
                "Cast on \(castOn) sts with a stretchy cast-on (long-tail is fine). "
                + "Join to work in the round, being careful not to twist.",
                stitchCount: castOn, isMilestone: true),
            PlanStep(
                "Work \(ribRounds) rounds in 2×2 rib (k2, p2 to end).",
                stitchCount: castOn, rows: ribRounds),
        ]

        let bodySteps: [PlanStep] = [
            PlanStep(
                "Work \(bodyRounds) rounds in \(structure.name.lowercased()) with no shaping, "
                + "until the hat measures \(CalculatorSupport.cm(ribDepth + bodyDepth, units)) from the cast-on edge.",
                stitchCount: castOn, rows: bodyRounds)
        ]

        var crownSteps: [PlanStep] = [
            PlanStep(
                "Place a marker every \(stitchesPerSection) sts — \(sections) markers in all. "
                + "Each decrease round takes one stitch out of every section.",
                stitchCount: castOn, isMilestone: true)
        ]
        // Plain rounds go into the earliest gaps so the dome starts gently and
        // tightens towards the top, which is how a crown should sit.
        for index in 1 ... decreaseRounds {
            let before = stitchesPerSection - index + 1
            let knitCount = before - 2
            let remaining = castOn - index * sections
            let repeatText = knitCount > 0
                ? "[k\(knitCount), k2tog] \(sections) times"
                : "[k2tog] \(sections) times"
            crownSteps.append(PlanStep(
                "Decrease round \(index): \(repeatText).",
                stitchCount: remaining, rows: 1))
            if index <= plainRounds {
                crownSteps.append(PlanStep("Knit one round even.", stitchCount: remaining, rows: 1))
            }
        }
        crownSteps.append(PlanStep(
            "Break the yarn leaving a 20 cm tail, thread it through the remaining "
            + "\(sections) sts, pull tight and fasten off on the inside.",
            stitchCount: sections, isMilestone: true))

        // MARK: Yarn accounting

        // The crown tapers linearly from the full count down to one stitch per
        // section, so its average stitch count is the mean of the two.
        let crownAverage = Double(castOn + sections) / 2
        let blocks = [
            StitchBlock("Brim", stitches: Double(castOn * ribRounds), structure: .ribbing),
            StitchBlock("Body", stitches: Double(castOn * bodyRounds), structure: structure),
            StitchBlock("Crown", stitches: crownAverage * Double(crownRounds), structure: structure),
        ]

        var warnings = CalculatorSupport.gaugeWarnings(gauge)
        if bodyRounds == 0 {
            warnings.append(
                "The crown and brim already fill the whole hat height. Shorten the brim, "
                + "pick a taller style, or use more crown sections.")
        }
        if stitchesPerSection < 5 {
            warnings.append(
                "Only \(stitchesPerSection) sts per section — the crown will decrease very "
                + "abruptly. Try \(max(4, sections - 2)) sections instead.")
        }

        // MARK: Finished measurements

        // The schematic measures the body from the cast-on edge upwards, so the
        // rib sits inside that depth rather than stacked below it.
        var metrics = PlanMetrics()
        metrics.castOnStitches = castOn
        metrics.circumference = brimCirc
        metrics.ribDepth = ribDepth
        metrics.bodyDepth = ribDepth + bodyDepth
        metrics.crownDepth = crownDepth

        return ProjectPlan(
            title: "\(options.hatStyle.name)",
            gauge: gauge,
            facts: [
                PlanFact("Cast on", "\(castOn) sts",
                         detail: "\(sections) sections of \(stitchesPerSection)"),
                PlanFact("Brim circumference", CalculatorSupport.cm(brimCirc, units),
                         detail: "\(Int(negativeEase * 100))% negative ease"),
                PlanFact("Total height", CalculatorSupport.cm(totalHeight, units)),
                PlanFact("Crown", "\(crownRounds) rounds",
                         detail: CalculatorSupport.cm(crownDepth, units)),
                PlanFact("Total rounds", "\(ribRounds + bodyRounds + crownRounds)"),
            ],
            sections: [
                PlanSection("Brim", detail: "Ribbing that grips the head", steps: brimSteps),
                PlanSection("Body", detail: "Straight tube to the crown", steps: bodySteps),
                PlanSection("Crown", detail: "\(decreaseRounds) decrease rounds", steps: crownSteps),
            ],
            blocks: blocks,
            notes: [
                "Hats are worn with negative ease — the brim measures less than the head so "
                + "it stays on. \(Int(negativeEase * 100))% is the usual amount.",
                "Switch to double-pointed needles or magic loop once the crown gets too small "
                + "for your circular needle, usually around \(sections * 4) sts.",
            ],
            warnings: warnings,
            metrics: metrics
        )
    }
}
