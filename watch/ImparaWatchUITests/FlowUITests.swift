import XCTest

final class FlowUITests: XCTestCase {
    let app = XCUIApplication()

    func testWalkthrough() throws {
        app.launch()

        // Mitteilungs-Dialog gehört zu Carousel, nicht zur App.
        let carousel = XCUIApplication(bundleIdentifier: "com.apple.Carousel")
        let allow = carousel.buttons["Erlauben"]
        if allow.waitForExistence(timeout: 12) { allow.tap(); sleep(2) }

        // --- Start ---
        XCTAssertTrue(app.buttons["Blitzrunde"].waitForExistence(timeout: 10), "Startbildschirm fehlt")
        step("01-home")

        // --- Kartenrunde ---
        let due = app.buttons.matching(NSPredicate(format: "label CONTAINS 'fällige' OR label CONTAINS 'Karten'")).firstMatch
        XCTAssertTrue(due.exists, "Taste für die Kartenrunde fehlt")
        due.tap()
        sleep(2)
        step("02-card-front")

        let grade = app.buttons["checkmark"]
        XCTAssertFalse(grade.exists, "Bewertungstasten dürfen vor dem Aufdecken nicht da sein")

        for round in 1...5 {
            if round == 1 {
                // Die Krone darf die Karte NICHT aufdecken.
                XCUIDevice.shared.rotateDigitalCrown(delta: 1.0)
                sleep(2)
                XCTAssertFalse(grade.exists, "Krone hat die Karte aufgedeckt, soll sie aber nicht")
                center().tap()
            } else if round == 3 {
                // Doppeltipp deckt auf.
                XCUIDevice.shared.perform(handGesture: .doubleTap)
            } else {
                center().tap()
            }
            XCTAssertTrue(grade.waitForExistence(timeout: 5), "Karte \(round) nicht aufgedeckt")
            step("03-card-back-\(round)")

            // Karte 4 ist höher als der Bildschirm. Die Krone muss sofort
            // rollen, ohne dass vorher jemand mit dem Finger gewischt hat.
            if round == 4 {
                let before = grade.frame.maxY
                XCTAssertGreaterThan(before, 257, "Karte 4 sollte über den Rand laufen")
                XCUIDevice.shared.rotateDigitalCrown(delta: 1.0)
                sleep(2)
                let after = grade.frame.maxY
                step("03-card-back-4-gerollt")
                XCTAssertLessThan(after, before - 20,
                                  "Krone rollt die Rückseite nicht (vorher \(before), nachher \(after))")
            }

            grade.tap()
            sleep(1)
        }
        sleep(1)
        step("04-result")
        XCTAssertTrue(app.buttons["Fertig"].exists, "Ergebnisbildschirm fehlt")

        // --- zurück zum Start ---
        app.buttons["Fertig"].tap()
        sleep(2)
        XCTAssertTrue(app.buttons["Blitzrunde"].waitForExistence(timeout: 10), "Kein Weg zurück zum Start")

        // --- Blitzrunde ---
        app.buttons["Blitzrunde"].tap()
        sleep(2)
        step("05-blitz")
        for round in 1...5 {
            let options = app.buttons.allElementsBoundByIndex.filter { $0.identifier != "BackButton" }
            XCTAssertEqual(options.count, 3, "Blitz \(round) zeigt nicht drei Antworten")
            log("Blitz \(round): " + options.map { "'\($0.label)'" }.joined(separator: ", "))
            options[2].tap()
            sleep(2)
        }
        sleep(1)
        step("06-blitz-result")
        XCTAssertTrue(app.buttons["Fertig"].exists, "Blitz-Ergebnis fehlt")
    }

    // MARK: Hilfen

    private func center() -> XCUICoordinate {
        app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45))
    }

    private var notes = ""
    private func log(_ s: String) { notes += s + "\n" }

    private func step(_ name: String) {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
        let tree = XCTAttachment(string: notes + "\n=== \(name) ===\n" + app.debugDescription)
        tree.name = "tree-\(name)"
        tree.lifetime = .keepAlways
        add(tree)
    }
}
