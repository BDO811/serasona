import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
@testable import SerasonaKit

final class FakeTransport: HTTPTransport, @unchecked Sendable {
    struct Call { let request: URLRequest }
    var calls: [Call] = []
    var statusCode: Int = 200
    var responseData: Data = Data()

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        calls.append(Call(request: request))
        let response = HTTPURLResponse(url: request.url!, statusCode: statusCode, httpVersion: nil, headerFields: nil)!
        return (responseData, response)
    }
}
