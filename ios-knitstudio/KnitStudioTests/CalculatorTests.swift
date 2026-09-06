import XCTest
@testable import KnitStudio

/// Expected values here were derived from a reference implementation of the
/// same formulas and checked against published yardage ranges for each garment.
final class CalculatorTests: XCTestCase {

    private let dk = Gauge(stitchesPer10cm: 22, rowsPer10cm: 30)
    private let worsted = Gauge(stitchesPer10cm: 18, rowsPer10cm: 24)
    private let sockGauge = Gauge(stitchesPer10cm: 30, rowsPer10cm: 42)
    private let fingering = Gauge(stitchesPer10cm: 28, rowsPer10cm: 36)

    private func fact(_ plan: ProjectPlan, _ label: String) -> String? {
        plan.facts.first { $0.label == label }?.value
    }

    // MARK: - Hat

    func testHatMatchesReferenceNumbers() {
        let plan = HatCalculator.plan(
            gauge: worsted,
            measurements: BodyMeasurements(),      // head 56 cm
            options: ProjectOptions(),             // ease 8%, 8 sections, 5 cm brim, classic
            structure: .stockinette,
            units: .metric)

        XCTAssertEqual(fact(plan, "Cast on"), "96 sts")
        XCTAssertEqual(fact(plan, "Crown"), "22 rounds")
        XCTAssertEqual(fact(plan, "Total rounds"), "53")

        // Brim 12 rounds, body 19, crown 22.
        XCTAssertEqual(plan.sections.count, 3)
        XCTAssertEqual(plan.sections[0].totalRows, 12)
        XCTAssertEqual(plan.sections[1].totalRows, 19)
        XCTAssertEqual(plan.sections[2].totalRows, 22)

        XCTAssertEqual(plan.totalStitches, 4120, accuracy: 0.5)
    }

    /// A crown that decreases every other round is what real hat patterns do;
    /// the schedule is derived from the geometry, not hard-coded.
    func testHatCrownDepthMatchesItsGeometry() {
        for gauge in [worsted, dk, fingering] {
            let plan = HatCalculator.plan(
                gauge: gauge, measurements: BodyMeasurements(), options: ProjectOptions(),
                structure: .stockinette, units: .metric)
            let crownRounds = plan.sections[2].totalRows
            let crownDepth = Double(crownRounds) * gauge.rowHeight

            // Brim circumference with the default 8% negative ease.
            let brim = 56.0 * 0.92
            let radius = brim / (2 * Double.pi)
            // Between a flat disc and a hemisphere.
            XCTAssertGreaterThan(crownDepth, radius * 0.8)
            XCTAssertLessThan(crownDepth, radius * Double.pi / 2)
        }
    }

    func testHatYarnLandsInOneSkeinTerritory() {
        let plan = HatCalculator.plan(
            gauge: worsted, measurements: BodyMeasurements(), options: ProjectOptions(),
            structure: .stockinette, units: .metric)
        let yarn = Yarn(name: "W", hex: "808080", weight: .medium, ballGrams: 100, ballMetres: 200)
        let grams = YarnEstimator.grams(metres: plan.metres(), yarn: yarn)
        XCTAssertGreaterThan(grams, 35)
        XCTAssertLessThan(grams, 90)
    }

    func testHatCastOnAlwaysDividesIntoCrownSections() {
        for sections in [4, 6, 8, 10, 12] {
            for head in stride(from: 44.0, through: 62.0, by: 2.0) {
                var measurements = BodyMeasurements()
                measurements.headCircumference = head
                var options = ProjectOptions()
                options.crownSections = sections
                let plan = HatCalculator.plan(
                    gauge: dk, measurements: measurements, options: options,
                    structure: .stockinette, units: .metric)
                guard let castOnText = fact(plan, "Cast on"),
                      let castOn = Int(castOnText.replacingOccurrences(of: " sts", with: ""))
                else { return XCTFail("no cast-on fact") }
                XCTAssertEqual(
                    castOn % sections, 0,
                    "\(castOn) sts does not divide into \(sections) sections")
            }
        }
    }

    // MARK: - Raglan sweater

