import XCTest
@testable import KnitStudio

final class ShoppingListTests: XCTestCase {

    private let dk = Gauge(stitchesPer10cm: 22, rowsPer10cm: 30)

    private func yarn(_ name: String, hex: String, price: Double? = nil) -> Yarn {
        Yarn(
            name: name, colourName: name, hex: hex, weight: .light,
            ballGrams: 50, ballMetres: 125, pricePerBall: price)
    }

    private func hatProject(allocations: [ColourAllocation]) -> SavedProject {
        SavedProject(
            name: "Test hat", kind: .hat, structure: .stockinette,
            gauge: dk, allocations: allocations)
    }

    // MARK: - Allocations

    func testSingleColourTakesTheWholeEstimate() {
        let project = hatProject(allocations: ColourAllocation.single(yarn("Cream", hex: "F0E9DA")))
        let list = project.shoppingList(units: .metric)

        XCTAssertEqual(list.lines.count, 1)
        XCTAssertEqual(list.lines[0].role, "Main colour (MC)")
        XCTAssertEqual(
            list.lines[0].metres, project.plan(units: .metric).metres(), accuracy: 1e-6)
        XCTAssertGreaterThanOrEqual(list.totalBalls, 1)
    }

    func testSharesAreNormalised() {
        // Raw shares of 2 : 1 : 1 should become 50% : 25% : 25%.
        let allocations = [
            ColourAllocation(yarn: yarn("A", hex: "111111"), share: 1.0, role: "MC"),
            ColourAllocation(yarn: yarn("B", hex: "222222"), share: 0.5, role: "CC1"),
            ColourAllocation(yarn: yarn("C", hex: "333333"), share: 0.5, role: "CC2"),
        ]
        let normalised = ColourAllocation.normalised(allocations)
        XCTAssertEqual(normalised.reduce(0) { $0 + $1.share }, 1.0, accuracy: 1e-9)
        XCTAssertEqual(normalised[0].share, 0.5, accuracy: 1e-9)
        XCTAssertEqual(normalised[1].share, 0.25, accuracy: 1e-9)

        let list = hatProject(allocations: allocations).shoppingList(units: .metric)
        let total = list.lines.reduce(0) { $0 + $1.metres }
        XCTAssertEqual(total, list.totalMetres, accuracy: 1e-6)
        XCTAssertEqual(list.lines[0].metres, total / 2, accuracy: 1e-6)
    }

    func testSharesClampToZeroAndOne() {
        let low = ColourAllocation(yarn: yarn("A", hex: "111111"), share: -3, role: "MC")
        let high = ColourAllocation(yarn: yarn("B", hex: "222222"), share: 8, role: "CC")
        XCTAssertEqual(low.share, 0)
        XCTAssertEqual(high.share, 1)
    }

    func testChartDrivenSharesMatchTheStitchCounts() {
        let palette = [yarn("Cream", hex: "F0E9DA"), yarn("Indigo", hex: "2E4272")]
        // Three quarters main colour, one quarter contrast.
        let chart = BuiltInPatterns.parse(
            name: "quarter", art: "X...", palette: palette)
        let allocations = ColourAllocation.from(chart: chart)

        XCTAssertEqual(allocations.count, 2)
        XCTAssertEqual(allocations[0].share, 0.75, accuracy: 1e-9)
        XCTAssertEqual(allocations[1].share, 0.25, accuracy: 1e-9)
        XCTAssertEqual(allocations[0].role, "Main colour (MC)")
        XCTAssertEqual(allocations[1].role, "Contrast B")
    }

    func testChartOverridesManualShares() {
        let palette = [yarn("Cream", hex: "F0E9DA"), yarn("Indigo", hex: "2E4272")]
        let chart = BuiltInPatterns.parse(name: "half", art: "XX..", palette: palette)
        var project = hatProject(
            allocations: ColourAllocation.single(yarn("Something else", hex: "999999")))
        project.chart = chart

        let effective = project.effectiveAllocations
        XCTAssertEqual(effective.count, 2)
        XCTAssertEqual(effective[0].share, 0.5, accuracy: 1e-9)
        XCTAssertEqual(effective[0].yarn.hex, "F0E9DA")
    }

    func testProjectWithNoColoursStillProducesAList() {
        let project = hatProject(allocations: [])
        let list = project.shoppingList(units: .metric)
        XCTAssertEqual(list.lines.count, 1)
        XCTAssertGreaterThan(list.totalMetres, 0)
    }

    // MARK: - Balls and cost

    func testBallCountsIncludeTheMargin() {
        var project = hatProject(allocations: ColourAllocation.single(yarn("Cream", hex: "F0E9DA")))
        project.options.safetyMargin = 0

        let tight = project.shoppingList(units: .metric)
        project.options.safetyMargin = 0.5
        let generous = project.shoppingList(units: .metric)

        XCTAssertGreaterThanOrEqual(generous.totalBalls, tight.totalBalls)
        XCTAssertEqual(generous.safetyMargin, 0.5, accuracy: 1e-9)
        // The yarn *needed* does not change — only how much is bought.
        XCTAssertEqual(generous.totalMetres, tight.totalMetres, accuracy: 1e-6)
    }

    func testEveryLineBuysAtLeastAsMuchAsItNeeds() {
        let allocations = [
            ColourAllocation(yarn: yarn("A", hex: "111111"), share: 0.7, role: "MC"),
            ColourAllocation(yarn: yarn("B", hex: "222222"), share: 0.3, role: "CC"),
        ]
        let list = hatProject(allocations: allocations).shoppingList(units: .metric)
        for line in list.lines {
            let bought = Double(line.balls) * line.yarn.ballMetres
            XCTAssertGreaterThanOrEqual(bought, line.metres, "\(line.role) buys less than it needs")
            XCTAssertGreaterThanOrEqual(line.spareMetres, 0)
        }
    }

