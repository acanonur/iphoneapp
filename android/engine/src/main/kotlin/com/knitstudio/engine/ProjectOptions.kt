package com.knitstudio.engine

import kotlinx.serialization.Serializable

enum class HatStyle(val displayName: String, val height: Double) {
    CLASSIC("Classic beanie", 22.0),
    SLOUCHY("Slouchy", 28.0),
    FOLDED_BRIM("Folded brim", 27.0),
}

/**
 * Every knob a calculator might read. Each calculator uses the subset that
 * applies to it, so one options object can back the whole UI.
 */
@Serializable
data class ProjectOptions(
    /** Fractional ease. Positive is roomier than the body, negative is snug. */
    val ease: Double = 0.08,

    // Hats
    val hatStyle: HatStyle = HatStyle.CLASSIC,
    val crownSections: Int = 8,

    // Ribbing / edgings
    val ribDepth: Double = 5.0,
    val cuffDepth: Double = 4.0,

    // Sweaters
    val raglanStitches: Int = 2,

    // Socks
    val legLength: Double = 15.0,

    // Flat pieces
    val width: Double = 25.0,
    val length: Double = 180.0,
    val edgeStitches: Int = 2,

    // Shawls
    val wingspan: Double = 180.0,
    val increasesPerRightSideRow: Int = 4,

    // Cowls
    val cowlCircumference: Double = 60.0,
    val cowlHeight: Double = 30.0,

    // Stitch pattern repeat the cast-on must respect.
    val stitchMultiple: Int = 1,
    val stitchOffset: Int = 0,

    /** Extra yarn bought as insurance, as a fraction. */
    val safetyMargin: Double = 0.10,
)

enum class MeasurementField(val label: String) {
    CHEST("Chest / bust"),
    HEAD_CIRCUMFERENCE("Head circumference"),
    NECK_CIRCUMFERENCE("Neck circumference"),
    UPPER_ARM("Upper arm"),
    WRIST("Wrist"),
    BODY_LENGTH("Body length (shoulder to hem)"),
    SLEEVE_LENGTH("Sleeve length (underarm to cuff)"),
    FOOT_CIRCUMFERENCE("Foot circumference (around the ball)"),
    FOOT_LENGTH("Foot length (heel to toe)"),
    HAND_CIRCUMFERENCE("Hand circumference"),
    HAND_LENGTH("Hand length (wrist to fingertip)");

    fun valueIn(m: BodyMeasurements): Double = when (this) {
        CHEST -> m.chest
        HEAD_CIRCUMFERENCE -> m.headCircumference
        NECK_CIRCUMFERENCE -> m.neckCircumference
        UPPER_ARM -> m.upperArm
        WRIST -> m.wrist
        BODY_LENGTH -> m.bodyLength
        SLEEVE_LENGTH -> m.sleeveLength
        FOOT_CIRCUMFERENCE -> m.footCircumference
        FOOT_LENGTH -> m.footLength
        HAND_CIRCUMFERENCE -> m.handCircumference
        HAND_LENGTH -> m.handLength
    }

    fun setIn(m: BodyMeasurements, value: Double): BodyMeasurements = when (this) {
        CHEST -> m.copy(chest = value)
        HEAD_CIRCUMFERENCE -> m.copy(headCircumference = value)
        NECK_CIRCUMFERENCE -> m.copy(neckCircumference = value)
        UPPER_ARM -> m.copy(upperArm = value)
        WRIST -> m.copy(wrist = value)
        BODY_LENGTH -> m.copy(bodyLength = value)
        SLEEVE_LENGTH -> m.copy(sleeveLength = value)
        FOOT_CIRCUMFERENCE -> m.copy(footCircumference = value)
        FOOT_LENGTH -> m.copy(footLength = value)
        HAND_CIRCUMFERENCE -> m.copy(handCircumference = value)
        HAND_LENGTH -> m.copy(handLength = value)
    }
}

/** The project types the calculator can plan. */
enum class PatternKind(
    val displayName: String,
    val blurb: String,
    val difficulty: Difficulty,
) {
    SCARF("Scarf", "A flat rectangle. The best first project.", Difficulty.BEGINNER),
    BLANKET("Blanket", "A big rectangle — plan the yarn before you start.", Difficulty.BEGINNER),
    COWL("Cowl", "A tube worked in the round, no shaping.", Difficulty.EASY),
    HAT("Hat", "Ribbed brim, straight body, shaped crown.", Difficulty.EASY),
    RAGLAN_SWEATER(
        "Top-down raglan sweater",
        "Cast on at the neck, increase to the underarms, split, work down.",
        Difficulty.ADVANCED,
    ),
    SOCK("Socks", "Cuff down: leg, heel flap, gusset, foot, toe.", Difficulty.ADVANCED),
    MITTEN("Mittens", "Cuff, thumb gusset, hand, shaped tip.", Difficulty.INTERMEDIATE),
    SHAWL("Triangle shawl", "Centre-out triangle, increases every right-side row.", Difficulty.INTERMEDIATE);

    /** Which measurements the form should ask for. */
    val relevantMeasurements: List<MeasurementField>
        get() = when (this) {
            SCARF, BLANKET, COWL, SHAWL -> emptyList()
            HAT -> listOf(MeasurementField.HEAD_CIRCUMFERENCE)
            RAGLAN_SWEATER -> listOf(
                MeasurementField.CHEST, MeasurementField.NECK_CIRCUMFERENCE,
                MeasurementField.BODY_LENGTH, MeasurementField.SLEEVE_LENGTH,
                MeasurementField.UPPER_ARM, MeasurementField.WRIST,
            )
            SOCK -> listOf(MeasurementField.FOOT_CIRCUMFERENCE, MeasurementField.FOOT_LENGTH)
            MITTEN -> listOf(MeasurementField.HAND_CIRCUMFERENCE, MeasurementField.HAND_LENGTH)
        }

    fun makePlan(
        gauge: Gauge,
        measurements: BodyMeasurements = BodyMeasurements(),
        options: ProjectOptions = ProjectOptions(),
        structure: FabricStructure = FabricStructure.STOCKINETTE,
        units: UnitSystem = UnitSystem.METRIC,
    ): ProjectPlan = when (this) {
        SCARF, BLANKET -> FlatPieceCalculator.plan(this, gauge, options, structure, units)
        COWL -> CowlCalculator.plan(gauge, options, structure, units)
        HAT -> HatCalculator.plan(gauge, measurements, options, structure, units)
        RAGLAN_SWEATER -> RaglanSweaterCalculator.plan(gauge, measurements, options, structure, units)
        SOCK -> SockCalculator.plan(gauge, measurements, options, structure, units)
        MITTEN -> MittenCalculator.plan(gauge, measurements, options, structure, units)
        SHAWL -> ShawlCalculator.plan(gauge, options, structure, units)
    }
}
