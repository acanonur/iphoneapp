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
                return Lf("Speech recognition for %@ is not available on this iPhone right now.", language.displayName)
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

    private var audioEngine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    /// Counts turns, so a late callback from an earlier one is ignored.
    private var turn = 0
    private var finalWaiter: CheckedContinuation<Void, Never>?

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
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        // Recognise on the phone wherever the language allows it: nothing
        // leaves the device, and there is no one-minute limit.
        request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition

        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        // No usable input (another app holds the microphone, or there is none):
        // installing a tap on such a format would bring the app down.
        guard format.sampleRate > 0, format.channelCount > 0 else {
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
            throw error
        }

        turn += 1
        let thisTurn = turn
        transcript = ""
        isRecording = true
        isOnDevice = request.requiresOnDeviceRecognition
        audioEngine = engine
        self.request = request

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            let text = result?.bestTranscription.formattedString
            let ended = error != nil || (result?.isFinal ?? false)
            Task { @MainActor in
                guard let self, self.turn == thisTurn else { return }
                if let text, !text.isEmpty { self.transcript = text }
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

        // The final result normally arrives within a moment; do not wait forever.
        let thisTurn = turn
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            finalWaiter = continuation
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .milliseconds(1_500))
                guard let self, self.turn == thisTurn else { return }
                self.resumeWaiter()
            }
        }
        let text = transcript
        reset()
        return text
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
