# Handoff: more design and testing work on the alignment kits

For a fresh Claude Code session that will carry on **designing and testing** the new alignment abilities with Toby,
before anything is built into the live game. (Building them in is separate work: [IMPLEMENTATION.md](IMPLEMENTATION.md).)
Written on 26 November 2026, after round 28 of the tests.

## 1. Read these first, in this order

1. `CLAUDE.md`: the project's rules. They all apply, with the exceptions for this test branch in section 3.
2. This file, to the end.
3. **The playtesters' Google Sheet, as Toby has updated it.** Ask Toby for its link. It is the current statement of every
   ability, and Toby edits it himself: do not edit it unless he asks. Where it differs from the code, the sheet is what
   Toby wants, and the code is what was tested.
4. [findings/round-28.md](findings/round-28.md): the latest results, the problems players would hit, and the round 29
   suggestions Toby has not answered yet.
5. [brief.md](brief.md): the rules as the hand players read them. Later sections replace earlier ones.
6. [IMPLEMENTATION.md](IMPLEMENTATION.md), section 5: every ability as it stood at the end of round 28, alignment by
   alignment, with what is built, partly built and not built. Section 6 has the edge cases the games found.
7. [METHOD.md](METHOD.md): how the testing works and how sure its figures are.

## 2. What this work is

Toby is the designer. He reads each round's findings, says what to change, and you:

1. change the prototype kits;
2. test them with the bot matrix and with hand-played games;
3. report back in game terms, with numbered suggestions and a recommendation.

Toby has shared the sheet with the playtesters. They will talk it through, and Toby will bring their feedback into this
work. **Do not invent rules.** A design question goes to Toby as numbered options, with your recommendation and a short
example from inside the game.

## 3. Where to work

- All the prototype code is on the branch `claude/determined-archimedes-ppq0qn`. Start your session's branch from it:
  ```sh
  git fetch origin claude/determined-archimedes-ppq0qn
  git checkout -B <your session's branch> origin/claude/determined-archimedes-ppq0qn
  ```
- This is a **test branch**: no pull request, never merged, never pushed to `main`. Commit each round as
  `Round N: <short title>` and push to your session's branch.
- **Do not rebase or merge onto `main`.** `main` has moved on by over a thousand commits since this branch was cut, and
  the kits and the harness depend on the code as it was. The live build comes later, fresh on `main`.
- Every kit stays behind its switch: `alignProto(G, align)` in `src/engine/alignment-prototypes.ts`. With every switch
  off, the game must stay today's game (the identity check in section 4).
- The repo is public. Use made-up names in every report. Never paste live-game reports, player names or Google Drive
  links into the repo.

## 4. Setting up a fresh container

1. Node **exactly** 24.22.0 (`.nvmrc`): `npm ci` refuses any other, even 24.22.3. If `node -v` shows another version,
   download it into your scratchpad (nodejs.org is reachable from the cloud container):
   ```sh
   cd <scratchpad> && curl -sSO https://nodejs.org/dist/v24.22.0/node-v24.22.0-linux-x64.tar.xz
   curl -sS https://nodejs.org/dist/v24.22.0/SHASUMS256.txt | grep 'linux-x64.tar.xz$' | sha256sum -c -
   tar -xJf node-v24.22.0-linux-x64.tar.xz
   export PATH=<scratchpad>/node-v24.22.0-linux-x64/bin:$PATH   # in every shell that runs npm or npx
   ```
2. `npm ci`, then `npm run build`.
3. Save the harness, which is kept as text (see its file for why), and keep it out of git:
   ```sh
   awk '/^```ts$/{f=1;next} /^```$/{f=0} f' tools/handplay/harness-source.md > tools/handplay/handplay.ts
   echo tools/handplay/handplay.ts >> .git/info/exclude
   ```
4. Check that the build works: `npx tsx tools/handplay/handplay.ts new /tmp/g.json --seed 4242 --alignments Divine,Good`
   then `npx tsx tools/handplay/handplay.ts run /tmp/g.json`.
