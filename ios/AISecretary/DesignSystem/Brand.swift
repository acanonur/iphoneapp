import SwiftUI

/// Yaver — Turkish for an aide: the person who makes the calls and carries the
/// messages for someone else.
enum Brand {
    static let name = "Yaver"
}

/// The mark: Archivo ExtraBold's own capital Y with a square full stop set on
/// the baseline, flush with the tip of the right arm. The stop is the one
/// accent in an otherwise ink-on-paper identity — the same square that marks
/// "live" and "done" everywhere else in the app.
struct BrandMark: View {
    var height: CGFloat = 28
    var letter: Color = Modernist.text
    var stop: Color = Modernist.accent

    // The glyph's own measurements, in font units.
    private static let glyphWidth: CGFloat = 715
    private static let glyphHeight: CGFloat = 687
    private static let stopSide: CGFloat = 180

    var body: some View {
        let scale = height / Self.glyphHeight
        ZStack(alignment: .topLeading) {
            LetterY().fill(letter)
            Rectangle()
                .fill(stop)
                .frame(width: Self.stopSide * scale, height: Self.stopSide * scale)
                .offset(
                    x: (Self.glyphWidth - Self.stopSide) * scale,
                    y: (Self.glyphHeight - Self.stopSide) * scale
                )
        }
        .frame(width: Self.glyphWidth * scale, height: height, alignment: .topLeading)
        .accessibilityHidden(true)
    }
}

/// The outline of the Y, taken from the typeface so the mark and the wordmark
/// are cut from the same letter.
private struct LetterY: Shape {
    func path(in rect: CGRect) -> Path {
        // Font coordinates run upwards from the baseline; the screen's run down.
        let outline = SVGPath.parse("M277 0V272L8 687H215L369 430H374L527 687H723L457 272V0Z")
        let scale = rect.height / 687
        return outline.applying(
            CGAffineTransform(a: scale, b: 0, c: 0, d: -scale, tx: -8 * scale, ty: rect.height)
        )
    }
}

/// The name as it appears in the header bar: the word, then the square stop
/// sitting on its baseline.
struct BrandWordmark: View {
    var size: CGFloat = 18

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: size * 0.11) {
            Text(Brand.name)
                .typeStyle(
                    TypeStyle(size: size, weight: .extrabold, lineHeight: 1.2, tracking: -0.01)
                )
            Rectangle()
                .fill(Modernist.accent)
                .frame(width: size * 0.26, height: size * 0.26)
                .alignmentGuide(.firstTextBaseline) { dimensions in dimensions[.bottom] }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Brand.name)
    }
}
