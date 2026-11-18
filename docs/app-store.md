# Yaver on the App Store — step by step

This page takes you from your Mac to the App Store in five parts:

1. [Before you start](#1-before-you-start) — Xcode, the agreements, the update (20 minutes, once)
2. [Try Yaver on your iPhone](#2-try-yaver-on-your-iphone) with your paid developer account (30 minutes)
3. [Test the App Store version with TestFlight](#3-test-the-app-store-version-with-testflight) (30 minutes)
4. [A server for Apple's reviewers](#4-a-server-for-apples-reviewers) (30 minutes)
5. [Fill in App Store Connect and submit](#5-fill-in-app-store-connect-and-submit) (1–2 hours, then 1–3 days of review)

At the end: [the texts for the store page](#texts-for-the-store-page) in English, German and
Turkish, ready to copy, and [what to do if Apple says no](#if-apple-says-no).

Everything happens in four places: **Terminal** and **Xcode** on your Mac, the **Yaver app**
on your iPhone, and **App Store Connect** in Safari (<https://appstoreconnect.apple.com>,
sign in with the Apple ID of your developer account).

---

## 1. Before you start

### 1.1 Xcode must be version 26 or newer

Apple only accepts apps built with **Xcode 26 or later**.

1. Open Xcode. In the menu bar: **Xcode → About Xcode**. The window shows the version.
2. If it says 16 or lower, update it:
   - The **App Store** app on the Mac offers the newest Xcode (27.x) under **Updates** (if it
     is not listed there, search for **Xcode** in the App Store and click **Get**). It needs
     **macOS Tahoe 26.6** or later, so update macOS first if needed: Apple menu → **System
     Settings → General → Software Update**. The Xcode download is large (about an hour on a
     normal connection).
   - If your Mac cannot get macOS Tahoe: look at Apple menu → **About This Mac**. With
     **macOS Sequoia 15.6** or later, download **Xcode 26.3**: open
     <https://developer.apple.com/download/all/>, sign in, search `Xcode 26.3`, download it,
     double-click the downloaded file (unpacking takes a while) and drag **Xcode** into
     **Applications**. With Sequoia 15.5 or lower, first install the newest Sequoia under
     **Software Update**. A Mac that cannot get Sequoia 15.6 can no longer make App Store
     versions; tell me.
3. Start the new Xcode once and let it install its components (choose **iOS** when it asks
   which platforms). If Xcode later shows red errors when it builds Yaver, send me a
   screenshot.

### 1.2 Accept Apple's agreement

1. In Safari, open <https://appstoreconnect.apple.com> and sign in.
2. If a banner asks you to review or accept an agreement: click it, read, **Agree**. Until
   you have, App Store Connect will not let you add an app.
3. That is all: a free app needs only the agreement from step 2. Under **Business** you will
   also see **Paid Apps**. Leave it alone: it asks for a bank account and tax forms, which
   Yaver does not need.

### 1.3 Get the newest Yaver

If a Yaver server window is open on the Mac, close it first. Then, in the Finder, open
**Desktop → iphoneapp** and double-click **Update Yaver.command**. It downloads the newest
version, prepares the server and the Xcode project, and opens Xcode. It is finished when its
window says **Done**; press Enter to close the window. Do not press ▶ in Xcode yet — part 2
says when.

(If macOS refuses to open the file: Apple menu → **System Settings → Privacy & Security**,
scroll down, click **Open Anyway**, then double-click the file again.)

### 1.4 Put your paid account into Xcode

1. In Xcode: **Xcode → Settings… → Accounts**.
2. If your account is not in the list: **+** → **Apple Account** (older Xcode: **Apple ID**)
   → sign in.
3. Click your account. On the right, under the teams, you should now see your team
   **without** "(Personal Team)" — for example "Your Name". That is the paid account.
   (The "Personal Team" may still be listed; it is the free one you used before.)
   If only the Personal Team is there, Apple has not finished your membership yet: wait for
   Apple's confirmation email, then quit and reopen Xcode. No email within 24 hours of
   paying: <https://developer.apple.com/contact/>.

---

## 2. Try Yaver on your iPhone

### 2.1 Remove the old Yaver from the iPhone

The Yaver on your phone was signed by your free "Personal Team". An app from your paid team
cannot replace it, so remove it first: touch and hold the Yaver icon → **Remove App** →
**Delete App**. (Your tasks stay on your Mac's server, but the new Yaver will not show them:
to the server it is a new iPhone, so its list starts empty. The app also forgets where the
server is and its access key. It finds the server again by itself; if it asks for the key,
scan the QR code as in 2.4.)

### 2.2 Choose the paid team in Xcode

1. Connect the iPhone to the Mac with a cable. Unlock it; if it asks "Trust This
   Computer?", tap **Trust**.
2. In Xcode, in the left column, click the blue **AISecretary** icon at the very top.
3. In the middle, under **TARGETS**, click **AISecretary**, then the tab **Signing &
   Capabilities**.
4. **Team**: choose your paid team (the one **without** "Personal Team").
5. Wait a few seconds. Xcode registers the app with Apple. When the red messages are gone,
   it worked.

**If Xcode says the bundle identifier "is not available"** (or "cannot be registered"): Apple still holds the name
`com.canonur.aisecretary` for your free team. Give the app another one:

1. Open **Terminal**, paste this line and press Enter (nothing to change in it):

   ```
   echo 'PRODUCT_BUNDLE_IDENTIFIER = com.canonur.yaver' >> ~/Desktop/iphoneapp/ios/Config/Local.xcconfig
   ```

2. Double-click **Update Yaver.command** again, then repeat steps 2–5 above.
3. Only if Xcode now says that `com.canonur.yaver` is not available either: paste this line,
   press Enter, and do step 2 of this list once more (the newer line wins):

   ```
   echo 'PRODUCT_BUNDLE_IDENTIFIER = com.canonur.yaver2' >> ~/Desktop/iphoneapp/ios/Config/Local.xcconfig
   ```

Updates never undo this: `Local.xcconfig` belongs to your Mac and keeps your team and this
line.

### 2.3 Run it

1. At the top of the Xcode window, in the middle, click the device name and choose **your
   iPhone**.
2. Press **▶** (or **Product → Run**). The first build takes a few minutes.
3. The iPhone needs the internet the first time the app starts (Apple checks the new
   signature once).
4. If the iPhone says **"Untrusted Developer"**: on the iPhone, **Settings → General →
   VPN & Device Management** → your developer account → **Trust**. Then open Yaver again.
5. Developer Mode is already on from last time. (If Xcode asks for it: on the iPhone,
   **Settings → Privacy & Security → Developer Mode → On → Restart**, and confirm after the
   restart.)

An app installed this way keeps working for up to a year, no longer only 7 days.

### 2.4 Connect it to your server

The names in this guide are the ones Yaver shows in English. If your iPhone is set to German
or Turkish, Yaver uses that language — the ones you need:

| English | Deutsch | Türkçe |
|---|---|---|
| Continue · Start | Weiter · Los geht’s | Devam · Başla |
| Brief Yaver | Yaver beauftragen | Yaver’e görev ver |
| Use an example brief | Beispielauftrag verwenden | Örnek bir görev kullan |
| Calls are simulated | Anrufe werden simuliert | Aramalar simüle ediliyor |
| Place the call · Open the report | Anruf starten · Bericht öffnen | Aramayı başlat · Raporu aç |
| Settings · Server · Connect | Einstellungen · Server · Verbinden | Ayarlar · Sunucu · Bağlan |
| You · About | Ihre Angaben · Über Yaver | Siz · Hakkında |
| Answer my calls | Anrufe für mich annehmen | Aramalarımı yanıtla |
| Simulate an incoming call | Eingehenden Anruf simulieren | Gelen bir aramayı simüle et |
| Live translator · I speak · They speak | Live-Übersetzer · Ich spreche · Gegenüber spricht | Canlı çevirmen · Ben konuşuyorum · Karşı taraf |
| Follow-up or reminder · Remind me on | Wiedervorlage oder Erinnerung · Erinnern am | Takip veya hatırlatma · Hatırlatma zamanı |
| Letter or document · What should Yaver do? | Brief oder Dokument · Was soll Yaver tun? | Mektup veya belge · Yaver ne yapsın? |
| Add a photo of the document · Send to Yaver | Foto des Dokuments hinzufügen · An Yaver senden | Belgenin fotoğrafını ekle · Yaver’e gönder |
| Allow · Not now | Erlauben · Nicht jetzt | İzin ver · Şimdi değil |

1. On the Mac, double-click **Start Yaver.command** (keep its window open).
2. Open Yaver on the iPhone and go through the four introduction pages:
   - page 3, **Your name**: type your name. Yaver says it at the start of every call, and
     does not place a real call without it. (Later: **Settings** → **You**.)
   - page 4, **Your server**: allow the **local network** when iOS asks. The app finds the
     server by itself. If it does not, or it says **This server needs an access key**: point
     the iPhone's **Camera** at the QR code in the server's window, tap the link, then
     **Open Yaver** (if iOS asks: **Open**), and in Yaver **Connect**.
3. Tap **Start**.

### 2.5 Try everything (15 minutes)

Tick off as you go. Whenever the iPhone or Yaver asks for permission on the way
(microphone, speech recognition, camera, notifications, or Yaver's **Your data and AI
services**), tap **Allow**.

- [ ] **A call** (simulated): **Brief Yaver** (the red button at the bottom) → **Use an
      example brief**. The screen must now show the box **Calls are simulated** — if it does
      not, your server places real calls: stop, and tell me. Then **Place the call**. The
      conversation appears line by line with the translation underneath (if Yaver asks to
      download languages, tap **Download languages**). When it has ended: **Open the
      report**.
- [ ] **An answered call**: **Settings** (the sliders icon at the top right of the home
      screen — the right one of the two) → **Answer my calls** → **On** → **Simulate an
      incoming call**.
- [ ] **The live translator**: on the home screen, **Live translator**. At the top, choose the
      languages under **You speak** and **They speak**. Tap **I speak** and talk: the
      translation must appear **while you speak**. Tap again when you are done. Then let
      someone answer in the other language with **They speak**. If it says the languages
      need a download, tap **Download languages** and wait.
      *This is the one part the build machine cannot test — please try it properly.*
- [ ] **A reminder**: on the home screen, **Follow-up or reminder**. Write what to remember,
      set **Remind me on** to two minutes from now, **Send to Yaver**. Allow notifications.
      It rings at that time, also when the iPhone is locked.
- [ ] **A letter** (only if you set up Claude with `npm run claude:setup`): **Letter or
      document** → under **What should Yaver do?** type `Explain this letter to me` → **Add
      a photo of the document** → photograph a letter → wait until the button says
      **Document read · … characters** → **Send to Yaver**. (Without the sentence under
      **What should Yaver do?** the button stays grey.) The text is read on the phone and
      Yaver explains it. Under the result, **Report a problem with this result** opens the
      help page.
- [ ] **Settings → About → Privacy policy** opens the policy in your language.
- [ ] Optional, costs a little: **a real call to your own phone** (see
      [Real phone calls](real-calls.md)). Before the first real call the app asks whether
      your server may send it to Retell AI — tap **Allow**. Type **your own** number: from
      now on your server places real calls every time it starts, and **Use an example
      brief** then leaves the number empty for you to fill in.

If something looks wrong, take a screenshot and send it to me before going on.

---

## 3. Test the App Store version with TestFlight

What you ran in part 2 is the "development" version. TestFlight installs the exact version
Apple will review, through Apple. It takes 30 minutes and finds problems before Apple does.

### 3.1 Create the app in App Store Connect

1. <https://appstoreconnect.apple.com> → **Apps** → the blue **+** → **New App**.
2. Fill in:
   - **Platforms**: iOS
   - **Name**: `Yaver` (if App Store Connect says the name is taken: `Yaver – AI Secretary`.
     If later, in 5.2, German or Turkish refuses `Yaver`, use `Yaver – KI-Sekretär` or
     `Yaver – Yapay Zekâ Sekreteri` there; both are under 30 characters.)
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: choose `com.canonur.aisecretary` (or the one you chose in 2.2) from the
     list. It appears there because Xcode registered it in part 2.
   - **SKU**: `yaver-ios` (any word only you see)
   - **User Access**: Full Access
3. **Create**. The SKU can never be changed, and the bundle ID can no longer be changed once
   the first build is uploaded (3.2) — check both before you click.

### 3.2 Upload the build from Xcode

1. In Xcode, at the top where you chose your iPhone, choose **Any iOS Device (arm64)**.
2. **Product → Archive**. This takes a few minutes; then the **Organizer** window opens with
   the archive selected.
3. Click **Distribute App** → choose **TestFlight & App Store** → **Distribute**.
   Xcode signs the app, gives it the next build number by itself, and uploads it.
4. Wait for "Upload Successful". After 10–30 minutes, Apple emails you that the build has
   been processed.

Yaver already answers Apple's export question in its settings (it uses only the encryption
built into iOS), so the build does not stop at "Missing Compliance".

### 3.3 Install it with TestFlight

1. In App Store Connect: your app → **TestFlight**.
2. On the left, next to **Internal Testing**, click **+** → name the group `Me` → turn on
   **Enable automatic distribution** → **Create**.
3. In the group: **Testers → +** → tick yourself → **Add**.
4. Under **Builds** in the group, add the build if it is not there yet. Fill in **What to
   Test** with anything (for example "First version").
5. On the iPhone: install the free **TestFlight** app from the App Store, open it, accept
   the invitation (also by email) and tap **Install** next to Yaver.

Internal testing needs no review by Apple: the build is available as soon as it has been
processed, for 90 days. Repeat 2.5 quickly with this version (with **Calls are simulated**
shown, or with your own number for a call). If you have an iPad, install
TestFlight there too (same Apple Account), install Yaver and try a simulated call and the
translator: every iPad can run Yaver in iPhone mode, and Apple's reviewers may test it there.

---

## 4. A server for Apple's reviewers

Apple's reviewers must be able to use Yaver — and apart from the live translator, Yaver needs a
server for everything.
They cannot reach the one on your Mac at home, so they need one on the internet, for the
whole review (usually 1–2 days; in busy weeks it can take a few weeks).

It runs in **simulation mode**: no real calls, no AI service, no costs except the host.

We use **Render** (<https://render.com>): one web form, a fixed `https://…onrender.com`
address, nothing to install. It costs **7 US dollars a month, charged by the second** — if
you delete it a week after Apple approves, you pay about 2 dollars. (Render's free plan
does not work here: it falls asleep after 15 minutes and needs up to a minute to wake up,
longer than the app waits.) Render changes its screens now and then: if a field below is
named a little differently, take the closest one.

### 4.1 Make up an access key

Open **Terminal**, paste this and press Enter:

```
openssl rand -hex 16
```

It prints 32 letters and digits, for example `3f9c0a1e…`. Select them, copy them (⌘C) and
paste them into a new note in the **Notes** app. This is the access key of the review server.
You need it on the iPhone in 4.3 and in the review notes in 5.4. If Notes uses iCloud, the
same note is on your iPhone: copy it from there instead of typing it.

### 4.2 Create the server on Render

1. Open <https://dashboard.render.com> → **Sign up** → **GitHub** (the GitHub account that
   holds the Yaver project). Signing up is free. If Render asks which plan your workspace
   should have, choose **Hobby** (free); you pay only for the 7-dollar server below.
2. Add a payment card: **Billing** (left column, or your account menu) → add a payment
   method. Render may reserve 1 dollar for a moment to check the card.
3. **+ New** → **Web Service**. Under **Git Provider** choose the repository
   **acanonur/iphoneapp** → **Connect**. (If it is not in the list: **Configure GitHub** /
   **Connect GitHub** and allow Render to see `acanonur/iphoneapp`.)
4. Fill in the form:

   | Field | What to choose |
   |---|---|
   | **Name** | `yaver-review` |
   | **Language** | `Docker` |
   | **Branch** | `claude/ai-secretary-design-uyvh5i` |
   | **Region** | `Frankfurt (EU Central)` |
   | **Root Directory** | leave empty |
   | **Dockerfile Path** | `./backend/Dockerfile` |
   | **Instance Type** | **Starter** — 7 dollars a month, 512 MB (may be shown as `0.5c-512mb`). **Not Free.** |

5. **Environment Variables** → **Add Environment Variable**, four times:

   | NAME_OF_VARIABLE | value |
   |---|---|
   | `CALL_PROVIDER` | `mock` |
   | `REQUIRE_KEY` | `always` |
   | `API_KEY` | the 32 letters and digits from 4.1 |
   | `PUBLIC_BASE_URL` | `https://yaver-review.onrender.com` |

   Do **not** add anything for Retell or Claude: the review server only simulates calls.
6. Open **Advanced**:
   - **Docker Build Context Directory**: `./backend`
   - **Health Check Path**: `/health`
   - **Add Disk**: Name `yaver-data`, Mount Path `/data`, Size `1` GB (about 25 cents a
     month; it keeps the server's tasks when Render restarts it).
   - **Auto-Deploy**: **Off** (or **No**). Otherwise every new version I push would restart
     the server in the middle of the review.
7. **Deploy Web Service**. The first build takes about 5 minutes. It is done when the page
   shows **Live** in green.
8. At the top of the page you now see the real address, for example
   `https://yaver-review.onrender.com` — if the name was taken, Render adds a few letters,
   such as `https://yaver-review-x1y2.onrender.com`. If it is **different** from what you
   typed for `PUBLIC_BASE_URL`: left column **Environment** → edit `PUBLIC_BASE_URL` →
   **Save and deploy**.

This address (without `https://` is fine) and the key from 4.1 go into the review notes.

**If the build fails** with a message that the Dockerfile or `package.json` was not found:
left column **Settings** → **Build & Deploy**: **Root Directory** `backend`, **Dockerfile
Path** `./Dockerfile`, **Docker Build Context Directory** `.` → **Save Changes**, then top
right **Manual Deploy** → **Deploy latest commit**. For any other failure, copy the last
lines of **Logs** and send them to me.

### 4.3 Check it from your iPhone

1. In Safari on the iPhone, open your address with `/health` at the end, for example
   `https://yaver-review.onrender.com/health`. It must show `"ok":true`,
   `"service":"yaver"` and `"simulated":true`.
2. In Yaver: **Settings** (the sliders icon, top right) → **Server**. Tap into **Server
   address**, hold the delete key until the field is empty, then type or paste your address.
   Do the same in **Access key (only if the server shows one)**: empty it, then paste the key
   from 4.1 → **Connect**. It must say **Connected to** followed by a name.
3. Place a simulated call: **Brief Yaver → Use an example brief → Place the call**.
4. Then go back to your own server: double-click **Start Yaver.command** on the Mac, point
   the iPhone's **Camera** at the QR code in its window, tap the link, then **Open Yaver**
   (if iOS asks: **Open**), and in Yaver **Connect**. **Settings → Server** now shows your
   Mac's name. (Do not use **Find automatically** for this: it tries the last address
   first, and the review server still answers.)

### 4.4 Afterwards

Keep the review server running until Apple has approved Yaver (status "Ready for
Distribution" or "Pending Developer Release"). Then, to stop paying: Render → **yaver-review**
→ **Settings** → at the very bottom **Delete Web Service**. For the next update you send to
Apple, create it again the same way (5 minutes).

---

## 5. Fill in App Store Connect and submit

Open your app in App Store Connect. The pages are in the left column. The texts to copy are
in [Texts for the store page](#texts-for-the-store-page) below.

### 5.1 European Union: are you a "trader"?

Apple asks every developer this — also if the app is not offered in the EU — and asks again
when you submit a new app. Without an answer, the app is not shown in the EU.

1. **Business** (top of App Store Connect) → **Agreements** → under **Compliance**:
   **Digital Services Act** → **Complete Compliance Requirements**.
2. Choose:
   - **"This is not a trader account"** if Yaver is a free hobby project and you earn nothing
     with it. No address, phone number or email is published (your name is shown as the
     seller on the App Store page in any case); EU customers are told that consumer-protection
     rights do not apply to contracts with you.
   - **"This is a trader account"** if you offer it as a business. Then your **address, phone
     number and email are shown publicly** on the App Store page in all EU countries. You
     confirm the phone number and email with codes, upload a current document that proves your
     name and address, enter bank details, and confirm that what you offer follows EU law.
   Apple says this is your own decision; ask an adviser if you are unsure.

### 5.2 App Information

1. **App Information** (under "General"):
   - **Subtitle**: see the texts below.
   - **Category**: Primary **Productivity**, Secondary **Utilities**.
   - **Content Rights**: "No, it does not contain, show, or access third-party content".
   - **Age Ratings → Set Up Age Ratings** (later: **Edit**): on the first page tick
     **nothing** (Yaver has no parental controls, no age check, no web browser, no content
     shared between users, no messaging between users, no ads) → **Next**. In every following
     section choose **None** or **No**, also for **Shared Location** and **Dating and
     Relationships** → **Next**. Under **Age Categories and Override** choose **Not
     Applicable** (not "Made for Kids": that can never be undone). Leave **Age Suitability
     URL** empty → **Save**. The rating shows **4+**.
   - If you see **Digital Goods and Services in Your Apps**: **Get Started** → "Can customers
     consume digital goods and services in this app?" → **No** (Yaver sells nothing) →
     **Next**. (The EU answer cannot be changed for 12 months.) If it is not there, there is
     nothing to do.
   - Then **Save** (top right).
2. At the top right, the language menu: **English (U.S.)** → add **German** and **Turkish**
   (+ → add the language). For each language, fill in **Name** and **Subtitle**, then
   **Save**.
3. **App Privacy** (left column):
   - Next to **Privacy Policy**, **Edit** → paste the URL for the language shown in the menu
     at the top right → **Save**. Do the same for German and Turkish:
     - English: `https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/privacy/en.md`
     - German: `https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/privacy/de.md`
     - Turkish: `https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/privacy/tr.md`
   - Open each of the three links once in Safari: each must show the policy, not GitHub's
     "404" page. If one does not, stop and tell me.
   - **Get Started** → "Do you or your third-party partners collect data from this app?" →
     **No, we do not collect data from this app** → **Save** → **Publish** (top right) →
     **Publish** again to confirm.
     This is true: the app sends nothing to you, and it contains no third-party code; your
     users' data goes only to their own Yaver server. The review server from part 4 does not
     change this: only Apple's reviewers use it, during the review, and you delete it
     afterwards. (If you ever run a server that other people use, this answer must change.)

### 5.3 Pricing and Availability

1. Left column, under **Monetization**: **Pricing and Availability**. Under **Price
   Schedule**: **Add Pricing** → base country **Germany** → price **Free** (0.00) → **Next**
   → **Next** → **Confirm**.
2. Under **App Availability**: **Set Up Availability** → **Specific Countries or Regions** →
   make sure every country is ticked except **China mainland** (there, apps need government
   filings and declarations for AI-generated content) → **Next** → **Confirm**.
3. Further down: under **iPhone and iPad Apps on Apple Silicon Mac** → **Apple Silicon Mac
   Availability**, untick **Make this app available**; under **iPhone and iPad Apps on Apple
   Vision Pro**, untick **Make this app available on Apple Vision Pro**. Then **Save** (top
   right). Yaver is made for the iPhone; reviewers might otherwise test it on a Mac.

### 5.4 The version page: screenshots and texts

Click **1.0 Prepare for Submission** (under "iOS App").

1. **Screenshots**. The build machine makes them for you, in all three languages and both
   sizes Apple may ask for. Download them all at once:
   <https://github.com/acanonur/iphoneapp/archive/refs/heads/ci-screenshots.zip>. In
   **Downloads** you get the folder **iphoneapp-ci-screenshots** (if it is still a `.zip`
   file, double-click it). It must contain the folder **appstore**, with pictures whose
   names end in `.jpg`, and the file `en/consent.png`; if not, the build machine is not
   finished — try again in an hour, or tell me.
   - On the version page, under **Product Page Information**, click the tab **App Previews
     and Screenshots**, then the **iPhone** tab. Drag the seven pictures from
     `appstore/6.9-inch/en` (`1-call` … `7-answering`) onto the 6.9" box, in order 1–7, and
     the seven from `appstore/6.3-inch/en` onto the 6.3" box. If one of the two boxes is not
     on the page, click **View All Sizes in Media Manager** and find it there. (Apple's pages
     disagree on which size is required; with both, nothing is missing.)
   - Then choose **German** in the language menu at the top right. If it is listed under
     **Not Localized**, hold the pointer over it and click the **+** that appears. Use the
     `de` folders, and do the same with **Turkish** and the `tr` folders. A new language
     starts with the English pictures and links but with an empty description and keywords,
     so fill in every box in each language.
2. **Promotional Text**, **Description**, **Keywords**: from the texts below, for each
   language.
3. **Support URL** (each language):
   `https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/support.md`
   — open it once in Safari: it must show Yaver's help page with a section **Report a
   problem**, not GitHub's "404" page.
4. **Marketing URL**: leave empty.
5. **Copyright**: `2026 ` followed by your full name.
6. **Build**: **+** (Add Build) → choose the build from part 3 → **Done**.
7. **App Review Information**:
   - **Sign-in required**: off (Yaver has no accounts).
   - **Contact Information**: your first and last name, phone number with `+49…`, and
     `caanonurr@gmail.com`. (Only Apple sees this.)
   - **Notes**: copy the [notes for the reviewer](#notes-for-apples-reviewer) below and
     replace the four placeholders that start with `YOUR-` (the review server's address and
     key, your iPhone's model and iOS version).
   - **Attachment** (needed: the notes say "screenshot attached", and on the review server
     the reviewer never sees this question): drag in `consent.png` from the `en` folder of the
     unzipped screenshots.
   - Helpful, if your server places real calls (2.5): record one real call, so Apple sees the
     permission question and the AI disclosure. First, in Yaver: **Settings → About →
     Withdraw permission**, so that the question appears again (if **Answer my calls** was on,
     switch it on again afterwards and tap **Allow**). Then on the iPhone: Control Center →
     **Screen Recording**. In Yaver: **Brief Yaver** → write `Ask whether this is a good time
     to talk, then say goodbye` → enter a number you can answer on another phone (a landline,
     or the phone of someone who agrees), so Yaver stays on screen → **Place the call** →
     **Allow**. Keep recording until the conversation appears (with your Mac's server, shortly
     after the call ends), then open **Settings** and scroll down to **About**. Stop the
     recording, add the video as another **Attachment**, and add this line to the notes,
     after the access key:
     `Attached: a screen recording of a real call placed with Yaver: the permission dialog, then the transcript with the AI disclosure and recording notice.`
   - Without a video, but you tapped **Allow** in 2.5: in Yaver open **Settings**, scroll down
     until **Withdraw permission** is on screen, and take a screenshot (side button and volume
     up together). Put it on the Mac with **AirDrop**, add it as another **Attachment**, and
     add this line to the notes, after the access key:
     `Also attached: Settings > About with Withdraw permission.`
8. **Version Release**: **Manually release this version** (you decide when it goes live) or
   **Automatically release** (it goes live as soon as Apple approves).
9. **Save** (top right).

### 5.5 Submit

1. Top right: **Add for Review** (if it asks, choose to create a **new submission**). The
   status now says **Ready for Review** — that is **not** sent to Apple yet. In the panel that
   opens (or under **App Review** in the left column), click **Submit for Review**. If App
   Store Connect lists something missing, it says what; fill it in and try again.
2. The status goes to "Waiting for Review", then "In Review". Apple reviews 90% of
   submissions within 48 hours; in busy weeks it can take longer. You get an email either
   way.
3. If you chose to release manually: when the status is **Pending Developer Release**, click
   **Release This Version**. (Keep the review server running until then — see 4.4.)
4. After release it can take up to 24 hours until Yaver can be found in the App Store.

Only want friends to have it, not everyone? Ask Apple for an **unlisted app** (found only by
a link). Decide before you submit: in 5.4 choose **Manually release this version**, and add
the line `This app is intended for unlisted distribution.` at the end of the notes. Right
after **Submit for Review**, fill in the form at
<https://developer.apple.com/contact/request/unlisted-app/>. Release the version only after
Apple has approved the request (**Pricing and Availability** then shows **Unlisted App**).

---

## If Apple says no

You get an email and a message in App Store Connect (**App Review** in the left column, or
the version page). It names the rule ("Guideline 2.1", "5.1.2" and so on) and what they saw.

- **"We were unable to connect to the server" / app does not work** → the review server
  was stopped: check part 4, answer in App Store Connect that it runs again, and resubmit.
- **5.1.2 (data shared with AI)** → reply, and attach `consent.png` again: "Yaver asks for
  explicit permission before it sends a task to an AI service and before it switches call
  answering on (screenshot attached); on the review server no AI service is set up, so no
  data is shared."
- **"Guideline 2.1 – Information Needed"** (they want to see a real call) → reply, and attach
  the screen recording from 5.4 if you made one: "Real calls need the user's own account at
  the phone service Retell AI, set up on the user's own server; every new Yaver server
  simulates calls until then, as the review server does. Attached is a screen recording of
  a real call placed with Yaver: the permission dialog, then the transcript with the AI
  disclosure and the recording notice." If you have no recording, send me the message.
- **"Guideline 4.2.3" or "4.2"** (the app needs something else to work) → reply: "Yaver is
  the client of the Yaver server, as the Home Assistant, Nextcloud, Jellyfin and Plex apps on
  the App Store are clients of their servers. The server is not an iOS app: it is free, its
  code is public (https://github.com/acanonur/iphoneapp/tree/claude/ai-secretary-design-uyvh5i),
  and the support page shows how to start it on a Mac. The live translator works on the
  iPhone without any server, and for the review a server runs at the address in the notes."
- **Anything else** → copy the whole message and send it to me.

You can reply and resubmit as often as needed; it does not count against you.

---

## Later: updates

1. Get the new version (**Update Yaver.command**).
2. Every update you send to Apple needs a higher version (1.0 → 1.1); I change it in the
   project for you. (Do not put a version into `Local.xcconfig`: it would override every
   later version for good.)
3. Upload as in 3.2 (Xcode raises the build number by itself). In App Store Connect: left
   column, **+** next to **iOS App** → the new version number → **Create**. Fill in
   **What's New** in each language and choose the new build under **Build** (this works
   once the current version is **Ready for Distribution**). If you deleted the review server,
   create it again as in 4.2 and put its address and key into the notes. If App Store Connect
   asks age-rating questions again, answer them as in 5.2. Then submit as in 5.5.

---

## Texts for the store page

Each grey box has a **copy** button at its top right. Choose the language in the menu at
the top right of App Store Connect first, then paste the boxes of that language.

**Name** (App Information), the same in all three languages: `Yaver`

Good to know: in Germany the App Store offers only a German and an English page; the
Turkish page is shown in Türkiye and Cyprus. Turkish-speaking people in Germany therefore
see the German page — that is why the German keywords include a few Turkish words.

### English (U.S.)

**Subtitle** (App Information)

```
AI secretary for phone calls
```

**Promotional Text** (version page)

```
Yaver phones the doctor, a government office or the landlord for you – in German, Turkish or English – and shows you every sentence of the call in your language.
```

**Description** (version page)

```
Yaver is an AI secretary for people who live in a country whose language they do not speak well. It makes the phone calls you find hard, answers the calls you cannot take, and translates conversations as they happen. Apart from the live translator, Yaver works through the free Yaver server, which you run on your own Mac; real phone calls also need your own paid account with the telephone service Retell AI (details below).

MAKES CALLS FOR YOU
Write what you need – "Call my dentist and book a check-up appointment for next week, mornings preferred" – and give the number. Yaver calls in German, Turkish or English, says at the start that it is an AI calling on your behalf and that the call is recorded, and handles the conversation.
• Follow the call on your screen: every sentence, with its translation into your language underneath – while it is spoken if your server can be reached from the internet, otherwise right after the call.
• Afterwards you get a short report: what was agreed, and what you still have to do.

ANSWERS CALLS FOR YOU
Forward the calls you do not pick up to your number at the telephone service Retell AI. Yaver answers, says that it is your AI assistant and that the call is recorded, takes the message in the caller's language and writes down who called and why.

LIVE TRANSLATOR
For conversations in person: tap "I speak" and talk. The translation appears on the other half of the screen while you are still speaking, and is read aloud when you finish. The translation is made on your iPhone.

LETTERS, MESSAGES AND FORMS
Photograph an official letter: Yaver reads the text on your iPhone and explains what the letter says and what you have to do. It also drafts the email you find hard to write, and fills in a form as far as it can.

REMINDERS
Ask Yaver to remind you of an appointment or of a call you want to follow up, and it does so at the time you choose.

IN YOUR LANGUAGE
The whole app is in English, German and Turkish and follows your iPhone's language.

YOUR OWN SERVER – NO ACCOUNT WITH US
Yaver works together with the free Yaver server, which you run on your own Mac; the support page shows how. There is no sign-up, no advertising and no tracking, and the developer of Yaver receives none of your data.
• Out of the box the server only simulates calls: you can try placed and answered calls, the translator and reminders without an account and without cost.
• Real phone calls need your own account with the telephone service Retell AI, with a phone number in it; Retell charges per minute, and the number costs a monthly fee. Letters, messages and forms need your own key for Claude by Anthropic (paid per use); Claude then also writes your call reports.
• Yaver asks for your permission before it sends a task to one of these services or switches call answering on, and you can withdraw it at any time in Settings.

Yaver only calls when you ask it to, and it always says on whose behalf it is calling.
```

**Keywords** (version page)

```
assistant,translator,translate,interpreter,german,turkish,english,receptionist,letter,expat,doctor
```


### German

**Subtitle** (App Information)

```
KI-Sekretär für Telefonate
```

**Promotional Text** (version page)

```
Yaver ruft für Sie bei Arzt, Amt oder Vermieter an – auf Deutsch, Türkisch oder Englisch – und zeigt Ihnen jeden Satz des Gesprächs, übersetzt in Ihre Sprache.
```

**Description** (version page)

```
Yaver ist ein KI-Sekretär für Menschen, die in einem Land leben, dessen Sprache sie nicht gut sprechen. Yaver führt die Telefonate, die Ihnen schwerfallen, nimmt Anrufe an, wenn Sie nicht können, und übersetzt Gespräche, während sie stattfinden. Außer dem Live-Übersetzer arbeitet Yaver über den kostenlosen Yaver-Server, den Sie auf Ihrem eigenen Mac betreiben; für echte Telefonate brauchen Sie außerdem ein eigenes, kostenpflichtiges Konto beim Telefondienst Retell AI (Einzelheiten unten).

RUFT FÜR SIE AN
Schreiben Sie, was Sie brauchen – „Meinen Zahnarzt anrufen und für nächste Woche einen Kontrolltermin vereinbaren, am liebsten vormittags“ – und geben Sie die Nummer an. Yaver ruft auf Deutsch, Türkisch oder Englisch an, sagt gleich zu Beginn, dass hier eine KI in Ihrem Auftrag anruft und dass das Gespräch aufgezeichnet wird, und führt das Gespräch.
• Verfolgen Sie das Telefonat auf Ihrem Bildschirm: jeden Satz, darunter die Übersetzung in Ihre Sprache – schon während des Gesprächs, wenn Ihr Server aus dem Internet erreichbar ist, sonst gleich nach dem Anruf.
• Danach erhalten Sie einen kurzen Bericht: was vereinbart wurde und was Sie noch tun müssen.

NIMMT ANRUFE FÜR SIE AN
Leiten Sie die Anrufe, die Sie nicht annehmen, an Ihre Nummer beim Telefondienst Retell AI weiter. Yaver meldet sich als Ihr KI-Assistent, sagt, dass das Gespräch aufgezeichnet wird, nimmt die Nachricht in der Sprache des Anrufers entgegen und notiert, wer angerufen hat und warum.

LIVE-ÜBERSETZER
Für Gespräche vor Ort: Tippen Sie auf „Ich spreche“ und reden Sie. Die Übersetzung erscheint auf der anderen Hälfte des Bildschirms, während Sie noch sprechen, und wird vorgelesen, sobald Sie fertig sind. Die Übersetzung entsteht auf Ihrem iPhone.

BRIEFE, NACHRICHTEN UND FORMULARE
Fotografieren Sie einen Brief vom Amt: Yaver liest den Text auf Ihrem iPhone und erklärt, was darin steht und was Sie tun müssen. Yaver entwirft auch die E-Mail, die Ihnen schwerfällt, und füllt ein Formular aus, soweit es geht.

ERINNERUNGEN
Lassen Sie sich an einen Termin erinnern oder an ein Telefonat, bei dem Sie nachhaken wollen – zu der Zeit, die Sie wählen.

IN IHRER SPRACHE
Die ganze App gibt es auf Deutsch, Englisch und Türkisch; sie erscheint automatisch in der Sprache, die auf Ihrem iPhone eingestellt ist.

IHR EIGENER SERVER – KEIN KONTO BEI UNS
Yaver arbeitet mit dem kostenlosen Yaver-Server zusammen, den Sie auf Ihrem eigenen Mac betreiben; wie das geht, zeigt die Support-Seite. Es gibt keine Anmeldung, keine Werbung und kein Tracking, und der Entwickler von Yaver erhält keine Ihrer Daten.
• Zunächst simuliert der Server Anrufe nur – so können Sie ausgehende und angenommene Anrufe, den Übersetzer und Erinnerungen ohne Konto und kostenlos ausprobieren.
• Für echte Telefonate brauchen Sie ein eigenes Konto beim Telefondienst Retell AI mit einer Telefonnummer darin; Retell berechnet die Gesprächsminuten, und für die Nummer fällt eine monatliche Gebühr an. Für Briefe, Nachrichten und Formulare brauchen Sie einen eigenen Schlüssel für Claude von Anthropic (Abrechnung nach Nutzung); Claude schreibt dann auch Ihre Gesprächsberichte.
• Bevor Yaver eine Aufgabe an einen dieser Dienste schickt oder das Annehmen von Anrufen einschaltet, fragt es Sie um Erlaubnis; Sie können sie in den Einstellungen jederzeit widerrufen.

Yaver ruft nur an, wenn Sie es verlangen, und sagt immer, in wessen Auftrag es anruft.
```

**Keywords** (version page)

```
Assistent,Anruf,Übersetzer,Dolmetscher,Türkisch,Anrufbeantworter,Brief,tercüman,çeviri,Almanca
```


### Turkish

**Subtitle** (App Information)

```
Yapay zekâ telefon asistanı
```

**Promotional Text** (version page)

```
Yaver doktorunuzu, resmî daireleri ya da ev sahibinizi sizin yerinize arar – Almanca, Türkçe veya İngilizce – ve görüşmenin her cümlesini dilinize çevirip gösterir.
```

**Description** (version page)

```
Yaver, dilini iyi konuşamadığı bir ülkede yaşayan ya da Türkiye’den Almanca veya İngilizce bir görüşme yapması gereken herkes için yapay zekâlı bir sekreterdir. Size zor gelen telefon görüşmelerini yapar, açamadığınız aramaları yanıtlar ve konuşmaları o anda çevirir. Canlı çevirmen dışında Yaver, kendi Mac’inizde çalıştırdığınız ücretsiz Yaver sunucusu üzerinden çalışır; gerçek telefon görüşmeleri için ayrıca Retell AI telefon hizmetinde kendi ücretli hesabınız olmalıdır (ayrıntılar aşağıda).

SİZİN YERİNİZE ARAR
Ne istediğinizi yazın – “Diş hekimimi ara ve gelecek hafta için bir kontrol randevusu al, tercihen öğleden önce” – ve numarayı verin. Yaver Almanca, Türkçe veya İngilizce arar; en başta sizin adınıza arayan bir yapay zekâ olduğunu ve görüşmenin kaydedildiğini söyler, sonra görüşmeyi yürütür.
• Görüşmeyi ekranınızda izleyin: her cümle, altında kendi dilinize çevirisiyle – sunucunuza internetten ulaşılabiliyorsa konuşulurken, değilse görüşmenin hemen ardından.
• Ardından kısa bir rapor alırsınız: neyin kararlaştırıldığı ve sizin daha neler yapmanız gerektiği.

ARAMALARINIZI YANITLAR
Açmadığınız aramaları Retell AI telefon hizmetindeki numaranıza yönlendirin. Yaver kendini yapay zekâ asistanınız olarak tanıtır, görüşmenin kaydedildiğini söyler, arayanın dilinde mesajını alır ve kimin, neden aradığını not eder.

CANLI ÇEVİRMEN
Yüz yüze konuşmalar için: “Ben konuşuyorum”a dokunun ve konuşun. Çeviri, siz daha konuşurken ekranın diğer yarısında belirir ve bitirdiğinizde sesli okunur. Çeviri iPhone’unuzda yapılır.

MEKTUPLAR, MESAJLAR VE FORMLAR
Resmî bir mektubun fotoğrafını çekin: Yaver metni iPhone’unuzda okur; mektupta ne yazdığını ve sizin ne yapmanız gerektiğini açıklar. Yazmakta zorlandığınız e-postanın taslağını hazırlar, bir formu da elinden geldiğince doldurur.

HATIRLATMALAR
Bir randevuyu ya da takip etmek istediğiniz bir görüşmeyi Yaver size seçtiğiniz zamanda hatırlatır.

KENDİ DİLİNİZDE
Uygulamanın tamamı Türkçe, Almanca ve İngilizce olarak kullanılabilir; iPhone’unuz hangi dildeyse o dilde açılır.

KENDİ SUNUCUNUZ – BİZE ÜYE OLMANIZ GEREKMEZ
Yaver, kendi Mac’inizde çalıştırdığınız ücretsiz Yaver sunucusuyla birlikte çalışır; nasıl kurulacağı destek sayfasında anlatılır. Üyelik yok, reklam yok, izleme yok; Yaver’in geliştiricisi verilerinizden hiçbirini almaz.
• Sunucu ilk kurulduğunda aramaları yalnızca simüle eder; böylece arama yapmayı, gelen aramaların yanıtlanmasını, çevirmeni ve hatırlatmaları hesap açmadan ve ücretsiz deneyebilirsiniz.
• Gerçek telefon görüşmeleri için Retell AI telefon hizmetinde kendi hesabınız ve orada bir telefon numaranız olmalıdır; Retell dakika başına ücret alır, numara için de aylık ücret ödenir. Mektuplar, mesajlar ve formlar için Anthropic’ten kendi Claude anahtarınızı almanız gerekir (kullandıkça ücretlendirilir); o zaman görüşme raporlarınızı da Claude yazar.
• Yaver, bu hizmetlerden birine bir görev göndermeden ya da aramaları yanıtlamayı açmadan önce izninizi ister; bu izni Ayarlar’dan istediğiniz zaman geri alabilirsiniz.

Yaver yalnızca siz istediğinizde arar ve kimin adına aradığını her zaman söyler.
```

**Keywords** (version page)

```
sekreter,arama,çeviri,çevirmen,tercüman,almanca,ingilizce,mektup,randevu,telesekreter,belge
```

## Notes for Apple's reviewer

Copy this into **App Review Information → Notes**, then replace the four placeholders
that start with `YOUR-`: `YOUR-ADDRESS` and `YOUR-KEY` with your review server's address
and access key (part 4), `YOUR-IPHONE-MODEL` and `YOUR-IOS-VERSION` with your iPhone's
model and iOS version (on the iPhone: **Settings → General → About** shows both, as
*Model Name* and *iOS Version*). Apple reads it in English.

```
Yaver is the iPhone app for the Yaver server, which each user runs on their own Mac (free; code is public: https://github.com/acanonur/iphoneapp/tree/claude/ai-secretary-design-uyvh5i). Like the Home Assistant and Nextcloud apps, it works through the user's own server; only the live translator works without one. We run a server for the review.

REVIEW SERVER (calls are simulated, as on every new Yaver server until its owner adds a phone-service account; no AI service; no data leaves the server)
Address: YOUR-ADDRESS
Access key: YOUR-KEY

To connect: go through the four introduction pages (on page 3 type any name: every call opens with it; you may decline the local network permission, it only finds servers on the same Wi-Fi). Then Settings (sliders icon, top right) > Server: replace http://localhost:8787 with the address, enter the access key, tap Connect.

WHAT TO TRY
1. A call: Brief Yaver > Use an example brief > Place the call. The simulated conversation appears line by line with its translation (iOS may ask to download languages), then the report.
2. An answered call: Settings > Answer my calls > On > Simulate an incoming call.
3. Live translator (home screen): choose two languages, tap "I speak" and talk; the translation appears while you speak (Siri & Dictation must be on).
4. A reminder: Follow-up or reminder on the home screen.
Letters, messages and forms need the user's own Claude (Anthropic) key; the review server has none, so they show "Not set up yet" (expected).

THIRD-PARTY AI AND CONSENT (5.1.2(i))
On a user's own server, real calls go through Retell AI (phone service, USA) and letters, messages and call reports through Claude by Anthropic (USA), only with the user's own accounts there. Before the app sends a task that would reach one of them, and before it switches call answering on, a dialog names the service, the data and where it goes (screenshot attached); the action waits until the user taps Allow. Settings > About > Withdraw permission takes it back (shown once one was given). The review server has neither service, so no dialog appears and no data reaches a third party.

CALLS ARE NEVER ANONYMOUS (1.1.6)
Yaver calls only when the user starts a call, one call per request. Every call opens by saying that an AI is calling on behalf of the user, by name, and that the call is recorded (by the phone service, for the transcript; the user's server then has it deleted there). A real call is refused without the user's name, and comes from the number in the user's own Retell AI account. Real calls go only to countries the user's server allows (by default +49, +90, +44 and +1 for the US and Canada); premium-rate numbers are refused; calls per day are capped.

PRIVACY AND REPORTING (App Privacy: Data Not Collected)
No account, analytics, ads, tracking or third-party SDK. The app sends data only to the user's own server and has no Retell or Anthropic code; that server uses them with the user's own accounts, so neither we nor any partner of ours can access the data. Our review server is only for App Review and is deleted afterwards. Privacy policy: Settings > About. The app stores no audio. AI results are shown only to the user who asked; nothing is shared between users. Under every result, "Report a problem with this result" opens the help page with our contact.

Tested on YOUR-IPHONE-MODEL with iOS YOUR-IOS-VERSION.

PERMISSIONS
Camera: a letter's text is read on the iPhone; only the text is sent (photos come through iOS's picker, no library access). Microphone, speech recognition: the translator, only while it shows "Listening". Notifications: reminders.
```
