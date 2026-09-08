import Foundation
import Observation

@Observable
@MainActor
final class SecretaryViewModel {
    private(set) var tasks: [SecretaryTask] = []
    var isLoading = false
    var errorMessage: String?

    private let api = APIClient()
    private var pollTask: Task<Void, Never>?

    // MARK: - Derived state the screens read

    var activeTasks: [SecretaryTask] { tasks.filter { $0.status.isActive } }
    var hasActiveTasks: Bool { !activeTasks.isEmpty }

    /// The call the live screen follows: the newest one still running.
    var liveCall: SecretaryTask? {
        tasks.first { $0.kind == .call && $0.status.isActive }
    }

    var completedCount: Int { tasks.filter { $0.status == .completed }.count }

    /// Tasks the secretary has handed back and is waiting on the user for.
    var waitingCount: Int {
        tasks.filter { $0.status == .needsInput || $0.status == .draft }.count
    }

    func task(withID id: String) -> SecretaryTask? {
        tasks.first { $0.id == id }
    }

    // MARK: - Loading

    func refresh() async {
        isLoading = tasks.isEmpty
        defer { isLoading = false }
        do {
            tasks = try await api.listTasks()
            errorMessage = nil
            managePolling()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @discardableResult
    func create(_ request: NewTaskRequest) async throws -> SecretaryTask {
        let task = try await api.createTask(request)
        tasks.insert(task, at: 0)
        managePolling()
        return task
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

    // MARK: - Polling
    //
    // Anything in flight — a call being placed, a letter being read — updates
    // by polling; the app has no push channel yet.

    private func managePolling() {
        guard hasActiveTasks, pollTask == nil else { return }
        pollTask = Task { [weak self] in
            while let self, !Task.isCancelled, self.hasActiveTasks {
                try? await Task.sleep(for: .seconds(3))
                if Task.isCancelled { break }
                if let fresh = try? await self.api.listTasks() {
                    self.tasks = fresh
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
