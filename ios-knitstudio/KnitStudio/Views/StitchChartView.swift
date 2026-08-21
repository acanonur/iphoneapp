import SwiftUI

// MARK: - Chart

/// Draws a stitch chart the way a printed pattern does: one cell per stitch,
/// symbols drawn as strokes, colour stripes behind them.
struct StitchChartGridView: View {
    let pattern: StitchPattern
    var palette: [Yarn] = []
    var gauge: Gauge?
    var cellWidth: CGFloat = 20
    var showRowNumbers: Bool = true
    var highlightRow: Int?
    var onTap: ((Int, Int) -> Void)?

    private var cellHeight: CGFloat {
        guard let gauge, gauge.stitchWidth > 0 else { return cellWidth }
        let ratio = gauge.rowHeight / gauge.stitchWidth
        return max(4, cellWidth * ratio)
    }

    private var gridSize: CGSize {
        CGSize(
            width: cellWidth * CGFloat(pattern.width),
            height: cellHeight * CGFloat(pattern.height))
    }

    /// Below this the chart is a thumbnail and the numbers have nowhere to sit.
    private var drawsNumbers: Bool { showRowNumbers && cellWidth >= 14 }

    private var canvasSize: CGSize {
        let gutterWidth: CGFloat = drawsNumbers ? 22 : 0
        let gutterHeight: CGFloat = drawsNumbers ? 16 : 0
        return CGSize(
            width: gridSize.width + gutterWidth,
            height: gridSize.height + gutterHeight)
    }

    var body: some View {
        Canvas { context, _ in
            drawRows(in: context)
            drawGridLines(in: context)
            drawNumbers(in: context)
        }
        .frame(width: canvasSize.width, height: canvasSize.height)
        .contentShape(Rectangle())
        .gesture(tapGesture, including: onTap == nil ? GestureMask.none : GestureMask.all)
    }

    // MARK: - Rows

    private func drawRows(in context: GraphicsContext) {
        for y in 0 ..< pattern.height {
            // Chart row 0 is the bottom row, drawn last from the top.
            let drawY = CGFloat(pattern.height - 1 - y) * cellHeight
            let rowRect = CGRect(x: 0, y: drawY, width: gridSize.width, height: cellHeight)
            context.fill(Path(rowRect), with: .color(rowBackground(y)))
            drawSymbols(in: context, row: y, top: drawY, ink: rowInk(y))
            if let highlightRow, highlightRow == y {
                context.stroke(Path(rowRect), with: .color(Color.accentColor), lineWidth: 2)
            }
        }
    }

    private func drawSymbols(in context: GraphicsContext, row y: Int, top: CGFloat, ink: Color) {
        for x in 0 ..< pattern.width {
            let cell = pattern.symbol(x: x, y: y)
            if cell == .knit { continue }
            if cell == .noStitch, isUnderCable(x: x, y: y) { continue }
            let span = min(cellSpan(for: cell), pattern.width - x)
            let rect = CGRect(
                x: CGFloat(x) * cellWidth,
                y: top,
                width: cellWidth * CGFloat(span),
                height: cellHeight)
            drawSymbol(cell, in: context, rect: rect, colour: ink)
        }
    }

    /// A cable is charted once and the columns it eats follow as "no stitch",
    /// because a printed chart draws one wide crossing across all of them.
    private func cellSpan(for symbol: StitchSymbol) -> Int {
        switch symbol {
        case .cable2Front, .cable2Back: return 4
        case .cable3Front, .cable3Back: return 6
        default: return 1
        }
    }

    /// Those eaten columns are already covered by the crossing, so they must not
    /// be greyed out as if they were a real gap in the chart.
    private func isUnderCable(x: Int, y: Int) -> Bool {
        var back = 1
        while back <= 5, x - back >= 0 {
            let neighbour = pattern.symbol(x: x - back, y: y)
            let span = cellSpan(for: neighbour)
            if span > 1 { return back < span }
            if neighbour != .noStitch { return false }
            back += 1
        }
        return false
    }

    // MARK: - Colours

    private func rowYarn(_ y: Int) -> Yarn? {
        guard !pattern.rowColours.isEmpty, !palette.isEmpty else { return nil }
        let index = min(pattern.colourIndex(row: y), palette.count - 1)
        return palette[max(0, index)]
    }

    /// A plain chart is drawn on the app's own panel colour rather than a fixed
    /// white, so it stays a light neutral in one theme and legible in the other.
    private func rowBackground(_ y: Int) -> Color {
        guard let yarn = rowYarn(y) else { return Color.knitSecondaryBackground }
        return yarn.colour
    }

