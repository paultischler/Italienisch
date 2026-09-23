# Impara Italiano für die Apple Watch Ultra

Kurzkonzept, Stand September 2026. Wireframes: `wireframes.html` im selben Ordner.

## Idee in einem Satz

Die Watch-App ist kein Ersatz für die Web-App, sondern ihr Taschenformat: eine Lerneinheit dauert fünf Karten oder etwa eine Minute und lässt sich ohne Tastatur mit einem Daumen erledigen.

## Was die Watch übernimmt und was nicht

Die Watch nutzt die Daten, die es schon gibt: Lektionen, Karten, Phase-6-Stand und Streak. Sie zeigt sie nur in kleinerem Format und macht daraus kurze Häppchen. Lektionen anlegen, Karten bearbeiten, Screenshots hochladen und Statistiken bleiben in der Web-App.

Auf der Watch gibt es drei Dinge:

1. Fällige Karten (Phase 6). Die App holt die fälligen Karten und zeigt sie fünf Stück am Stück. Das ist die Hauptfunktion und der Grund, die App überhaupt zu öffnen.
2. Blitzrunde. Fünf Vokabeln aus dem Grundwortschatz als Auswahl aus drei Antworten, angelehnt an das Vokabelspiel in der Web-App. Kein Tippen, Zeitlimit pro Karte 8 Sekunden.
3. Wort des Moments. Eine einzelne Karte als Widget im Smart Stack oder als Komplikation auf dem Zifferblatt. Antippen dreht die Karte um. So lernt man beim Blick auf die Uhr nebenbei.

## Ablauf einer Lerneinheit

Startbildschirm: Ein Ring zeigt, wie viele Karten heute fällig sind, darunter der Streak. Zwei große Tasten: „5 fällige“ und „Blitzrunde“. Auf der Ultra lässt sich die Aktionstaste so belegen, dass sie direkt eine Runde mit fälligen Karten startet.

Karte: Die Vorderseite zeigt die Frage groß, darüber den Phase-Badge und fünf Punkte als Fortschritt. Antippen oder Krone drehen deckt die Antwort auf. Die Rückseite zeigt die Antwort und, wenn vorhanden, den Beispielsatz. Unten zwei Tasten: Falsch (rot, links) und Richtig (grün, rechts). Die Positionen sind fest, damit man nach kurzer Zeit blind trifft.

Haptik: Ein kurzer Tick beim Aufdecken, ein doppelter bei Richtig, ein schwerer bei Falsch. Kein Ton.

Ende: Nach fünf Karten steht das Ergebnis (zum Beispiel 4 von 5), der Streak aktualisiert sich, und es gibt zwei Ausgänge: „Noch 5“ oder „Fertig“. Es gibt bewusst keine endlose Runde; wer weitermachen will, drückt nochmal.

Die Bewertung wird nach denselben Regeln verbucht wie in der Web-App: richtig hebt die Phase um eins (maximal 6) und setzt den nächsten Termin nach den Intervallen 0, 1, 3, 10, 30, 90 Tage; falsch setzt auf Phase 1 zurück, nächster Termin in 4 Stunden. Ein Ergebnis von der Watch zählt also wie eines vom Handy.

## Erinnerungen

Eine Mitteilung pro Tag, zu einer festen Uhrzeit, nur wenn mindestens fünf Karten fällig sind: „12 Karten fällig, 1 Minute?“. Aus der Mitteilung startet die Runde direkt. Am Abend, falls der Streak sonst reißt, eine zweite Erinnerung. Mehr nicht; wer die Watch öfter belästigt, wird stummgeschaltet.

## Bildschirm und Bedienung

Das Ultra-Display ist mit rund 410 mal 502 Pixeln (Ultra 2) bzw. 422 mal 514 Pixeln (Ultra 3) das größte der Reihe; die Ultra 4 hat ein ähnliches Format. Damit passen eine Frage in großer Schrift, ein Beispielsatz und zwei Tasten auf einen Bildschirm, ohne zu scrollen. Längere Beispielsätze scrollen mit der Krone.

Mindestgrößen: Tasten 44 Punkte hoch, über die volle Breite geteilt. Frage in SF Rounded, 26 Punkte, fett. Antworttasten in den Farben der Web-App (Grün 4a8c6a, Rot c44b3f) auf schwarzem Hintergrund, Akzent Terrakotta c4724a. Schwarz ist auf der Watch Pflicht, weil das Display dann Strom spart und Always-On-Ansicht sauber funktioniert.

Always-On: Zeigt die Vorderseite der aktuellen Karte gedimmt. So bleibt der Blick auf die Uhr eine Wiederholung.

## Technik, so knapp wie möglich

Die Web-App ist eine PWA. Eine PWA läuft nicht auf der Watch, deshalb braucht es eine native watchOS-App in SwiftUI. Da Watch-Apps im App Store nur zusammen mit einer iOS-App erscheinen können, kommt eine kleine iOS-Hülle dazu, die die vorhandene Web-App in einem WebView öffnet. Mehr macht die Hülle nicht.

Daten: Die Watch tritt demselben Firebase-Sync-Raum bei, den die Web-App schon nutzt (Ende-zu-Ende verschlüsselt). Den Raumschlüssel überträgt die iOS-Hülle einmalig per WatchConnectivity auf die Uhr. Die Watch hält eine lokale Kopie der Karten und des Phase-6-Standes, arbeitet offline und schickt Ergebnisse nach, sobald sie Netz hat. Für Konflikte gilt die Regel, die die Web-App schon hat: pro Karte gewinnt der jüngere Stand.

Was in Version 1 fehlt und erst später kommt: Spracheingabe (die Watch kann diktieren, die Trefferquote bei italienischen Wörtern ist aber unsicher), Grammatikkategorien in der Blitzrunde, Lektionen auswählen.

## Aufwand

Grob geschätzt: iOS-Hülle plus Sync-Anbindung zwei Wochen, Watch-App mit den drei Funktionen drei Wochen, Widget und Mitteilungen eine Woche. Apple-Entwicklerkonto nötig (99 Dollar im Jahr). Ohne App-Store-Veröffentlichung geht es auch über TestFlight, dann muss die App alle 90 Tage neu installiert werden.
