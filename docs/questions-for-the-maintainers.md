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
- **Checked against the rulings:** each question ends with a line *Touches:*, the rulings it was checked against
  in [the rulings' index](rulings/README.md), by id, or "none". A static test checks the line
  (`tests/static/each-open-question-names-the-rulings-it-was-checked-against.test.ts`).
- **Numbered** in one series. A number is never reused.
- **Answered:** an answer becomes a ruling at once. The next pull request adds the ruling, with the status "Decided,
  not built", and takes the question out of this file ([adding a ruling](rulings/README.md#adding-a-ruling)). Building
  it is a row of [the backlog](backlog/README.md), and its own pull request.

Also open: the one point each ruling marked "(open question)" in [the rulings' index](rulings/README.md) leaves, in its
"Open" line. For example, [R-082](rulings/R-082-run-them-down.md) leaves open whether +15% is the right figure.

## 79. Does a Druidic hero bring Home of the Wild to another realm's Creatures?

Found on 2026-11-14.

The books give a Druidic realm's Creatures ×1.5 in forest and jungle. In play, a Druidic hero hired by a Good realm
also gives his Great Bears ×1.5 in the Elder Wood.

1. **As played: the realm's creed or the commander's, and the books say so.** Impact: nothing in play changes; the
   books' words change.
2. **As written: the realm's creed alone.** Impact: a change in play; a Druidic hero in another realm's service no
   longer gives his Creatures ×1.5.

*Assessment:* option 1, because nothing in play changes.

*Unlocks:* the fix of a known defect, KD-071, "Home of the Wild lifts a Druidic hero's Creatures in any realm, which the books
don't say".

*Touches:* [R-030](rulings/R-030-fervour.md) (a Druidic host's fervour),
[R-036](rulings/R-036-druid-mastery.md) (a Druidic realm's Creatures need no Druid level) and
[R-164](rulings/R-164-a-garrison-with-no-hero-fights-with-its-realms-rules.md) (a garrison's Home of the Wild is its
realm's).

## 80. After the turn's deadline, may a realm still save a draft or revise its orders?

Found on 2026-11-15.

[R-184](rulings/R-184-orders-sent-after-the-turns-deadline-are-refused.md) refuses orders sent after the deadline. It
doesn't say whether a realm may still save a draft, change the order of its heroes, or press Revise between the
deadline and the moment the GM's tab runs the turn. The deadline is 20:00. At 20:10 Bram saves a draft with a new
march for Sir Aldric; the GM's tab runs the turn at 21:00.

1. **Refused too, with the same message.** Impact: after the deadline the order form saves nothing, and the turn runs
   on what each realm had saved by 20:00. This is how the game works now (P2-05), until a maintainer rules.
2. **Allowed, but they don't count this turn.** Impact: Bram can keep working on his draft after 20:00, and the turn
   still runs on what he had saved by 20:00. The turn would need to tell a draft saved late from one saved in time:
   a change to the turn.

*Assessment:* option 1: one rule for every change after the deadline, and nothing more to build.

*Unlocks:* the late-orders rule of P2-05 set for good (one line of its database function).

*Touches:* [R-184](rulings/R-184-orders-sent-after-the-turns-deadline-are-refused.md) (orders sent after the
deadline are refused).

## 85. A line told to the whole world that also names a province: who reads it?

Found on 2026-11-21.

A line can be told to the whole world (a realm concedes, the game is decided), and those lines name no province. No
game writes one that names a province too, and no ruling says who would read it. The reports read it as a line seen
in that province (a combat line: only those who fought); the leak check reads it as told to every realm. Example: a
line "the crown's price falls" is told to the world and names Wendmeadow; Brenvale has no eyes in Wendmeadow.

1. **Every realm reads it, the province only says where.** Impact: Brenvale reads it. Nothing in play changes today.
2. **Only realms with eyes there read it, as the reports read it now.** Impact: Brenvale reads nothing of it. Nothing
   in play changes today.
3. **None is written: a line told to the world names no province,** and the engine refuses one, as
   [R-187](rulings/R-187-a-line-seen-in-a-province-or-in-a-battle-names-its-province.md) refuses a line seen in a
   province with no province. Impact: nothing in play changes; the question can't come back.

*Assessment:* option 3: a line has one reading, and the reports and the leak check can't disagree on it.

*Unlocks:* the one reading the reports' gate keeps for such a line (B-18).

*Touches:* [R-185](rulings/R-185-a-battles-line-is-read-only-by-those-who-fought-in-it-whatever-its-type.md),
[R-186](rulings/R-186-a-line-seen-in-a-province-is-read-by-whoever-has-eyes-there-whatever-its-type.md) and
[R-187](rulings/R-187-a-line-seen-in-a-province-or-in-a-battle-names-its-province.md) (who reads a line, by its sight).
