import Foundation
import WidgetKit

/// Hält Karten, Phase-6-Stand und das Sitzungsprotokoll. Speichert als JSON im Documents-Ordner.
@MainActor
final class Store: ObservableObject {
    @Published private(set) var cards: [Card] = []
    @Published private(set) var phase6: [Int: Phase6State] = [:]
    @Published private(set) var sessions: [SessionLog] = []

    struct SessionLog: Codable, Hashable {
        let date: Date
        let kind: String      // "due" oder "blitz"
        let total: Int
        let correct: Int
    }

    private struct Persisted: Codable {
        var cards: [Card]
        var phase6: [String: Phase6State]
        var sessions: [SessionLog]
    }

    static let sessionSize = 5

    private var fileURL: URL {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return dir.appendingPathComponent("impara-state.json")
    }

    init() {
        load()
    }

    // MARK: Abfragen

    var dueCount: Int {
        let now = Date()
        return cards.filter { card in
            guard let st = phase6[card.id] else { return false }
            return st.nextReviewAt <= now
        }.count
    }

    var learnedCount: Int { cards.filter { phase6[$0.id] != nil }.count }

    var studiedToday: Bool {
        sessions.contains { Calendar.current.isDateInToday($0.date) }
    }

    /// Tage in Folge mit mindestens einer Sitzung. Heute zählt, sobald gelernt wurde;
    /// sonst beginnt die Zählung gestern (wie in der Web-App).
    var streak: Int {
        let cal = Calendar.current
        let days = Set(sessions.map { cal.startOfDay(for: $0.date) })
        guard !days.isEmpty else { return 0 }
        var cursor = cal.startOfDay(for: Date())
        if !days.contains(cursor) {
            cursor = cal.date(byAdding: .day, value: -1, to: cursor)!
        }
        var count = 0
        while days.contains(cursor) {
            count += 1
            cursor = cal.date(byAdding: .day, value: -1, to: cursor)!
        }
        return count
    }

    /// Fällige Karten zuerst (die am längsten überfälligen vorn), dann noch nie gelernte Karten.
    func nextSession(limit: Int = Store.sessionSize) -> [Card] {
        let now = Date()
        let due = cards
            .compactMap { card -> (Card, Date)? in
                guard let st = phase6[card.id], st.nextReviewAt <= now else { return nil }
                return (card, st.nextReviewAt)
            }
            .sorted { $0.1 < $1.1 }
            .map { $0.0 }
        var picked = Array(due.prefix(limit))
        if picked.count < limit {
            let fresh = cards.filter { phase6[$0.id] == nil }.shuffled()
            picked.append(contentsOf: fresh.prefix(limit - picked.count))
        }
        return picked
    }

    // MARK: Änderungen

    func grade(card: Card, correct: Bool) {
        phase6[card.id] = Leitner.next(after: phase6[card.id], correct: correct)
        save()
    }

    func logSession(kind: String, total: Int, correct: Int) {
        sessions.append(SessionLog(date: Date(), kind: kind, total: total, correct: correct))
        save()
        refresh()
    }

    /// Wird beim Aktivwerden der App aufgerufen: Widget und Erinnerung auf den aktuellen Stand bringen.
    func refresh() {
        let words = cards.isEmpty
            ? Vocabulary.allWords
            : cards.shuffled().prefix(48).map { VocabWord(de: $0.front, it: $0.back) }
        SharedData.publish(dueCount: dueCount, words: Array(words))
        WidgetCenter.shared.reloadAllTimelines()
        Reminders.schedule(dueCount: dueCount)
    }

    // MARK: Import

    /// Liest ein Backup der Web-App (Statistiken > Backup & Geräteübertragung).
    /// Der Phase-6-Stand aus der Datei überschreibt den lokalen Stand pro Karte.
    func importBackup(data: Data) throws {
        let backup = try JSONDecoder().decode(WebBackup.self, from: data)
        cards = backup.cards
        phase6.merge(backup.phase6) { _, incoming in incoming }
        save()
        refresh()
    }

    // MARK: Persistenz

    private func load() {
        if let data = try? Data(contentsOf: fileURL),
           let p = try? JSONDecoder().decode(Persisted.self, from: data) {
            cards = p.cards
            phase6 = Dictionary(uniqueKeysWithValues: p.phase6.compactMap { key, value in
                Int(key).map { ($0, value) }
            })
            sessions = p.sessions
            return
        }
        // Erster Start: echtes Backup aus dem Bundle, sonst Beispieldaten.
        for name in ["impara-backup", "sample-backup"] {
            if let url = Bundle.main.url(forResource: name, withExtension: "json"),
               let data = try? Data(contentsOf: url),
               (try? importBackup(data: data)) != nil {
                return
            }
        }
    }

    private func save() {
        let p = Persisted(
            cards: cards,
            phase6: Dictionary(uniqueKeysWithValues: phase6.map { (String($0.key), $0.value) }),
            sessions: sessions
        )
        if let data = try? JSONEncoder().encode(p) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }
}
