import SwiftUI

@main
struct KnitStudioApp: App {
    @StateObject private var store = AppStore()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Before the first view is built: a Font.custom naming a face that is
        // not registered yet silently resolves to the system font, and the
        // whole app would quietly stop looking like the design.
        OrganicFonts.register()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
        }
        .onChange(of: scenePhase) { _, phase in
            // Flush any pending debounced write before the app is suspended.
            if phase != .active { store.save() }
        }
    }
}
