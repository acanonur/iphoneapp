pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "KnitStudio"

// The engine is pure Kotlin/JVM and builds anywhere.
include(":engine")

// The Android app needs the Android Gradle Plugin and the Android SDK. Pass
// -PengineOnly to work on (and test) the engine without either — useful in CI
// or any environment that cannot reach Google's Maven repository.
if (!providers.gradleProperty("engineOnly").isPresent) {
    include(":app")
}
