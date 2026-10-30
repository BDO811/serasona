import Foundation

enum SerasonaAPIError: Error, LocalizedError {
    case badResponse(Int)
    case decoding(Error)
    case timedOut
    case noIdentity
    case notSignedIn
    case freeCheckInUsed
    case server(String)

    var errorDescription: String? {
        switch self {
        case .badResponse(let code): return "The server returned an unexpected response (\(code))."
        case .decoding: return "Couldn't read the server's response."
        case .timedOut: return "That took too long. Try again on a better connection."
        case .noIdentity: return "Add an email in Settings before saving check-ins."
        case .notSignedIn: return "Sign in to Serasona on this device, then try again."
        case .freeCheckInUsed: return "You've used today's free check-ins. Try tomorrow or upgrade for unlimited check-ins."
        case .server(let message): return message
        }
    }
}

/// Mints the `Authorization: Bearer` token every gated call needs. The iOS app
/// sets this to a live `FirebaseAuthService`-backed provider at launch; the
/// watch targets never override it, so they fall back to whatever the phone
/// most recently synced into the shared App Group (see `AuthTokenCache`).
protocol SerasonaAuthTokenProviding {
    func idToken() async throws -> String
}

struct CachedAuthTokenProvider: SerasonaAuthTokenProviding {
    func idToken() async throws -> String {
        guard let token = AuthTokenCache.cachedToken else { throw SerasonaAPIError.notSignedIn }
        return token
    }
}

/// Endpoints match `Serasona_App/.env` / `src/lib/*-client.ts` exactly —
/// see `gcp-functions/{analyze-audio,voice-history,recommendations}` for the
/// server side of each contract.
enum SerasonaAPIEndpoint {
    static let analyzeAudio = URL(string: "https://us-central1-amits-playground-po.cloudfunctions.net/analyzeAudio")!
    static let voiceHistory = URL(string: "https://us-central1-amits-playground-po.cloudfunctions.net/voiceHistory")!
    static let recommendations = URL(string: "https://us-central1-amits-playground-po.cloudfunctions.net/recommendations")!
    static let appleIapVerify = URL(string: "https://us-central1-amits-playground-po.cloudfunctions.net/appleIapVerify")!
}

struct RecommendationSign: Encodable {
    let label: String
    let band: String
}

enum SerasonaAPI {

    /// Set once at launch — a live Firebase-backed provider on iOS, the shared
    /// App Group cache everywhere else. See `SerasonaAuthTokenProviding`.
    static var tokenProvider: SerasonaAuthTokenProviding = CachedAuthTokenProvider()

    /// Maps a non-2xx response to a `SerasonaAPIError`, preferring the
    /// server's own `{ "error": "..." }` body (every gated endpoint here
    /// returns one) over a bare status code.
    private static func apiError(status: Int, data: Data) -> SerasonaAPIError {
        struct ServerError: Decodable { let error: String? }
        let message = (try? JSONDecoder().decode(ServerError.self, from: data))?.error
        switch status {
        case 401: return .notSignedIn
        case 402: return .freeCheckInUsed
        default: return message.map(SerasonaAPIError.server) ?? .badResponse(status)
        }
    }

    // MARK: - analyzeAudio

