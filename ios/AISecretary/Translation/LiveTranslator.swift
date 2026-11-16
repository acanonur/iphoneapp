import NaturalLanguage
import Observation
import SwiftUI
import Translation

/// Translate from `source` into `target`.
struct TranslationPair: Hashable {
    let source: Language
    let target: Language

    /// The two languages, whichever way round: both directions of a
    /// conversation need the same download.
    var languages: Set<Language> { [source, target] }
}

/// On-device translation for text that keeps arriving: the lines of a call as
/// it happens, the words of a sentence as it is spoken.
///
/// Apple hands out a translation session only through a view modifier, and the
/// session lives as long as that view and its language pair do. So each pair
/// gets one long-lived session (a "lane") that waits for text and translates
/// it as it comes — rather than a new session per sentence, which would stall
/// while people are talking.
///
/// Nothing leaves the phone: the translation models run on the device.
@Observable
@MainActor
final class LiveTranslator {
    enum LaneState: Equatable {
        /// Never used.
        case idle
        /// Checking that the languages are on the phone, asking for them if not.
        case preparing
        /// The user agreed to the download and it is on its way.
        case downloading
        case ready
        /// The languages are not on the phone and were not downloaded.
        case needsDownload
        /// This pair cannot be translated here (unsupported, or the simulator).
        case unavailable
    }

    /// Every ordered pair of the app's three languages.
    static let pairs: [TranslationPair] = Language.allCases.flatMap { source in
        Language.allCases.filter { $0 != source }.map {
            TranslationPair(source: source, target: $0)
        }
    }

    /// Finished translations, by pair and source text.
    private(set) var results: [String: String] = [:]
    /// The sentence being spoken, as far as it has been translated: the newest
    /// translation of text that is still changing. It lags the speaker by one
    /// translation, and never waits for them to pause.
    private(set) var live: [TranslationPair: String] = [:]
    private(set) var states: [TranslationPair: LaneState] = [:]
    /// How often a piece of text has failed to translate. Text that failed
    /// twice is left alone, and the screens stop saying it is on its way.
    private(set) var failures: [String: Int] = [:]
    /// A lane exists once it has a configuration; the host view starts a
    /// session for each one.
    private(set) var configurations: [TranslationPair: TranslationSession.Configuration] = [:]

    @ObservationIgnored private var cacheOrder: [String] = []
    /// Translations of half-spoken sentences. There are several per second of
    /// speech and each is needed only for a moment, so they are kept apart
    /// from `results` — a handful at a time — and cannot push finished
    /// sentences out of it.
    @ObservationIgnored private var partials: [String: String] = [:]
    @ObservationIgnored private var partialOrder: [String] = []
    /// Language sets whose download the user said no to. The other direction
    /// of the same conversation then does not ask again.
    @ObservationIgnored private var declined: Set<Set<Language>> = []
    /// One download question at a time (see `prepare`).
    @ObservationIgnored private var isAsking = false
    @ObservationIgnored private var askWaiters: [CheckedContinuation<Void, Never>] = []
    @ObservationIgnored private var queues: [TranslationPair: [String]] = [:]
    /// Text that is still changing (a sentence being spoken): only the newest
    /// version is worth translating.
    @ObservationIgnored private var volatile: [TranslationPair: String] = [:]
    /// Counts the turns of changing text, so a translation that arrives after
    /// its turn has ended is not shown at the start of the next one.
    @ObservationIgnored private var turns: [TranslationPair: Int] = [:]
    @ObservationIgnored private var wakers: [TranslationPair: AsyncStream<Void>.Continuation] = [:]
    /// What the language recogniser made of a line; nil where it could not tell.
    @ObservationIgnored private var guesses: [String: Language?] = [:]
    /// The lines of the transcript on screen, per lane, as last asked for.
    @ObservationIgnored private var transcriptTexts: [TranslationPair: Set<String>] = [:]

    private static let cacheLimit = 600
    private static let partialLimit = 40
    private static let batchSize = 8

    private func key(_ text: String, _ pair: TranslationPair) -> String {
        "\(pair.source.rawValue)>\(pair.target.rawValue)|\(text)"
    }

