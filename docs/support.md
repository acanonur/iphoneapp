# Yaver — Help and contact · Hilfe und Kontakt · Yardım ve iletişim

[English](#english) · [Deutsch](#deutsch) · [Türkçe](#türkçe)

## English

**Yaver** is an iPhone app: an AI secretary that makes and answers phone calls for you in German, Turkish and English, shows you the conversation live with a translation, reads your letters, and translates conversations face to face.

**Yaver needs a Yaver server.** The app works through a small server that you run yourself, on your computer or at a hosting service. At first, the server only simulates calls: no accounts, no costs. How to start one on a Mac: follow [Try it in ten minutes](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/README.md#try-it-in-ten-minutes--no-accounts-no-keys). It says how to get the project folder and Node.js 22.13 or newer. Then you need only step 1, *Start the server* (or double-click **Start Yaver.command** in the project folder), and step 3, *Connect the app to the server*. Skip step 2: it builds the app with Xcode, and Yaver from the App Store does not need it.

### The three most common problems

**1. The app cannot find the server.**

- Check that the server is running on your computer. Its window must stay open, and the computer must be awake.
- Put the iPhone and the computer on the same Wi-Fi: not a guest network, no mobile data, no VPN.
- On the iPhone, open **Settings → Privacy & Security → Local Network** and switch **Yaver** on.
- In Yaver, tap **Find automatically**. You find it on Yaver's home screen while the server cannot be reached, and in Settings (the icon with three sliders at the top right) under **Server**. Or point the iPhone's Camera at the QR code in the server's window, tap the link, then tap **Open Yaver**. If the iPhone asks whether to open the page in Yaver, tap **Open**. Then, in Yaver, tap **Connect**.
- Quick test: open the address the server shows (for example `http://192.168.1.20:8787`) in Safari on the iPhone. If the page says *The server is running*, the iPhone can reach the computer. If not, on a Mac open **System Settings → Network → Firewall** and allow incoming connections for `node`.

**2. "This server needs an access key."**

As soon as real calls, reports by Claude or an internet address are set up, the server lets in only an app that has its access key. Point the iPhone's Camera at the QR code in the server's window, tap the link, then tap **Open Yaver** (if the iPhone asks, tap **Open**) and, in Yaver, **Connect**: the app saves the address and the key. Or enter both in Yaver under **Settings → Server** and tap **Connect** (the server's window shows the key after "Access key"). If the key is not accepted, scan the code again. At a hosting service, the key is in the service's log. Give the server a disk that lasts (a "volume"): without one, the server makes a new key and loses your calls at every restart. Setting your own `API_KEY` (at least 20 characters) keeps the key the same.

**3. Real calls are not set up yet.**

If Yaver says *Calls are simulated*, that is normal: every server starts that way.

- Real calls need your own Retell AI account with a phone number. Retell charges for calls by the minute, and the number has a monthly fee. Step by step: [Real phone calls](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/real-calls.md).
- On the computer, in the `backend` folder, run `npm run retell:setup`. Then restart the server: close its window (or press Ctrl-C in it), and start it again the way you started it before (double-click **Start Yaver.command**, or run `npm start` in the `backend` folder). If Yaver then says that the server needs an access key, scan the code in the server's window again (see 2).
- Enter your name in Yaver under **Settings → You**. At the start of every real call, Yaver says that it is an AI acting for you and that the call is recorded. Without a name, Yaver places no real call.
- Before the first real call, Yaver asks whether your server may send the data to Retell AI (and to Claude, if reports are set up): *Your data and AI services*. Tap **Allow**. With **Not now**, nothing is sent. To take it back: **Settings → About → Withdraw permission**.
- Reports by Claude, and letters, messages and forms, need your own Anthropic API key: run `npm run claude:setup`, then restart the server the same way.

### Report a problem

Reports, letters, messages and forms are written by an AI, and real calls are held by one. An AI can get things wrong. Check anything important (a date, a time, an amount, a deadline) before you rely on it, above all in letters and appointments.

If a result is wrong, harmful or offensive, write to [caanonurr@gmail.com](mailto:caanonurr@gmail.com?subject=Problem%20with%20a%20result) with the subject "Problem with a result". Say:

- which screen it was on (a call report, a letter, a message draft, a form);
- what the AI wrote: copy only the part that is wrong;
- what it should have been.

The developer cannot see your tasks, so your email is all there is to go on. Do not send passwords or access keys. Leave out other people's names, numbers and other details unless the problem cannot be understood without them.

### Contact

Email: [caanonurr@gmail.com](mailto:caanonurr@gmail.com). Please say what the app shows (the exact message helps). Do not send passwords or access keys. Send transcripts, letters or other people's details only if your question cannot be answered without them.

**Privacy policy:** [English](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/privacy/en.md)

---

## Deutsch

**Yaver** ist eine iPhone-App: ein KI-Assistent, der für Sie auf Deutsch, Türkisch und Englisch telefoniert und Ihre Anrufe annimmt, Ihnen das Gespräch live mit Übersetzung zeigt, Ihre Briefe liest und Gespräche vor Ort übersetzt.

**Yaver braucht einen Yaver-Server.** Die App arbeitet über einen kleinen Server, den Sie selbst betreiben – auf Ihrem Computer oder bei einem Hosting-Anbieter. Zunächst simuliert der Server Anrufe nur – ohne Konto und ohne Kosten. So starten Sie ihn auf einem Mac: Folgen Sie der Anleitung [In zehn Minuten ausprobieren](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/README.md#try-it-in-ten-minutes--no-accounts-no-keys) (auf Englisch). Dort steht, wie Sie den Projektordner und Node.js 22.13 oder neuer bekommen. Danach brauchen Sie nur Schritt 1, *Start the server* (oder Sie doppelklicken im Projektordner auf **Start Yaver.command**), und Schritt 3, *Connect the app to the server*. Schritt 2 erstellt die App mit Xcode; mit Yaver aus dem App Store brauchen Sie ihn nicht.

### Die drei häufigsten Probleme

**1. Die App findet den Server nicht.**

- Prüfen Sie, ob der Server auf Ihrem Computer läuft. Sein Fenster muss geöffnet bleiben, und der Computer darf nicht im Ruhezustand sein.
- iPhone und Computer müssen im selben WLAN sein: kein Gastnetz, keine mobilen Daten, kein VPN.
- Öffnen Sie auf dem iPhone **Einstellungen → Datenschutz & Sicherheit → Lokales Netzwerk** und schalten Sie **Yaver** ein.
- Tippen Sie in Yaver auf **Automatisch suchen**. Die Schaltfläche finden Sie auf der Startseite von Yaver, solange der Server nicht erreichbar ist, und in den Einstellungen (Symbol mit den drei Schiebereglern oben rechts) unter **Server**. Oder richten Sie die Kamera des iPhone auf den QR-Code im Fenster des Servers, tippen Sie auf den Link und dann auf **Open Yaver**. Fragt das iPhone, ob die Seite in Yaver geöffnet werden soll, tippen Sie auf **Öffnen**. Tippen Sie dann in Yaver auf **Verbinden**.
- Schnelltest: Öffnen Sie die Adresse, die der Server anzeigt (zum Beispiel `http://192.168.1.20:8787`), in Safari auf dem iPhone. Steht dort *Der Server läuft*, erreicht das iPhone den Computer. Wenn nicht, öffnen Sie auf dem Mac **Systemeinstellungen → Netzwerk → Firewall** und erlauben Sie eingehende Verbindungen für `node`.

**2. „Dieser Server verlangt einen Zugangsschlüssel.“**

Sobald echte Anrufe, Berichte von Claude oder eine Internetadresse eingerichtet sind, lässt der Server nur eine App mit seinem Zugangsschlüssel zu. Richten Sie die Kamera des iPhone auf den QR-Code im Fenster des Servers, tippen Sie auf den Link, dann auf **Open Yaver** (fragt das iPhone nach, auf **Öffnen**) und in Yaver auf **Verbinden** – die App speichert Adresse und Schlüssel. Oder geben Sie beides in Yaver unter **Einstellungen → Server** ein und tippen Sie auf **Verbinden** (den Schlüssel zeigt das Fenster des Servers hinter „Access key“). Wird der Schlüssel nicht akzeptiert, scannen Sie den Code noch einmal. Bei einem Hosting-Anbieter steht der Schlüssel im Log des Dienstes. Richten Sie dort einen dauerhaften Speicher (ein „Volume“) für den Server ein: Ohne ihn erzeugt der Server bei jedem Neustart einen neuen Schlüssel, und Ihre Anrufe gehen verloren. Mit einem eigenen `API_KEY` (mindestens 20 Zeichen) bleibt der Schlüssel gleich.

**3. Echte Anrufe sind noch nicht eingerichtet.**

Zeigt Yaver *Anrufe werden simuliert*, ist das normal: So startet jeder Server.

- Für echte Anrufe brauchen Sie ein eigenes Konto bei Retell AI mit einer Telefonnummer. Retell rechnet die Anrufe pro Minute ab, und die Nummer kostet eine monatliche Gebühr. Schritt für Schritt: [Echte Anrufe](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/real-calls.md) (auf Englisch).
- Führen Sie auf dem Computer im Ordner `backend` den Befehl `npm run retell:setup` aus. Starten Sie den Server danach neu: Schließen Sie sein Fenster (oder drücken Sie darin Ctrl-C) und starten Sie ihn wieder so wie vorher – per Doppelklick auf **Start Yaver.command** oder mit `npm start` im Ordner `backend`. Meldet Yaver danach, dass der Server einen Zugangsschlüssel verlangt, scannen Sie den Code in seinem Fenster noch einmal (siehe 2.).
- Tragen Sie in Yaver unter **Einstellungen → Ihre Angaben** Ihren Namen ein. Zu Beginn jedes echten Anrufs sagt Yaver, dass eine KI in Ihrem Auftrag spricht und dass das Gespräch aufgezeichnet wird. Ohne Namen führt Yaver keinen echten Anruf durch.
- Vor dem ersten echten Anruf fragt Yaver, ob Ihr Server die Daten an Retell AI senden darf – und an Claude, falls Berichte eingerichtet sind (*Ihre Daten und KI-Dienste*). Tippen Sie auf **Erlauben**. Mit **Nicht jetzt** wird nichts gesendet. Widerrufen können Sie die Erlaubnis unter **Einstellungen → Über Yaver → Erlaubnis widerrufen**.
- Für Berichte von Claude sowie für Briefe, Nachrichten und Formulare brauchen Sie einen eigenen API-Schlüssel von Anthropic: Führen Sie `npm run claude:setup` aus und starten Sie den Server danach auf dieselbe Weise neu.

### Ein Problem melden

Berichte, Briefe, Nachrichten und Formulare schreibt eine KI, und auch echte Anrufe führt eine KI. Eine KI kann sich irren. Prüfen Sie daher alles Wichtige (ein Datum, eine Uhrzeit, einen Betrag, eine Frist), bevor Sie sich darauf verlassen – vor allem bei Briefen und Terminen.

Ist ein Ergebnis falsch, schädlich oder anstößig, schreiben Sie bitte eine E-Mail mit dem Betreff „Problem mit einem Ergebnis“ an [caanonurr@gmail.com](mailto:caanonurr@gmail.com?subject=Problem%20mit%20einem%20Ergebnis). Nennen Sie darin:

- auf welchem Bildschirm das Ergebnis stand (Bericht zu einem Anruf, Brief, Entwurf einer Nachricht, Formular);
- was die KI geschrieben hat – kopieren Sie nur die falsche Stelle;
- was richtig gewesen wäre.

Der Entwickler kann Ihre Aufgaben nicht sehen; er hat nur Ihre E-Mail. Senden Sie keine Passwörter und keine Zugangsschlüssel. Lassen Sie Namen, Nummern und andere Angaben über andere Personen weg, es sei denn, das Problem ist ohne sie nicht zu verstehen.

### Kontakt

E-Mail: [caanonurr@gmail.com](mailto:caanonurr@gmail.com). Bitte beschreiben Sie, was die App anzeigt (am besten mit der genauen Meldung). Senden Sie keine Passwörter und keine Zugangsschlüssel. Mitschriften, Briefe oder Angaben über andere Personen senden Sie bitte nur, wenn sich Ihre Frage ohne sie nicht beantworten lässt.

**Datenschutzerklärung:** [Deutsch](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/privacy/de.md)

---

## Türkçe

**Yaver**, iPhone için bir yapay zekâ asistanıdır: sizin için Almanca, Türkçe ve İngilizce telefon görüşmeleri yapar ve aramalarınızı yanıtlar, görüşmeyi çevirisiyle birlikte canlı gösterir, mektuplarınızı okur ve yüz yüze konuşmaları anında çevirir.

**Yaver için bir Yaver sunucusu gerekir.** Uygulama, kendi bilgisayarınızda ya da bir barındırma (hosting) hizmetinde sizin çalıştırdığınız küçük bir sunucu üzerinden çalışır. Sunucu başlangıçta aramaları yalnızca simüle eder: hesap açmanız ya da ücret ödemeniz gerekmez. Sunucuyu bir Mac’te başlatmak için [On dakikada deneyin](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/README.md#try-it-in-ten-minutes--no-accounts-no-keys) (İngilizce) bölümünü izleyin. Proje klasörünü ve Node.js 22.13 ya da daha yeni bir sürümü nasıl edineceğiniz orada anlatılır. Sonrasında yalnızca 1. adımı (*Start the server*) ve 3. adımı (*Connect the app to the server*) uygulamanız yeterlidir; 1. adımın yerine proje klasöründeki **Start Yaver.command** dosyasına çift tıklayabilirsiniz. 2. adım uygulamayı Xcode ile derler; App Store’dan indirdiğiniz Yaver için bu adımı atlayabilirsiniz.

### En sık görülen üç sorun

**1. Uygulama sunucuyu bulamıyor.**

- Sunucunun bilgisayarınızda çalıştığını kontrol edin. Penceresi açık kalmalı ve bilgisayar uyku modunda olmamalıdır.
- iPhone ile bilgisayar aynı Wi-Fi ağında olmalıdır: misafir ağı olmamalı, mobil veri ve VPN kullanılmamalıdır.
- iPhone’da **Ayarlar → Gizlilik ve Güvenlik → Yerel Ağ** bölümünü açın ve **Yaver**’i açık konuma getirin.
- Yaver’de **Otomatik bul**’a dokunun. Bu düğme, sunucuya ulaşılamadığı sürece Yaver’in ana sayfasında, ayrıca Ayarlar’da (sağ üstteki üç sürgülü simge) **Sunucu** bölümünde bulunur. Ya da iPhone’un Kamera uygulamasını sunucu penceresindeki QR koduna tutun, bağlantıya ve ardından **Open Yaver**’e dokunun. iPhone sayfanın Yaver’de açılıp açılmayacağını sorarsa **Aç**’a dokunun. Son olarak Yaver’de **Bağlan**’a dokunun.
- Hızlı deneme: Sunucunun gösterdiği adresi (örneğin `http://192.168.1.20:8787`) iPhone’da Safari ile açın. Sayfada *Sunucu çalışıyor* yazıyorsa iPhone bilgisayara ulaşabiliyor demektir. Yazmıyorsa Mac’te **Sistem Ayarları → Ağ → Güvenlik Duvarı** bölümünü açın ve `node` için gelen bağlantılara izin verin.

**2. “Bu sunucu bir erişim anahtarı istiyor.”**

Gerçek aramalar, Claude raporları ya da bir internet adresi ayarlandığı anda sunucu yalnızca erişim anahtarına sahip uygulamayı kabul eder. iPhone’un Kamera uygulamasını sunucu penceresindeki QR koduna tutun, bağlantıya, ardından **Open Yaver**’e (iPhone sorarsa **Aç**’a) ve son olarak Yaver’de **Bağlan**’a dokunun; uygulama adresi ve anahtarı kaydeder. Ya da ikisini Yaver’de **Ayarlar → Sunucu** bölümüne girip **Bağlan**’a dokunun (anahtar, sunucu penceresinde “Access key” yazan satırdadır). Anahtar kabul edilmezse kodu yeniden tarayın. Barındırma hizmetinde anahtar, hizmetin log kayıtlarında görünür. Sunucuya kalıcı bir depolama alanı (volume) bağlayın: aksi hâlde sunucu her yeniden başlatmada yeni bir anahtar oluşturur ve aramalarınız kaybolur. Kendi `API_KEY` değerinizi (en az 20 karakter) belirlerseniz anahtar değişmez.

**3. Gerçek aramalar henüz kurulmadı.**

Yaver *Aramalar simüle ediliyor* diyorsa bu normaldir: her sunucu böyle başlar.

- Gerçek aramalar için telefon numarası olan kendi Retell AI hesabınız gerekir. Retell aramaları dakika başına ücretlendirir; numara için de aylık ücret ödenir. Adım adım: [Gerçek telefon aramaları](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/real-calls.md) (İngilizce).
- Bilgisayarda `backend` klasöründe `npm run retell:setup` komutunu çalıştırın. Ardından sunucuyu yeniden başlatın: penceresini kapatın (ya da pencerede Ctrl-C’ye basın), sonra sunucuyu daha önce nasıl başlattıysanız yine öyle başlatın (**Start Yaver.command** dosyasına çift tıklayarak ya da `backend` klasöründe `npm start` komutuyla). Yaver bundan sonra sunucunun erişim anahtarı istediğini söylerse sunucu penceresindeki kodu yeniden tarayın (bkz. 2).
- Yaver’de **Ayarlar → Siz** bölümüne adınızı yazın. Her gerçek aramanın başında Yaver, sizin adınıza konuşan bir yapay zekâ olduğunu ve görüşmenin kaydedildiğini söyler. Ad olmadan Yaver gerçek arama yapmaz.
- İlk gerçek aramadan önce Yaver, sunucunuzun verileri Retell AI’a (raporlar kuruluysa Claude’a da) göndermesine izin verip vermediğinizi sorar (*Verileriniz ve yapay zekâ hizmetleri*). **İzin ver**’e dokunun. **Şimdi değil**’i seçerseniz hiçbir şey gönderilmez. İzni geri almak için: **Ayarlar → Hakkında → İzni geri al**.
- Claude raporları ile mektuplar, mesajlar ve formlar için kendi Anthropic API anahtarınız gerekir: `npm run claude:setup` komutunu çalıştırın, ardından sunucuyu aynı şekilde yeniden başlatın.

### Bir sorun bildirin

Raporları, mektupları, mesajları ve formları bir yapay zekâ yazar; gerçek aramaları da bir yapay zekâ yürütür. Yapay zekâ hata yapabilir. Bu yüzden önemli bilgileri (bir tarihi, bir saati, bir tutarı, bir son tarihi), özellikle mektuplarda ve randevularda, bunlara güvenmeden önce kontrol edin.

Bir sonuç yanlış, zararlı ya da rahatsız ediciyse konu satırına “Bir sonuçla ilgili sorun” yazarak [caanonurr@gmail.com](mailto:caanonurr@gmail.com?subject=Bir%20sonu%C3%A7la%20ilgili%20sorun) adresine e-posta gönderin ve şunları belirtin:

- sonucun hangi ekranda olduğunu (arama raporu, mektup, mesaj taslağı, form);
- yapay zekânın ne yazdığını (yalnızca yanlış olan kısmı kopyalayın);
- doğrusunun ne olması gerektiğini.

Geliştirici görevlerinizi göremez; elinde yalnızca sizin e-postanız vardır. Parola veya erişim anahtarı göndermeyin. Başka kişilerin adlarını, numaralarını ve diğer bilgilerini yalnızca sorun bunlar olmadan anlaşılamıyorsa yazın.

### İletişim

E-posta: [caanonurr@gmail.com](mailto:caanonurr@gmail.com). Lütfen uygulamanın ne gösterdiğini anlatın (tam mesajı yazmanız en iyisidir). Parola veya erişim anahtarı göndermeyin. Görüşme dökümlerini, mektupları ya da başka kişilere ait bilgileri yalnızca sorunuz bunlar olmadan yanıtlanamıyorsa gönderin.

**Gizlilik politikası:** [Türkçe](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/privacy/tr.md)
