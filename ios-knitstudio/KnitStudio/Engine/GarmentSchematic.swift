import Foundation

/// Finished dimensions a calculator worked out, in centimetres. A project type
/// fills in only the fields that apply to it.
struct PlanMetrics: Codable, Equatable {
    var castOnStitches: Int = 0
    var flatWidth: Double?
    var flatLength: Double?
    var circumference: Double?
    var ribDepth: Double?
    var bodyDepth: Double?
    var crownDepth: Double?
    var chestCircumference: Double?
    var yokeDepth: Double?
    var bodyLength: Double?
    var sleeveLength: Double?
    var upperArmCircumference: Double?
    var cuffCircumference: Double?
    var neckCircumference: Double?
    var legLength: Double?
    var footLength: Double?
    var footCircumference: Double?
    var heelDepth: Double?
    var handLength: Double?
    var thumbLength: Double?
    var wingspan: Double?
    var depth: Double?

    init() {}
}

/// A point on a schematic, in centimetres, y increasing upwards.
struct SchematicPoint: Codable, Equatable {
    var x: Double
    var y: Double

    init(_ x: Double, _ y: Double) {
        self.x = x
        self.y = y
    }
}

/// A measurement arrow with the number already formatted.
struct SchematicDimension: Identifiable, Equatable {
    var id: UUID = UUID()
    var from: SchematicPoint
    var to: SchematicPoint
    var text: String
}

/// One flat shape to draw. Every coordinate is centimetres with the origin at
/// the bottom-left of the piece, so a view only has to scale and flip y.
struct SchematicPiece: Identifiable, Equatable {
    var id: UUID = UUID()
    var name: String
    /// Closed polygon: the last point joins back to the first.
    var outline: [SchematicPoint]
    /// Lines drawn inside the outline — raglan lines, fold lines, heel turn.
    var guides: [[SchematicPoint]]
    var dimensions: [SchematicDimension]
    /// Drawn as "x2" beside the name.
    var quantity: Int = 1
    var caption: String?

    var boundingBox: (width: Double, height: Double) {
        guard let first = outline.first else { return (width: 0, height: 0) }
        var minX = first.x
        var maxX = first.x
        var minY = first.y
        var maxY = first.y
        for point in outline {
            minX = min(minX, point.x)
            maxX = max(maxX, point.x)
            minY = min(minY, point.y)
            maxY = max(maxY, point.y)
        }
        return (width: maxX - minX, height: maxY - minY)
    }
}

/// The flat shapes that make up a finished project, drawn from the numbers a
/// calculator worked out rather than from the stitch counts.
struct GarmentSchematic: Equatable {
    var pieces: [SchematicPiece]
    var note: String

    static let standardNote: String =
        "Measurements are the finished knitted piece, laid flat and blocked."
    static let emptyNote: String =
        "There is not enough information yet to draw this project — the finished "
        + "measurements appear once the plan has been worked out."

    static func make(kind: PatternKind, metrics: PlanMetrics, options: ProjectOptions) -> GarmentSchematic {
        let pieces: [SchematicPiece]
        switch kind {
        case .scarf, .blanket:
            pieces = optionalPieces([flatPiece(kind: kind, metrics: metrics)])
        case .cowl:
            pieces = optionalPieces([cowlPiece(metrics: metrics)])
        case .hat:
            pieces = optionalPieces([hatPiece(metrics: metrics)])
        case .raglanSweater:
            pieces = optionalPieces([
                sweaterBody(metrics: metrics),
                sweaterSleeve(metrics: metrics, options: options),
                sweaterNeckband(metrics: metrics),
            ])
        case .sock:
            pieces = optionalPieces([
                sockLeg(metrics: metrics, options: options),
                sockFoot(metrics: metrics),
            ])
        case .mitten:
            pieces = optionalPieces([mittenPiece(metrics: metrics)])
        case .shawl:
            pieces = optionalPieces([shawlPiece(metrics: metrics)])
        }

        if pieces.isEmpty {
            return fallback(kind: kind, metrics: metrics)
        }
        return GarmentSchematic(pieces: pieces, note: standardNote)
    }

    private static func optionalPieces(_ pieces: [SchematicPiece?]) -> [SchematicPiece] {
        var result: [SchematicPiece] = []
        for piece in pieces {
            if let piece = piece { result.append(piece) }
        }
        return result
    }

    // MARK: - Flat pieces

