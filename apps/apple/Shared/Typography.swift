import SwiftUI

/// One entry per row in the `type.groups` table in `tokens.json`. `size` and
/// `lineHeight` are the token's px values carried straight over as points.
struct SerasonaTypeStyle {
    let fontName: String
    let size: CGFloat
    let lineHeight: CGFloat
    let tracking: CGFloat
    let uppercase: Bool

    init(_ fontName: String, _ size: CGFloat, _ lineHeight: CGFloat, tracking: CGFloat = 0, uppercase: Bool = false) {
        self.fontName = fontName
        self.size = size
        self.lineHeight = lineHeight
        self.tracking = tracking
        self.uppercase = uppercase
    }

    var font: Font { .custom(fontName, size: size) }
    /// SwiftUI's `lineSpacing` is *extra* space added between lines, on top of
    /// the font's own leading — not a CSS-style absolute line height — so this
    /// is an approximation tuned to roughly match the design system's leading.
    var extraLineSpacing: CGFloat { max(0, lineHeight - size * 1.2) }
}

enum SerasonaType {
    // Display — Bricolage Grotesque
    static let displayXL = SerasonaTypeStyle(SerasonaFontName.bricolageBold, 64, 60, tracking: -0.03 * 64)
    static let displayLG = SerasonaTypeStyle(SerasonaFontName.bricolageBold, 48, 48, tracking: -0.028 * 48)
    static let displayMD = SerasonaTypeStyle(SerasonaFontName.bricolageSemiBold, 36, 40, tracking: -0.022 * 36)
    static let displaySM = SerasonaTypeStyle(SerasonaFontName.bricolageSemiBold, 28, 32, tracking: -0.018 * 28)

    // Score — Bricolage Grotesque, tabular numerals
    static let scoreHero = SerasonaTypeStyle(SerasonaFontName.bricolageBold, 96, 86, tracking: -0.04 * 96)
    static let scoreLG = SerasonaTypeStyle(SerasonaFontName.bricolageBold, 56, 52, tracking: -0.03 * 56)
    static let scoreMD = SerasonaTypeStyle(SerasonaFontName.bricolageSemiBold, 32, 32, tracking: -0.02 * 32)
    static let scoreDelta = SerasonaTypeStyle(SerasonaFontName.bricolageSemiBold, 18, 20, tracking: -0.01 * 18)

    // Text — Hanken Grotesk
    static let titleLG = SerasonaTypeStyle(SerasonaFontName.hankenSemiBold, 22, 28, tracking: -0.01 * 22)
    static let titleMD = SerasonaTypeStyle(SerasonaFontName.hankenSemiBold, 18, 24, tracking: -0.005 * 18)
    static let bodyLG = SerasonaTypeStyle(SerasonaFontName.hankenRegular, 17, 27)
    static let body = SerasonaTypeStyle(SerasonaFontName.hankenRegular, 15, 23)
    static let bodySM = SerasonaTypeStyle(SerasonaFontName.hankenRegular, 13, 20)
    static let label = SerasonaTypeStyle(SerasonaFontName.hankenSemiBold, 13, 16, tracking: 0.01 * 13)
    static let caption = SerasonaTypeStyle(SerasonaFontName.hankenMedium, 12, 16, tracking: 0.005 * 12)
    static let eyebrow = SerasonaTypeStyle(SerasonaFontName.hankenBold, 11, 14, tracking: 0.14 * 11, uppercase: true)

    // Readout — DM Mono, tabular numerals
    static let readoutLG = SerasonaTypeStyle(SerasonaFontName.dmMonoMedium, 20, 24, tracking: 0.01 * 20)
    static let readout = SerasonaTypeStyle(SerasonaFontName.dmMonoRegular, 14, 20, tracking: 0.01 * 14)
    static let readoutSM = SerasonaTypeStyle(SerasonaFontName.dmMonoRegular, 12, 16, tracking: 0.02 * 12)
    static let timer = SerasonaTypeStyle(SerasonaFontName.dmMonoMedium, 15, 20, tracking: 0.08 * 15, uppercase: true)
}

private struct SerasonaStyleModifier: ViewModifier {
    let style: SerasonaTypeStyle
    func body(content: Content) -> some View {
        content
            .font(style.font)
            .tracking(style.tracking)
            .lineSpacing(style.extraLineSpacing)
            .textCase(style.uppercase ? .uppercase : nil)
    }
}

extension View {
    func serasonaStyle(_ style: SerasonaTypeStyle) -> some View {
        modifier(SerasonaStyleModifier(style: style))
    }
}

extension Text {
    /// Applies a style and, for eyebrow-style tokens, uppercases the text.
    func serasonaText(_ style: SerasonaTypeStyle) -> some View {
        self.serasonaStyle(style)
    }
}
