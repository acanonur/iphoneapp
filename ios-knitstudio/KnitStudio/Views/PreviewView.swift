import SwiftUI

/// What the finished thing will look like: the shape drawn to scale, the
/// fabric simulated stitch by stitch, and the colours and symbols it takes.
struct ProjectPreviewView: View {
    @EnvironmentObject private var store: AppStore
    let project: SavedProject

    @State private var pane = 0

    var body: some View {
        VStack(spacing: 0) {
            Picker("Showing", selection: $pane) {
                Text("Shape").tag(0)
                Text("Fabric").tag(1)
                Text("Chart").tag(2)
            }
            .pickerStyle(.segmented)
            .padding()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    switch pane {
                    case 0: shapePane
                    case 1: fabricPane
                    default: chartPane
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
            }
        }
    }

    // MARK: - Shape

    @ViewBuilder
    private var shapePane: some View {
        SchematicView(schematic: project.schematic(units: store.units), units: store.units)

        if !finishedFacts.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Finished measurements")
                    .font(.headline)
                FactGrid(facts: finishedFacts)
            }
        }

        ForEach(plan.warnings, id: \.self) { (warning: String) in
            NoteBox(kind: .warning, text: warning)
        }
    }

    /// Only the fields this project's calculator filled in, so a hat is not
    /// listed with a sleeve length of nothing.
    private var finishedFacts: [PlanFact] {
        let metrics = plan.metrics
        var facts: [PlanFact] = []
        if metrics.castOnStitches > 0 {
            facts.append(PlanFact("Cast on", "\(metrics.castOnStitches) sts"))
        }

        let shape: [(label: String, centimetres: Double?)] = [
            (label: "Width", centimetres: metrics.flatWidth),
            (label: "Length", centimetres: metrics.flatLength),
            (label: "Circumference", centimetres: metrics.circumference),
            (label: "Depth", centimetres: metrics.depth),
            (label: "Wingspan", centimetres: metrics.wingspan),
            (label: "Ribbing", centimetres: metrics.ribDepth),
            (label: "Body depth", centimetres: metrics.bodyDepth),
            (label: "Crown depth", centimetres: metrics.crownDepth),
        ]
        let garment: [(label: String, centimetres: Double?)] = [
            (label: "Chest", centimetres: metrics.chestCircumference),
            (label: "Body length", centimetres: metrics.bodyLength),
            (label: "Yoke depth", centimetres: metrics.yokeDepth),
            (label: "Sleeve length", centimetres: metrics.sleeveLength),
            (label: "Upper arm", centimetres: metrics.upperArmCircumference),
            (label: "Cuff", centimetres: metrics.cuffCircumference),
            (label: "Neck", centimetres: metrics.neckCircumference),
        ]
        let extremities: [(label: String, centimetres: Double?)] = [
            (label: "Leg length", centimetres: metrics.legLength),
            (label: "Foot length", centimetres: metrics.footLength),
            (label: "Foot circumference", centimetres: metrics.footCircumference),
            (label: "Heel depth", centimetres: metrics.heelDepth),
            (label: "Hand length", centimetres: metrics.handLength),
            (label: "Thumb gusset", centimetres: metrics.thumbLength),
        ]

        for entry in shape + garment + extremities {
            guard let centimetres = entry.centimetres, centimetres > 0 else { continue }
            facts.append(PlanFact(entry.label, store.units.formatLength(centimetres)))
        }
        return facts
    }

    // MARK: - Fabric

    @ViewBuilder
    private var fabricPane: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(stitchPattern.name)
                .font(.headline)
            if !stitchPattern.summary.isEmpty {
                Text(stitchPattern.summary)
                    .font(.subheadline)
                    .foregroundStyle(Color.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }

        FabricSimulationPane(
            pattern: stitchPattern,
            palette: paletteYarns,
            gauge: project.gauge,
            units: store.units,
            stitchesWide: fabricStitchesWide)
    }

    /// The real cast-on where the plan knows it, so the swatch is the width of
    /// the piece rather than an arbitrary sample. Past about sixty stitches the
    /// drawing is too small to read and too slow to redraw.
    private var fabricStitchesWide: Int {
        let castOn = plan.metrics.castOnStitches
        let wanted = castOn > 0 ? castOn : 40
        return max(8, min(wanted, 60))
    }

    // MARK: - Chart

    @ViewBuilder
    private var chartPane: some View {
        StitchPatternPreview(
            pattern: stitchPattern,
            palette: paletteYarns,
            gauge: project.gauge)

        PatternColourTable(project: project, units: store.units)
    }

    // MARK: - Shared

    private var plan: ProjectPlan { project.plan(units: store.units) }

    private var stitchPattern: StitchPattern { project.effectiveStitchPattern }

    private var paletteYarns: [Yarn] {
        project.effectiveAllocations.map { (allocation: ColourAllocation) in allocation.yarn }
    }
}

