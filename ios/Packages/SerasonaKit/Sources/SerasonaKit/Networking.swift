import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Thin seam over URLSession so tests can inject a fake transport instead of
/// hitting the network. Every SerasonaKit client takes one of these rather
/// than calling URLSession.shared directly.
public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

public struct URLSessionTransport: HTTPTransport {
    public init() {}

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw SerasonaError.network("No HTTP response")
        }
        return (data, http)
    }
}

public enum SerasonaError: Error, LocalizedError, Sendable {
    case network(String)
    case server(status: Int, message: String?)
    case decoding(String)
    case notSignedIn

    public var errorDescription: String? {
        switch self {
        case .network(let message): return message
        case .server(let status, let message): return message ?? "Request failed (\(status))."
        case .decoding(let message): return "Could not read the server's response: \(message)"
        case .notSignedIn: return "Sign in to continue."
        }
    }
}

/// Builds a single-part `multipart/form-data` body: one file field plus any
/// number of plain text fields. Matches what `gcp-functions/analyze-audio`
/// parses with busboy (see `parseMultipartAudio`).
enum MultipartFormBuilder {
    static func build(boundary: String, fileField: String, filename: String, mimeType: String, fileData: Data, textFields: [String: String]) -> Data {
        var body = Data()
        func append(_ string: String) { body.append(string.data(using: .utf8)!) }

        for (name, value) in textFields {
            append("--\(boundary)\r\n")
            append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
            append("\(value)\r\n")
        }

        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"\(fileField)\"; filename=\"\(filename)\"\r\n")
        append("Content-Type: \(mimeType)\r\n\r\n")
        body.append(fileData)
        append("\r\n--\(boundary)--\r\n")
        return body
    }
}
