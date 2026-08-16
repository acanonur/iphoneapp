import Foundation

/// A cuff-down sock: ribbed cuff, leg, heel flap, heel turn, gusset, foot, toe.
enum SockCalculator {

    static func plan(
        gauge: Gauge,
        measurements: BodyMeasurements,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem
    ) -> ProjectPlan {
        // Socks are always worked with negative ease so they stay up.
        let negativeEase = min(0.2, abs(options.ease) == 0 ? 0.10 : abs(options.ease))
        let footCirc = max(10, measurements.footCircumference)
        let footLength = max(10, measurements.footLength)
        let sockCirc = footCirc * (1 - negativeEase)

        let castOn = Shaping.roundToMultiple(gauge.stitches(forWidth: sockCirc), multiple: 4)
        let heelStitches = castOn / 2
        let instepStitches = castOn - heelStitches

        let cuffRounds = max(1, Int(gauge.rows(forLength: options.cuffDepth).rounded()))
        let legRounds = max(0, Int(gauge.rows(forLength: max(0, options.legLength - options.cuffDepth)).rounded()))

        // A square heel flap: as many rows as there are heel stitches. Worked in
        // slip-stitch so it wears twice as long as plain stockinette.
        let heelFlapRows = heelStitches
        let heelTurnRows = max(2, heelStitches / 2)
        let heelTurnStitches = heelStitches / 2 + 2

        // One stitch picked up for every two flap rows, plus one in the corner.
        let gussetPickUp = heelFlapRows / 2 + 1
        let afterPickUp = heelTurnStitches + 2 * gussetPickUp + instepStitches
        let gussetDecreaseRounds = max(0, Int(((Double(afterPickUp - castOn)) / 2).rounded(.up)))

        // Wedge toe: 4 sts out per decrease round, alternating with plain rounds
        // at first and every round near the end.
        let toeEndStitches = Shaping.roundToMultiple(Double(castOn / 4), multiple: 4)
        let toeDecreaseRounds = max(1, (castOn - toeEndStitches) / 4)
        let toeRows = toeDecreaseRounds * 2 - toeDecreaseRounds / 3
        let toeLength = Double(toeRows) * gauge.rowHeight

        let gussetLength = Double(gussetDecreaseRounds * 2) * gauge.rowHeight
        let footPlainLength = max(0, footLength - toeLength - gussetLength)
        let footRounds = max(0, Int(gauge.rows(forLength: footPlainLength).rounded()))

        // MARK: Steps

        let cuffSteps: [PlanStep] = [
            PlanStep(
                "Cast on \(castOn) sts with a stretchy cast-on. Join in the round and divide "
                + "over your needles: \(heelStitches) heel sts and \(instepStitches) instep sts.",
                stitchCount: castOn, isMilestone: true),
            PlanStep("Work \(cuffRounds) rounds in 1×1 or 2×2 rib.", stitchCount: castOn, rows: cuffRounds),
            PlanStep(
                "Work \(legRounds) rounds in \(structure.name.lowercased()) for the leg.",
                stitchCount: castOn, rows: legRounds),
        ]

        let heelSteps: [PlanStep] = [
            PlanStep(
                "Heel flap, worked flat on \(heelStitches) sts over \(heelFlapRows) rows. "
                + "RS: [sl1, k1] to end. WS: sl1, purl to end. The slipped stitches make the "
                + "double-thick fabric that takes the wear.",
                stitchCount: heelStitches, rows: heelFlapRows, isMilestone: true),
            PlanStep(
                "Turn the heel with short rows: work past the centre, ssk (or p2tog), turn, "
                + "and repeat, taking in one more stitch each side every row until all the flap "
                + "stitches are used.",
                stitchCount: heelTurnStitches, rows: heelTurnRows, isMilestone: true),
            PlanStep(
                "Pick up \(gussetPickUp) sts along each side of the flap.",
                stitchCount: afterPickUp),
            PlanStep(
                "Gusset: decrease 2 sts every other round \(gussetDecreaseRounds) times "
                + "(k to 3 sts before the instep, k2tog, k1 — and k1, ssk after it) until "
                + "\(castOn) sts remain.",
                stitchCount: castOn, rows: gussetDecreaseRounds * 2, isMilestone: true),
        ]

        let footSteps: [PlanStep] = [
            PlanStep(
                "Work \(footRounds) rounds even until the foot measures "
                + "\(CalculatorSupport.cm(footLength - toeLength, units)) from the back of the heel — "
                + "that is \(CalculatorSupport.cm(toeLength, units)) short of the end of your toes.",
                stitchCount: castOn, rows: footRounds),
        ]

        let toeSteps: [PlanStep] = [
            PlanStep(
                "Toe: decrease 4 sts per decrease round (k to 3 sts before the end of each half, "
                + "k2tog, k1; k1, ssk at the start of the next half). Work \(toeDecreaseRounds) "
                + "decrease rounds over \(toeRows) rounds — every other round at first, then "
                + "every round for the last third.",
                stitchCount: toeEndStitches, rows: toeRows, isMilestone: true),
            PlanStep(
                "Graft the remaining \(toeEndStitches) sts with Kitchener stitch.",
                isMilestone: true),
            PlanStep("Knit the second sock the same way.", isMilestone: true),
        ]

        // MARK: Yarn accounting (one sock, doubled at the end)

        let gussetAverage = Double(afterPickUp + castOn) / 2
        let perSock: [StitchBlock] = [
            StitchBlock("Cuff", stitches: Double(castOn * cuffRounds), structure: .ribbing),
            StitchBlock("Leg", stitches: Double(castOn * legRounds), structure: structure),
            StitchBlock("Heel flap", stitches: Double(heelStitches * heelFlapRows), structure: .mosaic),
            StitchBlock("Heel turn", stitches: Double(heelStitches * heelTurnRows), structure: structure),
            StitchBlock("Gusset", stitches: gussetAverage * Double(gussetDecreaseRounds * 2), structure: structure),
            StitchBlock("Foot", stitches: Double(castOn * footRounds), structure: structure),
            StitchBlock("Toe", stitches: Double(castOn + toeEndStitches) / 2 * Double(toeRows), structure: structure),
        ]
        // A pair, which is what anyone actually knits.
        let blocks = perSock.map {
            StitchBlock($0.name, stitches: $0.stitches * 2, structure: $0.structure)
        }

        var warnings = CalculatorSupport.gaugeWarnings(gauge)
        if gauge.stitchesPer10cm < 24 {
            warnings.append(
                "Socks knitted looser than about 24 sts / 10 cm wear through quickly. A firmer "
                + "fabric on smaller needles lasts far longer.")
        }
        if footPlainLength <= 0 {
            warnings.append(
                "The gusset and toe already fill the whole foot length — this foot is very short "
                + "for this gauge. Check the foot length measurement.")
        }

        return ProjectPlan(
            title: "Socks",
            gauge: gauge,
            facts: [
                PlanFact("Cast on", "\(castOn) sts",
                         detail: "\(heelStitches) heel + \(instepStitches) instep"),
                PlanFact("Sock circumference", CalculatorSupport.cm(sockCirc, units),
                         detail: "\(Int(negativeEase * 100))% negative ease"),
                PlanFact("Heel flap", "\(heelFlapRows) rows"),
                PlanFact("Gusset pick-up", "\(gussetPickUp) sts each side"),
                PlanFact("Toe", "\(toeDecreaseRounds) decrease rounds",
                         detail: CalculatorSupport.cm(toeLength, units)),
                PlanFact("Yarn shown for", "a pair"),
            ],
            sections: [
                PlanSection("Cuff and leg", steps: cuffSteps),
                PlanSection("Heel", detail: "Flap, turn and gusset", steps: heelSteps),
                PlanSection("Foot", steps: footSteps),
                PlanSection("Toe", steps: toeSteps),
            ],
            blocks: blocks,
            notes: [
                "The heel flap is worked back and forth on half the stitches while the instep "
                + "stitches wait — nothing is bound off.",
                "Measure the foot length against the sock as you go; it is the one number that "
                + "cannot be fixed afterwards.",
            ],
            warnings: warnings
        )
    }
}
