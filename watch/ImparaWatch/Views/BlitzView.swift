import Combine
import SwiftUI

/// Fünf Wörter aus Grundwortschatz und Grammatik, je drei Antworten, acht Sekunden Zeit. Kein Tippen.
struct BlitzView: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss

    struct Round {
        let word: VocabWord
        let options: [String]
    }

    static let roundsPerSession = 5
    static let secondsPerWord = 8

    @State private var rounds: [Round] = []
    @State private var index = 0
    @State private var chosen: String?
    @State private var results: [Bool] = []
    @State private var secondsLeft = BlitzView.secondsPerWord
    @State private var finished = false

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        Group {
            if rounds.isEmpty {
                ContentUnavailableView("Kein Wortschatz", systemImage: "book.closed", description: Text("Grundwortschatz.json fehlt im Bundle."))
            } else if finished {
                ResultView(results: results, remainingDue: nil, again: restart, done: { dismiss() })
            } else {
                roundView
            }
        }
        .navigationTitle("Blitz")
        .onAppear { if rounds.isEmpty { restart() } }
        .onReceive(timer) { _ in tick() }
    }

    private var round: Round { rounds[index] }

    private var roundView: some View {
        ScrollView {
            VStack(spacing: 6) {
                HStack {
                    Text("\(index + 1) / \(rounds.count)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("\(secondsLeft)")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .frame(width: 24, height: 24)
                        .overlay(Circle().stroke(secondsLeft <= 3 ? Color.brick : Color.gold, lineWidth: 2))
                }
                Text(round.word.de)
                    .font(.system(.title3, design: .rounded, weight: .heavy))
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.6)
                    .lineLimit(2)
                    .padding(.vertical, 2)

                ForEach(round.options, id: \.self) { option in
                    Button { answer(option) } label: {
                        Text(option)
                            .font(.footnote.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                    .buttonStyle(.bordered)
                    .tint(tint(for: option))
                    .disabled(chosen != nil)
                }
            }
        }
    }

    private func tint(for option: String) -> Color? {
        guard chosen != nil else { return nil }
        if option == round.word.it { return .sage }
        if option == chosen { return .brick }
        return nil
    }

    private func restart() {
        rounds = BlitzView.makeRounds()
        index = 0
        results = []
        chosen = nil
        secondsLeft = BlitzView.secondsPerWord
        finished = false
    }

    private func tick() {
        guard !finished, !rounds.isEmpty, chosen == nil else { return }
        secondsLeft -= 1
        if secondsLeft <= 0 { answer(nil) }
    }

    private func answer(_ option: String?) {
        guard chosen == nil else { return }
        let correct = option == round.word.it
        chosen = option ?? "⏱"
        if correct { Haptics.correct() } else { Haptics.wrong() }
        results.append(correct)
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(0.7))
            advance()
        }
    }

    private func advance() {
        if index + 1 < rounds.count {
            index += 1
            chosen = nil
            secondsLeft = BlitzView.secondsPerWord
        } else {
            store.logSession(kind: "blitz", total: rounds.count, correct: results.filter { $0 }.count)
            Haptics.finished()
            finished = true
        }
    }

    /// Zieht fünf Wörter aus allen Kategorien (Grundwortschatz und Grammatik);
    /// die falschen Antworten stammen aus derselben Kategorie, bei Konjugationen also
    /// aus demselben Verb-Block.
    static func makeRounds() -> [Round] {
        let categories = Vocabulary.allCategories.filter { $0.words.count >= 3 }
        guard !categories.isEmpty else { return [] }
        var rounds: [Round] = []
        var used = Set<String>()
        while rounds.count < roundsPerSession {
            let category = categories.randomElement()!
            let word = category.words.randomElement()!
            if used.contains(word.it) { continue }
            used.insert(word.it)
            let distractors = category.words.filter { $0.it != word.it }.shuffled().prefix(2).map(\.it)
            rounds.append(Round(word: word, options: ([word.it] + distractors).shuffled()))
        }
        return rounds
    }
}