    private static func flatPiece(kind: PatternKind, metrics: PlanMetrics) -> SchematicPiece? {
        guard let width = positive(metrics.flatWidth) else { return nil }
        guard let length = positive(metrics.flatLength) else { return nil }

        let dimensions: [SchematicDimension] = [
            horizontalDimension(y: 0, from: 0, to: width),
            verticalDimension(x: 0, from: 0, to: length),
        ]
        return SchematicPiece(
            name: kind.name,
            outline: rectangle(width: width, height: length),
            guides: [],
            dimensions: dimensions,
            quantity: 1,
            caption: "Worked flat in one piece.")
    }

    private static func cowlPiece(metrics: PlanMetrics) -> SchematicPiece? {
        guard let circumference = positive(metrics.circumference) else { return nil }
        guard let depth = positive(metrics.depth) else { return nil }

        let width = circumference / 2
        var guides: [[SchematicPoint]] = []
        // The cowl is ribbed at both ends, so both edges get a line.
        if let rib = positive(metrics.ribDepth), rib * 2 < depth {
            guides.append(horizontalGuide(y: rib, from: 0, to: width))
            guides.append(horizontalGuide(y: depth - rib, from: 0, to: width))
        }
        let dimensions: [SchematicDimension] = [
            horizontalDimension(y: 0, from: 0, to: width),
            verticalDimension(x: 0, from: 0, to: depth),
        ]
        let caption = String(
            format: "A tube joined in the round, shown laid flat. Right round it measures %.1f cm.",
            circumference)
        return SchematicPiece(
            name: "Cowl",
            outline: rectangle(width: width, height: depth),
            guides: guides,
            dimensions: dimensions,
            quantity: 1,
            caption: caption)
    }

    private static func shawlPiece(metrics: PlanMetrics) -> SchematicPiece? {
        guard let wingspan = positive(metrics.wingspan) else { return nil }
        guard let depth = positive(metrics.depth) else { return nil }

        let centre = wingspan / 2
        let outline: [SchematicPoint] = [
            SchematicPoint(0, depth),
            SchematicPoint(wingspan, depth),
            SchematicPoint(centre, 0),
        ]
        let spine: [SchematicPoint] = [
            SchematicPoint(centre, depth),
            SchematicPoint(centre, 0),
        ]
        let dimensions: [SchematicDimension] = [
            horizontalDimension(y: depth, from: 0, to: wingspan),
            verticalDimension(x: centre, from: 0, to: depth),
        ]
        return SchematicPiece(
            name: "Shawl",
            outline: outline,
            guides: [spine],
            dimensions: dimensions,
            quantity: 1,
            caption: "The top edge is the bind-off; the spine runs down the centre to the point.")
    }

    // MARK: - Hat

    private static func hatPiece(metrics: PlanMetrics) -> SchematicPiece? {
        guard let circumference = positive(metrics.circumference) else { return nil }
        guard let bodyDepth = positive(metrics.bodyDepth) else { return nil }

        let width = circumference / 2
        let crownDepth: Double = positive(metrics.crownDepth) ?? 0

        var outline: [SchematicPoint] = [
            SchematicPoint(0, 0),
            SchematicPoint(width, 0),
        ]
        if crownDepth > 0 {
            outline.append(contentsOf: dome(width: width, height: crownDepth, baseY: bodyDepth, steps: 12))
        } else {
            outline.append(SchematicPoint(width, bodyDepth))
            outline.append(SchematicPoint(0, bodyDepth))
        }

        var guides: [[SchematicPoint]] = []
        if let rib = positive(metrics.ribDepth), rib < bodyDepth {
            guides.append(horizontalGuide(y: rib, from: 0, to: width))
        }

        var dimensions: [SchematicDimension] = [
            horizontalDimension(y: 0, from: 0, to: width),
            verticalDimension(x: 0, from: 0, to: bodyDepth + crownDepth),
        ]
        if crownDepth > 0 {
            dimensions.append(verticalDimension(x: width, from: bodyDepth, to: bodyDepth + crownDepth))
        }
        let caption = String(
            format: "The tube laid flat, with the shaped crown on top. Around the brim it measures %.1f cm.",
            circumference)
        return SchematicPiece(
            name: "Hat",
            outline: outline,
            guides: guides,
            dimensions: dimensions,
            quantity: 1,
            caption: caption)
    }

    // MARK: - Raglan sweater

