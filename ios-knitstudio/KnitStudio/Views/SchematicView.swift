import SwiftUI

/// Room around a piece for its dimension lines and their labels. Both views
/// have to agree on it: one works the scale out against it, the other draws.
private enum SchematicMetrics {
    static let sideMargin: CGFloat = 56
    static let verticalMargin: CGFloat = 28
    static let heightBudget: CGFloat = 260
    static let dimensionGap: CGFloat = 10
    static let tickLength: CGFloat = 4
    static let labelGap: CGFloat = 4
    static let minimumScale: CGFloat = 0.4
    static let maximumScale: CGFloat = 12
}

/// The corners of a piece's bounding box, in centimetres. The drawing needs the
/// minimums to translate the outline and the maximums to work out which side of
/// the piece each dimension line belongs on.
private struct SchematicExtent {
    var minX: Double = 0
    var maxX: Double = 0
    var minY: Double = 0
    var maxY: Double = 0

    init(points: [SchematicPoint]) {
        guard let first = points.first else { return }
        minX = first.x
        maxX = first.x
        minY = first.y
        maxY = first.y
        for point in points {
            minX = min(minX, point.x)
            maxX = max(maxX, point.x)
            minY = min(minY, point.y)
            maxY = max(maxY, point.y)
        }
    }

    var midX: Double { (minX + maxX) / 2 }
    var midY: Double { (minY + maxY) / 2 }
}

// MARK: - Schematic

/// Draws the finished pieces to scale, the way a pattern's schematic page does.
struct SchematicView: View {
    let schematic: GarmentSchematic
    let units: UnitSystem
    var maxWidth: CGFloat = 320

