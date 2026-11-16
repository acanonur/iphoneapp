> **This repository holds two independent apps.**
>
> | App | Folder | What it is |
> |---|---|---|
> | **Yaver** 📞 | [`ios/`](ios/) + [`backend/`](backend/) | Described below: an AI secretary that makes and answers phone calls for you in German, Turkish and English, and shows you what is said in your own language. |
> | **KnitStudio** 🧶 | [`ios-knitstudio/`](ios-knitstudio/) (Apple)<br>[`android/`](android/) (Android) | A knitting technique guide, pattern calculator, chart tool and yarn shopping list. Runs on **iPhone, iPad, Mac and Android**; fully on-device. The knitting engine exists twice — Swift and Kotlin — and both are tested against the same verified numbers. See [**how to run it on a Mac**](docs/running-on-your-mac.md), the [Apple README](ios-knitstudio/README.md), the [Android README](android/README.md), [how the numbers work](docs/knitstudio.md), and [how to release it](docs/platforms-and-release.md). |

---

# Yaver 📞

*Yaver* is Turkish for an aide — the person who makes the calls and carries the messages
for someone else. It is an iPhone app for people living in a country whose language they
do not speak well.

**It makes phone calls for you.** You write what you need and give a number. Yaver calls
in **German, Turkish or English**, says at once that it is an AI calling on your behalf,
and handles the conversation. While the call is going on you see every sentence on your
screen — **with its translation into your language underneath** — and afterwards a short
report: what was agreed, and what you still have to do.

> *"Call my dentist at +49 30 1234567 and book a check-up for next week, mornings
> preferred."* → three minutes later: *"Randevunuz salı 10.30'da alındı. Sigorta
> kartınızı getirmeniz gerekiyor."*

**It answers calls for you.** When you cannot pick up, Yaver does: it says it is your AI
assistant, takes a message in the caller's language, and writes down who rang and why.

**It translates a conversation as it is spoken.** For the moments you are there in person:
tap "I speak" and talk — the translation is written on the other side of the screen while
you are still speaking, and read aloud when you finish. This part runs entirely on the
iPhone.

It also reads the official letter you photograph, drafts the email you cannot phrase, and
fills in a form as far as it can.

The whole app is in **English, German and Turkish** and follows the iPhone's language.

<p>
<img src="docs/brand/yaver-icon.png" alt="The Yaver app icon: a white Y with a square full stop on red" width="120">
</p>

## Try it in ten minutes — no accounts, no keys

