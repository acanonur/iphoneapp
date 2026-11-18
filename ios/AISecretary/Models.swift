import Foundation

enum Language: String, Codable, CaseIterable, Identifiable {
    case de, en, tr

    var id: String { rawValue }

    /// Each language named in itself, as the design writes them.
    var displayName: String {
        switch self {
        case .de: return "Deutsch"
        case .en: return "English"
        case .tr: return "Türkçe"
        }
    }

    /// The language's name in the reader's own language — for sentences and
    /// facts ("translated into German"). `displayName` is for choosing a
    /// language, where each is best recognised by its own name.
    var localizedName: String {
        switch self {
        case .de: return L("German")
        case .en: return L("English")
        case .tr: return L("Turkish")
        }
    }

    /// The name in capitals, by the rules of the language it names — so
    /// "English" never picks up a Turkish dotted İ.
    var displayNameUppercased: String {
        displayName.uppercased(with: Locale(identifier: rawValue))
    }

    /// Locale for speech recognition and the spoken voice.
    var speechLocaleIdentifier: String {
        switch self {
        case .de: return "de-DE"
        case .en: return "en-US"
        case .tr: return "tr-TR"
        }
    }

    var voiceLanguageCode: String { speechLocaleIdentifier }

    /// Language value for Apple's Translation framework.
    var localeLanguage: Locale.Language { Locale.Language(identifier: rawValue) }

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Language(rawValue: raw) ?? .en
    }
}

/// What the user asked the secretary to do.
enum TaskKind: String, Codable, CaseIterable, Identifiable {
    case call, letter, message, form, followup, reminder

    var id: String { rawValue }

    /// The kinds the user can start from the Brief screen.
    static let briefable: [TaskKind] = [.call, .letter, .message, .form, .followup]

    /// How the ledger names the kind.
    var label: String {
        switch self {
        case .call: return L("Phone call")
        case .letter: return L("Letter")
        case .message: return L("Message")
        case .form: return L("Form")
        case .followup: return L("Follow-up")
        case .reminder: return L("Reminder")
        }
    }

    /// The longer name the home screen's grid uses.
    var tileLabel: String {
        switch self {
        case .call: return L("Phone call")
        case .letter: return L("Letter or document")
        case .message: return L("Email or message")
        case .form: return L("Fill in a form")
        case .followup: return L("Follow-up or reminder")
        case .reminder: return L("Reminder")
        }
    }

    /// The short name the Brief screen's type control uses.
    var briefLabel: String {
        switch self {
        case .call: return L("Call")
        case .followup: return L("Reminder")
        default: return label
        }
    }

    var glyph: Lucide {
        switch self {
        case .call: return .phone
        case .letter: return .fileText
        case .message: return .mail
        case .form: return .clipboardList
        case .followup, .reminder: return .bell
        }
    }

    /// Kinds where the secretary works from a photographed document.
    var takesDocument: Bool {
        self == .letter || self == .form
    }

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = TaskKind(rawValue: raw) ?? .call
    }
}

enum TaskStatus: String, Codable {
    case queued
    case dialing
    case inProgress = "in_progress"
    case completed
    case failed
    case draft
    case needsInput = "needs_input"
    case scheduled

    var label: String {
        switch self {
        case .queued: return L("Queued")
        case .dialing: return L("Dialing…")
        case .inProgress: return L("On the call…")
        case .completed: return L("Completed")
        case .failed: return L("Failed")
        case .draft: return L("Draft ready")
        case .needsInput: return L("Needs your details")
        case .scheduled: return L("Scheduled")
        }
    }

    var tagVariant: TagVariant {
        switch self {
        case .dialing, .inProgress, .draft: return .accent
        case .failed, .needsInput: return .outline
        case .queued, .completed, .scheduled: return .neutral
        }
    }

    /// Still being worked on — the home screen counts these as "in progress".
    var isActive: Bool {
        switch self {
        case .queued, .dialing, .inProgress: return true
        case .completed, .failed, .draft, .needsInput, .scheduled: return false
        }
    }

