import Foundation

/// Why the server could not be reached — worked out from the system's error, so
/// the app can say something a person can act on instead of an error code.
enum ConnectionProblem: Error, Equatable {
    /// Nothing is listening at the address: the server is not running, the
    /// computer is asleep, or the address is no longer the computer's.
    case notRunning
    /// The address could not be found on this network at all.
    case notFound
    /// No answer in time: usually a different Wi-Fi, or a firewall.
    case timedOut
    /// The iPhone has no network, or the app may not use the local network.
    case offline
    /// iOS refused a plain-HTTP connection to an address on the internet.
    case needsHTTPS
    case badAddress
    /// Something answered, but it is not this app's server.
    case notOurServer
    /// The app may not use the local network, so it can neither search for
    /// the server nor reach it.
    case localNetworkDenied
    /// No address is known yet, and a search of the Wi-Fi found no server.
    case noServerFound

    init(_ error: Error) {
        guard let urlError = error as? URLError else {
            self = .notRunning
            return
        }
        switch urlError.code {
        case .cannotConnectToHost, .networkConnectionLost:
            self = .notRunning
        case .cannotFindHost, .dnsLookupFailed:
            self = .notFound
        case .timedOut:
            self = .timedOut
        case .notConnectedToInternet, .dataNotAllowed, .internationalRoamingOff:
            self = .offline
        case .appTransportSecurityRequiresSecureConnection, .secureConnectionFailed,
             .serverCertificateUntrusted, .serverCertificateHasBadDate:
            self = .needsHTTPS
        case .badURL, .unsupportedURL:
            self = .badAddress
        default:
            self = .notRunning
        }
    }

    /// One sentence saying what is wrong.
    var title: String {
        switch self {
        case .notRunning: return L("The server is not answering.")
        case .notFound: return L("That address was not found on this network.")
        case .timedOut: return L("The server took too long to answer.")
        case .offline: return L("The iPhone is offline, or Yaver may not use the local network.")
        case .needsHTTPS: return L("This address needs a secure (https) connection.")
        case .badAddress: return L("That does not look like a server address.")
        case .notOurServer: return L("Something answered, but it is not a Yaver server.")
        case .localNetworkDenied: return L("Yaver is not allowed to use the local network.")
        case .noServerFound: return L("No server was found on this Wi-Fi.")
        }
    }

    /// What to check, in the order it is most likely to help.
    var advice: String {
        switch self {
        case .notRunning:
            return L("Check that the server is running on your computer and that the computer is awake. If its address changed, tap “Find automatically”.")
        case .notFound, .timedOut:
            return L("Check that the iPhone and the computer are on the same Wi-Fi, then tap “Find automatically”.")
        case .offline:
            return L("Check Wi-Fi, and in the iPhone’s Settings → Privacy & Security → Local Network make sure Yaver is switched on.")
        case .needsHTTPS:
            return L("Addresses on the internet must start with https://. Addresses on your home Wi-Fi can use http://.")
        case .badAddress:
            return L("An address looks like 192.168.1.20:8787 or https://yaver.example.com.")
        case .notOurServer:
            return L("Check the address and the port (usually 8787).")
        case .localNetworkDenied:
            return L("In the iPhone’s Settings → Privacy & Security → Local Network, switch Yaver on. Then come back and tap “Find automatically”.")
        case .noServerFound:
            return L("Start the server on your computer, keep the iPhone on the same Wi-Fi, and tap “Find automatically” — or point the iPhone’s Camera at the code the server shows.")
        }
    }
}

/// Why an address did not answer, with the system's own code kept for the
/// person who has to work out what is going on.
struct ProbeFailure: Error {
    let problem: ConnectionProblem
    /// The system's error number (for example -1004), if there was one.
    let code: Int?
}

enum APIError: LocalizedError {
    /// The request never got an answer.
    case unreachable(ConnectionProblem, URL)
    case keyRequired
    case keyInvalid
    /// The server answered with an error; `code` is its machine-readable name.
    case server(status: Int, code: String?, message: String)
    case unreadable

    var errorDescription: String? {
        switch self {
        case let .unreachable(problem, url):
            return "\(problem.title) (\(url.host() ?? url.absoluteString)) \(problem.advice)"
        case .keyRequired:
            return L("This server needs an access key. Open Settings → Server and scan the code the server shows.")
        case .keyInvalid:
            return L("The server did not accept the access key. Scan the code the server shows again.")
        case let .server(_, code, message):
            return APIError.explanation(for: code) ?? (message.isEmpty ? L("The server reported an error.") : message)
        case .unreadable:
            return L("The server sent something the app did not understand. Update the server or the app.")
        }
    }

