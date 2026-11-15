import SwiftUI

/// The ledger. What is happening now at the top, the six things the secretary
/// can be asked to do in the middle, every task ever asked for below, and one
/// fixed primary action at the foot.
struct HomeView: View {
    @Environment(SecretaryViewModel.self) private var model

    var openBrief: (TaskKind) -> Void
    var openTask: (SecretaryTask) -> Void
    var openTranslator: () -> Void
    var openSettings: () -> Void

    /// The six cells of the "New task" grid, in the design's order.
    private let tiles: [TaskKind] = [.call, .letter, .message, .form, .followup]

    @State private var isSearching = false

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar {
                HStack {
                    BrandWordmark()
                    Spacer()
                    HStack(spacing: 2) {
                        IconButton(
                            glyph: .languages,
                            accessibilityLabel: L("Live translator"),
                            action: openTranslator
                        )
                        IconButton(
                            glyph: .sliders,
                            accessibilityLabel: L("Settings"),
                            action: openSettings
                        )
                    }
                    .padding(.trailing, -8)
                }
            }

            ScrollView {
                VStack(spacing: 0) {
                    connectionBlock
                    nowBlock
                    newTaskGrid
                    tasksHeading
                    taskList
                    Color.clear.frame(height: 24)
                }
            }
            .refreshable { await model.refresh() }
            // The ledger catches up whenever the user lands back here; polling
            // only runs while something is actually in flight.
            .task { await model.refresh() }

            FooterBar {
                Button { openBrief(.call) } label: {
                    ButtonLabel(title: L("Brief Yaver"), icon: .arrowRight)
                }
                .buttonStyle(
                    ModernistButtonStyle(variant: .primary, block: true, height: 56, fontSize: 16)
                )
            }
        }
    }

    // MARK: - The server

    /// Says so, plainly and at the top, when the app has no server to talk to —
    /// with the two things that fix it one tap away.
    @ViewBuilder
    private var connectionBlock: some View {
        switch model.server.status {
        case .connected, .unknown:
            if model.server.isConnected, model.server.isOutdated {
                connectionPanel(
                    title: L("Your server needs an update."),
                    message: L("It still works, but live transcripts and call answering need the newer server software."),
                    showsSearch: false
                )
            }
        case .checking:
            if model.tasks.isEmpty {
                HStack(spacing: Modernist.Space.s2) {
                    PulsingDot(size: 10)
                    Text(L("Looking for your server…"))
                        .typeStyle(.small)
                        .foregroundStyle(Modernist.Neutral.s700)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Modernist.gutter)
                .padding(.top, 14)
            }
        case let .unreachable(problem):
            connectionPanel(title: problem.title, message: problem.advice, showsSearch: true)
        case .needsKey:
            connectionPanel(
                title: L("This server needs an access key."),
                message: L("On your computer, look at the server’s window and scan the code it shows with the iPhone’s Camera."),
                showsSearch: false
            )
        case .wrongKey:
            connectionPanel(
                title: L("The server did not accept the access key."),
                message: L("Scan the code the server shows again, with the iPhone’s Camera."),
                showsSearch: false
            )
        }
    }

    private func connectionPanel(title: String, message: String, showsSearch: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Notice(title: title, message: message, tone: .accent)
            VStack(spacing: Modernist.Space.s2) {
                if showsSearch {
                    Button {
                        isSearching = true
                        Task {
                            await model.refresh()
                            isSearching = false
                        }
                    } label: {
                        ButtonLabel(
                            title: isSearching ? L("Searching…") : L("Find automatically"),
                            icon: .search,
                            iconSize: 16
                        )
                    }
                    .buttonStyle(ModernistButtonStyle(variant: .secondary, block: true, height: 44))
                    .disabled(isSearching)
                }
                Button(action: openSettings) {
                    ButtonLabel(title: L("Server settings"), icon: .chevronRight, iconSize: 16)
                }
                .buttonStyle(ModernistButtonStyle(variant: .secondary, block: true, height: 44))
            }
        }
        .padding(.horizontal, Modernist.gutter)
        .padding(.top, 14)
    }

    // MARK: - Now

    /// What the secretary is doing this second, or what is waiting on the user.
    private var nowBlock: some View {
        let active = model.activeTasks
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: Modernist.Space.s2) {
                    Kicker(text: L("Now"))
                    if !active.isEmpty { PulsingDot(size: 10) }
                    Spacer()
                    if model.server.isConnected, model.server.isSimulated {
                        Tag(title: L("Simulation"), variant: .outline)
                    }
                }
                Text(headline(active))
                    .typeStyle(.headline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                subline(active)
            }
            .padding(.horizontal, Modernist.gutter)
            .padding(.top, 18)
            .padding(.bottom, 16)
            Rule()
        }
    }

    private func headline(_ active: [SecretaryTask]) -> String {
        switch active.count {
        case 0: return L("Nothing in progress")
        case 1: return L("1 task in progress")
        case let count: return Lf("%d tasks in progress", count)
        }
    }

    @ViewBuilder
    private func subline(_ active: [SecretaryTask]) -> some View {
        if let first = active.first {
            // The clock keeps running while the task does.
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                Text(
                    "\(first.status.label) · \(first.phoneNumber ?? first.kindLabel) · "
                        + DateFormatting.clock(first.elapsedSeconds)
                )
                .typeStyle(TypeStyle(size: 13, weight: .regular, lineHeight: 1.4, tabularNumbers: true))
                .foregroundStyle(Modernist.Neutral.s700)
            }
        } else {
            Text(
                "\(Lf("%d completed", model.completedCount)) · \(Lf("%d waiting for you", model.waitingCount))"
            )
            .typeStyle(TypeStyle(size: 13, weight: .regular, lineHeight: 1.4, tabularNumbers: true))
            .foregroundStyle(Modernist.Neutral.s700)
        }
    }

    // MARK: - New task

    /// Two columns of equal cells, the grid's own rules left visible.
    private var newTaskGrid: some View {
        VStack(alignment: .leading, spacing: 0) {
            Kicker(text: L("New task"))
                .padding(.horizontal, Modernist.gutter)
                .padding(.top, 16)

            VStack(spacing: 0) {
                Hairline()
                ForEach(0 ..< 3, id: \.self) { row in
                    HStack(spacing: 0) {
                        VHairline()
                        gridCell(at: row * 2)
                        VHairline()
                        gridCell(at: row * 2 + 1)
                        VHairline()
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    Hairline()
                }
            }
            .padding(.horizontal, Modernist.gutter)
            .padding(.top, 10)
        }
    }

    @ViewBuilder
    private func gridCell(at index: Int) -> some View {
        if index < tiles.count {
            let kind = tiles[index]
            gridTile(
                glyph: kind.glyph,
                title: kind.tileLabel,
                // The phone call is the primary of the six, so it carries the accent.
                tint: kind == .call ? Modernist.accent : Modernist.text
            ) { openBrief(kind) }
        } else {
            gridTile(glyph: .languages, title: L("Live translator"), tint: Modernist.text) {
                openTranslator()
            }
        }
    }

    private func gridTile(
        glyph: Lucide,
        title: String,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                Icon(glyph: glyph, size: 20)
                Spacer(minLength: Modernist.Space.s2)
                Text(title)
                    .typeStyle(.tile)
                    .multilineTextAlignment(.leading)
            }
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: 86, alignment: .topLeading)
            .foregroundStyle(tint)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - The ledger

    private var tasksHeading: some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Kicker(text: L("Tasks"))
                Spacer()
                Text("\(model.tasks.count)")
                    .typeStyle(
                        TypeStyle(size: 12, weight: .regular, lineHeight: 1.4, tabularNumbers: true)
                    )
                    .foregroundStyle(Modernist.Neutral.s700)
            }
            .padding(.horizontal, Modernist.gutter)
            .padding(.top, 26)
            .padding(.bottom, 10)
            Rule()
        }
    }

    @ViewBuilder
    private var taskList: some View {
        if let error = model.errorMessage {
            Text(error)
                .typeStyle(.small)
                .foregroundStyle(Modernist.Accent.s700)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Modernist.gutter)
                .padding(.vertical, 14)
            Hairline()
        }
        if model.tasks.isEmpty {
            Text(L("Nothing yet. Brief Yaver and it appears here."))
                .typeStyle(.small)
                .foregroundStyle(Modernist.Neutral.s700)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Modernist.gutter)
                .padding(.vertical, 14)
        } else {
            ForEach(model.tasks) { task in
                TaskRow(task: task, isNew: model.isWaiting(task)) { openTask(task) }
            }
        }
    }
}

