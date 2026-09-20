# Impara Italiano für die Apple Watch, Prototyp

SwiftUI-App für watchOS 10 oder neuer, ohne iPhone-App lauffähig. Sie setzt das Konzept aus `docs/watch/KONZEPT.md` um: fünf fällige Karten pro Einheit, eine Blitzrunde mit Auswahlantworten und ein Widget mit dem Wort des Moments.

Der Code wurde ohne Xcode geschrieben und noch nicht kompiliert. Beim ersten Öffnen sind kleine Korrekturen wahrscheinlich, große nicht.

## Öffnen

Mit XcodeGen (empfohlen):

```
brew install xcodegen
cd watch
xcodegen generate
open ImparaWatch.xcodeproj
```

Ohne XcodeGen: In Xcode ein neues Projekt anlegen (watchOS > App, Name `ImparaWatch`, Sprache Swift, Interface SwiftUI), die erzeugten Swift-Dateien löschen und die Ordner `ImparaWatch` und `Shared` ins Projekt ziehen. Für das Widget zusätzlich ein Target „Widget Extension“ (watchOS) anlegen, dessen generierte Dateien löschen und `ImparaWidget` sowie `Shared` hinzufügen. In beiden Targets muss `Shared/Resources/Grundwortschatz.json` unter „Copy Bundle Resources“ stehen, in der App zusätzlich `ImparaWatch/Resources/sample-backup.json`.

Danach in Xcode unter Signing & Capabilities das Team eintragen. Die App Group `group.de.tischler.impara` braucht ein bezahltes Entwicklerkonto; ohne sie läuft die App trotzdem, nur das Widget kennt dann die fälligen Karten nicht und zeigt den Grundwortschatz.

Zum Ausprobieren im Simulator „Apple Watch Ultra 3 (49mm)“ oder ein anderes 49-mm-Modell wählen.

## Eigene Karten

Beim ersten Start lädt die App Beispieldaten (20 Karten, davon 12 fällig). Für die eigenen Karten in der Web-App unter Statistiken > Backup & Geräteübertragung exportieren, die Datei in `impara-backup.json` umbenennen und nach `ImparaWatch/Resources/` legen. Beim nächsten frischen Start (App im Simulator löschen) liest die App diese Datei statt der Beispieldaten. Die Bewertungen bleiben lokal auf der Uhr; die Sync-Anbindung an den Firebase-Raum ist der nächste Schritt.

## Dateien

| Datei | Inhalt |
|---|---|
| `Shared/Models.swift` | Karte, Phase-6-Stand, Leitner-Regeln (identisch mit `dbUpdatePhase6` in `app.js`), Backup-Decoder, Grundwortschatz |
| `Shared/SharedData.swift` | Datenbrücke zum Widget über die App Group, Farben der Web-App |
| `ImparaWatch/Store.swift` | Laden, Speichern, fällige Karten, Streak, Sitzungsprotokoll |
| `ImparaWatch/Views/HomeView.swift` | Startbildschirm mit Ring und zwei Tasten |
| `ImparaWatch/Views/SessionView.swift` | Kartenrunde: Tippen oder Krone deckt auf, zwei Tasten bewerten, Always-On zeigt nur die Vorderseite |
| `ImparaWatch/Views/BlitzView.swift` | Blitzrunde: fünf Wörter, drei Antworten, acht Sekunden |
| `ImparaWatch/Views/ResultView.swift` | Ergebnis mit „Noch 5“ und „Fertig“ |
| `ImparaWatch/Reminders.swift` | Eine Mitteilung pro Tag um 12:30, nur ab fünf fälligen Karten |
| `ImparaWidget/ImparaWidget.swift` | Komplikation: Ring mit fälligen Karten, Wort pro Stunde, Tippen dreht um |

## Was fehlt

Sync mit dem Firebase-Raum der Web-App, die iOS-Hülle für den App Store, Start der Runde direkt aus der Mitteilung, Belegung der Aktionstaste (das geht über die Einstellungen der Uhr, sobald die App installiert ist) und ein App-Icon.
