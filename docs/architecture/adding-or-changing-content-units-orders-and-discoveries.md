# Adding or changing content: units, orders and discoveries

What adding or changing a unit, an order, a discovery or another rule of the content touches, and the places a rule is still written twice. Each section is a trap's full text; the trap in brief is under the same title in [traps.md](../traps.md).
How to add a discovery's effect, kind by kind: [the discoveries' registry](the-discoveries-registry-its-stages-and-how-to-add-a-discoverys-effect.md#how-to-add-a-discoverys-effect) (from P1-19aa).

## A refactor that changes a container's type needs a test that calls the consumers

When the shared tables were collapsed into the data file, one table became a `Set` while five call
sites still used `.includes`. The equivalence check compared table **contents** before and after, so
it passed. Every turn report then threw.

- When a refactor changes a type (array ↔ `Set`, object ↔ `Map`), test through the **consumers**
  (e.g. build a turn report for a realm that has a fleet), not by comparing contents.
- Grep for every method used on the name (`.includes`, `.has`, `.length`, `.size`, indexing) before
  changing what it holds.

## A rule written twice must change twice

The most common root cause in this project's history is two copies of one rule disagreeing. The shared
tables now have one source, and so do the rules of a hero, an army, an item, a level or a number that the player
portal uses: it calls the engine's own function, in `src/engine/rules-on-plain-values/`, through
`src/shared/` ([the rule registry and the one source for shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md#kingdoms-call-datats-the-one-source-for-shared-rules)). Change such a
rule there, once. Rules are still restated:
- in the player portal's projections (forecasts, order validation, hints): the copies still left are the ones
  `tests/lib/player-portal-copies.ts` checks (`effMagicLvl`, the army card's sea-transport line, the
  Explore forecast `exploreGainFor`; the level of a hero's Druid that `druidNeedP` and the army card's Druid lines
  feed the engine's Druid rule; and the Naval 8 the Move notice works out from the report's skills to feed the sea
  lift, `seaLiftOfAColumn`), and the other forecasts and order checks whose engine rule is written inline (P1-11b,
  P1-19);
- at order time and again at resolution time in the engine;
- in the balance matrix's scripted realm: what the player portal sends, `doSubmitOrders`
  (`src/ui/player/briefing-and-submit.ts`), is copied in `tools/balance/the-orders-the-player-portal-sends.ts`, and
  which heroes the form lists, the Encounter Character list's sight, what Recruit Armies and the declarations
  offer, and the heroes a spare hero's Spy and Hire Hero list beside him, the lairs his Search Lair lists
  and the masteries the form offers at their level (a copy of `L79_ORDERS`, `src/ui/player/l79-orders.ts`, held
  equal by `tests/unit/balance-scripted.test.ts`) are read from the saved state in `tools/balance/scripted.ts`. The
  page test `tests/page/the-scripted-realm-sends-what-the-player-portal-sends.test.ts` holds them to the portal: a change to the
  form's payload or to what it offers turns it red until the copy follows;
- in the turn-report forecast versus the end-of-turn collector;
- in narrative strings, both rulebooks, join-screen blurbs and tooltips.

Before changing a rule, grep the engine and both portals for its nouns **and its numbers**, and change
every place in the same commit. When a number moves, grep the old number in narrative strings and the
rulebooks.

## Order is data

- `KC_*` arrays are iterated for random picks, tie-breaks and dropdowns, and object keys are walked.
  Append; never re-sort.
- The few GM-portal tables marked `NOT a copy` are deliberate re-orderings (tie-break priorities). Don't
  collapse them into the shared table.
- Never reorder a character's `items` array. Send Item addresses items by index.
- A stage of the rule registry runs its effects in the order its list gives (`THE_ORDER_OF_EACH_STAGE` in
  `src/engine/rules/the-registry-of-content-effects.ts`), not in the order of the registry's entries or of the content's
  rows. The list is the battle code's order before the registry took the effects: moving a slug in it changes a product
  of decimals or the ladder's words (Shieldwall after Sergeants: 9 of the matrix's 60 games differ). Add a new effect at
  its place; never re-sort.

## A new army unit is a dozen tables

A unit type is keyed by its name in tables spread over three files, and nothing throws when one is
missed: a unit with no cost recruits for 2g, one with no speed never marches, one with no names is "the
Guard", one missing from a terrain block fights at ×1 there. When adding (or renaming) a unit, touch:

- `src/content/kingdoms-call-data.ts`: `PROVINCE_ARMIES_P` (append to the cell: order is data, a king's two
  starting companies are the first two non-garrison types of his home's cell), `ARMY_UNIT_NAMES` (40
  names), `KC_UNIT_CLASS` (cavalry / missile / lightFoot / flying …), `KC_UNIT_TYPE`, `KC_DRUID_LEVELS`,
  `KC_UNIT_BASE_STR`.
- GM portal: `ARMY_COST_MASTER`, `ARMY_SPEED_MASTER`, `UNIT_SHORT`, `ARMY_RACE_OF_TYPE` (keep
  `'Orc Garrison':'Orcish'};` as its last entry: a test slices the source up to it), `DISC_CLS_SETS`,
  `TERRAIN_MODS` (`engine/battle/terrain-and-unit-strength.ts`) and `armStr`'s magic items' `CAV_I` / `INF_I` / `ARCH_I` sets.
- `src/content/unit-abilities-their-names-numbers-and-words.ts`: the unit's blurb in `UNIT_ABILITIES` (the player
  portal shows it). Player portal: the race blurbs. Rulebook: the roster, home-roster, move-rate and
  kinds-of-unit tables and the light-foot list. The intro's list of kinds.

Add the unit to `tests/lib/roster-decided.js` first: `tests/roster.test.js` and `tests/roster-words.test.js`
then list every table and sentence that is still missing it. Running games' capitals pick a new unit up on their next
turn (`backfillHomeRosters`); other provinces keep the pool they were generated with.

**The compiler now catches part of it**. The data file's unit type is `UnitType`, the keys of `KC_UNIT_TYPE`.
`KC_UNIT_BASE_STR` (every humanoid unit and elemental) and `ARMY_UNIT_NAMES` with `PRIMAL_UNIT_NAMES` (every unit type)
end in `satisfies`, so a unit in `KC_UNIT_TYPE` that is missing from one fails `npm run typecheck` (TS1360). A unit
that `PRIMAL_ARMY_DEFS_P`, `ARMY_UNIT_NAMES` or `KC_CARRIER_BERTHS` names but `KC_UNIT_TYPE` doesn't fails too
(TS2353). Add the unit to `KC_UNIT_TYPE` first, and the compiler names the data file's tables that still need it.
The engine's `ARMY_COST_MASTER` and `ARMY_SPEED_MASTER` (`engine/army-tables.ts`) end in `satisfies
Record<HumanoidUnitType, number>` too: a humanoid unit missing from either fails (a primal unit's cost and speed come
from `PRIMAL_ARMY_DEFS_P`). The engine's other tables (`UNIT_SHORT`, `TERRAIN_MODS`, `ARMY_RACE_OF_TYPE`, …) are
still unchecked: their files keep `@ts-nocheck`, and a `satisfies` there checks nothing
([traps.md](../traps.md#ts-nocheck-checks-nothing-in-the-file)). Each gets its `satisfies` when its file loses `@ts-nocheck`
(P1-10b: none of those files passes with annotations alone, P1-10a3). The lists above are still the whole job.

**A Creature or Monster** is the same list with its own tables. Mark it `live` in `tests/lib/primal-decided.js`
first (`tests/primal-roster.test.js` and `tests/primal-words.test.js` then list what is missing), then:
`PRIMAL_ARMY_DEFS_P` (the one place a beast's cost, strength, move, sub-race and pre-battle strike are written:
the master tables and the player portal's speeds are built from it), `PRIMAL_UNIT_NAMES` (28 names),
`KC_UNIT_CLASS` (`creature` or `monster`, plus `aerial` for a flyer, `cavalry` for a horse, `primalSea` for a
swimmer, `carrier` for a ferry), `KC_UNIT_TYPE`, `KC_DRUID_LEVELS`; the GM portal's `UNIT_SHORT`, `TERRAIN_MODS` rows, and **both** copies of the wild pools
(`CREATURE_BY_TERRAIN` / `MONSTER_BY_TERRAIN` in world generation and `CBT` / `MBT` in the alignment-neighbour
pass: `tests/new-creatures.test.js` holds the Creature pair together); the player portal's `PRIMAL_SUBRACE_CLASS`
(the `Primal:<sub-race>` string a wild province carries) and its alignment texts; the rulebook's Druid ladder
and the Druidic or Evil section. Renaming one also needs `LEGACY_UNIT_RENAMES` and `LEGACY_RACE_RENAMES`
(`migrateLegacyUnitNames` runs at the top of every turn) and the discoveries whose `effect.types` name it.

## A sea unit must be a carrier or a primal sea beast

The engine's "crosses the sea under its own power" set (`SEA_TYPES`, and the bots' `BOT_SEA_ALL`) is built from
`KC_UNIT_CLASS.carrier` plus `KC_UNIT_CLASS.primalSea`, **not** from `KC_UNIT_CLASS.sea`, which several other
consumers read. A unit listed in `sea` alone is a land unit the moment it is at sea: it needs a berth, is
stranded by `settleStrandedAtSea` and blocks the column's move. Put a new swimmer in `primalSea` (it swims,
carries nothing, is raised only at sea and cannot march inland) or, if it ferries troops, in `carrier` (one
berth, or its `KC_CARRIER_BERTHS` entry); the first run of `tests/shark-waters.test.js` showed the shoal left behind as
a garrison for exactly this reason. World generation's prosperous-seas pool is `primalSea` less the Shark Shoals.

## A beast joining a column checks its leader's Druid

Since 2026-10-12 (item 24) a realm's hero leads at most as many Creature and Monster units as his Druid level
(`beastCommandCount`, `beastsLed`, `beastCommandRoom`, module level beside `druIdPenaltyMult`). The rule is enforced
where a beast joins a column: Recruit Armies (overflow musters into the garrison), Pick Up Army, Leave/Transfer to a
hero and Wild Calling. A new path that puts a living beast into a hero's `armies` must ask `beastCommandRoom` first,
or the cap is quietly broken. The player portal's hero card counts with the same `countsAgainstBeastCommand`
(`engine/rules-on-plain-values/`, through `src/shared/`).
`tests/beast-command.test.js` holds the three orders.

## Terror is spent at battle start

`consumeTerror` runs at the start of every battle and deletes the province's `_terrorStacks`, `_terrorisedBy` and
the rest once it has demoralised the defenders. Anything that must know whether a province is "under Terror"
for that battle (Reign of Fear reads it through `reignOfFearHere`) reads it **before** the call, in both battle
paths, and hands the answer on through the strength context (`ctx.reignOfFear`). Read it after and it is always
false. (Reign of Fear fires only for the attacker since 2026-10-12, so the defender's answer is always false.)

## An alignment order is written in a dozen places

Call from the Pit (2026-10-13; removed with Awaken the Wild on 2026-10-12, item 22) touched: the engine's `case` in the order switch, the order-name map
(`'call from the pit':'call_pit'`), `ALIGNMENT_ORDER_KEYS` (the Charmed-hero gate), the short label map, the
bots' `botSignaturePre` case and their two lists of muster-like orders; the player portal's `ACTIONS`,
`ALIGN_ACTIONS`, `ACTION_DISPLAY_ORDER`, the target widget `case`, the army projection and the gold ledger; the
rulebook's orders table and alignment section, the intro's table and the player portal's three alignment
texts. Nothing
throws when one is missed: the order is simply refused, hidden or priced wrong. Copy Harvest the Field's
occurrences (grep `harvest_field` and `Harvest the Field`) and mirror each. Removing one touches the same places;
keep its `case` as a plain refusal, so an order a save still holds is answered rather than silently dropped.

## A fate line names two companies

Since 2026-10-12 a casualty line names the enemy company too: "— Aldric's Levies (Shieldwall Levies, Average),
facing the Red Hand (Gorbash's Gnomish Gyrocopters), were annihilated in the rout!". Two readers depend on the
company's own reference coming **first**:

- the losses tally (`battleTallyLine`) reads the owner and the unit type from the first match in the line, so a
  new fate line must open with the company's own reference (`unitRef`) and put the clause after it;
- the clause comes from `battleFacedClauses`, read from the deploy's grids right after `battleDeploy`. Anything
  that faces the rows again later (the stay-or-retreat estimate does) overwrites the rows' `_faced` stamps, so
  read the map once, early, and pass it to `rollUnitFates` as `faced`.

`tests/battle-faced-lines.test.js` holds the wording of every branch and the tally's crediting.

## Retired discovery ids are never reused

`RETIRED_DISCOVERY_IDS` lists Sage discoveries that have been removed. `retireDiscoveries(G)` strips them
from live saves at the start of every turn. Reusing an id would hand the new power to every realm whose
save still carries the old one. Add to that set; never remove from it. Removing a discovery touches
three places: its row in the data file, its effect in the engine (the discoveries' registry, for a kind it holds; the
readers in `src/engine/discoveries.ts` that still name its id or its kind, for the rest), and anything the player
portal shows for it.
