import SwiftUI

struct ConversationEntry: Identifiable, Equatable {
    enum Side: Equatable {
        /// You spoke; translated into their language.
        case mine
        /// They spoke; translated into your language.
        case theirs
    }

    var id = UUID().uuidString
    let side: Side
    let original: String
    /// The languages of this turn, fixed when it was spoken — changing the
    /// language bar afterwards must not change what an old line means.
    let pair: TranslationPair
}

/// A ready-made conversation for previews and screenshots, where neither the
/// microphone nor the system's translation is available.
struct TranslatorStage {
    var entries: [ConversationEntry] = []
    /// Who is "speaking" right now, with the words recognised so far.
    var speaking: ConversationEntry.Side?
    var partial = ""
}

/// Live two-way conversation translator, laid out as a two-column ledger: what
/// was said on one side, what the other side reads on the other.
///
/// The translation is written while the person is still speaking: every few
/// words the recogniser hears are translated and the line on the other side
/// grows with them. When the turn ends the whole sentence is translated once
/// more, kept, and read aloud.
///
/// Recognition, translation and speech all use Apple's on-device frameworks —
/// no server, no per-use cost, and it keeps working offline once the language
/// packs are downloaded.
struct TranslatorView: View {
    var goBack: () -> Void
    var stage: TranslatorStage?

    @Environment(LiveTranslator.self) private var translator

    @AppStorage("translator.myLanguage") private var myLanguageRaw = ""
    @AppStorage("translator.theirLanguage") private var theirLanguageRaw = ""
    @AppStorage("translator.autoSpeak") private var autoSpeak = true

    @State private var recognizer = SpeechRecognizer()
    @State private var speaker = Speaker()

    private enum Phase: Equatable {
        case idle
        case listening(ConversationEntry.Side)
        /// The microphone is closed and the last words are being recognised.
        case finishing(ConversationEntry.Side)
    }

    @State private var phase: Phase = .idle
    @State private var entries: [ConversationEntry] = []
    /// The languages of the turn in progress.
    @State private var turnPair: TranslationPair?
    /// The newest translation of the sentence being spoken. Kept on screen
    /// while the next, longer version is on its way, so the line never blinks.
    @State private var liveTranslation = ""
    @State private var spoken: Set<String> = []
    @State private var errorMessage: String?
    @State private var permissionsGranted = false

    /// "Your" language starts as the language the iPhone is in; "theirs" as
    /// German, or Turkish for someone whose own language is German.
    private var myLanguage: Language {
        Language(rawValue: myLanguageRaw) ?? L10n.language
    }

    private var theirLanguage: Language {
        Language(rawValue: theirLanguageRaw) ?? (myLanguage == .de ? .tr : .de)
    }

    private var isBusy: Bool { phase != .idle }

