import Foundation

enum HatStyle: String, Codable, CaseIterable, Identifiable {
    case classic
    case slouchy
    case foldedBrim

    var id: String { rawValue }

    var name: String {
        switch self {
        case .classic: return "Classic beanie"
        case .slouchy: return "Slouchy"
        case .foldedBrim: return "Folded brim"
        }
    }

    /// Finished height from brim edge to crown, in cm, for an adult head.
    var height: Double {
        switch self {
        case .classic: return 22
        case .slouchy: return 28
        case .foldedBrim: return 27
        }
    }
}

/// Every knob a calculator might read. Each calculator uses the subset that
/// applies to it, so one options object can back the whole UI.
struct ProjectOptions: Codable, Equatable {
    /// Fractional ease. Positive is roomier than the body, negative is snug.
    var ease: Double = 0.08

    // Hats
    var hatStyle: HatStyle = .classic
    var crownSections: Int = 8

    // Ribbing / edgings
    var ribDepth: Double = 5
    var cuffDepth: Double = 4

    // Sweaters
    var raglanStitches: Int = 2

    // Socks
    var legLength: Double = 15

    // Flat pieces
    var width: Double = 25
    var length: Double = 180
    var edgeStitches: Int = 2

    // Shawls
    var wingspan: Double = 180
    var increasesPerRightSideRow: Int = 4

    // Cowls
    var cowlCircumference: Double = 60
    var cowlHeight: Double = 30

    // Stitch pattern repeat the cast-on must respect.
    var stitchMultiple: Int = 1
    var stitchOffset: Int = 0

    /// Extra yarn bought as insurance, as a fraction.
    var safetyMargin: Double = 0.10
}

/// The project types the calculator can plan.
enum PatternKind: String, Codable, CaseIterable, Identifiable {
    case scarf
    case blanket
    case cowl
    case hat
    case raglanSweater
    case sock
    case mitten
    case shawl

    var id: String { rawValue }

    var name: String {
        switch self {
        case .scarf: return "Scarf"
        case .blanket: return "Blanket"
        case .cowl: return "Cowl"
        case .hat: return "Hat"
        case .raglanSweater: return "Top-down raglan sweater"
        case .sock: return "Socks"
        case .mitten: return "Mittens"
        case .shawl: return "Triangle shawl"
        }
    }

    var symbol: String {
        switch self {
        case .scarf: return "scribble"
        case .blanket: return "square.grid.3x3.fill"
        case .cowl: return "circle.circle"
        case .hat: return "graduationcap"
        case .raglanSweater: return "tshirt"
        case .sock: return "shoe"
        case .mitten: return "hand.raised"
        case .shawl: return "triangle"
        }
    }

    var blurb: String {
        switch self {
        case .scarf: return "A flat rectangle. The best first project."
        case .blanket: return "A big rectangle — plan the yarn before you start."
        case .cowl: return "A tube worked in the round, no shaping."
        case .hat: return "Ribbed brim, straight body, shaped crown."
        case .raglanSweater: return "Cast on at the neck, increase to the underarms, split, work down."
        case .sock: return "Cuff down: leg, heel flap, gusset, foot, toe."
        case .mitten: return "Cuff, thumb gusset, hand, shaped tip."
        case .shawl: return "Centre-out triangle, increases every right-side row."
        }
    }

    /// Difficulty as a knitter would judge it.
    var difficulty: Difficulty {
        switch self {
        case .scarf, .blanket: return .beginner
        case .cowl, .hat: return .easy
        case .shawl, .mitten: return .intermediate
        case .sock, .raglanSweater: return .advanced
        }
    }

    /// Which measurements the form should ask for.
    var relevantMeasurements: [MeasurementField] {
        switch self {
        case .scarf, .blanket: return []
        case .cowl: return []
        case .hat: return [.headCircumference]
        case .raglanSweater: return [.chest, .neckCircumference, .bodyLength, .sleeveLength, .upperArm, .wrist]
        case .sock: return [.footCircumference, .footLength]
        case .mitten: return [.handCircumference, .handLength]
        case .shawl: return []
        }
    }

