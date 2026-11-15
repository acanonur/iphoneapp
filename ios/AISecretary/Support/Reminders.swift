import Foundation
import UserNotifications

/// Reminders that actually remind: a follow-up with a date becomes a
/// notification on this iPhone at that time. Nothing leaves the phone.
enum Reminders {
    /// Schedules the notification. Returns false when the user has not allowed
    /// Yaver to send notifications — the follow-up is then only a list entry.
    static func schedule(id: String, text: String, at date: Date) async -> Bool {
        let center = UNUserNotificationCenter.current()
        guard (try? await center.requestAuthorization(options: [.alert, .sound])) == true else {
            return false
        }
        let content = UNMutableNotificationContent()
        content.title = Brand.name
        content.body = text
        content.sound = .default

        let moment = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute], from: date
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: moment, repeats: false)
        do {
            try await center.add(
                UNNotificationRequest(identifier: "yaver.reminder.\(id)", content: content, trigger: trigger)
            )
            return true
        } catch {
            return false
        }
    }
}
