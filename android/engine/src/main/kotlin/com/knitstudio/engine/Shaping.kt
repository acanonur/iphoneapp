package com.knitstudio.engine

import kotlin.math.abs
import kotlin.math.floor

/**
 * Swift's `Double.rounded()` rounds halves away from zero. Kotlin's `round()`
 * does not, and every stitch count in this engine was verified against the
 * Swift behaviour — so the port uses this everywhere the Swift used `.rounded()`.
 */
internal fun Double.swiftRounded(): Double =
    if (this < 0) -floor(-this + 0.5) else floor(this + 0.5)

internal fun Double.swiftRoundedToInt(): Int = swiftRounded().toInt()

/** Result of spreading shaping points evenly across a row. */
data class EvenDistribution(
    /** Number of stitches in each gap, in the order they are worked. */
    val segments: List<Int>,
    /** The smaller of the two gap sizes used. */
    val base: Int,
    /** How many gaps use `base + 1` stitches. */
    val longGaps: Int,
) {
    val totalStitches: Int get() = segments.sum()
    val shapingPoints: Int get() = segments.size

    /** Plain-language description a knitter can follow at the needles. */
    val instruction: String
        get() = when {
            segments.isEmpty() -> "no shaping needed"
            longGaps == 0 -> "work $base sts between each of the ${segments.size} shaping points"
            else -> {
                val short = segments.size - longGaps
                "$longGaps× ${base + 1} sts and $short× $base sts between shaping points"
            }
        }
}

/** Stitch and row arithmetic shared by every calculator. */
object Shaping {

    /**
     * Rounds [value] to the nearest [multiple], offset by [offset] (for stitch
     * patterns needing "a multiple of 8 sts + 1"). Never fewer than one repeat.
     */
    fun roundToMultiple(value: Double, multiple: Int, offset: Int = 0): Int {
        if (multiple <= 1) return maxOf(1, value.swiftRoundedToInt())
        val repeats = maxOf(1, ((value - offset) / multiple).swiftRoundedToInt())
        return repeats * multiple + offset
    }

    /**
     * Distributes [count] shaping points across [over] stitches.
     * Returns null when there are not enough stitches to shape into.
     */
    fun distributeEvenly(count: Int, over: Int): EvenDistribution? {
        if (count <= 0) return EvenDistribution(emptyList(), 0, 0)
        if (count > over) return null

        val base = over / count
        val remainder = over % count
        val segments = (0 until count).map { if (it < remainder) base + 1 else base }
        return EvenDistribution(segments, base, remainder)
    }

    /**
     * Row numbers on which [events] shaping rows should fall, spread across
     * [rows] rows. Always strictly increasing.
     */
    fun spreadRows(events: Int, over: Int): List<Int> {
        if (events <= 0 || over <= 0) return emptyList()
        val result = ArrayList<Int>(events)
        var previous = 0
        for (index in 1..events) {
            val ideal = (index.toDouble() * over / events).swiftRoundedToInt()
            val row = maxOf(previous + 1, ideal)
            result.add(row)
            previous = row
        }
        return result
    }

    /** Describes a repeating shaping rhythm, e.g. "every 6th round 12 times". */
    fun rhythm(events: Int, over: Int, unit: String = "row"): String {
        if (events <= 0) return "work even"
        val interval = maxOf(1, over / events)
        val times = if (events == 1) "once" else "$events times"
        return "every ${ordinal(interval)} $unit $times"
    }

    fun ordinal(value: Int): String {
        val suffix = when {
            value % 100 in 11..13 -> "th"
            value % 10 == 1 -> "st"
            value % 10 == 2 -> "nd"
            value % 10 == 3 -> "rd"
            else -> "th"
        }
        return "$value$suffix"
    }
}
