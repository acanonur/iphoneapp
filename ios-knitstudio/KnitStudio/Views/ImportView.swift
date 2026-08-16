import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// Bring outside patterns in: a written pattern to check, or an image to turn
/// into a colourwork chart.
struct ImportView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss

    @State private var mode = 0
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Mode", selection: $mode) {
                    Text("Image → chart").tag(0)
                    Text("Written pattern").tag(1)
                }
                .pickerStyle(.segmented)
                .padding()

                if mode == 0 {
                    ImageImportPane(errorMessage: $errorMessage)
                } else {
                    TextImportPane(errorMessage: $errorMessage)
                }
            }
            .navigationTitle("Import")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .alert(
                "Could not import",
                isPresented: Binding(
                    get: { errorMessage != nil },
                    set: { if !$0 { errorMessage = nil } })
            ) {
                Button("OK", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }
}

// MARK: - Image to chart

struct ImageImportPane: View {
    @EnvironmentObject private var store: AppStore
    @Binding var errorMessage: String?

    @State private var photoItem: PhotosPickerItem?
    @State private var sourceImage: UIImage?
    @State private var chart: ColourChart?
    @State private var showingFileImporter = false

    @State private var stitches = 40.0
    @State private var colourCount = 4.0
    @State private var dither = false
    @State private var snapToStash = true
    @State private var working: ChartWorking = .inTheRound

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 12) {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label("Photos", systemImage: "photo")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    Button {
                        showingFileImporter = true
                    } label: {
                        Label("Files", systemImage: "folder")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }

                if let sourceImage {
                    HStack(alignment: .top, spacing: 14) {
                        Image(uiImage: sourceImage)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 110, height: 110)
                            .clipShape(RoundedRectangle(cornerRadius: 10))

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Chart size")
                                .font(.subheadline.weight(.medium))
                            Text("\(Int(stitches)) sts wide"
                                 + (chart.map { " × \($0.height) rows" } ?? ""))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Slider(value: $stitches, in: 8 ... 150, step: 1)

                            Text("\(Int(colourCount)) colours")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Slider(value: $colourCount, in: 2 ... 8, step: 1)
                        }
                    }

                    Toggle("Dither (keeps gradients)", isOn: $dither)
                    Toggle("Snap colours to my stash", isOn: $snapToStash)
                        .disabled(store.stash.isEmpty)
                    Picker("Worked", selection: $working) {
                        ForEach(ChartWorking.allCases) { option in
                            Text(option.name).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if let chart {
                    ChartPreview(chart: chart, gauge: store.lastGauge, cellWidth: 10)

                    ForEach(chart.reviewNotes(gauge: store.lastGauge), id: \.self) { note in
                        NoteBox(kind: .note, text: note)
                    }

                    Button {
                        store.addChart(chart)
                    } label: {
                        Label("Save to my charts", systemImage: "square.and.arrow.down")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                } else if sourceImage == nil {
                    EmptyStateView(
                        symbol: "photo.on.rectangle.angled",
                        title: "Turn a picture into knitting",
                        message: "Pick an image and it becomes a colourwork chart, sampled with "
                            + "real stitch proportions so the knitted result is not squashed.")
                }
            }
            .padding()
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else {
                    errorMessage = "That image could not be read."
                    return
                }
                sourceImage = image
                rebuild()
            }
        }
        .onChange(of: stitches) { _, _ in rebuild() }
        .onChange(of: colourCount) { _, _ in rebuild() }
        .onChange(of: dither) { _, _ in rebuild() }
        .onChange(of: snapToStash) { _, _ in rebuild() }
        .onChange(of: working) { _, _ in rebuild() }
        .fileImporter(
            isPresented: $showingFileImporter,
            allowedContentTypes: PatternImporter.imageTypes,
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                do {
                    sourceImage = try PatternImporter.image(from: url)
                    rebuild()
                } catch {
                    errorMessage = error.localizedDescription
                }
            case .failure(let error):
                errorMessage = error.localizedDescription
            }
        }
    }

    private func rebuild() {
        guard let sourceImage else { return }
        let options = ImageChartConverter.Options(
            stitches: Int(stitches),
            colourCount: Int(colourCount),
            gauge: store.lastGauge,
            working: working,
            yarnWeight: YarnWeight.matching(gauge: store.lastGauge),
            stash: snapToStash ? store.stash : [],
            dither: dither)
        chart = ImageChartConverter.convert(image: sourceImage, options: options)
    }
}

