import AVFoundation
import Foundation
import Observation
import Speech

/// Live microphone speech-to-text built on Apple's Speech framework.
/// Publishes the words as they are recognised, and — when the turn ends —
/// waits for the recogniser's last word on it before handing the text back.
@Observable
@MainActor
final class SpeechRecognizer {
    enum RecognizerError: LocalizedError {
        case unavailable(Language)
        case noMicrophone

        var errorDescription: String? {
            switch self {
            case let .unavailable(language):
                return Lf("Speech recognition for %@ is not available on this iPhone right now.", language.localizedName)
            case .noMicrophone:
                return L("The microphone is not available right now.")
            }
        }
    }

    /// What has been recognised so far in this turn. Changes as more is said.
    private(set) var transcript = ""
    private(set) var isRecording = false
    /// True when this turn is recognised on the phone, with no audio sent anywhere.
    private(set) var isOnDevice = false
    /// Why the last turn produced nothing, when the recogniser said so.
    private(set) var problem: String?

    private var audioEngine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    /// Words from earlier in this turn that the recogniser has since let go
    /// of, and the text it reported last (see the recognition handler).
    private var earlier = ""
    private var lastPart = ""
    /// Counts turns, so a late callback from an earlier one is ignored.
    private var turn = 0
    private var finalWaiter: CheckedContinuation<Void, Never>?
    private let observers = ObserverBag()

    init() {
        // A phone call, Siri, or headphones being plugged in stop the audio
        // under us; end the turn then, instead of "listening" to nothing.
        let center = NotificationCenter.default
        for name in [AVAudioSession.interruptionNotification, .AVAudioEngineConfigurationChange] {
            observers.tokens.append(
                center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                    Task { @MainActor in
                        guard let self, self.isRecording else { return }
                        self.recognitionEnded()
                    }
                }
            )
        }
    }

    /// Asks for speech-recognition + microphone permission. Returns true if both granted.
    static func requestPermissions() async -> Bool {
        let speechStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        guard speechStatus == .authorized else { return false }
        return await AVAudioApplication.requestRecordPermission()
    }

    func start(language: Language) throws {
        cancel()

        guard
            let recognizer = SFSpeechRecognizer(
                locale: Locale(identifier: language.speechLocaleIdentifier)
            ),
            recognizer.isAvailable
        else {
            throw RecognizerError.unavailable(language)
        }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: .spokenAudio,
            options: [.defaultToSpeaker, .duckOthers]
        )
        try session.setActive(true)

        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        request.taskHint = .dictation
        // Recognise on the phone wherever the language allows it: nothing
        // leaves the device, and there is no one-minute limit.
        request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition

        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        // No usable input (another app holds the microphone, or there is none):
        // installing a tap on such a format would bring the app down.
        guard format.sampleRate > 0, format.channelCount > 0 else {
            Self.releaseAudio()
            throw RecognizerError.noMicrophone
        }
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            inputNode.removeTap(onBus: 0)
            Self.releaseAudio()
            throw error
        }

        turn += 1
        let thisTurn = turn
        transcript = ""
        earlier = ""
        lastPart = ""
        problem = nil
        isRecording = true
        isOnDevice = request.requiresOnDeviceRecognition
        audioEngine = engine
        self.request = request

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            let text = result?.bestTranscription.formattedString
            let ended = error != nil || (result?.isFinal ?? false)
            let failure = error.flatMap(Self.explain)
            Task { @MainActor in
                guard let self, self.turn == thisTurn else { return }
                if let text, !text.isEmpty {
                    // Some iOS 18 versions start the text afresh after a pause
                    // instead of adding to it, which would drop every earlier
                    // sentence of the turn. A text that suddenly shrinks to
                    // less than half is taken to be such a restart, and what
                    // was there is kept in front. A recogniser that keeps its
                    // text never triggers this.
                    if self.lastPart.count > 12, text.count * 2 < self.lastPart.count {
                        self.earlier += self.lastPart + " "
                    }
                    self.lastPart = text
                    self.transcript = self.earlier + text
                }
                if let failure { self.problem = failure }
                if ended { self.recognitionEnded() }
            }
        }
    }

    /// Ends the turn and returns everything that was said. Unlike cancelling,
    /// this lets the recogniser finish with the audio it already has, so the
    /// last words before the tap are not lost.
    func finish() async -> String {
        guard isRecording, let task else {
            let text = transcript
            cancel()
            return text
        }
        stopCapturing()
        request?.endAudio()
        task.finish()

        // The final result normally arrives within a moment; do not wait
        // forever. Recognition by Apple's servers takes a little longer.
        let thisTurn = turn
        let patience: Duration = isOnDevice ? .milliseconds(1_500) : .seconds(3)
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            finalWaiter = continuation
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: patience)
                guard let self, self.turn == thisTurn else { return }
                self.resumeWaiter()
            }
        }
        let text = transcript
        reset()
        return text
    }

    /// The recogniser's failures that a person can do something about, in
    /// plain words. Everything else ("no speech heard", a cancelled turn) is
    /// not worth an alert.
    nonisolated private static func explain(_ error: Error) -> String? {
        let failure = error as NSError
        // Apple files these under two different domains; the number alone
        // does not say which failure it is.
        switch (failure.domain, failure.code) {
        case ("kLSRErrorDomain", 201):
            return L("Siri and Dictation are switched off on this iPhone. Switch them on in Settings to use the translator.")
        case ("kLSRErrorDomain", 102), ("kAFAssistantErrorDomain", 1101):
            return L("The language for speech recognition has not been downloaded yet. Try again in a moment, with an internet connection.")
        case ("kAFAssistantErrorDomain", 1700):
            return L("Microphone and speech recognition access are needed. Please allow both in the iPhone’s Settings.")
        default:
            return nil
        }
    }

    /// Hands the audio back to whatever was playing before — music, a
    /// podcast — once the translator is done with the microphone.
    static func releaseAudio() {
        try? AVAudioSession.sharedInstance().setActive(
            false, options: .notifyOthersOnDeactivation
        )
    }

    /// Drops the turn without waiting for anything.
    func cancel() {
        stopCapturing()
        task?.cancel()
        reset()
    }

    /// The recogniser has said its last word: by itself (a pause it took for
    /// the end, its time limit, an error) or because `finish()` asked.
    private func recognitionEnded() {
        stopCapturing()
        isRecording = false
        resumeWaiter()
    }

    private func resumeWaiter() {
        finalWaiter?.resume()
        finalWaiter = nil
    }

    private func stopCapturing() {
        guard let engine = audioEngine else { return }
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        audioEngine = nil
    }

    private func reset() {
        resumeWaiter()
        request = nil
        task = nil
        isRecording = false
        // A new turn number, so nothing from this one can touch the next.
        turn += 1
    }
}

/// Notification observers that unregister themselves when their owner goes away.
private final class ObserverBag {
    var tokens: [NSObjectProtocol] = []

    deinit {
        for token in tokens { NotificationCenter.default.removeObserver(token) }
    }
}
