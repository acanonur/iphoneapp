import Foundation

extension TechniqueLibrary {

    // MARK: - Getting started and cast-ons

    static let basics: [Technique] = [

        Technique(
            id: "holding-yarn",
            name: "Holding the yarn",
            category: .gettingStarted,
            difficulty: .beginner,
            summary: "The two mainstream styles, English and Continental, and why it matters.",
            whenToUse: "Before anything else. Whichever you pick, consistency is what makes even fabric.",
            steps: [
                "English (‘throwing’): hold the working yarn in your right hand and wrap it around the right needle for each stitch.",
                "Continental (‘picking’): hold the working yarn in your left hand, tensioned over the index finger, and scoop it through with the right needle.",
                "Run the yarn over one finger and under the next to add friction — that tension, not your grip, is what evens out your stitches.",
                "Work a few rows each way before deciding. Neither is faster in the abstract; the one your hands settle into is faster for you.",
            ],
            tips: [
                "Continental makes ribbing and purling quicker because the yarn moves less.",
                "English gives many knitters more even tension in stranded colourwork.",
                "Holding one colour in each hand is the reason many colourwork knitters learn both.",
            ],
            alsoKnownAs: ["throwing", "picking", "English style", "Continental style"]),

        Technique(
            id: "slip-knot",
            name: "Slip knot",
            category: .gettingStarted,
            difficulty: .beginner,
            summary: "The adjustable loop that starts almost every cast-on.",
            whenToUse: "The first stitch of nearly every project.",
            steps: [
                "Leave the tail you need, then make a loop by crossing the working yarn over the tail.",
                "Reach through the loop and pull a bight of the working yarn through it.",
                "Slide that new loop onto the needle and pull the tail to snug it up.",
                "Check which strand tightens the loop — pulling the working yarn should close it.",
            ],
            tips: ["Keep it loose enough to move on the needle. A tight slip knot distorts the first stitch of the first row."],
            alsoKnownAs: ["slipknot"]),

        Technique(
            id: "gauge-swatch",
            name: "Knitting a gauge swatch",
            category: .gettingStarted,
            difficulty: .beginner,
            summary: "The measurement every calculation in this app depends on.",
            whenToUse: "Before casting on anything that has to fit. Skipping it is the single most common reason a sweater comes out the wrong size.",
            steps: [
                "Cast on enough stitches for at least 15 cm of fabric — roughly 1.5× the pattern's stated stitch count over 10 cm.",
                "Work in the stitch pattern you will actually use, for at least 15 cm.",
                "Add a few garter or seed stitches at each edge so the swatch lies flat and does not curl.",
                "Bind off loosely, then wash and block the swatch exactly as you will treat the finished piece. Let it dry fully.",
                "Lay it flat without stretching. Measure 10 cm across the middle and count the stitches, including partial ones.",
                "Measure 10 cm vertically and count the rows the same way.",
                "Enter both numbers in the calculator. If your stitch count is higher than the pattern's, go up a needle size; lower, go down.",
            ],
            tips: [
                "Measure in the middle, never at the edges — edge stitches are always distorted.",
                "Swatch in the round for a project knitted in the round. Most people purl at a different tension than they knit, so a flat swatch lies about your gauge.",
                "Keep your swatches with a note of needle size and yarn. They become a personal reference library.",
                "Row gauge matters more than knitters expect: it sets every length, every shaping interval and the depth of every yoke.",
            ],
            alsoKnownAs: ["tension square", "swatching"],
            abbreviations: ["st", "sts"]),

        Technique(
            id: "reading-charts",
            name: "Reading a chart",
            category: .gettingStarted,
            difficulty: .easy,
            summary: "Charts are a picture of the right side of the fabric, read from the bottom up.",
            whenToUse: "Colourwork, lace and cables are all far easier charted than written out.",
            steps: [
                "Start at the bottom right. Row 1 is the bottom row — the first one you knit.",
                "Right-side rows read right to left, the direction your stitches travel.",
                "Wrong-side rows read left to right, and every symbol is worked as its opposite: a knit symbol is purled.",
                "Worked in the round there are no wrong-side rows, so every round reads right to left.",
                "Bold lines mark the pattern repeat: work the stitches inside them over and over across the row.",
                "Check the legend before you start — symbols are conventional but not standardised.",
            ],
            tips: [
                "A magnetic board or a sticky note under the current row saves more mistakes than any other habit.",
                "Put the note above the row you are on, not below, so you can see the rows you have already worked and check against them.",
            ],
            alsoKnownAs: ["chart reading"]),

        Technique(
            id: "long-tail-cast-on",
            name: "Long-tail cast-on",
            category: .castOn,
            difficulty: .beginner,
            summary: "The default cast-on: fast, tidy, moderately stretchy.",
            whenToUse: "Almost anything. If a pattern does not say otherwise, use this one.",
            steps: [
                "Estimate the tail: about three times the width of your cast-on edge, plus a bit. For 100 stitches, roughly a metre.",
                "Make a slip knot at that point and put it on the needle. It counts as your first stitch.",
                "Hold both strands in your left hand, tail over the thumb and working yarn over the index finger, with both anchored in the palm — the ‘slingshot’.",
                "Bring the needle up through the loop on your thumb.",
                "Take it over the top of the index-finger strand and catch that strand.",
                "Bring it back down through the thumb loop, then let the thumb loop drop.",
                "Pull the tail gently to snug the new stitch against the needle. Repeat.",
            ],
            tips: [
                "Ran out of tail? Cast on from both ends of a centre-pull ball and never estimate again.",
                "Cast on over one needle, not two — the ‘two needles’ advice makes a sloppy edge. If your cast-on is tight, use a needle one size up instead.",
                "The tail end must be the one over your thumb. Swap them and the edge comes out inside out.",
            ],
            alsoKnownAs: ["double cast-on", "slingshot cast-on"],
            abbreviations: ["CO"]),

        Technique(
            id: "knitted-cast-on",
            name: "Knitted cast-on",
            category: .castOn,
            difficulty: .beginner,
            summary: "Cast on using only the knit stitch — no tail estimate needed.",
            whenToUse: "Adding stitches mid-project, and for absolute beginners who already know the knit stitch.",
            steps: [
                "Make a slip knot and put it on the left needle.",
                "Knit into that stitch but do not slip it off.",
                "Bring the new loop from the right needle onto the left needle, giving it a slight twist so it sits like a normal stitch.",
                "Repeat, knitting into the newest stitch each time.",
            ],
            tips: ["Looser and less elastic than long-tail. Fine for a scarf edge, poor for a sock cuff."],
            abbreviations: ["CO"]),

        Technique(
            id: "cable-cast-on",
            name: "Cable cast-on",
            category: .castOn,
            difficulty: .easy,
            summary: "A firm, corded edge worked between stitches rather than into them.",
            whenToUse: "Buttonhole edges, underarm cast-ons, and anywhere you want a sturdy non-stretchy edge.",
            steps: [
                "Cast on two stitches by any method.",
                "Insert the right needle between the first two stitches on the left needle, not into a stitch.",
                "Wrap the yarn and pull a loop through that gap.",
                "Place the loop on the left needle.",
                "Repeat, always working between the two newest stitches.",
            ],
            tips: [
                "This is the cast-on to use for the underarm stitches of a top-down sweater — it is firm enough not to sag.",
                "Too firm for a hem or cuff that has to stretch over a body part.",
            ],
            abbreviations: ["CO"]),

        Technique(
            id: "german-twisted-cast-on",
            name: "German twisted cast-on",
            category: .castOn,
            difficulty: .easy,
            summary: "Long-tail with an extra twist, giving a noticeably stretchier edge.",
            whenToUse: "Sock cuffs, hat brims, mitten cuffs — anywhere the edge has to stretch and spring back.",
            steps: [
                "Set up exactly as for a long-tail cast-on, tail over the thumb.",
                "Bring the needle under both strands of the thumb loop, then back down into the loop from above — that is the extra twist.",
                "Catch the index-finger strand as usual.",
                "Draw it back through the thumb loop and drop the thumb loop.",
                "Snug up and repeat.",
            ],
            tips: ["Worth learning the day you knit your first sock. A long-tail cuff that will not stretch over a heel is a wasted sock."],
            alsoKnownAs: ["old Norwegian cast-on", "twisted German cast-on"],
            abbreviations: ["CO"]),

        Technique(
            id: "tubular-cast-on",
            name: "Tubular cast-on",
            category: .castOn,
            difficulty: .advanced,
            summary: "An invisible, rounded edge that flows seamlessly into 1×1 rib.",
            whenToUse: "The most professional finish for a ribbed cuff, hem or neckband.",
            steps: [
                "With waste yarn, provisionally cast on half the final stitch count.",
                "Change to the main yarn and work four rows: knit a row, purl a row, knit a row, purl a row.",
                "Fold the fabric so the waste-yarn edge sits behind the needle.",
                "Undo the provisional cast-on and put the freed live stitches on a spare needle.",
                "Knit across, alternating one stitch from the front needle with one from the back needle — you now have the full count in 1×1 rib.",
                "Carry on in rib.",
            ],
            tips: [
                "Pairs with the tubular bind-off for a garment where both edges match.",
                "Slow the first time and quick the fifth. Practise on a swatch before a garment neckline.",
            ],
            alsoKnownAs: ["invisible cast-on", "Italian cast-on"],
            abbreviations: ["CO"]),

        Technique(
            id: "provisional-cast-on",
            name: "Provisional cast-on",
            category: .castOn,
            difficulty: .intermediate,
            summary: "A temporary cast-on that leaves live stitches you can come back to.",
            whenToUse: "Anywhere you need to knit in both directions from one starting line, or graft an edge later.",
            steps: [
                "With smooth waste yarn in a contrasting colour, crochet a chain a few stitches longer than you need.",
                "With the main yarn and a needle, pick up and knit one stitch into the back bump of each chain.",
                "Work your project from there.",
                "When you need the live stitches, undo the crochet chain from its last-made end and catch each freed loop on a needle.",
            ],
            tips: [
                "Use slippery cotton waste yarn. Anything grabby makes the chain a misery to unzip.",
                "Count as you free the stitches — it is easy to gain or lose one at the very end.",
            ],
            abbreviations: ["CO"]),

        Technique(
            id: "judys-magic-cast-on",
            name: "Judy's magic cast-on",
            category: .castOn,
            difficulty: .intermediate,
            summary: "Casts on two sets of live stitches back to back, with a closed edge and no seam.",
            whenToUse: "Toe-up socks, mitten tips, the closed end of a bag — anything that starts as a seamless pocket.",
            steps: [
                "Hold two needle tips together, one above the other. Drape the yarn over the top needle with the tail hanging towards you.",
                "Bring the tail under and over the bottom needle to make a stitch there.",
                "Bring the working yarn under and over the top needle to make a stitch there.",
                "Keep alternating until each needle carries half the stitches.",
                "Turn the work and knit the top needle's stitches, being careful with the very first one.",
                "Rotate and knit the second needle. From here you are working in the round.",
            ],
            tips: ["The first round is fiddly and every round after is easy. Push through it."],
            alsoKnownAs: ["magic cast-on"],
            abbreviations: ["CO"]),

        Technique(
            id: "backward-loop-cast-on",
            name: "Backward loop cast-on",
            category: .castOn,
            difficulty: .beginner,
            summary: "The quickest way to add a few stitches mid-row.",
            whenToUse: "Small numbers of stitches: a thumb gap, a buttonhole, the odd underarm stitch.",
            steps: [
                "Make a loop in the working yarn with the tail behind.",
                "Slip the loop onto the right needle and pull it snug.",
                "Repeat for each stitch needed.",
            ],
            tips: [
                "Loose and awkward to knit into on the next row. Good for two or three stitches, poor for twenty.",
                "For a whole underarm, use the cable cast-on instead.",
            ],
            alsoKnownAs: ["e-wrap cast-on", "single cast-on"],
            abbreviations: ["CO"]),

        // MARK: - Basic stitches

        Technique(
            id: "knit-stitch",
            name: "Knit stitch",
            category: .basicStitches,
            difficulty: .beginner,
            summary: "The stitch everything else is built from.",
            whenToUse: "Everywhere.",
            steps: [
                "Hold the needle with the stitches in your left hand, working yarn at the back.",
                "Push the right needle into the front of the first stitch, from left to right — the needles cross behind.",
                "Wrap the working yarn anticlockwise around the right needle.",
                "Bring that wrap back through the stitch towards you, catching it on the right needle.",
                "Slide the old stitch off the left needle. One knit stitch made.",
            ],
            tips: [
                "The new stitch lives on the right needle. If your stitch count is growing, you are probably not dropping the old stitch off.",
                "Work into the stitch, not into the gap between stitches — that is the other way counts creep up.",
            ],
            abbreviations: ["k"]),

        Technique(
            id: "purl-stitch",
            name: "Purl stitch",
            category: .basicStitches,
            difficulty: .beginner,
            summary: "The knit stitch worked backwards — the reverse side of the same loop.",
            whenToUse: "Every wrong-side row of stockinette, and half of all ribbing.",
            steps: [
                "Bring the working yarn to the front of the work.",
                "Push the right needle into the front of the first stitch from right to left — the needles cross in front.",
                "Wrap the yarn anticlockwise around the right needle.",
                "Push that wrap back through the stitch away from you.",
                "Slide the old stitch off. One purl made.",
            ],
            tips: [
                "Moving the yarn front and back between knits and purls is what makes ribbing slow. Keep the movement small — go between the needle tips, not around them.",
                "A purl is a knit seen from the other side. Purl a whole row and turn the work: it is a knit row.",
            ],
            abbreviations: ["p"]),

        Technique(
            id: "stockinette",
            name: "Stockinette stitch",
            category: .basicStitches,
            difficulty: .beginner,
            summary: "Knit on the right side, purl on the wrong side. The smooth V-shaped fabric.",
            whenToUse: "The default fabric for sweaters, hats, socks and colourwork.",
            steps: [
                "Flat: knit every right-side row, purl every wrong-side row.",
                "In the round: knit every round.",
                "The right side shows columns of Vs; the wrong side shows bumpy purl ridges.",
            ],
            tips: [
                "It curls. The edges roll to the front at top and bottom, and to the back at the sides. This is physics, not a mistake — plan an edging or a seam.",
                "Reverse stockinette is the same fabric used purl side out.",
            ],
            alsoKnownAs: ["stocking stitch", "St st"],
            abbreviations: ["St st", "k", "p"]),

        Technique(
            id: "garter-stitch",
            name: "Garter stitch",
            category: .basicStitches,
            difficulty: .beginner,
            summary: "Knit every row. Ridged, squashy, and completely flat.",
            whenToUse: "Scarves, blanket borders, shawl edges, and any beginner's first project.",
            steps: [
                "Flat: knit every row, both sides.",
                "In the round: alternate a knit round with a purl round.",
                "Two rows make one visible ridge.",
            ],
            tips: [
                "It does not curl, which is why it borders so many things.",
                "It is much shorter row-for-row than stockinette — roughly twice the rows for the same length. Do not reuse a stockinette row gauge for it.",
                "It stretches widthways far more than lengthways.",
            ],
            abbreviations: ["k"]),

        Technique(
            id: "ribbing",
            name: "Ribbing",
            category: .basicStitches,
            difficulty: .beginner,
            summary: "Columns of knits and purls that pull the fabric in and let it spring back.",
            whenToUse: "Cuffs, hems, brims, necklines — anywhere the fabric has to hug and recover.",
            steps: [
                "1×1 rib: *k1, p1* to the end. On the next row, knit the knits and purl the purls as they face you.",
                "2×2 rib: *k2, p2* to the end, again working the stitches as they present.",
                "Worked in the round, every round is the same: k1, p1 (or k2, p2) all the way.",
                "Cast on a multiple of 2 for 1×1, or of 4 for 2×2, so the pattern meets itself.",
            ],
            tips: [
                "1×1 is the stretchiest; 2×2 pulls in more strongly and looks bolder.",
                "Rib is normally worked on needles one size smaller than the body of the piece.",
                "Bind off rib loosely, or in a stretchy bind-off — a tight rib edge defeats the whole point of the rib.",
            ],
            abbreviations: ["k", "p"]),

        Technique(
            id: "seed-stitch",
            name: "Seed stitch",
            category: .texture,
            difficulty: .easy,
            summary: "Alternating knits and purls that never stack, giving an even bobbled texture.",
            whenToUse: "Flat, reversible borders and whole garments with quiet texture.",
            steps: [
                "Row 1: *k1, p1* to the end.",
                "Row 2: purl the knits and knit the purls — the opposite of what faces you.",
                "Repeat those two rows.",
            ],
            tips: [
                "The rule is simply: never let a knit sit on a knit.",
                "Lies perfectly flat and looks the same on both sides, which makes it excellent for scarves.",
                "Slower than stockinette because the yarn moves on every stitch.",
            ],
            alsoKnownAs: ["moss stitch"],
            abbreviations: ["k", "p"]),
    ]
}
