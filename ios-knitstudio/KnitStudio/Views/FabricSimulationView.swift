import SwiftUI

// MARK: - The fabric

/// Draws what the knitting will actually look like.
///
/// Not a grid of coloured squares: every stitch is a loop of yarn, its two legs
/// running down into the head of the stitch below so the fabric reads as
/// interlocked rather than stacked. Where the stitches sit comes from
/// `StitchMesh`, which lets the fabric settle first — so a cable pulls its
/// columns in, lace opens up, and the edges scallop the way they really do.
struct FabricSimulationView: View {
    let pattern: StitchPattern
    let palette: [Yarn]
    let gauge: Gauge
    var stitchesWide: Int = 40
    var rowsHigh: Int = 30
    var stitchWidth: CGFloat = 16
    var settings: FabricSettings = FabricSettings()

    /// Settling a mesh is far too slow to redo on every frame, so it is kept
    /// here and rebuilt only when something it depends on changes. Zoom is not
    /// one of those: the mesh is in stitch widths, and the view scales it.
    @State private var mesh: StitchMesh = StitchMesh.flat(columns: 1, rows: 1)

    var body: some View {
        Canvas { context, _ in
            drawFabric(in: context)
        }
        .frame(width: canvasSize.width, height: canvasSize.height)
        .onAppear { rebuildMesh() }
        .onChange(of: meshKey) { _, _ in rebuildMesh() }
        .accessibilityLabel(Text(accessibilityDescription))
    }

    // MARK: - Size

    /// A Canvas redrawing many thousands of paths on every slider tick is the
    /// one way this screen can feel broken.
    private static let maximumStitches = 3000

    private var columns: Int { max(2, min(stitchesWide, 120)) }

    private var rows: Int {
        let wanted = max(2, rowsHigh)
        let allowed = max(2, FabricSimulationView.maximumStitches / columns)
        return min(wanted, allowed)
    }

    private var cellWidth: CGFloat { max(4, stitchWidth) }

    /// A knitted stitch is wider than it is tall, and taking that from the
    /// knitter's own gauge is what stops the picture looking like a spreadsheet.
    private var rowHeight: CGFloat {
        guard gauge.stitchWidth > 0 else { return cellWidth * 0.75 }
        return max(3, cellWidth * CGFloat(gauge.rowHeight / gauge.stitchWidth))
    }

    private var yarnWidth: CGFloat { cellWidth * 0.24 * CGFloat(settings.fullness) }

    private var padding: CGFloat { cellWidth * 0.8 }

    private var canvasSize: CGSize {
        let extent = mesh.bounds
        return CGSize(
            width: CGFloat(extent.width) * cellWidth + padding * 2,
            height: CGFloat(extent.height) * rowHeight + padding * 2)
    }

    /// Everything the settled mesh depends on, and nothing it does not.
    private var meshKey: String {
        let tension = Int(settings.tension * 100)
        let settling = Int(settings.settling * 100)
        return "\(pattern.id)-\(columns)x\(rows)-\(tension)-\(settling)"
    }

    private func rebuildMesh() {
        mesh = StitchMesh.build(
            pattern: pattern, columns: columns, rows: rows, settings: settings)
    }

    private var accessibilityDescription: String {
        "A drawing of \(pattern.name) knitted up, \(columns) stitches across and \(rows) rows tall."
    }

    // MARK: - Mesh to screen

    private func point(_ meshPoint: StitchMesh.Point) -> CGPoint {
        CGPoint(
            x: padding + CGFloat(meshPoint.x) * cellWidth,
            y: canvasSize.height - padding - CGFloat(meshPoint.y) * rowHeight)
    }

    /// A position inside one stitch: `across` runs 0 at its left to 1 at its
    /// right, `up` runs 0 at its bottom to 1 at its top, following whatever
    /// shape the settled mesh gave that particular stitch.
    private func inCell(_ x: Int, _ y: Int, across: CGFloat, up: CGFloat) -> CGPoint {
        let corners = mesh.cell(x: x, y: y)
        let bottom = lerp(point(corners.bottomLeft), point(corners.bottomRight), across)
        let top = lerp(point(corners.topLeft), point(corners.topRight), across)
        return lerp(bottom, top, up)
    }

