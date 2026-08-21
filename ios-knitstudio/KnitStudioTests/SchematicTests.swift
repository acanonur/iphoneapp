import XCTest
@testable import KnitStudio

/// The schematic is drawn from the finished measurements a calculator worked
/// out, so there are two things to check: that the metrics agree with the plan
/// the knitter reads, and that the shapes drawn from them are legible.
final class SchematicTests: XCTestCase {

    private let worsted = Gauge(stitchesPer10cm: 18, rowsPer10cm: 24)
    private let dk = Gauge(stitchesPer10cm: 22, rowsPer10cm: 30)
    private let fingering = Gauge(stitchesPer10cm: 28, rowsPer10cm: 36)

    // MARK: - Helpers

    private func plan(for kind: PatternKind, gauge: Gauge) -> ProjectPlan {
        return kind.makePlan(
            gauge: gauge,
            measurements: BodyMeasurements(),
            options: ProjectOptions(),
            structure: .stockinette,
            units: .metric)
    }

    private func schematic(for kind: PatternKind, gauge: Gauge) -> GarmentSchematic {
        let metrics = plan(for: kind, gauge: gauge).metrics
        return GarmentSchematic.make(kind: kind, metrics: metrics, options: ProjectOptions())
    }

    /// The cast-on as the facts state it. Every calculator labels it either
    /// "Cast on" or, for the top-down sweater, "Neck cast-on".
    private func castOnFact(_ made: ProjectPlan) -> Int? {
        let match = made.facts.first { (fact: PlanFact) in
            let label = fact.label.lowercased()
            return label.contains("cast on") || label.contains("cast-on")
        }
        guard let value = match?.value else { return nil }
        let digits = value.prefix { (character: Character) in character.isNumber }
        return Int(String(digits))
    }

    private func firstStepText(_ made: ProjectPlan) -> String {
        guard let section = made.sections.first else { return "" }
        guard let step = section.steps.first else { return "" }
        return step.text
    }

    private func extent(
        of points: [SchematicPoint]
    ) -> (minX: Double, maxX: Double, minY: Double, maxY: Double)? {
        guard let first = points.first else { return nil }
        var minX = first.x
        var maxX = first.x
        var minY = first.y
        var maxY = first.y
        for point in points {
            minX = min(minX, point.x)
            maxX = max(maxX, point.x)
            minY = min(minY, point.y)
            maxY = max(maxY, point.y)
        }
        return (minX: minX, maxX: maxX, minY: minY, maxY: maxY)
    }

    // MARK: - Cast-on

    /// Worked through by hand from each calculator at 18 sts × 24 rows / 10 cm
    /// with the default measurements and options.
    private let castOnAtWorsted: [(kind: PatternKind, castOn: Int)] = [
        (kind: .scarf, castOn: 45),
        (kind: .blanket, castOn: 45),
        (kind: .cowl, castOn: 108),
        (kind: .hat, castOn: 96),
        (kind: .raglanSweater, castOn: 68),
        (kind: .sock, castOn: 40),
        (kind: .mitten, castOn: 32),
        (kind: .shawl, castOn: 3),
    ]

    func testCastOnMetricsMatchTheVerifiedNumbers() {
        XCTAssertEqual(
            castOnAtWorsted.count, PatternKind.allCases.count,
            "a project type has been added without a verified cast-on")

        for expected in castOnAtWorsted {
            let metrics = plan(for: expected.kind, gauge: worsted).metrics
            XCTAssertEqual(
                metrics.castOnStitches, expected.castOn,
                "\(expected.kind.name) cast on \(metrics.castOnStitches) sts")
        }
    }

    /// The number in the metrics is the number the schematic is scaled from, so
    /// it has to be the same one the facts quote and the first step tells the
    /// knitter to cast on.
    func testCastOnMetricMatchesTheFactsAndTheFirstStep() {
        for kind in PatternKind.allCases {
            for gauge in [worsted, dk, fingering] {
                let made = plan(for: kind, gauge: gauge)
                let castOn = made.metrics.castOnStitches
                XCTAssertGreaterThan(castOn, 0, "\(kind.name) records no cast-on")

                guard let stated = castOnFact(made) else {
                    XCTFail("\(kind.name) has no cast-on fact")
                    continue
                }
                XCTAssertEqual(
                    stated, castOn,
                    "\(kind.name) states \(stated) sts but records \(castOn)")

                let text = firstStepText(made).lowercased()
                XCTAssertTrue(
                    text.contains("cast on \(castOn) sts"),
                    "\(kind.name) first step does not cast on \(castOn) sts: \(text)")
            }
        }
    }

