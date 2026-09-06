import XCTest
@testable import KnitStudio

final class ParserTests: XCTestCase {

    private func produced(_ text: String, from incoming: Int) -> Int? {
        WrittenPatternParser.evaluate(text, incoming: incoming).produced
    }

    private func issues(_ text: String, from incoming: Int) -> [String] {
        WrittenPatternParser.evaluate(text, incoming: incoming).issues
    }

    private func assertRow(
        _ text: String, from incoming: Int, gives expected: Int,
        clean: Bool = true, file: StaticString = #filePath, line: UInt = #line
    ) {
        let outcome = WrittenPatternParser.evaluate(text, incoming: incoming)
        XCTAssertEqual(outcome.produced, expected, text, file: file, line: line)
        if clean {
            XCTAssertTrue(
                outcome.issues.isEmpty,
                "\(text) → unexpected issues \(outcome.issues)", file: file, line: line)
        }
    }

    // MARK: - Plain rows

    func testPlainRows() {
        assertRow("knit to end", from: 96, gives: 96)
        assertRow("k to end", from: 96, gives: 96)
        assertRow("purl to end", from: 96, gives: 96)
        assertRow("k96", from: 96, gives: 96)
    }

    // MARK: - Repeats

    func testRibbingRepeats() {
        assertRow("*k2, p2; rep from * to end", from: 100, gives: 100)
        assertRow("k2, *p2, k2; rep from * to end", from: 102, gives: 102)
        assertRow("*k1, p1; rep from * to end", from: 64, gives: 64)
    }

    func testBracketRepeatsAreExpanded() {
        assertRow("[k10, k2tog] 8 times", from: 96, gives: 88)
        assertRow("[k4, k2tog] x 8", from: 48, gives: 40)
        assertRow("(k1, yo) 4 times, k to end", from: 20, gives: 24)
    }

    func testUnevenRepeatIsReported() {
        // 7-stitch repeat over 100 stitches leaves 2 over.
        let outcome = WrittenPatternParser.evaluate("*k2, p2, k3; rep from * to end", incoming: 100)
        XCTAssertEqual(outcome.produced, 98)
        XCTAssertTrue(outcome.issues.contains { $0.contains("does not divide evenly") })
    }

    // MARK: - Decreases and increases

    func testDecreaseRows() {
        assertRow("*k2tog; rep from * to end", from: 64, gives: 32)
        assertRow("*k3tog; rep from * to end", from: 30, gives: 10)
        assertRow("k1, *cdd, k1; rep from * to end", from: 41, gives: 21)
    }

    /// The classic paired shaping row. Getting the "to last N sts" bookkeeping
    /// wrong here miscounts every sleeve and every raglan.
    func testPairedShapingRow() {
        assertRow("k1, k2tog, k to last 3 sts, ssk, k1", from: 100, gives: 98)
        assertRow("k to last 3 sts, k2tog, k1", from: 50, gives: 49)
        assertRow("k1, m1l, k to last 1 st, m1r, k1", from: 40, gives: 42)
        assertRow("k2, kfb, k to last 3 sts, kfb, k2", from: 60, gives: 62)
    }

    func testLaceKeepsItsStitchCount() {
        assertRow("k1, *yo, k2tog; rep from * to last 1 st, k1", from: 50, gives: 50)
        assertRow("k3, yo, k to last 3 sts, yo, k3", from: 50, gives: 52)
        assertRow("*k1, yo; rep from * to end", from: 20, gives: 40)
    }

    // MARK: - Housekeeping instructions

    func testMarkersAndTurnsChangeNothing() {
        assertRow("k20, pm, k to end", from: 96, gives: 96)
        assertRow("sm, k to last 2 sts, k2tog", from: 48, gives: 47)
    }

    // MARK: - Cross-checks against the pattern's own numbers

    func testStatedCountIsChecked() {
        let good = WrittenPatternParser.evaluate("*k2, p2; rep from * to end (100 sts)", incoming: 100)
        XCTAssertEqual(good.produced, 100)
        XCTAssertTrue(good.issues.isEmpty)

        let bad = WrittenPatternParser.evaluate("*k2, p2; rep from * to end (99 sts)", incoming: 100)
        XCTAssertEqual(bad.produced, 100)
        XCTAssertTrue(bad.issues.contains { $0.contains("99") })
    }

    func testRowThatDoesNotUseAllTheStitchesIsReported() {
        let outcome = WrittenPatternParser.evaluate("k1, k2tog, k1", incoming: 100)
        XCTAssertEqual(outcome.produced, 3)
        XCTAssertTrue(outcome.issues.contains { $0.contains("100") })
    }

    func testMismatchedToLastIsReported() {
        let outcome = WrittenPatternParser.evaluate("k to last 3 sts, k2tog", incoming: 40)
        XCTAssertTrue(outcome.issues.contains { $0.contains("to last 3 sts") })
    }

