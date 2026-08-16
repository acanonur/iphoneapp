import Foundation
import SwiftUI

/// Everything the app owns, persisted as one JSON document.
final class AppStore: ObservableObject {

    @Published var projects: [SavedProject] = [] { didSet { scheduleSave() } }
    @Published var charts: [ColourChart] = [] { didSet { scheduleSave() } }
    @Published var stash: [Yarn] = [] { didSet { scheduleSave() } }
    @Published var units: UnitSystem = .metric { didSet { scheduleSave() } }
    @Published var favouriteTechniques: Set<String> = [] { didSet { scheduleSave() } }
    /// The gauge the knitter last measured, reused as the default for new projects.
    @Published var lastGauge: Gauge = YarnWeight.light.nominalGauge { didSet { scheduleSave() } }

    private var saveWorkItem: DispatchWorkItem?
    private var isLoading = false

    init() {
        load()
    }

    // MARK: - Mutations

    func add(_ project: SavedProject) {
        projects.insert(project, at: 0)
    }

    func update(_ project: SavedProject) {
        guard let index = projects.firstIndex(where: { $0.id == project.id }) else { return }
        projects[index] = project
    }

    func delete(at offsets: IndexSet) {
        projects.remove(atOffsets: offsets)
    }

    func addChart(_ chart: ColourChart) {
        charts.insert(chart, at: 0)
    }

    func toggleFavourite(_ techniqueID: String) {
        if favouriteTechniques.contains(techniqueID) {
            favouriteTechniques.remove(techniqueID)
        } else {
            favouriteTechniques.insert(techniqueID)
        }
    }

    // MARK: - Persistence

    private struct Snapshot: Codable {
        var projects: [SavedProject]
        var charts: [ColourChart]
        var stash: [Yarn]
        var units: UnitSystem
        var favouriteTechniques: [String]
        var lastGauge: Gauge
    }

    private static var storeURL: URL {
        let directory = FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent("knitstudio.json")
    }

    private func scheduleSave() {
        guard !isLoading else { return }
        saveWorkItem?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.save() }
        saveWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: work)
    }

    func save() {
        let snapshot = Snapshot(
            projects: projects,
            charts: charts,
            stash: stash,
            units: units,
            favouriteTechniques: Array(favouriteTechniques),
            lastGauge: lastGauge)
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let data = try encoder.encode(snapshot)
            try data.write(to: AppStore.storeURL, options: .atomic)
        } catch {
            // Losing a save is not worth crashing over; the in-memory state is intact.
            print("KnitStudio: could not save — \(error.localizedDescription)")
        }
    }

    private func load() {
        isLoading = true
        defer { isLoading = false }

        guard let data = try? Data(contentsOf: AppStore.storeURL),
              let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data)
        else {
            seedFirstRun()
            return
        }
        projects = snapshot.projects
        charts = snapshot.charts
        stash = snapshot.stash
        units = snapshot.units
        favouriteTechniques = Set(snapshot.favouriteTechniques)
        lastGauge = snapshot.lastGauge
    }

    /// A first launch with an empty library is unhelpful — start with a stash
    /// and the built-in charts so every screen has something in it.
    private func seedFirstRun() {
        stash = BuiltInPatterns.palette(weight: .light)
        charts = BuiltInPatterns.motifs.compactMap {
            BuiltInPatterns.chart(id: $0.id, weight: .light)
        }
    }
}
