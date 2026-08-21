import SwiftUI

/// One yarn colour together with the shades a knitted loop needs: the flat
/// colour of the ground, the shadow between the legs of a stitch and the light
/// that catches the top of a purl bump.
private struct FabricInk {
    let red: Double
    let green: Double
    let blue: Double

    init(hex: String) {
        let value = UInt32(Yarn.normalise(hex: hex), radix: 16) ?? 0x9E9E9E
        red = Double((value >> 16) & 0xFF) / 255
        green = Double((value >> 8) & 0xFF) / 255
        blue = Double(value & 0xFF) / 255
    }

    /// Multiplying alone leaves a near-black yarn perfectly flat, so a
    /// highlight adds a little light of its own on top of the multiplication.
    func shaded(_ factor: Double) -> Color {
        let lift = factor > 1 ? (factor - 1) * 0.30 : 0
        let r = FabricInk.clamped(red * factor + lift)
        let g = FabricInk.clamped(green * factor + lift)
        let b = FabricInk.clamped(blue * factor + lift)
        return Color(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }

    private static func clamped(_ value: Double) -> Double {
        min(1, max(0, value))
    }
}

/// Draws what the knitted fabric will actually look like: every stitch is a
/// V, purls are bumps, and the proportions come from the knitter's own gauge.
struct FabricSimulationView: View {
    let pattern: StitchPattern
    let palette: [Yarn]
    let gauge: Gauge
    var stitchesWide: Int = 40
    var rowsHigh: Int = 30
    var stitchWidth: CGFloat = 16
    var showsNeedle: Bool = false

    // A Canvas redrawing thousands of paths on every slider tick is the one way
    // this screen can feel broken, so the swatch is capped before it is drawn.
    private static let maximumCells = 3000
    private static let undyedWool = "CFC6B4"

    var body: some View {
        Canvas { context, _ in
            drawFabric(in: context)
        }
        .frame(width: canvasSize.width, height: canvasSize.height)
        .accessibilityElement()
        .accessibilityLabel(Text(accessibilityDescription))
    }

    // MARK: - How much fabric is drawn

    static func columnsDrawn(stitchesWide: Int) -> Int {
        min(max(1, stitchesWide), 400)
    }

    /// Rows go rather than stitches when the swatch would cost more than the
    /// drawing budget: a swatch narrower than the repeat shows the knitter
    /// nothing, a shorter one still shows the pattern.
    static func rowsDrawn(stitchesWide: Int, rowsHigh: Int) -> Int {
        let across = columnsDrawn(stitchesWide: stitchesWide)
        let allowed = max(1, maximumCells / across)
        return max(1, min(max(1, rowsHigh), allowed))
    }

    private var columns: Int {
        FabricSimulationView.columnsDrawn(stitchesWide: stitchesWide)
    }

    private var rows: Int {
        FabricSimulationView.rowsDrawn(stitchesWide: stitchesWide, rowsHigh: rowsHigh)
    }

    // MARK: - Geometry

    private var cellWidth: CGFloat {
        max(3, stitchWidth)
    }

    /// A knitted stitch is wider than it is tall, and taking that from the
    /// knitter's own row gauge is what makes the picture read as knitting
    /// rather than as a spreadsheet.
    private var cellHeight: CGFloat {
        guard gauge.stitchWidth > 0 else { return cellWidth }
        let ratio = CGFloat(gauge.rowHeight / gauge.stitchWidth)
        return max(3, cellWidth * ratio)
    }

    /// Real stitch legs sit inside the loops of the row below, so every cell is
    /// drawn taller than its own row and the rows are painted from the bottom
    /// up, letting each row close over the one beneath it.
    private var overlap: CGFloat {
        cellHeight * 0.15
    }

    /// The band above the fabric that the needle sits in.
    private var fabricTop: CGFloat {
        showsNeedle ? cellHeight * 0.62 : 0
    }

    private var canvasSize: CGSize {
        let width = cellWidth * CGFloat(columns)
        let height = fabricTop + cellHeight * CGFloat(rows) + overlap
        return CGSize(width: width, height: height)
    }

