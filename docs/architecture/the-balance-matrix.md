# The balance matrix

`npm run balance` (`tools/balance/`, P1-02a) plays 60 seeded games in the GM portal and compares them, game by game,
with the committed baseline in `balance/baseline/`. It answers "did this engine change change anything, and how
much?". Then it plays them again with every realm's report (below). It isn't part of `npm test` or `npm run check`: it
takes about 40 s on 14 cores (20 s for the page's games, 17 s for every realm's report).

- **The games** (`tools/balance/matrix.ts`): 48 all-bot games (3 to 6 realms, each on its rung of the map ladder ×
  sea 20% or 50% × normal or hostile bots × 3 seeds, races and alignments rotating; up to 30 turns, which almost
  every game needs to reach the Reckoning) and 12 with a **scripted realm** (`tools/balance/scripted.ts`): one realm
  held by the runner, which chooses its orders from the saved state each turn, with no randomness, and sends them as
  the player portal sends them: every field of the portal's payload, five orders for every hero its report
  lists, a plan for every living hero, in the form's names, and only what the form offers. It does what bots don't:
  war on the nearest realm it has met, Encounter Character after the nearest enemy it sees (the armed king is the
  chaser, so the chase meets battles), a plan for every hero varied by hero and turn (tactics, a pre-battle school, a
  battle cry, each duel stance, an Evil realm's doctrine), and, since P1-15e3, an order for every spare hero (one
  who isn't chasing or recruiting) of those the form offers him where he stands, by hero and turn: Spy on a wandering
  hero or a rival beside him, Hire Hero (a wanderer who will serve, with his card and its plan), a mastery at its
  level, Search Lair (a Weak lair his realm knows there, with the province it was planned in), Research (Sage 1),
  Practice Skill, Explore or Rest; and once a game, in the orders for turn 6, Release Hero for its first unarmed hero
  if it has three or more. The payload is a typed copy of the portal's
  (`tools/balance/the-orders-the-player-portal-sends.ts`), held to it by
  `page/the-scripted-realm-sends-what-the-player-portal-sends.test.ts`. Its report is hashed too: an all-bot game
  writes none. The run fails if Encounter Character never happens in a set's games. A chase held by an unresolved
  battle is still counted in them and printed ("Scripted cases: …"), but the games meet it only by luck (none in
  P1-15e3's), so since P1-15e2b it is required of a named scenario instead (below): every `npm run balance` plays
  `a-chase-held-by-an-unresolved-battle` first, on this site or `KC_SITE`'s, and fails if it misses (not with
  `--only`, nor when a scenario is named).
- **The invariants after every turn** (`lib/invariants.ts`, P1-04b), as in `turn-fuzz`, and the **report-leak check**
  on the scripted realm's report (`lib/report-leaks.ts`, P1-04c): a breach fails the game with its turn, the check and
  what broke ([how the tests reach the site](how-the-tests-reach-the-site.md#how-the-tests-reach-the-site)). They only read: the games are identical with them and without.
  The invariants add about 11 ms a turn (about 13 s of work over set A, 1 s on 14 cores).
- **The save's check fails a game** (P1-15e1, `tools/balance/a-game-fails-on-the-save-check.ts`): after every turn,
  a `[Save check]` line in its GM log (the check of the save the turn loaded, P1-15d: what the turn before wrote that
  the saved state's schema refuses) fails the game with `turn N:` and the places it names; after the last turn, so is
  the check of the last save, which no turn loads (`upgradeGameState` from `src/`, on a copy: a game's end is written
  by its last turn). With `KC_SITE` the line is that copy's and the last save's check this checkout's. Not an
  invariant: `checkTurn` also runs on the staged worlds of `turn-fuzz` and the fixtures test, which lack what Turn 0
  adds. A place found on `main` whose fix waits is parked and let through by a narrow entry (one path and kind) in
  its `KNOWN_PLACES_THE_SAVE_CHECK_FINDS`, empty today; its fix removes the entry. Since the scripted realm sends what
  the portal sends, the matrix also sees what a human realm's plans and orders save (a plan's duel stance
  and doctrine, with no bot's marks), but only for the orders it gives: since P1-15e3 those above, so also Release
  Hero's `_releasedBy` and a spied hero's entry. Not the orders it never gives (Cast Spell, the item orders, the
  masteries that need a target, the Grand Design, the raise and charm cards) nor a mastery no scripted hero reaches
  the level of.
- **One fresh page per game** (`tools/balance/play.ts`), booted through `lib/boot.js` with an explicit `seed` and
  `now`, in manual turn mode, stopping at the Reckoning. Games run side by side, one worker process per core
  (`--jobs N` to change it). The results are identical one game at a time and many side by side, and on a second
  run.
- **Exact:** per game and turn, 12-character hashes (`tools/balance/hash.ts`) of the saved state without its prose,
  the prose on its own, the GM log's structure and its text, the telemetry, the scripted realm's report
  (structure and text apart; per section over the game), and **every write** the turn sends to the stand-in database
  (`writes`, P1-02c: `tools/balance/writes.ts`). That last one is every write and database function (`rpc`) in order,
  with its table, operation, filters, modifiers and payload, so a changed filter, a field dropped from the save's
  `meta` or two writes swapped show even when nothing in play changed. The recorder wraps the stand-in client's
  `from` and `rpc` before the page boots, and copies each write when its query runs. Reads aren't recorded. Left
  out: the stand-in database's ids and stamps, the build stamp, and clock readings (the pinned clock moves on at each
  reading). In the writes, the JSON held as a string (`game_state`, `turn_report`) is parsed first so this reaches
  inside, and words are left out as in the other play hashes. Recording adds about 1.5–2 s on 14 cores.
  A baseline from before a column was added reads with it not kept: never a difference, and `npm run balance`
  refuses to compare with it.
- **Statistics** (`tools/balance/stats.ts`), per game, from the telemetry and the GM log: battles (attacker win % by
  kind, terrain and the realm side's leading unit type; units lost), lairs by grade, heroes' deaths by how, spells by
  school, realms at turns 10 and 20 and at the end, items, titles, game length and how it ended, chases.
- **The noise rule** (`tools/balance/paired.ts`): the two runs paired by seed, each statistic's change with its 95%
  and 99% ranges from resampling whole games 2,000 times (fixed resampling seed): "clear change", "possible change",
  "within the noise" or "too few to tell". The overall answer looks only at the bot games' headline statistics, with
  the bar raised for their number. `balance/baseline/noise.json` is the same matrix on other seeds: against the
  baseline, the rule must say "no meaningful change" in the bot games (`unit/balance-baseline.test.ts`; not the 12
  scripted games, too few for its bar: P1-15e3).
- **Every realm's report** (`tools/balance/every-realm.ts`, P1-12a1; P1-12's Decision 1): the matrix hashes only the
  scripted realm's report, so a bot realm's report, and so most of what perception does, was never compared. The second
  half plays the same games again in the engine's bare `vm` (`lib/engine.ts`, one worker process per core), each the
  matrix's own game (the set-up, seed, scripted orders and the shell's work around a turn: `lib/matrix-game.ts`), with
  a report for every realm every turn, bots' too (`lib/scenario-in-the-vm.ts`'s `reportEveryRealm`: built from copies
  of the slot rows, after the turn is saved). It checks that each turn's saved state hashes as the page's did (the
  turns are untouched), runs the leak checks on every realm's report (the audience check among them, on the turn's
  events, recorded as they are emitted: `recordTheEvents`, P1-12b3), and hashes each report, play and words apart,
  against `balance/baseline/reports.json` (both sets: about 5,800 reports a set). A difference names the game, the
  first turn, the realms and the report sections. It reads `src/`, so with `KC_SITE` it isn't played: its fail-first
  proof is a planted copy of the branch. `--out FILE` writes its run beside FILE (`every-realm.json`), and the balance
  report says in one line whether every realm's report is identical to the base branch's.
