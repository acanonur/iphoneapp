import Foundation

/// The real screens, shown over ready-made data and with nothing touching the
/// network. Used to photograph every screen in every language (see
/// `.github/workflows/ci.yml`) — which is how the design is checked — and
/// available only in debug builds, by launch argument:
///
///     -yaverStage report
@MainActor
struct Stage {
    let model: SecretaryViewModel
    let translator: LiveTranslator
    let route: Route
    var translatorStage: TranslatorStage?
    var onboardingStep = 0
    /// Settings opens scrolled down to "Answer my calls".
    var settingsShowsAnswering = false

    static func requested() -> Stage? {
        #if DEBUG
        guard let name = UserDefaults.standard.string(forKey: "yaverStage") else { return nil }
        return Fixtures.stage(named: name)
        #else
        return nil
        #endif
    }
}

#if DEBUG

/// One coherent story, told in the reader's language: a person abroad has the
/// secretary book a doctor's appointment, gets a call answered, and has some
/// paperwork on the go.
@MainActor
enum Fixtures {
    /// The reader's language: the one the interface is in.
    private static var reader: Language { L10n.language }
    /// A German reader calls Turkish numbers; everyone else calls German ones.
    private static var spoken: Language { reader == .de ? .tr : .de }
    private static var name: String { reader == .de ? "Jonas Becker" : "Deniz Kaya" }
    private static var number: String { spoken == .de ? "+49 30 1234567" : "+90 232 123 45 67" }

    private static func text(_ en: String, _ de: String, _ tr: String) -> String {
        switch reader {
        case .en: return en
        case .de: return de
        case .tr: return tr
        }
    }

    private static func ago(_ seconds: TimeInterval) -> String {
        ISO8601DateFormatter.withFractionalSeconds.string(from: Date().addingTimeInterval(-seconds))
    }

    // MARK: - The call

    /// The conversation as it was spoken, with each line in the reader's language.
    private static var conversation: [(role: CallLine.Role, said: String, means: String)] {
        if spoken == .de {
            return [
                (.other, "Praxis Dr. Weber, guten Tag.",
                 text("Dr. Weber’s practice, hello.", "", "Dr. Weber muayenehanesi, iyi günler.")),
                (.assistant,
                 "Guten Tag! Hier spricht ein KI-Assistent, der im Auftrag von Deniz Kaya anruft. Ich möchte einen Kontrolltermin für nächste Woche vereinbaren, am liebsten vormittags.",
                 text(
                     "Hello! This is an AI assistant calling on behalf of Deniz Kaya. I would like to book a check-up for next week, preferably in the morning.",
                     "",
                     "İyi günler! Ben Deniz Kaya adına arayan bir yapay zekâ asistanıyım. Gelecek hafta için bir kontrol randevusu almak istiyorum, tercihen öğleden önce."
                 )),
                (.other, "Einen Moment bitte. Dienstag um 10:30 Uhr wäre noch frei.",
                 text(
                     "One moment, please. Tuesday at 10:30 would still be free.", "",
                     "Bir dakika lütfen. Salı günü saat 10.30 hâlâ boş."
                 )),
                (.assistant, "Dienstag um 10:30 Uhr passt sehr gut. Können Sie den Termin bitte eintragen?",
                 text(
                     "Tuesday at 10:30 suits very well. Could you please book the appointment?", "",
                     "Salı 10.30 çok uygun. Randevuyu kaydedebilir misiniz lütfen?"
                 )),
                (.other, "Ist eingetragen. Bitte bringen Sie die Versichertenkarte mit.",
                 text(
                     "It is booked. Please bring your insurance card.", "",
                     "Kaydedildi. Lütfen sigorta kartınızı yanınızda getirin."
                 )),
            ]
        }
        return [
            (.other, "Ege Diş Kliniği, buyurun.", "Zahnklinik Ege, guten Tag."),
            (.assistant,
             "Merhaba! Ben Jonas Becker adına arayan bir yapay zekâ asistanıyım. Gelecek hafta için bir kontrol randevusu almak istiyorum, tercihen öğleden önce.",
             "Guten Tag! Ich bin ein KI-Assistent und rufe im Auftrag von Jonas Becker an. Ich möchte für nächste Woche einen Kontrolltermin vereinbaren, am liebsten vormittags."),
            (.other, "Bir saniye lütfen. Salı günü saat 10.30 uygun görünüyor.",
             "Einen Moment bitte. Dienstag um 10:30 Uhr wäre möglich."),
            (.assistant, "Salı 10.30 çok uygun. Randevuyu kaydedebilir misiniz?",
             "Dienstag um 10:30 Uhr passt sehr gut. Können Sie den Termin eintragen?"),
            (.other, "Kaydettim. Lütfen kimliğinizi yanınızda getirin.",
             "Ist eingetragen. Bitte bringen Sie Ihren Ausweis mit."),
        ]
    }

