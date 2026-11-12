# How the alignment kits were tested

This note is for engineers reviewing the alignment-kit work on this test branch. It says how each round of changes was
measured, how the comparisons were made, how sure the figures are, and what the method cannot tell you.

## In short

- Every kit is code in `src/engine/`, but it runs only when a game is created with that alignment's name in
  `G.alignmentPrototypes`. With the list empty, the game is today's game, and the balance matrix shows it: all 60
  games identical to the baseline in `tests/balance/baseline/`.
- Each round was measured two ways:
  1. **The bot matrix**: 48 all-bot games a seed set, on five seed sets (240 games), with the kits on and with them
     off. This gives each alignment's share of wins, land, army and gold, with a 95% range.
  2. **Hand-played games**: ten-realm games of 20 turns in which every realm was played by an AI agent reading only
     that realm's turn report, as a person would. These find what the bots cannot: abilities nobody uses, confusing
     report lines, and bugs.
- Toby read a summary of both after each round and decided what changed next.

## 1. How a kit is switched on

| Switch (environment variable, read by `tools/balance/play.ts`) | What it does |
|---|---|
| `KC_ALIGN_PROTO=Divine,Good,…` | Puts those alignments in `G.alignmentPrototypes`. `alignProto(G, align)` in `src/engine/alignment-prototypes.ts` is the only gate. |
| `KC_ALIGN_TACTICS=1` | The bots play to their kits: they cast the new spells and give the new orders. |
| `KC_BOT_LAIRS=1` | The bots hunt lairs at a person's pace (they otherwise leave lairs alone, which hid the monster abilities). |
| `KC_START_GRAVES=1` | Every land province begins with one to three graves (one test world; not in the round 28 figures). |
| `KC_DUMP_LOG=<dir>` | Writes each game's whole GM log, one file a game, for counting how often abilities fired. |
| `KC_RACE=Human` | Every realm plays one race, to see alignment effects without race effects. |

**The identity check.** With all switches off, `npm run balance` must report "no meaningful change" and "60 of 60
games identical" against the committed baseline. I ran it again on the final state of the branch and it passed. This
is the evidence that the kits change nothing in today's game while switched off.

## 2. The bot matrix

The matrix is the project's own balance tool (`tools/balance/`, plan step P1-02). A seed set is 60 fixed games:

- **48 bot games**: 3, 4, 5 or 6 realms; 20% or 50% sea; normal or hostile bots; three seeds of each. The races and
  alignments rotate from game to game, so each alignment appears in about 140 of the 240 realm-slots over five sets.
- **12 scripted games**: one realm follows a fixed human-like script. The kit figures use the bot games only.
- Games stop at turn 30 if the Reckoning has not ended them.

Seed sets A to E start their seeds at 1000, 2000, 3000, 4000 and 5000. Sets A and B are the committed baselines; C to
E were added in round 20 because two sets were too few to separate the alignments.

### What is measured

`tools/balance/stats.ts` records each figure for each realm and slices it by alignment, for example
`game: won | by alignment: Undead`. The ones used most:

- won the game, alive at the end;
- provinces, army strength and gold at turn 10, turn 20 and the end;
- creature and monster companies recruited, lairs cleared;
- battle results by the two sides' alignments: `battles: attacker won | by alignments: Evil vs Undead`.

### The three comparisons

For each round I played the matrix in up to three set-ups, on the same seeds:

| Set-up | Switches | Answers |
|---|---|---|
| Today | none (or `KC_BOT_LAIRS=1`) | Where each alignment stands in the live game. |
| Kit alone | `KC_ALIGN_PROTO=<one alignment>` | What that kit does on its own, with every rival on today's rules. |
| All seven | `KC_ALIGN_PROTO=` all seven | Where each alignment stands when every kit is on: the game we would ship. |

"Kit alone" shows what a kit does; "all seven" shows whether the alignments end up level. A kit can look strong alone
and ordinary with all seven on, because the rivals' new answers cancel it out (the Druids' beasts were the clearest
case).

### Two ways to judge a change

**Paired by seed (rounds 1 to 19).** `tools/balance/by-alignment.ts BASE.json RUN.json --noise NOISE_B.json`
compares two runs game by game on the same seeds, using the matrix's own noise rule (`tools/balance/paired.ts`). It
resamples whole games 2,000 times with a fixed seed and calls a change "clear" when the 99% range leaves out zero,
"possible" when only the 95% range does. Because the games are paired, a kit that touches few games still shows. Set A
against set B on today's rules is the noise band.

**Pooled over five seed sets (rounds 20 to 28).** `tools/handplay/matrix/compare.py` adds up each figure over the five
sets' bot games and prints the today, kit alone and all-seven figures side by side. For a share (such as won the game)
it prints a 95% range: p ± 1.96·√(p(1−p)/n). With n about 140 realm-slots per alignment, a win share near 25% is known
to about ±7 points. Two alignments whose ranges overlap are not shown to differ.

