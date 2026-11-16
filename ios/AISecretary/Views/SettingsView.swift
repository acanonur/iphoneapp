import SwiftUI

/// Everything that is set once: where the server is, who the secretary works
/// for, and whether it should pick up calls the user cannot take.
struct SettingsView: View {
    @Environment(SecretaryViewModel.self) private var model

    @Binding var userName: String
    @Binding var reportLanguage: Language
    @Binding var callLanguage: Language
    var goBack: () -> Void
    /// Opens a task — used after a simulated incoming call starts.
    var openTask: (SecretaryTask) -> Void
    /// Starts scrolled down to "Answer my calls" (the screenshots use this).
    var opensAtAnswering = false

    @State private var address = ""
    @State private var accessKey = ""
    @State private var isConnecting = false
    @State private var isSearching = false

    @State private var answering = false
    @State private var answerNote = ""
    @State private var answerError: String?
    @State private var isSavingAnswer = false
    @State private var isSimulating = false

    private var server: ServerStore { model.server }

    private static let answeringAnchor = "answering"

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar {
                HStack(spacing: 6) {
                    IconButton(glyph: .chevronLeft, accessibilityLabel: L("Back"), action: goBack)
                        .padding(.leading, -10)
                    Wordmark(title: L("Settings"))
                }
            }

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        serverSection
                        profileSection
                        answeringSection
                            .id(Self.answeringAnchor)
                        aboutSection
                    }
                    .padding(.horizontal, Modernist.gutter)
                    .padding(.bottom, 28)
                }
                .scrollDismissesKeyboard(.interactively)
                .task {
                    guard opensAtAnswering else { return }
                    // Once the sections have been laid out.
                    try? await Task.sleep(for: .milliseconds(250))
                    proxy.scrollTo(Self.answeringAnchor, anchor: .top)
                }
            }
        }
        .task {
            address = server.baseURL.absoluteString
            accessKey = server.accessKey
            loadAnswering()
            // Not after an address that was typed or scanned and failed: what
            // went wrong with it should stay on screen, not be searched away.
            if !server.isConnected, !server.lastAttemptWasExplicit { _ = await server.connect() }
            loadAnswering()
            // What this screen shows must be what the server does: answering
            // may have been taken over by another phone since the app last
            // asked. Only then is the screen changed — never under a note
            // that is being typed.
            let shown = server.session?.profile
            await server.refreshSession()
            let fresh = server.session?.profile
            if fresh?.answerCalls != shown?.answerCalls || fresh?.answerNote != shown?.answerNote {
                loadAnswering()
            }
        }
        .onChange(of: server.baseURL) { _, url in address = url.absoluteString }
        // A pairing link can change the key while this screen is open; the
        // field must not keep — and later send — the old one.
        .onChange(of: server.accessKey) { _, key in accessKey = key }
    }

    // MARK: - Server

    private var serverSection: some View {
        section(L("Server")) {
            statusLine
                .padding(.bottom, 14)

            VStack(alignment: .leading, spacing: 14) {
                Field(label: L("Server address")) {
                    DSTextField(
                        placeholder: "192.168.1.20:8787",
                        text: $address,
                        minHeight: 44,
                        fontSize: 15,
                        keyboard: .URL
                    )
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                }
                Field(label: L("Access key (only if the server shows one)")) {
                    DSTextField(placeholder: "", text: $accessKey, minHeight: 44, fontSize: 15)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                VStack(spacing: Modernist.Space.s2) {
                    Button {
                        isConnecting = true
                        Task {
                            // Only on success: a refresh after a failure would
                            // search for the old server and write its result
                            // over what was wrong with this address.
                            if await server.use(address: address, key: accessKey) {
                                await model.refresh()
                            }
                            loadAnswering()
                            isConnecting = false
                        }
                    } label: {
                        ButtonLabel(title: isConnecting ? L("Connecting…") : L("Connect"), icon: .arrowRight, iconSize: 16)
                    }
                    .buttonStyle(ModernistButtonStyle(variant: .primary, block: true, height: 46))
                    .disabled(isConnecting || isSearching || address.trimmingCharacters(in: .whitespaces).isEmpty)

                    Button {
                        isSearching = true
                        Task {
                            await server.connect()
                            await model.refresh()
                            loadAnswering()
                            isSearching = false
                        }
                    } label: {
                        ButtonLabel(title: isSearching ? L("Searching…") : L("Find automatically"), icon: .search, iconSize: 16)
                    }
                    .buttonStyle(ModernistButtonStyle(variant: .secondary, block: true, height: 46))
                    .disabled(isConnecting || isSearching)
                }
            }

            Text(
                L("The server runs on your computer. Start it, then point the iPhone’s Camera at the code it shows — or stay on the same Wi-Fi and tap “Find automatically”.")
            )
            .typeStyle(.smallTight)
            .foregroundStyle(Modernist.Neutral.s700)
            .padding(.top, 14)
        }
    }

    @ViewBuilder
    private var statusLine: some View {
        switch server.status {
        case .connected:
            statusRow(
                connected: true,
                title: Lf("Connected to %@", server.serverName),
                details: connectedDetails
            )
        case .checking, .unknown:
            HStack(spacing: Modernist.Space.s2) {
                PulsingDot(size: 10)
                Text(L("Looking for your server…"))
                    .typeStyle(TypeStyle(size: 15, weight: .extrabold, lineHeight: 1.3))
            }
        case let .unreachable(problem):
            statusRow(
                connected: false,
                title: problem.title,
                details: [problem.advice] + (server.failureDetail.map { [$0] } ?? [])
            )
        case .needsKey:
            statusRow(
                connected: false,
                title: L("This server needs an access key."),
                details: [L("On your computer, look at the server’s window and scan the code it shows with the iPhone’s Camera.")]
            )
        case .wrongKey:
            statusRow(
                connected: false,
                title: L("The server did not accept the access key."),
                details: [L("Scan the code the server shows again, with the iPhone’s Camera.")]
            )
        }
    }

    /// What the connected server does, one fact per line.
    private var connectedDetails: [String] {
        var details: [String] = []
        details.append(
            server.isSimulated
                ? L("Calls are simulated — no real phone call is made.")
                : L("Real phone calls are switched on.")
        )
        if let session = server.session {
            details.append(
                session.reports == "claude"
                    ? L("Reports are written by Claude.")
                    : L("Reports are basic: no AI summary is set up.")
            )
            if !session.simulated, !session.reachable {
                details.append(
                    L("The phone service cannot reach your server, so the transcript arrives after each call rather than during it.")
                )
            }
        }
        if server.isOutdated {
            details.append(L("The server software is older than the app. Update it for live transcripts and call answering."))
        }
        return details
    }

    private func statusRow(connected: Bool, title: String, details: [String]) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Rectangle()
                .fill(connected ? Modernist.accent : .clear)
                .overlay {
                    Rectangle().strokeBorder(
                        connected ? Modernist.accent : Modernist.text, lineWidth: 2
                    )
                }
                .frame(width: 12, height: 12)
                .padding(.top, 4)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .typeStyle(TypeStyle(size: 15, weight: .extrabold, lineHeight: 1.3))
                ForEach(details, id: \.self) { detail in
                    Text(detail)
                        .typeStyle(.smallTight)
                        .foregroundStyle(Modernist.Neutral.s800)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - You

    private var profileSection: some View {
        section(L("You")) {
            VStack(alignment: .leading, spacing: 18) {
                Field(label: L("Your name — said at the start of every call")) {
                    DSTextField(
                        placeholder: "",
                        text: $userName,
                        minHeight: 44,
                        fontSize: 16,
                        textContentType: .name
                    )
                }
                Field(label: L("Reports are written in")) {
                    languagePicker($reportLanguage)
                }
                Field(label: L("Calls are usually in")) {
                    languagePicker($callLanguage)
                }
            }
        }
    }

    private func languagePicker(_ selection: Binding<Language>) -> some View {
        SegmentedControl(
            values: Language.allCases,
            selection: selection,
            padding: EdgeInsets(top: 11, leading: 12, bottom: 11, trailing: 12)
        ) { language, _ in
            Text(language.displayName)
                .typeStyle(TypeStyle(size: 14, weight: .regular, lineHeight: 1.2))
        }
    }

    // MARK: - Answering calls

    private var canAnswer: Bool { server.session?.canAnswerCalls ?? false }

    private var answeringSection: some View {
        section(L("Answer my calls")) {
            Text(
                L("When you cannot pick up, Yaver answers for you. It says at once that it is your AI assistant, takes a message in German, Turkish or English, and writes down who called and why.")
            )
            .typeStyle(.bodyTight)
            .frame(maxWidth: .infinity, alignment: .leading)

            // Which language a caller hears first is decided two fields up;
            // say so here, where it matters.
            Text(
                Lf(
                    "Callers are greeted in %@, the language your calls are usually in. After that, Yaver answers in whatever language the caller speaks.",
                    callLanguage.localizedName
                )
            )
            .typeStyle(.smallTight)
            .foregroundStyle(Modernist.Neutral.s700)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 8)

            if canAnswer {
                SegmentedControl(
                    values: [false, true],
                    selection: $answering,
                    padding: EdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12)
                ) { isOn, _ in
                    Text(isOn ? L("On") : L("Off"))
                        .typeStyle(TypeStyle(size: 14, weight: .regular, lineHeight: 1.2))
                }
                .disabled(isSavingAnswer)
                .padding(.top, 14)
                .onChange(of: answering) { _, enabled in
                    guard enabled != (server.session?.profile.answerCalls ?? false) else { return }
                    saveAnswering()
                }

                if let answerError {
                    Notice(title: L("That did not work."), message: answerError, tone: .accent)
                        .padding(.top, 12)
                }

                if !server.isSimulated {
                    // The phone service picks up, not this server: say what
                    // that means for a computer that is not always on.
                    Text(
                        L("Yaver also answers while your computer is off. The messages wait for up to seven days and appear here as soon as the server is running again.")
                    )
                    .typeStyle(.smallTight)
                    .foregroundStyle(Modernist.Neutral.s700)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 12)
                }

                if let number = server.session?.answerNumber, !number.isEmpty {
                    forwardingHelp(number)
                }

                Field(label: L("Note for callers (optional)")) {
                    DSTextField(
                        placeholder: L("e.g. I am at work until six."),
                        text: $answerNote,
                        minHeight: 44,
                        fontSize: 15
                    )
                }
                .padding(.top, 16)

                if answerNote.trimmingCharacters(in: .whitespaces)
                    != (server.session?.profile.answerNote ?? "") {
                    Button(action: saveAnswering) {
                        Text(L("Save note"))
                    }
                    .buttonStyle(ModernistButtonStyle(variant: .secondary, height: 40))
                    .disabled(isSavingAnswer)
                    .padding(.top, 10)
                }

                if server.isSimulated {
                    Button {
                        isSimulating = true
                        Task {
                            // A caller in another language than the reader's:
                            // that is the case the translation is for.
                            let caller: Language = reportLanguage == .de ? .tr : .de
                            let task = await model.simulateIncomingCall(callerLanguage: caller)
                            isSimulating = false
                            if let task { openTask(task) }
                        }
                    } label: {
                        ButtonLabel(title: L("Simulate an incoming call"), icon: .phoneIncoming, iconSize: 16)
                    }
                    .buttonStyle(ModernistButtonStyle(variant: .secondary, block: true, height: 48))
                    .disabled(isSimulating)
                    .padding(.top, 16)

                    Text(L("Your server only simulates calls for now, so this shows what an answered call looks like."))
                        .typeStyle(.captionSmall)
                        .foregroundStyle(Modernist.Neutral.s700)
                        .padding(.top, 8)
                }
            } else {
                Notice(
                    title: server.isConnected
                        ? L("Not set up on your server yet.")
                        : L("Connect to your server first."),
                    message: L("Answering calls needs a phone number at a phone service, set up on the server.")
                )
                .padding(.top, 14)
            }
        }
    }

    /// How to send unanswered calls to the secretary. The codes are the ones
    /// mobile networks share; the phone's own call settings do the same.
    private func forwardingHelp(_ number: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(L("Forward the calls you do not answer to"))
                .typeStyle(.smallTight)
                .foregroundStyle(Modernist.Neutral.s800)
            Text(number)
                .typeStyle(TypeStyle(size: 20, weight: .extrabold, lineHeight: 1.2, tabularNumbers: true))
                .textSelection(.enabled)
            Text(
                Lf("On most mobile networks: dial **61*%@# and press call. To switch it off again, dial ##61#.", number)
            )
            .typeStyle(.smallTight)
            .foregroundStyle(Modernist.Neutral.s700)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 14)
    }

    private func loadAnswering() {
        let profile = server.session?.profile
        answering = profile?.answerCalls ?? false
        answerNote = profile?.answerNote ?? ""
    }

    private func saveAnswering() {
        guard !isSavingAnswer else { return }
        isSavingAnswer = true
        answerError = nil
        Task {
            answerError = await model.saveAnswering(enabled: answering, note: answerNote)
            if answerError == nil {
                loadAnswering()
            } else {
                // After a failure the server may still have done it — the
                // app only stopped waiting. So ask what it does now, and let
                // the switch show that. A note that could not be saved stays
                // in its field, to be tried again.
                await server.refreshSession()
                answering = server.session?.profile.answerCalls ?? false
            }
            isSavingAnswer = false
        }
    }

    // MARK: - About

    private var aboutSection: some View {
        section(L("About")) {
            HStack(alignment: .bottom, spacing: 14) {
                BrandMark(height: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(Brand.name)
                        .typeStyle(TypeStyle(size: 22, weight: .extrabold, lineHeight: 1.1, tracking: -0.02))
                    Text(Lf("Version %@", Self.version))
                        .typeStyle(.captionSmall)
                        .foregroundStyle(Modernist.Neutral.s700)
                }
            }
            .padding(.bottom, 14)

            VStack(alignment: .leading, spacing: 8) {
                promise(L("Says it is an AI at the start of every call."))
                promise(L("Keeps a written transcript. The audio is not kept."))
                promise(L("Calls only when you ask. One request, one call."))
                promise(L("Translation and speech recognition happen on your iPhone."))
            }
        }
    }

    private func promise(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Rectangle()
                .fill(Modernist.accent)
                .frame(width: 8, height: 8)
                .padding(.top, 5)
            Text(text)
                .typeStyle(.smallTight)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private static let version: String =
        (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "—"

    // MARK: - Layout

    /// A block opened by a kicker and closed by the strong rule.
    private func section<Content: View>(
        _ title: String, @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Kicker(text: title)
                .padding(.top, 20)
                .padding(.bottom, 12)
            content()
            Rule()
                .padding(.top, 20)
        }
    }
}
