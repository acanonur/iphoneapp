package com.knitstudio.engine

import kotlinx.serialization.Serializable

import kotlin.math.ceil

/** Craft Yarn Council standard yarn weight categories (0–7). */
enum class YarnWeight(
    val category: Int,
    val displayName: String,
    /** The names knitters actually use in patterns. */
    val commonNames: String,
    /** Typical stockinette gauge range, in stitches per 10 cm. */
    val gaugeLow: Double,
    val gaugeHigh: Double,
    /** Typical needle size range in millimetres. */
    val needleLowMM: Double,
    val needleHighMM: Double,
    /** A representative ball band, used to pre-fill a new yarn. */
    val ballGrams: Double,
    val ballMetres: Double,
) {
    LACE(0, "Lace", "Lace, 2-ply, cobweb", 33.0, 40.0, 1.5, 2.25, 100.0, 800.0),
    SUPER_FINE(1, "Super Fine", "Fingering, sock, 4-ply", 27.0, 32.0, 2.25, 3.25, 100.0, 400.0),
    FINE(2, "Fine", "Sport, baby", 23.0, 26.0, 3.25, 3.75, 50.0, 155.0),
    LIGHT(3, "Light", "DK, light worsted, 8-ply", 21.0, 24.0, 3.75, 4.5, 50.0, 125.0),
    MEDIUM(4, "Medium", "Worsted, aran, afghan", 16.0, 20.0, 4.5, 5.5, 100.0, 200.0),
    BULKY(5, "Bulky", "Chunky, craft, rug", 12.0, 15.0, 5.5, 8.0, 100.0, 120.0),
    SUPER_BULKY(6, "Super Bulky", "Super chunky, roving", 7.0, 11.0, 8.0, 12.75, 100.0, 60.0),
    JUMBO(7, "Jumbo", "Jumbo, giant", 1.0, 6.0, 12.75, 25.0, 200.0, 40.0);

    val suggestedNeedleMM: Double get() = (needleLowMM + needleHighMM) / 2

    /** Best guess for a swatch gauge before the knitter has measured one. */
    val nominalGauge: Gauge
        get() {
            val sts = (gaugeLow + gaugeHigh) / 2
            // Stockinette rows run roughly 4:3 against stitches.
            return Gauge(sts, sts * 4 / 3)
        }

    companion object {
        fun matching(gauge: Gauge): YarnWeight {
            entries.firstOrNull { gauge.stitchesPer10cm in it.gaugeLow..it.gaugeHigh }?.let { return it }
            return if (gauge.stitchesPer10cm > 40) LACE else JUMBO
        }
    }
}

/** A colour of yarn the knitter owns or intends to buy. */
@Serializable
data class Yarn(
    val id: String = java.util.UUID.randomUUID().toString(),
    val name: String,
    val colourName: String = "",
    /** sRGB hex, e.g. "C8443C". Used for chart rendering and swatches. */
    val hex: String,
    val weight: YarnWeight,
    /** Grams per ball / skein as printed on the band. */
    val ballGrams: Double = weight.ballGrams,
    /** Metres per ball / skein as printed on the band. */
    val ballMetres: Double = weight.ballMetres,
    /** Optional price per ball, in whatever currency the knitter uses. */
    val pricePerBall: Double? = null,
) {
    /** Metres of yarn per gram — the number that actually drives the estimate. */
    val metresPerGram: Double get() = if (ballGrams > 0) ballMetres / ballGrams else 0.0

    val displayName: String get() = if (colourName.isEmpty()) name else "$name — $colourName"

    val normalisedHex: String get() = normaliseHex(hex)

    /** Red, green and blue in 0...1. */
    val rgb: Triple<Double, Double, Double>
        get() {
            val value = normalisedHex.toLongOrNull(16) ?: 0x9E9E9EL
            return Triple(
                ((value shr 16) and 0xFF) / 255.0,
                ((value shr 8) and 0xFF) / 255.0,
                (value and 0xFF) / 255.0,
            )
        }

    companion object {
        fun normaliseHex(hex: String): String {
            var value = hex.uppercase().removePrefix("#")
            value = value.filter { it in "0123456789ABCDEF" }
            if (value.length == 3) value = value.map { "$it$it" }.joinToString("")
            return if (value.length == 6) value else "9E9E9E"
        }
    }
}

/**
 * How much yarn a fabric structure eats relative to plain stockinette at the
 * same measured gauge.
 */
enum class FabricStructure(
    val displayName: String,
    /** Multiplier applied to the stockinette loop length. */
    val yarnFactor: Double,
    val note: String,
) {
    STOCKINETTE("Stockinette", 1.00, "The baseline every estimate is measured against."),
    GARTER("Garter", 1.00, "Garter's extra yarn already shows up in its row gauge."),
    RIBBING("Ribbing", 1.05, "Ribbing pulls in, so a little more yarn per finished cm."),
    SEED("Seed / moss", 1.05, "Alternating knits and purls use slightly more than stockinette."),
    CABLES("Cables", 1.25, "Crossings compress the fabric — budget about a quarter more."),
    LACE("Lace", 0.90, "Yarn-overs replace stitches with holes, so lace goes further."),
    STRANDED_COLOURWORK("Stranded colourwork", 1.18, "Floats across the back add roughly a fifth."),
    INTARSIA("Intarsia", 1.05, "Blocks of colour, no floats — barely more than stockinette."),
    MOSAIC("Mosaic / slip stitch", 1.10, "Slipped stitches carry yarn up over two rows."),
    BRIOCHE("Brioche", 1.85, "Every row is worked twice — budget nearly double.");
}

/** One block of knitting, used to total up stitches for the yarn estimate. */
data class StitchBlock(
    val name: String,
    /** Fractional because tapered sections use an average stitch count. */
    val stitches: Double,
    val structure: FabricStructure = FabricStructure.STOCKINETTE,
) {
    val weightedStitches: Double get() = stitches * structure.yarnFactor
}

/** Turns stitch counts into metres, grams and balls. */
object YarnEstimator {

    /** Metres of yarn consumed by a set of blocks at the given gauge. */
    fun metres(blocks: List<StitchBlock>, gauge: Gauge): Double =
        blocks.sumOf { it.weightedStitches } * gauge.loopLength / 100

    fun metres(
        stitches: Double,
        gauge: Gauge,
        structure: FabricStructure = FabricStructure.STOCKINETTE,
    ): Double = stitches * structure.yarnFactor * gauge.loopLength / 100

    fun grams(metres: Double, yarn: Yarn): Double =
        if (yarn.metresPerGram > 0) metres / yarn.metresPerGram else 0.0

    /** Whole balls to buy, including a safety margin (default 10%). */
    fun balls(metres: Double, yarn: Yarn, safetyMargin: Double = 0.10): Int {
        if (yarn.ballMetres <= 0) return 0
        return maxOf(1, ceil(metres * (1 + safetyMargin) / yarn.ballMetres).toInt())
    }

    /**
     * Grams of fabric per square metre — a useful cross-check and the number
     * that tells you whether a swatch was entered sensibly.
     */
    fun arealDensity(gauge: Gauge, yarn: Yarn): Double {
        val stitchesPerSquareMetre = gauge.stitchesPer10cm * 10 * gauge.rowsPer10cm * 10
        return grams(stitchesPerSquareMetre * gauge.loopLength / 100, yarn)
    }
}
