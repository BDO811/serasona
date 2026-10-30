import Foundation
import Security

/// A watch-owned Firebase session. Credentials never depend on the paired phone.
@MainActor
final class WatchAuthService: ObservableObject, SerasonaAuthTokenProviding {
    static let shared = WatchAuthService()
    struct Session: Codable {
        var token: String
        var refreshToken: String
        var uid: String
        var email: String
        var expiresAt: Date
    }
    @Published private(set) var isSignedIn = false
    @Published private(set) var email: String?
    private var session: Session?
    private var refreshTask: Task<String, Error>?
    private let service = "com.serasona.watch.session"

    private init() {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service, kSecAttrAccount as String: "firebase",
            kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data, let stored = try? JSONDecoder().decode(Session.self, from: data) {
            session = stored
            email = stored.email
            isSignedIn = true
            SerasonaIdentity.email = stored.email
        }
    }

    private var apiKey: String {
        get throws {
            guard let url = Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist"),
                  let config = NSDictionary(contentsOf: url), let key = config["API_KEY"] as? String else {
                throw SerasonaAPIError.server("The Watch sign-in configuration is missing.")
            }
            return key
        }
    }

    func logIn(email: String, password: String) async throws {
        let key = try apiKey
        var request = URLRequest(url: URL(string: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=\(key)")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "email": email.trimmingCharacters(in: .whitespacesAndNewlines),
            "password": password, "returnSecureToken": true])
        let data = try await perform(request)
        struct Response: Decodable { let idToken, refreshToken, localId, email, expiresIn: String }
        let response = try JSONDecoder().decode(Response.self, from: data)
        let next = Session(token: response.idToken, refreshToken: response.refreshToken,
            uid: response.localId, email: response.email,
            expiresAt: Date().addingTimeInterval(Double(response.expiresIn) ?? 3600))
        if session?.uid != next.uid { SharedStore.clear() }
        try persist(next)
    }

    func idToken() async throws -> String {
        guard let current = session else { throw SerasonaAPIError.notSignedIn }
        if current.expiresAt.timeIntervalSinceNow > 120 { return current.token }
        if let refreshTask { return try await refreshTask.value }
        let task = Task { @MainActor in
            let key = try self.apiKey
            var request = URLRequest(url: URL(string: "https://securetoken.googleapis.com/v1/token?key=\(key)")!)
            request.httpMethod = "POST"
            request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
            var form = URLComponents()
            form.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token"),
                               URLQueryItem(name: "refresh_token", value: current.refreshToken)]
            request.httpBody = form.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B").data(using: .utf8)
            let data = try await self.perform(request)
            struct Response: Decodable { let id_token, refresh_token, user_id, expires_in: String }
            let response = try JSONDecoder().decode(Response.self, from: data)
            guard self.session?.uid == current.uid, !Task.isCancelled else { throw CancellationError() }
            try self.persist(Session(token: response.id_token, refreshToken: response.refresh_token,
                uid: response.user_id, email: current.email,
                expiresAt: Date().addingTimeInterval(Double(response.expires_in) ?? 3600)))
            return response.id_token
        }
        refreshTask = task
        defer { refreshTask = nil }
        return try await task.value
    }

    var uid: String? { session?.uid }

    func logOut() {
        WatchUploadQueue.shared.discardAll()
        refreshTask?.cancel()
        refreshTask = nil
        SecItemDelete([kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service, kSecAttrAccount as String: "firebase"] as CFDictionary)
        session = nil
        isSignedIn = false
        email = nil
        SerasonaIdentity.email = nil
        SharedStore.clear()
    }

    private func persist(_ next: Session) throws {
        let data = try JSONEncoder().encode(next)
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service, kSecAttrAccount as String: "firebase"]
        let attributes: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw SerasonaAPIError.server("Couldn't securely save your sign-in. Try again.") }
        session = next
        email = next.email
        isSignedIn = true
        SerasonaIdentity.email = next.email
    }

    private func perform(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            struct Failure: Decodable { struct Detail: Decodable { let message: String }; let error: Detail }
            let code = (try? JSONDecoder().decode(Failure.self, from: data))?.error.message ?? ""
            if ["USER_DISABLED", "USER_NOT_FOUND", "TOKEN_EXPIRED", "INVALID_REFRESH_TOKEN"].contains(code) {
                logOut()
                throw SerasonaAPIError.notSignedIn
            }
            let message = code == "TOO_MANY_ATTEMPTS_TRY_LATER" ? "Too many attempts. Try again later." : "Sign-in failed. Check your email and password."
            throw SerasonaAPIError.server(message)
        }
        return data
    }
}