    var body: some View {
        if schematic.pieces.isEmpty {
            EmptyStateView(
                symbol: "ruler",
                title: "Nothing to draw yet",
                message: emptyMessage)
        } else {
            VStack(alignment: .leading, spacing: 12) {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 20) {
                    ForEach(schematic.pieces) { (piece: SchematicPiece) in
                        SchematicPieceView(piece: piece, units: units, scale: scale)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                Text(schematic.note)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var emptyMessage: String {
        let note = schematic.note.trimmingCharacters(in: .whitespacesAndNewlines)
        if note.isEmpty { return GarmentSchematic.emptyNote }
        return note
    }

    // MARK: - Scale

    /// One scale for every piece in the schematic. Fitting each piece to its own
    /// box would draw a sleeve as large as the body it is joined to.
    private var scale: CGFloat {
        let widest = widestPiece
        let tallest = tallestPiece
        guard widest > 0, tallest > 0 else { return 1 }
        let widthBudget: CGFloat = max(60, maxWidth - SchematicMetrics.sideMargin * 2)
        let heightAllowance: CGFloat = SchematicMetrics.verticalMargin * 2
        let heightBudget: CGFloat = max(60, SchematicMetrics.heightBudget - heightAllowance)
        let byWidth: CGFloat = widthBudget / CGFloat(widest)
        let byHeight: CGFloat = heightBudget / CGFloat(tallest)
        let fitted: CGFloat = min(byWidth, byHeight)
        return min(max(fitted, SchematicMetrics.minimumScale), SchematicMetrics.maximumScale)
    }

    private var widestPiece: Double {
        var widest: Double = 0
        for piece in schematic.pieces {
            widest = max(widest, piece.boundingBox.width)
        }
        return widest
    }

    private var tallestPiece: Double {
        var tallest: Double = 0
        for piece in schematic.pieces {
            tallest = max(tallest, piece.boundingBox.height)
        }
        return tallest
    }

    // MARK: - Layout

    private var columns: [GridItem] {
        return [GridItem(.adaptive(minimum: columnWidth), spacing: 16, alignment: .top)]
    }

    /// Every column is the width of the widest piece, so the pieces line up in
    /// the row rather than shuffling about as the drawing changes.
    private var columnWidth: CGFloat {
        let drawn: CGFloat = CGFloat(widestPiece) * scale
        let withMargins: CGFloat = drawn + SchematicMetrics.sideMargin * 2
        return min(maxWidth, max(120, withMargins))
    }
}

// MARK: - One piece

struct SchematicPieceView: View {
    let piece: SchematicPiece
    let units: UnitSystem
    var scale: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            nameRow
            Canvas { context, _ in
                drawOutline(in: context)
                drawGuides(in: context)
                drawDimensions(in: context)
            }
            .frame(width: canvasSize.width, height: canvasSize.height)
            captionText
        }
        .frame(width: canvasSize.width, alignment: .leading)
    }

    private var nameRow: some View {
        HStack(spacing: 6) {
            Text(piece.name)
                .font(.subheadline.weight(.semibold))
                .lineLimit(2)
            if piece.quantity > 1 {
                Text("x\(piece.quantity)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var captionText: some View {
        if let caption = piece.caption {
            Text(caption)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Geometry

    private var extent: SchematicExtent {
        return SchematicExtent(points: piece.outline)
    }

    private var drawnSize: CGSize {
        let box = piece.boundingBox
        let width: CGFloat = CGFloat(box.width) * scale
        let height: CGFloat = CGFloat(box.height) * scale
        return CGSize(width: max(1, width), height: max(1, height))
    }

    private var canvasSize: CGSize {
        let width: CGFloat = drawnSize.width + SchematicMetrics.sideMargin * 2
        let height: CGFloat = drawnSize.height + SchematicMetrics.verticalMargin * 2
        return CGSize(width: width, height: height)
    }

    /// Centimetres to points, with y flipped: a schematic point counts upwards
    /// from the bottom of the piece and the canvas counts downwards.
    private func canvasPoint(_ schematicPoint: SchematicPoint) -> CGPoint {
        let corner = extent
        let acrossCm: Double = schematicPoint.x - corner.minX
        let upCm: Double = schematicPoint.y - corner.minY
        let x: CGFloat = SchematicMetrics.sideMargin + CGFloat(acrossCm) * scale
        let fromTop: CGFloat = drawnSize.height - CGFloat(upCm) * scale
        let y: CGFloat = SchematicMetrics.verticalMargin + fromTop
        return CGPoint(x: x, y: y)
    }

    private func path(through points: [SchematicPoint], closed: Bool) -> Path {
        var result = Path()
        guard points.count > 1 else { return result }
        result.move(to: canvasPoint(points[0]))
        for index in 1 ..< points.count {
            result.addLine(to: canvasPoint(points[index]))
        }
        if closed { result.closeSubpath() }
        return result
    }

    // MARK: - Drawing

    private func drawOutline(in context: GraphicsContext) {
        let outline = path(through: piece.outline, closed: true)
        context.fill(outline, with: .color(Color.accentColor.opacity(0.08)))
        context.stroke(outline, with: .color(Color.primary), lineWidth: 1.5)
    }

    private func drawGuides(in context: GraphicsContext) {
        let style = StrokeStyle(lineWidth: 1, lineCap: .round, dash: [3, 3])
        for line in piece.guides {
            let guide = path(through: line, closed: false)
            context.stroke(guide, with: .color(Color.secondary.opacity(0.8)), style: style)
        }
    }

    private func drawDimensions(in context: GraphicsContext) {
        for dimension in piece.dimensions {
            draw(dimension, in: context)
        }
    }

    private func draw(_ dimension: SchematicDimension, in context: GraphicsContext) {
        let start = canvasPoint(dimension.from)
        let end = canvasPoint(dimension.to)
        let across: Double = abs(dimension.to.x - dimension.from.x)
        let up: Double = abs(dimension.to.y - dimension.from.y)
        let horizontal: Bool = up <= across
        let gap = SchematicMetrics.dimensionGap
        let tick = SchematicMetrics.tickLength

        var from = start
        var to = end
        // Which way the label sits from its line: -1 is up or left, 1 is down or right.
        var outward: CGFloat = 1

        if horizontal {
            let middle: Double = (dimension.from.y + dimension.to.y) / 2
            let upper: Bool = middle > extent.midY
            let topEdge: CGFloat = SchematicMetrics.verticalMargin
            let bottomEdge: CGFloat = topEdge + drawnSize.height
            let y: CGFloat = upper ? topEdge - gap : bottomEdge + gap
            from = CGPoint(x: start.x, y: y)
            to = CGPoint(x: end.x, y: y)
            outward = upper ? -1 : 1
        } else {
            let middle: Double = (dimension.from.x + dimension.to.x) / 2
            let right: Bool = middle > extent.midX
            let leftEdge: CGFloat = SchematicMetrics.sideMargin
            let rightEdge: CGFloat = leftEdge + drawnSize.width
            let x: CGFloat = right ? rightEdge + gap : leftEdge - gap
            from = CGPoint(x: x, y: start.y)
            to = CGPoint(x: x, y: end.y)
            outward = right ? 1 : -1
        }

        var line = Path()
        line.move(to: from)
        line.addLine(to: to)
        if horizontal {
            line.move(to: CGPoint(x: from.x, y: from.y - tick))
            line.addLine(to: CGPoint(x: from.x, y: from.y + tick))
            line.move(to: CGPoint(x: to.x, y: to.y - tick))
            line.addLine(to: CGPoint(x: to.x, y: to.y + tick))
        } else {
            line.move(to: CGPoint(x: from.x - tick, y: from.y))
            line.addLine(to: CGPoint(x: from.x + tick, y: from.y))
            line.move(to: CGPoint(x: to.x - tick, y: to.y))
            line.addLine(to: CGPoint(x: to.x + tick, y: to.y))
        }
        context.stroke(line, with: .color(Color.secondary), lineWidth: 1)

        drawLabel(
            measurement(for: dimension),
            from: from,
            to: to,
            horizontal: horizontal,
            outward: outward,
            in: context)
    }

    private func drawLabel(
        _ text: String, from: CGPoint, to: CGPoint, horizontal: Bool,
        outward: CGFloat, in context: GraphicsContext
    ) {
        let label = Text(text).font(.system(size: 9, weight: .regular, design: .rounded))
        var resolved = context.resolve(label)
        resolved.shading = .color(Color.secondary)

        let midX: CGFloat = (from.x + to.x) / 2
        let midY: CGFloat = (from.y + to.y) / 2
        let step: CGFloat = SchematicMetrics.tickLength + SchematicMetrics.labelGap

        if horizontal {
            let anchor: UnitPoint = outward < 0 ? UnitPoint.bottom : UnitPoint.top
            let place = CGPoint(x: midX, y: midY + outward * step)
            context.draw(resolved, at: place, anchor: anchor)
        } else {
            let anchor: UnitPoint = outward < 0 ? UnitPoint.trailing : UnitPoint.leading
            let place = CGPoint(x: midX + outward * step, y: midY)
            context.draw(resolved, at: place, anchor: anchor)
        }
    }

    /// The stored text is centimetres, so in imperial the number has to be
    /// worked out again from the points rather than simply relabelled.
    private func measurement(for dimension: SchematicDimension) -> String {
        if units == .metric { return dimension.text }
        let dx: Double = dimension.to.x - dimension.from.x
        let dy: Double = dimension.to.y - dimension.from.y
        let centimetres: Double = (dx * dx + dy * dy).squareRoot()
        return units.formatLength(centimetres)
    }
}
