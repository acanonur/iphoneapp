import Foundation
import Observation

@Observable
@MainActor
final class CallsViewModel {
    var calls: [CallTask] = []
    var isLoading = false
    var errorMessage: String?

    private let api = APIClient()
    private var pollTask: Task<Void, Never>?

    var hasActiveCalls: Bool {
        calls.contains { $0.status.isActive }
    }

    func refresh() async {
        isLoading = calls.isEmpty
        defer { isLoading = false }
        do {
            calls = try await api.listCalls()
            errorMessage = nil
            managePolling()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func create(goal: String, phoneNumber: String, language: Language,
                summaryLanguage: Language, userName: String?) async throws -> CallTask {
        let task = try await api.createCall(NewCallRequest(
            goal: goal,
            phoneNumber: phoneNumber,
            language: language,
            summaryLanguage: summaryLanguage,
            userName: userName?.isEmpty == true ? nil : userName
        ))
        calls.insert(task, at: 0)
        managePolling()
        return task
    }

    func call(withID id: String) -> CallTask? {
        calls.first { $0.id == id }
    }

    /// Polls while any call is still in flight so status/transcript update live.
    private func managePolling() {
        if hasActiveCalls, pollTask == nil {
            pollTask = Task { [weak self] in
                while let self, !Task.isCancelled, self.hasActiveCalls {
                    try? await Task.sleep(for: .seconds(3))
                    if let fresh = try? await self.api.listCalls() {
                        self.calls = fresh
                    }
                }
                self?.pollTask = nil
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }
}