    /// Server errors the app can put into the user's own words.
    private static func explanation(for code: String?) -> String? {
        switch code {
        case "destination_not_allowed":
            return L("Your server is not set up to call this country.")
        case "limit_reached":
            return L("Your server has reached the number of calls it places per day.")
        case "number_required":
            return L("A phone call needs a phone number.")
        case "answering_not_set_up":
            return L("Answering calls is not set up on your server yet.")
        case "public_address_needed":
            return L("Answering calls needs a server that can be reached from the internet.")
        case "not_simulated":
            return L("This is only available while calls are simulated.")
        case "invalid_request":
            return L("The server could not use this request. Check what you entered and try again.")
        case "too_large":
            return L("That is too much text for one request. Shorten it and try again.")
        default:
            return nil
        }
    }

    var isConnectionFailure: Bool {
        if case .unreachable = self { return true }
        return false
    }
}

/// Where to send requests, and what to present there.
struct ServerEndpoint: Equatable {
    var baseURL: URL
    var accessKey: String
}

struct APIClient {
    let endpoint: ServerEndpoint

    init(_ endpoint: ServerEndpoint) {
        self.endpoint = endpoint
    }

    /// Stable anonymous id for this install; identifies the device to the server.
    static var deviceID: String {
        let key = "aisecretary.deviceId"
        if let existing = UserDefaults.standard.string(forKey: key) {
            return existing
        }
        let fresh = UUID().uuidString
        UserDefaults.standard.set(fresh, forKey: key)
        return fresh
    }

    /// A session that gives up quickly: a call is live, and a person is
    /// looking at the screen.
    private static let transport: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 12
        configuration.waitsForConnectivity = false
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: configuration)
    }()

    private struct NoBody: Encodable {}

    // MARK: - Is anybody there?

    /// Asks an address whether a Yaver server lives there. Short timeout: this
    /// runs over several candidate addresses in a row.
    ///
    /// The `challenge` is a random string; a server that holds the access key
    /// answers with a proof of it (see `ServerStore.trust`), so the app can
    /// tell its own server from anything else before it sends the key there.
    static func probe(
        _ baseURL: URL, challenge: String
    ) async -> Result<ServerHealth, ProbeFailure> {
        var request = URLRequest(
            url: baseURL.appending(path: "/health")
                .appending(queryItems: [URLQueryItem(name: "challenge", value: challenge)])
        )
        request.timeoutInterval = 4
        do {
            let (data, response) = try await transport.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let health = try? JSONDecoder().decode(ServerHealth.self, from: data),
                  health.service == "yaver" || health.provider != nil
            else { return .failure(ProbeFailure(problem: .notOurServer, code: nil)) }
            return .success(health)
        } catch {
            return .failure(
                ProbeFailure(problem: ConnectionProblem(error), code: (error as? URLError)?.code.rawValue)
            )
        }
    }

    // MARK: - Session and profile

    func session() async throws -> ServerSession {
        try await send(path: "/api/session", method: "GET", body: NoBody?.none)
    }

    func saveProfile(_ profile: ServerProfile) async throws -> ServerProfile {
        try await send(path: "/api/profile", method: "PUT", body: profile)
    }

    // MARK: - Tasks

    func createTask(_ request: NewTaskRequest) async throws -> SecretaryTask {
        try await send(path: "/api/tasks", method: "POST", body: request)
    }

    func listTasks() async throws -> [SecretaryTask] {
        try await send(path: "/api/tasks", method: "GET", body: NoBody?.none)
    }

    func getTask(id: String) async throws -> SecretaryTask {
        try await send(path: "/api/tasks/\(id)", method: "GET", body: NoBody?.none)
    }

    /// Hangs up a call that is still going on.
    func cancelTask(id: String) async throws -> SecretaryTask {
        try await send(path: "/api/tasks/\(id)/cancel", method: "POST", body: NoBody?.none)
    }

    /// Simulator only: plays an incoming call that the secretary answers.
    func simulateIncomingCall(callerLanguage: Language) async throws -> SecretaryTask {
        try await send(
            path: "/api/dev/incoming",
            method: "POST",
            body: ["language": callerLanguage.rawValue]
        )
    }

    // MARK: - Transport

    private struct ServerErrorBody: Decodable {
        var error: String?
        var code: String?
    }

    private func send<Body: Encodable, Response: Decodable>(
        path: String,
        method: String,
        body: Body?
    ) async throws -> Response {
        let url = endpoint.baseURL.appending(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(Self.deviceID, forHTTPHeaderField: "X-Device-Id")
        if !endpoint.accessKey.isEmpty {
            request.setValue("Bearer \(endpoint.accessKey)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await Self.transport.data(for: request)
        } catch {
            throw APIError.unreachable(ConnectionProblem(error), endpoint.baseURL)
        }

        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ..< 300).contains(status) else {
            let details = try? JSONDecoder().decode(ServerErrorBody.self, from: data)
            switch details?.code {
            case "key_required": throw APIError.keyRequired
            case "key_invalid": throw APIError.keyInvalid
            default:
                // A failed call still comes back as a task (502): let the
                // caller see it rather than a bare error.
                if status == 502, let task = try? JSONDecoder().decode(Response.self, from: data) {
                    return task
                }
                throw APIError.server(
                    status: status, code: details?.code, message: details?.error ?? ""
                )
            }
        }
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw APIError.unreadable
        }
    }
}