// MARK: - Colour table

/// The colour and pattern table a printed pattern puts on its information
/// page: every colour with its letter, what it is for, how much of the
/// knitting it covers and how much to buy.
struct PatternColourTable: View {
    let project: SavedProject
    let units: UnitSystem

    /// One line of the table. The amounts are the shopping list's own, so the
    /// table and the Shopping tab can never disagree.
    private struct Line: Identifiable {
        var id: UUID
        var letter: String
        var yarn: Yarn
        var role: String
        var share: Double
        var metres: Double
        var grams: Double
        var balls: Int
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Colours and symbols")
                .font(.headline)
            table
            legend
            ShareLink(item: plainText) {
                Label("Share the colour table", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(.bordered)
        }
    }

    // MARK: - Table

    private var table: some View {
        ScrollView(.horizontal) {
            Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
                headerRow
                ForEach(Array(lines.enumerated()), id: \.offset) { (entry: (offset: Int, element: Line)) in
                    row(entry.element)
                        .background(entry.offset % 2 == 0
                                    ? Color.clear
                                    : Color.knitSecondaryBackground)
                }
            }
        }
    }

    private var headerRow: some View {
        GridRow {
            cell("")
            cell("Yarn")
            cell("Role")
            cell("Share")
            cell("Metres")
            cell("Grams")
            cell("Balls")
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(Color.secondary)
    }

    private func row(_ line: Line) -> some View {
        GridRow {
            YarnSwatch(yarn: line.yarn, size: 24, label: line.letter)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
            yarnCell(line)
            cell(line.role)
            cell(percentage(line.share))
            cell(rounded(line.metres))
            cell(rounded(line.grams))
            cell("\(line.balls)")
        }
        .font(.caption)
    }

    private func yarnCell(_ line: Line) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(line.yarn.name)
                .lineLimit(1)
            if !line.yarn.colourName.isEmpty {
                Text(line.yarn.colourName)
                    .font(.caption2)
                    .foregroundStyle(Color.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
    }

    private func cell(_ text: String) -> some View {
        Text(text)
            .lineLimit(1)
            .monospacedDigit()
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
    }

    // MARK: - Legend

    @ViewBuilder
    private var legend: some View {
        let pattern = project.effectiveStitchPattern
        if !pattern.legend.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Symbols")
                    .font(.subheadline.weight(.semibold))
                StitchSymbolLegend(pattern: pattern)
            }
        }
    }

    // MARK: - Numbers

    private var lines: [Line] {
        let list = project.shoppingList(units: units)
        let allocations = ColourAllocation.normalised(project.effectiveAllocations)
        var shares: [UUID: Double] = [:]
        for allocation in allocations {
            shares[allocation.yarn.id] = allocation.share
        }
        var result: [Line] = []
        for (index, source) in list.lines.enumerated() {
            result.append(Line(
                id: source.id,
                letter: ColourAllocation.letter(index),
                yarn: source.yarn,
                role: source.role,
                share: shares[source.yarn.id] ?? 0,
                metres: source.metres,
                grams: source.grams,
                balls: source.balls))
        }
        return result
    }

    private func percentage(_ share: Double) -> String {
        "\(Int((share * 100).rounded()))%"
    }

    private func rounded(_ value: Double) -> String {
        String(format: "%.0f", value)
    }

    /// The same table as text, for pasting into a pattern or a note to the
    /// yarn shop.
    private var plainText: String {
        var out: [String] = ["Colours — \(project.name)", ""]
        for line in lines {
            out.append("\(line.letter) — \(line.yarn.displayName) (\(line.role))")
            let share: String = percentage(line.share)
            let metres: String = rounded(line.metres)
            let grams: String = rounded(line.grams)
            let ballWord: String = line.balls == 1 ? "ball" : "balls"
            out.append("    \(share) of the knitting · \(metres) m · \(grams) g · \(line.balls) \(ballWord)")
        }

        let pattern = project.effectiveStitchPattern
        if !pattern.legend.isEmpty {
            out.append("")
            out.append("Symbols — \(pattern.name)")
            for symbol in pattern.legend {
                out.append("\(symbol.rightSideAbbreviation) — \(symbol.name): \(symbol.meaning)")
            }
        }
        return out.joined(separator: "\n")
    }
}
