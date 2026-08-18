package com.knitstudio.engine

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * The Swift XCTest suite is the specification for this port. These are the same
 * verified constants: if they pass, the Kotlin engine agrees with the Swift one.
 */
class CalculatorTest {

    private val dk = Gauge(22.0, 30.0)
    private val worsted = Gauge(18.0, 24.0)
    private val sockGauge = Gauge(30.0, 42.0)
    private val fingering = Gauge(28.0, 36.0)

    // MARK: Rounding — Swift rounds halves away from zero.

    @Test fun swiftRoundingSemantics() {
        assertEquals(3.0, 2.5.swiftRounded())
        assertEquals(-3.0, (-2.5).swiftRounded())
        assertEquals(2.0, 2.4.swiftRounded())
        assertEquals(3.0, 2.6.swiftRounded())
    }

    @Test fun roundToMultiple() {
        assertEquals(104, Shaping.roundToMultiple(103.0, 8))
        assertEquals(105, Shaping.roundToMultiple(103.0, 8, 1))
        assertEquals(100, Shaping.roundToMultiple(100.0, 4))
        assertEquals(7, Shaping.roundToMultiple(7.4, 1))
        assertEquals(8, Shaping.roundToMultiple(2.0, 8))
        assertEquals(4, Shaping.roundToMultiple(0.0, 4))
    }

    @Test fun distributeEvenlySplitsRemainder() {
        val result = Shaping.distributeEvenly(8, 100)
        assertNotNull(result)
        assertEquals(listOf(13, 13, 13, 13, 12, 12, 12, 12), result.segments)
        assertEquals(100, result.totalStitches)
        assertEquals(12, result.base)
        assertEquals(4, result.longGaps)
    }

    @Test fun distributeEvenlyAlwaysConservesStitches() {
        for (over in 10..240 step 7) {
            for (count in listOf(2, 3, 5, 8, 11)) {
                if (count > over) continue
                val result = Shaping.distributeEvenly(count, over)
                assertEquals(over, result?.totalStitches, "count $count over $over")
                assertEquals(count, result?.shapingPoints, "count $count over $over")
            }
        }
    }

    // MARK: Loop length — drives every yarn estimate.

    @Test fun loopLengthMatchesMundenModel() {
        assertEquals(1.696970, dk.loopLength, 1e-6)
        assertEquals(2.097222, worsted.loopLength, 1e-6)
        assertEquals(1.228571, sockGauge.loopLength, 1e-6)
    }

    @Test fun loopLengthStaysInProportionAcrossWeights() {
        for (weight in YarnWeight.entries) {
            val gauge = weight.nominalGauge
            val ratio = gauge.loopLength / gauge.stitchWidth
            assertTrue(ratio > 3.0 && ratio < 4.6, "${weight.displayName} ratio $ratio")
            assertTrue(gauge.looksPlausible, "${weight.displayName} flagged implausible")
        }
    }

    @Test fun ballsRoundUpAndIncludeMargin() {
        val yarn = Yarn(name = "DK", hex = "112233", weight = YarnWeight.LIGHT, ballGrams = 50.0, ballMetres = 125.0)
        assertEquals(11, YarnEstimator.balls(1149.0, yarn))
        assertEquals(1, YarnEstimator.balls(10.0, yarn))
        assertEquals(2, YarnEstimator.balls(250.0, yarn, safetyMargin = 0.0))
    }

    @Test fun arealDensityIsRealisticForEachYarnWeight() {
        fun density(weight: YarnWeight): Double {
            val yarn = Yarn(name = weight.displayName, hex = "808080", weight = weight)
            return YarnEstimator.arealDensity(weight.nominalGauge, yarn)
        }
        listOf(
            Triple(YarnWeight.SUPER_FINE, 300.0, 420.0),
            Triple(YarnWeight.LIGHT, 380.0, 500.0),
            Triple(YarnWeight.MEDIUM, 400.0, 520.0),
            Triple(YarnWeight.BULKY, 440.0, 580.0),
        ).forEach { (weight, low, high) ->
            val value = density(weight)
            assertTrue(value > low && value < high, "${weight.displayName} = $value g/m2")
        }
        assertTrue(density(YarnWeight.BULKY) > density(YarnWeight.SUPER_FINE) + 50)
    }

