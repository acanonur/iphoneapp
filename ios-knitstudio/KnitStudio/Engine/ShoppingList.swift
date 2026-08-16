import Foundation

/// How much of the project is worked in one particular colour.
struct ColourAllocation: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var yarn: Yarn
    /// Fraction of the total yarn, 0...1.
    var share: Double
    /// "Main colour", "Contrast A"…
    var role: String

    init(yarn: Yarn, share: Double, role: String) {
        self.yarn = yarn
        self.share = max(0, min(1, share))
        self.role = role
    }

    static func roleName(index: Int) -> String {
        index == 0 ? "Main colour (MC)" : "Contrast \(ColourAllocation.letter(index))"
    }

    static func letter(_ index: Int) -> String {
        let scalar = UnicodeScalar(65 + max(0, index) % 26) ?? "A"
        return String(Character(scalar))
    }

    /// A single-colour project.
    static func single(_ yarn: Yarn) -> [ColourAllocation] {
        [ColourAllocation(yarn: yarn, share: 1.0, role: "Main colour (MC)")]
    }

    /// Allocations taken straight from a chart's colour counts.
    static func from(chart: ColourChart) -> [ColourAllocation] {
        let shares = chart.colourShares()
        return chart.palette.enumerated().map { index, yarn in
            ColourAllocation(
                yarn: yarn,
                share: shares[index] ?? 0,
                role: roleName(index: index))
        }
    }

    /// Normalises a set of allocations so the shares add up to exactly 1.
    static func normalised(_ allocations: [ColourAllocation]) -> [ColourAllocation] {
        let total = allocations.reduce(0) { $0 + $1.share }
        guard total > 0 else { return allocations }
        return allocations.map {
            var copy = $0
            copy.share = $0.share / total
            return copy
        }
    }
}

/// One line of the shopping list.
struct ShoppingLine: Identifiable, Equatable {
    var id: UUID = UUID()
    var yarn: Yarn
    var role: String
    var metres: Double
    var grams: Double
    var balls: Int
    var cost: Double?

    /// Yarn bought beyond what the estimate says is needed.
    var spareMetres: Double { Double(balls) * yarn.ballMetres - metres }
}

struct ShoppingList: Equatable {
    var lines: [ShoppingLine]
    var needles: [String]
    var notions: [String]
    var safetyMargin: Double

    var totalBalls: Int { lines.reduce(0) { $0 + $1.balls } }
    var totalMetres: Double { lines.reduce(0) { $0 + $1.metres } }
    var totalGrams: Double { lines.reduce(0) { $0 + $1.grams } }

    var totalCost: Double? {
        let costs = lines.compactMap(\.cost)
        guard costs.count == lines.count, !lines.isEmpty else { return nil }
        return costs.reduce(0, +)
    }

    func plainText(projectName: String) -> String {
        var out = ["Shopping list — \(projectName)", ""]
        for line in lines {
            var text = "• \(line.balls) × \(line.yarn.displayName)"
            text += String(format: " (%.0f g / %.0f m", line.yarn.ballGrams, line.yarn.ballMetres)
            text += ") — \(line.role)"
            out.append(text)
            out.append(String(format: "    needs %.0f m ≈ %.0f g", line.metres, line.grams))
        }
        if let cost = totalCost {
            out.append("")
            out.append(String(format: "Estimated total: %.2f", cost))
        }
        out.append("")
        out.append("Needles")
        needles.forEach { out.append("• \($0)") }
        out.append("")
        out.append("Notions")
        notions.forEach { out.append("• \($0)") }
        out.append("")
        out.append(String(
            format: "Quantities include a %.0f%% margin. Buy every ball of a colour in the same "
            + "dye lot — a second lot bought later will not match.", safetyMargin * 100))
        return out.joined(separator: "\n")
    }
}

enum ShoppingListBuilder {

