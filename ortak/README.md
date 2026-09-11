# Ortak 🏠

A shared daily-life app for two people on two different phones, with two
different calendars.

*Ortak* is Turkish for "joint" or "shared" — which is the whole idea. One
calendar that writes into **both** of your real calendars, one to-do list, one
shopping list you can both watch update while you're in the shop, one notebook,
one place to keep the things that scroll away in WhatsApp, and one ledger for
working out who owes whom after a holiday.

It runs on **iOS and Android** from one codebase, and on **your own server** —
your household's data doesn't go to anyone else.

Both phones run the same app, built from `ortak/mobile` with `npx expo run:ios`
and `npx expo run:android`. Nothing is iOS-first: the calendar integration uses
EventKit on iOS and the Calendar Provider on Android through the same API, the
share sheet works on both, and every screen is shared code. Exactly one feature
is iOS-only — copying to-dos into Apple Reminders, because Android has no
equivalent system list — and it is hidden on Android rather than shown broken.

It is designed on the **Modernist** system — ink on warm paper, Archivo, one
red, zero radius, and structure made from 2px rules rather than cards. See
[`docs/design.md`](docs/design.md) for how that maps onto the code.

---

## What it does

| | |
|---|---|
| 📅 **Calendar** | Type "dinner with Tugce friday 8pm @ Trattoria" and it becomes a real event in **your own** calendar — Apple Calendar on the iPhone, Google Calendar on the Android — while staying shared between you. Filter by context (Ev / Work / Family). |
| 🔎 **Find a time for us** | Reads *both* your real calendars and proposes evenings you are genuinely both free. Tap one to book it into both calendars. |
| 📊 **Your day** | A visual timeline where the **gaps** are as clear as the bookings — including the other person's commitments, so you can see they are in the office until five. |
| 📝 **Notes** | Shared notes both of you can edit, with nested `#ev/tamirat` tags, `[[wiki links]]` and backlinks, and notes you can attach to a calendar entry. One-tap export into Apple Notes, plus a Mac script that writes into Notes automatically. |
| ✅ **To-dos** | Today / Upcoming / Anytime / Someday, sorted by dates rather than filed by hand, with start dates that hide work you can't begin yet. Ticking something off shows up on the other phone with who did it. Optionally mirrored into Apple Reminders. |
| 🛒 **Shopping** | Live: while you're both in the shop, each tick appears on the other phone within a second, and you can see the other person is there. Prices, totals and a spending history per shop. |
| 🗂️ **Chat archive** | Import a WhatsApp chat export and it becomes permanently searchable — the plumber's number from three years ago is one search away instead of gone. |
| 🔗 **Links** | Save links from any app, with titles and previews. |
| ✈️ **Trips** | Splitwise-style expense splitting for holidays with friends, including people who don't use the app. Works out the *fewest* transfers that settle everyone up. |
| 🔍 **Search** | One box over all of it. Turkish and German spellings are interchangeable — "alisveris" finds "Alışveriş", "strasse" finds "Straße". |

---

## Where the good ideas came from

A survey of ten leading productivity apps (Fantastical, Things 3, OmniFocus,
Structured, Craft, Ulysses, BBEdit, Agenda, GoodNotes, Bear) found that none of
them does all three of: run on iOS *and* Android, support real shared
collaboration, and write two-way into each person's own native calendar. That
intersection is exactly what Ortak is.

Its "best-of features worth adopting" list is implemented here:

| From | Idea | Where it lives |
|---|---|---|
| Fantastical | Natural-language event entry | The quick-add box, in three languages |
| Fantastical / Agenda | **Two-way** native calendar, not just display | Events written out *and* your calendars read back |
| Fantastical | Calendar sets for context switching | The filter row on the calendar tab |
| Fantastical | Availability / scheduling ("Openings") | **Find a time for us** |
| Things 3 | Today / Upcoming / Anytime / Someday | The to-do tab |
| OmniFocus | Defer dates | "Start" on any to-do — hides it until then |
| Things 3 | Frictionless quick capture | The box at the top of every screen |
| Structured | Visual timeline where gaps are visible | **Your day** on the home screen |
| Craft | Backlinks between documents | `[[Wiki links]]`, with "linked from" on every note |
| Bear | Markdown with nested tags | `#ev/tamirat` files under both `ev` and `ev/tamirat` |
| Agenda | Notes tied to calendar entries | "Attach to a calendar entry" on any note |
| Craft / Agenda | Real-time collaboration | The whole app |

