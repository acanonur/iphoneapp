import Foundation

/// Pages about Yaver on the web: the privacy policy and the help page, in the
/// language the app is shown in. They live in the project's public repository,
/// next to the code they describe.
enum Links {
    private static let pages =
        "https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs"

    static var privacyPolicy: URL {
        URL(string: "\(pages)/privacy/\(L10n.language.rawValue).md")!
    }

    static var help: URL {
        URL(string: "\(pages)/support.md")!
    }

    /// The part of the help page that says how to report a wrong or harmful
    /// result, under its heading in the app's language.
    static var reportProblem: URL {
        let heading: String
        switch L10n.language {
        case .de: heading = "ein-problem-melden"
        case .tr: heading = "bir-sorun-bildirin"
        case .en: heading = "report-a-problem"
        }
        return URL(string: "\(pages)/support.md#\(heading)")!
    }
}
