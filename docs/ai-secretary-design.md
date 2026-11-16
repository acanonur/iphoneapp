# Yaver — the design, and where it lives in the code

The app's interface was designed in [Claude Design](https://claude.ai/design) and handed
over as an HTML/CSS/JS prototype (`AI Secretary.dc.html`, option **1a** — the interactive
one). This document records how that design maps onto the SwiftUI app, so the next change
can be made against the design rather than against a guess.

## The design system

The prototype is built on **Modernist**: flat and architectural, everything set in
Archivo, a near-mono red on a light ground, **zero corner radius**, strong **2px rules**,
and every label flush left — including inside a button that is wider than its text.

`ios/AISecretary/DesignSystem/` is that system in SwiftUI:

| File | What it holds |
|---|---|
| `Modernist.swift` | The token sheet — the four role colours, the 100–900 neutral and accent ramps, the spacing scale, radius 0, and the screen metrics (20pt gutter, 52pt header, 2px rules). Ported one-for-one from the bundle's `styles.css`. |
| `Typography.swift` | Archivo at 400/600/800, plus a `TypeStyle` that carries the CSS `line-height` and `letter-spacing` for each place the design uses type. Tabular figures where the design asks for `tnum`. |
| `Components.swift` | `.btn` in its four variants, `.tag`, `.field`/`.input`, the segmented control, and the two live indicators (the pulsing square, the listening meter). |
| `Lucide.swift` | The [Lucide](https://lucide.dev) glyphs the system calls for, as the design's own 24-unit path data. |
| `Brand.swift` | The name and the mark (below). |
| `SVGPath.swift` | A small SVG path-data parser, so that geometry stays in the form the design ships it in. |

Archivo is bundled under `Resources/Fonts` (SIL Open Font License — `OFL.txt` ships beside
it). Modernist has no dark palette, so the app declares `UIUserInterfaceStyle: Light` and
pins `.preferredColorScheme(.light)` rather than inventing one.

**Rules of thumb when editing:** take every colour, size and space from `Modernist` /
`TypeStyle`; never round a corner; never centre a button label; never soften a 2px rule
into a hairline.

## The screens

The redesign replaced the old two-tab shell with **one home and one primary action**.
Navigation is a small explicit state machine (`Route` in `AISecretaryApp.swift`).

| Design screen | Swift | What it does |
|---|---|---|
| Onboarding | `Views/OnboardingView.swift` | Four steps: what Yaver does and the promises it keeps, the two languages, the name it says on the call, and finding the server. |
| Home | `Views/HomeView.swift` | What is happening now, the six-cell grid of things Yaver can be asked to do, the ledger of every task — placed and answered — and the fixed *Brief Yaver* action. Says so at the top when there is no server to talk to. |
| Brief | `Views/BriefView.swift` | One form for every kind. A call takes a number and a language; a letter or a form takes a photograph. |
| Live call | `Views/LiveCallView.swift` | The four-cell progress rail, the brief, and the conversation filling in line by line, each line with its translation. *Hang up* ends it. |
| Report | `Views/ReportView.swift` | The verdict and summary, the facts in a four-cell grid, what is still to do, and the record. For a call that failed, why. For a call that was answered, who rang and a call-back button. |
| Translator | `Translator/TranslatorView.swift` | The two-column ledger: what was said on one side, what the other side reads on the other — written while the person is still speaking. |
| Settings | `Views/SettingsView.swift` | The server (status, address, find automatically), the user's name and languages, and *Answer my calls*. |

`Views/ScreenChrome.swift` holds the pieces every screen shares — the header bar under the
status bar, the footer action bar, transcript rows, notices and section headings.
`Views/TranscriptSection.swift` is the translated transcript the live call and the report
both show.

## The name and the mark

**Yaver** is Turkish for an aide — the person who makes the calls and carries the messages
for someone else. It reads the same in the app's three languages.

The mark is the capital **Y** of Archivo ExtraBold — the typeface the whole interface is
set in — with a **square full stop** on the baseline, flush with the tip of the right arm.
The square is the system's one accent, the same square that marks "live" and "done"
elsewhere in the app. `docs/brand/mark.py` builds the mark from the letter's own outline;
`DesignSystem/Brand.swift` draws it in SwiftUI from the same path, and the header's
wordmark is the word with the square set on its baseline.

| Where | What |
|---|---|
| App icon | White Y, ink stop, on the red field. Dark: ink field, red stop. Tinted: greyscale. |
| Launch screen | The mark on the paper ground (`LaunchMark`, `LaunchBackground`). |
| In the app | `BrandMark` (onboarding, about), `BrandWordmark` (header). |

## Three languages

The interface follows the iPhone's language — English, German or Turkish. Strings are
looked up with `L("English text")` (`Support/L10n.swift`); the translations live in
`de.lproj` and `tr.lproj`, and `scripts/check-strings.py` fails the build when one is
missing or its placeholders do not match. Capitals for kickers are made with the
interface's own locale, because Turkish has two letters "i".

## Translation on screen

Every line of a call that is not in the reader's language is translated by the iPhone
(Apple's Translation framework) and set under the original: the original is the record,
the translation — heavier, with the accent rule beside it — is what the reader reads.
`Translation/LiveTranslator.swift` keeps one long-lived translation session per language
pair and feeds it text as it arrives, which is what lets the translator write while
someone is still speaking.

### Two deliberate departures from the prototype

1. **The report shows what the secretary wrote.** The prototype only ever displayed call
   transcripts, because its paperwork tasks produced nothing. They now produce a real
   draft, translation or filled form, so the report renders it in the same idiom — a
   kicker, the text, a rule. Without it the user could never read what was written on
   their behalf.
2. **The share and profile controls do something.** The prototype drew both without
   handlers. Share hands over the report (never the raw transcript); the profile control
   became *Settings*, which also holds the server and call answering.
3. **Notices.** A ruled box with a square marker (`Notice`) says the things the prototype
   had no state for: the server cannot be reached, this call was simulated, a language has
   to be downloaded.

The prototype's dimensions are the design's own: it was drawn at 402 × 874, an iPhone 16
Pro, where one design pixel is one point. Its `62px` top padding is the status bar and its
`44px` bottom padding is the home indicator, so both come from the safe area rather than
from a literal in the code.

## The task kinds

The home grid offers six things, and all of them do real work:

| Kind | Where it runs | How it ends |
|---|---|---|
| Phone call | Voice provider (Retell, or the simulator) | `completed` with the conversation and a report, or `failed` with the reason |
| Answered call | Voice provider, started by someone ringing | `completed` with who rang, why, and what to do next |
| Letter or document | Claude, from text read off the photograph | `completed` — explained in your language, with a reply drafted in the letter's |
| Email or message | Claude | `draft` — written and waiting for your approval |
| Fill in a form | Claude | `needs_input` — filled as far as it can be, naming what it still needs |
| Follow-up or reminder | The backend, no model | `scheduled` |
| Live translator | On-device (Speech + Translation) | — |

A photographed letter or form is read **on the phone** with Vision, and only the
recognised text is sent — the photograph never leaves the device. That keeps the "no
stored audio" promise the app makes about calls true of paperwork as well.

With no Anthropic key on the server (`npm run claude:setup` sets one), a letter, message
or form is not pretended to be done: it ends as `failed` with the reason `reports_off`,
which the app shows as *Not set up yet* with the one command that switches it on — and
the brief screen says so before anything is typed. Calls, the answered-call demo, the
reminders and the translator need no key at all.
