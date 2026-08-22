import Foundation

/// How a chart draws its cells. The traditional convention leaves a knit blank
/// and marks everything else with a glyph, which is compact but tells a knitter
/// who has not learned the glyphs nothing at all.
enum ChartSymbolStyle: String, Codable, CaseIterable, Identifiable {
    /// Every cell labelled: K, P, YO, K2, SSK.
    case letters
    /// The printed-pattern glyphs: a knit is an empty square.
    case symbols

    var id: String { rawValue }

    var name: String { self == .letters ? "Letters" : "Symbols" }

    var explanation: String {
        switch self {
        case .letters:
            return "Every stitch spelled out, and colour-coded by what it does."
        case .symbols:
            return "The glyphs a printed pattern uses. A knit is an empty square."
        }
    }
}

/// What a stitch does, which is what the chart colour-codes by. Knowing a cell
/// is a decrease matters more at a glance than knowing which decrease it is.
enum StitchCategory: String, Codable, CaseIterable, Identifiable {
    case knit
    case purl
    case increase
    case decrease
    case cable
    case slip
    case other

    var id: String { rawValue }

    var name: String {
        switch self {
        case .knit: return "Knit"
        case .purl: return "Purl"
        case .increase: return "Increases"
        case .decrease: return "Decreases"
        case .cable: return "Cables"
        case .slip: return "Slipped"
        case .other: return "Other"
        }
    }

    /// sRGB hex the chart inks this category in. Knit and purl are the two a
    /// knitter reads constantly, so they get the strongest separation.
    var tintHex: String {
        switch self {
        case .knit: return "2E4272"      // the app's accent blue
        case .purl: return "B5561C"      // burnt orange, unmistakable against it
        case .increase: return "1F7A4D"  // green: stitches arriving
        case .decrease: return "A32B4F"  // red: stitches leaving
        case .cable: return "6B3FA0"     // violet
        case .slip: return "4A6E82"      // slate
        case .other: return "5A5A5A"
        }
    }
}

/// One cell of a stitch chart.
enum StitchSymbol: String, Codable, CaseIterable, Identifiable {
    case knit, purl, yarnOver, k2tog, ssk, cdd, k3tog, make1, slip, slipWyif
    case cable2Front, cable2Back, cable3Front, cable3Back, bobble, noStitch

    var id: String { rawValue }

    var name: String {
        switch self {
        case .knit: return "Knit"
        case .purl: return "Purl"
        case .yarnOver: return "Yarn over"
        case .k2tog: return "Knit 2 together"
        case .ssk: return "Slip slip knit"
        case .cdd: return "Centred double decrease"
        case .k3tog: return "Knit 3 together"
        case .make1: return "Make one"
        case .slip: return "Slip 1, yarn in back"
        case .slipWyif: return "Slip 1, yarn in front"
        case .cable2Front: return "Cable 2 over 2, left cross"
        case .cable2Back: return "Cable 2 over 2, right cross"
        case .cable3Front: return "Cable 3 over 3, left cross"
        case .cable3Back: return "Cable 3 over 3, right cross"
        case .bobble: return "Bobble"
        case .noStitch: return "No stitch"
        }
    }

    var rightSideAbbreviation: String {
        switch self {
        case .knit: return "k"
        case .purl: return "p"
        case .yarnOver: return "yo"
        case .k2tog: return "k2tog"
        case .ssk: return "ssk"
        case .cdd: return "cdd"
        case .k3tog: return "k3tog"
        case .make1: return "M1"
        case .slip: return "sl1"
        case .slipWyif: return "sl1wyif"
        case .cable2Front: return "C4F"
        case .cable2Back: return "C4B"
        case .cable3Front: return "C6F"
        case .cable3Back: return "C6B"
        case .bobble: return "MB"
        case .noStitch: return "no st"
        }
    }

    /// One to three characters for the letters style. Short enough to fit a
    /// cell, long enough to be guessable without the legend.
    var chartLabel: String {
        switch self {
        case .knit: return "K"
        case .purl: return "P"
        case .yarnOver: return "YO"
        case .k2tog: return "K2"
        case .ssk: return "SSK"
        case .cdd: return "CDD"
        case .k3tog: return "K3"
        case .make1: return "M1"
        case .slip: return "SL"
        case .slipWyif: return "SLF"
        case .cable2Front: return "C4F"
        case .cable2Back: return "C4B"
        case .cable3Front: return "C6F"
        case .cable3Back: return "C6B"
        case .bobble: return "MB"
        case .noStitch: return ""
        }
    }

