package com.knitstudio.engine

/** A single headline number shown at the top of a plan. */
data class PlanFact(
    val label: String,
    val value: String,
    val detail: String? = null,
)

/** One instruction the knitter follows. */
data class PlanStep(
    val text: String,
    /** Stitch count in play once this step is finished. */
    val stitchCount: Int? = null,
    /** Rows or rounds this step occupies. */
    val rows: Int? = null,
    /** Set when the step matters enough to call out (a heel turn, a split). */
    val isMilestone: Boolean = false,
)

/** A named run of steps — cuff, yoke, heel, crown. */
data class PlanSection(
    val name: String,
    val detail: String? = null,
    val steps: List<PlanStep>,
) {
    val totalRows: Int get() = steps.sumOf { it.rows ?: 0 }
}

/** Everything the calculator works out for one project. */
data class ProjectPlan(
    val title: String,
    val gauge: Gauge,
    val facts: List<PlanFact>,
    val sections: List<PlanSection>,
    /** Stitch blocks feeding the yarn estimate. */
    val blocks: List<StitchBlock>,
    val notes: List<String> = emptyList(),
    /** Things that are off: gauge implausible, measurements inconsistent. */
    val warnings: List<String> = emptyList(),
) {
    val totalStitches: Double get() = blocks.sumOf { it.stitches }
    val totalRows: Int get() = sections.sumOf { it.totalRows }

    fun metres(): Double = YarnEstimator.metres(blocks, gauge)

    fun fact(label: String): String? = facts.firstOrNull { it.label == label }?.value

    /** Flat plain-text rendering, used for sharing and export. */
    fun plainText(units: UnitSystem): String {
        val lines = mutableListOf(title, "=".repeat(title.length), "")
        lines += "Gauge: ${gauge.describe(units)}"
        lines += ""
        facts.forEach { fact ->
            lines += if (fact.detail != null) {
                "${fact.label}: ${fact.value}  (${fact.detail})"
            } else {
                "${fact.label}: ${fact.value}"
            }
        }
        sections.forEach { section ->
            lines += ""
            lines += section.name.uppercase()
            section.detail?.let { lines += it }
            section.steps.forEach { step ->
                var line = "  • ${step.text}"
                step.stitchCount?.let { line += " ($it sts)" }
                lines += line
            }
        }
        if (notes.isNotEmpty()) {
            lines += ""
            lines += "NOTES"
            notes.forEach { lines += "  • $it" }
        }
        if (warnings.isNotEmpty()) {
            lines += ""
            lines += "CHECK THESE"
            warnings.forEach { lines += "  ! $it" }
        }
        return lines.joinToString("\n")
    }
}

/** Common body measurements a project is calculated from. Stored in cm. */
data class BodyMeasurements(
    val chest: Double = 100.0,
    val headCircumference: Double = 56.0,
    val neckCircumference: Double = 38.0,
    val upperArm: Double = 34.0,
    val wrist: Double = 20.0,
    val bodyLength: Double = 62.0,
    val sleeveLength: Double = 45.0,
    val footCircumference: Double = 23.0,
    val footLength: Double = 24.0,
    val handCircumference: Double = 20.0,
    val handLength: Double = 19.0,
) {
    companion object {
        /** Standard adult sizes, so a knitter who has not measured can start. */
        val sizePresets: List<Pair<String, BodyMeasurements>> = listOf(
            "Child 6–8" to BodyMeasurements(
                chest = 66.0, headCircumference = 51.0, neckCircumference = 30.0, upperArm = 22.0,
                wrist = 15.0, bodyLength = 42.0, sleeveLength = 33.0,
                footCircumference = 17.0, footLength = 18.0,
                handCircumference = 15.0, handLength = 14.0,
            ),
            "Adult XS" to BodyMeasurements(
                chest = 82.0, headCircumference = 54.0, neckCircumference = 34.0, upperArm = 27.0,
                wrist = 16.0, bodyLength = 56.0, sleeveLength = 43.0,
                footCircumference = 20.0, footLength = 22.0,
                handCircumference = 17.0, handLength = 17.0,
            ),
            "Adult S" to BodyMeasurements(
                chest = 90.0, headCircumference = 55.0, neckCircumference = 36.0, upperArm = 30.0,
                wrist = 17.0, bodyLength = 59.0, sleeveLength = 44.0,
                footCircumference = 21.0, footLength = 23.0,
                handCircumference = 18.0, handLength = 18.0,
            ),
            "Adult M" to BodyMeasurements(),
            "Adult L" to BodyMeasurements(
                chest = 110.0, headCircumference = 57.0, neckCircumference = 40.0, upperArm = 37.0,
                wrist = 21.0, bodyLength = 65.0, sleeveLength = 46.0,
                footCircumference = 25.0, footLength = 26.0,
                handCircumference = 22.0, handLength = 20.0,
            ),
            "Adult XL" to BodyMeasurements(
                chest = 122.0, headCircumference = 58.0, neckCircumference = 42.0, upperArm = 41.0,
                wrist = 22.0, bodyLength = 68.0, sleeveLength = 47.0,
                footCircumference = 27.0, footLength = 27.0,
                handCircumference = 24.0, handLength = 21.0,
            ),
        )
    }
}

enum class Difficulty(val displayName: String, val order: Int) {
    BEGINNER("Beginner", 0),
    EASY("Easy", 1),
    INTERMEDIATE("Intermediate", 2),
    ADVANCED("Advanced", 3),
}
