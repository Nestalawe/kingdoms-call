## Session v2026.09.10-1625 — To-hit audit; flee spoils; race-bound items were inert

### 67.1 To-hit / chance audit (Toby item 1) — findings, and two bugs fixed
Personal-combat archery: `30 + Archery×10 + temper.archeryHit − hitPenalty (+10 sd33)`, clamp 5–95, × foe dodge; Archery is the capped 0–5 effStat + minor titles + sd37. Two arrows per Fire at Archery 3+. Damage 2–5 + ceil(raw/2). Melee: `50 + (Melee−foe Melee)×10 + temper attack − foe temper defence`, clamp 40–95. Personal-combat casting: `20 + level×10 (+10 per raw-L8 school)`, cap 95. Guardians: melee via the same formula on their 1–4 stat; ranged guardians fire at 30 + archery×10 (no temper); specials roll their own per-ability `castChance` (30–50%) and land automatically on success (a miss costs the round).
- **Bug — duplicate object keys in `pcCharCombatant`**: a second `meleeRaw:skillLevel(...)`/`archeryRaw:skillLevel(...)` pair further down the literal silently overrode the 09-09e `Math.max(raw, effStat+minors)` pair, so "+2 Melee" items never reached the damage roll. Duplicate removed.
- **Bug — personal-combat casts ignored sd27 Arcane Codex and the `cast` heritage discoveries** (pre-battle and action-phase casts honoured them). `pcCastCombatSpell` now adds both.
- Not changed (flagged): archery ignores `status.hitBonus` (Elixir of Focus) and `status.toHitReduce` (Invisibility), which melee honours.

### 67.2 Flee spoils (Toby item 2)
New `duelFleeItemDrop(runnerCbt, stayerCbt, narrative)` beside `resolveDuel`: when a character flees a pre-battle duel (`resolveDuel`) or a character-vs-character Encounter (`resolveCharVsChar`), `DUEL_FLEE_DROP` = 30% chance one random transferable item (never Mithril) passes to the character who held the field. Resolved on the REAL records via id lookup; battle copies kept in step. Roll shown in the narrative. Fleeing from monsters is unchanged.

### 67.3 Race-bound items were inert in their own race's hands (Toby item 3)
Root cause: the 15 race-bound items carried `race:'Elf'|'Dwarf'|'Orc'` while characters carry `'Elven'|'Dwarven'|'Orcish'`; only Human matched. Item data now uses canonical names, and `itemUsableBy` (GM) / `itemUsableByP` (Player) run the tag through `_ITEM_RACE_ALIAS` so items already rolled into saves also work. Player-portal bound label now prints the canonical race. `session_harness_0908.js` had encoded the mismatch (test character `race:'Dwarf'`) — corrected to `'Dwarven'`.

### Validation
syntax 0/0; scan 0 unresolved both portals; scenario.js pass; `session_harness_0910g.js` pass (alias both portals, meleeRaw fix, cast 50→55→65, drop rate 29%, duel + encounter drop paths). Regression: all pass except pre-existing failures (research_hpcap, 0909k, 0909l, 0909t/partB, trapped) and `intel_harness` (flaky spy roll — fails ~1 in 3 on the baseline build too).

## Session v2026.09.10-1546 — Move orders target a specific province, not a compass direction

### 65.1 Absolute move targets `prov:<id>` (Toby: "move NE, fight, retreat SE, then my 'move E' goes to the wrong place")
Root cause: move orders were stored as `dir:<D>` and resolved at run time with `neighborInDir(currentProvince, D)`, so a character displaced earlier in the turn (retreat after a lost battle) had every later direction re-applied from wherever the retreat left them. The engine already accepted a bare numeric province id (bot AI uses it), but with no adjacency check.
- **Player + GM order forms** now emit `prov:<id>` for Move — same labels as before ("North East (Ravenmoor)"), computed from `predictedLocation(c.id,ph)` on the offset-hex grid (E/W wrap, N/S off-map omitted). A previously saved `dir:<D>` order still pre-selects the matching option (harness 0909g D5/D6 updated to the new expectation).
- **Engine `move` case** — new `prov:` branch: same province → "move order is moot", nothing spent; adjacent → march in; **not adjacent (displaced) → one step along the shortest passable route via `stepToward(c,id)`** (terrain-aware BFS already used by wanderers; `seaCap` refreshed first), narrated "intended to march to X, but after being displaced it no longer lies adjacent — the column turns toward it by way of Y". The step then passes through every normal movement rule (pools, neutral-border block, sea/land capability). No route → "the column holds". Toby chose this "step toward" behaviour over a plain fail.
- `intendedDestination()` (phase-intent / interception preview) mirrors the same adjacent-or-first-step resolution.
- Both `predictedLocation()` functions (GM ~line 815, Player ~5191) follow `prov:` chains so later-phase dropdowns, Search-Lair/cast targeting and recruit tallies project correctly.
- Legacy `dir:` and bare-numeric (bot) targets unchanged. Nothing else in either portal parsed `dir:`.

### 65.2 Validation
`syntax.js` 0 errors both portals; `scan.js` 0 unresolved both portals; `scenario.js` pass; **`session_harness_0910f.js`** (adjacent prov:, legacy dir:, wrap-around, distance-2 detour, moot, bogus id, real repel-and-retreat then move-to-original-province, GM/Player forms emit prov:, both predictedLocation follow prov:) ALL PASS ×3 random worlds; full regression suite pass. Pre-existing/flaky on the base build too (not this change): `research_hpcap_harness`, `session_harness_0909d/k/l/t`. Harness note: neutral defenders live on the guard hero — retiring guards (alive=false) makes a province claim-without-battle; keep a live `_isNeutralGuard` with armies to force a fight.

## Session v2026.09.10-1341 — One visibility rule; Wild Hunt tag; End-of-Turn Chronicle bucket; kin narrated; battle-line parity; Spy on a character; hidden research fields

