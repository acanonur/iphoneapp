import SwiftUI

/// The Lucide icon set the design system calls for, drawn from the same 24-unit
/// path data the prototype used so the glyphs are the designed ones rather than
/// SF Symbols that merely mean the same thing.
///
/// Icons inherit the current foreground style, exactly as `currentColor` does in
/// the source SVGs, and their 2-unit stroke scales with the requested size.
struct Lucide {
    /// One primitive from the source SVG, in viewBox units.
    enum Element {
        case path(String)
        case circle(cx: CGFloat, cy: CGFloat, r: CGFloat)
        case rect(x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat, r: CGFloat = 0)
        case line(x1: CGFloat, y1: CGFloat, x2: CGFloat, y2: CGFloat)
        case polygon([CGFloat])
    }

    let elements: [Element]
    /// True for the glyphs the design fills as well as strokes (the stop square).
    var filled: Bool = false

    /// Builds the glyph in the 24-unit viewBox, then scales it to `size`.
    func path(size: CGFloat) -> Path {
        var path = Path()
        for element in elements {
            switch element {
            case let .path(d):
                path.addPath(SVGPath.parse(d))
            case let .circle(cx, cy, r):
                path.addEllipse(in: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))
            case let .rect(x, y, w, h, r):
                let rect = CGRect(x: x, y: y, width: w, height: h)
                if r > 0 {
                    path.addRoundedRect(in: rect, cornerSize: CGSize(width: r, height: r))
                } else {
                    path.addRect(rect)
                }
            case let .line(x1, y1, x2, y2):
                path.move(to: CGPoint(x: x1, y: y1))
                path.addLine(to: CGPoint(x: x2, y: y2))
            case let .polygon(points):
                guard points.count >= 4 else { break }
                path.move(to: CGPoint(x: points[0], y: points[1]))
                for i in stride(from: 2, to: points.count - 1, by: 2) {
                    path.addLine(to: CGPoint(x: points[i], y: points[i + 1]))
                }
                path.closeSubpath()
            }
        }
        let scale = size / 24
        return path.applying(CGAffineTransform(scaleX: scale, y: scale))
    }
}

/// A Lucide glyph at an interface size, stroked the way the set is drawn:
/// 2 units wide, round caps, round joins.
struct Icon: View {
    let glyph: Lucide
    var size: CGFloat = 20

    var body: some View {
        let shape = IconShape(glyph: glyph, size: size)
        ZStack {
            if glyph.filled { shape }
            shape.stroke(
                style: StrokeStyle(lineWidth: 2 * size / 24, lineCap: .round, lineJoin: .round)
            )
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

private struct IconShape: Shape {
    let glyph: Lucide
    let size: CGFloat

    func path(in rect: CGRect) -> Path {
        glyph.path(size: size)
    }
}

// MARK: - The glyphs used by the app

extension Lucide {
    static let languages = Lucide(elements: [
        .path("m5 8 6 6"), .path("m4 14 6-6 2-3"), .path("M2 5h12"), .path("M7 2h1"),
        .path("m22 22-5-10-5 10"), .path("M14 18h6"),
    ])

    static let user = Lucide(elements: [
        .path("M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"),
        .circle(cx: 12, cy: 7, r: 4),
    ])

    static let phone = Lucide(elements: [
        .path("M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"),
    ])

    static let fileText = Lucide(elements: [
        .path("M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"),
        .path("M14 2v4a2 2 0 0 0 2 2h4"),
        .path("M10 9H8"), .path("M16 13H8"), .path("M16 17H8"),
    ])

    static let mail = Lucide(elements: [
        .rect(x: 2, y: 4, w: 20, h: 16, r: 2),
        .path("m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"),
    ])

    static let clipboardList = Lucide(elements: [
        .rect(x: 8, y: 2, w: 8, h: 4, r: 1),
        .path("M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"),
        .path("M12 11h4"), .path("M12 16h4"), .path("M8 11h.01"), .path("M8 16h.01"),
    ])

    static let bell = Lucide(elements: [
        .path("M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"),
        .path("M10.3 21a1.94 1.94 0 0 0 3.4 0"),
    ])

    static let chevronRight = Lucide(elements: [.path("m9 18 6-6-6-6")])
    static let chevronLeft = Lucide(elements: [.path("m15 18-6-6 6-6")])
    static let arrowRight = Lucide(elements: [.path("M5 12h14"), .path("m12 5 7 7-7 7")])
    static let close = Lucide(elements: [.path("M18 6 6 18"), .path("m6 6 12 12")])
    static let check = Lucide(elements: [.path("M20 6 9 17l-5-5")])

    static let camera = Lucide(elements: [
        .path("M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"),
        .circle(cx: 12, cy: 13, r: 3),
    ])

    static let share = Lucide(elements: [
        .path("M12 3v12"), .path("m17 8-5-5-5 5"),
        .path("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"),
    ])

    private static let speakerCone = Element.polygon([11, 5, 6, 9, 2, 9, 2, 15, 6, 15, 11, 19])

    static let volumeHigh = Lucide(elements: [
        speakerCone,
        .path("M15.54 8.46a5 5 0 0 1 0 7.07"),
        .path("M19.07 4.93a10 10 0 0 1 0 14.14"),
    ])

    static let volumeLow = Lucide(elements: [
        speakerCone,
        .path("M15.54 8.46a5 5 0 0 1 0 7.07"),
    ])

    static let volumeOff = Lucide(elements: [
        speakerCone,
        .line(x1: 22, y1: 9, x2: 16, y2: 15),
        .line(x1: 16, y1: 9, x2: 22, y2: 15),
    ])

    static let swap = Lucide(elements: [
        .path("M8 3 4 7l4 4"), .path("M4 7h16"),
        .path("m16 21 4-4-4-4"), .path("M20 17H4"),
    ])

    static let mic = Lucide(elements: [
        .path("M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"),
        .path("M19 10v2a7 7 0 0 1-14 0v-2"),
        .line(x1: 12, y1: 19, x2: 12, y2: 22),
    ])

    static let stop = Lucide(elements: [.rect(x: 4, y: 4, w: 16, h: 16)], filled: true)
}
