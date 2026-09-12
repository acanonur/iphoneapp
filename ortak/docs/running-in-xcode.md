# Running Ortak on your iPhone from Xcode

Ortak is an **Expo / React Native** app, not a hand-written Swift project, so
there is no `.xcodeproj` in the repository to double-click. Xcode's project is
**generated** from `app.json` and the installed packages, and it is deliberately
not committed — regenerating it is how config changes take effect.

> **Careful, two things are easy to get wrong:**
>
> 1. The repository's **default branch does not contain Ortak.** The app lives on
>    the branch `claude/daily-life-collab-app-5g3p5p`. A plain `git clone` checks
>    out the other branch and you will not find `ortak/` anywhere.
> 2. This repository holds more than one app. `ios/` at the top level is the
>    **AI Secretary**, a different SwiftUI project. Ortak lives in
>    `ortak/mobile/`. Everything below happens there.

Every command block below is meant to be pasted whole. Copy the block, paste it,
press Return. There are no comments inside the blocks to strip out.

---

## Before you start

On the Mac:

- **Xcode** from the App Store. Open it once and let it install the command-line
  components, then `sudo xcode-select --install` if `git`/`clang` are missing.
- **Node 22 or newer** — run `node -v` to check.
- **CocoaPods** — `sudo gem install cocoapods`, or `brew install cocoapods`.

---

## Step 1 — get the code onto the Mac

Only needed once. Note the `--branch` flag; without it you get the wrong branch.

```bash
cd ~
git clone --branch claude/daily-life-collab-app-5g3p5p https://github.com/acanonur/iphoneapp.git
cd iphoneapp/ortak/mobile
```

If git answers `destination path 'iphoneapp' already exists and is not an empty
directory`, a clone from an earlier attempt is in the way — and it is almost
certainly on the default branch, which has no `ortak/` in it. Nothing after the
failed clone will work, because the `cd` fails too and every later command then
runs in your home folder.

The simplest way out is to clone into a different folder and leave the old one
alone:

```bash
cd ~
git clone --branch claude/daily-life-collab-app-5g3p5p https://github.com/acanonur/iphoneapp.git ortak-app
cd ortak-app/ortak/mobile
```

Or, to reuse the clone you already have:

```bash
cd ~/iphoneapp
git fetch origin claude/daily-life-collab-app-5g3p5p
git checkout -B claude/daily-life-collab-app-5g3p5p FETCH_HEAD
cd ortak/mobile
```

Confirm you are in the right place before going on. This must print a path
ending in `ortak/mobile`, and must list `app.json`:

```bash
pwd
ls app.json
```

If `ls` says `No such file or directory`, stop — the clone or the `cd` did not
do what you think, and running `npm ci` or `expo` from here will install into
your home folder and fail confusingly. `npm ci` in `ortak/mobile` installs
around 837 packages; a much smaller number is a sign you are somewhere else.

---

## Step 2, the short way — no Xcode window needed

From `ortak/mobile`:

```bash
npm ci
npx expo run:ios
```

That generates the native project, installs the pods, builds, and launches the
simulator. For a **physical iPhone**, plug it in and run:

```bash
npx expo run:ios --device
```

Xcode must be installed for this, but you never have to open it. This is the
fastest path, and the one to try first.

---

## Step 2, the other way — opening it in Xcode properly

From `ortak/mobile`:

```bash
npm ci
npx expo prebuild --platform ios
open ios/Ortak.xcworkspace
```

`prebuild` is what writes the `ios/` folder and runs `pod install`; it takes a
few minutes the first time.

**Open the `.xcworkspace`, not the `.xcodeproj`.** CocoaPods builds the
dependencies into the workspace; the bare project will not link.

### Start Metro first — Xcode will not do it for you

A debug build does not contain any JavaScript. It asks the Metro bundler for it
at launch, and **nothing in the Xcode project starts Metro**: the "Start
Packager" build phase that older React Native templates carried is not in
Expo's. `npx expo run:ios` starts Metro itself, which is why that route needs no
second window — pressing ▶ in Xcode does not.

So before pressing ▶, in a **separate terminal window**:

```bash
cd ~/ortak-app/ortak/mobile
npx expo start
```

Leave it running for as long as you are working in Xcode. Skipping it gives a
red screen reading `No script URL provided` and `unsanitizedScriptURLString =
(null)`.

Then in Xcode:

1. Select the **Ortak** project in the navigator.
2. Target **Ortak** → *Signing & Capabilities* → set **Team** to your Apple ID.
3. Do the same for the **ShareExtension** target — it is a second target and
   needs its own signing.
4. If Xcode complains the bundle identifier is taken, change it to something of
   your own in both targets, keeping the extension nested under the app:
   - app: `com.yourname.ortak`
   - extension: `com.yourname.ortak.ShareExtension`
5. Pick your iPhone in the device menu and press ▶.

First run on a device: the phone will refuse to launch an untrusted developer.
Settings → General → VPN & Device Management → trust your certificate.

---

## App Groups and the iOS share extension

