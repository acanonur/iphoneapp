import CoreGraphics
import SwiftUI

/// A small SVG path-data parser, so icon geometry can be kept in the form the
/// design ships it (`d="M15 2H6a2 2 0 0 0-2 2…"`) instead of being hand-ported
/// into Core Graphics calls and drifting from the source.
///
/// Supports the full path grammar — `M L H V C S Q T A Z`, absolute and
/// relative — with elliptical arcs converted to cubic béziers.
enum SVGPath {

    static func parse(_ d: String) -> Path {
        var path = Path()
        var scanner = PathScanner(d)
        var current = CGPoint.zero
        var subpathStart = CGPoint.zero
        /// Previous cubic/quadratic control point, for the reflections `S` and `T` need.
        var lastCubicControl: CGPoint?
        var lastQuadControl: CGPoint?
        var command: Character = "M"

        func point(_ x: CGFloat, _ y: CGFloat, relative: Bool) -> CGPoint {
            relative ? CGPoint(x: current.x + x, y: current.y + y) : CGPoint(x: x, y: y)
        }

        while true {
            var isFreshCommand = false
            if let next = scanner.nextCommand() {
                command = next
                isFreshCommand = true
            } else if scanner.atEnd {
                break
            }
            // A repeated coordinate run continues the previous command; after a
            // moveto it continues as a lineto, per the grammar.
            let relative = command.isLowercase
            let op = Character(command.uppercased())

            switch op {
            case "M":
                guard let x = scanner.nextNumber(), let y = scanner.nextNumber() else { return path }
                current = point(x, y, relative: relative)
                subpathStart = current
                path.move(to: current)
                command = relative ? "l" : "L"
                lastCubicControl = nil
                lastQuadControl = nil

            case "L":
                guard let x = scanner.nextNumber(), let y = scanner.nextNumber() else { return path }
                current = point(x, y, relative: relative)
                path.addLine(to: current)
                lastCubicControl = nil
                lastQuadControl = nil

            case "H":
                guard let x = scanner.nextNumber() else { return path }
                current = CGPoint(x: relative ? current.x + x : x, y: current.y)
                path.addLine(to: current)
                lastCubicControl = nil
                lastQuadControl = nil

            case "V":
                guard let y = scanner.nextNumber() else { return path }
                current = CGPoint(x: current.x, y: relative ? current.y + y : y)
                path.addLine(to: current)
                lastCubicControl = nil
                lastQuadControl = nil

            case "C":
                guard let x1 = scanner.nextNumber(), let y1 = scanner.nextNumber(),
                      let x2 = scanner.nextNumber(), let y2 = scanner.nextNumber(),
                      let x = scanner.nextNumber(), let y = scanner.nextNumber() else { return path }
                let c1 = point(x1, y1, relative: relative)
                let c2 = point(x2, y2, relative: relative)
                current = point(x, y, relative: relative)
                path.addCurve(to: current, control1: c1, control2: c2)
                lastCubicControl = c2
                lastQuadControl = nil

            case "S":
                guard let x2 = scanner.nextNumber(), let y2 = scanner.nextNumber(),
                      let x = scanner.nextNumber(), let y = scanner.nextNumber() else { return path }
                let c1 = reflect(lastCubicControl, about: current)
                let c2 = point(x2, y2, relative: relative)
                current = point(x, y, relative: relative)
                path.addCurve(to: current, control1: c1, control2: c2)
                lastCubicControl = c2
                lastQuadControl = nil

            case "Q":
                guard let x1 = scanner.nextNumber(), let y1 = scanner.nextNumber(),
                      let x = scanner.nextNumber(), let y = scanner.nextNumber() else { return path }
                let c = point(x1, y1, relative: relative)
                current = point(x, y, relative: relative)
                path.addQuadCurve(to: current, control: c)
                lastQuadControl = c
                lastCubicControl = nil

            case "T":
                guard let x = scanner.nextNumber(), let y = scanner.nextNumber() else { return path }
                let c = reflect(lastQuadControl, about: current)
                current = point(x, y, relative: relative)
                path.addQuadCurve(to: current, control: c)
                lastQuadControl = c
                lastCubicControl = nil

            case "A":
                guard let rx = scanner.nextNumber(), let ry = scanner.nextNumber(),
                      let rotation = scanner.nextNumber(),
                      let largeArc = scanner.nextFlag(), let sweep = scanner.nextFlag(),
                      let x = scanner.nextNumber(), let y = scanner.nextNumber() else { return path }
                let end = point(x, y, relative: relative)
                appendArc(
                    to: &path, from: current, to: end,
                    rx: rx, ry: ry, rotationDegrees: rotation,
                    largeArc: largeArc, sweep: sweep
                )
                current = end
                lastCubicControl = nil
                lastQuadControl = nil

            case "Z":
                // `Z` takes no arguments, so it can never continue implicitly —
                // anything else left in the run is malformed.
                guard isFreshCommand else { return path }
                path.closeSubpath()
                current = subpathStart
                lastCubicControl = nil
                lastQuadControl = nil

            default:
                return path
            }

            if scanner.atEnd { break }
        }
        return path
    }

