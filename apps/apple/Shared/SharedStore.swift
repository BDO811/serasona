import Foundation
import WidgetKit

/// The app-group-backed cache the watch complication reads, and that both the
/// iOS app and the watch app's own check-in flow write to after a completed
/// check-in. Deliberately tiny — a complication has no business holding more
/// than "what's the latest state, and when."
enum SharedStore {
    /// Must match the App Group capability configured on every target
    /// (iOS app, watch app, watch widget extension) in `project.yml`.
    static let appGroupID = "group.com.serasona.app"

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroupID) ?? .standard
    }

    private static let stateKey = "serasona.latest.state"
    private static let dateKey = "serasona.latest.date"

    static func recordLatest(state: OverallState, date: Date = Date()) {
        defaults.set(state.rawValue, forKey: stateKey)
        defaults.set(date.timeIntervalSince1970, forKey: dateKey)
        WidgetCenter.shared.reloadAllTimelines()
    }

    static var latestState: OverallState? {
        (defaults.string(forKey: stateKey)).flatMap(OverallState.init(rawValue:))
    }

    static var latestDate: Date? {
        let interval = defaults.double(forKey: dateKey)
        return interval > 0 ? Date(timeIntervalSince1970: interval) : nil
    }

    /// Wipes the cached reading. Called when an account is deleted, so the
    /// watch face doesn't keep showing a band belonging to an account that
    /// no longer exists.
    static func clear() {
        defaults.removeObject(forKey: stateKey)
        defaults.removeObject(forKey: dateKey)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
