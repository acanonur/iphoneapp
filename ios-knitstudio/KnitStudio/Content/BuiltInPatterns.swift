import Foundation

/// A ready-made starting point the knitter can pick instead of filling in a
/// blank form. Selecting one pre-fills the whole calculator.
struct PatternPreset: Identifiable, Equatable {
    var id: String
    var name: String
    var kind: PatternKind
    var structure: FabricStructure
    var options: ProjectOptions
    var suggestedWeight: YarnWeight
    var blurb: String
    /// Identifier of a built-in colourwork chart, when the preset uses one.
    var chartID: String?
}

enum BuiltInPatterns {

    // MARK: - Default yarn palette

    static func palette(weight: YarnWeight) -> [Yarn] {
        [
            Yarn(name: "Main", colourName: "Undyed cream", hex: "F0E9DA", weight: weight),
            Yarn(name: "Contrast", colourName: "Deep indigo", hex: "2E4272", weight: weight),
            Yarn(name: "Contrast", colourName: "Rust", hex: "B5533C", weight: weight),
            Yarn(name: "Contrast", colourName: "Moss", hex: "6B7A43", weight: weight),
            Yarn(name: "Contrast", colourName: "Charcoal", hex: "3A3A3C", weight: weight),
            Yarn(name: "Contrast", colourName: "Mustard", hex: "D6A32E", weight: weight),
        ]
    }

    // MARK: - Presets

    static let all: [PatternPreset] = [
        PatternPreset(
            id: "first-scarf",
            name: "First scarf",
            kind: .scarf,
            structure: .garter,
            options: ProjectOptions(ribDepth: 0, width: 20, length: 150, edgeStitches: 0),
            suggestedWeight: .medium,
            blurb: "Garter stitch, no shaping, no seams. The project that teaches your hands the knit stitch.",
            chartID: nil),

        PatternPreset(
            id: "seed-scarf",
            name: "Seed stitch scarf",
            kind: .scarf,
            structure: .seed,
            options: ProjectOptions(width: 25, length: 170, edgeStitches: 2, stitchMultiple: 2),
            suggestedWeight: .light,
            blurb: "Reversible, lies flat, and quietly more interesting than garter.",
            chartID: nil),

        PatternPreset(
            id: "chunky-blanket",
            name: "Chunky throw",
            kind: .blanket,
            structure: .stockinette,
            options: ProjectOptions(width: 120, length: 150, edgeStitches: 6),
            suggestedWeight: .bulky,
            blurb: "A big rectangle in bulky yarn. Fast to knit, but budget the yarn before you start.",
            chartID: nil),

        PatternPreset(
            id: "classic-beanie",
            name: "Classic beanie",
            kind: .hat,
            structure: .stockinette,
            options: ProjectOptions(ease: 0.09, hatStyle: .classic, crownSections: 8, ribDepth: 5),
            suggestedWeight: .medium,
            blurb: "Ribbed brim, plain body, eight-section crown. One skein, one evening.",
            chartID: nil),

        PatternPreset(
            id: "slouchy-hat",
            name: "Slouchy hat",
            kind: .hat,
            structure: .stockinette,
            options: ProjectOptions(ease: 0.06, hatStyle: .slouchy, crownSections: 8, ribDepth: 6),
            suggestedWeight: .light,
            blurb: "Extra length in the body so it drapes at the back.",
            chartID: nil),

        PatternPreset(
            id: "colourwork-hat",
            name: "Stranded colourwork hat",
            kind: .hat,
            structure: .strandedColourwork,
            options: ProjectOptions(ease: 0.10, hatStyle: .foldedBrim, crownSections: 8, ribDepth: 4),
            suggestedWeight: .light,
            blurb: "A folded brim and a charted band around the head. Warmer than plain knitting.",
            chartID: "fair-isle-band"),

        PatternPreset(
            id: "rib-cowl",
            name: "2×2 rib cowl",
            kind: .cowl,
            structure: .ribbing,
            options: ProjectOptions(ribDepth: 0, cowlCircumference: 62, cowlHeight: 28, stitchMultiple: 4),
            suggestedWeight: .medium,
            blurb: "Squashy, reversible and completely mindless. Good television knitting.",
            chartID: nil),

        PatternPreset(
            id: "raglan-pullover",
            name: "Top-down raglan pullover",
            kind: .raglanSweater,
            structure: .stockinette,
            options: ProjectOptions(ease: 0.08, ribDepth: 6, cuffDepth: 6, raglanStitches: 2),
            suggestedWeight: .light,
            blurb: "Seamless, tried on as you go, and the sleeves are fitted rather than balloons.",
            chartID: nil),

        PatternPreset(
            id: "cabled-sweater",
            name: "Cabled pullover",
            kind: .raglanSweater,
            structure: .cables,
            options: ProjectOptions(ease: 0.10, ribDepth: 7, cuffDepth: 6, raglanStitches: 2),
            suggestedWeight: .medium,
            blurb: "Same construction, cabled fabric. Cables pull in, so it needs more yarn and more ease.",
            chartID: nil),

        PatternPreset(
            id: "vanilla-socks",
            name: "Vanilla socks",
            kind: .sock,
            structure: .stockinette,
            options: ProjectOptions(ease: 0.10, cuffDepth: 4, legLength: 15),
            suggestedWeight: .superFine,
            blurb: "Cuff down, heel flap and gusset, wedge toe. The sock everyone learns first.",
            chartID: nil),

        PatternPreset(
            id: "colourwork-mittens",
            name: "Colourwork mittens",
            kind: .mitten,
            structure: .strandedColourwork,
            options: ProjectOptions(ease: 0.05, ribDepth: 6),
            suggestedWeight: .light,
            blurb: "Stranded floats double the fabric — the warmest thing you can knit for hands.",
            chartID: "zigzag"),

        PatternPreset(
            id: "triangle-shawl",
            name: "Garter triangle shawl",
            kind: .shawl,
            structure: .garter,
            options: ProjectOptions(wingspan: 180, increasesPerRightSideRow: 4),
            suggestedWeight: .superFine,
            blurb: "Starts at nine stitches and grows. Blocking is what turns it into a shawl.",
            chartID: nil),
    ]

