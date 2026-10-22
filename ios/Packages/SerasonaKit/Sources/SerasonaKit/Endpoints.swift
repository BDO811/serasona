import Foundation

/// Live endpoints for the Serasona backend (BDO811/serasona, Firebase project
/// `amits-playground-po`). The Firebase web API key is not a secret — Firebase
/// documents that it only identifies the project, never grants access on its
/// own — and is already public in the deployed web bundle at serasona.com, so
/// shipping it here does not open anything the web app does not already.
public enum SerasonaEndpoints {
    public static let firebaseAPIKey = "AIzaSyCKySJYqydO97YOJyllmvSC6rH3maIrUCg"
    public static let firebaseProjectID = "amits-playground-po"
    public static let firebaseAuthDomain = "amits-playground-po.firebaseapp.com"

    public static let identityToolkitBase = URL(string: "https://identitytoolkit.googleapis.com/v1")!
    public static let secureTokenBase = URL(string: "https://securetoken.googleapis.com/v1")!

    public static let analyzeAudio = URL(string: "https://us-central1-amits-playground-po.cloudfunctions.net/analyzeAudio")!
    public static let voiceHistory = URL(string: "https://us-central1-amits-playground-po.cloudfunctions.net/voiceHistory")!
    public static let recommendations = URL(string: "https://us-central1-amits-playground-po.cloudfunctions.net/recommendations")!
}