    private static var callGoal: String {
        text(
            "Call my doctor and book a check-up for next week, mornings preferred.",
            "Meinen Zahnarzt anrufen und für nächste Woche einen Kontrolltermin vereinbaren, am liebsten vormittags.",
            "Doktorumu ara ve gelecek hafta için bir kontrol randevusu al, tercihen öğleden önce."
        )
    }

    private static func call(
        id: String, status: TaskStatus, lineCount: Int, age: TimeInterval
    ) -> SecretaryTask {
        let done = status == .completed
        return SecretaryTask(
            id: id,
            kind: .call,
            goal: callGoal,
            phoneNumber: number,
            language: spoken,
            summaryLanguage: reader,
            userName: name,
            status: status,
            documentText: nil,
            lines: conversation.prefix(lineCount).map { CallLine(role: $0.role, text: $0.said) },
            transcript: nil,
            summary: done
                ? text(
                    "The practice offered an appointment on Tuesday at 10:30, and it is booked. Please bring your insurance card.",
                    "Die Klinik hat einen Termin am Dienstag um 10:30 Uhr angeboten, und er ist eingetragen. Bitte bringen Sie Ihren Ausweis mit.",
                    "Muayenehane salı günü saat 10.30 için randevu önerdi ve randevu kaydedildi. Lütfen sigorta kartınızı yanınızda getirin."
                )
                : nil,
            result: nil,
            todo: done
                ? text(
                    "Bring your insurance card to the appointment",
                    "Ausweis zum Termin mitbringen",
                    "Randevuya sigorta kartınızı götürün"
                )
                : nil,
            todoWhen: done ? text("Tuesday, 10:30", "Dienstag, 10:30 Uhr", "Salı, 10.30") : nil,
            outcome: done ? .achieved : nil,
            durationSeconds: done ? 94 : nil,
            error: nil,
            createdAt: ago(age),
            updatedAt: ago(age)
        )
    }

    // MARK: - A call that was answered

