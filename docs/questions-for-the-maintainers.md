# The questions waiting for the maintainers

These are the questions about the game's rules that wait for a maintainer's answer. Each one names what its answer
unlocks. None waits today.

**To answer on the GitHub website:** open this file, click the pencil icon, and write your answer on a new line under
the question (for example "2026-11-20: (1)"). Then click **Commit changes**.

## How a question is written and kept

- **Written** as a design fork: numbered options, each with its impact on play, then an agent's assessment, and a
  short example from inside the game, with made-up names ([CLAUDE.md](../CLAUDE.md#rules), "Design forks go to the
  maintainers"). Either maintainer answers.
- **Kept here** with what its answer unlocks, so that the questions are answered together, in one sitting
  ([the decision](decisions/README.md#the-decisions-on-how-the-work-runs), "Questions stored, asked in one sitting").
- **Checked against the rulings:** each question ends with a line *Touches:*, the rulings it was checked against
  in [the rulings' index](rulings/README.md), by id, or "none". A static test checks the line
  (`tests/static/each-open-question-names-the-rulings-it-was-checked-against.test.ts`).
- **Numbered** in one series. A number is never reused.
- **Answered:** an answer becomes a ruling at once. The next pull request adds the ruling, with the status "Decided,
  not built", and takes the question out of this file ([adding a ruling](rulings/README.md#adding-a-ruling)). Building
  it is a row of [the backlog](backlog/README.md), and its own pull request.

Also open: the one point each ruling marked "(open question)" in [the rulings' index](rulings/README.md) leaves, in its
"Open" line. For example, [R-082](rulings/R-082-run-them-down.md) leaves open whether +15% is the right figure.

