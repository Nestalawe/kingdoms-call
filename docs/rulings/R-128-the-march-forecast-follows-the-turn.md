# R-128: The march forecast follows the turn

- **Decided:** 2026-11-05, Toby
- **Status:** Confirmed
- **Source:** Plan question 44, built from PR #463 on
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts)

The order form works out where each hero will stand in every later phase, and what his marches will map, from the
orders it holds. It follows the turn, not the order as written:
1. **A Move and a Forced March read their target alike**, as the turn reads it: a compass direction is a step that
   way, and a province is named by `prov:<id>` or by its bare number. Example: Sir Aldric is given a Forced March
   north-west; his later orders are built in the province north-west of where he stood, where the turn takes him.
2. **A march the turn refuses leaves him where he is**: at a neutral realm's border, with ships over land, with too
   little lift to put to sea, or past his pace. Example: Sir Aldric leads longships and spearmen in Wendmeadow and is
   ordered east over land; his later orders, and his Search Lair, stay in Wendmeadow.
3. **A far province is one step toward it**, as the turn marches.
4. **Every cloak counts in the Explore note**, whatever its name (a Travelworn Drape is a Traveller's Cloak), and so
   does Naval 6's charting of the coast beside a sea he sails into.

Where the form doesn't yet follow the turn, the parity test pins the difference (question 44); each part's PR turns
its pin into an agreement case.

The question was: the forecast kept a hero marching where the turn stops him, read a Forced March only by a province's
number, and knew a Traveller's Cloak only by its name. Option 1: "the forecast follows the turn". Option 2 (not
taken): the forecast keeps him marching and only warns, and the turn counts only cloaks of that name.

In Toby's words: "(1)"
