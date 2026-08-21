import SwiftUI

/// Draws a colourwork chart. Cells use the real stitch proportions when a
/// gauge is supplied, so the chart on screen looks like the knitted fabric
/// rather than a square grid.
struct ChartGridView: View {
    let chart: ColourChart
    var gauge: Gauge?
    var cellWidth: CGFloat = 16
    var showGridLines: Bool = true
    var highlightRow: Int?
    var onPaint: ((Int, Int) -> Void)?

    private var cellHeight: CGFloat {
        guard let gauge, gauge.stitchWidth > 0 else { return cellWidth }
        let ratio = gauge.rowHeight / gauge.stitchWidth
        return max(4, cellWidth * ratio)
    }

    private var canvasSize: CGSize {
        CGSize(
            width: cellWidth * CGFloat(chart.width),
            height: cellHeight * CGFloat(chart.height))
    }

    var body: some View {
        Canvas { context, _ in
            for y in 0 ..< chart.height {
                // Chart row 0 is the bottom row, drawn last from the top.
                let drawY = CGFloat(chart.height - 1 - y) * cellHeight
                for x in 0 ..< chart.width {
                    let index = chart.colourIndex(x: x, y: y)
                    let rect = CGRect(
                        x: CGFloat(x) * cellWidth,
                        y: drawY,
                        width: cellWidth,
                        height: cellHeight)
                    let yarn = chart.palette[min(index, chart.palette.count - 1)]
                    context.fill(Path(rect), with: .color(yarn.colour))
                }
                if let highlightRow, highlightRow == y {
                    let rect = CGRect(
                        x: 0, y: drawY, width: canvasSize.width, height: cellHeight)
                    context.stroke(Path(rect), with: .color(.accentColor), lineWidth: 2)
                }
            }

            if showGridLines, cellWidth >= 8 {
                var path = Path()
                for x in 0 ... chart.width {
                    let px = CGFloat(x) * cellWidth
                    path.move(to: CGPoint(x: px, y: 0))
                    path.addLine(to: CGPoint(x: px, y: canvasSize.height))
                }
                for y in 0 ... chart.height {
                    let py = CGFloat(y) * cellHeight
                    path.move(to: CGPoint(x: 0, y: py))
                    path.addLine(to: CGPoint(x: canvasSize.width, y: py))
                }
                context.stroke(path, with: .color(.primary.opacity(0.15)), lineWidth: 0.5)

                // Heavier line every ten stitches and rows, as printed charts do.
                var major = Path()
                for x in stride(from: 0, through: chart.width, by: 10) {
                    let px = CGFloat(x) * cellWidth
                    major.move(to: CGPoint(x: px, y: 0))
                    major.addLine(to: CGPoint(x: px, y: canvasSize.height))
                }
                for y in stride(from: 0, through: chart.height, by: 10) {
                    let py = CGFloat(chart.height - y) * cellHeight
                    major.move(to: CGPoint(x: 0, y: py))
                    major.addLine(to: CGPoint(x: canvasSize.width, y: py))
                }
                context.stroke(major, with: .color(.primary.opacity(0.35)), lineWidth: 1)
            }
        }
        .frame(width: canvasSize.width, height: canvasSize.height)
        .contentShape(Rectangle())
        .gesture(paintGesture)
    }

    private var paintGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard let onPaint else { return }
                let x = Int(value.location.x / cellWidth)
                let drawnY = Int(value.location.y / cellHeight)
                let y = chart.height - 1 - drawnY
                guard x >= 0, x < chart.width, y >= 0, y < chart.height else { return }
                onPaint(x, y)
            }
    }
}

/// Chart plus its legend and the numbers a knitter needs before casting on.
struct ChartPreview: View {
    let chart: ColourChart
    var gauge: Gauge?
    var cellWidth: CGFloat = 16

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ScrollView([.horizontal, .vertical]) {
                ChartGridView(chart: chart, gauge: gauge, cellWidth: cellWidth)
                    .padding(4)
            }
            .frame(maxHeight: 320)
            .background(Color.knitSecondaryBackground, in: RoundedRectangle(cornerRadius: 12))

