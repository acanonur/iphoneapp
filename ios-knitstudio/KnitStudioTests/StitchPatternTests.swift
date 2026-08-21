import XCTest
@testable import KnitStudio

/// The stitch chart engine and the built-in stitch dictionary.
final class StitchPatternTests: XCTestCase {

    /// Row 0 is the bottom of the chart — the first row knitted. Both rows are
    /// deliberately lopsided so that reading them backwards shows up.
    private func sample(working: ChartWorking = .flat) -> StitchPattern {
        let cells: [StitchSymbol] = [
            .knit, .knit, .purl, .purl,
            .purl, .knit, .knit, .knit,
        ]
        return StitchPattern(name: "sample", width: 4, height: 2, symbols: cells, working: working)
    }

    // MARK: - The grid

    func testGridSizeIsAlwaysConsistent() {
        // Too few cells are padded with knits, too many are trimmed.
        let short = StitchPattern(name: "short", width: 3, height: 3, symbols: [.purl, .purl])
        XCTAssertEqual(short.symbols.count, 9)
        XCTAssertEqual(short.symbol(x: 0, y: 0), .purl)
        XCTAssertEqual(short.symbol(x: 2, y: 2), .knit)

        let spare: [StitchSymbol] = Array(repeating: .purl, count: 7)
        let long = StitchPattern(name: "long", width: 2, height: 2, symbols: spare)
        XCTAssertEqual(long.symbols.count, 4)
        XCTAssertTrue(long.symbols.allSatisfy { (cell: StitchSymbol) in cell == .purl })
    }

    func testAPatternIsNeverSmallerThanOneCell() {
        let tiny = StitchPattern(name: "tiny", width: 0, height: -3, symbols: [])
        XCTAssertEqual(tiny.width, 1)
        XCTAssertEqual(tiny.height, 1)
        XCTAssertEqual(tiny.symbols.count, 1)
        XCTAssertEqual(tiny.multipleOf, 1)
    }

    func testOutOfRangeCellsAreSafe() {
        let pattern = sample()
        XCTAssertEqual(pattern.symbol(x: -1, y: 0), .knit)
        XCTAssertEqual(pattern.symbol(x: 0, y: -5), .knit)
        XCTAssertEqual(pattern.symbol(x: 4, y: 0), .knit)
        XCTAssertEqual(pattern.symbol(x: 99, y: 99), .knit)

        var mutable = pattern
        mutable.setSymbol(.bobble, x: 99, y: 99)   // must not crash
        XCTAssertEqual(mutable.symbols, pattern.symbols)
        mutable.setSymbol(.bobble, x: 1, y: 1)
        XCTAssertEqual(mutable.symbol(x: 1, y: 1), .bobble)
    }

    /// A swatch is drawn much larger than one repeat, so the tiling has to run
    /// in both directions and off both edges.
    func testSymbolTiledWrapsBothWays() {
        let pattern = sample()
        XCTAssertEqual(pattern.symbolTiled(x: 4, y: 0), pattern.symbol(x: 0, y: 0))
        XCTAssertEqual(pattern.symbolTiled(x: 6, y: 0), pattern.symbol(x: 2, y: 0))
        XCTAssertEqual(pattern.symbolTiled(x: -1, y: 0), pattern.symbol(x: 3, y: 0))
        XCTAssertEqual(pattern.symbolTiled(x: 0, y: 2), pattern.symbol(x: 0, y: 0))
        XCTAssertEqual(pattern.symbolTiled(x: 0, y: -1), pattern.symbol(x: 0, y: 1))
        XCTAssertEqual(pattern.symbolTiled(x: 9, y: 7), pattern.symbol(x: 1, y: 1))
        XCTAssertEqual(pattern.symbolTiled(x: -5, y: -6), pattern.symbol(x: 3, y: 0))
    }

    // MARK: - Reading order

    /// Charts are read right to left, the direction the stitches are worked;
    /// only a wrong-side row is read the other way.
    func testFlatRowsAlternateTheirReadingDirection() {
        let pattern = sample(working: .flat)
        XCTAssertTrue(pattern.isRightSideRow(0))
        XCTAssertFalse(pattern.isRightSideRow(1))
        let bottomRow: [StitchSymbol] = [.purl, .purl, .knit, .knit]
        let secondRow: [StitchSymbol] = [.purl, .knit, .knit, .knit]
        XCTAssertEqual(pattern.rowSymbolsInKnittingOrder(0), bottomRow)
        XCTAssertEqual(pattern.rowSymbolsInKnittingOrder(1), secondRow)
    }

    func testEveryRoundReadsRightToLeft() {
        let pattern = sample(working: .inTheRound)
        XCTAssertTrue(pattern.isRightSideRow(0))
        XCTAssertTrue(pattern.isRightSideRow(1))
        let bottomRound: [StitchSymbol] = [.purl, .purl, .knit, .knit]
        let secondRound: [StitchSymbol] = [.knit, .knit, .knit, .purl]
        XCTAssertEqual(pattern.rowSymbolsInKnittingOrder(0), bottomRound)
        XCTAssertEqual(pattern.rowSymbolsInKnittingOrder(1), secondRound)
    }