    var body: some View {
        VStack(spacing: 0) {
            header
            languageBar
            conversation
            controls
        }
        .task {
            guard stage == nil else {
                entries = stage?.entries ?? []
                spoken = Set(entries.map(\.id))
                if let side = stage?.speaking {
                    turnPair = pair(for: side)
                    phase = .listening(side)
                }
                return
            }
            permissionsGranted = await SpeechRecognizer.requestPermissions()
            prepareLanguages()
        }
        .onChange(of: recognizer.transcript) { _, text in
            guard case .listening = phase, let turnPair else { return }
            translator.requestLatest(text, turnPair)
        }
        .onChange(of: currentLiveTranslation) { _, fresh in
            if let fresh { liveTranslation = fresh }
        }
        // The recogniser can stop on its own (a long pause, its time limit):
        // treat that exactly like the user tapping "done".
        .onChange(of: recognizer.isRecording) { _, recording in
            if !recording, case .listening = phase, stage == nil { finishListening() }
        }
        .onChange(of: translator.results.count) { speakNewTranslations() }
        .onDisappear {
            recognizer.cancel()
            speaker.stop()
            SpeechRecognizer.releaseAudio()
        }
        .alert(
            L("Translator"),
            isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )
        ) {
            Button(L("OK")) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // MARK: - Chrome

    private var header: some View {
        HeaderBar {
            HStack {
                HStack(spacing: 6) {
                    IconButton(glyph: .chevronLeft, accessibilityLabel: L("Back"), action: goBack)
                        .padding(.leading, -10)
                    Wordmark(title: L("Live translator"))
                }
                Spacer()
                IconButton(
                    glyph: autoSpeak ? .volumeHigh : .volumeOff,
                    accessibilityLabel: autoSpeak ? L("Voice output on") : L("Voice output off")
                ) {
                    autoSpeak.toggle()
                    if !autoSpeak { speaker.stop() }
                }
                .padding(.trailing, -8)
            }
        }
    }

    /// Who speaks what. Tapping a side cycles through the three languages;
    /// the middle control swaps them. Locked while someone is speaking.
    private var languageBar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                languageButton(title: L("You speak"), language: myLanguage) {
                    setLanguages(mine: cycled(from: myLanguage, avoiding: theirLanguage), theirs: theirLanguage)
                }

                IconButton(glyph: .swap, accessibilityLabel: L("Swap languages")) {
                    setLanguages(mine: theirLanguage, theirs: myLanguage)
                }
                .frame(width: 44)

                HStack(spacing: 0) {
                    VHairline()
                    languageButton(title: L("They speak"), language: theirLanguage) {
                        setLanguages(mine: myLanguage, theirs: cycled(from: theirLanguage, avoiding: myLanguage))
                    }
                    .padding(.leading, 12)
                }
            }
            .padding(.horizontal, Modernist.gutter)
            .padding(.vertical, 12)
            .disabled(isBusy)
            .opacity(isBusy ? 0.5 : 1)
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

    /// The next language in the cycle that is not the other side's — the two
    /// sides are never the same language.
    private func cycled(from language: Language, avoiding other: Language) -> Language {
        let order: [Language] = [.tr, .de, .en]
        let start = order.firstIndex(of: language) ?? 0
        for step in 1 ... order.count {
            let candidate = order[(start + step) % order.count]
            if candidate != other { return candidate }
        }
        return language
    }

    private func setLanguages(mine: Language, theirs: Language) {
        myLanguageRaw = mine.rawValue
        theirLanguageRaw = theirs.rawValue
        prepareLanguages()
    }

    /// Opens both directions now, so that a request to download a language
    /// comes when the screen opens rather than in the middle of a sentence.
    private func prepareLanguages() {
        guard stage == nil else { return }
        translator.prepare(pair(for: .mine))
        translator.prepare(pair(for: .theirs))
    }

    // MARK: - The conversation

