// The battle against a province's defenders (combatVsNPC, src/engine/battle/battles-against-province-defenders.ts), its
// fourth stage, B-06bc: the terrain's notes and the battle lines with every multiplier (the battle proof's N8), the
// fortune of battle (N9), and the stat block and the result (N10), moved here as they were, the same statements in the
// same order. combatVsNPC calls it where they stood, after the defenders' pre-battle phases (n5-to-n7-…), and hands it
// what the set-up and the attacker's phases returned, as they are. It returns what the later stages read, each final
// here: the deploy, whom each company faced, the two sides' strengths and the fortune, the margin and who won, and the
// skills the battle may train. The two fronts' widths (`lineWidth`, `defLineWidth`) are written and read in this stage
// alone, so they stay its own lets and the battle's state (its type and table in n3-to-n4-…) gains no field. The battle
// proof (tools/proof/README.md, section 8) finds N8's, N9's and N10's anchors in this file; nothing above N8's draws a
// die.
import {
  KC_A_COMMANDERS_TACTICAL_AND_NAVAL_IN_A_BATTLE,
  KC_A_CURSED_COMMANDERS_SKILL_IN_A_BATTLE,
  KC_THE_DEFENDERS_EDGE_AND_A_REALMS_HOME_GROUND_IN_A_BATTLE,
  KC_THE_MASTERY_ORDERS_FACTORS_IN_A_BATTLE,
  PRIMAL_ARMY_DEFS_P,
} from '../../../content/kingdoms-call-data.ts';
import { kcRng } from '../../rng.ts';
import {
  theAlignmentASideFightsUnder,
  theChanceOfZealARealmsAlignmentGivesASide,
  theFactorConsecratedGroundWeakensAnAttackersHostBy,
  theFervourOfASide,
} from '../../rules/the-registry-of-alignment-abilities.ts';
import {
  battleDeploy,
  battleFacedClauses,
  battleGridLines,
  battleLineTotal,
  battleMovesLine,
  battleScout,
  battleScoutLine,
  battleWidthLine,
  rollBattleWidth,
} from '../lines.ts';
import { ARCHERY_MISSILE_PCT, UNDEAD_SKEL_HERO_FAN, UNDEAD_SKEL_KING_FAN, ladderLines } from '../ladder.ts';
import { tacMulted } from '../../units/movement.ts';
import {
  AERIAL_TYPES,
  SEA_TYPES,
} from '../../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { battleFortune } from '../fortune.ts';
import { isConsecrated } from '../../world/the-marks-on-a-province-consecrated-ground-terror-and-enslave.ts';
import {
  doARealmsDiscoveriesWeightTheLinesBehindTheFront,
  whatARealmsDiscoveriesAddToASidesFanaticism,
  whatARealmsDiscoveriesAddToTheWholeArmy,
} from '../../rules/the-registry-of-discovery-effects.ts';
import { doesTheWinnersRaceFlagTheProvinceItWonABattleIn } from '../../rules/the-registry-of-the-race-gifts.ts';
import { effStat } from '../../heroes/effective-skills-and-hidden-heroes.ts';
import {
  SEA_LAND_PENALTY,
  finishSide,
  illusoryTerrainMult,
  isAirborneAtSea,
  ladderRow,
} from '../terrain-and-unit-strength.ts';
import type { CommandMultiplier } from '../terrain-and-unit-strength.ts';
import type { BattleGrid } from '../lines.ts';
import { druidShortfallLine, terrainNoteList } from '../battle-report-lines-and-force-markers.ts';
import { raidLandedHere } from '../raid-the-coast-and-landing-parties.ts';
import { theFortuneAsTheLineTellsIt } from '../the-facts-a-battles-lines-record.ts';
import { narrateAll, narrate } from '../../turn/events-and-their-audiences.ts';
import type { TurnContext } from '../../turn/context.ts';
import type { HeroInABattle, ProvinceInABattle } from '../../army-tables.ts';
import type { AForceWideModifierOfASide, TheDefendersOfAProvince } from '../the-facts-a-battles-lines-record.ts';
import { asItsGuardReadsIt } from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import {
  SEA_AIRBORNE_FLYER_PENALTY,
  SEA_AIRBORNE_LAND_PENALTY,
} from '../the-strength-a-host-carried-over-the-sea-by-flyers-keeps.ts';
import type { AUnitInTheBattleAgainstTheDefenders } from './n0-to-n2-the-set-up-the-duel-and-the-sides-to-the-home-ground.ts';
import type { WhatTheSetUpOfTheBattleAgainstTheDefendersHandsOn } from './n3-to-n4-the-attackers-pre-battle-magic-army-spells-archery-flak-and-breach.ts';
import type { WhatTheAttackersPreBattlePhasesInTheBattleAgainstTheDefendersHandOn } from './n5-to-n7-the-defenders-pre-battle-magic-archery-and-army-spells.ts';

