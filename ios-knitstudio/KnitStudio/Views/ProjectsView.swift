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

struct ProjectDetailView: View {
    @EnvironmentObject private var store: AppStore
    @Binding var project: SavedProject
    @State private var tab = 0
    @State private var editing = false

    var body: some View {
        VStack(spacing: 0) {
            Picker("View", selection: $tab) {
                Text("Preview").tag(0)
                Text("Plan").tag(1)
                Text("Shopping").tag(2)
                Text("Counter").tag(3)
                if project.chart != nil { Text("Chart").tag(4) }
            }
            .pickerStyle(.segmented)
            .padding()

            switch tab {
            case 0: ProjectPreviewView(project: project)
            case 1: ProjectPlanView(project: project)
            case 2: ShoppingListDetailView(project: project)
            case 3: RowCounterView(project: $project)
            default:
                if project.chart != nil {
                    ChartEditorView(
                        chart: Binding(
                            get: { project.chart ?? ColourChart.blank(palette: store.stash) },
                            set: { project.chart = $0 }),
                        gauge: project.gauge)
                }
            }
        }
        .navigationTitle(project.name)
        .knitInlineTitle()
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Edit") { editing = true }
            }
        }
        .sheet(isPresented: $editing) {
            NavigationStack {
                ProjectEditorView(project: project, existingID: project.id)
                    .environmentObject(store)
            }
            .knitSheetFrame()
        }
    }
}

// MARK: - Plan

struct ProjectPlanView: View {
    @EnvironmentObject private var store: AppStore
    let project: SavedProject

    private var plan: ProjectPlan { project.plan(units: store.units) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                FactGrid(facts: plan.facts)

                ForEach(plan.warnings, id: \.self) { warning in
                    NoteBox(kind: .warning, text: warning)
                }

                yarnSummary

                ForEach(plan.sections) { section in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(section.name)
                                .font(.headline)
                            Spacer()
                            if section.totalRows > 0 {
                                Text("\(section.totalRows) rows")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        if let detail = section.detail {
                            Text(detail)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        ForEach(section.steps) { step in
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: step.isMilestone ? "flag.fill" : "circle.fill")
                                    .font(.system(size: step.isMilestone ? 10 : 5))
                                    .foregroundStyle(step.isMilestone ? Color.accentColor : .secondary)
                                    .frame(width: 14)
                                    .padding(.top, 6)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(step.text)
                                        .fixedSize(horizontal: false, vertical: true)
                                    if let count = step.stitchCount {
                                        Text("\(count) sts")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .monospacedDigit()
                                    }
                                }
                            }
                        }
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.knitSecondaryBackground, in: RoundedRectangle(cornerRadius: 14))
                }

                ForEach(plan.notes, id: \.self) { note in
                    NoteBox(kind: .note, text: note)
                }

                let techniques = TechniqueLibrary.recommended(
                    for: project.kind, structure: project.structure)
                if !techniques.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Techniques this uses")
                            .font(.headline)
                        ForEach(techniques) { technique in
                            NavigationLink {
                                TechniqueDetailView(technique: technique)
                            } label: {
                                HStack {
                                    Text(technique.name)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.caption)
                                        .foregroundStyle(.tertiary)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.knitSecondaryBackground, in: RoundedRectangle(cornerRadius: 14))
                }

                ShareLink(item: plan.plainText(units: store.units)) {
                    Label("Share the pattern", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.bordered)
            }
            .padding()
        }
    }

    private var yarnSummary: some View {
        let metres = plan.metres()
        return VStack(alignment: .leading, spacing: 6) {
            Text("Yarn needed")
                .font(.headline)
            Text(String(format: "%.0f m of %@ across %.0f stitches",
                        metres, project.structure.name.lowercased(), plan.totalStitches))
                .font(.subheadline)
            Text("Estimated from your gauge, not from a table — a tighter swatch means more yarn.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.knitSecondaryBackground, in: RoundedRectangle(cornerRadius: 14))
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
        VStack(spacing: 24) {
            Spacer()

            Text("\(project.rowsCompleted)")
                .font(.system(size: 84, weight: .bold, design: .rounded))
                .monospacedDigit()
                .contentTransition(.numericText())

            Text("rows worked of \(plan.totalRows)")
                .foregroundStyle(.secondary)

            if let position {
                VStack(spacing: 4) {
                    Text(position.section.name)
                        .font(.headline)
                    Text("row \(position.rowInSection) of \(position.section.totalRows)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(Color.knitSecondaryBackground, in: RoundedRectangle(cornerRadius: 14))
            }

            ProgressView(
                value: Double(project.rowsCompleted),
                total: Double(max(1, plan.totalRows)))
                .padding(.horizontal, 40)

            HStack(spacing: 30) {
                Button {
                    project.rowsCompleted = max(0, project.rowsCompleted - 1)
                } label: {
                    Image(systemName: "minus")
                        .font(.title2)
                        .frame(width: 64, height: 64)
                }
                .buttonStyle(.bordered)
                .clipShape(Circle())

                Button {
                    project.rowsCompleted += 1
                } label: {
                    Image(systemName: "plus")
                        .font(.largeTitle)
                        .frame(width: 96, height: 96)
                }
                .buttonStyle(.borderedProminent)
                .clipShape(Circle())
            }

            Button("Reset", role: .destructive) { project.rowsCompleted = 0 }
                .font(.caption)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}