    /// Position on the live call's four-cell progress rail.
    var railIndex: Int {
        switch self {
        case .queued: return 0
        case .dialing: return 1
        case .inProgress: return 2
        case .completed, .failed: return 3
        default: return 0
        }
    }

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = TaskStatus(rawValue: raw) ?? .queued
    }
}

enum CallOutcome: String, Codable {
    case achieved
    case partiallyAchieved = "partially_achieved"
    case notAchieved = "not_achieved"
    case noAnswer = "no_answer"
    case unknown

    var label: String {
        switch self {
        case .achieved: return L("Goal achieved")
        case .partiallyAchieved: return L("Partly achieved")
        case .notAchieved: return L("Not achieved")
        case .noAnswer: return L("No answer")
        case .unknown: return L("Outcome unknown")
        }
    }

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = CallOutcome(rawValue: raw) ?? .unknown
    }
}

/// `outbound`: the secretary called someone. `inbound`: it answered for the user.
enum CallDirection: String, Codable {
    case outbound, inbound

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = CallDirection(rawValue: raw) ?? .outbound
    }
}

/// Why a call did not work out. The server sends a code; the words are ours,
/// so they arrive in the user's language.
enum CallProblem: String {
    case noAnswer = "no_answer"
    case busy
    case declined
    case voicemail
    case invalidNumber = "invalid_number"
    case blocked
    case providerAccount = "provider_account"
    case providerError = "provider_error"
    case technical
    case cancelled
    case limitReached = "limit_reached"
    /// A letter, message or form on a server with no AI to work on it.
    case reportsOff = "reports_off"
    /// The AI was asked and did not deliver.
    case reportFailed = "report_failed"

    /// The few words that stand where the outcome would.
    var title: String {
        switch self {
        case .noAnswer: return L("No answer")
        case .busy: return L("Line busy")
        case .declined: return L("Call declined")
        case .voicemail: return L("Voicemail answered")
        case .invalidNumber: return L("Number not valid")
        case .blocked: return L("Call blocked")
        case .providerAccount, .providerError: return L("Could not place the call")
        case .technical: return L("Call interrupted")
        case .cancelled: return L("Ended by you")
        case .limitReached: return L("Daily limit reached")
        case .reportsOff: return L("Not set up yet")
        case .reportFailed: return L("Could not be done")
        }
    }

    /// One or two sentences on what happened and what to do about it.
    var explanation: String {
        switch self {
        case .noAnswer:
            return L("Nobody picked up. Try again later, or at a time the office is open.")
        case .busy:
            return L("The line was busy. Try again in a few minutes.")
        case .declined:
            return L("The call was rejected on the other side. They may not accept calls from unknown numbers.")
        case .voicemail:
            return L("An answering machine or phone menu picked up, not a person. No message was left.")
        case .invalidNumber:
            return L("The phone company does not recognise this number. Check it, including the country code.")
        case .blocked:
            return L("The phone company refused to connect this call. The number you are calling from may not be allowed to call this country.")
        case .providerAccount:
            return L("The phone service account cannot place calls right now — usually credit or a limit. Check the account of whoever runs your server.")
        case .providerError:
            return L("The phone service could not place the call. Try again; if it keeps happening, check the server.")
        case .technical:
            return L("A technical problem cut the call off. Whatever was said until then is below.")
        case .cancelled:
            return L("You ended this call.")
        case .limitReached:
            return L("Your server has reached the number of calls it places per day.")
        case .reportsOff:
            return L("Letters, messages and forms are worked on by Claude, and your server has no key for it yet. On the computer, in the backend folder, run “npm run claude:setup” — then try again.")
        case .reportFailed:
            return L("The AI service did not answer, or declined. Try again in a moment. If it keeps happening, check the key on your server.")
        }
    }
}

/// One turn of a call. `assistant` is the AI secretary; `other` is whoever is
/// on the line with it.
struct CallLine: Codable, Equatable {
    enum Role: String, Codable {
        case assistant, other

        init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self)
            self = Role(rawValue: raw) ?? .other
        }
    }

    let role: Role
    let text: String
}

