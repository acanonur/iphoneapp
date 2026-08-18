package com.knitstudio.app

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.knitstudio.engine.BodyMeasurements
import com.knitstudio.engine.FabricStructure
import com.knitstudio.engine.Gauge
import com.knitstudio.engine.HatStyle
import com.knitstudio.engine.PatternKind
import com.knitstudio.engine.SavedProject
import com.knitstudio.engine.YarnWeight

/** A stable dropdown picker — no experimental Material 3 APIs involved. */
@Composable
fun <T> Picker(
    label: String,
    selected: T,
    options: List<T>,
    display: (T) -> String,
    onSelect: (T) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = true }
                .padding(vertical = 10.dp),
        ) {
            Text(label, style = MaterialTheme.typography.labelSmall)
            Text(display(selected), style = MaterialTheme.typography.bodyLarge)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(display(option)) },
                    onClick = { onSelect(option); expanded = false },
                )
            }
        }
    }
}

@Composable
private fun StepperRow(label: String, value: Int, range: IntRange, step: Int = 1, onValue: (Int) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("$label: $value", modifier = Modifier.weight(1f))
        TextButton(onClick = { onValue((value - step).coerceIn(range)) }) { Text("−") }
        TextButton(onClick = { onValue((value + step).coerceIn(range)) }) { Text("+") }
    }
}

@Composable
private fun PercentRow(label: String, fraction: Double, range: ClosedFloatingPointRange<Float>, onValue: (Double) -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text("$label: ${(fraction * 100).toInt()}%", style = MaterialTheme.typography.bodyMedium)
        Slider(
            value = fraction.toFloat(),
            onValueChange = { onValue(it.toDouble()) },
            valueRange = range,
        )
    }
}