- `KC_SITE` plays another copy of the site. `-- --set B` plays the noise set; `-- --only bots-03,scripted-01` plays
  some games; `-- --out <file>` writes the run in the baseline's form, e.g. to compare two runs.
- When a change is meant to change play, or a realm's report, `npm run balance:update` rewrites the baselines (both
  sets, and both sets of `reports.json`); commit them with it.
- **In CI** (the `balance` job in `ci.yml`, P1-02b; `ci` needs it). Its first step,
  `tools/balance/engine-paths.ts`, runs in plain Node before `npm ci`. It compares the commit with the one before: a
  pull request's base, or, in `deploy.yml`'s run on `main`, the commit before the push. If no **engine path** changed,
  the job ends there, in seconds. The engine paths are the GM portal and every script its page loads, the data file,
  `tools/balance/`, `tests/balance/`, the helpers in `lib/` that the balance code imports, and the tools the matrix
  runs on (`package-lock.json`, `.nvmrc`: a jsdom or Node bump can change the games). The helpers include those the
  helpers import (the every-realm half loads the engine through `lib/engine.ts`). The runner refuses to
  play if its page loads a file that isn't on the list. Otherwise the job plays set A, one game per core, and fails if
  any game differs from the committed baseline: commit the new baseline with a change that is meant to change play. A
  pull request labelled `refactor-only` fails at the first step if it changes `balance/baseline/` at all. CI plays
  only the branch: the base branch's figures are its committed baseline. Adding or removing a label runs CI again.
