import Foundation
import PDFKit
import UniformTypeIdentifiers

/// Reads pattern files the knitter picks from Files, iCloud or Photos.
enum PatternImporter {

    enum ImportError: LocalizedError {
        case noAccess
        case unreadable
        case unsupported(String)
        case noText

        var errorDescription: String? {
            switch self {
            case .noAccess:
                return "The file could not be opened. If it is in iCloud Drive, let it finish downloading first."
            case .unreadable:
                return "That file could not be read."
            case .unsupported(let ext):
                return "\(ext.uppercased()) files are not supported. Import a PDF, a text file, or an image."
            case .noText:
                return "No text was found. Scanned PDFs are images of a pattern, not text — "
                    + "photograph the chart instead and import it as an image."
            }
        }
    }

    /// File types the text importer accepts.
    static let textTypes: [UTType] = [.pdf, .plainText, .rtf, .utf8PlainText]
    /// File types the chart importer accepts.
    static let imageTypes: [UTType] = [.image, .png, .jpeg, .heic]

    // MARK: - Text patterns

    static func text(from url: URL) throws -> String {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }

        switch url.pathExtension.lowercased() {
        case "pdf":
            guard let document = PDFDocument(url: url) else { throw ImportError.unreadable }
            var pages: [String] = []
            for index in 0 ..< document.pageCount {
                if let page = document.page(at: index), let string = page.string {
                    pages.append(string)
                }
            }
            let joined = pages.joined(separator: "\n")
            guard !joined.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw ImportError.noText
            }
            return joined

        case "txt", "md", "text", "":
            guard let data = try? Data(contentsOf: url) else { throw ImportError.unreadable }
            if let string = String(data: data, encoding: .utf8) { return string }
            if let string = String(data: data, encoding: .isoLatin1) { return string }
            throw ImportError.unreadable

        case "rtf":
            guard let data = try? Data(contentsOf: url),
                  let attributed = try? NSAttributedString(
                    data: data,
                    options: [.documentType: NSAttributedString.DocumentType.rtf],
                    documentAttributes: nil)
            else { throw ImportError.unreadable }
            return attributed.string

        default:
            throw ImportError.unsupported(url.pathExtension)
        }
    }

    // MARK: - Images

    static func image(from url: URL) throws -> PlatformImage {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }

        guard let data = try? Data(contentsOf: url) else { throw ImportError.noAccess }
        guard let image = PlatformImage.knitImage(from: data) else { throw ImportError.unreadable }
        return image
    }

    // MARK: - Turning a parsed pattern into something usable

    /// Builds a plain-text summary of what the importer understood, so the
    /// knitter can see whether it read their pattern correctly before trusting it.
    static func summary(of pattern: ParsedPattern) -> String {
        var lines: [String] = []
        if let title = pattern.title { lines.append(title) }
        if let gauge = pattern.gauge {
            lines.append("Gauge read as \(gauge.describe(in: .metric)).")
        } else {
            lines.append("No gauge found — set it by hand before calculating.")
        }
        if let castOn = pattern.castOnStitches {
            lines.append("Cast on \(castOn) sts.")
        }
        lines.append("\(pattern.rows.count) rows found, \(pattern.verifiedRowCount) of which check out.")

        let problems = pattern.rows.filter { !$0.issues.isEmpty }
        if !problems.isEmpty {
            lines.append("")
            lines.append("Rows that do not add up:")
            for row in problems.prefix(12) {
                lines.append("  \(row.label): \(row.issues.joined(separator: " "))")
            }
            if problems.count > 12 {
                lines.append("  …and \(problems.count - 12) more.")
            }
        }
        if !pattern.unknownTerms.isEmpty {
            lines.append("")
            lines.append("Terms not recognised: \(pattern.unknownTerms.prefix(20).joined(separator: ", "))")
        }
        return lines.joined(separator: "\n")
    }
}
