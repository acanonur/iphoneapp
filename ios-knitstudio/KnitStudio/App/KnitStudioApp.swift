import SwiftUI

@main
struct KnitStudioApp: App {
    @StateObject private var store = AppStore()
    @Environment(\.scenePhase) private var scenePhase

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
