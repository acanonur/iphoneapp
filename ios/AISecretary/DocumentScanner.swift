import PhotosUI
import SwiftUI
import Vision
import VisionKit

/// Turns a photographed letter or form into text.
///
/// Only the recognised text is sent to the backend — the photograph never
/// leaves the phone, which keeps the "no stored media" promise the app makes
/// about calls true of paperwork as well.
enum DocumentText {
    /// The languages the secretary works in, filtered to those this device's
    /// text recogniser actually supports.
    private static var recognitionLanguages: [String] {
        let wanted = ["de-DE", "en-US", "tr-TR"]
        let request = VNRecognizeTextRequest()
        let supported = (try? request.supportedRecognitionLanguages()) ?? []
        let available = wanted.filter { supported.contains($0) }
        return available.isEmpty ? ["en-US"] : available
    }

    static func recognize(in image: CGImage) -> String {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = recognitionLanguages

        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        guard (try? handler.perform([request])) != nil else { return "" }

        return (request.results ?? [])
            .compactMap { $0.topCandidates(1).first?.string }
            .joined(separator: "\n")
    }

    static func recognize(in images: [CGImage]) -> String {
        images
            .map(recognize(in:))
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    /// Recognition is slow enough to be worth keeping off the main thread.
    static func recognizeInBackground(_ images: [CGImage]) async -> String {
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                continuation.resume(returning: recognize(in: images))
            }
        }
    }

    /// Reads an already-photographed document out of the photo library — the
    /// path used in the simulator, where there is no document camera.
    static func recognize(in item: PhotosPickerItem) async -> String {
        guard
            let data = try? await item.loadTransferable(type: Data.self),
            let image = UIImage(data: data)?.cgImage
        else { return "" }
        return await recognizeInBackground([image])
    }
}

/// The system document camera. Available on devices with a camera; the photo
/// library stands in for it elsewhere.
struct DocumentCamera: UIViewControllerRepresentable {
    var onFinish: (String) -> Void

    static var isSupported: Bool { VNDocumentCameraViewController.isSupported }

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_: VNDocumentCameraViewController, context _: Context) {}

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        private let onFinish: (String) -> Void

        init(onFinish: @escaping (String) -> Void) {
            self.onFinish = onFinish
        }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFinishWith scan: VNDocumentCameraScan
        ) {
            let images = (0 ..< scan.pageCount).compactMap { scan.imageOfPage(at: $0).cgImage }
            controller.dismiss(animated: true)

            let callback = onFinish
            DispatchQueue.global(qos: .userInitiated).async {
                let text = DocumentText.recognize(in: images)
                DispatchQueue.main.async { callback(text) }
            }
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            controller.dismiss(animated: true)
        }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFailWithError _: Error
        ) {
            controller.dismiss(animated: true)
        }
    }
}
