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
    /// The utterance in progress. Stopping one line to start the next makes the
    /// old one report "cancelled" after the new one has begun; only the ending
    /// of the line that is actually playing may clear the label.
    private var current: ObjectIdentifier?

    init() {
        let monitor = SpeakerMonitor { [weak self] ended in
            Task { @MainActor in
                guard let self, self.current == ended else { return }
                self.current = nil
                self.speakingID = nil
            }
        }
        synthesizer.delegate = monitor
        self.monitor = monitor
    }

    func speak(_ text: String, languageCode: String, id: String? = nil) {
        synthesizer.stopSpeaking(at: .immediate)
        // No voice for the language: stay silent rather than have a German
        // sentence read out by an English voice.
        guard let voice = AVSpeechSynthesisVoice(language: languageCode)
            ?? AVSpeechSynthesisVoice(language: String(languageCode.prefix(2)))
        else {
            speakingID = nil
            return
        }
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = voice
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        current = ObjectIdentifier(utterance)
        speakingID = id
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        current = nil
        speakingID = nil
    }
}

/// Bridges the synthesizer's delegate callbacks, which arrive off the main
/// actor, back to the speaker.
private final class SpeakerMonitor: NSObject, AVSpeechSynthesizerDelegate {
    private let onEnd: (ObjectIdentifier) -> Void

    init(onEnd: @escaping (ObjectIdentifier) -> Void) {
        self.onEnd = onEnd
    }

    func speechSynthesizer(_: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        onEnd(ObjectIdentifier(utterance))
    }

    func speechSynthesizer(_: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        onEnd(ObjectIdentifier(utterance))
    }
}