Deliberately **not** adopted, following the survey's own feature-bloat warning
("the most-loved apps win by doing one thing beautifully"): handwriting and OCR,
GTD perspectives, publishing, habit tracking and focus timers.

## Three honest constraints

Two of the things you asked for are limited by the phone platforms rather than
by effort. Rather than pretend otherwise, here is exactly what is and isn't
possible, and what Ortak does instead.

### ✅ Calendar — works fully, no compromise

This one is genuinely solved. Both operating systems expose a single calendar
database that every configured account feeds into:

- **iOS** — EventKit lists iCloud (Apple Calendar) *and* any Google, Outlook or
  Exchange account you've added in Settings → Calendar → Accounts
- **Android** — the Calendar Provider lists the Google accounts on the device

So Ortak writes **native calendar events** through `expo-calendar`. No OAuth, no
Google API key, no separate calendar to check. Onur picks his iCloud calendar,
Tugce picks her Google one, and the same shared event is written into each. Once
it's in iCloud or Google, it syncs onward on its own — to your Mac, your watch,
calendar.google.com, everywhere.

Ortak remembers which native event belongs to which shared event **per person**,
so editing an event updates the existing entry instead of leaving a duplicate,
and deleting it removes the entry from both your calendars.

**And it reads back.** Writing events out is only half of it. Each phone can also
read the calendars you nominate — work, university, whatever else is on there —
and publish them as *busy time*, so the app knows when each of you is genuinely
free. That is what makes "find a time for us" possible, and what puts the other
person's commitments on your timeline. By default it shares **only the times,
not the titles**; there is a switch if you want titles too, and one to stop
sharing entirely.

### ⚠️ Apple Notes — no app can write to it (but Reminders is fine)

There is **no public API for Apple Notes on iOS**. No third-party app can
create, read or edit notes in it. That's an Apple restriction; no library or
trick works around it, and anything claiming otherwise is doing something that
will break.

So Ortak keeps the shared note as the original and gives you three real ways to
get a copy across:

1. **Share sheet** — every note has an Export button. Tap it, tap Notes. Two
   taps, works on a stock phone, nothing to set up. This is the default.