    private static func reflect(_ control: CGPoint?, about point: CGPoint) -> CGPoint {
        guard let control else { return point }
        return CGPoint(x: 2 * point.x - control.x, y: 2 * point.y - control.y)
    }

    // MARK: - Elliptical arcs
    //
    // Endpoint to centre parameterisation, per SVG 1.1 appendix F.6, then split
    // into quarter-turn cubic segments.

    private static func appendArc(
        to path: inout Path,
        from start: CGPoint,
        to end: CGPoint,
        rx: CGFloat,
        ry: CGFloat,
        rotationDegrees: CGFloat,
        largeArc: Bool,
        sweep: Bool
    ) {
        var rx = abs(rx), ry = abs(ry)
        guard rx > 0, ry > 0, start != end else {
            path.addLine(to: end)
            return
        }

        let phi = rotationDegrees * .pi / 180
        let cosPhi = cos(phi), sinPhi = sin(phi)

        let dx = (start.x - end.x) / 2, dy = (start.y - end.y) / 2
        let x1 = cosPhi * dx + sinPhi * dy
        let y1 = -sinPhi * dx + cosPhi * dy

        // Scale the radii up if they are too small to span the two endpoints.
        let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
        if lambda > 1 {
            let scale = sqrt(lambda)
            rx *= scale
            ry *= scale
        }

        let numerator = max(0, rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1)
        let denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1
        let coefficient = (largeArc == sweep ? -1 : 1) * sqrt(denominator == 0 ? 0 : numerator / denominator)

        let cx1 = coefficient * rx * y1 / ry
        let cy1 = -coefficient * ry * x1 / rx
        let center = CGPoint(
            x: cosPhi * cx1 - sinPhi * cy1 + (start.x + end.x) / 2,
            y: sinPhi * cx1 + cosPhi * cy1 + (start.y + end.y) / 2
        )

        let startAngle = angle(from: CGPoint(x: 1, y: 0),
                               to: CGPoint(x: (x1 - cx1) / rx, y: (y1 - cy1) / ry))
        var sweepAngle = angle(from: CGPoint(x: (x1 - cx1) / rx, y: (y1 - cy1) / ry),
                               to: CGPoint(x: (-x1 - cx1) / rx, y: (-y1 - cy1) / ry))
        if !sweep, sweepAngle > 0 { sweepAngle -= 2 * .pi }
        if sweep, sweepAngle < 0 { sweepAngle += 2 * .pi }

        let segments = max(1, Int(ceil(abs(sweepAngle) / (.pi / 2))))
        let delta = sweepAngle / CGFloat(segments)
        let alpha = 4.0 / 3.0 * tan(delta / 4)

        func onEllipse(_ theta: CGFloat) -> CGPoint {
            CGPoint(
                x: center.x + rx * cosPhi * cos(theta) - ry * sinPhi * sin(theta),
                y: center.y + rx * sinPhi * cos(theta) + ry * cosPhi * sin(theta)
            )
        }
        func derivative(_ theta: CGFloat) -> CGPoint {
            CGPoint(
                x: -rx * cosPhi * sin(theta) - ry * sinPhi * cos(theta),
                y: -rx * sinPhi * sin(theta) + ry * cosPhi * cos(theta)
            )
        }

        for i in 0 ..< segments {
            let theta1 = startAngle + CGFloat(i) * delta
            let theta2 = theta1 + delta
            let p1 = onEllipse(theta1), p2 = onEllipse(theta2)
            let d1 = derivative(theta1), d2 = derivative(theta2)
            path.addCurve(
                to: p2,
                control1: CGPoint(x: p1.x + alpha * d1.x, y: p1.y + alpha * d1.y),
                control2: CGPoint(x: p2.x - alpha * d2.x, y: p2.y - alpha * d2.y)
            )
        }
    }