### 64.1 One visibility rule for non-own characters (Toby items 1 & 12)
Root cause of BOTH reports (hero on the map but not in the Encounter Character dropdown; hero in the dropdown but not on the map): the map, the Enemy/Wandering Heroes lists, the Hire list and `encounterTargets` each applied their own subset of the stealth rules (map: Spy-contest `spotEnemyInOwnedProvince` for enemies lurking in owned land; lists/targets: the older flat `_unspottedTurn` cloak; the Encounter list also silently dropped enemy KINGS for non-king heroes and Cloak-of-Many-Faces wearers).
- New module-level `enemyCharVisibleTo(gs, viewerPi, c, {ownedProvIds, ownCharLocs, spiedThisTurn})` — line of sight (owned / co-located / spied) → Invisibility hides from everyone → a deliberate Spy pierces → enemy in owned land with no hero of yours: army-leaders always seen, otherwise the Spy contest → elsewhere (and neutrals) the flat unspotted cloak. All five consumers call it.
- `encounterUntargetableReason(c)` → `'faceless'` (Cloak of Many Faces) is carried on `encounterTargets[].untargetable`. The player-portal dropdown now LISTS every visible enemy and greys out the ones this hero can't hunt with the reason ("only your king may hunt a king" / faceless) instead of dropping them.

### 64.2 Wild Hunt units tagged everywhere (item 2)
`wildHunt` / `wildHuntUntil` exported on character armies (`charReports`), all three `garrisonArmies` builders and `forceMarker` rows; `armyLabel()` (player portal) appends `[Wild Hunt — bound until end of turn N, no wages]`. Garrison exports now also carry `race`/`skeletal`/`unitName` so every army line renders identically.

### 64.3 End-of-turn character entries (item 3)
`buildChronicle` gave each character five phase buckets, so any char-scoped `phase:99` entry (courier deliveries, Elven escapes, Observatory) fell into Spring. Sixth bucket "End of Turn" (grey) rendered after Early Winter. Only explicit `phase:99` files there; unphased turn-START lines keep Spring.

### 64.4 Practice default (item 4)
`practiceOwnEarlierSkill(c,ph)`: if no companion is practising here this phase, pre-select the latest skill this character practised in an earlier phase.

### 64.5 Items (items 5 & 6)
`itemLoreTip` is a passthrough (pop-up retired — the description is printed after every item). `itemSlotTag(it,c)` now reads `[<slot> slot — equipped/not equipped · N of M free]`; slotless items show `[carried — needs no slot]`.

### 64.6 Kin bonus was applied but never narrated (item 7)
Verified `armStr` applies ×1.2 king's-race and ×1.2 leader's-race (stacking ×1.44) and recruits carry `race`. Added `kinNarrative(force, leader, ownerRace, sideName)` → `🤝 Kinship — X's host: N units of the king's own race under a commander of that blood (+44% strength); …` for both sides in the NPC path and the PvP path (garrison defenders use the province owner's race).

### 64.7 Battle-report parity NPC ↔ PvP (item 8) and army lines across sections (item 9)
- `unitRef(owner, a)` → `Owner's Unit Name (Type, Quality)` in EVERY casualty / promotion / demotion / flight line in both paths and in the guard-survivor block (previously NPC omitted the owner, PvP omitted type & quality; wording aligned: "were destroyed in the fighting / in the rout", "earn promotion to", "lost heart in defeat, reduced to", "Despite defeat … improved to").
- NPC opener and attacker force row now name the realm `King (Realm)` like PvP; NPC terrain line uses the PvP shape `📊 <terrain> terrain — X's front line holds N: …; reserve N at ×M.`; NPC summary uses `X's forces defeat Y` / `Y hold against X`.
- Player portal: Blood Offering rows and the province character roster use `armyLabel()` like the map, Your Realm and Chronicle force rows.

### 64.8 Spy on a character (item 10)
Spy target `char:<id>` (order form offers the province or any visible non-own character standing in the same province). Success **25% +10%/Spy** (Master Spy / Crystal Orb automatic; +spy discoveries) → `[Intelligence] 🔍 … report on X: skills — …; Items — …; Leads — …` and the skills persist to `_spiedHeroSkills`. Success or not, **caught**: 20% +10%/target Spy −10%/own Spy, +15% in the target realm's land, −15% in the spy's own land, clamped 5–95; The Shadow is never caught; Cloak of Many Faces can't be spied. Caught → `thiefCaughtScuffle` (target's Refuse stance honoured, Vanish honoured) and a counter-intel line to the victim. Formula uses the sensible reading of Toby's brief (own Spy REDUCES being caught). Rulebook §Spying updated.

### 64.9 Hidden research fields (item 11)
`RESEARCH_HIDDEN_CATS = {Heroic, Special}` (module-level, beside `SAGE_DISCOVERIES_P`). Never listed in `researchCategories`; a smuggled target is treated as "any"; the main roll's pool excludes them. Every Research order (success or fail) adds an independent side roll at **half** the discovery chance for a hidden-field discovery, reported as `💡 An unlooked-for find! …` (same merit / Sage-L6 gold / skill-gain hooks). Rulebook: one sentence about unlooked-for finds — no field named (Sage-secrecy rule kept).

### Validation
syntax.js 0/0; scan.js 0 unresolved both portals; scenario.js pass; `session_harness_0910e.js` (new, ~45 checks: visibility agreement across 6 stealth cases, Wild Hunt export/label, kin + parity lines in real NPC & PvP battles, spy-on-character incl. forced catch loop, hidden research via forced d100, End-of-Turn bucket, item tags) ×4 green; full regression: all green except pre-existing (0909l D1; research_hpcap 4 HP checks superseded by the HP redesign; 0909t flakes identically on v0939). Harness expectations updated: `session_harness_0909k.js` D12 (new Spy form shape), `research_hpcap_harness.js` (side finds allowed).

### Open
- Spy-on-character catch formula as implemented above — confirm or invert per Toby's literal wording.
- Bot AI never issues `char:` spies or reacts to hidden-field discoveries (no change needed, noted).

## Analysis 2026-09-10 (b) — Streak-damping dice models (no code change; `bell_ab_harness.js` v2)

