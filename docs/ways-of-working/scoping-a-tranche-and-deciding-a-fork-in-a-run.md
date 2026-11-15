# Scoping a tranche, and deciding a fork in a run

A tranche is found, scoped and built as [making a change](../architecture/making-a-change-the-six-kinds-and-the-plans-format.md#a-tranche-a-stack-of-pull-requests)
says: that file holds the plan's format, the rows' lines and the stack. This file adds how a scoping measures, and how
a run decides a fork instead of stopping.

## Scoping: measure before deciding

A scoping writes no code in the game's repository and opens no pull request. Its output is the tranche's plan, with
every choice its rows need made or put to Theo as numbered options with a recommendation.

1. **Start from `main` as it is**, and read it without changing the clone: `git show origin/main:<path>`, or a copy
   (`git archive origin/main | tar -x -C <folder>`, with `node_modules` linked in). Another session may be working in
   the clone, so a scoping never switches its branch or builds in it.
2. **Measure with throwaway scripts outside the repository**, given the repository's paths as arguments: the counts
   (files, functions, tables, findings), a trial of the risky part, and a trial of each row's proof at its tier
   ([the proof a row gives](a-row-of-a-stack-from-its-branch-to-its-report-and-the-proof-it-gives.md#the-proof-a-row-gives)).
   A tier 1 or 2 proof must turn red on a planted fault: show it.
3. **Quote each figure with the commit it was measured on.** The rows below change the code, so each building row
   recounts its headline figures on its own base and gives both.
4. **Sizes are bytes** (`wc -c`), never a string's length.
5. **Say what the method can't see**, each with the row or later step that covers it, or "nothing does". Example: a
   scan for the keys a saved schema doesn't know can't see a field the schema wrongly requires.
6. **Two copies of a rule that disagree** are found first. No row writes a switch, a parameter or a second path so one
   function carries both; that part stays as it is, and the question goes to Toby
   ([the decisions](../decisions/README.md#theos-decisions-on-how-the-work-runs), "An inconsistency is asked").
7. **Each row is one pull request an agent can finish in a sitting:** split rather than grow. A row of mechanical moves
   (4 to 8 files a row where they fit) can run on a faster model.

## Deciding a fork in a run, instead of stopping

A run that stops for a decision whose answer is the recommended one wastes the day. So when a row or a scoping meets a
fork, **the run takes the recommended option only if every answer below is yes**, records it, and goes on. Theo reviews
it afterwards and can undo it.

1. **The goal:** does it move the work towards [the goal](../the-goal-and-the-road.md), and keep or widen what the
   balance matrix and the tests meet? (The matrix describes a change's effect to Toby and checks refactors; an option
   that lets its games meet less fails here.)
2. **Inside the harness:** does it change only `tools/`, `tests/` or the docs, with no rule of the game, nothing a
   player sees, no saved shape, no database or access rule, nothing about security or what a realm can see?
3. **No check weakened:** does it keep every assertion, required case, test and ratchet count? The one exception: the
   check contradicts a documented contract (cite the file and line), and the new form still checks all it asks for.
4. **No luck:** does the outcome hold whatever the dice, with no retry, re-seed or chosen seed?
5. **Small and undoable:** can one commit or one small row carry it, and one pull request undo it?
6. **The premise checked:** has the option's key claim been checked against the code by a fresh read (a second agent
   given the claim and the files, not the conclusion)? A recommendation resting on a wrong premise is the risk this
   check exists for.

If the recommended option fails a test but another passes every one, take that one and say why. **If any answer is no,
stop**, and say which. Always stop for a rule of the game (it waits for Toby), anything players notice, the database or
production, security, what a realm can see, a check loosened, or an outcome resting on luck.

**Recording it:** in the row's report, a line `DECIDED BY THE RUN:` (the fork in one sentence, the options, the one
taken, the six answers in a few words, who checked the premise); in the pull request's lower half, under "Decided by
the run, for Theo to undo"; and first in the run's note to the person, with how to undo each.

**A fork no test lets the run decide** (a ratchet count that would rise, say): the rows that don't build on it go on,
each told what not to read or edit, and the note puts the fork first.
