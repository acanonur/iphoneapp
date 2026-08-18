import SwiftUI

/// The calculator form: everything that feeds a project plan.
struct ProjectEditorView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss

    @State var project: SavedProject
    /// Nil when creating; set when editing an existing project.
    var existingID: UUID?

    @State private var showingChartPicker = false
    @State private var sizePreset = "Adult M"

    private var units: UnitSystem { store.units }

    var body: some View {
        Form {
            Section("Project") {
                TextField("Name", text: $project.name)

                Picker("Type", selection: $project.kind) {
                    ForEach(PatternKind.allCases) { kind in
                        Label(kind.name, systemImage: kind.symbol).tag(kind)
                    }
                }
                Text(project.kind.blurb)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Picker("Fabric", selection: $project.structure) {
                    ForEach(FabricStructure.allCases) { structure in
                        Text(structure.name).tag(structure)
                    }
                }
                Text(project.structure.note)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            gaugeSection

            if !project.kind.relevantMeasurements.isEmpty {
                measurementsSection
            }

            optionsSection

            coloursSection

            Section {
                NavigationLink {
                    ProjectPlanView(project: project)
                } label: {
                    Label("See the plan", systemImage: "list.bullet.rectangle")
                }
            }
        }
        .navigationTitle(existingID == nil ? "New project" : "Edit")
        .knitInlineTitle()
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { save() }
                    .disabled(project.name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .sheet(isPresented: $showingChartPicker) {
            ChartPickerSheet(selection: $project.chart)
                .environmentObject(store)
        }
    }

    // MARK: - Gauge

    private var gaugeSection: some View {
        Section {
            HStack {
                Text("Stitches per \(units.gaugeWindowLabel)")
                Spacer()
                TextField("sts", value: gaugeStitchesBinding, format: .number.precision(.fractionLength(0 ... 1)))
                    .knitDecimalKeyboard()
                    .multilineTextAlignment(.trailing)
                    .frame(width: 70)
            }
            HStack {
                Text("Rows per \(units.gaugeWindowLabel)")
                Spacer()
                TextField("rows", value: gaugeRowsBinding, format: .number.precision(.fractionLength(0 ... 1)))
                    .knitDecimalKeyboard()
                    .multilineTextAlignment(.trailing)
                    .frame(width: 70)
            }

            Picker("Start from a yarn weight", selection: yarnWeightBinding) {
                ForEach(YarnWeight.allCases) { weight in
                    Text("\(weight.name) — \(weight.commonNames)").tag(weight)
                }
            }
            .knitLongListPicker()

            if !project.gauge.looksPlausible {
                NoteBox(
                    kind: .warning,
                    text: "That gauge looks unusual. Check the swatch was measured over "
                        + "\(units.gaugeWindowLabel) and that stitches and rows are the right way round.")
            }
        } header: {
            Text("Gauge")
        } footer: {
            Text("Every number in the plan comes from this. Measure a blocked swatch — "
                 + "guessing here is what makes sweaters come out the wrong size.")
        }
    }

    private var gaugeStitchesBinding: Binding<Double> {
        Binding(
            get: {
                units == .metric
                    ? project.gauge.stitchesPer10cm
                    : (project.gauge.stitchesPer10cm * 10.16 / 10)
            },
            set: { newValue in
                let per10 = units == .metric ? newValue : newValue * 10 / 10.16
                project.gauge = Gauge(
                    stitchesPer10cm: max(1, per10),
                    rowsPer10cm: project.gauge.rowsPer10cm)
                store.lastGauge = project.gauge
            })
    }

    private var gaugeRowsBinding: Binding<Double> {
        Binding(
            get: {
                units == .metric
                    ? project.gauge.rowsPer10cm
                    : (project.gauge.rowsPer10cm * 10.16 / 10)
            },
            set: { newValue in
                let per10 = units == .metric ? newValue : newValue * 10 / 10.16
                project.gauge = Gauge(
                    stitchesPer10cm: project.gauge.stitchesPer10cm,
                    rowsPer10cm: max(1, per10))
                store.lastGauge = project.gauge
            })
    }

    private var yarnWeightBinding: Binding<YarnWeight> {
        Binding(
            get: { YarnWeight.matching(gauge: project.gauge) },
            set: { project.gauge = $0.nominalGauge })
    }

    // MARK: - Measurements

    private var measurementsSection: some View {
        Section {
            Picker("Size preset", selection: $sizePreset) {
                ForEach(BodyMeasurements.sizePresets, id: \.name) { preset in
                    Text(preset.name).tag(preset.name)
                }
            }
            .onChange(of: sizePreset) { _, newValue in
                if let preset = BodyMeasurements.sizePresets.first(where: { $0.name == newValue }) {
                    project.measurements = preset.measurements
                }
            }

            ForEach(project.kind.relevantMeasurements) { field in
                LengthField(
                    label: field.label,
                    centimetres: Binding(
                        get: { field.value(in: project.measurements) },
                        set: { field.set($0, in: &project.measurements) }),
                    units: units)
            }
        } header: {
            Text("Measurements")
        } footer: {
            Text("Measure the body, not a garment. Ease is added separately below.")
        }
    }

    // MARK: - Options

    @ViewBuilder
    private var optionsSection: some View {
        Section("Fit and shaping") {
            switch project.kind {
            case .scarf, .blanket:
                LengthField(label: "Width", centimetres: $project.options.width, units: units)
                LengthField(label: "Length", centimetres: $project.options.length, units: units)
                Stepper("Garter edge: \(project.options.edgeStitches) sts",
                        value: $project.options.edgeStitches, in: 0 ... 12)

            case .cowl:
                LengthField(label: "Circumference", centimetres: $project.options.cowlCircumference, units: units)
                LengthField(label: "Height", centimetres: $project.options.cowlHeight, units: units)
                LengthField(label: "Ribbed edge", centimetres: $project.options.ribDepth, units: units, range: 0 ... 20)

            case .hat:
                Picker("Style", selection: $project.options.hatStyle) {
                    ForEach(HatStyle.allCases) { style in Text(style.name).tag(style) }
                }
                PercentField(label: "Negative ease", fraction: $project.options.ease, range: 0 ... 0.2)
                Stepper("Crown sections: \(project.options.crownSections)",
                        value: $project.options.crownSections, in: 4 ... 12, step: 2)
                LengthField(label: "Brim depth", centimetres: $project.options.ribDepth, units: units, range: 0 ... 20)

            case .raglanSweater:
                PercentField(label: "Ease at the chest", fraction: $project.options.ease, range: -0.05 ... 0.4)
                Stepper("Raglan line: \(project.options.raglanStitches) sts",
                        value: $project.options.raglanStitches, in: 1 ... 6)
                LengthField(label: "Hem rib", centimetres: $project.options.ribDepth, units: units, range: 0 ... 20)
                LengthField(label: "Cuff rib", centimetres: $project.options.cuffDepth, units: units, range: 0 ... 20)

            case .sock:
                PercentField(label: "Negative ease", fraction: $project.options.ease, range: 0 ... 0.2)
                LengthField(label: "Leg length", centimetres: $project.options.legLength, units: units, range: 2 ... 60)
                LengthField(label: "Cuff rib", centimetres: $project.options.cuffDepth, units: units, range: 0 ... 20)

            case .mitten:
                PercentField(label: "Negative ease", fraction: $project.options.ease, range: 0 ... 0.15)
                LengthField(label: "Cuff rib", centimetres: $project.options.ribDepth, units: units, range: 0 ... 20)

            case .shawl:
                LengthField(label: "Wingspan", centimetres: $project.options.wingspan, units: units, range: 40 ... 260)
                Stepper("Increases per RS row: \(project.options.increasesPerRightSideRow)",
                        value: $project.options.increasesPerRightSideRow, in: 2 ... 8, step: 2)
            }

            Stepper("Stitch repeat: multiple of \(project.options.stitchMultiple)",
                    value: $project.options.stitchMultiple, in: 1 ... 24)
            PercentField(label: "Spare yarn margin", fraction: $project.options.safetyMargin, range: 0 ... 0.5)
        }
    }

    // MARK: - Colours

    private var coloursSection: some View {
        Section {
            if let chart = project.chart {
                HStack {
                    Label(chart.name, systemImage: "square.grid.3x3.fill")
                    Spacer()
                    Text("\(chart.width)×\(chart.height)")
                        .foregroundStyle(.secondary)
                }
                Text("Colour amounts come from the chart: "
                     + chart.colourShares()
                        .sorted { $0.key < $1.key }
                        .map { "\(chart.letter(for: $0.key)) \(Int($0.value * 100))%" }
                        .joined(separator: ", "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button("Remove chart", role: .destructive) { project.chart = nil }
            } else {
                ForEach($project.allocations) { $allocation in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            YarnSwatch(yarn: allocation.yarn, size: 26)
                            Text(allocation.yarn.displayName)
                                .lineLimit(1)
                            Spacer()
                            Text("\(Int(allocation.share * 100))%")
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        if project.allocations.count > 1 {
                            Slider(value: $allocation.share, in: 0 ... 1)
                        }
                    }
                }
                .onDelete { project.allocations.remove(atOffsets: $0) }

                Menu {
                    ForEach(store.stash) { yarn in
                        Button {
                            addColour(yarn)
                        } label: {
                            Label(yarn.displayName, systemImage: "circle.fill")
                        }
                    }
                } label: {
                    Label("Add a colour from the stash", systemImage: "plus")
                }
                .disabled(store.stash.isEmpty)
            }

            Button {
                showingChartPicker = true
            } label: {
                Label(project.chart == nil ? "Attach a colourwork chart" : "Change chart",
                      systemImage: "square.grid.3x3")
            }
        } header: {
            Text("Colours")
        } footer: {
            Text(project.chart == nil
                 ? "Shares decide how the yarn estimate is split. They are normalised, so they need not add to 100."
                 : "Every stitch in the chart is counted, so the split is exact.")
        }
    }

    private func addColour(_ yarn: Yarn) {
        let index = project.allocations.count
        project.allocations.append(
            ColourAllocation(
                yarn: yarn,
                share: index == 0 ? 1.0 : 0.25,
                role: ColourAllocation.roleName(index: index)))
    }

    private func save() {
        if existingID == nil {
            store.add(project)
        } else {
            store.update(project)
        }
        dismiss()
    }
}

/// Pick one of the saved or built-in charts.
struct ChartPickerSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @Binding var selection: ColourChart?

    var body: some View {
        NavigationStack {
            List {
                if store.charts.isEmpty {
                    Text("No charts yet. Make one in the Patterns tab, or import an image.")
                        .foregroundStyle(.secondary)
                }
                ForEach(store.charts) { chart in
                    Button {
                        selection = chart
                        dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            ChartGridView(chart: chart, cellWidth: 5, showGridLines: false)
                                .frame(width: 80, alignment: .leading)
                                .clipped()
                            VStack(alignment: .leading) {
                                Text(chart.name).foregroundStyle(.primary)
                                Text("\(chart.width) × \(chart.height), \(chart.palette.count) colours")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Choose a chart")
            .knitInlineTitle()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
