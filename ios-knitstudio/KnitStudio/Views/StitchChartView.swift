import SwiftUI

// MARK: - Chart

/// Draws a stitch chart the way a printed pattern does: one cell per stitch,
/// symbols drawn as strokes, colour stripes behind them.
struct StitchChartGridView: View {
    let pattern: StitchPattern
    var palette: [Yarn] = []
    var gauge: Gauge?
    var cellWidth: CGFloat = 20
    var symbolStyle: ChartSymbolStyle = .letters
    var showRowNumbers: Bool = true
    /// The colour letter down the left edge. A chart whose rows differ only by
    /// yarn colour is unreadable without it, and unreadable to a colourblind
    /// knitter with it.
    var showColourGutter: Bool = true
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

    /// Only worth a gutter when the pattern actually changes colour.
    private var drawsColourGutter: Bool {
        showColourGutter && pattern.usesColourStripes && !palette.isEmpty && cellWidth >= 12
    }

    private var colourGutterWidth: CGFloat { drawsColourGutter ? 18 : 0 }

    private var canvasSize: CGSize {
        let numberWidth: CGFloat = drawsNumbers ? 22 : 0
        let gutterHeight: CGFloat = drawsNumbers ? 16 : 0
        return CGSize(
            width: colourGutterWidth + gridSize.width + numberWidth,
            height: gridSize.height + gutterHeight)
    }

    var body: some View {
        Canvas { context, _ in
            drawRows(in: context)
            drawGridLines(in: context)
            drawNumbers(in: context)
            drawColourGutter(in: context)
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
            let rowRect = CGRect(
                x: colourGutterWidth, y: drawY, width: gridSize.width, height: cellHeight)
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
            // In the traditional style a knit is an empty square. In the letters
            // style it is spelled out, because an empty square tells a knitter
            // who has not learned the glyphs nothing at all.
            if cell == .knit, symbolStyle == .symbols { continue }
            if cell == .noStitch, isUnderCable(x: x, y: y) { continue }
            let span = min(cellSpan(for: cell), pattern.width - x)
            let rect = CGRect(
                x: colourGutterWidth + CGFloat(x) * cellWidth,
                y: top,
                width: cellWidth * CGFloat(span),
                height: cellHeight)
            switch symbolStyle {
            case .letters:
                drawLetter(cell, in: context, rect: rect, over: rowBackground(y))
            case .symbols:
                drawSymbol(cell, in: context, rect: rect, colour: ink)
            }
        }
    }

    /// The letters style carries three things at once: the yarn is the cell
    /// background, the stitch is the text, and what the stitch *does* is the
    /// colour of the text. They are three separate channels so none of them has
    /// to be guessed from the others.
    private func drawLetter(
        _ cell: StitchSymbol,
        in context: GraphicsContext,
        rect: CGRect,
        over background: Color
    ) {
        if cell == .noStitch {
            drawNoStitch(context, rect, Color.secondary)
            return
        }

        let tint = Color(hex: cell.category.tintHex)
        let label = cell.chartLabel
        guard !label.isEmpty else { return }
        let size = letterSize(for: label, in: rect)
        guard size >= 5 else {
            // Too small for text. The category wash alone still shows the shape
            // of the pattern, which is all a thumbnail needs to do.
            if cell != .knit {
                context.fill(Path(rect.insetBy(dx: 0.5, dy: 0.5)), with: .color(tint.opacity(0.45)))
            }
            return
        }

        // The chip is sized to the text, not to the cell, so the yarn colour
        // still shows around it — the row colour and the stitch are two
        // separate things to read and neither may hide the other.
        let chipWidth = min(rect.width - 2, size * 0.66 * CGFloat(label.count) + size * 0.55)
        let chipHeight = min(rect.height - 2, size * 1.34)
        let chip = CGRect(
            x: rect.midX - chipWidth / 2,
            y: rect.midY - chipHeight / 2,
            width: chipWidth,
            height: chipHeight)
        let shape = RoundedRectangle(cornerRadius: chipHeight * 0.32)

        // A dark yarn swallows a dark letter, so it gets a pale chip to sit on.
        let onDarkYarn = backgroundIsDark(background)
        if onDarkYarn {
            context.fill(shape.path(in: chip), with: .color(Color.white.opacity(0.92)))
        } else if cell != .knit {
            // Knit is the quiet default; anything else is worth noticing.
            context.fill(shape.path(in: chip), with: .color(tint.opacity(0.15)))
        }

        let text = Text(label).font(.system(size: size, weight: .semibold, design: .rounded))
        var resolved = context.resolve(text)
        resolved.shading = .color(tint)
        context.draw(resolved, at: CGPoint(x: rect.midX, y: rect.midY), anchor: .center)
    }

