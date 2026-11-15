# A mutation session: faults made on purpose, and the tests they leave

Agents write most of the tests, so the tests themselves need measuring: "if the code were wrong, would we notice?". A
mutation session answers it. An agent writes realistic faults in `src/` (mutants), a script scores which ones the
checks catch, and each real survivor gets a test. Sessions run after each big series of steps, once over each large
tranche (its changed lines, before the note), and about monthly. **Never in CI.** How the scorer works (its stages,
its verdicts, `--resume`, its times):
[the toolchain](../architecture/the-toolchain-the-checks-and-the-harness.md) ("The mutant scorer").

**One session plays one role:** the **mutator** writes faults and no tests; the **builder** writes tests for the real
survivors and no faults. If the person doesn't say which, ask. Never both in one session.

## The mutator: writing faults

1. **Start from a clean tree** on the commit to score (normally `main`): the scorer scores `HEAD` and refuses
   uncommitted changes.
2. **Read** `CLAUDE.md`, [docs/traps.md](../traps.md), the [rulings](../rulings/README.md) for the area, and the
   area's code in `src/engine/` (and `src/views/` for what a realm sees and the words of its report). The person names
   the area; if not, ask.
3. **Write about 20 mutants**, one fault each, as patches of files under `src/` only, in a folder git never commits
   (outside the repository, or ignored in it): **the patches show where the tests are weak, and the repository is
   public.** Each patch starts with an `Area:` line, an `Imitates:` line (the real bug it imitates: a trap, a ruling
   broken, a past regression, a likely slip) and a line on why a player would notice. Aim for the faults this project
   gets:
   - a rule written in two places, changed in only one;
   - a visibility check missing on one path (a line reaching the wrong realm; Invisibility forgotten);
   - a boundary off by one (a roll equal to the chance; a cap of 3 read as 4);
   - the wrong side's value (the attacker's for the defender's, its own terrain for the enemy's);
   - a table entry missing for one unit, order or effect;
   - a version bump forgotten (the save's version);
   - an iteration order that changes a random draw;
   - a past regression rewritten against today's code.

   Avoid faults that crash at once (anything catches those) and faults that change nothing (equivalent).
4. **Score them:** `npm run mutants -- <folder>`. A broken patch is the mutator's mistake: fix it and score it again
   with `--only <patch>`. A run that stops carries on with `--resume`.
5. **Report to a maintainer:** caught, survived and broken, and which were caught by the balance matrix alone (a weaker catch
   than a red test: a real pull request would read "play changed" and could be waved through with a new baseline).
   **Read the counts from the scorer's table and `results.json`, never from prose.** For each survivor, a view: a
   **real gap** (what changed, and why no test noticed) or **equivalent** (why nothing a player could see changed).
   Write no tests.

## The builder: catching the real survivors

1. Read the session's folder: the survivors a maintainer marked as real gaps.
2. For each, write a test at the lowest level that catches it ([tests/README.md](../../tests/README.md#the-levels)).
   **Its fail-first proof is the mutant:** commit the test, then `npm run mutants -- <folder> --only <patch>` must score
   it **caught**, by the tests. Quote it.
3. **No change to the engine.** If a survivor shows a real bug in today's code (the "mutant" is how the code already
   behaves), stop and tell a maintainer: it becomes its own fix.
4. **The pull request:** `[P1-21] Tests for <area> from the mutation session of <date>`, label `refactor-only` (the
   tests pass on `main`). One line a gap, in neutral words ("the warnings now have a test for heroes under
   Invisibility"); **never the patches themselves**. Staging: not needed. For a tranche's session, the tests go into
   one tests-only row on top of the stack, and a survivor that is a slip in a row's own change holds that row until it
   is fixed.
