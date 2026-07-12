import SwiftUI
import Translation

struct ConversationEntry: Identifiable, Equatable {
    enum Direction {
        /// You spoke; translated into their language.
        case outgoing
        /// They spoke; translated into your language.
        case incoming
    }

    let id = UUID()
    let direction: Direction
    let original: String
    let translated: String
}

private struct PendingUtterance: Equatable {
    let text: String
    let direction: ConversationEntry.Direction
}

/// Live two-way conversation translator: tap a mic, speak, and the app shows
/// the translation as text and speaks it aloud. Recognition, translation and
/// speech all use Apple's on-device frameworks — no server, no per-use cost.
struct TranslatorView: View {
    @AppStorage("translator.myLanguage") private var myLanguageRaw = Language.tr.rawValue
    @AppStorage("translator.theirLanguage") private var theirLanguageRaw = Language.de.rawValue
    @AppStorage("translator.autoSpeak") private var autoSpeak = true

    @State private var recognizer = SpeechRecognizer()
    @State private var speaker = Speaker()

    @State private var entries: [ConversationEntry] = []
    @State private var activeDirection: ConversationEntry.Direction?
    @State private var pending: PendingUtterance?
    @State private var configuration: TranslationSession.Configuration?
    @State private var errorMessage: String?
    @State private var permissionsGranted = false

