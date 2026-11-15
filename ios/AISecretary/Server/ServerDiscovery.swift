import Foundation
import Network

/// Finds the user's server on the local network without anyone typing an
/// address. The server announces itself over Bonjour and puts its addresses in
/// the announcement, so finding it is a matter of listening for a moment.
enum ServerDiscovery {
    /// Must match the server's announcement (backend/src/discovery.ts) and the
    /// `NSBonjourServices` entry in the app's Info.plist, letter for letter.
    static let serviceType = "_yaver._tcp"

    struct Outcome {
        /// The addresses announced, most useful first.
        var urls: [URL] = []
        /// True when iOS refused the search because the user has not allowed
        /// the app to use the local network — a different problem from
        /// "nothing was found", with a different fix.
        var permissionDenied = false
    }

    /// Everything the search needs to remember, touched only on its own queue.
    private final class Search: @unchecked Sendable {
        var outcome = Outcome()
        var finished = false
    }

    /// The system's error for "the user said no to local network access".
    private static let policyDenied: Int32 = -65570

    /// Listens for up to `timeout` seconds.
    static func search(timeout: TimeInterval = 3) async -> Outcome {
        await withCheckedContinuation { (continuation: CheckedContinuation<Outcome, Never>) in
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
                continuation.resume(returning: search.outcome)
            }

            browser.browseResultsChangedHandler = { results, _ in
                var found: [URL] = []
                for result in results {
                    if case let .bonjour(record) = result.metadata {
                        found.append(contentsOf: urls(from: record.dictionary))
                    }
                }
                guard !found.isEmpty else { return }
                search.outcome.urls = found
                // Give a second announcement a moment to arrive, then stop.
                queue.asyncAfter(deadline: .now() + 0.4, execute: finish)
            }
            browser.stateUpdateHandler = { state in
                switch state {
                case let .waiting(error):
                    if case let .dns(code) = error, code == policyDenied {
                        search.outcome.permissionDenied = true
                        finish()
                    }
                case .failed:
                    finish()
                default:
                    break
                }
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
