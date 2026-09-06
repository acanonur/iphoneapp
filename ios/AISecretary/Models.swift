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
        case .call: return "Phone call"
        case .letter: return "Letter"
        case .message: return "Message"
        case .form: return "Form"
        case .followup: return "Follow-up"
        case .reminder: return "Reminder"
        }
    }

    /// The longer name the home screen's grid uses.
    var tileLabel: String {
        switch self {
        case .call: return "Phone call"
        case .letter: return "Letter or document"
        case .message: return "Email or message"
        case .form: return "Fill in a form"
        case .followup: return "Follow-up or reminder"
        case .reminder: return "Reminder"
        }
    }

    /// The short name the Brief screen's type control uses.
    var briefLabel: String {
        switch self {
        case .call: return "Call"
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
        case .queued: return "Queued"
        case .dialing: return "Dialing…"
        case .inProgress: return "On the call…"
        case .completed: return "Completed"
        case .failed: return "Failed"
        case .draft: return "Draft ready"
        case .needsInput: return "Needs your details"
        case .scheduled: return "Scheduled"
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
        case .achieved: return "Goal achieved"
        case .partiallyAchieved: return "Partly achieved"
        case .notAchieved: return "Not achieved"
        case .noAnswer: return "No answer"
        case .unknown: return "Outcome unknown"
        }
    }

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = CallOutcome(rawValue: raw) ?? .unknown
    }
}

struct SecretaryTask: Codable, Identifiable, Equatable {
    let id: String
    let kind: TaskKind
    let goal: String
    let phoneNumber: String?
    let language: Language
    let summaryLanguage: Language
    let userName: String?
    let status: TaskStatus
    let documentText: String?
    let transcript: String?
    let summary: String?
    /// What the secretary produced — a drafted reply, a translation.
    let result: String?
    let todo: String?
    let todoWhen: String?
    let outcome: CallOutcome?
    let durationSeconds: Int?
    let error: String?
    let createdAt: String
    let updatedAt: String

    var createdDate: Date? {
        ISO8601DateFormatter.withFractionalSeconds.date(from: createdAt)
            ?? ISO8601DateFormatter.plain.date(from: createdAt)
    }

    /// The ledger's timestamp: "Now", "Today · 16:05", "Mon · 09:12".
    var whenLabel: String {
        guard let date = createdDate else { return "" }
        return DateFormatting.relative(date)
    }

    /// The transcript, split into the speaker/line pairs the design lays out.
    var transcriptLines: [TranscriptLine] {
        TranscriptLine.parse(transcript)
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

/// One turn of a call, as the transcript records it.
struct TranscriptLine: Identifiable, Equatable {
    let id: Int
    let speaker: String
    let text: String
    let isAI: Bool

    /// Speaker labels the backend and the voice provider use for our own agent.
    private static let aiSpeakers: Set<String> = [
        "ki-assistent", "ai assistant", "yapay zeka asistanı",
        "agent", "assistant", "ai", "bot",
    ]

    /// Splits a `Speaker: line` transcript. The secretary always speaks first —
    /// the AI disclosure is the opening sentence — so an unrecognised first
    /// speaker is still the AI side.
    static func parse(_ transcript: String?) -> [TranscriptLine] {
        guard let transcript, !transcript.isEmpty else { return [] }
        var firstSpeaker: String?
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

            let key = speaker.lowercased()
            if firstSpeaker == nil, !key.isEmpty { firstSpeaker = key }
            let isAI = aiSpeakers.contains(key) || (!key.isEmpty && key == firstSpeaker)

            lines.append(
                TranscriptLine(id: lines.count, speaker: speaker, text: text, isAI: isAI)
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
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    private static let weekday: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter
    }()

    private static let dayMonth: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("d MMM")
        return formatter
    }()

    static func relative(_ date: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        let seconds = now.timeIntervalSince(date)
        if seconds < 60 { return "Now" }
        if calendar.isDateInToday(date) { return "Today · \(time.string(from: date))" }
        if calendar.isDateInYesterday(date) { return "Yesterday · \(time.string(from: date))" }
        if seconds < 7 * 24 * 3600 {
            return "\(weekday.string(from: date)) · \(time.string(from: date))"
        }
        return "\(dayMonth.string(from: date)) · \(time.string(from: date))"
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
/// the user during onboarding so they know what the other side will hear.
/// Required by EU AI Act Article 50(1); the backend speaks the same line.
enum Disclosure {
    static func line(_ language: Language, name: String?) -> String {
        let trimmed = name?.trimmingCharacters(in: .whitespaces) ?? ""
        guard !trimmed.isEmpty else {
            switch language {
            case .de: return "Hallo! Hier spricht ein KI-Assistent, der im Auftrag eines Kunden anruft."
            case .tr: return "Merhaba! Ben bir müşteri adına arayan bir yapay zeka asistanıyım."
            case .en: return "Hello! This is an AI assistant calling on behalf of a client."
            }
        }
        switch language {
        case .de: return "Hallo! Hier spricht ein KI-Assistent, der im Auftrag von \(trimmed) anruft."
        case .tr: return "Merhaba! Ben \(trimmed) adına arayan bir yapay zeka asistanıyım."
        case .en: return "Hello! This is an AI assistant calling on behalf of \(trimmed)."
        }
    }
}
