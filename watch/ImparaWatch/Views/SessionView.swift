import SwiftUI

/// Eine Lerneinheit: fünf fällige Karten, aufdecken per Tippen oder Krone, bewerten mit zwei Tasten.
struct SessionView: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.isLuminanceReduced) private var dimmed

    @State private var cards: [Card] = []
    @State private var index = 0
    @State private var revealed = false
    @State private var results: [Bool] = []
    @State private var crown = 0.0
    @State private var finished = false

    var body: some View {
        Group {
            if cards.isEmpty {
                ContentUnavailableView("Nichts fällig", systemImage: "checkmark.circle", description: Text("Alle Karten sind im Zeitplan."))
            } else if finished {
                ResultView(results: results, remainingDue: store.dueCount, again: restart, done: { dismiss() })
            } else {
                cardView
            }
        }
        .navigationTitle("Fällig")
        .onAppear {
            if cards.isEmpty && !finished { restart() }
        }
    }

    private var card: Card { cards[index] }

    private var cardView: some View {
        VStack(spacing: 6) {
            HStack {
                PhaseBadge(phase: store.phase6[card.id]?.phase)
                Spacer()
                Text("\(index + 1) / \(cards.count)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            ProgressDots(count: cards.count, results: results, current: index)

            Spacer(minLength: 4)

            if revealed && !dimmed {
                Text(card.front)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(card.back)
                    .font(.system(.title3, design: .rounded, weight: .heavy))
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.7)
                if !card.example.isEmpty {
                    Text(card.example)
                        .font(.caption2)
                        .italic()
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                }
            } else {
                Text(card.front)
                    .font(.system(.title2, design: .rounded, weight: .heavy))
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.6)
            }

            Spacer(minLength: 4)

            if dimmed {
                // Always-On: nur die Vorderseite, keine Tasten.
                Color.clear.frame(height: 1)
            } else if revealed {
                HStack(spacing: 8) {
                    Button { grade(false) } label: {
                        Image(systemName: "xmark").font(.title3.bold()).frame(maxWidth: .infinity)
                    }
                    .tint(.brick)
                    Button { grade(true) } label: {
                        Image(systemName: "checkmark").font(.title3.bold()).frame(maxWidth: .infinity)
                    }
                    .tint(.sage)
                }
                .buttonStyle(.borderedProminent)
            } else {
                Text("Tippen zum Aufdecken")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { if !revealed { reveal() } }
        .focusable()
        .digitalCrownRotation($crown, from: 0, through: 1, by: 0.25, sensitivity: .medium,
                              isContinuous: false, isHapticFeedbackEnabled: false)
        .onChange(of: crown) { _, value in
            if value >= 0.5 && !revealed { reveal() }
        }
    }

    private func restart() {
        cards = store.nextSession()
        index = 0
        results = []
        revealed = false
        crown = 0
        finished = false
    }

    private func reveal() {
        Haptics.reveal()
        withAnimation(.easeOut(duration: 0.15)) { revealed = true }
    }

    private func grade(_ correct: Bool) {
        if correct { Haptics.correct() } else { Haptics.wrong() }
        store.grade(card: card, correct: correct)
        results.append(correct)
        if index + 1 < cards.count {
            index += 1
            revealed = false
            crown = 0
        } else {
            store.logSession(kind: "due", total: cards.count, correct: results.filter { $0 }.count)
            Haptics.finished()
            finished = true
        }
    }
}
