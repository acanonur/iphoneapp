package com.knitstudio.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ChartAndShoppingTest {

    private val palette = listOf(
        Yarn(name = "Cream", hex = "F0E9DA", weight = YarnWeight.LIGHT),
        Yarn(name = "Indigo", hex = "2E4272", weight = YarnWeight.LIGHT),
    )
    private val dk = Gauge(22.0, 30.0)

    private fun twoRowChart(working: ChartWorking = ChartWorking.IN_THE_ROUND) =
        ColourChart.fromArt("test", "XX..\n..XX", palette, working)

    /** Text art reads top-down, but chart row 0 is the bottom row. */
    @Test fun textArtBottomRowIsChartRowZero() {
        val chart = twoRowChart()
        assertEquals(4, chart.width)
        assertEquals(2, chart.height)
        assertEquals(0, chart.colourIndex(0, 0))
        assertEquals(1, chart.colourIndex(3, 0))
        assertEquals(1, chart.colourIndex(0, 1))
        assertEquals(0, chart.colourIndex(3, 1))
    }

    @Test fun chartSizeIsAlwaysConsistent() {
        assertEquals(9, ColourChart.of("s", 3, 3, listOf(1, 1), palette).cells.size)
        assertEquals(4, ColourChart.of("l", 2, 2, List(7) { 1 }, palette).cells.size)
    }

    @Test fun outOfBoundsAccessIsSafe() {
        val chart = twoRowChart()
        assertEquals(0, chart.colourIndex(-1, 0))
        assertEquals(0, chart.colourIndex(99, 99))
        assertEquals(8, chart.withCell(1, 99, 99).cells.size)
    }

    @Test fun knittingOrderInTheRound() {
        val chart = twoRowChart(ChartWorking.IN_THE_ROUND)
        assertEquals(listOf(1, 1, 0, 0), chart.knittingOrder(0))
        assertEquals(listOf(0, 0, 1, 1), chart.knittingOrder(1))
    }

    @Test fun knittingOrderFlatAlternates() {
        val chart = twoRowChart(ChartWorking.FLAT)
        assertEquals(listOf(1, 1, 0, 0), chart.knittingOrder(0))  // RS, right to left
        assertEquals(listOf(1, 1, 0, 0), chart.knittingOrder(1))  // WS, as charted
    }

    @Test fun colourSharesSumToOne() {
        val shares = twoRowChart().colourShares()
        assertEquals(0.5, shares[0]!!, 1e-9)
        assertEquals(0.5, shares[1]!!, 1e-9)
        assertEquals(1.0, shares.values.sum(), 1e-9)
    }

    @Test fun longestFloatIsMeasuredInKnittingOrder() {
        assertEquals(2, twoRowChart().longestFloat())
        assertEquals(9, ColourChart.fromArt("wide", "X.........X", palette).longestFloat())
    }

    @Test fun longFloatsAreFlagged() {
        val wide = ColourChart.fromArt("wide", "X.............X", palette)
        assertTrue(wide.reviewNotes(dk).any { it.contains("float") })
    }

    @Test fun writtenInstructionsRunLengthEncodeEachRow() {
        val lines = twoRowChart(ChartWorking.IN_THE_ROUND).writtenInstructions()
        assertEquals(2, lines.size)
        assertEquals("Rnd 1: 2 B, 2 A", lines[0])
        assertEquals("Rnd 2: 2 A, 2 B", lines[1])
    }

    @Test fun writtenInstructionsLabelSidesWhenWorkedFlat() {
        val lines = twoRowChart(ChartWorking.FLAT).writtenInstructions()
        assertTrue(lines[0].startsWith("Row 1 (RS):"))
        assertTrue(lines[1].startsWith("Row 2 (WS):"))
    }

    @Test fun resizePreservesTheOverlappingCells() {
        val chart = twoRowChart().resized(6, 4)
        assertEquals(24, chart.cells.size)
        assertEquals(1, chart.colourIndex(3, 0))
        assertEquals(1, chart.colourIndex(0, 1))
        assertEquals(0, chart.colourIndex(5, 3))
    }

    @Test fun mirrorAndFlipAreTheirOwnInverse() {
        val original = twoRowChart()
        assertEquals(original.cells, original.mirroredHorizontally().mirroredHorizontally().cells)
        assertEquals(original.cells, original.flippedVertically().flippedVertically().cells)
        assertTrue(original.mirroredHorizontally().cells != original.cells)
    }

    @Test fun finishedSizeUsesGauge() {
        val (w, h) = twoRowChart().finishedSize(Gauge(20.0, 25.0))
        assertEquals(2.0, w, 1e-9)
        assertEquals(0.8, h, 1e-9)
    }

    // MARK: Shopping list

    private fun hatPlan() = PatternKind.HAT.makePlan(dk)

    private fun listFor(allocations: List<ColourAllocation>, options: ProjectOptions = ProjectOptions()) =
        ShoppingListBuilder.build(
            hatPlan(), PatternKind.HAT, allocations, FabricStructure.STOCKINETTE, options,
        )

    @Test fun singleColourTakesTheWholeEstimate() {
        val list = listFor(ColourAllocation.single(palette[0]))
        assertEquals(1, list.lines.size)
        assertEquals("Main colour (MC)", list.lines[0].role)
        assertEquals(hatPlan().metres(), list.lines[0].metres, 1e-6)
        assertTrue(list.totalBalls >= 1)
    }

    @Test fun sharesAreNormalised() {
        val allocations = listOf(
            ColourAllocation(palette[0], 1.0, "MC"),
            ColourAllocation(palette[1], 0.5, "CC1"),
            ColourAllocation(palette[1], 0.5, "CC2"),
        )
        val normalised = ColourAllocation.normalised(allocations)
        assertEquals(1.0, normalised.sumOf { it.share }, 1e-9)
        assertEquals(0.5, normalised[0].share, 1e-9)
        assertEquals(0.25, normalised[1].share, 1e-9)

        val list = listFor(allocations)
        assertEquals(list.totalMetres / 2, list.lines[0].metres, 1e-6)
    }

    @Test fun chartDrivenSharesMatchTheStitchCounts() {
        val chart = ColourChart.fromArt("quarter", "X...", palette)
        val allocations = ColourAllocation.fromChart(chart)
        assertEquals(2, allocations.size)
        assertEquals(0.75, allocations[0].share, 1e-9)
        assertEquals(0.25, allocations[1].share, 1e-9)
        assertEquals("Contrast B", allocations[1].role)
    }

    @Test fun everyLineBuysAtLeastAsMuchAsItNeeds() {
        val list = listFor(
            listOf(
                ColourAllocation(palette[0], 0.7, "MC"),
                ColourAllocation(palette[1], 0.3, "CC"),
            ),
        )
        list.lines.forEach { line ->
            assertTrue(line.balls * line.yarn.ballMetres >= line.metres, "${line.role} buys too little")
            assertTrue(line.spareMetres >= 0)
        }
    }

    @Test fun ballCountsIncludeTheMargin() {
        val tight = listFor(ColourAllocation.single(palette[0]), ProjectOptions(safetyMargin = 0.0))
        val generous = listFor(ColourAllocation.single(palette[0]), ProjectOptions(safetyMargin = 0.5))
        assertTrue(generous.totalBalls >= tight.totalBalls)
        // The yarn *needed* does not change — only how much is bought.
        assertEquals(tight.totalMetres, generous.totalMetres, 1e-6)
    }

    @Test fun costIsOnlyReportedWhenEveryYarnIsPriced() {
        val priced = palette[0].copy(pricePerBall = 6.0)
        assertNotNull(listFor(listOf(ColourAllocation(priced, 1.0, "MC"))).totalCost)
        assertNull(
            listFor(
                listOf(
                    ColourAllocation(priced, 0.5, "MC"),
                    ColourAllocation(palette[1], 0.5, "CC"),
                ),
            ).totalCost,
        )
    }

    @Test fun everyProjectKindGetsNeedlesAndNotions() {
        for (kind in PatternKind.entries) {
            val list = ShoppingListBuilder.build(
                kind.makePlan(dk), kind, ColourAllocation.single(palette[0]),
                FabricStructure.STOCKINETTE, ProjectOptions(),
            )
            assertTrue(list.needles.isNotEmpty(), "${kind.displayName} has no needles")
            assertTrue(list.notions.isNotEmpty(), "${kind.displayName} has no notions")
        }
    }

    @Test fun smallCircumferenceProjectsSuggestDoublePointedNeedles() {
        for (kind in listOf(PatternKind.SOCK, PatternKind.MITTEN)) {
            val needles = ShoppingListBuilder.needles(kind, YarnWeight.LIGHT)
            assertTrue(needles.any { it.contains("double-pointed") }, kind.displayName)
        }
    }

    @Test fun fabricStructureAddsItsOwnNotions() {
        assertTrue(
            ShoppingListBuilder.notions(PatternKind.HAT, FabricStructure.CABLES, 1)
                .any { it.contains("Cable needle") },
        )
        assertTrue(
            ShoppingListBuilder.notions(PatternKind.HAT, FabricStructure.LACE, 1)
                .any { it.contains("Lifeline") },
        )
        assertTrue(
            ShoppingListBuilder.notions(PatternKind.HAT, FabricStructure.STOCKINETTE, 2)
                .any { it.contains("Bobbins") },
        )
    }

    @Test fun plainTextListCarriesTheDyeLotWarning() {
        val text = listFor(ColourAllocation.single(palette[0])).plainText("Test hat")
        assertTrue(text.contains("Test hat"))
        assertTrue(text.contains("dye lot"))
        assertTrue(text.contains("Needles"))
        assertTrue(text.contains("Notions"))
    }
}