    // MARK: - Asking

    func translation(of text: String, _ pair: TranslationPair) -> String? {
        let entry = key(text.trimmingCharacters(in: .whitespacesAndNewlines), pair)
        return results[entry] ?? partials[entry]
    }

    func state(_ pair: TranslationPair) -> LaneState {
        states[pair] ?? .idle
    }

    /// Queues finished text. Each piece is translated once and kept.
    func request(_ texts: [String], _ pair: TranslationPair) {
        guard pair.source != pair.target else { return }
        var queue = queues[pair] ?? []
        for text in texts {
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            let entry = key(trimmed, pair)
            guard !trimmed.isEmpty, results[entry] == nil else { continue }
            // The sentence ended exactly as it was last heard: its translation
            // is already here, and now it is kept.
            if let known = partials[entry] {
                store(known, for: trimmed, pair)
                continue
            }
            guard !queue.contains(trimmed), (failures[entry] ?? 0) < 2 else { continue }
            queue.append(trimmed)
        }
        queues[pair] = queue
        open(pair)
        wakers[pair]?.yield()
    }

    /// Offers text that is still changing. A newer version replaces an older
    /// one that has not been translated yet, so the lane never falls behind.
    func requestLatest(_ text: String, _ pair: TranslationPair) {
        guard pair.source != pair.target else { return }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            // The turn is over (or a new one begins): forget its half-finished versions.
            volatile[pair] = nil
            live[pair] = nil
            turns[pair, default: 0] += 1
            return
        }
        if let known = translation(of: trimmed, pair) {
            volatile[pair] = nil
            live[pair] = known
            return
        }
        volatile[pair] = trimmed
        open(pair)
        wakers[pair]?.yield()
    }

    /// The translation, so far, of the sentence that is still being spoken.
    func liveTranslation(_ pair: TranslationPair) -> String? {
        live[pair]
    }

    /// Gets a lane ready before it is needed, so that a request to download a
    /// language arrives when a screen opens rather than mid-sentence.
    func prepare(_ pair: TranslationPair) {
        guard pair.source != pair.target else { return }
        open(pair)
    }

    /// Tries a lane again — after the user declined a download, say.
    func retry(_ pair: TranslationPair) {
        #if !targetEnvironment(simulator)
        failures = failures.filter { !$0.key.hasPrefix("\(pair.source.rawValue)>\(pair.target.rawValue)|") }
        declined.remove(pair.languages)
        if configurations[pair] == nil {
            open(pair)
        } else {
            configurations[pair]?.invalidate()
        }
        #endif
    }

    private func open(_ pair: TranslationPair) {
        guard configurations[pair] == nil else { return }
        #if targetEnvironment(simulator)
        // Apple's translation does not run in the simulator at all.
        states[pair] = .unavailable
        #else
        configurations[pair] = TranslationSetup.configuration(for: pair)
        #endif
    }

    // MARK: - Serving a lane

    /// Runs for as long as the lane's session lives: makes sure the languages
    /// are there, then translates whatever is queued, and waits for more.
    func serve(_ pair: TranslationPair, session: TranslationSession) async {
        states[pair] = .preparing
        switch await prepare(pair, session: session) {
        case .ready:
            break
        case .cancelled:
            states[pair] = .idle
            return
        case .unavailable:
            states[pair] = .unavailable
            return
        case .declined:
            states[pair] = .needsDownload
            // The download can still happen — it was started before the sheet
            // was closed, or the languages are added in Settings. Look now and
            // then, and start over by itself once they are there.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(3))
                if Task.isCancelled { return }
                if await installed(pair) == .installed {
                    declined.remove(pair.languages)
                    configurations[pair]?.invalidate()
                    return
                }
            }
            return
        }
        states[pair] = .ready

        let (signals, wake) = AsyncStream<Void>.makeStream(bufferingPolicy: .bufferingNewest(1))
        wakers[pair] = wake
        wake.yield()

        for await _ in signals {
            while let next = nextBatch(pair) {
                if Task.isCancelled { return }
                let batch = next.texts
                do {
                    let requests = batch.enumerated().map { index, text in
                        TranslationSession.Request(
                            sourceText: text, clientIdentifier: String(index)
                        )
                    }
                    let responses = try await session.translations(from: requests)
                    for response in responses {
                        guard let identifier = response.clientIdentifier,
                              let index = Int(identifier), batch.indices.contains(index)
                        else { continue }
                        if next.turn == nil {
                            store(response.targetText, for: batch[index], pair)
                        } else {
                            storePartial(response.targetText, for: batch[index], pair)
                        }
                    }
                    // The sentence in progress has got this far — unless its
                    // turn ended while this was being translated.
                    if let turn = next.turn, turn == turns[pair, default: 0],
                       let text = batch.first, let translated = translation(of: text, pair) {
                        live[pair] = translated
                    }
                    settle(batch, pair, translated: true)
                } catch {
                    if Task.isCancelled || error is CancellationError { return }
                    settle(batch, pair, translated: false)
                }
            }
        }
    }

    private enum Readiness {
        case ready, declined, unavailable, cancelled
    }

    private func installed(_ pair: TranslationPair) async -> LanguageAvailability.Status {
        await TranslationSetup.availability().status(
            from: pair.source.localeLanguage, to: pair.target.localeLanguage
        )
    }

    /// Sees to it that the languages are on the phone, asking for the download
    /// if they are not.
    ///
    /// The two directions of a conversation need the same languages and are
    /// opened together. They take turns here — the first waits for its
    /// download before the second looks — so the system asks once, not twice;
    /// and a "no" to one direction is not followed by the same question for
    /// the other.
    private func prepare(_ pair: TranslationPair, session: TranslationSession) async -> Readiness {
        await beginAsking()
        defer { endAsking() }
        if Task.isCancelled { return .cancelled }

        switch await installed(pair) {
        case .installed:
            return .ready
        case .unsupported:
            return .unavailable
        default:
            break
        }
        if declined.contains(pair.languages) { return .declined }

        do {
            // Shows the system's download sheet.
            try await session.prepareTranslation()
        } catch {
            if Task.isCancelled { return .cancelled }
            declined.insert(pair.languages)
            return .declined
        }

        // "Prepared" can mean "downloading": wait until the pair is installed
        // before translating, or every sentence would raise the sheet again.
        while !Task.isCancelled {
            let status = await installed(pair)
            if status == .installed { return .ready }
            if status == .unsupported { return .unavailable }
            // Agreed to and on its way: say so, rather than "translating…".
            states[pair] = .downloading
            try? await Task.sleep(for: .seconds(2))
        }
        return .cancelled
    }

    private func beginAsking() async {
        guard isAsking else {
            isAsking = true
            return
        }
        await withCheckedContinuation { askWaiters.append($0) }
    }

    private func endAsking() {
        if askWaiters.isEmpty {
            isAsking = false
        } else {
            // The turn passes straight to whoever waited longest.
            askWaiters.removeFirst().resume()
        }
    }

    private struct Batch {
        let texts: [String]
        /// Set when this is the sentence still being spoken: the turn it belongs to.
        let turn: Int?
    }

    /// What to translate next: finished text first, a few pieces at a time;
    /// then the newest version of whatever is still changing.
    private func nextBatch(_ pair: TranslationPair) -> Batch? {
        let waiting = (queues[pair] ?? []).filter { results[key($0, pair)] == nil }
        if !waiting.isEmpty {
            return Batch(texts: Array(waiting.prefix(Self.batchSize)), turn: nil)
        }
        if let latest = volatile[pair], translation(of: latest, pair) == nil {
            return Batch(texts: [latest], turn: turns[pair, default: 0])
        }
        return nil
    }

    private func settle(_ batch: [String], _ pair: TranslationPair, translated: Bool) {
        queues[pair]?.removeAll { batch.contains($0) }
        if let latest = volatile[pair], batch.contains(latest) { volatile[pair] = nil }
        guard !translated else { return }
        // Remember the failure so the same text is not tried forever.
        for text in batch { failures[key(text, pair), default: 0] += 1 }
    }

    private func store(_ translation: String, for text: String, _ pair: TranslationPair) {
        let entry = key(text, pair)
        if results[entry] == nil { cacheOrder.append(entry) }
        results[entry] = translation
        // Half-spoken sentences pile up; the oldest are never asked for again.
        if cacheOrder.count > Self.cacheLimit {
            let stale = cacheOrder.prefix(Self.cacheLimit / 3)
            for old in stale { results[old] = nil }
            cacheOrder.removeFirst(stale.count)
        }
    }

    private func storePartial(_ translation: String, for text: String, _ pair: TranslationPair) {
        let entry = key(text, pair)
        if partials[entry] == nil { partialOrder.append(entry) }
        partials[entry] = translation
        if partialOrder.count > Self.partialLimit {
            partials[partialOrder.removeFirst()] = nil
        }
    }

    /// Puts ready-made translations in place — for previews and screenshots,
    /// where the system's translation is not available.
    func seed(_ translations: [String: String], _ pair: TranslationPair) {
        for (text, translation) in translations { store(translation, for: text, pair) }
    }

    // MARK: - Call transcripts

    /// The language each line of a call was spoken in, in step with `lines`.
    ///
    /// A line long enough to tell is checked by itself. A short one ("Ja.",
    /// "Tamam.") cannot be told apart, so it takes the language its speaker
    /// mostly uses, then the other speaker's — the secretary answers in the
    /// caller's language — and only then the language the call was expected
    /// to be in. That matters most for answered calls, where nobody knows
    /// beforehand which language the caller will speak.
    func languages(of lines: [TranscriptLine], expected: Language) -> [Language] {
        let sure = lines.map { confidentLanguage(of: $0.text) }
        var weight: [Bool: [Language: Int]] = [:]
        for (line, language) in zip(lines, sure) {
            guard let language else { continue }
            weight[line.isAI, default: [:]][language, default: 0] += line.text.count
        }
        func usual(_ isAI: Bool) -> Language? {
            weight[isAI]?.max { $0.value < $1.value }?.key
        }
        return zip(lines, sure).map { line, language in
            language ?? usual(line.isAI) ?? usual(!line.isAI) ?? expected
        }
    }

    /// The language one side of a call mostly spoke.
    func usualLanguage(in lines: [TranscriptLine], ofAI: Bool, expected: Language) -> Language {
        let spoken = languages(of: lines, expected: expected)
        var weight: [Language: Int] = [:]
        for (line, language) in zip(lines, spoken) where line.isAI == ofAI {
            weight[language, default: 0] += line.text.count
        }
        return weight.max { $0.value < $1.value }?.key ?? expected
    }

    private func confidentLanguage(of text: String) -> Language? {
        if let known = guesses[text] { return known }
        let guess = LanguageGuess.confident(of: text)
        if guesses.count > 2_000 { guesses.removeAll() }
        // `updateValue`, because assigning nil would remove the entry.
        guesses.updateValue(guess, forKey: text)
        return guess
    }

    /// Queues every line that is not already in the reader's language.
    /// `languages` is what `languages(of:expected:)` made of the same lines.
    func translate(_ lines: [TranscriptLine], spokenIn languages: [Language], into target: Language) {
        var bySource: [Language: [String]] = [:]
        for (line, source) in zip(lines, languages) where source != target {
            bySource[source, default: []].append(
                line.text.trimmingCharacters(in: .whitespacesAndNewlines)
            )
        }
        for source in Language.allCases where source != target {
            let pair = TranslationPair(source: source, target: target)
            let texts = bySource[source] ?? []
            let current = Set(texts)
            // During a call the newest line grows and is corrected as it is
            // spoken. Its earlier versions are no longer worth translating:
            // drop them, so the lane keeps up with the conversation.
            if let before = transcriptTexts[pair] {
                let stale = before.subtracting(current)
                if !stale.isEmpty { queues[pair]?.removeAll { stale.contains($0) } }
            }
            transcriptTexts[pair] = current.isEmpty ? nil : current
            if !texts.isEmpty { request(texts, pair) }
        }
    }

    /// The translation of a line into the reader's language, if it needs one
    /// and it has arrived.
    func translation(
        of line: TranscriptLine, spokenIn source: Language, into target: Language
    ) -> String? {
        guard source != target else { return nil }
        return translation(of: line.text, TranslationPair(source: source, target: target))
    }

    /// True while a line's translation is still on its way.
    func isWorking(
        on line: TranscriptLine, spokenIn source: Language, into target: Language
    ) -> Bool {
        guard source != target else { return false }
        let pair = TranslationPair(source: source, target: target)
        let text = line.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard results[key(text, pair)] == nil, (failures[key(text, pair)] ?? 0) < 2 else {
            return false
        }
        switch state(pair) {
        case .preparing, .downloading, .ready: return true
        case .idle, .needsDownload, .unavailable: return false
        }
    }

    /// A lane this transcript needs that is in the given state — so a screen
    /// can offer a download, or say one is under way, instead of showing nothing.
    func pair(
        in wanted: LaneState, spokenIn languages: [Language], into target: Language
    ) -> TranslationPair? {
        for source in Language.allCases where source != target && languages.contains(source) {
            let pair = TranslationPair(source: source, target: target)
            if state(pair) == wanted { return pair }
        }
        return nil
    }
}

