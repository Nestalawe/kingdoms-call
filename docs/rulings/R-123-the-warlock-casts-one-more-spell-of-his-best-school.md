# R-123: The Warlock casts one more spell of his best school each turn, and the order form offers it

- **Decided:** 2026-10-31, Toby
- **Status:** Confirmed
- **Source:** Plan question 1, built in PR #369
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts), [`spells-each-school-allows-a-turn-and-a-fight`](../../tests/unit/spells-each-school-allows-a-turn-and-a-fight.test.ts), [`cast-practice-projection`](../../tests/cast-practice-projection.test.js)

A hero who holds the Warlock minor title may cast one more action spell a turn in his best school: the school he has
trained highest (each school tied for it counts). The turn always allowed it, and the rulebook says so; the order form
now offers it too. Example: Sir Aldric holds the Warlock title, and his best school is Elemental, at level 4. He may
cast 4 Elemental spells a turn, and the order form offers the fourth instead of greying it out. One rule decides it for
the turn, the bots and the order form.

The question was: the rulebook and the turn let the Warlock cast one more spell of his best school, but the order form
offered one fewer and greyed out the last. Option 1: "the form offers the fourth, as the rulebook and the turn do".

In Toby's words: "(1)"
