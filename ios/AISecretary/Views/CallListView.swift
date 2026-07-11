import SwiftUI

struct CallListView: View {
    @Environment(CallsViewModel.self) private var model
    @State private var showingNewCall = false

    var body: some View {
        NavigationStack {
            Group {
                if model.calls.isEmpty && !model.isLoading {
                    emptyState
                } else {
                    callList
                }
            }
            .navigationTitle("AI Secretary")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingNewCall = true
                    } label: {
                        Label("New call", systemImage: "phone.badge.plus")
                    }
                }
            }
            .sheet(isPresented: $showingNewCall) {
                NewCallView()
            }
            .task { await model.refresh() }
            .refreshable { await model.refresh() }
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No calls yet", systemImage: "phone.arrow.up.right")
        } description: {
            Text("Tell your AI secretary what to do — it makes the phone call for you in German, English or Turkish and reports back.")
        } actions: {
            Button("Make your first call") { showingNewCall = true }
                .buttonStyle(.borderedProminent)
        }
    }

    private var callList: some View {
        List {
            if let error = model.errorMessage {
                Section {
                    Label(error, systemImage: "wifi.exclamationmark")
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
            }
            ForEach(model.calls) { call in
                NavigationLink(value: call.id) {
                    CallRowView(call: call)
                }
            }
        }
        .navigationDestination(for: String.self) { id in
            CallDetailView(callID: id)
        }
    }
}

struct CallRowView: View {
    let call: CallTask

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(call.goal)
                .font(.headline)
                .lineLimit(2)
            HStack(spacing: 8) {
                StatusBadge(status: call.status)
                Text(call.phoneNumber)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                if let date = call.createdDate {
                    Text(date, style: .relative)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

struct StatusBadge: View {
    let status: CallStatus

    var body: some View {
        Text(status.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(status.color.opacity(0.15), in: Capsule())
            .foregroundStyle(status.color)
    }
}
