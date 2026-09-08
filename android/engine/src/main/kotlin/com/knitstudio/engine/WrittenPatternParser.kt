package com.knitstudio.engine

/** One instruction inside a row, and what it does to the stitch count. */
data class StitchOperation(val text: String, val consumes: Int, val produces: Int)

/** One row of a written pattern, after parsing. */
data class ParsedRow(
    val label: String,
    val side: String? = null,
    val text: String,
    val startingStitches: Int? = null,
    val endingStitches: Int? = null,
    val issues: List<String> = emptyList(),
) {
    val isVerified: Boolean get() = endingStitches != null && issues.isEmpty()
}

/** The result of importing a written pattern. */
data class ParsedPattern(
    val title: String? = null,
    val gauge: Gauge? = null,
    val gaugeNote: String? = null,
    val castOnStitches: Int? = null,
    val yarnNotes: List<String> = emptyList(),
    val needleNotes: List<String> = emptyList(),
    val rows: List<ParsedRow> = emptyList(),
    val unknownTerms: List<String> = emptyList(),
    val issues: List<String> = emptyList(),
) {
    val verifiedRowCount: Int get() = rows.count { it.isVerified }
}

/**
 * Reads a written knitting pattern and works out what each row does to the
 * stitch count — which is how you find the row where a pattern (or a
 * transcription of it) stops adding up.
 */
object WrittenPatternParser {

    data class Outcome(
        val produced: Int? = null,
        val issues: List<String> = emptyList(),
        val unknown: List<String> = emptyList(),
    )

    private data class Tally(val consumes: Int, val produces: Int)

    private data class StarRepeat(
        val prefix: List<String>,
        val body: List<String>,
        val suffix: List<String>,
        val leaveStitches: Int,
    )

    private data class Flexible(
        val before: List<String>,
        val after: List<String>,
        val hasToEnd: Boolean,
        val leaveStitches: Int,
    ) {
        val tokens: List<String> get() = before + after
    }

    // MARK: - Entry point

    fun parse(raw: String): ParsedPattern {
        val lines = raw.replace("\r\n", "\n").split("\n").map { it.trim() }

        var title: String? = lines.firstOrNull { it.isNotEmpty() && it.length < 80 }
        var gauge: Gauge? = null
        var gaugeNote: String? = null
        var castOn: Int? = null
        val yarnNotes = mutableListOf<String>()
        val needleNotes = mutableListOf<String>()
        val rows = mutableListOf<ParsedRow>()

        for (line in lines) {
            if (line.isEmpty()) continue
            val lower = line.lowercase()

            if (gauge == null &&
                (lower.contains("gauge") || lower.contains("tension") ||
                    (lower.contains("sts") && (lower.contains("row") || lower.contains("rnd"))))
            ) {
                parseGauge(line)?.let { gauge = it; gaugeNote = line }
            }
            if (lower.contains("yarn") || lower.contains("skein") || lower.contains("ball") ||
                lower.contains("yardage") || lower.contains("metres") || lower.contains("meters")
            ) {
                yarnNotes += line
            }
            if (lower.contains("needle") || (lower.contains("mm") && lower.contains("circular"))) {
                needleNotes += line
            }
            if (castOn == null) parseCastOn(line)?.let { castOn = it }
            parseRowLine(line)?.let { rows += it }
        }

        // Walk the rows, threading the stitch count through.
        var running = castOn
        val unknown = linkedSetOf<String>()
        val resolved = rows.map { row ->
            val start = running
            val outcome = evaluate(row.text, start)
            unknown += outcome.unknown
            running = outcome.produced ?: running
            row.copy(
                startingStitches = start,
                endingStitches = outcome.produced,
                issues = outcome.issues,
            )
        }

        val issues = mutableListOf<String>()
        if (resolved.isEmpty()) {
            issues += "No numbered rows found. This importer reads patterns written as " +
                "‘Row 1 (RS): k2, p2…’ — a scanned image of a chart will not parse."
        }
        if (castOn == null && resolved.isNotEmpty()) {
            issues += "No cast-on count found, so stitch counts could not be checked. " +
                "Add a line like ‘Cast on 96 sts’ and import again."
        }

        return ParsedPattern(
            title = title,
            gauge = gauge,
            gaugeNote = gaugeNote,
            castOnStitches = castOn,
            yarnNotes = yarnNotes,
            needleNotes = needleNotes,
            rows = resolved,
            unknownTerms = unknown.sorted(),
            issues = issues,
        )
    }

