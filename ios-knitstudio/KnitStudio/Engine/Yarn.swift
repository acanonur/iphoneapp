import Foundation

/// Craft Yarn Council standard yarn weight categories (0–7).
enum YarnWeight: Int, Codable, CaseIterable, Identifiable {
    case lace = 0
    case superFine = 1
    case fine = 2
    case light = 3
    case medium = 4
    case bulky = 5
    case superBulky = 6
    case jumbo = 7

    var id: Int { rawValue }

    var name: String {
        switch self {
        case .lace: return "Lace"
        case .superFine: return "Super Fine"
        case .fine: return "Fine"
        case .light: return "Light"
        case .medium: return "Medium"
        case .bulky: return "Bulky"
        case .superBulky: return "Super Bulky"
        case .jumbo: return "Jumbo"
        }
    }

    /// The names knitters actually use in patterns.
    var commonNames: String {
        switch self {
        case .lace: return "Lace, 2-ply, cobweb"
        case .superFine: return "Fingering, sock, 4-ply"
        case .fine: return "Sport, baby"
        case .light: return "DK, light worsted, 8-ply"
        case .medium: return "Worsted, aran, afghan"
        case .bulky: return "Chunky, craft, rug"
        case .superBulky: return "Super chunky, roving"
        case .jumbo: return "Jumbo, giant"
        }
    }

    /// Typical stockinette gauge range, in stitches per 10 cm.
    var stitchGaugeRange: ClosedRange<Double> {
        switch self {
        case .lace: return 33 ... 40
        case .superFine: return 27 ... 32
        case .fine: return 23 ... 26
        case .light: return 21 ... 24
        case .medium: return 16 ... 20
        case .bulky: return 12 ... 15
        case .superBulky: return 7 ... 11
        case .jumbo: return 1 ... 6
        }
    }

    /// Typical needle size range in millimetres.
    var needleRangeMM: ClosedRange<Double> {
        switch self {
        case .lace: return 1.5 ... 2.25
        case .superFine: return 2.25 ... 3.25
        case .fine: return 3.25 ... 3.75
        case .light: return 3.75 ... 4.5
        case .medium: return 4.5 ... 5.5
        case .bulky: return 5.5 ... 8.0
        case .superBulky: return 8.0 ... 12.75
        case .jumbo: return 12.75 ... 25.0
        }
    }

    var suggestedNeedleMM: Double {
        (needleRangeMM.lowerBound + needleRangeMM.upperBound) / 2
    }

    /// A representative ball band, used to pre-fill a new yarn.
    var typicalBall: (grams: Double, metres: Double) {
        switch self {
        case .lace: return (100, 800)
        case .superFine: return (100, 400)
        case .fine: return (50, 155)
        case .light: return (50, 125)
        case .medium: return (100, 200)
        case .bulky: return (100, 120)
        case .superBulky: return (100, 60)
        case .jumbo: return (200, 40)
        }
    }

    /// Best guess for a swatch gauge before the knitter has measured one.
    var nominalGauge: Gauge {
        let sts = (stitchGaugeRange.lowerBound + stitchGaugeRange.upperBound) / 2
        // Stockinette rows run roughly 4:3 against stitches.
        return Gauge(stitchesPer10cm: sts, rowsPer10cm: sts * 4 / 3)
    }

    static func matching(gauge: Gauge) -> YarnWeight {
        for weight in YarnWeight.allCases where weight.stitchGaugeRange.contains(gauge.stitchesPer10cm) {
            return weight
        }
        return gauge.stitchesPer10cm > 40 ? .lace : .jumbo
    }
}

/// A colour of yarn the knitter owns or intends to buy.
struct Yarn: Codable, Identifiable, Hashable {
    var id: UUID = UUID()
    var name: String
    var colourName: String
    /// sRGB hex, e.g. "C8443C". Used for chart rendering and swatches.
    var hex: String
    var weight: YarnWeight
    /// Grams per ball / skein as printed on the band.
    var ballGrams: Double
    /// Metres per ball / skein as printed on the band.
    var ballMetres: Double
    /// Optional price per ball, in whatever currency the knitter uses.
    var pricePerBall: Double?

