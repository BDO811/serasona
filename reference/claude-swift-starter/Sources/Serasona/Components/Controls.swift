import SwiftUI

struct SerasonaPrimaryButton: View {
    let title: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.serasonaLabel)
                .foregroundStyle(Serasona.Ink.onEmber)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Serasona.Space.s4)
                .background(Serasona.Accent.ember, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct SerasonaSecondaryButton: View {
    let title: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.serasonaLabel)
                .foregroundStyle(Serasona.Ink.strong)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Serasona.Space.s4)
                .background(Serasona.Surface.raised, in: Capsule())
                .overlay(Capsule().stroke(Serasona.Border.strong, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

struct SerasonaCard<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: Serasona.Space.s3) {
            content()
        }
        .padding(Serasona.Space.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Serasona.Surface.raised, in: RoundedRectangle(cornerRadius: Serasona.Radius.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Serasona.Radius.xl, style: .continuous)
                .stroke(Serasona.Border.hairline, lineWidth: 1)
        )
    }
}

struct SerasonaStateBanner: View {
    let band: Serasona.State.Band
    let detail: String

    var body: some View {
        HStack(spacing: Serasona.Space.s3) {
            Circle()
                .fill(band.color)
                .frame(width: 10, height: 10)
            VStack(alignment: .leading, spacing: 2) {
                Text(band.rawValue)
                    .font(.serasonaTitleMD)
                    .foregroundStyle(band.color)
                Text(detail)
                    .font(.serasonaBodySM)
                    .foregroundStyle(Serasona.Ink.muted)
            }
            Spacer()
        }
        .padding(Serasona.Space.s4)
        .background(band.soft, in: RoundedRectangle(cornerRadius: Serasona.Radius.lg, style: .continuous))
    }
}

struct SerasonaMetricTile: View {
    let label: String
    let value: Int
    let color: Color
    let softColor: Color

    var body: some View {
        VStack(alignment: .leading, spacing: Serasona.Space.s2) {
            Text(label)
                .serasonaEyebrowStyle()
            Text("\(value)")
                .font(.serasonaScoreMD)
                .foregroundStyle(color)
                .monospacedDigit()
        }
        .padding(Serasona.Space.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(softColor, in: RoundedRectangle(cornerRadius: Serasona.Radius.lg, style: .continuous))
    }
}