    // MARK: - Header lines

    fun parseGauge(line: String): Gauge? {
        val match = capture(
            """(\d+(?:[.,]\d+)?)\s*(?:sts?|stitches)\D{0,40}?(\d+(?:[.,]\d+)?)\s*(?:rows?|rnds?|rounds?)""",
            line,
        ) ?: return null
        val stitches = number(match.getOrNull(1)) ?: return null
        val rows = number(match.getOrNull(2)) ?: return null

        // Work out whether the gauge is quoted over 10 cm or 4 inches.
        var window = 10.0
        val unit = capture(
            """(\d+(?:[.,]\d+)?)\s*(cm|centimetre|centimeter|in\b|inch|inches|")""", line,
        )
        if (unit != null) {
            val value = number(unit.getOrNull(1))
            val label = unit.getOrNull(2)?.lowercase() ?: ""
            if (value != null) {
                window = if (label.startsWith("in") || label == "\"") value * 2.54 else value
            }
        } else if (line.lowercase().contains("4\"") || line.lowercase().contains("4 in")) {
            window = 10.16
        }
        if (window <= 0) return null
        return Gauge.fromSwatch(stitches, rows, window)
    }

    fun parseCastOn(line: String): Int? {
        // The \b stops "co" matching inside another word.
        val match = capture("""(?:cast on|\bco)\s+(\d+)\s*(?:sts?|stitches)?""", line) ?: return null
        return number(match.getOrNull(1))?.toInt()
    }

    fun parseRowLine(line: String): ParsedRow? {
        val match = capture(
            """^(rows?|rnds?|rounds?)\s*([\d\s,\-–and]+?)\s*(?:\((rs|ws)\))?\s*[:.]\s*(.+)$""",
            line,
        ) ?: return null

        val keyword = (match.getOrNull(1) ?: "Row").replaceFirstChar { it.uppercase() }
        val numbers = (match.getOrNull(2) ?: "").trim()
        val side = match.getOrNull(3)?.uppercase()
        val body = (match.getOrNull(4) ?: "").trim()
        if (body.isEmpty()) return null

        return ParsedRow(label = "$keyword $numbers", side = side, text = body)
    }

    // MARK: - Row evaluation

    /** Works out the stitch count a row ends on, given what it started with. */
    fun evaluate(text: String, incoming: Int?): Outcome {
        val issues = mutableListOf<String>()
        val unknown = mutableListOf<String>()
        val normalised = normalise(text)
        val stated = statedCount(normalised)

        if (incoming == null) return Outcome(produced = stated)

        val expanded = expandBrackets(normalised)

        val star = splitStarRepeat(expanded)
        if (star != null) {
            val prefix = tally(star.prefix, unknown)
            val body = tally(star.body, unknown)
            val suffix = tally(star.suffix, unknown)

            if (body.consumes <= 0) {
                issues += "The repeated section does not use any stitches, so it cannot be counted."
                return Outcome(stated, issues, unknown)
            }
            // "to last N sts" describes the same stitches the suffix works, so
            // it is a consistency check, not an extra deduction.
            if (star.leaveStitches > 0 && suffix.consumes != star.leaveStitches) {
                issues += "‘to last ${star.leaveStitches} sts’ but the instructions after it use " +
                    "${suffix.consumes} sts."
            }
            val available = incoming - prefix.consumes - suffix.consumes
            if (available < 0) {
                issues += "This row needs more stitches than the $incoming on the needle."
                return Outcome(stated, issues, unknown)
            }
            val repeats = available / body.consumes
            if (available % body.consumes != 0) {
                issues += "The repeat does not divide evenly: $available sts left for a " +
                    "${body.consumes}-st repeat leaves ${available % body.consumes} over."
            }
            val produced = prefix.produces + repeats * body.produces + suffix.produces
            checkStated(produced, stated, issues)
            return Outcome(produced, issues, unknown)
        }

        val flexible = flexibleConsumption(expanded)
        val fixed = tally(flexible.tokens, unknown)
        if (flexible.hasToEnd) {
            // The instructions after "to last N sts" are exactly those N sts —
            // anything before the marker is not part of that count.
            val after = tally(flexible.after, mutableListOf())
            if (flexible.leaveStitches > 0 && after.consumes != flexible.leaveStitches) {
                issues += "‘to last ${flexible.leaveStitches} sts’ but the instructions after it use " +
                    "${after.consumes} sts."
            }
            val available = incoming - fixed.consumes
            if (available < 0) {
                issues += "This row needs more stitches than the $incoming on the needle."
                return Outcome(stated, issues, unknown)
            }
            val produced = fixed.produces + available
            checkStated(produced, stated, issues)
            return Outcome(produced, issues, unknown)
        }

        if (fixed.consumes != incoming) {
            issues += "This row uses ${fixed.consumes} sts but $incoming were on the needle."
        }
        checkStated(fixed.produces, stated, issues)
        return Outcome(fixed.produces, issues, unknown)
    }

