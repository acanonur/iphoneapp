import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selection: AppSection? = .projects

    var body: some View {
        #if os(macOS)
        // A sidebar is the native shape for a Mac window; tabs across the top
        // of a desktop app read as a stretched phone.
        NavigationSplitView {
            List(AppSection.allCases, selection: $selection) { section in
                NavigationLink(value: section) {
                    Label(section.title, systemImage: section.symbol)
                }
            }
            .navigationSplitViewColumnWidth(min: 170, ideal: 200, max: 260)
            .navigationTitle("KnitStudio")
        } detail: {
            (selection ?? .projects).destination
        }
        .knitMinimumWindowSize()
        #else
        TabView {
            ForEach(AppSection.allCases) { section in
                section.destination
                    .tabItem { Label(section.title, systemImage: section.symbol) }
            }
        }
        #endif
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

/// The 1c Technique screen. Sage rather than clay: Learn is the other half of
/// the app, and the header colour is the fastest way to know which half you are
/// looking at without reading a word. Steps are numbered sage circles; the tip
/// is the one clay note on the page, so it reads as an aside rather than a
/// further step.
struct TechniqueDetailView: View {
    let technique: Technique
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss

    private var saved: Bool { store.favouriteTechniques.contains(technique.id) }

    var body: some View {
        VStack(spacing: 0) {
            OrganicHeader(tone: Organic.headerSage, bottomPadding: 28) {
                OrganicHeaderBar(backLabel: "Learn", tint: Organic.sage.s100) {
                    dismiss()
                } action: {
                    Button {
                        store.toggleFavourite(technique.id)
                    } label: {
                        LucideBookmark(tint: .white, filled: saved)
                    }
                    .buttonStyle(.plain)
                }

                HStack(spacing: 8) {
                    OrganicPill(
                        text: technique.difficulty.name,
                        background: Organic.sage.s200,
                        foreground: Organic.sage.s900)
                    OrganicPill(
                        text: technique.category.name,
                        background: Organic.sage.s700,
                        foreground: .white)
                }
                .padding(.top, 18)

                Text(technique.name)
                    .font(KnitType.display(36))
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 12)

                Text(technique.summary)
                    .font(KnitType.body(19))
                    .foregroundStyle(Organic.sage.s100)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text(technique.whenToUse)
                        .font(KnitType.body(18))
                        .foregroundStyle(Organic.neutral.s700)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("How to")
                        .font(KnitType.display(24))
                        .foregroundStyle(Organic.text)

                    ForEach(Array(technique.steps.enumerated()), id: \.offset) { index, step in
                        HStack(alignment: .top, spacing: 16) {
                            Text("\(index + 1)")
                                .font(KnitType.display(20))
                                .foregroundStyle(Organic.sage.s900)
                                .frame(width: 44, height: 44)
                                .background(Organic.sage.s200, in: Circle())
                            Text(step)
                                .font(KnitType.body(19))
                                .foregroundStyle(Organic.text)
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.top, 6)
                        }
                    }

                    ForEach(Array(technique.tips.enumerated()), id: \.offset) { _, tip in
                        HStack(alignment: .top, spacing: 12) {
                            Text("Tip")
                                .font(KnitType.display(20))
                                .foregroundStyle(Organic.clay.s800)
                            Text(tip)
                                .font(KnitType.body(18))
                                .foregroundStyle(Organic.clay.s900)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 18)
                        .background(Organic.clay.s100,
                                    in: RoundedRectangle(cornerRadius: Organic.radiusLg))
                    }

                    if !technique.abbreviations.isEmpty {
                        Text("In patterns you will see")
                            .font(KnitType.display(24))
                            .foregroundStyle(Organic.text)
                            .padding(.top, 8)

                        ForEach(technique.abbreviations, id: \.self) { short in
                            if let entry = AbbreviationGlossary.lookup(short) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(entry.short) — \(entry.full)")
                                        .font(KnitType.body(18, .bold))
                                        .foregroundStyle(Organic.text)
                                    Text(entry.meaning)
                                        .font(KnitType.body(17))
                                        .foregroundStyle(Organic.neutral.s700)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }

                    if !technique.alsoKnownAs.isEmpty {
                        Text("Also called: \(technique.alsoKnownAs.joined(separator: ", "))")
                            .font(KnitType.body(16))
                            .foregroundStyle(Organic.neutral.s700)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 24)
                .knitReadableWidth()
            }
        }
        .background(Organic.bg)
        .knitHideNavigationBar()
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
        .knitInlineTitle()
    }
}
