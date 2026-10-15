<!--
Title: "Batch YYYY-MM-DD: <a few items>" for Toby's batches, "[P0-NN] <step>" for plan steps.
Write the top half for Toby, in game terms. Engineering detail goes in the lower sections.
Public repo: no live-game names, pasted report or dispatch text, account ids, emails or secrets, and
no description of security weaknesses (keep security fixes neutrally worded). See CLAUDE.md.
Delete these comments, and any section that doesn't apply (write "None" rather than leaving it blank).
-->

## What changed

<!-- One short paragraph per item, in game terms: what a player or the GM will notice.
For a batch: one commit per item, message "Item N: <short title>", in the same order as here. -->

**Item 1: …**

## Rulings

<!-- Needed: the question, numbered options with a recommendation, and a short in-game example.
Recorded: the new docs/rulings/R-NNN-name.md file(s) in this PR, the ruling in Toby's words, and the test that enforces it. -->

None.

## Staging

<!-- One line: "Needed / not needed, because …" (docs/staging.md, "When a change needs staging").
If needed: a numbered checklist Toby can follow without reading code: which game, which screen, what to do,
what he should see. If not: which tests or proofs below cover the risks staging would have closed. -->

Not needed, because …

---

## Tests

<!-- For each new or changed test: its level (0 static, 1 unit, 1d database unit, 2 scenario,
3 simulation, 4 page), why a lower level wouldn't do, and the proof that it fails without this
change (on main, or against a copy via KC_SITE). Or say "refactor-only": new tests pass before and after. -->

| Test | Level | Why not lower | Fails without this change? |
|---|---|---|---|
| | | | |

`npm test`: <!-- paste the summary line, e.g. "16 passed · 0 failed · 95s", and the seed -->

## Database

<!-- None, or: the exact SQL; its rollback SQL; and, in plain words, what Toby is approving.
A PR changes the database OR the site, never both (supabase/README.md, "Database and site changes go
separately"). Answer whichever applies:
- Migration PR: does the live site work with it applied? (No access-rule test of what the game needs was
  loosened or removed.)
- Site PR using a new table or column: does it cope while that's missing? Name the test that hides it. -->

None.

## Checklist

- [ ] Needs Theo? Say so in the first line of the description if this changes who can see or change
      data, is a ✓ plan step or a unit step. (Changes to `.github/**`, `supabase/**` or `site/vendor/**`
      get a warning comment anyway; talk them through with Theo before merging.)
- [ ] Updates STATUS? (Plan steps only; batches don't. See "Never" 6 in `CLAUDE.md`.)
- [ ] Rule changes are mirrored everywhere the rule is restated (engine, player portal, rulebooks).
- [ ] If `kingdoms-call-data.js` changed: both its stamp lines and both portals' minimums are bumped.
- [ ] `docs/ARCHITECTURE.md` / `docs/traps.md` / `CLAUDE.md` updated, if this makes them wrong.