    private static var caller: [(role: CallLine.Role, said: String, means: String)] {
        if spoken == .de {
            return [
                (.assistant,
                 "Guten Tag! Hier ist der KI-Assistent von Deniz Kaya. Deniz Kaya ist gerade nicht erreichbar. Wie kann ich Ihnen helfen?",
                 text(
                     "Hello! This is Deniz Kaya’s AI assistant. Deniz Kaya can’t take your call right now. How can I help you?",
                     "",
                     "İyi günler! Ben Deniz Kaya’nın yapay zekâ asistanıyım. Deniz Kaya şu anda müsait değil. Size nasıl yardımcı olabilirim?"
                 )),
                (.other,
                 "Hier ist die Hausverwaltung Schmidt. Der Heizungsmonteur kommt am Donnerstag zwischen 8 und 10 Uhr.",
                 text(
                     "This is Schmidt property management. The heating engineer is coming on Thursday between 8 and 10.",
                     "",
                     "Schmidt bina yönetiminden arıyorum. Kalorifer tamircisi perşembe günü saat 8 ile 10 arasında gelecek."
                 )),
                (.assistant, "Verstanden: Donnerstag zwischen 8 und 10 Uhr. Unter welcher Nummer kann zurückgerufen werden?",
                 text(
                     "Understood: Thursday between 8 and 10. Which number should be called back?", "",
                     "Anladım: perşembe saat 8 ile 10 arası. Hangi numaradan geri aranabilirsiniz?"
                 )),
                (.other, "Unter 030 1234567, falls der Termin nicht passt.",
                 text(
                     "On 030 1234567, if the appointment does not suit.", "",
                     "Randevu uygun değilse 030 1234567 numarasından."
                 )),
            ]
        }
        return [
            (.assistant,
             "Merhaba! Ben Jonas Becker adına telefona bakan yapay zekâ asistanıyım. Jonas Becker şu anda müsait değil. Size nasıl yardımcı olabilirim?",
             "Guten Tag! Hier ist der KI-Assistent von Jonas Becker. Jonas Becker ist gerade nicht erreichbar. Wie kann ich Ihnen helfen?"),
            (.other, "Site yönetiminden arıyorum. Kombi ustası perşembe günü saat 8 ile 10 arasında gelecek.",
             "Ich rufe von der Hausverwaltung an. Der Heizungsmonteur kommt am Donnerstag zwischen 8 und 10 Uhr."),
            (.assistant, "Anladım: perşembe saat 8 ile 10 arası. Hangi numaradan geri aranabilirsiniz?",
             "Verstanden: Donnerstag zwischen 8 und 10 Uhr. Unter welcher Nummer kann zurückgerufen werden?"),
            (.other, "Saat uygun değilse 0232 123 45 67 numarasından.",
             "Unter 0232 123 45 67, falls der Termin nicht passt."),
        ]
    }

    private static var answered: SecretaryTask {
        SecretaryTask(
            id: "answered",
            kind: .call,
            goal: text(
                "Property management: heating engineer on Thursday",
                "Hausverwaltung: Heizungsmonteur am Donnerstag",
                "Bina yönetimi: kalorifer tamircisi perşembe günü"
            ),
            phoneNumber: number,
            language: spoken,
            summaryLanguage: reader,
            userName: name,
            status: .completed,
            direction: .inbound,
            documentText: nil,
            lines: caller.map { CallLine(role: $0.role, text: $0.said) },
            transcript: nil,
            summary: text(
                "The property management rang. The heating engineer is coming on Thursday between 8 and 10. If that does not suit, call back.",
                "Die Hausverwaltung hat angerufen. Der Heizungsmonteur kommt am Donnerstag zwischen 8 und 10 Uhr. Falls das nicht passt, bitte zurückrufen.",
                "Bina yönetimi aradı. Kalorifer tamircisi perşembe günü saat 8 ile 10 arasında gelecek. Uygun değilse geri arayın."
            ),
            result: nil,
            todo: text(
                "Be at home on Thursday morning, or call back",
                "Am Donnerstagvormittag zu Hause sein oder zurückrufen",
                "Perşembe sabahı evde olun ya da geri arayın"
            ),
            todoWhen: text("Thursday, 8–10", "Donnerstag, 8–10 Uhr", "Perşembe, 8–10"),
            outcome: .achieved,
            durationSeconds: 48,
            error: nil,
            createdAt: ago(3 * 3600),
            updatedAt: ago(3 * 3600)
        )
    }

    // MARK: - The rest of the ledger

