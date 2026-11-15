import SwiftUI

/// Four steps before the first task: what the secretary does and the promises
/// it keeps, the two languages, the name it says on the user's behalf, and the
/// server it works through.
struct OnboardingView: View {
    @Binding var userName: String
    @Binding var reportLanguage: Language
    @Binding var callLanguage: Language
    var onFinish: () -> Void

    @Environment(SecretaryViewModel.self) private var model

    @State private var step: Int
    @State private var isSearching = false

    private static let stepCount = 4

    init(
        userName: Binding<String>,
        reportLanguage: Binding<Language>,
        callLanguage: Binding<Language>,
        startAt step: Int = 0,
        onFinish: @escaping () -> Void
    ) {
        _userName = userName
        _reportLanguage = reportLanguage
        _callLanguage = callLanguage
        _step = State(initialValue: step)
        self.onFinish = onFinish
    }

    private var promises: [String] {
        [
            L("Says it is an AI at the start of every call."),
            L("Keeps a written transcript. The audio is not kept."),
            L("Calls only when you ask. One request, one call."),
        ]
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            progressCells
            ScrollView {
                stepContent
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Modernist.gutter)
                    .padding(.bottom, 20)
            }
            .scrollDismissesKeyboard(.interactively)
            footer
        }
    }

    // MARK: - Chrome

    private var header: some View {
        VStack(spacing: 0) {
            HStack {
                BrandWordmark()
                Spacer()
                Kicker(
                    text: Lf("Step %1$d of %2$d", step + 1, Self.stepCount),
                    color: Modernist.Neutral.s700,
                    tabularNumbers: true
                )
            }
            .frame(height: Modernist.headerHeight)
            Rule()
        }
        .padding(.horizontal, Modernist.gutter)
    }

    /// One cell per step, filled as the user moves through them.
    private var progressCells: some View {
        HStack(spacing: 4) {
            ForEach(0 ..< Self.stepCount, id: \.self) { index in
                Rectangle()
                    .fill(index <= step ? Modernist.accent : Modernist.Neutral.s300)
                    .frame(height: 4)
            }
        }
        .padding(.top, 12)
        .padding(.horizontal, Modernist.gutter)
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0: welcomeStep
        case 1: languagesStep
        case 2: nameStep
        default: connectStep
        }
    }

    // MARK: - Step 1 — what it is

    private var welcomeStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                BrandMark(height: 56)
                    .padding(.bottom, 28)
                Text(L("Phone calls, made for you."))
                    .typeStyle(.display)
                    .opticalHang(-0.058, size: 40)
                    .padding(.bottom, 20)
                Text(
                    L("Say what you need and give a number. Yaver calls in German, English or Turkish, shows you the conversation in your language as it happens, and reports back. It can answer your calls too.")
                )
                .typeStyle(.bodyLarge)
                .foregroundStyle(Modernist.Neutral.s800)
                .frame(maxWidth: 320, alignment: .leading)
            }
            .padding(.top, 32)
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
            Text(L("Your languages"))
                .typeStyle(.title)
                .opticalHang(-0.05, size: 32)
                .padding(.bottom, 10)
            Text(L("Both can be changed for any single task."))
                .typeStyle(.body)
                .foregroundStyle(Modernist.Neutral.s700)
                .padding(.bottom, 30)

            Field(label: L("Reports are written in")) {
                languagePicker($reportLanguage)
            }
            .padding(.bottom, 26)

            Field(label: L("Calls are usually in")) {
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
            Text(L("Your name"))
                .typeStyle(.title)
                .opticalHang(-0.05, size: 32)
                .padding(.bottom, 10)
            Text(
                L("Said at the start of every call, so the other side knows who Yaver is calling for.")
            )
            .typeStyle(.body)
            .foregroundStyle(Modernist.Neutral.s700)
            .padding(.bottom, 26)

            Field(label: L("Name")) {
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
                Kicker(text: L("Required disclosure"))
                Text("“\(Disclosure.line(callLanguage, name: userName))”")
                    .typeStyle(.quote)
                    .padding(.vertical, 10)
                Text(
                    L("Spoken in the call language as the first sentence of every call. This cannot be turned off.")
                )
                .typeStyle(.smallTight)
                .foregroundStyle(Modernist.Neutral.s700)
            }
            .padding(.top, 30)
        }
        .padding(.top, 40)
    }

    // MARK: - Step 4 — the server

    /// The secretary works through a small server on the user's computer. The
    /// app looks for it by itself; nobody has to type an address.
    private var connectStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(L("Your server"))
                .typeStyle(.title)
                .opticalHang(-0.05, size: 32)
                .padding(.bottom, 10)
            Text(
                L("Yaver works through a small server that runs on your computer. The app finds it on your Wi-Fi by itself.")
            )
            .typeStyle(.body)
            .foregroundStyle(Modernist.Neutral.s700)
            .padding(.bottom, 24)

            connectStatus

            VStack(alignment: .leading, spacing: 0) {
                Rule()
                    .padding(.bottom, 14)
                Kicker(text: L("If it is not found"))
                    .padding(.bottom, 10)
                ForEach(Array(connectHints.enumerated()), id: \.offset) { index, hint in
                    HStack(alignment: .top, spacing: 12) {
                        Text("\(index + 1)")
                            .typeStyle(TypeStyle(size: 14, weight: .extrabold, lineHeight: 1.4, tabularNumbers: true))
                            .foregroundStyle(Modernist.Accent.s700)
                            .frame(width: 14, alignment: .leading)
                        Text(hint)
                            .typeStyle(.smallTight)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.bottom, 8)
                }
                Text(L("You can also do this later, in Settings."))
                    .typeStyle(.captionSmall)
                    .foregroundStyle(Modernist.Neutral.s700)
                    .padding(.top, 4)
            }
            .padding(.top, 26)
        }
        .padding(.top, 40)
        .task { await search() }
    }

    private var connectHints: [String] {
        [
            L("Start the server on your computer."),
            L("Keep the iPhone on the same Wi-Fi as the computer."),
            L("Point the iPhone’s Camera at the code the server shows, or tap “Search again”."),
        ]
    }

    @ViewBuilder
    private var connectStatus: some View {
        let server = model.server
        if isSearching || server.status == .checking {
            HStack(spacing: 12) {
                PulsingDot(size: 12)
                Text(L("Looking for your server…"))
                    .typeStyle(TypeStyle(size: 17, weight: .extrabold, lineHeight: 1.3))
            }
        } else if server.isConnected {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 12) {
                    Rectangle().fill(Modernist.accent).frame(width: 12, height: 12)
                    Text(Lf("Connected to %@", server.serverName))
                        .typeStyle(TypeStyle(size: 17, weight: .extrabold, lineHeight: 1.3))
                }
                Text(
                    server.isSimulated
                        ? L("Calls are simulated for now — you can try everything, and no real phone call is made.")
                        : L("Real phone calls are switched on.")
                )
                .typeStyle(.smallTight)
                .foregroundStyle(Modernist.Neutral.s800)
            }
        } else {
            VStack(alignment: .leading, spacing: 12) {
                Text(L("No server found yet."))
                    .typeStyle(TypeStyle(size: 17, weight: .extrabold, lineHeight: 1.3))
                Button {
                    Task { await search() }
                } label: {
                    ButtonLabel(title: L("Search again"), icon: .search, iconSize: 16)
                }
                .buttonStyle(ModernistButtonStyle(variant: .secondary, block: true, height: 46))
            }
        }
    }

    private func search() async {
        guard !isSearching, !model.server.isConnected else { return }
        isSearching = true
        await model.refresh()
        isSearching = false
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
                    .accessibilityLabel(L("Back"))
                }

                Button {
                    if step < Self.stepCount - 1 { step += 1 } else { onFinish() }
                } label: {
                    ButtonLabel(
                        title: step == Self.stepCount - 1 ? L("Start") : L("Continue"),
                        icon: .arrowRight
                    )
                }
                .buttonStyle(
                    ModernistButtonStyle(variant: .primary, block: true, height: 52, fontSize: 15)
                )
            }
            .padding(.top, 12)
            .padding(.bottom, 10)
        }
        .padding(.horizontal, Modernist.gutter)
    }
}
