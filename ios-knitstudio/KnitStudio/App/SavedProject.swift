import Foundation

/// A project the knitter has set up and can come back to.
struct SavedProject: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var name: String
    var kind: PatternKind
    var structure: FabricStructure
    var gauge: Gauge
    var measurements: BodyMeasurements
    var options: ProjectOptions
    /// Colours and how much of the project each one covers.
    var allocations: [ColourAllocation]
    /// Attached colourwork chart, when the project uses one.
    var chart: ColourChart?
    var createdAt: Date = Date()
    /// Progress for the row counter.
    var rowsCompleted: Int = 0
    var notes: String = ""

    init(
        id: UUID = UUID(),
        name: String,
        kind: PatternKind,
        structure: FabricStructure = .stockinette,
        gauge: Gauge,
        measurements: BodyMeasurements = BodyMeasurements(),
        options: ProjectOptions = ProjectOptions(),
        allocations: [ColourAllocation] = [],
        chart: ColourChart? = nil,
        createdAt: Date = Date(),
        rowsCompleted: Int = 0,
        notes: String = ""
    ) {
        self.id = id
        self.name = name
        self.kind = kind
        self.structure = structure
        self.gauge = gauge
        self.measurements = measurements
        self.options = options
        self.allocations = allocations
        self.chart = chart
        self.createdAt = createdAt
        self.rowsCompleted = rowsCompleted
        self.notes = notes
    }

    func plan(units: UnitSystem) -> ProjectPlan {
        kind.makePlan(
            gauge: gauge,
            measurements: measurements,
            options: options,
            structure: structure,
            units: units)
    }

    /// Colour shares come from the chart when there is one, since that is the
    /// only place the real proportions are known.
    var effectiveAllocations: [ColourAllocation] {
        if let chart, chart.palette.count > 1 {
            return ColourAllocation.from(chart: chart)
        }
        if allocations.isEmpty {
            return ColourAllocation.single(
                Yarn(name: "Main yarn", hex: "9EB7C4", weight: YarnWeight.matching(gauge: gauge)))
        }
        return allocations
    }

    func shoppingList(units: UnitSystem) -> ShoppingList {
        ShoppingListBuilder.build(
            plan: plan(units: units),
            kind: kind,
            allocations: effectiveAllocations,
            structure: structure,
            options: options,
            units: units)
    }

    static func fromPreset(_ preset: PatternPreset, gauge: Gauge? = nil) -> SavedProject {
        let resolvedGauge = gauge ?? preset.suggestedWeight.nominalGauge
        let chart = preset.chartID.flatMap {
            BuiltInPatterns.chart(id: $0, weight: preset.suggestedWeight)
        }
        let allocations: [ColourAllocation]
        if let chart {
            allocations = ColourAllocation.from(chart: chart)
        } else {
            allocations = ColourAllocation.single(
                BuiltInPatterns.palette(weight: preset.suggestedWeight)[0])
        }
        return SavedProject(
            name: preset.name,
            kind: preset.kind,
            structure: preset.structure,
            gauge: resolvedGauge,
            options: preset.options,
            allocations: allocations,
            chart: chart)
    }
}