struct SecretaryTask: Decodable, Identifiable, Equatable {
    let id: String
    let kind: TaskKind
    let goal: String
    let phoneNumber: String?
    let language: Language
    let summaryLanguage: Language
    let userName: String?
    let status: TaskStatus
    var direction: CallDirection = .outbound
    /// True when no real phone call happened — the server's simulator ran it.
    var simulated = false
    let documentText: String?
    /// The call so far, turn by turn. Grows while the call is in progress.
    var lines: [CallLine] = []
    let transcript: String?
    let summary: String?
    /// Where the summary came from. `placeholder` means "no report yet".
    var summarySource: String?
    /// What the secretary produced — a drafted reply, a translation.
    let result: String?
    let todo: String?
    let todoWhen: String?
    let outcome: CallOutcome?
    let durationSeconds: Int?
    let error: String?
    var errorCode: String?
    let createdAt: String
    let updatedAt: String

    var createdDate: Date? {
        ISO8601DateFormatter.withFractionalSeconds.date(from: createdAt)
            ?? ISO8601DateFormatter.plain.date(from: createdAt)
    }

    var updatedDate: Date? {
        ISO8601DateFormatter.withFractionalSeconds.date(from: updatedAt)
            ?? ISO8601DateFormatter.plain.date(from: updatedAt)
    }

    /// A call that has just ended, whose report is still being written. The
    /// call is over before the report exists, so the app must keep asking.
    ///
    /// The phone service's own short summary counts as "still being written":
    /// it arrives first and stands in until the real report replaces it.
    var isAwaitingReport: Bool {
        guard kind == .call, status == .completed else { return false }
        guard summary == nil || summarySource == "placeholder" || summarySource == "provider"
        else { return false }
        guard let updated = updatedDate else { return false }
        return Date().timeIntervalSince(updated) < 90
    }

    /// The ledger's timestamp: "Now", "Today · 16:05", "Mon · 09:12".
    var whenLabel: String {
        guard let date = createdDate else { return "" }
        return DateFormatting.relative(date)
    }

    var isInbound: Bool { kind == .call && direction == .inbound }

    /// What went wrong, if the server said.
    var problem: CallProblem? {
        errorCode.flatMap(CallProblem.init(rawValue:))
    }

    /// The row title. An answered call has no brief: until the secretary has
    /// written down who rang and why, it is named by the number that called.
    var title: String {
        guard isInbound else { return goal }
        if !goal.isEmpty { return goal }
        if let phoneNumber, !phoneNumber.isEmpty { return Lf("Call from %@", phoneNumber) }
        return L("Call from an unknown number")
    }

    /// How the ledger names the kind of this task.
    var kindLabel: String {
        isInbound ? L("Answered call") : kind.label
    }

    /// The words that sum up where the task stands: the outcome if there is
    /// one, the reason if it failed, the status otherwise.
    var verdict: String {
        if let problem, status == .failed || problem == .cancelled { return problem.title }
        if isInbound, status == .completed {
            return outcome == .noAnswer ? L("No message left") : L("Message taken")
        }
        return outcome?.label ?? status.label
    }

    /// The call, turn by turn. Falls back to the plain transcript for a server
    /// that does not send the turns yet.
    var transcriptLines: [TranscriptLine] {
        if !lines.isEmpty {
            return lines.enumerated().map { index, line in
                TranscriptLine(id: index, isAI: line.role == .assistant, text: line.text)
            }
        }
        return TranscriptLine.parse(transcript)
    }

    /// Seconds the call has been running, for the live screen's clock.
    var elapsedSeconds: Int {
        if let durationSeconds { return durationSeconds }
        guard let date = createdDate else { return 0 }
        return max(0, Int(Date().timeIntervalSince(date)))
    }

    /// The line under a ledger row: the number for a call, the outcome otherwise.
    var metaLabel: String {
        if let phoneNumber, !phoneNumber.isEmpty { return phoneNumber }
        return outcome?.label ?? ""
    }
}

extension SecretaryTask {
    private enum CodingKeys: String, CodingKey {
        case id, kind, goal, phoneNumber, language, summaryLanguage, userName, status
        case direction, simulated, documentText, lines, transcript, summary, summarySource, result
        case todo, todoWhen, outcome, durationSeconds, error, errorCode, createdAt, updatedAt
    }

