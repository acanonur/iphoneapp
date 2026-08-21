import Foundation

/// The built-in stitch dictionary.
///
/// Every chart here is written the way a printed chart is read: the symbol says
/// what the stitch looks like from the right side, so a knit symbol falling on a
/// wrong-side row is purled. The one exception is shadow knitting, which charts
/// the wrong-side row itself and sets `chartsWrongSideRows`.
enum StitchPatternLibrary {

    // MARK: - Chart characters

    /// Keeping each row as a short string is what lets these definitions be read
    /// side by side with a printed chart instead of as a flat list of symbols.
    private static let defaultLegend: [Character: StitchSymbol] = [
        "k": StitchSymbol.knit,
        ".": StitchSymbol.purl,
        "o": StitchSymbol.yarnOver,
        "/": StitchSymbol.k2tog,
        "\\": StitchSymbol.ssk,
        "A": StitchSymbol.cdd,
        "T": StitchSymbol.k3tog,
        "m": StitchSymbol.make1,
        "-": StitchSymbol.noStitch,
        "C": StitchSymbol.cable2Front,
        "D": StitchSymbol.cable2Back,
        "E": StitchSymbol.cable3Front,
        "F": StitchSymbol.cable3Back,
        "b": StitchSymbol.bobble,
        "s": StitchSymbol.slip,
        "S": StitchSymbol.slipWyif,
    ]

    /// Shadow knitting charts the wrong-side row, where the purl is the stitch
    /// that leaves the bump the pattern is made of.
    private static let shadowLegend: [Character: StitchSymbol] = [
        "o": StitchSymbol.purl,
        "_": StitchSymbol.knit,
    ]

    // MARK: - Builder

    /// Builds a pattern from rows written top-down, the way a chart is printed.
    /// Pass `bottomUp` when the rows are quoted starting from the one worked first.
    private static func make(
        name: String,
        summary: String,
        rows: [String],
        multipleOf: Int,
        plusStitches: Int = 0,
        structure: FabricStructure = .stockinette,
        difficulty: Difficulty = .easy,
        working: ChartWorking = .flat,
        rowColours: [Int] = [],
        rowsPerChartedRow: Int = 1,
        impliedRowInstruction: String? = nil,
        chartsWrongSideRows: Bool = false,
        bottomUp: Bool = false,
        legend: [Character: StitchSymbol] = StitchPatternLibrary.defaultLegend,
        notes: String = ""
    ) -> StitchPattern {
        let ordered: [String] = bottomUp ? rows : Array(rows.reversed())
        let widths: [Int] = ordered.map { (row: String) in row.count }
        let width: Int = max(1, widths.max() ?? 1)

        var symbols: [StitchSymbol] = []
        for row in ordered {
            var cells: [StitchSymbol] = Array(repeating: StitchSymbol.knit, count: width)
            for (index, character) in row.enumerated() {
                cells[index] = legend[character] ?? StitchSymbol.knit
            }
            symbols.append(contentsOf: cells)
        }

        return StitchPattern(
            name: name,
            width: width,
            height: max(1, ordered.count),
            symbols: symbols,
            rowColours: rowColours,
            working: working,
            multipleOf: multipleOf,
            plusStitches: plusStitches,
            rowsPerChartedRow: rowsPerChartedRow,
            impliedRowInstruction: impliedRowInstruction,
            chartsWrongSideRows: chartsWrongSideRows,
            structure: structure,
            difficulty: difficulty,
            notes: notes,
            summary: summary)
    }

    // MARK: - Flat and simple

