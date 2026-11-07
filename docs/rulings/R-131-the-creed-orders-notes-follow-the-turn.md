# R-131: The creed orders' notes follow the turn

- **Decided:** 2026-11-05, Toby
- **Status:** Confirmed
- **Source:** Plan question 36, built in PR #473 (part a)
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts)

Each creed order's note on the order form says what the turn will do with the order. The turn is the rule.

Part (a), Consecrate's limit: the form counts the consecrations the king may hold as the turn does, from the report:
his trained White, and one more with Holy Sites from White 3. A Curse on him, or an item that raises his White, changes
neither. Example: King Aldric (White 3) holds three consecrated provinces and his realm has Holy Sites; his form lets
him consecrate a fourth, as the turn does.

Parts (b) and (c) are built in a later row and pinned until then: Call to Arms names the company the turn musters, and
Harvest the Field's note names the grave the turn raises (the most experienced of the dead).

The question was: three notes said otherwise than the turn. Option 1: "each note follows the turn". Option 2 (not
taken): the turn follows the notes.

In Toby's words: "(1)"