The share extension — what would put Ortak in the iOS share sheet, so you could
send a WhatsApp message straight into it — needs an **App Group**
(`group.com.ortak.app`) shared between the app and the extension.

**A free Apple ID cannot create App Groups.** They need a paid Apple Developer
account ($99/yr). With a free "Personal Team", Xcode shows the group in red
under Signing & Capabilities and the build fails.

**So the extension is off by default.** `app.json` carries
`"disableIOS": true` on the `expo-share-intent` plugin, which means a prebuilt
project has no second target, an empty entitlements file, and signs cleanly with
a free account.

What that costs, and what it does not:

- **Android is unaffected.** Tugce keeps the full share sheet either way; the
  `disableIOS` flag is iOS-only.
- **Sharing into Ortak on iOS still works** through the Shortcut recipe in the
  main README. The `ortak://` scheme is still registered, so
  `ortak://save?text=…` opens the capture screen exactly as before.
- You lose only Ortak's own row in the iOS share sheet.

**With a paid account**, turn it back on by removing `"disableIOS": true` from
the `expo-share-intent` entry in `app.json` and running
`npx expo prebuild --platform ios --clean`. Then sign the **ShareExtension**
target as well as the app.

---

## Bundle identifiers

`com.canonur.ortak` is the identifier in `app.json`. Bundle identifiers are
global across all of Apple's developers, so if Xcode says

> Failed Registering Bundle Identifier — the app identifier "…" cannot be
> registered to your development team because it is not available

then somebody else has already claimed that string. Pick another one in
`app.json` under `expo.ios.bundleIdentifier` — anything unlikely to collide,
such as a reversed domain or your own name — and run

```bash
npx expo prebuild --platform ios --clean
```

**Change it in `app.json`, not in Xcode.** The Xcode project is generated, so
the next prebuild overwrites anything edited there.

---

## Running it against the server

The app needs its server. In a **second terminal window**, from the repository:

```bash
cd ~/iphoneapp/ortak/server
npm install
npm run dev
```

That serves `http://localhost:8788`. Leave it running.

- **Simulator** — enter `http://localhost:8788` on the app's first screen.
- **Physical iPhone** — `localhost` is the phone, not the Mac. Use the Mac's
  address on your network, which this prints:

  ```bash
  ipconfig getifaddr en0
  ```

  Then enter `http://192.168.1.x:8788` with that address. Both devices must be
  on the same Wi-Fi.

---

## When something goes wrong

**`Invalid project root`, or `The files ... do not exist`.** Two causes, both
common:

- You are not in `ortak/mobile`. Run `pwd`; if it does not end in
  `ortak/mobile`, go back to Step 1.
- You pasted a command together with a comment after it. Anything after a `#` on
  a command line is a comment to you, but the shell passes the words as
  filenames, which is what produces that error. Paste only the command.

**`destination path 'iphoneapp' already exists`.** An earlier clone is in the
way; see Step 1. Everything after that failure ran in your home folder rather
than in the project, so start again from a working `cd`.

**`Xcode project not found in project: /Users/you`.** `expo` was run outside
`ortak/mobile`. Run `pwd` and go back to Step 1.

**`no such file or directory: ortak/mobile`, or `ortak` not found.** You are on
the wrong branch. Run `git branch --show-current` in the repository; it must say
`claude/daily-life-collab-app-5g3p5p`.

**A wall of `npm warn deprecated` lines, and an `npm audit` count.** Expected,
and not worth acting on: they come from the React Native build toolchain's own
dependencies, which run on your Mac at build time and ship nothing into the app.
Do not run `npm audit fix --force` — it will move packages off the versions this
Expo SDK expects and break the build.

**Pods fail to install.**

```bash
cd ios
pod install --repo-update
```

**A stale native project after changing `app.json` or adding a package.**

```bash
npx expo prebuild --platform ios --clean
```

That rebuilds `ios/` from scratch. It is safe: nothing in there is hand-edited,
which is why it is not committed.

**`No script URL provided`, `unsanitizedScriptURLString = (null)`, or "No
bundle URL present" at launch.** The Metro bundler is not running. A debug build
holds no JavaScript of its own and fetches it from Metro, and Xcode does not
start Metro when you press ▶. Run `npx expo start` from `ortak/mobile` in
another window and press ▶ again — or use `npx expo run:ios`, which starts it
for you.

**Build succeeds, screen is blank.** Almost always Metro again; check the
terminal running it for a red error.

**Changes to `ortak/shared/` are not picked up.** That folder lives outside the
app, so Metro is told about it in `metro.config.js`. Restart Metro with
`npx expo start --clear` after editing it.

---

## Why there is no committed Xcode project

Expo calls this *continuous native generation*: `ios/` and `android/` are build
output, derived from `app.json` plus the config plugins of each package. Adding
`expo-share-intent` is what created the ShareExtension target — nobody wrote it
by hand. Committing the folder would mean maintaining generated code and
resolving merge conflicts in `project.pbxproj`, so it is in `.gitignore` and
regenerated instead.
