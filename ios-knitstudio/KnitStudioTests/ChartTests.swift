import XCTest
@testable import KnitStudio

final class ChartTests: XCTestCase {

    private let palette = [
        Yarn(name: "Cream", hex: "F0E9DA", weight: .light),
        Yarn(name: "Indigo", hex: "2E4272", weight: .light),
    ]

    /// Text art reads top-down, but chart row 0 is the bottom row — the first
    /// one knitted. Getting this backwards silently knits every motif upside down.
    private func twoRowChart(working: ChartWorking = .inTheRound) -> ColourChart {
        BuiltInPatterns.parse(
            name: "test",
            art: """
            XX..
            ..XX
            """,
            palette: palette,
            working: working)
    }

    func testTextArtBottomRowIsChartRowZero() {
        let chart = twoRowChart()
        XCTAssertEqual(chart.width, 4)
        XCTAssertEqual(chart.height, 2)
        // Bottom row of the art was "..XX".
        XCTAssertEqual(chart.colourIndex(x: 0, y: 0), 0)
        XCTAssertEqual(chart.colourIndex(x: 3, y: 0), 1)
        // Top row was "XX..".
        XCTAssertEqual(chart.colourIndex(x: 0, y: 1), 1)
        XCTAssertEqual(chart.colourIndex(x: 3, y: 1), 0)
    }

    func testChartSizeIsAlwaysConsistent() {
        // Too few cells are padded, too many are trimmed.
        let short = ColourChart(name: "s", width: 3, height: 3, cells: [1, 1], palette: palette)
        XCTAssertEqual(short.cells.count, 9)
        let long = ColourChart(
            name: "l", width: 2, height: 2,
            cells: [1, 1, 1, 1, 1, 1, 1], palette: palette)
        XCTAssertEqual(long.cells.count, 4)
    }

    func testOutOfBoundsAccessIsSafe() {
        let chart = twoRowChart()
        XCTAssertEqual(chart.colourIndex(x: -1, y: 0), 0)
        XCTAssertEqual(chart.colourIndex(x: 99, y: 99), 0)
        var mutable = chart
        mutable.setColourIndex(1, x: 99, y: 99)   // must not crash
        XCTAssertEqual(mutable.cells.count, 8)
    }

    /// Charts are read right to left, the direction stitches are worked.
    func testKnittingOrderInTheRound() {
        let chart = twoRowChart(working: .inTheRound)
        XCTAssertEqual(chart.knittingOrder(row: 0), [1, 1, 0, 0])
        XCTAssertEqual(chart.knittingOrder(row: 1), [0, 0, 1, 1])
    }

    /// Worked flat, wrong-side rows are read the other way.
    func testKnittingOrderFlatAlternates() {
        let chart = twoRowChart(working: .flat)
        // Row 0 is a right-side row: right to left.
        XCTAssertEqual(chart.knittingOrder(row: 0), [1, 1, 0, 0])
        // Row 1 is a wrong-side row: left to right, as charted.
        XCTAssertEqual(chart.knittingOrder(row: 1), [1, 1, 0, 0])
    }

    func testColourSharesSumToOne() {
        let chart = twoRowChart()
        let shares = chart.colourShares()
        XCTAssertEqual(shares[0] ?? 0, 0.5, accuracy: 1e-9)
        XCTAssertEqual(shares[1] ?? 0, 0.5, accuracy: 1e-9)
        XCTAssertEqual(shares.values.reduce(0, +), 1.0, accuracy: 1e-9)
    }

    func testStitchCountsMatchTheGrid() {
        let chart = twoRowChart()
        let counts = chart.stitchCounts()
        XCTAssertEqual(counts[0], 4)
        XCTAssertEqual(counts[1], 4)
        XCTAssertEqual(counts.values.reduce(0, +), chart.totalStitches)
    }

    func testLongestFloatIsMeasuredInKnittingOrder() {
        let chart = twoRowChart()
        XCTAssertEqual(chart.longestFloat(), 2)

        let wide = BuiltInPatterns.parse(
            name: "wide", art: "X.........X", palette: palette)
        XCTAssertEqual(wide.longestFloat(), 9)
    }

    func testLongFloatsAreFlagged() {
        let wide = BuiltInPatterns.parse(
            name: "wide", art: "X.............X", palette: palette)
        let notes = wide.reviewNotes(gauge: Gauge(stitchesPer10cm: 22, rowsPer10cm: 30))
        XCTAssertTrue(notes.contains { $0.contains("float") })
    }