**The fair share of wins is about 22%.** An alignment's realm is in a game of 3 to 6 realms; weighting each size by how
often the alignment appears in it, an even game gives each realm about 4 in 18 wins. Above about 30% or below about 15%
over 240 games is outside the range chance alone gives.

### Ability use

With `KC_DUMP_LOG` set, `tools/handplay/matrix/count-uses.py` counts each ability's log line in the bot games and gives
the mean a game. An ability that fires close to zero times is either too dear, too narrow, or not played by the bots;
the hand-played games told those apart. Standing bonuses with no log line of their own (Markets, Tithes) are not
counted.

### Round 28's matrix, all seven kits on (240 bot games)

| Alignment | Won the game | 95% range |
|---|---|---|
| Druidic | 32% | 24% to 40% |
| Neutral | 31% | 23% to 38% |
| Good | 26% | 19% to 34% |
| Pagan | 25% | 18% to 32% |
| Evil | 22% | 15% to 29% |
| Divine | 20% | 13% to 26% |
| Undead | 2% | 0% to 4% |

Six alignments overlap. The Undead are far below: the bots do not raise the dead well (they did better in hand play,
2 wins of 32 games). That is a bot problem as much as a rules problem, and is the first item for the bot work.

## 3. Hand-played games

The bots play the kits by rules written for them, so they cannot tell us whether a person would find an ability, use
it, or understand its report line. So from round 24 each round also had ten-realm games played by hand.

- **The harness** (`tools/handplay/harness-source.md`; save it as `handplay.ts` to run) creates a game with the kits
  on and no bots, shows one realm what the sight rules let it see, takes that realm's orders as a JSON file, and plays
  the turn. Each turn's dice come from `kcRng()` seeded with the game's seed plus 7,919 times the turn, so a game
  replays exactly from its file.
- **The players** were AI agents, one game each. Each agent played every realm in turn from that realm's view and
  report only, following `tools/handplay/brief.md` (the rules of every kit). It kept a diary and wrote a report:
  the result, how each alignment played, report lines that confused it, orders that failed, and balance
  observations (`tools/handplay/reports/`).
- **The set-up**: the seven alignments plus three more at random (at most one Divine and one Undead), races mixed,
  maps of 16×11 hexes. Games g10 to g18 ran 16 turns; g19 to g41 ran 20 turns.
- **Each round's summary** (`tools/handplay/findings/`) pooled the games: who won, which abilities were never used,
  which were decisive, and the bugs found. Toby chose the next round's changes from it.

Bugs the hand-played games found and the rounds fixed include: Good's muster companies that never went home from a
host, a sighting line that said "is in undefined", Divine Power reported as "falling" to 0 at the start, and a captive
being marched back onto the battlefield it was taken from.

## 4. The loop for each round

1. Make the round's changes in `src/engine/` behind the kit gate.
2. `npm run check` (types, lint, layers, format, ratchet), `npm test` and `npx playwright test`.
3. Commit and push to this branch (never a PR; the branch is for testing only).
4. Play the matrix with all seven kits on, on sets A to E (a few minutes a run; five side by side), and compare
   with `compare.py`. Kit-alone runs when a single kit changed a lot.
5. Play four to nine hand-played ten-realm games, side by side.
6. Write the round's summary for Toby: results, findings, numbered suggestions with a recommendation.

## 5. What this method cannot tell you

- **One kind of player.** The same AI model played every realm in the hand-played games, so it plays every side
  equally well and cannot be surprised. Real players will find lines it did not.
- **Small hand-played samples.** 32 ten-realm games over rounds 24 to 28, and 4 to 9 a round: enough to find unused
  abilities and bugs, not enough to rank alignments. Use the matrix for ranking.
- **Different set-ups.** The matrix plays 3 to 6 realms; the hand-played games 10. Effects that grow with the number
  of neighbours (Terror, Trade Pacts, Crusades) can differ between the two.
- **The bots are the weak link** for the Undead and for abilities that need planning (Watch-fires, The ancestors
  watch and Deserters turn mercenary were never used by bots or hand players).
- **Some late turns were shortened.** In a few long games the agent gave routine orders (moves, recruits) with a
  helper from turn 16 on and wrote every other order itself; the reports say which.
- **No fail-first unit tests for the kits.** The kits are prototypes behind a switch and were tested by play, not by
  dedicated unit tests. When a kit is accepted for the live game, it needs those tests (lowest level first, as
  CLAUDE.md requires) before it merges.
- **Container noise.** Two timing tests in the mutant-scorer test ("a stage's time limit") fail in the cloud container
  on the unchanged tree, and five engine files carry prettier warnings from before this work. Neither comes from the
  kits.

## 6. Repeating a comparison

The commands are in [matrix/README.md](matrix/README.md). In short, from the repo root, with Node 24:

```sh
npm ci && npm run build
OUT=/tmp/kits TAG=t1 tools/handplay/matrix/run-kits.sh "base-A base-B base-C base-D base-E all-A all-B all-C all-D all-E"
python3 -I tools/handplay/matrix/compare.py /tmp/kits t1
```

Two runs on the same commit give the same figures: every draw comes from the seeded `kcRng()`.
