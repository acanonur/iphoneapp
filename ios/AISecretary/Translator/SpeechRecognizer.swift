import AVFoundation
import Foundation
import Observation
import Speech

/// Live microphone speech-to-text built on Apple's Speech framework.
/// Publishes a running partial transcript while recording.
@Observable
@MainActor
final class SpeechRecognizer {
    enum RecognizerError: LocalizedError {
        case unavailable(String)

        var errorDescription: String? {
            switch self {
            case let .unavailable(language):
                return "Speech recognition is not available for \(language) on this device right now."
            }
        }
    }

    private(set) var transcript = ""
    private(set) var isRecording = false

    private var audioEngine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    /// Asks for speech-recognition + microphone permission. Returns true if both granted.
    static func requestPermissions() async -> Bool {
        let speechStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        guard speechStatus == .authorized else { return false }
        return await AVAudioApplication.requestRecordPermission()
    }

    func start(localeIdentifier: String) throws {
        stop()

        guard
            let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeIdentifier)),
            recognizer.isAvailable
        else {
            throw RecognizerError.unavailable(localeIdentifier)
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
        request.requiresOnDeviceRecognition = false

        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        engine.prepare()
        try engine.start()

        transcript = ""
        isRecording = true
        audioEngine = engine
        self.request = request

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            Task { @MainActor in
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                }
                if error != nil || (result?.isFinal ?? false) {
                    self.cleanupEngine()
                }
            }
        }
    }

    /// Stops listening and returns the transcript captured so far.
    @discardableResult
    func stop() -> String {
        let text = transcript
        request?.endAudio()
        task?.cancel()
        cleanupEngine()
        return text
    }

    private func cleanupEngine() {
        if let engine = audioEngine {
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
        }
        audioEngine = nil
        request = nil
        task = nil
        isRecording = false
    }
}
