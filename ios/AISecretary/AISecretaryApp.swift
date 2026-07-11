import SwiftUI

@main
struct AISecretaryApp: App {
    @State private var model = CallsViewModel()

    var body: some Scene {
        WindowGroup {
            CallListView()
                .environment(model)
        }
    }
}
