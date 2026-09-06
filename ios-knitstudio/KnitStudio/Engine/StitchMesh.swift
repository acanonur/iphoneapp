import Foundation

/// The things a knitter's own hands change about the fabric, and the two
/// choices about how it is drawn.
struct FabricSettings: Codable, Equatable {
    /// Below 1 the knitting is loose and open, above 1 it is tight.
    var tension: Double = 1.0
    /// How much of its stitch the yarn itself fills.
    var fullness: Double = 1.0
    /// 0 leaves the stitches on a plain grid; 1 lets the fabric settle fully.
    var settling: Double = 1.0
    /// Line art instead of coloured yarn, the way a pattern book prints it.
    var outlined: Bool = false

    init(tension: Double = 1.0, fullness: Double = 1.0, settling: Double = 1.0, outlined: Bool = false) {
        self.tension = min(max(tension, 0.6), 1.6)
        self.fullness = min(max(fullness, 0.5), 1.6)
        self.settling = min(max(settling, 0), 1)
        self.outlined = outlined
    }
}

/// Where every stitch actually ends up once the fabric has been allowed to
/// settle.
///
/// Knitting does not sit on a grid. A cable pulls its columns in, a yarn-over
/// shoulders its neighbours apart, a decrease eats width — and because the
/// fabric is one connected thing, everything around them has to move too. That
/// is why lace scallops along its cast-off edge and a cabled panel pulls in.
///
/// So: put a node at every stitch corner, give every edge between two nodes a
/// rest length that depends on the stitches either side of it, and relax the
/// whole mesh until it stops fighting itself.
struct StitchMesh: Equatable {

    struct Point: Equatable {
        var x: Double
        var y: Double

        init(_ x: Double, _ y: Double) {
            self.x = x
            self.y = y
        }
    }

    let columns: Int
    let rows: Int
    /// `(columns + 1) * (rows + 1)` corners, row-major, row 0 at the bottom.
    /// Measured in stitch widths across and row heights up.
    private(set) var corners: [Point]

    private init(columns: Int, rows: Int, corners: [Point]) {
        self.columns = columns
        self.rows = rows
        self.corners = corners
    }

    /// The unrelaxed grid, used before the first settle has been worked out.
    static func flat(columns: Int, rows: Int) -> StitchMesh {
        let width = max(1, columns)
        let height = max(1, rows)
        var points: [Point] = []
        points.reserveCapacity((width + 1) * (height + 1))
        for y in 0 ... height {
            for x in 0 ... width {
                points.append(Point(Double(x), Double(y)))
            }
        }
        return StitchMesh(columns: width, rows: height, corners: points)
    }

    // MARK: - Reading it

    func corner(x: Int, y: Int) -> Point {
        let column = min(max(0, x), columns)
        let row = min(max(0, y), rows)
        return corners[row * (columns + 1) + column]
    }

    /// The four corners of one stitch.
    func cell(x: Int, y: Int) -> (bottomLeft: Point, bottomRight: Point, topLeft: Point, topRight: Point) {
        (
            bottomLeft: corner(x: x, y: y),
            bottomRight: corner(x: x + 1, y: y),
            topLeft: corner(x: x, y: y + 1),
            topRight: corner(x: x + 1, y: y + 1)
        )
    }

    var bounds: (width: Double, height: Double) {
        var maxX = 0.0
        var maxY = 0.0
        for point in corners {
            maxX = max(maxX, point.x)
            maxY = max(maxY, point.y)
        }
        return (width: max(0.001, maxX), height: max(0.001, maxY))
    }

    // MARK: - Settling

    static func build(
        pattern: StitchPattern,
        columns: Int,
        rows: Int,
        settings: FabricSettings
    ) -> StitchMesh {
        var mesh = StitchMesh.flat(columns: columns, rows: rows)
        let iterations = Int((Double(StitchMesh.maximumIterations) * settings.settling).rounded())
        guard iterations > 0 else { return mesh }
        mesh.relax(pattern: pattern, tension: settings.tension, iterations: iterations)
        mesh.recentre()
        return mesh
    }

    /// Enough to settle a swatch without the slider feeling sticky.
    private static let maximumIterations = 90
    private static let stiffness = 0.5
    private static let smoothing = 0.06