    func testTooManyColoursPerRowIsFlagged() {
        let three = [
            palette[0], palette[1],
            Yarn(name: "Rust", hex: "B5533C", weight: .light),
        ]
        let chart = BuiltInPatterns.parse(name: "three", art: "X.oX.o", palette: three)
        XCTAssertEqual(chart.maxColoursPerRow(), 3)
        let notes = chart.reviewNotes(gauge: Gauge(stitchesPer10cm: 22, rowsPer10cm: 30))
        XCTAssertTrue(notes.contains { $0.contains("colours appear in one row") })
    }

    func testWrittenInstructionsRunLengthEncodeEachRow() {
        let chart = twoRowChart(working: .inTheRound)
        let lines = chart.writtenInstructions()
        XCTAssertEqual(lines.count, 2)
        XCTAssertEqual(lines[0], "Rnd 1: 2 B, 2 A")
        XCTAssertEqual(lines[1], "Rnd 2: 2 A, 2 B")
    }

    func testWrittenInstructionsLabelSidesWhenWorkedFlat() {
        let chart = twoRowChart(working: .flat)
        let lines = chart.writtenInstructions()
        XCTAssertTrue(lines[0].hasPrefix("Row 1 (RS):"))
        XCTAssertTrue(lines[1].hasPrefix("Row 2 (WS):"))
    }

    func testResizePreservesTheOverlappingCells() {
        var chart = twoRowChart()
        chart.resize(width: 6, height: 4)
        XCTAssertEqual(chart.width, 6)
        XCTAssertEqual(chart.height, 4)
        XCTAssertEqual(chart.cells.count, 24)
        // Original corner survives.
        XCTAssertEqual(chart.colourIndex(x: 3, y: 0), 1)
        XCTAssertEqual(chart.colourIndex(x: 0, y: 1), 1)
        // New space is the main colour.
        XCTAssertEqual(chart.colourIndex(x: 5, y: 3), 0)
    }

    func testMirrorAndFlipAreTheirOwnInverse() {
        let original = twoRowChart()
        var chart = original
        chart.mirrorHorizontally()
        XCTAssertNotEqual(chart.cells, original.cells)
        chart.mirrorHorizontally()
        XCTAssertEqual(chart.cells, original.cells)

        chart.flipVertically()
        XCTAssertNotEqual(chart.cells, original.cells)
        chart.flipVertically()
        XCTAssertEqual(chart.cells, original.cells)
    }

    func testFinishedSizeUsesGauge() {
        let chart = twoRowChart()
        let gauge = Gauge(stitchesPer10cm: 20, rowsPer10cm: 25)
        let size = chart.finishedSize(gauge: gauge)
        XCTAssertEqual(size.width, 2.0, accuracy: 1e-9)    // 4 sts at 5 mm each
        XCTAssertEqual(size.height, 0.8, accuracy: 1e-9)   // 2 rows at 4 mm each
    }

    func testLegendLetters() {
        let chart = twoRowChart()
        XCTAssertEqual(chart.letter(for: 0), "A")
        XCTAssertEqual(chart.letter(for: 1), "B")
        XCTAssertEqual(chart.legend.count, 2)
        XCTAssertEqual(chart.legend[1].letter, "B")
    }

    func testEveryBuiltInMotifParses() {
        for motif in BuiltInPatterns.motifs {
            guard let chart = BuiltInPatterns.chart(id: motif.id) else {
                return XCTFail("\(motif.id) failed to parse")
            }
            XCTAssertGreaterThan(chart.width, 0, motif.id)
            XCTAssertGreaterThan(chart.height, 0, motif.id)
            XCTAssertEqual(chart.cells.count, chart.width * chart.height, motif.id)
            XCTAssertEqual(chart.palette.count, motif.colours, motif.id)
            // Every cell must index a real palette entry.
            for cell in chart.cells {
                XCTAssertLessThan(cell, chart.palette.count, motif.id)
                XCTAssertGreaterThanOrEqual(cell, 0, motif.id)
            }
        }
    }

    func testBlankChartIsAllMainColour() {
        let chart = ColourChart.blank(width: 5, height: 5, palette: palette)
        XCTAssertEqual(chart.cells.count, 25)
        XCTAssertTrue(chart.cells.allSatisfy { $0 == 0 })
        XCTAssertEqual(chart.colourShares()[0], 1.0)
    }

