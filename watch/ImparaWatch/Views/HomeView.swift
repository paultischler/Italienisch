import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var store: Store

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    DueRing(due: store.dueCount, total: max(store.learnedCount, 1))
                        .padding(.top, 2)

                    Text(streakLine)
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    NavigationLink {
                        SessionView()
                    } label: {
                        Text(store.dueCount > 0 ? "\(min(store.dueCount, Store.sessionSize)) fällige" : "5 Karten")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.terracotta)
                    .disabled(store.cards.isEmpty)
                    .doubleTapAction()

                    NavigationLink {
                        BlitzView()
                    } label: {
                        Text("Blitzrunde")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    if store.cards.isEmpty {
                        Text("Keine Karten. Backup der Web-App als impara-backup.json ins Bundle legen.")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                }
            }
            .navigationTitle("Impara")
        }
        .task {
            await Reminders.requestAuthorization()
        }
    }

    private var streakLine: String {
        let days = store.streak
        let state = store.studiedToday ? "heute erledigt" : "heute noch offen"
        return "🔥 \(days) \(days == 1 ? "Tag" : "Tage") · \(state)"
    }
}