/// One line of the ledger: what kind of task, when, what it was, where it got to.
private struct TaskRow: View {
    let task: SecretaryTask
    /// Handed back and not opened yet — marked, so it is found at a glance.
    var isNew = false
    var action: () -> Void

    /// The tag says where the task stands in a word or two: the reason for a
    /// call that failed, "Message taken" for one that was answered.
    private var tagTitle: String {
        if task.status == .failed || (task.isInbound && task.status == .completed) {
            return task.verdict
        }
        return task.status.label
    }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 7) {
                        HStack(spacing: 10) {
                            if isNew {
                                Rectangle()
                                    .fill(Modernist.accent)
                                    .frame(width: 8, height: 8)
                                    .accessibilityLabel(L("New"))
                            }
                            if task.isInbound {
                                Icon(glyph: .phoneIncoming, size: 12)
                            }
                            Text(task.kindLabel.displayUppercased)
                            Text(task.whenLabel.displayUppercased)
                        }
                        .typeStyle(
                            TypeStyle(
                                size: 11, weight: .regular, lineHeight: 1.3,
                                tracking: 0.06, tabularNumbers: true
                            )
                        )
                        .foregroundStyle(Modernist.Neutral.s700)

                        Text(task.title)
                            .typeStyle(.rowTitle)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        HStack(spacing: 10) {
                            Tag(title: tagTitle, variant: task.status.tagVariant)
                            if !task.metaLabel.isEmpty {
                                Text(task.metaLabel)
                                    .typeStyle(
                                        TypeStyle(
                                            size: 12, weight: .regular,
                                            lineHeight: 1.4, tabularNumbers: true
                                        )
                                    )
                                    .foregroundStyle(Modernist.Neutral.s700)
                                    .lineLimit(1)
                            }
                        }
                    }
                    Icon(glyph: .chevronRight, size: 18)
                        .foregroundStyle(Modernist.Neutral.s600)
                }
                .padding(.horizontal, Modernist.gutter)
                .padding(.vertical, 14)
                .contentShape(Rectangle())
                Hairline()
            }
        }
        .buttonStyle(.plain)
    }
}
