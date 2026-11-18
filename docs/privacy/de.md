# Yaver – Datenschutzerklärung

**Gültig ab:** 18. November 2026<br>
Diese Datenschutzerklärung gibt es mit demselben Inhalt auch auf Englisch und Türkisch: [English](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/privacy/en.md) · [Türkçe](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/privacy/tr.md)

> **Das Wichtigste in Kürze**
>
> - Der Entwickler von Yaver betreibt keinen Server für Sie und erhält keine der Daten, die Sie in die App eingeben. Es gibt kein Yaver-Konto, keine Werbung, keine Nutzungsanalyse und kein Tracking.
> - Was Sie Yaver auftragen, geht nur an Ihren Yaver-Server, den Sie selbst betreiben (auf Ihrem Computer oder bei einem Hosting-Anbieter). Dort werden Ihre Aufgaben, Mitschriften und Berichte gespeichert.
> - Solange Sie keine eigenen Konten verbinden, simuliert Ihr Server Anrufe nur, und nichts geht an einen KI-Dienst. Mit Ihrem eigenen Konto bei Retell AI, einem KI-Telefondienst, tätigt Ihr Server über Retell echte Anrufe. Mit Ihrem eigenen API-Schlüssel von Anthropic schreibt Claude, die KI von Anthropic, Ihre Berichte und bearbeitet Ihre Briefe, Nachrichten und Formulare. Beide verarbeiten die Daten außerhalb der EU, vor allem in den USA. Bevor Ihre Daten zum ersten Mal an einen dieser Dienste gehen, bittet die App Sie um Erlaubnis. Es gibt eine Ausnahme; sie wird weiter unten erklärt.
> - Retell zeichnet jeden echten Anruf auf. Wer von Yaver angerufen wird oder Sie anruft, hört gleich zu Beginn, dass am anderen Ende eine KI spricht und dass das Gespräch aufgezeichnet wird. Danach lässt Ihr Server den Anruf bei Retell löschen; die schriftliche Mitschrift bleibt auf Ihrem Server ([Details](#retell-ai-echte-anrufe)).
> - Der Live-Übersetzer und die Übersetzungen der Mitschriften Ihrer Anrufe laufen auf Ihrem iPhone, ebenso das Erkennen des Textes auf dem Foto eines Briefs. Auch die Spracherkennung läuft dort, wenn Ihr iPhone die Sprache selbst erkennen kann. Kann es das nicht, sendet iOS den Ton an Apple.
> - So löschen Sie Ihre Daten: Schalten Sie **Anrufe für mich annehmen** aus, löschen Sie den Ordner `data` Ihres Servers und löschen Sie dann die App ([so geht’s](#wie-lange-daten-bleiben-und-wie-sie-sie-löschen)). Fragen: [caanonurr@gmail.com](mailto:caanonurr@gmail.com).

## Wer ist verantwortlich?

**Der Entwickler von Yaver** – die Person, die auf der App-Store-Seite von Yaver als Anbieter genannt ist. E-Mail: [caanonurr@gmail.com](mailto:caanonurr@gmail.com)

Der Entwickler betreibt keinen Server für Nutzer und erhält von der App keine personenbezogenen Daten. Er erhält nur:

- die E-Mails, die Sie ihm schicken;
- Absturzberichte und Statistiken von Apple, wenn Sie das in den Einstellungen Ihres iPhone erlauben;
- wenn Sie eine TestFlight-Version von Yaver testen: das, was Apple Entwicklern über Tester anzeigt ([siehe Apple](#apple-spracherkennung-übersetzung-absturzberichte)).

Nur für diese Daten ist der Entwickler verantwortlich (der „Verantwortliche“ im Sinne der Datenschutz-Grundverordnung, DSGVO).

Für die App-Prüfung durch Apple betreibt der Entwickler einen Demo-Server, der Anrufe nur simuliert. Seine Adresse und seinen Zugangsschlüssel erhalten nur die Prüfer von Apple. Dieser Server sendet nichts an KI-Dienste und ist nicht für Nutzer gedacht.

Alles andere liegt bei Ihnen: Ihr iPhone, Ihr Yaver-Server und die Konten, die Sie mit ihm verbinden.

## Was die App auf Ihrem iPhone speichert

- **Einstellungen:**
  - Ihr Name (wenn Sie ihn eingeben) und Ihre Sprachen;
  - die Einstellungen des Übersetzers;
  - die Adresse Ihres Servers und bis zu acht weitere Adressen, unter denen Ihr Server erreichbar ist – damit die App ihn wiederfindet, wenn sich seine Adresse ändert;
  - welche Berichte Sie geöffnet haben;
  - welche KI-Dienste Sie erlaubt haben.
- **Im iOS-Schlüsselbund** (dem geschützten Speicher des iPhone für Passwörter): der Zugangsschlüssel Ihres Servers und eine Geräte-ID. Die App erzeugt diese ID zufällig und legt eine Kopie davon in ihren Einstellungen ab. Die ID zeigt Ihrem Server nur, welches iPhone anfragt.
- **Erinnerungen:** Das iPhone plant sie als Mitteilungen ein, wenn Sie Mitteilungen erlauben.
- **Vom Übersetzer wird nichts gespeichert.** Das Gespräch liegt nur im Arbeitsspeicher der App, bis Sie die App schließen.

Die App speichert diese Daten auf Ihrem iPhone nur, weil ihre Funktionen sie brauchen. Deshalb fragt sie dafür nicht nach Ihrer Einwilligung (§ 25 Abs. 2 Nr. 2 TDDDG). Nichts wird für Werbung, Statistik oder Tracking gespeichert.

## Was die App an wen sendet

### Ihr eigener Yaver-Server

Folgendes sendet die App nur an Ihren Yaver-Server:

- Ihr Profil: Name, Sprachen, ob Yaver Ihre Anrufe annimmt, und Ihren Hinweis für Anrufer;
- jede Aufgabe, die Sie anlegen: was Yaver tun soll, die anzurufende Nummer, die Sprachen, Ihren Namen, den aus einem Brief oder Formular gelesenen Text und ein Erinnerungsdatum;
- bei jeder Anfrage die Geräte-ID und, wenn Ihr Server ihn verlangt, den Zugangsschlüssel.

Ihr Server speichert all das in einer Datenbankdatei, zusammen mit der Mitschrift, dem Bericht und den offenen Punkten jedes Anrufs sowie den Nummern der Anrufer. Nichts davon wird automatisch gelöscht ([so löschen Sie es](#wie-lange-daten-bleiben-und-wie-sie-sie-löschen)).

Ihr Server speichert keine Tonaufnahmen der Anrufe, nur den Text. Retell AI zeichnet echte Anrufe dagegen auf: siehe [Retell AI](#retell-ai-echte-anrufe).

Das Fenster Ihres Servers (bei einem Hosting-Anbieter: sein Log) zeigt zu jedem Ereignis eine Zeile – bei Anrufen mit der Telefonnummer und, wenn Sie das Annehmen von Anrufen einschalten, mit Ihrem Namen. Es zeigt auch den Zugangsschlüssel: Zeigen Sie ihn niemandem. Mit der Einstellung `LOG_REQUESTS=true` zeigt es außerdem die IP-Adresse jeder Anfrage.

Damit die App ihn findet, macht sich Ihr Server in Ihrem WLAN unter dem Namen Ihres Computers bekannt (zum Beispiel „Yaver on MacBook von Anna“). Alle im selben WLAN können diesen Namen sehen. Ihr Server nennt den Namen außerdem jedem, der ihn erreicht. Wenn sich Ihr Server nicht im WLAN bekannt machen soll, setzen Sie `ADVERTISE=false` – oder geben Sie Ihrem Computer einen Namen, in dem Ihr Name nicht vorkommt.

Zu Hause kann die App unverschlüsselt (http) mit Ihrem Server kommunizieren. Nutzen Sie deshalb nur ein WLAN, dem Sie vertrauen. Über das Internet verbindet sich die App nur verschlüsselt (https).

### KI-Dienste: nur mit Ihren eigenen Konten und erst nach Ihrer Erlaubnis (eine Ausnahme)

Ihr Server gibt Daten nur dann an Retell AI oder Anthropic weiter, wenn Sie ihn mit **Ihrem eigenen** Konto beim jeweiligen Dienst einrichten. Dann gelten die Bedingungen und Datenschutzerklärungen dieser Dienste (unten verlinkt).

Bevor Ihre Daten zum ersten Mal an einen solchen Dienst gehen, zeigt die App den Hinweis „Ihre Daten und KI-Dienste“. Er erklärt, welche Daten wohin gehen. Erst wenn Sie auf **Erlauben** tippen, wird etwas gesendet. Tippen Sie auf **Nicht jetzt**, wird nichts gesendet. Die App fragt, bevor sie einen Anruf, einen Brief, eine Nachricht oder ein Formular sendet, wenn Sie **Anrufe für mich annehmen** einschalten und wenn Sie auf **Eingehenden Anruf simulieren** tippen – immer dann, wenn dabei ein Dienst genutzt würde, den Sie noch nicht erlaubt haben. Dabei prüft sie zuerst, wofür Ihr Server eingerichtet ist, und fragt nur nach diesen Diensten. Kann sie das nicht feststellen, fragt sie nach beiden.

In einem Fall fragt sie nicht:

- Wenn Sie Ihrem Server einen API-Schlüssel von Anthropic hinzufügen, während **Anrufe für mich annehmen** schon eingeschaltet ist, schreibt Claude ab dann die Notizen zu angenommenen Anrufen, ohne dass die App fragt. Das richten Sie selbst auf Ihrem Server ein. Wenn Sie das nicht möchten, schalten Sie **Anrufe für mich annehmen** aus, bevor Sie den Schlüssel hinzufügen. Die App fragt dann, wenn Sie das Annehmen das nächste Mal einschalten.

**So widerrufen Sie Ihre Erlaubnis:** Einstellungen → Über Yaver → **Erlaubnis widerrufen** (die Schaltfläche erscheint dort, sobald Sie einen Dienst erlaubt haben). Ist Ihr Server für echte Anrufe eingerichtet, schaltet die App dabei auch **Anrufe für mich annehmen** aus. Dafür muss Ihr Server erreichbar sein. Ist er nicht erreichbar, zeigt die App einen Fehler, und das Annehmen bleibt eingeschaltet: Schalten Sie **Anrufe für mich annehmen** aus, sobald Ihr Server wieder erreichbar ist. Bis dahin angenommene Anrufe werden trotzdem noch abgerufen, und es werden Berichte dazu erstellt; ein bereits begonnener Anruf läuft bis zum Ende. Vor der nächsten Aufgabe, die einen Dienst braucht, fragt die App erneut. Der Widerruf löscht nicht, was bereits gesendet wurde ([so löschen Sie es](#wie-lange-daten-bleiben-und-wie-sie-sie-löschen)).

#### Retell AI: echte Anrufe

Retell AI, Inc., ein Unternehmen in den USA, tätigt die echten Anrufe für Ihren Server und nimmt Anrufe für ihn an – über Ihr eigenes Retell-Konto.

- **Was Retell erhält:** die anzurufende Nummer und Ihre Retell-Telefonnummer, Ihr Anliegen, Ihr Name, die Gesprächssprache und der Eröffnungssatz. Darin sagt die KI, dass sie in Ihrem Auftrag anruft und dass das Gespräch aufgezeichnet wird. Hat Ihr Server eine Internetadresse, erhält Retell auch diese Adresse, damit Retell Ihrem Server Meldungen zum Anruf schicken kann. Retell verarbeitet die Stimmen beider Seiten und alles, was gesagt wird. Dafür setzt Retell andere Unternehmen ein – für die Telefonleitungen, die Spracherkennung, die KI-Stimme und das KI-Modell ([Liste der Unterauftragsverarbeiter von Retell](https://trust.retellai.com/subprocessors)). Anschließend sendet Retell Ihrem Server die Mitschrift und eine eigene kurze Zusammenfassung.
- **Wenn Sie „Anrufe für mich annehmen“ einschalten:** Ihr Name, die Begrüßung, Ihr Hinweis für Anrufer und Ihre Sprachen werden in Ihrem Retell-Konto gespeichert, damit Retell Anrufe auch dann annehmen kann, wenn Ihr Computer aus ist. Diese Angaben bleiben dort – auch nachdem Sie das Annehmen ausgeschaltet haben –, bis Sie sie in Ihrem Retell-Konto ändern oder löschen (sie gehören zum Agenten „Yaver — answers calls“, der die Anrufe annimmt). Nummern, Stimmen und Nachrichten der Anrufer werden auf dieselbe Weise verarbeitet und aufgezeichnet.
- **Aufzeichnung und wie lange Retell sie aufbewahrt:**
  - Retell zeichnet jeden echten Anruf auf – den Ton und den Text. Das ist die Standardeinstellung von Retell, und Yaver ändert sie nicht.
  - Gleich nach einem Anruf fordert Ihr Server Retell auf, ihn zu löschen, einschließlich dessen, was Retell dazu gespeichert hat: sobald Retell seine eigene Auswertung des Anrufs schickt, spätestens aber zwei Minuten nach dem Ende des Anrufs. Das funktioniert nur, solange Ihr Server läuft. Ein Anruf, der angenommen wurde, während Ihr Server aus war, wird gelöscht, sobald Ihr Server ihn abgerufen hat. Das tut Ihr Server, solange Sie seine Einstellung `RETELL_DELETE_AFTER_CALL` nicht ausschalten.
  - Als Absicherung sorgt die Standardeinrichtung (`npm run retell:setup`) dafür, dass Retell Anrufe auch selbst löscht: nach einem Tag bei Anrufen, die Yaver tätigt, und nach sieben Tagen bei Anrufen, die Yaver annimmt. Bei angenommenen Anrufen sind es sieben Tage: So ist eine Nachricht, die jemand hinterlässt, während Ihr Computer aus ist, noch da, wenn Sie ihn einschalten.
  - Retell gibt an, dass das Löschen „den Anruf und die zugehörigen Daten“ entfernt und dass Retell einige grundlegende Angaben zum Anruf behält.
- **Verarbeitungsort und KI-Training:** Nach eigenen Angaben speichert und verarbeitet Retell Daten vor allem in den USA. Für Daten aus der EU nennt Retell Garantien wie die EU-Standardvertragsklauseln (von der EU-Kommission beschlossene Vertragsklauseln für die Übermittlung von Daten in Drittländer); eine Kopie können Sie unter support@retellai.com anfordern. Seinen Kunden – also Ihnen – bietet Retell einen Auftragsverarbeitungsvertrag an. Nach seinen Bedingungen darf Retell Anrufdaten nutzen, um seine Dienste und KI-Modelle zu verbessern – nachdem Merkmale entfernt wurden, die Personen erkennbar machen, und die Daten mit anderen Daten zusammengefasst wurden. Yaver kann nicht ausschließen, dass das geschieht; prüfen Sie die Bedingungen von Retell (unten verlinkt).
- [Datenschutzerklärung von Retell](https://www.retellai.com/legal/privacy-policy) · [Nutzungsbedingungen](https://www.retellai.com/legal/terms-of-service)

#### Claude von Anthropic: Berichte, Briefe, Nachrichten und Formulare

Claude, die KI von Anthropic, schreibt Ihre Anrufberichte und die Notizen zu angenommenen Anrufen, erklärt Briefe, schreibt Nachrichten und füllt Formulare aus. Nach den Geschäftsbedingungen von Anthropic (Commercial Terms) ist Ihr Vertragspartner Anthropic Ireland, Limited, wenn Sie im Europäischen Wirtschaftsraum, in der Schweiz oder im Vereinigten Königreich leben, und sonst – zum Beispiel in der Türkei – Anthropic PBC in den USA. In beiden Fällen verarbeitet Anthropic die Daten nur für Sie und nach Ihren Weisungen (Anthropic ist Ihr „Auftragsverarbeiter“), auf Grundlage seiner Vereinbarung zur Auftragsverarbeitung (Data Processing Addendum).

- **Was Anthropic erhält:** Für einen Anrufbericht: die Mitschrift, Ihr Anliegen, die Sprachen und Ihr Name. Für eine Notiz zu einem Anruf, den Yaver angenommen hat: die Mitschrift, Ihr Name und die Sprache. Für einen Brief, eine Nachricht oder ein Formular: Ihr Anliegen, der Text des Dokuments und die Sprachen. Briefe enthalten oft private Angaben, zum Beispiel zu Ihrer Gesundheit, Ihren Finanzen oder Ihrer Aufenthaltserlaubnis. Überlegen Sie vor dem Senden, ob Sie damit einverstanden sind, dass Anthropic einen solchen Brief verarbeitet.
- **Speicherdauer:** Anthropic gibt an, dass es normalerweise innerhalb von 30 Tagen löscht, was Ihr Server sendet und was Claude zurückschreibt. Länger bewahrt Anthropic die Daten nur auf, wenn das Gesetz es verlangt, oder bis zu zwei Jahre, wenn seine Systeme sie als möglichen Verstoß gegen seine Nutzungsrichtlinie markieren.
- **Verarbeitungsort und KI-Training:** Anthropic gibt an, die Daten in den USA zu speichern. Anthropic kann sie auch in anderen Ländern verarbeiten und nutzt dafür die EU-Standardvertragsklauseln. Nach seinen Geschäftsbedingungen darf Anthropic seine KI-Modelle nicht mit diesen Daten trainieren.
- Ohne Ihren eigenen API-Schlüssel von Anthropic geht nichts an Anthropic.
- [Datenschutzerklärung von Anthropic](https://www.anthropic.com/legal/privacy) · [Geschäftsbedingungen](https://www.anthropic.com/legal/commercial-terms) · [Vereinbarung zur Auftragsverarbeitung](https://www.anthropic.com/legal/data-processing-addendum) · [Speicherdauer](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)

### Apple: Spracherkennung, Übersetzung, Absturzberichte

- **Spracherkennung (im Übersetzer):** Kann Ihr iPhone die Sprache selbst erkennen, bleibt der Ton auf dem iPhone. Kann es das nicht, sendet iOS den Ton an Apple, und der Übersetzer weist Sie darauf hin ([Apple zu Siri, Diktierfunktion und Datenschutz](https://www.apple.com/legal/privacy/data/en/ask-siri-dictation/)).
- **Die Übersetzung** läuft auf dem iPhone. iOS fragt einmal, ob die Sprachen von Apple geladen werden sollen. Apple gibt an, dass es Nutzungsstatistiken erheben kann – etwa, welche Sprachen übersetzt werden –, aber nicht den Text selbst.
- **Briefe und Formulare:** Die App erkennt den Text auf dem iPhone und sendet das Foto nie. Nur der Text geht an Ihren Server, und zwar erst, wenn Sie die Aufgabe senden.
- **Absturzberichte und Statistiken:** Apple gibt sie nur dann an den Entwickler weiter, wenn Sie das erlauben: Einstellungen → Datenschutz & Sicherheit → Analyse & Verbesserungen → Mit App-Entwicklern teilen. Dort können Sie das jederzeit wieder ausschalten. Apple stellt sie dem Entwickler nur in einer Form bereit, in der Sie nicht persönlich erkennbar sind. Ein Absturzbericht enthält das iPhone-Modell, die Versionen von iOS und der App sowie technische Angaben zum Absturz. Die Statistiken zeigen nur Gesamtzahlen.
- **TestFlight-Testversionen** (TestFlight ist die App von Apple zum Testen neuer Versionen): Apple gibt dem Entwickler immer Absturzberichte weiter, zusammen mit Ihrem iPhone-Modell, der Angabe, wie oft Sie die Testversion genutzt haben, und Feedback, das Sie senden – mit Bildschirmfoto, falls Sie eines anhängen. Hat der Entwickler Sie per E-Mail eingeladen, sieht er diese Angaben mit Ihrem Namen und Ihrer E-Mail-Adresse. Sind Sie über einen öffentlichen Link beigetreten, bleiben Sie anonym.
- Den Download aus dem App Store wickelt Apple ab ([Datenschutzrichtlinie von Apple](https://www.apple.com/de/legal/privacy/de-ww/)).

### Cloudflare: nur, wenn Sie Ihren Server mit `npm run start:public` starten

Mit diesem Befehl bekommt Ihr Server von Cloudflare eine Internetadresse (einen kostenlosen „Quick Tunnel“). Alles, was über diese Adresse zwischen Ihrem Server und der App oder Retell läuft, geht durch das Netz von Cloudflare: was die App sendet, wenn sie diese Adresse nutzt (unterwegs oder nachdem Sie den Code gescannt haben, der die Adresse enthält), alles, was Retell sendet, und die Antworten Ihres Servers. Dazu gehören der Zugangsschlüssel, Ihre Aufgaben, die Mitschriften und die Berichte. Dafür gelten die [Nutzungsbedingungen](https://www.cloudflare.com/website-terms/) und die [Datenschutzerklärung](https://www.cloudflare.com/privacypolicy/) von Cloudflare. Cloudflare, Inc. ist ein US-Unternehmen. Cloudflare gibt an, nach dem Datenschutzrahmen EU-USA (EU-U.S. Data Privacy Framework) zertifiziert zu sein. Die EU-Kommission hat in einem Angemessenheitsbeschluss festgestellt, dass Daten bei US-Unternehmen, die nach diesem Rahmen zertifiziert sind, angemessen geschützt sind. Wenn Sie Ihren Server mit `npm start` oder per Doppelklick auf **Start Yaver.command** starten, geht nichts über Cloudflare.

### Ein Hosting-Anbieter: nur, wenn Sie einen wählen

Wenn Sie Ihren Server bei einem Hosting-Anbieter statt auf Ihrem eigenen Computer betreiben, werden die Datenbank und das Log Ihres Servers bei diesem Unternehmen gespeichert. Dafür gelten dann dessen Bedingungen und Datenschutzerklärung.

### Zurückrufen, Bericht teilen und Webseiten

Die Schaltfläche „… zurückrufen“ öffnet die Telefon-App des iPhone mit der Nummer. „Bericht teilen“ öffnet das Teilen-Menü von iOS, und Sie wählen, wohin der Bericht geht. „Datenschutzerklärung“, „Hilfe und Kontakt“ und „Ein Problem mit diesem Ergebnis melden“ öffnen Seiten auf GitHub in Ihrem Webbrowser. GitHub (USA) verarbeitet dann Daten zu Ihrem Besuch, etwa Ihre IP-Adresse, nach seiner [Datenschutzerklärung](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Der Entwickler sieht nur, wie oft die Seiten aufgerufen wurden, nicht von wem.

### Weitergabe an Dritte

Die App selbst gibt Ihre Daten an keine Dritten weiter. Sie enthält keinen Analyse-, Werbe- oder sonstigen Code von Drittanbietern, und der Entwickler hat keine Partner oder verbundenen Unternehmen, die Nutzerdaten erhalten. Retell AI, Anthropic, Cloudflare oder ein Hosting-Anbieter erhalten Daten nur von Ihrem eigenen Server, nur in den oben beschriebenen Fällen und nur, weil Sie sie dort eingerichtet haben. Apple erhält Daten nur über iOS, und GitHub sieht nur Ihre Besuche auf seinen Seiten, wie oben beschrieben. Die E-Mails, die Sie dem Entwickler schreiben, liegen bei seinem E-Mail-Anbieter Google ([siehe unten](#wie-lange-daten-bleiben-und-wie-sie-sie-löschen)). Jedes dieser Unternehmen schützt die Daten nach seinen eigenen Bedingungen, die auf dieser Seite verlinkt sind. Wo der Entwickler weiß, dass diese Bedingungen mehr erlauben, als diese Erklärung beschreibt, steht das hier – zum Beispiel, dass Retell Anrufdaten nutzen darf, aus denen Merkmale entfernt wurden, die Personen erkennbar machen.

## Berechtigungen auf Ihrem iPhone

Alle Berechtigungen sind freiwillig. Lehnen Sie eine ab, funktioniert nur die Funktion nicht, die sie braucht. Sie können sie jederzeit unter Einstellungen → Apps → Yaver ändern.

| Berechtigung | Wozu sie dient |
|---|---|
| Lokales Netzwerk | Ihren Server in Ihrem WLAN finden und sich mit ihm verbinden |
| Mikrofon, Spracherkennung | Der Live-Übersetzer |
| Kamera | Einen Brief oder ein Formular fotografieren |
| Mitteilungen | Erinnerungen |

**Fotos:** Dafür ist keine Berechtigung nötig. Nur wenn Ihr iPhone mit seiner Kamera keine Dokumente scannen kann, wählen Sie in der Fotoauswahl von iOS ein Foto des Briefs oder Formulars aus – und die App erhält nur dieses Foto.

## Wen Yaver anruft und wer Sie anruft

Zu Beginn jedes echten Anrufs sagt die KI, dass sie ein KI-Assistent ist, der für Sie handelt, und dass das Gespräch aufgezeichnet wird. Wenn Yaver einen Anruf tätigt, nennt es auch Ihren Namen; für einen echten Anruf ist deshalb Ihr Name nötig (Einstellungen → Ihre Angaben). Wenn Yaver für Sie einen Anruf annimmt, nennt es Ihren Namen, sofern Sie einen eingetragen haben.

Über die andere Person verarbeitet Yaver:

- ihre Telefonnummer;
- ihre Stimme: Retell verarbeitet sie während des Anrufs und zeichnet sie auf; die Aufnahme bleibt bei Retell, bis Ihr Server den Anruf löschen lässt (siehe [Retell AI](#retell-ai-echte-anrufe));
- was sie sagt: Das wird als Mitschrift auf Ihrem Server gespeichert und an Anthropic gesendet, wenn Ihr Server die Berichte von Claude schreiben lässt.

Möchte diese Person wissen, was über sie gespeichert ist, oder möchte sie, dass es gelöscht wird, sollte sie sich an Sie wenden: Sie sind die Person, die im Anruf genannt wird, und Sie betreiben den Yaver-Server, der die Mitschrift speichert. Der Entwickler von Yaver hat keine Daten dieser Person. Yaver kann auf Ihrem Server keinen einzelnen Anruf löschen, nur alles auf einmal ([so geht’s](#wie-lange-daten-bleiben-und-wie-sie-sie-löschen)). Bei Retell können Sie einen einzelnen Anruf in Ihrem Retell-Konto löschen.

## Ihre eigene Verantwortung

Ganz gleich, wofür Sie Yaver nutzen – auch privat –, gelten für Sie die Gesetze über das Aufzeichnen von Gesprächen (in Deutschland § 201 des Strafgesetzbuchs, in der Türkei Art. 133 des türkischen Strafgesetzbuchs). Deshalb beginnt jeder echte Anruf mit dem Hinweis, dass er aufgezeichnet wird.

Nutzen Sie Yaver nur für Ihre eigenen privaten Angelegenheiten – zum Beispiel, um für sich oder Ihre Familie in der Arztpraxis oder bei Ihrem Vermieter anzurufen –, ist das in der Regel eine ausschließlich persönliche oder familiäre Tätigkeit. Für Ihren Umgang mit den Daten der anderen Person gilt die DSGVO dann nicht (Art. 2 Abs. 2 lit. c DSGVO). Diese Ausnahme ist eng gefasst. In der Türkei ist sie noch enger ([siehe unten](#hinweise-für-nutzer-in-der-türkei-kvkk)).

Nutzen Sie Yaver beruflich, für ein Unternehmen, eine freiberufliche Tätigkeit, einen Verein oder für andere Menschen, sind Sie für diese Anrufe datenschutzrechtlich verantwortlich: Sie sind der „Verantwortliche“. Dann müssen Sie:

- eine Rechtsgrundlage für die Anrufe haben;
- die betroffenen Personen darüber informieren, was mit ihren Daten geschieht. Der Eröffnungssatz ist nur der Anfang; geben Sie ihnen die übrigen Informationen, wenn sie danach fragen, zum Beispiel in Ihren eigenen Datenschutzhinweisen;
- mit jedem Dienst, den Sie verbinden, einen Auftragsverarbeitungsvertrag abschließen (Art. 28 DSGVO). Bei Anthropic ist er Teil der Geschäftsbedingungen. Nach Angaben von Retell können Sie den Vertrag dort online unterzeichnen. Prüfen Sie auch die Bedingungen Ihres Hosting-Anbieters;
- die Regeln für die Übermittlung von Daten in Drittländer, also in Länder außerhalb der EU, einhalten (in der Türkei: die Regeln des KVKK).

## Wie lange Daten bleiben und wie Sie sie löschen

- **Auf Ihrem iPhone:** bis Sie die App löschen (Yaver-Symbol gedrückt halten → App entfernen → App löschen), und in den Backups Ihres iPhone (in iCloud oder auf dem Computer), bis diese gelöscht werden. iOS kann den Zugangsschlüssel und die Geräte-ID auch nach dem Löschen der App im Schlüsselbund behalten. Installieren Sie Yaver erneut, verwendet die App sie wieder; ohne Ihren eigenen Server nützen sie nichts. Sprachen, die Sie für die Übersetzung geladen haben, bleiben auf dem iPhone; Sie können sie unter Einstellungen → Apps → Übersetzen → Geladene Sprachen entfernen. Schalten Sie **Anrufe für mich annehmen** aus, bevor Sie die App löschen: Das Löschen der App hindert weder Ihren Server noch Retell daran, Ihre Anrufe anzunehmen.
- **Auf Ihrem Server:** bis Sie sie selbst löschen. Die App hat keine Schaltfläche zum Löschen, und Yaver kann keine einzelnen Anrufe löschen. So löschen Sie alles:
  1. Schalten Sie in der App **Anrufe für mich annehmen** aus, damit Retell keine Anrufe mehr annimmt.
  2. Beenden Sie Ihren Server: Schließen Sie sein Fenster (oder drücken Sie darin Ctrl-C). Bei einem Hosting-Anbieter beenden Sie ihn dort.
  3. Öffnen Sie im Yaver-Projektordner (dem Ordner mit **Start Yaver.command**) den Ordner `backend` und löschen Sie darin den Ordner `data`. Bei einem Hosting-Anbieter löschen Sie stattdessen den Speicher (das „Volume“), der mit Ihrem Server verbunden ist.
  4. Damit sind alle Aufgaben, Mitschriften und Berichte gelöscht, ebenso der Zugangsschlüssel, den Ihr Server erzeugt hat. Wenn Sie Ihren Server wieder starten, ist er leer. Zeigt er einen neuen Code, scannen Sie ihn mit der Kamera des iPhone, um die App wieder zu verbinden.
- **Bei Retell:** Ihr Server lässt jeden Anruf gleich nach dessen Ende löschen, und mit der Standardeinrichtung löscht Retell Anrufe nach einem oder nach sieben Tagen auch selbst ([Details](#retell-ai-echte-anrufe)). In Ihrem Retell-Konto können Sie außerdem selbst Anrufe löschen, ebenso Ihren Namen, die Begrüßung und Ihren Hinweis für Anrufer (siehe oben).
- **Bei Anthropic:** Anthropic löscht die Daten nach eigenen Fristen, normalerweise innerhalb von 30 Tagen ([Details](#claude-von-anthropic-berichte-briefe-nachrichten-und-formulare)).
- **E-Mails an den Entwickler:** Die E-Mails werden nur so lange aufbewahrt, wie es für die Antwort nötig ist, und danach innerhalb von 12 Monaten gelöscht, sofern das Gesetz keine längere Aufbewahrung verlangt. Sie können verlangen, dass sie früher gelöscht werden. Das gilt auch für Problemmeldungen, die Sie senden, nachdem Sie auf **Ein Problem mit diesem Ergebnis melden** getippt haben. Senden Sie nur, was nötig ist: keine Passwörter oder Zugangsschlüssel – und Angaben über andere Personen nur, wenn das Problem ohne sie nicht zu verstehen ist. Der Entwickler nutzt Gmail; deshalb speichert und verarbeitet auch Google die E-Mails, möglicherweise in den USA. Google gibt an, nach dem Datenschutzrahmen EU-USA zertifiziert zu sein, für den die EU-Kommission ein angemessenes Schutzniveau festgestellt hat ([Datenschutzerklärung von Google](https://policies.google.com/privacy?hl=de)).
- **Absturzberichte und Statistiken:** Apple bewahrt sie auf und entscheidet, wie lange ([Datenschutzrichtlinie von Apple](https://www.apple.com/de/legal/privacy/de-ww/)).

## Kein Tracking, keine Werbung, kein Verkauf

Die App enthält keine Werbung, keine Nutzungsanalyse, kein Tracking und keine SDKs von Drittanbietern (Softwarebausteine anderer Unternehmen). Es werden keine Daten verkauft, und nichts wird genutzt, um Sie zu bewerten oder Ihr Verhalten vorherzusagen (kein Profiling). Yaver trifft keine automatisierten Entscheidungen über Sie, die rechtliche Folgen für Sie haben oder Sie in ähnlicher Weise erheblich beeinträchtigen (Art. 22 DSGVO).

## Rechtsgrundlagen (DSGVO)

| Was | Rechtsgrundlage |
|---|---|
| E-Mails an den Entwickler | Art. 6 Abs. 1 lit. f DSGVO: das berechtigte Interesse des Entwicklers, Ihnen zu antworten. Geht es in Ihrer Frage um die Nutzung der App: Art. 6 Abs. 1 lit. b DSGVO, um Ihnen die App bereitzustellen. |
| Absturzberichte und Statistiken von Apple, auch aus TestFlight | Apple stellt sie dem Entwickler nur in einer Form bereit, in der Sie nicht persönlich erkennbar sind (TestFlight: siehe [Apple](#apple-spracherkennung-übersetzung-absturzberichte)). Soweit es dennoch personenbezogene Daten sind: Art. 6 Abs. 1 lit. f DSGVO, das berechtigte Interesse des Entwicklers, Fehler zu finden und zu beheben. Ob Apple sie weitergibt, entscheiden Sie in iOS. |

Die Daten auf Ihrem iPhone und auf Ihrem Server sowie das, was Ihr Server an Retell, Anthropic, Cloudflare oder einen Hosting-Anbieter sendet, verarbeitet der Entwickler nicht. Er braucht dafür deshalb keine Rechtsgrundlage – darüber entscheiden Sie ([siehe „Ihre eigene Verantwortung“](#ihre-eigene-verantwortung)). Die Erlaubnis, die die App einholt, bevor Daten an einen KI-Dienst gehen, ist eine Vorgabe von Apple und ein Schutz für Sie. Diese Erlaubnis ist keine Einwilligung der Personen, mit denen Yaver für Sie telefoniert.

Sie sind nicht verpflichtet, Daten anzugeben. Ohne Server funktioniert nur der Live-Übersetzer. Ohne eine Berechtigung funktioniert nur die Funktion nicht, die sie braucht. Ohne Ihren Namen tätigt Yaver keine echten Anrufe. Ohne Ihre E-Mail-Adresse kann der Entwickler Ihnen nicht antworten.

## Ihre Rechte

**Was Sie vom Entwickler verlangen können.** Der Entwickler hat nur dann Daten über Sie, wenn Sie ihm eine E-Mail schreiben oder wenn Sie Yaver mit TestFlight testen (das, was Apple über Tester anzeigt). Für diese Daten können Sie verlangen:

- Auskunft, welche Daten der Entwickler über Sie hat, und eine Kopie davon (Art. 15 DSGVO);
- dass er sie berichtigt (Art. 16 DSGVO);
- dass er sie löscht (Art. 17 DSGVO);
- dass er ihre Verarbeitung einschränkt (Art. 18 DSGVO);
- soweit dieses Recht besteht, dass Sie die Daten in einem gängigen Dateiformat erhalten (Datenübertragbarkeit, Art. 20 DSGVO).

Schreiben Sie dazu an [caanonurr@gmail.com](mailto:caanonurr@gmail.com).

**Ihr Widerspruchsrecht.** Sie können jederzeit widersprechen, wenn der Entwickler Ihre E-Mails oder Absturzberichte auf Grundlage seines berechtigten Interesses verarbeitet (Art. 21 DSGVO). Schreiben Sie dazu an [caanonurr@gmail.com](mailto:caanonurr@gmail.com).

**Alles andere liegt in Ihrer Hand.** Der Entwickler hat keinen Zugriff auf Ihr iPhone, Ihren Server oder Ihre Konten bei Retell, Anthropic, Cloudflare oder einem Hosting-Anbieter. Er kann dort also nichts anzeigen, berichtigen oder löschen. Das tun Sie selbst ([so geht’s](#wie-lange-daten-bleiben-und-wie-sie-sie-löschen)), oder Sie wenden sich an diese Unternehmen; ihre Datenschutzerklärungen sind oben verlinkt. Wenn Apple keine Absturzberichte mehr an den Entwickler weitergeben soll: Schalten Sie auf Ihrem iPhone unter Einstellungen → Datenschutz & Sicherheit → Analyse & Verbesserungen die Option „Mit App-Entwicklern teilen“ aus. So widerrufen Sie Ihre Erlaubnis für KI-Dienste: in Yaver unter Einstellungen → Über Yaver → Erlaubnis widerrufen.

**Beschwerderecht.** Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren, insbesondere in dem EU-Mitgliedstaat, in dem Sie leben oder arbeiten oder in dem Ihrer Ansicht nach gegen das Datenschutzrecht verstoßen wurde (Art. 77 DSGVO): [Aufsichtsbehörden in Deutschland](https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html) · [Aufsichtsbehörden in allen Ländern der EU und des EWR](https://www.edpb.europa.eu/about-edpb/our-members_en).

## Hinweise für Nutzer in der Türkei (KVKK)

Nach dem türkischen Gesetz Nr. 6698 über den Schutz personenbezogener Daten (KVKK) gilt:

- **Der Entwickler.** Für die Daten, die ihn erreichen, ist der Entwickler von Yaver der Verantwortliche (veri sorumlusu) ([Kontakt](#wer-ist-verantwortlich)). Von der App erhält er keine Daten.
  - Ihre E-Mails werden elektronisch erhoben, wenn Sie schreiben. Die E-Mails werden nur genutzt, um Ihnen zu antworten. Rechtsgrundlage: das berechtigte Interesse des Entwicklers (Art. 5 Abs. 2 lit. f KVKK). Gespeichert werden sie bei Google (Gmail), das sie außerhalb der Türkei verarbeiten kann, zum Beispiel in den USA.
  - Absturzberichte und Statistiken von Apple identifizieren Sie nicht. Wo sie es doch tun (TestFlight), ist die Rechtsgrundlage das berechtigte Interesse, Fehler zu beheben (Art. 5 Abs. 2 lit. f KVKK).
- **Sie.** In der Türkei ist die Ausnahme für die private Nutzung (Art. 28 Abs. 1 lit. a KVKK) eng gefasst. Die Ausnahme gilt nur für Tätigkeiten, die allein Sie selbst oder die Familienangehörigen betreffen, mit denen Sie zusammenleben, und nur, wenn keine Daten an andere gehen. Ihr Server gibt Anrufdaten an Retell und Anthropic weiter; das KVKK kann deshalb auch dann gelten, wenn Sie Yaver privat nutzen. Wo es gilt, sind Sie der Verantwortliche (veri sorumlusu) für Ihre Anrufe. Sie müssen dann die Menschen, mit denen Sie über Yaver telefonieren, darüber informieren, wie ihre Daten verwendet werden (Art. 10 KVKK). Ihr Server sendet Daten in die USA (an Retell, an Anthropic und, wenn Sie es nutzen, an Cloudflare); Sie müssen deshalb auch die Regeln des KVKK für die Übermittlung von Daten ins Ausland einhalten (Art. 9 KVKK).
- **Ihre Rechte (Art. 11 KVKK).** Sie können:
  - erfahren, ob Ihre Daten verarbeitet werden, und wenn ja, Auskunft darüber verlangen;
  - erfahren, wozu sie verarbeitet werden und ob sie nur dafür verwendet werden;
  - erfahren, an wen sie in der Türkei oder im Ausland weitergegeben werden;
  - verlangen, dass falsche oder unvollständige Daten berichtigt oder Daten gelöscht werden und dass die Empfänger darüber informiert werden;
  - einem für Sie nachteiligen Ergebnis widersprechen, das allein auf einer automatisierten Auswertung beruht;
  - Schadensersatz verlangen, wenn Ihnen eine rechtswidrige Verarbeitung schadet.
- **So gehen Sie vor.** Schreiben Sie zuerst eine E-Mail an den Entwickler, und zwar von der Adresse, mit der Sie ihm schon früher geschrieben haben. Der Entwickler antwortet spätestens innerhalb von 30 Tagen (Art. 13 KVKK). Sind Sie mit der Antwort nicht zufrieden oder erhalten Sie keine, können Sie sich beim türkischen Datenschutzausschuss beschweren (Kişisel Verileri Koruma Kurulu, [kvkk.gov.tr](https://www.kvkk.gov.tr)): innerhalb von 30 Tagen nach der Antwort oder, wenn keine Antwort kam, innerhalb von 60 Tagen nach Ihrem Antrag (Art. 14 KVKK).

## Kinder

Yaver ist für Erwachsene gedacht. Der Entwickler erhält von der App keine Daten und erhebt deshalb auch keine Daten über Kinder.

## Änderungen dieser Datenschutzerklärung

Wenn sich ändert, was Yaver mit Daten tut, wird diese Seite aktualisiert, und das Datum oben ändert sich. Frühere Fassungen finden Sie auf GitHub: Öffnen Sie diese Seite dort und klicken Sie auf **History**.

## Kontakt

Der Entwickler von Yaver: [caanonurr@gmail.com](mailto:caanonurr@gmail.com)<br>
Hilfe zur App: [Hilfe und Kontakt](https://github.com/acanonur/iphoneapp/blob/claude/ai-secretary-design-uyvh5i/docs/support.md#deutsch)
