import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Uploads one recording to the `analyzeAudio` Cloud Function and returns the
/// finished job. The function itself submits to the Amplifier v2 API and
/// polls until a terminal status before responding, so this is a single POST
/// that can take up to ~4 minutes (see `POLL_TIMEOUT_MS` server-side) — give
/// the URLRequest a generous timeout, not URLSession's 60s default.
public struct AnalyzeAudioClient: Sendable {
    private let transport: HTTPTransport
    private let url: URL

    public init(transport: HTTPTransport = URLSessionTransport(), url: URL = SerasonaEndpoints.analyzeAudio) {
        self.transport = transport
        self.url = url
    }

    public func analyze(audio: Data, filename: String = "checkin.m4a", mimeType: String = "audio/m4a", model: SerasonaModel, idToken: String) async throws -> VoiceJob {
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "model", value: model.rawValue)]

        let boundary = "SerasonaBoundary-\(UUID().uuidString)"
        let body = MultipartFormBuilder.build(
            boundary: boundary,
            fileField: "audio",
            filename: filename,
            mimeType: mimeType,
            fileData: audio,
            textFields: ["recorded_at": ISO8601DateFormatter().string(from: Date())]
        )

        var request = URLRequest(url: components.url!, timeoutInterval: 280)
        request.httpMethod = "POST"
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let (data, response) = try await transport.send(request)
        guard response.statusCode == 200 else {
            let message = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error
            throw SerasonaError.server(status: response.statusCode, message: message ?? "The check-in could not be analyzed.")
        }
        do {
            return try JSONDecoder().decode(VoiceJob.self, from: data)
        } catch {
            throw SerasonaError.decoding(error.localizedDescription)
        }
    }
}

struct ServerErrorBody: Decodable {
    let error: String
}
