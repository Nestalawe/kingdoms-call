# R-135: The hero card's figures follow the turn

- **Decided:** 2026-11-05, Toby
- **Status:** Confirmed
- **Source:** Plan question 45, built in the pull requests of P1-11e31 (the sea note), stacked on PR #477, and
  P1-11e33 (the magic level), stacked on PR #479, and P1-11e34 (the upkeep), stacked on PR #480
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts)

The figures on a hero's card, and the order form's, say what the turn will do. The army card's sea note asks the
turn's own sea lift: a column's hulls (each carries double under a trained Naval of 8 or more) and its humanoid flyers
pool their lift, so the note says the column can put to sea whenever the turn lets it sail, and names how many units
would be left ashore when it can't. The Move note asks the same rule.

The army card's upkeep is the wages the turn charges his column: a Creature or Monster he leads pays half its wage
(rounded down, at least 1g) when he has trained Druid to 6 or his realm's Druidic Wonder stands, as the turn's Early
Winter asks it. A summoned company and a beast of the Wild Hunt still draw none, and a skeleton 1g.

The order form's level of a magic school asks the turn's own rule: his trained level counts to 5 (the levels past it
buy mastery, not casting), then his items and a Crown of Command's aura, as the report counts them, stack to 9, and two
items of one name count once. So the spells the form offers, their casting limit and the level they show are the
turn's.

Example: Sir Bram leads Eagle Riders, a Galleon Fleet and two Knights. The hull carries one Knight and the Eagle Riders
lift the other, so the turn lets the column sail. His card said "needs 2 hulls, has 1"; it now says "needs 2 hulls, has
1, and the flyers carry the rest — can put to sea".

Example: Mother Ysolde, Psychic 2, carries two Dreamstones. The turn counts one (Psychic 3, two casts a season); the
form counted both and offered her a third cast that the turn refused. Brother Aldo has trained White to 7: he casts at
White 5, and the form now says "Lv5", not "Lv7".

Example: Lady Wren, Druid 6, leads two Thunderbirds. The turn charges her realm 4g for them each winter; her card said
"Upkeep 8g/turn" and now says "4g/turn".

The turn is not changed. The question was: the card left out the flyers' lift (the sea note), Druid 8's and Necromancy
6's lifts, the commander's items, the discoveries and titles (its strength), Druid 6's half wage (its upkeep), and the
cap on a trained magic level and two items of one name (its magic level). Option 1: "the card and the form follow the
turn". Option 2 (not taken): the turn follows them. The sea note, the magic level and the upkeep are built; the
strength follows in its own row.

In Toby's words: "(1)"