    private func symbol(_ pattern: StitchPattern, _ x: Int, _ y: Int) -> StitchSymbol {
        guard x >= 0, x < columns, y >= 0, y < rows else { return .knit }
        return pattern.fabricAppearance(x: x, fabricRow: y)
    }

    /// The horizontal edge from corner (x, y) to (x + 1, y) is the top of the
    /// stitch below it and the bottom of the one above, so it splits the
    /// difference between what those two want.
    private func restWidth(_ pattern: StitchPattern, x: Int, y: Int, tension: Double) -> Double {
        let below = symbol(pattern, x, y - 1).relaxedWidth
        let above = symbol(pattern, x, y).relaxedWidth
        let base = (below + above) / 2
        return base / tension * (1 + 0.05 * StitchMesh.wobble(x: x, y: y, salt: 1))
    }

    private func restHeight(_ pattern: StitchPattern, x: Int, y: Int, tension: Double) -> Double {
        let left = symbol(pattern, x - 1, y).relaxedHeight
        let right = symbol(pattern, x, y).relaxedHeight
        let base = (left + right) / 2
        return base / tension * (1 + 0.04 * StitchMesh.wobble(x: x, y: y, salt: 2))
    }

    private mutating func relax(pattern: StitchPattern, tension: Double, iterations: Int) {
        for _ in 0 ..< iterations {
            for y in 0 ... rows {
                for x in 0 ..< columns {
                    let rest = restWidth(pattern, x: x, y: y, tension: tension)
                    pull(from: (x, y), to: (x + 1, y), rest: rest)
                }
            }
            for y in 0 ..< rows {
                for x in 0 ... columns {
                    let rest = restHeight(pattern, x: x, y: y, tension: tension)
                    pull(from: (x, y), to: (x, y + 1), rest: rest)
                }
            }
            // Without a little smoothing the mesh kinks into zigzags instead of
            // easing into the curves real fabric makes.
            smooth()
        }
    }

    private mutating func pull(from: (x: Int, y: Int), to: (x: Int, y: Int), rest: Double) {
        let a = from.y * (columns + 1) + from.x
        let b = to.y * (columns + 1) + to.x
        let dx = corners[b].x - corners[a].x
        let dy = corners[b].y - corners[a].y
        let distance = (dx * dx + dy * dy).squareRoot()
        guard distance > 1e-9 else { return }
        let scale = (distance - rest) / distance * 0.5 * StitchMesh.stiffness
        corners[a].x += dx * scale
        corners[a].y += dy * scale
        corners[b].x -= dx * scale
        corners[b].y -= dy * scale
    }

    private mutating func smooth() {
        guard columns >= 2, rows >= 2 else { return }
        let stride = columns + 1
        for y in 1 ..< rows {
            for x in 1 ..< columns {
                let index = y * stride + x
                let averageX = (corners[index - 1].x + corners[index + 1].x
                                + corners[index - stride].x + corners[index + stride].x) / 4
                let averageY = (corners[index - 1].y + corners[index + 1].y
                                + corners[index - stride].y + corners[index + stride].y) / 4
                corners[index].x += (averageX - corners[index].x) * StitchMesh.smoothing
                corners[index].y += (averageY - corners[index].y) * StitchMesh.smoothing
            }
        }
    }

    private mutating func recentre() {
        var minX = corners.first?.x ?? 0
        var minY = corners.first?.y ?? 0
        for point in corners {
            minX = min(minX, point.x)
            minY = min(minY, point.y)
        }
        for index in corners.indices {
            corners[index].x -= minX
            corners[index].y -= minY
        }
    }

    /// A repeatable unevenness. Hand knitting is never mechanically regular,
    /// but a random number generator would reshuffle the fabric on every
    /// redraw, so this is hashed from the coordinates instead.
    static func wobble(x: Int, y: Int, salt: Int) -> Double {
        var hash = UInt64(truncatingIfNeeded: x &* 73_856_093)
        hash ^= UInt64(truncatingIfNeeded: y &* 19_349_663)
        hash ^= UInt64(truncatingIfNeeded: salt &* 83_492_791)
        hash = hash &* 2_654_435_761
        hash ^= hash >> 29
        return Double(hash % 1000) / 1000 - 0.5
    }
}