    private static var paperwork: [SecretaryTask] {
        [
            SecretaryTask(
                id: "failed",
                kind: .call,
                goal: text(
                    "Ask the citizens’ office for a new appointment",
                    "Beim Bürgeramt nach einem neuen Termin fragen",
                    "Nüfus dairesinden yeni bir randevu iste"
                ),
                phoneNumber: spoken == .de ? "+49 30 9012345" : "+90 232 765 43 21",
                language: spoken,
                summaryLanguage: reader,
                userName: name,
                status: .failed,
                documentText: nil,
                transcript: nil,
                summary: nil,
                result: nil,
                todo: nil,
                todoWhen: nil,
                outcome: .noAnswer,
                durationSeconds: nil,
                error: "Call not connected (dial_no_answer)",
                errorCode: "no_answer",
                createdAt: ago(26 * 3600),
                updatedAt: ago(26 * 3600)
            ),
            SecretaryTask(
                id: "letter",
                kind: .letter,
                goal: text(
                    "What does this letter from the tax office want from me?",
                    "Was will dieses Schreiben vom Finanzamt von mir?",
                    "Vergi dairesinden gelen bu mektup benden ne istiyor?"
                ),
                phoneNumber: nil,
                language: spoken,
                summaryLanguage: reader,
                userName: name,
                status: .completed,
                documentText: nil,
                transcript: nil,
                summary: text(
                    "The tax office asks for your tax ID and a copy of your rental contract by 28 November. Nothing is to be paid.",
                    "Das Finanzamt bittet bis zum 28. November um Ihre Steuernummer und eine Kopie des Mietvertrags. Es ist nichts zu zahlen.",
                    "Vergi dairesi 28 Kasım’a kadar vergi numaranızı ve kira sözleşmenizin bir kopyasını istiyor. Ödenecek bir şey yok."
                ),
                result: nil,
                todo: nil,
                todoWhen: nil,
                outcome: .achieved,
                durationSeconds: nil,
                error: nil,
                createdAt: ago(2 * 24 * 3600),
                updatedAt: ago(2 * 24 * 3600)
            ),
            SecretaryTask(
                id: "message",
                kind: .message,
                goal: text(
                    "Email the landlord: the bathroom heating is broken",
                    "E-Mail an den Vermieter: Die Heizung im Bad ist defekt",
                    "Ev sahibine e-posta: banyodaki kalorifer bozuk"
                ),
                phoneNumber: nil,
                language: spoken,
                summaryLanguage: reader,
                userName: name,
                status: .draft,
                documentText: nil,
                transcript: nil,
                summary: text(
                    "The email is written and waiting for you to approve it.",
                    "Die E-Mail ist geschrieben und wartet auf Ihre Freigabe.",
                    "E-posta yazıldı ve onayınızı bekliyor."
                ),
                result: nil,
                todo: nil,
                todoWhen: nil,
                outcome: nil,
                durationSeconds: nil,
                error: nil,
                createdAt: ago(3 * 24 * 3600),
                updatedAt: ago(3 * 24 * 3600)
            ),
        ]
    }

    // MARK: - Staging

    private static func server(
        _ status: ServerStore.Status = .connected, simulated: Bool = false
    ) -> ServerStore {
        let store = ServerStore(
            defaults: UserDefaults(suiteName: "yaver.stage") ?? .standard, persists: false
        )
        var session = ServerSession()
        session.simulated = simulated
        session.reports = "claude"
        session.canAnswerCalls = true
        session.answerNumber = "+49 30 5550 1234"
        session.reachable = true
        session.allowedCountryPrefixes = ["+49", "+90", "+44", "+1"]
        session.profile = ServerProfile(name: name, language: reader, answerCalls: true, answerNote: nil)
        store.stage(
            health: ServerHealth(
                service: "yaver", version: 2, name: text("Deniz’s MacBook", "Jonas’ MacBook", "Deniz’in MacBook’u"),
                provider: simulated ? "mock" : "retell", simulated: simulated, auth: "key",
                reports: "claude"
            ),
            session: session,
            status: status
        )
        return store
    }

    private static func translator() -> LiveTranslator {
        let translator = LiveTranslator()
        let pair = TranslationPair(source: spoken, target: reader)
        var known: [String: String] = [:]
        for line in conversation + caller { known[line.said] = line.means }
        // The translator's own conversation.
        for turn in translatorTurns where turn.pair == pair { known[turn.said] = turn.means }
        translator.seed(known, pair)

        let back = TranslationPair(source: reader, target: spoken)
        var reverse: [String: String] = [:]
        for turn in translatorTurns where turn.pair == back { reverse[turn.said] = turn.means }
        translator.seed(reverse, back)
        return translator
    }