class PresetTest {
    @Test fun everyBuiltInMotifParses() {
        for (motif in BuiltInPatterns.motifs) {
            val chart = BuiltInPatterns.chart(motif.id)
            assertNotNull(chart, motif.id)
            assertEquals(chart.width * chart.height, chart.cells.size, motif.id)
            assertEquals(motif.colours, chart.palette.size, motif.id)
            chart.cells.forEach { assertTrue(it in chart.palette.indices, motif.id) }
        }
    }

    @Test fun presetsAllBuildWorkingProjects() {
        for (preset in BuiltInPatterns.all) {
            val project = SavedProject.fromPreset(preset)
            assertTrue(project.plan().totalStitches > 0, preset.displayName)
            val list = project.shoppingList()
            assertTrue(list.lines.isNotEmpty(), preset.displayName)
            assertTrue(list.totalBalls >= 1, preset.displayName)
            if (preset.chartId != null) assertNotNull(project.chart, preset.displayName)
        }
    }
}

class PersistenceTest {
    @Test fun projectSurvivesARoundTripThroughJson() {
        val original = SavedProject(
            name = "Test hat",
            kind = PatternKind.HAT,
            gauge = Gauge(22.0, 30.0),
            allocations = ColourAllocation.single(
                Yarn(name = "Cream", hex = "F0E9DA", weight = YarnWeight.LIGHT),
            ),
            chart = BuiltInPatterns.chart("fair-isle-band"),
            rowsCompleted = 42,
            notes = "Second attempt",
        )
        val json = kotlinx.serialization.json.Json.encodeToString(
            SavedProject.serializer(), original,
        )
        val restored = kotlinx.serialization.json.Json.decodeFromString(
            SavedProject.serializer(), json,
        )
        assertEquals(original.name, restored.name)
        assertEquals(original.kind, restored.kind)
        assertEquals(original.gauge, restored.gauge)
        assertEquals(42, restored.rowsCompleted)
        assertEquals(original.chart?.cells, restored.chart?.cells)
        assertEquals(original.plan().totalStitches, restored.plan().totalStitches, 1e-6)
    }

