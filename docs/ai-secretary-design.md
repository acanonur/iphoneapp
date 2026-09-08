# AI Secretary — the redesign, and where it lives in the code

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
| Onboarding | `Views/OnboardingView.swift` | Three steps: what the secretary does and the promises it keeps, the two languages, the name it says on the call. Reachable again later from the home screen's profile control. |
| Home | `Views/HomeView.swift` | What is happening now, the six-cell grid of things the secretary can be asked to do, the ledger of every task, and the fixed *Brief the secretary* action. |
| Brief | `Views/BriefView.swift` | One form for every kind. A call takes a number and a language; a letter or a form takes a photograph. |
| Live call | `Views/LiveCallView.swift` | The four-cell progress rail, the brief, and the transcript filling in line by line. |
| Report | `Views/ReportView.swift` | The verdict and summary, the facts in a four-cell grid, what is still to do, and the record. |
| Translator | `Translator/TranslatorView.swift` | The two-column ledger: what was said on one side, what the other side hears on the other. |

`Views/ScreenChrome.swift` holds the pieces every screen shares — the header bar under the
status bar, the footer action bar, transcript rows and section headings.

### Two deliberate departures from the prototype

1. **The report shows what the secretary wrote.** The prototype only ever displayed call
   transcripts, because its paperwork tasks produced nothing. They now produce a real
   draft, translation or filled form, so the report renders it in the same idiom — a
   kicker, the text, a rule. Without it the user could never read what was written on
   their behalf.
2. **The share and profile controls do something.** The prototype drew both without
   handlers. Share hands over the report (never the raw transcript); profile reopens the
   setup steps, which is where the name and the two languages already live.

The prototype's dimensions are the design's own: it was drawn at 402 × 874, an iPhone 16
Pro, where one design pixel is one point. Its `62px` top padding is the status bar and its
`44px` bottom padding is the home indicator, so both come from the safe area rather than
from a literal in the code.

## The task kinds

The home grid offers six things, and all of them do real work:

| Kind | Where it runs | How it ends |
|---|---|---|
| Phone call | Voice provider (Retell, or the mock) | `completed` with a transcript and a report, or `failed` |
| Letter or document | Claude, from text read off the photograph | `completed` — explained in your language, with a reply drafted in the letter's |
| Email or message | Claude | `draft` — written and waiting for your approval |
| Fill in a form | Claude | `needs_input` — filled as far as it can be, naming what it still needs |
| Follow-up or reminder | The backend, no model | `scheduled` |
| Live translator | On-device (Speech + Translation) | — |

A photographed letter or form is read **on the phone** with Vision, and only the
recognised text is sent — the photograph never leaves the device. That keeps the "no
stored audio" promise the app makes about calls true of paperwork as well.

With no `ANTHROPIC_API_KEY` set, the paperwork kinds still resolve into the same states
with an honest placeholder summary, so the whole app is demoable with no keys at all.
