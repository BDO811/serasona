import Foundation

/// The capture prompt pool, ported from `Serasona_Site/src/lib/i18n.ts`
/// (`question1`…`question9`) so the app asks the same things the web
/// check-in asks.
///
/// Open prompts on purpose. Nothing here can be closed out with a yes or a
/// no: the read needs fifteen to twenty seconds of natural speech, and a
/// question someone can answer in one word produces a clip that fails the
/// speech gate every time.
enum CheckInQuestions {

    /// How many a single check-in asks. Everything downstream derives from
    /// this: the initial draw, the re-ask cursor, the per-question takes,
    /// and the "n of m" readout.
    static let perCheckIn = 2

    static let pool: [String] = [
        "Tell me about your favorite vacation — where you went, what you did, and why it stood out.",
        "Describe your favorite meal — what it is, what it tastes like, and why you love it.",
        "Walk me through what you did today, from when you woke up until now.",
        "Tell me about members of your family: who they are, what they do, and what makes them unique.",
        "Describe a hobby or activity you genuinely enjoy and why it relaxes you.",
        "Tell me about the most memorable trip you've ever taken.",
        "Describe your ideal weekend, from morning to night.",
        "Tell me about a movie or show you recently watched and what you thought of it.",
        "Describe your morning routine, step by step.",
    ]

    /// A fresh shuffle each session, so two check-ins in a row don't open on
    /// the same prompt.
    static func shuffledPool() -> [String] { pool.shuffled() }
}
