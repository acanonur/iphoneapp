package com.knitstudio.engine

/** The second half of the technique guide, split only to keep files readable. */
internal object TechniqueLibraryPartTwo {

    private fun t(
        id: String, name: String, category: TechniqueCategory, difficulty: Difficulty,
        summary: String, whenToUse: String, steps: List<String>,
        tips: List<String> = emptyList(), aka: List<String> = emptyList(),
        abbr: List<String> = emptyList(),
    ) = Technique(id, name, category, difficulty, summary, whenToUse, steps, tips, aka, abbr)

    val more: List<Technique> = listOf(

        // ── Increases ─────────────────────────────────────────────────────
        t(
            "m1l", "Make one left (M1L)", TechniqueCategory.INCREASES, Difficulty.EASY,
            "An almost invisible increase that leans left, made from the bar between stitches.",
            "Paired with M1R on the other side of a raglan line, sleeve or gusset.",
            listOf(
                "Find the horizontal bar running between the stitch you just worked and the next one.",
                "Lift it onto the left needle from front to back.",
                "Knit into the back of that lifted loop. The twist is what stops a hole forming.",
            ),
            listOf(
                "It will feel tight. That tightness is the technique working.",
                "Remember it as: front to back, knit through the back.",
            ),
            abbr = listOf("M1L", "M1"),
        ),
        t(
            "m1r", "Make one right (M1R)", TechniqueCategory.INCREASES, Difficulty.EASY,
            "The mirror of M1L, leaning right.", "The other half of every increase pair.",
            listOf(
                "Find the bar between the stitch just worked and the next.",
                "Lift it onto the left needle from back to front.",
                "Knit into the front of the lifted loop.",
            ),
            listOf("Back to front, knit through the front — the exact opposite of M1L in both moves."),
            abbr = listOf("M1R"),
        ),
        t(
            "kfb", "Knit front and back (KFB)", TechniqueCategory.INCREASES, Difficulty.BEGINNER,
            "Two stitches out of one. The easiest increase to learn.",
            "Garter-stitch shaping and anywhere the small bump it leaves does not matter.",
            listOf(
                "Knit into the front of the stitch as normal, but do not slide it off.",
                "Bring the right needle round and knit into the back loop of the same stitch.",
                "Now slide the old stitch off. Two stitches where there was one.",
            ),
            listOf(
                "It leaves a visible purl bump to the left of the new stitch — invisible in garter, obvious in stockinette.",
                "It eats a stitch of its own, so it cannot be worked into the very last stitch of a row.",
            ),
            abbr = listOf("kfb", "inc"),
        ),
        t(
            "yarn-over", "Yarn over (YO)", TechniqueCategory.INCREASES, Difficulty.BEGINNER,
            "An increase that deliberately leaves a hole. The basis of all lace.",
            "Lace, eyelets, buttonholes, and the increase lines of many shawls.",
            listOf(
                "Between two knit stitches: bring the yarn forward between the needles, then over the right needle to the back, and knit the next stitch.",
                "Between two purls: take the yarn to the back over the needle and forward again, then purl.",
                "On the next row, work the yarn over as an ordinary stitch. That is what opens the hole.",
            ),
            listOf(
                "If your yarn over vanished on the next row, you probably worked it through the back loop and closed it.",
                "In lace, each yarn over is normally paired with a decrease so the stitch count stays put.",
            ),
            abbr = listOf("yo", "yon", "yfwd"),
        ),
        t(
            "lifted-increase", "Lifted increase (RLI / LLI)", TechniqueCategory.INCREASES, Difficulty.INTERMEDIATE,
            "Made from the stitch below rather than the bar. The least visible increase of all.",
            "Stockinette shaping where you want the increase to disappear completely.",
            listOf(
                "Right lifted increase: put the right needle into the right leg of the stitch below the next stitch on the left needle, lift it up and knit it, then knit the stitch itself.",
                "Left lifted increase: knit the stitch, then put the left needle into the left leg of the stitch two rows below the one just worked, lift it and knit it.",
            ),
            listOf(
                "Flatter than M1 and far flatter than KFB.",
                "Do not stack them in the same column on consecutive rows — the fabric will pucker.",
            ),
            abbr = listOf("RLI", "LLI"),
        ),

        // ── Decreases ─────────────────────────────────────────────────────
        t(
            "k2tog", "Knit two together (k2tog)", TechniqueCategory.DECREASES, Difficulty.BEGINNER,
            "The basic right-leaning decrease.",
            "Hat crowns, sleeve tapers, the right edge of a lace motif.",
            listOf(
                "Put the right needle through the front of the next two stitches at once, right to left.",
                "Wrap the yarn and knit them as if they were a single stitch.",
                "Slide both off the left needle. Two stitches become one.",
            ),
            listOf("The resulting stitch slants to the right. Its mirror image is ssk."),
            abbr = listOf("k2tog", "dec"),
        ),
        t(
            "ssk", "Slip slip knit (ssk)", TechniqueCategory.DECREASES, Difficulty.EASY,
            "The basic left-leaning decrease, the mirror of k2tog.",
            "Wherever a decrease needs to lean the other way — the left edge of a sleeve, the far side of a raglan.",
            listOf(
                "Slip the first stitch knitwise onto the right needle.",
                "Slip the second stitch knitwise as well.",
                "Put the left needle through the fronts of both slipped stitches, from left to right.",
                "Knit them together from this position.",
            ),
            listOf(
                "Slipping them knitwise is what turns the stitches around so the decrease lies flat.",
                "Slipping purlwise by mistake gives a twisted, lumpy decrease — a very common slip.",
                "‘k2tog through the back loop’ is a quicker substitute but sits less neatly.",
            ),
            abbr = listOf("ssk", "dec"),
        ),
        t(
            "cdd", "Centred double decrease (CDD)", TechniqueCategory.DECREASES, Difficulty.INTERMEDIATE,
            "Takes out two stitches with the centre stitch sitting proudly on top.",
            "The spine of a shawl, the point of a chevron, the centre of a mitred square.",
            listOf(
                "Slip two stitches together knitwise, as if to k2tog.",
                "Knit the next stitch.",
                "Pass the two slipped stitches over the knitted one together.",
            ),
            listOf(
                "Slipping the two together, not one at a time, is what centres the result.",
                "Makes a strong vertical line — use it where you want the decrease to be seen.",
            ),
            listOf("sl2-k1-p2sso", "s2kp"), listOf("cdd", "s2kp"),
        ),
        t(
            "p2tog", "Purl two together (p2tog)", TechniqueCategory.DECREASES, Difficulty.BEGINNER,
            "The purl-side decrease, leaning right on the knit side.",
            "Wrong-side rows and the purl half of ribbed shaping.",
            listOf(
                "Put the right needle purlwise through the next two stitches at once.",
                "Wrap and purl them together as one.",
            ),
            listOf("Its mirror is ssp: slip two knitwise, return them to the left needle, purl together through the back loops."),
            abbr = listOf("p2tog", "ssp"),
        ),
        t(
            "gathered-crown", "Gathering a crown", TechniqueCategory.DECREASES, Difficulty.EASY,
            "Closing the last few stitches of a hat, mitten or bag.",
            "The final step of anything worked to a point in the round.",
            listOf(
                "Work decreases until only a handful of stitches remain — usually one per section.",
                "Cut the yarn leaving a 20 cm tail.",
                "Thread the tail onto a tapestry needle and pass it through every remaining stitch, in order, slipping each off the needle as you go.",
                "Pull firmly to close the hole.",
                "Take the tail down through the centre to the inside and weave it in there.",
            ),
            listOf(
                "Go through the stitches in knitting order, or the closure spirals unevenly.",
                "Pass through the round twice before pulling tight if the hole still shows.",
            ),
        ),

        // ── Cables and lace ───────────────────────────────────────────────
        t(
            "cable-cross", "Cable cross", TechniqueCategory.CABLES, Difficulty.INTERMEDIATE,
            "Swapping the order of two groups of stitches so one crosses in front of the other.",
            "Every cable, rope and braid.",
            listOf(
                "C4F (cross four front): slip the next 2 stitches onto a cable needle and hold it at the front of the work.",
                "Knit the next 2 stitches from the left needle.",
                "Knit the 2 stitches from the cable needle. The cable leans left.",
                "C4B is identical except the cable needle is held at the back, and the cable leans right.",
            ),
            listOf(
                "Front means left lean, back means right lean. That single sentence covers every cable abbreviation you will meet.",
                "The number in the name is the total stitches involved: C6F crosses 3 over 3.",
                "Cables pull the fabric in hard. A cabled sweater needs noticeably more stitches than a plain one for the same width — the calculator's cable setting accounts for the extra yarn.",
            ),
            listOf("C4F", "C4B"), listOf("C4F", "C4B", "C6F", "C6B", "cn"),
        ),
        t(
            "cable-without-needle", "Cabling without a cable needle", TechniqueCategory.CABLES, Difficulty.ADVANCED,
            "Dropping stitches deliberately and catching them back in the new order.",
            "Once cables are familiar. Much faster over an all-over cable pattern.",
            listOf(
                "Work to the cable. Slip all the cable stitches to the right needle.",
                "Pinch the fabric firmly below the stitches, then slide the stitches off the needle entirely.",
                "Catch the group that must end up in front on the left needle, and the other group on the right needle.",
                "Rearrange them onto the left needle in the new order and knit across.",
            ),
            listOf(
                "Practise on a swatch in smooth, non-splitty yarn before trusting it on a garment.",
                "Only for small cables. Dropping six stitches of slippery silk is a bad afternoon.",
            ),
        ),
        t(
            "lifeline", "Lifeline", TechniqueCategory.LACE, Difficulty.EASY,
            "A thread run through a whole row so you can rip back to it safely.",
            "Lace, brioche, and any pattern you cannot read back stitch by stitch.",
            listOf(
                "Thread a length of smooth contrasting yarn or dental floss onto a tapestry needle.",
                "Pass it through every live stitch on the needle, without splitting the yarn.",
                "Leave it in and keep knitting. The lifeline stays put in the fabric.",
                "If it goes wrong, pull the needle out, rip back to the lifeline, and put the held stitches back on the needle.",
                "Place a new lifeline after every completed repeat.",
            ),
            listOf(
                "Interchangeable needles with a small hole in the join let you thread a lifeline as you knit a row.",
                "The cost of a lifeline is thirty seconds. The cost of not having one in lace is the whole shawl.",
            ),
        ),
        t(
            "lace-basics", "Reading and working lace", TechniqueCategory.LACE, Difficulty.ADVANCED,
            "Paired yarn overs and decreases that keep the stitch count while opening holes.",
            "Shawls, and any openwork panel.",
            listOf(
                "Every yarn over adds a stitch; every decrease takes one away. In most lace they are paired so each row ends at the same count.",
                "Count your stitches at the end of every row against the pattern's stated count. Catching an error one row later is easy; ten rows later is not.",
                "Most lace patterns rest on the wrong-side rows — usually just purl back.",
                "Lace looks like crumpled string on the needles. It only becomes lace when blocked.",
            ),
            listOf(
                "Place markers between repeats. If a repeat comes out one stitch short, you only rip back to that marker.",
                "Learn to read your knitting: a yarn over next to a k2tog is visible once you know what to look for.",
            ),
            abbr = listOf("yo", "k2tog", "ssk", "sk2p"),
        ),

        // ── Colourwork ────────────────────────────────────────────────────
        t(
            "stranded-colourwork", "Stranded colourwork", TechniqueCategory.COLOURWORK, Difficulty.ADVANCED,
            "Two colours in one round, with the unused colour carried across the back as floats.",
            "Fair Isle yokes, colourwork mittens and hats, patterned socks.",
            listOf(
                "Work from a chart, reading every round right to left.",
                "Knit each stitch with the colour its chart cell shows, carrying the other colour loosely behind.",
                "Keep the same colour in the same hand or position the whole way through — the one held to the left sits slightly more prominently, and switching mid-project shows.",
                "Spread the stitches on the right needle before each float so the strand behind is long enough. This is the whole skill.",
                "Turn the work inside out when knitting in the round to make the floats travel the longer way and stay loose.",
            ),
            listOf(
                "Puckering means tight floats. There is no fixing it afterwards, so check the back constantly.",
                "Stranded fabric is thicker, warmer and less elastic than plain knitting, and uses roughly a fifth more yarn.",
                "It is far easier in the round than flat: you never have to strand on a purl row.",
            ),
            listOf("Fair Isle", "stranded knitting"), listOf("MC", "CC"),
        ),
        t(
            "catching-floats", "Catching floats", TechniqueCategory.COLOURWORK, Difficulty.ADVANCED,
            "Trapping a long strand behind the work so fingers do not snag it.",
            "Any run of more than about seven stitches in one colour.",
            listOf(
                "Work to the middle of the long run.",
                "Bring the carried colour over the working colour before making the next stitch.",
                "Knit that stitch as normal — the carried strand is now caught behind it.",
                "Do not catch in the same column on consecutive rounds, or a visible line forms on the front.",
            ),
            listOf(
                "Stagger the catch point by a stitch or two each round.",
                "In a light colour over a dark one, catching can show through. Catch less often and knit the floats looser instead.",
            ),
        ),
        t(
            "intarsia", "Intarsia", TechniqueCategory.COLOURWORK, Difficulty.ADVANCED,
            "Blocks of colour, each with its own yarn supply and no floats at all.",
            "Large motifs, pictures, argyle — anything where a float would be far too long.",
            listOf(
                "Wind a separate bobbin for every block of colour in the row.",
                "Knit each block with its own yarn.",
                "At every colour change, bring the new colour up from under the old one. That twist is what joins the blocks.",
                "Forget the twist and you get a vertical slit instead of a seam.",
            ),
            listOf(
                "Intarsia is worked flat. It does not work in the round, because the yarn ends up on the wrong side of the block.",
                "Lots of ends to weave in. Leave generous tails.",
                "Uses barely more yarn than plain stockinette, since there are no floats.",
            ),
        ),
        t(
            "mosaic-knitting", "Mosaic (slip-stitch) knitting", TechniqueCategory.COLOURWORK, Difficulty.EASY,
            "Colour patterns made by slipping stitches, using only one colour per row.",
            "The easiest route into colourwork, and a good one for high-contrast yarns.",
            listOf(
                "Work two rows in colour A, then two rows in colour B, alternating throughout.",
                "On each row, knit the stitches in the current colour and slip the ones that should stay the other colour, purlwise with the yarn behind.",
                "The slipped stitch carries its old colour up from the row below.",
                "Never carry two colours in one row — that is the point of the method.",
            ),
            listOf(
                "Because only one colour is worked per row, there are no floats and no tension juggling.",
                "The slipped stitches make the fabric denser and shorter than plain stockinette. Check row gauge carefully.",
            ),
            listOf("slip stitch colourwork"),
        ),
        t(
            "brioche", "Brioche", TechniqueCategory.COLOURWORK, Difficulty.ADVANCED,
            "A lofty, fully reversible two-colour rib made with paired yarn-overs and slips.",
            "Squashy scarves, cowls and hats where both sides show.",
            listOf(
                "Every visible row is worked twice, once in each colour, so a ‘row’ means two passes.",
                "brk (brioche knit): knit the stitch together with the yarn over that sits with it.",
                "brp (brioche purl): purl the stitch together with its yarn over.",
                "sl1yo: slip a stitch purlwise while taking the yarn over the needle, creating the paired yarn over for next time.",
                "Two-colour brioche alternates: work a pass in the dark colour, slide back, work a pass in the light colour.",
            ),
            listOf(
                "Almost impossible to tink back. Use a lifeline every few rows.",
                "It uses close to double the yarn of stockinette for the same area — budget accordingly.",
                "The two sides are negatives of each other, which is exactly why people love it.",
            ),
            abbr = listOf("brk", "brp", "sl1yo"),
        ),
        t(
            "jogless-stripes", "Jogless stripes", TechniqueCategory.COLOURWORK, Difficulty.EASY,
            "Hiding the step that appears where a stripe changes colour in the round.",
            "Any striped tube: hats, cowls, sleeves, socks.",
            listOf(
                "Knit the first round of the new colour normally, all the way around.",
                "At the start of the second round, lift the right leg of the stitch directly below the first stitch onto the left needle.",
                "Knit it together with the first stitch.",
                "Carry on. The jog is pulled level and effectively disappears.",
            ),
            listOf(
                "It shifts the start of the round by a fraction each time. Over many stripes the marker drifts — move it back when it bothers you.",
                "For single-round stripes, a spiral is unavoidable; use it deliberately instead of fighting it.",
            ),
        ),
        t(
            "duplicate-stitch", "Duplicate stitch", TechniqueCategory.COLOURWORK, Difficulty.EASY,
            "Embroidering over knitted stitches to add colour after the fact.",
            "Small details, letters, fixing a mis-knitted colourwork stitch, third colours in a two-colour row.",
            listOf(
                "Thread the new colour on a tapestry needle.",
                "Come up from behind at the base of the V you want to cover.",
                "Pass under both legs of the stitch above it.",
                "Go back down where you came up. You have traced the V exactly.",
                "Move to the next stitch.",
            ),
            listOf(
                "Use the same weight of yarn or it will not cover.",
                "The single best rescue for one wrong colourwork stitch found twenty rounds later.",
            ),
            listOf("Swiss darning"),
        ),

        // ── Short rows and in the round ───────────────────────────────────
        t(
            "german-short-rows", "German short rows", TechniqueCategory.SHORT_ROWS, Difficulty.INTERMEDIATE,
            "Extra rows worked over part of the fabric, using a pulled ‘double stitch’.",
            "Sock heels, shoulder slopes, raising the back neck of a sweater, bust darts.",
            listOf(
                "Work to your turning point and turn the work.",
                "Slip the first stitch purlwise with the yarn in front.",
                "Pull the yarn firmly up and over the needle to the back. The stitch below is dragged up and now shows two legs — that is the double stitch.",
                "Work the row as normal from there.",
                "On later rows, when you reach a double stitch, work both its legs together as one stitch.",
            ),
            listOf(
                "Far easier than wrap and turn and it looks better.",
                "Count double stitches as one stitch when counting the row.",
                "The pull needs to be firm. A limp pull leaves a slack, visible turn.",
            ),
            listOf("double stitch short rows"), listOf("DS"),
        ),
        t(
            "wrap-and-turn", "Wrap and turn (w&t)", TechniqueCategory.SHORT_ROWS, Difficulty.INTERMEDIATE,
            "The traditional short-row method: wrap the next stitch before turning.",
            "When a pattern is written for it, or in garter stitch where the wraps disappear anyway.",
            listOf(
                "Work to the turning point.",
                "Slip the next stitch purlwise to the right needle.",
                "Bring the yarn to the other side of the work between the needles.",
                "Slip the stitch back to the left needle. It is now wrapped.",
                "Turn and work back.",
                "Later, when you reach a wrapped stitch, lift the wrap onto the needle and work it together with its stitch to hide it.",
            ),
            listOf(
                "In garter stitch you can skip picking up the wraps entirely — they vanish into the ridges.",
                "Picking up wraps is where most people go wrong: the wrap goes under the stitch on the knit side, over it on the purl side.",
            ),
            abbr = listOf("w&t"),
        ),
        t(
            "heel-flap", "Heel flap", TechniqueCategory.SHORT_ROWS, Difficulty.INTERMEDIATE,
            "A slip-stitch rectangle worked flat on half the sock stitches.",
            "Cuff-down socks, before the heel turn.",
            listOf(
                "Divide the stitches: half for the heel, half held for the instep.",
                "Right side: *slip 1 purlwise with yarn in back, k1* to the end.",
                "Wrong side: slip 1, purl to the end.",
                "Repeat until the flap is square — as many rows as there are heel stitches.",
            ),
            listOf(
                "The slipped stitches double the fabric thickness exactly where a sock wears out first.",
                "They also make neat chain edges: one chain per two rows, which is precisely what you pick up for the gusset.",
            ),
        ),
        t(
            "short-row-heel-turn", "Turning a heel", TechniqueCategory.SHORT_ROWS, Difficulty.ADVANCED,
            "The short-row wedge that turns a sock through ninety degrees.",
            "Right after the heel flap on a cuff-down sock.",
            listOf(
                "Working on the heel stitches only, knit past the centre by a few stitches, then ssk, k1, and turn.",
                "Slip the first stitch, purl back past the centre by the same margin, then p2tog, p1, and turn.",
                "Knit to one stitch before the gap left by the previous turn, ssk across that gap, k1, turn.",
                "Purl to one stitch before the gap, p2tog across it, p1, turn.",
                "Repeat until every heel stitch has been consumed. The heel now cups.",
            ),
            listOf(
                "The gap is always visible — it is the ladder between the last worked stitch and the next. Close it, do not knit past it.",
                "You may run out of stitches for the final k1 or p1. That is normal; just work the decrease.",
                "This is the moment a flat piece of knitting becomes a three-dimensional object. Worth doing slowly the first time.",
            ),
        ),
        t(
            "join-in-round", "Joining in the round", TechniqueCategory.IN_THE_ROUND, Difficulty.BEGINNER,
            "Closing the cast-on into a circle without twisting it.",
            "The first round of every hat, sock, cowl and sleeve.",
            listOf(
                "Cast on and spread the stitches evenly along the needle.",
                "Lay the work down and check that the cast-on edge faces inwards the whole way round, with no stitch flipped over the needle.",
                "Place a marker for the start of the round.",
                "Knit the first stitch, pulling the yarn firmly to close the gap.",
            ),
            listOf(
                "A twist cannot be fixed later. It is a Möbius strip and the only cure is ripping back.",
                "Work the first round flat and join on round two if you find the check hard — the tiny seam at the join is barely visible.",
                "Swap the first and last stitch as you join for a tidier, tighter start.",
            ),
        ),
        t(
            "magic-loop", "Magic loop", TechniqueCategory.IN_THE_ROUND, Difficulty.INTERMEDIATE,
            "Knitting a small circumference on one long circular needle.",
            "Socks, sleeves, mitten and hat crowns — anywhere too small for a circular needle.",
            listOf(
                "Use a circular needle with a cable of at least 80 cm.",
                "Slide all the stitches onto the cable and find the halfway point.",
                "Pull a loop of cable out at that halfway point, so half the stitches sit on each side.",
                "Slide the back half onto its needle tip; let the front half rest on the cable.",
                "Knit the back-half stitches with the free tip.",
                "Turn the work, redistribute, and repeat.",
            ),
            listOf(
                "Pull the first stitch of each half firmly or you will get a ladder down the two changeover points.",
                "A flexible cable makes the difference between pleasant and infuriating.",
            ),
        ),
        t(
            "avoiding-ladders", "Avoiding ladders", TechniqueCategory.IN_THE_ROUND, Difficulty.EASY,
            "Stopping the loose columns that appear where needles change over.",
            "Any small-circumference knitting on double-points or magic loop.",
            listOf(
                "Give the first stitch after each changeover a firm tug.",
                "Better: knit the first two or three stitches of the new needle, then tug.",
                "Shift where the changeover falls every few rounds so the strain never lands in the same column twice.",
            ),
            listOf("Blocking hides mild laddering. It will not save a really loose one, so fix it as you knit."),
        ),

        // ── Finishing ─────────────────────────────────────────────────────
        t(
            "standard-bind-off", "Standard bind-off", TechniqueCategory.FINISHING, Difficulty.BEGINNER,
            "The basic chained bind-off, worked two stitches at a time.",
            "Any edge that does not need to stretch.",
            listOf(
                "Knit two stitches.",
                "Lift the first stitch over the second and off the needle. One stitch remains on the right needle.",
                "Knit one more stitch, then lift the previous one over it again.",
                "Repeat to the end. Cut the yarn and pull the tail through the last stitch.",
            ),
            listOf(
                "Work it in pattern — knit the knits and purl the purls — for a tidier edge on rib.",
                "Almost everyone binds off too tightly. Go up a needle size or two for the bind-off row.",
            ),
            listOf("cast off"), listOf("BO"),
        ),
        t(
            "stretchy-bind-off", "Stretchy bind-off", TechniqueCategory.FINISHING, Difficulty.EASY,
            "A yarn-over bind-off that stretches as far as ribbing does.",
            "Sock cuffs, hat brims, necklines, shawls — anywhere a standard bind-off would strangle the edge.",
            listOf(
                "Yarn over, then knit one, then lift the yarn over off over the knitted stitch.",
                "Lift the previous stitch over as well, as in a normal bind-off.",
                "Before a purl stitch, make the yarn over in the opposite direction so it sits flat.",
                "Repeat to the end.",
            ),
            listOf(
                "Known as Jeny's Surprisingly Stretchy Bind-Off. It genuinely stretches as much as the rib.",
                "A sock cuff bound off tightly cannot go over a heel. This is the fix.",
            ),
            listOf("JSSBO"), listOf("BO"),
        ),
        t(
            "kitchener-stitch", "Kitchener stitch (grafting)", TechniqueCategory.FINISHING, Difficulty.ADVANCED,
            "Joining two sets of live stitches with a row of sewn stitches — an invisible seam.",
            "Sock toes, mitten tips, underarms, and any join that must not show.",
            listOf(
                "Divide the stitches evenly over two needles held parallel, wrong sides together. Thread the tail on a tapestry needle.",
                "Set-up: go through the first front stitch purlwise and leave it on; go through the first back stitch knitwise and leave it on.",
                "Front needle: go through the first stitch knitwise and slip it off; go through the next stitch purlwise and leave it on.",
                "Back needle: go through the first stitch purlwise and slip it off; go through the next stitch knitwise and leave it on.",
                "Repeat those two steps until all stitches are gone. Adjust the tension of the grafted row to match its neighbours.",
            ),
            listOf(
                "The rhythm is: knit off, purl on — front; purl off, knit on — back. Say it aloud while you work.",
                "Do not pull tight as you go. Work loosely, then even the whole row out at the end with the needle tip.",
                "Getting interrupted is what ruins a graft. Finish it in one sitting.",
            ),
            listOf("grafting"),
        ),
        t(
            "mattress-stitch", "Mattress stitch", TechniqueCategory.FINISHING, Difficulty.INTERMEDIATE,
            "An invisible vertical seam sewn from the right side.",
            "Joining side seams and sleeve seams on pieces knitted flat.",
            listOf(
                "Lay both pieces side by side, right sides up, edges touching.",
                "Find the horizontal bars between the edge stitch and the next stitch in.",
                "Pick up one bar on the left piece, then the matching bar on the right piece.",
                "Alternate side to side for a few centimetres, then pull the yarn to draw the seam closed.",
                "Keep going, tightening every few stitches.",
            ),
            listOf(
                "Always work into the same column on both pieces or the seam wanders.",
                "Do not pull so hard that the seam puckers — it should have the same give as the fabric.",
                "Done well, the seam vanishes completely. It is worth the practice.",
            ),
        ),
        t(
            "picking-up-stitches", "Picking up stitches", TechniqueCategory.FINISHING, Difficulty.INTERMEDIATE,
            "Creating new live stitches along a finished edge.",
            "Necklines, button bands, sleeve cuffs, sock gussets.",
            listOf(
                "With the right side facing, insert the needle under both legs of the edge stitch.",
                "Wrap the working yarn and pull a loop through. That is one picked-up stitch.",
                "Along a vertical edge, pick up roughly 3 stitches for every 4 rows — row gauge is finer than stitch gauge.",
                "Along a horizontal edge, pick up 1 stitch for every stitch.",
                "Around a curve, pick up steadily and skip a stitch here and there rather than bunching.",
            ),
            listOf(
                "Divide the edge with markers first and pick up the same number in each section. It is the only reliable way to stay even.",
                "Going one full stitch in from the edge, rather than into the very edge stitch, gives a much tidier line.",
            ),
            abbr = listOf("PU"),
        ),
        t(
            "weaving-in-ends", "Weaving in ends", TechniqueCategory.FINISHING, Difficulty.BEGINNER,
            "Securing loose tails so they never work their way out.",
            "Every project, at every colour change and every new ball.",
            listOf(
                "Thread the tail on a tapestry needle.",
                "On the wrong side, run it through the bumps of the purl stitches for about 5 cm, following the line of a row.",
                "Reverse direction and go back through a neighbouring row for a couple of centimetres. The change of direction is what locks it.",
                "Stretch the fabric gently, then trim the tail close.",
            ),
            listOf(
                "Weave along a colour change into the matching colour, not across it, or the tail shows on the front.",
                "In slippery yarns like silk or superwash, weave further and split the plies as you go.",
                "Never trim before stretching — the tail retreats into the fabric and can pop out later.",
            ),
        ),
        t(
            "blocking", "Blocking", TechniqueCategory.FINISHING, Difficulty.EASY,
            "Wetting and pinning the finished piece to set its shape and even out the stitches.",
            "Every project. It is not optional for lace and it improves everything else.",
            listOf(
                "Soak the piece in cool water with a little wool wash for twenty minutes. Do not agitate.",
                "Lift it out supporting its whole weight, and squeeze — never wring.",
                "Roll it in a towel and press to get most of the water out.",
                "Lay it on blocking mats, pat it to the measurements you want, and pin it there. For lace, stretch firmly and use wires along straight edges.",
                "Let it dry completely before unpinning — usually a day.",
            ),
            listOf(
                "Blocking transforms lace, evens out colourwork, and relaxes stockinette. It cannot fix a garment that is the wrong size.",
                "Superwash yarns grow when wet and keep the growth. Block your swatch the same way or your gauge will lie.",
                "Steam blocking is quicker but never touch the iron to the fabric, and never steam acrylic — it kills the springiness permanently.",
            ),
        ),
        t(
            "garter-tab", "Garter tab cast-on", TechniqueCategory.FINISHING, Difficulty.INTERMEDIATE,
            "Starting a top-down shawl with a seamless garter edge instead of a lumpy corner.",
            "Nearly every top-down triangular or crescent shawl.",
            listOf(
                "Cast on 3 stitches and knit 6 rows — three garter ridges.",
                "Do not turn. Rotate the work a quarter turn clockwise and pick up and knit 3 stitches along the side edge, one in each ridge.",
                "Rotate again and pick up and knit 3 stitches from the cast-on edge.",
                "You have 9 stitches, and the top edge of the shawl now runs continuously into the garter border.",
            ),
            listOf("The tab is worth the two minutes: a shawl started without one has a visible pucker at the neck forever."),
        ),

        // ── Fixing mistakes ───────────────────────────────────────────────
        t(
            "dropped-stitch", "Picking up a dropped stitch", TechniqueCategory.FIXING, Difficulty.EASY,
            "Climbing a runaway stitch back up its ladder with a crochet hook.",
            "The moment you spot a run. They do not fix themselves.",
            listOf(
                "Stop and secure the loose stitch with a locking marker or safety pin so it cannot run further.",
                "In stockinette, work from the knit side. Put a crochet hook through the dropped loop from the front.",
                "Catch the lowest ladder rung and pull it through the loop.",
                "Repeat rung by rung until you reach the needle, then put the stitch back on, making sure it is not twisted.",
                "In garter stitch, flip the work each rung so you are always pulling from the knit side.",
            ),
            listOf(
                "Rescuing a stitch several rows down often leaves it slightly loose. Tug the neighbouring stitches sideways to redistribute the slack, then block.",
                "A dropped stitch in ribbing needs the same alternation as garter: knit rungs from the front, purl rungs from the back.",
            ),
        ),
        t(
            "tink", "Tinking (unknitting)", TechniqueCategory.FIXING, Difficulty.BEGINNER,
            "Undoing stitches one at a time, backwards. ‘Tink’ is ‘knit’ spelled backwards.",
            "A mistake within the last row or two.",
            listOf(
                "Put the left needle into the stitch below the first stitch on the right needle, from the front.",
                "Slip the stitch above off the right needle.",
                "Pull the working yarn to undo it.",
                "Repeat back to the mistake.",
            ),
            listOf("Slow but completely safe. For more than a couple of rows, rip back to a lifeline instead."),
            listOf("unknitting"),
        ),
        t(
            "frogging", "Frogging (ripping back)", TechniqueCategory.FIXING, Difficulty.EASY,
            "Pulling the work off the needle and unravelling several rows at once.",
            "A mistake more than a couple of rows down, or a project you want to reclaim the yarn from.",
            listOf(
                "Decide which row you want to land on, and count down to it.",
                "If you have a lifeline in that row, rip straight down to it.",
                "Otherwise, run a spare circular needle or a lifeline through one leg of every stitch in the target row first.",
                "Slide the work off the needle and pull the yarn until you reach that row.",
                "Check every stitch is sitting the right way round as you knit the next row.",
            ),
            listOf(
                "Threading the safety line before ripping — not after — is the whole trick.",
                "Kinked yarn relaxes when washed, or wind it into a skein and give it a light steam.",
            ),
            listOf("ripping back"),
        ),
        t(
            "twisted-stitch-fix", "Fixing a twisted stitch", TechniqueCategory.FIXING, Difficulty.EASY,
            "Spotting and correcting a stitch mounted the wrong way round.",
            "Whenever a stitch looks tighter and more crossed than its neighbours.",
            listOf(
                "A correctly mounted stitch has its right leg at the front of the needle.",
                "If the left leg is at the front, slip the stitch off, turn it around, and put it back.",
                "If you have already knitted it and it is a row or two down, drop that column down to the twisted stitch and ladder it back up correctly.",
            ),
            listOf(
                "Twisted stitches usually come from purling backwards or from picking up a dropped stitch the wrong way.",
                "One twisted stitch in a plain fabric is genuinely visible. In textured fabric, let it go.",
            ),
        ),
        t(
            "miscount-fix", "Fixing a miscount", TechniqueCategory.FIXING, Difficulty.EASY,
            "Finding where a stitch was gained or lost, without ripping everything out.",
            "The count at the end of a row does not match the pattern.",
            listOf(
                "Count again, in groups of ten, with markers. Half of all miscounts are counting errors.",
                "One stitch too many: look for an accidental yarn over at the start of a row, or a stitch worked into the gap between two stitches.",
                "One stitch too few: look for two stitches worked together by accident, or a stitch that slipped off the needle a row back.",
                "In a plain fabric you can simply decrease or increase discreetly at the edge of the next row to correct by one.",
                "In a patterned fabric, find the actual error and ladder that column down to fix it.",
            ),
            listOf(
                "Markers every 20 stitches turn a whole-row hunt into a 20-stitch hunt.",
                "Write your count down at the end of each row of a complicated pattern. It takes two seconds.",
            ),
        ),
    )
}

