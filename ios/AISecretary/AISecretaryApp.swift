import SwiftUI

@main
struct AISecretaryApp: App {
    @State private var model = CallsViewModel()

    var body: some Scene {
        WindowGroup {
            TabView {
                CallListView()
                    .tabItem {
                        Label("Secretary", systemImage: "phone.badge.checkmark")
                    }
                TranslatorView()
                    .tabItem {
                        Label("Translator", systemImage: "globe.europe.africa.fill")
                    }
            }
            .environment(model)
        }
    }
}