5. The baseline runs ("today's rules") are not kept between containers. Play them once before the first comparison:
   `OUT=<dir> TAG=r29 tools/handplay/matrix/run-kits.sh "base-A base-B base-C base-D base-E"` ([matrix/README.md](matrix/README.md)).

**The identity check.** After a change outside the kits, run `npm run balance` with no kit switches set. It must say "no
meaningful change" and "60 of 60 games identical".

**Known noise in the cloud container.** Two timing tests ("a stage's time limit") fail on the unchanged tree. Five
engine files carry prettier warnings from before this work. Neither comes from the kits.

## 5. How a round runs

1. Toby says what to change: his own ideas, the playtesters' feedback, or your last round's suggestions.
2. Change the prototype. Where each ability lives: [IMPLEMENTATION.md](IMPLEMENTATION.md), section 8. Keep each number as
   a named constant with a comment naming the round, as the existing ones do.
3. Add a "Round N changes" section to the end of [brief.md](brief.md).
4. `npm run check`, `npm test` and `npx playwright test`. Expect only the two timing failures.
5. Commit and push.
6. **The bot matrix**, all seven kits on, sets A to E (five runs side by side, a few minutes each):
   `OUT=<dir> TAG=rN tools/handplay/matrix/run-kits.sh "all-A all-B all-C all-D all-E"`, then
   `python3 -I tools/handplay/matrix/compare.py <dir> rN`. Add `KC_DUMP_LOG=<dir>/logs-all-A` in front of one run and use
   `count-uses.py` to see how often each ability fired.
7. **Hand-played games**: four to nine ten-realm games of 20 turns, one forked agent each, side by side (section 6).
8. **Write the round up** for Toby, in plain words and game terms, as [findings/round-28.md](findings/round-28.md) is:
   the short version, what changed, results (who won each game; the totals over all rounds; the matrix), what the
   games showed change by change, problems a player would hit, and what you would change next. Save it as
   `findings/round-N.md`, put each game's report in `reports/`, commit, and give Toby the same text as a Google Doc.

## 6. Hand-played games

The set-up Toby chose: ten realms, the seven alignments plus three more at random, **never more than one Divine and one
Undead**, races mixed, 20 turns. Number new games from **g42**. Give each game its own seed (for example 4242 for g42);
make some hostile (`--diplomacy hostile`) and some sea-heavy (`--sea 30`).

Each game is played by one forked agent. A brief that worked:

> Play game gN of Kingdoms Call by hand, with the harness in `tools/handplay/` (README.md). Create it with
> `npx tsx tools/handplay/handplay.ts new <dir>/gN.json --seed <seed> --alignments <ten alignments> --races <ten races>`.
> Play all ten realms for 20 turns. Each turn, for each realm still alive: `view` that realm, read only what it shows,
> decide its orders as a thoughtful human player of that alignment would, and write them with `orders`. Then `run` the
> turn. Follow `tools/handplay/brief.md` for the rules and the order formats (its later sections replace earlier ones).
> Use each realm's kit as a real player would: do not hold back, and do not use what that realm cannot see. Keep a short
> diary in `<dir>/gN-diary.md`. At the end, write `tools/handplay/reports/gN-report.md` with four sections: 1. Result
> (each realm's provinces, share of the tax, gold and army at turn 20, and who was wiped out when); 2. By alignment (how
> each played and which abilities mattered); 3. Report and order problems (new ones only: lines that confused you,
> orders that failed without a reason); 4. Balance observations. Use the realm names the game gives, never real
> players' names.

Things learned from running games this way:

- A game takes the agent a long time. Run several side by side, and check on them rather than waiting.
- If a usage limit stops an agent, resume it with SendMessage: its game file holds the whole game.
- A worker restart kills background matrix runs. Restart only the sets that did not finish.
- The harness's dice come from `kcRng()` seeded with the game's seed plus 7,919 times the turn, so a game replays
  exactly from its file.