    func testUnknownIncomingCountFallsBackToTheStatedNumber() {
        let outcome = WrittenPatternParser.evaluate("work in pattern (48 sts)", incoming: nil)
        XCTAssertEqual(outcome.produced, 48)
    }

    // MARK: - Gauge

    func testGaugeIsReadFromMetricAndImperialLines() {
        let metric = WrittenPatternParser.parseGauge("Gauge: 18 sts and 24 rows to 10 cm in stockinette")
        XCTAssertEqual(metric?.stitchesPer10cm ?? 0, 18, accuracy: 0.01)
        XCTAssertEqual(metric?.rowsPer10cm ?? 0, 24, accuracy: 0.01)

        let imperial = WrittenPatternParser.parseGauge("Gauge: 22 sts and 30 rows = 4 inches")
        XCTAssertEqual(imperial?.stitchesPer10cm ?? 0, 21.65, accuracy: 0.05)
        XCTAssertEqual(imperial?.rowsPer10cm ?? 0, 29.53, accuracy: 0.05)

        XCTAssertNil(WrittenPatternParser.parseGauge("A cosy hat for winter"))
    }

    func testCastOnIsRead() {
        XCTAssertEqual(WrittenPatternParser.parseCastOn("Cast on 96 sts."), 96)
        XCTAssertEqual(WrittenPatternParser.parseCastOn("CO 64 stitches"), 64)
        XCTAssertNil(WrittenPatternParser.parseCastOn("Work in the round"))
    }

    // MARK: - Whole patterns

    func testWholePatternThreadsTheStitchCountThroughEveryRow() {
        let text = """
        Simple Ribbed Hat
        Gauge: 18 sts and 24 rows to 10 cm in stockinette
        Yarn: 1 skein worsted, 100 g / 200 m
        Needles: 4.5 mm circular

        Cast on 96 sts and join in the round.
        Rnd 1: *k2, p2; rep from * to end
        Rnd 2: knit to end
        Rnd 3: *k10, k2tog; rep from * to end
        Rnd 4: knit to end
        """
        let pattern = WrittenPatternParser.parse(text)

        XCTAssertEqual(pattern.castOnStitches, 96)
        XCTAssertEqual(pattern.gauge?.stitchesPer10cm ?? 0, 18, accuracy: 0.01)
        XCTAssertEqual(pattern.rows.count, 4)
        XCTAssertEqual(pattern.rows[0].endingStitches, 96)
        XCTAssertEqual(pattern.rows[1].endingStitches, 96)
        XCTAssertEqual(pattern.rows[2].endingStitches, 88)   // 8 decreases
        XCTAssertEqual(pattern.rows[3].endingStitches, 88)
        XCTAssertEqual(pattern.verifiedRowCount, 4)
        XCTAssertFalse(pattern.yarnNotes.isEmpty)
        XCTAssertFalse(pattern.needleNotes.isEmpty)
    }

    func testRowSidesAreRead() {
        let pattern = WrittenPatternParser.parse("""
        Cast on 40 sts
        Row 1 (RS): knit to end
        Row 2 (WS): purl to end
        """)
        XCTAssertEqual(pattern.rows.count, 2)
        XCTAssertEqual(pattern.rows[0].side, "RS")
        XCTAssertEqual(pattern.rows[1].side, "WS")
        XCTAssertEqual(pattern.rows[0].label, "Row 1")
    }

    func testPatternWithNoRowsExplainsItself() {
        let pattern = WrittenPatternParser.parse("A lovely hat. Photographs by someone.")
        XCTAssertTrue(pattern.rows.isEmpty)
        XCTAssertTrue(pattern.issues.contains { $0.contains("No numbered rows") })
    }

    func testMissingCastOnIsExplained() {
        let pattern = WrittenPatternParser.parse("Rnd 1: knit to end")
        XCTAssertEqual(pattern.rows.count, 1)
        XCTAssertTrue(pattern.issues.contains { $0.contains("No cast-on") })
    }

    func testUnknownTermsAreCollectedNotSwallowed() {
        let pattern = WrittenPatternParser.parse("""
        Cast on 40 sts
        Row 1: k10, frobnicate, k to end
        """)
        XCTAssertTrue(pattern.unknownTerms.contains("frobnicate"))
    }

    func testParserDoesNotHangOnPathologicalInput() {
        // Deeply nested brackets are bounded by the expansion limit.
        let nasty = String(repeating: "[k1] 2 times, ", count: 40)
        let outcome = WrittenPatternParser.evaluate(nasty, incoming: 100)
        XCTAssertNotNil(outcome.produced)
    }

    func testEmptyInputIsHandled() {
        let pattern = WrittenPatternParser.parse("")
        XCTAssertTrue(pattern.rows.isEmpty)
        XCTAssertNil(pattern.castOnStitches)
    }
}
