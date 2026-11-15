#if DEBUG
import Foundation

/// The app checking itself against a real server, with nobody touching it.
///
/// The build machine starts the server, launches the app in the simulator with
/// `-yaverSelfTest flow` (or `key`), and reads the verdicts the app writes to
/// `Documents/selftest.json` — see `ios/scripts/selftest.sh`. Nothing else
/// runs the app's own connecting, decoding and polling against the server
/// they were written for, so this is what stands between "it compiles" and
/// "it works". The screens are driven along, so the pictures taken meanwhile
/// show the real thing over real data.
@MainActor
final class SelfTest {
    struct Check: Codable {
        let name: String
        let ok: Bool
        let detail: String
    }

    private struct Report: Codable {
        let plan: String
        var done = false
        var checks: [Check] = []
    }

    /// The plan asked for on the command line, if any.
    static var requestedPlan: String? {
        UserDefaults.standard.string(forKey: "yaverSelfTest")
    }

    private let model: SecretaryViewModel
    private let show: (Route) -> Void
    private var report: Report

    init(plan: String, model: SecretaryViewModel, show: @escaping (Route) -> Void) {
        self.model = model
        self.show = show
        report = Report(plan: plan)
    }

    func run() async {
        save()
        switch report.plan {
        case "key": await keyPlan()
        default: await flowPlan()
        }
        report.done = true
        save()
    }

    // MARK: - Everything a person would do, on a server that simulates calls

    private func flowPlan() async {
        let server = model.server

        // The app starts with no address worth having; the server is found on
        // the network. This is what failed on the owner's first try.
        let found = await server.connect()
        check(
            "finds the server by itself",
            found && server.isConnected,
            "status=\(server.status) address=\(server.baseURL.absoluteString) "
                + "detail=\(server.failureDetail ?? "-")"
        )
        if !server.isConnected {
            // Say what the search itself came back with, for whoever reads the log.
            let heard = await ServerDiscovery.search(timeout: 5)
            check(
                "note: what the network search returned",
                true,
                "addresses=\(heard.urls.map(\.absoluteString)) denied=\(heard.permissionDenied)"
            )
            if let address = UserDefaults.standard.string(forKey: "yaverSelfTestAddress") {
                // Carry on with the rest even where the network cannot be searched.
                await server.use(address: address, key: nil)
            }
        }
        guard server.isConnected else {
            check("connects to the server", false, "status=\(server.status)")
            return
        }
        check(
            "knows what the server can do",
            server.health?.isCurrent == true && server.isSimulated && server.session != nil,
            "version=\(server.health?.version ?? 0) simulated=\(server.isSimulated) "
                + "countries=\(server.session?.allowedCountryPrefixes ?? []) "
                + "answering=\(server.session?.canAnswerCalls ?? false)"
        )

        await model.refresh()
        check(
            "loads the task list",
            model.errorMessage == nil,
            model.errorMessage ?? "\(model.tasks.count) task(s)"
        )

        await model.syncProfile(name: "Deniz Kaya", language: .en)
        check(
            "tells the server who it works for",
            server.session?.profile.name == "Deniz Kaya",
            "name=\(server.session?.profile.name ?? "-")"
        )

        await placeACall()
        await hangUpACall()
        await answerACall()
        await handlePaperwork()

        do {
            _ = try await model.create(
                NewTaskRequest(
                    kind: .call, goal: "Ask about opening hours.", phoneNumber: "+74951234567",
                    language: .en, summaryLanguage: .en
                )
            )
            check("refuses a country the server may not call", false, "the call was accepted")
        } catch {
            check(
                "refuses a country the server may not call",
                error.localizedDescription == L("Your server is not set up to call this country."),
                error.localizedDescription
            )
        }

        let problem = await model.saveAnswering(enabled: true, note: "Back at six.")
        check(
            "switches call answering on",
            problem == nil && server.session?.profile.answerCalls == true
                && server.session?.profile.answerNote == "Back at six.",
            problem ?? "answering=\(server.session?.profile.answerCalls ?? false)"
        )
        _ = await model.saveAnswering(enabled: false, note: "")

        show(.home)
        try? await Task.sleep(for: .seconds(3))
    }

