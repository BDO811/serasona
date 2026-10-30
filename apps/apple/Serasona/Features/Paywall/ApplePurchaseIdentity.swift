import CryptoKit
import Foundation
import FirebaseAuth

enum ApplePurchaseIdentity {
    /// Same opaque UUID as the backend's accountToken(uid). No email or
    /// plaintext Firebase identifier is passed to Apple.
    static func token() throws -> UUID {
        guard let uid = Auth.auth().currentUser?.uid else { throw SerasonaAPIError.notSignedIn }
        var bytes = Array(SHA256.hash(data: Data("com.serasona.app.account:\(uid)".utf8)).prefix(16))
        bytes[6] = (bytes[6] & 0x0f) | 0x80
        bytes[8] = (bytes[8] & 0x3f) | 0x80
        let hex = bytes.map { String(format: "%02x", $0) }.joined()
        let parts = [hex.prefix(8), hex.dropFirst(8).prefix(4), hex.dropFirst(12).prefix(4),
                     hex.dropFirst(16).prefix(4), hex.dropFirst(20).prefix(12)]
        guard let token = UUID(uuidString: parts.map(String.init).joined(separator: "-")) else {
            throw SerasonaAPIError.server("Couldn't identify your purchase account.")
        }
        return token
    }
}
