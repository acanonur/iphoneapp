# Yaver — Privacy Policy

**Effective date:** 18 November 2026<br>
Also in: [Deutsch](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/privacy/de.md) · [Türkçe](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/privacy/tr.md)

> **In short**
>
> - The developer of Yaver runs no server for you and receives none of the data you put into the app. No Yaver account, no advertising, no analytics, no tracking.
> - What you ask Yaver to do goes only to your Yaver server, which you run yourself (on your computer or at a hosting service). Your tasks, transcripts and reports are kept there.
> - Until you connect your own accounts, your server only simulates calls, and nothing goes to an AI service. With your own account at Retell AI, an AI phone service, your server makes real calls through Retell. With your own Anthropic key, Anthropic's Claude, an AI, writes your reports and works on your letters, messages and forms. Both process the data outside the EU, mainly in the USA. Before your data goes to them for the first time, the app asks your permission. There is one exception, explained below.
> - Retell records every real call. Everyone Yaver calls, or who calls you, hears at the start that they are talking to an AI and that the call is recorded. Your server then has Retell delete the call, and the written transcript stays on your server ([details](#retell-ai-real-phone-calls)).
> - The live translator and the translations of call transcripts run on your iPhone, and so does reading the text off a photo of a letter. Speech recognition does too, if your iPhone can recognise the language itself. If it cannot, iOS sends the audio to Apple.
> - To delete your data: switch off **Answer my calls**, delete your server's `data` folder, then delete the app ([how](#how-long-data-is-kept-and-how-to-delete-it)). Questions: [caanonurr@gmail.com](mailto:caanonurr@gmail.com).

## Who is responsible

**The developer of Yaver**, the person named as the seller on Yaver's App Store page. Email: [caanonurr@gmail.com](mailto:caanonurr@gmail.com)

The developer runs no server for users and gets no personal data from the app. The developer gets only:

- the emails you send;
- crash reports and statistics from Apple, if you allow this in your iPhone's settings;
- if you test a TestFlight version of Yaver, what Apple shows developers about testers ([see Apple](#apple-speech-recognition-translation-crash-reports)).

The developer is responsible for these only (the "controller").

For Apple's app review, the developer runs a demo server that only simulates calls. Only Apple's reviewers get its address and key. It sends nothing to any AI service, and it is not meant for users.

Everything else is under your control: your iPhone, your Yaver server and the accounts you connect to it.

## What the app keeps on your iPhone

- **Settings:**
  - your name (if you enter it) and your languages;
  - the translator's settings;
  - your server's address, and up to eight other addresses where your server can be reached, so the app can find it again when its address changes;
  - which reports you have opened;
  - which AI services you allowed.
- **In the iOS Keychain** (the iPhone's protected storage for passwords): your server's access key, and a device ID. The app makes up this ID at random and keeps a copy in its settings. It only tells your server which iPhone is asking.
- **Reminders:** scheduled on the iPhone as notifications, if you allow them.
- **Nothing from the translator is saved.** Its conversation is held only in the app's memory until you close the app.

The app stores this on your iPhone only because its features need it, so it does not ask for consent (§ 25(2) No. 2 TDDDG). Nothing is stored for advertising, statistics or tracking.

## What the app sends, and to whom

### Your own Yaver server

The app sends the following only to your Yaver server:

- your profile: name, languages, whether Yaver answers your calls, and your note for callers;
- each task you create: what Yaver should do, the number to call, the languages, your name, the text read from a letter or form, a reminder date;
- with every request, the device ID, and the access key if your server asks for it.

Your server keeps all of this in one database file, together with each call's transcript, report and to-dos, and the callers' numbers. Nothing in it is deleted automatically ([how to delete it](#how-long-data-is-kept-and-how-to-delete-it)).

Your server stores no call audio, only the text. Retell AI does record real calls: see [Retell AI](#retell-ai-real-phone-calls).

Your server's window (at a hosting service: its log) shows a line for each event, with the phone number for calls, and your name when you switch answering on. It also shows the access key: do not show it to anyone. With the setting `LOG_REQUESTS=true`, it also shows the IP address of each request.

So that the app can find it, your server announces itself on your Wi-Fi under your computer's name (for example "Yaver on Anna's MacBook"). Everyone on the same Wi-Fi can see that name, and your server also tells it to anyone who reaches it. To stop the announcement, set `ADVERTISE=false`, or give your computer a name without yours in it.

At home, the app may talk to your server without encryption (http), so use only a Wi-Fi you trust. Over the internet, the app connects only with encryption (https).

### AI services: only with your own accounts, and after you allow it (one exception)

Your server passes data to Retell AI or Anthropic only if you set it up with **your own** account there. Their terms and privacy policies (linked below) then apply.

Before your data goes to such a service for the first time, the app shows a message, "Your data and AI services", that says what goes where. Nothing is sent until you tap **Allow**. If you tap **Not now**, nothing is sent. The app asks before it sends a call, letter, message or form, when you switch on **Answer my calls**, and when you tap **Simulate an incoming call**, whenever a service you have not allowed yet would be used. It first checks what your server is set up for and asks only about those services; if it cannot tell, it asks about both.

It does not ask in one case:

- If you add an Anthropic key to your server while **Answer my calls** is already on, Claude writes the notes on answered calls from then on, without a question. You set this up yourself on your server. If you do not want it, switch **Answer my calls** off before you add the key. The app asks the next time you switch it on.

**To take back your permission:** Settings → About → **Withdraw permission** (the button is there once you have allowed a service). If your server makes real calls, the app then also switches **Answer my calls** off. For that, your server must be reachable. If it is not, the app shows an error and answering stays on: switch **Answer my calls** off as soon as your server can be reached. Calls answered until then are still fetched and reported on, and a call that has already started runs to the end. The app asks again before the next task that needs a service. Taking back your permission does not delete what was already sent ([how to delete](#how-long-data-is-kept-and-how-to-delete-it)).

#### Retell AI: real phone calls

Retell AI, Inc., a company in the USA, makes and answers the real phone calls for your server, under your own Retell account.

- **What goes there:** the number to call and your Retell phone number, your request, your name, the call language and the opening sentence. That sentence says that an AI is calling for you and that the call is recorded. If your server has an internet address, Retell also gets that address, so that it can report the call to your server. Retell processes both sides' voices and everything that is said. For this it uses other companies for the phone lines, speech recognition, the AI voice and the AI model ([Retell's list](https://trust.retellai.com/subprocessors)). Retell then sends your server the transcript and its own short summary.
- **If you switch on Answer my calls:** your name, the greeting, your note for callers and your languages are saved in your Retell account, so that Retell can answer even while your computer is off. They stay there, also after you switch answering off, until you change them or delete them in your Retell account (they belong to the answering agent "Yaver — answers calls"). Callers' numbers, voices and messages are processed, and recorded, in the same way.
- **Recording, and how long Retell keeps it:**
  - Retell records every real call, the sound and the text. This is Retell's standard setting, and Yaver does not change it.
  - Right after a call, your server asks Retell to delete it, including what Retell stored for it: as soon as Retell's own analysis of the call arrives, and at the latest two minutes after the call ended. This works only while your server is running. A call answered while your server was off is deleted once your server has fetched it. Your server does this unless you switch off its setting `RETELL_DELETE_AFTER_CALL`.
  - As a backup, the standard set-up (`npm run retell:setup`) has Retell delete calls by itself: after one day for calls Yaver places, and after seven days for calls Yaver answers. Answered calls get seven days so that a message left while your computer is off is still there when you switch it on.
  - Retell says that deleting removes "the call and its associated data", and that it keeps some basic details about the call.
- **Where the data goes, and AI training:** Retell says it stores and processes data mainly in the USA. For data from the EU, it names safeguards such as the EU Standard Contractual Clauses (contract terms the EU approved for sending data abroad); a copy can be requested at support@retellai.com. It offers its customers, that is you, a data processing agreement. Retell's terms allow it to use call data to improve its services and AI models, after removing what identifies people and combining the data with other data. Yaver cannot be sure that this does not happen; check Retell's terms (linked below).
- [Retell's privacy policy](https://www.retellai.com/legal/privacy-policy) · [terms](https://www.retellai.com/legal/terms-of-service)

#### Anthropic's Claude: reports, letters, messages and forms

Anthropic's Claude, an AI, writes your call reports and the notes on answered calls, explains letters, writes messages and fills in forms. Anthropic's commercial terms name Anthropic Ireland, Limited as your contract partner if you live in the European Economic Area, Switzerland or the UK, and otherwise, for example in Türkiye, Anthropic PBC in the USA. Either way, Anthropic handles the data only for you and as you instruct (it is your "processor"), under its data processing addendum.

- **What goes there:** for a call report, the transcript, your request, the languages and your name. For a note on a call Yaver answered, the transcript, your name and the language. For a letter, message or form, your request, the document's text and the languages. Letters often contain private details, for example about your health, your money or your residence permit. Before you send one, decide whether you are fine with Anthropic processing it.
- **How long:** Anthropic says it normally deletes what your server sends and what Claude writes back within 30 days. It keeps them longer only where the law requires it, or for up to two years if its systems flag them as a possible breach of its usage policy.
- **Where the data goes, and AI training:** Anthropic says it stores the data in the USA. It may also process it in other countries, using the EU Standard Contractual Clauses. Its commercial terms say it may not train its AI models on this data.
- Without your own Anthropic key, nothing goes to Anthropic.
- [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy) · [commercial terms](https://www.anthropic.com/legal/commercial-terms) · [data processing addendum](https://www.anthropic.com/legal/data-processing-addendum) · [data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)

### Apple: speech recognition, translation, crash reports

- **Speech recognition (in the translator):** if your iPhone can recognise the language itself, the audio stays on the iPhone. If it cannot, iOS sends the audio to Apple, and the translator tells you so ([Apple on Siri, Dictation and privacy](https://www.apple.com/legal/privacy/data/en/ask-siri-dictation/)).
- **Translation** runs on the iPhone. iOS asks once to download the languages from Apple. Apple says it may collect usage statistics, such as which languages are translated, but not the text itself.
- **Letters and forms:** the app reads the text on the iPhone and never sends the photo. Only the text goes to your server, when you send the task.
- **Crash reports and statistics:** Apple passes them to the developer only if you allow it: Settings → Privacy & Security → Analytics & Improvements → Share With App Developers. You can switch this off there at any time. Apple gives them to the developer only in a form that does not identify you. A crash report contains the iPhone model, the iOS and app versions, and technical details of the crash. The statistics only show totals.
- **TestFlight test versions** (TestFlight is Apple's app for testing new versions): Apple always passes crash reports to the developer, together with your iPhone model, how often you used the test version, and any feedback you send, with any screenshot you attach. If the developer invited you by email, the developer sees this with your name and email address. If you joined through a public link, you stay anonymous.
- Apple handles the App Store download ([Apple's privacy policy](https://www.apple.com/legal/privacy/)).

### Cloudflare: only if you start your server with `npm run start:public`

With this command, Cloudflare gives your server an internet address (a free "quick tunnel"). Everything that goes between your server and the app or Retell through that address passes through Cloudflare's network: what the app sends when it uses that address (away from home, or after you scanned the code that carries it), everything Retell sends, and your server's answers. This includes the access key, your tasks, the transcripts and the reports. Cloudflare's [terms](https://www.cloudflare.com/website-terms/) and [privacy policy](https://www.cloudflare.com/privacypolicy/) apply to this. Cloudflare, Inc. is a US company. It says it is certified under the EU-U.S. Data Privacy Framework, which the EU recognises as giving adequate protection to data sent to the US companies certified under it. If you start your server with `npm start`, or by double-clicking **Start Yaver.command**, nothing goes through Cloudflare.

### A hosting service: only if you choose one

If you run your server at a hosting service instead of on your own computer, your server's database and log are stored at that company. Its terms and privacy policy then apply to them.

### Call back, Share report and web pages

"Call back" opens the iPhone's Phone app with the number. "Share report" opens the iOS share menu, and you choose where the report goes. "Privacy policy", "Help and contact" and "Report a problem with this result" open pages on GitHub in your web browser. GitHub (USA) then processes your visit, such as your IP address, under its [privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). The developer can see only how often the pages were viewed, not by whom.

### Third parties

The app itself shares your data with no third party. It contains no analytics, advertising or other third-party code, and the developer has no partner or related company that gets user data. Retell AI, Anthropic, Cloudflare or a hosting service get data only from your own server, only in the cases described above, and only because you set them up there. Apple gets data only through iOS, and GitHub only sees your visits to its pages, as described above. The emails you write to the developer are kept with the developer's email provider, Google ([see below](#how-long-data-is-kept-and-how-to-delete-it)). Each of these companies protects the data under its own terms, linked on this page. Where the developer knows that those terms allow more than this policy describes, this page says so, for example Retell's use of de-identified call data.

## Permissions on your iPhone

All are optional. If you say no to one, only the feature that needs it does not work. You can change them at any time in Settings → Apps → Yaver.

| Permission | What it is for |
|---|---|
| Local network | Finding your server on your Wi-Fi and talking to it |
| Microphone, speech recognition | The translator |
| Camera | Photographing a letter or form |
| Notifications | Reminders |

**Photos:** no permission is needed. Only if your iPhone cannot scan documents with its camera, you pick one photo of the letter or form in iOS's own photo picker, and the app gets only that photo.

## People you call, and people who call you

Every real call starts with the AI saying that it is an AI assistant acting for you, and that the call is recorded. When Yaver places a call, it also says your name, so a real call needs your name (Settings → You). When it answers for you, it says your name if you entered one.

About the other person, Yaver processes:

- their phone number;
- their voice: Retell processes it during the call and records it until your server has the call deleted (see [Retell AI](#retell-ai-real-phone-calls));
- what they say: kept as a transcript on your server, and sent to Anthropic if your server has Claude write the reports.

If they want to know what is stored about them, or want it deleted, they should ask you. You are the person named in the call, and you run the Yaver server that keeps the transcript. The developer of Yaver has none of their data. Yaver cannot delete a single call on your server, only everything at once ([how](#how-long-data-is-kept-and-how-to-delete-it)). At Retell, you can delete a single call in your Retell account.

## Your own responsibility

Whatever you use Yaver for, private use included, the laws on recording calls apply to you (in Germany § 201 of the Criminal Code, in Türkiye Art. 133 of the Turkish Penal Code). That is why every real call starts by saying that it is recorded.

If you use Yaver only for your own private matters, for example to call your doctor's office or your landlord for yourself or your family, that is usually purely personal use. The GDPR then does not apply to how you handle the other person's data (Art. 2(2)(c) GDPR). This exception is narrow. In Türkiye it is narrower still ([see below](#notes-for-users-in-türkiye-kvkk)).

If you use Yaver for work, a business, freelance work, an association, or for other people, you are responsible for those calls under data protection law: you are the "controller". Then you must:

- have a legal basis for the calls;
- tell the people concerned what happens with their data. The opening sentence is only the start; give them the rest when they ask, for example in your own privacy notice;
- have a data processing agreement with each service you connect (Art. 28 GDPR). Anthropic's is part of its commercial terms. Retell says you can sign its agreement online. Check your hosting service's terms too;
- follow the rules for sending data outside the EU (in Türkiye: the KVKK).

## How long data is kept, and how to delete it

- **On your iPhone:** until you delete the app (touch and hold the Yaver icon → Remove App → Delete App), and in your iPhone's backups (iCloud or computer) until those are deleted. iOS may keep the access key and the device ID in the Keychain even after you delete the app. If you install Yaver again, it uses them again; without your own server, they are of no use. Translation languages you downloaded stay on the iPhone; you can remove them in Settings → Apps → Translate → Downloaded Languages. Before you delete the app, switch **Answer my calls** off: deleting the app does not stop your server or Retell from answering your calls.
- **On your server:** until you delete it yourself. The app has no delete button, and Yaver cannot delete single calls. To delete everything:
  1. In the app, switch **Answer my calls** off, so that Retell stops answering.
  2. Stop your server: close its window (or press Ctrl-C in it). At a hosting service, stop it there.
  3. In the Yaver project folder (the one with **Start Yaver.command**), open the folder `backend` and delete the folder `data` inside it. At a hosting service, delete the storage (volume) attached to your server instead.
  4. All tasks, transcripts and reports are now gone, and so is the access key your server made. When you start your server again, it starts empty. If it shows a new code, scan it with the iPhone's Camera to connect the app again.
- **At Retell:** your server has each call deleted right after it ends, and with the standard set-up Retell deletes calls by itself after one or seven days ([details](#retell-ai-real-phone-calls)). In your Retell account you can also delete calls yourself, and your name, greeting and note (see above).
- **At Anthropic:** Anthropic deletes the data on its own schedule, normally within 30 days ([details](#anthropics-claude-reports-letters-messages-and-forms)).
- **Emails to the developer:** kept only as long as needed to answer you, then deleted within 12 months, unless the law requires keeping them longer. You can ask for them to be deleted sooner. This includes problem reports you send after tapping **Report a problem with this result**. Send only what is needed: no passwords or access keys, and other people's details only if the problem cannot be understood without them. The developer uses Gmail, so Google also stores and processes the emails, and may do so in the USA. Google says it is certified under the EU-U.S. Data Privacy Framework, which the EU recognises as giving adequate protection ([Google's privacy policy](https://policies.google.com/privacy)).
- **Crash reports and statistics:** Apple keeps them and decides for how long ([Apple's privacy policy](https://www.apple.com/legal/privacy/)).

## No tracking, no ads, no selling

The app has no advertising, no analytics, no tracking and no third-party SDKs (software kits from other companies). No data is sold, and nothing is used to evaluate you or predict your behaviour (no profiling). Yaver makes no automatic decisions about you that have legal consequences for you or affect you in a similarly serious way (Art. 22 GDPR).

## Legal bases (GDPR)

| What | Legal basis |
|---|---|
| Emails to the developer | Art. 6(1)(f) GDPR: the developer's legitimate interest in answering you. If your question is about using the app: Art. 6(1)(b) GDPR, to provide the app to you. |
| Crash reports and statistics from Apple, also from TestFlight | Apple gives them to the developer only in a form that does not identify you (TestFlight: see [Apple](#apple-speech-recognition-translation-crash-reports)). Where they still count as personal data: Art. 6(1)(f) GDPR, the developer's legitimate interest in finding and fixing errors. Whether Apple shares them is your choice in iOS. |

The developer does not process the data on your iPhone and your server, or what your server sends to Retell, Anthropic, Cloudflare or a hosting service. So the developer needs no legal basis for it: you decide about it ([see Your own responsibility](#your-own-responsibility)). The permission the app asks for before data goes to an AI service is Apple's rule and a safeguard for you. It is not consent from the people you call.

You do not have to provide any data. Without a server, only the live translator works. Without a permission, only the feature that needs it does not work. Without your name, Yaver places no real calls. Without your email, the developer cannot answer you.

## Your rights

**What you can ask the developer.** The developer holds data about you only if you write an email, or if you test Yaver with TestFlight (what Apple shows about testers). For that data you can ask:

- what data about you the developer holds, and for a copy (Art. 15 GDPR);
- to correct it (Art. 16);
- to delete it (Art. 17);
- to limit its use (Art. 18);
- where it applies, to get it in a common file format (Art. 20).

Write to [caanonurr@gmail.com](mailto:caanonurr@gmail.com).

**Your right to object.** You can object at any time to the developer using your emails or crash reports on the basis of its legitimate interest (Art. 21 GDPR). Write to [caanonurr@gmail.com](mailto:caanonurr@gmail.com).

**Everything else is in your hands.** The developer has no access to your iPhone, your server or your accounts at Retell, Anthropic, Cloudflare or a hosting service, so it cannot show, correct or delete anything there. You do that yourself ([how](#how-long-data-is-kept-and-how-to-delete-it)), or you ask those companies; their privacy policies are linked above. To stop Apple's crash reports: on your iPhone, Settings → Privacy & Security → Analytics & Improvements → Share With App Developers. To take back the app's permission for AI services: in Yaver, Settings → About → Withdraw permission.

**Complaints.** You can complain to a data protection authority, in particular in the EU country where you live or work, or where you think the law was broken (Art. 77 GDPR): [authorities in Germany](https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html) · [authorities in all EU and EEA countries](https://www.edpb.europa.eu/about-edpb/our-members_en).

## Notes for users in Türkiye (KVKK)

Under Law No. 6698 on the Protection of Personal Data (KVKK):

- **The developer.** The developer of Yaver is the data controller (veri sorumlusu) for the data that reaches the developer ([contact](#who-is-responsible)). The developer receives no data from the app.
  - Your emails are collected electronically, when you write. They are used only to answer you. Legal reason: the developer's legitimate interest (Art. 5(2)(f) KVKK). They are stored at Google (Gmail), which may process them outside Türkiye, for example in the USA.
  - Crash reports and statistics from Apple do not identify you. Where they do (TestFlight), the legal reason is legitimate interest (Art. 5(2)(f) KVKK), to fix errors.
- **You.** In Türkiye, the exception for private use (Art. 28(1)(a) KVKK) is narrow. It covers only activities that concern you alone or the family members you live with, and only if no data goes to others. Your server passes call data to Retell and Anthropic, so the KVKK may apply even when you use Yaver privately. Where it applies, you are the data controller (veri sorumlusu) for your calls. You must then tell the people you call how their data is used (Art. 10 KVKK). Your server sends data to the USA (Retell, Anthropic, and Cloudflare if you use it), so you must also follow the KVKK's rules for sending data abroad (Art. 9 KVKK).
- **Your rights (Art. 11 KVKK).** You can ask:
  - whether your data is processed, and if so, for information about it;
  - why it is processed, and whether it is used only for that;
  - to whom it is passed, in Türkiye or abroad;
  - to have wrong or incomplete data corrected, or data deleted, and to have those who received it told;
  - to object to a result against you that comes only from automated analysis;
  - for compensation if unlawful processing harms you.
- **How.** Write to the developer by email first, from the address you used when you wrote before. The developer answers within 30 days at the latest (Art. 13 KVKK). If you are not satisfied with the answer, or get none, you can complain to the Personal Data Protection Board (Kişisel Verileri Koruma Kurulu, [kvkk.gov.tr](https://www.kvkk.gov.tr)): within 30 days of the answer, or within 60 days of your request if no answer came (Art. 14 KVKK).

## Children

Yaver is meant for adults. The developer receives no data from the app, so it collects none about children either.

## Changes to this policy

When Yaver changes what it does with data, this page is updated and the date at the top changes. You can see earlier versions on GitHub: open this page there and click **History**.

## Contact

The developer of Yaver: [caanonurr@gmail.com](mailto:caanonurr@gmail.com)<br>
Help with the app: [Help and contact](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/support.md)
