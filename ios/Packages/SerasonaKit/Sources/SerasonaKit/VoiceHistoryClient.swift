import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Client for the `voiceHistory` Cloud Function (gcp-functions/voice-history).
/// Ported from src/lib/voice-history-client.ts: both failure modes there
/// resolve rather than throw (history is an enhancement, not the main flow),
/// so this mirrors that by returning an empty list / false instead of
/// propagating a thrown error, except where the caller explicitly opts into
/// `strict` for a UI that needs to show a real error state.
public struct VoiceHistoryClient: Sendable {
    private let transport: HTTPTransport
    private let url: URL

    public init(transport: HTTPTransport = URLSessionTransport(), url: URL = SerasonaEndpoints.voiceHistory) {
        self.transport = transport
        self.url = url
    }

    public func fetchHistory(idToken: String, strict: Bool = false) async throws -> [StoredSession] {
        var request = URLRequest(url: url)
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        do {
            let (data, response) = try await transport.send(request)
            guard response.statusCode == 200 else {
                throw SerasonaError.server(status: response.statusCode, message: "Your readings could not be loaded.")
            }
            return try JSONDecoder().decode(HistoryResponse.self, from: data).sessions
        } catch {
            if strict { throw error }
            return []
        }
    }

    /// Returns false (never throws) on anything but a clean 200, matching the
    /// web client: a 402 means the free-plan one-check-in limit, which the UI
    /// already routes around elsewhere and should not show as an error.
    public func saveSession(_ session: SessionToSave, idToken: String) async -> Bool {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        guard let body = try? JSONEncoder().encode(session) else { return false }
        request.httpBody = body
        guard let (_, response) = try? await transport.send(request) else { return false }
        return response.statusCode == 200
    }
}
