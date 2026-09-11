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

If you cloned it before, update it instead:

```bash
cd ~/iphoneapp
git checkout claude/daily-life-collab-app-5g3p5p
git pull origin claude/daily-life-collab-app-5g3p5p
cd ortak/mobile
```

Confirm you are in the right place before going on. This must print a path
ending in `ortak/mobile`, and must list `app.json`:

```bash
pwd
ls app.json
```

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

## The thing most likely to stop you: App Groups

The share extension — what puts Ortak in the iOS share sheet so you can send a
WhatsApp message straight into it — needs an **App Group**
(`group.com.ortak.app`) shared between the app and the extension.

**A free Apple ID cannot create App Groups.** They need a paid Apple Developer
account ($99/yr). With a free account the build fails at the signing step with a
provisioning error mentioning the group.

If you do not have a paid account, or just want to see the app running first,
turn the extension off — everything else works without it:

In `ortak/mobile/app.json`, change the plugin entry:

```json
["expo-share-intent", { "androidIntentFilters": ["text/*"], "disableIOS": true }]
```

Then regenerate:

```bash
npx expo prebuild --platform ios --clean
```

You lose only the iOS share-sheet target. Sharing into Ortak on iOS still works
through the Shortcut recipe in the main README, and **Android keeps its full
share sheet** either way.

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

**`no such file or directory: ortak/mobile`, or `ortak` not found.** You are on
the wrong branch. Run `git branch --show-current` in the repository; it must say
`claude/daily-life-collab-app-5g3p5p`.

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

**"No bundle URL present" at launch.** The Metro bundler is not running. Either
run `npx expo start` in another terminal, or just use `npx expo run:ios`.

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
