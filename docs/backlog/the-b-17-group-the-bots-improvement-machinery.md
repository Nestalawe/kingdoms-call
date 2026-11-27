# The backlog: B-17, the bots' improvement machinery

Part of [the backlog](README.md), in the same columns ([how to read a row](README.md#how-to-read-a-row)): B-17's
group heading and its rows. Run A's rows and Run B's are in [the top's group 1](README.md#1-b-17s-run-a-the-bots-statistics);
the rows after the rulings belong to Later's [ground for the redesign](the-later-group-what-serves-a-later-outcome-or-waits.md#the-ground-for-the-redesign).

## The groups

### B-17: the bots' improvement machinery

A group, not a row ([how to read a row](README.md#how-to-read-a-row)): one repeatable way to find what the bots do
badly, change them, and prove the change made them better, as [its requirements](../explorations/the-bots-improvement-machinery-its-intent-its-outcome-and-its-requirements.md)
say (the ids BOT-S1 and so on are theirs). Impact: the maintainers get a bot change judged better or worse on the same
seeds, and a balance verdict that holds because the bots play every alignment well. Outcome: the ground for the
redesign. Planned on 27 November (its plan is in B-17a's pull request); its decisions in force, a maintainer's
answers of 28 November:
- **The order:** Run A (B-17a to f, l, m, q, r, s) next, before the rest of the rulings; then KD-498; then Run B
  (B-17g to k) by day with a maintainer; Runs C and D (B-17n to ai, aj, ak) after the rulings.
- **Each alignment ability's bot valuation lives in the bots,** in one table keyed by the ability (BOT-V5): content
  holds rules only.
- **BOT-S3's exceptions:** a set-up ability counts as used when the world is made with it; the Neutral mercenary
  discount stands in a named scenario, with its row, until the bots hire mercenaries; the Undead realm's 0% zeal is
  listed as "cannot act", its reason a maintainer's line.
- **The bots' reads beyond their realm's view are fixed now, in Run B,** each a fix with its balance report and
  BOT-S's figures.
- **The league seats an older bot by its weights file first,** then the base commit's bots packaged on their own: a
  trial first, and B-17ad stops if it can't run.
- **KD-498 is fixed right after Run A,** so Run A's figures show the bots' spells on themselves starting to work.

Its known defects, each keeping its id and its row in the bots' known defects
([part 1](known-defects-the-bots.md), [part 2](known-defects-the-bots-part-2.md)):
- the bots' copies of a rule that agree with it, made to ask the rule by B-17l and B-17m: KD-174, KD-519 to KD-526;
- the copies that differ from their rule, each a fix with its balance report after Run B, by impact: KD-165, KD-171,
  KD-173 (with KD-458 and KD-459), KD-175, KD-432, KD-433, KD-434, KD-435, KD-447, KD-448, KD-462, KD-463, KD-465,
  KD-466 and KD-477.

No rows yet: BOT-V1's rows (the bot's input becomes its realm's view, pass by pass) are scoped after Run B, and BOT-P
waits for B-07's tool that reads players' games as totals only.

## Run A: the bots' statistics, then the copies and the weights' first rows

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| B-17a | B-17's rows join the backlog (B-17 becomes a group); the requirements take the answers of 28 November; KD rows for the bots' copies of rules with no row and for the matrix doc's time | The maintainers: B-17's order and decisions are in the backlog, where the next rows read them | The ground for the redesign | Small | – | 🟦 | | First: the rows after it read their place and their decisions here |
| B-17b | The bots' record of their choices (BOT-V7's first part), in memory, outside the save, per realm per turn: each order the hygiene drops with its reason, by realm; each padding order by its kind; each hero's cast limit and casts given. The matrix reads it; the save, the telemetry and the GM log don't change. `refactor-only` | The maintainers: the three figures BOT-S1 can't count today become countable; unblocks B-17d | The ground for the redesign | Small | – | ⬜ | | After B-17a: the statistics need its record first |
| B-17c | The ability count by key: a typed map over the 51 alignment abilities, `satisfies Record<AlignmentAbilitySlug, …>`, saying how each is counted (a line's kind, an order, a fact, the state or the set-up), read from the events' facts; nothing new stored. A tool | The maintainers: the abilities the matrix counts rise from 16 of 51 to 49 or more; a new ability with no counting rule doesn't compile | The ground for the redesign | Small | – | ⬜ | | After B-17b: the report (B-17d) counts by its map |
| B-17d | The statistics report (BOT-S1, S2): per realm, summed by alignment and by race, each figure under the noise rule, leading with its answer in game terms (BOT-X7). A tool | The maintainers: "does the Undead bot raise its dead, and how often?" answered from one report; the first figures for the competence bar | The ground for the redesign | Small | – | ⬜ | | After B-17c: it reports what B-17b records and B-17c counts |
| B-17e | The ability check (BOT-S3): a run fails when an ability is used in none of the games, naming it; its stand-in list as answer 5 says. Its proof: a bot planted never to Consecrate fails it. A tool | The maintainers: an ability the bots stop using fails the run, where today it goes unseen | The ground for the redesign | Small | – | ⬜ | | After B-17d: it checks the figures B-17d reports |
| B-17f | R-043's test (BOT-V3): for a seeded world, change one thing the bot's realm can't see and plan again; the orders must stay the same. Today's reads beyond the view are a known list, each entry named by its fix row (B-17g to k), that only shrinks. A test | The maintainers: R-043 gets its first test; each of Run B's fixes empties an entry | The ground for the redesign | Small | ✓ | ⬜ | | After B-17e, closing Run A's statistics: Run B's fixes are proved by it |
| B-17l | The bots' copies of a rule that agree with it ask the rule (part 1): KD-174 and the copies with no row before B-17a (KD-519 to KD-526), as far as one row goes. A copy found to differ stays, gets its KD row, and is fixed in Run B. `refactor-only` | The maintainers: a rule that changes no longer leaves a bot's copy behind | The ground for the redesign | Small | – | ⬜ | | After B-17f: mechanical, no game changes; the copies that differ go to Run B |
| B-17m | The same, part 2: the copies B-17l leaves. `refactor-only` | The maintainers: about 9 copies of rules inside the bots fall to 0 | The ground for the redesign | Small | – | ⬜ | | After B-17l |
| B-17q | The weights file's schema (Zod), and each kind's names typed, in place of `Record<string, number>`. `refactor-only` | The maintainers: a misnamed weight fails the build; unblocks B-17r | The ground for the redesign | Small | – | ⬜ | | After B-17m: the weights' first row, no game changes |
| B-17r | The bots' 31 named tables (about 83 numbers) into the weights file, part 1. `refactor-only` | The maintainers: the bots' named judgement in one checked file | The ground for the redesign | Small | – | ⬜ | | After B-17q: it moves tables under its schema |
| B-17s | The same, part 2: the tables B-17r leaves. `refactor-only` | The maintainers: the named tables outside the file fall from 31 to 0 | The ground for the redesign | Small | – | ⬜ | | After B-17r, Run A's last row |

## Run B: the bots read only what their realm sees

Each row waits for a day with a maintainer (⏸), after KD-498. Each changes how the bots play: its own pull request,
with its balance report and BOT-S's figures, and its entry in B-17f's list emptied.

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| B-17g | The bots read only what their realm sees: whom they see when they plan. A fix; waits for a day with a maintainer | The maintainers: the bots keep R-043 on this read; the balance baselines move | The ground for the redesign | Small | ✓ | ⏸ | | After KD-498: a maintainer placed Run B by day on 28 November; B-17f proves it |
| B-17h | The bots read only what their realm sees: the offers of the same turn. A fix; waits for a day with a maintainer | The same, for this read | The ground for the redesign | Small | ✓ | ⏸ | | After B-17g, one read a row |
| B-17i | The bots read only what their realm sees: a rival's gold, skills and discoveries. A fix; waits for a day with a maintainer | The same, for this read | The ground for the redesign | Small | ✓ | ⏸ | | After B-17h |
| B-17j | The bots read only what their realm sees: the map as the realm knows it, for the paths (may split). A fix; waits for a day with a maintainer | The same, for this read | The ground for the redesign | Medium | ✓ | ⏸ | | After B-17i |
| B-17k | The bots read only what their realm sees: what they remember of a hero, and the relations of two other realms. A fix; waits for a day with a maintainer | The same, for this read; B-17f's list empty | The ground for the redesign | Small | ✓ | ⏸ | | After B-17j, Run B's last row; then the folded-in copies by impact |

## After the rulings: Runs C and D, and the work by hand

In Later's [ground for the redesign](the-later-group-what-serves-a-later-outcome-or-waits.md#the-ground-for-the-redesign),
after the rulings, as a maintainer placed them on 28 November (answer 3). B-17n, p and t to ab may be built early as
a run's spare rows; their place stays here.

| Id | What | Impact | Outcome | Size | Maintainer ✓ | Status | PR | Why here |
|---|---|---|---|---|---|---|---|---|
| B-17n | The typed orders the player portal sends move from `tools/balance/` to where the engine can use them (BOT-V2, part 1). `refactor-only` | The maintainers: unblocks B-17o and B-17aj | The ground for the redesign | Small | – | ⬜ | | Run C's first, after the rulings (answer 3) |
| B-17o | The bots' orders go through the player portal's door (BOT-V2, part 2): one merge takes them as it takes a player's. If the merge's checks move a game, the row stops and reports a fork. After B-17n | The maintainers: one door for a bot's, a player's and Claude's orders | The ground for the redesign | Small | – | ⬜ | | After B-17n, with a person near: it may become a fork |
| B-17p | Each alignment ability's bot valuation in the bots' table (BOT-V5, answer 4), with a static check that all 51 have one (the 18 set-up rules say "nothing to choose"). `refactor-only` | The maintainers: a new ability with no valuation doesn't compile; 0 → 51 of 51 | The ground for the redesign | Small | – | ⬜ | | After B-17o, in Run C (answer 3) |
| B-17t | The inline judgement numbers into the weights file: `specialists.ts`, part 1. `refactor-only` | The maintainers: the bots' judgement named, so it can be tuned | The ground for the redesign | Small | – | ⬜ | | After B-17p: 675 inline numbers, file by file |
| B-17u | The same: `specialists.ts`, part 2. `refactor-only` | The same | The ground for the redesign | Small | – | ⬜ | | After B-17t |
| B-17v | The same: `missions.ts`, part 1. `refactor-only` | The same | The ground for the redesign | Small | – | ⬜ | | After B-17u |
| B-17w | The same: `missions.ts`, part 2. `refactor-only` | The same | The ground for the redesign | Small | – | ⬜ | | After B-17v |
| B-17x | The same: `strategy.ts`. `refactor-only` | The same | The ground for the redesign | Small | – | ⬜ | | After B-17w |
| B-17y | The same: `spellcraft.ts`. `refactor-only` | The same | The ground for the redesign | Small | – | ⬜ | | After B-17x |
| B-17z | The same: `movement.ts`. `refactor-only` | The same | The ground for the redesign | Small | – | ⬜ | | After B-17y |
| B-17aa | The same: `war.ts` and `phase-one.ts`. `refactor-only` | The same | The ground for the redesign | Small | – | ⬜ | | After B-17z |
| B-17ab | The same: `intel.ts`, `economy.ts`, `setup.ts` and the plan. `refactor-only` | The same; the inline judgement numbers fall to 0 | The ground for the redesign | Small | – | ⬜ | | After B-17aa |
| B-17ac | Weights by alignment (BOT-W3): the shape only, each alignment's copy today's. `refactor-only` | The maintainers: each alignment's flavour can be set in data | The ground for the redesign | Small | – | ⬜ | | After B-17ab, Run C's last row |
| B-17ad | A bot version per seat, in the league's set-up only (BOT-L1, A3): a weights file per seat, then the base commit's bots packaged on their own, a trial first (answer 7). A tool | The maintainers: an older bot can sit beside a newer one; unblocks the league | The ground for the redesign | Small | – | ⬜ | | Run D's first, after Run C (answer 3) |
| B-17ae | The league (BOT-L2, L5, L6, L7): seats, races and alignments rotate; normal and hostile bots; the same seeds for both versions; a quick and a full mode. A tool | The maintainers: a bot change played against the bot it replaces | The ground for the redesign | Small | – | ⬜ | | After B-17ad |
| B-17af | The league's report (BOT-L3, X7): by version and by alignment, the win share, the Reckoning's score, survival to turns 10 and 20, and BOT-S's figures, under the noise rule. A tool | The maintainers: a bot change gets its verdict | The ground for the redesign | Small | – | ⬜ | | After B-17ae |
| B-17ag | The competence bar (BOT-L4): a maintainer's figures, set after Run A's first report, checked by the league. A tool | The maintainers: each alignment's bot held to a bar | The ground for the redesign | Small | ✓ (the figures) | ⬜ | | After B-17af |
| B-17ah | The tuning tool (BOT-W4): a fixed search seed, judged by the league, the aims in order; local only | The maintainers: a better weights file proposed with its league report | The ground for the redesign | Small | – | ⬜ | | After B-17ag |
| B-17ai | Outside opponents take seats in the league (BOT-L8): the scripted realm, then Claude's recordings. After B-17ak | The maintainers: a bot never judged only against copies of itself | The ground for the redesign | Small | – | ⬜ | | After B-17ah and B-17ak, Run D's last row |
| B-17aj | The tool for Claude's turns (BOT-C1, C6): a seeded, synthetic game; for a realm and a turn, its report, its view and the orders its form offers. After B-17n | The maintainers: Claude can read a bot realm's turn; unblocks B-17ak | The ground for the redesign | Small | – | ⬜ | | In Run D, after B-17n |
| B-17ak | The tool reads an orders file (BOT-C2, C5): checks it against the typed orders, refuses an order with its reason, plays the turn; each recording replays exactly (its test) | The maintainers: a Claude-played game kept and replayed without Claude | The ground for the redesign | Small | – | ⬜ | | After B-17aj |
| B-17al | The skill that reviews the bots' turns (BOT-C3, C8): findings become proposals a maintainer accepts, then rows. By hand | The maintainers: the bots' poor moves found, each with its game, turn and realm | The ground for the redesign | Small | – | ⬜ | | By hand, after B-17ak |
| B-17am | The skill that plays a realm (BOT-C4, C7): it states its size first and stops at the maintainer's limit. By hand | The maintainers: realms played by Claude, recorded for the league | The ground for the redesign | Small | – | ⬜ | | By hand, after B-17al |
| B-17an | The profile per alignment (BOT-S4), set against each alignment's flavour (BOT-D: Claude drafts it, the owner corrects it, answer 2). A tool. After BOT-D | The maintainers: aim 2 measured, alignment by alignment | The ground for the redesign | Small | – | ⬜ | | Last: it needs BOT-D, after Runs A to D (answer 2) |
