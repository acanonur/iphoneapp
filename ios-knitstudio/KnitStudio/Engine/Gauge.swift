import Foundation

/// Which units the knitter wants to see. Everything is stored in centimetres
/// internally; this only affects input parsing and display.
enum UnitSystem: String, Codable, CaseIterable, Identifiable {
    case metric
    case imperial

    var id: String { rawValue }

    var lengthLabel: String { self == .metric ? "cm" : "in" }
    /// Gauge is quoted over 10 cm (metric) or 4 in (imperial).
    var gaugeWindowLabel: String { self == .metric ? "10 cm" : "4\"" }

    func fromCentimetres(_ cm: Double) -> Double {
        self == .metric ? cm : cm / 2.54
    }

    func toCentimetres(_ value: Double) -> Double {
        self == .metric ? value : value * 2.54
    }

    func formatLength(_ cm: Double, decimals: Int = 1) -> String {
        let value = fromCentimetres(cm)
        return String(format: "%.\(decimals)f %@", value, lengthLabel)
    }
}

/// A knitted gauge (tension), always normalised to stitches and rows per 10 cm.
struct Gauge: Codable, Equatable, Hashable {
    /// Stitches measured over 10 cm.
    var stitchesPer10cm: Double
    /// Rows (or rounds) measured over 10 cm.
    var rowsPer10cm: Double

    init(stitchesPer10cm: Double, rowsPer10cm: Double) {
        self.stitchesPer10cm = max(0.1, stitchesPer10cm)
        self.rowsPer10cm = max(0.1, rowsPer10cm)
    }

    /// Builds a gauge from a swatch measured over an arbitrary window.
    static func fromSwatch(stitches: Double, rows: Double, overCm: Double) -> Gauge {
        let window = max(0.1, overCm)
        return Gauge(
            stitchesPer10cm: stitches * 10 / window,
            rowsPer10cm: rows * 10 / window
        )
    }

    /// Width of a single stitch, in centimetres.
    var stitchWidth: Double { 10 / stitchesPer10cm }
    /// Height of a single row, in centimetres.
    var rowHeight: Double { 10 / rowsPer10cm }

    /// How elongated the stitch is. Stockinette normally sits near 0.75.
    var aspectRatio: Double { rowHeight / stitchWidth }

    func stitches(forWidth cm: Double) -> Double { cm / 10 * stitchesPer10cm }
    func rows(forLength cm: Double) -> Double { cm / 10 * rowsPer10cm }
    func width(forStitches count: Double) -> Double { count / stitchesPer10cm * 10 }
    func length(forRows count: Double) -> Double { count / rowsPer10cm * 10 }

    // MARK: - Loop length

    // Munden's relaxed plain-knit relations: courses per unit length = Kc / l
    // and wales per unit length = Kw / l, where l is the loop (stitch) length.
    // Solving each for l gives two independent estimates from the knitter's own
    // swatch; averaging them is what makes the yarn estimate self-calibrating.
    private static let walesConstant = 3.8
    private static let coursesConstant = 5.0

    /// Length of yarn consumed by one stitch, in centimetres.
    var loopLength: Double {
        let walesPerCm = stitchesPer10cm / 10
        let coursesPerCm = rowsPer10cm / 10
        let fromWales = Gauge.walesConstant / walesPerCm
        let fromCourses = Gauge.coursesConstant / coursesPerCm
        return (fromWales + fromCourses) / 2
    }

    /// Sanity flag: a swatch whose loop length is wildly out of proportion to
    /// its stitch width usually means the swatch was measured or entered wrong.
    var looksPlausible: Bool {
        let ratio = loopLength / stitchWidth
        return ratio > 2.5 && ratio < 5.5
    }

    func describe(in units: UnitSystem) -> String {
        if units == .metric {
            return String(format: "%.0f sts × %.0f rows / 10 cm", stitchesPer10cm, rowsPer10cm)
        }
        let sts = stitchesPer10cm * 2.54 * 4 / 10
        let rows = rowsPer10cm * 2.54 * 4 / 10
        return String(format: "%.1f sts × %.1f rows / 4\"", sts, rows)
    }
}
