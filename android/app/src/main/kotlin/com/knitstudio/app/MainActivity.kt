package com.knitstudio.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.GridOn
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.knitstudio.engine.SavedProject

/** Where the app can be. Root tabs plus the screens pushed on top of them. */
sealed interface Screen {
    data object Projects : Screen
    data object Patterns : Screen
    data object Learn : Screen
    data object Stash : Screen
    data class ProjectDetail(val projectId: String) : Screen
    data class Editor(val draft: SavedProject, val isNew: Boolean) : Screen
    data class TechniqueDetail(val techniqueId: String) : Screen
    data object Abbreviations : Screen
}

private enum class Tab(val screen: Screen, val label: String, val icon: ImageVector) {
    PROJECTS(Screen.Projects, "Projects", Icons.Filled.Layers),
    PATTERNS(Screen.Patterns, "Patterns", Icons.Filled.GridOn),
    LEARN(Screen.Learn, "Learn", Icons.Filled.Book),
    STASH(Screen.Stash, "Stash", Icons.Filled.Inventory2),
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            KnitStudioTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    KnitStudioApp(remember { AppStore(applicationContext) })
                }
            }
        }
    }
}

@Composable
fun KnitStudioApp(store: AppStore) {
    // A plain list is enough of a back stack for four tabs and two push levels,
    // and avoids pulling in a navigation library for it.
    var stack by remember { mutableStateOf<List<Screen>>(listOf(Screen.Projects)) }
    val current = stack.last()
    val isRoot = stack.size == 1

    fun push(screen: Screen) { stack = stack + screen }
    fun pop() { if (stack.size > 1) stack = stack.dropLast(1) }
    fun selectTab(tab: Tab) { stack = listOf(tab.screen) }

    BackHandler(enabled = !isRoot) { pop() }

    Scaffold(
        bottomBar = {
            if (isRoot) {
                NavigationBar {
                    Tab.entries.forEach { tab ->
                        NavigationBarItem(
                            selected = current == tab.screen,
                            onClick = { selectTab(tab) },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (val screen = current) {
                Screen.Projects -> ProjectsScreen(
                    store = store,
                    onOpen = { push(Screen.ProjectDetail(it.id)) },
                    onNew = { push(Screen.Editor(it, isNew = true)) },
                )

                Screen.Patterns -> PatternsScreen(
                    store = store,
                    onUsePreset = { push(Screen.Editor(it, isNew = true)) },
                )

                Screen.Learn -> LearnScreen(
                    store = store,
                    onOpenTechnique = { push(Screen.TechniqueDetail(it.id)) },
                    onOpenAbbreviations = { push(Screen.Abbreviations) },
                )

                Screen.Stash -> StashScreen(store = store)

                is Screen.ProjectDetail -> {
                    val project = store.projects.firstOrNull { it.id == screen.projectId }
                    if (project == null) {
                        Text("This project was deleted.", modifier = Modifier.padding(24.dp))
                    } else {
                        ProjectDetailScreen(
                            store = store,
                            project = project,
                            onBack = { pop() },
                            onEdit = { push(Screen.Editor(it, isNew = false)) },
                            onOpenTechnique = { push(Screen.TechniqueDetail(it.id)) },
                        )
                    }
                }

                is Screen.Editor -> EditorScreen(
                    store = store,
                    initial = screen.draft,
                    isNew = screen.isNew,
                    onBack = { pop() },
                    onSaved = { saved ->
                        if (screen.isNew) store.add(saved) else store.update(saved)
                        stack = listOf(Screen.Projects) + Screen.ProjectDetail(saved.id)
                    },
                )

                is Screen.TechniqueDetail -> TechniqueDetailScreen(
                    store = store,
                    techniqueId = screen.techniqueId,
                    onBack = { pop() },
                )

                Screen.Abbreviations -> AbbreviationsScreen(onBack = { pop() })
            }
        }
    }
}
