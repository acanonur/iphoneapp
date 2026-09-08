> **This repository holds three independent apps.**
>
> | App | Folder | What it is |
> |---|---|---|
> | **AI Secretary** 📞 | [`ios/`](ios/) + [`backend/`](backend/) | Described below: an AI that makes phone calls for you and reports back in your language. |
> | **Ortak** 🏠 | [`ortak/`](ortak/README.md) | A shared daily-life app for two people on two different phones: one calendar that writes into **both** your real calendars, collaborative to-do and shopping lists, notes, a searchable WhatsApp archive and holiday expense splitting. Runs on **iOS and Android** from one Expo codebase, against your own server. See the [Ortak README](ortak/README.md). |
> | **KnitStudio** 🧶 | [`ios-knitstudio/`](ios-knitstudio/) (Apple)<br>[`android/`](android/) (Android) | A knitting technique guide, pattern calculator, chart tool and yarn shopping list. Runs on **iPhone, iPad, Mac and Android**; fully on-device. The knitting engine exists twice — Swift and Kotlin — and both are tested against the same verified numbers. See [**how to run it on a Mac**](docs/running-on-your-mac.md), the [Apple README](ios-knitstudio/README.md), the [Android README](android/README.md), [how the numbers work](docs/knitstudio.md), and [how to release it](docs/platforms-and-release.md). |

---

# AI Secretary 📞🤖

An iPhone app for people living in a country whose language they don't speak well.
Two tools in one app:

**1. Secretary** — you type **what you need**; your AI secretary does it and reports back
in your own language. It makes the real phone call in **German, English or Turkish**,
reads the official letter you photograph, drafts the email you can't phrase, fills in the
form as far as it can, and keeps the follow-up.

> *"Call my dentist at +49 30 1234567 and book a check-up appointment for next week,
> mornings preferred."* → 3 minutes later: *"Randevunuz salı 10:30'da alındı.
> Sigorta kartınızı getirmeniz gerekiyor."*