    static func preset(id: String) -> PatternPreset? {
        all.first { $0.id == id }
    }

    // MARK: - Built-in colourwork charts

    /// Charts written as text art: `.` is the main colour, `X` the contrast,
    /// `o` a third colour. The first line is the top of the chart.
    static func chart(id: String, weight: YarnWeight = .light) -> ColourChart? {
        guard let motif = motifs.first(where: { $0.id == id }) else { return nil }
        return parse(
            name: motif.name,
            art: motif.art,
            palette: Array(palette(weight: weight).prefix(motif.colours)),
            working: .inTheRound)
    }

    static var motifs: [(id: String, name: String, art: String, colours: Int)] {
        [
            (id: "fair-isle-band", name: "Fair Isle band", colours: 2, art: """
            ..XX..XX..XX..XX
            .X..XX..XX..XX..
            X..XX..XX..XX..X
            ..XX..XX..XX..XX
            .XXXX..XXXX..XXX
            X..XX..XX..XX..X
            ..X..XX..XX..XX.
            .XX..XX..XX..XX.
            """),

            (id: "zigzag", name: "Zigzag", colours: 2, art: """
            X......XX......X
            .X....X..X....X.
            ..X..X....X..X..
            ...XX......XX...
            ..X..X....X..X..
            .X....X..X....X.
            X......XX......X
            .......XX.......
            """),

            (id: "checkerboard", name: "Checkerboard", colours: 2, art: """
            XXXX....XXXX....
            XXXX....XXXX....
            XXXX....XXXX....
            XXXX....XXXX....
            ....XXXX....XXXX
            ....XXXX....XXXX
            ....XXXX....XXXX
            ....XXXX....XXXX
            """),

            (id: "snowflake", name: "Snowflake", colours: 2, art: """
            ...X.......X....
            .X.X.X...X.X.X..
            ..XXX.....XXX...
            XXXXXXX.XXXXXXX.
            ..XXX.....XXX...
            .X.X.X...X.X.X..
            ...X.......X....
            ................
            """),

            (id: "hearts", name: "Hearts", colours: 2, art: """
            ................
            .XX..XX..XX..XX.
            XXXXXXXXXXXXXXXX
            XXXXXXXXXXXXXXXX
            .XXXXXX..XXXXXX.
            ..XXXX....XXXX..
            ...XX......XX...
            ................
            """),

            (id: "diamonds", name: "Diamonds", colours: 3, art: """
            .......XX.......
            ......XooX......
            .....XooooX.....
            ....XooooooX....
            .....XooooX.....
            ......XooX......
            .......XX.......
            ................
            """),
        ]
    }

    /// Turns text art into a chart. Unknown characters fall back to colour 0.
    static func parse(
        name: String,
        art: String,
        palette: [Yarn],
        working: ChartWorking = .inTheRound
    ) -> ColourChart {
        let lines = art
            .split(separator: "\n", omittingEmptySubsequences: true)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        guard !lines.isEmpty else {
            return ColourChart.blank(name: name, palette: palette)
        }
        let width = lines.map(\.count).max() ?? 1
        // Row 0 of a chart is the bottom, so read the art bottom-up.
        var cells: [Int] = []
        for line in lines.reversed() {
            var row = Array(repeating: 0, count: width)
            for (index, character) in line.enumerated() {
                switch character {
                case "X", "x", "#": row[index] = min(1, palette.count - 1)
                case "o", "O", "*": row[index] = min(2, palette.count - 1)
                default: row[index] = 0
                }
            }
            cells.append(contentsOf: row)
        }
        return ColourChart(
            name: name,
            width: width,
            height: lines.count,
            cells: cells,
            palette: palette,
            working: working)
    }
}
