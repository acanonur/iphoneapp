import SwiftUI

// MARK: - Buttons

/// The system's four button variants. Labels are flush left in every one of
/// them — a button wider than its label starts the text at the left padding
/// edge, trailing icon and all, never centred.
enum ModernistButtonVariant {
    case primary, secondary, ghost, icon

    var foreground: Color {
        switch self {
        case .primary: return Modernist.bg
        case .secondary, .icon: return Modernist.text
        case .ghost: return Modernist.accent
        }
    }

    func background(pressed: Bool) -> Color {
        switch self {
        case .primary: return pressed ? Modernist.Accent.s700 : Modernist.accent
        case .secondary: return pressed ? Modernist.text.opacity(0.14) : .clear
        case .ghost: return pressed ? Modernist.accent.opacity(0.18) : .clear
        case .icon: return pressed ? Modernist.Neutral.s200 : .clear
        }
    }

    var borderColor: Color {
        self == .secondary ? Modernist.divider : .clear
    }
}

struct ModernistButtonStyle: ButtonStyle {
    var variant: ModernistButtonVariant = .secondary
    /// Full width with a flush-left label — the `.btn-block` pattern.
    var block = false
    var height: CGFloat?
    var fontSize: CGFloat = 14
    var horizontalPadding: CGFloat?
    var verticalPadding: CGFloat?
    /// Overrides the variant's ink — the design sets a couple of ghost buttons
    /// in the text colour rather than the accent.
    var foreground: Color?

    func makeBody(configuration: Configuration) -> some View {
        Body(style: self, configuration: configuration)
    }

    /// A real view, so `isEnabled` is read from the live environment. A
    /// `ButtonStyle` is not part of the view graph and would never see it.
    private struct Body: View {
        @Environment(\.isEnabled) private var isEnabled

        let style: ModernistButtonStyle
        let configuration: ButtonStyleConfiguration

        var body: some View {
            configuration.label
                .font(Archivo.font(size: style.fontSize, weight: .extrabold))
                .foregroundStyle(style.foreground ?? style.variant.foreground)
                .padding(.horizontal, style.horizontalPadding ?? style.defaultHorizontalPadding)
                .padding(
                    .vertical,
                    style.verticalPadding ?? (style.height == nil ? Modernist.Space.s2 : 0)
                )
                .frame(
                    maxWidth: style.block ? .infinity : nil,
                    alignment: style.block ? .leading : .center
                )
                .frame(height: style.height)
                .background(style.variant.background(pressed: configuration.isPressed))
                .overlay {
                    Rectangle()
                        .strokeBorder(style.variant.borderColor, lineWidth: Modernist.hairlineWidth)
                }
                .opacity(isEnabled ? 1 : 0.45)
                .contentShape(Rectangle())
        }
    }

    fileprivate var defaultHorizontalPadding: CGFloat {
        switch variant {
        case .ghost: return Modernist.Space.s1
        case .icon: return 0
        case .primary, .secondary: return Modernist.Space.s3 * 1.2
        }
    }
}

/// A label with an optional trailing glyph, flush left, as every wide button in
/// the design is drawn.
struct ButtonLabel: View {
    let title: String
    var icon: Lucide?
    var iconSize: CGFloat = 18
    var gap: CGFloat = 10

    var body: some View {
        HStack(spacing: gap) {
            Text(title)
            if let icon {
                Icon(glyph: icon, size: iconSize)
            }
        }
    }
}

/// A 36×36 icon-only button — the header bar's actions.
struct IconButton: View {
    let glyph: Lucide
    var accessibilityLabel: String
    var size: CGFloat = 36
    var glyphSize: CGFloat = 20
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Icon(glyph: glyph, size: glyphSize)
                .frame(width: size, height: size)
        }
        .buttonStyle(ModernistButtonStyle(variant: .icon, horizontalPadding: 0, verticalPadding: 0))
        .accessibilityLabel(accessibilityLabel)
    }
}

// MARK: - Tags

enum TagVariant {
    case accent, neutral, outline

    var foreground: Color {
        switch self {
        case .accent: return Modernist.Accent.s800
        case .neutral: return Modernist.Neutral.s800
        case .outline: return Modernist.accent
        }
    }

    var background: Color {
        switch self {
        case .accent: return Modernist.Accent.s100
        case .neutral: return Modernist.Neutral.s100
        case .outline: return .clear
        }
    }

    var border: Color {
        self == .outline ? Modernist.accent : .clear
    }
}

struct Tag: View {
    let title: String
    var variant: TagVariant = .neutral

    var body: some View {
        Text(title)
            .typeStyle(TypeStyle(size: 11, weight: .regular, lineHeight: 1.4, tracking: 0.02))
            .foregroundStyle(variant.foreground)
            .padding(.horizontal, 10)
            .padding(.vertical, 3)
            .background(variant.background)
            .overlay {
                Rectangle().strokeBorder(variant.border, lineWidth: Modernist.hairlineWidth)
            }
    }
}

// MARK: - Kickers

/// The uppercase section label that opens nearly every block in the design.
struct Kicker: View {
    let text: String
    var color: Color = Modernist.Accent.s700
    var style: TypeStyle = .kicker
    var tabularNumbers = false