    // MARK: - Written instructions

    func testWrongSideAbbreviationsFlipTheStitch() {
        XCTAssertEqual(StitchSymbol.knit.wrongSideAbbreviation, "p")
        XCTAssertEqual(StitchSymbol.purl.wrongSideAbbreviation, "k")
        XCTAssertEqual(StitchSymbol.k2tog.wrongSideAbbreviation, "p2tog")
        XCTAssertEqual(StitchSymbol.ssk.wrongSideAbbreviation, "ssp")
        // A yarn-over is a yarn-over from either side.
        XCTAssertEqual(StitchSymbol.yarnOver.wrongSideAbbreviation, "yo")
        XCTAssertEqual(StitchSymbol.cable2Back.wrongSideAbbreviation, "C4B")
    }

    /// The written row has to say what the knitter does, not what the chart
    /// draws: a knit charted on a wrong-side row is purled.
    func testWrittenRowsFollowTheKnittingDirectionAndSide() {
        let lines = sample(working: .flat).writtenInstructions(colourNames: [])
        XCTAssertEqual(lines.count, 2)
        XCTAssertEqual(lines[0], "Row 1 (RS): p2, k2")
        XCTAssertEqual(lines[1], "Row 2 (WS): k1, p3")
    }

    // MARK: - The library

    func testEveryLibraryPatternKeepsItsStitchCount() {
        for pattern in StitchPatternLibrary.all {
            XCTAssertTrue(
                pattern.isStitchCountStable,
                "\(pattern.name) does not come back to the count it started with")
            for y in 0 ..< pattern.height {
                XCTAssertEqual(
                    pattern.netStitchChange(row: y), 0,
                    "\(pattern.name) row \(y + 1)")
            }
            let complaints = pattern.validate().filter { (note: String) in
                note.contains("does not come back")
            }
            XCTAssertTrue(complaints.isEmpty, "\(pattern.name): \(complaints.joined(separator: " "))")
        }
    }

    func testEveryLibraryPatternIsNamedAndLegended() {
        for pattern in StitchPatternLibrary.all {
            let name = pattern.name.trimmingCharacters(in: .whitespacesAndNewlines)
            let summary = pattern.summary.trimmingCharacters(in: .whitespacesAndNewlines)
            XCTAssertFalse(name.isEmpty, "a library pattern has no name")
            XCTAssertFalse(summary.isEmpty, "\(pattern.name) has no summary")
            XCTAssertGreaterThanOrEqual(pattern.multipleOf, 1, pattern.name)
            XCTAssertGreaterThanOrEqual(pattern.plusStitches, 0, pattern.name)
            XCTAssertEqual(pattern.symbols.count, pattern.width * pattern.height, pattern.name)

            // The legend is what the knitter reads the chart with, so it must
            // list every symbol used and nothing else.
            let used = Set(pattern.symbols)
            XCTAssertEqual(pattern.legend.count, used.count, pattern.name)
            for entry in pattern.legend {
                XCTAssertTrue(
                    used.contains(entry),
                    "\(pattern.name) legends \(entry.name) but never uses it")
            }
        }
    }

    func testCastOnAlwaysLandsOnAWholeRepeat() {
        let desiredCounts: [Int] = [1, 2, 3, 5, 9, 17, 33, 64, 100, 150, 220]
        for pattern in StitchPatternLibrary.all {
            for desired in desiredCounts {
                let castOn: Int = pattern.castOn(nearest: desired)
                XCTAssertGreaterThanOrEqual(
                    castOn, pattern.multipleOf,
                    "\(pattern.name) cast on \(castOn) for \(desired)")
                let beyondTheEdges: Int = castOn - pattern.plusStitches
                let leftOver: Int = beyondTheEdges % pattern.multipleOf
                let remainder: Int = (leftOver + pattern.multipleOf) % pattern.multipleOf
                XCTAssertEqual(
                    remainder, 0,
                    "\(pattern.name) cast on \(castOn) for \(desired) is not a whole repeat")
            }
        }
    }

    /// Feather and fan is the one repeat with edge stitches on top of the
    /// multiple, so it is where an off-by-one in the rounding would show.
    func testCastOnAddsTheEdgeStitchesOnTop() {
        guard let fan = StitchPatternLibrary.pattern(named: "Feather and fan") else {
            return XCTFail("Feather and fan is missing from the library")
        }
        XCTAssertEqual(fan.multipleOf, 18)
        XCTAssertEqual(fan.plusStitches, 2)
        XCTAssertEqual(fan.castOn(nearest: 110), 110)
        XCTAssertEqual(fan.castOn(nearest: 100), 92)
        XCTAssertEqual(fan.castOn(nearest: 30), 38)
        XCTAssertEqual(fan.castOn(nearest: 25), 20)
        // Never rounds away to nothing: one repeat is the smallest cast-on.
        XCTAssertEqual(fan.castOn(nearest: 4), 20)
        XCTAssertEqual(fan.castOn(nearest: 1), 20)
    }

