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

Im Bundle liegt `ImparaWatch/Resources/impara-backup.json`, ein Export der Web-App (Statistiken > Backup & Geräteübertragung, Stand 21. September 2026: 33 Lektionen, 226 Karten). Die App liest ihn beim ersten Start und danach immer dann, wenn das Feld `_exported` der Datei neuer ist als beim letzten Import. Ein neues Backup einspielen heißt also: Datei ersetzen, App neu bauen und installieren. Der Phase-6-Stand wird pro Karte zusammengeführt, der jüngere Eintrag gewinnt; Bewertungen auf der Uhr gehen dabei nicht verloren. Die Sync-Anbindung an den Firebase-Raum ist der nächste Schritt.

Ohne diese Datei fällt die App auf `sample-backup.json` zurück (20 Beispielkarten).

## Blitzrunde

Zieht aus dem Grundwortschatz (`Shared/Resources/Grundwortschatz.json`, 334 Wörter in 9 Kategorien) und der Grammatik (`Shared/Resources/Grammatik.json`: Modalverben, Präpositionen, Präsenz, Vergangenheit, 148 Einträge). Beide Dateien sind aus `app.js` exportiert. Die falschen Antworten kommen aus derselben Kategorie.

## Doppeltipp

Ab watchOS 11 löst die Doppeltipp-Geste (Zeigefinger und Daumen zweimal zusammen) pro Bildschirm eine Taste aus: auf dem Start „5 fällige“, auf der Kartenvorderseite das Aufdecken, auf der Rückseite „Richtig“, im Ergebnis „Noch 5“. Damit lässt sich eine Runde einhändig durchgehen; nur „Falsch“ braucht einen Fingertipp auf die rote Taste. Die Blitzrunde hat keine Doppeltipp-Belegung, weil dort drei gleichwertige Antworten zur Wahl stehen. Wer alles einhändig will, schaltet zusätzlich AssistiveTouch ein (Einstellungen > Bedienungshilfen > AssistiveTouch > Handgesten); damit lassen sich auch ✗ und die Blitz-Antworten per Kneifen und Faustschluss ansteuern.

## Dateien

| Datei | Inhalt |
|---|---|
| `Shared/Models.swift` | Karte, Phase-6-Stand, Leitner-Regeln (identisch mit `dbUpdatePhase6` in `app.js`), Backup-Decoder, Grundwortschatz und Grammatik |
| `Shared/SharedData.swift` | Datenbrücke zum Widget, Farben der Web-App |
| `ImparaWatch/Store.swift` | Laden, Speichern, fällige Karten, Streak, Sitzungsprotokoll |
| `ImparaWatch/Views/HomeView.swift` | Startbildschirm mit Ring und zwei Tasten |
| `ImparaWatch/Views/SessionView.swift` | Kartenrunde: Vorderseite rollt nicht, dort deckt Tippen oder Krone auf; die Rückseite rollt, damit lange Karten ungekürzt dastehen und die Krone durch den Text blättert; zwei Tasten bewerten, Always-On zeigt nur die Vorderseite |
| `ImparaWatch/Views/BlitzView.swift` | Blitzrunde: fünf Wörter aus Grundwortschatz und Grammatik, drei Antworten, acht Sekunden |
| `ImparaWatch/Views/ResultView.swift` | Ergebnis mit „Noch 5“ und „Fertig“ |
| `ImparaWatch/Reminders.swift` | Eine Mitteilung pro Tag um 12:30, nur ab fünf fälligen Karten |
| `ImparaWidget/ImparaWidget.swift` | Komplikation: Ring mit fälligen Karten, Wort pro Stunde, Tippen dreht um |
| `ImparaWatchUITests/FlowUITests.swift` | Durchlauf durch Start, Kartenrunde und Blitzrunde mit Screenshots |

## Was fehlt

Sync mit dem Firebase-Raum der Web-App, die iOS-Hülle für den App Store, Start der Runde direkt aus der Mitteilung, Belegung der Aktionstaste (das geht über die Einstellungen der Uhr, sobald die App installiert ist) und die App Group für das Widget.
