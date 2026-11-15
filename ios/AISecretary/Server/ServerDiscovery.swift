import Foundation
import Network

/// Finds the user's server on the local network without anyone typing an
/// address. The server announces itself over Bonjour and puts its addresses in
/// the announcement, so finding it is a matter of listening for a moment.
enum ServerDiscovery {
    static let serviceType = "_yaver._tcp"

    /// Everything the search needs to remember, touched only on its own queue.
    private final class Search: @unchecked Sendable {
        var urls: [URL] = []
        var finished = false
    }

    /// Listens for up to `timeout` seconds and returns the addresses announced,
    /// most useful first. Empty when nothing answered — including when the user
    /// has not allowed the app to use the local network.
    static func search(timeout: TimeInterval = 3) async -> [URL] {
        await withCheckedContinuation { (continuation: CheckedContinuation<[URL], Never>) in
            let queue = DispatchQueue(label: "yaver.discovery")
            let search = Search()
            let browser = NWBrowser(
                for: .bonjourWithTXTRecord(type: serviceType, domain: nil),
                using: NWParameters()
            )

            let finish: @Sendable () -> Void = {
                guard !search.finished else { return }
                search.finished = true
                browser.cancel()
                continuation.resume(returning: search.urls)
            }

            browser.browseResultsChangedHandler = { results, _ in
                var found: [URL] = []
                for result in results {
                    if case let .bonjour(record) = result.metadata {
                        found.append(contentsOf: urls(from: record.dictionary))
                    }
                }
                guard !found.isEmpty else { return }
                search.urls = found
                // Give a second announcement a moment to arrive, then stop.
                queue.asyncAfter(deadline: .now() + 0.4, execute: finish)
            }
            browser.stateUpdateHandler = { state in
                if case .failed = state { finish() }
            }
            browser.start(queue: queue)
            queue.asyncAfter(deadline: .now() + timeout, execute: finish)
        }
    }

    /// The addresses in one announcement: the numeric ones first (they work at
    /// once), then the computer's network name (it survives an address change).
    static func urls(from record: [String: String]) -> [URL] {
        let port = record["port"].flatMap { Int($0) } ?? 8787
        var hosts = (record["addrs"] ?? "")
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        if let name = record["host"], !name.isEmpty { hosts.append(name) }
        return hosts.compactMap { URL(string: "http://\($0):\(port)") }
    }
}
