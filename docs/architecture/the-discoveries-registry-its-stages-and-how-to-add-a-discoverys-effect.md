# The discoveries' registry: its stages, and how to add a discovery's effect

The rule registry is described in [the rule registry and the one source for shared rules](the-rule-registry-and-the-one-source-for-shared-rules.md).
This file is its part for the discoveries (plan P1-19's discoveries family, from P1-19aa).

## What a discovery's effect is

A **discovery** is a row of `SAGE_DISCOVERIES_P` (`src/content/kingdoms-call-data.ts`): its id (`'sd40'`), name,
field of study, text (`desc`), and the race or alignment it needs, if any. It has one or two **effects** (`effect`,
`effect2`). Each effect names its **kind** (`'unitStr'`) and holds its numbers and filters (`pct`, `delta`, `types`,
`terrain`, `side`, `home`, …). Since P1-19aa every effect names a kind: the 15 discoveries the engine read by their id
(War Academy, Flanking Tactics, Dragon Taming, …) named a `type` before.

A realm holds its discoveries by id (`discoveries`, each `{ id, … }`), and every number is read from the discovery's
row by that id. So a save never holds an effect, and an old save's discoveries work as content says today.

A **kind of effect** is one row in `src/content/discovery-effects-their-kinds-numbers-and-words.ts` and one entry in
`src/engine/rules/the-registry-of-discovery-effects.ts`, keyed by the same slug (`'unit-strength'` for `unitStr`). Its
effects are in `src/engine/rules/discoveries/`, a file per group of stages.

- **A row** names the kind as `SAGE_DISCOVERIES_P` writes it, and holds the numbers the code writes for every effect of
  the kind, each with how a text would write it: the ceilings (a unit's strength ×1.30 at most, however many effects a
  realm stacks; the own ground +30% at most), the floor (a quarter), Veteran Training's +1 and the Golden Shield's ×2. No text states them: the rulebook keeps the discoveries secret by design.
  A row exists only for a kind whose effect the registry holds.
- **The registry** ends `satisfies Record<DiscoveryEffectSlug, DiscoveryEffectEntry>`, both ways, as the other
  registries do: a row with no entry, or an entry with no row, fails to compile. Its stages are the hook points' own
  (one union, `TheStagesOfEachHookPoint`, in `the-registry-of-content-effects.ts`); its orders are its own list,
  `THE_ORDER_OF_EACH_STAGE_OF_THE_DISCOVERIES`. Each stage holds one kind so far.
- **A runner is handed the realm.** It finds the realm's effects of its stage's kind by the realm's discoveries' ids
  (`theEffectsOfAKindARealmHolds`, in the table `DISC_BY_ID`): in the order the realm holds its discoveries, `effect`
  before `effect2`, the order a product or a sum of decimals runs in. It hands each effect, with the stage's facts, to
  the kind's effect, which returns its number (or nothing, where its filters don't hold), and adds, multiplies or asks
  them as the old reader did. The old readers of `src/engine/discoveries.ts` (`discEffectsOf`, `discSum`, …) ask the
  same finder, so a kind not yet taken is found the same way.
- **The unit-class tests** the filters need (`discUnitIs`, `discUnitMatch`, the class sets `DISC_CLS_SETS`,
  `ARMY_RACE_OF_TYPE`) are in `src/engine/rules-on-plain-values/units-a-discoverys-effect-reaches-by-type-class-race-and-quality.ts`,
  which the engine, the views and the registry's effects all read.
- **No effect draws a die.** An effect that rolls returns its chance, and the resolver draws where it drew before.

## The stages written so far

**The army's strength** (P1-19aa, `discoveries/a-realms-discoveries-in-its-armys-strength.ts`):

- `strength`'s **a realm's discoveries strengthen a unit** (`unitStr`; `discUnitMult`, which `armStr` asks). It is
  handed the unit (its type, race and quality, and whether it is risen dead), the ground, whether its side attacks,
  whether the king leads it, and whether a commander leads it (a garrison standing alone has none). It returns the
  factor, `1 + pct`, or nothing. The runner multiplies them and caps the product at the kind's ceiling.
