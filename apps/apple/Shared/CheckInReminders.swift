import Foundation
import UserNotifications

/// Schedules the "a short voice check-in, a few times a week" reminder
/// `OnboardingView` promises — Mon/Wed/Fri at a user-chosen time. A nudge
/// often enough to build the habit without becoming a daily notification
/// someone starts swiping away unread.
enum CheckInReminders {
    private static let enabledKey = "serasona.reminders.enabled"
    private static let hourKey = "serasona.reminders.hour"
    private static let minuteKey = "serasona.reminders.minute"
    private static let identifierPrefix = "serasona.reminder.weekday."

    /// `Calendar` weekday numbering: Sunday = 1 ... Saturday = 7.
    private static let weekdays = [2, 4, 6] // Mon, Wed, Fri

    static var isEnabled: Bool {
        UserDefaults.standard.bool(forKey: enabledKey)
    }

    /// Defaults to 9:00am the first time this is read, before anyone has
    /// picked their own time.
    static var time: DateComponents {
        var components = DateComponents()
        components.hour = UserDefaults.standard.object(forKey: hourKey) as? Int ?? 9
        components.minute = UserDefaults.standard.object(forKey: minuteKey) as? Int ?? 0
        return components
    }

    /// Turns reminders on, requesting notification permission first. Returns
    /// `false` (and leaves reminders off) if permission is denied.
    @discardableResult
    static func enable() async -> Bool {
        let granted = await requestAuthorization()
        guard granted else { return false }
        UserDefaults.standard.set(true, forKey: enabledKey)
        await reschedule()
        return true
    }

    static func disable() {
        UserDefaults.standard.set(false, forKey: enabledKey)
        removePending()
    }

    /// Call after the user picks a new time in Settings; a no-op reschedule
    /// when reminders are currently off.
    static func setTime(hour: Int, minute: Int) {
        UserDefaults.standard.set(hour, forKey: hourKey)
        UserDefaults.standard.set(minute, forKey: minuteKey)
        guard isEnabled else { return }
        Task { await reschedule() }
    }

    private static func requestAuthorization() async -> Bool {
        await withCheckedContinuation { continuation in
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                continuation.resume(returning: granted)
            }
        }
    }

    private static func removePending() {
        let identifiers = weekdays.map { "\(identifierPrefix)\($0)" }
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: identifiers)
    }

    private static func reschedule() async {
        removePending()

        let content = UNMutableNotificationContent()
        content.title = "Time for a check-in"
        content.body = "A short voice check-in keeps your baseline current: energy, stress, mood and more."
        content.sound = .default

        let center = UNUserNotificationCenter.current()
        for weekday in weekdays {
            var components = time
            components.weekday = weekday
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            let request = UNNotificationRequest(identifier: "\(identifierPrefix)\(weekday)", content: content, trigger: trigger)
            await withCheckedContinuation { continuation in
                center.add(request) { _ in continuation.resume() }
            }
        }
    }
}
