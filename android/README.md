# KnitStudio for Android 🧶🤖

The Android build of KnitStudio: the same knitting technique guide, pattern
calculator, chart tools and yarn shopping list as the iOS/macOS app.

Runs entirely on-device — the app requests no permissions and has no `INTERNET`
permission at all.

## Why this is a port and not a shared codebase

The Apple app in [`../ios-knitstudio/`](../ios-knitstudio/) is Swift and
SwiftUI, neither of which exists on Android. There is no build setting that
changes that, so the app was ported rather than recompiled — but only the UI had
to be rewritten. The valuable part, the knitting maths, moved across as pure
logic and is verified to produce identical numbers.

## Layout

```
engine/    Pure Kotlin/JVM. No Android dependencies at all, so it compiles and
           unit-tests without the Android SDK. Gauge, shaping, the yarn model,
           seven garment calculators, colourwork charts, the shopping list and
           the written-pattern parser.
app/       Android application: Jetpack Compose UI, Material 3, one activity.
```

The engine has no Android imports for the same reason the Swift engine has no
UI imports: it is the part worth testing, so nothing platform-specific is
allowed near it.

## Building

You need JDK 17+ and Android Studio (or the Android SDK command-line tools).

```bash
cd android
./gradlew :app:assembleDebug      # builds the APK
./gradlew :engine:test            # runs the engine test suite
```

Or open the `android/` folder in Android Studio and press Run.

### Working on the engine without the Android SDK

The `:app` module needs the Android Gradle Plugin and Google's Maven
repository. If you do not have those — in CI, or a restricted network — skip it:

```bash
./gradlew :engine:test -PengineOnly
```

`settings.gradle.kts` leaves `:app` out of the build when that flag is set, so
the engine still compiles and tests on a bare JDK.

## How the numbers are verified

The Swift XCTest suite is the specification. The Kotlin tests assert the same
constants, so the port is correct exactly when they pass:

| Project | Asserted |
|---|---|
| Hat | 96 sts cast on, 22 crown rounds, 4120 stitches |
| Raglan sweater | 84 neck, 40 increase rounds, 236 body / 74 sleeve, 58668 stitches |
| Socks | 64 sts, 32-row heel flap, 17 gusset pick-up, 23504 stitches (a pair) |
| Shawl | 504 sts, 252 rows, 63882 stitches |
| Loop length | 1.696970 (DK), 2.097222 (worsted), 1.228571 (sock) |

Plus areal-density bounds, the compound-raglan sleeve fit, the whole
written-pattern parser, chart geometry, the shopping list and JSON round-trips.
73 tests in total, and they run on any JDK.

### One translation trap worth knowing

Swift's `Double.rounded()` rounds halves **away from zero**. Kotlin's `round()`
does not. Every stitch count in the engine would have drifted at `.5`
boundaries, silently and only sometimes. `Shaping.kt` defines `swiftRounded()`
and the port uses it everywhere the Swift used `.rounded()`; a test pins the
semantics so it cannot regress.

## What is not here yet

The Apple app has two features this build does not:

- **Image → colourwork chart.** The algorithm (median cut, k-means refinement,
  Floyd–Steinberg dithering, gauge-aware row count) is platform-independent and
  ports directly; only the bitmap sampling needs an Android implementation.
- **Chart editing by tapping cells.** Charts render and can be attached to a
  project, but the painting UI has not been rewritten yet.

Everything else — the technique guide, all seven calculators, presets, charts,
the shopping list, the row counter and the pattern parser — is here.

## Releasing on Google Play

See [`../docs/platforms-and-release.md`](../docs/platforms-and-release.md) §6.
The one thing to start early: new **personal** developer accounts must run a
closed test with 12 testers for 14 continuous days before they can ship to
production.
