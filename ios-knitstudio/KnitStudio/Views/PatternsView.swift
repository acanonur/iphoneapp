import SwiftUI

/// The 1c Patterns screen: a clay header, a row of kind filters, then a divided
/// list rather than a stack of cards. Rows are 88pt so a preset can be picked
/// without aiming, and the rule does the work a card outline used to.
struct PatternsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var draft: SavedProject?
    @State private var newChart: ColourChart?
    @State private var showingImport = false
    @State private var kindFilter: PatternKind?

    private var presets: [PatternPreset] {
        guard let kindFilter else { return BuiltInPatterns.all }
        return BuiltInPatterns.all.filter { $0.kind == kindFilter }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                OrganicHeader(tone: Organic.headerClay, topPadding: 24, bottomPadding: 28) {
                    Text("Patterns")
                        .font(KnitType.display(38))
                        .foregroundStyle(.white)
                    Text("Ready-made starting points. Pick one and the numbers come from your gauge.")
                        .font(KnitType.body(18))
                        .foregroundStyle(Organic.clay.s100)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 4)
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        OrganicChip(text: "All", selected: kindFilter == nil) { kindFilter = nil }
                        ForEach(PatternKind.allCases) { kind in
                            OrganicChip(text: kind.name, selected: kindFilter == kind) {
                                kindFilter = kind
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.top, 18)

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(presets.enumerated()), id: \.element.id) { index, preset in
                            OrganicListRow(
                                title: preset.name,
                                blurb: preset.blurb,
                                tintIndex: index
                            ) { draft = SavedProject.fromPreset(preset) }
                        }

                        sectionHeading("Stitch patterns")
                        ForEach(Array(StitchPatternLibrary.all.enumerated()), id: \.element.id) { index, pattern in
                            NavigationLink {
                                StitchPatternDetailView(pattern: pattern)
                            } label: {
                                OrganicRowLabel(
                                    title: pattern.name,
                                    blurb: pattern.summary,
                                    tintIndex: index + 1)
                            }
                            .buttonStyle(.plain)
                        }

                        sectionHeading("Charts")
                        OrganicWideButton(label: "Turn a picture into a chart") {
                            showingImport = true
                        }
                        .padding(.bottom, 6)

                        // Enumerating a Binding array does not give elements
                        // with an id, so iterate the values and take the
                        // binding by index.
                        ForEach(Array(store.charts.enumerated()), id: \.element.id) { index, chart in
                            NavigationLink {
                                ChartWorkspace(chart: $store.charts[index])
                            } label: {
                                OrganicRowLabel(
                                    title: chart.name,
                                    blurb: "\(chart.width) sts × \(chart.height) rows, \(chart.palette.count) colours",
                                    tintIndex: index + 2)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 18)
                    .padding(.bottom, 24)
                    .knitReadableWidth()
                }
            }
            .background(Organic.bg)
            .knitHideNavigationBar()
            .sheet(item: $draft) { project in
                NavigationStack {
                    ProjectEditorView(project: project, existingID: nil)
                        .environmentObject(store)
                }
                .knitSheetFrame()
            }
            .sheet(item: $newChart) { chart in
                NavigationStack {
                    NewChartSheet(chart: chart)
                        .environmentObject(store)
                }
                .knitSheetFrame(width: 480, height: 520)
            }
            .sheet(isPresented: $showingImport) {
                ImportView()
                    .environmentObject(store)
                    .knitSheetFrame(width: 640, height: 700)
            }
        }
    }

    private func sectionHeading(_ text: String) -> some View {
        Text(text)
            .font(KnitType.display(24))
            .foregroundStyle(Organic.text)
            .padding(.top, 26)
            .padding(.bottom, 10)
    }
}

/// The visual half of a list row, for the places that need a NavigationLink
/// rather than a Button. Kept in step with `OrganicListRow` by hand — there is
/// no way to hand a NavigationLink its own label from inside a Button.
struct OrganicRowLabel: View {
    var title: String
    var blurb: String
    var tintIndex: Int

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 16) {
                Circle()
                    .fill(OrganicTint.pair(tintIndex).background)
                    .frame(width: 60, height: 60)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(KnitType.body(20, .bold))
                        .foregroundStyle(Organic.text)
                    Text(blurb)
                        .font(KnitType.body(17))
                        .foregroundStyle(Organic.neutral.s700)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                LucideChevronRight(tint: Organic.clay.s800, size: 24)
            }
            .frame(minHeight: 88)
            .padding(.vertical, 16)
            .contentShape(Rectangle())

            Rectangle()
                .fill(Organic.neutral.s300)
                .frame(height: 2)
        }
    }
}


/// One stitch pattern on its own: the chart it is read from, and the fabric it
/// makes at the gauge the knitter last measured.
struct StitchPatternDetailView: View {
    @EnvironmentObject private var store: AppStore
    let pattern: StitchPattern

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if !pattern.summary.isEmpty {
                    Text(pattern.summary)
                        .font(.subheadline)
                        .fixedSize(horizontal: false, vertical: true)
                }

                StitchPatternPreview(
                    pattern: pattern,
                    palette: store.stash,
                    gauge: store.lastGauge,
                    symbolStyle: store.chartSymbolStyle)

                VStack(alignment: .leading, spacing: 10) {
                    Text("Knitted up")
                        .font(.headline)
                    FabricSimulationPane(
                        pattern: pattern,
                        palette: store.stash,
                        gauge: store.lastGauge,
                        units: store.units)
                }

                if !pattern.notes.isEmpty {
                    NoteBox(kind: .note, text: pattern.notes)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .navigationTitle(pattern.name)
        .knitInlineTitle()
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
                .knitSheetFrame(width: 520, height: 600)
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
        .knitFormStyle()
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
