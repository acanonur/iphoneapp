import XCTest
@testable import KnitStudio

/// The simulation is only worth looking at if the fabric settles the way real
/// fabric does: a cable pulls its columns in, lace opens out, and nothing ever
/// folds through itself.
final class StitchMeshTests: XCTestCase {

    private let worsted = Gauge(stitchesPer10cm: 18, rowsPer10cm: 24)

    private func pattern(_ name: String) -> StitchPattern {
        guard let found = StitchPatternLibrary.pattern(named: name) else {
            XCTFail("\(name) is missing from the library")
            return StitchPattern.blank(name: "fallback", width: 4, height: 4)
        }
        return found
    }

    // MARK: - Shape of the mesh

    func testFlatMeshIsExactlyTheGrid() {
        let mesh = StitchMesh.flat(columns: 6, rows: 4)
        XCTAssertEqual(mesh.columns, 6)
        XCTAssertEqual(mesh.rows, 4)
        XCTAssertEqual(mesh.corners.count, 7 * 5)
        XCTAssertEqual(mesh.corner(x: 0, y: 0).x, 0, accuracy: 1e-9)
        XCTAssertEqual(mesh.corner(x: 6, y: 4).x, 6, accuracy: 1e-9)
        XCTAssertEqual(mesh.corner(x: 6, y: 4).y, 4, accuracy: 1e-9)
    }

    func testCornerLookupClampsInsteadOfTrapping() {
        let mesh = StitchMesh.flat(columns: 3, rows: 3)
        XCTAssertEqual(mesh.corner(x: -5, y: -5), mesh.corner(x: 0, y: 0))
        XCTAssertEqual(mesh.corner(x: 99, y: 99), mesh.corner(x: 3, y: 3))
    }

    func testNoSettlingLeavesTheStitchesOnTheGrid() {
        let settings = FabricSettings(settling: 0)
        let mesh = StitchMesh.build(
            pattern: pattern("Little arrowhead lace"), columns: 10, rows: 8, settings: settings)
        for y in 0 ... 8 {
            for x in 0 ... 10 {
                XCTAssertEqual(mesh.corner(x: x, y: y).x, Double(x), accuracy: 1e-9)
                XCTAssertEqual(mesh.corner(x: x, y: y).y, Double(y), accuracy: 1e-9)
            }
        }
    }

    // MARK: - It has to stay a fabric

    /// Every settled mesh must still be a sane sheet: finite, the right way up,
    /// and not folded back through itself.
    func testEveryLibraryPatternSettlesIntoASaneSheet() {
        let settings = FabricSettings()
        for entry in StitchPatternLibrary.all {
            let mesh = StitchMesh.build(pattern: entry, columns: 14, rows: 12, settings: settings)
            let extent = mesh.bounds
            XCTAssertTrue(extent.width.isFinite, "\(entry.name): width is not finite")
            XCTAssertTrue(extent.height.isFinite, "\(entry.name): height is not finite")
            XCTAssertGreaterThan(extent.width, 4, "\(entry.name): collapsed sideways")
            XCTAssertGreaterThan(extent.height, 4, "\(entry.name): collapsed vertically")
            XCTAssertLessThan(extent.width, 40, "\(entry.name): blew up sideways")
            XCTAssertLessThan(extent.height, 40, "\(entry.name): blew up vertically")

            for y in 0 ... 12 {
                for x in 0 ..< 14 {
                    let here = mesh.corner(x: x, y: y)
                    let next = mesh.corner(x: x + 1, y: y)
                    XCTAssertGreaterThan(
                        next.x, here.x,
                        "\(entry.name): column \(x) folded through column \(x + 1) on row \(y)")
                }
            }
            for x in 0 ... 14 {
                for y in 0 ..< 12 {
                    let here = mesh.corner(x: x, y: y)
                    let above = mesh.corner(x: x, y: y + 1)
                    XCTAssertGreaterThan(
                        above.y, here.y,
                        "\(entry.name): row \(y) folded through row \(y + 1) at column \(x)")
                }
            }
        }
    }

    func testSettlingIsRepeatable() {
        let settings = FabricSettings()
        let first = StitchMesh.build(
            pattern: pattern("Feather and fan"), columns: 20, rows: 10, settings: settings)
        let second = StitchMesh.build(
            pattern: pattern("Feather and fan"), columns: 20, rows: 10, settings: settings)
        XCTAssertEqual(first, second, "the same fabric settled twice must land in the same place")
    }

    // MARK: - It has to settle the way knitting does

    /// A cable panel is narrower than the same stitches worked plain. That is
    /// why a cabled sweater comes out tighter than its gauge swatch promised.
    func testACablePullsInNarrowerThanStockinette() {
        let settings = FabricSettings()
        let plain = StitchMesh.build(
            pattern: pattern("Stockinette"), columns: 12, rows: 12, settings: settings)
        let cabled = StitchMesh.build(
            pattern: pattern("Rope cable (4 st)"), columns: 12, rows: 12, settings: settings)
        XCTAssertLessThan(
            cabled.bounds.width, plain.bounds.width,
            "a cable should pull the fabric in")
    }

