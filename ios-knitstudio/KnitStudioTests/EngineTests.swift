import XCTest
@testable import KnitStudio

/// Gauge, shaping arithmetic and the yarn model.
final class EngineTests: XCTestCase {

    // MARK: - Gauge

    func testGaugeConversions() {
        let gauge = Gauge(stitchesPer10cm: 22, rowsPer10cm: 30)
        XCTAssertEqual(gauge.stitchWidth, 10.0 / 22, accuracy: 1e-9)
        XCTAssertEqual(gauge.rowHeight, 10.0 / 30, accuracy: 1e-9)
        XCTAssertEqual(gauge.stitches(forWidth: 50), 110, accuracy: 1e-9)
        XCTAssertEqual(gauge.rows(forLength: 20), 60, accuracy: 1e-9)
        XCTAssertEqual(gauge.width(forStitches: 110), 50, accuracy: 1e-9)
        XCTAssertEqual(gauge.length(forRows: 60), 20, accuracy: 1e-9)
    }

    func testGaugeFromSwatchNormalisesToTenCentimetres() {
        // 28 sts over 4 inches (10.16 cm) is a fingering gauge.
        let gauge = Gauge.fromSwatch(stitches: 28, rows: 36, overCm: 10.16)
        XCTAssertEqual(gauge.stitchesPer10cm, 27.559, accuracy: 0.001)
        XCTAssertEqual(gauge.rowsPer10cm, 35.433, accuracy: 0.001)
    }

    /// Loop length drives every yarn estimate, so pin the exact values.
    func testLoopLengthMatchesMundenModel() {
        XCTAssertEqual(Gauge(stitchesPer10cm: 22, rowsPer10cm: 30).loopLength, 1.696970, accuracy: 1e-6)
        XCTAssertEqual(Gauge(stitchesPer10cm: 18, rowsPer10cm: 24).loopLength, 2.097222, accuracy: 1e-6)
        XCTAssertEqual(Gauge(stitchesPer10cm: 30, rowsPer10cm: 42).loopLength, 1.228571, accuracy: 1e-6)
    }

    /// A knitted loop is always several times longer than the stitch is wide.
    func testLoopLengthStaysInProportionAcrossWeights() {
        for weight in YarnWeight.allCases where weight != .jumbo {
            let gauge = weight.nominalGauge
            let ratio = gauge.loopLength / gauge.stitchWidth
            XCTAssertGreaterThan(ratio, 3.0, "\(weight.name) loop/width ratio too small")
            XCTAssertLessThan(ratio, 4.6, "\(weight.name) loop/width ratio too large")
            XCTAssertTrue(gauge.looksPlausible, "\(weight.name) nominal gauge flagged implausible")
        }
    }

    func testImplausibleGaugeIsFlagged() {
        // Stitches and rows entered the wrong way round.
        XCTAssertFalse(Gauge(stitchesPer10cm: 40, rowsPer10cm: 6).looksPlausible)
    }

    // MARK: - Rounding

    func testRoundToMultiple() {
        XCTAssertEqual(Shaping.roundToMultiple(103, multiple: 8), 104)
        XCTAssertEqual(Shaping.roundToMultiple(103, multiple: 8, offset: 1), 105)
        XCTAssertEqual(Shaping.roundToMultiple(100, multiple: 4), 100)
        XCTAssertEqual(Shaping.roundToMultiple(7.4, multiple: 1), 7)
        // Never rounds away to nothing.
        XCTAssertEqual(Shaping.roundToMultiple(2, multiple: 8), 8)
        XCTAssertEqual(Shaping.roundToMultiple(0, multiple: 4), 4)
    }

    // MARK: - Even distribution

    func testDistributeEvenlySplitsRemainder() {
        let result = Shaping.distributeEvenly(count: 8, over: 100)
        XCTAssertNotNil(result)
        guard let result else { return }
        XCTAssertEqual(result.segments, [13, 13, 13, 13, 12, 12, 12, 12])
        XCTAssertEqual(result.totalStitches, 100)
        XCTAssertEqual(result.shapingPoints, 8)
        XCTAssertEqual(result.base, 12)
        XCTAssertEqual(result.longGaps, 4)
    }

    func testDistributeEvenlyExactDivision() {
        let result = Shaping.distributeEvenly(count: 7, over: 63)
        XCTAssertEqual(result?.base, 9)
        XCTAssertEqual(result?.longGaps, 0)
        XCTAssertEqual(result?.totalStitches, 63)
    }

    /// However the numbers fall, the gaps must add back up to the row.
    func testDistributeEvenlyAlwaysConserversStitches() {
        for over in stride(from: 10, through: 240, by: 7) {
            for count in [2, 3, 5, 8, 11] where count <= over {
                let result = Shaping.distributeEvenly(count: count, over: over)
                XCTAssertEqual(result?.totalStitches, over, "count \(count) over \(over)")
                XCTAssertEqual(result?.shapingPoints, count, "count \(count) over \(over)")
            }
        }
    }

    func testDistributeEvenlyRefusesImpossibleShaping() {
        XCTAssertNil(Shaping.distributeEvenly(count: 20, over: 10))
        XCTAssertEqual(Shaping.distributeEvenly(count: 0, over: 40)?.segments, [])
    }

    func testSpreadRowsIsStrictlyIncreasing() {
        let rows = Shaping.spreadRows(events: 6, over: 40)
        XCTAssertEqual(rows.count, 6)
        XCTAssertEqual(rows.last, 40)
        for (a, b) in zip(rows, rows.dropFirst()) {
            XCTAssertLessThan(a, b)
        }
        // More events than rows still produces distinct row numbers.
        let crowded = Shaping.spreadRows(events: 5, over: 4)
        XCTAssertEqual(Set(crowded).count, crowded.count)
    }