2. **A Shortcut**, for one tap or full automation — recipe [below](#ios-shortcut-recipes).
   The server serves any note as plain text, which the built-in "Create Note"
   action can consume.
3. **On your MacBook**, where AppleScript *is* allowed to write to Notes:
   `scripts/sync-notes-to-apple-notes.sh` pulls every shared note into a
   dedicated "Ortak" folder in Notes. Put it on a cron and it's automatic.

For **to-dos** the picture is better, because Reminders *is* part of EventKit and
fully writable. Point Ortak at a Reminders list (Settings → Apple Reminders) and
your shared to-dos are copied into it, where Siri, your watch and the Lock Screen
can all see them. One direction only — Ortak stays the shared original.

### ⚠️ WhatsApp — no API for reading your chats

WhatsApp has no API that lets another app read your personal conversations. The
Business API only covers messages sent to a business number. Libraries that
drive WhatsApp Web (`whatsapp-web.js`, Baileys and friends) violate WhatsApp's
Terms of Service and get phone numbers banned — so Ortak doesn't use them.

What WhatsApp *does* support is the export built into the app, and that turns
out to be enough for what you actually wanted — not losing information, and
finding it again:

- **Whole conversations.** In WhatsApp: open the chat → tap the contact or group
  name → **Export chat** → **Without media** → share the `.txt` into Ortak. Every
  message becomes searchable forever. Re-exporting the same group next year is
  safe and cheap: message ids are fingerprints of the content, so only genuinely
  new messages are added.
- **Single messages, as they happen.** Long-press a message in WhatsApp → Share
  → Ortak. This is a real share target on **both** platforms — an
  `ACTION_SEND` filter on Android and a share extension on iOS, both generated
  by the `expo-share-intent` config plugin. Sharing a whole exported chat opens
  the importer directly instead. (A [Shortcut](#ios-shortcut-recipes) is still
  offered as an alternative on iOS, since it needs no custom build.)

The parser handles the format's real-world messiness: iOS and Android layouts,
12- and 24-hour clocks, day-first vs month-first dates (inferred from the file,
and it *asks* when a file is genuinely ambiguous rather than silently guessing),
multi-line messages, attachments and system notices in English, German and
Turkish.

---

## How it fits together

```
┌───────────────────┐        ┌───────────────────┐
│  iPhone (Onur)    │        │  Android (Tugce)  │
│                   │        │                   │
│  Ortak app        │        │  Ortak app        │
│    ↓ EventKit     │        │    ↓ CalendarProvider
│  iCloud calendar  │        │  Google calendar  │
└─────────┬─────────┘        └─────────┬─────────┘
          │      HTTPS + WebSocket     │
          └──────────────┬─────────────┘
                         ▼
              ┌─────────────────────┐
              │  Ortak server       │
              │  Fastify + SQLite   │
              │  delta sync · FTS5  │
              └─────────────────────┘
```

- **Offline-first.** Every edit is saved on the phone immediately and queued.
  A supermarket basement, a plane or a Turkish holiday on roaming changes
  nothing; the queue flushes when there's signal again.
- **Conflicts** resolve last-writer-wins on the timestamp of the device that
  made the edit, with tombstones so deletions actually propagate.
- **Realtime** is just a nudge over a WebSocket ("the space is at revision N") —
  the data still moves through the normal pull. Losing the socket is a non-event.

```
ortak/
  shared/    Pure logic used by both sides: expense splitting, the
             natural-language date parser, the WhatsApp export parser
  server/    Fastify + SQLite: sync, search, imports, trip balances
  mobile/    Expo app (iOS + Android)
               src/ui/theme.ts       the Modernist tokens
               src/ui/components.tsx the components built from them
  docs/      How the design maps onto the code
  scripts/   The macOS Apple Notes script
```

---

## Setting it up

### 1. The server

Needs Node.js 22.5+. It can live on a small VPS, a Raspberry Pi at home, or any
machine both phones can reach.

```bash
cd ortak/server
npm install
cp .env.example .env       # every value has a working default
npm run dev                # http://localhost:8788
```

For a real deployment, put it behind HTTPS (Caddy or nginx) and set
`SIGNUP_SECRET` in `.env` so a stranger who guesses an invite code can't walk
in.

Everything lives in one SQLite file (`DB_PATH`, default `./data/ortak.db`).
**Back that file up** — it is all of your household's data.

```bash
npm test          # 64 API tests
npm run typecheck
```

### 2. The phones

```bash
cd ortak/mobile
npm install
npx expo install --fix     # aligns native module versions with your Expo SDK
```

Ortak uses native calendar access and a native share extension, so it needs a
**development build** rather than Expo Go. Build each phone once:

```bash
npx expo run:ios          # Onur's iPhone
npx expo run:android      # Tugce's Android
```

There is no `.xcodeproj` in the repository — Expo generates it. For opening the
project in Xcode, signing both targets, and the App Group the share extension
needs, see [`docs/running-in-xcode.md`](docs/running-in-xcode.md).

Same codebase, same server, same invite code — the two builds differ only in
which native calendar they talk to.

On first launch:

1. Enter your server's address
2. **First phone:** "Start a new space" → note the invite code
3. **Second phone:** "Join with a code" → enter it
4. On each phone: Settings → Calendar → pick which calendar shared plans go into
   (Onur picks iCloud, Tugce picks her Google calendar)
5. Once you've both joined, Settings → Rotate code

That's it. Anything either of you adds now shows up on the other phone, and
calendar entries land in your own calendars automatically.

---

## iOS Shortcut recipes

Two small Shortcuts fill the gaps iOS leaves. Both take about two minutes in the
Shortcuts app.

### "Save to Ortak" — an alternative to the built-in share extension

Ortak already registers a native share extension, so it appears in the iOS share
sheet once you've made a development build. This Shortcut does the same job
without one, which is handy while you're still testing.

1. Shortcuts → **+** → name it *Save to Ortak*
2. Tap ⓘ → turn on **Show in Share Sheet**, accept **Text** and **URLs**
3. Add action **URL** → set it to:
   `ortak://save?text=` — then add a **Text** action containing
   *Shortcut Input*, and a **URL Encode** action between them
4. Add action **Open URLs**

Now: long-press a message in WhatsApp → Share → *Save to Ortak*, and Ortak opens
on the capture screen with the text already filled in.

### "Ortak note → Apple Notes" — automatic note export

1. New Shortcut → **Get Contents of URL**
   - URL: `https://your-server/api/notes/NOTE_ID.txt`
     (each note screen shows its own URL)
   - Method: GET
   - Headers: `Authorization` = `Bearer YOUR_TOKEN`
2. Add **Create Note** → Body: *Contents of URL*, Folder: your choice

Add it to your Home Screen, or use a Personal Automation to run it on a
schedule.

---

## The Mac script

On macOS, AppleScript *can* write to Notes, so this needs no share sheet at all:

```bash
export ORTAK_URL=https://ortak.example.com
export ORTAK_TOKEN=your-token
./ortak/scripts/sync-notes-to-apple-notes.sh          # → "Ortak" folder in Notes
./ortak/scripts/sync-notes-to-apple-notes.sh Family   # → a folder you name
```

Every shared note appears in Notes on the Mac, and therefore on the iPhone too,
since Notes syncs through iCloud. On a cron it's fully automatic:

```
*/30 * * * * ORTAK_URL=... ORTAK_TOKEN=... /path/to/sync-notes-to-apple-notes.sh
```

The first run needs permission: System Settings → Privacy & Security →
Automation → allow your terminal to control Notes.

It's **one direction** — Ortak → Notes. Editing the copy in Notes doesn't come
back, and the next run overwrites it. Ortak stays the shared original.

---

## A few details worth knowing

**Sharing availability is opt-in and time-only by default.** You choose which of
your calendars Ortak may read, and titles stay private unless you turn them on.
A phone republishes on a timer, and the server only records what actually
changed — so an unchanged calendar doesn't wake the other phone.

**Tasks sort themselves.** A to-do is in exactly one bucket, decided by its
dates: due today or overdue → Today; dated later → Upcoming; no dates → Anytime;
deferred a long way out → Someday. Setting a start date is how you get something
out of your face until it matters, without losing it.

**Quick-add understands three languages.** All of these work:

```
dinner with Tugce friday 8pm @ Mama Trattoria
yarın 19:00 diş hekimi
übermorgen 10:00 Termin beim Amt
20.08 Tugce birthday
workshop 19:00-21:00
spor 18:00 2 saat
```

Anything with no date in it becomes a to-do instead of an appointment.

**Search folds the characters SQLite won't.** `remove_diacritics` handles ş, ğ,
ö, ü and ç, but not the Turkish dotless **ı** — which is exactly the character
you'd skip typing on a German or English keyboard. Ortak folds ı, İ and ß itself
at both index and query time, so "alisveris" finds "Alışveriş" and "strasse"
finds "Straße".

**Splitting a bill never loses a cent.** Splitting €100 three ways gives
34/33/33, not three lots of 33.33 that don't add up. Settling uses greedy
largest-debtor matching, so four friends settle a holiday in at most three
transfers rather than twelve.

**The chat archive stays on the server.** A five-year group chat is tens of
thousands of messages; mirroring that onto both phones would make every sync
slow to serve a screen that's used online anyway. Everything else works fully
offline.

---

## Testing

```bash
cd ortak/shared && npm test     # 186 tests — splitting, dates, WhatsApp parsing,
                                #             availability, buckets, timeline, tags
cd ortak/server && npm test     #  88 tests — the HTTP API end to end
```

The domain logic is where the subtle bugs live, so that's where the tests are
concentrated: cent-exact splitting across awkward remainders, date-order
inference from real export samples, the Turkish/German folding, free-slot search
across timezones and day boundaries, task bucketing at the local midnight edge,
sync conflict resolution, and cross-household isolation.

---

## Not done yet

Honest list of what a second pass would add:

- **Push notifications** ("Tugce added milk to the list") — needs Expo push
  credentials and a token table
- **Recurring events** — the sync engine models single events only
- **Reading Reminders back** — the mirror is one-way; a two-way merge between
  two independent to-do stores is a much bigger promise than it looks
- **Widgets and App Intents** — table stakes on iOS, and the survey flags them;
  they need native config plugins and a development build to verify
- **Photos and receipts** on expenses — needs blob storage
- **Live exchange rates** — foreign-currency expenses take a rate you type
- **Two-way Apple Notes sync** — not possible on iOS, and on macOS it would mean
  reconciling two editable copies
