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
        let kind: String      // "due", "blitz" oder "web" (aus dem Backup übernommen)
        let total: Int
        let correct: Int
    }

    private struct Persisted: Codable {
        var cards: [Card]
        var phase6: [String: Phase6State]
        var sessions: [SessionLog]
        /// "_exported" des zuletzt übernommenen Backups; ein neueres im Bundle wird beim Start eingespielt.
        var importedExport: String?
    }

    private var importedExport: String?

    nonisolated static let sessionSize = 5

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
    /// Karten kommen komplett aus der Datei. Beim Phase-6-Stand gewinnt pro Karte
    /// der jüngere Eintrag, damit Bewertungen auf der Uhr nicht verloren gehen.
    func importBackup(data: Data) throws {
        let backup = try JSONDecoder().decode(WebBackup.self, from: data)
        // Lokaler Stand zählt nur für Karten, die es vorher schon mit gleichem Inhalt gab.
        // So überschreibt der Stand der Beispielkarten nie echte Karten mit derselben ID.
        let oldByID = Dictionary(cards.map { ($0.id, $0) }, uniquingKeysWith: { $1 })
        let newByID = Dictionary(backup.cards.map { ($0.id, $0) }, uniquingKeysWith: { $1 })
        var merged = backup.phase6
        for (id, local) in phase6 {
            guard let old = oldByID[id], let new = newByID[id],
                  old.front == new.front, old.back == new.back else { continue }
            if let incoming = merged[id] {
                let localDate = local.lastReviewedAt ?? .distantPast
                let incomingDate = incoming.lastReviewedAt ?? .distantPast
                merged[id] = incomingDate >= localDate ? incoming : local
            } else {
                merged[id] = local
            }
        }
        cards = backup.cards
        phase6 = merged
        // Sitzungen der Web-App für den Streak übernehmen, ohne Duplikate.
        let known = Set(sessions.map(\.date))
        for s in backup.sessions {
            guard let date = s.completedAt, !known.contains(date) else { continue }
            sessions.append(SessionLog(date: date, kind: "web", total: s.totalCards, correct: s.correctFirstTry))
        }
        sessions.sort { $0.date < $1.date }
        importedExport = backup.exportedAt
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
            importedExport = p.importedExport
        }
        importBundledBackupIfNewer()
    }

    /// Erster Start: echtes Backup aus dem Bundle, sonst Beispieldaten.
    /// Spätere Starts: ein Backup mit neuerem "_exported" wird eingespielt (etwa nach einem Update der App).
    private func importBundledBackupIfNewer() {
        for name in ["impara-backup", "sample-backup"] {
            guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
                  let data = try? Data(contentsOf: url),
                  let backup = try? JSONDecoder().decode(WebBackup.self, from: data) else { continue }
            let isFirstStart = cards.isEmpty
            let isNewer = backup.exportedAt != nil && backup.exportedAt != importedExport
            if isFirstStart || isNewer {
                try? importBackup(data: data)
            }
            return
        }
    }

    private func save() {
        let p = Persisted(
            cards: cards,
            phase6: Dictionary(uniqueKeysWithValues: phase6.map { (String($0.key), $0.value) }),
            sessions: sessions,
            importedExport: importedExport
        )
        if let data = try? JSONEncoder().encode(p) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }
}
