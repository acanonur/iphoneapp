import SwiftUI

/// What came of a task: the verdict and the summary at the top, the facts in a
/// four-cell grid, anything still on the user's plate, and the record below.
struct ReportView: View {
    @Environment(SecretaryViewModel.self) private var model
    @Environment(LiveTranslator.self) private var translator

    let taskID: String
    let reportLanguage: Language
    var goHome: () -> Void
    /// Opens another task — the new call when a failed one is tried again.
    var openTask: (SecretaryTask) -> Void = { _ in }

    @State private var isAddingReminder = false
    @State private var reminderError: String?
    @State private var isRetrying = false
    @State private var retryError: String?

    private var task: SecretaryTask? { model.task(withID: taskID) }

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar {
                HStack {
                    BackButton(title: L("Home"), action: goHome)
                    Spacer()
                    if let task, let summary = shareText(task) {
                        ShareLink(item: summary) {
                            Icon(glyph: .share, size: 20)
                                .frame(width: 36, height: 36)
                        }
                        .buttonStyle(
                            ModernistButtonStyle(
                                variant: .icon, horizontalPadding: 0, verticalPadding: 0,
                                hitSlop: 4
                            )
                        )
                        .accessibilityLabel(L("Share report"))
                        .padding(.trailing, -8)
                    }
                }
            }

            ScrollView {
                if let task {
                    VStack(alignment: .leading, spacing: 0) {
                        verdictBlock(task)
                        if task.kind == .call {
                            metaGrid(task)
                        }
                        if task.isInbound, let number = task.phoneNumber, !number.isEmpty {
                            callBackBlock(number)
                        }
                        if canRetry(task) {
                            retryBlock(task)
                        }
                        if let todo = task.todo, !todo.isEmpty {
                            todoBlock(task, todo: todo)
                        }
                        if let draft = task.result, !draft.isEmpty {
                            draftBlock(task, draft: draft)
                        }
                        if task.kind == .call {
                            transcriptBlock(task)
                        }
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

            FooterBar {
                Button(action: goHome) {
                    ButtonLabel(title: L("Done"), icon: .check)
                }
                .buttonStyle(
                    ModernistButtonStyle(variant: .primary, block: true, height: 56, fontSize: 16)
                )
            }
        }
        // Once a draft, a question or a caller's message is on screen, it is
        // no longer "waiting for you" — also when it arrives while this is open.
        .onChange(of: task?.status, initial: true) { _, _ in
            if let task { model.markSeen(task) }
        }
        // A report can still change after the call is over: a better one
        // replaces the first. Whoever opens this screen gets the latest.
        .task { await model.refresh() }
    }

    // MARK: - Verdict

    private func verdictBlock(_ task: SecretaryTask) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                Kicker(
                    text: "\(task.kindLabel) · \(task.status.label) · \(task.whenLabel)",
                    tabularNumbers: true
                )
                .padding(.bottom, 12)

                HStack(alignment: .center, spacing: 12) {
                    if succeeded(task) {
                        Rectangle()
                            .fill(Modernist.accent)
                            .frame(width: 14, height: 14)
                    }
                    Text(task.verdict)
                        .typeStyle(.titleReport)
                        .lineLimit(3)
                        .minimumScaleFactor(0.75)
                }

                // For a call that was answered, the subject says who rang.
                if task.isInbound, !task.goal.isEmpty {
                    Text(task.goal)
                        .typeStyle(TypeStyle(size: 17, weight: .extrabold, lineHeight: 1.3))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 14)
                }

