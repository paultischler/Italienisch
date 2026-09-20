import SwiftUI

/// Ring mit der Zahl der fälligen Karten (Startbildschirm).
struct DueRing: View {
    let due: Int
    let total: Int

    private var fraction: Double {
        guard total > 0 else { return 0 }
        return min(1, Double(due) / Double(total))
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.12), lineWidth: 9)
            Circle()
                .trim(from: 0, to: fraction)
                .stroke(Color.terracotta, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(due)")
                    .font(.system(size: 30, weight: .heavy, design: .rounded))
                Text("fällig")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 84, height: 84)
        .accessibilityLabel("\(due) Karten fällig")
    }
}

/// Fünf Punkte: erledigte Karten grün oder rot, die aktuelle in Terrakotta.
struct ProgressDots: View {
    let count: Int
    let results: [Bool]
    let current: Int

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<count, id: \.self) { i in
                Circle()
                    .fill(color(for: i))
                    .frame(width: 7, height: 7)
            }
        }
    }

    private func color(for i: Int) -> Color {
        if i < results.count { return results[i] ? .sage : .brick }
        if i == current { return .terracotta }
        return Color.white.opacity(0.2)
    }
}

struct PhaseBadge: View {
    let phase: Int?

    var body: some View {
        Text(phase.map { "Phase \($0)" } ?? "Neu")
            .font(.system(size: 10, weight: .bold))
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .overlay(Capsule().stroke(Color.white.opacity(0.25), lineWidth: 1))
            .foregroundStyle(.secondary)
    }
}
