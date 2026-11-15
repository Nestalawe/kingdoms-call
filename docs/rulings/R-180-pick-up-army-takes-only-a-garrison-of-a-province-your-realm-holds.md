# R-180: Pick Up Army takes only a garrison of a province your realm holds

- **Decided:** 2026-11-15, a maintainer
- **Status:** Decided, not built
- **Source:** Question 48: whose garrison may Pick Up Army take: only one in a province the hero's realm holds, or any garrison where he stands? Answer: option 1, only a garrison of a province his own realm holds.
- **Enforced by:** no test yet

A hero's Pick Up Army takes the unled (garrison) companies of the province he stands in only when his own realm holds
it, as Leave/Transfer Army lets him garrison troops only in a province his realm holds. The order form lists only
those garrisons, and the rulebook says so. Example: Sir Aldric walks alone into a province Lord Thorn's realm holds,
where three of its companies stand on garrison, and orders Pick Up Army: the turn refuses it, and the form doesn't
offer those companies. Today the turn hands them over, the form lists the garrison of any province where he will
stand, and the rulebook says only "the province the character currently stands in".

**Note:** Decided, not yet built. Left: the turn's check of the province's owner (`resolvePickUpArmyOrder` has none;
Leave has one), then the form and the rulebook, each a unit case first, with a balance report (the bots made 11 Pick
Ups off their own ground in 120 games, all on an empty garrison).

The question was: Sir Aldric orders Pick Up Army where another realm's companies stand on garrison. Option 1: "Pick Up
takes only a garrison of a province his own realm holds; the form lists only those, and the rulebook says so".

In the maintainer's words: "(1)"
