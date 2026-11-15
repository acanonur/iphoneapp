import SwiftUI

/// The 52pt header row that sits under the status bar on every screen, closed
/// by the system's strong 2px rule.
struct HeaderBar<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) {
            content
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(height: Modernist.headerHeight)
            Rule()
        }
        .padding(.horizontal, Modernist.gutter)
    }
}

/// The fixed action bar at the foot of a screen: a 2px rule, then the button.
/// The home indicator supplies the rest of the design's bottom margin.
struct FooterBar<Content: View>: View {
    var horizontalPadding: CGFloat = Modernist.gutter
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: 0) {
            Rule()
            content
                .padding(.horizontal, horizontalPadding)
                .padding(.vertical, 10)
        }
    }
}

/// A screen's title in the header bar.
struct Wordmark: View {
    let title: String

    var body: some View {
        Text(title)
            .typeStyle(.brand)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
    }
}

/// A back control that reads as a word rather than a chevron alone — the design
/// labels it "Home" on the call and report screens.
struct BackButton: View {
    var title: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Icon(glyph: .chevronLeft, size: 18)
                Text(title)
            }
        }
        .buttonStyle(
            ModernistButtonStyle(
                variant: .ghost,
                height: 44,
                horizontalPadding: 6,
                verticalPadding: 0,
                foreground: Modernist.text
            )
        )
        .padding(.leading, -6)
    }
}

/// One turn of a transcript: an uppercase speaker column beside the line, ruled
/// off from the next. The AI side is set in the accent.
///
/// When the line was spoken in a language the user does not read, its
/// translation is set underneath, heavier than the original: the original is
/// the record, the translation is what the user actually reads.
struct TranscriptRow: View {
    let line: TranscriptLine
    /// Who is speaking, already in the interface language.
    let speaker: String
    var translation: String?
    /// True while a translation is on its way for this line.
    var isTranslating = false

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                Text(speaker.displayUppercased)
                    .typeStyle(.kickerRailLabel)
                    .foregroundStyle(line.isAI ? Modernist.Accent.s700 : Modernist.Neutral.s700)
                    .padding(.top, 3)
                    .frame(width: 84, alignment: .leading)

                VStack(alignment: .leading, spacing: 6) {
                    Text(line.text)
                        .typeStyle(.transcript)
                        .foregroundStyle(
                            translation == nil ? Modernist.text : Modernist.Neutral.s700
                        )
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if let translation {
                        Text(translation)
                            .typeStyle(.transcriptTranslation)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.leading, 10)
                            .overlay(alignment: .leading) {
                                Rectangle().fill(Modernist.accent).frame(width: 2)
                            }
                            .accessibilityLabel(translation)
                    } else if isTranslating {
                        Text("…")
                            .typeStyle(.transcriptTranslation)
                            .foregroundStyle(Modernist.Neutral.s600)
                            .padding(.leading, 10)
                            .overlay(alignment: .leading) {
                                Rectangle().fill(Modernist.Neutral.s400).frame(width: 2)
                            }
                            .accessibilityHidden(true)
                    }
                }
            }
            .padding(.vertical, 10)
            Hairline()
        }
    }
}

/// A block opened by a kicker, with an optional note set flush right against it
/// — the pattern the transcript and report sections share.
struct SectionHeading: View {
    let title: String
    var note: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Kicker(text: title)
            if let note {
                Spacer(minLength: Modernist.Space.s2)
                Text(note)
                    .typeStyle(.captionSmall)
                    .foregroundStyle(Modernist.Neutral.s700)
                    .multilineTextAlignment(.trailing)
            }
        }
    }
}

/// A short notice set in a ruled box: something the user should know about what
/// they are looking at — that a call was simulated, that the server is away.
struct Notice: View {
    let title: String
    var message: String?
    var tone: Tone = .neutral

    enum Tone {
        case neutral, accent
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Rectangle()
                .fill(tone == .accent ? Modernist.accent : Modernist.text)
                .frame(width: 10, height: 10)
                .padding(.top, 4)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .typeStyle(TypeStyle(size: 14, weight: .extrabold, lineHeight: 1.3))
                if let message {
                    Text(message)
                        .typeStyle(.smallTight)
                        .foregroundStyle(Modernist.Neutral.s800)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(tone == .accent ? Modernist.Accent.s100 : Modernist.surface)
        .overlay {
            Rectangle().strokeBorder(
                tone == .accent ? Modernist.accent : Modernist.divider,
                lineWidth: Modernist.hairlineWidth
            )
        }
    }
}

/// Large display headings hang slightly into the left margin so the letterform,
/// not the bounding box, lines up with the text below it.
extension View {
    func opticalHang(_ em: CGFloat, size: CGFloat) -> some View {
        padding(.leading, em * size)
    }
}
