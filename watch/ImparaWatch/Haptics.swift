import WatchKit

enum Haptics {
    static func reveal() { WKInterfaceDevice.current().play(.click) }
    static func correct() { WKInterfaceDevice.current().play(.success) }
    static func wrong() { WKInterfaceDevice.current().play(.failure) }
    static func finished() { WKInterfaceDevice.current().play(.notification) }
}
