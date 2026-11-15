import Foundation

/// Looks a string up in the language the interface is shown in. The key is the
/// English text itself, so the code reads as plain English and a missing
/// translation falls back to something sensible.
func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

/// The same, for strings with placeholders (`%@`, `%d`).
func Lf(_ key: String, _ arguments: CVarArg...) -> String {
    String(format: NSLocalizedString(key, comment: ""), locale: L10n.locale, arguments: arguments)
}

enum L10n {
    /// The language the interface is in: the best match between the languages
    /// set on the iPhone and the three this app is written in.
    static let languageCode: String = {
        let preferred = Bundle.main.preferredLocalizations.first ?? "en"
        return String(preferred.prefix(2))
    }()

    static let locale = Locale(identifier: languageCode)

    /// The interface language as one of the app's three working languages.
    static var language: Language {
        Language(rawValue: languageCode) ?? .en
    }
}

extension String {
    /// Capitals for kickers and labels. Turkish has two letters "i", and only
    /// the right locale turns "i" into "İ".
    var displayUppercased: String {
        uppercased(with: L10n.locale)
    }
}
