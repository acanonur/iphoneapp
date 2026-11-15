import NaturalLanguage
import Observation
import SwiftUI
import Translation

/// Translate from `source` into `target`.
struct TranslationPair: Hashable {
    let source: Language
    let target: Language
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
    private(set) var states: [TranslationPair: LaneState] = [:]
    /// A lane exists once it has a configuration; the host view starts a
    /// session for each one.
    private(set) var configurations: [TranslationPair: TranslationSession.Configuration] = [:]

    @ObservationIgnored private var cacheOrder: [String] = []
    @ObservationIgnored private var queues: [TranslationPair: [String]] = [:]
    /// Text that is still changing (a sentence being spoken): only the newest
    /// version is worth translating.
    @ObservationIgnored private var volatile: [TranslationPair: String] = [:]
    @ObservationIgnored private var wakers: [TranslationPair: AsyncStream<Void>.Continuation] = [:]
    @ObservationIgnored private var failures: [String: Int] = [:]
    @ObservationIgnored private var guesses: [String: Language] = [:]

    private static let cacheLimit = 600
    private static let batchSize = 8

    private func key(_ text: String, _ pair: TranslationPair) -> String {
        "\(pair.source.rawValue)>\(pair.target.rawValue)|\(text)"
    }

    // MARK: - Asking

    func translation(of text: String, _ pair: TranslationPair) -> String? {
        results[key(text.trimmingCharacters(in: .whitespacesAndNewlines), pair)]
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
            guard !trimmed.isEmpty, results[key(trimmed, pair)] == nil, !queue.contains(trimmed),
                  (failures[key(trimmed, pair)] ?? 0) < 2
            else { continue }
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
            volatile[pair] = nil
            return
        }
        guard results[key(trimmed, pair)] == nil else { return }
        volatile[pair] = trimmed
        open(pair)
        wakers[pair]?.yield()
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
        do {
            // Shows the system's download sheet if a language is missing.
            try await session.prepareTranslation()
        } catch {
            states[pair] = Task.isCancelled ? .idle : .needsDownload
            return
        }

        // "Prepared" can mean "downloading": wait until the pair is installed
        // before translating, or every sentence would raise the sheet again.
        while !Task.isCancelled {
            let status = await LanguageAvailability().status(
                from: pair.source.localeLanguage, to: pair.target.localeLanguage
            )
            if status == .installed { break }
            if status == .unsupported {
                states[pair] = .unavailable
                return
            }
            try? await Task.sleep(for: .seconds(2))
        }
        guard !Task.isCancelled else {
            states[pair] = .idle
            return
        }
        states[pair] = .ready

        let (signals, wake) = AsyncStream<Void>.makeStream(bufferingPolicy: .bufferingNewest(1))
        wakers[pair] = wake
        wake.yield()

        for await _ in signals {
            while let batch = nextBatch(pair) {
                if Task.isCancelled { return }
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
                        store(response.targetText, for: batch[index], pair)
                    }
                    settle(batch, pair, translated: true)
                } catch {
                    if Task.isCancelled || error is CancellationError { return }
                    settle(batch, pair, translated: false)
                }
            }
        }
    }

    /// What to translate next: finished text first, a few pieces at a time;
    /// then the newest version of whatever is still changing.
    private func nextBatch(_ pair: TranslationPair) -> [String]? {
        let waiting = (queues[pair] ?? []).filter { results[key($0, pair)] == nil }
        if !waiting.isEmpty { return Array(waiting.prefix(Self.batchSize)) }
        if let latest = volatile[pair], results[key(latest, pair)] == nil { return [latest] }
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

    /// Puts ready-made translations in place — for previews and screenshots,
    /// where the system's translation is not available.
    func seed(_ translations: [String: String], _ pair: TranslationPair) {
        for (text, translation) in translations { store(translation, for: text, pair) }
    }

    // MARK: - Call transcripts

    /// The language a line was spoken in. A call is usually held in one
    /// language, but people switch; a line long enough to tell is checked.
    func language(of text: String, expected: Language) -> Language {
        if let known = guesses[text] { return known }
        let guess = LanguageGuess.language(of: text, fallback: expected)
        guesses[text] = guess
        return guess
    }

    /// Queues every line of a call that is not already in the reader's language.
    func translate(lines: [TranscriptLine], spokenIn language: Language, into target: Language) {
        var bySource: [Language: [String]] = [:]
        for line in lines {
            let source = self.language(of: line.text, expected: language)
            if source != target { bySource[source, default: []].append(line.text) }
        }
        for (source, texts) in bySource {
            request(texts, TranslationPair(source: source, target: target))
        }
    }

    /// The translation of a line into the reader's language, if it needs one
    /// and it has arrived.
    func translation(
        of line: TranscriptLine, spokenIn language: Language, into target: Language
    ) -> String? {
        let source = self.language(of: line.text, expected: language)
        guard source != target else { return nil }
        return translation(of: line.text, TranslationPair(source: source, target: target))
    }

    /// True while a line's translation is still on its way.
    func isWorking(
        on line: TranscriptLine, spokenIn language: Language, into target: Language
    ) -> Bool {
        let source = self.language(of: line.text, expected: language)
        guard source != target else { return false }
        let pair = TranslationPair(source: source, target: target)
        guard translation(of: line.text, pair) == nil else { return false }
        let state = self.state(pair)
        return state == .preparing || state == .ready
    }

    /// The lanes a call's transcript needs, and where they stand — so a screen
    /// can say "download the language" instead of showing nothing.
    func blockedPair(
        for lines: [TranscriptLine], spokenIn language: Language, into target: Language
    ) -> TranslationPair? {
        for line in lines {
            let source = self.language(of: line.text, expected: language)
            guard source != target else { continue }
            let pair = TranslationPair(source: source, target: target)
            if state(pair) == .needsDownload { return pair }
        }
        return nil
    }
}

/// Builds sessions the same way everywhere.
enum TranslationSetup {
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
    /// Short text ("Ja.", "Tamam") cannot be told apart reliably, so anything
    /// under twenty characters is taken to be in the expected language.
    static func language(of text: String, fallback: Language) -> Language {
        guard text.count >= 20 else { return fallback }
        let recognizer = NLLanguageRecognizer()
        recognizer.languageConstraints = [.german, .english, .turkish]
        recognizer.processString(text)
        let hypotheses = recognizer.languageHypotheses(withMaximum: 2)
        guard let best = hypotheses.max(by: { $0.value < $1.value }), best.value >= 0.75 else {
            return fallback
        }
        switch best.key {
        case .german: return .de
        case .turkish: return .tr
        case .english: return .en
        default: return fallback
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