    private var accessibilityDescription: String {
        "A drawing of \(pattern.name) knitted up, \(columns) stitches across and \(rows) rows tall."
    }

    // MARK: - Reading the chart

    /// One charted row can stand for more than one knitted row, so the fabric
    /// is taller than the chart it came from.
    private func chartedRow(for fabricRow: Int) -> Int {
        let perChartedRow = max(1, pattern.rowsPerChartedRow)
        let charted = fabricRow / perChartedRow
        let height = max(1, pattern.height)
        return ((charted % height) + height) % height
    }

    /// The repeat carried on sideways for ever, seen from the right side. The
    /// pattern has already accounted for wrong-side-charted rows.
    private func appearance(x: Int, chartedRow: Int) -> StitchSymbol {
        let width = max(1, pattern.width)
        let column = ((x % width) + width) % width
        return pattern.rightSideAppearance(x: column, y: chartedRow)
    }

    private func rowInk(_ chartedRow: Int) -> FabricInk {
        guard !palette.isEmpty else { return FabricInk(hex: FabricSimulationView.undyedWool) }
        let index = pattern.colourIndex(row: chartedRow)
        let safe = min(max(0, index), palette.count - 1)
        return FabricInk(hex: palette[safe].hex)
    }

    /// A small, repeatable difference in brightness per stitch. Hand knitting
    /// is never mechanically even, but a random number generator would make the
    /// fabric flicker on every redraw, so this is hashed from the coordinates.
    private static func wobble(x: Int, y: Int) -> Double {
        var hash = UInt64(truncatingIfNeeded: x &* 73_856_093)
        hash ^= UInt64(truncatingIfNeeded: y &* 19_349_663)
        hash = hash &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
        hash ^= hash >> 33
        let fraction = Double(hash % 512) / 512
        return 0.95 + fraction * 0.10
    }

    // MARK: - Drawing the fabric

    private func drawFabric(in context: GraphicsContext) {
        // Fine detail costs a path per stitch and disappears below about a
        // centimetre of screen, so it is dropped when the swatch is zoomed out.
        let detailed = cellWidth >= 11

        if showsNeedle {
            drawNeedle(in: context)
            drawLoopsOverNeedle(in: context)
        }

        for row in 0 ..< rows {
            let top = fabricTop + CGFloat(rows - 1 - row) * cellHeight
            let charted = chartedRow(for: row)
            let colour = rowInk(charted)
            var x = 0
            while x < columns {
                let cell = appearance(x: x, chartedRow: charted)
                let rect = CGRect(
                    x: CGFloat(x) * cellWidth,
                    y: top,
                    width: cellWidth,
                    height: cellHeight + overlap)
                switch cell {
                case .cable2Front, .cable2Back, .cable3Front, .cable3Back:
                    let span = cableSpan(from: x, chartedRow: charted, symbol: cell)
                    let groupRect = CGRect(
                        x: rect.minX,
                        y: rect.minY,
                        width: cellWidth * CGFloat(span),
                        height: rect.height)
                    let leansLeft = cell == .cable2Front || cell == .cable3Front
                    drawCable(
                        in: context, rect: groupRect, span: span, ink: colour,
                        leansLeft: leansLeft, x: x, y: row, detailed: detailed)
                    x += span
                default:
                    var cellInk = colour
                    if (cell == .slip || cell == .slipWyif) && pattern.usesColourStripes {
                        // A slipped stitch was not worked on this row, so it
                        // still shows the colour it was knitted in.
                        cellInk = rowInk(charted - 1)
                    }
                    drawCell(cell, in: context, rect: rect, ink: cellInk, x: x, y: row, detailed: detailed)
                    x += 1
                }
            }
        }
    }

    /// How many cells one cable crossing covers, so the group is drawn as a
    /// pair of bands crossing rather than as a row of unrelated cells.
    private func cableSpan(from x: Int, chartedRow: Int, symbol: StitchSymbol) -> Int {
        let wanted = max(2, symbol.produces)
        var span = 1
        while span < wanted, x + span < columns {
            // A chart draws one cable cell and fills the columns it eats with
            // "no stitch", so those fillers belong to the crossing as well.
            let next = appearance(x: x + span, chartedRow: chartedRow)
            guard next == symbol || next == .noStitch else { break }
            span += 1
        }
        return span
    }

