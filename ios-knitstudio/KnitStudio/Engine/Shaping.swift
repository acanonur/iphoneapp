import Foundation

/// Result of spreading a number of shaping points evenly across a row.
struct EvenDistribution: Equatable {
    /// Number of stitches in each gap, in the order they are worked.
    var segments: [Int]
    /// The smaller of the two gap sizes used.
    var base: Int
    /// How many gaps use `base + 1` stitches.
    var longGaps: Int

    var totalStitches: Int { segments.reduce(0, +) }
    var shapingPoints: Int { segments.count }

    /// Plain-language description a knitter can follow at the needles.
    var instruction: String {
        guard !segments.isEmpty else { return "no shaping needed" }
        if longGaps == 0 {
            return "work \(base) sts between each of the \(segments.count) shaping points"
        }
        let short = segments.count - longGaps
        return "\(longGaps)× \(base + 1) sts and \(short)× \(base) sts between shaping points"
    }
}

/// Stitch and row arithmetic shared by every calculator.
enum Shaping {

    /// Rounds `value` to the nearest `multiple`, offset by `offset`
    /// (for stitch patterns that need "a multiple of 8 sts + 1").
    /// Never returns fewer than one repeat.
    static func roundToMultiple(_ value: Double, multiple: Int, offset: Int = 0) -> Int {
        guard multiple > 1 else { return max(1, Int(value.rounded())) }
        let repeats = max(1, Int(((value - Double(offset)) / Double(multiple)).rounded()))
        return repeats * multiple + offset
    }

    /// Distributes `count` shaping points across `over` stitches.
    /// Returns `nil` when there are not enough stitches to shape into.
    static func distributeEvenly(count: Int, over: Int) -> EvenDistribution? {
        guard count > 0 else {
            return EvenDistribution(segments: [], base: 0, longGaps: 0)
        }
        guard count <= over else { return nil }

        let base = over / count
        let remainder = over % count
        var segments: [Int] = []
        segments.reserveCapacity(count)
        for index in 0 ..< count {
            segments.append(index < remainder ? base + 1 : base)
        }
        return EvenDistribution(segments: segments, base: base, longGaps: remainder)
    }

    /// Row numbers on which `events` shaping rows should fall, spread across
    /// `rows` rows. Always returns strictly increasing row numbers.
    static func spreadRows(events: Int, over rows: Int) -> [Int] {
        guard events > 0, rows > 0 else { return [] }
        var result: [Int] = []
        result.reserveCapacity(events)
        var previous = 0
        for index in 1 ... events {
            let ideal = Int((Double(index) * Double(rows) / Double(events)).rounded())
            let row = max(previous + 1, ideal)
            result.append(row)
            previous = row
        }
        return result
    }

    /// Describes a repeating shaping rhythm, e.g. "every 6th round 12 times".
    static func rhythm(events: Int, over rows: Int, unit: String = "row") -> String {
        guard events > 0 else { return "work even" }
        let interval = max(1, rows / events)
        let times = events == 1 ? "once" : "\(events) times"
        return "every \(ordinal(interval)) \(unit) \(times)"
    }

    static func ordinal(_ value: Int) -> String {
        let suffix: String
        switch (value % 100, value % 10) {
        case (11, _), (12, _), (13, _): suffix = "th"
        case (_, 1): suffix = "st"
        case (_, 2): suffix = "nd"
        case (_, 3): suffix = "rd"
        default: suffix = "th"
        }
        return "\(value)\(suffix)"
    }
}
