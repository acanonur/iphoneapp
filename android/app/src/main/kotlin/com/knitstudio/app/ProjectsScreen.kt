package com.knitstudio.app

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.knitstudio.engine.BuiltInPatterns
import com.knitstudio.engine.ColourAllocation
import com.knitstudio.engine.PatternKind
import com.knitstudio.engine.SavedProject
import com.knitstudio.engine.Technique
import com.knitstudio.engine.TechniqueLibrary

@Composable
fun ProjectsScreen(
    store: AppStore,
    onOpen: (SavedProject) -> Unit,
    onNew: (SavedProject) -> Unit,
) {
    Scaffold(
        topBar = { ScreenBar("Projects") },
        floatingActionButton = {
            FloatingActionButton(onClick = {
                onNew(
                    SavedProject(
                        name = "New project",
                        kind = PatternKind.HAT,
                        gauge = store.lastGauge,
                        allocations = ColourAllocation.single(
                            store.stash.firstOrNull()
                                ?: BuiltInPatterns.palette(com.knitstudio.engine.YarnWeight.LIGHT)[0],
                        ),
                    ),
                )
            }) {
                Icon(Icons.Filled.Add, contentDescription = "New project")
            }
        },
    ) { padding ->
        if (store.projects.isEmpty()) {
            Column(modifier = Modifier.fillMaxSize().padding(padding)) {
                EmptyState(
                    "No projects yet",
                    "Set up a project and the app works out the cast-on, every shaping row, " +
                        "and how much yarn to buy.",
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(store.projects, key = { it.id }) { project ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onOpen(project) },
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp).fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(project.name, fontWeight = FontWeight.SemiBold)
                                Text(
                                    "${project.kind.displayName} · " +
                                        project.gauge.describe(store.units),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                project.effectiveAllocations.take(4).forEach {
                                    androidx.compose.foundation.layout.Box(
                                        modifier = Modifier
                                            .size(14.dp)
                                            .clip(CircleShape)
                                            .background(hexToColor(it.yarn.hex)),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ProjectDetailScreen(
    store: AppStore,
    project: SavedProject,
    onBack: () -> Unit,
    onEdit: (SavedProject) -> Unit,
    onOpenTechnique: (Technique) -> Unit,
) {
    var tab by remember { mutableIntStateOf(0) }
    val tabs = buildList {
        add("Plan"); add("Shopping"); add("Counter")
        if (project.chart != null) add("Chart")
    }

    Scaffold(
        topBar = {
            ScreenBar(project.name, onBack = onBack) {
                IconButton(onClick = { onEdit(project) }) {
                    Icon(Icons.Filled.Edit, contentDescription = "Edit")
                }
                IconButton(onClick = { store.delete(project); onBack() }) {
                    Icon(Icons.Filled.Delete, contentDescription = "Delete")
                }
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = tab) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = tab == index,
                        onClick = { tab = index },
                        text = { Text(title) },
                    )
                }
            }
            when (tab) {
                0 -> PlanTab(store, project, onOpenTechnique)
                1 -> ShoppingTab(store, project)
                2 -> CounterTab(store, project)
                else -> ChartTab(store, project)
            }
        }
    }
}

@Composable
private fun PlanTab(store: AppStore, project: SavedProject, onOpenTechnique: (Technique) -> Unit) {
    val context = LocalContext.current
    val plan = remember(project, store.units) { project.plan(store.units) }

    LazyColumn(
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            // Two facts per row keeps them readable on a phone.
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                plan.facts.chunked(2).forEach { pair ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        pair.forEach { fact -> FactCard(fact, Modifier.weight(1f)) }
                        if (pair.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }

        items(plan.warnings) { NoteBox(it, warning = true) }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Text("Yarn needed", fontWeight = FontWeight.SemiBold)
                    Text(
                        String.format(
                            java.util.Locale.ROOT,
                            "%.0f m across %.0f stitches", plan.metres(), plan.totalStitches,
                        ),
                    )
                    Text(
                        "Estimated from your gauge, not from a table — a tighter swatch means more yarn.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        plan.sections.forEach { section ->
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                section.name,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.weight(1f),
                            )
                            if (section.totalRows > 0) {
                                Text(
                                    "${section.totalRows} rows",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        section.detail?.let {
                            Text(
                                it,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        section.steps.forEach { step ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(if (step.isMilestone) "◆" else "•")
                                Column {
                                    Text(step.text, style = MaterialTheme.typography.bodyMedium)
                                    step.stitchCount?.let {
                                        Text(
                                            "$it sts",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        items(plan.notes) { NoteBox(it) }

        item {
            val techniques = TechniqueLibrary.recommended(project.kind, project.structure)
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Techniques this uses", fontWeight = FontWeight.SemiBold)
                    techniques.forEach { technique ->
                        Text(
                            technique.displayName,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(6.dp))
                                .clickable { onOpenTechnique(technique) }
                                .padding(vertical = 6.dp),
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
        }

        item {
            FilledTonalButton(
                onClick = { sharePlainText(context, plan.plainText(store.units)) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Filled.Share, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Share the pattern")
            }
        }
    }
}

@Composable
private fun ShoppingTab(store: AppStore, project: SavedProject) {
    val context = LocalContext.current
    val list = remember(project) { project.shoppingList() }

    LazyColumn(
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(list.lines) { line ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.padding(14.dp).fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    YarnSwatch(line.yarn, 34.dp)
                    Column(modifier = Modifier.weight(1f)) {
                        Text(line.yarn.displayName, fontWeight = FontWeight.Medium)
                        Text(
                            line.role,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            String.format(
                                java.util.Locale.ROOT,
                                "%.0f m ≈ %.0f g needed", line.metres, line.grams,
                            ),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            "${line.balls}",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            if (line.balls == 1) "ball" else "balls",
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                }
            }
        }

        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Text("Total: ${list.totalBalls} balls", fontWeight = FontWeight.SemiBold)
                    Text(
                        String.format(
                            java.util.Locale.ROOT,
                            "%.0f m ≈ %.0f g", list.totalMetres, list.totalGrams,
                        ),
                    )
                    list.totalCost?.let {
                        Text(String.format(java.util.Locale.ROOT, "Estimated cost: %.2f", it))
                    }
                    Text(
                        String.format(
                            java.util.Locale.ROOT,
                            "Includes a %.0f%% margin. Buy every ball of a colour in the same dye " +
                                "lot — a second lot bought later will not match.",
                            list.safetyMargin * 100,
                        ),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        item { SectionHeading("Needles") }
        items(list.needles) { Text("• $it", style = MaterialTheme.typography.bodyMedium) }
        item { SectionHeading("Notions") }
        items(list.notions) { Text("• $it", style = MaterialTheme.typography.bodyMedium) }

        item {
            FilledTonalButton(
                onClick = { sharePlainText(context, list.plainText(project.name)) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Filled.Share, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Share the list")
            }
        }
    }
}

@Composable
private fun CounterTab(store: AppStore, project: SavedProject) {
    val plan = remember(project, store.units) { project.plan(store.units) }
    var rows by remember(project.id) { mutableStateOf(project.rowsCompleted) }

    fun commit(value: Int) {
        rows = value.coerceAtLeast(0)
        store.update(project.copy(rowsCompleted = rows))
    }

    // Which section the current row falls in, and how far through it.
    var remaining = rows
    var sectionName = plan.sections.lastOrNull()?.name ?: ""
    var rowInSection = 0
    var sectionRows = 0
    for (section in plan.sections) {
        val total = section.totalRows
        if (total > 0 && remaining < total) {
            sectionName = section.name
            rowInSection = remaining + 1
            sectionRows = total
            break
        }
        remaining -= total
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
    ) {
        Text("$rows", style = MaterialTheme.typography.displayLarge, fontWeight = FontWeight.Bold)
        Text(
            "rows worked of ${plan.totalRows}",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (sectionRows > 0) {
            Card {
                Column(
                    Modifier.padding(14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(sectionName, fontWeight = FontWeight.SemiBold)
                    Text(
                        "row $rowInSection of $sectionRows",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
        LinearProgressIndicator(
            progress = { if (plan.totalRows > 0) rows.toFloat() / plan.totalRows else 0f },
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            FilledTonalButton(onClick = { commit(rows - 1) }, modifier = Modifier.size(72.dp)) {
                Icon(Icons.Filled.Remove, contentDescription = "One row back")
            }
            Button(onClick = { commit(rows + 1) }, modifier = Modifier.size(96.dp)) {
                Icon(Icons.Filled.Add, contentDescription = "One row done")
            }
        }
        androidx.compose.material3.TextButton(onClick = { commit(0) }) { Text("Reset") }
    }
}

@Composable
private fun ChartTab(store: AppStore, project: SavedProject) {
    val chart = project.chart ?: return
    LazyColumn(
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
            ) {
                ChartCanvas(chart = chart, gauge = project.gauge, cellWidth = 14.dp)
            }
        }
        item { ChartLegend(chart) }
        items(chart.reviewNotes(project.gauge)) { NoteBox(it) }
        item { SectionHeading("Row by row") }
        items(chart.writtenInstructions()) {
            Text(it, style = MaterialTheme.typography.bodySmall)
        }
    }
}

/** Android's share sheet, used for both the pattern and the shopping list. */
fun sharePlainText(context: android.content.Context, text: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
    }
    context.startActivity(Intent.createChooser(intent, null))
}
