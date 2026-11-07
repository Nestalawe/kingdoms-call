# R-133: The Blood Offering's rows follow the turn

- **Decided:** 2026-11-05, Toby
- **Status:** Confirmed
- **Source:** Plan question 39, built in PR #(this)
- **Enforced by:** [`the-player-portals-copies-agree-with-the-engine`](../../tests/unit/the-player-portals-copies-agree-with-the-engine.test.ts), [`the-player-portal-reaches-the-engine-only-through-src-shared`](../../tests/static/the-player-portal-reaches-the-engine-only-through-src-shared.test.ts)

The Blood Offering's form lets a player mark only the companies the rite may take. A company bound by the Wild Hunt,
summoned or charmed for a while, or risen from the dead is still shown in the list, but locked on "Keep". The hint
under the rows names the companies the turn will give and raise, by the turn's own rule: with nothing marked, or a side
left empty, the turn ignores the marks, gives the first company it may take and raises the next; with fewer than two
it may take, it makes no offering. The Move note's column in later phases drops the company the turn gives.

Example: Lady Wren's mage leads Ash Spears, Oak Spears and a pack of Wild Hunt wolves. The wolves' row is locked. If
she marks only the Oak Spears to raise, the hint warns that the turn will give the Ash Spears to raise the Oak Spears.

The turn is not changed. The question was: the form offered every company and showed "✓" for marks the turn never
follows. Option 1: "the form follows the turn". Option 2 (not taken): the turn follows the form (a side empty, or a
mark it can't take, gives and raises nothing).

In Toby's words: "(1)"
