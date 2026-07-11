import Foundation

enum AppConfig {
    /// Backend base URL.
    /// - Simulator: http://localhost:8787 reaches the backend on your Mac.
    /// - Real device: use your Mac's LAN IP (e.g. http://192.168.1.20:8787)
    ///   or a deployed HTTPS URL.
    static let baseURL = URL(string: "http://localhost:8787")!
}
