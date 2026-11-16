import SwiftUI

@main
struct AISecretaryApp: App {
    @State private var model: SecretaryViewModel
    @State private var translator: LiveTranslator
    private let stage: Stage?

    init() {
        // Screenshots and previews run the real screens over ready-made data.
        let stage = Stage.requested()
        self.stage = stage
        _model = State(initialValue: stage?.model ?? SecretaryViewModel())
        _translator = State(initialValue: stage?.translator ?? LiveTranslator())
    }

    var body: some Scene {
        WindowGroup {
            RootView(stage: stage)
                .environment(model)
                .environment(translator)
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
    case settings
}

struct RootView: View {
    @Environment(SecretaryViewModel.self) private var model
    @Environment(LiveTranslator.self) private var translator
    @Environment(\.scenePhase) private var scenePhase

    let stage: Stage?

    @AppStorage("aisecretary.onboarded") private var hasOnboarded = false
    @AppStorage("aisecretary.userName") private var userName = ""
    // Reports start in the language the iPhone is in; calls in German, or in
    // Turkish for someone whose own language is German.
    @AppStorage("aisecretary.reportLanguage") private var reportLanguageRaw = L10n.language.rawValue
    @AppStorage("aisecretary.callLanguage") private var callLanguageRaw =
        (L10n.language == .de ? Language.tr : Language.de).rawValue

    @State private var route: Route
    /// A pairing link that arrived, waiting for the user to say yes.
    @State private var pairing: ServerStore.Pairing?
    /// A pairing link did not work, and the screen in front does not show the
    /// server's state: what went wrong, to be said in a message.
    @State private var pairingFailure: String?

    init(stage: Stage?) {
        self.stage = stage
        // Read straight from defaults so a first launch opens on onboarding
        // rather than flashing the home screen for a frame first.
        let onboarded = UserDefaults.standard.bool(forKey: "aisecretary.onboarded")
        _route = State(initialValue: stage?.route ?? (onboarded ? .home : .onboarding))
    }

    private var reportLanguage: Binding<Language> {
        Binding(
            get: { Language(rawValue: reportLanguageRaw) ?? L10n.language },
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
        .hostsLiveTranslation(translator)
        .task { if hasOnboarded { await model.refresh() } }
        #if DEBUG
        // The build machine's end-to-end check: the app against a real server.
        .task {
            if let plan = SelfTest.requestedPlan {
                await SelfTest(plan: plan, model: model) { route = $0 }.run()
            }
        }
        #endif
        // The server needs to know who it works for — to answer calls and
        // write notes while the app is closed.
        .task(
            id: ProfileKey(
                name: userName, language: reportLanguageRaw, callLanguage: callLanguageRaw,
                connected: model.server.isConnected
            )
        ) {
            // A name changes this with every key that is typed: wait until
            // it rests, rather than send the server every half-written one.
            try? await Task.sleep(for: .milliseconds(700))
            guard !Task.isCancelled else { return }
            await model.syncProfile(
                name: userName,
                language: reportLanguage.wrappedValue,
                callLanguage: callLanguage.wrappedValue
            )
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, hasOnboarded { Task { await model.refresh() } }
        }
        // yaver://pair?url=…&key=… — the server's pairing page opens this. Any
        // web page could, too, so the app asks before it changes servers.
        .onOpenURL { link in
            pairing = ServerStore.Pairing(link: link)
        }
        .alert(
            L("Connect to this server?"),
            isPresented: Binding(get: { pairing != nil }, set: { if !$0 { pairing = nil } }),
            presenting: pairing
        ) { request in
            Button(L("Connect")) {
                Task {
                    let before = model.server.baseURL
                    let paired = await model.server.pair(request)
                    if paired { await model.refresh() }
                    if hasOnboarded, route == .home {
                        // Show the result where the server lives.
                        route = .settings
                    } else if hasOnboarded, !paired, route != .settings {
                        // Not worth taking the user away from something they
                        // are writing — it would be lost. But they must know
                        // that the app is still with the old server, and why:
                        // the reason is gone by the time Settings is opened.
                        pairingFailure = [
                            Self.reason(for: model.server.status),
                            // A server that answered but wants a key, say, is
                            // the app's server now; one that did not answer
                            // at all is not.
                            model.server.baseURL == before
                                ? L("Nothing has changed: your tasks still go to the server you used before.")
                                : L("Yaver now uses this server. Settings shows what it still needs."),
                        ]
                        .filter { !$0.isEmpty }
                        .joined(separator: " ")
                    }
                }
            }
            Button(L("Cancel"), role: .cancel) {}
        } message: { request in
            Text(Lf("Yaver will send your tasks to %@. Only connect to a server you started yourself.", request.host))
        }
        .alert(
            L("Could not connect"),
            isPresented: Binding(
                get: { pairingFailure != nil }, set: { if !$0 { pairingFailure = nil } }
            )
        ) {
            Button(L("OK"), role: .cancel) {}
        } message: {
            Text(pairingFailure ?? "")
        }
    }

    /// Why a server could not be connected to, in one sentence.
    private static func reason(for status: ServerStore.Status) -> String {
        switch status {
        case let .unreachable(problem): return problem.title
        case .needsKey: return L("This server needs an access key.")
        case .wrongKey: return L("The server did not accept the access key.")
        case .unknown, .checking, .connected: return ""
        }
    }

    @ViewBuilder
    private var screen: some View {
        switch route {
        case .onboarding:
            OnboardingView(
                userName: $userName,
                reportLanguage: reportLanguage,
                callLanguage: callLanguage,
                startAt: stage?.onboardingStep ?? 0,
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
                openSettings: { route = .settings }
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
                readerLanguage: reportLanguage.wrappedValue,
                goHome: { route = .home },
                openReport: { route = .report(id) }
            )

        case let .report(id):
            ReportView(
                taskID: id,
                reportLanguage: reportLanguage.wrappedValue,
                goHome: { route = .home },
                openTask: { open($0) }
            )
            // A report is about one task; another task is another report.
            .id(id)

        case .translator:
            TranslatorView(goBack: { route = .home }, stage: stage?.translatorStage)

        case .settings:
            SettingsView(
                userName: $userName,
                reportLanguage: reportLanguage,
                callLanguage: callLanguage,
                goBack: { route = .home },
                openTask: { open($0) },
                opensAtAnswering: stage?.settingsShowsAnswering ?? false
            )
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

/// Changes when the profile the server should know about changes.
private struct ProfileKey: Equatable {
    let name: String
    let language: String
    let callLanguage: String
    let connected: Bool
}