    private func rowInk(_ y: Int) -> Color {
        guard let yarn = rowYarn(y) else { return Color.primary }
        return yarn.contrastingColour
    }

    // MARK: - Grid

    private func drawGridLines(in context: GraphicsContext) {
        guard cellWidth >= 8 else { return }
        var path = Path()
        for x in 0 ... pattern.width {
            let px = CGFloat(x) * cellWidth
            path.move(to: CGPoint(x: px, y: 0))
            path.addLine(to: CGPoint(x: px, y: gridSize.height))
        }
        for y in 0 ... pattern.height {
            let py = CGFloat(y) * cellHeight
            path.move(to: CGPoint(x: 0, y: py))
            path.addLine(to: CGPoint(x: gridSize.width, y: py))
        }
        context.stroke(path, with: .color(Color.primary.opacity(0.15)), lineWidth: 0.5)

        // Heavier line every ten stitches and rows, as printed charts do.
        var major = Path()
        for x in stride(from: 0, through: pattern.width, by: 10) {
            // Stitch 1 is the rightmost stitch, so the tens are counted from
            // the right edge just as the rows are counted from the bottom.
            let px = CGFloat(pattern.width - x) * cellWidth
            major.move(to: CGPoint(x: px, y: 0))
            major.addLine(to: CGPoint(x: px, y: gridSize.height))
        }
        for y in stride(from: 0, through: pattern.height, by: 10) {
            let py = CGFloat(pattern.height - y) * cellHeight
            major.move(to: CGPoint(x: 0, y: py))
            major.addLine(to: CGPoint(x: gridSize.width, y: py))
        }
        context.stroke(major, with: .color(Color.primary.opacity(0.35)), lineWidth: 1)
    }

    // MARK: - Numbers

    private func drawNumbers(in context: GraphicsContext) {
        guard drawsNumbers else { return }
        let halfCell = cellHeight / 2
        for y in 0 ..< pattern.height {
            let number = rowNumber(y)
            // A short cell has no room for every number, and the odd ones are
            // what a knitter counts by anyway.
            if cellHeight < 16, number % 2 == 0 { continue }
            let drawY = CGFloat(pattern.height - 1 - y) * cellHeight
            let point = CGPoint(x: gridSize.width + 4, y: drawY + halfCell)
            draw(number: number, at: point, anchor: .leading, in: context)
        }
        for x in 0 ..< pattern.width {
            // Stitch 1 is the rightmost stitch: charts count the way they read.
            let number = pattern.width - x
            guard showsStitchNumber(number) else { continue }
            let px = CGFloat(x) * cellWidth + cellWidth / 2
            let point = CGPoint(x: px, y: gridSize.height + 7)
            draw(number: number, at: point, anchor: .center, in: context)
        }
    }

    /// The first row of the pair when one charted row is worked twice.
    private func rowNumber(_ y: Int) -> Int {
        y * pattern.rowsPerChartedRow + 1
    }

    private func showsStitchNumber(_ number: Int) -> Bool {
        if cellWidth >= 22 { return true }
        return number == 1 || number % 5 == 0
    }

    private func draw(number: Int, at point: CGPoint, anchor: UnitPoint, in context: GraphicsContext) {
        let label = Text(String(number)).font(.system(size: 9, weight: .regular, design: .rounded))
        var resolved = context.resolve(label)
        resolved.shading = .color(Color.secondary)
        context.draw(resolved, at: point, anchor: anchor)
    }

    // MARK: - Tapping

    private var tapGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onEnded { value in
                guard let onTap else { return }
                let x = Int(value.location.x / cellWidth)
                let drawnY = Int(value.location.y / cellHeight)
                let y = pattern.height - 1 - drawnY
                guard x >= 0, x < pattern.width, y >= 0, y < pattern.height else { return }
                onTap(x, y)
            }
    }
}

// MARK: - Legend

struct StitchSymbolLegend: View {
    let pattern: StitchPattern

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(pattern.legend) { (symbol: StitchSymbol) in
                HStack(alignment: .top, spacing: 10) {
                    StitchSymbolGlyph(symbol: symbol)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(symbol.rightSideAbbreviation) — \(symbol.name)")
                            .font(.subheadline.weight(.medium))
                        Text(symbol.meaning)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }
}

/// One legend-sized cell, drawn with the strokes the chart itself uses.
private struct StitchSymbolGlyph: View {
    let symbol: StitchSymbol
    var size: CGFloat = 22

    /// A crossing is only recognisable across the cells it spans.
    private var glyphWidth: CGFloat {
        switch symbol {
        case .cable2Front, .cable2Back: return size * 2
        case .cable3Front, .cable3Back: return size * 2.6
        default: return size
        }
    }

