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

## 167. Does the Ring or the Helm shrug off a death that isn't a struck blow?

Found on 2026-11-27.

[R-153](rulings/R-153-two-second-wind-items-shrug-off-a-killing-blow-and-four-say-the-30-percent.md) says only a blow
is shrugged off, not a burn, poison or bleeding at a round's start. Other harms also kill without a roll today: a
guardian's burn aura, a shield's lash-back, the Thornwood bite, a spell's recoil. Arrows, spells' hits, guardian
specials and free strikes do get the roll. Sir Aldric, wearing the Ring, strikes a Thornwood-clad foe and dies to the
bite: does the Ring roll?

1. **No: only a struck blow, as built.** Impact: these harms kill a wearer outright, as burns do.
2. **Yes: any harm in the fight but the round-start ticks.** Impact: the Ring and the Helm save a few more wearers; four
   more places draw the roll, so more fights reshape.

*Assessment:* option 1: one line between a blow and a harm the wearer meets, and nothing to build.

*Unlocks:* R-153's open point settled.

*Touches:* [R-153](rulings/R-153-two-second-wind-items-shrug-off-a-killing-blow-and-four-say-the-30-percent.md).

## 168. Does a Philosopher's Stone already found take the Stone's new words?

Found on 2026-11-27.

[R-191](rulings/R-191-the-philosophers-stones-text-says-the-skeletal-companies-are-left-out.md) gives the Stone words
that say skeletal companies are not promoted. A Stone found before the change keeps the words it was found with: King
Aldric found one three turns ago, and his pack still reads "promote all armies one quality tier". The turn works it
the same either way.

1. **It keeps its words.** Impact: nothing changes for a Stone already found; one found from now on has the new words.
   This is how the game works now.
2. **It takes the new words at the head of the next turn,** as the Ring and the Helm do
   ([R-153](rulings/R-153-two-second-wind-items-shrug-off-a-killing-blow-and-four-say-the-30-percent.md)). Impact:
   Aldric's pack reads the new words from the next turn; the Stone works as before.

*Assessment:* option 2: the words a player reads match what the Stone does, at the cost of one more effect in the list
of those every copy takes from its row.

*Unlocks:* R-191's open point.

*Touches:* [R-153](rulings/R-153-two-second-wind-items-shrug-off-a-killing-blow-and-four-say-the-30-percent.md) (every
copy of the Ring and the Helm takes its row's words) and
[R-191](rulings/R-191-the-philosophers-stones-text-says-the-skeletal-companies-are-left-out.md) (the Stone's words).
