import Foundation
import Observation

@Observable
@MainActor
final class SecretaryViewModel {
    private(set) var tasks: [SecretaryTask] = []
    var isLoading = false
    /// The last thing that went wrong, in words for the user. Cleared by the
    /// next thing that works.
    var errorMessage: String?

    let server: ServerStore
    private var pollTask: Task<Void, Never>?
    /// Set when the screens are fed from fixtures and nothing may touch the network.
    private let isStaged: Bool
    /// Handed-back tasks whose report the user has opened. Kept on the phone:
    /// what has been read is a fact about this reader, not about the task.
    private var seenTaskIDs: Set<String>

    private static let seenKey = "yaver.seenTasks"

    init(server: ServerStore? = nil, staged tasks: [SecretaryTask]? = nil) {
        self.server = server ?? .shared
        isStaged = tasks != nil
        self.tasks = tasks ?? []
        seenTaskIDs = tasks == nil
            ? Set(UserDefaults.standard.stringArray(forKey: Self.seenKey) ?? [])
            : []
    }

    // MARK: - Derived state the screens read

    var activeTasks: [SecretaryTask] { tasks.filter { $0.status.isActive } }
    var hasActiveTasks: Bool { !activeTasks.isEmpty }
    var hasActiveCall: Bool { tasks.contains { $0.kind == .call && $0.status.isActive } }

    var completedCount: Int { tasks.filter { $0.status == .completed }.count }

    /// Tasks the secretary has handed back and the user has not looked at yet.
    var waitingCount: Int { tasks.filter(isWaiting).count }

    /// Something for the user to read: a draft to check, a question to answer,
    /// a message a caller left. It stops waiting once its report is opened.
    func isWaiting(_ task: SecretaryTask) -> Bool {
        guard !seenTaskIDs.contains(task.id) else { return false }
        switch task.status {
        case .needsInput, .draft: return true
        case .completed: return task.isInbound
        default: return false
        }
    }

    /// The user has the report of this task in front of them.
    func markSeen(_ task: SecretaryTask) {
        guard !isStaged, isWaiting(task) else { return }
        seenTaskIDs.insert(task.id)
        // Remember only tasks that still exist, so the list cannot grow for ever.
        let current = Set(tasks.map(\.id))
        seenTaskIDs.formIntersection(current)
        UserDefaults.standard.set(Array(seenTaskIDs), forKey: Self.seenKey)
    }

    func task(withID id: String) -> SecretaryTask? {
        tasks.first { $0.id == id }
    }

    private var api: APIClient { APIClient(server.endpoint) }

    // MARK: - Loading

    /// Connects if need be, then loads the ledger. Safe to call often.
    func refresh() async {
        guard !isStaged else { return }
        isLoading = tasks.isEmpty
        defer { isLoading = false }

        if !server.isConnected {
            guard await server.connect() else { return }
        }
        do {
            tasks = try await api.listTasks()
            errorMessage = nil
            managePolling()
        } catch {
            await handle(error)
        }
    }

    /// A request failed. If the server has gone quiet, look for it again — the
    /// computer may simply have a new address — and say what is wrong if it
    /// cannot be found.
    private func handle(_ error: Error) async {
        guard let apiError = error as? APIError else {
            errorMessage = error.localizedDescription
            return
        }
        switch apiError {
        case .unreachable, .keyRequired, .keyInvalid:
            if await server.connect(), let fresh = try? await api.listTasks() {
                tasks = fresh
                errorMessage = nil
                managePolling()
            }
        default:
            errorMessage = apiError.localizedDescription
        }
    }

    @discardableResult
    func create(_ request: NewTaskRequest) async throws -> SecretaryTask {
        if !server.isConnected { _ = await server.connect() }
        let task = try await api.createTask(request)
        tasks.removeAll { $0.id == task.id }
        tasks.insert(task, at: 0)
        managePolling()
        return task
    }