Player complaint: turns FEEL streaky (runs of 90+ or sub-10 rolls). Bell curves don't fix that (they change the odds, not the streaks). Tested three "balanced dice" models that keep every displayed chance honest in the long run:
- **bag100** — shuffle bag of 1–100, draw without replacement (Tetris-style). Exactly uniform per 100 rolls.
- **bag20** — stratified bag: 20 strata of 5 (1–5, 6–10 …) in shuffled order, uniform pick within the stratum; refills every 20 rolls. Balances 5× faster than bag100 at full 1–100 resolution.
- **karmic** — BG3 / Dota-PRD style: running luck debt `d = 0.7·d + (roll−50.5)/49.5`, next raw roll shifted by `−round(15·d)` (max ±15), clamped 1–100. The SHIFTED roll is what the report shows, so the ✓/✗ stays honest.
Self-play A/B (2×8 games, 20 turns, 4 bots): success rate by chance band matches uniform for all three (unlike avg2/avg3); game outcomes within noise (skill gain 229–265 vs 225–258 uniform). Swing metrics on ~100k rolls — sd of 10-roll window mean: uniform 9.1, bag100 8.6, bag20 7.0–7.3, karmic 5.8; share of 10-roll stretches averaging <35 or >65: uniform ~9.5%, bag20 ~3.5%, karmic ~0.6%; triple 80+/20− runs per 1000 rolls: uniform 13.5, bag20 7.8, karmic 2.3. bag100 barely helps because a player makes far fewer than 100 rolls a turn.
Recommendation: karmic, keyed PER PLAYER (`G.players[i]._diceDebt`, set via a module-level `_diceCtx` from `processOrder` next to `_logCtx`; world/NPC rolls use a shared pool), behind a game setting so it can be A/B'd live. Rulebook wording: "the dice remember — a run of high rolls is followed by lower ones and vice versa; every chance shown is still the true long-run chance."

## Analysis 2026-09-10 — Bell-curve d100 (no code change; `bell_ab_harness.js`)

`d100()` feeds 36 sites; `trySkillGain`, fortune-of-battle and most army-battle maths use raw `Math.random` and would be UNAFFECTED. Shapes tested: uniform, mean of 2 rolls (triangular), mean of 3 rolls. Success probability at a displayed chance c: 10%→1.9/0.4, 20%→7.8/3.6, 30%→17.7/12.1, 40%→31.6/28.4, 50%→50/50, 60%→67.6/71.6, 70%→81.7/87.9, 80%→91.8/96.4, 90%→97.9/99.6 (avg2/avg3).
Self-play A/B (2×8 games, 20 turns, 4 bots, seeded): ~7k displayed rolls per mode, 85% of them Practice (chance 5–29%, `PRACTICE_BASE_BY_LEVEL` 25/20/15/10/5%). Practice successes: uniform 14% → avg2 6.7% → avg3 4%. End-of-game skill gain per game 225–258 (uniform) → 175–186 (avg2) → 131–142 (avg3). NPC battle wins and land held drop with it (weaker heroes); hero deaths, king deaths, battles roughly unchanged (hit chances cluster 45–60% and are clamped 40–95, so combat barely moves). Ambush (10%+9/Spy) 15%→4%→1%; pursuit 50% unchanged. Conclusion: a global bell curve is mostly a progression nerf, not a combat change. If Toby wants it, scope it to a `d100bell()` on the high-variance skill actions (spy, steal, assassinate, ambush, unify) and leave practice/research/cast on uniform, or re-tune those base tables.

## Session v2026.09.10-0939 — Roll==chance succeeds; Mirror Image same-round; wages single-source-of-truth

### 66.1 A roll equal to the success % was reported as a failure (Toby item 1)
Root cause (two layers):
- The personal-combat spell caster (`pcCast…`, ~L10328) rolled `Math.floor(Math.random()*100)` (0–99) and succeeded on `roll < chance`, contradicting the engine-wide `d100()` (1–100) / `roll <= chance` convention. A cast at 30% with a 30 rolled printed `[roll 30 ✗]`.
- `fmtRoll(chance, roll)` displayed `Math.round(chance)` but ticked ✓/✗ against the raw fractional chance, so a 29.6% chance could print `30% [roll 30 ✗]`.

Fix: PC casts use `d100()` and fail only on `roll > chance`; `fmtRoll` compares the integer roll against the rounded chance it shows; new module-level `pctRoll(chance)` → `{chance, roll, ok}` is the one canonical way to make a displayed check going forward. Parley (`TA`) converted to the same convention and now shows its roll. Every other displayed d100 site was audited (`<=` already). The Research roll was already correct (integer chance, `<=`); the report you saw was almost certainly a spell cast.

### 66.2 Mirror Image — victim got a free swing at the caster (Toby item 2)
Initiative is fixed per fight (`initA/initB` = speed×10 + melee + archery + random tiebreak; `first`/`second` do not re-roll each round — by design) and was working. The bug: the mirror branch only ran at the **top** of a round, so when the caster held the initiative and cast in the first slot, the victim's second-slot action still went at the caster; the mirror fight only began next round.

Fix: the mirror round is now a closure `_mirrorExchange()` inside `resolvePersonalCombat` (victim acts vs phantom in an isolated state, phantom acts back, shatter/slain checks). The round-start branch calls it after the disbelief roll; the exchange loop calls it immediately (and breaks) when `pcAct` has just created `state.mirror`, `actor===first` and the victim is `second`. No disbelief roll in that same-round case — they have just been fooled; the first check comes next round.

### 66.3 Realm Events wages ≠ Your Realm wages (Toby item 3)
Investigated with `wage_diag.js` (bot self-play, 900 player-turns) plus code comparison. The collector (~L17580) and the forecast (~L7390) are code-equivalent; the divergence is timing. Wages are charged at Early Winter (ph 4) but the report is built after: (a) Orc war-spoils half-wage (same-turn transient, deliberately not forecast), (b) Host-Leader read from `G._minorHolders` (turn start) vs `computeMinorTitles` (report time), (c) roster changes after wages — non-payment disbands, elven-escape survivors reaching garrisons (L17720), skeleton rises (L18096), Divine resurrection, heirs. A forward forecast can therefore never be guaranteed equal to the bill.

