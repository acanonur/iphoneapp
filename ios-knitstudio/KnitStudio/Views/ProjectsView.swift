import SwiftUI

struct ProjectsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var newProject: SavedProject?

    var body: some View {
        NavigationStack {
            Group {
                if store.projects.isEmpty {
                    EmptyStateView(
                        symbol: "square.stack.3d.up",
                        title: "No projects yet",
                        message: "Set up a project and the app works out the cast-on, every "
                            + "shaping row, and how much yarn to buy.",
                        actionTitle: "Start one",
                        action: startBlank)
                } else {
                    List {
                        ForEach($store.projects) { $project in
                            NavigationLink {
                                ProjectDetailView(project: $project)
                            } label: {
                                ProjectRow(project: project, units: store.units)
                            }
                        }
                        .onDelete { store.delete(at: $0) }
                    }
                }
            }
            .navigationTitle("Projects")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: startBlank) { Image(systemName: "plus") }
                }
            }
            .sheet(item: $newProject) { draft in
                NavigationStack {
                    ProjectEditorView(project: draft, existingID: nil)
                        .environmentObject(store)
                }
                .knitSheetFrame()
            }
        }
    }

    private func startBlank() {
        newProject = SavedProject(
            name: "New project",
            kind: .hat,
            gauge: store.lastGauge,
            allocations: ColourAllocation.single(
                store.stash.first ?? BuiltInPatterns.palette(weight: .light)[0]))
    }
}

struct ProjectRow: View {
    let project: SavedProject
    let units: UnitSystem

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: project.kind.symbol)
                .font(.title3)
                .frame(width: 34, height: 34)
                .background(Color.accentColor.opacity(0.15), in: RoundedRectangle(cornerRadius: 9))

            VStack(alignment: .leading, spacing: 2) {
                Text(project.name)
                    .font(.body.weight(.medium))
                Text("\(project.kind.name) · \(project.gauge.describe(in: units))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            ForEach(Array(project.effectiveAllocations.prefix(4))) { allocation in
                Circle()
                    .fill(allocation.yarn.colour)
                    .overlay(Circle().strokeBorder(Color.primary.opacity(0.2), lineWidth: 0.5))
                    .frame(width: 14, height: 14)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Detail

/// The 1c Project screen: a deep clay header carrying the name and the three
/// numbers you check most, with the tab pill floated across the seam onto the
/// cream body below.
struct ProjectDetailView: View {
    @EnvironmentObject private var store: AppStore
    @Binding var project: SavedProject
    @State private var tab = 1
    @State private var editing = false
    @Environment(\.dismiss) private var dismiss

    private var plan: ProjectPlan { project.plan(units: store.units) }

    private var tabs: [String] {
        var names = ["Preview", "Plan", "Shop", "Counter"]
        if project.chart != nil { names.append("Chart") }
        return names
    }

    var body: some View {
        VStack(spacing: 0) {
            OrganicHeader(tone: Organic.headerClay, bottomInset: 30) {
                OrganicHeaderBar(backLabel: "Projects", tint: Organic.clay.s100) {
                    dismiss()
                } action: {
                    Button("Edit") { editing = true }
                        .font(KnitType.body(18, .semibold))
                        .foregroundStyle(Organic.clay.s100)
                        .buttonStyle(.plain)
                }

                Text(project.name)
                    .font(KnitType.display(36))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 18)

                HStack(spacing: 10) {
                    OrganicStatTile(label: "Cast on", value: castOn)
                    OrganicStatTile(label: "Rows", value: "\(plan.totalRows)")
                    OrganicStatTile(label: "Yarn", value: yarn)
                }
                .padding(.top, 16)
            }

            OrganicSegmentedControl(options: tabs, selection: $tab)

            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Organic.bg)
        .knitHideNavigationBar()
        .sheet(isPresented: $editing) {
            NavigationStack {
                ProjectEditorView(project: project, existingID: project.id)
                    .environmentObject(store)
            }
            .knitSheetFrame()
        }
    }

    @ViewBuilder
    private var content: some View {
        switch tabs[min(tab, tabs.count - 1)] {
        case "Preview": ProjectPreviewView(project: project)
        case "Plan": ProjectPlanView(project: project)
        case "Shop": ShoppingListDetailView(project: project)
        case "Counter": RowCounterView(project: $project)
        default:
            ChartEditorView(
                chart: Binding(
                    get: { project.chart ?? ColourChart.blank(palette: store.stash) },
                    set: { project.chart = $0 }),
                gauge: project.gauge)
        }
    }

    private var castOn: String {
        plan.fact("Cast on") ?? plan.facts.first?.value ?? "—"
    }

    private var yarn: String {
        plan.fact("Yarn") ?? String(format: "%.0f m", plan.metres())
    }
}


// MARK: - Plan

/// The plan as a vertical timeline. Each section is a numbered node on a rail,
/// which suits knitting better than a stack of cards: the work is strictly
/// sequential and what you want to know is where you are in it.
struct ProjectPlanView: View {
    @EnvironmentObject private var store: AppStore
    let project: SavedProject

    private var plan: ProjectPlan { project.plan(units: store.units) }

    /// The section the row counter has reached, so the rail can show it.
    private var currentIndex: Int {
        var running = 0
        for (index, section) in plan.sections.enumerated() {
            running += section.totalRows
            if project.rowsCompleted < running { return index }
        }
        return plan.sections.count
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(plan.warnings, id: \.self) { warning in
                    NoteBox(kind: .warning, text: warning)
                        .padding(.bottom, 12)
                }

                ForEach(Array(plan.sections.enumerated()), id: \.offset) { index, section in
                    OrganicTimelineRow(
                        number: index + 1,
                        title: section.name,
                        meta: section.totalRows > 0 ? "\(section.totalRows) rounds" : "",
                        text: section.detail ?? section.steps.first?.text ?? "",
                        stitches: section.steps.last?.stitchCount.map { "\($0) sts" },
                        state: index < currentIndex ? .done
                            : (index == currentIndex ? .current : .todo),
                        isLast: index == plan.sections.count - 1)
                }

                yarnSummary
                    .padding(.top, 4)
            }
            .padding(.horizontal, 20)
            .padding(.top, 22)
            .padding(.bottom, 24)
            .knitReadableWidth()
        }
    }

    private var yarnSummary: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Yarn")
                .font(KnitType.display(20))
                .foregroundStyle(Organic.clay.s800)
            Text(String(format: "%.0f m across %.0f stitches", plan.metres(), plan.totalStitches))
                .font(KnitType.body(18))
                .foregroundStyle(Organic.clay.s900)
            Text("Worked out from your own gauge, not a table — a tighter swatch means more yarn.")
                .font(KnitType.body(16))
                .foregroundStyle(Organic.neutral.s700)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(Organic.clay.s100, in: RoundedRectangle(cornerRadius: Organic.radiusLg))
    }
}


