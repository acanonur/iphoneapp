import SwiftUI

/// The AI services outside the app that a Yaver server can hand personal data
/// to, and the user's explicit permission for each.
///
/// The app itself sends everything only to the user's own server. But that
/// server may be set up to pass a call to Retell AI and a report to Anthropic's
/// Claude, and the person whose words, numbers and letters go there should say
/// yes to it first — Apple asks for exactly that (App Review Guideline 5.1.2(i):
/// disclose where personal data is shared with third-party AI, and get explicit
/// permission before doing so).
enum AIService: String, CaseIterable, Identifiable {
    /// Retell AI: real phone calls, placed and answered.
    case phoneCalls
    /// Anthropic's Claude: reports, letters, messages, forms.
    case writing

    var id: String { rawValue }

    /// Where the data goes, in one sentence or three.
    var disclosure: String {
        switch self {
        case .phoneCalls:
            return L("Phone calls: your server gives Retell AI (USA) the number, your request and your name. Retell’s AI holds the conversation, so the voices and everything said are processed there. Yaver’s server has the call deleted there after the report.")
        case .writing:
            return L("Reports, letters and messages: your server sends the conversation or the document’s text to Claude, the AI of Anthropic (USA), which writes them.")
        }
    }

    /// The service's name, for the line in Settings.
    var label: String {
        switch self {
        case .phoneCalls: return L("Retell AI (phone calls)")
        case .writing: return L("Anthropic Claude (reports)")
        }
    }
}

enum AIConsent {
    private static func key(_ service: AIService) -> String { "yaver.consent.\(service.rawValue)" }

    static func isGranted(_ service: AIService) -> Bool {
        UserDefaults.standard.bool(forKey: key(service))
    }

    static func grant(_ services: [AIService]) {
        for service in services { UserDefaults.standard.set(true, forKey: key(service)) }
    }

    static func withdrawAll() {
        for service in AIService.allCases { UserDefaults.standard.removeObject(forKey: key(service)) }
    }

    static var granted: [AIService] { AIService.allCases.filter(isGranted) }

    /// The services this server would send a task of this kind to, and that
    /// the user has not allowed yet. A simulated call goes nowhere; a report
    /// goes to Claude only where the server has it set up.
    @MainActor
    static func missing(for kind: TaskKind, server: ServerStore) -> [AIService] {
        var needed: [AIService] = []
        switch kind {
        case .call:
            if !server.isSimulated { needed.append(.phoneCalls) }
            if writesWithClaude(server) { needed.append(.writing) }
        case .letter, .message, .form:
            if writesWithClaude(server) { needed.append(.writing) }
        case .followup, .reminder:
            break
        }
        return needed.filter { !isGranted($0) }
    }

    /// The same for answering the owner's calls: the phone service picks up,
    /// and the note about the call is written by Claude where it is set up.
    @MainActor
    static func missingForAnswering(server: ServerStore) -> [AIService] {
        var needed: [AIService] = []
        if !server.isSimulated { needed.append(.phoneCalls) }
        if writesWithClaude(server) { needed.append(.writing) }
        return needed.filter { !isGranted($0) }
    }

    @MainActor
    private static func writesWithClaude(_ server: ServerStore) -> Bool {
        server.session?.reports == "claude"
    }

    /// The text of the question: one paragraph per service, then what it means.
    static func message(for services: [AIService]) -> String {
        (services.map(\.disclosure)
            + [L("This happens only with the services set up on your server. You can withdraw your permission in Settings.")])
            .joined(separator: "\n\n")
    }
}

extension View {
    /// Asks for permission to send data to the AI services in `services`,
    /// whenever that is set. "Allow" remembers the answer and carries on.
    func aiConsentQuestion(
        _ services: Binding<[AIService]?>,
        onAllow: @escaping () -> Void,
        onDecline: @escaping () -> Void = {}
    ) -> some View {
        alert(
            L("Your data and AI services"),
            isPresented: Binding(
                get: { services.wrappedValue != nil },
                set: { if !$0 { services.wrappedValue = nil } }
            ),
            presenting: services.wrappedValue
        ) { asked in
            Button(L("Allow")) {
                AIConsent.grant(asked)
                services.wrappedValue = nil
                onAllow()
            }
            Button(L("Not now"), role: .cancel) {
                services.wrappedValue = nil
                onDecline()
            }
        } message: { asked in
            Text(AIConsent.message(for: asked))
        }
    }
}
