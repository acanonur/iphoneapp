import SwiftUI

struct NewCallView: View {
    @Environment(CallsViewModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @AppStorage("aisecretary.userName") private var userName = ""
    @AppStorage("aisecretary.summaryLanguage") private var summaryLanguageRaw = Language.en.rawValue

    @State private var goal = ""
    @State private var phoneNumber = ""
    @State private var language: Language = .de
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private var summaryLanguage: Binding<Language> {
        Binding(
            get: { Language(rawValue: summaryLanguageRaw) ?? .en },
            set: { summaryLanguageRaw = $0.rawValue }
        )
    }

    private var canSubmit: Bool {
        goal.trimmingCharacters(in: .whitespacesAndNewlines).count >= 4 &&
            phoneNumber.hasPrefix("+") && phoneNumber.count >= 8 && !isSubmitting
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("What should the secretary do?") {
                    TextField(
                        "e.g. Call my dentist and book a check-up appointment for next week, mornings preferred.",
                        text: $goal,
                        axis: .vertical
                    )
                    .lineLimit(4 ... 8)
                }

                Section("Who to call") {
                    TextField("+49 30 1234567", text: $phoneNumber)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                    Picker("Call language", selection: $language) {
                        ForEach(Language.allCases) { lang in
                            Text(lang.displayName).tag(lang)
                        }
                    }
                }

                Section("Your details") {
                    TextField("Your name (said on the call)", text: $userName)
                        .textContentType(.name)
                    Picker("Report language", selection: summaryLanguage) {
                        ForEach(Language.allCases) { lang in
                            Text(lang.displayName).tag(lang)
                        }
                    }
                }

                Section {
                    Text("The assistant introduces itself as an AI calling on your behalf — this disclosure is legally required and cannot be turned off.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("New call")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        submit()
                    } label: {
                        if isSubmitting {
                            ProgressView()
                        } else {
                            Text("Call")
                        }
                    }
                    .disabled(!canSubmit)
                }
            }
            .alert("Could not start the call", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func submit() {
        isSubmitting = true
        let cleanedNumber = phoneNumber.replacingOccurrences(of: " ", with: "")
        Task {
            defer { isSubmitting = false }
            do {
                _ = try await model.create(
                    goal: goal.trimmingCharacters(in: .whitespacesAndNewlines),
                    phoneNumber: cleanedNumber,
                    language: language,
                    summaryLanguage: summaryLanguage.wrappedValue,
                    userName: userName.trimmingCharacters(in: .whitespaces)
                )
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