/// Builds sessions the same way everywhere, and asks about the same kind of
/// translation the sessions use.
enum TranslationSetup {
    /// "Are the languages on the phone?" — for the strategy the sessions are
    /// built with. From iOS 26.4 the plain check asks about another family of
    /// models, with another set of languages, so the two must be made alike.
    static func availability() -> LanguageAvailability {
        #if compiler(>=6.3)
        if #available(iOS 26.4, *) {
            return LanguageAvailability(preferredStrategy: .lowLatency)
        }
        #endif
        return LanguageAvailability()
    }

    static func configuration(for pair: TranslationPair) -> TranslationSession.Configuration {
        // From iOS 26.4 a session can favour speed or polish. Words on a
        // screen while someone is talking need speed. The option only exists
        // in newer SDKs, hence the compile-time check as well.
        #if compiler(>=6.3)
        if #available(iOS 26.4, *) {
            return TranslationSession.Configuration(
                source: pair.source.localeLanguage,
                target: pair.target.localeLanguage,
                preferredStrategy: .lowLatency
            )
        }
        #endif
        return TranslationSession.Configuration(
            source: pair.source.localeLanguage, target: pair.target.localeLanguage
        )
    }
}

/// Works out which of the app's three languages a piece of text is in.
enum LanguageGuess {
    /// The language of the text, or nil where it cannot be told reliably:
    /// anything under twenty characters ("Ja.", "Tamam"), and anything the
    /// recogniser is not clearly sure about.
    static func confident(of text: String) -> Language? {
        guard text.count >= 20 else { return nil }
        let recognizer = NLLanguageRecognizer()
        recognizer.languageConstraints = [.german, .english, .turkish]
        recognizer.processString(text)
        let hypotheses = recognizer.languageHypotheses(withMaximum: 2)
        guard let best = hypotheses.max(by: { $0.value < $1.value }), best.value >= 0.75 else {
            return nil
        }
        switch best.key {
        case .german: return .de
        case .turkish: return .tr
        case .english: return .en
        default: return nil
        }
    }
}

/// Hosts the translation sessions. Attached once, at the root, so a session
/// outlives the screen that first needed it and its translations carry over
/// from the live call to the report.
struct LiveTranslationHost: ViewModifier {
    let translator: LiveTranslator

    func body(content: Content) -> some View {
        content.background {
            ForEach(LiveTranslator.pairs, id: \.self) { pair in
                Color.clear
                    .translationTask(translator.configurations[pair]) { session in
                        await translator.serve(pair, session: session)
                    }
            }
        }
    }
}

extension View {
    func hostsLiveTranslation(_ translator: LiveTranslator) -> some View {
        modifier(LiveTranslationHost(translator: translator))
    }
}
