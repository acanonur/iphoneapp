import SwiftUI

/// The Modernist design system, ported from the design bundle's `styles.css`.
///
/// Flat and architectural: a near-mono red on a light ground, everything set in
/// Archivo, zero corner radius, strong 2px rules and flush-left labels. The
/// numbers here are the token sheet — take every colour, size and space from
/// this type rather than writing a literal into a screen.
enum Modernist {

    // MARK: - Roles

    static let bg = Color(hex: 0xF3F2F2)
    static let surface = Color(hex: 0xEAE9E9)
    static let text = Color(hex: 0x201E1D)
    static let accent = Color(hex: 0xEC3013)

    /// `color-mix(in srgb, #201e1d 40%, transparent)` — the rule colour.
    static let divider = Color(hex: 0x201E1D, opacity: 0.40)

    // MARK: - Tonal ramps
    //
    // Generated in OKLCH on one shared lightness scale, so the same step of any
    // role carries the same visual weight. 100–300 tint fills and hovers, 500 is
    // the role's base, 700–900 are text on tints and pressed states.

    enum Neutral {
        static let s100 = Color(hex: 0xF8F4F4)
        static let s200 = Color(hex: 0xEAE7E7)
        static let s300 = Color(hex: 0xD7D3D3)
        static let s400 = Color(hex: 0xBAB6B6)
        static let s500 = Color(hex: 0x9B9797)
        static let s600 = Color(hex: 0x7D7979)
        static let s700 = Color(hex: 0x605D5D)
        static let s800 = Color(hex: 0x444141)
        static let s900 = Color(hex: 0x2D2B2B)
    }

    enum Accent {
        static let s100 = Color(hex: 0xFFF2EF)
        static let s200 = Color(hex: 0xFFE0D9)
        static let s300 = Color(hex: 0xFFC4B8)
        static let s400 = Color(hex: 0xFF9783)
        static let s500 = Color(hex: 0xFF563C)
        static let s600 = Color(hex: 0xDD2B0F)
        static let s700 = Color(hex: 0xAE1800)
        static let s800 = Color(hex: 0x7C1405)
        static let s900 = Color(hex: 0x4D170E)
    }

    // MARK: - Space

    /// The `--space-*` scale (density 1.00×).
    enum Space {
        static let s1: CGFloat = 4
        static let s2: CGFloat = 8
        static let s3: CGFloat = 12
        static let s4: CGFloat = 16
        static let s6: CGFloat = 24
        static let s8: CGFloat = 32
    }

    /// Every radius in the system is 0 — on purpose. Nothing is rounded.
    static let radius: CGFloat = 0

    // MARK: - Screen metrics
    //
    // The design was drawn at 402 × 874 (iPhone 16 Pro), where one design pixel
    // is one point, so these are the prototype's own numbers.

    /// Horizontal page gutter.
    static let gutter: CGFloat = 20
    /// Height of the header row that sits under the status bar.
    static let headerHeight: CGFloat = 52
    /// A strong section rule.
    static let ruleWidth: CGFloat = 2
    /// A row rule inside a section.
    static let hairlineWidth: CGFloat = 1
}

// MARK: - Rules

/// The strong 2px rule that separates major sections.
struct Rule: View {
    var color: Color = Modernist.divider
    var body: some View {
        Rectangle()
            .fill(color)
            .frame(height: Modernist.ruleWidth)
    }
}

/// The 1px rule that separates rows within a section.
struct Hairline: View {
    var color: Color = Modernist.divider
    var body: some View {
        Rectangle()
            .fill(color)
            .frame(height: Modernist.hairlineWidth)
    }
}

/// A 1px vertical rule, for the grids that show their structure.
struct VHairline: View {
    var color: Color = Modernist.divider
    var body: some View {
        Rectangle()
            .fill(color)
            .frame(width: Modernist.hairlineWidth)
    }
}

// MARK: - Colour helpers

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}