    // MARK: Hat

    @Test fun hatMatchesReferenceNumbers() {
        val plan = HatCalculator.plan(
            worsted, BodyMeasurements(), ProjectOptions(),
            FabricStructure.STOCKINETTE, UnitSystem.METRIC,
        )
        assertEquals("96 sts", plan.fact("Cast on"))
        assertEquals("22 rounds", plan.fact("Crown"))
        assertEquals("53", plan.fact("Total rounds"))
        assertEquals(3, plan.sections.size)
        assertEquals(12, plan.sections[0].totalRows)
        assertEquals(19, plan.sections[1].totalRows)
        assertEquals(22, plan.sections[2].totalRows)
        assertEquals(4120.0, plan.totalStitches, 0.5)
    }

    @Test fun hatCastOnAlwaysDividesIntoCrownSections() {
        for (sections in listOf(4, 6, 8, 10, 12)) {
            var head = 44.0
            while (head <= 62.0) {
                val plan = HatCalculator.plan(
                    dk, BodyMeasurements(headCircumference = head),
                    ProjectOptions(crownSections = sections),
                    FabricStructure.STOCKINETTE, UnitSystem.METRIC,
                )
                val castOn = plan.fact("Cast on")!!.removeSuffix(" sts").toInt()
                assertEquals(0, castOn % sections, "$castOn sts / $sections sections")
                head += 2.0
            }
        }
    }

    // MARK: Raglan

    @Test fun raglanMatchesReferenceNumbers() {
        val plan = RaglanSweaterCalculator.plan(
            dk, BodyMeasurements(), ProjectOptions(),
            FabricStructure.STOCKINETTE, UnitSystem.METRIC,
        )
        assertEquals("84 sts", plan.fact("Neck cast-on"))
        assertEquals("40", plan.fact("Increase rounds"))
        assertEquals("236 sts", plan.fact("Body at underarm"))
        assertEquals("74 sts", plan.fact("Sleeve at underarm"))
        assertEquals(63, plan.sections[0].totalRows)
        assertEquals(123, plan.sections[2].totalRows)
        assertEquals(135, plan.sections[3].totalRows)
        assertEquals(58668.0, plan.totalStitches, 1.0)
    }

    @Test fun raglanHitsTheRequestedChest() {
        for (gauge in listOf(dk, worsted, fingering)) {
            for (chest in listOf(82.0, 100.0, 122.0)) {
                val plan = RaglanSweaterCalculator.plan(
                    gauge, BodyMeasurements(chest = chest), ProjectOptions(),
                    FabricStructure.STOCKINETTE, UnitSystem.METRIC,
                )
                val sts = plan.fact("Body at underarm")!!.removeSuffix(" sts").toInt()
                val finished = gauge.widthForStitches(sts.toDouble())
                assertTrue(abs(finished - chest * 1.08) <= 2.0, "chest $chest came out $finished")
            }
        }
    }

    /** The whole point of the compound raglan: sleeves that fit the arm. */
    @Test fun raglanSleeveFitsTheUpperArm() {
        for (gauge in listOf(dk, worsted, fingering)) {
            val m = BodyMeasurements()
            val plan = RaglanSweaterCalculator.plan(
                gauge, m, ProjectOptions(), FabricStructure.STOCKINETTE, UnitSystem.METRIC,
            )
            val sts = plan.fact("Sleeve at underarm")!!.removeSuffix(" sts").toInt()
            val width = gauge.widthForStitches(sts.toDouble())
            assertTrue(abs(width - m.upperArm) <= 1.5, "sleeve $width cm for a ${m.upperArm} cm arm")
        }
        val plan = RaglanSweaterCalculator.plan(
            dk, BodyMeasurements(), ProjectOptions(), FabricStructure.STOCKINETTE, UnitSystem.METRIC,
        )
        assertTrue(plan.warnings.isEmpty(), "unexpected warnings: ${plan.warnings}")
    }

