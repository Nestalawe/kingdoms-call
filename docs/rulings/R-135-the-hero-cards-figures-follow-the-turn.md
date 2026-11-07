# R-135: The hero card's figures follow the turn

- **Decided:** 2026-11-05, Toby
- **Status:** Confirmed
- **Source:** Plan question 45, built in the pull request of P1-11e31 (the sea note), stacked on PR #477
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts)

The figures on a hero's card, and the order form's, say what the turn will do. The army card's sea note asks the
turn's own sea lift: a column's hulls (each carries double under a trained Naval of 8 or more) and its humanoid flyers
pool their lift, so the note says the column can put to sea whenever the turn lets it sail, and names how many units
would be left ashore when it can't. The Move note asks the same rule.

Example: Sir Bram leads Eagle Riders, a Galleon Fleet and two Knights. The hull carries one Knight and the Eagle Riders
lift the other, so the turn lets the column sail. His card said "needs 2 hulls, has 1"; it now says "needs 2 hulls, has
1, and the flyers carry the rest — can put to sea".

The turn is not changed. The question was: the card left out the flyers' lift (the sea note), Druid 8's and Necromancy
6's lifts, the commander's items, the discoveries and titles (its strength), Druid 6's half wage (its upkeep), and the
cap on a trained magic level and two items of one name (its magic level). Option 1: "the card and the form follow the
turn". Option 2 (not taken): the turn follows them. The sea note is built; the strength, the upkeep and the magic level
follow in their own rows.

In Toby's words: "(1)"
