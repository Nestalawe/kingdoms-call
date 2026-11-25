// The battle between two heroes' hosts (combatVsChar, src/engine/battle/battles-between-heroes.ts), its fourth stage,
// B-06bi: Sanctuary, the mastery orders, Consecrate's sickness and the lines with every whole-force multiplier and the
// scout's deploy (the battle proof's H5), the fortune of battle (H6), and the stat block and the result, to the margin
// (H7: the ladder, who won, Raiders' Muster and the skills the battle may train), moved here as they were, the same
// statements in the same order. combatVsChar calls it where they stood, after the archery, Flak and Breach (h4-…), and
// hands it what the set-up and H4 returned, as they are. It returns what the later stages read, each final here: the
// Sanctuary's and the mastery orders' factors and Consecrate's (H9's stay-or-retreat check reads them), the front's
// width after the scout's deploy, the deploy and whom each company faced, the two sides' strengths and the fortune, who
// won and the margin, and the skills the battle may train. The front's width is this stage's own `let` from the width
// the set-up rolled (nothing changes it before the deploy here), handed on once the deploy has set it. It writes no
// other `let` of the table in h0-to-h2-…, and the battle's state gains no field. The battle proof
// (tools/proof/README.md, section 8) finds H5's, H6's and H7's anchors in this file; nothing above H5's draws a die.
import {
  KC_THE_DEFENDERS_EDGE_AND_A_REALMS_HOME_GROUND_IN_A_BATTLE,
  KC_THE_MASTERY_ORDERS_FACTORS_IN_A_BATTLE,
  KC_THE_STRENGTH_A_SANCTUARYS_WARDS_LEAVE_THE_CASTERS_ENEMIES_IN_A_BATTLE,
  PRIMAL_ARMY_DEFS_P,
} from '../../../content/kingdoms-call-data.ts';
import { theFactorConsecratedGroundWeakensAnAttackersHostBy } from '../../rules/the-registry-of-alignment-abilities.ts';
import {
  battleDeploy,
  battleFacedClauses,
  battleGridLines,
  battleMovesLine,
  battleScout,
  battleScoutLine,
  battleWidthLine,
} from '../lines.ts';
import { ladderLines } from '../ladder.ts';
import { tacMulted } from '../../units/movement.ts';
import { battleFortune } from '../fortune.ts';
import { doesTheWinnersRaceFlagTheProvinceItWonABattleIn } from '../../rules/the-registry-of-the-race-gifts.ts';
import { finishSide } from '../terrain-and-unit-strength.ts';
import { raidLandedHere } from '../raid-the-coast-and-landing-parties.ts';
import { narrateAll, narrate } from '../../turn/events-and-their-audiences.ts';
import { theFortuneAsTheLineTellsIt } from '../the-facts-a-battles-lines-record.ts';
import type { TurnContext } from '../../turn/context.ts';
import type { ArmyInABattle, HeroInABattle, ProvinceInABattle } from '../../army-tables.ts';
import type { BattleGrid } from '../lines.ts';
import type { AForceWideModifierOfASide } from '../the-facts-a-battles-lines-record.ts';
import type { WhatTheSetUpOfTheBattleBetweenHeroesHandsOn } from './h3-both-sides-pre-battle-magic-and-army-spells.ts';
import type { bothSidesArcheryFlakAndBreachInTheBattleBetweenHeroes } from './h4-both-sides-archery-flak-and-breach.ts';

/** What both sides' archery, Flak and Breach hand on to the later stages, as they returned it. */
export type WhatTheArcheryFlakAndBreachOfTheBattleBetweenHeroesHandOn = ReturnType<
  typeof bothSidesArcheryFlakAndBreachInTheBattleBetweenHeroes
>;

/** The fourth stage of the battle between two heroes' hosts: Sanctuary, the mastery orders, Consecrate's sickness and
 *  the lines, the fortune of battle, then the stat block and the result, to the margin. It returns what the later
 *  stages read, each final here. */