    private func drawCell(
        _ cell: StitchSymbol,
        in context: GraphicsContext,
        rect: CGRect,
        ink: FabricInk,
        x: Int,
        y: Int,
        detailed: Bool
    ) {
        let wobble = FabricSimulationView.wobble(x: x, y: y)
        switch cell {
        case .noStitch:
            return
        case .knit:
            drawKnitV(in: context, rect: rect, ink: ink, wobble: wobble, detailed: detailed)
        case .make1:
            drawKnitV(in: context, rect: rect, ink: ink, wobble: wobble, narrow: 0.16, detailed: detailed)
        case .purl:
            drawPurlBump(in: context, rect: rect, ink: ink, wobble: wobble, detailed: detailed)
        case .yarnOver:
            drawYarnOver(in: context, rect: rect, ink: ink, wobble: wobble)
        case .k2tog:
            drawKnitV(in: context, rect: rect, ink: ink, wobble: wobble, lean: 0.20, detailed: detailed)
        case .ssk:
            drawKnitV(in: context, rect: rect, ink: ink, wobble: wobble, lean: -0.20, detailed: detailed)
        case .k3tog:
            drawKnitV(in: context, rect: rect, ink: ink, wobble: wobble, lean: 0.32, detailed: detailed)
        case .cdd:
            drawKnitV(in: context, rect: rect, ink: ink, wobble: wobble, narrow: 0.34, detailed: detailed)
        case .slip, .slipWyif:
            // A slipped stitch is pulled up over the row it skipped, so its V
            // is long and narrow.
            drawKnitV(
                in: context, rect: rect, ink: ink, wobble: wobble,
                narrow: 0.20, depth: 0.86, detailed: detailed)
        case .bobble:
            drawBobble(in: context, rect: rect, ink: ink, wobble: wobble)
        case .cable2Front, .cable2Back, .cable3Front, .cable3Back:
            drawKnitV(in: context, rect: rect, ink: ink, wobble: wobble, detailed: detailed)
        }
    }

    // MARK: - Stitch shapes

    /// A knit stitch seen from the right side: two legs falling from the top
    /// corners to a point below the middle, bowed outwards the way yarn under
    /// tension actually sits. `lean` slides the point sideways for a decrease.
    private func drawKnitV(
        in context: GraphicsContext,
        rect: CGRect,
        ink: FabricInk,
        wobble: Double,
        lean: CGFloat = 0,
        narrow: CGFloat = 0,
        depth: CGFloat = 0.58,
        detailed: Bool = true
    ) {
        context.fill(Path(rect), with: .color(ink.shaded(wobble)))

        let width = rect.width
        let height = rect.height
        let inset = width * (0.10 + narrow * 0.50)
        let slide = width * lean
        let topY = rect.minY + height * 0.02
        let waistY = rect.minY + height * 0.42

        let leftTop = CGPoint(x: rect.minX + inset + slide * 0.35, y: topY)
        let rightTop = CGPoint(x: rect.maxX - inset + slide * 0.35, y: topY)
        let point = CGPoint(x: rect.midX + slide, y: rect.minY + height * depth)
        let leftControl = CGPoint(x: rect.minX + inset * 0.65 + slide * 0.6, y: waistY)
        let rightControl = CGPoint(x: rect.maxX - inset * 0.65 + slide * 0.6, y: waistY)

        var legs = Path()
        legs.move(to: leftTop)
        legs.addQuadCurve(to: point, control: leftControl)
        legs.addQuadCurve(to: rightTop, control: rightControl)

        let legWidth = max(0.6, width * 0.26)
        let legStyle = StrokeStyle(lineWidth: legWidth, lineCap: .round, lineJoin: .round)
        context.stroke(legs, with: .color(ink.shaded(wobble * 0.74)), style: legStyle)

        guard detailed else { return }

        // A thin light line down the inside of the left leg is the sheen that
        // stops a flat V looking like ink on paper.
        let sheenTop = CGPoint(x: leftTop.x + width * 0.07, y: leftTop.y + height * 0.08)
        let sheenEnd = CGPoint(x: point.x - width * 0.03, y: point.y - height * 0.10)
        let sheenControl = CGPoint(x: leftControl.x + width * 0.11, y: leftControl.y)
        var sheen = Path()
        sheen.move(to: sheenTop)
        sheen.addQuadCurve(to: sheenEnd, control: sheenControl)
        let sheenStyle = StrokeStyle(lineWidth: max(0.4, width * 0.07), lineCap: .round)
        context.stroke(sheen, with: .color(ink.shaded(wobble * 1.18)), style: sheenStyle)
    }

