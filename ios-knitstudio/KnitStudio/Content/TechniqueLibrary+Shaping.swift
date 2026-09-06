import Foundation

extension TechniqueLibrary {

    static let stitchesAndShaping: [Technique] = [

        // MARK: - Increases

        Technique(
            id: "m1l",
            name: "Make one left (M1L)",
            category: .increases,
            difficulty: .easy,
            summary: "An almost invisible increase that leans left, made from the bar between stitches.",
            whenToUse: "Paired with M1R on the other side of a raglan line, sleeve or gusset.",
            steps: [
                "Find the horizontal bar running between the stitch you just worked and the next one.",
                "Lift it onto the left needle from front to back.",
                "Knit into the back of that lifted loop. The twist is what stops a hole forming.",
            ],
            tips: [
                "It will feel tight. That tightness is the technique working.",
                "Remember it as: front to back, knit through the back.",
            ],
            alsoKnownAs: ["make one left"],
            abbreviations: ["M1L", "M1"]),

        Technique(
            id: "m1r",
            name: "Make one right (M1R)",
            category: .increases,
            difficulty: .easy,
            summary: "The mirror of M1L, leaning right.",
            whenToUse: "The other half of every increase pair.",
            steps: [
                "Find the bar between the stitch just worked and the next.",
                "Lift it onto the left needle from back to front.",
                "Knit into the front of the lifted loop.",
            ],
            tips: ["Back to front, knit through the front — the exact opposite of M1L in both moves."],
            alsoKnownAs: ["make one right"],
            abbreviations: ["M1R"]),

        Technique(
            id: "kfb",
            name: "Knit front and back (KFB)",
            category: .increases,
            difficulty: .beginner,
            summary: "Two stitches out of one. The easiest increase to learn.",
            whenToUse: "Garter-stitch shaping and anywhere the small bump it leaves does not matter.",
            steps: [
                "Knit into the front of the stitch as normal, but do not slide it off.",
                "Bring the right needle round and knit into the back loop of the same stitch.",
                "Now slide the old stitch off. Two stitches where there was one.",
            ],
            tips: [
                "It leaves a visible purl bump to the left of the new stitch — invisible in garter, obvious in stockinette.",
                "It eats a stitch of its own, so it cannot be worked into the very last stitch of a row.",
            ],
            abbreviations: ["kfb", "inc"]),

        Technique(
            id: "yarn-over",
            name: "Yarn over (YO)",
            category: .increases,
            difficulty: .beginner,
            summary: "An increase that deliberately leaves a hole. The basis of all lace.",
            whenToUse: "Lace, eyelets, buttonholes, and the increase lines of many shawls.",
            steps: [
                "Between two knit stitches: bring the yarn forward between the needles, then over the right needle to the back, and knit the next stitch.",
                "Between two purls: take the yarn to the back over the needle and forward again, then purl.",
                "On the next row, work the yarn over as an ordinary stitch. That is what opens the hole.",
            ],
            tips: [
                "If your yarn over vanished on the next row, you probably worked it through the back loop and closed it.",
                "In lace, each yarn over is normally paired with a decrease so the stitch count stays put.",
            ],
            abbreviations: ["yo", "yon", "yfwd"]),

        Technique(
            id: "lifted-increase",
            name: "Lifted increase (RLI / LLI)",
            category: .increases,
            difficulty: .intermediate,
            summary: "Made from the stitch below rather than the bar. The least visible increase of all.",
            whenToUse: "Stockinette shaping where you want the increase to disappear completely.",
            steps: [
                "Right lifted increase: put the right needle into the right leg of the stitch below the next stitch on the left needle, lift it up and knit it, then knit the stitch itself.",
                "Left lifted increase: knit the stitch, then put the left needle into the left leg of the stitch two rows below the one just worked, lift it and knit it.",
            ],
            tips: [
                "Flatter than M1 and far flatter than KFB.",
                "Do not stack them in the same column on consecutive rows — the fabric will pucker.",
            ],
            abbreviations: ["RLI", "LLI"]),

        // MARK: - Decreases

        Technique(
            id: "k2tog",
            name: "Knit two together (k2tog)",
            category: .decreases,
            difficulty: .beginner,
            summary: "The basic right-leaning decrease.",
            whenToUse: "Hat crowns, sleeve tapers, the right edge of a lace motif.",
            steps: [
                "Put the right needle through the front of the next two stitches at once, right to left.",
                "Wrap the yarn and knit them as if they were a single stitch.",
                "Slide both off the left needle. Two stitches become one.",
            ],
            tips: ["The resulting stitch slants to the right. Its mirror image is ssk."],
            abbreviations: ["k2tog", "dec"]),

        Technique(
            id: "ssk",
            name: "Slip slip knit (ssk)",
            category: .decreases,
            difficulty: .easy,
            summary: "The basic left-leaning decrease, the mirror of k2tog.",
            whenToUse: "Wherever a decrease needs to lean the other way — the left edge of a sleeve, the far side of a raglan.",
            steps: [
                "Slip the first stitch knitwise onto the right needle.",
                "Slip the second stitch knitwise as well.",
                "Put the left needle through the fronts of both slipped stitches, from left to right.",
                "Knit them together from this position.",
            ],
            tips: [
                "Slipping them knitwise is what turns the stitches around so the decrease lies flat.",
                "Slipping purlwise by mistake gives a twisted, lumpy decrease — a very common slip.",
                "‘k2tog through the back loop’ is a quicker substitute but sits less neatly.",
            ],
            alsoKnownAs: ["SSK"],
            abbreviations: ["ssk", "dec"]),

        Technique(
            id: "cdd",
            name: "Centred double decrease (CDD)",
            category: .decreases,
            difficulty: .intermediate,
            summary: "Takes out two stitches with the centre stitch sitting proudly on top.",
            whenToUse: "The spine of a shawl, the point of a chevron, the centre of a mitred square.",
            steps: [
                "Slip two stitches together knitwise, as if to k2tog.",
                "Knit the next stitch.",
                "Pass the two slipped stitches over the knitted one together.",
            ],
            tips: [
                "Slipping the two together, not one at a time, is what centres the result.",
                "Makes a strong vertical line — use it where you want the decrease to be seen.",
            ],
            alsoKnownAs: ["sl2-k1-p2sso", "s2kp"],
            abbreviations: ["cdd", "s2kp", "sl2-k1-p2sso"]),

        Technique(
            id: "p2tog",
            name: "Purl two together (p2tog)",
            category: .decreases,
            difficulty: .beginner,
            summary: "The purl-side decrease, leaning right on the knit side.",
            whenToUse: "Wrong-side rows and the purl half of ribbed shaping.",
            steps: [
                "Put the right needle purlwise through the next two stitches at once.",
                "Wrap and purl them together as one.",
            ],
            tips: ["Its mirror is ssp: slip two knitwise, return them to the left needle, purl together through the back loops."],
            abbreviations: ["p2tog", "ssp"]),

        Technique(
            id: "gathered-crown",
            name: "Gathering a crown",
            category: .decreases,
            difficulty: .easy,
            summary: "Closing the last few stitches of a hat, mitten or bag.",
            whenToUse: "The final step of anything worked to a point in the round.",
            steps: [
                "Work decreases until only a handful of stitches remain — usually one per section.",
                "Cut the yarn leaving a 20 cm tail.",
                "Thread the tail onto a tapestry needle and pass it through every remaining stitch, in order, slipping each off the needle as you go.",
                "Pull firmly to close the hole.",
                "Take the tail down through the centre to the inside and weave it in there.",
            ],
            tips: [
                "Go through the stitches in knitting order, or the closure spirals unevenly.",
                "Pass through the round twice before pulling tight if the hole still shows.",
            ]),

        // MARK: - Short rows

        Technique(
            id: "german-short-rows",
            name: "German short rows",
            category: .shortRows,
            difficulty: .intermediate,
            summary: "Extra rows worked over part of the fabric, using a pulled ‘double stitch’.",
            whenToUse: "Sock heels, shoulder slopes, raising the back neck of a sweater, bust darts.",
            steps: [
                "Work to your turning point and turn the work.",
                "Slip the first stitch purlwise with the yarn in front.",
                "Pull the yarn firmly up and over the needle to the back. The stitch below is dragged up and now shows two legs — that is the double stitch.",
                "Work the row as normal from there.",
                "On later rows, when you reach a double stitch, work both its legs together as one stitch.",
            ],
            tips: [
                "Far easier than wrap and turn and it looks better.",
                "Count double stitches as one stitch when counting the row.",
                "The pull needs to be firm. A limp pull leaves a slack, visible turn.",
            ],
            alsoKnownAs: ["double stitch short rows"],
            abbreviations: ["DS"]),

        Technique(
            id: "wrap-and-turn",
            name: "Wrap and turn (w&t)",
            category: .shortRows,
            difficulty: .intermediate,
            summary: "The traditional short-row method: wrap the next stitch before turning.",
            whenToUse: "When a pattern is written for it, or in garter stitch where the wraps disappear anyway.",
            steps: [
                "Work to the turning point.",
                "Slip the next stitch purlwise to the right needle.",
                "Bring the yarn to the other side of the work between the needles.",
                "Slip the stitch back to the left needle. It is now wrapped.",
                "Turn and work back.",
                "Later, when you reach a wrapped stitch, lift the wrap onto the needle and work it together with its stitch to hide it.",
            ],
            tips: [
                "In garter stitch you can skip picking up the wraps entirely — they vanish into the ridges.",
                "Picking up wraps is where most people go wrong: the wrap goes under the stitch on the knit side, over it on the purl side.",
            ],
            abbreviations: ["w&t"]),

        Technique(
            id: "short-row-heel-turn",
            name: "Turning a heel",
            category: .shortRows,
            difficulty: .advanced,
            summary: "The short-row wedge that turns a sock through ninety degrees.",
            whenToUse: "Right after the heel flap on a cuff-down sock.",
            steps: [
                "Working on the heel stitches only, knit past the centre by a few stitches, then ssk, k1, and turn.",
                "Slip the first stitch, purl back past the centre by the same margin, then p2tog, p1, and turn.",
                "Knit to one stitch before the gap left by the previous turn, ssk across that gap, k1, turn.",
                "Purl to one stitch before the gap, p2tog across it, p1, turn.",
                "Repeat until every heel stitch has been consumed. The heel now cups.",
            ],
            tips: [
                "The gap is always visible — it is the ladder between the last worked stitch and the next. Close it, do not knit past it.",
                "You may run out of stitches for the final k1 or p1. That is normal; just work the decrease.",
                "This is the moment a flat piece of knitting becomes a three-dimensional object. It is worth doing slowly the first time.",
            ]),

        Technique(
            id: "heel-flap",
            name: "Heel flap",
            category: .shortRows,
            difficulty: .intermediate,
            summary: "A slip-stitch rectangle worked flat on half the sock stitches.",
            whenToUse: "Cuff-down socks, before the heel turn.",
            steps: [
                "Divide the stitches: half for the heel, half held for the instep.",
                "Right side: *slip 1 purlwise with yarn in back, k1* to the end.",
                "Wrong side: slip 1, purl to the end.",
                "Repeat until the flap is square — as many rows as there are heel stitches.",
            ],
            tips: [
                "The slipped stitches double the fabric thickness exactly where a sock wears out first.",
                "They also make neat chain edges: one chain per two rows, which is precisely what you pick up for the gusset.",
            ]),

        // MARK: - In the round

        Technique(
            id: "join-in-round",
            name: "Joining in the round",
            category: .inTheRound,
            difficulty: .beginner,
            summary: "Closing the cast-on into a circle without twisting it.",
            whenToUse: "The first round of every hat, sock, cowl and sleeve.",
            steps: [
                "Cast on and spread the stitches evenly along the needle.",
                "Lay the work down and check that the cast-on edge faces inwards the whole way round, with no stitch flipped over the needle.",
                "Place a marker for the start of the round.",
                "Knit the first stitch, pulling the yarn firmly to close the gap.",
            ],
            tips: [
                "A twist cannot be fixed later. It is a Möbius strip and the only cure is ripping back.",
                "Work the first round flat and join on round two if you find the check hard — the tiny seam at the join is barely visible.",
                "Swap the first and last stitch as you join for a tidier, tighter start.",
            ]),

        Technique(
            id: "magic-loop",
            name: "Magic loop",
            category: .inTheRound,
            difficulty: .intermediate,
            summary: "Knitting a small circumference on one long circular needle.",
            whenToUse: "Socks, sleeves, mitten and hat crowns — anywhere too small for a circular needle.",
            steps: [
                "Use a circular needle with a cable of at least 80 cm.",
                "Slide all the stitches onto the cable and find the halfway point.",
                "Pull a loop of cable out at that halfway point, so half the stitches sit on each side.",
                "Slide the back half onto its needle tip; let the front half rest on the cable.",
                "Knit the back-half stitches with the free tip.",
                "Turn the work, redistribute, and repeat.",
            ],
            tips: [
                "Pull the first stitch of each half firmly or you will get a ladder down the two changeover points.",
                "A flexible cable makes the difference between pleasant and infuriating.",
            ]),

        Technique(
            id: "avoiding-ladders",
            name: "Avoiding ladders",
            category: .inTheRound,
            difficulty: .easy,
            summary: "Stopping the loose columns that appear where needles change over.",
            whenToUse: "Any small-circumference knitting on double-points or magic loop.",
            steps: [
                "Give the first stitch after each changeover a firm tug.",
                "Better: knit the first two or three stitches of the new needle, then tug.",
                "Shift where the changeover falls every few rounds so the strain never lands in the same column twice.",
            ],
            tips: ["Blocking hides mild laddering. It will not save a really loose one, so fix it as you knit."]),
    ]
}
