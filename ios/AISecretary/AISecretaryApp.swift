import SwiftUI

@main
struct AISecretaryApp: App {
    @State private var model = SecretaryViewModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                // Modernist is a single light ground — there is no dark palette
                // in the system, so the app does not follow the system theme.
                .preferredColorScheme(.light)
        }
    }
}

/// Where the user is. The redesign replaced the two-tab shell with one home and
/// one primary action, so navigation is a small explicit state machine rather
/// than a tab bar.
enum Route: Equatable {
    case onboarding
    case home
    case brief(TaskKind)
    case call(String)
    case report(String)
    case translator
}

struct RootView: View {
    @Environment(SecretaryViewModel.self) private var model

    @AppStorage("aisecretary.onboarded") private var hasOnboarded = false
    @AppStorage("aisecretary.userName") private var userName = ""
    @AppStorage("aisecretary.reportLanguage") private var reportLanguageRaw = Language.en.rawValue
    @AppStorage("aisecretary.callLanguage") private var callLanguageRaw = Language.de.rawValue

    /// Read straight from defaults so a first launch opens on onboarding rather
    /// than flashing the home screen for a frame first. Same key as `hasOnboarded`.
    @State private var route: Route =
        UserDefaults.standard.bool(forKey: "aisecretary.onboarded") ? .home : .onboarding

    private var reportLanguage: Binding<Language> {
        Binding(
            get: { Language(rawValue: reportLanguageRaw) ?? .en },
            set: { reportLanguageRaw = $0.rawValue }
        )
    }

    private var callLanguage: Binding<Language> {
        Binding(
            get: { Language(rawValue: callLanguageRaw) ?? .de },
            set: { callLanguageRaw = $0.rawValue }
        )
    }

    var body: some View {
        ZStack {
            Modernist.bg.ignoresSafeArea()
            screen
        }
        .typeStyle(.body)
        .foregroundStyle(Modernist.text)
        .tint(Modernist.accent)
        .task { await model.refresh() }
    }

    @ViewBuilder
    private var screen: some View {
        switch route {
        case .onboarding:
            OnboardingView(
                userName: $userName,
                reportLanguage: reportLanguage,
                callLanguage: callLanguage,
                onFinish: {
                    hasOnboarded = true
                    route = .home
                }
            )

        case .home:
            HomeView(
                openBrief: { route = .brief($0) },
                openTask: { open($0) },
                openTranslator: { route = .translator },
                openProfile: { route = .onboarding }
            )

        case let .brief(kind):
            BriefView(
                kind: kind,
                userName: userName,
                reportLanguage: reportLanguage.wrappedValue,
                callLanguage: callLanguage,
                onCancel: { route = .home },
                // A call opens its live screen straight away; the paperwork
                // kinds go back to the ledger and resolve there.
                onCreated: { task in
                    route = task.kind == .call ? .call(task.id) : .home
                }
            )
            // A fresh brief every time, so the form never carries over.
            .id(kind)

        case let .call(id):
            LiveCallView(
                taskID: id,
                goHome: { route = .home },
                openReport: { route = .report(id) }
            )

        case let .report(id):
            ReportView(
                taskID: id,
                reportLanguage: reportLanguage.wrappedValue,
                goHome: { route = .home }
            )

        case .translator:
            TranslatorView(goBack: { route = .home })
        }
    }

    /// A running call opens the live screen; anything else opens its report.
    private func open(_ task: SecretaryTask) {
        if task.kind == .call, task.status.isActive {
            route = .call(task.id)
        } else {
            route = .report(task.id)
        }
    }
}
