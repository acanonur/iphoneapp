import SwiftUI

/// The pieces the 1c "Terracotta Header" direction is built from.
///
/// The shape of the direction: one deep coloured field at the top carrying the
/// screen's identity and its key numbers, a cream body underneath, and a pill
/// control floated across the seam between them. Clay for projects and
/// patterns, sage for anything under Learn, so you can tell which half of the
/// app you are in without reading a word.

/// How far the floating segmented control rides up over the header's edge.
let organicSeamOverlap: CGFloat = 26

// MARK: - Header

/// The deep field at the top of a 1c screen.
///
/// `bottomInset` leaves room for a control that overlaps the seam; pass 0 when
/// nothing floats over it.
struct OrganicHeader<Content: View>: View {
    var tone: Color
    var topPadding: CGFloat = 20
    var bottomPadding: CGFloat = 24
    var bottomInset: CGFloat = 0
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, topPadding)
        .padding(.bottom, bottomPadding + bottomInset)
        .background(tone)
        .clipShape(
            .rect(
                bottomLeadingRadius: Organic.radiusHeader,
                bottomTrailingRadius: Organic.radiusHeader
            )
        )
    }
}

/// Back chevron on the left, an optional action on the right.
struct OrganicHeaderBar<Action: View>: View {
    var backLabel: String
    var tint: Color
    var onBack: () -> Void
    @ViewBuilder var action: Action

    var body: some View {
        HStack {
            Button(action: onBack) {
                HStack(spacing: 6) {
                    LucideChevronLeft(tint: tint, size: 22)
                    Text(backLabel)
                        .font(KnitType.body(18, .semibold))
                        .foregroundStyle(tint)
                }
            }
            .buttonStyle(.plain)

            Spacer()
            action
        }
    }
}

extension OrganicHeaderBar where Action == EmptyView {
    init(backLabel: String, tint: Color, onBack: @escaping () -> Void) {
        self.init(backLabel: backLabel, tint: tint, onBack: onBack) { EmptyView() }
    }
}

/// One of the three numbers across the bottom of a project header.
struct OrganicStatTile: View {
    var label: String
    var value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label)
                .font(KnitType.body(15))
                .foregroundStyle(Organic.clay.s200)
            Text(value)
                .font(KnitType.display(26))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Organic.clay.s700, in: RoundedRectangle(cornerRadius: Organic.radiusMd))
    }
}

// MARK: - Segmented control

/// The pill that floats across the seam. Sits on neutral-100 rather than the
/// page so it reads as lifted off the header rather than cut into it.
struct OrganicSegmentedControl: View {
    var options: [String]
    @Binding var selection: Int
    var activeTone: Color = Organic.clay.s800

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(options.enumerated()), id: \.offset) { index, label in
                let active = index == selection
                Button { selection = index } label: {
                    Text(label)
                        .font(KnitType.body(16, .bold))
                        .foregroundStyle(active ? .white : Organic.neutral.s700)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(active ? activeTone : .clear, in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Organic.neutral.s100, in: Capsule())
        .organicShadow(Organic.shadowMd)
        .padding(.horizontal, 20)
        .offset(y: -organicSeamOverlap)
        // The control is drawn outside its own bounds, so claim back the space
        // it borrowed rather than leaving a gap under it.
        .padding(.bottom, -organicSeamOverlap)
    }
}

// MARK: - Pills and chips

/// A small tinted label — stitch counts, difficulty, category.
struct OrganicPill: View {
    var text: String
    var background: Color
    var foreground: Color

    var body: some View {
        Text(text)
            .font(KnitType.body(15, .bold))
            .foregroundStyle(foreground)
            .padding(.horizontal, 14)
            .padding(.vertical, 5)
            .background(background, in: Capsule())
    }
}

/// A filter chip. Outlined when off, solid when on.
struct OrganicChip: View {
    var text: String
    var selected: Bool
    var tone: Color = Organic.clay.s800
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(text)
                .font(KnitType.body(17, .semibold))
                .foregroundStyle(selected ? .white : Organic.text)
                .lineLimit(1)
                .padding(.horizontal, 18)
                .padding(.vertical, 12)
                .background(selected ? tone : .clear, in: Capsule())
                .overlay(Capsule().strokeBorder(selected ? tone : Organic.neutral.s400, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }
}

/// The full-width pill the redesign uses for a screen's one main action.
struct OrganicWideButton: View {
    var label: String
    var tone: Color = Organic.clay.s800
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(KnitType.display(20))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: Organic.minTap)
                .background(tone, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Timeline

enum OrganicTimelineState {
    case done, current, todo

    var fill: Color {
        switch self {
        case .done: return Organic.clay.s800
        case .current, .todo: return Organic.bg
        }
    }

    var border: Color {
        switch self {
        case .done, .current: return Organic.clay.s800
        case .todo: return Organic.neutral.s400
        }
    }

    var ink: Color {
        switch self {
        case .done: return .white
        case .current: return Organic.clay.s800
        case .todo: return Organic.neutral.s700
        }
    }
}

/// One step of the Plan timeline: a numbered node with a rail running down to
/// the next one, and the step's text beside it.
struct OrganicTimelineRow: View {
    var number: Int
    var title: String
    var meta: String
    var text: String
    var stitches: String?
    var state: OrganicTimelineState
    var isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(spacing: 0) {
                Text("\(number)")
                    .font(KnitType.body(15, .bold))
                    .foregroundStyle(state.ink)
                    .frame(width: 36, height: 36)
                    .background(state.fill, in: Circle())
                    .overlay(Circle().strokeBorder(state.border, lineWidth: 3))

                if !isLast {
                    // The rail only needs to reach the next node, and the row
                    // below draws its own, so a flexible fill is right here.
                    Rectangle()
                        .fill(Organic.neutral.s300)
                        .frame(width: 3)
                        .frame(maxHeight: .infinity)
                        .padding(.vertical, 4)
                }
            }
            .frame(width: 36)

            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .lastTextBaseline) {
                    Text(title)
                        .font(KnitType.display(22))
                        .foregroundStyle(Organic.text)
                    Spacer()
                    if !meta.isEmpty {
                        Text(meta)
                            .font(KnitType.body(16))
                            .foregroundStyle(Organic.neutral.s700)
                    }
                }
                Text(text)
                    .font(KnitType.body(18))
                    .foregroundStyle(Organic.text)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
                if let stitches, !stitches.isEmpty {
                    OrganicPill(
                        text: stitches,
                        background: Organic.sage.s200,
                        foreground: Organic.sage.s900
                    )
                    .padding(.top, 8)
                }
            }
            .padding(.bottom, 22)
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

// MARK: - List row

/// A row on a divided list: washed tint circle, two lines, a chevron.
struct OrganicListRow: View {
    var title: String
    var blurb: String
    var tintIndex: Int
    var action: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button(action: action) {
                HStack(spacing: 16) {
                    Circle()
                        .fill(OrganicTint.pair(tintIndex).background)
                        .frame(width: 60, height: 60)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(title)
                            .font(KnitType.body(20, .bold))
                            .foregroundStyle(Organic.text)
                        Text(blurb)
                            .font(KnitType.body(17))
                            .foregroundStyle(Organic.neutral.s700)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 8)
                    LucideChevronRight(tint: Organic.clay.s800, size: 24)
                }
                .frame(minHeight: 88)
                .padding(.vertical, 16)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Rectangle()
                .fill(Organic.neutral.s300)
                .frame(height: 2)
        }
    }
}