    func makePlan(
        gauge: Gauge,
        measurements: BodyMeasurements,
        options: ProjectOptions,
        structure: FabricStructure,
        units: UnitSystem
    ) -> ProjectPlan {
        switch self {
        case .scarf, .blanket:
            return FlatPieceCalculator.plan(
                kind: self, gauge: gauge, options: options, structure: structure, units: units)
        case .cowl:
            return CowlCalculator.plan(gauge: gauge, options: options, structure: structure, units: units)
        case .hat:
            return HatCalculator.plan(
                gauge: gauge, measurements: measurements, options: options,
                structure: structure, units: units)
        case .raglanSweater:
            return RaglanSweaterCalculator.plan(
                gauge: gauge, measurements: measurements, options: options,
                structure: structure, units: units)
        case .sock:
            return SockCalculator.plan(
                gauge: gauge, measurements: measurements, options: options,
                structure: structure, units: units)
        case .mitten:
            return MittenCalculator.plan(
                gauge: gauge, measurements: measurements, options: options,
                structure: structure, units: units)
        case .shawl:
            return ShawlCalculator.plan(gauge: gauge, options: options, structure: structure, units: units)
        }
    }
}

enum MeasurementField: String, CaseIterable, Identifiable {
    case chest, headCircumference, neckCircumference, upperArm, wrist
    case bodyLength, sleeveLength, footCircumference, footLength
    case handCircumference, handLength

    var id: String { rawValue }

    var label: String {
        switch self {
        case .chest: return "Chest / bust"
        case .headCircumference: return "Head circumference"
        case .neckCircumference: return "Neck circumference"
        case .upperArm: return "Upper arm"
        case .wrist: return "Wrist"
        case .bodyLength: return "Body length (shoulder to hem)"
        case .sleeveLength: return "Sleeve length (underarm to cuff)"
        case .footCircumference: return "Foot circumference (around the ball)"
        case .footLength: return "Foot length (heel to toe)"
        case .handCircumference: return "Hand circumference"
        case .handLength: return "Hand length (wrist to fingertip)"
        }
    }

    func value(in measurements: BodyMeasurements) -> Double {
        switch self {
        case .chest: return measurements.chest
        case .headCircumference: return measurements.headCircumference
        case .neckCircumference: return measurements.neckCircumference
        case .upperArm: return measurements.upperArm
        case .wrist: return measurements.wrist
        case .bodyLength: return measurements.bodyLength
        case .sleeveLength: return measurements.sleeveLength
        case .footCircumference: return measurements.footCircumference
        case .footLength: return measurements.footLength
        case .handCircumference: return measurements.handCircumference
        case .handLength: return measurements.handLength
        }
    }

    func set(_ value: Double, in measurements: inout BodyMeasurements) {
        switch self {
        case .chest: measurements.chest = value
        case .headCircumference: measurements.headCircumference = value
        case .neckCircumference: measurements.neckCircumference = value
        case .upperArm: measurements.upperArm = value
        case .wrist: measurements.wrist = value
        case .bodyLength: measurements.bodyLength = value
        case .sleeveLength: measurements.sleeveLength = value
        case .footCircumference: measurements.footCircumference = value
        case .footLength: measurements.footLength = value
        case .handCircumference: measurements.handCircumference = value
        case .handLength: measurements.handLength = value
        }
    }
}

enum Difficulty: String, Codable, CaseIterable, Identifiable, Comparable {
    case beginner, easy, intermediate, advanced

    var id: String { rawValue }

    var name: String { rawValue.capitalized }

    var order: Int {
        switch self {
        case .beginner: return 0
        case .easy: return 1
        case .intermediate: return 2
        case .advanced: return 3
        }
    }

    static func < (lhs: Difficulty, rhs: Difficulty) -> Bool { lhs.order < rhs.order }
}
