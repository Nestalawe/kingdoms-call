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

## 159. Do a province's guards' own Manticores and Shark Shoals hunt a beaten hero?

Found on 2026-11-27.

[R-166](rulings/R-166-the-rout-rules-work-against-guards-as-between-heroes.md) has four rout rules work against a
province's guards as between heroes. Between heroes, either side's winner hunts. It doesn't say whether the guards, when
they win, hunt too. The Manticore guards of the Greywater Ford beat Sir Aldric's host: do his beaten companies die at
the beaten chance plus 15%?

1. **Yes, either winner hunts, as between heroes.** Impact: how the game works now (P1-23as); a beaten host loses a
   few more companies against Manticore or Shark Shoal guards.
2. **No, only a hero's Manticores and Shark Shoals hunt.** Impact: a change in play; a beaten host loses only the plain
   chance against those guards (their Warg Riders still run it down, by R-166).

*Assessment:* option 1: one rule for both sides, as between heroes, and nothing more to build.

*Unlocks:* R-166's open point settled.

*Touches:* [R-166](rulings/R-166-the-rout-rules-work-against-guards-as-between-heroes.md) (the rout rules against
guards) and [R-082](rulings/R-082-run-them-down.md) (Run Them Down's +15%).

## 160. Does a realm that already holds Messenger Birds keep it?

Found on 2026-11-27.

[R-140](rulings/R-140-messenger-birds-is-retired.md) retires Messenger Birds: no realm is offered it. It doesn't say
what becomes of a realm that found it before. Lady Wren's realm made it on turn 6: is it still in her list of
discoveries after the change?

1. **It keeps it, as built (P1-23k).** Impact: nothing in play changes; the line stays in its records, and it does
   nothing, as before.
2. **It loses it, as the retired `sd34` did** ([R-013](rulings/R-013-mounted-couriers-removed.md); the save's upgrade,
   `retireDiscoveries`, strikes it and the new turn says how many went). Impact: nothing in play changes either; the
   line goes from the realm's records, and the turn's report says a retired discovery was removed.

*Assessment:* option 1: a realm keeps what it found, and nothing more to build. Option 2 tidies the records, as `sd34`
was, for one more small change.

*Unlocks:* R-140's open point settled.

*Touches:* [R-140](rulings/R-140-messenger-birds-is-retired.md) (Messenger Birds retired) and
[R-013](rulings/R-013-mounted-couriers-removed.md) (the retirement of `sd34`).

## 161. Does a game made before the guardians' fix keep the table's HP on its first turn?

Found on 2026-11-27.

[R-145](rulings/R-145-new-games-keep-the-guardian-tables-hp-and-running-games-keep-theirs.md) gives a new game's
guardians the table's HP, and a running game keeps its guardians as they are. It doesn't say what becomes of a game
made before the fix whose first turn has not yet run. Its guardians stand at the table's HP until that turn: the
Dracolich of Ashfall Barrow at 54. Does it keep 54 when the first turn runs after the fix?

1. **It is cut to 49 on its first turn, as built (P1-23l).** Impact: that game plays as it would have before the fix;
   only games made after the fix keep the table's HP.
2. **It keeps 54.** Impact: every game whose first turn runs after the fix keeps the table's HP; the cut never runs
   again on a real save, so it could be retired. One more small change to build.

*Assessment:* option 2 fits the ruling's aim (guardians as tough as the table says) and its words ("keep their
guardians as they are"); option 1 is the smaller change. It matters only for a game made but not yet played when the
fix goes live: deploying when no game waits on its first turn makes both the same.

*Unlocks:* R-145's open point settled.

*Touches:* [R-145](rulings/R-145-new-games-keep-the-guardian-tables-hp-and-running-games-keep-theirs.md) (new games'
guardians at the table's HP) and [R-072](rulings/R-072-guardian-strength.md) (the guardian table's HP).

## 162. Does a Curse on Tactical take away Tactical 6's tier-up?

Found on 2026-11-27.

[R-162](rulings/R-162-battle-magic-takes-effect-at-one-moment-in-both-battles.md) has a Curse on Tactical halve the
Tactical a battle counts, in both kinds of battle. A commander at Tactical 6 or more also has the chance that each of
his units fights a quality tier higher, decided as the battle is set up, before any spell. Example: Lady Wren, Tactical
7, is cursed by the warlord Morvane: her lines fight at Tactical 3, but her units still roll for their tier-up as at
Tactical 7. Should the Curse take the tier-up away too?

1. **No: the tier-up stays, as built (P1-23an).** Impact: a cursed Tactical 6+ commander keeps one perk of his level;
   the Curse weakens his lines' bonus only.
2. **Yes: a Curse that leaves him below 6 takes the tier-up.** Impact: the Curse hits a great tactician harder; the
   tier-up has to be decided after both sides' spells, so the battle's dice move.

*Assessment:* option 2 follows the ruling's words ("before the skills … it changes are counted") most closely; option
1 is how the game plays now and the smaller change. It matters only for a Curse on a Tactical 6+ commander.

*Unlocks:* R-162's open point settled.

*Touches:* [R-162](rulings/R-162-battle-magic-takes-effect-at-one-moment-in-both-battles.md) (battle magic at one
moment) and [R-126](rulings/R-126-battle-magic-follows-one-rule-in-every-battle.md) (battle magic's one rule).

## 163. Do ships left ashore keep a battle's cuts when the battle resumes the same turn?

Found on 2026-11-27.

When a beaten force's ships can't sail, they stay on their own shore and hold the province
([R-067](rulings/R-067-ships-ashore-hold-the-ground.md)), and the battle stalls: it resumes against them in a later phase of the same turn. They keep the arrows' and spells'
cuts from the first fight until the new turn wipes them (#841). The Grey Cog of Hollin, shot down to half strength at
Saltmarsh in phase 1, fights the phase-3 resumption at half strength. Is the resumption the same battle, or a new one?

1. **The same battle: the ships keep their cuts.** Impact: as built; a stalled fight goes on where it stopped, and the
   ships recover at the new turn.
2. **A new battle: the ships recover first.** Impact: the ships fight each resumption at full strength; a small change
   where the hulls join the garrison (`_navalLeaveBehind`), with its own case.

*Assessment:* option 1 matches how a stalled battle reads elsewhere (it "grinds on" each phase until it breaks), and
it needs no change; option 2 treats every phase's fight alike. Few games meet it: ships stranded on their own shore
after a lost battle.

*Unlocks:* the last path where a battle's cuts outlive its end settled.

*Touches:* [R-067](rulings/R-067-ships-ashore-hold-the-ground.md) (ships left ashore contest the province).
