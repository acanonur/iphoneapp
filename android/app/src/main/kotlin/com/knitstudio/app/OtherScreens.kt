package com.knitstudio.app

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.knitstudio.engine.AbbreviationGlossary
import com.knitstudio.engine.BuiltInPatterns
import com.knitstudio.engine.SavedProject
import com.knitstudio.engine.Technique
import com.knitstudio.engine.TechniqueLibrary
import com.knitstudio.engine.UnitSystem
import com.knitstudio.engine.YarnWeight

// ── Patterns ──────────────────────────────────────────────────────────────

@Composable
fun PatternsScreen(store: AppStore, onUsePreset: (SavedProject) -> Unit) {
    Scaffold(topBar = { ScreenBar("Patterns") }) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Text(
                    "Pick a pattern and the calculator fills in with sensible defaults. " +
                        "Change anything — the numbers recalculate from your gauge.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            items(BuiltInPatterns.all) { preset ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onUsePreset(SavedProject.fromPreset(preset, store.lastGauge)) },
                ) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                preset.displayName,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                preset.kind.difficulty.displayName,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                        Text(preset.blurb, style = MaterialTheme.typography.bodySmall)
                        Text(
                            "${preset.suggestedWeight.displayName} · ${preset.structure.displayName}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            item { SectionHeading("Charts") }
            items(store.charts) { chart ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(chart.name, fontWeight = FontWeight.SemiBold)
                        Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
                            ChartCanvas(chart = chart, gauge = store.lastGauge, cellWidth = 10.dp)
                        }
                        ChartLegend(chart)
                        Text(
                            "${chart.width} × ${chart.height} · longest float ${chart.longestFloat()}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

// ── Learn ─────────────────────────────────────────────────────────────────

@Composable
fun LearnScreen(
    store: AppStore,
    onOpenTechnique: (Technique) -> Unit,
    onOpenAbbreviations: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val results = remember(query) { TechniqueLibrary.search(query) }
    val searching = query.isNotBlank()

    Scaffold(topBar = { ScreenBar("Learn") }) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    label = { Text("Search techniques") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (!searching) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable { onOpenAbbreviations() },
                    ) {
                        Text("Abbreviations", modifier = Modifier.padding(14.dp))
                    }
                }
                val favourites = TechniqueLibrary.all.filter { it.id in store.favouriteTechniques }
                if (favourites.isNotEmpty()) {
                    item { SectionHeading("Saved") }
                    items(favourites) { TechniqueRow(it, onOpenTechnique) }
                }
                TechniqueLibrary.categoriesInOrder.forEach { category ->
                    item {
                        Column {
                            SectionHeading(category.displayName)
                            Text(
                                category.blurb,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    items(TechniqueLibrary.inCategory(category)) { TechniqueRow(it, onOpenTechnique) }
                }
            } else {
                item { SectionHeading("${results.size} result${if (results.size == 1) "" else "s"}") }
                items(results) { TechniqueRow(it, onOpenTechnique) }
            }
        }
    }
}

@Composable
private fun TechniqueRow(technique: Technique, onOpen: (Technique) -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().clickable { onOpen(technique) }) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    technique.displayName,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    technique.difficulty.displayName,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Text(
                technique.summary,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
fun TechniqueDetailScreen(store: AppStore, techniqueId: String, onBack: () -> Unit) {
    val technique = TechniqueLibrary.technique(techniqueId)
    if (technique == null) {
        Scaffold(topBar = { ScreenBar("Not found", onBack = onBack) }) { padding ->
            Text("That technique is no longer in the guide.", Modifier.padding(padding).padding(24.dp))
        }
        return
    }
    val saved = technique.id in store.favouriteTechniques

    Scaffold(
        topBar = {
            ScreenBar(technique.displayName, onBack = onBack) {
                IconButton(onClick = { store.toggleFavourite(technique.id) }) {
                    Icon(
                        if (saved) Icons.Filled.Bookmark else Icons.Filled.BookmarkBorder,
                        contentDescription = if (saved) "Remove from saved" else "Save",
                    )
                }
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        AssistChip(onClick = {}, label = { Text(technique.difficulty.displayName) })
                        AssistChip(onClick = {}, label = { Text(technique.category.displayName) })
                    }
                    Text(technique.summary, style = MaterialTheme.typography.titleMedium)
                    Text(
                        technique.whenToUse,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            item { SectionHeading("How to") }
            items(technique.steps.withIndex().toList()) { (index, step) ->
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("${index + 1}.", fontWeight = FontWeight.Bold)
                    Text(step, style = MaterialTheme.typography.bodyMedium)
                }
            }
            if (technique.tips.isNotEmpty()) {
                item { SectionHeading("Worth knowing") }
                items(technique.tips) { NoteBox(it) }
            }
            if (technique.abbreviations.isNotEmpty()) {
                item { SectionHeading("In patterns you will see") }
                items(technique.abbreviations) { short ->
                    AbbreviationGlossary.lookup(short)?.let { entry ->
                        Column {
                            Text("${entry.short} — ${entry.full}", fontWeight = FontWeight.Medium)
                            Text(
                                entry.meaning,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
            if (technique.alsoKnownAs.isNotEmpty()) {
                item {
                    Text(
                        "Also called: ${technique.alsoKnownAs.joinToString(", ")}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
fun AbbreviationsScreen(onBack: () -> Unit) {
    var query by remember { mutableStateOf("") }
    val results = remember(query) { AbbreviationGlossary.search(query) }

    Scaffold(topBar = { ScreenBar("Abbreviations", onBack = onBack) }) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    label = { Text("Search") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            items(results) { entry ->
                Column {
                    Text("${entry.short} — ${entry.full}", fontWeight = FontWeight.SemiBold)
                    Text(
                        entry.meaning,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

// ── Stash ─────────────────────────────────────────────────────────────────

@Composable
fun StashScreen(store: AppStore) {
    Scaffold(topBar = { ScreenBar("Stash") }) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Settings", fontWeight = FontWeight.SemiBold)
                        Picker(
                            "Units", store.units, UnitSystem.entries,
                            { if (it == UnitSystem.METRIC) "Centimetres" else "Inches" },
                        ) { store.setUnits(it) }
                        Text(
                            "Working gauge: ${store.lastGauge.describe(store.units)}",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            NumberField(
                                "Stitches / 10 cm", store.lastGauge.stitchesPer10cm,
                                { store.setGauge(com.knitstudio.engine.Gauge(it.coerceAtLeast(1.0), store.lastGauge.rowsPer10cm)) },
                                modifier = Modifier.weight(1f),
                            )
                            NumberField(
                                "Rows / 10 cm", store.lastGauge.rowsPer10cm,
                                { store.setGauge(com.knitstudio.engine.Gauge(store.lastGauge.stitchesPer10cm, it.coerceAtLeast(1.0))) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                        Text(
                            "Yarn per stitch at this gauge: " +
                                String.format(java.util.Locale.ROOT, "%.2f cm", store.lastGauge.loopLength) +
                                " · closest weight ${YarnWeight.matching(store.lastGauge).displayName}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            item { SectionHeading("Yarn") }
            items(store.stash) { yarn ->
                Card(Modifier.fillMaxWidth()) {
                    Row(
                        Modifier.padding(14.dp).fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        YarnSwatch(yarn, 34.dp)
                        Column(Modifier.weight(1f)) {
                            Text(yarn.displayName, fontWeight = FontWeight.Medium)
                            Text(
                                String.format(
                                    java.util.Locale.ROOT, "%s · %.0f g / %.0f m",
                                    yarn.weight.displayName, yarn.ballGrams, yarn.ballMetres,
                                ),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
            item {
                Text(
                    "Ball weight and length are what turn the yarn estimate into a number of " +
                        "balls. Copy them from the band.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
