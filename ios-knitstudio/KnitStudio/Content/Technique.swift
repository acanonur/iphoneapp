import Foundation

enum TechniqueCategory: String, Codable, CaseIterable, Identifiable {
    case gettingStarted
    case castOn
    case basicStitches
    case increases
    case decreases
    case texture
    case cables
    case lace
    case colourwork
    case shortRows
    case inTheRound
    case finishing
    case fixing

    var id: String { rawValue }

    var name: String {
        switch self {
        case .gettingStarted: return "Getting started"
        case .castOn: return "Cast-ons"
        case .basicStitches: return "Basic stitches"
        case .increases: return "Increases"
        case .decreases: return "Decreases"
        case .texture: return "Texture"
        case .cables: return "Cables"
        case .lace: return "Lace"
        case .colourwork: return "Colourwork"
        case .shortRows: return "Short rows"
        case .inTheRound: return "Working in the round"
        case .finishing: return "Finishing"
        case .fixing: return "Fixing mistakes"
        }
    }

    var symbol: String {
        switch self {
        case .gettingStarted: return "figure.wave"
        case .castOn: return "arrow.down.to.line"
        case .basicStitches: return "square.grid.2x2"
        case .increases: return "plus.circle"
        case .decreases: return "minus.circle"
        case .texture: return "square.stack.3d.down.right"
        case .cables: return "arrow.triangle.swap"
        case .lace: return "snowflake"
        case .colourwork: return "paintpalette"
        case .shortRows: return "arrow.uturn.left"
        case .inTheRound: return "circle.dashed"
        case .finishing: return "checkmark.seal"
        case .fixing: return "bandage"
        }
    }

    var blurb: String {
        switch self {
        case .gettingStarted: return "Needles, yarn, and reading what a pattern is telling you."
        case .castOn: return "Every project starts here. The right one matters more than people expect."
        case .basicStitches: return "Knit and purl, and the fabrics they make between them."
        case .increases: return "Adding stitches, and which way each one leans."
        case .decreases: return "Taking stitches away so the lean matches the shaping."
        case .texture: return "Fabric that is made by where you put the knits and purls."
        case .cables: return "Crossing stitches over each other to make ropes and braids."
        case .lace: return "Deliberate holes, paired with decreases that keep the count."
        case .colourwork: return "More than one colour in a row, and how to carry the others."
        case .shortRows: return "Extra rows in part of the fabric, to shape it in three dimensions."
        case .inTheRound: return "Knitting a tube: no seams, no purling back."
        case .finishing: return "Bind-offs, seams and blocking — where a project is won or lost."
        case .fixing: return "Dropped, twisted, miscounted. All of it is recoverable."
        }
    }
}

/// One technique in the guide.
struct Technique: Identifiable, Codable, Equatable, Hashable {
    /// Stable slug so favourites survive updates.
    var id: String
    var name: String
    var category: TechniqueCategory
    var difficulty: Difficulty
    /// One line: what it is.
    var summary: String
    /// When a knitter should reach for it.
    var whenToUse: String
    /// Numbered instructions.
    var steps: [String]
    var tips: [String] = []
    var alsoKnownAs: [String] = []
    /// Abbreviations that show up alongside it in patterns.
    var abbreviations: [String] = []

    var searchText: String {
        ([name, summary, whenToUse] + alsoKnownAs + abbreviations).joined(separator: " ").lowercased()
    }
}

/// A pattern abbreviation and what it means.
struct Abbreviation: Identifiable, Codable, Equatable, Hashable {
    var id: String { short }
    var short: String
    var full: String
    var meaning: String
    /// Slug of the technique that explains it, when there is one.
    var techniqueID: String?
}

enum TechniqueLibrary {

    static let all: [Technique] =
        basics + stitchesAndShaping + textureAndColour + finishingAndFixing

    static func technique(id: String) -> Technique? {
        all.first { $0.id == id }
    }

    static func inCategory(_ category: TechniqueCategory) -> [Technique] {
        all.filter { $0.category == category }
    }

    static var categoriesInOrder: [TechniqueCategory] {
        TechniqueCategory.allCases.filter { !inCategory($0).isEmpty }
    }

    static func search(_ query: String) -> [Technique] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return all }
        return all.filter { $0.searchText.contains(trimmed) }
    }

    /// Techniques a given project will actually need.
    static func recommended(for kind: PatternKind, structure: FabricStructure) -> [Technique] {
        var ids: [String] = ["gauge-swatch", "long-tail-cast-on", "knit-stitch", "purl-stitch"]
        switch kind {
        case .scarf, .blanket:
            ids += ["garter-stitch", "standard-bind-off", "weaving-in-ends", "blocking"]
        case .cowl:
            ids += ["join-in-round", "magic-loop", "stretchy-bind-off", "blocking"]
        case .hat:
            ids += ["join-in-round", "ribbing", "k2tog", "magic-loop", "gathered-crown"]
        case .raglanSweater:
            ids += ["join-in-round", "m1l", "m1r", "ribbing", "picking-up-stitches",
                    "stretchy-bind-off", "blocking"]
        case .sock:
            ids += ["join-in-round", "magic-loop", "heel-flap", "short-row-heel-turn",
                    "picking-up-stitches", "ssk", "k2tog", "kitchener-stitch"]
        case .mitten:
            ids += ["join-in-round", "magic-loop", "m1l", "m1r", "kitchener-stitch"]
        case .shawl:
            ids += ["garter-tab", "yarn-over", "ssk", "k2tog", "stretchy-bind-off", "blocking"]
        }
        switch structure {
        case .cables: ids += ["cable-cross", "cable-without-needle"]
        case .lace: ids += ["yarn-over", "lifeline", "reading-charts"]
        case .strandedColourwork: ids += ["stranded-colourwork", "catching-floats", "reading-charts"]
        case .intarsia: ids += ["intarsia"]
        case .mosaic: ids += ["mosaic-knitting"]
        case .brioche: ids += ["brioche"]
        case .ribbing: ids += ["ribbing"]
        case .seed: ids += ["seed-stitch"]
        case .garter: ids += ["garter-stitch"]
        case .stockinette: ids += ["stockinette"]
        }
        var seen = Set<String>()
        return ids.compactMap { id in
            guard !seen.contains(id), let technique = technique(id: id) else { return nil }
            seen.insert(id)
            return technique
        }
    }
}
