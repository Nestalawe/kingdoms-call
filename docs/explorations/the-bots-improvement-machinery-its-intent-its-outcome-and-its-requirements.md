# The bots' improvement machinery: its intent, its outcome and its requirements

**One repeatable way to find what the bots do badly, change them, and prove that the change made them better.** It
runs whenever the rules change, and above all each time an alignment changes. This file holds the requirements. The
delivery plan (which parts come first, their backlog rows, their sizes) is still to come, and its backlog row is
B-17.

## 1. The proposal

**Why it matters.** The maintainers judge an alignment's balance from bot games. If the bots play an alignment badly,
that alignment looks weak, and the verdict is wrong. The new alignment abilities (B-09) change many rules across seven
alignments, so the risk grows with them.

**The outcome, once the machinery is in place:**

1. The bots use every ability in the game, new or old, and the normal set of games shows how often and how well.
2. A bot change comes with a verdict: better, no different, or worse, on the same seeds as the bot it replaces.
3. When a rule changes, the bots' use of it changes in the same piece of work, with no second copy of the rule to
   forget.
4. A bot knows only what a player in its seat would know
   ([R-043](../rulings/R-043-bots-know-what-a-player-knows.md)), and a test holds it to that.
5. A maintainer can trust a balance verdict from bot games, because the bots are known to be competent with every
   alignment.

### What "a better bot" means

A bot is better when it is more competent with every alignment first; strength comes last. When two aims pull against
each other, the higher one wins.

| Priority | Aim | In the game | Measured by |
|---|---|---|---|
| 1 | Competent with every alignment | A Druid realm uses its Druids, a Divine realm blesses its land: each ability used where it helps | BOT-S, BOT-L4 |
| 2 | Plays its alignment's flavour | An Evil king wars, bargains and chooses his doctrine as the alignment's design describes | BOT-D, BOT-S4, BOT-C |
| 3 | Human-like | No idle heroes, no hoarded gold, no march into a hopeless battle | BOT-C, later BOT-P |
| 4 | Stronger | Wins more often against the bot it replaces | BOT-L3 |

**BOT-A1 (must).** Every measure names the aim it serves. A change that improves a lower aim must not make a higher
one measurably worse. Example: a new Evil bot that wins more often but stops using Blood Harvest fails, because aim 1
got worse.

### Where it starts

The tools that measure *change* are strong; nothing yet measures whether a bot is *better*.

| What exists | What it gives | The gap |
|---|---|---|
| The bots (`src/engine/bots/`, about 11,500 lines), run inside the turn | Every bot realm plans its turn | They write orders straight into the saved game and read the whole state; R-043 has no test |
| Copies of rules inside the bots | Predictions of outcomes | The copies drift: KD-165, KD-171, KD-173, KD-174 |
| Judgement as inline numbers | | Few are named, and nothing can tune a number with no name |
| One bot for every realm, "normal" or "hostile" | | No way to seat an old and a new bot in one game |
| [The balance matrix](../architecture/the-balance-matrix.md) and its noise rule (`tools/balance/paired.ts`) | "Did this change anything, beyond the noise?" | Not "is the bot better?" |
| The scripted realm (`tools/balance/scripted.ts`) | A realm that sends exactly the player portal's orders | It chooses from the whole saved state, not its realm's view |
| Every realm's report (`tools/balance/every-realm.ts`) | A report for every realm every turn | Nothing plays from it yet |

### The loop

Every bot improvement goes round the same four steps; an alignment change starts a new round.

1. **Observe** what the bots do badly: BOT-S's figures and BOT-C's reviews.
2. **Change** the bot: its code, or its weights (BOT-W).
3. **Measure** the old bot against the new on the same seeds: the league (BOT-L). This is the step that doesn't exist
   today.
4. **Accept** through an ordinary pull request with its league report; a maintainer merges.

BOT-V is the foundation under all four: one door through which a bot, the scripted realm and Claude all play.

## 2. Its state

The requirements are agreed but for one point: a maintainer answered ten of the eleven questions on 2026-11-20 (below), and A10 waits for a maintainer. Nothing is built. The
delivery plan comes next, as B-17. When the last part is built, this file goes, and the architecture docs say what is
true ([the explorations](README.md)).

## 3. The questions and their answers

