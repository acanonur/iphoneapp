import SwiftUI

/// Browse ready-made patterns, build charts, and import files.
struct PatternsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var draft: SavedProject?
    @State private var newChart: ColourChart?
    @State private var showingImport = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        showingImport = true
                    } label: {
                        Label("Import a file", systemImage: "square.and.arrow.down")
                    }
                    Button {
                        newChart = ColourChart.blank(
                            name: "New chart",
                            width: 24,
                            height: 24,
                            palette: Array(store.stash.prefix(4)))
                    } label: {
                        Label("Draw a chart from scratch", systemImage: "square.grid.3x3")
                    }
                } header: {
                    Text("Create")
                } footer: {
                    Text("Import a written pattern to check its stitch counts, or an image to "
                         + "turn into a colourwork chart.")
                }

                Section {
                    ForEach(PatternKind.allCases) { kind in
                        DisclosureGroup {
                            ForEach(BuiltInPatterns.all.filter { $0.kind == kind }) { preset in
                                Button {
                                    draft = SavedProject.fromPreset(preset)
                                } label: {
                                    VStack(alignment: .leading, spacing: 3) {
                                        HStack {
                                            Text(preset.name)
                                                .foregroundStyle(.primary)
                                            Spacer()
                                            DifficultyBadge(difficulty: kind.difficulty)
                                        }
                                        Text(preset.blurb)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .multilineTextAlignment(.leading)
                                    }
                                }
                            }
                        } label: {
                            Label(kind.name, systemImage: kind.symbol)
                        }
                    }
                } header: {
                    Text("Start from a pattern")
                } footer: {
                    Text("Each one fills in the calculator with sensible defaults. Change anything "
                         + "you like — the numbers recalculate from your gauge.")
                }

                Section("Charts") {
                    if store.charts.isEmpty {
                        Text("No charts yet.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach($store.charts) { $chart in
                        NavigationLink {
                            ChartWorkspace(chart: $chart)
                        } label: {
                            HStack(spacing: 12) {
                                ChartGridView(chart: chart, cellWidth: 4, showGridLines: false)
                                    .frame(width: 72, alignment: .leading)
                                    .clipped()
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(chart.name)
                                    Text("\(chart.width) × \(chart.height), \(chart.palette.count) colours")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .onDelete { store.charts.remove(atOffsets: $0) }
                }
            }
            .navigationTitle("Patterns")
            .sheet(item: $draft) { project in
                NavigationStack {
                    ProjectEditorView(project: project, existingID: nil)
                        .environmentObject(store)
                }
            }
            .sheet(item: $newChart) { chart in
                NavigationStack {
                    NewChartSheet(chart: chart)
                        .environmentObject(store)
                }
            }
            .sheet(isPresented: $showingImport) {
                ImportView()
                    .environmentObject(store)
            }
        }
    }
}

/// Edit a chart and see what it means for the knitting.
struct ChartWorkspace: View {
    @EnvironmentObject private var store: AppStore
    @Binding var chart: ColourChart
    @State private var showingReview = false

    var body: some View {
        ChartEditorView(chart: $chart, gauge: store.lastGauge)
            .navigationTitle(chart.name)
            .knitInlineTitle()
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Picker("Worked", selection: $chart.working) {
                            ForEach(ChartWorking.allCases) { working in
                                Text(working.name).tag(working)
                            }
                        }
                        Button {
                            showingReview = true
                        } label: {
                            Label("Check the chart", systemImage: "checkmark.seal")
                        }
                        ShareLink(item: chart.writtenInstructions().joined(separator: "\n")) {
                            Label("Share the rows", systemImage: "square.and.arrow.up")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $showingReview) {
                NavigationStack {
                    List {
                        Section("At your gauge") {
                            ForEach(chart.reviewNotes(gauge: store.lastGauge), id: \.self) { note in
                                Text(note)
                            }
                        }
                        Section("Colour amounts") {
                            ForEach(chart.colourShares().sorted { $0.key < $1.key }, id: \.key) { entry in
                                let yarn = chart.palette[min(entry.key, chart.palette.count - 1)]
                                HStack {
                                    YarnSwatch(yarn: yarn, size: 22, label: chart.letter(for: entry.key))
                                    Text(yarn.displayName)
                                    Spacer()
                                    Text("\(Int(entry.value * 100))%")
                                        .foregroundStyle(.secondary)
                                        .monospacedDigit()
                                }
                            }
                        }
                    }
                    .navigationTitle("Chart check")
                    .knitInlineTitle()
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { showingReview = false }
                        }
                    }
                }
            }
    }
}

/// Name and size a brand-new chart before drawing it.
struct NewChartSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State var chart: ColourChart
    @State private var width = 24
    @State private var height = 24

    var body: some View {
        Form {
            Section("Chart") {
                TextField("Name", text: $chart.name)
                Stepper("Width: \(width) sts", value: $width, in: 2 ... 200)
                Stepper("Height: \(height) rows", value: $height, in: 2 ... 300)
                Picker("Worked", selection: $chart.working) {
                    ForEach(ChartWorking.allCases) { working in
                        Text(working.name).tag(working)
                    }
                }
            }
            Section {
                Text(String(
                    format: "At your gauge that is %.1f cm wide and %.1f cm tall.",
                    store.lastGauge.width(forStitches: Double(width)),
                    store.lastGauge.length(forRows: Double(height))))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("New chart")
        .knitInlineTitle()
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Create") {
                    var made = chart
                    made.resize(width: width, height: height)
                    store.addChart(made)
                    dismiss()
                }
            }
        }
    }
}