Fix — single source of truth:
- Collector stamps `p._lastWages={turn, armyWages, heroWages, hostLeaderG, heroWageDisc, orcSpoilsG}` (Host-Leader, hero discounts and Orc spoils now itemised there).
- `buildTurnReport`: when `player._lastWages.turn === gameState.turn-1` (i.e. this report follows the resolved turn) the Your Realm box uses those actual figures; the roster-based numbers go out as `kingdom.nextArmyWages` / `nextHeroWages` only when they differ. Otherwise (GM preview, stale stamp) the roster forecast is used as before.
- Realm Events line keeps the exact `owes Ng wages (armies: Ag, heroes: Hg)` format (harness regexes depend on it) and appends ` — after −Ng the Host-Leader, −Ng Orcish war-spoils, −Ng hero wage discounts` when applicable.
- Player portal: Army/Hero Wages boxes show `after −Ng Orcish war-spoils` and a grey `next turn: Ng` line when the bill will change.
Net Income in the box is now forecast tax − actual wages; the tax forecast itself was not touched.

### Validation
`syntax.js` 0/0 both portals · `scan.js` 0 unresolved both · `scenario.js` ALL CHECKS PASSED · new `session_harness_0910d.js` (1a–1g roll convention; 2a–2c Mirror Image across 12 live casts; 3a–3f wage parity incl. bankruptcy-disband next-turn note and stale-stamp fallback) ALL PASSED · `session_harness_0909b.js` A1 updated to the `<=` convention (its 21 "mismatches" were exactly the roll==chance cases). Full regression suite passes except `research_hpcap_harness`, `session_harness_0909l` D1, `session_harness_0909t` C0 and `trapped.js`, all of which fail identically on the untouched v0839 baseline (pre-existing; `research_hpcap` predates the HP redesign). `wage_diag.js` kept as a diagnostic (not a pass/fail harness).

## Session v2026.09.10-0839 — Bot upgrade II: companions for generals, split-recipient dispatch, hire a hero every turn

### 65.1 Companions (Toby item: a hero at every general's side, ideally a mage)
Pre-pass in `runBotMovement` builds `escortOf`: every general leading a host takes one unarmed, non-leader, non-king character — scored `magicScore×3 − distance` (elemental+necromancy+psychic+illusory+white), within 6 hops through any land, biggest host choosing first. Companion behaviour (first branch of the unarmed logic, after wanderer-seeking):
- **Co-located:** up to two casts from `botCastPlan(…,{fighting: general})` — offence on enemies standing here, Oratory / Phantasmal Armies for the general, Illusory Terrain, Bless — with general-targeted buffs kept only in phases before his first Move (the engine resolves a friendly cast before its co-located target's own move in the same phase). Then **follows one phase behind** along his move list, but only into ground that is ours/allied, land he simply walks into, or his first assault when the battle model gives him a 2× edge.
- **Elsewhere:** `Join <general>` via `botPathAny` (≤6 hops).
- A co-located companion is also the split recipient: a leader with ≥10 units hands the weaker half to the **least magical** unarmed character here, so a mage stays the companion and a fighter takes the column. A lone big host thereby pulls the nearest spare hero to it before splitting.

### 65.2 Hiring (Toby item: at least one wandering hero a turn)
- `botHeroCap` = 3 + land (was 2 + land/2).
- `botHireOrder`: the wage comes from the chest only (no longer gated on the troop upkeep cap); one claimant per wanderer per turn (`L.hired`).
- Seekers use `botPathAny` up to 5 hops (an unarmed character is never engaged by a neutral guard), and **seeking outranks escort duty** — the recruit becomes the next companion.
Self-play (3×20 turns): hires 196 vs ~140 before; hero counts per bot at T20 roughly doubled; claims +20% in the seeded A/B; wage shortfalls unchanged.

### 65.3 Flagged
- A companion following into a province whose battle is still unresolved next phase is possible when the general's 2× assault drags on; it is unarmed and is not engaged by the guard, so the risk is a wasted hop, not a death.
- Only the commander casts pre-battle magic in the engine; a companion's contribution is action-phase casting (buffs/curses/province spells). If you want companions to add battle magic inside the general's battle, that is an engine change (co-caster in `combatVsNPC`/PvP) — say the word.

### Validation
`syntax.js` 0/0 both portals; `scan.js` 0 unresolved both; `scenario.js` ALL CHECKS PASSED; new `session_harness_0910c.js` (8 live runBotMovement scenarios) ALL PASSED; regressions 0910b / 0910 / 0909v / 0908b / mirror / autoturn / bot_strategy / fod ALL PASSED; `bot_selfplay_harness` 0 errors.

## Session v2026.09.10-0823 — Bot upgrade: honest battle model, Druid drilling, expansion pressure, distant strike, split hosts, early watches

Root causes found by new diagnostics (`bot_expand_diag.js`, `bot_reason_diag.js`, `bot_ab_harness.js` — seeded A/B runner with battle win/loss, claims, wage shortfalls, per-turn land):
- Bots summed **raw** unit strength: no Druid penalty, no Tactical multiplier (×1.6–2.0), no terrain front line. They won 96% of the battles they dared and declined the rest; a Druid-0 king marched Cave Trolls in at −60% unknowingly.
- A host on the frontier beside one over-strong guard **held for the rest of the game** (`botFrontierTarget` is null on the edge; no realm-wide search).
- Leaders raided lairs before expanding; a freshly hired Tactical-3 hero displaced the king and cost a "hand column" turn.
- Upkeep cap left 80–110g idle in the chest.
- The spare-phase Defend was placed AFTER the moves; its watch dragged the main host off its advance to answer neighbouring skirmishes.
- A single mega-stack (16–22 units) conquered one province a turn with most units in reserve (front line ≤6; one battle per phase).

### 64.1 Battle model (all bot decisions)
`botBattleForce(G,c,armies,terrain)` mirrors the engine: per-unit `druIdPenaltyMult` (same-race rule, Druidic realm, sd40 via `botHasDisc`), `BOT_FRONT_WIDTH` (plain/desert/sea 6, forest/jungle 4, mountain 3), flyers up front, reserve ×0.5 (×0.75 with sd09), Tactical ×(1+0.2·lvl) cap 2.0 on front-line land units. `botTargetDefence` reads the defenders on the target's own terrain (guard hero's Tactical included) × `BOT_DEF_BONUS` 1.25. `botEffForce` (Druid only) remains for quick reads; `botDruidShortfall` reports the worst shortfall. `botScanTargets` / `botDistantStrike` re-project the column's plain-ground strength onto each target's terrain (`strIn`).
Margins re-tuned against the honest model: king 1.35 (≈63% on the fortune curve), hero 1.20 (≈58%).