| | The question | The answer (a maintainer, 2026-11-20) |
|---|---|---|
| A1 | The competence bar for each alignment | Each ability used in a set share of the games where it is available, and no alignment's win share more than a set margin below the average; the figures set after BOT-S's first run |
| A2 | An ability too rare to come up in the matrix's games | A named scenario may stand in, but the goal is bots that make the normal set of games show every ability |
| A3 | Where "which bot plays which realm" is kept | Only in the league's set-up: the league judges a bot's change, nothing is kept in the saved game |
| A4 | Where each alignment's flavour is written | A design document discusses the flavour of each alignment (BOT-D) |
| A5 | When Claude-played turns run | By hand only, each run stating its size first |
| A6 | What Claude's findings become | A set of bot changes and tweaks; a maintainer discusses and accepts them; then they become backlog rows |
| A7 | Whether a better bot reaches running games | Yes, once its backlog rows are delivered |
| A8 | Whether the league plays both "normal" and "hostile" bots | Yes |
| A9 | What tuning means | Improving the bots' behaviour against these criteria (the aims in order), not only beating copies of themselves |
| A10 | Whether the balance report needs a "bot change" class | Open. Proposed: no. It already reports a bot change as a reshape, lists the figures that moved, and doesn't fail on them; the league report is the verdict |
| A11 | Where these requirements live | Here, with one backlog row (B-17) for the delivery plan; each part's how-to goes into `docs/architecture/` as it is built |

## 4. The rules it changes

None. The machinery changes how the bots play, never a rule of the game. A bot change that reaches running games is
delivered as its backlog rows say (A7), with playtester notes.

## 5. How it is measured

The machinery is the measurement: BOT-S observes, BOT-L judges. Each part's acceptance check is under it in section 7.

## 6. The parts, in the order of the loop

| Part | Step of the loop | What it is |
|---|---|---|
| BOT-S | Observe | The bots' statistics, from the games the matrix already plays |
| BOT-D | Observe | Each alignment's flavour, written down, for aim 2 |
| BOT-C | Observe | Claude reviewing and playing turns, through a skill and tools |
| BOT-W | Change | The bots' judgement as named weights in data, and tuning |
| BOT-L | Measure | A bot per seat, and the league |
| BOT-V | The foundation | The bot as a player: its realm's view in, the portal's orders out |
| BOT-P | Observe, later | Comparing the bots with players' choices, from totals only |

## 7. The requirements

Each has an id, a statement and an acceptance check. "Must" is required for the part to count as done; "should" may be
traded off in the delivery plan.

### BOT-S: the bots' statistics

**Intent:** see what the bots actually do, per realm and per alignment. **Outcome:** after any matrix run, a maintainer
can answer "does the Undead bot raise its dead, how often, and does it waste orders?" from one report.

- **BOT-S1 (must).** For each realm in each game: orders given by kind; each alignment ability used, by its key in the
  alignment abilities' registry; orders the order hygiene dropped as unworkable, by reason; heroes left on Defend with
  nothing else to do; gold unspent at each turn's end; casts left unused.
- **BOT-S2 (must).** Summed per alignment and per race across the run, each figure with the noise rule.
- **BOT-S3 (must).** Every alignment ability is used in at least one of the matrix's games; a missing one fails the run
  and names the ability. While the bots' use of one is still to be built, a named scenario may stand in for it,
  listed by name with its backlog row; the list is meant to empty (A2).
- **BOT-S4 (should).** A profile per alignment, set against BOT-D: wars declared, treaties made and broken, doctrine
  chosen, and the share of the treasury spent on armies, heroes and spells.
- **BOT-S5 (must).** The statistics only read: every game plays the same with them and without them.
- **BOT-S6 (must).** The figures come from the telemetry and the GM log's kinds, never from words players read.

*Acceptance:* a bot planted to stop one alignment using one ability fails BOT-S3, and BOT-S1's figures show it.

### BOT-D: each alignment's flavour

**Intent:** aim 2 needs something to be measured against. **Outcome:** for each alignment, a design document says how
it should feel to play and to face.

- **BOT-D1 (must).** A design document discusses the flavour of each of the seven alignments: what such a realm values,
  how it treats its neighbours, what it does when it is winning and when it is losing.
- **BOT-D2 (must).** Each alignment's BOT-S4 profile names the passage of BOT-D1 it measures.

*Acceptance:* every alignment has its passage, and every BOT-S4 figure points at one.

### BOT-C: Claude reviewing and playing turns

**Intent:** use Claude's judgement to spot what a person would call a poor move, and to play realms that aren't copies
of the bot. It runs in a maintainer's Claude Code session, on their subscription: **nothing calls a Claude API**. It
is a skill the session follows, with tools in `tools/` that read and write files. **Outcome:** a maintainer runs one
skill and gets the bots' poor choices, each with its game, turn, realm, orders and a reason in game terms; or a realm
played by Claude, recorded so that it replays exactly without Claude.