    var category: StitchCategory {
        switch self {
        case .knit: return .knit
        case .purl: return .purl
        case .yarnOver, .make1: return .increase
        case .k2tog, .ssk, .cdd, .k3tog: return .decrease
        case .cable2Front, .cable2Back, .cable3Front, .cable3Back: return .cable
        case .slip, .slipWyif: return .slip
        case .bobble, .noStitch: return .other
        }
    }

    /// The same charted cell worked on a wrong-side row. Only the symbols with a
    /// settled purl-side name change; the rest are written the way they are charted.
    var wrongSideAbbreviation: String {
        switch self {
        case .knit: return "p"
        case .purl: return "k"
        case .k2tog: return "p2tog"
        case .ssk: return "ssp"
        case .k3tog: return "p3tog"
        case .slipWyif: return "sl1wyib"
        case .slip: return "sl1wyif"
        case .yarnOver, .cdd, .make1,
             .cable2Front, .cable2Back, .cable3Front, .cable3Back, .bobble, .noStitch:
            return rightSideAbbreviation
        }
    }

    var meaning: String {
        switch self {
        case .knit: return "Knit the stitch with the yarn held at the back."
        case .purl: return "Purl the stitch with the yarn held at the front."
        case .yarnOver: return "Wrap the yarn over the needle to make a new stitch and a hole."
        case .k2tog: return "Knit two stitches together as one, a decrease that leans right."
        case .ssk: return "Slip two knitwise, then knit them together through the front, a decrease that leans left."
        case .cdd: return "Slip two together knitwise, knit one, pass the slipped stitches over, taking out two stitches."
        case .k3tog: return "Knit three stitches together as one, taking out two stitches."
        case .make1: return "Lift the bar between two stitches and knit into it, adding one stitch."
        case .slip: return "Slip the stitch purlwise with the yarn behind the work."
        case .slipWyif: return "Slip the stitch purlwise with the yarn carried across the front, leaving a small bar."
        case .cable2Front: return "Hold two stitches on a cable needle at the front, knit two, then knit the held stitches, so the cable leans left."
        case .cable2Back: return "Hold two stitches on a cable needle at the back, knit two, then knit the held stitches, so the cable leans right."
        case .cable3Front: return "Hold three stitches on a cable needle at the front, knit three, then knit the held stitches, so the cable leans left."
        case .cable3Back: return "Hold three stitches on a cable needle at the back, knit three, then knit the held stitches, so the cable leans right."
        case .bobble: return "Work several stitches into one and then back together again, leaving a small ball on the surface."
        case .noStitch: return "A placeholder where the chart has no stitch, so skip it and carry on."
        }
    }

    /// Stitches taken off the left needle.
    var consumes: Int {
        switch self {
        case .knit, .purl, .slip, .slipWyif, .bobble: return 1
        case .yarnOver, .make1, .noStitch: return 0
        case .k2tog, .ssk: return 2
        case .k3tog, .cdd: return 3
        case .cable2Front, .cable2Back: return 4
        case .cable3Front, .cable3Back: return 6
        }
    }

    /// Stitches made on the right needle.
    var produces: Int {
        switch self {
        case .knit, .purl, .slip, .slipWyif, .bobble, .yarnOver, .make1,
             .k2tog, .ssk, .k3tog, .cdd:
            return 1
        case .cable2Front, .cable2Back: return 4
        case .cable3Front, .cable3Back: return 6
        case .noStitch: return 0
        }
    }

    /// Yarn used relative to a plain knit stitch.
    var yarnFactor: Double {
        switch self {
        case .knit: return 1.0
        case .purl: return 1.05
        case .yarnOver: return 0.4
        case .k2tog, .ssk, .k3tog, .cdd: return 1.0
        case .make1: return 0.6
        case .slip, .slipWyif: return 0.5
        case .cable2Front, .cable2Back, .cable3Front, .cable3Back: return 1.3
        case .bobble: return 3.0
        case .noStitch: return 0.0
        }
    }

    /// How this cell looks from the right side of the fabric, which is what the
    /// simulation draws. A purl worked on a wrong-side row shows as a knit.
    var wrongSideAppearance: StitchSymbol {
        switch self {
        case .knit: return .purl
        case .purl: return .knit
        case .slipWyif: return .slip
        case .yarnOver, .k2tog, .ssk, .cdd, .k3tog, .make1, .slip,
             .cable2Front, .cable2Back, .cable3Front, .cable3Back, .bobble, .noStitch:
            return self
        }
    }
}