- **The balance report** (`tools/balance/report.ts`, `npm run balance:report`, P1-03a). On a pull request the
  `balance` job compares its games with the base branch's committed baseline, game by game, and writes the report CI
  posts as a comment (`.github/workflows/balance-report.yml`, run when CI finishes; it runs only the default branch's
  `tools/github/balance-comment.ts`, never the pull request's code). The report first names the **class of change**:
  - **no change:** every game identical (a pure refactor);
  - **wording only:** every game played out the same (the state, the log's structure, the telemetry, the results, the
    scripted realm's report structure), and only words differ (if the database writes changed too, it says so);
  - **writes only**: every game played out the same, in the same words, and only what the turns wrote to the
    database differs. Nothing in play changed; it lists the games and the first turn that wrote differently, and
    replays nothing. That's expected only of a change to how the game saves: P1-17's moves of these writes must come
    out "no change";
  - **a reshape:** at least 90% of the games played out differently (`RESHAPE_SHARE`), as when the order of the dice
    changes, counting the games still being played at the first turn any game differs (a change from turn 18 can't
    reach a game that ended at 15). Every game differs, so it's judged as a whole, by the strict overall answer, which
    must be "no meaningful change";
  - **a rule change:** fewer games played out differently, and the rest are identical. It's judged by where the
    changed games first differ and by every figure and slice beyond the noise, so a change confined to one slice
    still shows in the verdict.

  Then: where the changed games first played out differently (up to 12, replayed on both sides to their first
  differing turn: the base's side on a copy of its site from `git archive`, through `KC_SITE`), the figures that
  moved, biggest first, each with one fixed label (`tools/balance/labels.ts`), the slices that moved, and how sure
  each is. With no report (no engine path changed, or the job stopped first) the posting workflow says so in an
  earlier report's comment, and posts nothing on a pull request that never had one. It also warns (never blocking)
  while a pull request whose report isn't "no change" or "writes only" has no "What changes in play" section. A base
  baseline without a column is compared on the rest, and the report says what wasn't compared.
- **Named scenarios** (`npm run balance -- <scenario>`, `tools/balance/scenario.ts`, P1-03c). A scenario measures one
  rule's direct effect in one staged scene; the matrix measures the knock-on effects in whole games. Each is a file in
  `balance/scenarios/`: a scene staged through `lib/scenario.js`, its number of runs (400), and the figures it
  reports, named and labelled as the matrix's statistics. Run *n* plays on a fresh page with seed *n* and the matrix's
  clock, so the base's runs and the branch's pair by seed and the noise rule judges them. The base's side plays a copy
  of `main`'s site (`-- --base REF` for another; `git archive`, through `KC_SITE`), then this side plays this site
  (or `KC_SITE`'s), each with every core. The result is a table to paste into a pull request: each figure before and
  after with its own 95% range and the cases behind it, the change with its range and how sure it is, and the runs it
  changed in. `-- --runs N` plays fewer runs for a quick look. Not in CI or `npm test`: about 45 s a side on 14 cores.
  A scenario may also **require** figures (`requires`, P1-15e2b): each in every run or in some run. Such a scenario is
  played by every `npm run balance` too, before the games (once with `--update`), on this site only, with every core,
  and prints one line: its runs, its seconds, and "every requirement met" or each requirement missed with how many runs
  showed it; a miss, or a run that fails (it couldn't be staged, or the page reported an error), fails the run. One is
  required today (about 3 s); the rest are played by hand.
  - `a-chase-held-by-an-unresolved-battle` (required, 20 runs): an enemy king with 12 Elite Heavy Infantry besieges a
    province held by two hosts of one Green Light Infantry each, in a ring of the hunter's realm's provinces; the
    hunter, with 4 Veteran Heavy Infantry, rides after him (Encounter Character) in Spring. The siege can't end in
    Spring (the besieger is more than four times the stronger, the fortune of battle's bound, and only one holder
    fights a round), so the chase is held in Early Summer in every run ("the chase after … must wait"), and on the
    catch in Spring whenever the catch roll succeeds ("the reckoning must wait"; 70%). It checks its own staging
    ("could not stage" if the siege isn't more than four to one, or a Spy isn't 0). Required: held in Early Summer in
    every run, held on the catch in some run;
  - `battle`: 6 Elite Yeoman Longbows (a Human realm) attack 6 Average Dwarven Guard (a Dwarven realm) in the hills,
    plain commanders on both sides, measured on the first clash: attacker win %, units lost on each side;
  - `lair`: a young hero (Melee 2, 20 HP, no items) searches the Weak lair in their home: cleared, fled, killed;
  - `encounter`: Encounter Character on an enemy hero in the same province, catch rolls by Spy level (0 or 3 each
    side, 100 runs each).
