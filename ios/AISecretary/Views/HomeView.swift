import SwiftUI

/// The ledger. What is happening now at the top, the six things the secretary
/// can be asked to do in the middle, every task ever asked for below, and one
/// fixed primary action at the foot.
struct HomeView: View {
    @Environment(SecretaryViewModel.self) private var model

    var openBrief: (TaskKind) -> Void
    var openTask: (SecretaryTask) -> Void
    var openTranslator: () -> Void
    var openProfile: () -> Void

    /// The six cells of the "New task" grid, in the design's order.
    private let tiles: [TaskKind] = [.call, .letter, .message, .form, .followup]

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar {
                HStack {
                    Wordmark()
                    Spacer()
                    HStack(spacing: 2) {
                        IconButton(
                            glyph: .languages,
                            accessibilityLabel: "Live translator",
                            action: openTranslator
                        )
                        IconButton(
                            glyph: .user,
                            accessibilityLabel: "Your name and languages",
                            action: openProfile
                        )
                    }
                    .padding(.trailing, -8)
                }
            }

            ScrollView {
                VStack(spacing: 0) {
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
                    ButtonLabel(title: "Brief the secretary", icon: .arrowRight)
                }
                .buttonStyle(
                    ModernistButtonStyle(variant: .primary, block: true, height: 56, fontSize: 16)
                )
            }
        }
    }

    // MARK: - Now

    /// What the secretary is doing this second, or what is waiting on the user.
    private var nowBlock: some View {
        let active = model.activeTasks
        return VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: Modernist.Space.s2) {
                    Kicker(text: "Now")
                    if !active.isEmpty { PulsingDot(size: 10) }
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
        case 0: return "Nothing in progress"
        case 1: return "1 task in progress"
        case let count: return "\(count) tasks in progress"
        }
    }

    @ViewBuilder
    private func subline(_ active: [SecretaryTask]) -> some View {
        if let first = active.first {
            // The clock keeps running while the task does.
            TimelineView(.periodic(from: .now, by: 1)) { _ in
                Text(
                    "\(first.status.label) · \(first.phoneNumber ?? first.kind.label) · "
                        + DateFormatting.clock(first.elapsedSeconds)
                )
                .typeStyle(TypeStyle(size: 13, weight: .regular, lineHeight: 1.4, tabularNumbers: true))
                .foregroundStyle(Modernist.Neutral.s700)
            }
        } else {
            Text(
                "\(model.completedCount) completed this week · \(model.waitingCount) waiting for you"
            )
            .typeStyle(TypeStyle(size: 13, weight: .regular, lineHeight: 1.4, tabularNumbers: true))
            .foregroundStyle(Modernist.Neutral.s700)
        }
    }

    // MARK: - New task

    /// Two columns of equal cells, the grid's own rules left visible.
    private var newTaskGrid: some View {
        VStack(alignment: .leading, spacing: 0) {
            Kicker(text: "New task")
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
            gridTile(glyph: .languages, title: "Live translator", tint: Modernist.text) {
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
                Kicker(text: "Tasks")
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
        if let error = model.errorMessage, model.tasks.isEmpty {
            Text(error)
                .typeStyle(.small)
                .foregroundStyle(Modernist.Accent.s700)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Modernist.gutter)
                .padding(.vertical, 14)
        } else if model.tasks.isEmpty {
            Text("Nothing yet. Brief the secretary and it appears here.")
                .typeStyle(.small)
                .foregroundStyle(Modernist.Neutral.s700)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Modernist.gutter)
                .padding(.vertical, 14)
        } else {
            ForEach(model.tasks) { task in
                TaskRow(task: task) { openTask(task) }
            }
        }
    }
}

/// One line of the ledger: what kind of task, when, what it was, where it got to.
private struct TaskRow: View {
    let task: SecretaryTask
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 7) {
                        HStack(spacing: 10) {
                            Text(task.kind.label.uppercased())
                            Text(task.whenLabel.uppercased())
                        }
                        .typeStyle(
                            TypeStyle(
                                size: 11, weight: .regular, lineHeight: 1.3,
                                tracking: 0.06, tabularNumbers: true
                            )
                        )
                        .foregroundStyle(Modernist.Neutral.s700)

                        Text(task.goal)
                            .typeStyle(.rowTitle)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        HStack(spacing: 10) {
                            Tag(title: task.status.label, variant: task.status.tagVariant)
                            if !task.metaLabel.isEmpty {
                                Text(task.metaLabel)
                                    .typeStyle(
                                        TypeStyle(
                                            size: 12, weight: .regular,
                                            lineHeight: 1.4, tabularNumbers: true
                                        )
                                    )
                                    .foregroundStyle(Modernist.Neutral.s700)
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