    /// Shrink the text until the longest label fits its cell.
    private func letterSize(for label: String, in rect: CGRect) -> CGFloat {
        let byHeight = rect.height * 0.62
        let byWidth = rect.width / CGFloat(max(1, label.count)) * 1.35
        return min(12, min(byHeight, byWidth))
    }

    private func backgroundIsDark(_ colour: Color) -> Bool {
        Yarn(name: "", hex: colour.knitHex, weight: .light).relativeLuminance < 0.42
    }

    // MARK: - Colour gutter

    /// A letter per row saying which yarn it is worked in. The row background
    /// already carries the colour, but two close colours look the same and some
    /// knitters cannot tell them apart at all.
    private func drawColourGutter(in context: GraphicsContext) {
        guard drawsColourGutter else { return }
        for y in 0 ..< pattern.height {
            let drawY = CGFloat(pattern.height - 1 - y) * cellHeight
            let rect = CGRect(x: 0, y: drawY, width: colourGutterWidth - 3, height: cellHeight)
            guard let yarn = rowYarn(y) else { continue }
            context.fill(Path(rect), with: .color(yarn.colour))
            context.stroke(Path(rect), with: .color(Color.primary.opacity(0.18)), lineWidth: 0.5)

            guard cellHeight >= 9 else { continue }
            let letter = StitchPattern.letter(for: pattern.colourIndex(row: y))
            let size = min(9, cellHeight * 0.62)
            let text = Text(letter).font(.system(size: size, weight: .bold, design: .rounded))
            var resolved = context.resolve(text)
            resolved.shading = .color(yarn.contrastingColour)
            context.draw(resolved, at: CGPoint(x: rect.midX, y: rect.midY), anchor: .center)
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
            let px = colourGutterWidth + CGFloat(x) * cellWidth
            path.move(to: CGPoint(x: px, y: 0))
            path.addLine(to: CGPoint(x: px, y: gridSize.height))
        }
        for y in 0 ... pattern.height {
            let py = CGFloat(y) * cellHeight
            path.move(to: CGPoint(x: colourGutterWidth, y: py))
            path.addLine(to: CGPoint(x: colourGutterWidth + gridSize.width, y: py))
        }
        context.stroke(path, with: .color(Color.primary.opacity(0.15)), lineWidth: 0.5)

        // Heavier line every ten stitches and rows, as printed charts do.
        var major = Path()
        for x in stride(from: 0, through: pattern.width, by: 10) {
            // Stitch 1 is the rightmost stitch, so the tens are counted from
            // the right edge just as the rows are counted from the bottom.
            let px = colourGutterWidth + CGFloat(pattern.width - x) * cellWidth
            major.move(to: CGPoint(x: px, y: 0))
            major.addLine(to: CGPoint(x: px, y: gridSize.height))
        }
        for y in stride(from: 0, through: pattern.height, by: 10) {
            let py = CGFloat(pattern.height - y) * cellHeight
            major.move(to: CGPoint(x: colourGutterWidth, y: py))
            major.addLine(to: CGPoint(x: colourGutterWidth + gridSize.width, y: py))
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
            let point = CGPoint(x: colourGutterWidth + gridSize.width + 4, y: drawY + halfCell)
            draw(number: number, at: point, anchor: .leading, in: context)
        }
        for x in 0 ..< pattern.width {
            // Stitch 1 is the rightmost stitch: charts count the way they read.
            let number = pattern.width - x
            guard showsStitchNumber(number) else { continue }
            let px = colourGutterWidth + CGFloat(x) * cellWidth + cellWidth / 2
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
                // The gutter is not part of the grid, so a tap in it is not a cell.
                let inGrid = value.location.x - colourGutterWidth
                guard inGrid >= 0 else { return }
                let x = Int(inGrid / cellWidth)
                let drawnY = Int(value.location.y / cellHeight)
                let y = pattern.height - 1 - drawnY
                guard x >= 0, x < pattern.width, y >= 0, y < pattern.height else { return }
                onTap(x, y)
            }
    }
}

// MARK: - Legend

