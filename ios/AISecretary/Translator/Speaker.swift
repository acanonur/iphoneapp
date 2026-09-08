import AVFoundation
import Observation

/// Speaks translated text aloud with the system voice for the target language,
/// and reports which line is currently being spoken so the screen can label its
/// play button "Speaking…".
@Observable
@MainActor
final class Speaker {
    private(set) var speakingID: String?

    private let synthesizer = AVSpeechSynthesizer()
    private var monitor: SpeakerMonitor?

    init() {
        let monitor = SpeakerMonitor { [weak self] in
            Task { @MainActor in self?.speakingID = nil }
        }
        synthesizer.delegate = monitor
        self.monitor = monitor
    }

    func speak(_ text: String, languageCode: String, id: String? = nil) {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: languageCode)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        speakingID = id
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        speakingID = nil
    }
}

/// Bridges the synthesizer's delegate callbacks, which arrive off the main
/// actor, back to the speaker.
private final class SpeakerMonitor: NSObject, AVSpeechSynthesizerDelegate {
    private let onEnd: () -> Void

    init(onEnd: @escaping () -> Void) {
        self.onEnd = onEnd
    }

    func speechSynthesizer(_: AVSpeechSynthesizer, didFinish _: AVSpeechUtterance) {
        onEnd()
    }

    func speechSynthesizer(_: AVSpeechSynthesizer, didCancel _: AVSpeechUtterance) {
        onEnd()
    }
}