    // MARK: - Pieces

    func testEveryPatternKindDrawsAtLeastOnePiece() {
        for kind in PatternKind.allCases {
            let drawn = schematic(for: kind, gauge: worsted)
            XCTAssertFalse(drawn.pieces.isEmpty, "\(kind.name) draws nothing")
            XCTAssertEqual(drawn.note, GarmentSchematic.standardNote, "\(kind.name)")
            for piece in drawn.pieces {
                XCTAssertFalse(piece.name.isEmpty, "\(kind.name) has an unnamed piece")
                XCTAssertGreaterThanOrEqual(piece.quantity, 1, "\(kind.name)/\(piece.name)")
            }
        }
    }

    /// A polygon needs three corners before it is a shape at all, and a piece
    /// with no width or no height would draw as a line.
    func testEveryOutlineIsANonDegenerateShape() {
        for kind in PatternKind.allCases {
            for gauge in [worsted, dk, fingering] {
                let drawn = schematic(for: kind, gauge: gauge)
                for piece in drawn.pieces {
                    let place = "\(kind.name)/\(piece.name)"
                    XCTAssertGreaterThanOrEqual(piece.outline.count, 3, "\(place) is not a polygon")
                    let box = piece.boundingBox
                    XCTAssertGreaterThan(box.width, 0, "\(place) has no width")
                    XCTAssertGreaterThan(box.height, 0, "\(place) has no height")
                    for point in piece.outline {
                        XCTAssertFalse(point.x.isNaN, "\(place) has a NaN x")
                        XCTAssertFalse(point.y.isNaN, "\(place) has a NaN y")
                    }
                }
            }
        }
    }

    func testEveryDimensionCarriesALabel() {
        for kind in PatternKind.allCases {
            for gauge in [worsted, dk, fingering] {
                let drawn = schematic(for: kind, gauge: gauge)
                for piece in drawn.pieces {
                    XCTAssertFalse(
                        piece.dimensions.isEmpty,
                        "\(kind.name)/\(piece.name) has no measurements on it")
                    for dimension in piece.dimensions {
                        XCTAssertFalse(
                            dimension.text.isEmpty,
                            "\(kind.name)/\(piece.name) has an unlabelled measurement")
                    }
                }
            }
        }
    }

    /// Guides are fold lines and shaping lines drawn inside the piece, so one
    /// falling outside the outline means the wrong measurement reached it.
    func testGuidesStayInsideTheirPiece() {
        let tolerance: Double = 0.001
        for kind in PatternKind.allCases {
            let drawn = schematic(for: kind, gauge: worsted)
            for piece in drawn.pieces {
                guard let box = extent(of: piece.outline) else {
                    XCTFail("\(kind.name)/\(piece.name) has an empty outline")
                    continue
                }
                for guide in piece.guides {
                    for point in guide {
                        let place = "\(kind.name)/\(piece.name)"
                        XCTAssertGreaterThanOrEqual(point.x, box.minX - tolerance, "\(place) guide x")
                        XCTAssertLessThanOrEqual(point.x, box.maxX + tolerance, "\(place) guide x")
                        XCTAssertGreaterThanOrEqual(point.y, box.minY - tolerance, "\(place) guide y")
                        XCTAssertLessThanOrEqual(point.y, box.maxY + tolerance, "\(place) guide y")
                    }
                }
            }
        }
    }

    // MARK: - Individual projects

    /// A hat is a tube: laid flat it is half the way round, and it stands as
    /// tall as the body and crown together.
    func testHatIsDrawnAsHalfItsCircumference() {
        for gauge in [worsted, dk, fingering] {
            let metrics = plan(for: .hat, gauge: gauge).metrics
            let drawn = GarmentSchematic.make(
                kind: .hat, metrics: metrics, options: ProjectOptions())
            guard let piece = drawn.pieces.first else {
                XCTFail("no hat piece at \(gauge.stitchesPer10cm) sts")
                continue
            }
            guard let circumference = metrics.circumference else {
                XCTFail("the hat plan records no circumference")
                continue
            }
            XCTAssertEqual(
                piece.boundingBox.width, circumference / 2, accuracy: 0.1,
                "flattened hat is \(piece.boundingBox.width) cm across")

            let bodyDepth: Double = metrics.bodyDepth ?? 0
            let crownDepth: Double = metrics.crownDepth ?? 0
            XCTAssertEqual(
                piece.boundingBox.height, bodyDepth + crownDepth, accuracy: 0.1,
                "hat height does not match the body and crown")
        }
    }