    var body: some View {
        Canvas { context, _ in
            let rect = CGRect(x: 0, y: 0, width: glyphWidth, height: size)
            context.fill(Path(rect), with: .color(Color.knitSecondaryBackground))
            drawSymbol(symbol, in: context, rect: rect, colour: Color.primary)
            context.stroke(Path(rect), with: .color(Color.primary.opacity(0.25)), lineWidth: 0.5)
        }
        .frame(width: glyphWidth, height: size)
    }
}

// MARK: - Preview

/// Chart, legend, colours and the numbers a knitter needs before casting on.
struct StitchPatternPreview: View {
    let pattern: StitchPattern
    var palette: [Yarn] = []
    var gauge: Gauge?
    var cellWidth: CGFloat = 20

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            chartPane
            colourStrip
            facts
            impliedRow
            warnings
            legendPane
        }
    }

    @ViewBuilder
    private var chartPane: some View {
        ScrollView([.horizontal, .vertical]) {
            StitchChartGridView(
                pattern: pattern,
                palette: palette,
                gauge: gauge,
                cellWidth: cellWidth)
                .padding(8)
        }
        .frame(maxHeight: 340)
        .background(Color.knitSecondaryBackground, in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private var colourStrip: some View {
        if pattern.usesColourStripes, !palette.isEmpty {
            HStack(spacing: 14) {
                ForEach(stripeIndices, id: \.self) { (index: Int) in
                    let yarn = palette[min(index, palette.count - 1)]
                    HStack(spacing: 6) {
                        YarnSwatch(yarn: yarn, size: 22, label: StitchPattern.letter(for: index))
                        Text(yarn.colourName.isEmpty ? yarn.name : yarn.colourName)
                            .font(.caption)
                            .lineLimit(1)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var facts: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 16) {
                Label(repeatText, systemImage: "grid")
                if let measured = repeatSizeText {
                    Label(measured, systemImage: "ruler")
                }
            }
            Text(castOnRule)
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    @ViewBuilder
    private var impliedRow: some View {
        if let implied = pattern.impliedRowInstruction, !implied.isEmpty {
            NoteBox(kind: .note, text: "One row is left off the chart: \(implied)")
        }
    }

    @ViewBuilder
    private var warnings: some View {
        if !validationNotes.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(validationNotes.enumerated()), id: \.offset) { (entry: (offset: Int, element: String)) in
                    NoteBox(kind: .warning, text: entry.element)
                }
            }
        }
    }

    @ViewBuilder
    private var legendPane: some View {
        if !pattern.legend.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Legend")
                    .font(.headline)
                StitchSymbolLegend(pattern: pattern)
            }
        }
    }

    private var validationNotes: [String] { pattern.validate() }

    private var stripeIndices: [Int] {
        let used = Set(pattern.rowColours.map { (index: Int) in max(0, index) })
        return used.sorted()
    }

    private var repeatText: String {
        "\(pattern.width) sts × \(pattern.totalRows) rows"
    }

    private var repeatSizeText: String? {
        guard let gauge else { return nil }
        let size = pattern.finishedRepeatSize(gauge: gauge)
        let across = String(format: "%.1f", size.width)
        let up = String(format: "%.1f", size.height)
        return "\(across) × \(up) cm at this gauge"
    }

    private var castOnRule: String {
        if pattern.multipleOf > 1, pattern.plusStitches > 0 {
            return "Cast on a multiple of \(pattern.multipleOf) sts plus \(pattern.plusStitches)."
        }
        if pattern.multipleOf > 1 {
            return "Cast on a multiple of \(pattern.multipleOf) sts."
        }
        return "Cast on any number of sts."
    }
}

// MARK: - Row

/// One row per pattern, for pickers and lists.
struct StitchPatternRow: View {
    let pattern: StitchPattern

    private static let thumbnailWidth: CGFloat = 64
    private static let thumbnailHeight: CGFloat = 46

    /// A thumbnail has to fit a list row, so the whole repeat sets the cell size.
    private var thumbnailCell: CGFloat {
        let byWidth = StitchPatternRow.thumbnailWidth / CGFloat(max(1, pattern.width))
        let byHeight = StitchPatternRow.thumbnailHeight / CGFloat(max(1, pattern.height))
        return max(4, min(byWidth, byHeight))
    }

    private var subtitle: String {
        pattern.summary.isEmpty ? "\(pattern.width) sts × \(pattern.totalRows) rows" : pattern.summary
    }