    static let flatAndSimple: [StitchPattern] = [
        make(
            name: "Stockinette",
            summary: "Knit on the right side, purl back. The plainest fabric there is, and it curls at every edge.",
            rows: ["kkkk", "kkkk"],
            multipleOf: 1,
            structure: .stockinette,
            difficulty: .beginner,
            notes: "Stockinette curls: the side edges roll to the back and the cast-on edge rolls to "
                + "the front. Plan a border, a hem or a seam rather than hoping blocking will fix it."),

        make(
            name: "Reverse stockinette",
            summary: "The same fabric worked with the purl side out, used as a quiet ground behind cables.",
            rows: ["....", "...."],
            multipleOf: 1,
            structure: .stockinette,
            difficulty: .beginner),

        make(
            name: "Garter",
            summary: "Knit every row. Lies flat, stretches lengthwise, and looks the same from both sides.",
            rows: ["....", "kkkk"],
            multipleOf: 1,
            structure: .garter,
            difficulty: .beginner,
            notes: "Two rows make one ridge, so count ridges rather than rows when you are measuring — "
                + "it is much harder to lose your place."),

        make(
            name: "Seed (moss)",
            summary: "Single knits and purls alternating in both directions: flat, reversible, slow and steady.",
            rows: [".k", "k."],
            multipleOf: 2,
            structure: .seed,
            difficulty: .easy,
            notes: "The rule at the needle is simpler than the chart: knit the stitches that look "
                + "like purls and purl the ones that look like knits."),

        make(
            name: "Double seed",
            summary: "Seed stitch in blocks of two, quicker to work and calmer to look at than single seed.",
            rows: ["..kk", "..kk", "kk..", "kk.."],
            multipleOf: 4,
            structure: .seed,
            difficulty: .easy),

        make(
            name: "1×1 rib",
            summary: "The stretchiest rib there is — cuffs, brims and anywhere the fabric has to pull in.",
            rows: ["k.", "k."],
            multipleOf: 2,
            structure: .ribbing,
            difficulty: .beginner,
            notes: "Rib measured relaxed is much narrower than rib stretched. Measure your swatch "
                + "unstretched or the cuff will come out loose."),

        make(
            name: "2×2 rib",
            summary: "Deeper columns than 1×1, a little less stretchy, and far easier to keep track of.",
            rows: ["kk..", "kk.."],
            multipleOf: 4,
            structure: .ribbing,
            difficulty: .beginner),

        make(
            name: "Broken rib",
            summary: "Ribbed on the right side and purled back, so it keeps the texture but loses most of the pull-in.",
            rows: ["kk", "k."],
            multipleOf: 2,
            structure: .ribbing,
            difficulty: .easy),

        make(
            name: "Waffle",
            summary: "Purl gutters crossing in both directions, leaving a grid of small raised squares.",
            rows: [".kkk", ".kkk", ".kkk", "...."],
            multipleOf: 4,
            structure: .seed,
            difficulty: .easy),

        make(
            name: "Basketweave",
            summary: "Blocks of knit and purl that swap every four rows, like strips woven over and under.",
            rows: [
                "....kkkk", "....kkkk", "....kkkk", "....kkkk",
                "kkkk....", "kkkk....", "kkkk....", "kkkk....",
            ],
            multipleOf: 8,
            structure: .seed,
            difficulty: .easy),

        make(
            name: "Linen stitch",
            summary: "Slipped stitches lay strands across the surface, giving a dense, close fabric that looks woven.",
            rows: ["kS", "Sk"],
            multipleOf: 2,
            structure: .mosaic,
            difficulty: .intermediate,
            notes: "Slip every slipped stitch purlwise, with the yarn held on the right side of the "
                + "work: in front on right-side rows, behind on wrong-side rows. Those strands lying "
                + "across the front are the whole effect. It uses noticeably more yarn and grows slowly, "
                + "so it suits small things and variegated yarn that needs breaking up."),
    ]

    // MARK: - Texture

    static let texture: [StitchPattern] = [
        make(
            name: "Diagonal ridges",
            summary: "A pair of purl ridges that steps one stitch to the left on every row.",
            rows: [".kk.", "kk..", "k..k", "..kk"],
            multipleOf: 4,
            structure: .seed,
            difficulty: .easy),

        make(
            name: "Diamond moss panel",
            summary: "Purl lines crossing into diamonds, each with a single purl dot at its centre.",
            rows: [
                "k.kkkkk.", ".k.kkk.k", "kkk.k.kk", "kkkk.kkk",
                "kkk.k.kk", "kk.k.k.k", "k.kkkkk.", ".kkkkkkk",
            ],
            multipleOf: 8,
            structure: .seed,
            difficulty: .easy),

        make(
            name: "Chevron",
            summary: "Paired increases and decreases push the rows into a zigzag, worked in garter so it lies flat.",
            rows: ["............", "kkkkkkkkkkkk", "............", "\\kkkmkkmkkk/"],
            multipleOf: 12,
            structure: .garter,
            difficulty: .intermediate,
            notes: "Row 1 takes four stitches out and puts four back, so the count never changes — "
                + "the fabric moves instead. The cast-on edge and the bind-off edge will both come "
                + "out scalloped, which is worth allowing for when you measure length."),
    ]

    // MARK: - Cables

