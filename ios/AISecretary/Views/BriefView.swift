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
    @State private var notificationsOff = false
    @State private var pendingCreated: SecretaryTask?
    @State private var showingCamera = false
    @State private var photoItem: PhotosPickerItem?
    @State private var showingPhotoPicker = false
    /// When a follow-up is due. Tomorrow, same time, to start with.
    @State private var dueDate = Date().addingTimeInterval(24 * 3600)
    /// True while a photograph is being read into text.
    @State private var isReadingDocument = false
    /// Set when a photo was taken but no text could be read from it.
    @State private var documentUnreadable = false
    /// The AI services this task would go to that the user has not allowed yet.
    @State private var consentAsked: [AIService]?
    /// Screenshots only: open with the permission question on screen.
    private let asksConsentAtOnce: Bool

    /// What the server accepts.
    /// The name as the server takes it: trimmed, of a sensible length, or none.
    private static func cleanName(_ name: String) -> String? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : String(trimmed.prefix(80))
    }

    private static let goalLimit = 2_000
    private static let documentLimit = 20_000

    private static var exampleGoal: String {
        L("Call my dentist and book a check-up appointment for next week, mornings preferred.")
    }

    private static let examplePhone = "+49 30 1234567"

    init(
        kind: TaskKind,
        userName: String,
        reportLanguage: Language,
        callLanguage: Binding<Language>,
        onCancel: @escaping () -> Void,
        onCreated: @escaping (SecretaryTask) -> Void,
        asksConsentAtOnce: Bool = false
    ) {
        self.asksConsentAtOnce = asksConsentAtOnce
        self.kind = kind
        self.userName = userName
        self.reportLanguage = reportLanguage
        _callLanguage = callLanguage
        self.onCancel = onCancel
        self.onCreated = onCreated
        _briefType = State(initialValue: kind)
    }

    private var isCall: Bool { briefType == .call }

    /// A letter, message or form is worked on by Claude on the server. Where
    /// the server has no key for it, say so before anything is typed.
    private var writerMissing: Bool {
        guard briefType == .letter || briefType == .message || briefType == .form else {
            return false
        }
        guard model.server.isConnected, let session = model.server.session else { return false }
        return session.reports != "claude"
    }

    /// A real call says at once on whose behalf the AI is calling — never for
    /// "a client" nobody can name. The name is set once, in Settings.
    private var nameMissing: Bool {
        isCall && model.server.isConnected && !model.server.isSimulated
            && Self.cleanName(userName) == nil
    }

    private var canSubmit: Bool {
        guard !isSubmitting, !isReadingDocument, !writerMissing, !nameMissing,
              goal.trimmingCharacters(in: .whitespacesAndNewlines).count >= 4
        else {
            return false
        }
        guard isCall else { return true }
        guard phoneProblem == nil else { return false }
        return normalizedPhone.hasPrefix("+") && normalizedPhone.count >= 8
    }

    /// The number as the server wants it: international, digits only.
    /// "+49 (0)30 123 45 67" and "0049 30 1234567" are both +49301234567.
    private var normalizedPhone: String {
        // The "(0)" some people write after the country code is not dialled.
        let cleaned = phone.replacingOccurrences(of: "(0)", with: "")
        var digits = cleaned.filter { ($0.isASCII && $0.isNumber) || $0 == "+" }
        if digits.hasPrefix("00") { digits = "+" + digits.dropFirst(2) }
        // "+49 0151 …": the 0 a number starts with inside the country is
        // dropped once the country code stands in front. (Not everywhere —
        // Italy keeps it — so only for the countries where that is the rule.)
        for code in Self.trunkZeroCodes where digits.hasPrefix(code + "0") {
            digits = code + digits.dropFirst(code.count + 1)
            break
        }
        return digits
    }

    private static let trunkZeroCodes = ["+49", "+90", "+44", "+43", "+41", "+31", "+33", "+32"]

    /// The international prefixes of the countries a number is most likely
    /// meant for, by the region the iPhone is set to.
    private static let callingCodes = [
        "DE": "49", "TR": "90", "AT": "43", "CH": "41", "GB": "44", "NL": "31",
        "FR": "33", "BE": "32", "US": "1", "CA": "1",
    ]

    /// A number typed the way it is dialled inside a country ("0151 2345678"),
    /// with the country the iPhone is set to put in front. The country a
    /// number belongs to is not ours to assume — so this is offered for one
    /// tap, not applied.
    private var suggestedPhone: String? {
        let digits = normalizedPhone
        guard isCall, !digits.hasPrefix("+"), !digits.contains("+"),
              let region = Locale.current.region?.identifier,
              let code = Self.callingCodes[region]
        else { return nil }
        let national: Substring
        if code == "1" {
            guard digits.count == 10 else { return nil }
            national = digits[...]
        } else {
            guard digits.hasPrefix("0"), digits.count >= 7 else { return nil }
            national = digits.dropFirst()
        }
        let candidate = "+" + code + national
        let allowed = model.server.session?.allowedCountryPrefixes ?? []
        guard allowed.isEmpty || allowed.contains(where: { candidate.hasPrefix($0) }) else {
            return nil
        }
        return candidate
    }

    /// Why the number cannot be called, if the server would refuse it.
    private var phoneProblem: String? {
        guard isCall, !phone.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        guard normalizedPhone.hasPrefix("+") else {
            return L("Write the number with its country code in place of the first 0 — for example +49 for Germany or +90 for Türkiye.")
        }
        let allowed = model.server.session?.allowedCountryPrefixes ?? []
        if !allowed.isEmpty, !allowed.contains(where: { normalizedPhone.hasPrefix($0) }) {
            return Lf("Your server only calls numbers starting with %@.", allowed.joined(separator: ", "))
        }
        return nil
    }

    var body: some View {
        VStack(spacing: 0) {
            HeaderBar {
                HStack(spacing: 6) {
                    IconButton(glyph: .close, accessibilityLabel: L("Cancel"), action: onCancel)
                        .padding(.leading, -10)
                        // Once the task is on its way it cannot be taken back here.
                        .disabled(isSubmitting)
                    Wordmark(title: L("New task"))
                }
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    typeField
                    if writerMissing {
                        Notice(
                            title: CallProblem.reportsOff.title,
                            message: CallProblem.reportsOff.explanation,
                            tone: .accent
                        )
                    }
                    goalField
                    if isCall {
                        phoneField
                    }
                    if nameMissing {
                        Notice(
                            title: L("Your name is missing."),
                            message: L("Yaver says at the start of every real call on whose behalf it is calling. Add your name in Settings, then come back."),
                            tone: .accent
                        )
                    }
                    if briefType == .followup {
                        dueField
                    } else {
                        callLanguageField
                    }
                    if briefType.takesDocument {
                        documentButton
                    }
                    if isCall, model.server.isConnected, model.server.isSimulated {
                        Notice(
                            title: L("Calls are simulated"),
                            message: L("Your server is not connected to a phone service yet, so this call will be acted out, not placed.")
                        )
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
            // Reading the text takes a few seconds after the camera has gone:
            // say so, and do not let the task go without its document meanwhile.
            DocumentCamera(
                onBegin: {
                    isReadingDocument = true
                    documentUnreadable = false
                },
                onFinish: { text in
                    isReadingDocument = false
                    keepDocument(text)
                }
            )
            .ignoresSafeArea()
        }
        .photosPicker(isPresented: $showingPhotoPicker, selection: $photoItem, matching: .images)
        // Before anything personal goes to an AI service for the first time.
        .aiConsentQuestion($consentAsked, onAllow: submit)
        .task {
            if asksConsentAtOnce { consentAsked = [.phoneCalls, .writing] }
            // So "Calls are simulated" is only said of a server that still
            // simulates them.
            await model.server.refreshSession()
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            isReadingDocument = true
            documentUnreadable = false
            Task {
                let text = await DocumentText.recognize(in: item)
                keepDocument(text)
                photoItem = nil
                isReadingDocument = false
            }
        }
        .alert(
            L("Could not send the task"),
            isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )
        ) {
            Button(L("OK")) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
        .alert(L("Saved, but it will not ring"), isPresented: $notificationsOff) {
            Button(L("OK")) {
                if let pendingCreated { onCreated(pendingCreated) }
            }
        } message: {
            Text(L("Notifications are switched off for Yaver. The follow-up is on your list; to be reminded, allow notifications in the iPhone’s Settings."))
        }
    }

    // MARK: - Fields

    private var typeField: some View {
        Field(label: L("Type")) {
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
        Field(label: L("What should Yaver do?")) {
            DSTextEditor(
                placeholder: Lf("e.g. %@", Self.exampleGoal),
                text: $goal,
                minHeight: 128,
                fontSize: 16
            )
        }
    }

    private var phoneField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Field(label: L("Who to call")) {
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
            if let phoneProblem {
                Text(phoneProblem)
                    .typeStyle(.captionSmall)
                    .foregroundStyle(Modernist.Accent.s700)
            }
            if let suggestedPhone {
                Button {
                    phone = suggestedPhone
                } label: {
                    HStack(spacing: 6) {
                        Text(Lf("Use %@", suggestedPhone))
                        Icon(glyph: .arrowRight, size: 14)
                    }
                }
                .buttonStyle(
                    ModernistButtonStyle(
                        variant: .ghost, fontSize: 14, horizontalPadding: 0, verticalPadding: 8,
                        hitSlop: 6
                    )
                )
            }
        }
    }

    private var callLanguageField: some View {
        Field(label: isCall ? L("Call language") : L("Language to write in")) {
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

    /// When to be reminded. The reminder is a notification on this iPhone.
    private var dueField: some View {
        Field(label: L("Remind me on")) {
            DatePicker(
                L("Remind me on"),
                selection: $dueDate,
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .labelsHidden()
            .datePickerStyle(.compact)
            .tint(Modernist.accent)
            .environment(\.locale, L10n.locale)
            .frame(maxWidth: .infinity, alignment: .leading)
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
            .disabled(isReadingDocument)

            if documentUnreadable {
                Text(L("No text could be read from the photo. Try again, flat and in good light."))
                    .typeStyle(.captionSmall)
                    .foregroundStyle(Modernist.Accent.s700)
            } else if !documentText.isEmpty {
                Text(L("Only the text is sent — the photograph stays on your phone."))
                    .typeStyle(.captionSmall)
                    .foregroundStyle(Modernist.Neutral.s700)
            }
        }
    }

    /// Takes the text read from a photo — or says that there was none, rather
    /// than leaving the screen looking as if nothing had happened.
    private func keepDocument(_ text: String) {
        if text.isEmpty {
            documentUnreadable = true
        } else {
            documentText = text
            documentUnreadable = false
        }
    }

    private var documentButtonTitle: String {
        if isReadingDocument { return L("Reading the document…") }
        return documentText.isEmpty
            ? L("Add a photo of the document")
            : Lf("Document read · %d characters", documentText.count)
    }

    private var exampleButton: some View {
        Button {
            briefType = .call
            goal = Self.exampleGoal
            // A made-up number is right for a simulated call. A server that
            // places real calls would ring whoever has it: then the number is
            // left for the user to type.
            let simulated = model.server.session?.simulated ?? model.server.health?.simulated ?? false
            phone = simulated ? Self.examplePhone : ""
        } label: {
            Text(L("Use an example brief"))
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
                L("Yaver says at once that it is an AI calling on your behalf. This disclosure is required by law and cannot be turned off.")
            )
            .typeStyle(.smallTight)
            .foregroundStyle(Modernist.Neutral.s700)
        }
    }

    // MARK: - Submitting

    private var submitLabel: String {
        isCall ? L("Place the call") : L("Send to Yaver")
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
            // What the server is set up for decides what has to be asked
            // first. Read it fresh: a server that places real calls or writes
            // with Claude since the app last looked must not pass for a
            // simulation.
            await model.server.refreshSession()
            let missing = AIConsent.missing(for: briefType, server: model.server)
            guard missing.isEmpty else {
                consentAsked = missing
                return
            }
            do {
                let created = try await model.create(
                    NewTaskRequest(
                        kind: briefType,
                        goal: String(
                            goal.trimmingCharacters(in: .whitespacesAndNewlines)
                                .prefix(Self.goalLimit)
                        ),
                        phoneNumber: isCall ? normalizedPhone : nil,
                        // For a call this is the language spoken; for a letter
                        // or a message it is the language the other side reads.
                        language: callLanguage,
                        summaryLanguage: reportLanguage,
                        userName: Self.cleanName(userName),
                        // Only the kinds that work from a document take one
                        // along; a scan made before the type was changed stays behind.
                        documentText: briefType.takesDocument && !documentText.isEmpty
                            ? String(documentText.prefix(Self.documentLimit))
                            : nil,
                        todoWhen: briefType == .followup ? DateFormatting.due(dueDate) : nil
                    )
                )
                if created.kind == .followup {
                    let scheduled = await Reminders.schedule(
                        id: created.id, text: created.goal, at: dueDate
                    )
                    if !scheduled {
                        // Saved, but it will not ring: say so before moving on.
                        notificationsOff = true
                        pendingCreated = created
                        return
                    }
                }
                onCreated(created)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