    private fun checkStated(produced: Int, stated: Int?, issues: MutableList<String>) {
        if (stated != null && stated != produced) {
            issues += "The pattern says $stated sts at the end of this row; " +
                "the instructions give $produced."
        }
    }

    // MARK: - Tokenising

    private fun tally(tokens: List<String>, unknown: MutableList<String>): Tally {
        var consumes = 0
        var produces = 0
        for (token in tokens) {
            val operation = interpret(token)
            if (operation == null) {
                if (token.isNotEmpty()) unknown += token
                continue
            }
            consumes += operation.consumes
            produces += operation.produces
        }
        return Tally(consumes, produces)
    }

    private val noOps = listOf("pm", "sm", "place marker", "slip marker", "remove marker", "turn", "rm")

    private val fixedOperations: List<Triple<String, Int, Int>> = listOf(
        Triple("sl2-k1-p2sso", 3, 1), Triple("sl2 k1 p2sso", 3, 1),
        Triple("s2kp", 3, 1), Triple("sk2p", 3, 1),
        Triple("cdd", 3, 1), Triple("k3tog", 3, 1), Triple("p3tog", 3, 1),
        Triple("k2tog tbl", 2, 1), Triple("p2tog tbl", 2, 1),
        Triple("k2tog", 2, 1), Triple("p2tog", 2, 1), Triple("ssk", 2, 1), Triple("ssp", 2, 1),
        Triple("kfb", 1, 2), Triple("pfb", 1, 2),
        Triple("m1lp", 0, 1), Triple("m1rp", 0, 1), Triple("m1l", 0, 1), Triple("m1r", 0, 1),
        Triple("m1p", 0, 1), Triple("m1", 0, 1),
        Triple("yo", 0, 1), Triple("yon", 0, 1), Triple("yfwd", 0, 1), Triple("yrn", 0, 1),
    )

    /** Turns one instruction into its stitch arithmetic. */
    fun interpret(token: String): StitchOperation? {
        val text = token.trim()
        if (text.isEmpty()) return null

        for (noop in noOps) {
            if (text == noop || text.startsWith("$noop ")) return StitchOperation(text, 0, 0)
        }
        for ((name, consumes, produces) in fixedOperations) {
            if (text == name || text.startsWith("$name ")) return StitchOperation(text, consumes, produces)
        }

        capture("""^(k|p|knit|purl|sl|slip)\s*(\d+)?(?:\s*sts?)?(?:\s*tbl)?$""", text)?.let { match ->
            val count = match.getOrNull(2)?.toIntOrNull() ?: 1
            return StitchOperation(text, count, count)
        }
        capture("""^(?:bind off|bo|cast off)\s*(\d+)""", text)?.let { match ->
            match.getOrNull(1)?.toIntOrNull()?.let { return StitchOperation(text, it, 0) }
        }
        capture("""^(?:cast on|co)\s*(\d+)""", text)?.let { match ->
            match.getOrNull(1)?.toIntOrNull()?.let { return StitchOperation(text, 0, it) }
        }
        return null
    }

    // MARK: - Structure

