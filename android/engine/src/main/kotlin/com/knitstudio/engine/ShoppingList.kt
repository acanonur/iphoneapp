package com.knitstudio.engine

import kotlinx.serialization.Serializable

import java.util.Locale

/** How much of the project is worked in one particular colour. */
@Serializable
data class ColourAllocation(
    val yarn: Yarn,
    /** Fraction of the total yarn, 0...1. */
    val share: Double,
    /** "Main colour", "Contrast A"… */
    val role: String,
) {
    init {
        require(share.isFinite()) { "share must be finite" }
    }

    val clampedShare: Double get() = share.coerceIn(0.0, 1.0)

    companion object {
        fun letter(index: Int): String = ('A' + (maxOf(0, index) % 26)).toString()

        fun roleName(index: Int): String =
            if (index == 0) "Main colour (MC)" else "Contrast ${letter(index)}"

        /** A single-colour project. */
        fun single(yarn: Yarn): List<ColourAllocation> =
            listOf(ColourAllocation(yarn, 1.0, "Main colour (MC)"))

        /** Allocations taken straight from a chart's colour counts. */
        fun fromChart(chart: ColourChart): List<ColourAllocation> {
            val shares = chart.colourShares()
            return chart.palette.mapIndexed { index, yarn ->
                ColourAllocation(yarn, shares[index] ?: 0.0, roleName(index))
            }
        }

        /** Normalises a set of allocations so the shares add up to exactly 1. */
        fun normalised(allocations: List<ColourAllocation>): List<ColourAllocation> {
            val total = allocations.sumOf { it.clampedShare }
            if (total <= 0) return allocations
            return allocations.map { it.copy(share = it.clampedShare / total) }
        }
    }
}

/** One line of the shopping list. */
data class ShoppingLine(
    val yarn: Yarn,
    val role: String,
    val metres: Double,
    val grams: Double,
    val balls: Int,
    val cost: Double?,
) {
    /** Yarn bought beyond what the estimate says is needed. */
    val spareMetres: Double get() = balls * yarn.ballMetres - metres
}

data class ShoppingList(
    val lines: List<ShoppingLine>,
    val needles: List<String>,
    val notions: List<String>,
    val safetyMargin: Double,
) {
    val totalBalls: Int get() = lines.sumOf { it.balls }
    val totalMetres: Double get() = lines.sumOf { it.metres }
    val totalGrams: Double get() = lines.sumOf { it.grams }

    val totalCost: Double?
        get() {
            val costs = lines.mapNotNull { it.cost }
            return if (lines.isNotEmpty() && costs.size == lines.size) costs.sum() else null
        }

    fun plainText(projectName: String): String {
        val out = mutableListOf("Shopping list — $projectName", "")
        lines.forEach { line ->
            out += String.format(
                Locale.ROOT, "• %d × %s (%.0f g / %.0f m) — %s",
                line.balls, line.yarn.displayName, line.yarn.ballGrams, line.yarn.ballMetres, line.role,
            )
            out += String.format(Locale.ROOT, "    needs %.0f m ≈ %.0f g", line.metres, line.grams)
        }
        totalCost?.let {
            out += ""
            out += String.format(Locale.ROOT, "Estimated total: %.2f", it)
        }
        out += ""
        out += "Needles"
        needles.forEach { out += "• $it" }
        out += ""
        out += "Notions"
        notions.forEach { out += "• $it" }
        out += ""
        out += String.format(
            Locale.ROOT,
            "Quantities include a %.0f%% margin. Buy every ball of a colour in the same " +
                "dye lot — a second lot bought later will not match.",
            safetyMargin * 100,
        )
        return out.joinToString("\n")
    }
}

object ShoppingListBuilder {

