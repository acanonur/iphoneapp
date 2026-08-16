import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        TabView {
            ProjectsView()
                .tabItem { Label("Projects", systemImage: "square.stack.3d.up") }

            PatternsView()
                .tabItem { Label("Patterns", systemImage: "square.grid.3x3") }

            LearnView()
                .tabItem { Label("Learn", systemImage: "book") }

            StashView()
                .tabItem { Label("Stash", systemImage: "basket") }
        }
    }
}

struct LearnView: View {
    @EnvironmentObject private var store: AppStore
    @State private var query = ""

    private var results: [Technique] { TechniqueLibrary.search(query) }
    private var isSearching: Bool { !query.trimmingCharacters(in: .whitespaces).isEmpty }

    private var favourites: [Technique] {
        TechniqueLibrary.all.filter { store.favouriteTechniques.contains($0.id) }
    }

    var body: some View {
        NavigationStack {
            List {
                if isSearching {
                    Section("\(results.count) result\(results.count == 1 ? "" : "s")") {
                        ForEach(results) { technique in
                            NavigationLink(value: technique) { TechniqueRow(technique: technique) }
                        }
                    }
                } else {
                    if !favourites.isEmpty {
                        Section("Saved") {
                            ForEach(favourites) { technique in
                                NavigationLink(value: technique) { TechniqueRow(technique: technique) }
                            }
                        }
                    }

                    Section {
                        NavigationLink {
                            AbbreviationsView()
                        } label: {
                            Label("Abbreviations", systemImage: "textformat.abc")
                        }
                    }

                    ForEach(TechniqueLibrary.categoriesInOrder) { category in
                        Section {
                            ForEach(TechniqueLibrary.inCategory(category)) { technique in
                                NavigationLink(value: technique) { TechniqueRow(technique: technique) }
                            }
                        } header: {
                            Label(category.name, systemImage: category.symbol)
                        } footer: {
                            Text(category.blurb)
                        }
                    }
                }
            }
            .navigationTitle("Learn")
            .searchable(text: $query, prompt: "Search techniques")
            .navigationDestination(for: Technique.self) { technique in
                TechniqueDetailView(technique: technique)
            }
        }
    }
}

struct TechniqueRow: View {
    let technique: Technique

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(technique.name)
                    .font(.body.weight(.medium))
                Spacer()
                DifficultyBadge(difficulty: technique.difficulty)
            }
            Text(technique.summary)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(.vertical, 2)
    }
}

struct TechniqueDetailView: View {
    let technique: Technique
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        DifficultyBadge(difficulty: technique.difficulty)
                        Text(technique.category.name)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Text(technique.summary)
                        .font(.title3)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(technique.whenToUse)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("How to")
                        .font(.headline)
                    ForEach(Array(technique.steps.enumerated()), id: \.offset) { index, step in
                        HStack(alignment: .top, spacing: 12) {
                            Text("\(index + 1)")
                                .font(.caption.weight(.bold))
                                .frame(width: 22, height: 22)
                                .background(Color.accentColor.opacity(0.15), in: Circle())
                            Text(step)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }

                if !technique.tips.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Worth knowing")
                            .font(.headline)
                        ForEach(Array(technique.tips.enumerated()), id: \.offset) { _, tip in
                            NoteBox(kind: .note, text: tip)
                        }
                    }
                }

                if !technique.abbreviations.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("In patterns you will see")
                            .font(.headline)
                        ForEach(technique.abbreviations, id: \.self) { short in
                            if let entry = AbbreviationGlossary.lookup(short) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(entry.short) — \(entry.full)")
                                        .font(.subheadline.weight(.medium))
                                    Text(entry.meaning)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                }

                if !technique.alsoKnownAs.isEmpty {
                    Text("Also called: \(technique.alsoKnownAs.joined(separator: ", "))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
        }
        .navigationTitle(technique.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    store.toggleFavourite(technique.id)
                } label: {
                    Image(systemName: store.favouriteTechniques.contains(technique.id)
                          ? "bookmark.fill" : "bookmark")
                }
            }
        }
    }
}

struct AbbreviationsView: View {
    @State private var query = ""

    var body: some View {
        List(AbbreviationGlossary.search(query)) { entry in
            VStack(alignment: .leading, spacing: 3) {
                Text("\(entry.short) — \(entry.full)")
                    .font(.subheadline.weight(.semibold))
                Text(entry.meaning)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 2)
        }
        .searchable(text: $query, prompt: "Search abbreviations")
        .navigationTitle("Abbreviations")
        .navigationBarTitleDisplayMode(.inline)
    }
}