    private static func angle(from u: CGPoint, to v: CGPoint) -> CGFloat {
        let dot = u.x * v.x + u.y * v.y
        let length = sqrt(u.x * u.x + u.y * u.y) * sqrt(v.x * v.x + v.y * v.y)
        guard length > 0 else { return 0 }
        let sign: CGFloat = (u.x * v.y - u.y * v.x) < 0 ? -1 : 1
        return sign * acos(min(1, max(-1, dot / length)))
    }

    // MARK: - Tokenising

    /// Path data separates numbers by whitespace, commas, or nothing at all —
    /// `m4 14 6-6 2-3` is five numbers — so the scanner has to find the
    /// boundaries itself rather than splitting on a separator.
    private struct PathScanner {
        private let characters: [Character]
        private var index = 0

        init(_ string: String) {
            characters = Array(string)
        }

        var atEnd: Bool {
            var probe = index
            while probe < characters.count, isSeparator(characters[probe]) { probe += 1 }
            return probe >= characters.count
        }

        private func isSeparator(_ character: Character) -> Bool {
            character == "," || character.isWhitespace
        }

        private mutating func skipSeparators() {
            while index < characters.count, isSeparator(characters[index]) { index += 1 }
        }

        /// Returns the next command letter, or nil when the run continues with
        /// more coordinates for the command already in hand.
        mutating func nextCommand() -> Character? {
            skipSeparators()
            guard index < characters.count else { return nil }
            let character = characters[index]
            guard character.isLetter, character != "e", character != "E" else { return nil }
            index += 1
            return character
        }

        mutating func nextNumber() -> CGFloat? {
            skipSeparators()
            guard index < characters.count else { return nil }
            let start = index
            if characters[index] == "-" || characters[index] == "+" { index += 1 }
            var sawDot = false
            while index < characters.count {
                let character = characters[index]
                if character.isNumber {
                    index += 1
                } else if character == ".", !sawDot {
                    sawDot = true
                    index += 1
                } else if character == "e" || character == "E" {
                    index += 1
                    if index < characters.count, characters[index] == "-" || characters[index] == "+" {
                        index += 1
                    }
                } else {
                    break
                }
            }
            guard index > start, let value = Double(String(characters[start ..< index])) else {
                index = start
                return nil
            }
            return CGFloat(value)
        }

        /// Arc flags are single digits and may be packed against what follows
        /// (`a2 2 0 0 1-2 2`), so they cannot go through `nextNumber`.
        mutating func nextFlag() -> Bool? {
            skipSeparators()
            guard index < characters.count else { return nil }
            let character = characters[index]
            guard character == "0" || character == "1" else { return nil }
            index += 1
            return character == "1"
        }
    }
}
