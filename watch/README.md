# Impara Italiano für die Apple Watch, Prototyp

SwiftUI-App für watchOS 10 oder neuer, ohne iPhone-App lauffähig. Sie setzt das Konzept aus `docs/watch/KONZEPT.md` um: fünf fällige Karten pro Einheit, eine Blitzrunde mit Auswahlantworten und ein Widget mit dem Wort des Moments.

Stand: übersetzt sich ohne Fehler und ohne Warnungen (Xcode 27, watchOS-27-SDK), läuft im Simulator und auf einer echten Uhr. Screenshots in `docs/watch/screenshot-simulator*.png`.

## Öffnen

Mit XcodeGen (empfohlen):

```
brew install xcodegen
cd watch
xcodegen generate
open ImparaWatch.xcodeproj
```

Ohne XcodeGen: In Xcode ein neues Projekt anlegen (watchOS > App, Name `ImparaWatch`, Sprache Swift, Interface SwiftUI), die erzeugten Swift-Dateien löschen und die Ordner `ImparaWatch` und `Shared` ins Projekt ziehen. Für das Widget zusätzlich ein Target „Widget Extension“ (watchOS) anlegen, dessen generierte Dateien löschen und `ImparaWidget` sowie `Shared` hinzufügen. In beiden Targets muss `Shared/Resources/Grundwortschatz.json` unter „Copy Bundle Resources“ stehen, in der App zusätzlich `ImparaWatch/Resources/sample-backup.json`.

Danach in Xcode unter Signing & Capabilities das Team eintragen.

## Bauen und ausprobieren

Simulator:

```
xcodebuild -project ImparaWatch.xcodeproj -scheme ImparaWatch \
  -destination 'platform=watchOS Simulator,id=<UDID>' build
```

Die UDID kommt aus `xcrun simctl list devices`. Ein Hinweis zur Bequemlichkeit: `-destination '…,name=Apple Watch Ultra 3 (49mm)'` findet ungepaarte Uhren-Simulatoren nicht zuverlässig, über die UDID klappt es immer.

Echte Uhr (Entwicklermodus auf der Uhr einschalten, Uhr per iPhone am Mac):

```
xcrun devicectl list devices                     # UDID der Uhr ablesen
xcodebuild -project ImparaWatch.xcodeproj -scheme ImparaWatch \
  -destination 'platform=watchOS,id=<UDID>' \
  DEVELOPMENT_TEAM=<Team-ID> -allowProvisioningUpdates build
xcrun devicectl device install app --device <UDID> \
  <DerivedData>/Build/Products/Debug-watchos/ImparaWatch.app
```

Xcode 27 liefert keine eigene Simulator.app mehr, man kann also nicht einfach mit der Maus im Uhren-Simulator klicken. Die Bedienung prüft stattdessen der UI-Test in `ImparaWatchUITests`: er deckt eine Karte auf, bewertet fünf Karten, spielt eine Blitzrunde und legt zu jedem Schritt einen Screenshot ab.

```
xcodebuild -project ImparaWatch.xcodeproj -scheme ImparaWatch \
  -destination 'platform=watchOS Simulator,id=<UDID>' \
  -resultBundlePath ergebnis.xcresult test
xcrun xcresulttool export attachments --path ergebnis.xcresult --output-path bilder
```

## App Group

`group.de.tischler.impara` ist im Entwicklerkonto nicht angelegt, deshalb schlug die Signierung damit fehl; die Gruppe ist aus beiden Zielen entfernt. `SharedData` fällt dann auf `UserDefaults.standard` zurück — die App läuft vollständig, nur das Widget kennt die fälligen Karten nicht und zeigt den gebündelten Grundwortschatz. Zum Aktivieren die Gruppe im Developer-Portal registrieren und die auskommentierten `entitlements`-Blöcke in `project.yml` wieder eintragen.

## Eigene Karten

Beim ersten Start lädt die App Beispieldaten (20 Karten, davon 12 fällig). Für die eigenen Karten in der Web-App unter Statistiken > Backup & Geräteübertragung exportieren, die Datei in `impara-backup.json` umbenennen und nach `ImparaWatch/Resources/` legen. Beim nächsten frischen Start (App im Simulator löschen) liest die App diese Datei statt der Beispieldaten. Die Bewertungen bleiben lokal auf der Uhr; die Sync-Anbindung an den Firebase-Raum ist der nächste Schritt.

## Dateien

| Datei | Inhalt |
|---|---|
| `Shared/Models.swift` | Karte, Phase-6-Stand, Leitner-Regeln (identisch mit `dbUpdatePhase6` in `app.js`), Backup-Decoder, Grundwortschatz |
| `Shared/SharedData.swift` | Datenbrücke zum Widget, Farben der Web-App |
| `ImparaWatch/Store.swift` | Laden, Speichern, fällige Karten, Streak, Sitzungsprotokoll |
| `ImparaWatch/Views/HomeView.swift` | Startbildschirm mit Ring und zwei Tasten |
| `ImparaWatch/Views/SessionView.swift` | Kartenrunde: Tippen oder Krone deckt auf, zwei Tasten bewerten, Always-On zeigt nur die Vorderseite |
| `ImparaWatch/Views/BlitzView.swift` | Blitzrunde: fünf Wörter, drei Antworten, acht Sekunden |
| `ImparaWatch/Views/ResultView.swift` | Ergebnis mit „Noch 5“ und „Fertig“ |
| `ImparaWatch/Reminders.swift` | Eine Mitteilung pro Tag um 12:30, nur ab fünf fälligen Karten |
| `ImparaWidget/ImparaWidget.swift` | Komplikation: Ring mit fälligen Karten, Wort pro Stunde, Tippen dreht um |
| `ImparaWatchUITests/FlowUITests.swift` | Durchlauf durch Start, Kartenrunde und Blitzrunde mit Screenshots |

## Was fehlt

Sync mit dem Firebase-Raum der Web-App, die iOS-Hülle für den App Store, Start der Runde direkt aus der Mitteilung, Belegung der Aktionstaste (das geht über die Einstellungen der Uhr, sobald die App installiert ist), die App Group für das Widget und ein App-Icon. Kleinigkeit fürs Auge: in der Kartenrunde und in der Blitzrunde überlagern sich die Kopfzeile der Ansicht und der Navigationstitel.
