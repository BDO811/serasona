import SwiftUI
import UIKit

extension Color {
    init(light: String, dark: String) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
        })
    }

    init(hex: String) {
        self.init(uiColor: UIColor(hex: hex))
    }
}

private extension UIColor {
    convenience init(hex: String) {
        var value = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        if value.count == 6 { value += "FF" }
        var rgba: UInt64 = 0
        Scanner(string: value).scanHexInt64(&rgba)
        let r = CGFloat((rgba & 0xFF00_0000) >> 24) / 255
        let g = CGFloat((rgba & 0x00FF_0000) >> 16) / 255
        let b = CGFloat((rgba & 0x0000_FF00) >> 8) / 255
        let a = CGFloat(rgba & 0x0000_00FF) / 255
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}

/// Serasona design tokens (Daylight / Dusk), from serasona-design-system/tokens.json.
/// Serasona is its own brand, separate from Amplifier — never substitute the Amplifier palette here.
enum Serasona {

    enum Surface {
        static let canvas = Color(light: "#fbf7f1", dark: "#14110e")
        static let raised = Color(light: "#ffffff", dark: "#1e1a16")
        static let sunken = Color(light: "#f2ebe0", dark: "#0d0b09")
        static let inverse = Color(light: "#1b1510", dark: "#f8f3ed")
        static let emberSoft = Color(light: "#fdece1", dark: "#3a2217")
        static let tideSoft = Color(light: "#e0f0f3", dark: "#0f3239")
        static let scrim = Color(light: "#1b1510b8", dark: "#000000cc")
    }

    enum Border {
        static let hairline = Color(light: "#e8dfd1", dark: "#2c2620")
        static let strong = Color(light: "#94806a", dark: "#756759")
    }

    enum Ink {
        static let strong = Color(light: "#1b1510", dark: "#f8f3ed")
        static let body = Color(light: "#574b3f", dark: "#c3b7aa")
        static let muted = Color(light: "#6f6254", dark: "#9b8f81")
        static let inverse = Color(light: "#fbf7f1", dark: "#14110e")
        static let onEmber = Color(light: "#fffaf5", dark: "#1b1510")
        static let onTide = Color(light: "#ffffff", dark: "#06262b")
    }

    enum Accent {
        static let ember = Color(light: "#c2410c", dark: "#ff8a4c")
        static let emberHover = Color(light: "#a83a0b", dark: "#ff9d68")
        static let emberPress = Color(light: "#8f3109", dark: "#f07a3c")
        static let tide = Color(light: "#0d6a76", dark: "#52cfe0")
        static let tideHover = Color(light: "#0b5a64", dark: "#6fdbea")
    }

    enum Metric {
        static let fatigue = Color(light: "#a94e08", dark: "#f0a33c")
        static let stress = Color(light: "#7b2d5e", dark: "#c76aa0")
        static let hydration = Color(light: "#1d5fa8", dark: "#9ccdff")
        static let fatigueSoft = Color(light: "#f7e9d7", dark: "#30220f")
        static let stressSoft = Color(light: "#f4e4ee", dark: "#2a1422")
        static let hydrationSoft = Color(light: "#e1ecf8", dark: "#11212f")
    }

    enum State {
        static let clear = Accent.tide
        static let watch = Color(light: "#9c5600", dark: "#f2b35e")
        static let strained = Color(light: "#a32020", dark: "#ff8f85")
        static let clearSoft = Surface.tideSoft
        static let watchSoft = Color(light: "#f8ead2", dark: "#332410")
        static let strainedSoft = Color(light: "#f9e2e0", dark: "#35191a")

        enum Band: String {
            case clear = "Clear", watch = "Watch", strained = "Strained"

            var color: Color {
                switch self {
                case .clear: State.clear
                case .watch: State.watch
                case .strained: State.strained
                }
            }

            var soft: Color {
                switch self {
                case .clear: State.clearSoft
                case .watch: State.watchSoft
                case .strained: State.strainedSoft
                }
            }
        }
    }

    enum Waveform {
        static let active = Accent.ember
        static let idle = Color(light: "#d9cdbb", dark: "#4a4036")
    }

    enum Radius {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 18
        static let xl: CGFloat = 28
        static let xxl: CGFloat = 40
        static let full: CGFloat = 9999
    }

    enum Space {
        static let s1: CGFloat = 4
        static let s2: CGFloat = 8
        static let s3: CGFloat = 12
        static let s4: CGFloat = 16
        static let s5: CGFloat = 20
        static let s6: CGFloat = 24
        static let s7: CGFloat = 28
        static let s8: CGFloat = 32
        static let s10: CGFloat = 40
    }
}
