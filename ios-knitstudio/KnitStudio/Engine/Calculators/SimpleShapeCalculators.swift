import Foundation

/// Warnings every calculator should raise when the inputs look wrong.
enum CalculatorSupport {
    static func gaugeWarnings(_ gauge: Gauge) -> [String] {
        var warnings: [String] = []
        if !gauge.looksPlausible {
            warnings.append(
                "That gauge is unusual for knitted fabric — double-check the swatch was "
                + "measured over 10 cm and counted in the same direction.")
        }
        if gauge.rowsPer10cm < gauge.stitchesPer10cm {
            warnings.append(
                "Fewer rows than stitches per 10 cm is rare in stockinette. If you meant "
                + "garter stitch that is fine; otherwise the numbers may be swapped.")
        }
        return warnings
    }

    static func cm(_ value: Double, _ units: UnitSystem) -> String {
        units.formatLength(value)
    }
}

/// Scarves and blankets: a plain rectangle with optional garter edges.
enum FlatPieceCalculator {
    static func plan(
        kind: PatternKind,
        gauge: Gauge,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem
    ) -> ProjectPlan {
        let width = max(1, options.width)
        let length = max(1, options.length)
        let edge = max(0, options.edgeStitches)

        let bodyStitches = Shaping.roundToMultiple(
            gauge.stitches(forWidth: width) - Double(edge * 2),
            multiple: options.stitchMultiple,
            offset: options.stitchOffset)
        let castOn = bodyStitches + edge * 2
        let rows = max(1, Int(gauge.rows(forLength: length).rounded()))

        let actualWidth = gauge.width(forStitches: Double(castOn))
        let actualLength = gauge.length(forRows: Double(rows))

        var steps: [PlanStep] = [
            PlanStep("Cast on \(castOn) sts.", stitchCount: castOn, isMilestone: true)
        ]
        if edge > 0 {
            steps.append(PlanStep(
                "Work \(edge) sts in garter at each side on every row; these edges stop the "
                + "fabric curling and are not counted in the pattern repeat."))
        }
        steps.append(PlanStep(
            "Work \(rows) rows in \(structure.name.lowercased()).",
            stitchCount: castOn, rows: rows))
        steps.append(PlanStep("Bind off loosely in pattern.", isMilestone: true))

        var facts: [PlanFact] = [
            PlanFact("Cast on", "\(castOn) sts",
                     detail: edge > 0 ? "\(bodyStitches) pattern sts + \(edge * 2) edge sts" : nil),
            PlanFact("Rows", "\(rows)"),
            PlanFact("Finished width", CalculatorSupport.cm(actualWidth, units)),
            PlanFact("Finished length", CalculatorSupport.cm(actualLength, units)),
        ]
        if options.stitchMultiple > 1 {
            facts.append(PlanFact(
                "Stitch repeat", "multiple of \(options.stitchMultiple)"
                + (options.stitchOffset > 0 ? " + \(options.stitchOffset)" : "")))
        }

        var notes = [
            "Blocking usually relaxes a flat piece by a few percent. If the exact "
            + "finished size matters, block your swatch before measuring the gauge."
        ]
        if kind == .blanket {
            notes.append(
                "A blanket this size is heavy on one circular needle — use an 80–100 cm "
                + "cable and count your stitches every twenty rows or so.")
        }

        return ProjectPlan(
            title: kind.name,
            gauge: gauge,
            facts: facts,
            sections: [PlanSection(kind.name, steps: steps)],
            blocks: [StitchBlock("Body", stitches: Double(castOn * rows), structure: structure)],
            notes: notes,
            warnings: CalculatorSupport.gaugeWarnings(gauge)
        )
    }
}

/// A cowl: a tube worked in the round.
enum CowlCalculator {
    static func plan(
        gauge: Gauge,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem
    ) -> ProjectPlan {
        let circumference = max(1, options.cowlCircumference)
        let height = max(1, options.cowlHeight)

        let castOn = Shaping.roundToMultiple(
            gauge.stitches(forWidth: circumference),
            multiple: max(1, options.stitchMultiple),
            offset: options.stitchOffset)
        let rounds = max(1, Int(gauge.rows(forLength: height).rounded()))
        let ribRounds = max(0, Int(gauge.rows(forLength: options.ribDepth).rounded()))
        let bodyRounds = max(0, rounds - ribRounds * 2)

        let actualCircumference = gauge.width(forStitches: Double(castOn))

        var steps: [PlanStep] = [
            PlanStep(
                "Cast on \(castOn) sts. Join to work in the round, being careful not to twist.",
                stitchCount: castOn, isMilestone: true)
        ]
        if ribRounds > 0 {
            steps.append(PlanStep(
                "Work \(ribRounds) rounds in 2×2 rib.", stitchCount: castOn, rows: ribRounds))
        }
        steps.append(PlanStep(
            "Work \(bodyRounds) rounds in \(structure.name.lowercased()).",
            stitchCount: castOn, rows: bodyRounds))
        if ribRounds > 0 {
            steps.append(PlanStep(
                "Work \(ribRounds) rounds in 2×2 rib.", stitchCount: castOn, rows: ribRounds))
        }
        steps.append(PlanStep("Bind off loosely in rib.", isMilestone: true))

        let blocks = [
            StitchBlock("Ribbed edges", stitches: Double(castOn * ribRounds * 2), structure: .ribbing),
            StitchBlock("Body", stitches: Double(castOn * bodyRounds), structure: structure),
        ]

        var warnings = CalculatorSupport.gaugeWarnings(gauge)
        if circumference < 50 {
            warnings.append(
                "A cowl under 50 cm around has to stretch over the head — work it in rib or "
                + "use a very stretchy bind-off.")
        }

        return ProjectPlan(
            title: "Cowl",
            gauge: gauge,
            facts: [
                PlanFact("Cast on", "\(castOn) sts"),
                PlanFact("Rounds", "\(rounds)"),
                PlanFact("Finished circumference", CalculatorSupport.cm(actualCircumference, units)),
                PlanFact("Finished height", CalculatorSupport.cm(height, units)),
            ],
            sections: [PlanSection("Cowl", steps: steps)],
            blocks: blocks,
            notes: [
                "Worked in the round there is no wrong side, so stockinette will not curl at "
                + "the edges the way a flat scarf does — but a few rounds of rib still sit flatter."
            ],
            warnings: warnings
        )
    }
}
