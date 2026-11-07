# R-134: The gold ledger and the practice note follow the turn

- **Decided:** 2026-11-05, Toby
- **Status:** Confirmed
- **Source:** Plan question 43, built in PR #476 (the practice note) and the ledger's PR stacked on it (P1-11e29)
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts)

The note under a Practice Skill order quotes the chance the turn rolls when a hero practises alone, by the turn's own
rule: the base chance for the level he holds, plus his realm's practice discoveries, and ×1.5 for a Human of a Human
realm (the note says so). At level 5 or more the note says no roll is made: practice raises a skill only to level 5.
The treasury ledger counts gold as the turn spends it: the Host-Leader's 1g off each company in his column where the
report names him (his titles shown, once the titles are public), a Druid 6 recruiter's half price for a beast, half
wages for a beast in the column of a Druid 6 leader or of a realm whose Druidic Wonder stands, and the upkeep
discoveries under their shared cap. Before the titles are public the report doesn't name the Host-Leader, so the ledger
can't count his saving: a forecast limit, not a disagreement.

Example: Lady Wren, a Human of a Human realm, practises Melee 2. The note says 22%, the chance the turn rolls (15%
×1.5), and that she learns half as fast again. At Melee 5 it says no roll is made. Her comrade, a Druid 6 hero, raises
Great Bears: the ledger shows 2g to raise them and 2g a turn in wages, as the turn charges, not 4g and 4g.

The turn is not changed. The question was: the note said 15% where the turn rolls 22%, and showed a chance at level 5
where the turn makes no roll; the ledger left out the Host-Leader, Druid 6 and the discoveries' cap. Option 1: "the
ledger and the note follow the turn". Option 2 (not taken): the turn follows them. The practice note, the Host-Leader and Druid 6
are built; the upkeep discoveries' cap and Granaries are still pinned in the test until their row follows.

In Toby's words: "(1)"
