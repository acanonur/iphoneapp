import CryptoKit
import Foundation
import Observation

enum ServerContract {
    /// The server contract this app is written against.
    static let apiVersion = 2
}

/// What a server says about itself to anyone who asks (`GET /health`).
struct ServerHealth: Decodable, Equatable {
    var service: String?
    var version: Int?
    var name: String?
    var provider: String?
    var simulated: Bool?
    var auth: String?
    var reports: String?
    /// Proof that the server holds the access key: an HMAC of the challenge.
    var proof: String?

    /// Servers from before the app could find and pair with them answer with
    /// less; they still work, but should be updated.
    var isCurrent: Bool { (version ?? 0) >= ServerContract.apiVersion }
    var needsKey: Bool { auth == "key" }
}

/// What the secretary knows about the person it works for.
struct ServerProfile: Codable, Equatable {
    var name: String?
    /// The language the owner reads: reports and notes are written in it.
    var language: Language = .en
    /// The language the owner's callers speak — that of the country they live
    /// in. A call the secretary answers is greeted in it.
    var callLanguage: Language?
    var answerCalls = false
    var answerNote: String?

    /// Written out in full, with an explicit null for an empty name or note:
    /// the server reads a missing field as "leave it as it is".
    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(name, forKey: .name)
        try values.encode(language, forKey: .language)
        try values.encode(callLanguage, forKey: .callLanguage)
        try values.encode(answerCalls, forKey: .answerCalls)
        try values.encode(answerNote, forKey: .answerNote)
    }
}

/// What the server tells the app once it is let in (`GET /api/session`).
struct ServerSession: Decodable, Equatable {
    var simulated = true
    var reports = "basic"
    var canAnswerCalls = false
    var answerNumber: String?
    var reachable = false
    var allowedCountryPrefixes: [String] = []
    var maxCallMinutes: Double?
    var maxCallsPerDay: Int?
    var callsToday: Int?
    var addresses: [String] = []
    var profile = ServerProfile()

    private enum CodingKeys: String, CodingKey {
        case simulated, reports, canAnswerCalls, answerNumber, reachable
        case allowedCountryPrefixes, maxCallMinutes, maxCallsPerDay, callsToday, addresses, profile
    }

    init() {}

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        simulated = try values.decodeIfPresent(Bool.self, forKey: .simulated) ?? true
        reports = try values.decodeIfPresent(String.self, forKey: .reports) ?? "basic"
        canAnswerCalls = try values.decodeIfPresent(Bool.self, forKey: .canAnswerCalls) ?? false
        answerNumber = try values.decodeIfPresent(String.self, forKey: .answerNumber)
        reachable = try values.decodeIfPresent(Bool.self, forKey: .reachable) ?? false
        allowedCountryPrefixes =
            try values.decodeIfPresent([String].self, forKey: .allowedCountryPrefixes) ?? []
        maxCallMinutes = try values.decodeIfPresent(Double.self, forKey: .maxCallMinutes)
        maxCallsPerDay = try values.decodeIfPresent(Int.self, forKey: .maxCallsPerDay)
        callsToday = try values.decodeIfPresent(Int.self, forKey: .callsToday)
        addresses = try values.decodeIfPresent([String].self, forKey: .addresses) ?? []
        profile = try values.decodeIfPresent(ServerProfile.self, forKey: .profile) ?? ServerProfile()
    }
}

/// Where the app's server is, whether it can be reached, and what it can do.
///
/// The address used to be compiled into the app, which meant a changed Wi-Fi
/// address left the app dead until it was rebuilt. Now the address is a
/// setting: found on the local network automatically, handed over by a QR
/// code, or typed in — and looked for again whenever it stops answering.
@Observable
@MainActor
final class ServerStore {
    static let shared = ServerStore()

    enum Status: Equatable {
        /// Not tried yet.
        case unknown
        case checking
        case connected
        /// Nothing answered. The associated value says what went wrong.
        case unreachable(ConnectionProblem)
        /// The server is there, but wants an access key the app does not have.
        case needsKey
        /// The server is there, but does not accept the key the app has.
        case wrongKey
    }

