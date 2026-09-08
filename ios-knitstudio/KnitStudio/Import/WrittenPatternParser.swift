import Foundation

/// One instruction inside a row, and what it does to the stitch count.
struct StitchOperation: Equatable {
    var text: String
    var consumes: Int
    var produces: Int
}

/// One row of a written pattern, after parsing.
struct ParsedRow: Identifiable, Equatable {
    var id: UUID = UUID()
    var label: String
    var side: String?
    var text: String
    var startingStitches: Int?
    var endingStitches: Int?
    var issues: [String] = []

    var isVerified: Bool { endingStitches != nil && issues.isEmpty }
}

/// The result of importing a written pattern.
struct ParsedPattern: Equatable {
    var title: String?
    var gauge: Gauge?
    var gaugeNote: String?
    var castOnStitches: Int?
    var yarnNotes: [String] = []
    var needleNotes: [String] = []
    var rows: [ParsedRow] = []
    var unknownTerms: [String] = []
    var issues: [String] = []

    var verifiedRowCount: Int { rows.filter(\.isVerified).count }
}

/// Reads a written knitting pattern and works out what each row does to the
/// stitch count — which is how you find the row where a pattern (or a
/// transcription of it) stops adding up.
enum WrittenPatternParser {

    // MARK: - Entry point

    static func parse(_ raw: String) -> ParsedPattern {
        var result = ParsedPattern()
        let lines = raw
            .replacingOccurrences(of: "\r\n", with: "\n")
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }

        result.title = lines.first { !$0.isEmpty && $0.count < 80 }

        for line in lines where !line.isEmpty {
            let lower = line.lowercased()

            if result.gauge == nil, lower.contains("gauge") || lower.contains("tension")
                || (lower.contains("sts") && (lower.contains("row") || lower.contains("rnd"))) {
                if let parsed = parseGauge(line) {
                    result.gauge = parsed
                    result.gaugeNote = line
                }
            }
            if lower.contains("yarn") || lower.contains("skein") || lower.contains("ball")
                || lower.contains("yardage") || lower.contains("metres") || lower.contains("meters") {
                result.yarnNotes.append(line)
            }
            if lower.contains("needle") || (lower.contains("mm") && lower.contains("circular")) {
                result.needleNotes.append(line)
            }
            if result.castOnStitches == nil,
               let count = parseCastOn(line) {
                result.castOnStitches = count
            }
            if let row = parseRowLine(line) {
                result.rows.append(row)
            }
        }

        // Walk the rows, threading the stitch count through.
        var running = result.castOnStitches
        var unknown = Set<String>()
        for index in result.rows.indices {
            result.rows[index].startingStitches = running
            let outcome = evaluate(result.rows[index].text, incoming: running)
            result.rows[index].endingStitches = outcome.produced
            result.rows[index].issues = outcome.issues
            outcome.unknown.forEach { unknown.insert($0) }
            running = outcome.produced ?? running
        }
        result.unknownTerms = unknown.sorted()