    private var myLanguage: Language { Language(rawValue: myLanguageRaw) ?? .tr }
    private var theirLanguage: Language { Language(rawValue: theirLanguageRaw) ?? .de }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                languageBar
                Divider()
                conversation
                Divider()
                controls
            }
            .navigationTitle("Translator")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        autoSpeak.toggle()
                    } label: {
                        Image(systemName: autoSpeak ? "speaker.wave.2.fill" : "speaker.slash.fill")
                    }
                    .accessibilityLabel(autoSpeak ? "Voice output on" : "Voice output off")
                }
                ToolbarItem(placement: .topBarLeading) {
                    if !entries.isEmpty {
                        Button("Clear") { entries.removeAll() }
                    }
                }
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
    }

    // MARK: - Subviews

    private var languageBar: some View {
        HStack(spacing: 12) {
            VStack(spacing: 2) {
                Text("You speak").font(.caption2).foregroundStyle(.secondary)
                Picker("You speak", selection: $myLanguageRaw) {
                    ForEach(Language.allCases) { lang in
                        Text(lang.displayName).tag(lang.rawValue)
                    }
                }
                .pickerStyle(.menu)
            }
            .frame(maxWidth: .infinity)

            Button {
                (myLanguageRaw, theirLanguageRaw) = (theirLanguageRaw, myLanguageRaw)
            } label: {
                Image(systemName: "arrow.left.arrow.right")
            }
            .accessibilityLabel("Swap languages")

            VStack(spacing: 2) {
                Text("They speak").font(.caption2).foregroundStyle(.secondary)
                Picker("They speak", selection: $theirLanguageRaw) {
                    ForEach(Language.allCases) { lang in
                        Text(lang.displayName).tag(lang.rawValue)
                    }
                }
                .pickerStyle(.menu)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal)
        .padding(.vertical, 6)
    }

    private var conversation: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 10) {
                    if entries.isEmpty && activeDirection == nil {
                        emptyHint
                    }
                    ForEach(entries) { entry in
                        bubble(for: entry)
                    }
                    if let direction = activeDirection {
                        listeningBubble(direction: direction)
                    }
                }
                .padding()
            }
            .onChange(of: entries) {
                if let last = entries.last {
                    withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
        }
    }

    private var emptyHint: some View {
        VStack(spacing: 10) {
            Image(systemName: "waveform.and.mic")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("Hold a conversation across languages")
                .font(.headline)
            Text("Tap “I speak” and talk — the other person instantly sees and hears it in their language. Tap “They speak” for their turn. Great for reception desks, offices and speakerphone conversations.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 40)
    }

    private func bubble(for entry: ConversationEntry) -> some View {
        let isOutgoing = entry.direction == .outgoing
        return VStack(alignment: isOutgoing ? .trailing : .leading, spacing: 4) {
            Text(entry.original)
                .font(.footnote)
                .foregroundStyle(.secondary)
            Text(entry.translated)
                .font(.title3.weight(.medium))
                .textSelection(.enabled)
            Button {
                let target = languagePair(for: entry.direction).target
                speaker.speak(entry.translated, languageCode: target.voiceLanguageCode)
            } label: {
                Label("Play", systemImage: "play.circle")
                    .font(.caption)
            }
            .buttonStyle(.borderless)
        }
        .padding(12)
        .background(
            (isOutgoing ? Color.blue : Color.green).opacity(0.10),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .frame(maxWidth: .infinity, alignment: isOutgoing ? .trailing : .leading)
        .id(entry.id)
    }

    private func listeningBubble(direction: ConversationEntry.Direction) -> some View {
        let isOutgoing = direction == .outgoing
        return HStack(spacing: 8) {
            Image(systemName: "waveform")
                .symbolEffect(.variableColor.iterative, isActive: true)
            Text(recognizer.transcript.isEmpty ? "Listening…" : recognizer.transcript)
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 14))
        .frame(maxWidth: .infinity, alignment: isOutgoing ? .trailing : .leading)
    }

    private var controls: some View {
        VStack(spacing: 8) {
            HStack(spacing: 12) {
                micButton(
                    direction: .incoming,
                    language: theirLanguage,
                    tint: .green,
                    idleLabel: "\(theirLanguage.shortFlag) They speak"
                )
                micButton(
                    direction: .outgoing,
                    language: myLanguage,
                    tint: .blue,
                    idleLabel: "\(myLanguage.shortFlag) I speak"
                )
            }
            Text("Works face-to-face and over speakerphone. During your own phone call, iOS does not let apps hear the call — translated in-app calls are on the roadmap.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }

    private func micButton(
        direction: ConversationEntry.Direction,
        language: Language,
        tint: Color,
        idleLabel: String
    ) -> some View {
        let isActive = activeDirection == direction
        return Button {
            if isActive {
                finishListening()
            } else if activeDirection == nil {
                startListening(direction: direction, language: language)
            }
        } label: {
            VStack(spacing: 6) {
                Image(systemName: isActive ? "stop.circle.fill" : "mic.circle.fill")
                    .font(.system(size: 42))
                Text(isActive ? "Tap when done" : idleLabel)
                    .font(.footnote.weight(.semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(tint.opacity(isActive ? 0.25 : 0.12), in: RoundedRectangle(cornerRadius: 16))
        }
        .tint(tint)
        .disabled(activeDirection != nil && !isActive)
    }

    // MARK: - Actions

    private func languagePair(
        for direction: ConversationEntry.Direction
    ) -> (source: Language, target: Language) {
        direction == .outgoing ? (myLanguage, theirLanguage) : (theirLanguage, myLanguage)
    }

    private func startListening(direction: ConversationEntry.Direction, language: Language) {
        guard myLanguage != theirLanguage else {
            errorMessage = "Please choose two different languages."
            return
        }
        guard permissionsGranted else {
            errorMessage = "Microphone and speech recognition access are needed. Please allow both in Settings."
            return
        }
        speaker.stop()
        do {
            try recognizer.start(localeIdentifier: language.speechLocaleIdentifier)
            activeDirection = direction
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func finishListening() {
        let text = recognizer.stop().trimmingCharacters(in: .whitespacesAndNewlines)
        guard let direction = activeDirection else { return }
        activeDirection = nil
        guard !text.isEmpty else { return }

        pending = PendingUtterance(text: text, direction: direction)
        let pair = languagePair(for: direction)
        let source = pair.source.localeLanguage
        let target = pair.target.localeLanguage
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
            entries.append(ConversationEntry(
                direction: utterance.direction,
                original: utterance.text,
                translated: response.targetText
            ))
            pending = nil
            if autoSpeak {
                let target = languagePair(for: utterance.direction).target
                speaker.speak(response.targetText, languageCode: target.voiceLanguageCode)
            }
        } catch {
            pending = nil
            errorMessage = "Translation failed: \(error.localizedDescription)"
        }
    }
}