    /// Uploads a recorded check-in and returns the completed job. The Cloud
    /// Function itself polls `/v2/jobs/{id}` server-side and only returns once
    /// the job is terminal, so this is a single request/response, not a poll
    /// loop on the client. Requires a signed-in identity — `analyzeAudio`
    /// spends real model credits and has no anonymous path.
    static func analyzeAudio(fileURL: URL, model: SerasonaModel) async throws -> V2JobDetail {
        let idToken = try await tokenProvider.idToken()

        var request = URLRequest(url: SerasonaAPIEndpoint.analyzeAudio.appending(queryItems: [
            URLQueryItem(name: "model", value: model.rawValue)
        ]))
        request.httpMethod = "POST"
        request.timeoutInterval = 260 // the function itself budgets 240s for polling
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")

        let boundary = "SerasonaBoundary-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        let audioData = try Data(contentsOf: fileURL)
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"audio\"; filename=\"checkin.m4a\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/m4a\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        let (data, response) = try await URLSession.shared.upload(for: request, from: body)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw apiError(status: code, data: data)
        }
        do {
            return try JSONDecoder().decode(V2JobDetail.self, from: data)
        } catch {
            throw SerasonaAPIError.decoding(error)
        }
    }

    // MARK: - voiceHistory

    /// Saves a completed check-in to the signed-in identity's history.
    /// A valid `Authorization` token always wins server-side over the `email`
    /// field below — it's sent along only as a harmless fallback/debug aid.
    static func saveHistory(_ checkIn: CheckIn, pathway: String = "WELLNESS") async throws {
        let idToken = try await tokenProvider.idToken()

        var request = URLRequest(url: SerasonaAPIEndpoint.voiceHistory)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")

        let payload: [String: Any] = [
            "jobId": checkIn.id,
            "email": SerasonaIdentity.email ?? "",
            "model": checkIn.model,
            "pathway": pathway,
            "capturedAt": checkIn.capturedAt.timeIntervalSince1970 * 1000,
            "signals": checkIn.signals.map { signal -> [String: Any] in
                [
                    "name": signal.name,
                    "label": signal.displayName,
                    "score": signal.score,
                    "level": signal.level,
                    "flagged": signal.band.isFlagged,
                ]
            },
            "summary": [
                "overallLevel": checkIn.overallLevel ?? "",
                "flaggedCount": checkIn.flaggedCount,
                "totalSignals": checkIn.totalSignals,
            ],
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw apiError(status: (response as? HTTPURLResponse)?.statusCode ?? -1, data: data)
        }
    }

    /// Erases every saved check-in belonging to the signed-in identity.
    ///
    /// Account deletion must not continue until server-side erasure succeeds.
    /// Missing routes and unsuccessful responses throw, retaining a usable
    /// account credential so deletion can be retried after the service recovers.
    @discardableResult
    static func deleteHistory() async throws -> Bool {
        let idToken = try await tokenProvider.idToken()

        var components = URLComponents(url: SerasonaAPIEndpoint.voiceHistory, resolvingAgainstBaseURL: false)!
        if let email = SerasonaIdentity.email, !email.isEmpty {
            components.queryItems = [URLQueryItem(name: "email", value: email)]
        }

        var request = URLRequest(url: components.url!)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? -1
        if (200...299).contains(status) { return true }
        throw apiError(status: status, data: data)
    }

    /// Fetches this identity's saved check-ins, oldest first (server-sorted).
    static func fetchHistory() async throws -> [CheckIn] {
        let idToken = try await tokenProvider.idToken()

        var components = URLComponents(url: SerasonaAPIEndpoint.voiceHistory, resolvingAgainstBaseURL: false)!
        if let email = SerasonaIdentity.email, !email.isEmpty {
            components.queryItems = [URLQueryItem(name: "email", value: email)]
        }

        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw apiError(status: (response as? HTTPURLResponse)?.statusCode ?? -1, data: data)
        }

        struct HistoryResponse: Decodable {
            struct Session: Decodable {
                let sessionId: String
                let capturedAt: Double
                let model: String?
                struct Signal: Decodable { let name: String; let label: String?; let score: Double; let level: String?; let flagged: Bool }
                let signals: [Signal]
                struct Summary: Decodable { let overallLevel: String?; let flaggedCount: Int?; let totalSignals: Int? }
                let summary: Summary?
            }
            let sessions: [Session]
        }

        let decoded = try JSONDecoder().decode(HistoryResponse.self, from: data)
        return decoded.sessions.map { session in
            let signals = session.signals.map {
                V2Signal(name: $0.name, label: $0.label, score: $0.score, level: $0.level ?? "inconclusive", flagged: $0.flagged, recommendedAction: nil, description: nil)
            }
            return CheckIn(
                id: session.sessionId,
                capturedAt: Date(timeIntervalSince1970: session.capturedAt / 1000),
                model: session.model ?? "pulse",
                signals: signals,
                overallLevel: session.summary?.overallLevel,
                flaggedCount: session.summary?.flaggedCount ?? signals.filter(\.band.isFlagged).count,
                totalSignals: session.summary?.totalSignals ?? signals.count
            )
        }
    }

    // MARK: - recommendations

    /// Written suggestions for the signals that landed outside NORMAL.
    /// Returns "" when nothing was actionable — mirrors the function's own
    /// `{ text: "", signs: 0 }` response for an all-clear result.
    static func recommendations(assessment: String, signals: [V2Signal]) async throws -> String {
        let actionable = signals
            .map { ($0, SignalBand.band(name: $0.name, level: $0.level)) }
            .filter { $0.1.isFlagged }
            .map { RecommendationSign(label: SignalBand.displayName(name: $0.0.name, apiLabel: $0.0.label), band: SignalBand.label(name: $0.0.name, band: $0.1)) }

        if actionable.isEmpty { return "" }

        var request = URLRequest(url: SerasonaAPIEndpoint.recommendations)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        struct Payload: Encodable { let assessment: String; let signs: [RecommendationSign] }
        request.httpBody = try JSONEncoder().encode(Payload(assessment: assessment, signs: actionable))

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw SerasonaAPIError.badResponse((response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        struct RecommendationsResponse: Decodable { let text: String }
        return try JSONDecoder().decode(RecommendationsResponse.self, from: data).text
    }

    // MARK: - appleIapVerify

    /// Redeems a just-purchased StoreKit transaction: the server verifies the
    /// JWS against Apple's own signature (no receipt-sharing, no secrets) and
    /// writes the same `users/{uid}.subscription` field `stripe-webhook`
    /// writes for web purchases. `environment` is whatever
    /// `StoreKit.Transaction.environment` reported on the transaction itself
    /// ("Xcode", "Sandbox", or "Production").
    static func redeemAppleTransaction(signedTransactionInfo: String, environment: String) async throws {
        let idToken = try await tokenProvider.idToken()

        var request = URLRequest(url: SerasonaAPIEndpoint.appleIapVerify)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        struct Payload: Encodable { let signedTransactionInfo: String; let environment: String }
        request.httpBody = try JSONEncoder().encode(Payload(signedTransactionInfo: signedTransactionInfo, environment: environment))

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw apiError(status: (response as? HTTPURLResponse)?.statusCode ?? -1, data: data)
        }
    }
}