### 64.2 Toby item 1 — Druid training
`botDrillOrder(G,pi,c)` (signature changed) Practises Druid before Tactical whenever the host carries a shortfall unit and Druid < 5. `botRecruitableTypes(prov,G,cmdr)` ranks recruits by strength FOR the commander who will lead them (co-located leader, else the recruiter), using `prov.race||'Human'` as the engine does.

### 64.3 Toby item 2 — a province a turn
- **Expansion pressure:** `botNoteLand` (once per turn, first thing in `runBotMovement`) tracks `_botLandPrev/_botStall` on the player object (survives saves). `botMarginFor` eases the margin −8% per stalled turn to floors 1.15 (king) / 1.0 (hero). Neutral guards take casualties even when they win, so a near-even assault still softens the target.
- **Distant strike:** `botDistantStrike` BFS through own/allied land (≤8 hops) for the staging province with the best winnable neighbour (−4/hop), walks as far as this turn's hops allow, and chains the attack on arrival. Runs BEFORE the lair raid and the blind frontier walk.
- **Sticky leadership:** `botGeneralship` +8 for a commander holding ≥3 units; `botRoles.want` never below the number of characters holding ≥3 units.
- **Chest:** `BOT_TUNING.chestShare` 0.35 (was a hard-coded /4). A/B over 8×20-turn games ×2 seeds: +12–15% land, wage shortfalls unchanged; 0.5 doubled shortfalls and eliminations, rejected.

### 64.4 Toby item 3 — more thorough expansion
- **Split hosts:** a leader with ≥10 units and an unarmed friendly character standing with it hands the weaker half (non-skeletal, non-naval, ≥3 units) over in phase 0 (`leave_army` by unit name); the recipient holds and drills that year and is a leader (sticky rule) the next.
- **Defend watches (Toby's rule this session):** `botFillOrders` now sets a `Watch` in phase 0 ONLY when other crowns have been met (`botHasMetPlayers`: non-neutral relation, or another player's land / armed host within 2 hexes of our land; cached per turn) AND a hostile host stands within 2 hexes (`botNearbyThreat`). The engine cancels a watch when a later phase holds a Move, so the general answers an incursion at the top of the year and still attacks. A general with no moves keeps a full-turn Hold watch once players are met; before contact spare phases are drill/practice only.

### 64.5 Not changed / flagged
- Bots still ignore fanaticism and fortune (random) and guard-side archery; the model is an estimate, not the engine.
- Splits fire only when an unarmed character is co-located (≈1 per game in self-play); a deliberate "send a hero to the host to receive a split" step would raise that — design call for Toby.
- Late-game total-land metrics saturate (maps of ~55 land provinces are mostly consumed by T15) and are dominated by bot-vs-bot wars; early-game rate (T1–T10) is the meaningful signal.

### Validation
`syntax.js` 0/0 both portals; `scan.js` 0 unresolved both; `scenario.js` ALL CHECKS PASSED; new `session_harness_0910b.js` (14 checks incl. 20k battle-model fuzz) ALL PASSED; regressions 0910 / 0909v / 0909u / 0908b / 0907 / mirror / autoturn / fod / mobile_map / bot_strategy / guardian_grid ALL PASSED; `bot_selfplay_harness` 0 errors.

## Session v2026.09.10-0733 — Magic-item lore; race/alignment discovery rework (17 new effect kinds); Evil doctrine on every capture path

### 63.1 Magic-item lore (Toby item 1)
Every base entry in `ALL_MAGIC_ITEMS_P` (183) and `MITHRIL_ARMOUR` now carries `lore` — one or two sentences of flavour that also state the effect in plain words. Name-clones inherit it through the existing spread in `_tripleLowerTierItems`. Items already in saves / lair hoards predate the field, so resolution is BY NAME: `ITEM_LORE_BY_NAME` (built right after `ITEMS_BY_TIER`), `itemLore(it)` (lore → name lookup → mithril → desc) and `itemLoreLines(items)` ("📜 The <name> (LEGENDARY) — <lore>").
- Lair clear: after the "hauls out …" line, one lore line per relic (hoard drops, `itemChance`/sd25 bonus finds, relics recovered from slain challengers).
- `buildPlayerReport` attaches `lore` to every item in a character's kit; the player portal's new `itemLoreTip()` wraps the item name at both listing sites (Chronicle character card and orders panel) with the same dotted-underline hover as `unitAbilityTip`.
Lore is written to survive the clone names (no hard object nouns where a clone differs — "Iron Heart Talisman"/"Charm of the Iron Vein" etc.).

### 63.2 Race/alignment discoveries reworked (item 2)
All 110 entries rewritten in place (IDs unchanged so saves migrate; the report builder now reads name/category/desc from `DISC_BY_ID` so re-worded discoveries display correctly in old games). 33 copy-paste generics replaced with effects feeding each race's/alignment's own signature mechanics. New data-driven kinds and their hooks (all read via `discSum`/`discEff` inside `runTurn`, or `discSumOf` at module level):
| kind | field | hook |
|---|---|---|
| `unitStr.king` | flag | `discUnitMult(...,heroChar)` — only when the King leads (rh10) |
| `skillGain` | pct | `trySkillGain` `_humanLearn` multiplier (rh05) |
| `maxHp` | hp | `computeMaxHp` via `_MAXHP_PLAYERS` (ro08) |
| `mithril` | extra | pc combatant `mithrilDR` (rd08) |
| `siege` | delta | both `defBonus` sites (rd09/ro10) |
| `consecrate` | cap | consecrate limit, still needs White ≥1 (ad03) |
| `bless` | pct | `_blessedMult` (+ log now prints the real %) (ad09) |
| `ctaQuality` | quality | Call to Arms garrison quality (ag05) |
| `unify` | pct | both contingent-unify sites (ag08) |
| `awakenCost` | delta | Awaken the Wild offering (au05) |
| `merc` | delta | mercenary hire + report price preview (an08) |
| `wildHunt` | turns | `_wildHuntUntilTurn` (ap08) |
| `bloodHarvest` | gold | per-unit take (ap09) |
| `terror` | pct | `spreadTerror` stores `_terrorPct` on the province; consumed by the terror penalty (ae03) |
| `plunder` | pct | `applyEvilConquest` loot fraction (ae09) |
| `harvestCost` | delta | Harvest the Field price (az06) |
| `graveDecay` | rate | end-of-turn grave rot (az08) |
Replaced: rh03 Drill Fields, rh05 Schools of the Sword, rh10 Household Knights; re05 Silent Scouts, re07 Sylvan Glamours; rd08 Mithril Craft, rd09 Siege Foundries; ro08 Thick Hides, ro09 (+15%), ro10 Battering Rams; ad03 Holy Sites, ad09 Rites of Plenty; ag05 Muster Rolls, ag08 Common Cause, ag10 Bulwark of the Realm; au05 Deep Roots; an05 Market Towns, an08 Hired Blades; ap08 The Long Hunt, ap09 Skull Tithe; ae03 Reign of Terror, ae09 Sack and Burn, ae10 Warmongers; az06 Corpse-Carters, az08 Embalmers. re01 now also covers Shadow Archers. `kingdomscallgamecontent.csv` discovery rows re-synced (33 rows).