    private static func sweaterBody(metrics: PlanMetrics) -> SchematicPiece? {
        guard let chest = positive(metrics.chestCircumference) else { return nil }
        guard let length = positive(metrics.bodyLength) else { return nil }

        let width = chest / 2
        var guides: [[SchematicPoint]] = []
        var dimensions: [SchematicDimension] = [
            horizontalDimension(y: 0, from: 0, to: width),
            verticalDimension(x: 0, from: 0, to: length),
        ]

        if let yoke = positive(metrics.yokeDepth), yoke < length {
            let underarm = length - yoke
            guides.append(horizontalGuide(y: underarm, from: 0, to: width))
            dimensions.append(verticalDimension(x: width, from: underarm, to: length))
            if let neck = positive(metrics.neckCircumference), neck / 2 < width {
                let raglans = raglanGuides(
                    width: width, neckWidth: neck / 2, top: length, underarm: underarm)
                guides.append(contentsOf: raglans)
            }
        }
        if let rib = positive(metrics.ribDepth), rib < length {
            guides.append(horizontalGuide(y: rib, from: 0, to: width))
        }

        return SchematicPiece(
            name: "Body (front and back)",
            outline: rectangle(width: width, height: length),
            guides: guides,
            dimensions: dimensions,
            quantity: 1,
            caption: "Worked in the round, shown as half the chest laid flat.")
    }

    /// Raglan lines run from each side of the neck opening out to the underarm.
    private static func raglanGuides(
        width: Double, neckWidth: Double, top: Double, underarm: Double
    ) -> [[SchematicPoint]] {
        let centre = width / 2
        let neckLeft = centre - neckWidth / 2
        let neckRight = centre + neckWidth / 2
        let left: [SchematicPoint] = [
            SchematicPoint(neckLeft, top),
            SchematicPoint(0, underarm),
        ]
        let right: [SchematicPoint] = [
            SchematicPoint(neckRight, top),
            SchematicPoint(width, underarm),
        ]
        return [left, right]
    }

    private static func sweaterSleeve(metrics: PlanMetrics, options: ProjectOptions) -> SchematicPiece? {
        guard let upperArm = positive(metrics.upperArmCircumference) else { return nil }
        guard let cuff = positive(metrics.cuffCircumference) else { return nil }
        guard let length = positive(metrics.sleeveLength) else { return nil }

        let topWidth = upperArm / 2
        let bottomWidth = cuff / 2
        let widest = max(topWidth, bottomWidth)
        let topInset = (widest - topWidth) / 2
        let bottomInset = (widest - bottomWidth) / 2

        var guides: [[SchematicPoint]] = []
        let cuffDepth = options.cuffDepth
        if cuffDepth > 0, cuffDepth < length {
            let guide = trapezoidGuide(
                bottomWidth: bottomWidth, topWidth: topWidth, height: length, at: cuffDepth)
            guides.append(guide)
        }

        let dimensions: [SchematicDimension] = [
            horizontalDimension(y: length, from: topInset, to: topInset + topWidth),
            horizontalDimension(y: 0, from: bottomInset, to: bottomInset + bottomWidth),
            verticalDimension(x: 0, from: 0, to: length),
        ]
        return SchematicPiece(
            name: "Sleeve",
            outline: trapezoid(bottomWidth: bottomWidth, topWidth: topWidth, height: length),
            guides: guides,
            dimensions: dimensions,
            quantity: 2,
            caption: "Picked up at the underarm and worked down to the cuff, shown laid flat.")
    }

    private static func sweaterNeckband(metrics: PlanMetrics) -> SchematicPiece? {
        guard let neck = positive(metrics.neckCircumference) else { return nil }

        let depth: Double = 3
        let dimensions: [SchematicDimension] = [
            horizontalDimension(y: 0, from: 0, to: neck),
            verticalDimension(x: 0, from: 0, to: depth),
        ]
        return SchematicPiece(
            name: "Neckband",
            outline: rectangle(width: neck, height: depth),
            guides: [],
            dimensions: dimensions,
            quantity: 1,
            caption: "The cast-on edge, opened out flat.")
    }

    // MARK: - Sock

    private static func sockLeg(metrics: PlanMetrics, options: ProjectOptions) -> SchematicPiece? {
        guard let circumference = positive(metrics.footCircumference) else { return nil }
        guard let legLength = positive(metrics.legLength) else { return nil }

        let width = circumference / 2
        var guides: [[SchematicPoint]] = []
        // Worked cuff down, so the rib sits at the top of the leg.
        let cuffDepth = options.cuffDepth
        if cuffDepth > 0, cuffDepth < legLength {
            guides.append(horizontalGuide(y: legLength - cuffDepth, from: 0, to: width))
        }
        let dimensions: [SchematicDimension] = [
            horizontalDimension(y: 0, from: 0, to: width),
            verticalDimension(x: 0, from: 0, to: legLength),
        ]
        return SchematicPiece(
            name: "Leg",
            outline: rectangle(width: width, height: legLength),
            guides: guides,
            dimensions: dimensions,
            quantity: 2,
            caption: "The leg tube laid flat, cuff at the top.")
    }