    func testRaglanMatchesReferenceNumbers() {
        let plan = RaglanSweaterCalculator.plan(
            gauge: dk,
            measurements: BodyMeasurements(),   // chest 100, neck 38, upper arm 34
            options: ProjectOptions(),          // 8% ease, 2-st raglan
            structure: .stockinette,
            units: .metric)

        XCTAssertEqual(fact(plan, "Neck cast-on"), "84 sts")
        XCTAssertEqual(fact(plan, "Increase rounds"), "40")
        XCTAssertEqual(fact(plan, "Body at underarm"), "236 sts")
        XCTAssertEqual(fact(plan, "Sleeve at underarm"), "74 sts")

        // Yoke 63 rounds, body 123, sleeves 135.
        XCTAssertEqual(plan.sections[0].totalRows, 63)
        XCTAssertEqual(plan.sections[2].totalRows, 123)
        XCTAssertEqual(plan.sections[3].totalRows, 135)

        XCTAssertEqual(plan.totalStitches, 58668, accuracy: 1)
    }

    /// The body must actually come out the size that was asked for.
    func testRaglanHitsTheRequestedChest() {
        for gauge in [dk, worsted, fingering] {
            for chest in [82.0, 100.0, 122.0] {
                var measurements = BodyMeasurements()
                measurements.chest = chest
                let plan = RaglanSweaterCalculator.plan(
                    gauge: gauge, measurements: measurements, options: ProjectOptions(),
                    structure: .stockinette, units: .metric)
                guard let text = fact(plan, "Body at underarm"),
                      let stitches = Int(text.replacingOccurrences(of: " sts", with: ""))
                else { return XCTFail("no body fact") }
                let finished = gauge.width(forStitches: Double(stitches))
                XCTAssertEqual(
                    finished, chest * 1.08, accuracy: 2.0,
                    "chest \(chest) at \(gauge.stitchesPer10cm) sts came out \(finished)")
            }
        }
    }

    /// The whole point of the compound raglan: sleeves that fit the arm.
    /// A single-rate raglan gives a 47 cm sleeve for a 34 cm arm.
    func testRaglanSleeveFitsTheUpperArm() {
        for gauge in [dk, worsted, fingering] {
            let measurements = BodyMeasurements()
            let plan = RaglanSweaterCalculator.plan(
                gauge: gauge, measurements: measurements, options: ProjectOptions(),
                structure: .stockinette, units: .metric)
            guard let text = fact(plan, "Sleeve at underarm"),
                  let stitches = Int(text.replacingOccurrences(of: " sts", with: ""))
            else { return XCTFail("no sleeve fact") }
            let width = gauge.width(forStitches: Double(stitches))
            XCTAssertEqual(
                width, measurements.upperArm, accuracy: 1.5,
                "sleeve came out \(width) cm for a \(measurements.upperArm) cm arm")
        }
        // And no fit warning should be raised in the normal case.
        let plan = RaglanSweaterCalculator.plan(
            gauge: dk, measurements: BodyMeasurements(), options: ProjectOptions(),
            structure: .stockinette, units: .metric)
        XCTAssertTrue(plan.warnings.isEmpty, "unexpected warnings: \(plan.warnings)")
    }

    /// The yoke has to be as deep as the armhole, no more and no less.
    func testRaglanYokeDepthMatchesArmhole() {
        for gauge in [dk, worsted, fingering] {
            for chest in [82.0, 100.0, 122.0] {
                var measurements = BodyMeasurements()
                measurements.chest = chest
                let plan = RaglanSweaterCalculator.plan(
                    gauge: gauge, measurements: measurements, options: ProjectOptions(),
                    structure: .stockinette, units: .metric)
                let yokeDepth = Double(plan.sections[0].totalRows) * gauge.rowHeight
                XCTAssertEqual(
                    yokeDepth, chest * 0.21, accuracy: gauge.rowHeight + 0.01,
                    "yoke \(yokeDepth) vs armhole \(chest * 0.21)")
            }
        }
    }