    init(
        id: UUID = UUID(),
        name: String,
        colourName: String = "",
        hex: String,
        weight: YarnWeight,
        ballGrams: Double? = nil,
        ballMetres: Double? = nil,
        pricePerBall: Double? = nil
    ) {
        self.id = id
        self.name = name
        self.colourName = colourName
        self.hex = Yarn.normalise(hex: hex)
        self.weight = weight
        self.ballGrams = ballGrams ?? weight.typicalBall.grams
        self.ballMetres = ballMetres ?? weight.typicalBall.metres
        self.pricePerBall = pricePerBall
    }

    /// Metres of yarn per gram — the number that actually drives the estimate.
    var metresPerGram: Double {
        guard ballGrams > 0 else { return 0 }
        return ballMetres / ballGrams
    }

    var displayName: String {
        colourName.isEmpty ? name : "\(name) — \(colourName)"
    }

    static func normalise(hex: String) -> String {
        var value = hex.uppercased()
        if value.hasPrefix("#") { value.removeFirst() }
        let allowed = Set("0123456789ABCDEF")
        value = String(value.filter { allowed.contains($0) })
        if value.count == 3 {
            value = value.map { "\($0)\($0)" }.joined()
        }
        if value.count != 6 { return "9E9E9E" }
        return value
    }

    var rgb: (red: Double, green: Double, blue: Double) {
        let value = UInt32(hex, radix: 16) ?? 0x9E9E9E
        return (
            Double((value >> 16) & 0xFF) / 255,
            Double((value >> 8) & 0xFF) / 255,
            Double(value & 0xFF) / 255
        )
    }
}

// MARK: - Telling two colours apart

extension Yarn {

    /// WCAG relative luminance. Two yarns can look different on a screen and
    /// still knit up as one colour, which is what a knitter means by "no
    /// contrast" — luminance is the part of the difference that survives.
    var relativeLuminance: Double {
        func channel(_ value: Double) -> Double {
            value <= 0.03928 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)
        }
        let (red, green, blue) = rgb
        return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
    }

    /// 1 for two identical colours, 21 for black against white.
    static func contrastRatio(_ first: Yarn, _ second: Yarn) -> Double {
        let a = first.relativeLuminance
        let b = second.relativeLuminance
        let lighter = max(a, b)
        let darker = min(a, b)
        return (lighter + 0.05) / (darker + 0.05)
    }

    /// The old trick for checking two yarns is to photograph them and look at
    /// the picture in black and white. This is that test, done arithmetically.
    /// Below about 1.6 the pattern will not read at arm's length.
    static func contrastWarnings(for palette: [Yarn]) -> [String] {
        guard palette.count > 1 else { return [] }
        var warnings: [String] = []
        for first in 0 ..< palette.count {
            for second in (first + 1) ..< palette.count {
                let ratio = contrastRatio(palette[first], palette[second])
                guard ratio < 1.6 else { continue }
                let one = palette[first].displayName
                let other = palette[second].displayName
                warnings.append(String(
                    format: "%@ and %@ are too close in tone (%.1f:1). Photograph them "
                    + "together and look at the picture in black and white — if you cannot "
                    + "tell them apart there, the pattern will not show in the knitting.",
                    one, other, ratio))
            }
        }
        return warnings
    }
}

/// How much yarn a fabric structure eats relative to plain stockinette at the
/// same measured gauge.
enum FabricStructure: String, Codable, CaseIterable, Identifiable {
    case stockinette
    case garter
    case ribbing
    case seed
    case cables
    case lace
    case strandedColourwork
    case intarsia
    case mosaic
    case brioche

    var id: String { rawValue }

