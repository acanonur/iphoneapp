import SwiftUI

/// Yarn stash, the gauge tool, and app settings.
struct StashView: View {
    @EnvironmentObject private var store: AppStore
    @State private var editingYarn: Yarn?

    var body: some View {
        NavigationStack {
            List {
                Section("Settings") {
                    Picker("Units", selection: $store.units) {
                        Text("Centimetres").tag(UnitSystem.metric)
                        Text("Inches").tag(UnitSystem.imperial)
                    }
                    NavigationLink {
                        GaugeToolView()
                    } label: {
                        Label("Gauge from a swatch", systemImage: "ruler")
                    }
                    LabeledContent("Working gauge", value: store.lastGauge.describe(in: store.units))
                }

                Section {
                    ForEach($store.stash) { $yarn in
                        Button {
                            editingYarn = yarn
                        } label: {
                            HStack(spacing: 12) {
                                YarnSwatch(yarn: yarn, size: 34)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(yarn.displayName)
                                        .foregroundStyle(.primary)
                                    Text(String(
                                        format: "%@ · %.0f g / %.0f m",
                                        yarn.weight.name, yarn.ballGrams, yarn.ballMetres))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                        }
                    }
                    .onDelete { store.stash.remove(atOffsets: $0) }

                    Button {
                        let yarn = Yarn(
                            name: "New yarn",
                            colourName: "",
                            hex: "8FA9BF",
                            weight: YarnWeight.matching(gauge: store.lastGauge))
                        store.stash.append(yarn)
                        editingYarn = yarn
                    } label: {
                        Label("Add a yarn", systemImage: "plus")
                    }
                } header: {
                    Text("Stash")
                } footer: {
                    Text("Ball weight and length are what turn the yarn estimate into a number of "
                         + "balls. Copy them from the band.")
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .navigationTitle("Stash")
            .sheet(item: $editingYarn) { yarn in
                NavigationStack {
                    YarnEditorView(yarn: yarn) { updated in
                        if let index = store.stash.firstIndex(where: { $0.id == updated.id }) {
                            store.stash[index] = updated
                        }
                    }
                }
                .knitSheetFrame(width: 480, height: 560)
            }
        }
    }
}

struct YarnEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @State var yarn: Yarn
    let onSave: (Yarn) -> Void

    @State private var colour: Color = .gray
    @State private var priceText = ""

    var body: some View {
        Form {
            Section("Yarn") {
                TextField("Name", text: $yarn.name)
                TextField("Colourway", text: $yarn.colourName)
                ColorPicker("Colour", selection: $colour, supportsOpacity: false)
                Picker("Weight", selection: $yarn.weight) {
                    ForEach(YarnWeight.allCases) { weight in
                        Text("\(weight.name) — \(weight.commonNames)").tag(weight)
                    }
                }
                .knitLongListPicker()
            }

            Section {
                HStack {
                    Text("Grams per ball")
                    Spacer()
                    TextField("g", value: $yarn.ballGrams, format: .number.precision(.fractionLength(0)))
                        .knitDecimalKeyboard()
                        .multilineTextAlignment(.trailing)
                        .frame(width: 80)
                }
                HStack {
                    Text("Metres per ball")
                    Spacer()
                    TextField("m", value: $yarn.ballMetres, format: .number.precision(.fractionLength(0)))
                        .knitDecimalKeyboard()
                        .multilineTextAlignment(.trailing)
                        .frame(width: 80)
                }
                HStack {
                    Text("Price per ball")
                    Spacer()
                    TextField("optional", text: $priceText)
                        .knitDecimalKeyboard()
                        .multilineTextAlignment(.trailing)
                        .frame(width: 80)
                }
            } header: {
                Text("Ball band")
            } footer: {
                Text(String(
                    format: "That is %.1f metres per gram. Typical for %@ is %.1f.",
                    yarn.metresPerGram,
                    yarn.weight.name.lowercased(),
                    yarn.weight.typicalBall.metres / yarn.weight.typicalBall.grams))
            }
        }
        .knitFormStyle()
        .navigationTitle(yarn.name)
        .knitInlineTitle()
        .onAppear {
            colour = yarn.colour
            priceText = yarn.pricePerBall.map { String(format: "%.2f", $0) } ?? ""
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    var updated = yarn
                    updated.hex = StashView.hex(from: colour)
                    updated.pricePerBall = Double(priceText.replacingOccurrences(of: ",", with: "."))
                    onSave(updated)
                    dismiss()
                }
            }
        }
    }
}

extension StashView {
    /// SwiftUI has no hex accessor, so this goes through the platform colour
    /// type — UIColor on iOS, NSColor on the Mac.
    static func hex(from colour: Color) -> String {
        colour.knitHex
    }
}

/// Turn a counted swatch into a gauge, in whatever units the knitter measured.
struct GaugeToolView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss

    @State private var stitches = 22.0
    @State private var rows = 30.0
    @State private var window = 10.0

    private var gauge: Gauge {
        Gauge.fromSwatch(
            stitches: stitches,
            rows: rows,
            overCm: store.units.toCentimetres(window))
    }

    var body: some View {
        Form {
            Section {
                HStack {
                    Text("Stitches counted")
                    Spacer()
                    TextField("sts", value: $stitches, format: .number.precision(.fractionLength(0 ... 1)))
                        .knitDecimalKeyboard()
                        .multilineTextAlignment(.trailing)
                        .frame(width: 70)
                }
                HStack {
                    Text("Rows counted")
                    Spacer()
                    TextField("rows", value: $rows, format: .number.precision(.fractionLength(0 ... 1)))
                        .knitDecimalKeyboard()
                        .multilineTextAlignment(.trailing)
                        .frame(width: 70)
                }
                HStack {
                    Text("Measured over")
                    Spacer()
                    TextField("width", value: $window, format: .number.precision(.fractionLength(0 ... 1)))
                        .knitDecimalKeyboard()
                        .multilineTextAlignment(.trailing)
                        .frame(width: 70)
                    Text(store.units.lengthLabel)
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("Your swatch")
            } footer: {
                Text("Count across the middle of a blocked swatch, including partial stitches. "
                     + "Measuring over a wider window makes the result more accurate.")
                    .fixedSize(horizontal: false, vertical: true)
            }

            Section("Result") {
                LabeledContent("Gauge", value: gauge.describe(in: store.units))
                LabeledContent("One stitch", value: store.units.formatLength(gauge.stitchWidth, decimals: 2))
                LabeledContent("One row", value: store.units.formatLength(gauge.rowHeight, decimals: 2))
                LabeledContent("Yarn per stitch", value: String(format: "%.2f cm", gauge.loopLength))
                LabeledContent("Closest yarn weight", value: YarnWeight.matching(gauge: gauge).name)
                if !gauge.looksPlausible {
                    NoteBox(
                        kind: .warning,
                        text: "These numbers are out of proportion for knitted fabric. Check the "
                            + "stitch and row counts are not swapped.")
                }
            }

            Section {
                Button("Use this as my working gauge") {
                    store.lastGauge = gauge
                    dismiss()
                }
            }
        }
        .knitFormStyle()
        .navigationTitle("Gauge")
        .knitInlineTitle()
    }
}
