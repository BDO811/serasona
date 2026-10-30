import AVFoundation
import Foundation

/// Joins the takes from a multi-question check-in into the single file the
/// analyze endpoint expects.
///
/// This cannot be done by appending the bytes. Each take is an encoded
/// `.m4a` container with its own header and index; two of them end to end
/// is not one longer recording, it is one playable recording followed by
/// garbage. The web flow has the same problem and solves it the same way,
/// by decoding each take and merging the samples rather than the files.
enum TakeMerger {

    enum MergeError: Error, LocalizedError {
        case noTakes
        case noAudioTrack
        case exportFailed(String)

        var errorDescription: String? {
            switch self {
            case .noTakes: return "No recordings to send."
            case .noAudioTrack: return "One of the recordings had no audio in it."
            case .exportFailed(let reason): return "Couldn't prepare the recording: \(reason)"
            }
        }
    }

    /// Returns a single `.m4a` in the temporary directory. A single take is
    /// handed straight back rather than round-tripped through an export
    /// that would only re-encode it.
    static func merge(_ urls: [URL]) async throws -> URL {
        guard let first = urls.first else { throw MergeError.noTakes }
        guard urls.count > 1 else { return first }

        let composition = AVMutableComposition()
        guard let track = composition.addMutableTrack(
            withMediaType: .audio,
            preferredTrackID: kCMPersistentTrackID_Invalid
        ) else {
            throw MergeError.noAudioTrack
        }

        var cursor = CMTime.zero
        for url in urls {
            let asset = AVURLAsset(url: url)
            guard let source = try await asset.loadTracks(withMediaType: .audio).first else {
                throw MergeError.noAudioTrack
            }
            let duration = try await asset.load(.duration)
            try track.insertTimeRange(
                CMTimeRange(start: .zero, duration: duration),
                of: source,
                at: cursor
            )
            cursor = CMTimeAdd(cursor, duration)
        }

        let output = FileManager.default.temporaryDirectory
            .appendingPathComponent("checkin-\(UUID().uuidString).m4a")

        guard let session = AVAssetExportSession(
            asset: composition,
            presetName: AVAssetExportPresetAppleM4A
        ) else {
            throw MergeError.exportFailed("no exporter available")
        }
        session.outputURL = output
        session.outputFileType = .m4a

        await session.export()

        guard session.status == .completed else {
            throw MergeError.exportFailed(session.error?.localizedDescription ?? "export did not complete")
        }

        // The individual takes are no use once they're merged, and a check-in
        // is voice: leaving copies in the temporary directory is leaving
        // someone's recording on disk for no reason.
        for url in urls { try? FileManager.default.removeItem(at: url) }

        return output
    }
}
