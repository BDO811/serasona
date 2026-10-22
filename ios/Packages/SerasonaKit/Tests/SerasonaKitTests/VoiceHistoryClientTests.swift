import XCTest
@testable import SerasonaKit

final class VoiceHistoryClientTests: XCTestCase {
    func testFetchHistoryDecodesSessions() async throws {
        let transport = FakeTransport()
        transport.responseData = """
        {"sessions":[{"sessionId":"s1","capturedAt":1000,"source":"ios","status":"complete","model":"pulse","pathway":null,"signals":[],"summary":null}]}
        """.data(using: .utf8)!
        let client = VoiceHistoryClient(transport: transport)

        let sessions = try await client.fetchHistory(idToken: "tok")

        XCTAssertEqual(sessions.count, 1)
        XCTAssertEqual(sessions.first?.sessionID, "s1")
    }

    func testFetchHistoryNonStrictSwallowsFailure() async throws {
        let transport = FakeTransport()
        transport.statusCode = 500
        let client = VoiceHistoryClient(transport: transport)

        let sessions = try await client.fetchHistory(idToken: "tok", strict: false)

        XCTAssertEqual(sessions, [])
    }

    func testFetchHistoryStrictPropagatesFailure() async {
        let transport = FakeTransport()
        transport.statusCode = 500
        let client = VoiceHistoryClient(transport: transport)

        do {
            _ = try await client.fetchHistory(idToken: "tok", strict: true)
            XCTFail("expected an error")
        } catch {
            // expected
        }
    }

    func testSaveSessionReturnsFalseOnFreeLimitWithoutThrowing() async {
        let transport = FakeTransport()
        transport.statusCode = 402
        let client = VoiceHistoryClient(transport: transport)
        let toSave = SessionToSave(jobID: "job-1", model: "pulse", signals: [], summary: nil)

        let saved = await client.saveSession(toSave, idToken: "tok")

        XCTAssertFalse(saved)
    }

    func testSaveSessionReturnsTrueOn200() async {
        let transport = FakeTransport()
        transport.statusCode = 200
        let client = VoiceHistoryClient(transport: transport)
        let toSave = SessionToSave(jobID: "job-1", model: "pulse", signals: [], summary: nil)

        let saved = await client.saveSession(toSave, idToken: "tok")

        XCTAssertTrue(saved)
    }
}
