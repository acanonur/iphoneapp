import AVFoundation

/// Speaks translated text aloud with the system voice for the target language.
final class Speaker {
    private let synthesizer = AVSpeechSynthesizer()

    func speak(_ text: String, languageCode: String) {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: languageCode)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
    }
}