                Text(explanation(task))
                    .typeStyle(.lead)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, task.isInbound && !task.goal.isEmpty ? 8 : 16)

                // A call that was cut short still has a summary; say why it ended.
                if let problem = task.problem, task.summary != nil {
                    Notice(title: problem.title, message: problem.explanation)
                        .padding(.top, 14)
                }

                if task.simulated {
                    Notice(
                        title: L("Simulated call"),
                        message: L("No real phone call was made. This is what a report looks like.")
                    )
                    .padding(.top, 14)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 22)
            .padding(.bottom, 18)
            Rule()
        }
    }

    private func succeeded(_ task: SecretaryTask) -> Bool {
        task.status == .completed && task.outcome == .achieved
    }

    /// The paragraph under the verdict: the report if there is one; otherwise
    /// why there is none, in plain words.
    private func explanation(_ task: SecretaryTask) -> String {
        if let summary = task.summary, !summary.isEmpty { return summary }
        if let problem = task.problem { return problem.explanation }
        if task.status == .failed {
            return L("The call could not be completed. Nothing was agreed.")
        }
        if task.status.isActive { return L("Yaver is still working on this.") }
        // The call is over a moment before its report is: say so, rather than
        // "there is no report".
        if task.isAwaitingReport { return L("The report is being written…") }
        if task.status == .scheduled { return L("This is on your list. Nothing else has to happen for it.") }
        return L("There is no report for this task.")
    }

    // MARK: - The facts

    private func metaGrid(_ task: SecretaryTask) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                metaCell(
                    task.isInbound ? L("Caller") : L("Number"),
                    task.phoneNumber ?? "—", tabular: true
                )
                .padding(.trailing, 12)
                VHairline()
                metaCell(L("Call language"), spokenLanguage(task))
                    .padding(.leading, 12)
            }
            Hairline()
            HStack(spacing: 0) {
                metaCell(L("Duration"), durationLabel(task), tabular: true)
                    .padding(.trailing, 12)
                VHairline()
                metaCell(L("Report in"), task.summaryLanguage.localizedName)
                    .padding(.leading, 12)
            }
            Rule()
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    /// The language the other side spoke. For a call that was answered it is
    /// worked out from what the caller said.
    private func spokenLanguage(_ task: SecretaryTask) -> String {
        guard task.isInbound else { return task.language.localizedName }
        let lines = task.transcriptLines
        guard lines.contains(where: { !$0.isAI }) else { return "—" }
        return translator.usualLanguage(in: lines, ofAI: false, expected: task.language)
            .localizedName
    }

    private func metaCell(_ label: String, _ value: String, tabular: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.displayUppercased)
                .typeStyle(.kickerSmall)
                .foregroundStyle(Modernist.Neutral.s700)
            Text(value)
                .typeStyle(
                    TypeStyle(size: 15, weight: .regular, lineHeight: 1.3, tabularNumbers: tabular)
                )
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 12)
    }

    private func durationLabel(_ task: SecretaryTask) -> String {
        guard let seconds = task.durationSeconds, seconds > 0 else { return "—" }
        return DateFormatting.clock(seconds)
    }

    // MARK: - Calling back

    /// One tap to ring the caller back from the phone's own dialler.
    @ViewBuilder
    private func callBackBlock(_ number: String) -> some View {
        let digits = number.filter { $0.isNumber || $0 == "+" }
        if let url = URL(string: "tel:\(digits)"), !digits.isEmpty {
            VStack(spacing: 0) {
                Link(destination: url) {
                    ButtonLabel(title: Lf("Call back %@", number), icon: .phone, iconSize: 16)
                }
                .buttonStyle(
                    ModernistButtonStyle(variant: .secondary, block: true, height: 48, fontSize: 15)
                )
                .padding(.vertical, 14)
                Rule()
            }
        }
    }

    // MARK: - Trying again

    /// A call the secretary placed that did not get through — and that the
    /// user did not end themselves — is worth another go.
    private func canRetry(_ task: SecretaryTask) -> Bool {
        task.kind == .call && !task.isInbound && task.status == .failed
            && task.problem != .cancelled && task.phoneNumber != nil
    }

    private func retryBlock(_ task: SecretaryTask) -> some View {
        VStack(spacing: 0) {
            Button {
                isRetrying = true
                retryError = nil
                Task {
                    defer { isRetrying = false }
                    do {
                        let again = try await model.create(
                            NewTaskRequest(
                                kind: .call,
                                goal: task.goal,
                                phoneNumber: task.phoneNumber,
                                language: task.language,
                                summaryLanguage: task.summaryLanguage,
                                userName: task.userName
                            )
                        )
                        openTask(again)
                    } catch {
                        retryError = error.localizedDescription
                    }
                }
            } label: {
                ButtonLabel(title: L("Call again"), icon: .phone, iconSize: 16)
            }
            .buttonStyle(
                ModernistButtonStyle(variant: .secondary, block: true, height: 48, fontSize: 15)
            )
            .disabled(isRetrying)
            .padding(.vertical, 14)
            if let retryError {
                Notice(title: L("That did not work."), message: retryError, tone: .accent)
                    .padding(.bottom, 14)
            }
            Rule()
        }
    }

    // MARK: - Still to do

    private func todoBlock(_ task: SecretaryTask, todo: String) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                Kicker(text: L("Still to do"))
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
                        Tag(title: L("On your list"), variant: .accent)
                    } else if task.kind != .followup, task.kind != .reminder {
                        Button {
                            isAddingReminder = true
                            reminderError = nil
                            Task {
                                reminderError = await model.addReminder(for: task)
                                isAddingReminder = false
                            }
                        } label: {
                            Text(L("Add to my list"))
                        }
                        .buttonStyle(ModernistButtonStyle(variant: .secondary, height: 40))
                        .disabled(isAddingReminder)
                    }
                }
                .padding(.top, 10)

                if let reminderError {
                    Notice(title: L("That did not work."), message: reminderError, tone: .accent)
                        .padding(.top, 12)
                }
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
                SectionHeading(title: draftTitle(task), note: task.language.localizedName)
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
        case .message: return L("Draft, waiting to be sent")
        case .form: return L("The form so far")
        default: return L("Written for you")
        }
    }

    // MARK: - Transcript

    private func transcriptBlock(_ task: SecretaryTask) -> some View {
        TranscriptSection(
            task: task,
            readerLanguage: reportLanguage,
            title: L("Transcript"),
            emptyText: L("Nothing was said on this call.")
        )
        .padding(.top, 14)
        .padding(.bottom, 24)
    }

    /// What the share sheet hands over: the report, not the raw transcript.
    private func shareText(_ task: SecretaryTask) -> String? {
        guard let summary = task.summary else { return nil }
        var lines = ["\(task.kindLabel) · \(task.title)", "", summary]
        if let todo = task.todo, !todo.isEmpty {
            lines.append("")
            lines.append("\(L("Still to do")): \(todo)\(task.todoWhen.map { " (\($0))" } ?? "")")
        }
        if let draft = task.result, !draft.isEmpty {
            lines.append("")
            lines.append(draft)
        }
        return lines.joined(separator: "\n")
    }
}