object AbbreviationGlossary {
    val all: List<Abbreviation> = listOf(
        Abbreviation("BO", "bind off", "Cast off — finish the live stitches so they cannot unravel.", "standard-bind-off"),
        Abbreviation("brk", "brioche knit", "Knit a stitch together with its paired yarn over.", "brioche"),
        Abbreviation("brp", "brioche purl", "Purl a stitch together with its paired yarn over.", "brioche"),
        Abbreviation("C4B", "cable 4 back", "Slip 2 to a cable needle, hold at back, k2, then k2 from the cable needle. Leans right.", "cable-cross"),
        Abbreviation("C4F", "cable 4 front", "Slip 2 to a cable needle, hold at front, k2, then k2 from the cable needle. Leans left.", "cable-cross"),
        Abbreviation("CC", "contrast colour", "The secondary colour in colourwork.", "stranded-colourwork"),
        Abbreviation("cdd", "centred double decrease", "Slip 2 together knitwise, k1, pass the 2 slipped stitches over.", "cdd"),
        Abbreviation("cn", "cable needle", "A short needle that holds stitches while a cable crosses.", "cable-cross"),
        Abbreviation("CO", "cast on", "Put the first stitches on the needle.", "long-tail-cast-on"),
        Abbreviation("dec", "decrease", "Reduce the stitch count.", "k2tog"),
        Abbreviation("DPN", "double-pointed needles", "Short needles with tips at both ends, for small circumferences.", "magic-loop"),
        Abbreviation("DS", "double stitch", "The two-legged stitch made by a German short row turn.", "german-short-rows"),
        Abbreviation("inc", "increase", "Add to the stitch count.", "m1l"),
        Abbreviation("k", "knit", "The basic stitch, worked with the yarn at the back.", "knit-stitch"),
        Abbreviation("k2tog", "knit two together", "Knit two stitches as one. Leans right, decreases by 1.", "k2tog"),
        Abbreviation("k3tog", "knit three together", "Knit three stitches as one. Decreases by 2.", "k2tog"),
        Abbreviation("kfb", "knit front and back", "Knit into the front then the back of one stitch. Increases by 1.", "kfb"),
        Abbreviation("ktbl", "knit through back loop", "Knit into the back of the stitch, twisting it.", "knit-stitch"),
        Abbreviation("LLI", "left lifted increase", "Increase made from the stitch two rows below, leaning left.", "lifted-increase"),
        Abbreviation("M1", "make one", "Increase from the bar between stitches. Usually means M1L.", "m1l"),
        Abbreviation("M1L", "make one left", "Lift the bar front to back, knit through the back. Leans left.", "m1l"),
        Abbreviation("M1R", "make one right", "Lift the bar back to front, knit through the front. Leans right.", "m1r"),
        Abbreviation("MC", "main colour", "The dominant colour of a colourwork piece.", "stranded-colourwork"),
        Abbreviation("p", "purl", "The reverse of a knit stitch, worked with the yarn in front.", "purl-stitch"),
        Abbreviation("p2tog", "purl two together", "Purl two stitches as one. Decreases by 1.", "p2tog"),
        Abbreviation("pm", "place marker", "Put a stitch marker on the needle.", null),
        Abbreviation("psso", "pass slipped stitch over", "Lift a slipped stitch over the one just worked.", "cdd"),
        Abbreviation("PU", "pick up and knit", "Make new live stitches along a finished edge.", "picking-up-stitches"),
        Abbreviation("rep", "repeat", "Work the marked instructions again.", null),
        Abbreviation("RLI", "right lifted increase", "Increase made from the stitch below, leaning right.", "lifted-increase"),
        Abbreviation("rnd", "round", "One full circuit when knitting in the round.", "join-in-round"),
        Abbreviation("RS", "right side", "The public face of the fabric.", "reading-charts"),
        Abbreviation("sk2p", "slip 1, k2tog, pass over", "A left-leaning double decrease. Takes out 2 stitches.", "cdd"),
        Abbreviation("sl", "slip", "Move a stitch to the other needle without working it.", "heel-flap"),
        Abbreviation("sl1yo", "slip 1, yarn over", "Slip a stitch purlwise while taking the yarn over the needle.", "brioche"),
        Abbreviation("sm", "slip marker", "Move the marker from one needle to the other.", null),
        Abbreviation("ssk", "slip slip knit", "Slip 2 knitwise, then knit them together through the front. Leans left.", "ssk"),
        Abbreviation("ssp", "slip slip purl", "The purl-side mirror of ssk.", "p2tog"),
        Abbreviation("st", "stitch", "One loop on the needle.", null),
        Abbreviation("St st", "stockinette stitch", "Knit on the right side, purl on the wrong side.", "stockinette"),
        Abbreviation("sts", "stitches", "Plural of stitch.", null),
        Abbreviation("tbl", "through back loop", "Work into the back of the stitch, twisting it.", null),
        Abbreviation("w&t", "wrap and turn", "Wrap the next stitch and turn, for a short row.", "wrap-and-turn"),
        Abbreviation("WS", "wrong side", "The inside face of the fabric.", "reading-charts"),
        Abbreviation("wyib", "with yarn in back", "Hold the working yarn behind the work while slipping.", "heel-flap"),
        Abbreviation("wyif", "with yarn in front", "Hold the working yarn in front of the work while slipping.", "german-short-rows"),
        Abbreviation("yo", "yarn over", "Wrap the yarn over the needle to make a new stitch and a hole.", "yarn-over"),
    )

    fun search(query: String): List<Abbreviation> {
        val trimmed = query.trim().lowercase()
        if (trimmed.isEmpty()) return all
        return all.filter {
            it.short.lowercase().contains(trimmed) ||
                it.full.lowercase().contains(trimmed) ||
                it.meaning.lowercase().contains(trimmed)
        }
    }

    fun lookup(short: String): Abbreviation? = all.firstOrNull { it.short.equals(short, ignoreCase = true) }
}