    /// A purl is the same loop lying on its side: a fat bump lit along the top
    /// and in shadow underneath, which is the only thing that tells the eye it
    /// is standing proud of the fabric.
    private func drawPurlBump(
        in context: GraphicsContext,
        rect: CGRect,
        ink: FabricInk,
        wobble: Double,
        detailed: Bool
    ) {
        context.fill(Path(rect), with: .color(ink.shaded(wobble * 0.86)))

        let width = rect.width
        let height = rect.height
        let restY = rect.minY + height * 0.50
        let left = CGPoint(x: rect.minX - width * 0.04, y: restY)
        let right = CGPoint(x: rect.maxX + width * 0.04, y: restY)
        let crest = CGPoint(x: rect.midX, y: rect.minY + height * 0.26)

        var bump = Path()
        bump.move(to: left)
        bump.addQuadCurve(to: right, control: crest)

        let shades: [Color] = [ink.shaded(wobble * 1.24), ink.shaded(wobble * 0.68)]
        let gradient = Gradient(colors: shades)
        let lit = CGPoint(x: rect.midX, y: rect.minY + height * 0.16)
        let shadowed = CGPoint(x: rect.midX, y: rect.minY + height * 0.86)
        let shading: GraphicsContext.Shading = .linearGradient(gradient, startPoint: lit, endPoint: shadowed)
        let bumpStyle = StrokeStyle(lineWidth: max(1, height * 0.44), lineCap: .round)
        context.stroke(bump, with: shading, style: bumpStyle)

        guard detailed else { return }

        // The groove where the next bump starts.
        let grooveY = rect.minY + height * 0.90
        var groove = Path()
        groove.move(to: CGPoint(x: rect.minX, y: grooveY))
        groove.addLine(to: CGPoint(x: rect.maxX, y: grooveY))
        context.stroke(groove, with: .color(ink.shaded(wobble * 0.60)), lineWidth: max(0.4, height * 0.05))
    }

    /// A yarn over is a hole. Clearing the fabric rather than painting over it
    /// means the swatch really does show through to whatever is behind it.
    private func drawYarnOver(
        in context: GraphicsContext,
        rect: CGRect,
        ink: FabricInk,
        wobble: Double
    ) {
        context.fill(Path(rect), with: .color(ink.shaded(wobble)))

        let inset = rect.width * 0.20
        let hole = CGRect(
            x: rect.minX + inset,
            y: rect.minY + rect.height * 0.26,
            width: rect.width - inset * 2,
            height: rect.height * 0.44)
        let ring = Path(ellipseIn: hole)

        var punch = context
        punch.blendMode = .destinationOut
        punch.fill(ring, with: .color(.black))

        let rimWidth = max(0.6, rect.width * 0.17)
        context.stroke(ring, with: .color(ink.shaded(wobble * 0.72)), lineWidth: rimWidth)
    }

    private func drawBobble(
        in context: GraphicsContext,
        rect: CGRect,
        ink: FabricInk,
        wobble: Double
    ) {
        context.fill(Path(rect), with: .color(ink.shaded(wobble * 0.86)))

        let size = min(rect.width, rect.height) * 0.84
        let ball = CGRect(
            x: rect.midX - size / 2,
            y: rect.midY - size / 2,
            width: size,
            height: size)
        let path = Path(ellipseIn: ball)
        let shades: [Color] = [ink.shaded(wobble * 1.26), ink.shaded(wobble * 0.64)]
        let gradient = Gradient(colors: shades)
        let top = CGPoint(x: ball.midX, y: ball.minY)
        let bottom = CGPoint(x: ball.midX, y: ball.maxY)
        let shading: GraphicsContext.Shading = .linearGradient(gradient, startPoint: top, endPoint: bottom)
        context.fill(path, with: shading)
        context.stroke(path, with: .color(ink.shaded(wobble * 0.56)), lineWidth: max(0.4, rect.width * 0.06))
    }