    func testRaglanHasABodyTwoSleevesAndANeckband() {
        let drawn = schematic(for: .raglanSweater, gauge: dk)

        let bodies = drawn.pieces.filter { (piece: SchematicPiece) in
            piece.name.contains("Body")
        }
        XCTAssertEqual(bodies.count, 1, "expected one body piece")

        let sleeves = drawn.pieces.filter { (piece: SchematicPiece) in
            piece.name.contains("Sleeve")
        }
        let sleeveCount = sleeves.reduce(0) { (total: Int, piece: SchematicPiece) in
            total + max(1, piece.quantity)
        }
        XCTAssertEqual(sleeveCount, 2, "a sweater needs two sleeves")

        let neckbands = drawn.pieces.filter { (piece: SchematicPiece) in
            piece.name.contains("Neckband")
        }
        XCTAssertEqual(neckbands.count, 1, "expected one neckband")

        // The raglan lines and the underarm are drawn inside the body.
        guard let body = bodies.first else { return XCTFail("no body piece") }
        XCTAssertGreaterThanOrEqual(body.guides.count, 3, "body has no raglan lines")
    }

    // MARK: - Edges

    /// Before a plan has been worked out there is nothing to draw, and drawing
    /// nothing is the right answer — but it must not be a broken shape.
    func testEmptyMetricsDrawNothingRatherThanCrashing() {
        for kind in PatternKind.allCases {
            let drawn = GarmentSchematic.make(
                kind: kind, metrics: PlanMetrics(), options: ProjectOptions())
            if drawn.pieces.isEmpty {
                XCTAssertEqual(drawn.note, GarmentSchematic.emptyNote, "\(kind.name)")
                continue
            }
            for piece in drawn.pieces {
                let box = piece.boundingBox
                XCTAssertGreaterThanOrEqual(piece.outline.count, 3, "\(kind.name)/\(piece.name)")
                XCTAssertGreaterThan(box.width, 0, "\(kind.name)/\(piece.name) has no width")
                XCTAssertGreaterThan(box.height, 0, "\(kind.name)/\(piece.name) has no height")
            }
        }
    }

    // MARK: - Round trip

    /// A saved project routes through `PatternKind.makePlan`, so the metrics it
    /// hands the schematic must be the same ones the calculator produced.
    func testMetricsSurviveTheRoundTripThroughASavedProject() {
        for kind in PatternKind.allCases {
            let project = SavedProject(name: "Round trip", kind: kind, gauge: worsted)
            let direct = plan(for: kind, gauge: worsted)
            XCTAssertEqual(
                project.plan(units: .metric).metrics, direct.metrics,
                "\(kind.name) metrics changed on the way through the project")
        }

        // Metrics are centimetres whatever the knitter reads, so the unit
        // system must not move them.
        let hatProject = SavedProject(name: "Hat", kind: .hat, gauge: worsted)
        XCTAssertEqual(
            hatProject.plan(units: .metric).metrics,
            hatProject.plan(units: .imperial).metrics)

        let hat = HatCalculator.plan(
            gauge: worsted, measurements: BodyMeasurements(), options: ProjectOptions(),
            structure: .stockinette, units: .metric)
        XCTAssertEqual(hatProject.plan(units: .metric).metrics, hat.metrics)

        let sweaterProject = SavedProject(name: "Sweater", kind: .raglanSweater, gauge: dk)
        let sweater = RaglanSweaterCalculator.plan(
            gauge: dk, measurements: BodyMeasurements(), options: ProjectOptions(),
            structure: .stockinette, units: .metric)
        XCTAssertEqual(sweaterProject.plan(units: .metric).metrics, sweater.metrics)

        let sockProject = SavedProject(name: "Socks", kind: .sock, gauge: fingering)
        let socks = SockCalculator.plan(
            gauge: fingering, measurements: BodyMeasurements(), options: ProjectOptions(),
            structure: .stockinette, units: .metric)
        XCTAssertEqual(sockProject.plan(units: .metric).metrics, socks.metrics)
    }
}
