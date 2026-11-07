# R-131: The creed orders' notes follow the turn

- **Decided:** 2026-11-05, Toby
- **Status:** Confirmed
- **Source:** Plan question 36, built in PR #473 (part a) and PR #PRNUM (parts b and c)
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts), [`the-player-portal-reaches-the-engine-only-through-src-shared`](../../tests/static/the-player-portal-reaches-the-engine-only-through-src-shared.test.ts)

Each creed order's note on the order form says what the turn will do with the order. The turn is the rule.

Part (a), Consecrate's limit: the form counts the consecrations the king may hold as the turn does, from the report:
his trained White, and one more with Holy Sites from White 3. A Curse on him, or an item that raises his White, changes
neither. Example: King Aldric (White 3) holds three consecrated provinces and his realm has Holy Sites; his form lets
him consecrate a fourth, as the turn does.

Part (b), Call to Arms: each province the form offers names the company the turn musters there: the first garrison
of the province's own companies, else its folk's garrison (Elves an Elven Garrison), else a Human Garrison. Example:
Lady Wren calls the folk of Wendmeadow (Free Lances, then a Human Garrison) to arms; the form reads "raises a Green
Human Garrison", as the turn musters.

Part (c), Harvest the Field: the note says the turn raises the most experienced grave, a grade higher while the realm
holds its Wonder. Example: graves of Green and Veteran spearmen lie in the field; the Veterans rise.

The question was: three notes said otherwise than the turn. Option 1: "each note follows the turn". Option 2 (not
taken): the turn follows the notes.

In Toby's words: "(1)"