    /// A cable crossing: two bands of stitches passing over each other. Which
    /// band is drawn last is the whole difference between a front and a back
    /// cross, so it is the only cue the picture needs to get right.
    private func drawCable(
        in context: GraphicsContext,
        rect: CGRect,
        span: Int,
        ink: FabricInk,
        leansLeft: Bool,
        x: Int,
        y: Int,
        detailed: Bool
    ) {
        let wobble = FabricSimulationView.wobble(x: x, y: y)
        // Crossings pull the fabric in, so the ground between the bands is deep
        // in shadow.
        context.fill(Path(rect), with: .color(ink.shaded(wobble * 0.78)))

        let width = rect.width
        let height = rect.height
        let lowY = rect.minY + height * 0.86
        let highY = rect.minY + height * 0.12
        let leftX = rect.minX + width * 0.22
        let rightX = rect.maxX - width * 0.22
        let middle = CGPoint(x: rect.midX, y: rect.midY)

        let risingStart = CGPoint(x: leftX, y: lowY)
        let risingEnd = CGPoint(x: rightX, y: highY)
        let fallingStart = CGPoint(x: rightX, y: lowY)
        let fallingEnd = CGPoint(x: leftX, y: highY)

        var rising = Path()
        rising.move(to: risingStart)
        rising.addQuadCurve(to: risingEnd, control: middle)

        var falling = Path()
        falling.move(to: fallingStart)
        falling.addQuadCurve(to: fallingEnd, control: middle)

        let over = leansLeft ? falling : rising
        let under = leansLeft ? rising : falling
        let bandWidth = max(1.5, width * 0.34)
        let bandStyle = StrokeStyle(lineWidth: bandWidth, lineCap: .round)
        let edgeStyle = StrokeStyle(lineWidth: bandWidth * 1.22, lineCap: .round)

        context.stroke(under, with: .color(ink.shaded(wobble * 0.72)), style: bandStyle)
        context.stroke(over, with: .color(ink.shaded(wobble * 0.50)), style: edgeStyle)
        context.stroke(over, with: .color(ink.shaded(wobble * 1.04)), style: bandStyle)

        guard detailed else { return }

        let perBand = max(1, span / 2)
        let markWidth = width / CGFloat(span) * 0.86
        let markHeight = height * 0.30
        let overStart = leansLeft ? fallingStart : risingStart
        let overEnd = leansLeft ? fallingEnd : risingEnd
        let underStart = leansLeft ? risingStart : fallingStart
        let underEnd = leansLeft ? risingEnd : fallingEnd
        drawBandStitches(
            in: context, from: underStart, to: underEnd, count: perBand,
            width: markWidth, height: markHeight, colour: ink.shaded(wobble * 0.56))
        drawBandStitches(
            in: context, from: overStart, to: overEnd, count: perBand,
            width: markWidth, height: markHeight, colour: ink.shaded(wobble * 0.74))
    }

    /// Small Vs spaced along a cable band, so a crossing still reads as knit
    /// stitches rather than as two plain ribbons.
    private func drawBandStitches(
        in context: GraphicsContext,
        from start: CGPoint,
        to end: CGPoint,
        count: Int,
        width: CGFloat,
        height: CGFloat,
        colour: Color
    ) {
        guard count > 0 else { return }
        let steps = CGFloat(count)
        let runX = end.x - start.x
        let runY = end.y - start.y
        var marks = Path()
        for index in 0 ..< count {
            let along = (CGFloat(index) + 0.5) / steps
            let centreX = start.x + runX * along
            let centreY = start.y + runY * along
            marks.move(to: CGPoint(x: centreX - width / 2, y: centreY - height / 2))
            marks.addLine(to: CGPoint(x: centreX, y: centreY + height / 2))
            marks.addLine(to: CGPoint(x: centreX + width / 2, y: centreY - height / 2))
        }
        let style = StrokeStyle(lineWidth: max(0.5, width * 0.22), lineCap: .round, lineJoin: .round)
        context.stroke(marks, with: .color(colour), style: style)
    }