/// The key. Grouped by what the stitches do, and colour-coded to match the
/// chart, so the two are read the same way round. Both the letter and the
/// printed glyph are shown for every stitch — whichever style the chart is set
/// to, the other one is the one you will meet in a published pattern.
struct StitchSymbolLegend: View {
    let pattern: StitchPattern

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array(pattern.legendByCategory.enumerated()), id: \.offset) { entry in
                categorySection(entry.element.category, symbols: entry.element.symbols)
            }
        }
    }

    @ViewBuilder
    private func categorySection(
        _ category: StitchCategory,
        symbols: [StitchSymbol]
    ) -> some View {
        let tint = Color(hex: category.tintHex)
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Circle()
                    .fill(tint)
                    .frame(width: 8, height: 8)
                Text(category.name)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(tint)
            }
            ForEach(symbols) { (symbol: StitchSymbol) in
                HStack(alignment: .top, spacing: 10) {
                    StitchLetterChip(symbol: symbol)
                    StitchSymbolGlyph(symbol: symbol)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(symbol.rightSideAbbreviation) — \(symbol.name)")
                            .font(.subheadline.weight(.medium))
                        Text(symbol.meaning)
                            .font(.caption)
                            .foregroundStyle(Color.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }
}

/// The letter as the chart draws it, in its category colour.
struct StitchLetterChip: View {
    let symbol: StitchSymbol
    var size: CGFloat = 24

    var body: some View {
        let tint = Color(hex: symbol.category.tintHex)
        Text(symbol.chartLabel.isEmpty ? "—" : symbol.chartLabel)
            .font(.system(size: size * 0.42, weight: .semibold, design: .rounded))
            .foregroundStyle(tint)
            .minimumScaleFactor(0.6)
            .lineLimit(1)
            .frame(width: size * 1.5, height: size)
            .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: 5))
    }
}

/// Which yarn is which. The chart paints the row in the yarn's own colour, but
/// two close colours look the same and some knitters cannot separate them at
/// all, so every colour also gets a letter.
struct ChartColourKey: View {
    let palette: [Yarn]
    var usedIndices: [Int] = []

    private var entries: [(index: Int, yarn: Yarn)] {
        let wanted = usedIndices.isEmpty ? Array(palette.indices) : usedIndices
        return wanted.compactMap { (index: Int) -> (index: Int, yarn: Yarn)? in
            guard index >= 0, index < palette.count else { return nil }
            return (index: index, yarn: palette[index])
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(entries.enumerated()), id: \.offset) { entry in
                HStack(spacing: 8) {
                    YarnSwatch(
                        yarn: entry.element.yarn,
                        size: 24,
                        label: StitchPattern.letter(for: entry.element.index))
                    Text(entry.element.yarn.displayName)
                        .font(.caption)
                        .lineLimit(1)
                }
            }
            ForEach(Yarn.contrastWarnings(for: entries.map(\.yarn)), id: \.self) { (warning: String) in
                NoteBox(kind: .warning, text: warning)
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
    var symbolStyle: ChartSymbolStyle = .letters

    @State private var style: ChartSymbolStyle?

    /// The picker overrides the caller's choice for as long as this view lives.
    private var activeStyle: ChartSymbolStyle { style ?? symbolStyle }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            stylePicker
            chartPane
            colourStrip
            facts
            impliedRow
            warnings
            legendPane
        }
    }

    private var styleBinding: Binding<ChartSymbolStyle> {
        Binding(
            get: { activeStyle },
            set: { (chosen: ChartSymbolStyle) in style = chosen })
    }

    @ViewBuilder
    private var stylePicker: some View {
        VStack(alignment: .leading, spacing: 4) {
            Picker("Chart style", selection: styleBinding) {
                ForEach(ChartSymbolStyle.allCases) { (option: ChartSymbolStyle) in
                    Text(option.name).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            Text(activeStyle.explanation)
                .font(.caption)
                .foregroundStyle(Color.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private var chartPane: some View {
        ScrollView([.horizontal, .vertical]) {
            StitchChartGridView(
                pattern: pattern,
                palette: palette,
                gauge: gauge,
                cellWidth: cellWidth,
                symbolStyle: activeStyle)
                .padding(8)
        }
        .frame(maxHeight: 340)
        .background(Color.knitSecondaryBackground, in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private var colourStrip: some View {
        if pattern.usesColourStripes, !palette.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Colours")
                    .font(.subheadline.weight(.semibold))
                ChartColourKey(palette: palette, usedIndices: stripeIndices)
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
                Text("Cells are coloured by what the stitch does, not by which stitch it is.")
                    .font(.caption)
                    .foregroundStyle(Color.secondary)
                    .fixedSize(horizontal: false, vertical: true)
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
                showRowNumbers: false,
                showColourGutter: false)
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