@Composable
fun EditorScreen(
    store: AppStore,
    initial: SavedProject,
    isNew: Boolean,
    onBack: () -> Unit,
    onSaved: (SavedProject) -> Unit,
) {
    var project by remember { mutableStateOf(initial) }
    val units = store.units

    Scaffold(
        topBar = {
            ScreenBar(if (isNew) "New project" else "Edit", onBack = onBack) {
                TextButton(onClick = {
                    store.setGauge(project.gauge)
                    onSaved(project)
                }) { Text("Save") }
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp)) {
                        OutlinedTextField(
                            value = project.name,
                            onValueChange = { project = project.copy(name = it) },
                            label = { Text("Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Picker(
                            "Type", project.kind, PatternKind.entries, { it.displayName },
                        ) { project = project.copy(kind = it) }
                        Text(
                            project.kind.blurb,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Picker(
                            "Fabric", project.structure, FabricStructure.entries, { it.displayName },
                        ) { project = project.copy(structure = it) }
                        Text(
                            project.structure.note,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Gauge", fontWeight = FontWeight.SemiBold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            NumberField(
                                "Stitches / 10 cm", project.gauge.stitchesPer10cm,
                                { project = project.copy(gauge = Gauge(it.coerceAtLeast(1.0), project.gauge.rowsPer10cm)) },
                                modifier = Modifier.weight(1f),
                            )
                            NumberField(
                                "Rows / 10 cm", project.gauge.rowsPer10cm,
                                { project = project.copy(gauge = Gauge(project.gauge.stitchesPer10cm, it.coerceAtLeast(1.0))) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                        Picker(
                            "Start from a yarn weight",
                            YarnWeight.matching(project.gauge),
                            YarnWeight.entries,
                            { "${it.displayName} — ${it.commonNames}" },
                        ) { project = project.copy(gauge = it.nominalGauge) }
                        if (!project.gauge.looksPlausible) {
                            NoteBox(
                                "That gauge looks unusual. Check the swatch was measured over 10 cm " +
                                    "and that stitches and rows are the right way round.",
                                warning = true,
                            )
                        }
                        Text(
                            "Every number in the plan comes from this. Measure a blocked swatch — " +
                                "guessing here is what makes sweaters come out the wrong size.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            if (project.kind.relevantMeasurements.isNotEmpty()) {
                item {
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Measurements", fontWeight = FontWeight.SemiBold)
                            Picker(
                                "Size preset", "Custom",
                                listOf("Custom") + BodyMeasurements.sizePresets.map { it.first },
                                { it },
                            ) { name ->
                                BodyMeasurements.sizePresets.firstOrNull { it.first == name }?.let {
                                    project = project.copy(measurements = it.second)
                                }
                            }
                            project.kind.relevantMeasurements.forEach { field ->
                                NumberField(
                                    field.label,
                                    units.fromCentimetres(field.valueIn(project.measurements)),
                                    { entered ->
                                        project = project.copy(
                                            measurements = field.setIn(
                                                project.measurements, units.toCentimetres(entered),
                                            ),
                                        )
                                    },
                                    suffix = units.lengthLabel,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                            Text(
                                "Measure the body, not a garment. Ease is added separately below.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Fit and shaping", fontWeight = FontWeight.SemiBold)
                        val options = project.options
                        fun setOptions(new: com.knitstudio.engine.ProjectOptions) {
                            project = project.copy(options = new)
                        }

                        when (project.kind) {
                            PatternKind.SCARF, PatternKind.BLANKET -> {
                                LengthRow("Width", options.width, units) { setOptions(options.copy(width = it)) }
                                LengthRow("Length", options.length, units) { setOptions(options.copy(length = it)) }
                                StepperRow("Garter edge (sts)", options.edgeStitches, 0..12) {
                                    setOptions(options.copy(edgeStitches = it))
                                }
                            }
                            PatternKind.COWL -> {
                                LengthRow("Circumference", options.cowlCircumference, units) {
                                    setOptions(options.copy(cowlCircumference = it))
                                }
                                LengthRow("Height", options.cowlHeight, units) {
                                    setOptions(options.copy(cowlHeight = it))
                                }
                                LengthRow("Ribbed edge", options.ribDepth, units) {
                                    setOptions(options.copy(ribDepth = it))
                                }
                            }
                            PatternKind.HAT -> {
                                Picker("Style", options.hatStyle, HatStyle.entries, { it.displayName }) {
                                    setOptions(options.copy(hatStyle = it))
                                }
                                PercentRow("Negative ease", options.ease, 0f..0.2f) {
                                    setOptions(options.copy(ease = it))
                                }
                                StepperRow("Crown sections", options.crownSections, 4..12, 2) {
                                    setOptions(options.copy(crownSections = it))
                                }
                                LengthRow("Brim depth", options.ribDepth, units) {
                                    setOptions(options.copy(ribDepth = it))
                                }
                            }
                            PatternKind.RAGLAN_SWEATER -> {
                                PercentRow("Ease at the chest", options.ease, -0.05f..0.4f) {
                                    setOptions(options.copy(ease = it))
                                }
                                StepperRow("Raglan line (sts)", options.raglanStitches, 1..6) {
                                    setOptions(options.copy(raglanStitches = it))
                                }
                                LengthRow("Hem rib", options.ribDepth, units) {
                                    setOptions(options.copy(ribDepth = it))
                                }
                                LengthRow("Cuff rib", options.cuffDepth, units) {
                                    setOptions(options.copy(cuffDepth = it))
                                }
                            }
                            PatternKind.SOCK -> {
                                PercentRow("Negative ease", options.ease, 0f..0.2f) {
                                    setOptions(options.copy(ease = it))
                                }
                                LengthRow("Leg length", options.legLength, units) {
                                    setOptions(options.copy(legLength = it))
                                }
                                LengthRow("Cuff rib", options.cuffDepth, units) {
                                    setOptions(options.copy(cuffDepth = it))
                                }
                            }
                            PatternKind.MITTEN -> {
                                PercentRow("Negative ease", options.ease, 0f..0.15f) {
                                    setOptions(options.copy(ease = it))
                                }
                                LengthRow("Cuff rib", options.ribDepth, units) {
                                    setOptions(options.copy(ribDepth = it))
                                }
                            }
                            PatternKind.SHAWL -> {
                                LengthRow("Wingspan", options.wingspan, units) {
                                    setOptions(options.copy(wingspan = it))
                                }
                                StepperRow("Increases per RS row", options.increasesPerRightSideRow, 2..8, 2) {
                                    setOptions(options.copy(increasesPerRightSideRow = it))
                                }
                            }
                        }
                        StepperRow("Stitch repeat (multiple of)", options.stitchMultiple, 1..24) {
                            setOptions(options.copy(stitchMultiple = it))
                        }
                        PercentRow("Spare yarn margin", options.safetyMargin, 0f..0.5f) {
                            setOptions(options.copy(safetyMargin = it))
                        }
                    }
                }
            }

            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Colours", fontWeight = FontWeight.SemiBold)
                        if (project.chart != null) {
                            Text("Colour amounts come from the attached chart, so the split is exact.")
                            TextButton(onClick = { project = project.copy(chart = null) }) {
                                Text("Remove chart")
                            }
                        } else {
                            project.allocations.forEach { allocation ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    YarnSwatch(allocation.yarn, 26.dp)
                                    Text(allocation.yarn.displayName, modifier = Modifier.weight(1f))
                                    Text("${(allocation.clampedShare * 100).toInt()}%")
                                }
                            }
                            if (store.stash.isNotEmpty()) {
                                Picker("Add a colour from the stash", "Choose…",
                                    listOf("Choose…") + store.stash.map { it.displayName }, { it },
                                ) { name ->
                                    store.stash.firstOrNull { it.displayName == name }?.let { yarn ->
                                        val index = project.allocations.size
                                        project = project.copy(
                                            allocations = project.allocations + com.knitstudio.engine.ColourAllocation(
                                                yarn,
                                                if (index == 0) 1.0 else 0.25,
                                                com.knitstudio.engine.ColourAllocation.roleName(index),
                                            ),
                                        )
                                    }
                                }
                            }
                        }
                        if (store.charts.isNotEmpty()) {
                            Picker("Attach a chart", project.chart?.name ?: "None",
                                listOf("None") + store.charts.map { it.name }, { it },
                            ) { name ->
                                project = project.copy(
                                    chart = store.charts.firstOrNull { it.name == name },
                                )
                            }
                        }
                    }
                }
            }

            item {
                Button(
                    onClick = { store.setGauge(project.gauge); onSaved(project) },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Save and see the plan") }
            }
        }
    }
}

@Composable
private fun LengthRow(
    label: String,
    centimetres: Double,
    units: com.knitstudio.engine.UnitSystem,
    onValue: (Double) -> Unit,
) {
    NumberField(
        label = label,
        value = units.fromCentimetres(centimetres),
        onValue = { onValue(units.toCentimetres(it)) },
        suffix = units.lengthLabel,
        modifier = Modifier.fillMaxWidth(),
    )
}
