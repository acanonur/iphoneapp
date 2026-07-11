import Foundation
import SwiftUI

enum Language: String, Codable, CaseIterable, Identifiable {
    case de, en, tr

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .de: return "Deutsch 🇩🇪"
        case .en: return "English 🇬🇧"
        case .tr: return "Türkçe 🇹🇷"
        }
    }
}

enum CallStatus: String, Codable {
    case queued
    case dialing
    case inProgress = "in_progress"
    case completed
    case failed

    var label: String {
        switch self {
        case .queued: return "Queued"
        case .dialing: return "Dialing…"
        case .inProgress: return "On the call…"
        case .completed: return "Completed"
        case .failed: return "Failed"
        }
    }

    var color: Color {
        switch self {
        case .queued: return .gray
        case .dialing: return .orange
        case .inProgress: return .blue
        case .completed: return .green
        case .failed: return .red
        }
    }

    var isActive: Bool {
        switch self {
        case .queued, .dialing, .inProgress: return true
        case .completed, .failed: return false
        }
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
        case .achieved: return "✅ Goal achieved"
        case .partiallyAchieved: return "🟡 Partly achieved"
        case .notAchieved: return "❌ Not achieved"
        case .noAnswer: return "📵 No answer"
        case .unknown: return "❔ Unknown"
        }
    }
}

struct CallTask: Codable, Identifiable, Equatable {
    let id: String
    let goal: String
    let phoneNumber: String
    let language: Language
    let summaryLanguage: Language
    let userName: String?
    let status: CallStatus
    let transcript: String?
    let summary: String?
    let outcome: CallOutcome?
    let error: String?
    let createdAt: String
    let updatedAt: String

    var createdDate: Date? {
        ISO8601DateFormatter.withFractionalSeconds.date(from: createdAt)
            ?? ISO8601DateFormatter.plain.date(from: createdAt)
    }
}

struct NewCallRequest: Codable {
    let goal: String
    let phoneNumber: String
    let language: Language
    let summaryLanguage: Language
    let userName: String?
}

extension ISO8601DateFormatter {
    static let withFractionalSeconds: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static let plain = ISO8601DateFormatter()
}
