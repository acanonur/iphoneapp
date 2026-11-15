import SwiftUI
import UIKit

/// Keeps the iPhone from dimming and locking while a screen is being read
/// rather than touched: a conversation in the translator with the phone lying
/// between two people, or a call whose transcript is being followed.
///
/// Counted, so that one screen letting go does not switch it off under another
/// that still needs it.
@MainActor
enum ScreenAwake {
    private static var holders = 0

    static func hold() {
        holders += 1
        apply()
    }

    static func release() {
        holders = max(0, holders - 1)
        apply()
    }

    private static func apply() {
        UIApplication.shared.isIdleTimerDisabled = holders > 0
    }
}

private struct KeepsScreenAwake: ViewModifier {
    let active: Bool
    @State private var holding = false

    func body(content: Content) -> some View {
        content
            .onAppear { update(active) }
            .onChange(of: active) { _, active in update(active) }
            .onDisappear { update(false) }
    }

    private func update(_ wanted: Bool) {
        guard wanted != holding else { return }
        holding = wanted
        if wanted { ScreenAwake.hold() } else { ScreenAwake.release() }
    }
}

extension View {
    /// While `active`, the screen stays on for as long as this view is shown.
    func keepsScreenAwake(_ active: Bool = true) -> some View {
        modifier(KeepsScreenAwake(active: active))
    }
}