        if result.rows.isEmpty {
            result.issues.append(
                "No numbered rows found. This importer reads patterns written as "
                + "‘Row 1 (RS): k2, p2…’ — a scanned image of a chart will not parse.")
        }
        if result.castOnStitches == nil, !result.rows.isEmpty {
            result.issues.append(
                "No cast-on count found, so stitch counts could not be checked. "
                + "Add a line like ‘Cast on 96 sts’ and import again.")
        }
        return result
    }

    // MARK: - Header lines

    static func parseGauge(_ line: String) -> Gauge? {
        guard let match = capture(
            #"(\d+(?:[.,]\d+)?)\s*(?:sts?|stitches)\D{0,40}?(\d+(?:[.,]\d+)?)\s*(?:rows?|rnds?|rounds?)"#,
            in: line
        ), match.count >= 3,
            let stitches = number(match[1]),
            let rows = number(match[2])
        else { return nil }

        // Work out whether the gauge is quoted over 10 cm or 4 inches.
        var window = 10.0
        if let unit = capture(#"(\d+(?:[.,]\d+)?)\s*(cm|centimetre|centimeter|in\b|inch|inches|")"#, in: line),
           unit.count >= 3, let value = number(unit[1]) {
            let isInches = (unit[2] ?? "").lowercased().hasPrefix("in") || (unit[2] ?? "") == "\""
            window = isInches ? value * 2.54 : value
        } else if line.lowercased().contains("4\"") || line.lowercased().contains("4 in") {
            window = 10.16
        }
        guard window > 0 else { return nil }
        return Gauge.fromSwatch(stitches: stitches, rows: rows, overCm: window)
    }

    static func parseCastOn(_ line: String) -> Int? {
        // The \b stops "co" matching inside another word.
        guard let match = capture(#"(?:cast on|\bco)\s+(\d+)\s*(?:sts?|stitches)?"#, in: line),
              match.count >= 2, let value = number(match[1]) else { return nil }
        return Int(value)
    }

    static func parseRowLine(_ line: String) -> ParsedRow? {
        guard let match = capture(
            #"^(rows?|rnds?|rounds?)\s*([\d\s,\-–and]+?)\s*(?:\((rs|ws)\))?\s*[:.]\s*(.+)$"#,
            in: line
        ), match.count >= 5 else { return nil }

        let keyword = (match[1] ?? "Row").capitalized
        let numbers = (match[2] ?? "").trimmingCharacters(in: .whitespaces)
        let side = match[3]?.uppercased()
        let body = (match[4] ?? "").trimmingCharacters(in: .whitespaces)
        guard !body.isEmpty else { return nil }

        return ParsedRow(
            label: "\(keyword) \(numbers)",
            side: side,
            text: body)
    }

    // MARK: - Row evaluation

    struct Outcome {
        var produced: Int?
        var issues: [String] = []
        var unknown: [String] = []
    }

    /// Works out the stitch count a row ends on, given what it started with.
    static func evaluate(_ text: String, incoming: Int?) -> Outcome {
        var outcome = Outcome()
        let normalised = normalise(text)

        // Pull the pattern's own stated count out of a trailing "— 96 sts".
        let stated = statedCount(in: normalised)

        guard let incoming else {
            outcome.produced = stated
            return outcome
        }

        let expanded = expandBrackets(normalised)

        // Split around a star repeat, if there is one.
        if let star = splitStarRepeat(expanded) {
            let prefix = tally(star.prefix, collecting: &outcome)
            let body = tally(star.body, collecting: &outcome)
            let suffix = tally(star.suffix, collecting: &outcome)

            guard body.consumes > 0 else {
                outcome.issues.append("The repeated section does not use any stitches, so it cannot be counted.")
                outcome.produced = stated
                return outcome
            }
            // "to last N sts" describes the same stitches the suffix works, so
            // it is a consistency check, not an extra deduction.
            if star.leaveStitches > 0, suffix.consumes != star.leaveStitches {
                outcome.issues.append(
                    "‘to last \(star.leaveStitches) sts’ but the instructions after it use "
                    + "\(suffix.consumes) sts.")
            }
            let available = incoming - prefix.consumes - suffix.consumes
            guard available >= 0 else {
                outcome.issues.append(
                    "This row needs more stitches than the \(incoming) on the needle.")
                outcome.produced = stated
                return outcome
            }
            let repeats = available / body.consumes
            if available % body.consumes != 0 {
                outcome.issues.append(
                    "The repeat does not divide evenly: \(available) sts left for a "
                    + "\(body.consumes)-st repeat leaves \(available % body.consumes) over.")
            }
            let produced = prefix.produces + repeats * body.produces + suffix.produces
            outcome.produced = produced
            check(produced: produced, stated: stated, into: &outcome)
            return outcome
        }

        // No repeat: a straight tally, with "to end" soaking up the remainder.
        let flexible = flexibleConsumption(expanded)
        let fixed = tally(flexible.tokens, collecting: &outcome)
        if flexible.hasToEnd {
            // The instructions after "to last N sts" are exactly those N sts —
            // anything before the marker is not part of that count.
            var afterOutcome = Outcome()
            let after = tally(flexible.after, collecting: &afterOutcome)
            if flexible.leaveStitches > 0, after.consumes != flexible.leaveStitches {
                outcome.issues.append(
                    "‘to last \(flexible.leaveStitches) sts’ but the instructions after it use "
                    + "\(after.consumes) sts.")
            }
            let available = incoming - fixed.consumes
            guard available >= 0 else {
                outcome.issues.append(
                    "This row needs more stitches than the \(incoming) on the needle.")
                outcome.produced = stated
                return outcome
            }
            let produced = fixed.produces + available
            outcome.produced = produced
            check(produced: produced, stated: stated, into: &outcome)
            return outcome
        }

        if fixed.consumes != incoming {
            outcome.issues.append(
                "This row uses \(fixed.consumes) sts but \(incoming) were on the needle.")
        }
        outcome.produced = fixed.produces
        check(produced: fixed.produces, stated: stated, into: &outcome)
        return outcome
    }

    static func check(produced: Int, stated: Int?, into outcome: inout Outcome) {
        guard let stated, stated != produced else { return }
        outcome.issues.append(
            "The pattern says \(stated) sts at the end of this row; the instructions give \(produced).")
    }

    // MARK: - Tokenising

    struct Tally {
        var consumes: Int = 0
        var produces: Int = 0
    }

    static func tally(_ tokens: [String], collecting outcome: inout Outcome) -> Tally {
        var result = Tally()
        for token in tokens {
            guard let operation = interpret(token) else {
                if !token.isEmpty { outcome.unknown.append(token) }
                continue
            }
            result.consumes += operation.consumes
            result.produces += operation.produces
        }
        return result
    }

    /// Turns one instruction into its stitch arithmetic.
    static func interpret(_ token: String) -> StitchOperation? {
        let text = token.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return nil }

        // Instructions that move markers or turn the work change nothing.
        for noop in ["pm", "sm", "place marker", "slip marker", "remove marker", "turn", "rm"]
        where text == noop || text.hasPrefix(noop + " ") {
            return StitchOperation(text: text, consumes: 0, produces: 0)
        }

        // Multi-stitch operations, longest first so "k2tog" beats "k2".
        let fixedOperations: [(String, Int, Int)] = [
            ("sl2-k1-p2sso", 3, 1), ("sl2 k1 p2sso", 3, 1), ("s2kp", 3, 1), ("sk2p", 3, 1),
            ("cdd", 3, 1), ("k3tog", 3, 1), ("p3tog", 3, 1),
            ("k2tog tbl", 2, 1), ("p2tog tbl", 2, 1),
            ("k2tog", 2, 1), ("p2tog", 2, 1), ("ssk", 2, 1), ("ssp", 2, 1),
            ("kfb", 1, 2), ("pfb", 1, 2),
            ("m1lp", 0, 1), ("m1rp", 0, 1), ("m1l", 0, 1), ("m1r", 0, 1), ("m1p", 0, 1), ("m1", 0, 1),
            ("yo", 0, 1), ("yon", 0, 1), ("yfwd", 0, 1), ("yrn", 0, 1),
        ]
        for (name, consumes, produces) in fixedOperations where text == name || text.hasPrefix(name + " ") {
            return StitchOperation(text: text, consumes: consumes, produces: produces)
        }

        // "k12", "p3", "sl 2", "knit 5", and bare "k" / "p".
        if let match = capture(#"^(k|p|knit|purl|sl|slip)\s*(\d+)?(?:\s*sts?)?(?:\s*tbl)?$"#, in: text),
           match.count >= 2 {
            let count = match[2].flatMap { Int($0) } ?? 1
            return StitchOperation(text: text, consumes: count, produces: count)
        }

        // "bind off 8 sts" / "cast on 12 sts".
        if let match = capture(#"^(?:bind off|bo|cast off)\s*(\d+)"#, in: text), match.count >= 2,
           let count = Int(match[1] ?? "") {
            return StitchOperation(text: text, consumes: count, produces: 0)
        }
        if let match = capture(#"^(?:cast on|co)\s*(\d+)"#, in: text), match.count >= 2,
           let count = Int(match[1] ?? "") {
            return StitchOperation(text: text, consumes: 0, produces: count)
        }

        return nil
    }

    // MARK: - Structure

    static func normalise(_ text: String) -> String {
        text.lowercased()
            .replacingOccurrences(of: "–", with: "-")
            .replacingOccurrences(of: "—", with: "-")
            .replacingOccurrences(of: "×", with: "x")
            .replacingOccurrences(of: "  ", with: " ")
            .trimmingCharacters(in: .whitespaces)
    }

    /// Reads a trailing "(96 sts)" or "- 96 sts" the pattern states for itself.
    static func statedCount(in text: String) -> Int? {
        guard let match = capture(#"[\(\-]\s*(\d+)\s*sts?\s*\)?\s*$"#, in: text),
              match.count >= 2, let value = Int(match[1] ?? "") else { return nil }
        return value
    }

    /// Expands "[k2, p2] 3 times" and "(k1, yo) x4" into plain instructions.
    static func expandBrackets(_ text: String) -> String {
        var working = text
        let pattern = #"[\[\(]([^\]\)]+)[\]\)]\s*(?:x\s*)?(\d+)\s*(?:times?)?"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return working
        }
        // Innermost-first, and bounded so a malformed pattern cannot loop forever.
        for _ in 0 ..< 8 {
            let range = NSRange(working.startIndex ..< working.endIndex, in: working)
            guard let match = regex.firstMatch(in: working, options: [], range: range),
                  let whole = Range(match.range, in: working),
                  let bodyRange = Range(match.range(at: 1), in: working),
                  let countRange = Range(match.range(at: 2), in: working),
                  let count = Int(working[countRange]), count > 0, count < 400
            else { break }

            let body = String(working[bodyRange]).trimmingCharacters(in: .whitespaces)
            let expansion = Array(repeating: body, count: count).joined(separator: ", ")
            working.replaceSubrange(whole, with: expansion)
        }
        return working
    }

    struct StarRepeat {
        var prefix: [String]
        var body: [String]
        var suffix: [String]
        var leaveStitches: Int
    }

    /// Splits "k3, *p2, k2; rep from * to last 3 sts, k3" into its three parts.
    static func splitStarRepeat(_ text: String) -> StarRepeat? {
        guard let starIndex = text.firstIndex(of: "*") else { return nil }
        let prefixText = String(text[text.startIndex ..< starIndex])
        let rest = String(text[text.index(after: starIndex)...])

        guard let repeatRange = rest.range(
            of: #"rep(eat)?\s+from\s*\*"#,
            options: [.regularExpression, .caseInsensitive]
        ) else { return nil }

        let bodyText = String(rest[rest.startIndex ..< repeatRange.lowerBound])
        let tail = String(rest[repeatRange.upperBound...])

        var leave = 0
        var suffixText = tail
        if let match = capture(#"to\s+last\s+(\d+)\s*sts?"#, in: tail), match.count >= 2,
           let value = Int(match[1] ?? "") {
            leave = value
            if let range = tail.range(of: #"to\s+last\s+\d+\s*sts?"#,
                                      options: [.regularExpression, .caseInsensitive]) {
                suffixText = String(tail[range.upperBound...])
            }
        } else if let range = tail.range(of: #"to\s+end"#,
                                         options: [.regularExpression, .caseInsensitive]) {
            suffixText = String(tail[range.upperBound...])
        }

        return StarRepeat(
            prefix: tokens(prefixText),
            body: tokens(bodyText),
            suffix: tokens(suffixText),
            leaveStitches: leave)
    }

    struct Flexible {
        /// Instructions worked before the "to end" / "to last N sts" marker.
        var before: [String]
        /// Instructions worked after it — these are the "last N stitches".
        var after: [String]
        var hasToEnd: Bool
        var leaveStitches: Int

        var tokens: [String] { before + after }
    }

    /// Handles "knit to end" and "knit to last 3 sts" outside a star repeat.
    static func flexibleConsumption(_ text: String) -> Flexible {
        var hasToEnd = false
        var leave = 0
        var before: [String] = []
        var after: [String] = []

        for token in tokens(text) {
            if let match = capture(#"^(?:k|p|knit|purl)\s*to\s*last\s*(\d+)\s*sts?$"#, in: token),
               match.count >= 2, let value = Int(match[1] ?? "") {
                hasToEnd = true
                leave = value
                continue
            }
            if token.range(of: #"^(?:k|p|knit|purl|work)\s*to\s*(?:end|marker)$"#,
                           options: [.regularExpression]) != nil {
                hasToEnd = true
                continue
            }
            if hasToEnd {
                after.append(token)
            } else {
                before.append(token)
            }
        }
        return Flexible(before: before, after: after, hasToEnd: hasToEnd, leaveStitches: leave)
    }

    static func tokens(_ text: String) -> [String] {
        text
            .replacingOccurrences(of: ";", with: ",")
            .components(separatedBy: ",")
            .map {
                $0.trimmingCharacters(in: CharacterSet(charactersIn: " .;:*()[]-"))
            }
            .filter { !$0.isEmpty }
            // Drop trailing "(96 sts)" style annotations.
            .filter { capture(#"^\d+\s*sts?$"#, in: $0) == nil }
    }

    // MARK: - Regex helper

    /// Returns the whole match plus each capture group, or nil if no match.
    static func capture(_ pattern: String, in text: String) -> [String?]? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
        else { return nil }
        let range = NSRange(text.startIndex ..< text.endIndex, in: text)
        guard let match = regex.firstMatch(in: text, options: [], range: range) else { return nil }
        return (0 ..< match.numberOfRanges).map { index in
            guard let groupRange = Range(match.range(at: index), in: text) else { return nil }
            return String(text[groupRange])
        }
    }

    static func number(_ value: String?) -> Double? {
        guard let value else { return nil }
        return Double(value.replacingOccurrences(of: ",", with: "."))
    }
}