    private(set) var status: Status = .unknown
    private(set) var health: ServerHealth?
    private(set) var session: ServerSession?
    /// The address in use.
    private(set) var baseURL: URL
    private(set) var accessKey: String
    /// Other addresses this server has been seen at — tried when the one in
    /// use stops answering (the Wi-Fi address changed, the phone left home).
    private(set) var knownAddresses: [String]

    /// True once the server in use has proved it holds the access key. Until
    /// then the key is not sent to it.
    private(set) var keyTrusted = false
    /// The system's error number and the address it was for, when the server
    /// did not answer — shown small in Settings.
    private(set) var failureDetail: String?
    /// True when the last thing tried was an address a person gave — typed or
    /// scanned — and it did not work. What went wrong with *that* address is
    /// then worth keeping on screen, rather than replacing it by a search.
    private(set) var lastAttemptWasExplicit = false

    private let defaults: UserDefaults
    private let persists: Bool
    private var connecting: Task<Bool, Never>?

    private enum Key {
        static let url = "yaver.serverURL"
        static let known = "yaver.serverAddresses"
    }

    init(defaults: UserDefaults = .standard, persists: Bool = true) {
        self.defaults = defaults
        self.persists = persists
        let saved = defaults.string(forKey: Key.url).flatMap(URL.init(string:))
        baseURL = saved ?? AppConfig.baseURL
        accessKey = persists ? Keychain.readKey() : ""
        knownAddresses = defaults.stringArray(forKey: Key.known) ?? []
    }

    // MARK: - What the screens read

    var isConnected: Bool { status == .connected }
    var isSimulated: Bool { session?.simulated ?? health?.simulated ?? true }
    var isOutdated: Bool { health.map { !$0.isCurrent } ?? false }
    var serverName: String { health?.name ?? baseURL.host() ?? "" }
    var endpoint: ServerEndpoint {
        ServerEndpoint(baseURL: baseURL, accessKey: keyTrusted ? accessKey : "")
    }

    // MARK: - Connecting

    /// Makes sure there is a server to talk to: the saved address first, then
    /// the others it has been seen at, then a search of the local network.
    @discardableResult
    func connect(searchNetwork: Bool = true) async -> Bool {
        if let running = connecting {
            // An attempt is under way: wait for it rather than start a second.
            if await running.value { return true }
            // It found nothing — but it may have started before something
            // changed, most often before the iPhone's "allow local network?"
            // question was answered. So this caller looks once more, freshly
            // (or joins whoever already does).
            if let newer = connecting, newer != running { return await newer.value }
        }
        let attempt = Task { await self.establish(searchNetwork: searchNetwork) }
        connecting = attempt
        let result = await attempt.value
        if connecting == attempt { connecting = nil }
        return result
    }

    private func establish(searchNetwork: Bool) async -> Bool {
        status = .checking
        failureDetail = nil
        lastAttemptWasExplicit = false
        var lastProblem: ConnectionProblem?

        var candidates: [URL] = []
        // "localhost" is the computer itself: right for the simulator, never
        // right on a real iPhone, where it would only produce a misleading error.
        if !Self.isThisDevice(baseURL) || Self.runsInSimulator { candidates.append(baseURL) }
        for address in knownAddresses {
            if let url = URL(string: address), !candidates.contains(url),
               !Self.isThisDevice(url) || Self.runsInSimulator {
                candidates.append(url)
            }
        }

        // A server that wants a key but cannot prove it holds ours is not our
        // server — or ours with another key. Either way the key stays here.
        var sawStranger = false

        for url in candidates {
            let challenge = Self.challenge()
            switch await APIClient.probe(url, challenge: challenge) {
            case let .success(found):
                if let trusted = trust(found, key: accessKey, challenge: challenge) {
                    return await adopt(url, health: found, keyTrusted: trusted)
                }
                sawStranger = true
            case let .failure(failure):
                if url == baseURL {
                    lastProblem = failure.problem
                    failureDetail = Self.detail(failure, url)
                }
            }
        }

        if searchNetwork {
            let found = await ServerDiscovery.search()
            for url in found.urls where !candidates.contains(url) {
                let challenge = Self.challenge()
                if case let .success(health) = await APIClient.probe(url, challenge: challenge),
                   let trusted = trust(health, key: accessKey, challenge: challenge) {
                    return await adopt(url, health: health, keyTrusted: trusted)
                }
            }
            if found.permissionDenied {
                keyTrusted = false
                status = .unreachable(.localNetworkDenied)
                return false
            }
        }

        // No server has proved itself: until one does, the key goes nowhere —
        // least of all to whatever now answers at the old address.
        keyTrusted = false
        if sawStranger {
            status = .wrongKey
        } else {
            status = .unreachable(lastProblem ?? .noServerFound)
        }
        return false
    }

