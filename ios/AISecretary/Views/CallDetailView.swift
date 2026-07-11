import SwiftUI

struct CallDetailView: View {
    @Environment(CallsViewModel.self) private var model
    let callID: String

    private var call: CallTask? { model.call(withID: callID) }

    var body: some View {
        Group {
            if let call {
                content(for: call)
            } else {
                ProgressView()
            }
        }
        .navigationTitle("Call")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func content(for call: CallTask) -> some View {
        List {
            Section("Task") {
                Text(call.goal)
                LabeledContent("Number", value: call.phoneNumber)
                LabeledContent("Language", value: call.language.displayName)
                HStack {
                    Text("Status")
                    Spacer()
                    StatusBadge(status: call.status)
                }
                if call.status.isActive {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Your secretary is working on it — this updates automatically.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if let error = call.error {
                Section("Problem") {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
            }

            if call.summary != nil || call.outcome != nil {
                Section("Report") {
                    if let outcome = call.outcome {
                        Text(outcome.label)
                            .font(.subheadline.weight(.semibold))
                    }
                    if let summary = call.summary {
                        Text(summary)
                    }
                }
            }

            if let transcript = call.transcript {
                Section("Transcript") {
                    Text(transcript)
                        .font(.footnote.monospaced())
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
            }
        }
    }
}