    /// Decoded field by field, so a server that is older (fewer fields) or
    /// newer (more) than the app still yields a usable task.
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(String.self, forKey: .id)
        kind = try values.decodeIfPresent(TaskKind.self, forKey: .kind) ?? .call
        goal = try values.decodeIfPresent(String.self, forKey: .goal) ?? ""
        phoneNumber = try values.decodeIfPresent(String.self, forKey: .phoneNumber)
        language = try values.decodeIfPresent(Language.self, forKey: .language) ?? .de
        summaryLanguage = try values.decodeIfPresent(Language.self, forKey: .summaryLanguage) ?? .en
        userName = try values.decodeIfPresent(String.self, forKey: .userName)
        status = try values.decodeIfPresent(TaskStatus.self, forKey: .status) ?? .queued
        direction = try values.decodeIfPresent(CallDirection.self, forKey: .direction) ?? .outbound
        simulated = try values.decodeIfPresent(Bool.self, forKey: .simulated) ?? false
        documentText = try values.decodeIfPresent(String.self, forKey: .documentText)
        lines = try values.decodeIfPresent([CallLine].self, forKey: .lines) ?? []
        transcript = try values.decodeIfPresent(String.self, forKey: .transcript)
        summary = try values.decodeIfPresent(String.self, forKey: .summary)
        summarySource = try values.decodeIfPresent(String.self, forKey: .summarySource)
        result = try values.decodeIfPresent(String.self, forKey: .result)
        todo = try values.decodeIfPresent(String.self, forKey: .todo)
        todoWhen = try values.decodeIfPresent(String.self, forKey: .todoWhen)
        outcome = try values.decodeIfPresent(CallOutcome.self, forKey: .outcome)
        durationSeconds = try values.decodeIfPresent(Int.self, forKey: .durationSeconds)
        error = try values.decodeIfPresent(String.self, forKey: .error)
        errorCode = try values.decodeIfPresent(String.self, forKey: .errorCode)
        createdAt = try values.decodeIfPresent(String.self, forKey: .createdAt) ?? ""
        updatedAt = try values.decodeIfPresent(String.self, forKey: .updatedAt) ?? ""
    }
}

/// One turn of a call, as the screens lay it out.
struct TranscriptLine: Identifiable, Equatable {
    let id: Int
    let isAI: Bool
    let text: String

    /// Speaker labels a voice provider or an older server uses for our own agent.
    private static let aiSpeakers: Set<String> = [
        "ki-assistent", "ai assistant", "yapay zeka asistanı", "yapay zekâ asistanı",
        "agent", "assistant", "ai", "bot",
    ]

    /// Splits a plain `Speaker: line` transcript — the fallback for a server
    /// that sends no structured turns.
    static func parse(_ transcript: String?) -> [TranscriptLine] {
        guard let transcript, !transcript.isEmpty else { return [] }
        var lines: [TranscriptLine] = []

        for raw in transcript.split(separator: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            guard !line.isEmpty else { continue }

            var speaker = ""
            var text = line
            if let separator = line.range(of: ": "),
               line.distance(from: line.startIndex, to: separator.lowerBound) <= 40 {
                speaker = String(line[..<separator.lowerBound])
                text = String(line[separator.upperBound...])
            }

            lines.append(
                TranscriptLine(
                    id: lines.count,
                    isAI: aiSpeakers.contains(speaker.lowercased()),
                    text: text
                )
            )
        }
        return lines
    }
}

struct NewTaskRequest: Codable {
    var kind: TaskKind
    var goal: String
    var phoneNumber: String?
    var language: Language?
    var summaryLanguage: Language?
    var userName: String?
    var documentText: String?
    var todoWhen: String?
}

// MARK: - Formatting

enum DateFormatting {
    private static let time: DateFormatter = {
        let formatter = DateFormatter()
        // A fixed format needs a fixed locale, or the phone's 12-hour switch
        // rewrites it.
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    private static let weekday: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = L10n.locale
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "EEE"
        return formatter
    }()