    private func lerp(_ a: CGPoint, _ b: CGPoint, _ t: CGFloat) -> CGPoint {
        CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t)
    }

    // MARK: - Colour

    private static let undyedWool = "D8D2C6"

    private func yarn(_ y: Int) -> Yarn {
        guard !palette.isEmpty else {
            return Yarn(name: "Wool", hex: FabricSimulationView.undyedWool, weight: .light)
        }
        let index = pattern.fabricColourIndex(fabricRow: y)
        return palette[min(max(0, index), palette.count - 1)]
    }

    /// The yarn colour and the shade it is outlined in. Line art drops the
    /// colour entirely, which is how a pattern book prints a swatch.
    private func ink(x: Int, y: Int) -> (fill: Color, outline: Color) {
        if settings.outlined {
            return (fill: Color.white, outline: Color(hex: "6E7076"))
        }
        let base = yarn(y)
        let shift = 1 + 0.07 * StitchMesh.wobble(x: x, y: y, salt: 7)
        return (fill: shade(base, by: shift), outline: shade(base, by: 0.55))
    }

    private func shade(_ source: Yarn, by factor: Double) -> Color {
        let (red, green, blue) = source.rgb
        return Color(
            .sRGB,
            red: min(1, max(0, red * factor)),
            green: min(1, max(0, green * factor)),
            blue: min(1, max(0, blue * factor)),
            opacity: 1)
    }

    // MARK: - Drawing

    private func drawFabric(in context: GraphicsContext) {
        for y in 0 ..< rows {
            // Bottom up, so each row closes over the one beneath it — which is
            // the order the stitches were made in.
            for x in 0 ..< columns {
                drawHead(in: context, x: x, y: y)
            }
            var x = 0
            while x < columns {
                let cell = pattern.fabricAppearance(x: x, fabricRow: y)
                let span = min(crossingSpan(cell), columns - x)
                if span > 1 {
                    drawCrossing(in: context, x: x, y: y, span: span, symbol: cell)
                    x += span
                } else {
                    drawStitch(cell, in: context, x: x, y: y)
                    x += 1
                }
            }
        }
    }

    private func crossingSpan(_ symbol: StitchSymbol) -> Int {
        switch symbol {
        case .cable2Front, .cable2Back: return 4
        case .cable3Front, .cable3Back: return 6
        default: return 1
        }
    }

    private func stroke(
        _ context: GraphicsContext,
        _ path: Path,
        _ colours: (fill: Color, outline: Color),
        _ width: CGFloat
    ) {
        let outlineWidth = width + max(1.2, yarnWidth * 0.55)
        context.stroke(
            path, with: .color(colours.outline),
            style: StrokeStyle(lineWidth: outlineWidth, lineCap: .round, lineJoin: .round))
        context.stroke(
            path, with: .color(colours.fill),
            style: StrokeStyle(lineWidth: max(0.7, width), lineCap: .round, lineJoin: .round))
    }

    /// The top of the loop. The row above threads its legs through the middle of
    /// it, so only the shoulders stay visible — which is the whole trick.
    private func drawHead(in context: GraphicsContext, x: Int, y: Int) {
        let cell = pattern.fabricAppearance(x: x, fabricRow: y)
        guard cell != .noStitch, cell != .yarnOver else { return }
        var path = Path()
        path.move(to: inCell(x, y, across: 0.03, up: 0.88))
        path.addQuadCurve(
            to: inCell(x, y, across: 0.97, up: 0.88),
            control: inCell(x, y, across: 0.50, up: 1.20))
        stroke(context, path, ink(x: x, y: y), yarnWidth * 0.92)
    }

    private func drawStitch(_ cell: StitchSymbol, in context: GraphicsContext, x: Int, y: Int) {
        guard cell != .noStitch else { return }
        let colours = ink(x: x, y: y)
        switch cell {
        case .purl:
            drawPurl(in: context, x: x, y: y, colours: colours)
        case .yarnOver:
            drawStrand(in: context, x: x, y: y, colours: colours)
        case .k2tog:
            drawLegs(in: context, x: x, y: y, colours: colours, spread: 0.62, lean: 0.30)
        case .ssk:
            drawLegs(in: context, x: x, y: y, colours: colours, spread: 0.62, lean: -0.30)
        case .cdd, .k3tog:
            drawLegs(in: context, x: x, y: y, colours: colours, spread: 0.52, lean: 0)
        case .make1:
            drawLegs(in: context, x: x, y: y, colours: colours, spread: 0.58, lean: 0)
        case .slip, .slipWyif:
            drawLegs(in: context, x: x, y: y, colours: colours, spread: 0.66, lean: 0, drop: 0.85)
        case .bobble:
            drawBobble(in: context, x: x, y: y, colours: colours)
        default:
            drawLegs(in: context, x: x, y: y, colours: colours)
        }
    }

    /// The V. Its point reaches down into the head of the stitch below, and that
    /// overlap is what makes knitted fabric look solid instead of stacked.
    private func drawLegs(
        in context: GraphicsContext,
        x: Int,
        y: Int,
        colours: (fill: Color, outline: Color),
        spread: CGFloat = 0.88,
        lean: CGFloat = 0,
        drop: CGFloat = 0
    ) {
        let foot = inCell(x, y, across: 0.5 + lean * 0.22, up: -0.06 - drop)
        for side in [CGFloat(-1), CGFloat(1)] {
            let top = inCell(x, y, across: 0.5 + side * spread / 2 + lean * 0.16, up: 0.94)
            let first = inCell(
                x, y, across: 0.5 + side * spread * 0.22 + lean * 0.20, up: 0.22 - drop * 0.6)
            let second = inCell(x, y, across: 0.5 + side * spread * 0.48 + lean * 0.18, up: 0.68)
            var path = Path()
            path.move(to: foot)
            path.addCurve(to: top, control1: first, control2: second)
            stroke(context, path, colours, yarnWidth)
        }
    }

    /// A purl shows the head of the loop coming towards you: a bump lying across
    /// the stitch rather than a V.
    private func drawPurl(
        in context: GraphicsContext,
        x: Int,
        y: Int,
        colours: (fill: Color, outline: Color)
    ) {
        var bump = Path()
        bump.move(to: inCell(x, y, across: -0.04, up: 0.34))
        bump.addQuadCurve(
            to: inCell(x, y, across: 1.04, up: 0.34),
            control: inCell(x, y, across: 0.50, up: 0.94))
        stroke(context, bump, colours, yarnWidth * 1.45)

        var under = Path()
        under.move(to: inCell(x, y, across: 0.10, up: 0.16))
        under.addQuadCurve(
            to: inCell(x, y, across: 0.90, up: 0.16),
            control: inCell(x, y, across: 0.50, up: 0.40))
        stroke(context, under, colours, yarnWidth * 0.60)
    }

    /// A yarn-over is not a stitch yet — it is a bare strand lying across the
    /// needle, and the hole underneath it is the entire point of lace.
    private func drawStrand(
        in context: GraphicsContext,
        x: Int,
        y: Int,
        colours: (fill: Color, outline: Color)
    ) {
        var path = Path()
        path.move(to: inCell(x, y, across: 0.14, up: 0.74))
        path.addQuadCurve(
            to: inCell(x, y, across: 0.86, up: 0.74),
            control: inCell(x, y, across: 0.50, up: 1.06))
        stroke(context, path, colours, yarnWidth * 0.82)
    }

    private func drawBobble(
        in context: GraphicsContext,
        x: Int,
        y: Int,
        colours: (fill: Color, outline: Color)
    ) {
        let centre = inCell(x, y, across: 0.5, up: 0.5)
        let radius = min(cellWidth, rowHeight) * 0.38
        let box = CGRect(
            x: centre.x - radius, y: centre.y - radius, width: radius * 2, height: radius * 2)
        context.fill(Path(ellipseIn: box), with: .color(colours.fill))
        context.stroke(
            Path(ellipseIn: box), with: .color(colours.outline),
            lineWidth: max(1, yarnWidth * 0.4))
    }

    /// A crossing: the two halves swap columns. Each stitch keeps its own V and
    /// leans across, because that is what a cable actually is — travelling
    /// stitches, not a rope laid on top. The front half is drawn last so it
    /// genuinely passes over the other.
    private func drawCrossing(
        in context: GraphicsContext,
        x: Int,
        y: Int,
        span: Int,
        symbol: StitchSymbol
    ) {
        let half = max(1, span / 2)
        let frontIsLeft = symbol == .cable2Front || symbol == .cable3Front
        var groups: [(start: Int, end: Int, shift: Int)] = [
            (start: 0, end: half, shift: half),
            (start: half, end: span, shift: -half),
        ]
        if frontIsLeft { groups.reverse() }

        for (order, group) in groups.enumerated() {
            let inFront = order == groups.count - 1
            let width = yarnWidth * (inFront ? 1.12 : 0.94)
            for index in group.start ..< group.end {
                drawTravellingStitch(
                    in: context, from: x + index, shift: group.shift, row: y, width: width)
            }
        }
    }

    private func drawTravellingStitch(
        in context: GraphicsContext,
        from sourceX: Int,
        shift: Int,
        row y: Int,
        width: CGFloat
    ) {
        let targetX = min(max(0, sourceX + shift), columns - 1)
        let colours = ink(x: sourceX, y: y)
        // The foot travels most of the way too, so the stitch leans rather than
        // splaying open across two columns.
        let foot = lerp(
            inCell(sourceX, y, across: 0.5, up: -0.06),
            inCell(targetX, y, across: 0.5, up: -0.06),
            0.55)
        for side in [CGFloat(-1), CGFloat(1)] {
            let top = inCell(targetX, y, across: 0.5 + side * 0.40, up: 0.96)
            let first = lerp(
                inCell(sourceX, y, across: 0.5 + side * 0.20, up: 0.24),
                inCell(targetX, y, across: 0.5 + side * 0.20, up: 0.24),
                0.55)
            let second = inCell(targetX, y, across: 0.5 + side * 0.38, up: 0.68)
            var path = Path()
            path.move(to: foot)
            path.addCurve(to: top, control1: first, control2: second)
            stroke(context, path, colours, width)
        }
    }
}

