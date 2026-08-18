// Pure Kotlin/JVM. Deliberately no Android dependencies, so the whole knitting
// engine can be compiled and unit-tested without the Android SDK — exactly as
// the Swift engine has no UI imports.
plugins {
    kotlin("jvm") version "2.1.0"
}

kotlin {
    jvmToolchain(21)
}

dependencies {
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "failed", "skipped")
    }
}