- **A realm's discoveries add to a siege** (`siege`; both battles): handed the attacker's units. It returns its `delta`
  if it names no unit types, or the attacker has one of them. The runner adds them.
- **A realm's discoveries fortify its own ground** (`defOwn`; both battles, the defending realm's): handed whether the
  province is the realm's home, as a question. Only an effect that needs the answer asks it, because asking may fix a
  realm's home (`homeProvinceIdFor` writes it the first time). The runner adds the shares and caps the sum at the
  kind's ceiling.
- **A realm's discoveries stir a side's fanaticism** (`fanatic`; both battles, before each side's roll): handed the
  side, the ground and the force (`discFanaticApplies`, now the effect's file's). The runner adds them; the battle rolls
  as before.
- **A realm's discoveries let a beast follow without its Druid** (Dragon Taming, `flyingNoDruid`; `dragonTamed`):
  handed the unit's type. The player portal's copy stays (P1-11); the parity test compares them.
- **A realm's discoveries add to the whole army** (both battles): no entry holds it. War Drums, the one such discovery,
  has been an ordinary unit strength effect since 2026-09-21, so its runner returns 0, as `discoveryArmyBonus` did
  (Parked "Three dead paths in `discoveries.ts`").
- `aHerosStanding`'s **a realm's discoveries add to a caster's chance** (`cast`): handed the school and where he casts,
  as the effect's `ctx` names it (`'battle'`, `'action'`, `'duel'`). Asked by `applyPreBattleMagic` and the hero's cast
  in `combatVsNPC`, and since P1-19ac by `castChanceFor` (the Cast Spell order, and the report's odds) and
  `pcCastCombatSpell`.

**The lines and the fates** (P1-19ab, `discoveries/a-realms-discoveries-in-its-lines-and-its-units-fates.ts`):

- `strength`'s **a realm's discoveries weight the lines behind the front** (Flanking Tactics, `flankBonus`). The effect
  returns its row's `lines`. It has two runners. One is handed a side's realm and says whether it holds such an effect,
  so the grid weights that side's lines (both battles, and `commandScore`). The other is handed nothing: it gives the
  weights of the first discovery in content with such an effect, because the grid asks `flankLineMults` with no realm.
  `flankLineMults` keeps its fallback for a row with no list of four.
- `fate`'s **a realm's discoveries spare a beaten unit** (`deathRed`; `discDeathMult`, which both battles ask): handed
  the unit and its side. An effect for one side reaches no unit whose side isn't given. The runner adds the shares cut
  and gives the multiplier left on the chance of death, never below the kind's floor (×0.25, a quarter).
- **A realm's discoveries promote a unit** (`promo`; `discPromo`): handed the unit. The runner adds the shares.
- **A realm's discoveries carry a fallen unit home** (Homeward Song, `elvenEscape`; `recordBattleGraves`): the points
  added to a fallen Elven unit's chance of slipping away home. The runner adds them; the graves roll as before.
- **A realm's discoveries drag a hero from the field** (Battlefield Surgery, `nearDeathSurvival`; `handleHeroDeath`):
  the chance, as its row writes it (0.2 for a row with none: the old fallback, Parked). The runner gives the first
  effect's chance, or nothing if the realm holds none; the hero's death rolls as before.

**The fighter and his rise** (P1-19ac, `discoveries/a-realms-discoveries-in-its-heroes-fights-and-their-rise.ts`):

- `personalCombat`'s **a realm's discoveries steady a fighter's aim** (`duelHit`; `pcHitChance` and `pcArrowHitChance`,
  after the wards): handed what the foe is (a character or a monster) and his kind (`pcFoeCat`), as a question only an
  effect against the undead asks. The runner adds the points.
- **A realm's discoveries add to a fighter's skills** (Veteran Training, `skillBonusCombat`): the kind's +1 to his Melee
  and his Archery. The runner gives the first effect's, so a realm holding it adds it once. Asked by `pcCharCombatant`
  (his four figures, under the ceiling of 9) and by `extraSkillBonuses` for his card: one rule, two readers.
- **A realm's discoveries strengthen his Mithril** (`mithril`; `pcCharCombatant`): its `extra`, after the suit's own 2.
- `experience`'s **a realm's discoveries add to a skill's rise** (`skillGain`; `trySkillGain`, before it rolls): handed
  the skill; an effect that lists skills reaches only those. The runner adds the shares.
- **A realm's discoveries harden the king** (Order of the Golden Shield, `kingKillHpX2`; `awardHpRoll`): the kind's ×2.
  The runner gives the first effect's factor, or nothing; the king's gain and his earned hit points are multiplied by
  it.

**The heroes' orders and the realm's sight** (P1-19ad, `discoveries/a-realms-discoveries-in-its-heroes-orders-and-its-sight.ts`):

- `orderOutcome`'s **spy stages**: a realm's discoveries **add to a spy's chance** (`spy`), **cut a rival spy's chance**
  (`counterSpy`, the realm that holds the province spied on), **add to spying on a hero** (`spyChar`) and **add to
  catching a spy** (`catchSpy`, the realm of the hero spied on). All four are asked by `resolveSpyOrder` and handed where
  the spy acts: the ground, and whether it is coastal or the realm's home, as questions only an effect scoped to them
  asks. Each effect returns its share, and the runner adds them. The report's odds ask the spy's stage with no province
  (`THE_REPORTS_ODDS_NAME_NO_PROVINCE`): an effect for a ground or a coast doesn't count, one for a home does, as before.
- **A realm's discoveries keep a spy's success quiet** (Disguise Techniques, `spyDisguise`): the chance, as its row
  writes it (0.5 for a row with none: the old fallback, Parked). The runner gives the first effect's; the order rolls.
- **A realm's discoveries add to exploring** (`explore`): the factor on the ground it lists. The runner multiplies them,
  for the Explore order and for `discExploreMult`, which the report ships: one rule.
- **… lengthen the wild hunt** (`wildHunt`), **… add to a lair's gold** (`lairGold`, handed the hero's race too) and
  **… add to a lair's item** (`itemChance`): the runners add them.
