import SwiftUI

enum Band: String {
    case clear = "Clear"
    case watch = "Watch"
    case strained = "Strained"
}

extension Color {
    init(light: String, dark: String) {
        self.init(uiColor: UIColor { trait in
            UIColor(hex: trait.userInterfaceStyle == .dark ? dark : light)
        })
    }

    static let surfaceCanvas = Color(light: "#fbf7f1", dark: "#14110e")
    static let surfaceRaised = Color(light: "#ffffff", dark: "#1e1a16")
    static let surfaceSunken = Color(light: "#f2ebe0", dark: "#0d0b09")
    static let surfaceInverse = Color(light: "#1b1510", dark: "#f8f3ed")
    static let surfaceEmberSoft = Color(light: "#fdece1", dark: "#3a2217")
    static let surfaceTideSoft = Color(light: "#e0f0f3", dark: "#0f3239")

    static let borderHairline = Color(light: "#e8dfd1", dark: "#2c2620")

    static let inkStrong = Color(light: "#1b1510", dark: "#f8f3ed")
    static let inkBody = Color(light: "#574b3f", dark: "#c3b7aa")
    static let inkMuted = Color(light: "#6f6254", dark: "#9b8f81")
    static let inkInverse = Color(light: "#fbf7f1", dark: "#14110e")

    static let ember = Color(light: "#c2410c", dark: "#ff8a4c")
    static let tide = Color(light: "#0d6a76", dark: "#52cfe0")

    static let stateClear = Color.tide
    static let stateWatch = Color(light: "#9c5600", dark: "#f2b35e")
    static let stateStrained = Color(light: "#a32020", dark: "#ff8f85")
    static let stateClearSoft = Color.surfaceTideSoft
    static let stateWatchSoft = Color(light: "#f8ead2", dark: "#332410")
    static let stateStrainedSoft = Color(light: "#f9e2e0", dark: "#35191a")

    static let waveformIdle = Color(light: "#d9cdbb", dark: "#4a4036")

    static func forBand(_ band: Band) -> Color {
        switch band {
        case .clear: return .stateClear
        case .watch: return .stateWatch
        case .strained: return .stateStrained
        }
    }

    static func softForBand(_ band: Band) -> Color {
        switch band {
        case .clear: return .stateClearSoft
        case .watch: return .stateWatchSoft
        case .strained: return .stateStrainedSoft
        }
    }
}

private extension UIColor {
    convenience init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        s.removeAll { $0 == "#" }
        var rgba: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgba)
        let hasAlpha = s.count >= 8
        let r = CGFloat((rgba & (hasAlpha ? 0xFF00_0000 : 0xFF0000)) >> (hasAlpha ? 24 : 16)) / 255
        let g = CGFloat((rgba & (hasAlpha ? 0x00FF_0000 : 0x00FF00)) >> (hasAlpha ? 16 : 8)) / 255
        let b = CGFloat((rgba & (hasAlpha ? 0x0000_FF00 : 0x0000FF)) >> (hasAlpha ? 8 : 0)) / 255
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}

// Type scale. Design system calls for Inter; falls back to the system sans
// (SF Pro) until Inter-Variable is bundled as a resource and registered.
enum SerasonaType {
    static func display(_ size: CGFloat, weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .default)
    }
    static func score(_ size: CGFloat) -> Font {
        .system(size: size, weight: .bold, design: .default).monospacedDigit()
    }
    static let titleLg = Font.system(size: 22, weight: .semibold)
    static let titleMd = Font.system(size: 18, weight: .semibold)
    static let bodyLg = Font.system(size: 17, weight: .regular)
    static let body = Font.system(size: 15, weight: .regular)
    static let bodySm = Font.system(size: 13, weight: .regular)
    static let label = Font.system(size: 13, weight: .semibold)
    static let caption = Font.system(size: 12, weight: .medium)
    static let eyebrow = Font.system(size: 11, weight: .bold)
    static let timer = Font.system(size: 15, weight: .medium, design: .monospaced)
}

enum SerasonaRadius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 18
    static let xl: CGFloat = 28
    static let xxl: CGFloat = 40
}