    @Test fun everyPresetSurvivesARoundTrip() {
        for (preset in BuiltInPatterns.all) {
            val project = SavedProject.fromPreset(preset)
            val json = kotlinx.serialization.json.Json.encodeToString(SavedProject.serializer(), project)
            val restored = kotlinx.serialization.json.Json.decodeFromString(SavedProject.serializer(), json)
            assertEquals(
                project.plan().totalStitches, restored.plan().totalStitches, 1e-6,
                preset.displayName,
            )
        }
    }
}

class TechniqueTest {
    @Test fun everyTechniqueIdIsUniqueAndWellFormed() {
        val ids = TechniqueLibrary.all.map { it.id }
        assertEquals(ids.size, ids.toSet().size, "duplicate technique ids")
        TechniqueLibrary.all.forEach { technique ->
            assertTrue(technique.steps.isNotEmpty(), "${technique.id} has no steps")
            assertTrue(technique.summary.isNotBlank(), "${technique.id} has no summary")
            assertTrue(technique.whenToUse.isNotBlank(), "${technique.id} has no whenToUse")
        }
        assertTrue(TechniqueLibrary.all.size >= 40, "only ${TechniqueLibrary.all.size} techniques")
    }

    @Test fun everyCategoryHasContent() {
        assertEquals(TechniqueCategory.entries.size, TechniqueLibrary.categoriesInOrder.size)
    }

    /** Recommendations must resolve — a typo in an id would silently drop one. */
    @Test fun recommendationsResolveForEveryProject() {
        for (kind in PatternKind.entries) {
            for (structure in FabricStructure.entries) {
                val recommended = TechniqueLibrary.recommended(kind, structure)
                assertTrue(recommended.size >= 6, "${kind.displayName}/${structure.displayName}")
                assertEquals(recommended.size, recommended.map { it.id }.toSet().size)
            }
        }
    }

    @Test fun abbreviationsPointAtRealTechniques() {
        AbbreviationGlossary.all.forEach { entry ->
            entry.techniqueId?.let {
                assertNotNull(TechniqueLibrary.technique(it), "${entry.short} -> $it")
            }
        }
    }

    @Test fun searchFindsThingsByNameAndAlias() {
        assertTrue(TechniqueLibrary.search("kitchener").any { it.id == "kitchener-stitch" })
        assertTrue(TechniqueLibrary.search("fair isle").any { it.id == "stranded-colourwork" })
        assertTrue(TechniqueLibrary.search("").size == TechniqueLibrary.all.size)
    }
}
