import CoreGraphics
import SwiftUI

#if canImport(UIKit)
import UIKit
/// The native image type on this platform. UIKit on iOS, iPadOS and Catalyst.
typealias PlatformImage = UIImage
#elseif canImport(AppKit)
import AppKit
/// The native image type on this platform. AppKit on macOS.
typealias PlatformImage = NSImage
#endif

// MARK: - Images

extension PlatformImage {

    /// A `CGImage` with any orientation already baked in, so a photo taken
    /// sideways does not come out rotated in the chart.
    var knitCGImage: CGImage? {
        #if canImport(UIKit)
        guard let cgImage else { return nil }
        // Already upright: no need to redraw.
        if imageOrientation == .up { return cgImage }
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let upright = renderer.image { _ in
            draw(in: CGRect(origin: .zero, size: size))
        }
        return upright.cgImage
        #elseif canImport(AppKit)
        return cgImage(forProposedRect: nil, context: nil, hints: nil)
        #else
        return nil
        #endif
    }

    /// Pixel dimensions, which is what the chart grid is derived from.
    var knitPixelSize: CGSize {
        guard let cgImage = knitCGImage else { return .zero }
        return CGSize(width: cgImage.width, height: cgImage.height)
    }

    static func knitImage(from data: Data) -> PlatformImage? {
        PlatformImage(data: data)
    }
}

extension Image {
    /// Builds a SwiftUI image from whichever native image type this platform uses.
    init(platformImage: PlatformImage) {
        #if canImport(UIKit)
        self.init(uiImage: platformImage)
        #elseif canImport(AppKit)
        self.init(nsImage: platformImage)
        #else
        self.init(systemName: "photo")
        #endif
    }
}

// MARK: - Colours

extension Color {

    /// Panel background behind cards and grouped content.
    static var knitSecondaryBackground: Color {
        #if canImport(UIKit)
        return Color(uiColor: .secondarySystemBackground)
        #elseif canImport(AppKit)
        return Color(nsColor: .controlBackgroundColor)
        #else
        return Color.gray.opacity(0.12)
        #endif
    }

    /// The backdrop a whole screen sits on.
    static var knitGroupedBackground: Color {
        #if canImport(UIKit)
        return Color(uiColor: .systemGroupedBackground)
        #elseif canImport(AppKit)
        return Color(nsColor: .windowBackgroundColor)
        #else
        return Color.gray.opacity(0.06)
        #endif
    }

    /// Splits a SwiftUI colour into sRGB components on either platform.
    var knitHex: String {
        #if canImport(UIKit)
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        guard UIColor(self).getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
            return "9E9E9E"
        }
        #elseif canImport(AppKit)
        // NSColor components are only defined in an RGB colour space.
        guard let converted = NSColor(self).usingColorSpace(.sRGB) else { return "9E9E9E" }
        let red = converted.redComponent
        let green = converted.greenComponent
        let blue = converted.blueComponent
        #else
        let red: CGFloat = 0.62, green: CGFloat = 0.62, blue: CGFloat = 0.62
        #endif
        return String(
            format: "%02X%02X%02X",
            Int((red * 255).rounded()),
            Int((green * 255).rounded()),
            Int((blue * 255).rounded()))
    }
}

// MARK: - View modifiers that only exist on one platform

extension View {

    /// A decimal keypad on touch platforms; the Mac already has a keyboard.
    @ViewBuilder
    func knitDecimalKeyboard() -> some View {
        #if os(iOS)
        keyboardType(.decimalPad)
        #else
        self
        #endif
    }

    /// Allows a leading minus, for fields that accept negative ease.
    @ViewBuilder
    func knitSignedKeyboard() -> some View {
        #if os(iOS)
        keyboardType(.numbersAndPunctuation)
        #else
        self
        #endif
    }

    /// Compact navigation titles are an iOS concept.
    @ViewBuilder
    func knitInlineTitle() -> some View {
        #if os(iOS)
        navigationBarTitleDisplayMode(.inline)
        #else
        self
        #endif
    }

    /// A picker with many options: pushed on iOS, a pop-up menu on the Mac.
    @ViewBuilder
    func knitLongListPicker() -> some View {
        #if os(iOS)
        pickerStyle(.navigationLink)
        #else
        pickerStyle(.menu)
        #endif
    }

    /// The Mac's default `Form` style right-aligns every label into one column
    /// sized to the longest label, which is what pushed the controls off the
    /// edge of the sheet. The grouped style lays a Mac form out the way System
    /// Settings does, and honours section headers and footers. iOS is already
    /// grouped.
    @ViewBuilder
    func knitFormStyle() -> some View {
        #if os(macOS)
        formStyle(.grouped)
        #else
        self
        #endif
    }

    /// A sheet on the Mac gets its size from its content, and a `Form` inside
    /// one has no width of its own — so it stretches to whatever its widest row
    /// asks for and the rest is pushed out of view. Giving the sheet an explicit
    /// size fixes that. On iOS a sheet is already the width of the screen.
    @ViewBuilder
    func knitSheetFrame(width: CGFloat = 560, height: CGFloat = 640) -> some View {
        #if os(macOS)
        frame(width: width, height: height)
        #else
        self
        #endif
    }

    /// Mac windows need a sensible opening size; iOS ignores this.
    @ViewBuilder
    func knitMinimumWindowSize() -> some View {
        #if os(macOS)
        frame(minWidth: 900, minHeight: 600)
        #else
        self
        #endif
    }
}

// MARK: - Sections

/// The top-level areas of the app. iOS shows them as tabs, macOS as a sidebar.
enum AppSection: String, CaseIterable, Identifiable {
    case projects
    case patterns
    case learn
    case stash

    /// The section is its own identifier so a `List(selection:)` binding of
    /// `AppSection?` type-checks against the row ID.
    var id: AppSection { self }

    var title: String {
        switch self {
        case .projects: return "Projects"
        case .patterns: return "Patterns"
        case .learn: return "Learn"
        case .stash: return "Stash"
        }
    }

    var symbol: String {
        switch self {
        case .projects: return "square.stack.3d.up"
        case .patterns: return "square.grid.3x3"
        case .learn: return "book"
        case .stash: return "basket"
        }
    }

    @ViewBuilder
    var destination: some View {
        switch self {
        case .projects: ProjectsView()
        case .patterns: PatternsView()
        case .learn: LearnView()
        case .stash: StashView()
        }
    }
}
