import XCTest
@testable import SerasonaKit

final class FirebaseAuthClientTests: XCTestCase {
    func testSignInSucceedsAndPersistsSession() async throws {
        let transport = FakeTransport()
        transport.responseData = """
        {"localId":"uid-1","email":"a@b.com","idToken":"tok-1","refreshToken":"refresh-1","expiresIn":"3600"}
        """.data(using: .utf8)!
        let store = InMemorySessionStore()
        let client = FirebaseAuthClient(transport: transport, store: store)

        let session = try await client.signIn(email: "a@b.com", password: "hunter2")

        XCTAssertEqual(session.uid, "uid-1")
        XCTAssertEqual(session.idToken, "tok-1")
        XCTAssertEqual(store.load()?.idToken, "tok-1")
        XCTAssertTrue(transport.calls.first?.request.url?.absoluteString.contains("accounts:signInWithPassword") ?? false)
    }

    func testSignInFailureSurfacesHumanizedMessage() async {
        let transport = FakeTransport()
        transport.statusCode = 400
        transport.responseData = """
        {"error":{"code":400,"message":"EMAIL_NOT_FOUND"}}
        """.data(using: .utf8)!
        let client = FirebaseAuthClient(transport: transport, store: InMemorySessionStore())

        do {
            _ = try await client.signIn(email: "nobody@nowhere.com", password: "x")
            XCTFail("expected an error")
        } catch let error as SerasonaError {
            XCTAssertEqual(error.errorDescription, "Incorrect email or password.")
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }

    func testValidIdTokenRefreshesWhenExpired() async throws {
        let expired = AuthSession(uid: "uid-1", email: "a@b.com", idToken: "stale", refreshToken: "refresh-1", expiresAt: Date().addingTimeInterval(-10))
        let store = InMemorySessionStore(expired)
        let transport = FakeTransport()
        transport.responseData = """
        {"user_id":"uid-1","id_token":"fresh","refresh_token":"refresh-2","expires_in":"3600"}
        """.data(using: .utf8)!
        let client = FirebaseAuthClient(transport: transport, store: store)

        let token = try await client.validIdToken()

        XCTAssertEqual(token, "fresh")
        XCTAssertEqual(store.load()?.refreshToken, "refresh-2")
    }

    func testValidIdTokenWithoutSessionThrowsNotSignedIn() async {
        let client = FirebaseAuthClient(transport: FakeTransport(), store: InMemorySessionStore())
        do {
            _ = try await client.validIdToken()
            XCTFail("expected notSignedIn")
        } catch let error as SerasonaError {
            guard case .notSignedIn = error else { return XCTFail("wrong error: \(error)") }
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }
}