    func testRaglanYarnMatchesPublishedRanges() {
        // Adult M pullover, DK: commonly quoted at 400–500 g.
        let plan = RaglanSweaterCalculator.plan(
            gauge: dk, measurements: BodyMeasurements(), options: ProjectOptions(),
            structure: .stockinette, units: .metric)
        let yarn = Yarn(name: "DK", hex: "808080", weight: .light, ballGrams: 50, ballMetres: 125)
        let grams = YarnEstimator.grams(metres: plan.metres(), yarn: yarn)
        XCTAssertGreaterThan(grams, 340)
        XCTAssertLessThan(grams, 560)
    }

    // MARK: - Socks

    func testSockMatchesReferenceNumbers() {
        var options = ProjectOptions()
        options.ease = 0.10
        let plan = SockCalculator.plan(
            gauge: sockGauge,
            measurements: BodyMeasurements(),   // foot 23 cm around, 24 cm long
            options: options,
            structure: .stockinette,
            units: .metric)

        XCTAssertEqual(fact(plan, "Cast on"), "64 sts")
        XCTAssertEqual(fact(plan, "Heel flap"), "32 rows")
        XCTAssertEqual(fact(plan, "Gusset pick-up"), "17 sts each side")
        XCTAssertEqual(fact(plan, "Toe"), "12 decrease rounds")

        // Totals are for a pair.
        XCTAssertEqual(plan.totalStitches, 23504, accuracy: 1)
    }

    func testSockCastOnIsAlwaysAMultipleOfFour() {
        for circumference in stride(from: 16.0, through: 30.0, by: 0.5) {
            var measurements = BodyMeasurements()
            measurements.footCircumference = circumference
            let plan = SockCalculator.plan(
                gauge: sockGauge, measurements: measurements, options: ProjectOptions(),
                structure: .stockinette, units: .metric)
            guard let text = fact(plan, "Cast on"),
                  let castOn = Int(text.replacingOccurrences(of: " sts", with: ""))
            else { return XCTFail("no cast-on fact") }
            XCTAssertEqual(castOn % 4, 0, "\(castOn) sts is not divisible by 4")
        }
    }

    func testSockPairUsesAboutOneSkein() {
        var options = ProjectOptions()
        options.ease = 0.10
        let plan = SockCalculator.plan(
            gauge: sockGauge, measurements: BodyMeasurements(), options: options,
            structure: .stockinette, units: .metric)
        let yarn = Yarn(name: "Sock", hex: "808080", weight: .superFine, ballGrams: 100, ballMetres: 400)
        let grams = YarnEstimator.grams(metres: plan.metres(), yarn: yarn)
        XCTAssertGreaterThan(grams, 60)
        XCTAssertLessThan(grams, 105)
    }

    // MARK: - Shawl

    func testShawlMatchesReferenceNumbers() {
        let plan = ShawlCalculator.plan(
            gauge: fingering,
            options: ProjectOptions(),   // wingspan 180, 4 increases per RS row
            structure: .garter,
            units: .metric)

        XCTAssertEqual(fact(plan, "Final stitches"), "504")
        XCTAssertEqual(fact(plan, "Rows"), "252")
        XCTAssertEqual(plan.totalStitches, 63882, accuracy: 1)
    }

    // MARK: - Flat pieces and cowls

    func testScarfIsASimpleRectangle() {
        var options = ProjectOptions()
        options.width = 20
        options.length = 150
        options.edgeStitches = 0
        let plan = FlatPieceCalculator.plan(
            kind: .scarf, gauge: worsted, options: options, structure: .garter, units: .metric)

        // 20 cm at 18 sts/10 cm = 36 sts; 150 cm at 24 rows/10 cm = 360 rows.
        XCTAssertEqual(fact(plan, "Cast on"), "36 sts")
        XCTAssertEqual(fact(plan, "Rows"), "360")
        XCTAssertEqual(plan.totalStitches, 36 * 360, accuracy: 0.5)
    }

