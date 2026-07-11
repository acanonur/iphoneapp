# Retell agent setup

Do this once in the [Retell dashboard](https://dashboard.retellai.com) to switch the backend
from mock calls to real phone calls.

## 1. Create the agent

1. **Agents → Create agent** → "Single prompt agent" (or Conversation Flow if you prefer).
2. Choose a **voice** (test German/Turkish pronunciation — multilingual voices work best;
   you can also create one agent per language with a native voice for each and set
   `RETELL_AGENT_ID_DE` / `_EN` / `_TR` in `.env`).
3. Set the agent **language** to multilingual (or the per-agent language).
4. Paste the **General Prompt** below. The `{{...}}` placeholders are *dynamic variables* —
   the backend sends fresh values on every call, so you never edit the agent per call.

```text
You are a polite, efficient personal secretary making a phone call on behalf of {{user_name}}, who is not fluent in {{language_name}}.

Speak ONLY {{language_name}} for the entire call.

Your task for this call:
{{goal}}

Rules:
1. Your very first sentence must be exactly: "{{disclosure}}" — you must always identify yourself as an AI assistant. Never pretend to be human, even if asked repeatedly.
2. Then state briefly why you are calling and pursue the task.
3. Be concise and natural. Use short sentences suitable for a phone call. One question at a time.
4. Never invent personal data. If you are asked for information about {{user_name}} that you were not given (date of birth, insurance number, address), say you don't have it at hand and that {{user_name}} will provide it later or in person.
5. If asked whether the call is recorded, say: no audio recording is stored; a text transcript is made so {{user_name}} can read what was agreed.
6. Before ending, repeat and confirm the key result (for example date, time, place, price, reference number).
7. If the other side cannot help, is a wrong number, or refuses to talk to an AI, apologize briefly, thank them, and end the call politely.
8. Never agree to payments or legally binding commitments beyond the stated task.
9. End the call with a short thank-you and goodbye.
```

5. **Begin message**: set to *dynamic* / agent speaks first, so the call opens with the
   disclosure from the prompt.

## 2. Get a phone number

Buy a number in Retell (or import a Twilio number). US/UK numbers are the pragmatic
choice at launch: Germany suppresses German *landline* caller IDs arriving via
international routes, and Turkey blocks calls that arrive from abroad carrying a
Turkish caller ID — a foreign number displays fine in both countries.

Set it as `RETELL_FROM_NUMBER` (E.164, e.g. `+14155550123`).

## 3. Point the webhook at your backend

Agent settings → **Webhook URL**:

```
https://<your-backend-host>/webhooks/retell/<WEBHOOK_SECRET>
```

The backend consumes `call_started`, `call_ended` (transcript) and `call_analyzed`
events. For local testing, expose your machine with `ngrok http 8787` and use the
ngrok URL.

Also enable **post-call analysis / call summary** in the agent settings if you want
Retell's own summary as a fallback when no Anthropic key is configured.

## 4. Disable audio storage

In the Retell agent/account settings, turn **off** call recording storage and keep
only transcripts. This matters for Germany (§201 StGB: storing call audio without
all-party consent is a criminal offense; live transcription without persisted audio
is the accepted design) — and the agent prompt answers the "are you recording?"
question truthfully on that basis.

## 5. Configure the backend

```bash
CALL_PROVIDER=retell
RETELL_API_KEY=key_...
RETELL_FROM_NUMBER=+1415...
RETELL_AGENT_ID=agent_...
WEBHOOK_SECRET=<openssl rand -hex 24>
```

Restart the backend — the iPhone app needs no changes; the same `POST /api/calls`
now places real calls.
