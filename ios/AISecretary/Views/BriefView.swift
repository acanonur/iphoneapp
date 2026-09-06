import PhotosUI
import SwiftUI

/// One form for every kind of task. Pick what it is, say what you want in your
/// own words, and add whatever that kind needs — a number for a call, a
/// photograph for a letter or a form.
struct BriefView: View {
    @Environment(SecretaryViewModel.self) private var model

    let kind: TaskKind
    let userName: String
    let reportLanguage: Language
    @Binding var callLanguage: Language
    var onCancel: () -> Void
    var onCreated: (SecretaryTask) -> Void

    @State private var briefType: TaskKind
    @State private var goal = ""
    @State private var phone = ""
    @State private var documentText = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var showingCamera = false
    @State private var photoItem: PhotosPickerItem?
    @State private var showingPhotoPicker = false

    private static let exampleGoal =
        "Call my dentist and book a check-up appointment for next week, mornings preferred."
    private static let examplePhone = "+49 30 1234567"

    init(
        kind: TaskKind,
        userName: String,
        reportLanguage: Language,
        callLanguage: Binding<Language>,
        onCancel: @escaping () -> Void,
        onCreated: @escaping (SecretaryTask) -> Void
    ) {
        self.kind = kind
        self.userName = userName
        self.reportLanguage = reportLanguage
        _callLanguage = callLanguage
        self.onCancel = onCancel
        self.onCreated = onCreated
        _briefType = State(initialValue: kind)
    }

    private var isCall: Bool { briefType == .call }

    private var canSubmit: Bool {
        guard !isSubmitting, goal.trimmingCharacters(in: .whitespacesAndNewlines).count >= 4 else {
            return false
        }
        guard isCall else { return true }
        let digits = phone.replacingOccurrences(of: " ", with: "")
        return digits.hasPrefix("+") && digits.count >= 8
    }

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar {
                HStack(spacing: 6) {
                    IconButton(glyph: .close, accessibilityLabel: "Cancel", action: onCancel)
                        .padding(.leading, -10)
                    Wordmark(title: "New task")
                }
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    typeField
                    goalField
                    if isCall {
                        phoneField
                        callLanguageField
                    }
                    if briefType.takesDocument {
                        documentButton
                    }
                    exampleButton
                    disclosureNote
                }
                .padding(.horizontal, Modernist.gutter)
                .padding(.top, 16)
                .padding(.bottom, 20)
            }
            .scrollDismissesKeyboard(.interactively)

            FooterBar {
                Button(action: submit) {
                    ButtonLabel(title: submitLabel, icon: submitIcon)
                }
                .buttonStyle(
                    ModernistButtonStyle(variant: .primary, block: true, height: 56, fontSize: 16)
                )
                .disabled(!canSubmit)
            }
        }
        .fullScreenCover(isPresented: $showingCamera) {
            DocumentCamera { text in
                if !text.isEmpty { documentText = text }
            }
            .ignoresSafeArea()
        }
        .photosPicker(isPresented: $showingPhotoPicker, selection: $photoItem, matching: .images)
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                let text = await DocumentText.recognize(in: item)
                if !text.isEmpty { documentText = text }
                photoItem = nil
            }
        }
        .alert("Could not send the task", isPresented: .constant(errorMessage != nil)) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // MARK: - Fields

    private var typeField: some View {
        Field(label: "Type") {
            SegmentedControl(
                values: TaskKind.briefable,
                selection: $briefType,
                padding: EdgeInsets(top: 10, leading: 8, bottom: 10, trailing: 8)
            ) { kind, _ in
                VStack(alignment: .leading, spacing: 10) {
                    Icon(glyph: kind.glyph, size: 16)
                    Text(kind.briefLabel)
                        .typeStyle(TypeStyle(size: 11, weight: .regular, lineHeight: 1.15))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
        }
    }

    private var goalField: some View {
        Field(label: "What should the secretary do?") {
            DSTextEditor(
                placeholder: "e.g. \(Self.exampleGoal)",
                text: $goal,
                minHeight: 128,
                fontSize: 16
            )
        }
    }

    private var phoneField: some View {
        Field(label: "Who to call") {
            DSTextField(
                placeholder: Self.examplePhone,
                text: $phone,
                minHeight: 48,
                fontSize: 17,
                tabularNumbers: true,
                keyboard: .phonePad,
                textContentType: .telephoneNumber
            )
        }
    }

    private var callLanguageField: some View {
        Field(label: "Call language") {
            SegmentedControl(
                values: Language.allCases,
                selection: $callLanguage,
                padding: EdgeInsets(top: 11, leading: 12, bottom: 11, trailing: 12)
            ) { language, _ in
                Text(language.displayName)
                    .typeStyle(TypeStyle(size: 14, weight: .regular, lineHeight: 1.2))
            }
        }
    }

    /// Photographs the letter or form and keeps only the text it reads.
    private var documentButton: some View {
        VStack(alignment: .leading, spacing: Modernist.Space.s2) {
            Button {
                if DocumentCamera.isSupported { showingCamera = true } else { showingPhotoPicker = true }
            } label: {
                ButtonLabel(title: documentButtonTitle, icon: .camera)
            }
            .buttonStyle(
                ModernistButtonStyle(variant: .secondary, block: true, height: 48, fontSize: 14)
            )

            if !documentText.isEmpty {
                Text("Only the text is sent — the photograph stays on your phone.")
                    .typeStyle(.captionSmall)
                    .foregroundStyle(Modernist.Neutral.s700)
            }
        }
    }

    private var documentButtonTitle: String {
        documentText.isEmpty
            ? "Add a photo of the document"
            : "Document read · \(documentText.count) characters"
    }

    private var exampleButton: some View {
        Button {
            briefType = .call
            goal = Self.exampleGoal
            phone = Self.examplePhone
        } label: {
            Text("Use an example brief")
        }
        .buttonStyle(ModernistButtonStyle(variant: .ghost))
        .padding(.top, -8)
        .padding(.leading, -4)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var disclosureNote: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rule()
                .padding(.bottom, 12)
            Text(
                "The secretary introduces itself as an AI calling on your behalf. This disclosure is legally required and cannot be turned off."
            )
            .typeStyle(.smallTight)
            .foregroundStyle(Modernist.Neutral.s700)
        }
    }

    // MARK: - Submitting

    private var submitLabel: String {
        isCall ? "Place the call" : "Send to the secretary"
    }

    /// The design gives the call its phone glyph and the document kinds an
    /// arrow; a message or follow-up submits with the label alone.
    private var submitIcon: Lucide? {
        if isCall { return .phone }
        return briefType.takesDocument ? .arrowRight : nil
    }

    private func submit() {
        guard canSubmit else { return }
        isSubmitting = true
        Task {
            defer { isSubmitting = false }
            do {
                let created = try await model.create(
                    NewTaskRequest(
                        kind: briefType,
                        goal: goal.trimmingCharacters(in: .whitespacesAndNewlines),
                        phoneNumber: isCall
                            ? phone.replacingOccurrences(of: " ", with: "")
                            : nil,
                        // For a call this is the language spoken; for a letter
                        // or a message it is the language the other side reads.
                        language: callLanguage,
                        summaryLanguage: reportLanguage,
                        userName: userName.isEmpty ? nil : userName,
                        documentText: documentText.isEmpty ? nil : documentText
                    )
                )
                onCreated(created)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