    var body: some View {
        HStack(spacing: 12) {
            StitchChartGridView(
                pattern: pattern,
                cellWidth: thumbnailCell,
                showRowNumbers: false)
                .frame(
                    width: StitchPatternRow.thumbnailWidth,
                    height: StitchPatternRow.thumbnailHeight,
                    alignment: .leading)
                .clipped()
            VStack(alignment: .leading, spacing: 2) {
                Text(pattern.name)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 8)
            DifficultyBadge(difficulty: pattern.difficulty)
        }
    }
}

// MARK: - Symbol drawing

/// Every symbol is stroked inside the cell it was charted in, so the chart can
/// be read at the size a printed one is read at.
private func drawSymbol(
    _ symbol: StitchSymbol,
    in context: GraphicsContext,
    rect: CGRect,
    colour: Color
) {
    switch symbol {
    case .knit: drawKnit(context, rect, colour)
    case .purl: drawPurl(context, rect, colour)
    case .yarnOver: drawYarnOver(context, rect, colour)
    case .k2tog: drawK2tog(context, rect, colour)
    case .ssk: drawSSK(context, rect, colour)
    case .cdd: drawCDD(context, rect, colour)
    case .k3tog: drawK3tog(context, rect, colour)
    case .make1: drawMake1(context, rect, colour)
    case .slip: drawSlip(context, rect, colour)
    case .slipWyif: drawSlipWyif(context, rect, colour)
    case .cable2Front: drawCable2Front(context, rect, colour)
    case .cable2Back: drawCable2Back(context, rect, colour)
    case .cable3Front: drawCable3Front(context, rect, colour)
    case .cable3Back: drawCable3Back(context, rect, colour)
    case .bobble: drawBobble(context, rect, colour)
    case .noStitch: drawNoStitch(context, rect, colour)
    }
}

private func symbolBox(_ rect: CGRect) -> CGRect {
    let inset = min(rect.width, rect.height) * 0.24
    return rect.insetBy(dx: inset, dy: inset)
}

private func centredSquare(_ rect: CGRect, fraction: CGFloat) -> CGRect {
    let side = min(rect.width, rect.height) * fraction
    let half = side / 2
    let originX = rect.midX - half
    let originY = rect.midY - half
    return CGRect(x: originX, y: originY, width: side, height: side)
}

private func symbolStroke(_ rect: CGRect) -> StrokeStyle {
    let smaller = min(rect.width, rect.height)
    let width = max(1, smaller * 0.11)
    return StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round)
}

/// An empty square is a knit — the one symbol every chart leaves undrawn.
private func drawKnit(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
}

private func drawPurl(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    let box = symbolBox(rect)
    var path = Path()
    path.move(to: CGPoint(x: box.minX, y: box.midY))
    path.addLine(to: CGPoint(x: box.maxX, y: box.midY))
    context.stroke(path, with: .color(colour), style: symbolStroke(rect))
}

private func drawYarnOver(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    let circle = centredSquare(rect, fraction: 0.52)
    context.stroke(Path(ellipseIn: circle), with: .color(colour), style: symbolStroke(rect))
}

private func drawK2tog(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    let box = symbolBox(rect)
    var path = Path()
    path.move(to: CGPoint(x: box.minX, y: box.maxY))
    path.addLine(to: CGPoint(x: box.maxX, y: box.minY))
    context.stroke(path, with: .color(colour), style: symbolStroke(rect))
}

private func drawSSK(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    let box = symbolBox(rect)
    var path = Path()
    path.move(to: CGPoint(x: box.minX, y: box.minY))
    path.addLine(to: CGPoint(x: box.maxX, y: box.maxY))
    context.stroke(path, with: .color(colour), style: symbolStroke(rect))
}

/// A peak with a stem: both neighbours lean in over the centre stitch, which is
/// what a centred double decrease does to the fabric.
private func drawCDD(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    let box = symbolBox(rect)
    let peak = CGPoint(x: box.midX, y: box.minY)
    var path = Path()
    path.move(to: CGPoint(x: box.minX, y: box.maxY))
    path.addLine(to: peak)
    path.addLine(to: CGPoint(x: box.maxX, y: box.maxY))
    path.move(to: peak)
    path.addLine(to: CGPoint(x: box.midX, y: box.maxY))
    context.stroke(path, with: .color(colour), style: symbolStroke(rect))
}

/// The k2tog slash with a bar through it: one more stitch taken in.
private func drawK3tog(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    let box = symbolBox(rect)
    let barHalf = box.width * 0.28
    var path = Path()
    path.move(to: CGPoint(x: box.minX, y: box.maxY))
    path.addLine(to: CGPoint(x: box.maxX, y: box.minY))
    path.move(to: CGPoint(x: box.midX - barHalf, y: box.midY))
    path.addLine(to: CGPoint(x: box.midX + barHalf, y: box.midY))
    context.stroke(path, with: .color(colour), style: symbolStroke(rect))
}