// MARK: - Written pattern

struct TextImportPane: View {
    @EnvironmentObject private var store: AppStore
    @Binding var errorMessage: String?

    @State private var rawText = ""
    @State private var parsed: ParsedPattern?
    @State private var showingFileImporter = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Button {
                    showingFileImporter = true
                } label: {
                    Label("Choose a PDF or text file", systemImage: "doc.text")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Text("Or paste the pattern")
                    .font(.subheadline.weight(.medium))
                TextEditor(text: $rawText)
                    .frame(height: 140)
                    .font(.system(.caption, design: .monospaced))
                    .padding(6)
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))

                Button("Check it") {
                    parsed = WrittenPatternParser.parse(rawText)
                }
                .buttonStyle(.borderedProminent)
                .disabled(rawText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                if let parsed {
                    resultView(parsed)
                } else {
                    NoteBox(
                        kind: .note,
                        text: "The importer reads a written pattern row by row and works out "
                            + "where the stitch counts stop adding up — which is how you find a "
                            + "typo in a pattern, or in your own transcription of one.")
                }
            }
            .padding()
        }
        .fileImporter(
            isPresented: $showingFileImporter,
            allowedContentTypes: PatternImporter.textTypes,
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                do {
                    rawText = try PatternImporter.text(from: url)
                    parsed = WrittenPatternParser.parse(rawText)
                } catch {
                    errorMessage = error.localizedDescription
                }
            case .failure(let error):
                errorMessage = error.localizedDescription
            }
        }
    }

    @ViewBuilder
    private func resultView(_ pattern: ParsedPattern) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if let gauge = pattern.gauge {
                HStack {
                    Text("Gauge found: \(gauge.describe(in: store.units))")
                        .font(.subheadline)
                    Spacer()
                    Button("Use it") { store.lastGauge = gauge }
                        .font(.caption)
                        .buttonStyle(.bordered)
                }
            }
            if let castOn = pattern.castOnStitches {
                Text("Cast on \(castOn) sts")
                    .font(.subheadline)
            }

            ForEach(pattern.issues, id: \.self) { issue in
                NoteBox(kind: .warning, text: issue)
            }

            if !pattern.rows.isEmpty {
                Text("\(pattern.verifiedRowCount) of \(pattern.rows.count) rows check out")
                    .font(.headline)

                ForEach(pattern.rows.prefix(60)) { row in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(row.label)
                                .font(.caption.weight(.semibold))
                            if let side = row.side {
                                Text(side)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let ending = row.endingStitches {
                                Text("\(ending) sts")
                                    .font(.caption)
                                    .monospacedDigit()
                                    .foregroundStyle(row.issues.isEmpty ? .secondary : .orange)
                            }
                        }
                        Text(row.text)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                        ForEach(row.issues, id: \.self) { issue in
                            Label(issue, systemImage: "exclamationmark.triangle")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                        }
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        Color(.secondarySystemBackground),
                        in: RoundedRectangle(cornerRadius: 10))
                }
            }

            if !pattern.unknownTerms.isEmpty {
                NoteBox(
                    kind: .note,
                    text: "Not recognised: \(pattern.unknownTerms.prefix(15).joined(separator: ", ")). "
                        + "Rows using them were still counted, minus those instructions.")
            }
        }
    }
}
