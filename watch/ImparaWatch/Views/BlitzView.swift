import Combine
import SwiftUI

/// Fünf Wörter aus Grundwortschatz und Grammatik, je drei Antworten, acht Sekunden Zeit. Kein Tippen.
struct BlitzView: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss

    struct Round: Identifiable {
        let id = UUID()
        let word: VocabWord
        let category: String
        let options: [String]
    }

    /// Eine beantwortete Frage. chosen == nil heißt: Zeit abgelaufen.
    struct Answer: Identifiable {
        let id = UUID()
        let word: VocabWord
        let category: String
        let chosen: String?
        var correct: Bool { chosen == word.it }
    }

    static let roundsPerSession = 5
    static let secondsPerWord = 8
    /// So lange bleibt die Färbung stehen, bevor die nächste Frage kommt.
    static let pauseAfterCorrect = 0.8
    static let pauseAfterWrong = 1.8

    @State private var rounds: [Round] = []
    @State private var index = 0
    @State private var chosen: String?
    @State private var answered = false
    @State private var answers: [Answer] = []
    @State private var secondsLeft = BlitzView.secondsPerWord
    @State private var finished = false
    @State private var isRetry = false

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        Group {
            if rounds.isEmpty {
                ContentUnavailableView("Kein Wortschatz", systemImage: "book.closed", description: Text("Grundwortschatz.json fehlt im Bundle."))
            } else if finished {
                BlitzResultView(answers: answers, retryWrong: retryWrong, again: restart, done: { dismiss() })
            } else {
                roundView
            }
        }
        .navigationTitle(isRetry && !finished ? "Wiederholen" : "Blitz")
        .onAppear { if rounds.isEmpty { restart() } }
        .onReceive(timer) { _ in tick() }
    }

    private var round: Round { rounds[index] }

    private var lastAnswerCorrect: Bool? {
        guard answered, let last = answers.last else { return nil }
        return last.correct
    }

    private var roundView: some View {
        ScrollView {
            VStack(spacing: 6) {
                HStack {
                    Text("\(index + 1) / \(rounds.count)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Spacer()
                    statusBadge
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
                            .padding(.vertical, 9)
                            .padding(.horizontal, 6)
                            .foregroundStyle(textColor(for: option))
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(fill(for: option))
                            )
                            .overlay(alignment: .trailing) { markIcon(for: option) }
                    }
                    .buttonStyle(.plain)
                    .animation(.easeOut(duration: 0.15), value: answered)
                }
            }
        }
    }

    /// Oben rechts: Restzeit, nach der Antwort ein Haken oder ein Kreuz.
    @ViewBuilder
    private var statusBadge: some View {
        if let correct = lastAnswerCorrect {
            Image(systemName: correct ? "checkmark" : "xmark")
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(.white)
                .frame(width: 24, height: 24)
                .background(Circle().fill(correct ? Color.sage : Color.brick))
        } else {
            Text("\(secondsLeft)")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .frame(width: 24, height: 24)
                .overlay(Circle().stroke(secondsLeft <= 3 ? Color.brick : Color.gold, lineWidth: 2))
        }
    }

    // MARK: Färbung nach der Antwort

    private func fill(for option: String) -> Color {
        guard answered else { return Color.white.opacity(0.14) }
        if option == round.word.it { return .sage }
        if option == chosen { return .brick }
        return Color.white.opacity(0.06)
    }

    private func textColor(for option: String) -> Color {
        guard answered else { return .primary }
        if option == round.word.it || option == chosen { return .white }
        return .secondary
    }

    @ViewBuilder
    private func markIcon(for option: String) -> some View {
        if answered && (option == round.word.it || option == chosen) {
            Image(systemName: option == round.word.it ? "checkmark" : "xmark")
                .font(.system(size: 11, weight: .heavy))
                .foregroundStyle(.white)
                .padding(.trailing, 8)
        }
    }

    // MARK: Ablauf

    private func start(_ newRounds: [Round], retry: Bool) {
        rounds = newRounds
        index = 0
        answers = []
        chosen = nil
        answered = false
        secondsLeft = BlitzView.secondsPerWord
        isRetry = retry
        finished = false
    }

    private func restart() {
        start(BlitzView.makeRounds(), retry: false)
    }

    /// Neue Runde nur mit den falsch beantworteten Wörtern, mit frisch gemischten Antworten.
    private func retryWrong() {
        let wrong = answers.filter { !$0.correct }
        guard !wrong.isEmpty else { return }
        start(wrong.map { BlitzView.makeRound(word: $0.word, categoryName: $0.category) }.shuffled(), retry: true)
    }

    private func tick() {
        guard !finished, !rounds.isEmpty, !answered else { return }
        secondsLeft -= 1
        if secondsLeft <= 0 { answer(nil) }
    }

    private func answer(_ option: String?) {
        guard !answered else { return }
        let current = round
        let result = Answer(word: current.word, category: current.category, chosen: option)
        chosen = option
        answered = true
        answers.append(result)
        if result.correct { Haptics.correct() } else { Haptics.wrong() }
        let pause = result.correct ? BlitzView.pauseAfterCorrect : BlitzView.pauseAfterWrong
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(pause))
            advance()
        }
    }

    private func advance() {
        if index + 1 < rounds.count {
            index += 1
            chosen = nil
            answered = false
            secondsLeft = BlitzView.secondsPerWord
        } else {
            store.logSession(kind: "blitz", total: answers.count, correct: answers.filter(\.correct).count)
            Haptics.finished()
            finished = true
        }
    }

    // MARK: Fragen bauen

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
            rounds.append(makeRound(word: word, categoryName: category.name))
        }
        return rounds
    }

    static func makeRound(word: VocabWord, categoryName: String) -> Round {
        let pool = Vocabulary.allCategories.first { $0.name == categoryName }?.words ?? Vocabulary.allWords
        let distractors = Array(Set(pool.map(\.it)).subtracting([word.it])).shuffled().prefix(2)
        return Round(word: word, category: categoryName, options: ([word.it] + distractors).shuffled())
    }
}