Out of the box the server only *simulates* calls: you can place a call, have one answered
and use the translator, and no real phone call is made. (Letters, messages and forms need
an AI key — [see below](#reports-written-by-claude).) You need a Mac with Xcode, and
[Node.js 22](https://nodejs.org).

**1. Start the server** (Terminal):

```bash
cd backend
npm install
npm start
```

It prints its address and a QR code, and stays running in that window. From then on the
window says what happens in plain sentences — *An iPhone connected*, *Calling +49…*,
*The call is over*. If the Mac asks whether "node" may accept incoming connections, click
**Allow**.

**2. Build the app** (another Terminal window, once):

```bash
brew install xcodegen
cd ios
./generate.sh
open AISecretary.xcodeproj
```

In Xcode choose your iPhone (or a simulator) at the top and press ▶. For a real iPhone,
pick your team once under *Signing & Capabilities* — `generate.sh` remembers it from then on.

**3. Connect the app to the server.** Nothing to type:

- On the same Wi-Fi the app **finds the server by itself**. The first time, iOS asks
  whether Yaver may use the local network — say yes.
- Or point the iPhone's **Camera** at the QR code in the Terminal window, tap the link,
  then tap **Open Yaver**.
- Or enter the address by hand in the app under *Settings → Server*.

Then tap **Brief Yaver**, use the example, and watch a (simulated) call arrive line by
line with its translation. *Settings → Answer my calls → Simulate an incoming call* shows
the other direction.

### If the app says it cannot reach the server

The app tells you what it thinks is wrong. The usual causes, in order:

1. **The server is not running.** The Terminal window with `npm start` must stay open,
   and the Mac must be awake.
2. **Different networks.** The iPhone and the Mac must be on the same Wi-Fi (not a guest
   network, not mobile data, no VPN on either).
3. **The Mac's address changed.** Tap *Find automatically* — the app looks the server up
   again. This is why the address is no longer built into the app.
4. **Local network permission is off.** iPhone *Settings → Privacy & Security → Local
   Network → Yaver*.
5. **The Mac's firewall asked and was told no.** *System Settings → Network → Firewall*:
   allow incoming connections for `node`.

A quick test without the app: open the address the server printed (for example
`http://192.168.1.20:8787`) in Safari on the iPhone. If the page says *The server is
running*, the phone can reach the Mac.

To use the app away from home, the server needs an address on the internet — see
[docs/real-calls.md](docs/real-calls.md#an-address-on-the-internet).

## Real phone calls

Real calls go through [Retell AI](https://retellai.com), a telephone service with AI
voices. It costs money per minute and needs a phone number, so it is switched on
deliberately. The short version:

```bash
cd backend
npm run retell:setup        # asks for your Retell API key, creates the two voice agents
npm start
```

**[docs/real-calls.md](docs/real-calls.md)** walks through it step by step: the account,
the phone number (the part that needs a decision), answering your calls, a public address,
the first test call, and what each safety switch does.

## Reports written by Claude

```bash
cd backend
npm run claude:setup        # asks for your Anthropic API key and keeps it in backend/.env
npm start
```

With a key, the report on each call — what happened, what was agreed, what you still have
to do — is written by Claude (`claude-opus-5-5`) in your language, and letters, messages
and forms are handled too. Without a key, calls still work: you get the transcript with
its on-device translation, and the phone service's own summary where there is one.

Once a key is set the server asks the app for its access key (a paid service is now behind
it): scan the QR code in the server's window once with the iPhone's Camera.

The requests use Anthropic's server-side fallback, so that if the main model declines a
request (official letters are full of debt, health and immigration matters) it is re-run
on another model instead of leaving you with nothing. Set `ANTHROPIC_MODEL` to use a
different model.

## How it works

An iPhone app cannot place and steer a phone call by itself, so the app is a thin client
and the call happens on a server:

```
iPhone app (SwiftUI)            Server (Node · Fastify)             The phone call
┌────────────────────┐  HTTP   ┌────────────────────────┐  phone   ┌─────────────────┐
│ brief + number     │ ──────▶ │ starts the call        │ ───────▶ │ AI voice agent  │
│                    │         │ (Retell AI)            │          │ speaks DE/TR/EN │
│ the conversation,  │ ◀────── │ ◀─ each sentence as    │ ◀─────── │ with the other  │
│ line by line       │  asks   │    it is said          │          │ side            │
│ + translation      │  every  │ Claude writes the      │          └─────────────────┘
│   (on the iPhone)  │  second │ report                 │
└────────────────────┘         └────────────────────────┘
```

- **Finding the server.** The server announces itself on the local network (Bonjour,
  `_yaver._tcp`); the app listens for it, remembers every address the server has been
  seen at, and looks again when it stops answering.
- **Live transcript.** A task carries `lines` — who said what — which grow during the
  call. The simulator feeds them in one by one; with Retell they arrive through its
  `transcript_updated` events. If Retell cannot reach the server (no public address), the
  server reads the call's record from Retell instead: calls still work, the transcript
  then arrives at the end.
- **Translation.** Each line that is not in your language is translated by the iPhone
  itself (Apple's Translation framework) as it arrives. Nothing is sent anywhere for that.
  The first time, the iPhone asks to download the two languages — once.
- **Answering.** Callers are greeted in the language your calls are usually in (the
  country's), and the assistant then follows whatever language the caller speaks; the note
  it leaves you is written in the language you read.
- **Translator.** Apple's Speech framework hears, Translation translates, and the system
  voice reads aloud — all on the device, offline once the languages are downloaded.
- **Access.** As soon as real calls, a paid model or a public address are involved, the
  app has to present an access key. The server makes one up on first start; it travels
  to the app inside the QR code.

### Server API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Is a Yaver server here, and what does it need from the app? (open) |
| `GET` | `/api/session` | What this server can do, and the owner's profile |
| `GET` `PUT` | `/api/profile` | Name, the language you read, the language callers speak, answer calls on/off, note for callers |
| `POST` | `/api/tasks` | Start a task: `call`, `letter`, `message`, `form`, `followup`, `reminder` |
| `GET` | `/api/tasks`, `/api/tasks/:id` | The ledger; one task with its `lines`, `summary`, `todo` |
| `POST` | `/api/tasks/:id/cancel` | Hang up a call that is under way |
| `POST` | `/api/dev/incoming` | Simulator only: play an incoming call |
| `POST` | `/webhooks/retell/:secret` | Events from Retell (signature checked) |
| `GET` | `/`, `/pair` | Pages for a phone's browser: "the server is running", and pairing |

Every `/api` request carries `X-Device-Id`, and `Authorization: Bearer <key>` when the
server asks for a key.

## Rules that are built in — do not remove

- **It says it is an AI.** The first sentence of every call — placed or answered — is the
  disclosure, spoken by the platform itself, word for word (EU AI Act, Article 50).
- **The audio is not kept.** The app keeps a written transcript. The recording the phone
  service makes is deleted there as soon as the report is saved.
- **Calls only when you ask.** One request, one call, to a number you typed; only to the
  countries the server allows (`ALLOWED_COUNTRY_PREFIXES`), and no more than
  `MAX_CALLS_PER_DAY`.
- **Only text leaves the phone.** A photographed letter is read on the device; the
  photograph stays there. The translator's audio and text never leave the phone.

## Repository layout

```
backend/              the server: src/, test/, scripts/ (retell-setup, claude-setup)
ios/                  the iPhone app
  AISecretary/        Swift sources (the target keeps the project's first name)
    Server/           where the server is: saved address, discovery, access key
    Translation/      live on-device translation of transcripts and speech
    Translator/       the conversation translator
    Views/            the screens
    DesignSystem/     Modernist: Archivo, the palette, the Lucide icons, the mark
    de.lproj tr.lproj en.lproj   the interface in three languages
  scripts/            check-strings.py (nothing ships untranslated), screenshots.sh,
                      selftest.sh (the app run against a real server)
docs/                 real-calls.md, ai-secretary-design.md, brand/
```

## Working on it

```bash
cd backend && npm test && npm run typecheck      # the server
python3 ios/scripts/check-strings.py             # every string exists in de and tr
```

Every push is built with Xcode 16 and Xcode 26 on GitHub Actions, and every screen is
photographed in all three languages; the pictures land on the
[`ci-screenshots`](../../tree/ci-screenshots) branch. To look at one screen over sample
data yourself, add the launch argument `-yaverStage report` (or `home`, `call`,
`answered`, `translator`, `settings`, …) in Xcode's scheme.

The same run also *uses* the app: it starts the server, launches the app in the simulator
with nobody touching it, and the app has to find the server on the network, place a call
and follow it line by line, hang up, take an answered call, and get past a server that
asks for its key ([`ios/scripts/selftest.sh`](ios/scripts/selftest.sh),
[`SelfTest.swift`](ios/AISecretary/Support/SelfTest.swift)). What that cannot check is
what the simulator does not have: Apple's on-device translation and speech recognition,
the iPhone's permission prompts, and a real phone line.

The interface is the **Modernist** system from [Claude Design](https://claude.ai/design) —
Archivo, ink on a light ground, one red, no rounded corners, everything flush left. See
[docs/ai-secretary-design.md](docs/ai-secretary-design.md).

### Updating a copy you already have

```bash
cd iphoneapp
git pull
cd backend && npm install        # then start the server again: npm start
cd ../ios && ./generate.sh       # then press ▶ in Xcode again
```

If you once changed `AppConfig.swift` to your Mac's address, leave it — it is only the
first address the app tries now.
