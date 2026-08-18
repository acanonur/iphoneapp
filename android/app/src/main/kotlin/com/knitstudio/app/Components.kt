package com.knitstudio.app

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.knitstudio.engine.ColourChart
import com.knitstudio.engine.Gauge
import com.knitstudio.engine.PlanFact
import com.knitstudio.engine.Yarn

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScreenBar(title: String, onBack: (() -> Unit)? = null, actions: @Composable () -> Unit = {}) {
    TopAppBar(
        title = { Text(title, maxLines = 1) },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
            }
        },
        actions = { actions() },
    )
}

/** A round colour chip with a border so pale yarns are still visible. */
@Composable
fun YarnSwatch(yarn: Yarn, size: Dp = 28.dp, label: String? = null) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(hexToColor(yarn.hex))
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (label != null) {
            Text(
                text = label,
                color = contrastingColor(yarn.hex),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

/** One headline number from a plan. */
@Composable
fun FactCard(fact: PlanFact, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(12.dp),
    ) {
        Text(fact.label, style = MaterialTheme.typography.labelSmall)
        Text(
            fact.value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
        fact.detail?.let {
            Text(it, style = MaterialTheme.typography.labelSmall, maxLines = 2)
        }
    }
}

@Composable
fun NoteBox(text: String, warning: Boolean = false) {
    val tint = if (warning) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(tint.copy(alpha = 0.10f))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(if (warning) "⚠" else "💡", color = tint)
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
fun SectionHeading(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
    )
}

/**
 * Draws a colourwork chart. Cells use the real stitch proportions when a gauge
 * is supplied, so the chart on screen looks like the knitted fabric rather than
 * a square grid.
 */
@Composable
fun ChartCanvas(
    chart: ColourChart,
    gauge: Gauge? = null,
    cellWidth: Dp = 16.dp,
    showGridLines: Boolean = true,
    modifier: Modifier = Modifier,
    onPaint: ((Int, Int) -> Unit)? = null,
) {
    val density = LocalDensity.current
    val cellWidthPx = with(density) { cellWidth.toPx() }
    val ratio = gauge?.let { it.rowHeight / it.stitchWidth } ?: 1.0
    val cellHeightPx = (cellWidthPx * ratio).toFloat().coerceAtLeast(4f)

    val widthDp = with(density) { (cellWidthPx * chart.width).toDp() }
    val heightDp = with(density) { (cellHeightPx * chart.height).toDp() }

    val gridColour = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)
    val majorColour = MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)

    Canvas(
        modifier = modifier
            .size(widthDp, heightDp)
            .then(
                if (onPaint == null) {
                    Modifier
                } else {
                    Modifier.pointerPaint(cellWidthPx, cellHeightPx, chart.height, chart.width, onPaint)
                },
            ),
    ) {
        for (y in 0 until chart.height) {
            // Chart row 0 is the bottom row, so it is drawn last from the top.
            val top = (chart.height - 1 - y) * cellHeightPx
            for (x in 0 until chart.width) {
                val yarn = chart.palette[chart.colourIndex(x, y).coerceIn(0, chart.palette.size - 1)]
                drawRect(
                    color = hexToColor(yarn.hex),
                    topLeft = Offset(x * cellWidthPx, top),
                    size = Size(cellWidthPx, cellHeightPx),
                )
            }
        }

        if (showGridLines && cellWidthPx >= 8f) {
            for (x in 0..chart.width) {
                val px = x * cellWidthPx
                val heavy = x % 10 == 0
                drawLine(
                    color = if (heavy) majorColour else gridColour,
                    start = Offset(px, 0f),
                    end = Offset(px, cellHeightPx * chart.height),
                    strokeWidth = if (heavy) 2f else 1f,
                )
            }
            for (y in 0..chart.height) {
                val py = y * cellHeightPx
                // Heavy lines count from the bottom, as printed charts do.
                val heavy = (chart.height - y) % 10 == 0
                drawLine(
                    color = if (heavy) majorColour else gridColour,
                    start = Offset(0f, py),
                    end = Offset(cellWidthPx * chart.width, py),
                    strokeWidth = if (heavy) 2f else 1f,
                )
            }
        }
    }
}

/** Maps a touch to a chart cell, remembering that row 0 is the bottom row. */
private fun Modifier.pointerPaint(
    cellWidthPx: Float,
    cellHeightPx: Float,
    height: Int,
    width: Int,
    onPaint: (Int, Int) -> Unit,
): Modifier = this.then(
    androidx.compose.ui.input.pointer.pointerInput(cellWidthPx, cellHeightPx, width, height) {
        androidx.compose.foundation.gestures.detectDragGestures(
            onDragStart = { offset ->
                val x = (offset.x / cellWidthPx).toInt()
                val y = height - 1 - (offset.y / cellHeightPx).toInt()
                if (x in 0 until width && y in 0 until height) onPaint(x, y)
            },
        ) { change, _ ->
            val x = (change.position.x / cellWidthPx).toInt()
            val y = height - 1 - (change.position.y / cellHeightPx).toInt()
            if (x in 0 until width && y in 0 until height) onPaint(x, y)
        }
    },
)

/** The chart legend: which letter means which yarn. */
@Composable
fun ChartLegend(chart: ColourChart) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        chart.palette.forEachIndexed { index, yarn ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                YarnSwatch(yarn, 22.dp, chart.letter(index))
                Text(
                    yarn.colourName.ifEmpty { yarn.name },
                    style = MaterialTheme.typography.labelSmall,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
fun EmptyState(title: String, message: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(
            message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** A number field that keeps its own text so partial input is not clobbered. */
@Composable
fun NumberField(
    label: String,
    value: Double,
    onValue: (Double) -> Unit,
    suffix: String? = null,
    modifier: Modifier = Modifier,
) {
    androidx.compose.material3.OutlinedTextField(
        value = formatNumber(value),
        onValueChange = { text -> text.replace(',', '.').toDoubleOrNull()?.let(onValue) },
        label = { Text(label) },
        suffix = suffix?.let { { Text(it) } },
        singleLine = true,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
            keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal,
        ),
        modifier = modifier,
    )
}

fun formatNumber(value: Double): String =
    if (value == value.toLong().toDouble()) value.toLong().toString()
    else String.format(java.util.Locale.ROOT, "%.1f", value)
