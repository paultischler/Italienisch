import Foundation
import UserNotifications

/// Eine Erinnerung pro Tag zur festen Uhrzeit, nur wenn mindestens fünf Karten fällig sind.
enum Reminders {
    static let identifier = "impara.daily"
    static let minimumDue = 5
    static var hour = 12
    static var minute = 30

    static func requestAuthorization() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
    }

    static func schedule(dueCount: Int) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        guard dueCount >= minimumDue else { return }

        let content = UNMutableNotificationContent()
        content.title = "\(dueCount) Karten fällig"
        content.body = "Eine Minute?"
        content.sound = nil

        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
    }
}