    /// A short exchange at a reception desk: the user speaks their language,
    /// the other side speaks theirs.
    private static var translatorTurns: [(pair: TranslationPair, said: String, means: String)] {
        let mine = TranslationPair(source: reader, target: spoken)
        let theirs = TranslationPair(source: spoken, target: reader)
        switch (reader, spoken) {
        case (.tr, _):
            return [
                (mine, "Merhaba, saat onda randevum var.", "Guten Tag, ich habe um zehn Uhr einen Termin."),
                (theirs, "Guten Tag. Haben Sie Ihre Versichertenkarte dabei?", "İyi günler. Sigorta kartınız yanınızda mı?"),
                (mine, "Evet, buyurun. Ne kadar beklemem gerekiyor", "Ja, bitte schön. Wie lange muss ich warten"),
            ]
        case (.de, _):
            return [
                (mine, "Guten Tag, ich habe um zehn Uhr einen Termin.", "Merhaba, saat onda randevum var."),
                (theirs, "Hoş geldiniz. Kimliğiniz yanınızda mı?", "Willkommen. Haben Sie Ihren Ausweis dabei?"),
                (mine, "Ja, bitte schön. Wie lange muss ich warten", "Evet, buyurun. Ne kadar beklemem gerekiyor"),
            ]
        default:
            return [
                (mine, "Hello, I have an appointment at ten.", "Guten Tag, ich habe um zehn Uhr einen Termin."),
                (theirs, "Guten Tag. Haben Sie Ihre Versichertenkarte dabei?", "Hello. Do you have your insurance card with you?"),
                (mine, "Yes, here you are. How long do I have to wait", "Ja, bitte schön. Wie lange muss ich warten"),
            ]
        }
    }

    private static var translatorStage: TranslatorStage {
        let turns = translatorTurns
        return TranslatorStage(
            entries: turns.dropLast().enumerated().map { index, turn in
                ConversationEntry(
                    id: "turn\(index)",
                    side: turn.pair.source == reader ? .mine : .theirs,
                    original: turn.said,
                    pair: turn.pair
                )
            },
            // The last turn is still being spoken: its translation is on the
            // other side already, a few words behind.
            speaking: .mine,
            partial: turns.last?.said ?? ""
        )
    }

    static func stage(named name: String) -> Stage? {
        // The translator screen reads its two languages from settings.
        UserDefaults.standard.set(reader.rawValue, forKey: "translator.myLanguage")
        UserDefaults.standard.set(spoken.rawValue, forKey: "translator.theirLanguage")

        let live = call(id: "live", status: .inProgress, lineCount: 4, age: 52)
        let finished = call(id: "done", status: .completed, lineCount: 5, age: 40 * 60)
        let ledger = [live, answered, finished] + paperwork
        let settled = [answered, finished] + paperwork

        func make(
            _ route: Route, tasks: [SecretaryTask], server store: ServerStore? = nil
        ) -> Stage {
            Stage(
                model: SecretaryViewModel(server: store ?? server(), staged: tasks),
                translator: translator(),
                route: route
            )
        }

        switch name {
        case "onboarding":
            return make(.onboarding, tasks: [])
        case "connect":
            var stage = make(.onboarding, tasks: [], server: server(simulated: true))
            stage.onboardingStep = 3
            return stage
        case "home":
            return make(.home, tasks: ledger)
        case "offline":
            return make(.home, tasks: [], server: server(.unreachable(.notRunning)))
        case "brief":
            return make(.brief(.call), tasks: settled)
        case "call":
            return make(.call("live"), tasks: ledger)
        case "report":
            return make(.report("done"), tasks: settled)
        case "answered":
            return make(.report("answered"), tasks: settled)
        case "failed":
            return make(.report("failed"), tasks: settled)
        case "translator":
            var stage = make(.translator, tasks: settled)
            stage.translatorStage = translatorStage
            return stage
        case "settings":
            return make(.settings, tasks: settled)
        case "answering":
            var stage = make(.settings, tasks: settled)
            stage.settingsShowsAnswering = true
            return stage
        default:
            return nil
        }
    }
}

#endif