The interface was designed in [Claude Design](https://claude.ai/design) on the **Modernist**
system — Archivo, ink on a light ground, one red, zero corner radius, 2px rules,
everything flush left. One home, one primary action, and a ledger of everything the
secretary has been asked to do. See **[docs/ai-secretary-design.md](docs/ai-secretary-design.md)**
for how the design maps onto the code.

**2. Live Translator** — a two-way conversation translator for the moments you're there
in person (reception desks, offices, speakerphone conversations). Tap "I speak", talk in
your language — the app instantly shows the translation as text **and speaks it aloud**
in the other language; tap "They speak" for their turn. Runs fully on-device with
Apple's Speech + Translation frameworks: fast, private, no per-use cost, works offline
once the language packs are downloaded.

## How it works

### Feature 1: Secretary (server-side tasks)

iPhones cannot place and control carrier phone calls from an app, so the app is a thin
client and the call happens server-side:

```
iPhone app (SwiftUI)          Backend (Node/Fastify)            The real phone call
┌──────────────────┐  HTTPS   ┌──────────────────────┐  PSTN    ┌──────────────────┐
│ goal + number +  │ ───────▶ │ POST provider API     │ ───────▶ │ AI voice agent   │
│ language         │          │ (Retell AI)           │          │ speaks DE/EN/TR  │
│                  │ ◀─────── │ webhook → transcript  │ ◀─────── │ with the callee  │
│ status, report,  │  polling │ Claude writes report  │          └──────────────────┘
│ transcript       │          │ in user's language    │
└──────────────────┘          └──────────────────────┘
```

- **Voice calls**: [Retell AI](https://retellai.com) (bundled telephony + realtime voice AI,
  official German/English/Turkish support) behind a small provider interface, so it can be
  swapped for ElevenLabs Agents or OpenAI Realtime + SIP later.
- **Mock mode**: with no API keys at all, the backend simulates the whole call lifecycle —
  the app is fully demoable locally.
- **Reports**: if `ANTHROPIC_API_KEY` is set, Claude (`claude-opus-4-8`) turns the transcript
  into a short report in the user's language with an outcome verdict; otherwise it falls back
  to Retell's summary or the transcript.

**Beyond calls.** The secretary also handles the paperwork, as text tasks rather than voice
ones. Each kind ends in the state the app's ledger shows:

| Kind | What Claude does | Ends as |
| --- | --- | --- |
| **Letter or document** | Explains who sent it, what it asks for, any deadline, whether money is due; drafts a reply in the letter's language | `completed` |
| **Email or message** | Writes the message, ready to send | `draft` — waiting for your approval |
| **Fill in a form** | Fills it in as far as the information allows, marking what it cannot | `needs_input` |
| **Follow-up or reminder** | Nothing — it is a date, not a piece of writing | `scheduled` |

A photographed letter or form is read **on the phone** with Vision, and only the recognised
text is sent; the photograph never leaves the device. With no `ANTHROPIC_API_KEY` the same
states are reached with an honest placeholder summary, so the whole app stays demoable
with no keys at all.

### Feature 2: Live Translator (fully on-device)

```
🎤 mic → Speech framework (live transcription, de/en/tr)
       → Translation framework (on-device translation)
       → text on screen + AVSpeechSynthesizer speaks it aloud
```

No backend involved at all. One honest platform limitation to know: **iOS never lets a
third-party app hear your own cellular phone call** (the same restriction that makes the
secretary run server-side). So the translator works for face-to-face conversations and
for calls played over a *nearby* speakerphone — but it cannot listen in on a call you are
holding on the same iPhone. True translated phone calls are the next milestone: the
backend dials **both** you and the other person and translates in the middle, so you just
answer a normal incoming call (no app audio plumbing needed) — see Roadmap.

## Repository layout

```
backend/   Node 22 + TypeScript + Fastify API, SQLite (node:sqlite), tests (vitest)
ios/       SwiftUI app (XcodeGen project definition + sources)
             AISecretary/DesignSystem/  the Modernist system in SwiftUI
             AISecretary/Views/         the redesigned screens
docs/      Retell agent prompt & setup guide, and how the design maps onto the code
ortak/     A separate app — see the table at the top
```

---

## Also in this repo: Ortak 🏠

[`ortak/`](ortak/README.md) is an independent app that shares nothing with the
secretary above except the repository: **a shared daily-life app for two people
on two different phones**, running on iOS *and* Android from one Expo codebase,
against your own server.

Shared calendar that writes into each person's **own** calendar (Apple Calendar
on one phone, Google Calendar on the other), shared notes with Apple Notes
export, collaborative to-do and shopping lists that update live while you are
both in the shop, a searchable archive of imported WhatsApp conversations, saved
links, and Splitwise-style expense splitting for holidays.

```bash
cd ortak/server && npm install && npm run dev
cd ortak/mobile && npm install && npx expo run:ios   # or run:android
```

Full setup, and an honest account of what the phone platforms do and don't
allow, is in [`ortak/README.md`](ortak/README.md).

## Quickstart — backend (no keys needed)

Requires Node.js >= 22.5.

```bash
cd backend
npm install
npm run dev          # starts on http://localhost:8787 in mock mode
```

Try it:

```bash
# start a (simulated) call
curl -X POST http://localhost:8787/api/tasks \
  -H 'content-type: application/json' -H 'x-device-id: demo' \
  -d '{"kind":"call","goal":"Book a dentist appointment for next week","phoneNumber":"+493012345678","language":"de","summaryLanguage":"tr","userName":"Can"}'

# ask it to read a letter instead — no phone number needed
curl -X POST http://localhost:8787/api/tasks \
  -H 'content-type: application/json' -H 'x-device-id: demo' \
  -d '{"kind":"letter","goal":"What does this letter from the Finanzamt ask for?","documentText":"Sehr geehrte Damen und Herren, ...","summaryLanguage":"tr"}'

# ~10s later: status "completed" with transcript + report
curl http://localhost:8787/api/tasks -H 'x-device-id: demo'
```

