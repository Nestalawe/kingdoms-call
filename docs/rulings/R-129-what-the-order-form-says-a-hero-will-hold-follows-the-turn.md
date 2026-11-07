# R-129: What the order form says a hero will hold follows the turn

- **Decided:** 2026-11-05, Toby
- **Status:** Confirmed
- **Source:** Plan question 42, built from PR #469 on
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts)

The order form works out what each hero will carry and lead, and what a province's garrison will hold, in every later
phase, from the orders it holds. It follows the turn, not the order as written:
1. **A granted Mithril suit stays on its wearer.** It is forged to him: a Send Item with "all items" hands over
   everything else, and the Send Item field lists the suit greyed, so it can't be ticked. Example: Sir Aldric, a Dwarf,
   sends "all items" to Dame Isolde; in the next season his form still shows the suit on him, and hers shows only the
   rest.
2. **A comrade marching in gets his item at once**, and a chain of hand-overs in one season goes in the turn's order.
3. **A beast past a leader's beast command goes where the turn sends it** (the garrison, or back), a hired band of
   garrison troops musters into the garrison, and companies taken up from the garrison join in the turn's order.
4. **Risen dead handed to a comrade of a realm that is not Undead go to their graves.**

All four parts are agreement cases of the parity test (part 1 since P1-11e18, parts 3 and 4 since P1-11e19, the
Move note's column too, part 2 since P1-11e20: a season's items are handed over in the turn's order of its heroes).
What the report doesn't show stays a forecast limit: a hero hired, charmed or raised this turn (his pack and his levels
are hidden, so his beast command and his place in the season's order too), a skill that rises during the turn, a
pursuit under way or a march the turn cancels (they change the season's order), and a province taken this turn (the
form musters by the realm's ground as the turn begins).

The question was: the form moved a Mithril suit with "all items", sent an item to a comrade marching in by courier,
replayed hand-overs in its heroes' order, put beasts past a leader's command in his column, added companies taken up
in the wrong order, and handed risen dead to any comrade. Option 1: "the form follows the turn". Option 2 (not
taken): the turn follows the form.

In Toby's words: "(1)"
