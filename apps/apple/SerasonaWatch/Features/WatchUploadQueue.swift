import Foundation

/// Durable account-scoped outbox. Persist analysis before saving history so
/// retrying a failed save never re-analyzes a completed recording.
@MainActor
final class WatchUploadQueue: ObservableObject {
    static let shared = WatchUploadQueue()
    struct Entry: Codable, Identifiable {
        let id: UUID
        let uid: String
        let recordedAt: Date
        let filename: String
        var result: CheckIn?
    }
    @Published private(set) var entries: [Entry] = []
    @Published private(set) var isUploading = false
    @Published private(set) var error: String?
    @Published private(set) var latestResult: CheckIn?
    private let directory: URL

    private init() {
        directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("WatchOutbox", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            var location = directory
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try location.setResourceValues(values)
            if let data = try? Data(contentsOf: directory.appendingPathComponent("queue.json")) {
                entries = try JSONDecoder().decode([Entry].self, from: data)
            }
            purgeExpired()
        } catch { self.error = "Couldn't open saved check-ins. \(error.localizedDescription)" }
    }

    var pendingCount: Int { entries.filter { $0.uid == WatchAuthService.shared.uid }.count }

    func enqueue(_ recording: URL) throws {
        guard let uid = WatchAuthService.shared.uid else { throw SerasonaAPIError.notSignedIn }
        purgeExpired()
        guard pendingCount < 10 else { throw SerasonaAPIError.server("Upload or discard saved check-ins before recording more.") }
        let id = UUID()
        let filename = "\(id.uuidString).m4a"
        let target = directory.appendingPathComponent(filename)
        try FileManager.default.copyItem(at: recording, to: target)
        entries.append(Entry(id: id, uid: uid, recordedAt: Date(), filename: filename))
        do { try persist() } catch {
            entries.removeAll { $0.id == id }
            try? FileManager.default.removeItem(at: target)
            throw error
        }
        try? FileManager.default.removeItem(at: recording)
    }

    func upload() async {
        guard !isUploading, let uid = WatchAuthService.shared.uid else { return }
        isUploading = true
        error = nil
        defer { isUploading = false }
        purgeExpired()
        for entry in entries.filter({ $0.uid == uid }) {
            do {
                guard WatchAuthService.shared.uid == uid else { return }
                var result = entry.result
                if result == nil {
                    let job = try await SerasonaAPI.analyzeAudio(fileURL: directory.appendingPathComponent(entry.filename), model: .pulse)
                    guard job.isDone, !(job.result?.allSignals.isEmpty ?? true) else {
                        throw SerasonaAPIError.server("The recording couldn't be analyzed. Discard it and record again.")
                    }
                    let parsed = CheckIn.from(job: job)
                    result = CheckIn(id: parsed.id, capturedAt: entry.recordedAt, model: parsed.model,
                        signals: parsed.signals, overallLevel: parsed.overallLevel,
                        flaggedCount: parsed.flaggedCount, totalSignals: parsed.totalSignals)
                    guard let index = entries.firstIndex(where: { $0.id == entry.id }), WatchAuthService.shared.uid == uid else { return }
                    entries[index].result = result
                    try persist()
                    try? FileManager.default.removeItem(at: directory.appendingPathComponent(entry.filename))
                }
                guard let result, WatchAuthService.shared.uid == uid else { return }
                try await SerasonaAPI.saveHistory(result)
                guard WatchAuthService.shared.uid == uid else { return }
                SharedStore.recordLatest(state: result.overallState, date: result.capturedAt)
                latestResult = result
                entries.removeAll { $0.id == entry.id }
                try persist()
                try? FileManager.default.removeItem(at: directory.appendingPathComponent(entry.filename))
            } catch {
                if let apiError = error as? SerasonaAPIError, case .notSignedIn = apiError {
                    WatchAuthService.shared.logOut()
                }
                self.error = error.localizedDescription
                return
            }
        }
    }

    func discardAll() {
        for entry in entries { try? FileManager.default.removeItem(at: directory.appendingPathComponent(entry.filename)) }
        entries = []
        latestResult = nil
        try? persist()
    }

    func purgeExpired() {
        let expired = entries.filter { Date().timeIntervalSince($0.recordedAt) >= 24 * 3600 }
        for entry in expired { try? FileManager.default.removeItem(at: directory.appendingPathComponent(entry.filename)) }
        entries.removeAll { Date().timeIntervalSince($0.recordedAt) >= 24 * 3600 }
        try? persist()
    }

    private func persist() throws {
        try JSONEncoder().encode(entries).write(to: directory.appendingPathComponent("queue.json"), options: .atomic)
    }
}
