import Foundation

// MARK: - Karten und Phase-6-Stand (gleiche Felder wie die Web-App)

struct Card: Codable, Identifiable, Hashable {
    let id: Int
    let lessonId: Int
    var front: String
    var back: String
    var example: String
    var notes: String

    enum CodingKeys: String, CodingKey {
        case id, front, back, example, notes
        case lessonId = "lesson_id"
    }

    init(id: Int, lessonId: Int, front: String, back: String, example: String = "", notes: String = "") {
        self.id = id
        self.lessonId = lessonId
        self.front = front
        self.back = back
        self.example = example
        self.notes = notes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try Card.flexibleInt(c, .id) ?? 0
        lessonId = try Card.flexibleInt(c, .lessonId) ?? 0
        front = try c.decodeIfPresent(String.self, forKey: .front) ?? ""
        back = try c.decodeIfPresent(String.self, forKey: .back) ?? ""
        example = try c.decodeIfPresent(String.self, forKey: .example) ?? ""
        notes = try c.decodeIfPresent(String.self, forKey: .notes) ?? ""
    }

    /// Die Web-App speichert IDs mal als Zahl, mal als String.
    private static func flexibleInt(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) throws -> Int? {
        if let n = try? c.decodeIfPresent(Int.self, forKey: key) { return n }
        if let s = try? c.decodeIfPresent(String.self, forKey: key) { return Int(s) }
        return nil
    }
}

struct Phase6State: Codable, Hashable {
    var phase: Int
    var correctStreak: Int
    var nextReviewAt: Date
    var lastReviewedAt: Date?

    enum CodingKeys: String, CodingKey {
        case phase
        case correctStreak = "correct_streak"
        case nextReviewAt = "next_review_at"
        case lastReviewedAt = "last_reviewed_at"
    }

    init(phase: Int, correctStreak: Int, nextReviewAt: Date, lastReviewedAt: Date?) {
        self.phase = phase
        self.correctStreak = correctStreak
        self.nextReviewAt = nextReviewAt
        self.lastReviewedAt = lastReviewedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        phase = try c.decodeIfPresent(Int.self, forKey: .phase) ?? 1
        correctStreak = try c.decodeIfPresent(Int.self, forKey: .correctStreak) ?? 0
        nextReviewAt = ISO.date(try c.decodeIfPresent(String.self, forKey: .nextReviewAt)) ?? .distantPast
        lastReviewedAt = ISO.date(try c.decodeIfPresent(String.self, forKey: .lastReviewedAt))
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(phase, forKey: .phase)
        try c.encode(correctStreak, forKey: .correctStreak)
        try c.encode(ISO.string(nextReviewAt), forKey: .nextReviewAt)
        try c.encode(lastReviewedAt.map(ISO.string) ?? "", forKey: .lastReviewedAt)
    }
}

// MARK: - Leitner-Regeln, identisch mit dbUpdatePhase6() in app.js

enum Leitner {
    static let intervalDays: [Int: Int] = [1: 0, 2: 1, 3: 3, 4: 10, 5: 30, 6: 90]

    static func next(after state: Phase6State?, correct: Bool, now: Date = Date()) -> Phase6State {
        let old = state ?? Phase6State(phase: 1, correctStreak: 0, nextReviewAt: now, lastReviewedAt: nil)
        let phase = correct ? min(old.phase + 1, 6) : 1
        let streak = correct ? old.correctStreak + 1 : 0
        let next: Date
        if correct {
            let days = intervalDays[phase] ?? 0
            next = Calendar.current.date(byAdding: .day, value: days, to: now) ?? now
        } else {
            next = now.addingTimeInterval(4 * 3600)
        }
        return Phase6State(phase: phase, correctStreak: streak, nextReviewAt: next, lastReviewedAt: now)
    }
}

// MARK: - Backup-Datei der Web-App (Statistiken > Backup & Geräteübertragung)

/// Das Export-Paket enthält die localStorage-Werte als JSON-Strings:
/// "c" Karten, "p" Phase-6-Stand, "s" abgeschlossene Lernsitzungen (für den Streak).
struct WebBackup: Decodable {
    let exportedAt: String?
    let cards: [Card]
    let phase6: [Int: Phase6State]
    let sessions: [WebSession]

    struct WebSession: Decodable {
        let completedAt: Date?
        let totalCards: Int
        let correctFirstTry: Int

        enum CodingKeys: String, CodingKey {
            case completedAt = "completed_at"
            case totalCards = "total_cards"
            case correctFirstTry = "correct_first_try"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            completedAt = ISO.date(try c.decodeIfPresent(String.self, forKey: .completedAt))
            totalCards = try c.decodeIfPresent(Int.self, forKey: .totalCards) ?? 0
            correctFirstTry = try c.decodeIfPresent(Int.self, forKey: .correctFirstTry) ?? 0
        }
    }

    enum CodingKeys: String, CodingKey {
        case exportedAt = "_exported"
        case c, p, s
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let dec = JSONDecoder()
        exportedAt = try c.decodeIfPresent(String.self, forKey: .exportedAt)
        let cardsJSON = try c.decodeIfPresent(String.self, forKey: .c) ?? "[]"
        cards = try dec.decode([Card].self, from: Data(cardsJSON.utf8))
        let p6JSON = try c.decodeIfPresent(String.self, forKey: .p) ?? "{}"
        let raw = try dec.decode([String: Phase6State].self, from: Data(p6JSON.utf8))
        var map: [Int: Phase6State] = [:]
        for (key, value) in raw {
            if let id = Int(key) { map[id] = value }
        }
        phase6 = map
        let sessionsJSON = try c.decodeIfPresent(String.self, forKey: .s) ?? "[]"
        sessions = (try? dec.decode([WebSession].self, from: Data(sessionsJSON.utf8))) ?? []
    }
}

// MARK: - Grundwortschatz für die Blitzrunde (aus app.js exportiert)

struct VocabWord: Codable, Hashable {
    let de: String
    let it: String
}

struct VocabCategory: Codable {
    let name: String
    let words: [VocabWord]
}

enum Vocabulary {
    /// Grundwortschatz (Grundwortschatz.json, 9 Kategorien) aus dem Vokabelspiel der Web-App.
    static let categories: [VocabCategory] = load("Grundwortschatz")

    /// Grammatik (Grammatik.json: Modalverben, Präpositionen, Präsenz, Vergangenheit).
    static let grammarCategories: [VocabCategory] = load("Grammatik")

    /// Beide Bestände zusammen, so wie „Beides“ im Vokabelspiel.
    static var allCategories: [VocabCategory] { categories + grammarCategories }

    static var allWords: [VocabWord] { categories.flatMap(\.words) }

    private static func load(_ name: String) -> [VocabCategory] {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let cats = try? JSONDecoder().decode([VocabCategory].self, from: data) else {
            return []
        }
        return cats
    }
}

// MARK: - ISO-8601 wie JavaScript's toISOString(), plus das ältere Format "2026-08-07 19:58:45"

enum ISO {
    private static let legacy: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return f
    }()

    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func date(_ s: String?) -> Date? {
        guard let s, !s.isEmpty else { return nil }
        return withFraction.date(from: s) ?? plain.date(from: s) ?? legacy.date(from: s)
    }

    static func string(_ d: Date) -> String { withFraction.string(from: d) }
}
