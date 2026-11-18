# Real phone calls

Out of the box Yaver's server *simulates* calls. This page switches on the real thing:
calls placed for you, and — if you want — calls answered for you.

Real calls go through [Retell AI](https://retellai.com), a telephone service with AI
voices. Yaver's server tells it whom to call and what to say; Retell does the talking and
reports every sentence back.

**What you need**

| | What | Cost |
|---|---|---|
| 1 | A Retell account and its API key | free to open; calls are billed per minute |
| 2 | A phone number in that account | monthly fee — see [A phone number](#a-phone-number) |
| 3 | *Optional:* an Anthropic API key (`npm run claude:setup` asks for it) | for reports written by Claude |
| 4 | *Optional:* an address on the internet for your server — to see a call's sentences while they are spoken, and to use the app away from home | free with a tunnel |

Allow an hour the first time.

**Where the commands go.** Everything below is typed in the Terminal, in the project's
`backend` folder. The server keeps one Terminal window busy, so open a second one (⌘N)
for these commands. A new window does not start in the right folder: type `cd ` — c, d and
a space — drag the `backend` folder from the Finder into the window, and press Enter.

---

## 1. The account and the key

1. Open an account at <https://dashboard.retellai.com> and add a payment method.
2. In the dashboard, open **Settings → API Keys** and copy the key (it starts with
   `key_`). If there are several, take the one marked **Webhook** — Retell signs what it
   sends to your server with that one. You paste it in the next step.

## 2. Create the two voice agents

```bash
npm run retell:setup
```

The first time, it asks for the key: paste it and press Enter. The key is kept in a file
called `.env` in the `backend` folder — your private settings file. It stays on your
computer and is never uploaded anywhere. (To look at or change your settings later:
`open -e .env`.)

The script then talks to Retell and creates two "agents" in your account, and writes
their ids into `.env` for you:

- **Yaver — places calls.** It opens every call with the sentence that says it is an AI
  calling on your behalf, pursues what you asked for, confirms the result and hangs up.
- **Yaver — answers calls.** It says it is your AI assistant, answers in the caller's
  language (German, Turkish or English), and takes a message. It cannot agree to anything
  or give out anything about you.

The script prints which voice it chose and a link to listen to it. To use another voice,
copy its id from the Retell dashboard into `.env` as `RETELL_VOICE_ID=…` and run the
script again — it updates the existing agents rather than making new ones. (In `.env`, a
line that starts with `#` is switched off: delete the `# ` in front of `RETELL_VOICE_ID`.)

If the script ends with *"One thing is still missing: a phone number"*, continue with the
next section and then run it once more.

## A phone number

This is the one step that needs a decision, because it costs money every month and decides
which countries you can call.

- **A number bought inside Retell** is the quickest (dashboard → **Phone Numbers → Buy**).
  Retell sells US and Canadian numbers. Retell's own documentation says such a number can
  call US numbers; whether it will also call Germany or Türkiye depends on your account —
  the dashboard's phone-number page shows international calling if it is available to you.
  Try it with one call before relying on it.
- **Your own number from a telephone provider** (Twilio, Telnyx and similar), connected to
  Retell as "custom telephony", is the dependable route for calling **German and Turkish**
  numbers and for showing a local number to the people you call. In Retell: **Phone
  Numbers → Import**, following the provider's "elastic SIP trunk" instructions. German
  numbers require proof of an address in Germany at the provider.

Whichever you choose, the number then appears in the Retell dashboard. Run
`npm run retell:setup` again: with exactly one number in the account it is picked up by
itself. With several, the script lists them: copy the one to use into `.env` as
`RETELL_FROM_NUMBER=+49…` and run `npm run retell:setup` once more — that is what switches
real calls on.

The server only calls the countries listed in `.env` under `ALLOWED_COUNTRY_PREFIXES`
(Germany, Türkiye, the UK and the US by default), at most `MAX_CALLS_PER_DAY` calls a day
(20), each at most `MAX_CALL_MINUTES` long (10). Inside those countries it still refuses
the expensive kinds of number — premium-rate, televoting, directory enquiries — and
emergency numbers.

## 3. Start the server and place a test call

If the server is still running in its own window, stop it there first (click into that
window and press Ctrl-C) — it has to start again to pick up the new settings. Then:

```bash
npm start
```

The server's window now says **Calls: REAL phone calls (Retell)** and shows an **access
key** and a QR code. Point the iPhone's Camera at the code, tap the link, tap **Open
Yaver** — the app saves the address and the key. (Once real calls are on, the app has to
present that key; this is what stops anyone else from making calls on your account.)

First put your name in the app under *Settings → You*: Yaver says at the start of every
real call on whose behalf it is calling, and it does not place a real call without a name.

For the first call, ring a phone you can pick up yourself: tap **Brief Yaver**, write
something like *"Ask whether this is a good time to talk, then say goodbye"*, enter your
own number with its country code, and place the call. Before the first real call the app
asks whether your server may send it to Retell AI (and the conversation to Claude, if you
set up reports) — tap **Allow**. You should hear the AI disclosure first, in the language
you chose.

**Without a public address**, the app shows *Dialing…* and *On the call…*, and the
conversation appears when the call is over. To see every sentence while it is being
spoken, give the server an address on the internet (next section).

## An address on the internet

Needed for two things: the live transcript during a call (yours, and the ones Yaver
answers), and using the app when the iPhone is not on your home Wi-Fi. Placing calls and
answering them work without it.

**The quick way — a tunnel from your Mac.** Free, no account, no router settings:

```bash
brew install cloudflared      # once
npm run start:public
```

The server's window then shows a line **From anywhere: https://….trycloudflare.com**, and
the QR code carries that address. Scan it again with the iPhone. The address is a new one
every time you start the server, and the Mac has to stay on and awake.

**The lasting way — a small server on the internet.** For a server that is always there,
run the `backend` folder on a hosting service that gives it a fixed `https://` address
(Railway, Fly.io, Render, or any small Linux server — a `Dockerfile` is included). Three
things to know:

- **Your `.env` file does not travel with the code** — on purpose, it holds your keys. On
  the hosting service, enter the settings on its *Variables* (or *Environment*) page
  instead: `CALL_PROVIDER`, the `RETELL_…` lines and `ANTHROPIC_API_KEY` as they are in
  your `.env`, plus `PUBLIC_BASE_URL=https://…` with the address the service gave you. Do
  not enter `PORT`, `HOST` or `DB_PATH` there.
- **Give it a disk that lasts** (a "volume"), attached at `/data`. That is where your calls
  and the access key are kept; without it they are gone at every restart.
- **The access key** is made by the server on its first start and shown in the service's
  log. Scan the QR code from the log, or type the address and the key into the app under
  *Settings → Server*.

On a Linux server of your own, from the project folder (one level above `backend`):

```bash
docker build -t yaver backend
docker run -p 8787:8787 -v yaver-data:/data --env-file backend/.env \
  -e DB_PATH=/data/calls.db -e HOST=0.0.0.0 -e PORT=8787 yaver
```

(The three `-e` settings at the end make sure the data lands on the volume, whatever your
`.env` says.)

## 4. Have Yaver answer your calls

1. In the app: **Settings → Answer my calls → On**. The server then tells Retell to answer
   calls to your Retell number with the answering agent, and hands it your name, your
   note for callers and the greeting. Switching it **Off** takes the agent off the number
   again.
2. The app shows the number. **Forward the calls you do not answer** to it — on most
   mobile networks by dialling `**61*` + the number + `#` and pressing call (`##61#`
   switches it off again), or in the phone's call settings.

   Forwarding is paid for by **your own mobile contract**, as a call from you to that
   number. To a number in your own country that is usually included; to a US or Canadian
   number it is usually billed as an international call, every time. For answering, use a
   number in your own country (see [A phone number](#a-phone-number)).

From then on, a call you do not pick up rings through to Yaver. It answers, says it is
your AI assistant, takes the message, and the call appears in the app as an **Answered
call** — with who rang, why, what to do next, a **Call back** button and the conversation
with its translation. The app shows new calls when you open it; it does not yet ring or
send a notification.

**Your computer does not have to be on.** Retell answers day and night. Your server
collects what was answered: when it starts, every two minutes while it runs, and whenever
you open the app. So a message left at night is in the app soon after you start the server
in the morning. Retell keeps a call your server has not collected for **seven days**; if
the computer will be off for longer than that, switch *Answer my calls* off first (and
dial `##61#`), or callers will leave messages nobody receives. With an address on the
internet the server hears of a call at once, and you can read along while it is going on.

Answering belongs to **one iPhone at a time**: the one that switched it on last.

In *Settings* you can leave a **note for callers** ("I am at work until six") that the
assistant may pass on.

---

## What happens to the recording

Retell records calls by default, so the first sentence of every call says so — *"…
This call is being recorded."* (in German *"Das Gespräch wird aufgezeichnet."*, in
Turkish *"Bu görüşme kaydediliyor."*). Recording a phone call without telling the other
side is a crime in Germany and in Türkiye; do not take this sentence out. Yaver's server
asks Retell to **delete each call — recording included — right after it**: as soon as
Retell has finished its own analysis of the call, and at the latest two minutes after the
call ended. In case the server is switched off at the wrong moment, Retell's own
automatic deletion is set as well: after one day for a call Yaver placed, after seven days
for a call it answered (a message left while your computer was off has to be there when
you switch it on again). What is kept is the written transcript, on your own server.

## If something does not work

- **The call fails at once with "Could not place the call".** Open the report: the reason
  is shown. *Call blocked* usually means the number you call from may not call that
  country (see [A phone number](#a-phone-number)). The server's window shows Retell's own
  wording.
- **The call is placed but nothing appears in the app until the end.** The server has no
  public address — see above. The app says so in *Settings → Server*.
- **The app says the server needs an access key.** Scan the QR code in the server's window
  again.
- **The voice speaks the wrong language or has a strong accent.** Pick another voice in
  the Retell dashboard, put its id in `.env` as `RETELL_VOICE_ID`, run
  `npm run retell:setup`.
- **Retell rejects the call with a message about "agent_override".** The server then
  places the call with the agent's own settings by itself. If that keeps happening, set
  `RETELL_SEND_OVERRIDES=false` in `.env`.
- **The server's window says "A message from the phone service was refused".** It also
  says why. Usually Retell signed the message with another key than the one in `.env`: if
  your account has several API keys, use the one marked **Webhook** as `RETELL_API_KEY`
  (or put it in `.env` as `RETELL_WEBHOOK_KEY`). As a last resort
  `RETELL_VERIFY_SIGNATURE=false` falls back to the secret that is part of the address
  Retell sends to. Until this is fixed, calls still work; the conversation just arrives
  when the call is over.
- **An answered call does not show up.** Open the app and pull the list down, or wait two
  minutes: the server asks Retell for answered calls at that pace. The server's window
  says so if Retell could not be asked.
- **A setting in `.env` seems to be ignored.** A line that starts with `#` is switched
  off — delete the `# ` at its start. Then stop the server (Ctrl-C) and start it again.

## The first real call is also a test of this guide

The server's requests are checked against Retell's official programming library, and the
handling of every call ending is covered by tests. What cannot be checked without an
account is how Retell behaves on the telephone network: whether a given number may call a
given country, how the chosen voice sounds in Turkish, how quickly the live transcript
arrives. Make the first calls to your own phone, and read the report and the server's
window after each.