    func testChartSurvivesARoundTripThroughJSON() throws {
        let chart = twoRowChart()
        let data = try JSONEncoder().encode(chart)
        let restored = try JSONDecoder().decode(ColourChart.self, from: data)
        XCTAssertEqual(restored.cells, chart.cells)
        XCTAssertEqual(restored.width, chart.width)
        XCTAssertEqual(restored.working, chart.working)
        XCTAssertEqual(restored.palette.map(\.hex), chart.palette.map(\.hex))
    }

    // MARK: - Image conversion geometry

    /// A knit stitch is wider than it is tall, so a square image needs more
    /// rows than stitches or the knitted result comes out squashed.
    func testImageRowCountAccountsForStitchProportions() {
        let gauge = Gauge(stitchesPer10cm: 22, rowsPer10cm: 30)
        let square = CGSize(width: 100, height: 100)
        let rows = ImageChartConverter.rowCount(forStitches: 40, imageSize: square, gauge: gauge)
        // 40 sts is 18.18 cm wide; the same in height needs 54.5 -> 55 rows.
        XCTAssertEqual(rows, 55)
        XCTAssertGreaterThan(rows, 40)

        // A wide image gives proportionally fewer rows.
        let wide = CGSize(width: 200, height: 100)
        XCTAssertEqual(
            ImageChartConverter.rowCount(forStitches: 40, imageSize: wide, gauge: gauge), 27)
    }

    func testColourDistanceIsWeightedTowardsGreen() {
        let black = ImageChartConverter.RGB(r: 0, g: 0, b: 0)
        let green = ImageChartConverter.RGB(r: 0, g: 1, b: 0)
        let blue = ImageChartConverter.RGB(r: 0, g: 0, b: 1)
        XCTAssertGreaterThan(
            ImageChartConverter.distance(black, green),
            ImageChartConverter.distance(black, blue))
    }

    /// Median cut splits at the median *index*, so with unequal cluster sizes
    /// its seeds land off-centre; the k-means refinement is what pulls them
    /// onto the real colours. Test the pair, since that is what conversion uses.
    func testMedianCutPlusRefinementSeparatesDistinctColours() {
        let samples =
            Array(repeating: ImageChartConverter.RGB(r: 0.95, g: 0.95, b: 0.95), count: 60)
            + Array(repeating: ImageChartConverter.RGB(r: 0.05, g: 0.05, b: 0.05), count: 40)

        let seeds = ImageChartConverter.medianCut(samples, into: 2)
        XCTAssertEqual(seeds.count, 2)

        let centroids = ImageChartConverter.refine(
            centroids: seeds, samples: samples, iterations: 12)
        let brightest = centroids.max { $0.r < $1.r }
        let darkest = centroids.min { $0.r < $1.r }
        XCTAssertEqual(brightest?.r ?? 0, 0.95, accuracy: 0.01)
        XCTAssertEqual(darkest?.r ?? 1, 0.05, accuracy: 0.01)
    }

    func testMedianCutNeverReturnsMoreThanAskedFor() {
        let samples = (0 ..< 64).map {
            ImageChartConverter.RGB(r: Double($0) / 64, g: 0.5, b: 1 - Double($0) / 64)
        }
        for count in [2, 3, 4, 8] {
            XCTAssertLessThanOrEqual(ImageChartConverter.medianCut(samples, into: count).count, count)
        }
        // A single flat colour cannot be split, and must not loop forever.
        let flat = Array(repeating: ImageChartConverter.RGB(r: 0.4, g: 0.4, b: 0.4), count: 20)
        XCTAssertEqual(ImageChartConverter.medianCut(flat, into: 4).count, 1)
    }

    func testNearestIndexPicksTheClosestPaletteEntry() {
        let palette = [
            ImageChartConverter.RGB(r: 1, g: 1, b: 1),
            ImageChartConverter.RGB(r: 0, g: 0, b: 0),
        ]
        XCTAssertEqual(
            ImageChartConverter.nearestIndex(
                to: ImageChartConverter.RGB(r: 0.9, g: 0.9, b: 0.9), in: palette), 0)
        XCTAssertEqual(
            ImageChartConverter.nearestIndex(
                to: ImageChartConverter.RGB(r: 0.1, g: 0.1, b: 0.1), in: palette), 1)
    }

    func testHexRoundTrip() {
        XCTAssertEqual(ImageChartConverter.RGB(r: 1, g: 0, b: 0).hex, "FF0000")
        XCTAssertEqual(ImageChartConverter.RGB(r: 0, g: 0, b: 0).hex, "000000")
        // Values outside 0...1 (which dithering can produce) are clamped.
        XCTAssertEqual(ImageChartConverter.RGB(r: 1.4, g: -0.3, b: 0.5).hex, "FF0080")
    }
}
