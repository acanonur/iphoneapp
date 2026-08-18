// Pure Kotlin/JVM. Deliberately no Android dependencies, so the whole knitting
// engine can be compiled and unit-tested without the Android SDK — exactly as
// the Swift engine has no UI imports.
plugins {
    kotlin("jvm") version "2.1.0"
    // Pure-Kotlin, multiplatform serialisation: keeps the engine free of any
    // platform dependency while still giving the app a persistence format.
    kotlin("plugin.serialization") version "2.1.0"
}

// Android cannot load class files newer than Java 17, and :app depends on this
// module — so compile with whatever JDK is present but emit 17 bytecode.
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    api("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "failed", "skipped")
    }
}