    func testCostIsOnlyReportedWhenEveryYarnIsPriced() {
        let priced = [
            ColourAllocation(yarn: yarn("A", hex: "111111", price: 6), share: 0.5, role: "MC"),
            ColourAllocation(yarn: yarn("B", hex: "222222", price: 6), share: 0.5, role: "CC"),
        ]
        XCTAssertNotNil(hatProject(allocations: priced).shoppingList(units: .metric).totalCost)

        let partly = [
            ColourAllocation(yarn: yarn("A", hex: "111111", price: 6), share: 0.5, role: "MC"),
            ColourAllocation(yarn: yarn("B", hex: "222222"), share: 0.5, role: "CC"),
        ]
        XCTAssertNil(hatProject(allocations: partly).shoppingList(units: .metric).totalCost)
    }

    // MARK: - Needles and notions

    func testEveryProjectKindGetsNeedlesAndNotions() {
        for kind in PatternKind.allCases {
            let project = SavedProject(
                name: kind.name, kind: kind, gauge: dk,
                allocations: ColourAllocation.single(yarn("Cream", hex: "F0E9DA")))
            let list = project.shoppingList(units: .metric)
            XCTAssertFalse(list.needles.isEmpty, "\(kind.name) has no needles")
            XCTAssertFalse(list.notions.isEmpty, "\(kind.name) has no notions")
        }
    }

    func testSmallCircumferenceProjectsSuggestDoublePointedNeedles() {
        for kind in [PatternKind.sock, .mitten] {
            let project = SavedProject(
                name: kind.name, kind: kind, gauge: dk,
                allocations: ColourAllocation.single(yarn("Cream", hex: "F0E9DA")))
            let needles = project.shoppingList(units: .metric).needles
            XCTAssertTrue(
                needles.contains { $0.contains("double-pointed") },
                "\(kind.name) should suggest DPNs or magic loop")
        }
    }

    func testFabricStructureAddsItsOwnNotions() {
        var cabled = hatProject(allocations: ColourAllocation.single(yarn("Cream", hex: "F0E9DA")))
        cabled.structure = .cables
        XCTAssertTrue(
            cabled.shoppingList(units: .metric).notions.contains { $0.contains("Cable needle") })

        var lace = cabled
        lace.structure = .lace
        XCTAssertTrue(
            lace.shoppingList(units: .metric).notions.contains { $0.contains("Lifeline") })
    }

    func testMultipleColoursAddBobbins() {
        let allocations = [
            ColourAllocation(yarn: yarn("A", hex: "111111"), share: 0.5, role: "MC"),
            ColourAllocation(yarn: yarn("B", hex: "222222"), share: 0.5, role: "CC"),
        ]
        let notions = hatProject(allocations: allocations).shoppingList(units: .metric).notions
        XCTAssertTrue(notions.contains { $0.contains("Bobbins") })
    }

    func testSweaterNeedsHoldersForTheSleeveStitches() {
        let project = SavedProject(
            name: "Sweater", kind: .raglanSweater, gauge: dk,
            allocations: ColourAllocation.single(yarn("Cream", hex: "F0E9DA")))
        let notions = project.shoppingList(units: .metric).notions
        XCTAssertTrue(notions.contains { $0.contains("Waste yarn") })
    }

    // MARK: - Export

    func testPlainTextListCarriesTheDyeLotWarning() {
        let project = hatProject(allocations: ColourAllocation.single(yarn("Cream", hex: "F0E9DA")))
        let text = project.shoppingList(units: .metric).plainText(projectName: project.name)
        XCTAssertTrue(text.contains("Test hat"))
        XCTAssertTrue(text.contains("dye lot"))
        XCTAssertTrue(text.contains("Needles"))
        XCTAssertTrue(text.contains("Notions"))
    }

    // MARK: - Persistence

    func testProjectSurvivesARoundTripThroughJSON() throws {
        var project = hatProject(
            allocations: ColourAllocation.single(yarn("Cream", hex: "F0E9DA")))
        project.chart = BuiltInPatterns.chart(id: "fair-isle-band")
        project.rowsCompleted = 42
        project.notes = "Second attempt"

        let data = try JSONEncoder().encode(project)
        let restored = try JSONDecoder().decode(SavedProject.self, from: data)

        XCTAssertEqual(restored.name, project.name)
        XCTAssertEqual(restored.kind, project.kind)
        XCTAssertEqual(restored.gauge, project.gauge)
        XCTAssertEqual(restored.rowsCompleted, 42)
        XCTAssertEqual(restored.chart?.cells, project.chart?.cells)
        XCTAssertEqual(
            restored.plan(units: .metric).totalStitches,
            project.plan(units: .metric).totalStitches,
            accuracy: 1e-6)
    }

    func testPresetsAllBuildWorkingProjects() {
        for preset in BuiltInPatterns.all {
            let project = SavedProject.fromPreset(preset)
            let plan = project.plan(units: .metric)
            XCTAssertGreaterThan(plan.totalStitches, 0, preset.name)
            let list = project.shoppingList(units: .metric)
            XCTAssertFalse(list.lines.isEmpty, preset.name)
            XCTAssertGreaterThanOrEqual(list.totalBalls, 1, preset.name)
            if preset.chartID != nil {
                XCTAssertNotNil(project.chart, "\(preset.name) should have loaded its chart")
            }
        }
    }
}