    // A cable symbol carries the whole crossing, so the columns it eats are
    // charted as "no stitch" — a printed chart draws one wide symbol across them.
    static let cables: [StitchPattern] = [
        make(
            name: "Rope cable (4 st)",
            summary: "A four-stitch cable crossed the same way every sixth row, on a purl ground.",
            rows: [".kkkk.", ".kkkk.", ".kkkk.", ".kkkk.", ".kkkk.", ".C---."],
            multipleOf: 6,
            structure: .cables,
            difficulty: .intermediate,
            notes: "Row 1 is the crossing row: p1, slip 2 to a cable needle and hold at the front, "
                + "k2, k2 from the cable needle, p1. Every other row is p1, k4, p1 as it appears. "
                + "Cables pull the fabric in, so a cabled piece needs more stitches and more yarn "
                + "than the same width in stockinette."),

        make(
            name: "Horseshoe cable",
            summary: "Two four-stitch cables crossed away from each other, so one rope splits into a horseshoe.",
            rows: [
                "..kkkkkkkk..", "..kkkkkkkk..", "..kkkkkkkk..", "..kkkkkkkk..",
                "..kkkkkkkk..", "..kkkkkkkk..", "..kkkkkkkk..", "..C---D---..",
            ],
            multipleOf: 12,
            structure: .cables,
            difficulty: .intermediate,
            notes: "Row 1: p2, C4B, C4F, p2. The right-leaning cross is worked first and the left-leaning one second, so the two ropes turn away from each other. "
                + "Cross them the other way round and you get a shape that closes in at the top instead."),
    ]

    // MARK: - Lace

    // Every row below takes exactly as many stitches off the left needle as it
    // puts back: a lace repeat whose yarn-overs and decreases do not balance
    // silently changes the stitch count on every repeat.
    static let lace: [StitchPattern] = [
        make(
            name: "Simple eyelet",
            summary: "Staggered single holes on a stockinette ground — the gentlest possible introduction to lace.",
            rows: ["kkkkkk", "kkko/k", "kkkkkk", "o/kkkk"],
            multipleOf: 6,
            structure: .lace,
            difficulty: .easy,
            notes: "Each yarn-over is paired with the decrease worked immediately before it, so the "
                + "count comes back to where it started at the end of every row."),

        make(
            name: "Feather and fan",
            summary: "The old Shetland shale: six decreases and six yarn-overs in one row, scalloping the fabric and its edges.",
            rows: ["..................", "///kokokokokoko///", "kkkkkkkkkkkkkkkkkk", "kkkkkkkkkkkkkkkkkk"],
            multipleOf: 18,
            plusStitches: 2,
            structure: .lace,
            difficulty: .intermediate,
            notes: "The chart is the 18-stitch repeat; the two extra stitches are one selvedge stitch at each end, knitted plain on every row. "
                + "Row 3 does all the work — six decreases pulled together at the sides and six yarn-overs spread through the middle — and row 4 is knitted on the wrong side to leave a garter ridge. "
                + "Blocking the points out is what makes the scallops read."),

        make(
            name: "Little arrowhead lace",
            summary: "Eyelets stepping inwards on every right-side row until they meet, making small arrowheads.",
            rows: [
                "kkkkkkkkkk", "kkko\\/okkk", "kkkkkkkkkk",
                "kko\\kk/okk", "kkkkkkkkkk", "ko\\kkkk/ok",
            ],
            multipleOf: 10,
            structure: .lace,
            difficulty: .intermediate,
            notes: "Every wrong-side row is purled straight across, so all the thinking happens on "
                + "right-side rows. Count your stitches at the end of each of those: 10 per repeat, "
                + "every time."),
    ]

    // MARK: - Colour

    static let colour: [StitchPattern] = [
        make(
            name: "Two-colour stripe",
            summary: "Two-row stripes in stockinette, the simplest way to use up two balls of yarn.",
            rows: ["kkkk", "kkkk", "kkkk", "kkkk"],
            multipleOf: 1,
            structure: .stockinette,
            difficulty: .beginner,
            rowColours: [0, 0, 1, 1],
            notes: "Two-row stripes change colour on a right-side row, so the resting yarn is always "
                + "waiting at the same edge — carry it up the side rather than cutting it and you "
                + "will have two ends instead of dozens."),

        make(
            name: "Mosaic slip-stitch",
            summary: "Mock houndstooth: one colour at a time, with slipped stitches pulling the other colour up from below.",
            rows: ["kksk", "kksk", "skkk", "skkk"],
            multipleOf: 4,
            structure: .mosaic,
            difficulty: .easy,
            rowColours: [0, 0, 1, 1],
            notes: "Only one colour is ever on the needles: work two rows in it, then two in the "
                + "other. Slip every slipped stitch purlwise with the yarn held to the wrong side — "
                + "yarn in back on right-side rows, in front on wrong-side rows — so the stitch "
                + "carries its own colour up from two rows below."),

        make(
            name: "Shadow-knit dots",
            summary: "Rows of dots that are invisible face-on and appear when the fabric is seen from below.",
            rows: StitchPatternLibrary.shadowDotRows,
            multipleOf: 18,
            structure: .mosaic,
            difficulty: .intermediate,
            rowColours: StitchPatternLibrary.shadowDotColours,
            rowsPerChartedRow: 2,
            impliedRowInstruction: "RS: knit all stitches. The colour changes at the beginning of every RS row.",
            chartsWrongSideRows: true,
            bottomUp: true,
            legend: StitchPatternLibrary.shadowLegend,
            notes: "This is shadow knitting, also called illusion knitting: the dots are nothing but purl bumps worked in the contrast colour, so face-on the fabric reads as plain stripes and the dots only step forward when you look at it from below, at a low angle. "
                + "The two colours alternate every two rows, changing at the start of each right-side row, and each charted row is the wrong-side row of that pair — the right-side row is knitted plain. "
                + "There are six plain stripes between the rounds of dots, and every dot sits half a repeat along from the one below it."),
    ]

