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

        for round in 1...5 {
            center().tap()                      // aufdecken
            sleep(1)
            if round == 1 { step("03-card-back") }
            let buttons = app.buttons.allElementsBoundByIndex
            log("Runde \(round) Tasten: " + buttons.map { "'\($0.label)'" }.joined(separator: ", "))
            guard let grade = buttons.last, buttons.count >= 2 else {
                XCTFail("Bewertungstasten fehlen in Runde \(round)"); return
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
            let options = app.buttons.allElementsBoundByIndex
            log("Blitz \(round) Tasten: " + options.map { "'\($0.label)'" }.joined(separator: ", "))
            guard let answer = options.last else { XCTFail("Keine Antworten in Blitz \(round)"); return }
            answer.tap()
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
