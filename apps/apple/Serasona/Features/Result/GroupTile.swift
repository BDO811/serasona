import SwiftUI

/// One tile per Serasona Score display group (Stress / Wellness / Clarity).
/// Sits above the per-signal `MetricTile` list, the same grouped-card shape
/// as the web dashboard.
struct GroupTile: View {
    let group: GroupScore

    /// Not a design-system token (the triad is fatigue/stress/hydration) —
    /// Stress and Clarity reuse the closest existing metric hues, Wellness is
    /// a one-off literal, the same escape hatch `shadowEmberTint` already
    /// uses in Theme.swift for a color with no asset-catalog entry.
    private var tint: Color {
        switch group.group {
        case .stress: return SerasonaColor.metricStress
        case .wellness: return Color(red: 0.541, green: 0.416, blue: 0.071) // #8a6a12
        case .clarity: return SerasonaColor.metricHydration
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: SerasonaSpace.s1) {
            Text(group.group.label.uppercased())
                .serasonaStyle(SerasonaType.eyebrow)
                .foregroundStyle(SerasonaColor.inkMuted)

            Text(group.index.map(String.init) ?? "—")
                .serasonaStyle(SerasonaType.scoreMD)
                .foregroundStyle(tint)

            Text(group.group.description)
                .serasonaStyle(SerasonaType.caption)
                .foregroundStyle(SerasonaColor.inkBody)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(SerasonaSpace.s5)
        .background(SerasonaColor.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: SerasonaRadius.xl))
    }
}
