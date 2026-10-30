import SwiftUI

/// Proportional bands match the website's 34, 67, and 90 cutoffs.
struct ScorePositionScale: View {
    let value: Int?
    private let segments: [(AssessmentRung, CGFloat)] = [(.optimal, 10), (.strong, 23), (.medium, 33), (.low, 34)]

    var body: some View {
        HStack(spacing: 5) {
            VStack(alignment: .trailing) {
                Text("100")
                Spacer(minLength: 0)
                Text("50")
                Spacer(minLength: 0)
                Text("0")
            }
            .font(.system(size: 10, weight: .medium, design: .monospaced))
            .foregroundStyle(SerasonaColor.inkMuted)
            GeometryReader { geometry in
                ZStack(alignment: .top) {
                    VStack(spacing: 0) {
                        ForEach(segments, id: \.0) { rung, weight in
                            rung.color.frame(height: geometry.size.height * weight / 100)
                        }
                    }
                    .clipShape(Capsule())
                    if let value {
                        Circle()
                            .fill(SerasonaColor.surfaceCanvas)
                            .overlay(Circle().stroke(SerasonaColor.inkStrong, lineWidth: 2))
                            .frame(width: 14, height: 14)
                            .position(x: 5, y: max(7, min(geometry.size.height - 7, geometry.size.height * (1 - CGFloat(min(100, max(0, value))) / 100))))
                    }
                }
            }
            .frame(width: 10)
        }
        .frame(width: 36)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(value.map { "\($0) out of 100. \(AssessmentRung.of($0).label)" } ?? "0 to 100 scale. No reading")
    }
}