    /// Garter edges live inside the requested width, so asking for 20 cm gives
    /// a 20 cm scarf whether or not it has a border.
    func testEdgeStitchesCountTowardsTheFinishedWidth() {
        var options = ProjectOptions()
        options.width = 20
        options.length = 100
        options.edgeStitches = 4
        let plan = FlatPieceCalculator.plan(
            kind: .scarf, gauge: worsted, options: options, structure: .stockinette, units: .metric)
        XCTAssertEqual(fact(plan, "Cast on"), "36 sts")
        XCTAssertEqual(
            plan.facts.first { $0.label == "Cast on" }?.detail,
            "28 pattern sts + 8 edge sts")
        XCTAssertEqual(fact(plan, "Finished width"), "20.0 cm")
    }

    func testCowlRespectsItsStitchRepeat() {
        var options = ProjectOptions()
        options.cowlCircumference = 62
        options.cowlHeight = 28
        options.stitchMultiple = 4
        let plan = CowlCalculator.plan(
            gauge: worsted, options: options, structure: .ribbing, units: .metric)
        guard let text = fact(plan, "Cast on"),
              let castOn = Int(text.replacingOccurrences(of: " sts", with: ""))
        else { return XCTFail("no cast-on fact") }
        XCTAssertEqual(castOn % 4, 0)
    }

    func testNarrowCowlWarnsAboutGettingItOverYourHead() {
        var options = ProjectOptions()
        options.cowlCircumference = 44
        let plan = CowlCalculator.plan(
            gauge: worsted, options: options, structure: .stockinette, units: .metric)
        XCTAssertTrue(plan.warnings.contains { $0.contains("over the head") })
    }

    // MARK: - Cross-cutting

    /// No project should ever produce a plan with no steps, a zero stitch
    /// count, or a negative number anywhere in it.
    func testEveryPatternKindProducesAUsablePlan() {
        for kind in PatternKind.allCases {
            for gauge in [fingering, dk, worsted] {
                let plan = kind.makePlan(
                    gauge: gauge,
                    measurements: BodyMeasurements(),
                    options: ProjectOptions(),
                    structure: .stockinette,
                    units: .metric)
                XCTAssertFalse(plan.sections.isEmpty, "\(kind.name) has no sections")
                XCTAssertFalse(plan.facts.isEmpty, "\(kind.name) has no facts")
                XCTAssertGreaterThan(plan.totalStitches, 0, "\(kind.name) has no stitches")
                XCTAssertGreaterThan(plan.metres(), 0, "\(kind.name) needs no yarn")
                for section in plan.sections {
                    XCTAssertFalse(section.steps.isEmpty, "\(kind.name)/\(section.name) has no steps")
                    for step in section.steps {
                        XCTAssertGreaterThanOrEqual(step.stitchCount ?? 0, 0)
                        XCTAssertGreaterThanOrEqual(step.rows ?? 0, 0)
                    }
                }
            }
        }
    }

    func testExtremeSizesDoNotBreakTheCalculators() {
        var tiny = BodyMeasurements()
        tiny.chest = 40
        tiny.headCircumference = 30
        tiny.footCircumference = 12
        tiny.footLength = 12
        tiny.handCircumference = 10
        tiny.handLength = 10

        var huge = BodyMeasurements()
        huge.chest = 160
        huge.headCircumference = 70
        huge.footCircumference = 34
        huge.footLength = 34
        huge.handCircumference = 30
        huge.handLength = 26

        for measurements in [tiny, huge] {
            for kind in PatternKind.allCases {
                let plan = kind.makePlan(
                    gauge: Gauge(stitchesPer10cm: 12, rowsPer10cm: 16),
                    measurements: measurements,
                    options: ProjectOptions(),
                    structure: .stockinette,
                    units: .metric)
                XCTAssertGreaterThan(plan.totalStitches, 0, "\(kind.name) collapsed")
                XCTAssertFalse(plan.totalStitches.isNaN, "\(kind.name) produced NaN")
            }
        }
    }

    func testPlainTextExportContainsTheKeyNumbers() {
        let plan = HatCalculator.plan(
            gauge: worsted, measurements: BodyMeasurements(), options: ProjectOptions(),
            structure: .stockinette, units: .metric)
        let text = plan.plainText(units: .metric)
        XCTAssertTrue(text.contains("96 sts"))
        XCTAssertTrue(text.contains("BRIM"))
        XCTAssertTrue(text.contains("CROWN"))
    }
}