            HStack(spacing: 14) {
                ForEach(Array(chart.palette.indices), id: \.self) { index in
                    let yarn = chart.palette[index]
                    HStack(spacing: 6) {
                        YarnSwatch(yarn: yarn, size: 22, label: chart.letter(for: index))
                        Text(yarn.colourName.isEmpty ? yarn.name : yarn.colourName)
                            .font(.caption)
                            .lineLimit(1)
                    }
                }
            }

            HStack(spacing: 16) {
                Label("\(chart.width) × \(chart.height)", systemImage: "grid")
                Label("\(chart.palette.count) colours", systemImage: "paintpalette")
                Label("float \(chart.longestFloat())", systemImage: "arrow.left.and.right")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }
}

/// Paint a chart cell by cell.
struct ChartEditorView: View {
    @Binding var chart: ColourChart
    var gauge: Gauge?

    @State private var selectedColour = 1
    @State private var cellWidth: CGFloat = 18
    @State private var undoStack: [[Int]] = []
    @State private var showingInstructions = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollView([.horizontal, .vertical]) {
                ChartGridView(
                    chart: chart,
                    gauge: gauge,
                    cellWidth: cellWidth,
                    onPaint: paint)
                    .padding(12)
            }
            .background(Color.knitGroupedBackground)

            Divider()

            VStack(spacing: 12) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(Array(chart.palette.indices), id: \.self) { index in
                            Button {
                                selectedColour = index
                            } label: {
                                YarnSwatch(
                                    yarn: chart.palette[index],
                                    size: 38,
                                    label: chart.letter(for: index))
                                    .overlay(
                                        Circle()
                                            .strokeBorder(
                                                selectedColour == index ? Color.accentColor : .clear,
                                                lineWidth: 3))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal)
                }

                HStack(spacing: 12) {
                    Button {
                        undo()
                    } label: {
                        Label("Undo", systemImage: "arrow.uturn.backward")
                    }
                    .disabled(undoStack.isEmpty)

                    Button {
                        snapshot()
                        chart.mirrorHorizontally()
                    } label: {
                        Label("Mirror", systemImage: "arrow.left.and.right.righttriangle.left.righttriangle.right")
                    }

                    Button {
                        snapshot()
                        chart.flipVertically()
                    } label: {
                        Label("Flip", systemImage: "arrow.up.and.down")
                    }

                    Button {
                        showingInstructions = true
                    } label: {
                        Label("Rows", systemImage: "list.number")
                    }
                }
                .labelStyle(.iconOnly)
                .buttonStyle(.bordered)

                HStack {
                    Image(systemName: "minus.magnifyingglass")
                    Slider(value: $cellWidth, in: 8 ... 34)
                    Image(systemName: "plus.magnifyingglass")
                }
                .padding(.horizontal)
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .padding(.vertical, 12)
            .background(.bar)
        }
        .sheet(isPresented: $showingInstructions) {
            NavigationStack {
                List(Array(chart.writtenInstructions().enumerated()), id: \.offset) { _, line in
                    Text(line)
                        .font(.system(.subheadline, design: .monospaced))
                }
                .navigationTitle("Row by row")
                .knitInlineTitle()
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { showingInstructions = false }
                    }
                }
            }
            .knitSheetFrame(width: 520, height: 600)
        }
    }

    private func paint(x: Int, y: Int) {
        guard chart.colourIndex(x: x, y: y) != selectedColour else { return }
        if undoStack.count > 40 { undoStack.removeFirst() }
        snapshot()
        chart.setColourIndex(selectedColour, x: x, y: y)
    }

    private func snapshot() {
        undoStack.append(chart.cells)
    }

    private func undo() {
        guard let previous = undoStack.popLast() else { return }
        chart.cells = previous
    }
}