    var name: String {
        switch self {
        case .stockinette: return "Stockinette"
        case .garter: return "Garter"
        case .ribbing: return "Ribbing"
        case .seed: return "Seed / moss"
        case .cables: return "Cables"
        case .lace: return "Lace"
        case .strandedColourwork: return "Stranded colourwork"
        case .intarsia: return "Intarsia"
        case .mosaic: return "Mosaic / slip stitch"
        case .brioche: return "Brioche"
        }
    }

    /// Multiplier applied to the stockinette loop length.
    var yarnFactor: Double {
        switch self {
        case .stockinette: return 1.00
        case .garter: return 1.00   // already reflected in the row gauge
        case .ribbing: return 1.05
        case .seed: return 1.05
        case .cables: return 1.25   // crossings pull in, so more yarn per cm
        case .lace: return 0.90     // yarn-overs are holes, not yarn
        case .strandedColourwork: return 1.18  // floats on the wrong side
        case .intarsia: return 1.05
        case .mosaic: return 1.10
        case .brioche: return 1.85  // two passes per visible row
        }
    }

    var note: String {
        switch self {
        case .stockinette: return "The baseline every estimate is measured against."
        case .garter: return "Garter's extra yarn already shows up in its row gauge."
        case .ribbing: return "Ribbing pulls in, so a little more yarn per finished cm."
        case .seed: return "Alternating knits and purls use slightly more than stockinette."
        case .cables: return "Crossings compress the fabric — budget about a quarter more."
        case .lace: return "Yarn-overs replace stitches with holes, so lace goes further."
        case .strandedColourwork: return "Floats across the back add roughly a fifth."
        case .intarsia: return "Blocks of colour, no floats — barely more than stockinette."
        case .mosaic: return "Slipped stitches carry yarn up over two rows."
        case .brioche: return "Every row is worked twice — budget nearly double."
        }
    }
}

/// One block of knitting, used to total up stitches for the yarn estimate.
struct StitchBlock: Identifiable, Equatable {
    var id: UUID = UUID()
    var name: String
    /// Fractional because tapered sections use an average stitch count.
    var stitches: Double
    var structure: FabricStructure = .stockinette

    init(_ name: String, stitches: Double, structure: FabricStructure = .stockinette) {
        self.name = name
        self.stitches = stitches
        self.structure = structure
    }

    var weightedStitches: Double { stitches * structure.yarnFactor }
}

/// Turns stitch counts into metres, grams and balls.
enum YarnEstimator {

    /// Metres of yarn consumed by a set of blocks at the given gauge.
    static func metres(for blocks: [StitchBlock], gauge: Gauge) -> Double {
        let weighted = blocks.reduce(0.0) { $0 + $1.weightedStitches }
        return weighted * gauge.loopLength / 100
    }

    static func metres(stitches: Double, gauge: Gauge, structure: FabricStructure = .stockinette) -> Double {
        stitches * structure.yarnFactor * gauge.loopLength / 100
    }

    static func grams(metres: Double, yarn: Yarn) -> Double {
        guard yarn.metresPerGram > 0 else { return 0 }
        return metres / yarn.metresPerGram
    }

    /// Whole balls to buy, including a safety margin (default 10%).
    static func balls(metres: Double, yarn: Yarn, safetyMargin: Double = 0.10) -> Int {
        guard yarn.ballMetres > 0 else { return 0 }
        let needed = metres * (1 + safetyMargin)
        return max(1, Int((needed / yarn.ballMetres).rounded(.up)))
    }

    /// Grams of fabric per square metre — a useful cross-check and the number
    /// that tells you whether a swatch was entered sensibly.
    static func arealDensity(gauge: Gauge, yarn: Yarn) -> Double {
        let stitchesPerSquareMetre = gauge.stitchesPer10cm * 10 * gauge.rowsPer10cm * 10
        let m = stitchesPerSquareMetre * gauge.loopLength / 100
        return grams(metres: m, yarn: yarn)
    }
}
