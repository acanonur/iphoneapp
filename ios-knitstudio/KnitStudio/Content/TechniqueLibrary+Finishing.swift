import Foundation

extension TechniqueLibrary {

    static let finishingAndFixing: [Technique] = [

        // MARK: - Finishing

        Technique(
            id: "standard-bind-off",
            name: "Standard bind-off",
            category: .finishing,
            difficulty: .beginner,
            summary: "The basic chained bind-off, worked two stitches at a time.",
            whenToUse: "Any edge that does not need to stretch.",
            steps: [
                "Knit two stitches.",
                "Lift the first stitch over the second and off the needle. One stitch remains on the right needle.",
                "Knit one more stitch, then lift the previous one over it again.",
                "Repeat to the end. Cut the yarn and pull the tail through the last stitch.",
            ],
            tips: [
                "Work it in pattern — knit the knits and purl the purls — for a tidier edge on rib.",
                "Almost everyone binds off too tightly. Go up a needle size or two for the bind-off row.",
            ],
            abbreviations: ["BO", "cast off"]),

        Technique(
            id: "stretchy-bind-off",
            name: "Stretchy bind-off",
            category: .finishing,
            difficulty: .easy,
            summary: "A yarn-over bind-off that stretches as far as ribbing does.",
            whenToUse: "Sock cuffs, hat brims, necklines, shawls — anywhere a standard bind-off would strangle the edge.",
            steps: [
                "Yarn over, then knit one, then lift the yarn over off over the knitted stitch.",
                "Lift the previous stitch over as well, as in a normal bind-off.",
                "Before a purl stitch, make the yarn over in the opposite direction so it sits flat.",
                "Repeat to the end.",
            ],
            tips: [
                "Known as Jeny's Surprisingly Stretchy Bind-Off. It genuinely stretches as much as the rib.",
                "A sock cuff bound off tightly cannot go over a heel. This is the fix.",
            ],
            alsoKnownAs: ["JSSBO", "Jeny's surprisingly stretchy bind-off"],
            abbreviations: ["BO"]),

        Technique(
            id: "icord-bind-off",
            name: "I-cord bind-off",
            category: .finishing,
            difficulty: .intermediate,
            summary: "Finishes an edge with a neat rolled cord along it.",
            whenToUse: "Cardigan fronts, blanket edges, shawl borders — anywhere you want a firm decorative rim.",
            steps: [
                "Cast on 3 extra stitches at the start of the edge.",
                "Knit 2, then slip 1 knitwise, knit the next edge stitch, and pass the slipped stitch over.",
                "Slide the 3 stitches from the right needle back to the left needle without turning.",
                "Repeat until every edge stitch is consumed, then bind off the 3 cord stitches.",
            ],
            tips: ["It is firm and does not stretch — do not use it where the edge must give."]),

        Technique(
            id: "kitchener-stitch",
            name: "Kitchener stitch (grafting)",
            category: .finishing,
            difficulty: .advanced,
            summary: "Joining two sets of live stitches with a row of sewn stitches — an invisible seam.",
            whenToUse: "Sock toes, mitten tips, underarms, and any join that must not show.",
            steps: [
                "Divide the stitches evenly over two needles held parallel, wrong sides together. Thread the tail on a tapestry needle.",
                "Set-up: go through the first front stitch purlwise and leave it on; go through the first back stitch knitwise and leave it on.",
                "Front needle: go through the first stitch knitwise and slip it off; go through the next stitch purlwise and leave it on.",
                "Back needle: go through the first stitch purlwise and slip it off; go through the next stitch knitwise and leave it on.",
                "Repeat those two steps until all stitches are gone. Adjust the tension of the grafted row to match its neighbours.",
            ],
            tips: [
                "The rhythm is: knit off, purl on — front; purl off, knit on — back. Say it aloud while you work.",
                "Do not pull tight as you go. Work loosely, then even the whole row out at the end with the needle tip.",
                "Getting interrupted is what ruins a graft. Finish it in one sitting.",
            ],
            alsoKnownAs: ["grafting", "Kitchener"]),

        Technique(
            id: "mattress-stitch",
            name: "Mattress stitch",
            category: .finishing,
            difficulty: .intermediate,
            summary: "An invisible vertical seam sewn from the right side.",
            whenToUse: "Joining side seams and sleeve seams on pieces knitted flat.",
            steps: [
                "Lay both pieces side by side, right sides up, edges touching.",
                "Find the horizontal bars between the edge stitch and the next stitch in.",
                "Pick up one bar on the left piece, then the matching bar on the right piece.",
                "Alternate side to side for a few centimetres, then pull the yarn to draw the seam closed.",
                "Keep going, tightening every few stitches.",
            ],
            tips: [
                "Always work into the same column on both pieces or the seam wanders.",
                "Do not pull so hard that the seam puckers — it should have the same give as the fabric.",
                "Done well, the seam vanishes completely. It is worth the practice.",
            ]),

        Technique(
            id: "picking-up-stitches",
            name: "Picking up stitches",
            category: .finishing,
            difficulty: .intermediate,
            summary: "Creating new live stitches along a finished edge.",
            whenToUse: "Necklines, button bands, sleeve cuffs, sock gussets.",
            steps: [
                "With the right side facing, insert the needle under both legs of the edge stitch.",
                "Wrap the working yarn and pull a loop through. That is one picked-up stitch.",
                "Along a vertical edge, pick up roughly 3 stitches for every 4 rows — row gauge is finer than stitch gauge.",
                "Along a horizontal edge, pick up 1 stitch for every stitch.",
                "Around a curve, pick up steadily and skip a stitch here and there rather than bunching.",
            ],
            tips: [
                "Divide the edge with markers first and pick up the same number in each section. It is the only reliable way to stay even.",
                "Going one full stitch in from the edge, rather than into the very edge stitch, gives a much tidier line.",
            ],
            abbreviations: ["PU", "pick up and knit"]),

        Technique(
            id: "weaving-in-ends",
            name: "Weaving in ends",
            category: .finishing,
            difficulty: .beginner,
            summary: "Securing loose tails so they never work their way out.",
            whenToUse: "Every project, at every colour change and every new ball.",
            steps: [
                "Thread the tail on a tapestry needle.",
                "On the wrong side, run it through the bumps of the purl stitches for about 5 cm, following the line of a row.",
                "Reverse direction and go back through a neighbouring row for a couple of centimetres. The change of direction is what locks it.",
                "Stretch the fabric gently, then trim the tail close.",
            ],
            tips: [
                "Weave along a colour change into the matching colour, not across it, or the tail shows on the front.",
                "In slippery yarns like silk or superwash, weave further and split the plies as you go.",
                "Never trim before stretching — the tail retreats into the fabric and can pop out later.",
            ]),

        Technique(
            id: "blocking",
            name: "Blocking",
            category: .finishing,
            difficulty: .easy,
            summary: "Wetting and pinning the finished piece to set its shape and even out the stitches.",
            whenToUse: "Every project. It is not optional for lace and it improves everything else.",
            steps: [
                "Soak the piece in cool water with a little wool wash for twenty minutes. Do not agitate.",
                "Lift it out supporting its whole weight, and squeeze — never wring.",
                "Roll it in a towel and press to get most of the water out.",
                "Lay it on blocking mats, pat it to the measurements you want, and pin it there. For lace, stretch firmly and use wires along straight edges.",
                "Let it dry completely before unpinning — usually a day.",
            ],
            tips: [
                "Blocking transforms lace, evens out colourwork, and relaxes stockinette. It cannot fix a garment that is the wrong size.",
                "Superwash yarns grow when wet and keep the growth. Block your swatch the same way or your gauge will lie.",
                "Steam blocking is quicker but never touch the iron to the fabric, and never steam acrylic — it kills the springiness permanently.",
            ]),

        Technique(
            id: "garter-tab",
            name: "Garter tab cast-on",
            category: .finishing,
            difficulty: .intermediate,
            summary: "Starting a top-down shawl with a seamless garter edge instead of a lumpy corner.",
            whenToUse: "Nearly every top-down triangular or crescent shawl.",
            steps: [
                "Cast on 3 stitches and knit 6 rows — three garter ridges.",
                "Do not turn. Rotate the work a quarter turn clockwise and pick up and knit 3 stitches along the side edge, one in each ridge.",
                "Rotate again and pick up and knit 3 stitches from the cast-on edge.",
                "You have 9 stitches, and the top edge of the shawl now runs continuously into the garter border.",
            ],
            tips: ["The tab is worth the two minutes: a shawl started without one has a visible pucker at the neck forever."]),

        // MARK: - Fixing mistakes

        Technique(
            id: "dropped-stitch",
            name: "Picking up a dropped stitch",
            category: .fixing,
            difficulty: .easy,
            summary: "Climbing a runaway stitch back up its ladder with a crochet hook.",
            whenToUse: "The moment you spot a run. They do not fix themselves.",
            steps: [
                "Stop and secure the loose stitch with a locking marker or safety pin so it cannot run further.",
                "In stockinette, work from the knit side. Put a crochet hook through the dropped loop from the front.",
                "Catch the lowest ladder rung and pull it through the loop.",
                "Repeat rung by rung until you reach the needle, then put the stitch back on, making sure it is not twisted.",
                "In garter stitch, flip the work each rung so you are always pulling from the knit side.",
            ],
            tips: [
                "Rescuing a stitch several rows down often leaves it slightly loose. Tug the neighbouring stitches sideways to redistribute the slack, then block.",
                "A dropped stitch in ribbing needs the same alternation as garter: knit rungs from the front, purl rungs from the back.",
            ]),

        Technique(
            id: "tink",
            name: "Tinking (unknitting)",
            category: .fixing,
            difficulty: .beginner,
            summary: "Undoing stitches one at a time, backwards. ‘Tink’ is ‘knit’ spelled backwards.",
            whenToUse: "A mistake within the last row or two.",
            steps: [
                "Put the left needle into the stitch below the first stitch on the right needle, from the front.",
                "Slip the stitch above off the right needle.",
                "Pull the working yarn to undo it.",
                "Repeat back to the mistake.",
            ],
            tips: ["Slow but completely safe. For more than a couple of rows, rip back to a lifeline instead."],
            alsoKnownAs: ["unknitting"]),

        Technique(
            id: "frogging",
            name: "Frogging (ripping back)",
            category: .fixing,
            difficulty: .easy,
            summary: "Pulling the work off the needle and unravelling several rows at once.",
            whenToUse: "A mistake more than a couple of rows down, or a project you want to reclaim the yarn from.",
            steps: [
                "Decide which row you want to land on, and count down to it.",
                "If you have a lifeline in that row, rip straight down to it.",
                "Otherwise, run a spare circular needle or a lifeline through one leg of every stitch in the target row first.",
                "Slide the work off the needle and pull the yarn until you reach that row.",
                "Check every stitch is sitting the right way round as you knit the next row.",
            ],
            tips: [
                "Threading the safety line before ripping — not after — is the whole trick.",
                "Kinked yarn relaxes when washed, or wind it into a skein and give it a light steam.",
            ],
            alsoKnownAs: ["ripping back", "rip it"]),

        Technique(
            id: "twisted-stitch-fix",
            name: "Fixing a twisted stitch",
            category: .fixing,
            difficulty: .easy,
            summary: "Spotting and correcting a stitch that is mounted the wrong way round.",
            whenToUse: "Whenever a stitch looks tighter and more crossed than its neighbours.",
            steps: [
                "A correctly mounted stitch has its right leg at the front of the needle.",
                "If the left leg is at the front, slip the stitch off, turn it around, and put it back.",
                "If you have already knitted it and it is a row or two down, drop that column down to the twisted stitch and ladder it back up correctly.",
            ],
            tips: [
                "Twisted stitches usually come from purling backwards or from picking up a dropped stitch the wrong way.",
                "One twisted stitch in a plain fabric is genuinely visible. In textured fabric, let it go.",
            ]),

        Technique(
            id: "miscount-fix",
            name: "Fixing a miscount",
            category: .fixing,
            difficulty: .easy,
            summary: "Finding where a stitch was gained or lost, without ripping everything out.",
            whenToUse: "The count at the end of a row does not match the pattern.",
            steps: [
                "Count again, in groups of ten, with markers. Half of all miscounts are counting errors.",
                "One stitch too many: look for an accidental yarn over at the start of a row, or a stitch worked into the gap between two stitches.",
                "One stitch too few: look for two stitches worked together by accident, or a stitch that slipped off the needle a row back.",
                "In a plain fabric you can simply decrease or increase discreetly at the edge of the next row to correct by one.",
                "In a patterned fabric, find the actual error and ladder that column down to fix it.",
            ],
            tips: [
                "Markers every 20 stitches turn a whole-row hunt into a 20-stitch hunt.",
                "Write your count down at the end of each row of a complicated pattern. It takes two seconds.",
            ]),
    ]
}
