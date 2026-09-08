import SwiftUI

/// The call as it happens: how far along it is, what it was asked to do, and
/// the transcript filling in line by line. The product's key moment, so the
/// rail, the brief and the transcript all sit on the same grid.
struct LiveCallView: View {
    @Environment(SecretaryViewModel.self) private var model

    let taskID: String
    var goHome: () -> Void
    var openReport: () -> Void

    private let railLabels = ["Queued", "Dialing", "On the call", "Report"]

    private var task: SecretaryTask? { model.task(withID: taskID) }

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar {
                HStack {
                    BackButton(title: "Home", action: goHome)
                    Spacer()
                    elapsedClock
                }
            }

            ScrollView {
                if let task {
                    VStack(alignment: .leading, spacing: 0) {
                        statusBlock(task)
                        briefBlock(task)
                        transcriptBlock(task)
                    }
                    .padding(.horizontal, Modernist.gutter)
                }
            }

            if let task {
                FooterBar {
                    if task.status.isActive {
                        Button(action: goHome) {
                            ButtonLabel(title: "Continue in the background", icon: .chevronRight)
                        }
                        .buttonStyle(
                            ModernistButtonStyle(
                                variant: .secondary, block: true, height: 56, fontSize: 15
                            )
                        )
                    } else {
                        Button(action: openReport) {
                            ButtonLabel(title: "Open the report", icon: .arrowRight)
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
                    text: "Phone call · \(task.phoneNumber ?? "—") · \(task.language.displayName)",
                    tabularNumbers: true
                )
                .padding(.bottom, 12)

                HStack(spacing: 14) {
                    Text(task.status.label)
                        .typeStyle(.displayTight)
                        .opticalHang(-0.058, size: 40)
                    if task.status.isActive { PulsingDot(size: 14) }
                }

                rail(task)
                    .padding(.top, 22)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 22)
            .padding(.bottom, 18)
            Rule()
        }
    }

    /// Four cells, filled up to where the call has got to.
    private func rail(_ task: SecretaryTask) -> some View {
        let reached = task.status.railIndex
        return HStack(spacing: 4) {
            ForEach(Array(railLabels.enumerated()), id: \.element) { index, label in
                VStack(alignment: .leading, spacing: 7) {
                    Rectangle()
                        .fill(index <= reached ? Modernist.accent : Modernist.Neutral.s300)
                        .frame(height: 4)
                    Text(label.uppercased())
                        .typeStyle(.kickerRailLabel)
                        .foregroundStyle(
                            index <= reached ? Modernist.text : Modernist.Neutral.s700
                        )
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    // MARK: - Brief

    private func briefBlock(_ task: SecretaryTask) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Kicker(text: "Brief")
                Text(task.goal)
                    .typeStyle(.bodyTight)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 14)
            Hairline()
        }
    }

    // MARK: - Transcript

    private func transcriptBlock(_ task: SecretaryTask) -> some View {
        let lines = task.transcriptLines
        return VStack(alignment: .leading, spacing: 0) {
            SectionHeading(
                title: "Live transcript",
                note: "Written record only. No audio is stored."
            )

            if lines.isEmpty {
                Text(task.status == .dialing ? "Ringing…" : "Waiting for the line…")
                    .typeStyle(.transcript)
                    .foregroundStyle(Modernist.Neutral.s700)
                    .padding(.top, 12)
            } else {
                ForEach(lines) { line in
                    TranscriptRow(line: line)
                }
            }

            Text(
                task.status.isActive
                    ? "Your secretary is working on it — this updates automatically."
                    : "The call has ended. The report is ready."
            )
            .typeStyle(.caption)
            .foregroundStyle(Modernist.Neutral.s700)
            .padding(.top, 12)
        }
        .padding(.top, 14)
        .padding(.bottom, 20)
    }
}