/// Ergebnis der Blitzrunde: Falsche wiederholen, Lösungen ansehen, neue Runde.
struct BlitzResultView: View {
    @EnvironmentObject private var store: Store

    let answers: [BlitzView.Answer]
    let retryWrong: () -> Void
    let again: () -> Void
    let done: () -> Void

    private var correctCount: Int { answers.filter(\.correct).count }
    private var wrongCount: Int { answers.count - correctCount }

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("\(correctCount)")
                        .font(.system(size: 40, weight: .heavy, design: .rounded))
                    Text("/ \(answers.count)")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                ProgressDots(count: answers.count, results: answers.map(\.correct), current: -1)

                Text("🔥 \(store.streak) \(store.streak == 1 ? "Tag" : "Tage")")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 4)

                if wrongCount > 0 {
                    Button(action: retryWrong) {
                        Label("\(wrongCount) Falsche wiederholen", systemImage: "arrow.counterclockwise")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.brick)
                    .doubleTapAction()
                }

                NavigationLink {
                    BlitzSolutionsView(answers: answers)
                } label: {
                    Label("Lösungen", systemImage: "list.bullet")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                if wrongCount == 0 {
                    Button(action: again) {
                        Text("Ancora").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.terracotta)
                    .doubleTapAction()
                } else {
                    Button(action: again) {
                        Text("Ancora").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }

                Button(action: done) {
                    Text("Fertig").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
        .navigationTitle("Fertig")
    }
}

/// Alle Fragen der Runde mit Lösung; bei Fehlern steht die eigene Antwort darunter.
struct BlitzSolutionsView: View {
    let answers: [BlitzView.Answer]

    var body: some View {
        List(answers) { a in
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Image(systemName: a.correct ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .font(.caption2)
                        .foregroundStyle(a.correct ? Color.sage : Color.brick)
                    Text(a.word.de)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Text(a.word.it)
                    .font(.system(.body, design: .rounded, weight: .bold))
                if !a.correct {
                    Text(a.chosen.map { "Deine Antwort: \($0)" } ?? "Zeit abgelaufen")
                        .font(.caption2)
                        .foregroundStyle(Color.brick)
                }
            }
            .padding(.vertical, 2)
        }
        .navigationTitle("Lösungen")
    }
}