    fun build(
        plan: ProjectPlan,
        kind: PatternKind,
        allocations: List<ColourAllocation>,
        structure: FabricStructure,
        options: ProjectOptions,
    ): ShoppingList {
        val totalMetres = plan.metres()
        val normalised = ColourAllocation.normalised(allocations)

        val lines = normalised.filter { it.share > 0 }.map { allocation ->
            val metres = totalMetres * allocation.share
            val balls = YarnEstimator.balls(metres, allocation.yarn, options.safetyMargin)
            ShoppingLine(
                yarn = allocation.yarn,
                role = allocation.role,
                metres = metres,
                grams = YarnEstimator.grams(metres, allocation.yarn),
                balls = balls,
                cost = allocation.yarn.pricePerBall?.let { balls * it },
            )
        }

        val weight = normalised.firstOrNull()?.yarn?.weight ?: YarnWeight.matching(plan.gauge)
        return ShoppingList(
            lines = lines,
            needles = needles(kind, weight),
            notions = notions(kind, structure, lines.size),
            safetyMargin = options.safetyMargin,
        )
    }

    fun needles(kind: PatternKind, weight: YarnWeight): List<String> {
        val main = String.format(Locale.ROOT, "%.2fmm", weight.suggestedNeedleMM)
            .replace(".00mm", "mm")
        val rib = String.format(Locale.ROOT, "%.2fmm", maxOf(1.5, weight.suggestedNeedleMM - 0.5))
            .replace(".00mm", "mm")

        val list = mutableListOf<String>()
        when (kind) {
            PatternKind.SCARF, PatternKind.BLANKET ->
                list += "$main straight needles, or a long circular to hold the stitches"
            PatternKind.COWL -> {
                list += "$main circular needle, 40–60 cm"
                list += "$rib circular needle for the ribbed edges"
            }
            PatternKind.HAT -> {
                list += "$main circular needle, 40 cm"
                list += "$rib circular needle, 40 cm, for the brim"
                list += "$main double-pointed needles for the crown (or magic loop)"
            }
            PatternKind.RAGLAN_SWEATER -> {
                list += "$main circular needle, 80 cm, for the body"
                list += "$main circular needle, 40 cm, for the yoke and sleeves"
                list += "$rib circular needles, 40 cm and 80 cm, for the ribbing"
            }
            PatternKind.SOCK ->
                list += "$main double-pointed needles, or a 80 cm circular for magic loop"
            PatternKind.MITTEN -> {
                list += "$main double-pointed needles, or a 80 cm circular for magic loop"
                list += "$rib needles for the cuffs"
            }
            PatternKind.SHAWL ->
                list += "$main circular needle, 80–100 cm, to hold the growing stitch count"
        }
        list += "A needle gauge, so you can prove the size before you swatch"
        return list
    }

    fun notions(kind: PatternKind, structure: FabricStructure, colours: Int): List<String> {
        val list = mutableListOf("Tapestry needle for weaving in ends", "Tape measure", "Scissors")

        when (kind) {
            PatternKind.HAT -> list += "8 stitch markers for the crown sections"
            PatternKind.RAGLAN_SWEATER -> {
                list += "8 stitch markers (4 raglan lines, plus the round start)"
                list += "Waste yarn or stitch holders for the sleeve stitches"
            }
            PatternKind.SOCK, PatternKind.MITTEN -> {
                list += "2 stitch markers"
                list += "Waste yarn for the held stitches"
            }
            PatternKind.SHAWL -> {
                list += "2 stitch markers for the spine"
                list += "Blocking wires and pins — a shawl is made by its blocking"
            }
            PatternKind.COWL -> list += "1 stitch marker for the start of the round"
            PatternKind.SCARF, PatternKind.BLANKET -> list += "Row counter"
        }

        when (structure) {
            FabricStructure.CABLES -> list += "Cable needle"
            FabricStructure.LACE -> {
                list += "Lifeline thread — a dropped lace stitch is unrecoverable without one"
                list += "Blocking mats and pins"
            }
            FabricStructure.STRANDED_COLOURWORK ->
                list += "Yarn guide or a spare finger technique for holding two colours"
            FabricStructure.BRIOCHE -> list += "Locking markers — brioche is very hard to tink back"
            else -> Unit
        }

        if (colours > 1) list += "Bobbins or small bags to stop the colours tangling"
        list += "Blocking mats and rustproof pins"
        return list
    }
}
