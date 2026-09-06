package com.knitstudio.app

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val Indigo = Color(0xFF2E4272)
private val Rust = Color(0xFFB5533C)
private val Mustard = Color(0xFFD6A32E)
private val Cream = Color(0xFFF0E9DA)

private val LightColours = lightColorScheme(
    primary = Indigo,
    secondary = Rust,
    tertiary = Mustard,
    background = Cream,
    surface = Color(0xFFFBF8F2),
)

private val DarkColours = darkColorScheme(
    primary = Color(0xFF9EB7C4),
    secondary = Color(0xFFE08C76),
    tertiary = Mustard,
)

@Composable
fun KnitStudioTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    // Material You on Android 12+, our own palette everywhere else.
    val colours = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        darkTheme -> DarkColours
        else -> LightColours
    }
    MaterialTheme(colorScheme = colours, content = content)
}

/** Turns an engine yarn's hex string into a Compose colour. */
fun hexToColor(hex: String): Color {
    val value = com.knitstudio.engine.Yarn.normaliseHex(hex).toLong(16)
    return Color(0xFF000000 or value)
}

/** Black or white, whichever stays readable on this colour. */
fun contrastingColor(hex: String): Color {
    val value = com.knitstudio.engine.Yarn.normaliseHex(hex).toLong(16)
    val r = ((value shr 16) and 0xFF) / 255.0
    val g = ((value shr 8) and 0xFF) / 255.0
    val b = (value and 0xFF) / 255.0
    return if (0.299 * r + 0.587 * g + 0.114 * b > 0.6) Color.Black else Color.White
}