    private func placeACall() async {
        do {
            let call = try await model.create(
                NewTaskRequest(
                    kind: .call,
                    goal: "Book a check-up for next week, mornings preferred.",
                    phoneNumber: "+49301234567",
                    language: .de,
                    summaryLanguage: .en,
                    userName: "Deniz Kaya"
                )
            )
            show(.call(call.id))
            check(
                "places a call",
                call.kind == .call && call.status.isActive && !call.isInbound,
                describe(call)
            )

            let live = await wait(for: call.id, upTo: 45) {
                $0.status == .inProgress && $0.lines.count >= 2
            }
            let ended = await wait(for: call.id, upTo: 120) {
                !$0.status.isActive && !$0.isAwaitingReport
            }
            check(
                "shows the conversation line by line while the call is going on",
                live?.status == .inProgress && (live?.lines.count ?? 0) >= 2
                    && (ended?.lines.count ?? 0) > (live?.lines.count ?? 0),
                "during: \(describe(live)) | after: \(describe(ended))"
            )
            check(
                "ends the call with a report",
                ended?.status == .completed && !(ended?.summary ?? "").isEmpty
                    && (ended?.transcriptLines.count ?? 0) >= 4
                    && (ended?.durationSeconds ?? 0) > 0,
                "\(describe(ended)) todo=\(ended?.todo ?? "-") duration=\(ended?.durationSeconds ?? 0)"
            )
            show(.report(call.id))
            try? await Task.sleep(for: .seconds(4))
        } catch {
            check("places a call", false, error.localizedDescription)
        }
    }

    private func hangUpACall() async {
        do {
            let call = try await model.create(
                NewTaskRequest(
                    kind: .call,
                    goal: "Ask whether the office is open on Saturday.",
                    phoneNumber: "+49301234567",
                    language: .de,
                    summaryLanguage: .en,
                    userName: "Deniz Kaya"
                )
            )
            show(.call(call.id))
            let live = await wait(for: call.id, upTo: 45) {
                $0.status == .inProgress && !$0.lines.isEmpty
            }
            if let live { await model.endCall(live) }
            let ended = await wait(for: call.id, upTo: 20) { !$0.status.isActive }
            check(
                "hangs up when asked, and keeps what was said",
                ended?.status.isActive == false && ended?.problem == .cancelled
                    && !(ended?.lines.isEmpty ?? true),
                describe(ended)
            )
        } catch {
            check("hangs up when asked, and keeps what was said", false, error.localizedDescription)
        }
    }

    private func answerACall() async {
        guard let incoming = await model.simulateIncomingCall(callerLanguage: .de) else {
            check("answers a call", false, model.errorMessage ?? "no task came back")
            return
        }
        show(.call(incoming.id))
        let ended = await wait(for: incoming.id, upTo: 120) {
            !$0.status.isActive && !$0.isAwaitingReport
        }
        check(
            "answers a call and writes down who rang and why",
            ended?.isInbound == true && ended?.status == .completed
                && !(ended?.summary ?? "").isEmpty && (ended?.lines.count ?? 0) >= 2,
            "\(describe(ended)) title=\(ended?.title ?? "-")"
        )
        check(
            "marks the message as waiting for the owner",
            ended.map { model.isWaiting($0) } == true,
            "waiting=\(model.waitingCount)"
        )
        show(.report(incoming.id))
        try? await Task.sleep(for: .seconds(4))
        check(
            "stops marking it once it has been opened",
            model.task(withID: incoming.id).map { model.isWaiting($0) } == false,
            "waiting=\(model.waitingCount)"
        )
    }

