import SwiftUI

/// What came of a task: the verdict and the summary at the top, the facts in a
/// four-cell grid, anything still on the user's plate, and the record below.
struct ReportView: View {
    @Environment(SecretaryViewModel.self) private var model

    let taskID: String
    let reportLanguage: Language
    var goHome: () -> Void

    @State private var isAddingReminder = false

    private var task: SecretaryTask? { model.task(withID: taskID) }

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar {
                HStack {
                    BackButton(title: "Home", action: goHome)
                    Spacer()
                    if let task, let summary = shareText(task) {
                        ShareLink(item: summary) {
                            Icon(glyph: .share, size: 20)
                                .frame(width: 36, height: 36)
                        }
                        .buttonStyle(
                            ModernistButtonStyle(
                                variant: .icon, horizontalPadding: 0, verticalPadding: 0
                            )
                        )
                        .accessibilityLabel("Share report")
                        .padding(.trailing, -8)
                    }
                }
            }

            ScrollView {
                if let task {
                    VStack(alignment: .leading, spacing: 0) {
                        verdictBlock(task)
                        metaGrid(task)
                        if let todo = task.todo, !todo.isEmpty {
                            todoBlock(task, todo: todo)
                        }
                        if let draft = task.result, !draft.isEmpty {
                            draftBlock(task, draft: draft)
                        }
                        transcriptBlock(task)
                    }
                    .padding(.horizontal, Modernist.gutter)
                }
            }

            FooterBar {
                Button(action: goHome) {
                    ButtonLabel(title: "Done", icon: .check)
                }
                .buttonStyle(
                    ModernistButtonStyle(variant: .primary, block: true, height: 56, fontSize: 16)
                )
            }
        }
    }

    // MARK: - Verdict

    private func verdictBlock(_ task: SecretaryTask) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                Kicker(
                    text: "\(task.kind.label) · \(task.status.label) · \(task.whenLabel)",
                    tabularNumbers: true
                )
                .padding(.bottom, 12)

                HStack(alignment: .center, spacing: 12) {
                    if task.outcome == .achieved {
                        Rectangle()
                            .fill(Modernist.accent)
                            .frame(width: 14, height: 14)
                    }
                    Text(task.outcome?.label ?? task.status.label)
                        .typeStyle(.titleReport)
                }

                Text(task.summary ?? "The secretary is still working on this task.")
                    .typeStyle(.lead)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 16)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 22)
            .padding(.bottom, 18)
            Rule()
        }
    }

    // MARK: - The facts

    private func metaGrid(_ task: SecretaryTask) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                metaCell("Number", task.phoneNumber ?? "—", tabular: true)
                    .padding(.trailing, 12)
                VHairline()
                metaCell("Call language", task.kind == .call ? task.language.displayName : "—")
                    .padding(.leading, 12)
            }
            Hairline()
            HStack(spacing: 0) {
                metaCell("Duration", durationLabel(task), tabular: true)
                    .padding(.trailing, 12)
                VHairline()
                metaCell("Report in", reportLanguage.displayName)
                    .padding(.leading, 12)
            }
            Rule()
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    private func metaCell(_ label: String, _ value: String, tabular: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .typeStyle(.kickerSmall)
                .foregroundStyle(Modernist.Neutral.s700)
            Text(value)
                .typeStyle(
                    TypeStyle(size: 15, weight: .regular, lineHeight: 1.3, tabularNumbers: tabular)
                )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 12)
    }

    private func durationLabel(_ task: SecretaryTask) -> String {
        guard let seconds = task.durationSeconds, seconds > 0 else { return "—" }
        return DateFormatting.clock(seconds)
    }

    // MARK: - Still to do

    private func todoBlock(_ task: SecretaryTask, todo: String) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                Kicker(text: "Still to do")
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(todo)
                            .typeStyle(TypeStyle(size: 15, weight: .semibold, lineHeight: 1.3))
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if let when = task.todoWhen, !when.isEmpty {
                            Text(when)
                                .typeStyle(
                                    TypeStyle(
                                        size: 12, weight: .regular,
                                        lineHeight: 1.4, tabularNumbers: true
                                    )
                                )
                                .foregroundStyle(Modernist.Neutral.s700)
                        }
                    }

                    if model.hasReminder(for: task) {
                        Tag(title: "Reminder set", variant: .accent)
                    } else {
                        Button {
                            isAddingReminder = true
                            Task {
                                await model.addReminder(for: task)
                                isAddingReminder = false
                            }
                        } label: {
                            Text("Add reminder")
                        }
                        .buttonStyle(ModernistButtonStyle(variant: .secondary, height: 40))
                        .disabled(isAddingReminder)
                    }
                }
                .padding(.top, 10)
            }
            .padding(.vertical, 14)
            Rule()
        }
    }

    // MARK: - What the secretary wrote
    //
    // The prototype's report only ever showed call transcripts. Now that the
    // paperwork kinds produce something real — a reply, a translation, a filled
    // form — it is shown here in the same idiom, or the user could never read
    // what was written on their behalf.

    private func draftBlock(_ task: SecretaryTask, draft: String) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                SectionHeading(title: draftTitle(task), note: task.language.displayName)
                Text(draft)
                    .typeStyle(.transcript)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 10)
            }
            .padding(.vertical, 14)
            Rule()
        }
    }

    private func draftTitle(_ task: SecretaryTask) -> String {
        switch task.kind {
        case .message: return "Draft, waiting to be sent"
        case .form: return "The form so far"
        default: return "Written for you"
        }
    }

    // MARK: - Transcript

    private func transcriptBlock(_ task: SecretaryTask) -> some View {
        let lines = task.transcriptLines
        return VStack(alignment: .leading, spacing: 0) {
            SectionHeading(title: "Transcript", note: task.language.displayName)
            if lines.isEmpty {
                Text("No transcript for this type of task.")
                    .typeStyle(.small)
                    .foregroundStyle(Modernist.Neutral.s700)
                    .padding(.top, 10)
            } else {
                ForEach(lines) { line in
                    TranscriptRow(line: line)
                }
            }
        }
        .padding(.top, 14)
        .padding(.bottom, 24)
    }

    /// What the share sheet hands over: the report, not the raw transcript.
    private func shareText(_ task: SecretaryTask) -> String? {
        guard let summary = task.summary else { return nil }
        var lines = ["\(task.kind.label) · \(task.goal)", "", summary]
        if let todo = task.todo, !todo.isEmpty {
            lines.append("")
            lines.append("Still to do: \(todo)\(task.todoWhen.map { " (\($0))" } ?? "")")
        }
        if let draft = task.result, !draft.isEmpty {
            lines.append("")
            lines.append(draft)
        }
        return lines.joined(separator: "\n")
    }
}
