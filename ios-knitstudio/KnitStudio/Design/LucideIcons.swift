import SwiftUI

/// The handful of Lucide icons the redesign uses, drawn rather than imported.
///
/// The design system asks for Lucide at stroke-width 2.75 on a 24-unit grid.
/// SF Symbols are a different family at a different weight, so putting them on
/// these screens would mean two icon languages on one page. There are only five
/// shapes, and they are all lines and one closed outline.
private struct LucideShape: Shape {
    /// Points on Lucide's 24-unit grid; each array is one open sub-path.
    var strokes: [[CGPoint]]
    var closed: Bool = false

    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height)
        func p(_ pt: CGPoint) -> CGPoint {
            CGPoint(x: rect.minX + pt.x / 24 * s, y: rect.minY + pt.y / 24 * s)
        }
        var path = Path()
        for stroke in strokes where stroke.count > 1 {
            path.move(to: p(stroke[0]))
            for point in stroke.dropFirst() { path.addLine(to: p(point)) }
            if closed { path.closeSubpath() }
        }
        return path
    }
}

private struct LucideIcon: View {
    var strokes: [[CGPoint]]
    var tint: Color
    var size: CGFloat
    var closed = false
    var filled = false

    var body: some View {
        let shape = LucideShape(strokes: strokes, closed: closed)
        Group {
            if filled {
                shape.fill(tint)
            } else {
                shape.stroke(
                    tint,
                    style: StrokeStyle(lineWidth: size * 2.75 / 24, lineCap: .round, lineJoin: .round)
                )
            }
        }
        .frame(width: size, height: size)
    }
}

private func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x, y: y) }

struct LucideChevronLeft: View {
    var tint: Color
    var size: CGFloat = 22
    var body: some View {
        LucideIcon(strokes: [[pt(15, 18), pt(9, 12), pt(15, 6)]], tint: tint, size: size)
    }
}

struct LucideChevronRight: View {
    var tint: Color
    var size: CGFloat = 24
    var body: some View {
        LucideIcon(strokes: [[pt(9, 18), pt(15, 12), pt(9, 6)]], tint: tint, size: size)
    }
}

struct LucidePlus: View {
    var tint: Color
    var size: CGFloat = 56
    var body: some View {
        LucideIcon(
            strokes: [[pt(5, 12), pt(19, 12)], [pt(12, 5), pt(12, 19)]],
            tint: tint, size: size
        )
    }
}

struct LucideMinus: View {
    var tint: Color
    var size: CGFloat = 36
    var body: some View {
        LucideIcon(strokes: [[pt(5, 12), pt(19, 12)]], tint: tint, size: size)
    }
}

struct LucideBookmark: View {
    var tint: Color
    var filled: Bool = false
    var size: CGFloat = 26
    var body: some View {
        LucideIcon(
            strokes: [[pt(19, 21), pt(12, 17), pt(5, 21), pt(5, 5),
                       pt(7, 3), pt(17, 3), pt(19, 5)]],
            tint: tint, size: size, closed: true, filled: filled
        )
    }
}
