import SwiftUI

/// Three steps before the first task: what the secretary does and the promises
/// it keeps, the two languages, and the name it says on the user's behalf.
struct OnboardingView: View {
    @Binding var userName: String
    @Binding var reportLanguage: Language
    @Binding var callLanguage: Language
    var onFinish: () -> Void

    @State private var step = 0

    private let promises = [
        "Introduces itself as an AI at the start of every call.",
        "Keeps a written transcript. Audio is never stored.",
        "Calls only when you ask. One request, one call.",
    ]

    var body: some View {
        VStack(spacing: 0) {
            header
            progressCells
            ScrollView {
                stepContent
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            footer
        }
        .padding(.horizontal, Modernist.gutter)
    }

    // MARK: - Chrome

    private var header: some View {
        VStack(spacing: 0) {
            HStack {
                Wordmark()
                Spacer()
                Kicker(
                    text: "Step \(step + 1) of 3",
                    color: Modernist.Neutral.s700,
                    tabularNumbers: true
                )
            }
            .frame(height: Modernist.headerHeight)
            Rule()
        }
    }

    /// One cell per step, filled as the user moves through them.
    private var progressCells: some View {
        HStack(spacing: 4) {
            ForEach(0 ..< 3, id: \.self) { index in
                Rectangle()
                    .fill(index <= step ? Modernist.accent : Modernist.Neutral.s300)
                    .frame(height: 4)
            }
        }
        .padding(.top, 12)
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0: welcomeStep
        case 1: languagesStep
        default: nameStep
        }
    }

    // MARK: - Step 1 — what it is

    private var welcomeStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Phone calls, made for you.")
                    .typeStyle(.display)
                    .opticalHang(-0.058, size: 40)
                    .padding(.bottom, 20)
                Text(
                    "Describe what you need and give a number. Your secretary calls in German, English or Turkish, handles the conversation and reports back in your language."
                )
                .typeStyle(.bodyLarge)
                .foregroundStyle(Modernist.Neutral.s800)
                .frame(maxWidth: 320, alignment: .leading)
            }
            .padding(.top, 44)
            .padding(.bottom, 26)

            VStack(spacing: 0) {
                Rule()
                ForEach(promises, id: \.self) { promise in
                    HStack(alignment: .top, spacing: 14) {
                        Rectangle()
                            .fill(Modernist.accent)
                            .frame(width: 10, height: 10)
                            .padding(.top, 6)
                        Text(promise)
                            .typeStyle(.bodyTight)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.vertical, 14)
                    Hairline()
                }
            }
        }
    }

    // MARK: - Step 2 — the two languages

    private var languagesStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Your languages")
                .typeStyle(.title)
                .opticalHang(-0.05, size: 32)
                .padding(.bottom, 10)
            Text("Both can be changed for any single task.")
                .typeStyle(.body)
                .foregroundStyle(Modernist.Neutral.s700)
                .padding(.bottom, 30)

            Field(label: "Reports are written in") {
                languagePicker($reportLanguage)
            }
            .padding(.bottom, 26)

            Field(label: "Calls are usually in") {
                languagePicker($callLanguage)
            }
        }
        .padding(.top, 40)
    }

    private func languagePicker(_ selection: Binding<Language>) -> some View {
        SegmentedControl(
            values: Language.allCases,
            selection: selection,
            padding: EdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12)
        ) { language, _ in
            Text(language.displayName)
                .typeStyle(TypeStyle(size: 14, weight: .regular, lineHeight: 1.2))
        }
    }

    // MARK: - Step 3 — the name said on the call

    private var nameStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Your name")
                .typeStyle(.title)
                .opticalHang(-0.05, size: 32)
                .padding(.bottom, 10)
            Text(
                "Said at the start of every call, so the other side knows who the secretary represents."
            )
            .typeStyle(.body)
            .foregroundStyle(Modernist.Neutral.s700)
            .padding(.bottom, 26)

            Field(label: "Name") {
                DSTextField(
                    placeholder: "",
                    text: $userName,
                    minHeight: 48,
                    fontSize: 17,
                    textContentType: .name
                )
            }

            VStack(alignment: .leading, spacing: 0) {
                Rule()
                    .padding(.bottom, 14)
                Kicker(text: "Required disclosure")
                Text("“\(Disclosure.line(.en, name: userName))”")
                    .typeStyle(.quote)
                    .padding(.vertical, 10)
                Text(
                    "Spoken in the call language as the first sentence of every call. This cannot be turned off."
                )
                .typeStyle(.smallTight)
                .foregroundStyle(Modernist.Neutral.s700)
            }
            .padding(.top, 30)
        }
        .padding(.top, 40)
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(spacing: 0) {
            Rule()
            HStack(spacing: Modernist.Space.s2) {
                if step > 0 {
                    Button {
                        step = max(0, step - 1)
                    } label: {
                        Icon(glyph: .chevronLeft, size: 20)
                            .frame(width: 52, height: 52)
                    }
                    .buttonStyle(
                        ModernistButtonStyle(
                            variant: .secondary,
                            horizontalPadding: 0,
                            verticalPadding: 0
                        )
                    )
                    .accessibilityLabel("Back")
                }

                Button {
                    if step < 2 { step += 1 } else { onFinish() }
                } label: {
                    ButtonLabel(title: step == 2 ? "Start" : "Continue", icon: .arrowRight)
                }
                .buttonStyle(
                    ModernistButtonStyle(variant: .primary, block: true, height: 52, fontSize: 15)
                )
            }
            .padding(.top, 12)
        }
    }
}
