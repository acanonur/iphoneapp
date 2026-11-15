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

    private var lines: [TranscriptLine] { task.transcriptLines }

    /// True when at least one line is in a language the reader does not read.
    private var hasForeignLines: Bool {
        lines.contains {
            translator.language(of: $0.text, expected: task.language) != readerLanguage
        }
    }

    private var otherSpeaker: String {
        task.isInbound ? L("Caller") : L("Other side")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            heading

            if let note {
                Text(note)
                    .typeStyle(.captionSmall)
                    .foregroundStyle(Modernist.Neutral.s700)
                    .padding(.top, 4)
            }

            if showTranslation,
               let blocked = translator.blockedPair(
                   for: lines, spokenIn: task.language, into: readerLanguage
               ) {
                downloadNotice(blocked)
            }

            if lines.isEmpty {
                Text(emptyText)
                    .typeStyle(.transcript)
                    .foregroundStyle(Modernist.Neutral.s700)
                    .padding(.top, 12)
            } else {
                ForEach(lines) { line in
                    TranscriptRow(
                        line: line,
                        speaker: line.isAI ? Brand.name : otherSpeaker,
                        translation: showTranslation
                            ? translator.translation(
                                of: line, spokenIn: task.language, into: readerLanguage
                            )
                            : nil,
                        isTranslating: showTranslation
                            && translator.isWorking(
                                on: line, spokenIn: task.language, into: readerLanguage
                            )
                    )
                }
            }
        }
        // Every time a line arrives or grows, ask for what is still missing.
        .task(id: TranslationTrigger(lines: lines, target: readerLanguage, on: showTranslation)) {
            guard showTranslation else { return }
            translator.translate(lines: lines, spokenIn: task.language, into: readerLanguage)
        }
    }

    private var heading: some View {
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
                            : Lf("Translate into %@", readerLanguage.displayName)
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
        .padding(.top, 12)
    }
}

/// Changes whenever there is something new to translate.
private struct TranslationTrigger: Equatable {
    let count: Int
    let lastLine: String
    let target: Language
    let on: Bool

    init(lines: [TranscriptLine], target: Language, on: Bool) {
        count = lines.count
        lastLine = lines.last?.text ?? ""
        self.target = target
        self.on = on
    }
}