    private static let dayMonth: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = L10n.locale
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.setLocalizedDateFormatFromTemplate("d MMM")
        return formatter
    }()

    static func relative(_ date: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        let seconds = now.timeIntervalSince(date)
        if seconds < 60 { return L("Now") }
        if calendar.isDateInToday(date) { return "\(L("Today")) · \(time.string(from: date))" }
        if calendar.isDateInYesterday(date) {
            return "\(L("Yesterday")) · \(time.string(from: date))"
        }
        if seconds < 7 * 24 * 3600 {
            return "\(weekday.string(from: date)) · \(time.string(from: date))"
        }
        return "\(dayMonth.string(from: date)) · \(time.string(from: date))"
    }

    private static let dueDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = L10n.locale
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.setLocalizedDateFormatFromTemplate("EEE d MMM")
        return formatter
    }()

    /// When something is due: "Fri 20 Nov · 14:30".
    static func due(_ date: Date) -> String {
        "\(dueDay.string(from: date)) · \(time.string(from: date))"
    }

    /// `mm:ss`, with the tabular figures the design asks for.
    static func clock(_ seconds: Int) -> String {
        String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}

extension ISO8601DateFormatter {
    static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let plain = ISO8601DateFormatter()
}

/// The AI self-disclosure spoken as the first sentence of every call, shown to
/// the user so they know what the other side will hear. Required by EU AI Act
/// Article 50(1); the server speaks the same line (backend/src/prompt.ts). It
/// ends by saying the call is recorded: the phone service records it, and the
/// other side has to be told (§ 201 StGB, TCK Art. 133).
enum Disclosure {
    /// The sentence that tells the other side the call is recorded.
    static func recorded(_ language: Language) -> String {
        switch language {
        case .de: return "Das Gespräch wird aufgezeichnet."
        case .tr: return "Bu görüşme kaydediliyor."
        case .en: return "This call is being recorded."
        }
    }

    static func line(_ language: Language, name: String?) -> String {
        let trimmed = name?.trimmingCharacters(in: .whitespaces) ?? ""
        guard !trimmed.isEmpty else {
            switch language {
            case .de: return "Guten Tag! Hier spricht ein KI-Assistent, der im Auftrag eines Kunden anruft. \(recorded(.de))"
            case .tr: return "Merhaba! Ben bir müşteri adına arayan bir yapay zekâ asistanıyım. \(recorded(.tr))"
            case .en: return "Hello! This is an AI assistant calling on behalf of a client. \(recorded(.en))"
            }
        }
        switch language {
        case .de: return "Guten Tag! Hier spricht ein KI-Assistent, der im Auftrag von \(trimmed) anruft. \(recorded(.de))"
        case .tr: return "Merhaba! Ben \(trimmed) adına arayan bir yapay zekâ asistanıyım. \(recorded(.tr))"
        case .en: return "Hello! This is an AI assistant calling on behalf of \(trimmed). \(recorded(.en))"
        }
    }

    /// The first thing a caller hears when the secretary answers for the user.
    static func greeting(_ language: Language, name: String?) -> String {
        let trimmed = name?.trimmingCharacters(in: .whitespaces) ?? ""
        guard !trimmed.isEmpty else {
            switch language {
            case .de: return "Guten Tag! Hier ist ein KI-Assistent. Die gewünschte Person ist gerade nicht erreichbar. \(recorded(.de)) Wie kann ich Ihnen helfen?"
            case .tr: return "Merhaba! Ben bir yapay zekâ asistanıyım. Aradığınız kişi şu anda müsait değil. \(recorded(.tr)) Size nasıl yardımcı olabilirim?"
            case .en: return "Hello! This is an AI assistant. The person you are calling can't take your call right now. \(recorded(.en)) How can I help you?"
            }
        }
        switch language {
        case .de: return "Guten Tag! Hier ist der KI-Assistent von \(trimmed). \(trimmed) ist gerade nicht erreichbar. \(recorded(.de)) Wie kann ich Ihnen helfen?"
        case .tr: return "Merhaba! Ben \(trimmed) adına telefona bakan yapay zekâ asistanıyım. \(trimmed) şu anda müsait değil. \(recorded(.tr)) Size nasıl yardımcı olabilirim?"
        case .en: return "Hello! This is \(trimmed)'s AI assistant. \(trimmed) can't take your call right now. \(recorded(.en)) How can I help you?"
        }
    }
}
