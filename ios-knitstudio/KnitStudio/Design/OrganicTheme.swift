import SwiftUI

/// The Organic design system, as the KnitStudio redesign uses it.
///
/// Warm and rounded: a cream-and-sand ground, terracotta as the accent, sage as
/// a genuine second voice rather than a highlight. Caprasimo for display over
/// Figtree for text. Radii start at 16 and grow into pills.
///
/// Every colour, radius and space in the app comes from here. The tokens are a
/// direct port of the system's `styles.css`, ramp steps included, so a value
/// that appears in the design can be found under the same name in the code —
/// and the Kotlin `Theme.kt` carries the identical numbers.
enum Organic {

    // MARK: - Colour

    /// A 100–900 tonal ramp. The steps were generated in OKLCH against one
    /// shared lightness scale, so step 200 of any ramp carries the same visual
    /// weight as step 200 of any other — which is what lets sage and
    /// terracotta stand in for each other without either one shouting.
    struct Ramp {
        let s100: Color, s200: Color, s300: Color, s400: Color, s500: Color
        let s600: Color, s700: Color, s800: Color, s900: Color
    }

    static let bg = Color(hex: 0xF5EAD8)
    static let surface = Color(hex: 0xEBDDC5)
    static let text = Color(hex: 0x201E1D)
    static let accent = Color(hex: 0xC67139)
    static let accent2 = Color(hex: 0x7A8A5E)

    /// #201E1D at 16%, matching the system's `color-mix` divider.
    static let divider = Color(hex: 0x201E1D).opacity(0.16)

    static let neutral = Ramp(
        s100: Color(hex: 0xF9F4ED), s200: Color(hex: 0xEEE7DB), s300: Color(hex: 0xDCD3C4),
        s400: Color(hex: 0xC0B6A5), s500: Color(hex: 0xA19786), s600: Color(hex: 0x82796A),
        s700: Color(hex: 0x645C50), s800: Color(hex: 0x474238), s900: Color(hex: 0x2E2B25)
    )

    /// Terracotta.
    static let clay = Ramp(
        s100: Color(hex: 0xFFF2EB), s200: Color(hex: 0xFFE1D0), s300: Color(hex: 0xFFC6A5),
        s400: Color(hex: 0xF6A06B), s500: Color(hex: 0xD67F48), s600: Color(hex: 0xB2622D),
        s700: Color(hex: 0x8C491A), s800: Color(hex: 0x643312), s900: Color(hex: 0x402310)
    )

    /// Sage — the second voice.
    static let sage = Ramp(
        s100: Color(hex: 0xF0FAE1), s200: Color(hex: 0xE1EECC), s300: Color(hex: 0xCCDBB2),
        s400: Color(hex: 0xAEBF92), s500: Color(hex: 0x8FA073), s600: Color(hex: 0x728157),
        s700: Color(hex: 0x56633F), s800: Color(hex: 0x3D472B), s900: Color(hex: 0x272E1B)
    )

    /// The 1c direction reads the header as one deep field over a cream body,
    /// so the two header colours get names rather than ramp subscripts.
    static let headerClay = clay.s800
    static let headerSage = sage.s800

    // MARK: - Shape

    static let radiusSm: CGFloat = 8
    static let radiusMd: CGFloat = 16
    static let radiusLg: CGFloat = 28
    /// Buttons and inputs go all the way round.
    static let radiusPill: CGFloat = 999
    /// The bottom sweep of the 1c header.
    static let radiusHeader: CGFloat = 40

    // MARK: - Space

    /// The scale carries the system's 1.10 density multiplier already.
    static let space1: CGFloat = 4.4
    static let space2: CGFloat = 8.8
    static let space3: CGFloat = 13.2
    static let space4: CGFloat = 17.6
    static let space6: CGFloat = 26.4
    static let space8: CGFloat = 35.2

    /// The smallest tap target the redesign allows. This is a knitting app,
    /// read at arm's length with a needle in one hand.
    static let minTap: CGFloat = 56

    // MARK: - Elevation

    struct Shadow {
        let color: Color, radius: CGFloat, y: CGFloat
    }

    static let shadowSm = Shadow(color: Color(hex: 0x2E2B25).opacity(0.14), radius: 2, y: 1)
    static let shadowMd = Shadow(color: Color(hex: 0x2E2B25).opacity(0.16), radius: 10, y: 3)
    static let shadowLg = Shadow(color: Color(hex: 0x2E2B25).opacity(0.22), radius: 32, y: 12)
}

// MARK: - Type

/// The sizes the redesign actually names, so a view asks for `.display(36)`
/// rather than restating the number. Body text never drops below 18pt.
enum KnitType {
    static let headingName = "Caprasimo-Regular"
    static let bodyName = "Figtree-Regular"

    /// Caprasimo has one weight, so display text never asks for another.
    static func display(_ size: CGFloat) -> Font {
        .custom(headingName, size: size)
    }

    static func body(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .custom(name(for: weight), size: size)
    }

    /// Figtree ships here as four static cuts, so the weight picks the file
    /// rather than asking the system to synthesise one.
    private static func name(for weight: Font.Weight) -> String {
        switch weight {
        case .bold, .heavy, .black: return "Figtree-Bold"
        case .semibold: return "Figtree-SemiBold"
        case .medium: return "Figtree-Medium"
        default: return "Figtree-Regular"
        }
    }
}

// MARK: - Helpers

extension Color {
    /// Builds a colour from a 0xRRGGBB literal, which is how the design system
    /// writes every one of its tokens.
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

extension View {
    /// Applies one of the system's three elevation steps.
    func organicShadow(_ shadow: Organic.Shadow) -> some View {
        self.shadow(color: shadow.color, radius: shadow.radius, x: 0, y: shadow.y)
    }

    /// The pill shape used for every button, chip and segmented control.
    func organicPill() -> some View {
        clipShape(Capsule())
    }
}

/// The tints the redesign cycles through for preset and category avatars.
enum OrganicTint {
    static func pair(_ index: Int) -> (background: Color, foreground: Color) {
        switch index % 3 {
        case 0: return (Organic.clay.s200, Organic.clay.s900)
        case 1: return (Organic.sage.s200, Organic.sage.s900)
        default: return (Organic.neutral.s300, Organic.neutral.s900)
        }
    }
}
