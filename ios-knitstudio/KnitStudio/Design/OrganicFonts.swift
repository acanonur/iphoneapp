import CoreText
import Foundation

/// Registers the bundled Organic typefaces with the font system.
///
/// Done in code rather than through Info.plist because the two platforms
/// disagree about how to declare bundled fonts — iOS wants `UIAppFonts` listing
/// each file, macOS wants `ATSApplicationFontsPath` naming a directory — and
/// which of those works depends on whether Xcode copied the fonts flat into
/// Resources or kept the folder. Registering at run time is one code path that
/// is correct on both, and it reports failure to the log rather than silently
/// falling back to the system face, which is otherwise a very quiet bug: the
/// app still runs, it just stops looking like the design.
enum OrganicFonts {

    private static var registered = false

    /// Idempotent — safe to call more than once, and does nothing after the
    /// first pass.
    static func register() {
        guard !registered else { return }
        registered = true

        let urls = fontURLs()
        guard !urls.isEmpty else {
            print("[KnitStudio] No bundled .ttf found — falling back to system fonts.")
            return
        }

        // Whichever spelling of rawValue CoreText uses on this SDK, CFIndex
        // accepts it, and CFErrorGetCode returns the same type.
        let alreadyRegistered = CFIndex(CTFontManagerError.alreadyRegistered.rawValue)

        for url in urls {
            var error: Unmanaged<CFError>?
            guard !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) else { continue }

            let code = error.map { CFErrorGetCode($0.takeRetainedValue()) } ?? -1
            // Already-registered is the one failure worth ignoring: it means
            // the platform picked the font up from the bundle before we did.
            if code != alreadyRegistered {
                print("[KnitStudio] Could not register \(url.lastPathComponent): CFError \(code)")
            }
        }
    }

    /// Looks in the two places Xcode might have put them: flat in Resources, or
    /// preserved under a Fonts directory.
    private static func fontURLs() -> [URL] {
        var found: [URL] = []
        for subdirectory in [nil, "Fonts"] as [String?] {
            found += Bundle.main.urls(forResourcesWithExtension: "ttf", subdirectory: subdirectory) ?? []
        }
        // The same file can answer both lookups; register each one once.
        var seen = Set<String>()
        return found.filter { seen.insert($0.lastPathComponent).inserted }
    }
}
