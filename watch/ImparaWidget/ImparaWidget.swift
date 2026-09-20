import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Umdrehen per Tipp (interaktives Widget, watchOS 10)

struct FlipWordIntent: AppIntent {
    static var title: LocalizedStringResource = "Wort umdrehen"

    @Parameter(title: "Wort")
    var word: String

    init() {}
    init(word: String) { self.word = word }

    func perform() async throws -> some IntentResult {
        SharedData.flippedWord = (SharedData.flippedWord == word) ? nil : word
        return .result()
    }
}

// MARK: - Zeitleiste: ein Wort pro Stunde

struct WordEntry: TimelineEntry {
    let date: Date
    let word: VocabWord?
    let dueCount: Int
    let flipped: Bool
}

struct WordProvider: TimelineProvider {
    func placeholder(in context: Context) -> WordEntry {
        WordEntry(date: .now, word: VocabWord(de: "der Nachmittag", it: "il pomeriggio"), dueCount: 12, flipped: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (WordEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WordEntry>) -> Void) {
        let shared = SharedData.words
        let words = shared.isEmpty ? Vocabulary.allWords : shared
        let dueCount = SharedData.dueCount
        let flippedWord = SharedData.flippedWord
        guard !words.isEmpty else {
            completion(Timeline(entries: [WordEntry(date: .now, word: nil, dueCount: dueCount, flipped: false)], policy: .never))
            return
        }
        let hourStart = Calendar.current.dateInterval(of: .hour, for: .now)?.start ?? .now
        let hourIndex = Int(hourStart.timeIntervalSince1970 / 3600)
        var entries: [WordEntry] = []
        for i in 0..<12 {
            let date = hourStart.addingTimeInterval(Double(i) * 3600)
            let word = words[(hourIndex + i) % words.count]
            entries.append(WordEntry(date: date, word: word, dueCount: dueCount, flipped: flippedWord == word.it))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// MARK: - Darstellung

struct WordWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WordEntry

    private var shown: String {
        guard let w = entry.word else { return "Impara" }
        return entry.flipped ? w.de : w.it
    }

    var body: some View {
        switch family {
        case .accessoryCircular:
            gauge
        case .accessoryInline:
            Text(shown)
        default:
            rectangular
        }
    }

    private var gauge: some View {
        Gauge(value: Double(min(entry.dueCount, 20)), in: 0...20) {
            Text("fällig")
        } currentValueLabel: {
            Text("\(entry.dueCount)")
                .font(.system(.body, design: .rounded, weight: .bold))
        }
        .gaugeStyle(.accessoryCircular)
        .tint(.terracotta)
    }

    private var rectangular: some View {
        Button(intent: FlipWordIntent(word: entry.word?.it ?? "")) {
            HStack(spacing: 8) {
                gauge
                    .scaleEffect(0.75)
                    .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text(shown)
                        .font(.system(.footnote, design: .rounded, weight: .bold))
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                    Text(entry.flipped ? "tippen: zurück" : "tippen zum Umdrehen")
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
    }
}

struct WordWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "de.tischler.impara.word", provider: WordProvider()) { entry in
            WordWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color.clear }
        }
        .configurationDisplayName("Wort des Moments")
        .description("Eine Vokabel pro Stunde und die Zahl der fälligen Karten.")
        .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}

@main
struct ImparaWidgetBundle: WidgetBundle {
    var body: some Widget {
        WordWidget()
    }
}