    func testColourSharesSumToOne() {
        guard let stripe = StitchPatternLibrary.pattern(named: "Two-colour stripe") else {
            return XCTFail("Two-colour stripe is missing from the library")
        }
        let shares = stripe.colourShares()
        XCTAssertEqual(shares.count, 2)
        XCTAssertEqual(shares[0] ?? 0, 0.5, accuracy: 1e-9)
        XCTAssertEqual(shares[1] ?? 0, 0.5, accuracy: 1e-9)
        XCTAssertEqual(shares.values.reduce(0, +), 1.0, accuracy: 1e-9)

        // A one-colour pattern still accounts for all of its stitches.
        for pattern in StitchPatternLibrary.all {
            let total = pattern.colourShares().values.reduce(0, +)
            XCTAssertEqual(total, 1.0, accuracy: 1e-9, pattern.name)
        }
    }

    // MARK: - Shadow knitting

    private func shadowDots() -> StitchPattern? {
        StitchPatternLibrary.pattern(named: "Shadow-knit dots")
    }

    /// Each charted row is the wrong-side row of a pair, so the chart is half
    /// as tall as the knitting and every charted row is a wrong-side row.
    func testShadowKnitDotsGeometry() {
        guard let dots = shadowDots() else {
            return XCTFail("Shadow-knit dots is missing from the library")
        }
        XCTAssertEqual(dots.width, 18)
        XCTAssertEqual(dots.height, 32)
        XCTAssertEqual(dots.rowsPerChartedRow, 2)
        XCTAssertTrue(dots.chartsWrongSideRows)
        XCTAssertEqual(dots.totalRows, 64)
        XCTAssertEqual(dots.multipleOf, 18)
        XCTAssertFalse(dots.isRightSideRow(0))
        XCTAssertFalse(dots.isRightSideRow(1))
        XCTAssertNotNil(dots.impliedRowInstruction)
    }

    func testShadowKnitDotsColoursAlternateEveryChartedRow() {
        guard let dots = shadowDots() else {
            return XCTFail("Shadow-knit dots is missing from the library")
        }
        XCTAssertEqual(dots.rowColours.count, 32)
        XCTAssertEqual(dots.colourCount, 2)
        XCTAssertTrue(dots.usesColourStripes)
        for y in 0 ..< dots.height {
            XCTAssertEqual(dots.colourIndex(row: y), y % 2, "charted row \(y + 1)")
        }
        let shares = dots.colourShares()
        XCTAssertEqual(shares[0] ?? 0, 0.5, accuracy: 1e-9)
        XCTAssertEqual(shares[1] ?? 0, 0.5, accuracy: 1e-9)
    }

    /// The dots are nothing but purl bumps, so the purl count per charted row
    /// is the whole motif — a change anywhere in the grid moves one of these.
    func testShadowKnitDotsHaveTheExpectedMotif() {
        guard let dots = shadowDots() else {
            return XCTFail("Shadow-knit dots is missing from the library")
        }
        let expected: [Int] = [
            18, 0, 18, 0, 18, 0, 14, 4, 10, 8, 8, 10, 10, 8, 14, 4,
            18, 0, 18, 0, 18, 0, 14, 4, 10, 8, 8, 10, 10, 8, 14, 4,
        ]
        var counted: [Int] = []
        for y in 0 ..< dots.height {
            var purls = 0
            for x in 0 ..< dots.width where dots.symbol(x: x, y: y) == .purl {
                purls += 1
            }
            counted.append(purls)
        }
        XCTAssertEqual(counted, expected)
    }

    /// The chart draws the wrong side, so what the knitter sees on the front is
    /// the opposite of every cell. Getting this the wrong way round turns the
    /// simulation inside out.
    func testShadowKnitDotsShowTheOppositeOfTheChartedStitch() {
        guard let dots = shadowDots() else {
            return XCTFail("Shadow-knit dots is missing from the library")
        }
        XCTAssertEqual(dots.symbol(x: 0, y: 0), .purl)
        XCTAssertEqual(dots.rightSideAppearance(x: 0, y: 0), .knit)
        XCTAssertEqual(dots.symbol(x: 0, y: 1), .knit)
        XCTAssertEqual(dots.rightSideAppearance(x: 0, y: 1), .purl)

        var invertedEverywhere = true
        for y in 0 ..< dots.height {
            for x in 0 ..< dots.width {
                let charted: StitchSymbol = dots.symbol(x: x, y: y)
                let shown: StitchSymbol = dots.rightSideAppearance(x: x, y: y)
                if charted == .purl, shown == .knit { continue }
                if charted == .knit, shown == .purl { continue }
                invertedEverywhere = false
            }
        }
        XCTAssertTrue(invertedEverywhere, "every charted cell should show as its opposite")

        // A pattern charted from the right side shows exactly what it draws.
        let plain = sample()
        XCTAssertEqual(plain.rightSideAppearance(x: 0, y: 0), plain.symbol(x: 0, y: 0))
    }
}
