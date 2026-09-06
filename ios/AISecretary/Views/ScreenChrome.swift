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

/// The wordmark in the header bar.
struct Wordmark: View {
    var title = "Secretary"

    var body: some View {
        Text(title)
            .typeStyle(.brand)
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
                horizontalPadding: 6,
                verticalPadding: 4,
                foreground: Modernist.text
            )
        )
        .padding(.leading, -6)
    }
}

/// One turn of a transcript: an uppercase speaker column beside the line, ruled
/// off from the next. The AI side is set in the accent.
struct TranscriptRow: View {
    let line: TranscriptLine

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                Text(line.speaker.uppercased())
                    .typeStyle(.kickerRailLabel)
                    .foregroundStyle(line.isAI ? Modernist.Accent.s700 : Modernist.Neutral.s700)
                    .padding(.top, 3)
                    .frame(width: 84, alignment: .leading)
                Text(line.text)
                    .typeStyle(.transcript)
                    .frame(maxWidth: .infinity, alignment: .leading)
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

/// Large display headings hang slightly into the left margin so the letterform,
/// not the bounding box, lines up with the text below it.
extension View {
    func opticalHang(_ em: CGFloat, size: CGFloat) -> some View {
        padding(.leading, em * size)
    }
}