// MARK: - The pane around it

/// The simulation with the controls a knitter would want: how big to draw it,
/// how tightly it was knitted, how fat the yarn is, how far the fabric has been
/// allowed to settle, and whether to see it as yarn or as line art.
struct FabricSimulationPane: View {
    let pattern: StitchPattern
    let palette: [Yarn]
    let gauge: Gauge
    var units: UnitSystem = .metric
    /// Left at a swatch's worth unless the caller knows the real cast-on.
    var stitchesWide: Int = 40

    @State private var stitchWidth: CGFloat = 18
    @State private var settings = FabricSettings()
    @State private var showingControls = false

    private let rowsHigh = 26

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            canvas
            caption
            controls
        }
    }

    private var canvas: some View {
        ScrollView([.horizontal, .vertical]) {
            FabricSimulationView(
                pattern: pattern,
                palette: palette,
                gauge: gauge,
                stitchesWide: stitchesWide,
                rowsHigh: rowsHigh,
                stitchWidth: stitchWidth,
                settings: settings)
                .padding(6)
        }
        .frame(maxHeight: 420)
        .background(fabricBackdrop, in: RoundedRectangle(cornerRadius: 12))
    }

    private var fabricBackdrop: Color {
        settings.outlined ? Color.white.opacity(0.75) : Color.knitSecondaryBackground
    }

    private var caption: some View {
        HStack(spacing: 12) {
            Text(sizeCaption)
            Spacer(minLength: 8)
            Button(showingControls ? "Hide settings" : "Settings") {
                showingControls.toggle()
            }
            .buttonStyle(.bordered)
        }
        .font(.caption)
        .foregroundStyle(Color.secondary)
    }

    /// What is on screen, measured as real cloth.
    private var sizeCaption: String {
        let across = gauge.width(forStitches: Double(stitchesWide))
        let up = gauge.length(forRows: Double(rowsHigh))
        return "\(stitchesWide) sts × \(rowsHigh) rows — "
            + "\(units.formatLength(across)) × \(units.formatLength(up)) at this gauge"
    }

    @ViewBuilder
    private var controls: some View {
        if showingControls {
            VStack(alignment: .leading, spacing: 12) {
                slider("Zoom", value: $stitchWidth, range: 8 ... 40)
                slider("Tension", value: tensionBinding, range: 0.7 ... 1.4,
                       note: "How tightly it was knitted.")
                slider("Yarn fullness", value: fullnessBinding, range: 0.6 ... 1.5,
                       note: "A fatter yarn fills more of its stitch.")
                slider("Settling", value: settlingBinding, range: 0 ... 1,
                       note: "How far the fabric relaxes out of the grid it was charted on.")
                Toggle("Line art", isOn: outlinedBinding)
                    .font(.caption)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.knitSecondaryBackground, in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private func slider(
        _ label: String,
        value: Binding<CGFloat>,
        range: ClosedRange<CGFloat>,
        note: String? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption.weight(.medium))
            Slider(value: value, in: range)
            if let note {
                Text(note)
                    .font(.caption2)
                    .foregroundStyle(Color.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // FabricSettings clamps in its initialiser, so every change goes back
    // through it rather than writing the stored properties directly.
    private func updated(
        tension: Double? = nil,
        fullness: Double? = nil,
        settling: Double? = nil,
        outlined: Bool? = nil
    ) -> FabricSettings {
        FabricSettings(
            tension: tension ?? settings.tension,
            fullness: fullness ?? settings.fullness,
            settling: settling ?? settings.settling,
            outlined: outlined ?? settings.outlined)
    }

    private var tensionBinding: Binding<CGFloat> {
        Binding(
            get: { CGFloat(settings.tension) },
            set: { settings = updated(tension: Double($0)) })
    }

    private var fullnessBinding: Binding<CGFloat> {
        Binding(
            get: { CGFloat(settings.fullness) },
            set: { settings = updated(fullness: Double($0)) })
    }

    private var settlingBinding: Binding<CGFloat> {
        Binding(
            get: { CGFloat(settings.settling) },
            set: { settings = updated(settling: Double($0)) })
    }

    private var outlinedBinding: Binding<Bool> {
        Binding(
            get: { settings.outlined },
            set: { settings = updated(outlined: $0) })
    }
}