How the pieces fit: the tool writes a realm's view for a turn to a file; the session reads it and writes an orders
file; the tool checks the orders, plays the turn and writes the next view. Only the session thinks; the tools read,
check and play.

- **BOT-C1 (must).** A tool that starts a seeded, synthetic game and, for a named realm and turn, writes its report, its
  view (BOT-V1's input) and the orders its form would offer.
- **BOT-C2 (must).** The tool reads an orders file, checks it against the player portal's typed orders (BOT-V2),
  refuses any order the form wouldn't offer with its reason, then plays the turn and writes the next view.
- **BOT-C3 (must).** A skill that reviews the bots' turns: it samples turns from a run, reads each bot realm's view and
  orders, and writes findings: the choice, why it looks poor, the aim it hurts, and how sure it is. Each names its
  game, seed, turn and realm, so anyone can replay it.
- **BOT-C4 (must).** A skill that plays a realm: one realm of a seeded game, for a set number of turns, from its view
  only (as R-043 holds a bot to), with a short reason for each turn's orders.
- **BOT-C5 (must).** Every Claude-played turn's orders are kept beside the game's seed, and replaying them reproduces
  the game exactly. Tests and the league use only such recordings: no test, CI job or league run needs Claude.
- **BOT-C6 (must).** Synthetic, seeded games only, with made-up names; never a live game, report or database.
- **BOT-C7 (must).** Started by hand only. A run states its size first (turns, realms) and stops at the limit the
  maintainer sets (A5).
- **BOT-C8 (must).** The findings become a set of proposed bot changes and tweaks. A maintainer discusses and accepts
  them, and the accepted ones become backlog rows (A6); none is built unrecorded.

*Acceptance:* a recorded Claude-played game replays to the same final state on two machines without Claude; a bot
planted to leave its gold unspent beside an undefended capital appears among the review's findings.

### BOT-W: the bots' judgement as weights, and tuning

**Intent:** turn the bots' judgement into named numbers in data, so it can be read, compared and improved against the
aims. **Outcome:** a bot version is its code and a weights file; a tuning run proposes a better weights file with its
league report.

- **BOT-W1 (must).** Each of the bots' judgement numbers (thresholds, priorities, margins of risk) becomes a named,
  typed and documented weight in one weights file a bot version, checked by a schema. A number that is a rule's value
  is not a weight: it comes from the content (BOT-V4).
- **BOT-W2 (must).** Moving a number into the weights file is `refactor-only`: every seeded game stays the same.
- **BOT-W3 (should).** Weights can differ by alignment, so each alignment's flavour (aim 2) is set in data.
- **BOT-W4 (should).** A tuning tool searches the weights, judged by the league against the aims in order (A9), with a
  fixed search seed. It runs locally only, never in CI.
- **BOT-W5 (must).** A tuned weights file is accepted only if it meets BOT-L4's bar for every alignment, against both
  the bot it replaces and the recorded outside opponents (the scripted realm and BOT-C's recordings).
- **BOT-W6 (must).** It arrives as an ordinary pull request with its league report, its balance report and a summary in
  game terms of what changed in how the bots play.

*Acceptance:* the weights file passes its schema; a tuning run started twice from one seed writes the same file.

### BOT-L: a bot per seat, and the league

**Intent:** give every bot change a verdict. **Outcome:** a pull request that changes a bot carries a league report: for
each aim, "clearly better", "within the noise" or "worse", with how sure it is.

- **BOT-L1 (must).** In the league, each realm can play a named bot version: the bot on `main`, the branch's bot, or a
  weights file. It is set in the league's set-up only; the saved game doesn't change and live games play the one
  current bot (A3).
- **BOT-L2 (must).** A league tool in `tools/` plays the old and the new bot against each other, rotating seats, races
  and alignments so each version plays each alignment in each seat equally often.
- **BOT-L3 (must).** It reports, per version and per alignment: win share, score at the Reckoning, survival to turns 10
  and 20, and BOT-S's figures; the same seeds play for both versions, and the noise rule judges each difference.
- **BOT-L4 (must).** The competence bar (A1): a version passes when each alignment uses each available ability in the
  set share of games, and no alignment's win share is more than the set margin below the average. A maintainer sets
  the figures after BOT-S's first run.
- **BOT-L5 (must).** Deterministic: the same inputs give the same answer, every run and on every machine.
- **BOT-L6 (must).** Both "normal" and "hostile" bots play; a version must meet the bar in both (A8).
- **BOT-L7 (should).** A quick mode (fewer games) to try an idea, and a full mode for the pull request.
- **BOT-L8 (should).** The scripted realm and Claude's recordings (BOT-C5) can take seats, so a bot is never judged only
  against copies of itself.

*Acceptance:* a bot planted to play one alignment worse is reported "worse" for it; a bot against itself is "within the
noise" on every figure.

### BOT-V: the bot as a player

**Intent:** a bot plays through the same door as a person: it reads its realm's view and sends the orders the player
portal sends, and its sense of what a rule is worth comes from the rule itself. **Outcome:** R-043 is held by the
code's shape; a changed alignment ability changes its bot valuation in the same row; a bot, the scripted realm and
Claude can each take any seat.

- **BOT-V1 (must).** A bot's input is its realm's view: what its report and the player portal show, plus what it
  remembers from earlier turns within R-043's limits. Nothing else from the saved game.
- **BOT-V2 (must).** Its output is the orders and plans the player portal sends, in the typed shape of
  `tools/balance/the-orders-the-player-portal-sends.ts` (moved to where the engine can use it), checked as a
  player's are.
- **BOT-V3 (must).** A test fails if a bot reads hidden state: the same view with a different army hidden from it gives
  the same orders.
- **BOT-V4 (must).** The bots keep no copy of a rule: to predict a battle, a spell or a sea lift, a bot asks the rule
  registry, through each family's bot valuation hook (B-06). KD-165, KD-171, KD-173 and KD-174 close as their copies go.
- **BOT-V5 (must).** Each row of the alignment abilities holds its bot valuation: when it is worth using, and what for.
  A row without one fails a static check.
- **BOT-V6 (must).** The move goes family by family as `refactor-only` rows, each keeping every seeded game the same.
  Where today's bots turn out to read hidden state, that row is a fix with its own test, not a refactor.
- **BOT-V7 (should).** Each pass of the bots' plan records its choices with a short reason, for BOT-S and BOT-C to
  read.
- **BOT-V8 (should).** The realm's view is one function, and each realm's report is built from it too: the heroes it
  lists and the names a line gives come from what that realm may know. So a hero under Invisibility, or a realm not
  yet met, can't reach a report by another path. The leak check's other two parts then rest on the view, as its
  audience part rests on the audience gate (B-18).

*Acceptance:* BOT-V3's test fails on a bot planted to read one hidden army, and passes on every bot after the move; no
alignment ability row lacks its bot valuation.

### BOT-P: comparing with players' choices (later)

**Intent:** check that the bots' choices look like players' (aim 3), from totals only. **Outcome:** a report compares,
per alignment, the shares of the bots' orders with players', naming no player, realm or game.

- **BOT-P1 (must).** It reads players' games only through the tool that reads them as totals (B-07): that tool changes
  who can see data, so its database pull request comes first and a maintainer reviews it.
- **BOT-P2 (must).** No live name, report text, account id or single game's orders leaves that tool, enters the
  repository or reaches a test.
- **BOT-P3 (should).** The same totals come from the league's games, so the two sit side by side.

*Acceptance:* the report holds only counts and shares, each over a group no smaller than a size the maintainers set.

### Every part

- **BOT-X1 (must).** Same answer every time: seeded games, dice from `kcRng()`, time from `kcClock()`; no retries,
  re-runs or lucky seeds decide a result.
- **BOT-X2 (must).** Synthetic data only; only BOT-P reads players' games, as totals, through B-07.
- **BOT-X3 (must).** Nothing in the repository calls a Claude API or holds a key.
- **BOT-X4 (must).** Live games change only when a bot change's backlog rows are delivered (A7), with playtester notes.
- **BOT-X5 (must).** One concern a pull request: a move of bot code is `refactor-only`; a change in how the bots play is
  its own pull request, with its league report and "What changes in play".
- **BOT-X6 (should).** The quick league answers in under 5 minutes on 14 cores, the full one in under 30; BOT-S adds no
  more than a tenth to a matrix run.
- **BOT-X7 (must).** Every report a maintainer reads leads with its answer in game terms, then the figures.

### Out of scope

The delivery plan; any change to a rule of the game; judging the alignments' balance (that stays with the balance
matrix and the maintainers); Claude in live games; new difficulty levels for players; the design matrix and its
scorecard (B-07).
