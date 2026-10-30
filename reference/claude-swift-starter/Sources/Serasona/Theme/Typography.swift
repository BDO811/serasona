import SwiftUI

/// Bricolage Grotesque: display headlines and every measured number, never body or labels.
/// Hanken Grotesk: all running copy, labels, controls.
/// DM Mono: timers, readouts, anything that must not reflow.
extension Font {

    private static func bricolage(_ weight: String, _ size: CGFloat) -> Font {
        .custom("BricolageGrotesque-\(weight)", size: size)
    }

    private static func hanken(_ weight: String, _ size: CGFloat) -> Font {
        .custom("HankenGrotesk-\(weight)", size: size)
    }

    private static func mono(_ weight: String, _ size: CGFloat) -> Font {
        .custom("DMMono-\(weight)", size: size)
    }

    // MARK: Display (Bricolage)
    static let serasonaDisplayLG = bricolage("Bold", 40)
    static let serasonaDisplayMD = bricolage("SemiBold", 30)
    static let serasonaDisplaySM = bricolage("SemiBold", 24)

    // MARK: Score (Bricolage, tabular numerals)
    static let serasonaScoreHero = bricolage("Bold", 80)
    static let serasonaScoreLG = bricolage("Bold", 46)
    static let serasonaScoreMD = bricolage("SemiBold", 27)
    static let serasonaScoreDelta = bricolage("SemiBold", 15)

    // MARK: Text (Hanken)
    static let serasonaTitleLG = hanken("SemiBold", 19)
    static let serasonaTitleMD = hanken("SemiBold", 16)
    static let serasonaBodyLG = hanken("Regular", 15)
    static let serasonaBody = hanken("Regular", 13)
    static let serasonaBodySM = hanken("Regular", 12)
    static let serasonaLabel = hanken("SemiBold", 12)
    static let serasonaCaption = hanken("Medium", 11)
    static let serasonaEyebrow = hanken("Bold", 10)

    // MARK: Readout (DM Mono)
    static let serasonaReadoutLG = mono("Medium", 18)
    static let serasonaReadout = mono("Regular", 13)
    static let serasonaReadoutSM = mono("Regular", 11)
    static let serasonaTimer = mono("Medium", 14)
}

extension Text {
    /// Uppercase, wide-tracked eyebrow label. One per card, set in ink-muted.
    func serasonaEyebrowStyle() -> some View {
        self
            .font(.serasonaEyebrow)
            .tracking(1.4)
            .foregroundStyle(Serasona.Ink.muted)
            .textCase(.uppercase)
    }
}