    private static var runsInSimulator: Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }

    private static func isThisDevice(_ url: URL) -> Bool {
        let host = url.host() ?? ""
        return host == "localhost" || host == "127.0.0.1" || host == "::1"
    }

    /// "-1004 · 192.168.2.56:8787" — small print for whoever is debugging.
    private static func detail(_ failure: ProbeFailure, _ url: URL) -> String {
        let host = url.host() ?? url.absoluteString
        let place = url.port.map { "\(host):\($0)" } ?? host
        return failure.code.map { "\($0) · \(place)" } ?? place
    }

    private static func challenge() -> String {
        UUID().uuidString + UUID().uuidString
    }

    /// Whether to talk to a server that answered, and whether to give it the key.
    ///
    /// - `false`: go ahead without the key — the server asks for none, or the
    ///   app has none to give (it will then be asked for one).
    /// - `true`: the server proved it holds the same key; send it.
    /// - `nil`: the server wants a key and could not prove it holds ours. The
    ///   app finds servers by itself, so this check is what keeps the key from
    ///   being handed to whatever happens to answer on a strange network.
    private func trust(_ found: ServerHealth, key: String, challenge: String) -> Bool? {
        guard found.needsKey, !key.isEmpty else { return false }
        let expected = HMAC<SHA256>.authenticationCode(
            for: Data(challenge.utf8), using: SymmetricKey(data: Data(key.utf8))
        )
        let hex = expected.map { String(format: "%02x", $0) }.joined()
        return found.proof == hex ? true : nil
    }

    /// Settles on an address that answered, then asks to be let in.
    private func adopt(_ url: URL, health found: ServerHealth, keyTrusted trusted: Bool) async -> Bool {
        keyTrusted = trusted
        if url != baseURL {
            baseURL = url
            if persists { defaults.set(url.absoluteString, forKey: Key.url) }
        }
        health = found
        remember([url.absoluteString])

        guard found.isCurrent else {
            // An older server has no session to ask for; its tasks still work.
            session = nil
            status = .connected
            return true
        }

        do {
            let fresh = try await APIClient(endpoint).session()
            session = fresh
            remember(fresh.addresses)
            status = .connected
            return true
        } catch APIError.keyRequired {
            status = .needsKey
        } catch APIError.keyInvalid {
            status = .wrongKey
        } catch let APIError.unreachable(problem, _) {
            status = .unreachable(problem)
        } catch {
            status = .unreachable(.notRunning)
        }
        return false
    }

    private func remember(_ addresses: [String]) {
        var merged = knownAddresses
        for address in addresses where !merged.contains(address) { merged.append(address) }
        // Recent ones matter; a list that only grows would slow every search.
        knownAddresses = Array(merged.suffix(8))
        if persists { defaults.set(knownAddresses, forKey: Key.known) }
    }

    /// Points the app at an address the user typed, scanned or tapped. The
    /// server in use is only given up once the new one has answered.
    @discardableResult
    func use(address: String, key: String?) async -> Bool {
        // One attempt at a time: a search that is still under way must not
        // write its "nothing found" over what this one finds.
        while let running = connecting {
            _ = await running.value
            if connecting == running { connecting = nil }
        }
        let attempt = Task { await self.switchTo(address: address, key: key) }
        connecting = attempt
        let result = await attempt.value
        if connecting == attempt { connecting = nil }
        lastAttemptWasExplicit = !result
        return result
    }

    private func switchTo(address: String, key: String?) async -> Bool {
        guard let url = Self.url(from: address) else {
            status = .unreachable(.badAddress)
            return false
        }
        // Plain http is for the home network. Anything on the internet has to
        // be https, or the access key would travel in the clear.
        guard url.scheme == "https" || Self.isLocal(url) else {
            status = .unreachable(.needsHTTPS)
            return false
        }
        let candidateKey = (key ?? accessKey).trimmingCharacters(in: .whitespacesAndNewlines)

        status = .checking
        failureDetail = nil
        let challenge = Self.challenge()
        // Patient: this may be the app's first reach into the home network,
        // with the iPhone's question about it still on screen.
        switch await APIClient.probe(url, challenge: challenge, patient: true) {
        case let .failure(failure):
            failureDetail = Self.detail(failure, url)
            status = .unreachable(failure.problem)
            return false
        case let .success(found):
            guard let trusted = trust(found, key: candidateKey, challenge: challenge) else {
                status = .wrongKey
                return false
            }
            accessKey = candidateKey
            if persists { Keychain.saveKey(candidateKey) }
            return await adopt(url, health: found, keyTrusted: trusted)
        }
    }

    /// An address on the home network: a private IPv4 address, a `.local`
    /// name, a bare host name, or this device itself.
    nonisolated static func isLocal(_ url: URL) -> Bool {
        guard let host = url.host()?.lowercased(), !host.isEmpty else { return false }
        if host == "localhost" || host.hasSuffix(".local") || !host.contains(".") { return true }
        let parts = host.split(separator: ".").compactMap { Int($0) }
        guard parts.count == 4, parts.allSatisfy({ (0 ... 255).contains($0) }) else { return false }
        switch (parts[0], parts[1]) {
        case (10, _), (127, _), (192, 168), (169, 254): return true
        case (172, 16 ... 31): return true
        // The range carriers and some VPNs (Tailscale) hand out.
        case (100, 64 ... 127): return true
        default: return false
        }
    }

    /// What a pairing link asks for: `yaver://pair?url=http://192.168.2.56:8787&key=…`
    /// The server's pairing page opens such a link.
    struct Pairing: Equatable {
        let address: String
        let key: String?

        init?(link: URL) {
            guard link.scheme == "yaver", link.host() == "pair",
                  let items = URLComponents(url: link, resolvingAgainstBaseURL: false)?.queryItems,
                  let address = items.first(where: { $0.name == "url" })?.value,
                  ServerStore.url(from: address) != nil
            else { return nil }
            self.address = address
            key = items.first(where: { $0.name == "key" })?.value
        }

        /// The server's host, for asking the user whether they meant this.
        var host: String { ServerStore.url(from: address)?.host() ?? address }
    }

    @discardableResult
    func pair(_ pairing: Pairing) async -> Bool {
        // A link without a key leaves the key the app already has alone.
        await use(address: pairing.address, key: pairing.key)
    }

    /// Re-reads what the server offers — after the profile changed, say.
    func refreshSession() async {
        guard isConnected, health?.isCurrent == true else { return }
        if let fresh = try? await APIClient(endpoint).session() { session = fresh }
    }

    func setSession(profile: ServerProfile) {
        session?.profile = profile
    }

    /// Accepts "192.168.2.56:8787", "my-mac.local" or a full URL.
    nonisolated static func url(from text: String) -> URL? {
        var address = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !address.isEmpty else { return nil }
        if !address.contains("://") { address = "http://" + address }
        while address.hasSuffix("/") { address.removeLast() }
        guard var components = URLComponents(string: address),
              let host = components.host, !host.isEmpty
        else { return nil }
        // A bare address means the server's own port, not the web's.
        if components.port == nil, components.scheme == "http" { components.port = 8787 }
        components.path = ""
        components.query = nil
        components.fragment = nil
        return components.url
    }

    #if DEBUG
    /// For previews and screenshots: a store that already looks connected.
    func stage(health: ServerHealth, session: ServerSession, status: Status = .connected) {
        self.health = health
        self.session = session
        self.status = status
    }
    #endif
}