    /// Hangs up a call that is under way.
    func endCall(_ task: SecretaryTask) async {
        do {
            let ended = try await api.cancelTask(id: task.id)
            replace(ended)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Simulator only: plays a call that the secretary answers, so the user can
    /// see what "answer my calls" looks like before buying a number.
    func simulateIncomingCall(callerLanguage: Language) async -> SecretaryTask? {
        do {
            let task = try await api.simulateIncomingCall(callerLanguage: callerLanguage)
            replace(task)
            managePolling()
            return task
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    private func replace(_ task: SecretaryTask) {
        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
            tasks[index] = task
        } else {
            tasks.insert(task, at: 0)
        }
    }

    /// Turns a report's "still to do" line into a reminder of its own, which is
    /// what the design's *Add reminder* button does.
    func addReminder(for task: SecretaryTask) async {
        guard let todo = task.todo, !todo.isEmpty else { return }
        do {
            try await create(
                NewTaskRequest(
                    kind: .reminder,
                    goal: todo,
                    summaryLanguage: task.summaryLanguage,
                    todoWhen: task.todoWhen
                )
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// True once a reminder exists for this task's outstanding item.
    func hasReminder(for task: SecretaryTask) -> Bool {
        guard let todo = task.todo else { return false }
        return tasks.contains { $0.kind == .reminder && $0.goal == todo }
    }

    // MARK: - Profile

    /// Tells the server who the secretary works for. It needs the name and the
    /// two languages to answer calls and write notes when the app is not open:
    /// callers are greeted in the language calls are usually in, and the note
    /// is written in the language the owner reads.
    func syncProfile(name: String, language: Language, callLanguage: Language) async {
        guard !isStaged, server.isConnected, server.health?.isCurrent == true else { return }
        var profile = server.session?.profile ?? ServerProfile()
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let wanted: String? = trimmed.isEmpty ? nil : trimmed
        guard profile.name != wanted || profile.language != language
            || profile.callLanguage != callLanguage
        else { return }
        profile.name = wanted
        profile.language = language
        profile.callLanguage = callLanguage
        if let saved = try? await api.saveProfile(profile) {
            server.setSession(profile: saved)
        }
    }

    /// Switches call answering on or off, or changes the note for callers.
    /// Returns nil on success, or the reason it could not be done.
    func saveAnswering(enabled: Bool, note: String) async -> String? {
        var profile = server.session?.profile ?? ServerProfile()
        profile.answerCalls = enabled
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        profile.answerNote = trimmed.isEmpty ? nil : trimmed
        do {
            let saved = try await api.saveProfile(profile)
            server.setSession(profile: saved)
            managePolling()
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    // MARK: - Polling
    //
    // The app has no push channel, so anything that changes on the server is
    // seen by asking: often while a call is live (the transcript should feel
    // live), slowly while only paperwork is in flight, and now and then when
    // the secretary is answering calls and one could come in at any time.

    private var pollInterval: Duration? {
        if hasActiveCall { return .milliseconds(1_200) }
        // The call is over; its report is still being written.
        if tasks.contains(where: \.isAwaitingReport) { return .seconds(2) }
        if hasActiveTasks { return .seconds(3) }
        if server.session?.profile.answerCalls == true { return .seconds(20) }
        return nil
    }

    private func managePolling() {
        guard !isStaged, pollTask == nil, pollInterval != nil else { return }
        pollTask = Task { [weak self] in
            // How many times in a row the server could not be found.
            var misses = 0
            while let self, !Task.isCancelled, let interval = self.pollInterval {
                try? await Task.sleep(for: interval)
                if Task.isCancelled { break }
                do {
                    self.tasks = try await self.api.listTasks()
                    self.errorMessage = nil
                    misses = 0
                } catch {
                    // One missed poll is nothing. A server that has gone is
                    // looked for — and looked for again, at a gentler pace,
                    // for as long as there is something to follow: the Wi-Fi
                    // that dropped during a call is usually back in a moment,
                    // and the screen must pick the call up again by itself.
                    guard let apiError = error as? APIError, apiError.isConnectionFailure else {
                        continue
                    }
                    if await self.server.connect() {
                        misses = 0
                    } else {
                        misses += 1
                        try? await Task.sleep(for: .seconds(min(30, 5 * misses)))
                    }
                }
            }
            self?.pollTask = nil
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }
}