export function sanctuaryTheMasteryOrdersTheLinesTheFortuneAndTheResultOfTheBattleBetweenHeroes(
  turnContext: TurnContext,
  atk: HeroInABattle,
  def: HeroInABattle,
  prov: ProvinceInABattle,
  theSetUp: WhatTheSetUpOfTheBattleBetweenHeroesHandsOn,
  theArcheryFlakAndBreach: WhatTheArcheryFlakAndBreachOfTheBattleBetweenHeroesHandOn,
) {
  const {
    G,
    theProvinceAsTheGuardsReadIt,
    narrative,
    atkArmies,
    defArmies,
    atkTact,
    defTact,
    atkTactBonus,
    defTactBonus,
    atkMorale,
    defMorale,
    atkName,
    defName,
    atkSide,
    defSide,
    atkHomeBonusP,
    defBonus,
    atkAlign,
    _consecratedHere,
    atkFanMult,
    defFanMult,
    pvpTerrain,
    pvpIsLand,
  } = theSetUp;
  let { pvpFront } = theSetUp;
  const { atkFlankPvp, defFlankPvp, atkRows, defRows, atkDiscBonus, defDiscBonus } = theArcheryFlakAndBreach;
  // WHITE L7 — Sanctuary: enemies of the warding caster fight at −25% in the warded province this
  // turn.
  const _sanctBy = theProvinceAsTheGuardsReadIt?._sanctuaryTurn === G.turn ? prov._sanctuaryBy : null;
  const atkSanct =
    _sanctBy != null && atk.player !== _sanctBy
      ? KC_THE_STRENGTH_A_SANCTUARYS_WARDS_LEAVE_THE_CASTERS_ENEMIES_IN_A_BATTLE.theFactorOnEachSideNotTheCastersRealm
      : 1;
  const defSanct =
    _sanctBy != null && def.player !== _sanctBy
      ? KC_THE_STRENGTH_A_SANCTUARYS_WARDS_LEAVE_THE_CASTERS_ENEMIES_IN_A_BATTLE.theFactorOnEachSideNotTheCastersRealm
      : 1;
  if (atkSanct < 1)
    narrate(narrative, {
      kind: "the sanctuary wards of the province sap a side's attackers",
      provName: prov.name,
      sideName: atkSide,
    });
  if (defSanct < 1)
    narrate(narrative, {
      kind: "the sanctuary wards of the province sap a side's attackers",
      provName: prov.name,
      sideName: defSide,
    });
  // ── L7/L9 MASTERY ORDER battle modifiers (turn-stamped flags set in the action phase) ──
  let atkOrd = 1,
    defOrd = 1;
  if (atk._grandStratagemTurn === G.turn) {
    atkOrd *= KC_THE_MASTERY_ORDERS_FACTORS_IN_A_BATTLE.aGrandStratagem;
    narrate(narrative, { kind: 'the attacker unfolds a grand stratagem', atkName: atkSide });
  }
  if (def._grandStratagemTurn === G.turn) {
    defOrd *= KC_THE_MASTERY_ORDERS_FACTORS_IN_A_BATTLE.aGrandStratagem;
    narrate(narrative, { kind: 'the defender unfolds a grand stratagem', defName: defSide });
  }
  if (def._feignedRetreatTurn === G.turn) {
    defOrd *= KC_THE_MASTERY_ORDERS_FACTORS_IN_A_BATTLE.aFeignedRetreat;
    narrate(narrative, { kind: "the defender's feigned retreat springs shut", defName: defSide });
  }
  if (raidLandedHere(turnContext, atk, prov)) {
    atkOrd *= KC_THE_MASTERY_ORDERS_FACTORS_IN_A_BATTLE.aRaidOnTheCoastStormingAshore;
    narrate(narrative, { kind: 'the attacker storms ashore in a raid on the coast', atkName: atkSide });
  } // 2026-09-23e: only a coast attacked from the sea
  // DIVINE — Consecrate: Undead and Evil hosts sicken on hallowed ground (−15% attacking a
  // consecrated province; the alignment abilities' registry's runner, P1-19au2).
  const _consecPenalty = _consecratedHere
    ? theFactorConsecratedGroundWeakensAnAttackersHostBy({ theAttackersAlignment: atkAlign })
    : 1;
  if (_consecPenalty < 1)
    narrate(narrative, {
      kind: "the consecrated ground of the province weakens the attacker's host",
      provName: prov.name,
      atkName: atkSide,
      attackersAlignment: atkAlign,
    });
  // Post-multiplier base strengths — every battle-level multiplier folded in, BEFORE the dice.
  // BUG FIX: the defender's Tactical bonus was applied TWICE — once per-unit inside pvpArmStr
  // (already folded into defRaw, exactly like the attacker's) and AGAIN as an explicit
  // ×defTactBonus here. The attacker only gets it once (no ×atkTactBonus below), so this
  // over-strengthened every PvP land defender with Tactical skill (×1.44 at Tac 2 up to ×4.0 at
  // Tac 5). defRaw already carries it; drop the duplicate so both sides are symmetric.
  // 2026-09-24 (Toby): whole-force multipliers per unit BEFORE pre-battle damage (finishSide). These
  // lists are the single source of each side's force product — the ladder prints them as they are.
  const _pAtkFM: AForceWideModifierOfASide[] = [
    { reason: 'fanaticism', m: atkFanMult },
    { reason: 'discoveries', m: atkDiscBonus },
    { reason: 'duel-morale', m: atkMorale },
    { reason: 'consecrated-ground', m: _consecPenalty },
    { reason: 'sanctuary-wards', m: atkSanct },
    { reason: 'orders', m: atkOrd },
    { reason: 'home-ground', m: atkHomeBonusP },
  ];
  const _pDefFM: AForceWideModifierOfASide[] = [
    { reason: 'fanaticism', m: defFanMult },
    { reason: 'defenders-position', m: defBonus },
    { reason: 'duel-morale', m: defMorale },
    { reason: 'discoveries', m: defDiscBonus },
    { reason: 'sanctuary-wards', m: defSanct },
    { reason: 'orders', m: defOrd },
  ];
  const _gA: { grid?: BattleGrid } = {},
    _gD: { grid?: BattleGrid } = {};
  finishSide(atkRows, pvpFront, atkFlankPvp, _pAtkFM, {
    terrain: pvpTerrain,
    tac: atkTact,
    enemy: defRows,
    enemyTac: defTact,
    out: _gA,
  });
  finishSide(defRows, pvpFront, defFlankPvp, _pDefFM, {
    terrain: pvpTerrain,
    tac: defTact,
    enemy: atkRows,
    enemyTac: atkTact,
    out: _gD,
  });
  // 2026-10-11 Battle lines III: the better-explored side picks the width and lines up second; the
  // commanders then shift their lines, one swap per Tactical level (a defender without a realm, a
  // wanderer on its own ground, knows it fully). finishSide's grids are replaced by the deploy's.
  const _explA = (prov.exploredBy?.[String(atk.player)] ?? 0) || 0,
    _explD =
      def.player == null
        ? KC_THE_DEFENDERS_EDGE_AND_A_REALMS_HOME_GROUND_IN_A_BATTLE.theShareOfTheirGroundAProvincesOwnDefendersHaveExplored
        : (prov.exploredBy?.[String(def.player)] ?? 0) || 0;
  const _dep = battleDeploy(atkRows, defRows, {
    terrain: pvpTerrain,
    roll: pvpFront,
    tacA: atkTact,
    tacD: defTact,
    flankA: atkFlankPvp,
    flankD: defFlankPvp,
    scout: battleScout(_explA, _explD),
  });
  _gA.grid = _dep.gA;
  _gD.grid = _dep.gD;
  pvpFront = _dep.W;
  // Who each company fought, for the fate lines (2026-10-12, Toby): read now, while the rows carry the deploy's facing.
  // Each enemy side as the clauses name it (plan P1-12d28: a side's record; the prose writes the label): its commander's
  // plain name, " (wandering)" cut, never "X's leaderless host".
  const _facedA = battleFacedClauses(_dep.gA, {
      heroName: (def.name || defName || '').replace(' (wandering)', ''),
      leaderless: false,
    }),
    _facedD = battleFacedClauses(_dep.gD, {
      heroName: (atk.name || atkName || '').replace(' (wandering)', ''),
      leaderless: false,
    });
  // (the deploy faces both grids)
  const theAttackersFace = _gA.grid.face,
    theDefendersFace = _gD.grid.face;
  if (!theAttackersFace || !theDefendersFace)
    throw new TypeError("Cannot read properties of undefined (reading 'total')");
  const atkBaseStr = theAttackersFace.total,
    defBaseStr = theDefendersFace.total;
  narrate(narrative, battleWidthLine(pvpTerrain, pvpFront));
  narrate(narrative, battleScoutLine(_dep, atkSide, defSide, _explA, _explD));
  {
    const _mv = battleMovesLine(_dep, atkSide, defSide);
    if (_mv) narrate(narrative, _mv);
  }
  narrateAll(narrative, [...battleGridLines(defSide, _gD.grid, true), ...battleGridLines(atkSide, _gA.grid, false)]);
  // Dice basis unified with the NPC path: each side rolls 0 to 70% of the stronger side's
  // POST-multiplier strength, so luck scales with what the armies are actually worth in battle.
  // Item 9: fortune of battle — one swing, applied as a pair of luck multipliers (see
  // battleFortune).
  const _fortP = battleFortune();
  const atkDice = _fortP.atk,
    defDice = _fortP.def;
  const atkStr = atkBaseStr * atkDice;
  const defStr = defBaseStr * defDice;
  // Phantasmal Armies lasts only until the end of the next battle the hero is in — clear it now.
  [atk, def].forEach((x: HeroInABattle | null | undefined) => {
    if (!x) return;
    const rx: HeroInABattle | undefined = G.characters[x.id];
    if (rx) delete rx._phantasmalBonus;
    delete x._phantasmalBonus;
  });

  // ── STAT BLOCK ── 2026-09-23b: a three-stage strength LADDER per side (see ladderLines) replaces
  // the old "(incl. …)" list, which omitted every per-unit modifier (Dwarven Bulwark, kinship,
  // terrain, the Druid creature bond, arrows) and listed Tactical as army-wide though flyers and
  // fleets never get it. The Whole-force list below MUST mirror atkBaseStr / defBaseStr above —
  // the harness asserts lineTotal × Π(m) === baseStr for both sides.
  narrate(narrative, { kind: "the battle's statistics begin" });
  narrateAll(
    narrative,
    ladderLines('attacker', atkSide, atkRows, pvpFront, atkFlankPvp, _pAtkFM, atkBaseStr, {
      grid: _gA.grid,
      tact:
        pvpIsLand && atkTactBonus > 1
          ? {
              mult: tacMulted(atkTactBonus, atk),
              reason: { kind: 'tactical at its level', level: atkTact, multiplier: tacMulted(atkTactBonus, atk) },
            }
          : null,
    }),
  );
  narrateAll(
    narrative,
    ladderLines('defender', defSide, defRows, pvpFront, defFlankPvp, _pDefFM, defBaseStr, {
      grid: _gD.grid,
      tact:
        pvpIsLand && defTactBonus > 1
          ? {
              mult: tacMulted(defTactBonus, def),
              reason: { kind: 'tactical at its level', level: defTact, multiplier: tacMulted(defTactBonus, def) },
            }
          : null,
    }),
  );
  narrate(narrative, {
    kind: 'the fortune of the battle',
    atkLabel: atkSide,
    defLabel: defSide,
    atkBase: atkBaseStr,
    defBase: defBaseStr,
    fortune: theFortuneAsTheLineTellsIt(_fortP),
  });

  const won = atkStr >= defStr;
  // ORC — Raiders' Muster (2026-10-11, Toby): an orcish province that sees an orc win this turn gains a
  // Goblin Horde at turn's end (the end-of-turn pass reads the flag).
  {
    const _wp = won ? atk.player : def.player;
    if (
      _wp != null &&
      doesTheWinnersRaceFlagTheProvinceItWonABattleIn(G.players[_wp]?.race, { theProvincesRace: prov.race })
    )
      prov._raidersMuster = G.turn;
  }
  // Tactical gain deferred to the end of the battle narrative — see the return below.
  const _rollTacticalGainPvP = prov.terrain !== 'sea';
  const _rollNavalGainPvP = prov.terrain === 'sea'; // sea-battle winner trains Naval (mirrors Tactical on land)
  // the primal units' rows, read by any unit's type
  const primalDefsPvP: Readonly<Partial<Record<string, unknown>>> = PRIMAL_ARMY_DEFS_P;
  const _rollDruidGainPvP = [...atkArmies, ...defArmies].some(
    (a: ArmyInABattle | null | undefined) => a && primalDefsPvP[a.type],
  ); // primal (Creature/Monster) units on EITHER side: both commanders may train Druid — winner full, loser half (2026-09-21)
  const margin = Math.abs(atkStr - defStr);
  const totalStrPvP = Math.max(1, atkStr + defStr);
  return {
    atkSanct,
    defSanct,
    atkOrd,
    defOrd,
    _consecPenalty,
    pvpFront,
    _dep,
    _facedA,
    _facedD,
    atkBaseStr,
    defBaseStr,
    _fortP,
    won,
    _rollTacticalGainPvP,
    _rollNavalGainPvP,
    _rollDruidGainPvP,
    margin,
    totalStrPvP,
  };
}
