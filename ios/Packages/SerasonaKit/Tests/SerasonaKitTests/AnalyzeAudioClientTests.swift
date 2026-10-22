import XCTest
@testable import SerasonaKit

final class AnalyzeAudioClientTests: XCTestCase {
    func testRequestCarriesBearerTokenAndModelQueryParam() async throws {
        let transport = FakeTransport()
        transport.responseData = """
        {"job_id":"job-1","status":"done","result":{"summary":{"overall_level":"none"}}}
        """.data(using: .utf8)!
        let client = AnalyzeAudioClient(transport: transport)

        let job = try await client.analyze(audio: Data([0x01, 0x02]), model: .haven, idToken: "tok-1")

        XCTAssertEqual(job.jobID, "job-1")
        let request = transport.calls.first!.request
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer tok-1")
        XCTAssertTrue(request.url!.query!.contains("model=haven"))
        XCTAssertEqual(request.httpMethod, "POST")
    }

    func testMultipartBodyContainsAudioFieldAndFileBytes() async throws {
        let transport = FakeTransport()
        transport.responseData = "{}".data(using: .utf8)!
        let client = AnalyzeAudioClient(transport: transport)
        let audioBytes = Data([0xDE, 0xAD, 0xBE, 0xEF])

        _ = try? await client.analyze(audio: audioBytes, model: .pulse, idToken: "tok")

        let body = transport.calls.first!.request.httpBody!
        XCTAssertTrue(body.contains(audioBytes))
        let bodyString = String(data: body, encoding: .isoLatin1)!
        XCTAssertTrue(bodyString.contains("name=\"audio\""))
        XCTAssertTrue(bodyString.contains("Content-Type: audio/m4a"))
    }

    func testNonTwoHundredStatusThrowsServerError() async {
        let transport = FakeTransport()
        transport.statusCode = 502
        transport.responseData = """
        {"error":"Something went wrong."}
        """.data(using: .utf8)!
        let client = AnalyzeAudioClient(transport: transport)

        do {
            _ = try await client.analyze(audio: Data(), model: .pulse, idToken: "tok")
            XCTFail("expected an error")
        } catch let error as SerasonaError {
            guard case .server(let status, _) = error else { return XCTFail("wrong case") }
            XCTAssertEqual(status, 502)
        } catch {
            XCTFail("wrong error type")
        }
    }
}

private extension Data {
    func contains(_ subdata: Data) -> Bool {
        guard !subdata.isEmpty, count >= subdata.count else { return false }
        for i in 0...(count - subdata.count) {
            if self[self.startIndex.advanced(by: i)..<self.startIndex.advanced(by: i + subdata.count)].elementsEqual(subdata) {
                return true
            }
        }
        return false
    }
}