    private func handlePaperwork() async {
        do {
            let letter = try await model.create(
                NewTaskRequest(
                    kind: .letter,
                    goal: "Explain this letter and tell me what I have to do.",
                    language: .de,
                    summaryLanguage: .en,
                    documentText: "Sehr geehrte Frau Kaya, bitte überweisen Sie 45 Euro bis zum 1. Dezember."
                )
            )
            let read = await wait(for: letter.id, upTo: 30) { !$0.status.isActive }
            // This server has no AI key: the honest answer is "not set up yet",
            // not "completed".
            check(
                "takes in a letter, and says that nobody can read it yet",
                read?.status == .failed && read?.problem == .reportsOff,
                describe(read)
            )

            let reminder = try await model.create(
                NewTaskRequest(
                    kind: .followup,
                    goal: "Call the landlord back about the heating.",
                    summaryLanguage: .en,
                    todoWhen: DateFormatting.due(Date().addingTimeInterval(86_400))
                )
            )
            let scheduled = await wait(for: reminder.id, upTo: 30) { $0.status == .scheduled }
            check(
                "schedules a reminder",
                scheduled?.status == .scheduled && scheduled?.todoWhen != nil,
                describe(scheduled)
            )
        } catch {
            check("handles paperwork", false, error.localizedDescription)
        }
    }

    // MARK: - A server that asks for its access key

    private func keyPlan() async {
        let server = model.server
        let defaults = UserDefaults.standard
        guard let address = defaults.string(forKey: "yaverSelfTestAddress"),
              let key = defaults.string(forKey: "yaverSelfTestKey")
        else {
            check("has an address and a key to test with", false, "launch arguments missing")
            return
        }

        await server.use(address: address, key: "")
        check(
            "says so when the server wants a key",
            server.status == .needsKey,
            "status=\(server.status)"
        )

        await server.use(address: address, key: "not-the-key")
        check(
            "does not hand a wrong key over",
            server.status == .wrongKey && !server.keyTrusted,
            "status=\(server.status) trusted=\(server.keyTrusted)"
        )

        await server.use(address: address, key: key)
        check(
            "connects with the right key",
            server.isConnected && server.keyTrusted,
            "status=\(server.status) trusted=\(server.keyTrusted)"
        )

        await model.refresh()
        check(
            "loads the tasks with the key",
            server.isConnected && model.errorMessage == nil,
            model.errorMessage ?? "\(model.tasks.count) task(s)"
        )

        // What the server's pairing page opens when its button is tapped.
        var link = URLComponents()
        link.scheme = "yaver"
        link.host = "pair"
        link.queryItems = [
            URLQueryItem(name: "url", value: address),
            URLQueryItem(name: "key", value: key),
        ]
        if let url = link.url, let pairing = ServerStore.Pairing(link: url) {
            let paired = await server.pair(pairing)
            check(
                "connects through a pairing link",
                paired && server.isConnected && server.keyTrusted,
                "status=\(server.status) host=\(pairing.host)"
            )
        } else {
            check("connects through a pairing link", false, "the link was not understood")
        }

        show(.settings)
        try? await Task.sleep(for: .seconds(3))
    }

    // MARK: - Plumbing

    private func check(_ name: String, _ ok: Bool, _ detail: String = "") {
        report.checks.append(Check(name: name, ok: ok, detail: detail))
        save()
    }

    private func save() {
        guard let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
              let data = try? JSONEncoder().encode(report)
        else { return }
        try? data.write(to: folder.appending(path: "selftest.json"), options: .atomic)
    }

    /// Waits, as a person watching the screen would, until the task looks a
    /// certain way. What comes back is the task as the screens see it.
    private func wait(
        for id: String, upTo seconds: Double, until condition: (SecretaryTask) -> Bool
    ) async -> SecretaryTask? {
        let deadline = Date().addingTimeInterval(seconds)
        while Date() < deadline {
            if let task = model.task(withID: id), condition(task) { return task }
            try? await Task.sleep(for: .milliseconds(150))
        }
        return model.task(withID: id)
    }

    private func describe(_ task: SecretaryTask?) -> String {
        guard let task else { return "no task" }
        return "status=\(task.status.rawValue) lines=\(task.lines.count) "
            + "source=\(task.summarySource ?? "-") error=\(task.errorCode ?? "-") "
            + "summary=\((task.summary ?? "").prefix(70))"
    }
}
#endif
