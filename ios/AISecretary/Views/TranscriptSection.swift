import SwiftUI

/// A call's conversation, turn by turn, with each line that was not spoken in
/// the reader's language translated underneath it — while the call is still
/// going on, and afterwards in the report.
///
/// The translation happens on the iPhone. Lines are sent to it as they arrive,
/// so the reader follows a German or Turkish call in their own language a
/// moment after each sentence is spoken.
struct TranscriptSection: View {
    @Environment(LiveTranslator.self) private var translator
    @AppStorage("yaver.showTranslation") private var showTranslation = true

    let task: SecretaryTask
    /// The language the reader wants to read in.
    let readerLanguage: Language
    let title: String
    /// What to say when there is nothing to show yet.
    let emptyText: String
    /// A line under the heading — what is and is not kept of the call.
    var note: String?

    /// What each row last showed as its translation, and of which words.
    /// While a line is still being spoken its text grows with every update;
    /// the translation of the shorter version stays up until that of the
    /// longer one is ready, instead of blinking away each time.
    @State private var lastShown: [Int: Shown] = [:]

    private struct Shown {
        let text: String
        let translation: String
    }

    private var otherSpeaker: String {
        task.isInbound ? L("Caller") : L("Other side")
    }

    var body: some View {
        let lines = task.transcriptLines
        // The language of each line, in step with `lines`.
        let spoken = translator.languages(of: lines, expected: task.language)

        VStack(alignment: .leading, spacing: 0) {
            // The switch is only offered when there is something to translate.
            heading(hasForeignLines: spoken.contains { $0 != readerLanguage })

            if let note {
                Text(note)
                    .typeStyle(.captionSmall)
                    .foregroundStyle(Modernist.Neutral.s700)
                    .padding(.top, 4)
            }

            if showTranslation {
                if let blocked = translator.pair(
                    in: .needsDownload, spokenIn: spoken, into: readerLanguage
                ) {
                    downloadNotice(blocked)
                } else if let coming = translator.pair(
                    in: .downloading, spokenIn: spoken, into: readerLanguage
                ) {
                    Notice(
                        title: L("The languages for the translation are downloading"),
                        message: Lf(
                            "%1$@ and %2$@ are being downloaded to your iPhone. This happens once and can take a minute.",
                            coming.source.localizedName, coming.target.localizedName
                        )
                    )
                    .padding(.top, 12)
                }
            }

            if lines.isEmpty {
                Text(emptyText)
                    .typeStyle(.transcript)
                    .foregroundStyle(Modernist.Neutral.s700)
                    .padding(.top, 12)
            } else {
                ForEach(Array(zip(lines, spoken)), id: \.0.id) { line, language in
                    row(line, spokenIn: language)
                }
            }
        }
        // Remember what each row shows, for the moment its line grows.
        .onChange(of: translator.results.count, initial: true) {
            remember(lines, spokenIn: spoken)
        }
        // Every time a line arrives, grows or is corrected, ask for what is
        // still missing.
        .task(
            id: TranslationTrigger(
                texts: lines.map(\.text), target: readerLanguage, on: showTranslation
            )
        ) {
            guard showTranslation else { return }
            translator.translate(lines, spokenIn: spoken, into: readerLanguage)
        }
    }

    private func row(_ line: TranscriptLine, spokenIn language: Language) -> TranscriptRow {
        guard showTranslation else {
            return TranscriptRow(line: line, speaker: speaker(of: line))
        }
        let fresh = translator.translation(of: line, spokenIn: language, into: readerLanguage)
        let working = translator.isWorking(on: line, spokenIn: language, into: readerLanguage)
        // The line has grown since it was translated: keep the earlier
        // translation up while the new one is on its way.
        let earlier = fresh == nil && working ? earlierTranslation(of: line) : nil
        return TranscriptRow(
            line: line,
            speaker: speaker(of: line),
            translation: fresh ?? earlier,
            isTranslating: working && fresh == nil && earlier == nil
        )
    }

    private func speaker(of line: TranscriptLine) -> String {
        line.isAI ? Brand.name : otherSpeaker
    }

    /// The translation this row showed before, if it was of an earlier
    /// version of the same line — one that began with the same words.
    private func earlierTranslation(of line: TranscriptLine) -> String? {
        guard let shown = lastShown[line.id] else { return nil }
        return line.text.hasPrefix(shown.text.prefix(12)) ? shown.translation : nil
    }

    private func remember(_ lines: [TranscriptLine], spokenIn languages: [Language]) {
        for (line, language) in zip(lines, languages) {
            if let translation = translator.translation(
                of: line, spokenIn: language, into: readerLanguage
            ), lastShown[line.id]?.text != line.text {
                lastShown[line.id] = Shown(text: line.text, translation: translation)
            }
        }
    }

    private func heading(hasForeignLines: Bool) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Kicker(text: title)
            Spacer(minLength: Modernist.Space.s2)
            if hasForeignLines {
                Button {
                    showTranslation.toggle()
                } label: {
                    Text(
                        showTranslation
                            ? L("Hide translation")
                            : Lf("Translate into %@", readerLanguage.localizedName)
                    )
                }
                .buttonStyle(
                    ModernistButtonStyle(
                        variant: .ghost, fontSize: 12, horizontalPadding: 4, verticalPadding: 2
                    )
                )
                .padding(.trailing, -4)
            }
        }
    }

    private func downloadNotice(_ pair: TranslationPair) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Notice(
                title: L("Translation needs a language download"),
                message: Lf(
                    "%1$@ and %2$@ are translated on your iPhone. The languages have to be downloaded once.",
                    pair.source.localizedName, pair.target.localizedName
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
        .padding(.top, 12)
    }
}

/// Changes whenever there is something new to translate: a new line, a line
/// that grew, or one the phone service corrected after the fact.
private struct TranslationTrigger: Equatable {
    let texts: [String]
    let target: Language
    let on: Bool
}
