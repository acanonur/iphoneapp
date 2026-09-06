package com.knitstudio.app

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.knitstudio.engine.BuiltInPatterns
import com.knitstudio.engine.ColourChart
import com.knitstudio.engine.Gauge
import com.knitstudio.engine.SavedProject
import com.knitstudio.engine.UnitSystem
import com.knitstudio.engine.Yarn
import com.knitstudio.engine.YarnWeight
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Everything the app owns, persisted as JSON in SharedPreferences.
 *
 * The engine types are all @Serializable, so persistence is a one-liner and is
 * covered by the engine's own round-trip tests rather than hand-rolled here.
 */
class AppStore(context: Context) {

    private val prefs = context.getSharedPreferences("knitstudio", Context.MODE_PRIVATE)
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    var projects by mutableStateOf<List<SavedProject>>(emptyList())
        private set
    var charts by mutableStateOf<List<ColourChart>>(emptyList())
        private set
    var stash by mutableStateOf<List<Yarn>>(emptyList())
        private set
    var units by mutableStateOf(UnitSystem.METRIC)
    var lastGauge by mutableStateOf(YarnWeight.LIGHT.nominalGauge)
    var favouriteTechniques by mutableStateOf<Set<String>>(emptySet())
        private set

    init {
        load()
    }

    // MARK: - Mutations

    fun add(project: SavedProject) {
        projects = listOf(project) + projects
        save()
    }

    fun update(project: SavedProject) {
        projects = projects.map { if (it.id == project.id) project else it }
        save()
    }

    fun delete(project: SavedProject) {
        projects = projects.filterNot { it.id == project.id }
        save()
    }

    fun addChart(chart: ColourChart) {
        charts = listOf(chart) + charts
        save()
    }

    fun deleteChart(chart: ColourChart) {
        charts = charts.filterNot { it == chart }
        save()
    }

    fun addYarn(yarn: Yarn) {
        stash = stash + yarn
        save()
    }

    fun updateYarn(yarn: Yarn) {
        stash = stash.map { if (it.id == yarn.id) yarn else it }
        save()
    }

    fun deleteYarn(yarn: Yarn) {
        stash = stash.filterNot { it.id == yarn.id }
        save()
    }

    fun setUnits(value: UnitSystem) {
        units = value
        save()
    }

    fun setGauge(value: Gauge) {
        lastGauge = value
        save()
    }

    fun toggleFavourite(techniqueId: String) {
        favouriteTechniques = if (techniqueId in favouriteTechniques) {
            favouriteTechniques - techniqueId
        } else {
            favouriteTechniques + techniqueId
        }
        save()
    }

    // MARK: - Persistence

    fun save() {
        try {
            prefs.edit()
                .putString(KEY_PROJECTS, json.encodeToString(projects))
                .putString(KEY_CHARTS, json.encodeToString(charts))
                .putString(KEY_STASH, json.encodeToString(stash))
                .putString(KEY_UNITS, units.name)
                .putString(KEY_GAUGE, json.encodeToString(lastGauge))
                .putStringSet(KEY_FAVOURITES, favouriteTechniques)
                .apply()
        } catch (error: Exception) {
            // Losing a save is not worth crashing over; in-memory state is intact.
            android.util.Log.w("KnitStudio", "could not save", error)
        }
    }

    private fun load() {
        try {
            prefs.getString(KEY_PROJECTS, null)?.let { projects = json.decodeFromString(it) }
            prefs.getString(KEY_CHARTS, null)?.let { charts = json.decodeFromString(it) }
            prefs.getString(KEY_STASH, null)?.let { stash = json.decodeFromString(it) }
            prefs.getString(KEY_UNITS, null)?.let { units = UnitSystem.valueOf(it) }
            prefs.getString(KEY_GAUGE, null)?.let { lastGauge = json.decodeFromString(it) }
            favouriteTechniques = prefs.getStringSet(KEY_FAVOURITES, emptySet()) ?: emptySet()
        } catch (error: Exception) {
            android.util.Log.w("KnitStudio", "stored data could not be read, starting fresh", error)
        }
        if (stash.isEmpty() && charts.isEmpty() && projects.isEmpty()) seedFirstRun()
    }

    /**
     * A first launch with an empty library is unhelpful — start with a stash
     * and the built-in charts so every screen has something in it.
     */
    private fun seedFirstRun() {
        stash = BuiltInPatterns.palette(YarnWeight.LIGHT)
        charts = BuiltInPatterns.motifs.mapNotNull { BuiltInPatterns.chart(it.id) }
        save()
    }

    private companion object {
        const val KEY_PROJECTS = "projects"
        const val KEY_CHARTS = "charts"
        const val KEY_STASH = "stash"
        const val KEY_UNITS = "units"
        const val KEY_GAUGE = "gauge"
        const val KEY_FAVOURITES = "favourites"
    }
}
