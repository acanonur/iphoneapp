package com.knitstudio.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ParserTest {

    private fun assertRow(text: String, from: Int, gives: Int, clean: Boolean = true) {
        val outcome = WrittenPatternParser.evaluate(text, from)
        assertEquals(gives, outcome.produced, text)
        if (clean) assertTrue(outcome.issues.isEmpty(), "$text → unexpected issues ${outcome.issues}")
    }

    @Test fun plainRows() {
        assertRow("knit to end", 96, 96)
        assertRow("k to end", 96, 96)
        assertRow("purl to end", 96, 96)
        assertRow("k96", 96, 96)
    }

    @Test fun ribbingRepeats() {
        assertRow("*k2, p2; rep from * to end", 100, 100)
        assertRow("k2, *p2, k2; rep from * to end", 102, 102)
        assertRow("*k1, p1; rep from * to end", 64, 64)
    }

    @Test fun bracketRepeatsAreExpanded() {
        assertRow("[k10, k2tog] 8 times", 96, 88)
        assertRow("[k4, k2tog] x 8", 48, 40)
        assertRow("(k1, yo) 4 times, k to end", 20, 24)
    }

    @Test fun unevenRepeatIsReported() {
        val outcome = WrittenPatternParser.evaluate("*k2, p2, k3; rep from * to end", 100)
        assertEquals(98, outcome.produced)
        assertTrue(outcome.issues.any { it.contains("does not divide evenly") })
    }

    @Test fun decreaseRows() {
        assertRow("*k2tog; rep from * to end", 64, 32)
        assertRow("*k3tog; rep from * to end", 30, 10)
        assertRow("k1, *cdd, k1; rep from * to end", 41, 21)
    }

    /** Getting "to last N sts" wrong miscounts every sleeve and every raglan. */
    @Test fun pairedShapingRow() {
        assertRow("k1, k2tog, k to last 3 sts, ssk, k1", 100, 98)
        assertRow("k to last 3 sts, k2tog, k1", 50, 49)
        assertRow("k1, m1l, k to last 1 st, m1r, k1", 40, 42)
        assertRow("k2, kfb, k to last 3 sts, kfb, k2", 60, 62)
    }

    @Test fun laceKeepsItsStitchCount() {
        assertRow("k1, *yo, k2tog; rep from * to last 1 st, k1", 50, 50)
        assertRow("k3, yo, k to last 3 sts, yo, k3", 50, 52)
        assertRow("*k1, yo; rep from * to end", 20, 40)
    }

    @Test fun markersAndTurnsChangeNothing() {
        assertRow("k20, pm, k to end", 96, 96)
        assertRow("sm, k to last 2 sts, k2tog", 48, 47)
    }

    @Test fun statedCountIsChecked() {
        val good = WrittenPatternParser.evaluate("*k2, p2; rep from * to end (100 sts)", 100)
        assertEquals(100, good.produced)
        assertTrue(good.issues.isEmpty())

        val bad = WrittenPatternParser.evaluate("*k2, p2; rep from * to end (99 sts)", 100)
        assertEquals(100, bad.produced)
        assertTrue(bad.issues.any { it.contains("99") })
    }

    @Test fun rowThatDoesNotUseAllTheStitchesIsReported() {
        val outcome = WrittenPatternParser.evaluate("k1, k2tog, k1", 100)
        assertEquals(3, outcome.produced)
        assertTrue(outcome.issues.any { it.contains("100") })
    }

    @Test fun mismatchedToLastIsReported() {
        val outcome = WrittenPatternParser.evaluate("k to last 3 sts, k2tog", 40)
        assertTrue(outcome.issues.any { it.contains("to last 3 sts") })
    }

    @Test fun unknownIncomingCountFallsBackToStated() {
        assertEquals(48, WrittenPatternParser.evaluate("work in pattern (48 sts)", null).produced)
    }

    @Test fun gaugeIsReadFromMetricAndImperialLines() {
        val metric = WrittenPatternParser.parseGauge("Gauge: 18 sts and 24 rows to 10 cm in stockinette")
        assertEquals(18.0, metric!!.stitchesPer10cm, 0.01)
        assertEquals(24.0, metric.rowsPer10cm, 0.01)

        val imperial = WrittenPatternParser.parseGauge("Gauge: 22 sts and 30 rows = 4 inches")
        assertEquals(21.65, imperial!!.stitchesPer10cm, 0.05)
        assertEquals(29.53, imperial.rowsPer10cm, 0.05)

        assertNull(WrittenPatternParser.parseGauge("A cosy hat for winter"))
    }

    @Test fun castOnIsRead() {
        assertEquals(96, WrittenPatternParser.parseCastOn("Cast on 96 sts."))
        assertEquals(64, WrittenPatternParser.parseCastOn("CO 64 stitches"))
        assertNull(WrittenPatternParser.parseCastOn("Work in the round"))
    }

    @Test fun wholePatternThreadsTheStitchCountThrough() {
        val pattern = WrittenPatternParser.parse(
            """
            Simple Ribbed Hat
            Gauge: 18 sts and 24 rows to 10 cm in stockinette
            Yarn: 1 skein worsted, 100 g / 200 m
            Needles: 4.5 mm circular

            Cast on 96 sts and join in the round.
            Rnd 1: *k2, p2; rep from * to end
            Rnd 2: knit to end
            Rnd 3: *k10, k2tog; rep from * to end
            Rnd 4: knit to end
            """.trimIndent(),
        )
        assertEquals(96, pattern.castOnStitches)
        assertEquals(18.0, pattern.gauge!!.stitchesPer10cm, 0.01)
        assertEquals(4, pattern.rows.size)
        assertEquals(96, pattern.rows[0].endingStitches)
        assertEquals(96, pattern.rows[1].endingStitches)
        assertEquals(88, pattern.rows[2].endingStitches)   // 8 decreases
        assertEquals(88, pattern.rows[3].endingStitches)
        assertEquals(4, pattern.verifiedRowCount)
        assertTrue(pattern.yarnNotes.isNotEmpty())
        assertTrue(pattern.needleNotes.isNotEmpty())
    }

    @Test fun rowSidesAreRead() {
        val pattern = WrittenPatternParser.parse(
            "Cast on 40 sts\nRow 1 (RS): knit to end\nRow 2 (WS): purl to end",
        )
        assertEquals(2, pattern.rows.size)
        assertEquals("RS", pattern.rows[0].side)
        assertEquals("WS", pattern.rows[1].side)
        assertEquals("Row 1", pattern.rows[0].label)
    }

    @Test fun patternWithNoRowsExplainsItself() {
        val pattern = WrittenPatternParser.parse("A lovely hat. Photographs by someone.")
        assertTrue(pattern.rows.isEmpty())
        assertTrue(pattern.issues.any { it.contains("No numbered rows") })
    }

    @Test fun missingCastOnIsExplained() {
        val pattern = WrittenPatternParser.parse("Rnd 1: knit to end")
        assertEquals(1, pattern.rows.size)
        assertTrue(pattern.issues.any { it.contains("No cast-on") })
    }

    @Test fun unknownTermsAreCollectedNotSwallowed() {
        val pattern = WrittenPatternParser.parse("Cast on 40 sts\nRow 1: k10, frobnicate, k to end")
        assertTrue(pattern.unknownTerms.contains("frobnicate"))
    }

    @Test fun parserDoesNotHangOnPathologicalInput() {
        val nasty = "[k1] 2 times, ".repeat(40)
        assertTrue(WrittenPatternParser.evaluate(nasty, 100).produced != null)
    }

    @Test fun emptyInputIsHandled() {
        val pattern = WrittenPatternParser.parse("")
        assertTrue(pattern.rows.isEmpty())
        assertNull(pattern.castOnStitches)
    }
}
