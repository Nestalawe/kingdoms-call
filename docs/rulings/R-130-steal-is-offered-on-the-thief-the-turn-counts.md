# R-130: Steal is offered on the Thief the turn counts

- **Decided:** 2026-11-05, Toby
- **Status:** Confirmed
- **Source:** Plan question 40, built in PR #472
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts)

The order form offers Steal to a hero whose Thief, as the turn counts it, is 1 or more: his trained level plus what his
items, an aura or a Curse add or take. This is the level the Steal order checks when it resolves, and the level its
target field and its chance already quote. Example: Sir Aldric has never trained as a thief, but wears the Gloves of the
Nightcrawler (Thief +2); his form offers Steal, and the turn lets him steal at Thief 2.

Research is not changed: it still needs a trained Sage of 1, as the turn checks it. A hero whose levels the form can't
see (hired or charmed this turn) is still offered both, and the turn judges.

The question was: the form offered Steal only on a trained Thief of 1, while the turn counts the items' too. Option 1:
"the form follows the turn". Option 2 (not taken): the turn follows the form (Steal needs a trained Thief of 1).

In Toby's words: "(1)"
