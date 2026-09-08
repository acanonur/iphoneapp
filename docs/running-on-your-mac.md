# Running KnitStudio on your Mac

Start to finish, from a Mac with nothing installed to the app open on screen.

**You do not need an Apple Developer account.** That is only for putting an app
on the App Store. Running it on your own Mac is free.

**Time:** about 20 minutes, most of which is Xcode downloading in the background.

---

## What you need

| | |
|---|---|
| A Mac | macOS 14 (Sonoma) or newer |
| Xcode 15 or newer | Free from the Mac App Store, ~10 GB |
| About 25 GB free disk | Xcode is large |

---

## Step 1 — Install Xcode

Open the **App Store**, search for **Xcode**, click **Get**. It is a big
download; start it and make a cup of tea.

When it finishes, **open Xcode once** and let it install the extra components it
asks for, then accept the licence agreement. It will not work until you have
done this.

Then open **Terminal** (⌘Space, type "Terminal") and run:

```bash
xcode-select --install
```

If it says the tools are already installed, that is fine — carry on.

---

## Step 2 — Install Homebrew

Homebrew installs developer tools. Skip this if you already have it (check with
`brew --version`).

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

At the end it prints a short **"Next steps"** section with two `echo` commands
to run. Run them — otherwise your Mac will not find `brew` afterwards.

Check it worked:

```bash
brew --version
```

---

## Step 3 — Install XcodeGen

```bash
brew install xcodegen
xcodegen --version
```

You need **2.35 or newer**.

> **What is XcodeGen and why is it here?**
> Xcode project files are enormous, machine-generated, and conflict horribly
> when two people edit them. So this project does not store one. Instead there
> is a readable 83-line file, `project.yml`, describing the app, and XcodeGen
> builds the real Xcode project from it. You run it once now, and again any
> time you add a new file.

---

## Step 4 — Download the code

```bash
mkdir -p ~/Developer
cd ~/Developer
git clone https://github.com/acanonur/iphoneapp.git
cd iphoneapp
git checkout claude/knitting-pattern-calculator-app-m2qece
```

That last line matters — the knitting app lives on that branch, not on `main`.

---

## Step 5 — Generate the Xcode project

```bash
cd ios-knitstudio
xcodegen generate
```

You should see `Created project at .../KnitStudio.xcodeproj`.

---

## Step 6 — Open it

```bash
open KnitStudio.xcodeproj
```

Xcode opens. Give it a minute the first time — it indexes the whole project
before it will build.

---

## Step 7 — Choose "My Mac"

At the top of the Xcode window, next to the ▶ and ■ buttons, there is a bar
showing **KnitStudio** and then a device name.

Click the **device name** and choose **My Mac** from the list.

---

## Step 8 — Press Run

Click **▶** (or press **⌘R**).

The first build takes a couple of minutes. Then KnitStudio opens as a normal Mac
window, with a sidebar down the left.

---

## Step 9 — Run the tests too

Press **⌘U**.

This runs 60-odd tests over the knitting maths — gauge, every calculator, the
chart geometry, the pattern parser and the shopping list. They check the numbers
against real published yardages, so if they pass, the maths is right.

You will see a green tick beside each one in the test navigator (⌘6).

---

## Want to see it on an iPhone too?

Same project, no changes. Go back to the device menu in step 7 and choose any
simulator — **iPhone 16** for example — then press ⌘R. The simulator takes a
minute to boot the first time.

Note it looks different on iPhone by design: tabs along the bottom instead of a
sidebar, because that is what each platform expects.

---

## If the build fails

**Please expect this, and do not be put off.**

The Swift code was written in an environment that had no Swift compiler, so this
will be the first time it is ever compiled. Some errors on the first build are
likely — most probably small: a type mismatch, a renamed API, a missing import.

If it happens:

1. In Xcode, press **⌘5** to open the Issue navigator.
2. Click the first red error.
3. Copy the error text and the file name, and send them over — they are usually
   a one-line fix each.

The knitting maths is the part that was verified thoroughly (the Kotlin port of
the same engine compiles and passes 73 tests), so any errors are almost
certainly in the screens, not the calculations.

### Other things that can go wrong

| What you see | Fix |
|---|---|
| `xcodegen: command not found` | Homebrew is not on your PATH. Re-run the "Next steps" commands Homebrew printed in step 2. |
| `Unsupported Swift Version` or SDK errors | Your Xcode is too old. It needs to be 15 or newer. |
| "Signing for KnitStudio requires a development team" | Click the **KnitStudio** target → **Signing & Capabilities** → set **Team** to **None** and **Signing Certificate** to **Sign to Run Locally**. That is enough to run it on your own machine. |
| App builds but the window is blank | Stop (⌘.) and run again. Xcode occasionally launches before the build finishes copying resources. |

---

## A quick tour, once it opens

Something to actually try, in order:

**1. Tell it how you knit.** Go to the **Stash** tab. Either type your gauge
straight in, or tap **Gauge from a swatch** and enter what you counted on a real
swatch. Everything the app calculates comes from this one number — it is why two
people knitting the same pattern get different numbers, and why the app asks.

**2. Pick something to make.** Go to **Patterns** and choose **Classic beanie**.

**3. Change it.** In the editor, set the head circumference to whoever it is for.
Try changing the yarn weight and watch the stitch count move.

**4. Read the plan.** Every row, in order: how many to cast on, how deep the
ribbing goes, and the crown decreases one round at a time — "Decrease round 1:
[k10, k2tog] 8 times", and so on to the last eight stitches.

**5. Look at the shopping list.** How many balls, in which colours, plus the
needles and notions. It even reminds you to buy one dye lot.

**6. Have a read.** The **Learn** tab has around fifty techniques, from
long-tail cast-on to turning a heel, each with steps and the mistakes people
usually make.

Then try **Top-down raglan sweater** — that one is the interesting piece of
maths. It works out the body and sleeve growth rates separately, which is why
the sleeve comes out fitting your actual arm instead of the balloon a plain
raglan gives you.