/// An arch, the shape of the bar lifted onto the needle.
private func drawMake1(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    let box = symbolBox(rect)
    let lift = box.minY - box.height * 0.35
    var path = Path()
    path.move(to: CGPoint(x: box.minX, y: box.maxY))
    path.addQuadCurve(
        to: CGPoint(x: box.maxX, y: box.maxY),
        control: CGPoint(x: box.midX, y: lift))
    context.stroke(path, with: .color(colour), style: symbolStroke(rect))
}

private func drawSlip(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    let box = symbolBox(rect)
    var path = Path()
    path.move(to: CGPoint(x: box.minX, y: box.minY))
    path.addLine(to: CGPoint(x: box.midX, y: box.maxY))
    path.addLine(to: CGPoint(x: box.maxX, y: box.minY))
    context.stroke(path, with: .color(colour), style: symbolStroke(rect))
}

/// The slip V with a bar across it: the yarn carried over the front of the work.
private func drawSlipWyif(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    drawSlip(context, rect, colour)
    let box = symbolBox(rect)
    let barHalf = box.width * 0.34
    var path = Path()
    path.move(to: CGPoint(x: box.midX - barHalf, y: box.midY))
    path.addLine(to: CGPoint(x: box.midX + barHalf, y: box.midY))
    context.stroke(path, with: .color(colour), style: symbolStroke(rect))
}

private func drawBobble(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    let circle = centredSquare(rect, fraction: 0.44)
    context.fill(Path(ellipseIn: circle), with: .color(colour))
}

/// A charted gap, greyed and hatched so it is never mistaken for a knit.
private func drawNoStitch(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    context.fill(Path(rect), with: .color(Color.secondary.opacity(0.30)))
    let step = max(4, rect.width / 2)
    var hatch = Path()
    var offset = -rect.height
    while offset < rect.width {
        let footX = rect.minX + offset
        hatch.move(to: CGPoint(x: footX, y: rect.maxY))
        hatch.addLine(to: CGPoint(x: footX + rect.height, y: rect.minY))
        offset += step
    }
    var clipped = context
    clipped.clip(to: Path(rect))
    clipped.stroke(hatch, with: .color(colour.opacity(0.45)), lineWidth: 0.75)
}

// MARK: - Cables

private func drawCable2Front(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    drawCableCross(context, rect, colour, leftOverRight: true)
}

private func drawCable2Back(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    drawCableCross(context, rect, colour, leftOverRight: false)
}

private func drawCable3Front(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    drawCableCross(context, rect, colour, leftOverRight: true)
}

private func drawCable3Back(_ context: GraphicsContext, _ rect: CGRect, _ colour: Color) {
    drawCableCross(context, rect, colour, leftOverRight: false)
}

/// Two strands crossing across the whole width of the crossing. The strand held
/// at the front is drawn last and heavier, so the chart shows which way the
/// cable leans without reading the abbreviation.
private func drawCableCross(
    _ context: GraphicsContext,
    _ rect: CGRect,
    _ colour: Color,
    leftOverRight: Bool
) {
    let insetX = rect.width * 0.08
    let insetY = rect.height * 0.20
    let box = rect.insetBy(dx: insetX, dy: insetY)
    guard box.width > 0, box.height > 0 else { return }

    var rising = Path()
    rising.move(to: CGPoint(x: box.minX, y: box.maxY))
    rising.addCurve(
        to: CGPoint(x: box.maxX, y: box.minY),
        control1: CGPoint(x: box.midX, y: box.maxY),
        control2: CGPoint(x: box.midX, y: box.minY))

    var falling = Path()
    falling.move(to: CGPoint(x: box.minX, y: box.minY))
    falling.addCurve(
        to: CGPoint(x: box.maxX, y: box.maxY),
        control1: CGPoint(x: box.midX, y: box.minY),
        control2: CGPoint(x: box.midX, y: box.maxY))

    let behind: Path = leftOverRight ? rising : falling
    let inFront: Path = leftOverRight ? falling : rising

    let thin = max(1, rect.height * 0.09)
    let thick = max(1.5, rect.height * 0.16)
    context.stroke(
        behind,
        with: .color(colour.opacity(0.55)),
        style: StrokeStyle(lineWidth: thin, lineCap: .round))
    context.stroke(
        inFront,
        with: .color(colour),
        style: StrokeStyle(lineWidth: thick, lineCap: .round))
}