    // MARK: - The needle

    private func drawNeedle(in context: GraphicsContext) {
        let thickness = cellHeight * 0.62
        let centreY = cellHeight * 0.42
        let bar = CGRect(
            x: -cellWidth * 0.5,
            y: centreY - thickness / 2,
            width: canvasSize.width + cellWidth,
            height: thickness)
        let path = Path(roundedRect: bar, cornerRadius: thickness / 2)

        let shades: [Color] = [Color(hex: "EBD9B8"), Color(hex: "B79466")]
        let gradient = Gradient(colors: shades)
        let top = CGPoint(x: bar.midX, y: bar.minY)
        let bottom = CGPoint(x: bar.midX, y: bar.maxY)
        let shading: GraphicsContext.Shading = .linearGradient(gradient, startPoint: top, endPoint: bottom)
        context.fill(path, with: shading)
        context.stroke(path, with: .color(Color(hex: "8A6A42").opacity(0.55)), lineWidth: 0.8)
    }

    /// The live stitches are wrapped round the needle, not resting under it, so
    /// each one is drawn as a band crossing in front of the bar.
    private func drawLoopsOverNeedle(in context: GraphicsContext) {
        let charted = chartedRow(for: rows - 1)
        let ink = rowInk(charted)
        let topY = cellHeight * 0.06
        let bottomY = fabricTop + cellHeight * 0.25

        for x in 0 ..< columns {
            let cell = appearance(x: x, chartedRow: charted)
            guard cell != .noStitch else { continue }
            let centreX = (CGFloat(x) + 0.5) * cellWidth
            var loop = Path()
            loop.move(to: CGPoint(x: centreX, y: topY))
            loop.addLine(to: CGPoint(x: centreX, y: bottomY))
            let wobble = FabricSimulationView.wobble(x: x, y: rows)
            let style = StrokeStyle(lineWidth: max(1, cellWidth * 0.36), lineCap: .round)
            context.stroke(loop, with: .color(ink.shaded(wobble * 0.94)), style: style)
        }
    }
}

// MARK: - Pane

/// The simulation plus its zoom control and a caption saying how big the
/// swatch on screen is in real centimetres.
struct FabricSimulationPane: View {
    let pattern: StitchPattern
    let palette: [Yarn]
    let gauge: Gauge
    var units: UnitSystem = .metric
    /// Left at a swatch's worth unless the caller knows the real cast-on.
    var stitchesWide: Int = 40

    @State private var stitchWidth: CGFloat = 16

    private let rowsHigh = 30

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ScrollView([.horizontal, .vertical]) {
                FabricSimulationView(
                    pattern: pattern,
                    palette: palette,
                    gauge: gauge,
                    stitchesWide: stitchesWide,
                    rowsHigh: rowsHigh,
                    stitchWidth: stitchWidth,
                    showsNeedle: true)
                    .padding(14)
            }
            .frame(maxHeight: 380)
            .background(Color.knitSecondaryBackground, in: RoundedRectangle(cornerRadius: 12))

            zoomControl

            Text(caption)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var zoomControl: some View {
        HStack(spacing: 10) {
            Image(systemName: "minus.magnifyingglass")
            Slider(value: $stitchWidth, in: 6 ... 34)
            Image(systemName: "plus.magnifyingglass")
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    private var columns: Int {
        FabricSimulationView.columnsDrawn(stitchesWide: stitchesWide)
    }

    private var rows: Int {
        FabricSimulationView.rowsDrawn(stitchesWide: stitchesWide, rowsHigh: rowsHigh)
    }

    private var caption: String {
        let across = units.formatLength(gauge.width(forStitches: Double(columns)))
        let tall = units.formatLength(gauge.length(forRows: Double(rows)))
        let counts = "\(columns) sts × \(rows) rows"
        return "\(counts) of \(pattern.name), about \(across) across and \(tall) tall at your gauge."
    }
}