    fun normalise(text: String): String = text.lowercase()
        .replace("–", "-").replace("—", "-").replace("×", "x")
        .replace("  ", " ")
        .trim()

    /** Reads a trailing "(96 sts)" or "- 96 sts" the pattern states for itself. */
    fun statedCount(text: String): Int? =
        capture("""[(\-]\s*(\d+)\s*sts?\s*\)?\s*$""", text)?.getOrNull(1)?.toIntOrNull()

    /** Expands "[k2, p2] 3 times" and "(k1, yo) x4" into plain instructions. */
    fun expandBrackets(text: String): String {
        var working = text
        val regex = Regex("""[\[(]([^\])]+)[\])]\s*(?:x\s*)?(\d+)\s*(?:times?)?""", RegexOption.IGNORE_CASE)
        // Bounded so a malformed pattern cannot loop forever.
        repeat(8) {
            val match = regex.find(working) ?: return working
            val count = match.groupValues[2].toIntOrNull() ?: return working
            if (count <= 0 || count >= 400) return working
            val body = match.groupValues[1].trim()
            val expansion = List(count) { body }.joinToString(", ")
            working = working.substring(0, match.range.first) + expansion +
                working.substring(match.range.last + 1)
        }
        return working
    }

    /** Splits "k3, *p2, k2; rep from * to last 3 sts, k3" into its three parts. */
    private fun splitStarRepeat(text: String): StarRepeat? {
        val star = text.indexOf('*')
        if (star < 0) return null
        val prefixText = text.substring(0, star)
        val rest = text.substring(star + 1)

        val repeatMatch = Regex("""rep(eat)?\s+from\s*\*""", RegexOption.IGNORE_CASE).find(rest)
            ?: return null
        val bodyText = rest.substring(0, repeatMatch.range.first)
        val tail = rest.substring(repeatMatch.range.last + 1)

        var leave = 0
        var suffixText = tail
        val lastMatch = Regex("""to\s+last\s+(\d+)\s*sts?""", RegexOption.IGNORE_CASE).find(tail)
        if (lastMatch != null) {
            leave = lastMatch.groupValues[1].toIntOrNull() ?: 0
            suffixText = tail.substring(lastMatch.range.last + 1)
        } else {
            Regex("""to\s+end""", RegexOption.IGNORE_CASE).find(tail)?.let {
                suffixText = tail.substring(it.range.last + 1)
            }
        }

        return StarRepeat(tokens(prefixText), tokens(bodyText), tokens(suffixText), leave)
    }

    /** Handles "knit to end" and "knit to last 3 sts" outside a star repeat. */
    private fun flexibleConsumption(text: String): Flexible {
        var hasToEnd = false
        var leave = 0
        val before = mutableListOf<String>()
        val after = mutableListOf<String>()

        for (token in tokens(text)) {
            val lastMatch = capture("""^(?:k|p|knit|purl)\s*to\s*last\s*(\d+)\s*sts?$""", token)
            if (lastMatch != null) {
                hasToEnd = true
                leave = lastMatch.getOrNull(1)?.toIntOrNull() ?: 0
                continue
            }
            if (capture("""^(?:k|p|knit|purl|work)\s*to\s*(?:end|marker)$""", token) != null) {
                hasToEnd = true
                continue
            }
            if (hasToEnd) after += token else before += token
        }
        return Flexible(before, after, hasToEnd, leave)
    }

    fun tokens(text: String): List<String> = text
        .replace(";", ",")
        .split(",")
        .map { it.trim(' ', '.', ';', ':', '*', '(', ')', '[', ']', '-') }
        .filter { it.isNotEmpty() }
        // Drop trailing "(96 sts)" style annotations.
        .filter { capture("""^\d+\s*sts?$""", it) == null }

    // MARK: - Regex helper

    /** Returns the whole match plus each capture group, or null if no match. */
    private fun capture(pattern: String, text: String): List<String?>? {
        val match = Regex(pattern, RegexOption.IGNORE_CASE).find(text) ?: return null
        return (0 until match.groups.size).map { match.groups[it]?.value }
    }

    private fun number(value: String?): Double? =
        value?.replace(",", ".")?.toDoubleOrNull()
}
