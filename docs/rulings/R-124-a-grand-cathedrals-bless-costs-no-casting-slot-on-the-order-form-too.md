# R-124: A Grand Cathedral's Bless Province costs no casting slot, on the order form too

- **Decided:** 2026-11-02, Toby
- **Status:** Confirmed
- **Source:** Plan question 28 (a), built in PR #370
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts), [`spells-each-school-allows-a-turn-and-a-fight`](../../tests/unit/spells-each-school-allows-a-turn-and-a-fight.test.ts), [`what-each-realm-may-see-of-the-world`](../../tests/unit/what-each-realm-may-see-of-the-world.test.ts), [`cast-practice-projection`](../../tests/cast-practice-projection.test.js)

While a Divine realm's Grand Cathedral stands, Bless Province costs its heroes no casting slot: it is never counted
among their White spells for the turn, and the limit never blocks it. The turn always worked this way, and the Wonder's
text says so; the order form now counts it the same way. The realm's report says whether its Cathedral stands, and
only that realm's report. Example: Brother Anselm (White Magic 1, one White spell a turn) casts Bless Province in
Spring; in Summer the order form still offers his White spells, and after a Holy Symbol it still offers Bless. One
rule decides it for the turn and the order form.

The question was: after a free Bless, the order form greyed out the hero's White spells ("limit reached 1/1"), though
the turn would let him cast one. Option 1: "each forecast follows the turn".

In Toby's words: "(1)"