    static func build(
        plan: ProjectPlan,
        kind: PatternKind,
        allocations: [ColourAllocation],
        structure: FabricStructure,
        options: ProjectOptions,
        units: UnitSystem
    ) -> ShoppingList {
        let totalMetres = plan.metres()
        let normalised = ColourAllocation.normalised(allocations)

        let lines: [ShoppingLine] = normalised.compactMap { allocation in
            guard allocation.share > 0 else { return nil }
            let metres = totalMetres * allocation.share
            let balls = YarnEstimator.balls(
                metres: metres, yarn: allocation.yarn, safetyMargin: options.safetyMargin)
            let cost = allocation.yarn.pricePerBall.map { Double(balls) * $0 }
            return ShoppingLine(
                yarn: allocation.yarn,
                role: allocation.role,
                metres: metres,
                grams: YarnEstimator.grams(metres: metres, yarn: allocation.yarn),
                balls: balls,
                cost: cost)
        }

        let weight = normalised.first?.yarn.weight ?? YarnWeight.matching(gauge: plan.gauge)
        return ShoppingList(
            lines: lines,
            needles: needles(for: kind, weight: weight, plan: plan, units: units),
            notions: notions(for: kind, structure: structure, colours: lines.count),
            safetyMargin: options.safetyMargin)
    }

    // MARK: - Needles

    static func needles(
        for kind: PatternKind, weight: YarnWeight, plan: ProjectPlan, units: UnitSystem
    ) -> [String] {
        let main = weight.suggestedNeedleMM
        let rib = max(1.5, main - 0.5)
        let mainText = String(format: "%.2fmm", main)
            .replacingOccurrences(of: ".00mm", with: "mm")
        let ribText = String(format: "%.2fmm", rib)
            .replacingOccurrences(of: ".00mm", with: "mm")

        var list: [String] = []
        switch kind {
        case .scarf, .blanket:
            list.append("\(mainText) straight needles, or a long circular to hold the stitches")
        case .cowl:
            list.append("\(mainText) circular needle, 40–60 cm")
            list.append("\(ribText) circular needle for the ribbed edges")
        case .hat:
            list.append("\(mainText) circular needle, 40 cm")
            list.append("\(ribText) circular needle, 40 cm, for the brim")
            list.append("\(mainText) double-pointed needles for the crown (or magic loop)")
        case .raglanSweater:
            list.append("\(mainText) circular needle, 80 cm, for the body")
            list.append("\(mainText) circular needle, 40 cm, for the yoke and sleeves")
            list.append("\(ribText) circular needles, 40 cm and 80 cm, for the ribbing")
        case .sock:
            list.append("\(mainText) double-pointed needles, or a 80 cm circular for magic loop")
        case .mitten:
            list.append("\(mainText) double-pointed needles, or a 80 cm circular for magic loop")
            list.append("\(ribText) needles for the cuffs")
        case .shawl:
            list.append("\(mainText) circular needle, 80–100 cm, to hold the growing stitch count")
        }
        list.append("A needle gauge, so you can prove the size before you swatch")
        return list
    }

    // MARK: - Notions

    static func notions(for kind: PatternKind, structure: FabricStructure, colours: Int) -> [String] {
        var list = ["Tapestry needle for weaving in ends", "Tape measure", "Scissors"]

        switch kind {
        case .hat:
            list.append("\(8) stitch markers for the crown sections")
        case .raglanSweater:
            list.append("8 stitch markers (4 raglan lines, plus the round start)")
            list.append("Waste yarn or stitch holders for the sleeve stitches")
        case .sock, .mitten:
            list.append("2 stitch markers")
            list.append("Waste yarn for the held stitches")
        case .shawl:
            list.append("2 stitch markers for the spine")
            list.append("Blocking wires and pins — a shawl is made by its blocking")
        case .cowl:
            list.append("1 stitch marker for the start of the round")
        case .scarf, .blanket:
            list.append("Row counter")
        }

        switch structure {
        case .cables:
            list.append("Cable needle")
        case .lace:
            list.append("Lifeline thread — a dropped lace stitch is unrecoverable without one")
            list.append("Blocking mats and pins")
        case .strandedColourwork:
            list.append("Yarn guide or a spare finger technique for holding two colours")
        case .brioche:
            list.append("Locking markers — brioche is very hard to tink back")
        default:
            break
        }

        if colours > 1 {
            list.append("Bobbins or small bags to stop the colours tangling")
        }
        list.append("Blocking mats and rustproof pins")
        return list
    }
}
