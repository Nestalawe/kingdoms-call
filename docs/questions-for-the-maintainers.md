# The questions waiting for the maintainers

These are the questions about the game's rules that wait for a maintainer's answer. Each one names what its answer
unlocks.

**To answer on the GitHub website:** open this file, click the pencil icon, and write your answer on a new line under
the question (for example "2026-11-20: (1)"). Then click **Commit changes**.

## How a question is written and kept

- **Written** as a design fork ([CLAUDE.md](../CLAUDE.md#rules), "Design forks go to the maintainers"), in this
  shape, about 700 bytes a question. Either maintainer answers.

  ```markdown
  ## N. The question, in game terms?

  Found on <date> (<row or PR>). *Unlocks:* <what the answer lets us build>.

  1. **<Option> (as built).** <its impact on play, one line>
  2. **<Option>.** <its impact on play, one line>

  *Assessment:* (n), <one reason>. *Example:* <one line from inside the game, made-up names>.

  *Touches:* <R-NNN, by id, or "none">
  ```

  The option the game follows today says "(as built)". Detail that doesn't fit stays in the pull request that asks
  the question, or in the ruling's Open line, and the question links there.
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

## 178. What hit points does a hero have when no maximum is written on him?

Found on 2026-11-28 (B-17m, #876). *Unlocks:* one named default for the engine's 13 places and the bots' 19, and a row that stops the others differing.

1. **20 (as built in the bots and 13 engine places).** A hero with no written maximum counts as 20; a new hero starts at 15 (18 if Orcish), so a missing maximum reads a hardier hero than a new one.
2. **15 (`HPGAIN_START`, which a grave record also falls back to).** One default for all; the bots' plans and the engine's rest and heal read a hero a fifth lighter where a maximum is missing.

*Assessment:* (2), a hero that has no maximum is a hero the game has not yet given one, and that is a new hero. *Example:* a hired hero of the made-up Eastmark realm arrives without a maximum: the portal shows 14, a rest heals him as if he had 20.

*Touches:* none
