import SwiftUI

// Serasona design tokens: Bone and Signal. Shared by the iPhone and Watch targets.
// Bundle Bricolage Grotesque, Hanken Grotesk and DM Mono, and list them in Info.plist under UIAppFonts.

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

enum Serasona {
    enum Bone {
        static let b50 = Color(hex: 0xFAF8F4)
        static let b100 = Color(hex: 0xF2EFE9)
        static let b200 = Color(hex: 0xE8E4DA)
        static let b300 = Color(hex: 0xDDD8CE)
        static let b400 = Color(hex: 0xB9B3A6)
        static let b500 = Color(hex: 0x8F897D)
        static let b600 = Color(hex: 0x6B675F)
        static let b700 = Color(hex: 0x4A4741)
        static let b800 = Color(hex: 0x2B2926)
        static let b900 = Color(hex: 0x111111)
    }

    // Compatibility names only. Green was retired by Amit.
    enum Green {
        static let g100 = Bone.b200
        static let g300 = Bone.b400
        static let g500 = Bone.b900
        static let g700 = Bone.b900
    }

    enum Blue {
        static let b100 = Color(hex: 0xDCE5FB)
        static let b300 = Color(hex: 0x8FA9F5)
        static let b500 = Color(hex: 0x2F5BEA)
        static let b600 = Color(hex: 0x2347C2)
        static let b700 = Color(hex: 0x1E3A8A)
    }

    enum Red {
        static let r100 = Color(hex: 0xF8D8D6)
        static let r300 = Color(hex: 0xEE8E8A)
        static let r500 = Color(hex: 0xD12B26)
        static let r600 = Color(hex: 0xA8201C)
        static let r700 = Color(hex: 0x7F1D1D)
    }

    // Semantic, iPhone (light Bone theme)
    enum Theme {
        static let ground = Bone.b100
        static let surface = Color.white
        static let sunken = Bone.b200
        static let textPrimary = Bone.b900
        static let textMuted = Bone.b600
        static let border = Bone.b300
        static let actionPrimary = Bone.b900
        static let focus = Blue.b500
        static let steady = Green.g500
        static let info = Blue.b500
        static let alert = Red.r500
    }

    // Semantic, Watch (OLED theme): black ground, 300 steps for rings
    enum WatchTheme {
        static let ground = Color.black
        static let surface = Bone.b800
        static let textPrimary = Bone.b100
        static let textMuted = Bone.b400
        static let actionFill = Bone.b100
        static let actionText = Bone.b900
        static let steady = Bone.b100
        static let info = Blue.b300
        static let alert = Red.r300
    }

    enum Spacing {
        static let s1: CGFloat = 4, s2: CGFloat = 8, s3: CGFloat = 12, s4: CGFloat = 16
        static let s5: CGFloat = 24, s6: CGFloat = 32, s7: CGFloat = 48
    }

    enum Radius {
        static let sm: CGFloat = 6, md: CGFloat = 12, lg: CGFloat = 20, xl: CGFloat = 28
    }

    enum Font {
        static func display(_ size: CGFloat) -> SwiftUI.Font { .custom("BricolageGrotesque-Bold", size: size) }
        static func body(_ size: CGFloat, weight: SwiftUI.Font.Weight = .regular) -> SwiftUI.Font {
            .custom("HankenGrotesk-Regular", size: size).weight(weight)
        }
        static func mono(_ size: CGFloat) -> SwiftUI.Font { .custom("DMMono-Medium", size: size) }
    }
}

// Score ring used on iPhone and Watch. Pair the color with a word, never color alone.
struct ScoreRing: View {
    let score: Int
    let color: Color
    var track: Color = Serasona.Bone.b200
    var lineWidth: CGFloat = 10

    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: CGFloat(score) / 100)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.6), value: score)
            Text("\(score)")
                .font(Serasona.Font.display(34))
                .monospacedDigit()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Score \(score)")
    }
}
