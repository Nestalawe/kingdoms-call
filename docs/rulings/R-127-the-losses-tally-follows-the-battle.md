# R-127: The losses tally follows the battle

- **Decided:** 2026-11-05, Toby
- **Status:** Confirmed
- **Source:** Plan question 37, built in PR #446
- **Enforced by:** [`a-battles-losses-tally-is-written-from-the-facts-of-its-lines`](../../tests/unit/a-battles-losses-tally-is-written-from-the-facts-of-its-lines.test.ts)

The "⚰ Losses" line under a battle sums up the casualty lines above it, as the battle and the game's statistics count
them:
1. **A company that rises again is not lost.** Example: Aldric's Cave Trolls are cut down, then rise again by their
   Regenerating Hide and fight on; Aldric's tally doesn't count them.
2. **Each loss counts for the side that suffered it**, whichever casualty list its line comes after, and also when the
   line names the company by its name alone. Example: Aldric's trapped Grey Legion are cut down after Lady Wren's list
   ("— the Grey Legion are cut down with no escape!"); the loss is Aldric's, not hers.

The question was: the tally counted risen trolls as lost, and gave a company named by its name alone to the side whose
list it followed. Option 1: "the tally follows the battle". Option 2 (not taken): the tally stays and the rulebook
explains it.

In Toby's words: "(1)"