    // The chart is quoted from the row worked first, so it is passed bottom-up.
    private static let shadowDotRows: [String] = [
        "oooooooooooooooooo",
        "__________________",
        "oooooooooooooooooo",
        "__________________",
        "oooooooooooooooooo",
        "__________________",
        "oooooooooooooo____",
        "______________oooo",
        "__oooooooooo______",
        "oo__________oooooo",
        "___oooooooo_______",
        "ooo________ooooooo",
        "__oooooooooo______",
        "oo__________oooooo",
        "oooooooooooooo____",
        "______________oooo",
        "oooooooooooooooooo",
        "__________________",
        "oooooooooooooooooo",
        "__________________",
        "oooooooooooooooooo",
        "__________________",
        "ooooo____ooooooooo",
        "_____oooo_________",
        "ooo________ooooooo",
        "___oooooooo_______",
        "oo__________oooooo",
        "__oooooooooo______",
        "ooo________ooooooo",
        "___oooooooo_______",
        "ooooo____ooooooooo",
        "_____oooo_________",
    ]

    /// Row 0 is colour 0, the dot colour, and the two colours alternate from there.
    private static let shadowDotColours: [Int] = (0 ..< 32).map { (row: Int) in row % 2 }

    // MARK: - Library

    private static let groups: [(name: String, patterns: [StitchPattern])] = [
        (name: "Flat and simple", patterns: StitchPatternLibrary.flatAndSimple),
        (name: "Texture", patterns: StitchPatternLibrary.texture),
        (name: "Cables", patterns: StitchPatternLibrary.cables),
        (name: "Lace", patterns: StitchPatternLibrary.lace),
        (name: "Colour", patterns: StitchPatternLibrary.colour),
    ]

    static let all: [StitchPattern] = {
        var patterns: [StitchPattern] = []
        for group in StitchPatternLibrary.groups {
            patterns.append(contentsOf: group.patterns)
        }
        return patterns
    }()

    static var categories: [(name: String, patterns: [StitchPattern])] {
        StitchPatternLibrary.groups
    }

    static func pattern(named name: String) -> StitchPattern? {
        let wanted = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return StitchPatternLibrary.all.first { (pattern: StitchPattern) in
            pattern.name.compare(wanted, options: .caseInsensitive) == .orderedSame
        }
    }

    /// Stitch patterns that suit a given project, in the order worth trying them.
    static func recommended(for kind: PatternKind) -> [StitchPattern] {
        let names: [String]
        switch kind {
        case .scarf:
            names = ["Garter", "Seed (moss)", "Broken rib", "Double seed", "Linen stitch"]
        case .blanket:
            names = ["Garter", "Basketweave", "Waffle", "Chevron", "Two-colour stripe"]
        case .cowl:
            names = ["2×2 rib", "Double seed", "Rope cable (4 st)", "Mosaic slip-stitch"]
        case .hat:
            names = ["2×2 rib", "Stockinette", "Rope cable (4 st)", "Two-colour stripe"]
        case .raglanSweater:
            names = ["Stockinette", "2×2 rib", "Horseshoe cable", "Waffle"]
        case .sock:
            names = ["1×1 rib", "2×2 rib", "Stockinette", "Simple eyelet"]
        case .mitten:
            names = ["2×2 rib", "Stockinette", "Rope cable (4 st)", "Mosaic slip-stitch"]
        case .shawl:
            names = ["Garter", "Feather and fan", "Little arrowhead lace", "Simple eyelet"]
        }
        return names.compactMap { (name: String) in StitchPatternLibrary.pattern(named: name) }
    }
}