/// A texture chart: a grid where every cell names a stitch rather than a colour.
struct StitchPattern: Codable, Identifiable, Equatable {
    var id: UUID = UUID()
    var name: String
    /// Stitches in one horizontal repeat.
    var width: Int
    /// Charted rows in one vertical repeat.
    var height: Int
    /// Row-major, `width * height` entries. Row 0 is the bottom of the chart —
    /// the first row knitted.
    var symbols: [StitchSymbol]
    /// Colour index per charted row. Empty means the whole pattern is one colour.
    var rowColours: [Int]
    var working: ChartWorking = .flat
    var multipleOf: Int = 1
    var plusStitches: Int = 0
    /// Shadow knitting and other slip-stitch charts work each charted row twice.
    var rowsPerChartedRow: Int = 1
    /// The row the chart leaves out, e.g. "RS: knit all stitches".
    var impliedRowInstruction: String?
    /// True when the charted row is the wrong-side row, the way shadow-knitting
    /// charts are drawn. Inverts what the simulation shows.
    var chartsWrongSideRows: Bool = false
    var structure: FabricStructure = .stockinette
    var difficulty: Difficulty = .easy
    var notes: String = ""
    /// One line: what this fabric is and where to use it.
    var summary: String = ""

    init(
        id: UUID = UUID(),
        name: String,
        width: Int,
        height: Int,
        symbols: [StitchSymbol],
        rowColours: [Int] = [],
        working: ChartWorking = .flat,
        multipleOf: Int = 1,
        plusStitches: Int = 0,
        rowsPerChartedRow: Int = 1,
        impliedRowInstruction: String? = nil,
        chartsWrongSideRows: Bool = false,
        structure: FabricStructure = .stockinette,
        difficulty: Difficulty = .easy,
        notes: String = "",
        summary: String = ""
    ) {
        self.id = id
        self.name = name
        self.width = max(1, width)
        self.height = max(1, height)
        let expected = self.width * self.height
        if symbols.count == expected {
            self.symbols = symbols
        } else if symbols.count > expected {
            self.symbols = Array(symbols.prefix(expected))
        } else {
            let padding = Array(repeating: StitchSymbol.knit, count: expected - symbols.count)
            self.symbols = symbols + padding
        }
        self.rowColours = rowColours
        self.working = working
        self.multipleOf = max(1, multipleOf)
        self.plusStitches = max(0, plusStitches)
        self.rowsPerChartedRow = max(1, rowsPerChartedRow)
        self.impliedRowInstruction = impliedRowInstruction
        self.chartsWrongSideRows = chartsWrongSideRows
        self.structure = structure
        self.difficulty = difficulty
        self.notes = notes
        self.summary = summary
    }

    static func blank(name: String = "New stitch pattern", width: Int = 12, height: Int = 12) -> StitchPattern {
        let cells = Array(repeating: StitchSymbol.knit, count: max(1, width) * max(1, height))
        return StitchPattern(name: name, width: width, height: height, symbols: cells)
    }

    // MARK: - Cell access

    func symbol(x: Int, y: Int) -> StitchSymbol {
        guard x >= 0, x < width, y >= 0, y < height else { return .knit }
        let index = y * width + x
        guard index < symbols.count else { return .knit }
        return symbols[index]
    }

    mutating func setSymbol(_ s: StitchSymbol, x: Int, y: Int) {
        guard x >= 0, x < width, y >= 0, y < height else { return }
        let index = y * width + x
        guard index < symbols.count else { return }
        symbols[index] = s
    }

    /// The repeat carried on for ever in both directions, for drawing a swatch
    /// larger than one repeat.
    func symbolTiled(x: Int, y: Int) -> StitchSymbol {
        let column = ((x % width) + width) % width
        let row = ((y % height) + height) % height
        return symbol(x: column, y: row)
    }

    func colourIndex(row y: Int) -> Int {
        guard !rowColours.isEmpty else { return 0 }
        let count = rowColours.count
        let index = ((y % count) + count) % count
        return max(0, rowColours[index])
    }

    /// What the knitter sees on the right side, used by the fabric simulation.
    func rightSideAppearance(x: Int, y: Int) -> StitchSymbol {
        let charted = symbol(x: x, y: y)
        return chartsWrongSideRows ? charted.wrongSideAppearance : charted
    }

    // MARK: - Reading order

    var totalRows: Int { height * rowsPerChartedRow }

    func isRightSideRow(_ y: Int) -> Bool {
        if working == .inTheRound { return true }
        // A shadow-knitting chart draws the wrong-side row of every pair, so
        // every charted row is a wrong-side row.
        if chartsWrongSideRows { return false }
        return y % 2 == 0
    }

