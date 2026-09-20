import SwiftUI

/// Ergebnis nach genau fünf Karten. Weiter nur auf Wunsch.
struct ResultView: View {
    @EnvironmentObject private var store: Store

    let results: [Bool]
    /// Zahl der noch fälligen Karten; nil in der Blitzrunde.
    let remainingDue: Int?
    let again: () -> Void
    let done: () -> Void

    private var correct: Int { results.filter { $0 }.count }

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("\(correct)")
                        .font(.system(size: 40, weight: .heavy, design: .rounded))
                    Text("/ \(results.count)")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                ProgressDots(count: results.count, results: results, current: -1)

                Text(subline)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 4)

                Button(action: again) {
                    Text(remainingDue == nil ? "Ancora" : "Noch 5")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.terracotta)

                Button(action: done) {
                    Text("Fertig").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
        .navigationTitle("Fertig")
    }

    private var subline: String {
        let days = store.streak
        var s = "🔥 \(days) \(days == 1 ? "Tag" : "Tage")"
        if let remainingDue {
            s += remainingDue > 0 ? " · \(remainingDue) noch fällig" : " · alles erledigt"
        }
        return s
    }
}