    var body: some View {
        Text(text.uppercased())
            .typeStyle(tabularNumbers ? tabular : style)
            .foregroundStyle(color)
    }

    private var tabular: TypeStyle {
        var style = self.style
        style.tabularNumbers = true
        return style
    }
}

// MARK: - Fields

/// A labelled form field — `.field` plus its `label`.
struct Field<Content: View>: View {
    let label: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .typeStyle(TypeStyle(size: 12, weight: .regular, lineHeight: 1.4))
                .foregroundStyle(Modernist.text.opacity(0.70))
            content
        }
    }
}

/// The `.input` surface: a filled box with a 1px rule and no radius.
private struct InputSurface: ViewModifier {
    var minHeight: CGFloat
    var isFocused: Bool
    var alignment: Alignment = .topLeading

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, minHeight: minHeight, alignment: alignment)
            .background(Modernist.surface)
            .overlay {
                Rectangle().strokeBorder(
                    isFocused ? Modernist.accent : Modernist.divider,
                    lineWidth: Modernist.hairlineWidth
                )
            }
    }
}

struct DSTextField: View {
    let placeholder: String
    @Binding var text: String
    var minHeight: CGFloat = 36
    var fontSize: CGFloat = 14
    var tabularNumbers = false
    var keyboard: UIKeyboardType = .default
    var textContentType: UITextContentType?

    @FocusState private var focused: Bool

    var body: some View {
        TextField(placeholder, text: $text)
            .textFieldStyle(.plain)
            .focused($focused)
            .keyboardType(keyboard)
            .textContentType(textContentType)
            .font(Archivo.font(size: fontSize, weight: .regular, tabularNumbers: tabularNumbers))
            .foregroundStyle(Modernist.text)
            .tint(Modernist.accent)
            .frame(maxWidth: .infinity, alignment: .leading)
            .modifier(
                InputSurface(minHeight: minHeight, isFocused: focused, alignment: .leading)
            )
    }
}

/// The multi-line brief field. A `TextEditor` with the placeholder drawn behind
/// it, because the design shows the full hint wrapped over several lines rather
/// than truncated to one.
struct DSTextEditor: View {
    let placeholder: String
    @Binding var text: String
    var minHeight: CGFloat = 128
    var fontSize: CGFloat = 16

    @FocusState private var focused: Bool

    private var style: TypeStyle {
        TypeStyle(size: fontSize, weight: .regular, lineHeight: 1.45)
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                Text(placeholder)
                    .typeStyle(style)
                    .foregroundStyle(Modernist.Neutral.s600)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 8)
                    .allowsHitTesting(false)
            }
            TextEditor(text: $text)
                .focused($focused)
                .font(style.font)
                .lineSpacing(style.lineSpacing)
                .foregroundStyle(Modernist.text)
                .tint(Modernist.accent)
                .scrollContentBackground(.hidden)
                .background(Color.clear)
                .frame(minHeight: minHeight - 12)
        }
        .modifier(InputSurface(minHeight: minHeight, isFocused: focused))
    }
}

// MARK: - Segmented control

/// `.seg` — equal-width options in one row, hairline-separated, flush left, the
/// selected one filled with the accent.
struct SegmentedControl<Value: Hashable, Content: View>: View {
    let values: [Value]
    @Binding var selection: Value
    var height: CGFloat?
    var padding: EdgeInsets = EdgeInsets(top: 11, leading: 12, bottom: 11, trailing: 12)
    @ViewBuilder var content: (Value, Bool) -> Content

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(values.enumerated()), id: \.element) { index, value in
                if index > 0 { VHairline() }
                let isSelected = value == selection
                Button {
                    selection = value
                } label: {
                    content(value, isSelected)
                        .padding(padding)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .frame(height: height)
                        .foregroundStyle(isSelected ? Modernist.bg : Modernist.text)
                        .background(isSelected ? Modernist.accent : .clear)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? [.isSelected] : [])
            }
        }
        .overlay {
            Rectangle().strokeBorder(Modernist.divider, lineWidth: Modernist.hairlineWidth)
        }
    }
}

// MARK: - Live indicators

/// The pulsing accent square that marks work in flight (`om-pulse`).
struct PulsingDot: View {
    var size: CGFloat = 10
    @State private var dim = false

    var body: some View {
        Rectangle()
            .fill(Modernist.accent)
            .frame(width: size, height: size)
            .opacity(dim ? 0.2 : 1)
            .animation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true), value: dim)
            .onAppear { dim = true }
            .accessibilityHidden(true)
    }
}

/// The five-bar level meter shown while the translator is listening (`om-bar`).
struct ListeningBars: View {
    @State private var animating = false

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0 ..< 5, id: \.self) { index in
                Rectangle()
                    .fill(Modernist.accent)
                    .frame(width: 3, height: 18)
                    .scaleEffect(y: animating ? 1 : 0.3, anchor: .center)
                    .animation(
                        .easeInOut(duration: 0.45)
                            .repeatForever(autoreverses: true)
                            .delay(Double(index) * 0.12),
                        value: animating
                    )
            }
        }
        .frame(height: 18)
        .onAppear { animating = true }
        .accessibilityHidden(true)
    }
}