    private static func sockFoot(metrics: PlanMetrics) -> SchematicPiece? {
        guard let circumference = positive(metrics.footCircumference) else { return nil }
        guard let footLength = positive(metrics.footLength) else { return nil }

        let width = circumference / 2
        let heelDepth: Double = positive(metrics.heelDepth) ?? 0
        let outline: [SchematicPoint]
        if heelDepth > 0 {
            // The heel hangs below the sole at the back of the foot; it is drawn
            // over the back half so the step reads as a heel and not as length.
            outline = lShape(
                width: width, height: footLength, stepWidth: width / 2, stepDepth: heelDepth)
        } else {
            outline = rectangle(width: width, height: footLength)
        }

        var guides: [[SchematicPoint]] = []
        let toeStart = footLength - width
        if toeStart > 0 {
            guides.append(horizontalGuide(y: heelDepth + toeStart, from: 0, to: width))
        }

        var dimensions: [SchematicDimension] = [
            horizontalDimension(y: heelDepth, from: 0, to: width),
            verticalDimension(x: width, from: heelDepth, to: heelDepth + footLength),
        ]
        if heelDepth > 0 {
            dimensions.append(verticalDimension(x: 0, from: 0, to: heelDepth))
        }
        return SchematicPiece(
            name: "Foot",
            outline: outline,
            guides: guides,
            dimensions: dimensions,
            quantity: 2,
            caption: "Measured from the back of the heel. The toe decreases start at the guide line.")
    }

    // MARK: - Mitten

    private static func mittenPiece(metrics: PlanMetrics) -> SchematicPiece? {
        // A mitten's circumference is the hand measurement less its negative ease.
        guard let circumference = positive(metrics.circumference) else { return nil }
        guard let handLength = positive(metrics.handLength) else { return nil }

        let width = circumference / 2
        let tipHeight = handLength / 3
        var outline: [SchematicPoint] = [
            SchematicPoint(0, 0),
            SchematicPoint(width, 0),
        ]
        outline.append(contentsOf: dome(
            width: width, height: tipHeight, baseY: handLength - tipHeight, steps: 5))

        var guides: [[SchematicPoint]] = []
        let ribDepth: Double = positive(metrics.ribDepth) ?? 0
        if ribDepth > 0, ribDepth < handLength {
            guides.append(horizontalGuide(y: ribDepth, from: 0, to: width))
        }
        if let thumb = positive(metrics.thumbLength), ribDepth + thumb < handLength {
            // The gusset takes about a quarter of the hand circumference, which is
            // half the width once the mitten is flattened.
            let thumbWidth = width / 2
            let gussetTop = ribDepth + thumb
            let triangle: [SchematicPoint] = [
                SchematicPoint(0, ribDepth),
                SchematicPoint(thumbWidth, gussetTop),
                SchematicPoint(0, gussetTop),
                SchematicPoint(0, ribDepth),
            ]
            guides.append(triangle)
        }

        let dimensions: [SchematicDimension] = [
            horizontalDimension(y: 0, from: 0, to: width),
            verticalDimension(x: 0, from: 0, to: handLength),
        ]
        return SchematicPiece(
            name: "Hand",
            outline: outline,
            guides: guides,
            dimensions: dimensions,
            quantity: 2,
            caption: "Shown laid flat with the thumb gusset at the side. Mirror it for the second mitten.")
    }

    // MARK: - Fallback

    /// Something is better than nothing: if the fields a piece needs are missing,
    /// draw a plain rectangle from whatever width and height did arrive.
    private static func fallback(kind: PatternKind, metrics: PlanMetrics) -> GarmentSchematic {
        guard let width = fallbackWidth(metrics) else {
            return GarmentSchematic(pieces: [], note: emptyNote)
        }
        guard let height = fallbackHeight(metrics) else {
            return GarmentSchematic(pieces: [], note: emptyNote)
        }
        let dimensions: [SchematicDimension] = [
            horizontalDimension(y: 0, from: 0, to: width),
            verticalDimension(x: 0, from: 0, to: height),
        ]
        let piece = SchematicPiece(
            name: kind.name,
            outline: rectangle(width: width, height: height),
            guides: [],
            dimensions: dimensions,
            quantity: 1,
            caption: "Overall size only — the shaping is not worked out yet.")
        return GarmentSchematic(pieces: [piece], note: standardNote)
    }