### 63.3 Pre-existing gaps closed on the way
- **sd03 Siege Engines never applied in realm-vs-realm battles** (only vs neutral guards). The PvP `defBonus` site now applies sd03 (−0.15) together with the `siege` kind.
- **Evil conquest doctrine (loot / enslave) skipped four capture paths**: battle-resume capture, end-of-turn stand-off capture, unit-gain capture and the "drives the interlopers out" capture never called `applyEvilConquest` despite its comment claiming every site did. All four now call it (the function's own per-province-per-turn guard prevents double application). Found because the 0910 harness's Orc attack captured via the contested-hold path and produced no plunder line.
- `session_harness_0907.js` had a stale expectation (eligible pool 60; sd30 was retired earlier → 59) and seeded ae10 as a defOwn — updated.

### Validation
`syntax.js` 0/0 both portals; `scan.js` 0 unresolved both portals; `scenario.js` ALL CHECKS PASSED; new `session_harness_0910.js` (27 checks incl. 20k-iteration maxHp/recruitCost fuzz over random discovery sets, PvP siege + Muster Rolls + Reign of Terror + plunder + lore-by-name in a live turn) ALL PASSED; regressions 0909v / 0909u / 0908b / 0907 / mirror / autoturn / fod / mobile_map ALL PASSED.

### Open
- Rulebook untouched (it names no discoveries — secrecy rule holds; item lore is a chronicle/hover feature, not rulebook content).
- sd14 Taxation Records fork; melee hit-chance redesign; bell-curve rolls; mobile map investigation.


## Session v2026.09.09-2300 — Defend-reaction Chronicle routing; ≤1 primal home neighbour; own-figure title intel

### 62.1 Defend reaction + battle missing from the reacting hero's Chronicle (Toby item 1)
Root cause: `runDefendReactions` (and `runDefendMaterializedReactions`) run in the STAGE 2b pre-phase pass, outside any character's `_logCtx`, so their lines logged with `charId:null, phase:null`. The player portal files such lines in Realm Events (phase-less → bucket 99), so the reacting hero's own phase block had nothing — not even the phase header. Reproduced with `session_harness_0909v.js` on the 2156 build (reaction line charId null / phase null; reactor had no Fall entries).
Fix:
- Reaction / hold / stranded lines in both reaction passes now pass `charId:c.id, phase:ph` explicitly.
- PvP `emitBattle` sites now carry `charIds` for every commander on both sides: move-attack (`[c, pvpReinforcements…, defChar, defReinforcements…]`), stalled-battle resumption (`[attacker, defender]`), unit-gain battle vs enemy char, Defend-materialised reaction battle (and its "falls upon" line). The report's `_reattributeCharId` picks the viewer's own commander from `charIds`.
- Each extra same-side commander gets a `notifyTarget` pointer in their own section ("stands in the battle line beside X — the full account is under X" / "marches in X's host against P").
Note the existing `battleCommanders[prov@phase]` re-attribution already covered most battle lines for the defChar; the gap was the reaction lines and the reinforcing commander.

### 62.2 At most one Primal province may border a home (item 2)
New world-gen block after the alignment primal-neighbour pass: count primal land neighbours of `best`; if >1, keep the alignment-placed one (`best._alignPrimalId`, else the first) and `_reRaceProvince` the rest to a random humanoid race (the own-race pair guarantee never picks a primal, so it is untouched). 60 worlds × 2 realms × 3 alignment mixes: 0 violations; Pagan/Druidic homes keep exactly one. Rulebook map paragraph updated.

### 62.3 Melee hit chance — current formula (item 3, no change; for Toby's redesign)
`pcHitChance(att, def, 50)`: 50 + 10×(att.melee − def.melee) [effStat 0–5 scale incl. Duelist/Widowmaker/Relic Hunter/sd37] + temper `meleeHit` (Berserk 18, Brave 12, Cautious 0, Cowardly −10) − defender temper `defence` (Cautious 14, Cowardly 6, Brave 4, Berserk −10) − `hitPenalty` + `hitBonus` − `toHitReduce` (Invisibility 25) + 10 if sd33 Duelling Code, × defender `dodge`, clamp 40–95. Used for blows, free strikes and ripostes (riposte fires 50% of the time). Damage is `pcMeleeDamage`: rng(2,5) + ⌈meleeRaw/2⌉ + max(0,gap) + temper meleeDamage, −damageSoak (Cautious 1), +2 Warbringer Gauntlets, halved under meleeHalvedRounds.

### 62.4 Title intel opens with the holder's own figure (item 4)
Throne (own % of world tax base), Vaultkeeper (own treasury), Grand Marshal / Sea Lord (own strongest host/fleet with commander + `kindStr` strength; rivals' lines now show strength too), Monster-Bane (own champion + tally, rival's tally appended). Archmage / Hierophant / Deathpriest / Loremaster are already global or event-based — unchanged. Rulebook title paragraph updated.

### Validation
`syntax.js` 0/0; `scan.js` 0 unresolved both portals; `scenario.js` ALL CHECKS PASSED; `session_harness_0909v.js` passes (and fails 6 checks on the 2156 build — bug reproduced); 0909u / 0909s / 0908b / mobile_map / fod / mirror pass; `guardian_grid_harness.js` errors 0.

### Open
- Item 3 (bell-curve rolls) — parked by Toby.
- Melee hit-chance redesign — awaiting Toby's numbers (formula in 62.3).
- sd14 Taxation Records fork; 0909t C3 flake; mobile map investigation.

## Session v2026.09.09-2156 — Rally line, Spy-contest pursuit, no lair-win heal, Enemy Heroes split, map colour fix

### 61.1 Garrison rally line names the units (Toby item 1)
"the garrison (1) join the defence" → "the garrison (1 unit — Green Spearmen) join the defence". Leaderless hosts now show the same count + `describeArmy` roster. GM portal only, in the standing-troops-rally block of the defence form-up.

### 61.2 Encounter Character catch chance is a Spy contest (item 2)
`pursuitCatchChance`: **50% + 5%/pursuer Spy − 5%/quarry Spy**, ×2 if the quarry leads an army, clamped 5–100; friendly quarry still 100. The AK Spy table `SPY_PURSUE_PCT` (50/100/150/200/250) is deleted. The divide-by-distance was dead code — the roll only happens once both stand in the same province (`advancePursuit`), so distance was always 1. The pursuit log line now shows both Spy levels, the army-doubling note, and uses `fmtRoll`. Rulebook Encounter Character bullet updated.

### 61.3 No automatic heal after winning a lair fight (item 4)
The "catches their breath … recovering to X/Y HP" block (half of lost HP restored on a lair-clear win) is removed; the hero keeps the HP `resolveEncounter` wrote back. Duel wins never healed. Rulebook "Hit points & recovery" corrected (it claimed heroes heal "by winning fights").

**HP recovery inventory (engine, this build)** — for Toby's tuning pass:
| Source | Amount | Where |
|---|---|---|
| Rest order | 2–5; ×3 Divine realm; +2 Colossus; +10% max Iron Heart Talisman; + `rest/hp` discoveries (ad06 Healing Hands +4, ag06 Healers' Guild +3, Item-5 rest discoveries); sd28 Medical Arts → full | `case 'rest'` ~13790 |
| sd29 Herbal Lore | 40% of damage taken this turn, min 1, end of turn | ~17007 |
| White L6 Mass Healing | full HP, self + friendly/allied co-located, end of turn | ~17468 |
| Combat-use items | Potion of Healing 8, Elixir of Vigour 15, Salve 5, Draught of the Phoenix 20, Chirurgeon's Kit 10 (Human), Elvenmead 12 (Elf); HoT: Regeneration 3×4, Seed of the World-Tree 4×4 (Druidic) | `_CI_PRIORITY` heal/hot ~10381 |
| Brave temper Second Wind | 22% max, once per fight, below 30% | ~10675 |
| Drain / "heals half" | monster spells (vampire/hag) and `drain` item use | ~10155, ~10389 |
| Phoenix rebirth | back to 40% max once | ~10663 |
| Max-HP rise | gain carried into current HP | `syncMaxHp` ~3745 |
| Resurrect / Divine king return / Vanish safety-net | full / 50% / 50% | 14292, 17877, 11901 |
| Neutral wanderers | reset to full each turn end | ~17927 |
| Feature guardians | `healFeatureMonsters` full each turn | 15546 |

### 61.4 Enemy Heroes split from Wandering Heroes; map colour bug (item 5)
Report: enemy sightings had no heading and ran on under "Wandering Heroes" — now have their own **Enemy Heroes** heading (player portal).
Map root cause (reproduced with `wander_enemy_diag.js`): the report carries two per-province character lists — `worldMeta.provinces[].characters` (from `liveChars()`: ownerName/ownerColor/isWanderer/isNeutralGuard/armyCount, stealth-filtered) and `ownedProvinces[].characters` (bare `{id,name,isOwn,isKing}`). `renderMapIntoSvg` merged them as `{...worldMeta,...owned}`, so in **your own provinces** the bare list won and any enemy hero fell into the grey "?" wanderer bucket (`!ownerColor`) with no realm in the tooltip. Fix: (a) player portal keeps the worldMeta list on that merge; (b) GM `ownedProvinces.characters` now carries the same fields as `liveChars()` (belt-and-braces for any other consumer). Verified: enemy marker now draws in the realm colour and the tooltip reads "Name of Realm".

### 61.5 Bell-curve skill checks (item 3) — DESIGN FORK, not implemented
`d100()` is the one canonical roll but feeds ~33 sites (cast, to-hit, unify, spy, steal, pursuit, assassination…) plus ~23 raw `Math.random()*100`. A bell curve pushes outcomes to the extremes: two-roll average makes 70% ≈ 82% / 30% ≈ 18%; three-roll ≈ 88% / 12%; 50% unchanged. Awaiting Toby: scope (all d100 vs skill actions only) and shape (2- or 3-roll). Recommend a separate `d100bell()` rather than changing `d100()`.

### Validation
`syntax.js` 0 errors both portals; `scan.js` 0 unresolved both; `scenario.js` ALL CHECKS PASSED; new `session_harness_0909u.js` (formula table, 200k fuzz, text guards) passes; 0909s / 0908b / mobile_map / fod / mirror pass. **Known pre-existing flake:** `session_harness_0909t.js` C3 ("report lists him under Wandering Heroes") fails on the untouched 2140 build too and only fires when C0 finds a demoted guard (~1 in 3 runs); probable cause is visibility (P0's attacker was repelled, so the province is neither owned nor co-located), not classification. Not touched this session.

### Open
- Item 3 decision (scope + shape).
- sd14 Taxation Records fork (still open).
- 0909t C3 flake above.
- Mobile map rendering (earlier investigation).

## Session v2026.09.09-2059 — Skeletal upkeep is 1g everywhere; Wild Hunt priced at one beast

### 59.1 Skeletal units: a flat 1g in every wage path
The rulebook has always said skeletons cost a flat 1g (three separate places), and the two paths
that actually bill the player were correct. Three *other* paths priced them at their full type cost,
so a skeletal Elder Dragon was quoted at 8g. All now use `a._isSkeletal?1:…`:

| Site | Was | Now |
|---|---|---|
| ~4960 `botUpkeep` (field armies) | full type cost | 1g |
| ~4963 `botUpkeep` (garrisons) | full type cost, and billed `_temporary`/Wild Hunt units | 1g; wage-free units skipped |
| ~7097 report wage forecast | full type cost | 1g |

Already correct and left alone: the engine wage sum (~17220), the disband sort and per-unit cost in
the unpaid-wages loop (~17254, ~17263), and `buildPlayerReport`'s per-army `cost` (~6480).

Effect: the player's forecast now matches the bill, and the bot solvency guard stops reserving
budget it never spends — an Undead bot was previously over-reserving badly enough to suppress
recruitment. `bot_selfplay_harness` still reports 0 errors.

### 59.2 Rite of the Wild Hunt priced at ONE beast (Toby's decision)
Was a flat `WILD_HUNT_COST=6`. Now the offering costs whatever a single one of the bound creatures
costs, however many answer: two Stone Giants (5g each) cost **5g**, not 6g and not 10g.

- New module-scope `wildHuntPrice(type)` → `ARMY_COST_MASTER[type]||WILD_HUNT_COST`. Declared as a
  **function**, so the `ARMY_COST_MASTER` lookup happens at call time — no load-order TDZ risk.
- `WILD_HUNT_COST` survives only as the fallback for a primal type missing from the master table.
- The rite computes `_huntCost` once and uses it for the affordability check, the deduction and the
  log line ("the price of a single beast, whatever number answer").

**Both order forms now read the price off the report rather than re-deriving it.** Both
`provinceOrderData` builders (`buildGMProvinceOrderData` ~1889 and `buildPlayerReport` ~7073) emit
`wildHuntType` and `wildHuntCost`, resolved exactly as the engine resolves them — first primal type
in `p.armyTypes`. This also closes a latent gate mismatch: the player form's `canHunt` used
`CREATURE_ARMIES_UI`/`MONSTER_ARMIES_UI` against the *display-filtered* `armyTypes` list, which
could disagree with the engine's `PRIMAL_ARMY_DEFS_P` check on the unfiltered list.

Note there are TWO provinceOrderData builders — editing only the GM one left the player form blank
(caught by harness E3/E4). Worth remembering.

Rulebook Pagan bullet updated: two Veterans, price of one, no wages, until the end of the following
turn. Skeletal upkeep text needed no change — it was already right.

### 59.3 Validation
`syntax.js` 0 errors both portals · `scan.js` 0 unresolved both portals · `scenario.js` ALL CHECKS
PASSED · new `session_harness_0909s.js` (T/D from 0909r, plus E0–E4 rite priced at one beast with
report/engine agreement, F0–F4 skeletal 1g across engine bill, player forecast, per-unit report cost
and `botUpkeep`) ALL PASSED · regressions `0909r`, `0909b`, `0908b`, `0909o`, `mirror`, `autoturn`,
`bot_strategy`, `bot_selfplay` (0 errors) ALL PASSED.


## Session v2026.09.09-2140 — Forecast/collector parity; troopless guards become wanderers

### 60.1 "Your Realm" forecast now equals the end-of-turn collector (Toby: player saw different income/wages in Realm Events vs Your Realm)
Root cause: `buildTurnReport`'s forecast had drifted from the collector in four places.

| Modifier | Collector | Forecast was | Now |
|---|---|---|---|
| Consecrate (+50%) | applied — it is PERSISTENT (`player.consecratedProvIds`, broken only when the province changes hands) | omitted as a "one-turn transient" | included, same position/rounding; itemised as `consecG` |
| Hero wages: Granaries sd17 + heritage/creed `heroWage` discoveries | `max(1, pay − 1 − n)` then sd38 halving | `pay` then sd38 only | mirrored; itemised as `heroWageDisc` |
| Army wages: Host-Leader minor title (−1g per unit led) | applied | omitted | applied (title-gated like the other perks); itemised as `hostLeaderG` |
| Interest (sd12 / creed) | on treasury at collection | on treasury at report time | unchanged — inherent to a forecast; noted in the box |

Deliberate omissions remain only the same-turn transients: Bless, Earthquake no-tax, Sabotage, Orc war-spoils half-wage.
Player portal: Tax Income box itemises consecrated ground; Army/Hero Wages boxes show "after −Ng …" lines; the projection note no longer calls Consecrate a one-turn effect.

### 60.2 Province "captured without a battle" with the chieftain still inside (Toby: wandering hero on map, absent from report and Hire)
Root cause: in `combatVsNPC`'s guard-WINS branch each defending unit still rolls `winDeathChance*0.5` to fall. A 1–2 unit guard can therefore repel the attack and lose every unit, keeping `_isNeutralGuard=true` with `armies=[]`. The move-in check (`neutralGuard` ~12367) only counts a guard who leads troops, so the returning hero "claimed" the land with no battle and the troopless guard stayed inside a player-owned province — the map showed him, sightings filed him under Local Chieftains (not Wandering Heroes), and the Hire list excludes guards.

Fix (three layers):
- `combatVsNPC` won-branch: a surviving guard whose last unit fell is demoted on the spot (`demoteGuardToWanderer`) with a narrative line ("…guardian no more — a masterless hero now").
- New module-scope `demoteGuardToWanderer(h)` / `normaliseStrandedGuards(gs)`: any living guard with no troops, or standing in a player-owned province, becomes a plain wanderer ("(wandering)" tag; armies left as they are).
- `normaliseStrandedGuards(G)` runs at turn start (after the race normaliser) and again after the final `reconcileProvinceCharacters()` before reports. The turn-start pass repairs the live game's existing case on the next run.

Not a bug: a wanderer in an OWNED province with no character present appears on the map and in Wandering Heroes but not in the Hire dropdown (Hire needs a character there; Neutral Broker excepted).

### 60.3 Validation
`syntax.js` 0 errors both portals · `scan.js` 0 unresolved both portals · `scenario.js` ALL CHECKS PASSED · new `session_harness_0909t.js` (+ `_partB.js`: A0–A7 forecast==collector incl. Consecrate/Granaries+Loyal Retainers/Host-Leader; B0–B7 stranded guard repaired and agreed by map/sightings/Hire; C0–C3 in-battle demotion via real replayed turns) ALL PASSED · diagnostic `wander_diag.js` (825 map/sightings/hire samples, 0 mismatches) · regressions `0909s`, `0909r`, `0909o`, `0908b`, `mirror`, `autoturn`, `bot_strategy`, `bot_selfplay` (0 errors) ALL PASSED.
