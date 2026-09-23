import Foundation
import SwiftUI

/// Brücke zwischen App und Widget über eine App Group.
/// Ohne App Group (z. B. ohne Team in Xcode) fällt alles auf UserDefaults.standard zurück;
/// das Widget zeigt dann den gebündelten Grundwortschatz und keine fälligen Karten.
enum SharedData {
    static let suiteName = "group.de.tischler.impara"

    private static var defaults: UserDefaults {
        UserDefaults(suiteName: suiteName) ?? .standard
    }

    private enum Key {
        static let dueCount = "dueCount"
        static let words = "widgetWords"
        static let flippedWord = "flippedWord"
    }

    static func publish(dueCount: Int, words: [VocabWord]) {
        defaults.set(dueCount, forKey: Key.dueCount)
        if let data = try? JSONEncoder().encode(words) {
            defaults.set(data, forKey: Key.words)
        }
    }

    static var dueCount: Int { defaults.integer(forKey: Key.dueCount) }

    static var words: [VocabWord] {
        guard let data = defaults.data(forKey: Key.words),
              let words = try? JSONDecoder().decode([VocabWord].self, from: data) else { return [] }
        return words
    }

    /// Das italienische Wort, das im Widget gerade umgedreht ist (nil = Vorderseite).
    static var flippedWord: String? {
        get { defaults.string(forKey: Key.flippedWord) }
        set { defaults.set(newValue, forKey: Key.flippedWord) }
    }
}

extension Color {
    /// Farben der Web-App (style.css)
    static let terracotta = Color(red: 0xC4 / 255, green: 0x72 / 255, blue: 0x4A / 255)
    static let sage = Color(red: 0x4A / 255, green: 0x8C / 255, blue: 0x6A / 255)
    static let brick = Color(red: 0xC4 / 255, green: 0x4B / 255, blue: 0x3F / 255)
    static let gold = Color(red: 0xC4 / 255, green: 0x92 / 255, blue: 0x34 / 255)
}
