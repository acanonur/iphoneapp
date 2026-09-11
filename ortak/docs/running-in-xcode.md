# Running Ortak on your iPhone from Xcode

Ortak is an **Expo / React Native** app, not a hand-written Swift project, so
there is no `.xcodeproj` in the repository to double-click. Xcode's project is
**generated** from `app.json` and the installed packages, and it is deliberately
not committed — regenerating it is how config changes take effect.

> **Careful:** this repository holds more than one app. `ios/` at the top level
> is the **AI Secretary**, a different SwiftUI app. Ortak lives in
> `ortak/mobile/`. Everything below happens there.

---

## Before you start

On the Mac:

- **Xcode** from the App Store. Open it once and let it install the command-line
  components, then `sudo xcode-select --install` if `git`/`clang` are missing.
- **Node 22 or newer** — `node -v` to check.
- **CocoaPods** — `sudo gem install cocoapods`, or `brew install cocoapods`.

---

## The short way — no Xcode window needed

```bash
cd ortak/mobile
npm ci
npx expo run:ios
```

That generates the native project, installs the pods, builds, and launches the
simulator. For a **physical iPhone**, plug it in and:

```bash
npx expo run:ios --device
```

Xcode must be installed for this, but you never have to open it. This is the
fastest path, and the one to try first.

---

## Opening it in Xcode properly

```bash
cd ortak/mobile
npm ci
npx expo prebuild --platform ios     # writes ios/ and runs pod install
open ios/Ortak.xcworkspace
```

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

The app needs its server. On the same Mac:

```bash
cd ortak/server
npm install
npm run dev          # http://localhost:8788
```

- **Simulator** — enter `http://localhost:8788` on the first screen.
- **Physical iPhone** — `localhost` is the phone, not the Mac. Use the Mac's
  address on your network, which `ipconfig getifaddr en0` will print:
  `http://192.168.1.x:8788`. Both devices must be on the same Wi-Fi.

---

## When something goes wrong

**Pods fail to install.** `cd ios && pod install --repo-update`.

**A stale native project after changing `app.json` or adding a package.**
`npx expo prebuild --platform ios --clean` rebuilds `ios/` from scratch. It is
safe: nothing in there is hand-edited, which is why it is not committed.

**"No bundle URL present" at launch.** The Metro bundler is not running —
`npx expo start` in another terminal, or just use `npx expo run:ios`.

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