// MARK: - Shopping

struct ShoppingListDetailView: View {
    @EnvironmentObject private var store: AppStore
    let project: SavedProject

    private var list: ShoppingList { project.shoppingList(units: store.units) }

    var body: some View {
        List {
            Section("Yarn") {
                ForEach(list.lines) { line in
                    HStack(spacing: 12) {
                        YarnSwatch(yarn: line.yarn, size: 34)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(line.yarn.displayName)
                                .font(.body.weight(.medium))
                            Text(line.role)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(String(format: "%.0f m ≈ %.0f g needed", line.metres, line.grams))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text("\(line.balls)")
                                .font(.title2.weight(.semibold))
                                .monospacedDigit()
                            Text(line.balls == 1 ? "ball" : "balls")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }

            Section {
                LabeledContent("Total balls", value: "\(list.totalBalls)")
                LabeledContent("Total yarn", value: String(format: "%.0f m", list.totalMetres))
                LabeledContent("Total weight", value: String(format: "%.0f g", list.totalGrams))
                if let cost = list.totalCost {
                    LabeledContent("Estimated cost", value: String(format: "%.2f", cost))
                }
            } footer: {
                Text(String(
                    format: "Includes a %.0f%% margin. Buy every ball of a colour in the same dye "
                    + "lot — a second lot bought later will not match.", list.safetyMargin * 100))
            }

            Section("Needles") {
                ForEach(list.needles, id: \.self) { needle in
                    Label(needle, systemImage: "line.diagonal")
                        .labelStyle(.titleAndIcon)
                }
            }

            Section("Notions") {
                ForEach(list.notions, id: \.self) { notion in
                    Label(notion, systemImage: "checkmark.circle")
                }
            }

            Section {
                ShareLink(item: list.plainText(projectName: project.name)) {
                    Label("Share the list", systemImage: "square.and.arrow.up")
                }
            }
        }
    }
}

// MARK: - Row counter

/// The counter, 1c style: the section you are in as a sage pill, the row count
/// huge and in clay, and two circular buttons sized so they can be hit without
/// looking away from the needles.
struct RowCounterView: View {
    @EnvironmentObject private var store: AppStore
    @Binding var project: SavedProject

    private var plan: ProjectPlan { project.plan(units: store.units) }

    /// Which section the current row falls in, and how far through it.
    private var position: (section: PlanSection, rowInSection: Int)? {
        var remaining = project.rowsCompleted
        for section in plan.sections {
            let rows = section.totalRows
            if rows > 0, remaining < rows { return (section, remaining + 1) }
            remaining -= max(0, rows)
        }
        return plan.sections.last.map { ($0, max(0, $0.totalRows)) }
    }

    var body: some View {
        VStack(spacing: 18) {
            Spacer()

            if let position {
                OrganicPill(
                    text: "\(position.section.name) · row \(position.rowInSection) of \(position.section.totalRows)",
                    background: Organic.sage.s200,
                    foreground: Organic.sage.s800)
            }

            Text("\(project.rowsCompleted)")
                .font(KnitType.display(130))
                .foregroundStyle(Organic.clay.s800)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .contentTransition(.numericText())

            Text("rows worked of \(plan.totalRows)")
                .font(KnitType.body(20))
                .foregroundStyle(Organic.neutral.s700)

            HStack(spacing: 18) {
                Button {
                    project.rowsCompleted = max(0, project.rowsCompleted - 1)
                } label: {
                    LucideMinus(tint: Organic.clay.s800)
                        .frame(width: 88, height: 88)
                        .overlay(Circle().strokeBorder(Organic.clay.s800, lineWidth: 3))
                }
                .buttonStyle(.plain)

                Button {
                    project.rowsCompleted += 1
                } label: {
                    LucidePlus(tint: .white)
                        .frame(width: 132, height: 132)
                        .background(Organic.clay.s800, in: Circle())
                        .organicShadow(Organic.shadowLg)
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 10)

            Button("Reset to 0") { project.rowsCompleted = 0 }
                .font(KnitType.body(16, .semibold))
                .foregroundStyle(Organic.clay.s700)
                .buttonStyle(.plain)

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 20)
    }
}