- **… add to research** (`research`): handed whether the field studied is the realm's own creed, as a question. The
  report's odds name no field. **… add to practice** (`practice`): handed the skill. The report's odds name none, and
  list each named skill's share from a second runner.
- **… add to a rest's heal** (`rest`): handed whether he rests on his realm's ground, whether it is its home (a
  question, asked only there), and the ground. **… heal a resting hero in full** (Medical Arts, `restFull`): yes or no.
- `visibility`'s first stages: **a realm's discoveries spot a hero lurking in its province** (`spotLurker`;
  `spotEnemyInOwnedProvince`, before the chance's bounds), handed the ground, and its home and coast as questions; and
  **… map the provinces around an explorer** (Ancient Lore, `adjacentReveal`): the share, 10 for a row with none (the
  old fallback, Parked). What a realm sees is unchanged: every realm's report is identical.

**The recruits and the realm's works** (P1-19ae, `discoveries/a-realms-discoveries-in-its-recruits-and-its-works.ts`):

- `orderValidity`'s **a realm's discoveries waive the hiring ban** (Diplomatic Protocols, `alignmentHire`): yes or no.
  Asked by the Hire Hero order, the Broker, the Charm, and `playerView` for the wages the report quotes: one rule.
- `orderOutcome`'s **… add to the consecrations a crown may hold** (`consecrate`; Consecrate): handed the consecrator's
  White skill. It returns its `cap` if he has the White its row needs (a row's 0, or none, is read as 1, as before).
- **… raise a call to arms' quality** (Muster Rolls, `ctaQuality`): the quality and its chance, as the row writes them.
  The runner lists them; the Call to Arms order rolls each chance in turn and takes the first quality, as before.
- **… cut the corpse-carters' cost** (`harvestCost`) and **… cut a company's price** (`merc`, handed the band's type):
  the gold each adds (a cut is less than 0). The runners add them, for the order and for the report's prices.
- **… cut a unit's price** (`recruitCost`; `realmRecruitCost`, which the order and the report ask): handed the unit's
  type and the price so far. Each effect that reaches the unit adds its gold, then multiplies by its factor and rounds
  up; the runner hands each the price the one before left, in the order they are found.
- **… raise a recruit's quality** (`recruitQ`; `discRecruitQChance`, at most 1) and **… add to a Bless** (Rites of
  Plenty, `bless`): the runners add the shares; the Recruit order rolls as before.

**War's spoils and the march** (P1-19af, `discoveries/a-realms-discoveries-in-wars-spoils-and-the-march.ts`):

- `fate`'s **a realm's discoveries add to a blood harvest** (Skull Tithe, `bloodHarvest`; `bloodHarvest`): the gold for
  each enemy unit destroyed. **… add to the terror a victory leaves** (Reign of Terror, `terror`; `spreadTerror`): the
  share each stack costs, for the provinces gripped and for the line. **… add to a conquest's plunder** (`plunder`;
  `applyEvilConquest`): handed the province's ground; its share on any ground, or on the terrains its row names.
- `movementCost`'s first stages: **a realm's discoveries add to a march** (`move`), handed the unit. Its `extra`, if
  its row's race, class (the skeletal dead too) or types reach it. The callers keep their own guards (a land unit of
  Speed 1–2, no flyer, no ship): `computeMovePoolMax`, `garrisonMoveRate` (the view's garrisons) and the report's
  speeds. The report hands its own copy of the unit, as before, so its speeds are unchanged. **… help converging
  columns unite** (Signal Fires, `unify`): the points it adds to both of `resolveMoveOrder`'s unify rolls.

## How it is checked

- `tests/unit/the-rule-registry-holds-each-effect-once-in-the-order-of-its-stage.test.ts`: each effect once in its
  stage's order, each row's kind a kind of `SAGE_DISCOVERIES_P`, no two rows of one kind, and every kind of content with
  its row or listed as not yet taken (each row of the family shortens the list, to none).
- `tests/static/the-rule-registry-fails-to-compile-when-an-effect-and-its-content-row-part.test.ts`: a row with no
  entry, and an entry with no row, fail to compile.
- `tests/static/the-resolvers-the-discovery-registry-has-taken-name-no-discovery.test.ts`, with the ratchet's
  `discoveryChecksInEngine` (94 before P1-19aa, 83 after it, 71 after P1-19ab, 59 after P1-19ac, 41 after P1-19ad, 31 after P1-19ae, 23 after P1-19af): the functions taken name no
  discovery's id and no kind, and the engine's checks outside the registry only fall. A string that is a kind's name
  but means something else (the Evil doctrine `'terror'` in both battles; the Spy skill `'spy'`, a line's type
  `'explore'`) is listed beside its function.
- `tests/static/each-discoverys-numbers-are-in-its-text.test.ts`: each number of each effect is in its discovery's
  `desc` (365 of 368; the 3 gaps listed with why).
- `tests/unit/the-discovery-effects-no-matrix-game-meets-keep-their-values.test.ts`: the effects the matrix's games
  meet 0 times or can't show (the own ground, P1-19aa; Homeward Song, P1-19ab; an aim against the undead, Veteran
  Training in a fight and on the card, P1-19ac; each spy's, explorer's, scholar's and rester's effect on and off its
  ground, coast or home, P1-19ad; each recruit's and realm's work's, P1-19ae; war's spoils and the march, P1-19af), and
  the effects on rows the content doesn't write. `tests/unit/what-each-realm-may-see-of-the-world.test.ts` checks the
  wages and prices the view and the report quote with the discoveries of P1-19ae, and the march rates of P1-19af. Each later row adds
  its own.

## How to add a discovery's effect

1. **Of a kind the registry holds:** write the discovery's row in `SAGE_DISCOVERIES_P`, its effect with the kind, its
   numbers and its filters, and its `desc` stating every number (the words test reads it). Nothing else changes.
2. **Of a new kind, or one not yet taken:** add its row to the kinds' content file (the kind, and any number the code
   writes for every effect of it), its effect to the stage's file under `src/engine/rules/discoveries/`, and its entry
   and its place in the stage's order. Take it off the registry test's list of kinds not yet taken. A new stage's
   signature goes into `TheStagesOfEachHookPoint`, with its runner in the discoveries' registry, and the resolver asks
   the runner.
3. **A new id is never an old one:** see [retired discovery ids](adding-or-changing-content-units-orders-and-discoveries.md#retired-discovery-ids-are-never-reused).