    func testOrdinals() {
        XCTAssertEqual(Shaping.ordinal(1), "1st")
        XCTAssertEqual(Shaping.ordinal(2), "2nd")
        XCTAssertEqual(Shaping.ordinal(3), "3rd")
        XCTAssertEqual(Shaping.ordinal(4), "4th")
        XCTAssertEqual(Shaping.ordinal(11), "11th")
        XCTAssertEqual(Shaping.ordinal(12), "12th")
        XCTAssertEqual(Shaping.ordinal(13), "13th")
        XCTAssertEqual(Shaping.ordinal(21), "21st")
    }

    // MARK: - Yarn

    func testTechniqueFactorsAppliedToBlocks() {
        let gauge = Gauge(stitchesPer10cm: 22, rowsPer10cm: 30)
        let plain = YarnEstimator.metres(
            for: [StitchBlock("a", stitches: 10_000)], gauge: gauge)
        let stranded = YarnEstimator.metres(
            for: [StitchBlock("a", stitches: 10_000, structure: .strandedColourwork)], gauge: gauge)
        XCTAssertEqual(stranded / plain, 1.18, accuracy: 1e-9)

        let brioche = YarnEstimator.metres(
            for: [StitchBlock("a", stitches: 10_000, structure: .brioche)], gauge: gauge)
        XCTAssertEqual(brioche / plain, 1.85, accuracy: 1e-9)

        // Lace has holes in it, so it goes further than stockinette.
        let lace = YarnEstimator.metres(
            for: [StitchBlock("a", stitches: 10_000, structure: .lace)], gauge: gauge)
        XCTAssertLessThan(lace, plain)
    }

    func testBallsRoundUpAndIncludeMargin() {
        let dk = Yarn(name: "DK", hex: "112233", weight: .light, ballGrams: 50, ballMetres: 125)
        // 1149 m + 10% = 1263.9 m, over 125 m balls = 10.1 -> 11.
        XCTAssertEqual(YarnEstimator.balls(metres: 1149, yarn: dk), 11)
        // Exactly one ball's worth still needs one ball.
        XCTAssertEqual(YarnEstimator.balls(metres: 10, yarn: dk), 1)
        // No margin means no rounding cushion beyond the ceiling.
        XCTAssertEqual(YarnEstimator.balls(metres: 250, yarn: dk, safetyMargin: 0), 2)
    }

    func testGramsFromMetres() {
        let worsted = Yarn(name: "W", hex: "112233", weight: .medium, ballGrams: 100, ballMetres: 200)
        XCTAssertEqual(YarnEstimator.grams(metres: 900, yarn: worsted), 450, accuracy: 1e-9)
    }

    /// Fabric weight per square metre is the best structural check on the yarn
    /// model: it must land in the range real knitted fabric occupies, and
    /// heavier yarn must make heavier fabric.
    ///
    /// Adjacent categories are *not* asserted to be strictly ordered — with the
    /// standard ball bands, DK and worsted both work out at 453 g/m², so only
    /// the ends of the range are meaningfully separated.
    func testArealDensityIsRealisticForEachYarnWeight() {
        func density(_ weight: YarnWeight) -> Double {
            let ball = weight.typicalBall
            let yarn = Yarn(
                name: weight.name, hex: "808080", weight: weight,
                ballGrams: ball.grams, ballMetres: ball.metres)
            return YarnEstimator.arealDensity(gauge: weight.nominalGauge, yarn: yarn)
        }

        let cases: [(YarnWeight, Double, Double)] = [
            (.superFine, 300, 420),
            (.light, 380, 500),
            (.medium, 400, 520),
            (.bulky, 440, 580),
        ]
        for (weight, low, high) in cases {
            let value = density(weight)
            XCTAssertGreaterThan(value, low, "\(weight.name) too light per m²")
            XCTAssertLessThan(value, high, "\(weight.name) too heavy per m²")
        }
        XCTAssertGreaterThan(
            density(.bulky), density(.superFine) + 50,
            "bulky fabric should be clearly heavier per m² than fingering")
    }

    func testYarnHexNormalisation() {
        XCTAssertEqual(Yarn.normalise(hex: "#ab12CD"), "AB12CD")
        XCTAssertEqual(Yarn.normalise(hex: "abc"), "AABBCC")
        XCTAssertEqual(Yarn.normalise(hex: "nonsense"), "9E9E9E")
        XCTAssertEqual(Yarn.normalise(hex: ""), "9E9E9E")
    }

    func testYarnWeightMatchesGauge() {
        XCTAssertEqual(YarnWeight.matching(gauge: Gauge(stitchesPer10cm: 22, rowsPer10cm: 30)), .light)
        XCTAssertEqual(YarnWeight.matching(gauge: Gauge(stitchesPer10cm: 18, rowsPer10cm: 24)), .medium)
        XCTAssertEqual(YarnWeight.matching(gauge: Gauge(stitchesPer10cm: 30, rowsPer10cm: 42)), .superFine)
        XCTAssertEqual(YarnWeight.matching(gauge: Gauge(stitchesPer10cm: 13, rowsPer10cm: 17)), .bulky)
    }

    // MARK: - Units

    func testUnitConversion() {
        XCTAssertEqual(UnitSystem.imperial.fromCentimetres(25.4), 10, accuracy: 1e-9)
        XCTAssertEqual(UnitSystem.imperial.toCentimetres(10), 25.4, accuracy: 1e-9)
        XCTAssertEqual(UnitSystem.metric.fromCentimetres(25.4), 25.4, accuracy: 1e-9)
    }
}