/** The fourth stage of the battle against a province's defenders: the terrain's notes and the battle lines with every
 *  multiplier, the fortune of battle, the stat block and the result. It returns what the later stages read. */
export function theGroundsNotesTheLinesTheFortuneAndTheResultOfTheBattleAgainstTheDefenders(
  turnContext: TurnContext,
  c: HeroInABattle,
  prov: ProvinceInABattle,
  neutralGuardHero: HeroInABattle | null | undefined,
  theSetUp: WhatTheSetUpOfTheBattleAgainstTheDefendersHandsOn,
  theAttackersPhases: WhatTheAttackersPreBattlePhasesInTheBattleAgainstTheDefendersHandOn,
) {
  const {
    G,
    theAttackerAsTheGuardsReadHim,
    narrative,
    armies,
    defenders,
    theAttackersRealm,
    _fearAtk,
    _npcAtkMorale,
    _npcDefMorale,
    cName,
    atkSide,
    defHero,
    tactSkill,
    isLandBattle,
    effectiveTactBonus,
    defBonus,
    homeBonus,
    atkHomeBonus,
    MISSILE_ARMIES,
    archSkillAtk,
    archMissileBonus,
    navalSkillAtk,
    navalFleetBonus,
    _provCoastal,
    playerAlign,
  } = theSetUp;
  const { defTactLvl, defTactBonus } = theAttackersPhases;
  // ── TERRAIN MODIFIER NOTES ──
  {
    const _tn = terrainNoteList(armies, prov.terrain);
    if (_tn)
      narrate(narrative, {
        kind: "the terrain's effect on the attacker's units",
        terrain: prov.terrain,
        cName: atkSide,
        unitsTheTerrainMarks: _tn,
      });
  } // 2026-09-23d: shared formatter
  if (!isLandBattle && armies.some((a) => !AERIAL_TYPES.has(a.type) && !SEA_TYPES.has(a.type))) {
    // 2026-09-23e: flying beasts are not "land units at sea"
    if (isAirborneAtSea(armies))
      narrate(narrative, {
        kind: 'hosts airborne over open water fight at a penalty against the defenders',
        seaAirborneLandPenalty: SEA_AIRBORNE_LAND_PENALTY,
        seaAirborneFlyerPenalty: SEA_AIRBORNE_FLYER_PENALTY,
      });
    else
      narrate(narrative, {
        kind: 'land units fight at sea at a penalty against the defenders',
        seaLandPenalty: SEA_LAND_PENALTY,
      });
  }

  // ── BATTLE LINES ──
  // (The old count-based "N flanking units" line is gone — it described a mechanic that no longer existed.)
  const atkFlankDisc = doARealmsDiscoveriesWeightTheLinesBehindTheFront(theAttackersRealm);
  const terrainFront = rollBattleWidth(prov.terrain); // 2026-10-11: rolled once per battle, shared by both sides; the scout may take one wider or narrower (battleDeploy)
  let lineWidth = terrainFront;
  // Illusory Terrain: if this province is cloaked by an enemy's illusion, the attacker is
  // disoriented — each unit fights as though caught in the worst ground for its kind (min −15%).
  const _illCasterN = prov._illusoryTerrain ? prov._illusoryTerrain.caster : null;
  const _atkIllActive = _illCasterN != null && c.player !== _illCasterN;
  if (_atkIllActive)
    narrate(narrative, {
      kind: "the illusory ground of the province confuses a side's forces",
      provName: prov.name,
      sideName: atkSide,
    });
  // 2026-09-23b: rows built by ladderRow so the Battle-stats ladder names every modifier and
  // reconciles with rawAtkStr exactly. Same multipliers as before, same order-independent product.
  const armiesWithStr = armies
    .map((a) => {
      const cmd: CommandMultiplier[] = [];
      if (MISSILE_ARMIES.has(a.type))
        cmd.push({
          key: 'arch',
          reason: { kind: 'archery', level: archSkillAtk, multiplier: archMissileBonus },
          m: archMissileBonus,
        });
      if (SEA_TYPES.has(a.type))
        cmd.push({
          key: 'nav',
          reason: { kind: 'naval', level: navalSkillAtk, multiplier: navalFleetBonus },
          m: navalFleetBonus,
        }); // Naval lifts fleets on land AND sea
      else
        cmd.push({
          key: 'tac',
          reason: { kind: 'tactical', multiplier: tacMulted(effectiveTactBonus, c) },
          m: tacMulted(effectiveTactBonus, c),
        }); // land AND air units (flyers since 2026-09-23c)
      if (_atkIllActive)
        cmd.push({
          key: 'ill',
          reason: { kind: 'illusory terrain', multiplier: illusoryTerrainMult(a.type) },
          m: illusoryTerrainMult(a.type),
        });
      return ladderRow(
        turnContext,
        a,
        c,
        playerAlign,
        prov.terrain,
        {
          force: armies,
          enemyForce: defenders,
          isAttacker: true,
          amphibious: !!c._amphibiousAssault,
          coastal: _provCoastal,
          reignOfFear: _fearAtk,
        },
        cmd,
      );
    })
    .sort((x, y) => Number(y.fly) - Number(x.fly) || y.base - x.base); // flying first, then strongest

  battleLineTotal(armiesWithStr, lineWidth, atkFlankDisc); // undamaged, before whole-force (2026-09-24); its total read by nothing, the call kept as it was
  // (2026-09-23b: the old comment here said the Archery strength bonus had never been applied — it
  // was, via archMissileBonus above. Archery is now +5%/level on missile units by design, and the
  // Battle-stats ladder names it on the units it reached.) Show Druid shortfall warnings
  effStat(turnContext, c, 'druid'); // (read as it always was; its value has been read by nothing since 2026-09-23d)
  {
    const _dl = druidShortfallLine(turnContext, atkSide, c, armies, playerAlign);
    if (_dl) narrate(narrative, _dl);
  } // 2026-09-23d: one line, not one per unit
  // (2026-09-23d: the standalone "Naval N grants +x%" line is retired — the ladder names it.)
  // Defender missile bonus — mirrors the attacker's. If the defending force has a commander
  // (defHero — a leaderless garrison passes null), their Archery lifts the garrison's bow and
  // crossbow units by +10% per level, exactly as it does for an attacker.
  const archSkillDef = defHero ? effStat(turnContext, defHero, 'archery') : 0;
  const defArchMissileBonus = 1 + archSkillDef * ARCHERY_MISSILE_PCT; // +5%/level (2026-09-23b) · sd07 Fire Arrows now via armStr
  // the defending commander's Naval lifts the fleets / sea-beasts they lead — land or sea —
  // exactly as the attacker's does.
  let navalSkillDef = defHero ? effStat(turnContext, defHero, 'naval') : 0;
  if (defHero?._curseHalveStat === 'naval')
    navalSkillDef = Math.floor(navalSkillDef / KC_A_CURSED_COMMANDERS_SKILL_IN_A_BATTLE.theNumberItIsDividedBy);
  const defNavalFleetBonus =
    1 +
    navalSkillDef * KC_A_COMMANDERS_TACTICAL_AND_NAVAL_IN_A_BATTLE.theRiseEachLevelOfNavalGivesHisFleetsAndSeaBeasts;
  let defLineWidth = terrainFront;
  // the defenders' Flanking Tactics come from the province OWNER (a player garrison) or the
  // defending commander's realm — previously hard-coded ×0.5 whatever discoveries they held.
  const defFlankDisc =
    (prov.owner != null && doARealmsDiscoveriesWeightTheLinesBehindTheFront(G.players[prov.owner])) ||
    (!!defHero &&
      defHero.player != null &&
      doARealmsDiscoveriesWeightTheLinesBehindTheFront(G.players[defHero.player]));
  const defsWithStr = (asItsGuardReadsIt(prov.neutralDefenders) ?? [])
    .map((a) => {
      const cmd: CommandMultiplier[] = [];
      if (MISSILE_ARMIES.has(a.type))
        cmd.push({
          key: 'arch',
          reason: { kind: 'archery', level: archSkillDef, multiplier: defArchMissileBonus },
          m: defArchMissileBonus,
        });
      if (SEA_TYPES.has(a.type))
        cmd.push({
          key: 'nav',
          reason: { kind: 'naval', level: navalSkillDef, multiplier: defNavalFleetBonus },
          m: defNavalFleetBonus,
        }); // defender's Naval, land or sea
      const landUnit = !SEA_TYPES.has(a.type); // land AND air units — flyers take Tactical since 2026-09-23c
      if (landUnit && prov.terrain !== 'sea')
        cmd.push({
          key: 'tac',
          reason: { kind: 'tactical', multiplier: tacMulted(defTactBonus, defHero) },
          m: tacMulted(defTactBonus, defHero),
        });
      return ladderRow(
        turnContext,
        a,
        defHero,
        null,
        prov.terrain,
        {
          force: defenders,
          enemyForce: armies,
          isAttacker: false,
          ownerRace: prov.owner != null ? G.players[prov.owner]?.race : null,
          ownerPi: prov.owner ?? null,
          coastal: _provCoastal,
        },
        cmd,
      );
    })
    .sort((x, y) => Number(y.fly) - Number(x.fly) || y.base - x.base);
  // the defender's half of the same phantom bonus, removed for the same reason.
  // (2026-09-23d: the defender's standalone Naval line is retired likewise.)
  // Tactical on every land unit of a land battle — the same scope the attacker and both PvP sides
  // use.
  battleLineTotal(defsWithStr, defLineWidth, defFlankDisc); // undamaged, before whole-force (2026-09-24); its total read by nothing, the call kept as it was
  // (Illusory Terrain is applied per-unit above, folded into each attacker's strength.)
  // L7/L9 MASTERY ORDER battle modifiers vs an NPC garrison (c is always the attacker here;
  // Feigned Retreat is purely defensive and correctly has no place on an attack).
  let atkOrdN = 1;
  const defOrdN = 1;
  if (c._grandStratagemTurn === G.turn) {
    atkOrdN *= KC_THE_MASTERY_ORDERS_FACTORS_IN_A_BATTLE.aGrandStratagem;
    narrate(narrative, { kind: 'the attacker unfolds a grand stratagem against the defenders', cName: atkSide });
  }
  if (raidLandedHere(turnContext, c, prov)) {
    atkOrdN *= KC_THE_MASTERY_ORDERS_FACTORS_IN_A_BATTLE.aRaidOnTheCoastStormingAshore;
    narrate(narrative, {
      kind: 'the attacker storms ashore in a raid on the coast against the defenders',
      cName: atkSide,
    });
  } // 2026-09-23e: only a coast attacked from the sea
  // Phantasmal Armies lasts only until the end of the next battle the hero is in — clear it now.
  {
    const _rc: HeroInABattle | undefined = G.characters[c.id];
    if (_rc) delete _rc._phantasmalBonus;
    if (theAttackerAsTheGuardsReadHim) delete c._phantasmalBonus;
  }

  // Fanaticism check: the attacker's chance of zeal its realm's alignment gives (the alignment abilities' registry,
  // P1-19au1); the defenders never roll
  const align = theAlignmentASideFightsUnder(theAttackersRealm?.alignment);
  const fanatic =
    kcRng() <
    theChanceOfZealARealmsAlignmentGivesASide(theAttackersRealm?.alignment) +
      whatARealmsDiscoveriesAddToASidesFanaticism(theAttackersRealm, {
        theSide: 'atk',
        theGround: prov.terrain,
        theForce: armies,
      }); // fanatic discoveries
  // Undead skeletal legions never waver under ANY of the realm's commanders — the king's presence
  // merely sharpens it (×1.5 king-led, ×1.3 hero-led). Evil: a host with Monster armies fights with savage
  // fury. (The Druidic mirror, Wild Ferocity — ×1.25 for a host with any Creature — was retired on 2026-10-13
  // (Toby, Creatures and Monsters I): the Druidic crown keeps its waiver, Home of the Wild and mastery.)
  const fervour = theFervourOfASide(theAttackersRealm?.alignment, {
    isItSeizedByZeal: fanatic,
    isItLedByTheKing: c.isKing,
    theForce: armies,
  });
  const skeletalFanatic = fervour.theAbilitiesThatStirredIt.includes('skeletal-fervour') && c.isKing;
  const skelHeroFanatic = fervour.theAbilitiesThatStirredIt.includes('skeletal-fervour') && !c.isKing;
  const evilMonsterFanatic = fervour.theAbilitiesThatStirredIt.includes('savage-fury');
  const fanMult = fervour.theFactor; // strongest counts (2026-09-23b)
  if (evilMonsterFanatic && !fanatic)
    narrate(narrative, { kind: "the attacker's monsters are driven to savage fury", cName: atkSide });
  if (fanatic && !skeletalFanatic && !skelHeroFanatic)
    narrate(narrative, { kind: "the attacker's troops fight with fanatical zeal", cName: atkSide });
  if (skeletalFanatic)
    narrate(narrative, {
      kind: "a side's skeletal legions fight with fanaticism under their undead king",
      sideName: atkSide,
      undeadKingFanaticismPct: Math.round((UNDEAD_SKEL_KING_FAN - 1) * 100),
    });
  if (skelHeroFanatic)
    narrate(narrative, {
      kind: "a side's skeletal legions know no fear",
      sideName: atkSide,
      undeadHeroFanaticismPct: Math.round((UNDEAD_SKEL_HERO_FAN - 1) * 100),
    });
  const discArmyBonus = 1 + whatARealmsDiscoveriesAddToTheWholeArmy();
  if (discArmyBonus > 1)
    narrate(narrative, {
      kind: "the attacker's realm discoveries strengthen his army",
      discoveriesArmyBonus: discArmyBonus,
    });

  // Apply discovery bonuses to final attack str
  const finalAtkMod = discArmyBonus;
  // DIVINE — Consecrate: an Undead/Evil realm assaulting consecrated ground fights at −15% (the alignment abilities'
  // registry's runner, P1-19au2).
  const _consecNPCFactor =
    prov.owner != null && prov.owner !== c.player && isConsecrated(G.players[prov.owner], prov.id)
      ? theFactorConsecratedGroundWeakensAnAttackersHostBy({ theAttackersAlignment: align })
      : 1;
  const _consecNPC = _consecNPCFactor < 1;
  if (_consecNPC)
    narrate(narrative, {
      kind: "the consecrated ground of the province weakens the attacker's host",
      provName: prov.name,
      atkName: atkSide,
      attackersAlignment: align,
    });
  // Post-multiplier base strengths — every battle-level multiplier (fanaticism, discoveries,
  // morale, home/defensive bonus, illusory, consecrate) folded in, BEFORE the dice.
  // 2026-09-24 (Toby): whole-force multipliers per unit BEFORE pre-battle damage (finishSide). These
  // lists are the single source of each side's force product — the ladder prints them as they are.
  const _nAtkFM: AForceWideModifierOfASide[] = [
    { reason: 'morale', m: _npcAtkMorale },
    { reason: 'orders', m: atkOrdN },
    { reason: 'home-ground', m: atkHomeBonus },
    { reason: 'fanaticism', m: fanMult },
    { reason: 'discoveries', m: finalAtkMod },
    { reason: 'consecrated-ground', m: _consecNPCFactor },
  ];
  const _nDefFM: AForceWideModifierOfASide[] = [
    { reason: 'defenders-position', m: defBonus },
    { reason: 'home', m: homeBonus },
    { reason: 'morale', m: _npcDefMorale },
    { reason: 'orders', m: defOrdN },
  ];
  const _gA: { grid?: BattleGrid } = {},
    _gD: { grid?: BattleGrid } = {};
  finishSide(armiesWithStr, lineWidth, atkFlankDisc, _nAtkFM, {
    terrain: prov.terrain,
    tac: tactSkill,
    enemy: defsWithStr,
    enemyTac: defTactLvl,
    out: _gA,
  });
  finishSide(defsWithStr, defLineWidth, defFlankDisc, _nDefFM, {
    terrain: prov.terrain,
    tac: defTactLvl,
    enemy: armiesWithStr,
    enemyTac: tactSkill,
    out: _gD,
  });
  // 2026-10-11 Battle lines III: the better-explored side picks the width and lines up second; the
  // commanders then shift their lines, one swap per Tactical level. The ground's own defenders (a
  // neutral guard, a standing garrison) know it fully. finishSide's grids are replaced by the deploy's.
  const _explA = (prov.exploredBy?.[String(c.player)] ?? 0) || 0,
    _explD =
      KC_THE_DEFENDERS_EDGE_AND_A_REALMS_HOME_GROUND_IN_A_BATTLE.theShareOfTheirGroundAProvincesOwnDefendersHaveExplored;
  const _dep = battleDeploy(armiesWithStr, defsWithStr, {
    terrain: prov.terrain,
    roll: terrainFront,
    tacA: tactSkill,
    tacD: defTactLvl,
    flankA: atkFlankDisc,
    flankD: defFlankDisc,
    scout: battleScout(_explA, _explD),
  });
  _gA.grid = _dep.gA;
  _gD.grid = _dep.gD;
  lineWidth = defLineWidth = _dep.W;
  // Who each company fought, for the fate lines (2026-10-12, Toby): read now, while the rows carry the deploy's facing.
  // Each enemy side as the clauses name it (plan P1-12d28: a record; the prose writes the label): the defenders (their
  // guard, " (wandering)" cut, else the realm's garrison of the province or its defenders), and the attacker by his
  // plain name, " (wandering)" cut, never "X's leaderless host".
  const _facedDefNm: TheDefendersOfAProvince = defHero
    ? { kind: 'the defenders led by their guard', guardName: defHero.name.replace(' (wandering)', '') }
    : prov.owner != null && !neutralGuardHero
      ? { kind: "a realm's garrison of a province with no guard to lead it", provName: prov.name }
      : { kind: 'the defenders of a province with no guard to lead them', provName: prov.name, capitalised: false };
  const _facedA = battleFacedClauses(_dep.gA, _facedDefNm),
    _facedD = battleFacedClauses(_dep.gD, {
      heroName: (c.name || cName || '').replace(' (wandering)', ''),
      leaderless: false,
    });
  // (the deploy faces both grids)
  const theAttackersFace = _gA.grid.face,
    theDefendersFace = _gD.grid.face;
  if (!theAttackersFace || !theDefendersFace)
    throw new TypeError("Cannot read properties of undefined (reading 'total')");
  const atkBaseStr = theAttackersFace.total,
    defBaseStr = theDefendersFace.total;
  // The defenders as the report lines name them (plan P1-12d30: a record; the prose writes the label): their guard, or
  // the defenders of the province with no guard to lead them; the grid names a side with no guard "Guards".
  const _defSideStat: TheDefendersOfAProvince = defHero
    ? { kind: 'the defenders led by their guard', guardName: defHero.name }
    : { kind: 'the defenders of a province with no guard to lead them', provName: prov.name, capitalised: false };
  narrate(narrative, battleWidthLine(prov.terrain, lineWidth));
  narrate(narrative, battleScoutLine(_dep, atkSide, _defSideStat, _explA, _explD));
  {
    const _mv = battleMovesLine(_dep, atkSide, _defSideStat);
    if (_mv) narrate(narrative, _mv);
  }
  narrateAll(narrative, [
    ...battleGridLines(
      defHero
        ? { kind: 'the defenders led by their guard', guardName: defHero.name }
        : { kind: "a province's guards with no guard to name them" },
      _gD.grid,
      true,
    ),
    ...battleGridLines(atkSide, _gA.grid, false),
  ]);
  // Roll with variance — each side rolls 0 to 70% of the stronger side's POST-multiplier
  // strength. Dice basis unified with the PvP path: both scale the random swing off the FULL
  // effective strength each force brings to the field (all multipliers applied), so luck is
  // proportional to what the armies are actually worth in this battle. Item 9: fortune of battle
  // — one swing, applied as a pair of luck multipliers (see battleFortune).
  const _fort = battleFortune();
  const atkRoll = _fort.atk,
    defRoll = _fort.def;
  const finalAtk = atkBaseStr * atkRoll;
  const finalDef = defBaseStr * defRoll;

  // (Battle-line width is applied above in the strength calculations, using the
  // terrain-based front width. No separate cosmetic line needed here.)

  // ── STAT BLOCK (visible to GM; included in player chronicle) ── the summary now reports the
  // EFFECTIVE strength (every multiplier already folded in — tactical is baked into the raw sum,
  // not applied again) plus the dice, so the numbers reconcile: effective + roll = final. The
  // "(incl. …)" note lists the multipliers already applied, for context — it is not a formula to
  // re-multiply. (Per-factor lines above give the full breakdown.)
  // 2026-09-23b: strength LADDER per side (see ladderLines) replaces the one-line "(incl. …)"
  // summary. The Whole-force lists MUST mirror atkBaseStr / defBaseStr above.
  const _nAtkTm = tacMulted(effectiveTactBonus, c),
    _nDefTm = tacMulted(defTactBonus, defHero);
  narrate(narrative, { kind: "the battle's statistics begin" });
  narrateAll(
    narrative,
    ladderLines('attacker', atkSide, armiesWithStr, lineWidth, atkFlankDisc, _nAtkFM, atkBaseStr, {
      grid: _gA.grid,
      tact: isLandBattle && _nAtkTm > 1 ? { mult: _nAtkTm, reason: { kind: 'tactical', multiplier: _nAtkTm } } : null,
    }),
  );
  narrateAll(
    narrative,
    ladderLines('defender', _defSideStat, defsWithStr, defLineWidth, defFlankDisc, _nDefFM, defBaseStr, {
      grid: _gD.grid,
      tact:
        prov.terrain !== 'sea' && _nDefTm > 1
          ? { mult: _nDefTm, reason: { kind: 'tactical', multiplier: _nDefTm } }
          : null,
    }),
  );
  narrate(narrative, {
    kind: 'the fortune of the battle',
    atkLabel: atkSide,
    defLabel: _defSideStat,
    atkBase: atkBaseStr,
    defBase: defBaseStr,
    fortune: theFortuneAsTheLineTellsIt(_fort),
  });

  // Combat result narrative
  const margin = finalAtk - finalDef;
  const won = margin >= 0;
  // ORC — Raiders' Muster (2026-10-11, Toby): an orc realm's win in an orcish province (the end-of-turn pass reads the flag).
  if (won && doesTheWinnersRaceFlagTheProvinceItWonABattleIn(theAttackersRealm?.race, { theProvincesRace: prov.race }))
    prov._raidersMuster = G.turn;
  // Tactical gain for winning a land battle is rolled AT THE END of the battle (just before the
  // return) so the 📈 line closes the battle report instead of preceding it in the chronicle.
  const _rollTacticalGain = won && prov.terrain !== 'sea';
  const _rollNavalGain = won && prov.terrain === 'sea'; // winning a SEA battle trains Naval (the sea-combat skill), mirroring Tactical on land
  // DRUID (2026-09-21, Toby): any battle with primal (Creature/Monster) units on EITHER side trains
  // Druid — full chance for the winner, half for the loser. Read before casualties are removed.
  // the primal units' rows, read by any unit's type
  const primalDefs: Readonly<Partial<Record<string, unknown>>> = PRIMAL_ARMY_DEFS_P;
  const _primalInBattle = [
    ...(asItsGuardReadsIt(c.armies) ?? []),
    ...(asItsGuardReadsIt(prov.neutralDefenders) ?? []),
    ...(neutralGuardHero?.armies ?? []),
  ].some((a: AUnitInTheBattleAgainstTheDefenders | null | undefined) => a && primalDefs[a.type]);
  const _rollDruidGain = _primalInBattle;

  // (The closeness of the battle once kept here, read by nothing, went with P1-10b24.)
  return {
    _dep,
    _facedA,
    _facedD,
    atkBaseStr,
    defBaseStr,
    _fort,
    finalAtk,
    finalDef,
    margin,
    won,
    _rollTacticalGain,
    _rollNavalGain,
    _rollDruidGain,
  };
}
