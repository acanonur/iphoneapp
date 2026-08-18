package com.knitstudio.engine

import java.util.Locale

/**
 * Which units the knitter wants to see. Everything is stored in centimetres
 * internally; this only affects input parsing and display.
 */
enum class UnitSystem {
    METRIC,
    IMPERIAL;

    val lengthLabel: String get() = if (this == METRIC) "cm" else "in"

    /** Gauge is quoted over 10 cm (metric) or 4 in (imperial). */
    val gaugeWindowLabel: String get() = if (this == METRIC) "10 cm" else "4\""

    fun fromCentimetres(cm: Double): Double = if (this == METRIC) cm else cm / 2.54

    fun toCentimetres(value: Double): Double = if (this == METRIC) value else value * 2.54

    fun formatLength(cm: Double, decimals: Int = 1): String =
        String.format(Locale.ROOT, "%.${decimals}f %s", fromCentimetres(cm), lengthLabel)
}

/** A knitted gauge (tension), always normalised to stitches and rows per 10 cm. */
data class Gauge(
    val stitchesPer10cm: Double,
    val rowsPer10cm: Double,
) {
    init {
        require(stitchesPer10cm > 0 && rowsPer10cm > 0) { "gauge must be positive" }
    }

    /** Width of a single stitch, in centimetres. */
    val stitchWidth: Double get() = 10 / stitchesPer10cm

    /** Height of a single row, in centimetres. */
    val rowHeight: Double get() = 10 / rowsPer10cm

    /** How elongated the stitch is. Stockinette normally sits near 0.75. */
    val aspectRatio: Double get() = rowHeight / stitchWidth

    fun stitchesForWidth(cm: Double): Double = cm / 10 * stitchesPer10cm
    fun rowsForLength(cm: Double): Double = cm / 10 * rowsPer10cm
    fun widthForStitches(count: Double): Double = count / stitchesPer10cm * 10
    fun lengthForRows(count: Double): Double = count / rowsPer10cm * 10

    /**
     * Length of yarn consumed by one stitch, in centimetres.
     *
     * Munden's relaxed plain-knit relations: courses per unit length = Kc / l
     * and wales per unit length = Kw / l, where l is the loop length. Solving
     * each for l gives two independent estimates from the knitter's own swatch;
     * averaging them is what makes the yarn estimate self-calibrating.
     */
    val loopLength: Double
        get() {
            val walesPerCm = stitchesPer10cm / 10
            val coursesPerCm = rowsPer10cm / 10
            return (WALES_CONSTANT / walesPerCm + COURSES_CONSTANT / coursesPerCm) / 2
        }

    /**
     * A swatch whose loop length is wildly out of proportion to its stitch
     * width usually means it was measured or entered wrong.
     */
    val looksPlausible: Boolean
        get() {
            val ratio = loopLength / stitchWidth
            return ratio > 2.5 && ratio < 5.5
        }

    fun describe(units: UnitSystem): String = if (units == UnitSystem.METRIC) {
        String.format(Locale.ROOT, "%.0f sts × %.0f rows / 10 cm", stitchesPer10cm, rowsPer10cm)
    } else {
        String.format(
            Locale.ROOT, "%.1f sts × %.1f rows / 4\"",
            stitchesPer10cm * 2.54 * 4 / 10, rowsPer10cm * 2.54 * 4 / 10,
        )
    }

    companion object {
        private const val WALES_CONSTANT = 3.8
        private const val COURSES_CONSTANT = 5.0

        /** Builds a gauge from a swatch measured over an arbitrary window. */
        fun fromSwatch(stitches: Double, rows: Double, overCm: Double): Gauge {
            val window = maxOf(0.1, overCm)
            return Gauge(stitches * 10 / window, rows * 10 / window)
        }
    }
}
