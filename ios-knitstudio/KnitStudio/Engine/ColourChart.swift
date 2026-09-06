import Foundation

/// How a chart is worked, which decides how each row is read.
enum ChartWorking: String, Codable, CaseIterable, Identifiable {
    /// Back and forth: right-side rows read right to left, wrong-side rows left to right.
    case flat
    /// In the round: every row reads right to left.
    case inTheRound

    var id: String { rawValue }
    var name: String { self == .flat ? "Flat (back and forth)" : "In the round" }
}

/// A colourwork chart: a grid where every cell names a colour in the palette.
struct ColourChart: Codable, Identifiable, Equatable {
    var id: UUID = UUID()
    var name: String
    var width: Int
    var height: Int
    /// Row-major, `width * height` entries, each an index into `palette`.
    /// Row 0 is the bottom of the chart — the first row knitted.
    var cells: [Int]
    var palette: [Yarn]
    var working: ChartWorking = .inTheRound
    var notes: String = ""

    init(
        id: UUID = UUID(),
        name: String,
        width: Int,
        height: Int,
        cells: [Int],
        palette: [Yarn],
        working: ChartWorking = .inTheRound,
        notes: String = ""
    ) {
        self.id = id
        self.name = name
        self.width = max(1, width)
        self.height = max(1, height)
        self.palette = palette.isEmpty ? [Yarn(name: "Main", hex: "FFFFFF", weight: .light)] : palette
        let expected = self.width * self.height
        if cells.count == expected {
            self.cells = cells
        } else if cells.count > expected {
            self.cells = Array(cells.prefix(expected))
        } else {
            self.cells = cells + Array(repeating: 0, count: expected - cells.count)
        }
        self.working = working
        self.notes = notes
    }

    static func blank(name: String = "New chart", width: Int = 20, height: Int = 20, palette: [Yarn]) -> ColourChart {
        ColourChart(
            name: name, width: width, height: height,
            cells: Array(repeating: 0, count: max(1, width) * max(1, height)),
            palette: palette)
    }

    // MARK: - Cell access

    func colourIndex(x: Int, y: Int) -> Int {
        guard x >= 0, x < width, y >= 0, y < height else { return 0 }
        return min(cells[y * width + x], palette.count - 1)
    }

    mutating func setColourIndex(_ index: Int, x: Int, y: Int) {
        guard x >= 0, x < width, y >= 0, y < height else { return }
        cells[y * width + x] = max(0, min(index, palette.count - 1))
    }

    /// Cells in the order they are knitted for the given row.
    func knittingOrder(row y: Int) -> [Int] {
        let rowCells = (0 ..< width).map { colourIndex(x: $0, y: y) }
        // Charts are read right to left, the direction the stitches are worked.
        if working == .inTheRound { return rowCells.reversed() }
        // Flat: odd-numbered rows (0-indexed even) are right side, read right to
        // left; wrong-side rows are read left to right.
        return y % 2 == 0 ? rowCells.reversed() : rowCells
    }

    // MARK: - Derived numbers

    /// Stitch count per palette index across the whole chart.
    func stitchCounts() -> [Int: Int] {
        var counts: [Int: Int] = [:]
        for cell in cells {
            let index = min(max(0, cell), palette.count - 1)
            counts[index, default: 0] += 1
        }
        return counts
    }

    var totalStitches: Int { width * height }

    /// Fraction of the chart worked in each palette colour.
    func colourShares() -> [Int: Double] {
        let counts = stitchCounts()
        let total = Double(max(1, totalStitches))
        return counts.mapValues { Double($0) / total }
    }

    /// The longest run of a single colour in any row — the float length that
    /// decides whether stranded colourwork is comfortable to knit and wear.
    func longestFloat() -> Int {
        var longest = 0
        for y in 0 ..< height {
            let row = knittingOrder(row: y)
            var run = 0
            var previous = -1
            for value in row {
                if value == previous {
                    run += 1
                } else {
                    run = 1
                    previous = value
                }
                longest = max(longest, run)
            }
        }
        return longest
    }

    /// How many colours appear on the busiest row. More than two at a time is
    /// hard work in stranded knitting.
    func maxColoursPerRow() -> Int {
        var maximum = 0
        for y in 0 ..< height {
            let row = Set((0 ..< width).map { colourIndex(x: $0, y: y) })
            maximum = max(maximum, row.count)
        }
        return maximum
    }

    /// Finished size at a given gauge.
    func finishedSize(gauge: Gauge) -> (width: Double, height: Double) {
        (gauge.width(forStitches: Double(width)), gauge.length(forRows: Double(height)))
    }

    // MARK: - Written instructions

    /// Row-by-row written instructions, run-length encoded, in knitting order.
    func writtenInstructions() -> [String] {
        var lines: [String] = []
        for y in 0 ..< height {
            let row = knittingOrder(row: y)
            var parts: [String] = []
            var run = 0
            var current = row.first ?? 0
            for value in row {
                if value == current {
                    run += 1
                } else {
                    parts.append("\(run) \(letter(for: current))")
                    current = value
                    run = 1
                }
            }
            if run > 0 { parts.append("\(run) \(letter(for: current))") }

            let side: String
            if working == .inTheRound {
                side = "Rnd \(y + 1)"
            } else {
                side = "Row \(y + 1) (\(y % 2 == 0 ? "RS" : "WS"))"
            }
            lines.append("\(side): \(parts.joined(separator: ", "))")
        }
        return lines
    }

    /// A, B, C… labels for the palette, the way charts are legended.
    func letter(for index: Int) -> String {
        let clamped = max(0, min(index, palette.count - 1))
        let scalar = UnicodeScalar(65 + (clamped % 26)) ?? "A"
        return String(Character(scalar))
    }

    var legend: [(letter: String, yarn: Yarn)] {
        palette.enumerated().map { (letter(for: $0.offset), $0.element) }
    }

    // MARK: - Editing

    mutating func resize(width newWidth: Int, height newHeight: Int) {
        let w = max(1, newWidth)
        let h = max(1, newHeight)
        var next = Array(repeating: 0, count: w * h)
        for y in 0 ..< min(h, height) {
            for x in 0 ..< min(w, width) {
                next[y * w + x] = cells[y * width + x]
            }
        }
        cells = next
        width = w
        height = h
    }

    mutating func mirrorHorizontally() {
        var next = cells
        for y in 0 ..< height {
            for x in 0 ..< width {
                next[y * width + x] = cells[y * width + (width - 1 - x)]
            }
        }
        cells = next
    }

    mutating func flipVertically() {
        var next = cells
        for y in 0 ..< height {
            for x in 0 ..< width {
                next[y * width + x] = cells[(height - 1 - y) * width + x]
            }
        }
        cells = next
    }

    /// Warnings a knitter would want before casting on.
    func reviewNotes(gauge: Gauge) -> [String] {
        var notes: [String] = []
        let float = longestFloat()
        if float > 7 {
            notes.append(
                "Longest float is \(float) stitches. Anything over about 7 catches on fingers — "
                + "trap the yarn mid-float, or edit the chart to break up the run.")
        }
        if maxColoursPerRow() > 2 {
            notes.append(
                "Up to \(maxColoursPerRow()) colours appear in one row. Stranded knitting is far "
                + "easier with two per row — consider intarsia or duplicate stitch for the extras.")
        }
        if palette.count > 1 {
            let size = finishedSize(gauge: gauge)
            notes.append(String(
                format: "At this gauge the chart works out %.1f cm wide by %.1f cm tall.",
                size.width, size.height))
        }
        return notes
    }
}