    /// Lace does the opposite: the yarn-overs are holes and they take up room.
    func testLaceOpensOutWiderThanStockinette() {
        let settings = FabricSettings()
        let plain = StitchMesh.build(
            pattern: pattern("Stockinette"), columns: 18, rows: 12, settings: settings)
        let lace = StitchMesh.build(
            pattern: pattern("Feather and fan"), columns: 18, rows: 12, settings: settings)
        XCTAssertGreaterThan(
            lace.bounds.width, plain.bounds.width * 0.98,
            "lace should not come out narrower than plain knitting")
    }

    /// Knitting tighter makes the same stitches take up less cloth.
    func testTighterTensionMakesASmallerPieceOfFabric() {
        let loose = StitchMesh.build(
            pattern: pattern("Stockinette"), columns: 12, rows: 12,
            settings: FabricSettings(tension: 0.8))
        let tight = StitchMesh.build(
            pattern: pattern("Stockinette"), columns: 12, rows: 12,
            settings: FabricSettings(tension: 1.3))
        XCTAssertLessThan(tight.bounds.width, loose.bounds.width)
        XCTAssertLessThan(tight.bounds.height, loose.bounds.height)
    }

    /// Real knitting is never mechanically even, so a settled plain fabric must
    /// not come back as a perfect grid — but it must not be chaotic either.
    func testSettledStockinetteIsUnevenButOnlySlightly() {
        let mesh = StitchMesh.build(
            pattern: pattern("Stockinette"), columns: 12, rows: 12, settings: FabricSettings())
        var biggestDrift = 0.0
        for y in 0 ... 12 {
            for x in 0 ... 12 where x <= mesh.columns {
                let drift = abs(mesh.corner(x: x, y: y).x - Double(x))
                biggestDrift = max(biggestDrift, drift)
            }
        }
        XCTAssertGreaterThan(biggestDrift, 0.0001, "the fabric came out perfectly regular")
        XCTAssertLessThan(biggestDrift, 2.0, "the fabric wandered much too far")
    }

    // MARK: - Settings

    func testSettingsClampToUsableRanges() {
        let silly = FabricSettings(tension: 99, fullness: -4, settling: 12)
        XCTAssertEqual(silly.tension, 1.6, accuracy: 1e-9)
        XCTAssertEqual(silly.fullness, 0.5, accuracy: 1e-9)
        XCTAssertEqual(silly.settling, 1, accuracy: 1e-9)
    }

    func testWobbleIsBoundedAndRepeatable() {
        for x in 0 ..< 40 {
            for y in 0 ..< 40 {
                let value = StitchMesh.wobble(x: x, y: y, salt: 3)
                XCTAssertGreaterThanOrEqual(value, -0.5)
                XCTAssertLessThan(value, 0.5)
                XCTAssertEqual(value, StitchMesh.wobble(x: x, y: y, salt: 3), accuracy: 1e-12)
            }
        }
    }

    // MARK: - Fabric coordinates

    func testFabricRowsMapOntoChartedRows() {
        let dots = pattern("Shadow-knit dots")
        XCTAssertEqual(dots.rowsPerChartedRow, 2)
        XCTAssertEqual(dots.chartedRow(forFabricRow: 0), 0)
        XCTAssertEqual(dots.chartedRow(forFabricRow: 1), 0)
        XCTAssertEqual(dots.chartedRow(forFabricRow: 2), 1)
        XCTAssertEqual(dots.chartedRow(forFabricRow: 63), 31)
        // And it carries on repeating up the fabric.
        XCTAssertEqual(dots.chartedRow(forFabricRow: 64), 0)
        XCTAssertEqual(dots.chartedRow(forFabricRow: -1), 31)
    }

    func testFabricAppearanceWrapsSidewaysAndInvertsWrongSideCharts() {
        let dots = pattern("Shadow-knit dots")
        for x in 0 ..< dots.width {
            XCTAssertEqual(
                dots.fabricAppearance(x: x, fabricRow: 0),
                dots.fabricAppearance(x: x + dots.width, fabricRow: 0),
                "the repeat should carry on sideways for ever")
            // The chart is drawn from the wrong side, so what you see is the
            // opposite of what is charted.
            XCTAssertEqual(
                dots.fabricAppearance(x: x, fabricRow: 0),
                dots.symbol(x: x, y: 0).wrongSideAppearance)
        }
    }

    func testEverySymbolHasSaneRelaxedProportions() {
        for symbol in StitchSymbol.allCases {
            XCTAssertGreaterThan(symbol.relaxedWidth, 0.2, "\(symbol.rawValue) is impossibly narrow")
            XCTAssertLessThan(symbol.relaxedWidth, 2.5, "\(symbol.rawValue) is impossibly wide")
            XCTAssertGreaterThan(symbol.relaxedHeight, 0.2)
            XCTAssertLessThan(symbol.relaxedHeight, 2.5)
        }
        XCTAssertGreaterThan(
            StitchSymbol.yarnOver.relaxedWidth, StitchSymbol.knit.relaxedWidth,
            "a yarn-over is a hole and takes up room")
        XCTAssertLessThan(
            StitchSymbol.k2tog.relaxedWidth, StitchSymbol.knit.relaxedWidth,
            "a decrease has eaten a stitch")
    }
}