    @Test fun raglanYokeDepthMatchesArmhole() {
        for (gauge in listOf(dk, worsted, fingering)) {
            for (chest in listOf(82.0, 100.0, 122.0)) {
                val plan = RaglanSweaterCalculator.plan(
                    gauge, BodyMeasurements(chest = chest), ProjectOptions(),
                    FabricStructure.STOCKINETTE, UnitSystem.METRIC,
                )
                val yokeDepth = plan.sections[0].totalRows * gauge.rowHeight
                assertTrue(
                    abs(yokeDepth - chest * 0.21) <= gauge.rowHeight + 0.01,
                    "yoke $yokeDepth vs armhole ${chest * 0.21}",
                )
            }
        }
    }

    // MARK: Socks, shawl, flat pieces

    @Test fun sockMatchesReferenceNumbers() {
        val plan = SockCalculator.plan(
            sockGauge, BodyMeasurements(), ProjectOptions(ease = 0.10),
            FabricStructure.STOCKINETTE, UnitSystem.METRIC,
        )
        assertEquals("64 sts", plan.fact("Cast on"))
        assertEquals("32 rows", plan.fact("Heel flap"))
        assertEquals("17 sts each side", plan.fact("Gusset pick-up"))
        assertEquals("12 decrease rounds", plan.fact("Toe"))
        assertEquals(23504.0, plan.totalStitches, 1.0)
    }

    @Test fun shawlMatchesReferenceNumbers() {
        val plan = ShawlCalculator.plan(
            fingering, ProjectOptions(), FabricStructure.GARTER, UnitSystem.METRIC,
        )
        assertEquals("504", plan.fact("Final stitches"))
        assertEquals("252", plan.fact("Rows"))
        assertEquals(63882.0, plan.totalStitches, 1.0)
    }

    @Test fun scarfIsASimpleRectangle() {
        val plan = FlatPieceCalculator.plan(
            PatternKind.SCARF, worsted,
            ProjectOptions(width = 20.0, length = 150.0, edgeStitches = 0),
            FabricStructure.GARTER, UnitSystem.METRIC,
        )
        assertEquals("36 sts", plan.fact("Cast on"))
        assertEquals("360", plan.fact("Rows"))
        assertEquals((36 * 360).toDouble(), plan.totalStitches, 0.5)
    }

    @Test fun edgeStitchesCountTowardsTheFinishedWidth() {
        val plan = FlatPieceCalculator.plan(
            PatternKind.SCARF, worsted,
            ProjectOptions(width = 20.0, length = 100.0, edgeStitches = 4),
            FabricStructure.STOCKINETTE, UnitSystem.METRIC,
        )
        assertEquals("36 sts", plan.fact("Cast on"))
        assertEquals("20.0 cm", plan.fact("Finished width"))
    }

    // MARK: Cross-cutting

    @Test fun everyPatternKindProducesAUsablePlan() {
        for (kind in PatternKind.entries) {
            for (gauge in listOf(fingering, dk, worsted)) {
                val plan = kind.makePlan(gauge)
                assertTrue(plan.sections.isNotEmpty(), "${kind.displayName} has no sections")
                assertTrue(plan.facts.isNotEmpty(), "${kind.displayName} has no facts")
                assertTrue(plan.totalStitches > 0, "${kind.displayName} has no stitches")
                assertTrue(plan.metres() > 0, "${kind.displayName} needs no yarn")
                plan.sections.forEach { section ->
                    assertTrue(section.steps.isNotEmpty(), "${kind.displayName}/${section.name} empty")
                }
            }
        }
    }

    @Test fun extremeSizesDoNotBreakTheCalculators() {
        val tiny = BodyMeasurements(
            chest = 40.0, headCircumference = 30.0, footCircumference = 12.0,
            footLength = 12.0, handCircumference = 10.0, handLength = 10.0,
        )
        val huge = BodyMeasurements(
            chest = 160.0, headCircumference = 70.0, footCircumference = 34.0,
            footLength = 34.0, handCircumference = 30.0, handLength = 26.0,
        )
        for (m in listOf(tiny, huge)) {
            for (kind in PatternKind.entries) {
                val plan = kind.makePlan(Gauge(12.0, 16.0), m)
                assertTrue(plan.totalStitches > 0, "${kind.displayName} collapsed")
                assertTrue(!plan.totalStitches.isNaN(), "${kind.displayName} produced NaN")
            }
        }
    }
}
