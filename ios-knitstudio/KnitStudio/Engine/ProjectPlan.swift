import Foundation

/// A single headline number shown at the top of a plan.
struct PlanFact: Identifiable, Equatable {
    var id: UUID = UUID()
    var label: String
    var value: String
    var detail: String?

    init(_ label: String, _ value: String, detail: String? = nil) {
        self.label = label
        self.value = value
        self.detail = detail
    }
}

/// One instruction the knitter follows.
struct PlanStep: Identifiable, Equatable {
    var id: UUID = UUID()
    var text: String
    /// Stitch count in play once this step is finished.
    var stitchCount: Int?
    /// Rows or rounds this step occupies.
    var rows: Int?
    /// Set when the step matters enough to call out (a heel turn, a split).
    var isMilestone: Bool = false

    init(_ text: String, stitchCount: Int? = nil, rows: Int? = nil, isMilestone: Bool = false) {
        self.text = text
        self.stitchCount = stitchCount
        self.rows = rows
        self.isMilestone = isMilestone
    }
}

/// A named run of steps — cuff, yoke, heel, crown.
struct PlanSection: Identifiable, Equatable {
    var id: UUID = UUID()
    var name: String
    var detail: String?
    var steps: [PlanStep]

    init(_ name: String, detail: String? = nil, steps: [PlanStep]) {
        self.name = name
        self.detail = detail
        self.steps = steps
    }

    var totalRows: Int { steps.compactMap(\.rows).reduce(0, +) }
}

/// Everything the calculator works out for one project.
struct ProjectPlan: Identifiable, Equatable {
    var id: UUID = UUID()
    var title: String
    var gauge: Gauge
    var facts: [PlanFact]
    var sections: [PlanSection]
    /// Stitch blocks feeding the yarn estimate.
    var blocks: [StitchBlock]
    var notes: [String] = []
    /// Things that are off: gauge implausible, measurements inconsistent.
    var warnings: [String] = []
    /// Finished measurements the schematic is drawn from.
    var metrics: PlanMetrics = PlanMetrics()

    var totalStitches: Double { blocks.reduce(0) { $0 + $1.stitches } }
    var totalRows: Int { sections.reduce(0) { $0 + $1.totalRows } }

    func metres() -> Double { YarnEstimator.metres(for: blocks, gauge: gauge) }

    /// Flat plain-text rendering, used for sharing and export.
    func plainText(units: UnitSystem) -> String {
        var lines: [String] = [title, String(repeating: "=", count: title.count), ""]
        lines.append("Gauge: \(gauge.describe(in: units))")
        lines.append("")
        for fact in facts {
            if let detail = fact.detail {
                lines.append("\(fact.label): \(fact.value)  (\(detail))")
            } else {
                lines.append("\(fact.label): \(fact.value)")
            }
        }
        for section in sections {
            lines.append("")
            lines.append(section.name.uppercased())
            if let detail = section.detail { lines.append(detail) }
            for step in section.steps {
                var line = "  • \(step.text)"
                if let count = step.stitchCount { line += " (\(count) sts)" }
                lines.append(line)
            }
        }
        if !notes.isEmpty {
            lines.append("")
            lines.append("NOTES")
            notes.forEach { lines.append("  • \($0)") }
        }
        if !warnings.isEmpty {
            lines.append("")
            lines.append("CHECK THESE")
            warnings.forEach { lines.append("  ! \($0)") }
        }
        return lines.joined(separator: "\n")
    }
}

/// Common body measurements a project is calculated from. Stored in cm.
struct BodyMeasurements: Codable, Equatable {
    var chest: Double = 100
    var headCircumference: Double = 56
    var neckCircumference: Double = 38
    var upperArm: Double = 34
    var wrist: Double = 20
    var bodyLength: Double = 62
    var sleeveLength: Double = 45
    var footCircumference: Double = 23
    var footLength: Double = 24
    var handCircumference: Double = 20
    var handLength: Double = 19

    /// Standard adult sizes, so a knitter who has not measured can start.
    static let sizePresets: [(name: String, measurements: BodyMeasurements)] = [
        ("Child 6–8", BodyMeasurements(
            chest: 66, headCircumference: 51, neckCircumference: 30, upperArm: 22,
            wrist: 15, bodyLength: 42, sleeveLength: 33,
            footCircumference: 17, footLength: 18, handCircumference: 15, handLength: 14)),
        ("Adult XS", BodyMeasurements(
            chest: 82, headCircumference: 54, neckCircumference: 34, upperArm: 27,
            wrist: 16, bodyLength: 56, sleeveLength: 43,
            footCircumference: 20, footLength: 22, handCircumference: 17, handLength: 17)),
        ("Adult S", BodyMeasurements(
            chest: 90, headCircumference: 55, neckCircumference: 36, upperArm: 30,
            wrist: 17, bodyLength: 59, sleeveLength: 44,
            footCircumference: 21, footLength: 23, handCircumference: 18, handLength: 18)),
        ("Adult M", BodyMeasurements()),
        ("Adult L", BodyMeasurements(
            chest: 110, headCircumference: 57, neckCircumference: 40, upperArm: 37,
            wrist: 21, bodyLength: 65, sleeveLength: 46,
            footCircumference: 25, footLength: 26, handCircumference: 22, handLength: 20)),
        ("Adult XL", BodyMeasurements(
            chest: 122, headCircumference: 58, neckCircumference: 42, upperArm: 41,
            wrist: 22, bodyLength: 68, sleeveLength: 47,
            footCircumference: 27, footLength: 27, handCircumference: 24, handLength: 21)),
    ]
}