    /// Cells in the order they are worked for the given row.
    func rowSymbolsInKnittingOrder(_ y: Int) -> [StitchSymbol] {
        let rowSymbols = (0 ..< width).map { symbol(x: $0, y: y) }
        // Charts are read right to left, the direction the stitches are worked;
        // only a wrong-side row is read the other way.
        if working == .inTheRound { return rowSymbols.reversed() }
        return isRightSideRow(y) ? rowSymbols.reversed() : rowSymbols
    }

    // MARK: - Written instructions

    func rowInstruction(_ y: Int, colourNames: [String]) -> String {
        let rightSide = isRightSideRow(y)
        let worked = rowSymbolsInKnittingOrder(y).filter { $0 != .noStitch }
        var parts: [String] = []
        var run = 0
        var current: StitchSymbol = worked.first ?? .knit
        for entry in worked {
            if entry == current {
                run += 1
            } else {
                parts.append(runText(for: current, count: run, rightSide: rightSide))
                current = entry
                run = 1
            }
        }
        if run > 0 { parts.append(runText(for: current, count: run, rightSide: rightSide)) }

        let label = rowLabel(y, colourNames: colourNames)
        let body = parts.isEmpty ? "no stitches worked" : parts.joined(separator: ", ")
        return "\(label): \(body)"
    }