    private var conversation: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 0) {
                    if let blocked = blockedPair {
                        downloadNotice(blocked)
                    }
                    if entries.isEmpty, !isBusy {
                        emptyState
                    }
                    ForEach(entries) { entry in
                        entryRow(entry).id(entry.id)
                    }
                    if case let .listening(side) = phase {
                        listeningRow(side).id("live")
                    } else if case let .finishing(side) = phase {
                        listeningRow(side).id("live")
                    }
                    Color.clear.frame(height: 20).id("end")
                }
                .padding(.horizontal, Modernist.gutter)
            }
            .onChange(of: entries) {
                withAnimation { proxy.scrollTo("end", anchor: .bottom) }
            }
            .onChange(of: recognizer.transcript) {
                proxy.scrollTo("end", anchor: .bottom)
            }
            .onChange(of: phase) {
                withAnimation { proxy.scrollTo("end", anchor: .bottom) }
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(L("Hold a conversation across languages."))
                .typeStyle(.headlineSmall)
            Text(
                L("Tap “I speak” and talk. The translation is written on the other side while you are still speaking, and read aloud when you finish. Tap “They speak” for their turn.")
            )
            .typeStyle(TypeStyle(size: 14, weight: .regular, lineHeight: 1.5))
            .foregroundStyle(Modernist.Neutral.s700)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 40)
    }

    /// A direction whose languages are not on the phone.
    private var blockedPair: TranslationPair? {
        [pair(for: .mine), pair(for: .theirs)].first { translator.state($0) == .needsDownload }
    }

    private func downloadNotice(_ pair: TranslationPair) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Notice(
                title: L("Translation needs a language download"),
                message: Lf(
                    "%1$@ and %2$@ are translated on your iPhone. The languages have to be downloaded once.",
                    pair.source.displayName, pair.target.displayName
                ),
                tone: .accent
            )
            Button {
                translator.retry(pair)
            } label: {
                ButtonLabel(title: L("Download languages"), icon: .arrowRight)
            }
            .buttonStyle(ModernistButtonStyle(variant: .secondary, block: true, height: 44))
        }
        .padding(.top, 14)
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
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 14)
    }

    @ViewBuilder
    private func translationCell(_ entry: ConversationEntry) -> some View {
        if let translated = translator.translation(of: entry.original, entry.pair) {
            VStack(alignment: .leading, spacing: Modernist.Space.s2) {
                Text(translated)
                    .typeStyle(.translated)
                    .textSelection(.enabled)
                Button {
                    play(entry)
                } label: {
                    HStack(spacing: 5) {
                        Icon(glyph: .volumeLow, size: 14)
                        Text(speaker.speakingID == entry.id ? L("Speaking…") : L("Play"))
                    }
                }
                .buttonStyle(
                    ModernistButtonStyle(
                        variant: .ghost, fontSize: 12, horizontalPadding: 4, verticalPadding: 12
                    )
                )
                .padding(.leading, -4)
                // A finger-sized target without loosening the line spacing.
                .padding(.vertical, -10)
                // Played back now, the loudspeaker would be heard as speech.
                .disabled(isBusy)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 14)
        } else {
            waitingCell(pendingNote(for: entry.pair))
        }
    }

    /// What to say in place of a translation that has not arrived.
    private func pendingNote(for pair: TranslationPair) -> String {
        switch translator.state(pair) {
        case .needsDownload: return L("Waiting for the language download.")
        case .unavailable: return L("Translation is not available here.")
        case .idle, .preparing, .ready: return L("Translating…")
        }
    }

    /// The live row while the microphone is open: a level meter and the words
    /// as they are recognised on one side, their translation on the other.
    private func listeningRow(_ side: ConversationEntry.Side) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 0) {
                if side == .mine {
                    partialCell.padding(.trailing, 12)
                    VHairline()
                    liveCell(side).padding(.leading, 12)
                } else {
                    liveCell(side).padding(.trailing, 12)
                    VHairline()
                    partialCell.padding(.leading, 12)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            Hairline()
        }
    }

    private var partialText: String {
        stage?.speaking != nil ? (stage?.partial ?? "") : recognizer.transcript
    }

    private var partialCell: some View {
        VStack(alignment: .leading, spacing: Modernist.Space.s2) {
            ListeningBars()
            Text(partialText.isEmpty ? L("Listening…") : partialText)
                .typeStyle(TypeStyle(size: 14, weight: .regular, lineHeight: 1.4))
                .foregroundStyle(Modernist.Accent.s700)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 14)
    }

    /// The translation of the sentence in progress, as far as it has got.
    private var currentLiveTranslation: String? {
        guard let turnPair, !partialText.isEmpty else { return nil }
        return translator.translation(of: partialText, turnPair)
    }

    @ViewBuilder
    private func liveCell(_ side: ConversationEntry.Side) -> some View {
        let shown = currentLiveTranslation ?? liveTranslation
        if shown.isEmpty {
            waitingCell(
                side == .mine ? L("Translating as you speak…") : L("Translating as they speak…")
            )
        } else {
            Text(shown)
                .typeStyle(.translated)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 14)
        }
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
                micButton(side: .mine, language: myLanguage, idleKicker: L("I speak"))
                VHairline()
                micButton(side: .theirs, language: theirLanguage, idleKicker: L("They speak"))
            }
            .fixedSize(horizontal: false, vertical: true)
            Hairline()
            Text(
                recognizer.isRecording && !recognizer.isOnDevice
                    ? L("For this language, the iPhone sends the audio to Apple to recognise it.")
                    : L("Works face-to-face and over speakerphone. iOS does not let apps listen to your own phone call.")
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
        let isActive = phase == .listening(side)
        let isFinishing = phase == .finishing(side)
        let highlighted = isActive || isFinishing
        return Button {
            if isActive {
                finishListening()
            } else if phase == .idle {
                startListening(side: side)
            }
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Icon(glyph: highlighted ? .stop : .mic, size: 22)
                Spacer(minLength: Modernist.Space.s2)
                VStack(alignment: .leading, spacing: 2) {
                    Text((highlighted ? L("Listening") : idleKicker).displayUppercased)
                        .typeStyle(.kickerRow)
                    Text(highlighted ? L("Tap when done") : language.displayName)
                        .typeStyle(TypeStyle(size: 16, weight: .extrabold, lineHeight: 1.2))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
            .padding(.horizontal, Modernist.gutter)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, minHeight: 92, alignment: .topLeading)
            .foregroundStyle(highlighted ? Modernist.bg : Modernist.text)
            .background(highlighted ? Modernist.accent : .clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .opacity(isBusy && !highlighted ? 0.45 : 1)
        .disabled((isBusy && !isActive) || stage != nil)
    }

    // MARK: - Speech

    private func pair(for side: ConversationEntry.Side) -> TranslationPair {
        side == .mine
            ? TranslationPair(source: myLanguage, target: theirLanguage)
            : TranslationPair(source: theirLanguage, target: myLanguage)
    }

    private func startListening(side: ConversationEntry.Side) {
        guard permissionsGranted else {
            errorMessage = L("Microphone and speech recognition access are needed. Please allow both in the iPhone’s Settings.")
            return
        }
        speaker.stop()
        let pair = pair(for: side)
        do {
            try recognizer.start(language: pair.source)
            turnPair = pair
            liveTranslation = ""
            phase = .listening(side)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Ends the turn: waits for the last words, then keeps the sentence and
    /// sends it for its final translation.
    private func finishListening() {
        guard case let .listening(side) = phase, let pair = turnPair else { return }
        phase = .finishing(side)
        Task {
            let text = await recognizer.finish().trimmingCharacters(in: .whitespacesAndNewlines)
            // Nothing half-spoken should be translated after this.
            translator.requestLatest("", pair)
            phase = .idle
            liveTranslation = ""
            turnPair = nil
            guard !text.isEmpty else {
                // Nothing was heard. If the recogniser said why, pass it on.
                errorMessage = recognizer.problem
                return
            }
            entries.append(ConversationEntry(side: side, original: text, pair: pair))
            translator.request([text], pair)
            speakNewTranslations()
        }
    }

    /// Reads a finished line aloud once, when its translation arrives.
    private func speakNewTranslations() {
        guard stage == nil, !isBusy else { return }
        // The newest line that has a translation and has not been read yet.
        // Anything older is skipped: reading it now would only be confusing.
        guard let index = entries.lastIndex(where: {
            !spoken.contains($0.id) && translator.translation(of: $0.original, $0.pair) != nil
        }) else { return }
        for entry in entries[...index] { spoken.insert(entry.id) }
        if autoSpeak { play(entries[index]) }
    }

    private func play(_ entry: ConversationEntry) {
        guard let translated = translator.translation(of: entry.original, entry.pair) else { return }
        speaker.speak(translated, languageCode: entry.pair.target.voiceLanguageCode, id: entry.id)
    }
}
