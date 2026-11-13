# Hand-played alignment test games

Research tooling from the alignment-kit test rounds (rounds 19 to 28) on this test branch. It is kept here so a later
session can play more games and compare bots with hand play. It is not part of the site, not run by the tests, and not
meant for `main`.

## What is here

| Path | What |
|---|---|
| `IMPLEMENTATION.md` | The requirements for building the new alignment abilities into the live game, for a fresh session: what to build, Toby's decisions, the cases the games found, how to build it on `main`. |
| `METHOD.md` | How the kits were tested and compared, for engineers. |
| `matrix/` | The scripts that play the bot matrix with the kits on and compare the runs. |
| `harness-source.md` | The harness: one game file holds a whole game, and you play every realm by hand, turn by turn. Kept as text (see that file for why): save its code block as `tools/handplay/handplay.ts` to run it, and don't commit that file. |
| `brief.md` | The rules brief each game was played from: how to write orders, every kit ability, lessons from the first games, and the changes of rounds 25 to 28 at the end (later sections replace earlier ones). |
| `reports/gN-report.md` | One report per hand-played game (g1 to g41): result, how each alignment played, report and order problems found, balance observations. g1 to g9 are 3- and 4-realm games of 16 turns; g10 to g18 ten realms, 16 turns; g19 to g41 ten realms, 20 turns. |
| `findings/` | The summary of each round (the overnight 3- and 4-realm games, then rounds 24 to 28): what changed, results, findings, suggestions. |

## Running a game

Node 24 (`.nvmrc`). First save the code block in `harness-source.md` as `tools/handplay/handplay.ts`. Then, from the repo root:

```sh
npx tsx tools/handplay/handplay.ts new g.json --seed 4242 --alignments Divine,Good,Druidic,Neutral,Pagan,Evil,Undead,Good,Pagan,Neutral --races Human,Elven,Dwarven,Orcish,Human,Elven,Dwarven,Orcish,Human,Elven
npx tsx tools/handplay/handplay.ts view g.json 3            # realm 3's situation and last report, as text
npx tsx tools/handplay/handplay.ts orders g.json 3 o3.json  # that realm's orders for this turn
npx tsx tools/handplay/handplay.ts run g.json               # plays the turn for every realm
```

`new` also takes `--sea 30` and `--diplomacy hostile`. Every alignment kit is switched on (KC_ALIGN_PROTO). The orders
file is `{"<heroId>": [five orders], "diplomacy": {"<realm>": "enemy"|"treat"}, "encounterPlans": {"<heroId>":
{"duelStance": "challenge"|"accept"|"refuse", "ransom": true}}, "discoveryChoices": {...}, "kingSkills": {...}}`; each
order is `{"action", "target", "extra", "desc"}` as the brief describes. A realm with no orders rests: there are no bots
in these games.

The view shows a realm what the game's sight rules allow (its own land, its heroes, the hosts it can see), not the whole
map. Write order files as JSON; do not split orders on `|` (a recruit order uses it for the quantity).

## The bot matrix with the kits on

How the kits were measured, and how sure the figures are: [METHOD.md](METHOD.md). The scripts that play the matrix
with the kits on and compare the runs are in [matrix/](matrix/README.md). One run by hand:

```sh
KC_BOT_LAIRS=1 KC_ALIGN_TACTICS=1 KC_ALIGN_PROTO=Divine,Good,Druidic,Neutral,Pagan,Evil,Undead npm run balance -- --set C --out out.json
```

Seed sets A to E, 48 bot games each. The share of wins by alignment, from round 23 to round 28, is in the `findings/` files.
