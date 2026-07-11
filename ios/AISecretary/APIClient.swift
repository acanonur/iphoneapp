import Foundation

enum APIError: LocalizedError {
    case badStatus(Int, String)
    case network(Error)

    var errorDescription: String? {
        switch self {
        case let .badStatus(code, message):
            return message.isEmpty ? "Server error (\(code))" : message
        case let .network(error):
            return "Cannot reach the server: \(error.localizedDescription)"
        }
    }
}

struct APIClient {
    var baseURL: URL = AppConfig.baseURL

    /// Stable anonymous id for this install; identifies the device to the backend.
    static var deviceID: String {
        let key = "aisecretary.deviceId"
        if let existing = UserDefaults.standard.string(forKey: key) {
            return existing
        }
        let fresh = UUID().uuidString
        UserDefaults.standard.set(fresh, forKey: key)
        return fresh
    }

    func createCall(_ request: NewCallRequest) async throws -> CallTask {
        try await send(path: "/api/calls", method: "POST", body: request)
    }

    func listCalls() async throws -> [CallTask] {
        try await send(path: "/api/calls", method: "GET", body: Optional<NewCallRequest>.none)
    }

    func getCall(id: String) async throws -> CallTask {
        try await send(path: "/api/calls/\(id)", method: "GET", body: Optional<NewCallRequest>.none)
    }

    private func send<Body: Encodable, Response: Decodable>(
        path: String,
        method: String,
        body: Body?
    ) async throws -> Response {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.setValue(Self.deviceID, forHTTPHeaderField: "X-Device-Id")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.network(error)
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ..< 300).contains(status) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? ""
            throw APIError.badStatus(status, message)
        }
        return try JSONDecoder().decode(Response.self, from: data)
    }
}
