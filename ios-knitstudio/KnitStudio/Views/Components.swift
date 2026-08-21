import SwiftUI

extension Color {
    init(hex: String) {
        let normalised = Yarn.normalise(hex: hex)
        let value = UInt32(normalised, radix: 16) ?? 0x9E9E9E
        self.init(
            .sRGB,
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255,
            opacity: 1)
    }
}

extension Yarn {
    var colour: Color { Color(hex: hex) }

    /// Black or white, whichever stays readable on this yarn's colour.
    var contrastingColour: Color {
        let (r, g, b) = rgb
        let luminance = 0.299 * r + 0.587 * g + 0.114 * b
        return luminance > 0.6 ? .black : .white
    }
}

/// A round colour chip with a subtle border so pale yarns are still visible.
struct YarnSwatch: View {
    let yarn: Yarn
    var size: CGFloat = 28
    var label: String?

    var body: some View {
        ZStack {
            Circle()
                .fill(yarn.colour)
                .overlay(Circle().strokeBorder(Color.primary.opacity(0.2), lineWidth: 1))
            if let label {
                Text(label)
                    .font(.system(size: size * 0.45, weight: .semibold, design: .rounded))
                    .foregroundStyle(yarn.contrastingColour)
            }
        }
        .frame(width: size, height: size)
    }
}

/// The headline numbers at the top of a plan.
struct FactGrid: View {
    let facts: [PlanFact]

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 12)]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 12) {
            ForEach(facts) { fact in
                VStack(alignment: .leading, spacing: 2) {
                    Text(fact.label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(fact.value)
                        .font(.title3.weight(.semibold))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    if let detail = fact.detail {
                        Text(detail)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Color.knitSecondaryBackground, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }
}

/// A callout used for warnings and notes.
struct NoteBox: View {
    enum Kind {
        case note, warning

        var symbol: String { self == .note ? "lightbulb" : "exclamationmark.triangle" }
        var tint: Color { self == .note ? .accentColor : .orange }
    }

    let kind: Kind
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: kind.symbol)
                .foregroundStyle(kind.tint)
                .font(.subheadline)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(kind.tint.opacity(0.10), in: RoundedRectangle(cornerRadius: 12))
    }
}

/// A length field that shows and accepts the knitter's chosen units while
/// storing centimetres underneath.
struct LengthField: View {
    let label: String
    @Binding var centimetres: Double
    let units: UnitSystem
    var range: ClosedRange<Double> = 1 ... 400

    var body: some View {
        HStack {
            Text(label)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 12)
            TextField(
                label,
                value: Binding(
                    get: { (units.fromCentimetres(centimetres) * 10).rounded() / 10 },
                    set: { newValue in
                        let cm = units.toCentimetres(newValue)
                        centimetres = min(max(cm, range.lowerBound), range.upperBound)
                    }),
                format: .number.precision(.fractionLength(0 ... 1)))
                .labelsHidden()
                .knitDecimalKeyboard()
                .multilineTextAlignment(.trailing)
                .frame(width: 70)
            Text(units.lengthLabel)
                .foregroundStyle(.secondary)
                .frame(width: 26, alignment: .leading)
        }
    }
}

/// A percentage field shown as a whole number.
struct PercentField: View {
    let label: String
    @Binding var fraction: Double
    var range: ClosedRange<Double> = -0.3 ... 0.5

    var body: some View {
        HStack {
            Text(label)
            Spacer(minLength: 12)
            TextField(
                label,
                value: Binding(
                    get: { (fraction * 100).rounded() },
                    set: { fraction = min(max($0 / 100, range.lowerBound), range.upperBound) }),
                format: .number.precision(.fractionLength(0)))
                .labelsHidden()
                .knitSignedKeyboard()
                .multilineTextAlignment(.trailing)
                .frame(width: 60)
            Text("%")
                .foregroundStyle(.secondary)
                .frame(width: 26, alignment: .leading)
        }
    }
}

struct DifficultyBadge: View {
    let difficulty: Difficulty

    private var tint: Color {
        switch difficulty {
        case .beginner: return .green
        case .easy: return .teal
        case .intermediate: return .orange
        case .advanced: return .pink
        }
    }

    var body: some View {
        Text(difficulty.name)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(tint.opacity(0.18), in: Capsule())
            .foregroundStyle(tint)
    }
}

/// Shown when a list has nothing in it yet.
struct EmptyStateView: View {
    let symbol: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 44))
                .foregroundStyle(.tertiary)
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderedProminent)
                    .padding(.top, 4)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity)
    }
}
