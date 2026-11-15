# The questions waiting for the maintainers

These are the questions about the game's rules that wait for a maintainer's answer. Each one names what its answer
unlocks.

**To answer on the GitHub website:** open this file, click the pencil icon, and write your answer on a new line under
the question (for example "2026-11-20: (1)"). Then click **Commit changes**.

## How a question is written and kept

- **Written** as a design fork: numbered options, each with its impact on play, then an agent's assessment, and a
  short example from inside the game, with made-up names ([CLAUDE.md](../CLAUDE.md#rules), "Design forks go to the
  maintainers"). Either maintainer answers.
- **Kept here** with what its answer unlocks, so that the questions are answered together, in one sitting
  ([the decision](decisions/README.md#the-decisions-on-how-the-work-runs), "Questions stored, asked in one sitting").
- **Numbered** in one series. A number is never reused.
- **Answered:** the pull request that builds the answer adds it as a ruling and takes the question out of this file
  ([adding a ruling](rulings/README.md#adding-a-ruling)). Each fix is its own pull request.

Also open: the one point each ruling marked "(open question)" in [the rulings' index](rulings/README.md) leaves, in its
"Open" line. For example, [R-082](rulings/R-082-run-them-down.md) leaves open whether +15% is the right figure.

## 78. Does a garrison on consecrated ground roll zeal?

Found on 2026-11-14.

The books say that defenders on consecrated ground roll zeal at double the chance. In play, only a hero defending
rolls it. Brother Osric's garrison of Holy Spearmen, alone in a consecrated province, never rolls.

1. **As played: only a hero's host rolls, and the books say so.** Impact: nothing in play changes; the books' words
   change.
2. **As written: a lone garrison rolls too.** Impact: a change in play; a lone garrison on consecrated ground
   rolls zeal at double the chance.

*Assessment:* option 1, because nothing in play changes.

*Unlocks:* the fix of a known defect, "the books promise a lone garrison zeal on consecrated ground": the words, or the
rule, in their own pull request.

## 79. Does a Druidic hero bring Home of the Wild to another realm's Creatures?

Found on 2026-11-14.

The books give a Druidic realm's Creatures ×1.5 in forest and jungle. In play, a Druidic hero hired by a Good realm
also gives his Great Bears ×1.5 in the Elder Wood.

1. **As played: the realm's creed or the commander's, and the books say so.** Impact: nothing in play changes; the
   books' words change.
2. **As written: the realm's creed alone.** Impact: a change in play; a Druidic hero in another realm's service no
   longer gives his Creatures ×1.5.

*Assessment:* option 1, because nothing in play changes.

*Unlocks:* the fix of a known defect, "Home of the Wild lifts a Druidic hero's Creatures in any realm, which the books
don't say".
