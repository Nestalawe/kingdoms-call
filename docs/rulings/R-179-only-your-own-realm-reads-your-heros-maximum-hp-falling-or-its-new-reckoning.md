# R-179: Only your own realm reads your hero's maximum HP falling outside a fight, or its one-time new reckoning

- **Decided:** 2026-11-02, a maintainer
- **Status:** Decided, not built
- **Source:** Question 30: when a hero's maximum HP falls outside a fight, or an old save's one-time note gives his new maximum HP, does every realm with eyes there read it, or only his own? Answer: option 1, his own realm alone reads both, as a rise.
- **Enforced by:** no test yet

When a hero's maximum HP falls outside a fight (an item given away, for example), the line "<hero>'s maximum HP
falls by N to M" is told to his own realm alone, as a rise is ([R-117](R-117-max-hp-rises-outside-a-fight-are-private.md)).
The same holds for the one-time note "A new reckoning of vigour: <hero>'s maximum HP is now …", written once for each
hero when a game saved before maximum HP was earned in battle is first played on. Example: Sir Aldric gives away his
Girdle of Giants in Wendmeadow, and his maximum HP falls from 22 to 18: only his own realm reads it. Today every realm
with eyes in the province reads the fall, and every realm reads the one-time note.

**Note:** Decided, not yet built. Left: the fall's line (`syncAllMaxHp`) and the one-time note (the max-HP sync in
`turn/after-the-phases-…`, on a save `migrateMaxHpV2` upgrades) get the hero's own realm as their audience, in one pull
request: a unit case first, and a whole-turn case on a save from before maximum HP was earned; a report change only.

The question was: Sir Aldric's maximum HP falls from 22 to 18 in Wendmeadow, and every rival with eyes there reads it;
in a game saved before maximum HP was earned in battle, every realm once read his new reckoning. Option 1: "his own
realm alone reads both, as a rise", as question 9's answer says, "wherever it comes from".

In the maintainer's words: "(1)"
