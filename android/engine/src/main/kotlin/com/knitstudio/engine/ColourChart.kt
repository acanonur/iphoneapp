package com.knitstudio.engine

/** How a chart is worked, which decides how each row is read. */
enum class ChartWorking(val displayName: String) {
    /** Back and forth: RS rows read right to left, WS rows left to right. */
    FLAT("Flat (back and forth)"),
    /** In the round: every row reads right to left. */
    IN_THE_ROUND("In the round"),
}

/** A colourwork chart: a grid where every cell names a colour in the palette. */
data class ColourChart(
    val name: String,
    val width: Int,
    val height: Int,
    /**
     * Row-major, `width * height` entries, each an index into [palette].
     * Row 0 is the bottom of the chart — the first row knitted.
     */
    val cells: List<Int>,
    val palette: List<Yarn>,
    val working: ChartWorking = ChartWorking.IN_THE_ROUND,
    val notes: String = "",
) {
    companion object {
        /** Builds a chart, padding or trimming cells to the exact grid size. */
        fun of(
            name: String,
            width: Int,
            height: Int,
            cells: List<Int>,
            palette: List<Yarn>,
            working: ChartWorking = ChartWorking.IN_THE_ROUND,
            notes: String = "",
        ): ColourChart {
            val w = maxOf(1, width)
            val h = maxOf(1, height)
            val safePalette = palette.ifEmpty {
                listOf(Yarn(name = "Main", hex = "FFFFFF", weight = YarnWeight.LIGHT))
            }
            val expected = w * h
            val sized = when {
                cells.size == expected -> cells
                cells.size > expected -> cells.take(expected)
                else -> cells + List(expected - cells.size) { 0 }
            }
            return ColourChart(name, w, h, sized, safePalette, working, notes)
        }

        fun blank(
            name: String = "New chart",
            width: Int = 20,
            height: Int = 20,
            palette: List<Yarn>,
        ): ColourChart = of(name, width, height, List(maxOf(1, width) * maxOf(1, height)) { 0 }, palette)

        /**
         * Turns text art into a chart. `.` is the main colour, `X` the contrast,
         * `o` a third colour. The first line is the TOP of the chart, because
         * that is how a chart is drawn — but row 0 is the bottom, the first row
         * knitted, so the art is read bottom-up.
         */
        fun fromArt(
            name: String,
            art: String,
            palette: List<Yarn>,
            working: ChartWorking = ChartWorking.IN_THE_ROUND,
        ): ColourChart {
            val lines = art.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
            if (lines.isEmpty()) return blank(name, palette = palette)
            val width = lines.maxOf { it.length }
            val cells = ArrayList<Int>(width * lines.size)
            for (line in lines.reversed()) {
                val row = MutableList(width) { 0 }
                line.forEachIndexed { index, character ->
                    row[index] = when (character) {
                        'X', 'x', '#' -> minOf(1, palette.size - 1)
                        'o', 'O', '*' -> minOf(2, palette.size - 1)
                        else -> 0
                    }
                }
                cells.addAll(row)
            }
            return of(name, width, lines.size, cells, palette, working)
        }
    }

    fun colourIndex(x: Int, y: Int): Int {
        if (x < 0 || x >= width || y < 0 || y >= height) return 0
        return minOf(cells[y * width + x], palette.size - 1)
    }

    fun withCell(index: Int, x: Int, y: Int): ColourChart {
        if (x < 0 || x >= width || y < 0 || y >= height) return this
        val next = cells.toMutableList()
        next[y * width + x] = index.coerceIn(0, palette.size - 1)
        return copy(cells = next)
    }

    /** Cells in the order they are knitted for the given row. */
    fun knittingOrder(row: Int): List<Int> {
        val rowCells = (0 until width).map { colourIndex(it, row) }
        // Charts are read right to left, the direction stitches travel.
        if (working == ChartWorking.IN_THE_ROUND) return rowCells.reversed()
        // Flat: rows 0, 2, 4… are right side and read right to left.
        return if (row % 2 == 0) rowCells.reversed() else rowCells
    }

    val totalStitches: Int get() = width * height

    /** Stitch count per palette index across the whole chart. */
    fun stitchCounts(): Map<Int, Int> =
        cells.groupingBy { it.coerceIn(0, palette.size - 1) }.eachCount()

    /** Fraction of the chart worked in each palette colour. */
    fun colourShares(): Map<Int, Double> {
        val total = maxOf(1, totalStitches).toDouble()
        return stitchCounts().mapValues { it.value / total }
    }

    /**
     * The longest run of a single colour in any row — the float length that
     * decides whether stranded colourwork is comfortable to knit and wear.
     */
    fun longestFloat(): Int {
        var longest = 0
        for (y in 0 until height) {
            var run = 0
            var previous = -1
            for (value in knittingOrder(y)) {
                if (value == previous) run++ else { run = 1; previous = value }
                if (run > longest) longest = run
            }
        }
        return longest
    }

    /** How many colours appear on the busiest row. */
    fun maxColoursPerRow(): Int =
        (0 until height).maxOfOrNull { y -> (0 until width).map { colourIndex(it, y) }.toSet().size } ?: 0

    /** Finished size at a given gauge. */
    fun finishedSize(gauge: Gauge): Pair<Double, Double> =
        gauge.widthForStitches(width.toDouble()) to gauge.lengthForRows(height.toDouble())

    /** A, B, C… labels for the palette, the way charts are legended. */
    fun letter(index: Int): String =
        ('A' + (index.coerceIn(0, palette.size - 1) % 26)).toString()

    val legend: List<Pair<String, Yarn>>
        get() = palette.mapIndexed { index, yarn -> letter(index) to yarn }

    /** Row-by-row written instructions, run-length encoded, in knitting order. */
    fun writtenInstructions(): List<String> = (0 until height).map { y ->
        val row = knittingOrder(y)
        val parts = mutableListOf<String>()
        var run = 0
        var current = row.firstOrNull() ?: 0
        for (value in row) {
            if (value == current) {
                run++
            } else {
                parts += "$run ${letter(current)}"
                current = value
                run = 1
            }
        }
        if (run > 0) parts += "$run ${letter(current)}"

        val label = if (working == ChartWorking.IN_THE_ROUND) {
            "Rnd ${y + 1}"
        } else {
            "Row ${y + 1} (${if (y % 2 == 0) "RS" else "WS"})"
        }
        "$label: ${parts.joinToString(", ")}"
    }

    fun resized(newWidth: Int, newHeight: Int): ColourChart {
        val w = maxOf(1, newWidth)
        val h = maxOf(1, newHeight)
        val next = MutableList(w * h) { 0 }
        for (y in 0 until minOf(h, height)) {
            for (x in 0 until minOf(w, width)) {
                next[y * w + x] = cells[y * width + x]
            }
        }
        return copy(width = w, height = h, cells = next)
    }

    fun mirroredHorizontally(): ColourChart {
        val next = MutableList(cells.size) { 0 }
        for (y in 0 until height) {
            for (x in 0 until width) {
                next[y * width + x] = cells[y * width + (width - 1 - x)]
            }
        }
        return copy(cells = next)
    }

    fun flippedVertically(): ColourChart {
        val next = MutableList(cells.size) { 0 }
        for (y in 0 until height) {
            for (x in 0 until width) {
                next[y * width + x] = cells[(height - 1 - y) * width + x]
            }
        }
        return copy(cells = next)
    }

    /** Warnings a knitter would want before casting on. */
    fun reviewNotes(gauge: Gauge): List<String> {
        val notes = mutableListOf<String>()
        val float = longestFloat()
        if (float > 7) {
            notes += "Longest float is $float stitches. Anything over about 7 catches on fingers — " +
                "trap the yarn mid-float, or edit the chart to break up the run."
        }
        if (maxColoursPerRow() > 2) {
            notes += "Up to ${maxColoursPerRow()} colours appear in one row. Stranded knitting is far " +
                "easier with two per row — consider intarsia or duplicate stitch for the extras."
        }
        if (palette.size > 1) {
            val (w, h) = finishedSize(gauge)
            notes += String.format(
                java.util.Locale.ROOT,
                "At this gauge the chart works out %.1f cm wide by %.1f cm tall.", w, h,
            )
        }
        return notes
    }
}
