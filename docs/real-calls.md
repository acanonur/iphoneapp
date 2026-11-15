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
| 4 | *Optional for placing calls, needed for answering them:* an address on the internet for your server | free with a tunnel |

Allow an hour the first time. Everything below is typed in the Terminal, in the `backend`
folder.

---

## 1. The account and the key

1. Open an account at <https://dashboard.retellai.com> and add a payment method.
2. In the dashboard, open **Settings → API Keys** and copy a key (it starts with `key_`).
   You paste it in the next step.

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
script again — it updates the existing agents rather than making new ones.

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
itself; with several, the script lists them and you copy one into `.env` as
`RETELL_FROM_NUMBER=+49…`.

The server only calls the countries listed in `.env` under `ALLOWED_COUNTRY_PREFIXES`
(Germany, Türkiye, the UK and the US by default), at most `MAX_CALLS_PER_DAY` calls a day
(20), each at most `MAX_CALL_MINUTES` long (10).

## 3. Start the server and place a test call

```bash
npm start
```

The server's window now says **Calls: REAL phone calls (Retell)** and shows an **access
key** and a QR code. Point the iPhone's Camera at the code, tap the link, tap **Open
Yaver** — the app saves the address and the key. (Once real calls are on, the app has to
present that key; this is what stops anyone else from making calls on your account.)

For the first call, ring a phone you can pick up yourself: tap **Brief Yaver**, write
something like *"Ask whether this is a good time to talk, then say goodbye"*, enter your
own number with its country code, and place the call. You should hear the AI disclosure
first, in the language you chose.

**Without a public address**, the app shows *Dialing…* and *On the call…*, and the
conversation appears when the call is over. To see every sentence while it is being
spoken, give the server an address on the internet (next section).

## An address on the internet

Needed for three things: the live transcript during a call, answering your calls, and
using the app when the iPhone is not on your home Wi-Fi.

**The quick way — a tunnel from your Mac.** Free, no account, no router settings:

```bash
brew install cloudflared      # once
npm run start:public
```

The server's window then shows a line **From anywhere: https://….trycloudflare.com**, and
the QR code carries that address. Scan it again with the iPhone. The address is a new one
every time you start the server, and the Mac has to stay on and awake.

**The lasting way — a small server on the internet.** For a setup that answers your calls
day and night, run the `backend` folder on a hosting service that gives it a fixed
`https://` address and keeps its `data` folder (Railway, Fly.io, Render with a disk, or
any small Linux server — a `Dockerfile` is included). Put that address in `.env` as
`PUBLIC_BASE_URL=https://…` and the access key you want as `API_KEY=…`.

## 4. Have Yaver answer your calls

1. The server needs an address on the internet (above), and the answering agent from
   step 2.
2. In the app: **Settings → Answer my calls → On**. The server then tells Retell to answer
   calls to your Retell number with the answering agent. Switching it **Off** takes the
   agent off the number again.
3. The app shows the number. **Forward the calls you do not answer** to it — on most
   mobile networks by dialling `**61*` + the number + `#` and pressing call (`##61#`
   switches it off again), or in the phone's call settings.

From then on, a call you do not pick up rings through to Yaver. It answers, says it is
your AI assistant, takes the message, and the call appears in the app as an **Answered
call** — with who rang, why, what to do next, a **Call back** button and the conversation
with its translation. The app shows new calls when you open it; it does not yet ring or
send a notification.

In *Settings* you can leave a **note for callers** ("I am at work until six") that the
assistant may pass on.

---

## What happens to the recording

Retell records calls by default. Yaver's server asks Retell to **delete each call —
recording included — as soon as the report is saved**, and additionally sets Retell's
automatic deletion to one day in case the server is switched off at the wrong moment.
What is kept is the written transcript, on your own server.

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
- **Webhooks are refused (the server's window shows "Webhook not authorised").** Retell
  signs its messages with an API key; if your account has several, put the one marked for
  webhooks in `.env` as `RETELL_WEBHOOK_KEY`. As a last resort
  `RETELL_VERIFY_SIGNATURE=false` falls back to the secret that is part of the webhook
  address.

## The first real call is also a test of this guide

The server's requests are checked against Retell's official programming library, and the
handling of every call ending is covered by tests. What cannot be checked without an
account is how Retell behaves on the telephone network: whether a given number may call a
given country, how the chosen voice sounds in Turkish, how quickly the live transcript
arrives. Make the first calls to your own phone, and read the report and the server's
window after each.
