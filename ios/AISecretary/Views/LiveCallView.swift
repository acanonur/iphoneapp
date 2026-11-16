import SwiftUI

/// The call as it happens: how far along it is, what it was asked to do, and
/// the conversation filling in line by line — each line with its translation.
/// The product's key moment, so the rail, the brief and the transcript all sit
/// on the same grid.
struct LiveCallView: View {
    @Environment(SecretaryViewModel.self) private var model
    @Environment(LiveTranslator.self) private var translator

    let taskID: String
    let readerLanguage: Language
    var goHome: () -> Void
    var openReport: () -> Void

    @State private var confirmingHangUp = false
    @State private var isHangingUp = false

    private var railLabels: [String] {
        [L("Queued"), L("Dialing"), L("On the call"), L("Report")]
    }

    private var task: SecretaryTask? { model.task(withID: taskID) }

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar {
                HStack {
                    BackButton(title: L("Home"), action: goHome)
                    Spacer()
                    elapsedClock
                }
            }

            ScrollViewReader { proxy in
                ScrollView {
                    if let task {
                        VStack(alignment: .leading, spacing: 0) {
                            statusBlock(task)
                            if task.status.isActive, !model.server.isConnected {
                                // The clock would keep running over a dead line.
                                Notice(
                                    title: L("The connection to your server is lost."),
                                    message: L("The call itself may still be going on. What you see here stops updating until the server is back."),
                                    tone: .accent
                                )
                                .padding(.top, 14)
                            }
                            if task.simulated {
                                Notice(
                                    title: L("Simulated call"),
                                    message: L("No real phone call is being made. This shows what a call looks like; real calls need a phone service on your server.")
                                )
                                .padding(.top, 14)
                            }
                            briefBlock(task)
                            transcriptBlock(task)
                            Color.clear.frame(height: 1).id("end")
                        }
                        .padding(.horizontal, Modernist.gutter)
                    } else {
                        Text(L("This task is no longer on the server."))
                            .typeStyle(.body)
                            .foregroundStyle(Modernist.Neutral.s700)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, Modernist.gutter)
                            .padding(.top, 22)
                    }
                }
                // Keep the newest line in view while the call is live — also
                // when it grows as it is spoken, and when its translation
                // arrives and makes the row taller. The call is watched, not
                // touched.
                .onChange(of: task?.lines.count ?? 0) {
                    withAnimation { proxy.scrollTo("end", anchor: .bottom) }
                }
                .onChange(of: task?.lines.last?.text) {
                    proxy.scrollTo("end", anchor: .bottom)
                }
                .onChange(of: translator.results.count) {
                    if task?.status.isActive == true { proxy.scrollTo("end", anchor: .bottom) }
                }
            }

            if let task {
                FooterBar {
                    if task.status.isActive {
                        HStack(spacing: Modernist.Space.s2) {
                            Button {
                                confirmingHangUp = true
                            } label: {
                                ButtonLabel(title: L("Hang up"), icon: .close, iconSize: 16)
                            }
                            .buttonStyle(
                                ModernistButtonStyle(
                                    variant: .secondary, height: 56, fontSize: 15,
                                    foreground: Modernist.Accent.s700
                                )
                            )
                            .disabled(isHangingUp)

                            Button(action: goHome) {
                                ButtonLabel(title: L("Continue in the background"), icon: .chevronRight)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.75)
                            }
                            .buttonStyle(
                                ModernistButtonStyle(
                                    variant: .secondary, block: true, height: 56, fontSize: 15
                                )
                            )
                        }
                    } else {
                        Button(action: openReport) {
                            ButtonLabel(title: L("Open the report"), icon: .arrowRight)
                        }
                        .buttonStyle(
                            ModernistButtonStyle(
                                variant: .primary, block: true, height: 56, fontSize: 16
                            )
                        )
                    }
                }
            }
        }
        // A call is watched, not touched: keep the screen on while it runs.
        .keepsScreenAwake(task?.status.isActive == true)
        .confirmationDialog(
            L("End this call now?"),
            isPresented: $confirmingHangUp,
            titleVisibility: .visible
        ) {
            Button(L("Hang up"), role: .destructive) { hangUp() }
            Button(L("Keep the call going"), role: .cancel) {}
        }
    }

    private func hangUp() {
        guard let task, !isHangingUp else { return }
        isHangingUp = true
        Task {
            await model.endCall(task)
            isHangingUp = false
        }
    }

    // MARK: - Header

    @ViewBuilder
    private var elapsedClock: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            Text(DateFormatting.clock(task?.elapsedSeconds ?? 0))
                .typeStyle(
                    TypeStyle(size: 18, weight: .extrabold, lineHeight: 1.2, tabularNumbers: true)
                )
        }
    }

    // MARK: - Status

    private func statusBlock(_ task: SecretaryTask) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                Kicker(
                    text: "\(task.kindLabel) · \(task.phoneNumber ?? "—")",
                    tabularNumbers: true
                )
                .padding(.bottom, 12)

                HStack(spacing: 14) {
                    Text(statusWord(task))
                        .typeStyle(.displayTight)
                        .opticalHang(-0.058, size: 40)
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    if task.status.isActive { PulsingDot(size: 14) }
                }

                // A call that was answered for the user starts connected: there
                // is no queue and no dialling to show.
                if !task.isInbound {
                    rail(task)
                        .padding(.top, 22)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 22)
            .padding(.bottom, 18)
            Rule()
        }
    }

    private func statusWord(_ task: SecretaryTask) -> String {
        if task.status == .failed || task.status == .completed { return task.verdict }
        if task.isInbound { return L("Answering…") }
        return task.status.label
    }

    /// Four cells, filled up to where the call has got to.
    private func rail(_ task: SecretaryTask) -> some View {
        let reached = task.status.railIndex
        return HStack(spacing: 4) {
            ForEach(Array(railLabels.enumerated()), id: \.offset) { index, label in
                VStack(alignment: .leading, spacing: 7) {
                    Rectangle()
                        .fill(index <= reached ? Modernist.accent : Modernist.Neutral.s300)
                        .frame(height: 4)
                    Text(label.displayUppercased)
                        .typeStyle(.kickerRailLabel)
                        .foregroundStyle(
                            index <= reached ? Modernist.text : Modernist.Neutral.s700
                        )
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    // MARK: - Brief

    @ViewBuilder
    private func briefBlock(_ task: SecretaryTask) -> some View {
        if !task.isInbound {
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline) {
                        Kicker(text: L("Brief"))
                        Spacer()
                        Text(task.language.localizedName)
                            .typeStyle(.captionSmall)
                            .foregroundStyle(Modernist.Neutral.s700)
                    }
                    Text(task.goal)
                        .typeStyle(.bodyTight)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.vertical, 14)
                Hairline()
            }
        }
    }

    // MARK: - Transcript

    private func transcriptBlock(_ task: SecretaryTask) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            TranscriptSection(
                task: task,
                readerLanguage: readerLanguage,
                title: L("Live transcript"),
                emptyText: waitingText(task),
                note: L("A written record only. The audio is not kept.")
            )

            Text(
                task.status.isActive
                    ? L("Yaver is working on it — this updates by itself.")
                    : L("The call has ended.")
            )
            .typeStyle(.caption)
            .foregroundStyle(Modernist.Neutral.s700)
            .padding(.top, 12)
        }
        .padding(.top, 14)
        .padding(.bottom, 20)
    }

    private func waitingText(_ task: SecretaryTask) -> String {
        switch task.status {
        case .queued: return L("Getting ready…")
        case .dialing: return L("Ringing…")
        case .inProgress: return L("Waiting for the first words…")
        default: return L("Nothing was said on this call.")
        }
    }
}
