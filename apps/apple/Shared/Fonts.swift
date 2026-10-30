import SwiftUI

/// PostScript names after `rename_fonts.py` disambiguated the shipped static
/// instances (all three Bricolage weights, and all four Hanken weights,
/// originally shared one colliding PostScript name — see the build notes).
enum SerasonaFontName {
    static let bricolageRegular = "BricolageGrotesque-Regular"
    static let bricolageSemiBold = "BricolageGrotesqueSemiBold-Regular"
    static let bricolageBold = "BricolageGrotesque-Bold"

    static let hankenRegular = "HankenGrotesk-Regular"
    static let hankenMedium = "HankenGroteskMedium-Regular"
    static let hankenSemiBold = "HankenGroteskSemiBold-Regular"
    static let hankenBold = "HankenGrotesk-Bold"

    static let dmMonoRegular = "DMMono-Regular"
    static let dmMonoMedium = "DMMono-Medium"
}

enum SerasonaFontRegistrar {
    /// Registers every bundled TTF with Core Text. Call once at app launch.
    /// Idempotent — registering an already-registered font is a harmless no-op.
    static func registerAll() {
        let names = [
            "Bricolage-400", "Bricolage-650", "Bricolage-700",
            "Hanken-400", "Hanken-500", "Hanken-650", "Hanken-700",
            "DMMono-400", "DMMono-500",
        ]
        for name in names {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf") else {
                assertionFailure("Missing bundled font resource: \(name).ttf")
                continue
            }
            var error: Unmanaged<CFError>?
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error)
        }
    }
}
