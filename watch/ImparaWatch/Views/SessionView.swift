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
        // Titel in der Leiste neben der Uhrzeit statt in einer eigenen Zeile.
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if cards.isEmpty && !finished { restart() }
        }
    }

    private var card: Card { cards[index] }

    private var cardView: some View {
        Group {
            if revealed && !dimmed {
                revealedView
            } else {
                coveredView
            }
        }
    }

    /// Kopfzeile: Phase, Fortschrittspunkte, Zähler.
    private var header: some View {
        HStack(spacing: 6) {
            PhaseBadge(phase: store.phase6[card.id]?.phase)
            Spacer(minLength: 2)
            ProgressDots(count: cards.count, results: results, current: index)
            Spacer(minLength: 2)
            Text("\(index + 1) / \(cards.count)")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    /// Rückseite. Sie rollt, damit lange Karten vollständig dastehen: kein
    /// lineLimit, kein Verkleinern, jeder Text bekommt mit fixedSize seine
    /// volle Höhe. Zum Lesen dreht man die Krone, die hier nicht mehr zum
    /// Aufdecken gebraucht wird. Die ScrollView setzt den Inhalt selbst unter
    /// die Navigationsleiste, ein eigener oberer Abstand entfällt.
    private var revealedView: some View {
        ScrollView {
            VStack(spacing: 4) {
                header

                Text(card.front)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                Text(card.back)
                    .font(.system(.title3, design: .rounded, weight: .heavy))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                if !card.example.isEmpty {
                    Text(card.example)
                        .font(.caption2)
                        .italic()
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 2)
                }
                if !card.notes.isEmpty {
                    // Notizen der Karte (z. B. die Regel hinter der Präposition).
                    Text(card.notes)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 2)
                }

                HStack(spacing: 8) {
                    Button { grade(false) } label: {
                        Image(systemName: "xmark").font(.title3.bold()).frame(maxWidth: .infinity)
                    }
                    .tint(.brick)
                    Button { grade(true) } label: {
                        Image(systemName: "checkmark").font(.title3.bold()).frame(maxWidth: .infinity)
                    }
                    .tint(.sage)
                    .doubleTapAction()   // Doppeltipp = Richtig
                }
                .buttonStyle(.borderedProminent)
                .padding(.top, 6)
            }
        }
        .padding(.horizontal, 6)
    }

    /// Vorderseite, auch im Always-On-Zustand. Sie rollt nicht, damit die Krone
    /// zum Aufdecken frei bleibt; deshalb hält sie sich mit eigenem Abstand
    /// unter der Navigationsleiste: die bleibt 66pt hoch, Zurück-Pfeil und
    /// Titel enden bei 58pt. Gemessen mit dem UI-Test, siehe README.
    private var coveredView: some View {
        VStack(spacing: 4) {
            header

            Spacer(minLength: 2)

            Text(card.front)
                .font(.system(.title2, design: .rounded, weight: .heavy))
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.5)

            Spacer(minLength: 2)

            if dimmed {
                // Always-On: nur die Vorderseite, keine Tasten.
                Color.clear.frame(height: 1)
            } else {
                // Als Taste, damit der Doppeltipp die Karte aufdecken kann.
                Button { reveal() } label: {
                    Text("Tippen zum Aufdecken")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
                .doubleTapAction()   // Doppeltipp = Aufdecken
            }
        }
        .padding(.top, 28)
        .padding(.horizontal, 6)
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
