import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// A signed-in session. `idToken` is the short-lived (1h) Firebase JWT the
/// Cloud Functions verify via `admin.auth().verifyIdToken`; `refreshToken`
/// exchanges for a new one once it expires.
public struct AuthSession: Codable, Sendable, Equatable {
    public let uid: String
    public let email: String
    public let idToken: String
    public let refreshToken: String
    public let expiresAt: Date

    public var isExpired: Bool { Date() >= expiresAt.addingTimeInterval(-60) }

    public init(uid: String, email: String, idToken: String, refreshToken: String, expiresAt: Date) {
        self.uid = uid
        self.email = email
        self.idToken = idToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
    }
}

/// Persists the session between launches. The app target supplies a
/// Keychain-backed implementation; tests use an in-memory one, since Security
/// isn't available when this package is exercised with `swift test` on Linux.
public protocol SessionStore: Sendable {
    func load() -> AuthSession?
    func save(_ session: AuthSession?)
}

public final class InMemorySessionStore: SessionStore, @unchecked Sendable {
    private var session: AuthSession?
    public init(_ session: AuthSession? = nil) { self.session = session }
    public func load() -> AuthSession? { session }
    public func save(_ session: AuthSession?) { self.session = session }
}

/// Talks to Firebase's Identity Toolkit REST API directly — the same calls
/// the Firebase web SDK makes under the hood for email/password auth — rather
/// than depending on the full firebase-ios-sdk. That keeps this package
/// buildable and testable on Linux and keeps the app's dependency graph small.
/// Reference: https://firebase.google.com/docs/reference/rest/auth
public actor FirebaseAuthClient {
    private let apiKey: String
    private let transport: HTTPTransport
    private let store: SessionStore
    private var current: AuthSession?

    public init(apiKey: String = SerasonaEndpoints.firebaseAPIKey, transport: HTTPTransport = URLSessionTransport(), store: SessionStore) {
        self.apiKey = apiKey
        self.transport = transport
        self.store = store
        self.current = store.load()
    }

    public var currentSession: AuthSession? { current }

    private struct SignUpOrInBody: Encodable {
        let email: String
        let password: String
        let returnSecureToken = true
    }

    private struct IdentityToolkitResponse: Decodable {
        let localId: String
        let email: String
        let idToken: String
        let refreshToken: String
        let expiresIn: String
    }

    private func call(path: String, body: Encodable) async throws -> AuthSession {
        var url = SerasonaEndpoints.identityToolkitBase.appendingPathComponent(path)
        url = URL(string: url.absoluteString + "?key=\(apiKey)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(AnyEncodable(body))

        let (data, response) = try await transport.send(request)
        guard response.statusCode == 200 else {
            let message = (try? JSONDecoder().decode(IdentityToolkitErrorBody.self, from: data))?.error.message
            throw SerasonaError.server(status: response.statusCode, message: Self.humanize(message))
        }
        let decoded = try decode(IdentityToolkitResponse.self, from: data)
        let expiresIn = TimeInterval(decoded.expiresIn) ?? 3600
        let session = AuthSession(
            uid: decoded.localId,
            email: decoded.email,
            idToken: decoded.idToken,
            refreshToken: decoded.refreshToken,
            expiresAt: Date().addingTimeInterval(expiresIn)
        )
        current = session
        store.save(session)
        return session
    }

    public func signUp(email: String, password: String) async throws -> AuthSession {
        try await call(path: "accounts:signUp", body: SignUpOrInBody(email: email, password: password))
    }

    public func signIn(email: String, password: String) async throws -> AuthSession {
        try await call(path: "accounts:signInWithPassword", body: SignUpOrInBody(email: email, password: password))
    }

    public func signOut() {
        current = nil
        store.save(nil)
    }

    private struct RefreshResponse: Decodable {
        let user_id: String
        let id_token: String
        let refresh_token: String
        let expires_in: String
    }

    /// Exchanges a refresh token for a new idToken. Called automatically by
    /// `validIdToken()` once the current one is within 60s of expiring.
    public func refresh() async throws -> AuthSession {
        guard let existing = current else { throw SerasonaError.notSignedIn }
        var url = SerasonaEndpoints.secureTokenBase.appendingPathComponent("token")
        url = URL(string: url.absoluteString + "?key=\(apiKey)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = "grant_type=refresh_token&refresh_token=\(existing.refreshToken)".data(using: .utf8)

        let (data, response) = try await transport.send(request)
        guard response.statusCode == 200 else {
            throw SerasonaError.server(status: response.statusCode, message: "Your session expired. Sign in again.")
        }
        let decoded = try decode(RefreshResponse.self, from: data)
        let expiresIn = TimeInterval(decoded.expires_in) ?? 3600
        let session = AuthSession(
            uid: decoded.user_id,
            email: existing.email,
            idToken: decoded.id_token,
            refreshToken: decoded.refresh_token,
            expiresAt: Date().addingTimeInterval(expiresIn)
        )
        current = session
        store.save(session)
        return session
    }

    /// The token every SerasonaKit API client should call before a request:
    /// refreshes automatically if the cached one is about to expire.
    public func validIdToken() async throws -> String {
        guard let session = current else { throw SerasonaError.notSignedIn }
        if session.isExpired {
            return try await refresh().idToken
        }
        return session.idToken
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw SerasonaError.decoding(error.localizedDescription)
        }
    }

    /// Firebase's REST error codes are machine words (EMAIL_EXISTS,
    /// INVALID_LOGIN_CREDENTIALS, WEAK_PASSWORD, ...); map the common ones to
    /// copy a person can act on rather than showing the code verbatim.
    private static func humanize(_ code: String?) -> String? {
        switch code {
        case "EMAIL_EXISTS": return "An account already exists for that email."
        case "EMAIL_NOT_FOUND", "INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD":
            return "Incorrect email or password."
        case "WEAK_PASSWORD : Password should be at least 6 characters":
            return "Choose a password with at least 6 characters."
        case .some(let other) where other.hasPrefix("WEAK_PASSWORD"):
            return "Choose a password with at least 6 characters."
        case "USER_DISABLED": return "This account has been disabled."
        case .some(let other): return other
        case nil: return nil
        }
    }
}

private struct IdentityToolkitErrorBody: Decodable {
    struct Err: Decodable { let message: String }
    let error: Err
}

/// Type-erasing box so `call(path:body:)` can accept any Encodable body.
private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void
    init(_ wrapped: Encodable) { encodeClosure = wrapped.encode }
    func encode(to encoder: Encoder) throws { try encodeClosure(encoder) }
}
