import Foundation

enum AbbreviationGlossary {

    static let all: [Abbreviation] = [
        Abbreviation(short: "BO", full: "bind off", meaning: "Cast off — finish the live stitches so they cannot unravel.", techniqueID: "standard-bind-off"),
        Abbreviation(short: "brk", full: "brioche knit", meaning: "Knit a stitch together with its paired yarn over.", techniqueID: "brioche"),
        Abbreviation(short: "brp", full: "brioche purl", meaning: "Purl a stitch together with its paired yarn over.", techniqueID: "brioche"),
        Abbreviation(short: "C4B", full: "cable 4 back", meaning: "Slip 2 to a cable needle, hold at back, k2, then k2 from the cable needle. Leans right.", techniqueID: "cable-cross"),
        Abbreviation(short: "C4F", full: "cable 4 front", meaning: "Slip 2 to a cable needle, hold at front, k2, then k2 from the cable needle. Leans left.", techniqueID: "cable-cross"),
        Abbreviation(short: "CC", full: "contrast colour", meaning: "The secondary colour in colourwork.", techniqueID: "stranded-colourwork"),
        Abbreviation(short: "cdd", full: "centred double decrease", meaning: "Slip 2 together knitwise, k1, pass the 2 slipped stitches over. Takes out 2 stitches.", techniqueID: "cdd"),
        Abbreviation(short: "cn", full: "cable needle", meaning: "A short needle that holds stitches while a cable crosses.", techniqueID: "cable-cross"),
        Abbreviation(short: "CO", full: "cast on", meaning: "Put the first stitches on the needle.", techniqueID: "long-tail-cast-on"),
        Abbreviation(short: "dec", full: "decrease", meaning: "Reduce the stitch count.", techniqueID: "k2tog"),
        Abbreviation(short: "DPN", full: "double-pointed needles", meaning: "Short needles with tips at both ends, for small circumferences.", techniqueID: "magic-loop"),
        Abbreviation(short: "DS", full: "double stitch", meaning: "The two-legged stitch made by a German short row turn.", techniqueID: "german-short-rows"),
        Abbreviation(short: "inc", full: "increase", meaning: "Add to the stitch count.", techniqueID: "m1l"),
        Abbreviation(short: "k", full: "knit", meaning: "The basic stitch, worked with the yarn at the back.", techniqueID: "knit-stitch"),
        Abbreviation(short: "k2tog", full: "knit two together", meaning: "Knit two stitches as one. Leans right, decreases by 1.", techniqueID: "k2tog"),
        Abbreviation(short: "k3tog", full: "knit three together", meaning: "Knit three stitches as one. Decreases by 2.", techniqueID: "k2tog"),
        Abbreviation(short: "kfb", full: "knit front and back", meaning: "Knit into the front then the back of one stitch. Increases by 1.", techniqueID: "kfb"),
        Abbreviation(short: "ktbl", full: "knit through back loop", meaning: "Knit into the back of the stitch, twisting it.", techniqueID: "knit-stitch"),
        Abbreviation(short: "LLI", full: "left lifted increase", meaning: "Increase made from the stitch two rows below, leaning left.", techniqueID: "lifted-increase"),
        Abbreviation(short: "M1", full: "make one", meaning: "Increase from the bar between stitches. Usually means M1L.", techniqueID: "m1l"),
        Abbreviation(short: "M1L", full: "make one left", meaning: "Lift the bar front to back, knit through the back. Leans left.", techniqueID: "m1l"),
        Abbreviation(short: "M1R", full: "make one right", meaning: "Lift the bar back to front, knit through the front. Leans right.", techniqueID: "m1r"),
        Abbreviation(short: "MC", full: "main colour", meaning: "The dominant colour of a colourwork piece.", techniqueID: "stranded-colourwork"),
        Abbreviation(short: "p", full: "purl", meaning: "The reverse of a knit stitch, worked with the yarn in front.", techniqueID: "purl-stitch"),
        Abbreviation(short: "p2tog", full: "purl two together", meaning: "Purl two stitches as one. Decreases by 1.", techniqueID: "p2tog"),
        Abbreviation(short: "pm", full: "place marker", meaning: "Put a stitch marker on the needle.", techniqueID: nil),
        Abbreviation(short: "psso", full: "pass slipped stitch over", meaning: "Lift a slipped stitch over the one just worked.", techniqueID: "cdd"),
        Abbreviation(short: "PU", full: "pick up and knit", meaning: "Make new live stitches along a finished edge.", techniqueID: "picking-up-stitches"),
        Abbreviation(short: "rep", full: "repeat", meaning: "Work the marked instructions again.", techniqueID: nil),
        Abbreviation(short: "RLI", full: "right lifted increase", meaning: "Increase made from the stitch below, leaning right.", techniqueID: "lifted-increase"),
        Abbreviation(short: "rnd", full: "round", meaning: "One full circuit when knitting in the round.", techniqueID: "join-in-round"),
        Abbreviation(short: "RS", full: "right side", meaning: "The public face of the fabric.", techniqueID: "reading-charts"),
        Abbreviation(short: "sk2p", full: "slip 1, k2tog, pass over", meaning: "A left-leaning double decrease. Takes out 2 stitches.", techniqueID: "cdd"),
        Abbreviation(short: "sl", full: "slip", meaning: "Move a stitch to the other needle without working it.", techniqueID: "heel-flap"),
        Abbreviation(short: "sl1yo", full: "slip 1, yarn over", meaning: "Slip a stitch purlwise while taking the yarn over the needle.", techniqueID: "brioche"),
        Abbreviation(short: "sm", full: "slip marker", meaning: "Move the marker from one needle to the other.", techniqueID: nil),
        Abbreviation(short: "ssk", full: "slip slip knit", meaning: "Slip 2 knitwise, then knit them together through the front. Leans left.", techniqueID: "ssk"),
        Abbreviation(short: "ssp", full: "slip slip purl", meaning: "The purl-side mirror of ssk.", techniqueID: "p2tog"),
        Abbreviation(short: "st", full: "stitch", meaning: "One loop on the needle.", techniqueID: nil),
        Abbreviation(short: "St st", full: "stockinette stitch", meaning: "Knit on the right side, purl on the wrong side.", techniqueID: "stockinette"),
        Abbreviation(short: "sts", full: "stitches", meaning: "Plural of stitch.", techniqueID: nil),
        Abbreviation(short: "tbl", full: "through back loop", meaning: "Work into the back of the stitch, twisting it.", techniqueID: nil),
        Abbreviation(short: "w&t", full: "wrap and turn", meaning: "Wrap the next stitch and turn, for a short row.", techniqueID: "wrap-and-turn"),
        Abbreviation(short: "WS", full: "wrong side", meaning: "The inside face of the fabric.", techniqueID: "reading-charts"),
        Abbreviation(short: "wyib", full: "with yarn in back", meaning: "Hold the working yarn behind the work while slipping.", techniqueID: "heel-flap"),
        Abbreviation(short: "wyif", full: "with yarn in front", meaning: "Hold the working yarn in front of the work while slipping.", techniqueID: "german-short-rows"),
        Abbreviation(short: "yo", full: "yarn over", meaning: "Wrap the yarn over the needle to make a new stitch and a hole.", techniqueID: "yarn-over"),
    ]

    static func search(_ query: String) -> [Abbreviation] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return all }
        return all.filter {
            $0.short.lowercased().contains(trimmed)
                || $0.full.lowercased().contains(trimmed)
                || $0.meaning.lowercased().contains(trimmed)
        }
    }

    static func lookup(_ short: String) -> Abbreviation? {
        all.first { $0.short.lowercased() == short.lowercased() }
    }
}
