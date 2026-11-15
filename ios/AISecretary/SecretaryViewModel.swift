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

    init(server: ServerStore? = nil, staged tasks: [SecretaryTask]? = nil) {
        self.server = server ?? .shared
        isStaged = tasks != nil
        self.tasks = tasks ?? []
    }

    // MARK: - Derived state the screens read

    var activeTasks: [SecretaryTask] { tasks.filter { $0.status.isActive } }
    var hasActiveTasks: Bool { !activeTasks.isEmpty }
    var hasActiveCall: Bool { tasks.contains { $0.kind == .call && $0.status.isActive } }

    var completedCount: Int { tasks.filter { $0.status == .completed }.count }

    /// Tasks the secretary has handed back and is waiting on the user for.
    var waitingCount: Int {
        tasks.filter { $0.status == .needsInput || $0.status == .draft }.count
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
    /// language to answer calls and write notes when the app is not open.
    func syncProfile(name: String, language: Language) async {
        guard !isStaged, server.isConnected, server.health?.isCurrent == true else { return }
        var profile = server.session?.profile ?? ServerProfile()
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let wanted: String? = trimmed.isEmpty ? nil : trimmed
        guard profile.name != wanted || profile.language != language else { return }
        profile.name = wanted
        profile.language = language
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
        if hasActiveTasks { return .seconds(3) }
        if server.session?.profile.answerCalls == true { return .seconds(20) }
        return nil
    }

    private func managePolling() {
        guard !isStaged, pollTask == nil, pollInterval != nil else { return }
        pollTask = Task { [weak self] in
            while let self, !Task.isCancelled, let interval = self.pollInterval {
                try? await Task.sleep(for: interval)
                if Task.isCancelled { break }
                do {
                    self.tasks = try await self.api.listTasks()
                    self.errorMessage = nil
                } catch {
                    // One missed poll is nothing; a server that has gone is
                    // looked for, and the loop ends if it cannot be found.
                    if let apiError = error as? APIError, apiError.isConnectionFailure {
                        if !(await self.server.connect()) { break }
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