## 7. Toby's decisions so far

These stand until Toby changes them.

| When | Decision |
|---|---|
| Round 24 | Harvest the Field is removed. The Undead raise the dead only with the Skeletal Armies spell. |
| Round 24 | Test games have ten realms: all seven alignments plus three at random, with at most one Divine and one Undead. |
| Round 25 | Games run to a full 20 turns. |
| Round 25 | No change to Undead casting: human players will train Necromancy early. |
| Round 25 | Every realm sees another realm's hero who leads armies in a province next to its own (built as a rule for every realm). |
| Round 26 | No new use for gold yet: Toby will add other ways to spend it later. |
| Round 26 | Evil and the Undead keep their wars that take effect the turn they are declared. Toby will discuss this with the playtesters. |
| Round 28 | No change to Defend riding out, or to empty provinces falling to any army that walks in. |
| After round 28 | The always-on Divine battle bonus is called **Smite the Unholy**, and Holy defence is folded into it. **Proclaim Crusade** keeps its name. The code's labels already match. |
| After round 28 | Toby updates the playtesters' sheet himself. |

The reasons behind earlier choices, rounds 1 to 23, are in the "ideas round" Google Docs; Toby can share them.

## 8. Open questions at the end of round 28

Put these to Toby before starting round 29, unless his playtesters' feedback replaces them.

1. **Round 29 suggestions** ([findings/round-28.md](findings/round-28.md), the last section):
   - Ransom: take the beaten hero when he loses a third of his companies, not half. If his realm cannot pay after three
     turns, free him for whatever it has. Say in the report why a hero was or was not taken.
   - Dark Pact companies draw half wages after their free turns, and the pact line says what they will cost. Evil has
     won nothing for two rounds, and the wage cliff causes most of its collapses.
   - Druidic, which leads the bot matrix: (a) leave it for the playtesters (recommended); (b) the beasts that join on
     capturing a creature province need a hero with Druid 2 or more; (c) the free beast garrisons stop at two a province.
2. **The parts not built yet**: build, drop or leave for later, one by one. They are Sanctuary against robbery, Absolution
   of curses and charms, the Church Triumphant's protection of the king, Good Works against spies and thieves, the
   storm's effects on movement and fleets, Watch-fires, The ancestors watch, and Deserters turn mercenary. No bot or hand
   player used the last three.
3. **Call to Arms (Good)**: the test games kept it next to Light the Beacons, but the sheet lists only the Beacons.
4. **Report problems still open** from round 28 (section "Problems a player would hit"). Most are small fixes to report
   lines. One is not understood yet: no warning fired for an empty Undead capital with an enemy army next door (g40).
5. **The bots cannot play the Undead** (2% of wins in the matrix, against 2 wins in 32 hand-played games). That is for the
   bot work ("handoff for improving the bots"), not this work, but it makes the matrix's Undead figure unreliable.

## 9. Lessons from 28 rounds

- **Predict first, then measure.** Before each matrix run, write down what you expect. Say plainly when the results
  differ.
- **One reading is not enough.** A win share over 240 games is good to about 7 points either way. A hand-played round
  of four games can find unused abilities and bugs, but cannot rank the alignments.
- **The bots and the hand players disagree, and both matter.** The bots show raw strength; the hand players show what a
  person would use, what confuses him, and what breaks.
- **Abilities nobody uses** are usually too dear, too narrow, or not explained in the report. Ask which before changing
  the numbers.
- **Every new mechanic needs a report line** saying what happened and why. Most of the hand players' complaints were
  about silence: an order refused with no reason, or wages arriving without warning.
- **The checks catch the usual traps:** no new `.js` or `.mjs` file (the ratchet counts them), no raised count in
  `eslint-suppressions.json`, no `as`, `!` or `any`, and no words in HTML outside `kcHtml`. In a file that still carries
  `// @ts-nocheck`, put untyped logic in a small helper there rather than in a typed file.
