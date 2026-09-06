import SwiftUI
import Translation

struct ConversationEntry: Identifiable, Equatable {
    enum Side {
        /// You spoke; translated into their language.
        case mine
        /// They spoke; translated into your language.
        case theirs
    }

    let id = UUID().uuidString
    let side: Side
    let original: String
    let translated: String
}

private struct PendingUtterance: Equatable {
    let text: String
    let side: ConversationEntry.Side
}

/// Live two-way conversation translator, laid out as a two-column ledger: what
/// was said on one side, what the other side hears on the other.
///
/// Recognition, translation and speech all use Apple's on-device frameworks —
/// no server, no per-use cost, and it keeps working offline once the language
/// packs are downloaded.
struct TranslatorView: View {
    var goBack: () -> Void

    @AppStorage("translator.myLanguage") private var myLanguageRaw = Language.tr.rawValue
    @AppStorage("translator.theirLanguage") private var theirLanguageRaw = Language.de.rawValue
    @AppStorage("translator.autoSpeak") private var autoSpeak = true

    @State private var recognizer = SpeechRecognizer()
    @State private var speaker = Speaker()

    @State private var entries: [ConversationEntry] = []
    @State private var listening: ConversationEntry.Side?
    @State private var pending: PendingUtterance?
    @State private var configuration: TranslationSession.Configuration?
    @State private var errorMessage: String?
    @State private var permissionsGranted = false

    private var myLanguage: Language { Language(rawValue: myLanguageRaw) ?? .tr }
    private var theirLanguage: Language { Language(rawValue: theirLanguageRaw) ?? .de }

