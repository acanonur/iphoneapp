import CoreText
import SwiftUI
import UIKit

/// Archivo — the one family in the system, used for headings (800) and body
/// (400), with 600 for the emphasis inside ledger rows.
///
/// The three static instances are bundled under `Resources/Fonts` and declared
/// in `UIAppFonts`. If a face ever fails to load we fall back to the system
/// font at the matching weight rather than silently rendering the wrong size.
enum Archivo {
    enum Weight {
        case regular, semibold, extrabold

        var postScriptName: String {
            switch self {
            case .regular: return "Archivo-Regular"
            case .semibold: return "Archivo-SemiBold"
            case .extrabold: return "Archivo-ExtraBold"
            }
        }

        var systemFallback: UIFont.Weight {
            switch self {
            case .regular: return .regular
            case .semibold: return .semibold
            case .extrabold: return .heavy
            }
        }
    }

    static func uiFont(size: CGFloat, weight: Weight, tabularNumbers: Bool = false) -> UIFont {
        let base = UIFont(name: weight.postScriptName, size: size)
            ?? .systemFont(ofSize: size, weight: weight.systemFallback)
        guard tabularNumbers else { return base }
        let descriptor = base.fontDescriptor.addingAttributes([
            .featureSettings: [[
                UIFontDescriptor.FeatureKey.type: kNumberSpacingType,
                UIFontDescriptor.FeatureKey.selector: kMonospacedNumbersSelector,
            ]],
        ])
        return UIFont(descriptor: descriptor, size: size)
    }

    static func font(size: CGFloat, weight: Weight, tabularNumbers: Bool = false) -> Font {
        Font(uiFont(size: size, weight: weight, tabularNumbers: tabularNumbers))
    }
}

/// One line of the type sheet: a size, a weight and the CSS line-height and
/// letter-spacing the design asked for.
struct TypeStyle {
    var size: CGFloat
    var weight: Archivo.Weight = .regular
    /// CSS `line-height`, as a multiple of the font size.
    var lineHeight: CGFloat = 1.45
    /// CSS `letter-spacing`, in em.
    var tracking: CGFloat = 0
    /// CSS `font-feature-settings: 'tnum' 1` — digits on a fixed advance, so
    /// timers and counters do not jitter as they count.
    var tabularNumbers: Bool = false

    var font: Font { Archivo.font(size: size, weight: weight, tabularNumbers: tabularNumbers) }

    /// SwiftUI adds `lineSpacing` *between* lines, so the leading we want is the
    /// CSS line box minus the height the face already occupies.
    var lineSpacing: CGFloat {
        let metrics = Archivo.uiFont(size: size, weight: weight)
        return max(0, size * lineHeight - metrics.lineHeight)
    }
}

extension View {
    func typeStyle(_ style: TypeStyle) -> some View {
        self.font(style.font)
            .tracking(style.tracking * style.size)
            .lineSpacing(style.lineSpacing)
    }
}

// MARK: - The styles the screens actually use

extension TypeStyle {
    /// The "Secretary" wordmark in the header bar.
    static let brand = TypeStyle(size: 18, weight: .extrabold, lineHeight: 1.2, tracking: -0.01)

    /// Uppercase section label — `Now`, `Tasks`, `Live transcript`.
    static let kicker = TypeStyle(size: 12, weight: .regular, lineHeight: 1.2, tracking: 0.08)
    /// The smaller kicker used inside the transcript and the report's meta grid.
    static let kickerSmall = TypeStyle(size: 10, weight: .regular, lineHeight: 1.3, tracking: 0.08)
    /// The kicker on ledger rows and the live rail.
    static let kickerRow = TypeStyle(size: 11, weight: .regular, lineHeight: 1.3, tracking: 0.06)
    static let kickerRailLabel = TypeStyle(size: 10, weight: .regular, lineHeight: 1.3, tracking: 0.06)

    /// Onboarding's opening statement and the live call's status word.
    static let display = TypeStyle(size: 40, weight: .extrabold, lineHeight: 1.04, tracking: -0.022)
    static let displayTight = TypeStyle(size: 40, weight: .extrabold, lineHeight: 1.0, tracking: -0.025)
    /// Onboarding steps two and three.
    static let title = TypeStyle(size: 32, weight: .extrabold, lineHeight: 1.04, tracking: -0.02)
    /// The report's outcome line.
    static let titleReport = TypeStyle(size: 32, weight: .extrabold, lineHeight: 1.02, tracking: -0.025)
    /// The home headline.
    static let headline = TypeStyle(size: 26, weight: .extrabold, lineHeight: 1.1, tracking: -0.02)
    /// The translator's empty-state statement.
    static let headlineSmall = TypeStyle(size: 24, weight: .extrabold, lineHeight: 1.1, tracking: -0.02)
    /// The language names in the translator's bar, and its ledger translations.
    static let subhead = TypeStyle(size: 20, weight: .extrabold, lineHeight: 1.2)
    static let translated = TypeStyle(size: 17, weight: .extrabold, lineHeight: 1.25)
    /// The disclosure quotation and the grid tile labels.
    static let quote = TypeStyle(size: 18, weight: .extrabold, lineHeight: 1.25)
    static let tile = TypeStyle(size: 14, weight: .extrabold, lineHeight: 1.2)

    /// Running copy.
    static let body = TypeStyle(size: 15, weight: .regular, lineHeight: 1.45)
    static let bodyLarge = TypeStyle(size: 16, weight: .regular, lineHeight: 1.5)
    static let bodyTight = TypeStyle(size: 15, weight: .regular, lineHeight: 1.4)
    static let lead = TypeStyle(size: 17, weight: .regular, lineHeight: 1.45)
    /// A ledger row's task title.
    static let rowTitle = TypeStyle(size: 15, weight: .semibold, lineHeight: 1.35)
    /// Transcript lines.
    static let transcript = TypeStyle(size: 14, weight: .regular, lineHeight: 1.45)
    static let small = TypeStyle(size: 13, weight: .regular, lineHeight: 1.45)
    static let smallTight = TypeStyle(size: 13, weight: .regular, lineHeight: 1.4)
    static let caption = TypeStyle(size: 12, weight: .regular, lineHeight: 1.4)
    static let captionSmall = TypeStyle(size: 11, weight: .regular, lineHeight: 1.4)
}