Tests & typecheck: `npm test && npm run typecheck`

### API

| Method & path                  | Purpose                                            |
| ------------------------------ | -------------------------------------------------- |
| `POST /api/tasks`              | Start a task. Body: `goal`, optional `kind` (`call`/`letter`/`message`/`form`/`followup`/`reminder`, default `call`), `phoneNumber` (E.164, required for a call), `language` (`de/en/tr`), `summaryLanguage`, `userName`, `documentText`, `todoWhen`. Header `X-Device-Id` required. |
| `GET /api/tasks`               | List this device's tasks.                          |
| `GET /api/tasks/:id`           | One task with live `status`, `transcript`, `summary`, `result`, `outcome`. |
| `POST /webhooks/retell/:token` | Retell webhook (token = `WEBHOOK_SECRET`).         |

`/api/calls` still works as it did — it is the same handler with `phoneNumber` required —
so an older build of the app keeps running against a newer backend. Existing SQLite
databases are migrated in place on startup.

## Quickstart — iOS app

On a Mac with Xcode 16+ (deployment target iOS 18, required by the Translation framework):

```bash
brew install xcodegen
cd ios && xcodegen generate
open AISecretary.xcodeproj    # pick a simulator, press Run
```

- The app talks to `http://localhost:8787` (see `AISecretary/AppConfig.swift`) — start the
  backend first, then brief the secretary and watch a call go
  *Queued → Dialing → On the call → Report* on the live screen, with the transcript
  filling in. On a physical device, change `AppConfig.baseURL` to your Mac's LAN IP or a
  deployed URL.
- **The translator** (from the home screen's grid, or the header) needs no backend. Test it
  on a **real device** (the simulator has limited microphone/translation support). On first
  use, iOS asks to download the language packs and to allow microphone + speech recognition.
- **Photographing a letter or form** uses the document camera on a device and falls back to
  the photo library in the simulator.

## Going live with real calls

1. Follow **docs/retell-agent-prompt.md** — create the Retell agent (5 min), buy a number,
   point its webhook at your backend.
2. Copy `backend/.env.example` → `backend/.env`, set `CALL_PROVIDER=retell` and the Retell
   keys; optionally `ANTHROPIC_API_KEY` for Claude-written reports.
3. Deploy the backend anywhere Node 22 runs (Fly.io, Railway, a small VPS) with HTTPS.

Rough per-call cost: ~$0.10–0.35/min all-in (~$0.50–1.75 for a typical 5-minute call).

## Compliance (built in — do not remove)

- **AI self-disclosure**: every call opens with "This is an AI assistant calling on behalf
  of …" in the call language. Required by EU AI Act Art. 50(1) from 2 Aug 2026.
- **No stored audio**: the design keeps transcripts only. Storing call audio without
  all-party consent is a criminal offense in Germany (§201 StGB) — disable recording
  storage in the voice provider (see docs).
- **User-initiated calls only**: one call per explicit user request, with a destination
  country allowlist (`ALLOWED_COUNTRY_PREFIXES`) — this is not a robocall tool.
- **Caller ID**: launch with a US/UK number. German landline caller IDs get suppressed on
  international routes; Turkey blocks Turkish caller IDs arriving from abroad.

## Roadmap ideas

- **Translated phone calls** (translator milestone 2): the backend places two calls —
  one to you, one to the target number — bridges them, and runs live
  STT → translate → TTS in both directions. You answer a normal incoming call and
  simply speak your language; no WebRTC in the app needed. (Alternative: an in-app
  VoIP leg via LiveKit/Twilio SDK for on-screen live captions during the call.)
- Push notifications (APNs) instead of polling; live transcript over WebSocket
- Listen-in / barge-in on a running secretary call (WebRTC leg into the provider call)
- Sign in with Apple + server-side accounts (replacing the anonymous device id)
- Localized app UI (DE/TR), call scheduling, contact book, cost limits
- Cheaper at scale: swap Retell for OpenAI Realtime + a Twilio/Telnyx SIP trunk
  behind the existing `CallProvider` interface