    var body: some View {
        VStack(spacing: 0) {
            header
            languageBar
            conversation
            controls
        }
        .translationTask(configuration) { session in
            await translatePending(with: session)
        }
        .task {
            permissionsGranted = await SpeechRecognizer.requestPermissions()
        }
        .alert("Translator", isPresented: .constant(errorMessage != nil)) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // MARK: - Chrome

    private var header: some View {
        HeaderBar {
            HStack {
                HStack(spacing: 6) {
                    IconButton(glyph: .chevronLeft, accessibilityLabel: "Back", action: goBack)
                        .padding(.leading, -10)
                    Wordmark(title: "Live translator")
                }
                Spacer()
                IconButton(
                    glyph: autoSpeak ? .volumeHigh : .volumeOff,
                    accessibilityLabel: autoSpeak ? "Voice output on" : "Voice output off"
                ) {
                    autoSpeak.toggle()
                    if !autoSpeak { speaker.stop() }
                }
                .padding(.trailing, -8)
            }
        }
    }

    /// Who speaks what. Tapping a side cycles through the three languages;
    /// the middle control swaps them.
    private var languageBar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                languageButton(title: "You speak", language: myLanguage) {
                    myLanguageRaw = cycled(from: myLanguage).rawValue
                }

                IconButton(glyph: .swap, accessibilityLabel: "Swap languages") {
                    let mine = myLanguageRaw
                    myLanguageRaw = theirLanguageRaw
                    theirLanguageRaw = mine
                }
                .frame(width: 44)

                HStack(spacing: 0) {
                    VHairline()
                    languageButton(title: "They speak", language: theirLanguage) {
                        theirLanguageRaw = cycled(from: theirLanguage).rawValue
                    }
                    .padding(.leading, 12)
                }
            }
            .padding(.horizontal, Modernist.gutter)
            .padding(.vertical, 12)
            Rule()
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    private func languageButton(
        title: String,
        language: Language,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Kicker(text: title)
                Text(language.displayName)
                    .typeStyle(.subhead)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title): \(language.displayName)")
    }

    /// tr → de → en → tr, as the design cycles them.
    private func cycled(from language: Language) -> Language {
        let order: [Language] = [.tr, .de, .en]
        let index = order.firstIndex(of: language) ?? 0
        return order[(index + 1) % order.count]
    }

    // MARK: - The conversation

    private var conversation: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 0) {
                    if entries.isEmpty, listening == nil {
                        emptyState
                    }
                    ForEach(entries) { entry in
                        entryRow(entry).id(entry.id)
                    }
                    if let listening {
                        listeningRow(listening)
                    }
                    Color.clear.frame(height: 20)
                }
                .padding(.horizontal, Modernist.gutter)
            }
            .onChange(of: entries) {
                if let last = entries.last {
                    withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Hold a conversation across languages.")
                .typeStyle(.headlineSmall)
            Text(
                "Tap “I speak” and talk. The other side reads and hears it in their language. Tap “They speak” for their turn. Suited to reception desks, offices and speakerphone calls."
            )
            .typeStyle(TypeStyle(size: 14, weight: .regular, lineHeight: 1.5))
            .foregroundStyle(Modernist.Neutral.s700)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 40)
    }

    /// Original on the speaker's side, translation on the listener's.
    private func entryRow(_ entry: ConversationEntry) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 0) {
                if entry.side == .mine {
                    originalCell(entry.original).padding(.trailing, 12)
                    VHairline()
                    translationCell(entry).padding(.leading, 12)
                } else {
                    translationCell(entry).padding(.trailing, 12)
                    VHairline()
                    originalCell(entry.original).padding(.leading, 12)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            Hairline()
        }
    }

    private func originalCell(_ text: String) -> some View {
        Text(text)
            .typeStyle(.smallTight)
            .foregroundStyle(Modernist.Neutral.s700)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 14)
    }

    private func translationCell(_ entry: ConversationEntry) -> some View {
        VStack(alignment: .leading, spacing: Modernist.Space.s2) {
            Text(entry.translated)
                .typeStyle(.translated)
                .textSelection(.enabled)
            Button {
                play(entry)
            } label: {
                HStack(spacing: 5) {
                    Icon(glyph: .volumeLow, size: 14)
                    Text(speaker.speakingID == entry.id ? "Speaking…" : "Play")
                }
            }
            .buttonStyle(
                ModernistButtonStyle(
                    variant: .ghost, fontSize: 12, horizontalPadding: 4, verticalPadding: 2
                )
            )
            .padding(.leading, -4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 14)
    }

    /// The live row while the microphone is open: a level meter and the words
    /// as they are recognised.
    private func listeningRow(_ side: ConversationEntry.Side) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 0) {
                if side == .mine {
                    partialCell.padding(.trailing, 12)
                    VHairline()
                    waitingCell("Translating as you speak…").padding(.leading, 12)
                } else {
                    waitingCell("Translating as they speak…").padding(.trailing, 12)
                    VHairline()
                    partialCell.padding(.leading, 12)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            Hairline()
        }
    }

    private var partialCell: some View {
        VStack(alignment: .leading, spacing: Modernist.Space.s2) {
            ListeningBars()
            Text(recognizer.transcript.isEmpty ? "Listening…" : recognizer.transcript)
                .typeStyle(TypeStyle(size: 14, weight: .regular, lineHeight: 1.4))
                .foregroundStyle(Modernist.Accent.s700)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 14)
    }

    private func waitingCell(_ text: String) -> some View {
        Text(text)
            .typeStyle(.smallTight)
            .foregroundStyle(Modernist.Neutral.s700)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 14)
    }

    // MARK: - Controls

    private var controls: some View {
        VStack(spacing: 0) {
            Rule()
            HStack(spacing: 0) {
                micButton(side: .mine, language: myLanguage, idleKicker: "I speak")
                VHairline()
                micButton(side: .theirs, language: theirLanguage, idleKicker: "They speak")
            }
            .fixedSize(horizontal: false, vertical: true)
            Hairline()
            Text(
                "Works face-to-face and over speakerphone. iOS does not let apps listen to your own phone call."
            )
            .typeStyle(.captionSmall)
            .foregroundStyle(Modernist.Neutral.s700)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Modernist.gutter)
            .padding(.top, 8)
            .padding(.bottom, 6)
        }
    }

    private func micButton(
        side: ConversationEntry.Side,
        language: Language,
        idleKicker: String
    ) -> some View {
        let isActive = listening == side
        return Button {
            if isActive {
                finishListening()
            } else if listening == nil {
                startListening(side: side, language: language)
            }
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Icon(glyph: isActive ? .stop : .mic, size: 22)
                Spacer(minLength: Modernist.Space.s2)
                VStack(alignment: .leading, spacing: 2) {
                    Text((isActive ? "Listening" : idleKicker).uppercased())
                        .typeStyle(.kickerRow)
                    Text(isActive ? "Tap when done" : language.displayName)
                        .typeStyle(TypeStyle(size: 16, weight: .extrabold, lineHeight: 1.2))
                }
            }
            .padding(.horizontal, Modernist.gutter)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, minHeight: 92, alignment: .topLeading)
            .foregroundStyle(isActive ? Modernist.bg : Modernist.text)
            .background(isActive ? Modernist.accent : .clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(listening != nil && !isActive ? 0.45 : 1)
        .disabled(listening != nil && !isActive)
    }

    // MARK: - Speech

    private func pair(
        for side: ConversationEntry.Side
    ) -> (source: Language, target: Language) {
        side == .mine ? (myLanguage, theirLanguage) : (theirLanguage, myLanguage)
    }

    private func startListening(side: ConversationEntry.Side, language: Language) {
        guard myLanguage != theirLanguage else {
            errorMessage = "Please choose two different languages."
            return
        }
        guard permissionsGranted else {
            errorMessage =
                "Microphone and speech recognition access are needed. Please allow both in Settings."
            return
        }
        speaker.stop()
        do {
            try recognizer.start(localeIdentifier: language.speechLocaleIdentifier)
            listening = side
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func finishListening() {
        let text = recognizer.stop().trimmingCharacters(in: .whitespacesAndNewlines)
        guard let side = listening else { return }
        listening = nil
        guard !text.isEmpty else { return }

        pending = PendingUtterance(text: text, side: side)
        let languages = pair(for: side)
        let source = languages.source.localeLanguage
        let target = languages.target.localeLanguage
        if configuration?.source == source, configuration?.target == target {
            // Same language pair: re-trigger the existing translation task.
            configuration?.invalidate()
        } else {
            configuration = TranslationSession.Configuration(source: source, target: target)
        }
    }

    private func translatePending(with session: TranslationSession) async {
        guard let utterance = pending else { return }
        do {
            let response = try await session.translate(utterance.text)
            let entry = ConversationEntry(
                side: utterance.side,
                original: utterance.text,
                translated: response.targetText
            )
            entries.append(entry)
            pending = nil
            if autoSpeak { play(entry) }
        } catch {
            pending = nil
            errorMessage = "Translation failed: \(error.localizedDescription)"
        }
    }

    private func play(_ entry: ConversationEntry) {
        let target = pair(for: entry.side).target
        speaker.speak(entry.translated, languageCode: target.voiceLanguageCode, id: entry.id)
    }
}
