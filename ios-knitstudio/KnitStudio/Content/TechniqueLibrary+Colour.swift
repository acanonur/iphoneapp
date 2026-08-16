import Foundation

extension TechniqueLibrary {

    static let textureAndColour: [Technique] = [

        // MARK: - Cables

        Technique(
            id: "cable-cross",
            name: "Cable cross",
            category: .cables,
            difficulty: .intermediate,
            summary: "Swapping the order of two groups of stitches so one crosses in front of the other.",
            whenToUse: "Every cable, rope and braid.",
            steps: [
                "C4F (cross four front): slip the next 2 stitches onto a cable needle and hold it at the front of the work.",
                "Knit the next 2 stitches from the left needle.",
                "Knit the 2 stitches from the cable needle. The cable leans left.",
                "C4B is identical except the cable needle is held at the back, and the cable leans right.",
            ],
            tips: [
                "Front means left lean, back means right lean. That single sentence covers every cable abbreviation you will meet.",
                "The number in the name is the total stitches involved: C6F crosses 3 over 3.",
                "Cables pull the fabric in hard. A cabled sweater needs noticeably more stitches than a plain one for the same width — the calculator's cable setting accounts for the extra yarn.",
            ],
            alsoKnownAs: ["cable cross", "C4F", "C4B"],
            abbreviations: ["C4F", "C4B", "C6F", "C6B", "cn"]),

        Technique(
            id: "cable-without-needle",
            name: "Cabling without a cable needle",
            category: .cables,
            difficulty: .advanced,
            summary: "Dropping stitches deliberately and catching them back in the new order.",
            whenToUse: "Once cables are familiar. Much faster over an all-over cable pattern.",
            steps: [
                "Work to the cable. Slip all the cable stitches to the right needle.",
                "Pinch the fabric firmly below the stitches, then slide the stitches off the needle entirely.",
                "Catch the group that must end up in front on the left needle, and the other group on the right needle.",
                "Rearrange them onto the left needle in the new order and knit across.",
            ],
            tips: [
                "Practise on a swatch in smooth, non-splitty yarn before trusting it on a garment.",
                "Only for small cables. Dropping six stitches of slippery silk is a bad afternoon.",
            ]),

        // MARK: - Lace

        Technique(
            id: "lifeline",
            name: "Lifeline",
            category: .lace,
            difficulty: .easy,
            summary: "A thread run through a whole row so you can rip back to it safely.",
            whenToUse: "Lace, brioche, and any pattern you cannot read back stitch by stitch.",
            steps: [
                "Thread a length of smooth contrasting yarn or dental floss onto a tapestry needle.",
                "Pass it through every live stitch on the needle, without splitting the yarn.",
                "Leave it in and keep knitting. The lifeline stays put in the fabric.",
                "If it goes wrong, pull the needle out, rip back to the lifeline, and put the held stitches back on the needle.",
                "Place a new lifeline after every completed repeat.",
            ],
            tips: [
                "Interchangeable needles with a small hole in the join let you thread a lifeline as you knit a row.",
                "The cost of a lifeline is thirty seconds. The cost of not having one in lace is the whole shawl.",
            ]),

        Technique(
            id: "lace-basics",
            name: "Reading and working lace",
            category: .lace,
            difficulty: .advanced,
            summary: "Paired yarn overs and decreases that keep the stitch count while opening holes.",
            whenToUse: "Shawls, and any openwork panel.",
            steps: [
                "Every yarn over adds a stitch; every decrease takes one away. In most lace they are paired so each row ends at the same count.",
                "Count your stitches at the end of every row against the pattern's stated count. Catching an error one row later is easy; ten rows later is not.",
                "Most lace patterns rest on the wrong-side rows — usually just purl back.",
                "Lace looks like crumpled string on the needles. It only becomes lace when blocked.",
            ],
            tips: [
                "Place markers between repeats. If a repeat comes out one stitch short, you only rip back to that marker.",
                "Learn to read your knitting: a yarn over next to a k2tog is visible once you know what to look for.",
            ],
            abbreviations: ["yo", "k2tog", "ssk", "sk2p"]),

        // MARK: - Colourwork

        Technique(
            id: "stranded-colourwork",
            name: "Stranded colourwork",
            category: .colourwork,
            difficulty: .advanced,
            summary: "Two colours in one round, with the unused colour carried across the back as floats.",
            whenToUse: "Fair Isle yokes, colourwork mittens and hats, patterned socks.",
            steps: [
                "Work from a chart, reading every round right to left.",
                "Knit each stitch with the colour its chart cell shows, carrying the other colour loosely behind.",
                "Keep the same colour in the same hand or position the whole way through — the one held to the left sits slightly more prominently, and switching mid-project shows.",
                "Spread the stitches on the right needle before each float so the strand behind is long enough. This is the whole skill.",
                "Turn the work inside out when knitting in the round to make the floats travel the longer way and stay loose.",
            ],
            tips: [
                "Puckering means tight floats. There is no fixing it afterwards, so check the back constantly.",
                "Stranded fabric is thicker, warmer and less elastic than plain knitting, and uses roughly a fifth more yarn.",
                "It is far easier in the round than flat: you never have to strand on a purl row.",
            ],
            alsoKnownAs: ["Fair Isle", "stranded knitting"],
            abbreviations: ["MC", "CC"]),

        Technique(
            id: "catching-floats",
            name: "Catching floats",
            category: .colourwork,
            difficulty: .advanced,
            summary: "Trapping a long strand behind the work so fingers do not snag it.",
            whenToUse: "Any run of more than about seven stitches in one colour.",
            steps: [
                "Work to the middle of the long run.",
                "Bring the carried colour over the working colour before making the next stitch.",
                "Knit that stitch as normal — the carried strand is now caught behind it.",
                "Do not catch in the same column on consecutive rounds, or a visible line forms on the front.",
            ],
            tips: [
                "Stagger the catch point by a stitch or two each round.",
                "In a light colour over a dark one, catching can show through. Catch less often and knit the floats looser instead.",
            ]),

        Technique(
            id: "intarsia",
            name: "Intarsia",
            category: .colourwork,
            difficulty: .advanced,
            summary: "Blocks of colour, each with its own yarn supply and no floats at all.",
            whenToUse: "Large motifs, pictures, argyle — anything where a float would be far too long.",
            steps: [
                "Wind a separate bobbin for every block of colour in the row.",
                "Knit each block with its own yarn.",
                "At every colour change, bring the new colour up from under the old one. That twist is what joins the blocks.",
                "Forget the twist and you get a vertical slit instead of a seam.",
            ],
            tips: [
                "Intarsia is worked flat. It does not work in the round, because the yarn ends up on the wrong side of the block.",
                "Lots of ends to weave in. Leave generous tails.",
                "Uses barely more yarn than plain stockinette, since there are no floats.",
            ]),

        Technique(
            id: "mosaic-knitting",
            name: "Mosaic (slip-stitch) knitting",
            category: .colourwork,
            difficulty: .easy,
            summary: "Colour patterns made by slipping stitches, using only one colour per row.",
            whenToUse: "The easiest route into colourwork, and a good one for high-contrast yarns.",
            steps: [
                "Work two rows in colour A, then two rows in colour B, alternating throughout.",
                "On each row, knit the stitches in the current colour and slip the ones that should stay the other colour, purlwise with the yarn behind.",
                "The slipped stitch carries its old colour up from the row below.",
                "Never carry two colours in one row — that is the point of the method.",
            ],
            tips: [
                "Because only one colour is worked per row, there are no floats and no tension juggling.",
                "The slipped stitches make the fabric denser and shorter than plain stockinette. Check row gauge carefully.",
            ],
            alsoKnownAs: ["slip stitch colourwork", "mosaic"]),

        Technique(
            id: "brioche",
            name: "Brioche",
            category: .colourwork,
            difficulty: .advanced,
            summary: "A lofty, fully reversible two-colour rib made with paired yarn-overs and slips.",
            whenToUse: "Squashy scarves, cowls and hats where both sides show.",
            steps: [
                "Every visible row is worked twice, once in each colour, so a ‘row’ means two passes.",
                "brk (brioche knit): knit the stitch together with the yarn over that sits with it.",
                "brp (brioche purl): purl the stitch together with its yarn over.",
                "sl1yo: slip a stitch purlwise while taking the yarn over the needle, creating the paired yarn over for next time.",
                "Two-colour brioche alternates: work a pass in the dark colour, slide back, work a pass in the light colour.",
            ],
            tips: [
                "Almost impossible to tink back. Use a lifeline every few rows.",
                "It uses close to double the yarn of stockinette for the same area — budget accordingly.",
                "The two sides are negatives of each other, which is exactly why people love it.",
            ],
            abbreviations: ["brk", "brp", "sl1yo"]),

        Technique(
            id: "jogless-stripes",
            name: "Jogless stripes",
            category: .colourwork,
            difficulty: .easy,
            summary: "Hiding the step that appears where a stripe changes colour in the round.",
            whenToUse: "Any striped tube: hats, cowls, sleeves, socks.",
            steps: [
                "Knit the first round of the new colour normally, all the way around.",
                "At the start of the second round, lift the right leg of the stitch directly below the first stitch onto the left needle.",
                "Knit it together with the first stitch.",
                "Carry on. The jog is pulled level and effectively disappears.",
            ],
            tips: [
                "It shifts the start of the round by a fraction each time. Over many stripes the marker drifts — move it back when it bothers you.",
                "For single-round stripes, a spiral is unavoidable; use it deliberately instead of fighting it.",
            ]),

        Technique(
            id: "duplicate-stitch",
            name: "Duplicate stitch",
            category: .colourwork,
            difficulty: .easy,
            summary: "Embroidering over knitted stitches to add colour after the fact.",
            whenToUse: "Small details, letters, fixing a mis-knitted colourwork stitch, third colours in a two-colour row.",
            steps: [
                "Thread the new colour on a tapestry needle.",
                "Come up from behind at the base of the V you want to cover.",
                "Pass under both legs of the stitch above it.",
                "Go back down where you came up. You have traced the V exactly.",
                "Move to the next stitch.",
            ],
            tips: [
                "Use the same weight of yarn or it will not cover.",
                "The single best rescue for one wrong colourwork stitch found twenty rounds later.",
            ],
            alsoKnownAs: ["Swiss darning"]),
    ]
}