    func writtenInstructions(colourNames: [String]) -> [String] {
        let implied = (impliedRowInstruction ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        var lines: [String] = []
        for y in 0 ..< height {
            // The omitted row is worked before the charted one only when the
            // chart itself is drawn from the wrong side.
            if chartsWrongSideRows, !implied.isEmpty { lines.append(implied) }
            lines.append(rowInstruction(y, colourNames: colourNames))
            if !chartsWrongSideRows, !implied.isEmpty { lines.append(implied) }
        }
        return lines
    }

    /// A run of one drops the number for a multi-letter abbreviation but keeps
    /// it for k and p, the way a written pattern reads.
    private func runText(for cell: StitchSymbol, count: Int, rightSide: Bool) -> String {
        let abbreviation = rightSide ? cell.rightSideAbbreviation : cell.wrongSideAbbreviation
        if abbreviation.count == 1 { return "\(abbreviation)\(count)" }
        if count == 1 { return abbreviation }
        return "[\(abbreviation)] \(count) times"
    }

    private func rowLabel(_ y: Int, colourNames: [String]) -> String {
        let first = y * rowsPerChartedRow + 1
        let last = (y + 1) * rowsPerChartedRow
        let numbers: String
        let side: String
        if working == .inTheRound {
            numbers = first == last ? "Rnd \(first)" : "Rnds \(first)-\(last)"
            side = ""
        } else {
            numbers = first == last ? "Row \(first)" : "Rows \(first)-\(last)"
            side = isRightSideRow(y) ? " (RS)" : " (WS)"
        }
        let colour = colourLabel(row: y, colourNames: colourNames)
        return "\(numbers)\(side)\(colour)"
    }

    private func colourLabel(row y: Int, colourNames: [String]) -> String {
        guard !rowColours.isEmpty else { return "" }
        let index = colourIndex(row: y)
        if index >= 0, index < colourNames.count {
            let trimmed = colourNames[index].trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { return " \(trimmed)" }
        }
        return " \(StitchPattern.letter(for: index))"
    }

    /// A, B, C… labels, the way charts are legended when the colours are unnamed.
    static func letter(for index: Int) -> String {
        let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        let position = max(0, index) % 26
        let start = alphabet.index(alphabet.startIndex, offsetBy: position)
        return String(alphabet[start])
    }

    // MARK: - Stitch counts

    func stitchesConsumed(row y: Int) -> Int {
        var total = 0
        for x in 0 ..< width {
            total += symbol(x: x, y: y).consumes
        }
        return total
    }

    func stitchesProduced(row y: Int) -> Int {
        var total = 0
        for x in 0 ..< width {
            total += symbol(x: x, y: y).produces
        }
        return total
    }

    func netStitchChange(row y: Int) -> Int {
        stitchesProduced(row: y) - stitchesConsumed(row: y)
    }

    var isStitchCountStable: Bool {
        for y in 0 ..< height where netStitchChange(row: y) != 0 {
            return false
        }
        return true
    }

    // MARK: - Derived numbers

    func castOn(nearest desired: Int) -> Int {
        Shaping.roundToMultiple(Double(desired), multiple: multipleOf, offset: plusStitches)
    }

    func castOn(forWidth cm: Double, gauge: Gauge) -> Int {
        let exact = gauge.stitches(forWidth: cm)
        return Shaping.roundToMultiple(exact, multiple: multipleOf, offset: plusStitches)
    }

    /// Mean yarn appetite of the cells that are actually knitted.
    var yarnFactor: Double {
        var total = 0.0
        var count = 0
        for cell in symbols where cell != .noStitch {
            total += cell.yarnFactor
            count += 1
        }
        guard count > 0 else { return 0.5 }
        return max(0.5, total / Double(count))
    }

    /// Fraction of the knitted stitches worked in each colour. Counted by
    /// stitches rather than rows, since one charted row can cover two.
    func colourShares() -> [Int: Double] {
        let perRow = Double(width * rowsPerChartedRow)
        var counts: [Int: Double] = [:]
        for y in 0 ..< height {
            counts[colourIndex(row: y), default: 0] += perRow
        }
        let total = counts.values.reduce(0, +)
        guard total > 0 else { return [:] }
        return counts.mapValues { $0 / total }
    }

    func finishedRepeatSize(gauge: Gauge) -> (width: Double, height: Double) {
        (gauge.width(forStitches: Double(width)), gauge.length(forRows: Double(totalRows)))
    }

    var legend: [StitchSymbol] {
        let used = Set(symbols)
        return StitchSymbol.allCases.filter { used.contains($0) }
    }

    /// The legend grouped the way the chart colour-codes it, so the key and the
    /// chart are read the same way.
    var legendByCategory: [(category: StitchCategory, symbols: [StitchSymbol])] {
        let used = legend
        var groups: [(category: StitchCategory, symbols: [StitchSymbol])] = []
        for category in StitchCategory.allCases {
            let matching = used.filter { $0.category == category }
            if !matching.isEmpty {
                groups.append((category: category, symbols: matching))
            }
        }
        return groups
    }

    var colourCount: Int {
        guard !rowColours.isEmpty else { return 1 }
        let distinct = Set(rowColours.map { max(0, $0) })
        return max(1, distinct.count)
    }

    var usesColourStripes: Bool { colourCount > 1 }

    // MARK: - Review

    /// Warnings a knitter would want before casting on.
    func validate() -> [String] {
        var warnings: [String] = []

        for y in 0 ..< height {
            let change = netStitchChange(row: y)
            guard change != 0 else { continue }
            let rowName = working == .inTheRound ? "Round \(y + 1)" : "Row \(y + 1)"
            let direction: String = change > 0 ? "gains" : "loses"
            let size = abs(change)
            let stitchWord: String = size == 1 ? "stitch" : "stitches"
            warnings.append(
                "\(rowName) \(direction) \(size) \(stitchWord), so the repeat does not come back to "
                + "the count it started with.")
        }

        if width > 40 {
            warnings.append(
                "The repeat is \(width) stitches wide. Past about 40 it is hard to keep your place — "
                + "consider splitting it into two charts.")
        }

        if colourCount > 2 {
            warnings.append(
                "\(colourCount) colours appear in the chart. Two is comfortable to carry up the side; "
                + "more means cutting and rejoining, or a lot of loose ends.")
        }

        if multipleOf > 1, width % multipleOf != 0 {
            warnings.append(
                "The chart is \(width) stitches wide but the cast-on is set to a multiple of "
                + "\(multipleOf). One of the two is wrong, and the repeat will not meet itself.")
        }

        return warnings
    }

    func plainText(colourNames: [String]) -> String {
        var lines: [String] = []
        lines.append(name)
        if !summary.isEmpty { lines.append(summary) }
        lines.append("")

        let castOnLine: String
        if multipleOf > 1, plusStitches > 0 {
            castOnLine = "Cast on a multiple of \(multipleOf) sts plus \(plusStitches)."
        } else if multipleOf > 1 {
            castOnLine = "Cast on a multiple of \(multipleOf) sts."
        } else {
            castOnLine = "Cast on any number of sts."
        }
        lines.append(castOnLine)
        lines.append(working == .inTheRound ? "Worked in the round." : "Worked flat, back and forth.")
        lines.append("The repeat is \(width) sts wide and \(totalRows) rows tall.")
        if rowsPerChartedRow > 1 {
            lines.append("Each charted row is worked over \(rowsPerChartedRow) rows.")
        }
        lines.append("")

        lines.append(contentsOf: writtenInstructions(colourNames: colourNames))

        let used = legend
        if !used.isEmpty {
            lines.append("")
            lines.append("Legend")
            for entry in used {
                lines.append("\(entry.rightSideAbbreviation) — \(entry.name): \(entry.meaning)")
            }
        }

        if !notes.isEmpty {
            lines.append("")
            lines.append(notes)
        }

        return lines.joined(separator: "\n")
    }
}