    private static func fallbackWidth(_ metrics: PlanMetrics) -> Double? {
        if let width = positive(metrics.flatWidth) { return width }
        if let circumference = positive(metrics.circumference) { return circumference / 2 }
        if let chest = positive(metrics.chestCircumference) { return chest / 2 }
        if let foot = positive(metrics.footCircumference) { return foot / 2 }
        if let wingspan = positive(metrics.wingspan) { return wingspan }
        return nil
    }

    private static func fallbackHeight(_ metrics: PlanMetrics) -> Double? {
        if let length = positive(metrics.flatLength) { return length }
        if let depth = positive(metrics.depth) { return depth }
        if let bodyLength = positive(metrics.bodyLength) { return bodyLength }
        if let bodyDepth = positive(metrics.bodyDepth) { return bodyDepth }
        if let footLength = positive(metrics.footLength) { return footLength }
        if let handLength = positive(metrics.handLength) { return handLength }
        return nil
    }

    // MARK: - Geometry

    private static func positive(_ value: Double?) -> Double? {
        guard let value = value, value > 0 else { return nil }
        return value
    }

    /// Corners anticlockwise from the bottom-left.
    private static func rectangle(width: Double, height: Double) -> [SchematicPoint] {
        return [
            SchematicPoint(0, 0),
            SchematicPoint(width, 0),
            SchematicPoint(width, height),
            SchematicPoint(0, height),
        ]
    }

    /// A tapered piece, both widths centred on the same vertical axis.
    private static func trapezoid(
        bottomWidth: Double, topWidth: Double, height: Double
    ) -> [SchematicPoint] {
        let widest = max(bottomWidth, topWidth)
        let bottomInset = (widest - bottomWidth) / 2
        let topInset = (widest - topWidth) / 2
        return [
            SchematicPoint(bottomInset, 0),
            SchematicPoint(bottomInset + bottomWidth, 0),
            SchematicPoint(topInset + topWidth, height),
            SchematicPoint(topInset, height),
        ]
    }

    /// A horizontal line across a trapezoid at a given height, following the taper.
    private static func trapezoidGuide(
        bottomWidth: Double, topWidth: Double, height: Double, at y: Double
    ) -> [SchematicPoint] {
        let widest = max(bottomWidth, topWidth)
        let fraction = y / height
        let widthHere = bottomWidth + (topWidth - bottomWidth) * fraction
        let inset = (widest - widthHere) / 2
        return [
            SchematicPoint(inset, y),
            SchematicPoint(inset + widthHere, y),
        ]
    }

    /// Half an ellipse, running right to left so it continues an outline that
    /// has just come up the right-hand edge.
    private static func dome(
        width: Double, height: Double, baseY: Double, steps: Int
    ) -> [SchematicPoint] {
        let count = max(2, steps)
        let radius = width / 2
        let centre = width / 2
        var points: [SchematicPoint] = []
        points.reserveCapacity(count + 1)
        for index in 0 ... count {
            let angle = Double(index) / Double(count) * Double.pi
            let x = centre + radius * cos(angle)
            let y = baseY + height * sin(angle)
            points.append(SchematicPoint(x, y))
        }
        return points
    }

    /// A rectangle with a block hanging below its back edge — the sock heel.
    private static func lShape(
        width: Double, height: Double, stepWidth: Double, stepDepth: Double
    ) -> [SchematicPoint] {
        let top = stepDepth + height
        return [
            SchematicPoint(0, 0),
            SchematicPoint(stepWidth, 0),
            SchematicPoint(stepWidth, stepDepth),
            SchematicPoint(width, stepDepth),
            SchematicPoint(width, top),
            SchematicPoint(0, top),
        ]
    }

    // MARK: - Dimensions

    private static func label(_ centimetres: Double) -> String {
        return String(format: "%.1f cm", centimetres)
    }

    private static func horizontalDimension(y: Double, from startX: Double, to endX: Double) -> SchematicDimension {
        return SchematicDimension(
            from: SchematicPoint(startX, y),
            to: SchematicPoint(endX, y),
            text: label(endX - startX))
    }

    private static func verticalDimension(x: Double, from startY: Double, to endY: Double) -> SchematicDimension {
        return SchematicDimension(
            from: SchematicPoint(x, startY),
            to: SchematicPoint(x, endY),
            text: label(endY - startY))
    }

    private static func horizontalGuide(y: Double, from startX: Double, to endX: Double) -> [SchematicPoint] {
        return [SchematicPoint(startX, y), SchematicPoint(endX, y)]
    }
}
