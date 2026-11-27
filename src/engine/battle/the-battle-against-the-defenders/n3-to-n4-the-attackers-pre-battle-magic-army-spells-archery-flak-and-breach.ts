// The battle against a province's defenders (combatVsNPC, src/engine/battle/battles-against-province-defenders.ts), its
// second stage, B-06ba: the attacker's pre-battle phases, his magic (the battle proof's N3), then his archery, Flak and
// Breach (N4), moved here as they were, the same statements in the same order. His units' army spells strike in N5,
// after their commander's battle spell (R-162), so after his archery here (R-162). combatVsNPC
// calls it where they stood, after the set-up (n0-to-n2-…), and hands it what the set-up returned, as it is. It returns
// what the later stages read: the battle spells' names, the defenders' commander's Tactical (final once N3 is done)
// and its bonus, and the battle's state below. The battle proof (tools/proof/README.md, section 8) finds N3's and N4's
// anchors in this file; nothing above N3's draws a die.
//
// The battle's state, shared by its five stages (B-06az to B-06bd), each a file of this folder, called in order from
// combatVsNPC. It is the type below and lives here, the file of the first stage that writes it (Breach's sunk hulls,
// N4), made where its lets were declared and handed back to combatVsNPC, which hands it on.
//
// What a stage hands on: each value a later stage reads and no stage writes after it is handed on as a value, returned
// by its stage in one object, which combatVsNPC hands on as it is and each later stage takes under the same names (the
// set-up's thirty or so, its lets tactSkill, defBonus and navalSkillAtk among them, each final there (N8 withers the
// first and the last by a Curse, under the same names: R-162); defTactLvl, final
// once N3 is done; the lines' thirteen, each final in N10). The lets a later stage still writes are the battle's state:
// each is a field of the state object, read and written through it, never copied by value into a stage. The giant's
// lets, by stage file (each file named by the stages it holds: n0-to-n2-…, n3-to-n4-…, n5-to-n7-…, n8-to-n10-…,
// n11-to-n13-…) and by the battle proof's stages (tools/proof/README.md, section 8), who writes each and who reads it:
//
// | let | written in | read in |
// |---|---|---|
// | `_npcDuel` | n0-to-n2 (N1) | n0-to-n2 (N1: the duel's result, local to the set-up) |
// | `tactSkill` | n0-to-n2 (N2); n8-to-n10 (N8: its own, a Curse halves it) | n8-to-n10 (N8) |
// | `defBonus` | n0-to-n2 (N2) | n8-to-n10 (N8) |
// | `navalSkillAtk` | n0-to-n2 (N2); n8-to-n10 (N8: its own, a Curse halves it) | n8-to-n10 (N8) |
// | `defTactLvl` | n3-to-n4 (N3) | n3-to-n4 (N3), n8-to-n10 (N8) |
// | `_npcSunkLost` (the state) | n3-to-n4 (N4: Breach and Swamp's hulls) | n11-to-n13 (N13: the defenders' losses handed back) |
// | `_npcDefWinLost` (the state) | n3-to-n4 (N4, declared), n11-to-n13 (N12: a winning garrison's dead) | n11-to-n13 (N13) |
// | `lineWidth` | n8-to-n10 (N8, twice: the front, the scout) | n8-to-n10 (N8, N10) |
// | `navalSkillDef` | n8-to-n10 (N8) | n8-to-n10 (N8) |
// | `defLineWidth` | n8-to-n10 (N8, twice) | n8-to-n10 (N8, N10) |
// | `atkOrdN` | n8-to-n10 (N8) | n8-to-n10 (N8) |
//
// So the state the stages share by reference: the defenders' two loss counts (from n3-to-n4 to the end); the two
// fronts' widths are written and read in one stage file (n8-to-n10-…, B-06bc), so they stay its own lets; the rest are
// values once their stage is done; n5-to-n7 and n11-to-n13 declare none a later stage reads. The objects the stages
// share (the narrative, the two hosts, the province, the commanders) are handed on as they are, never copied.
import { KC_A_SPELLS_CAST_CHANCE_THE_RISE_EACH_SCHOOL_LEVEL_GIVES_AND_THE_MOST } from '../../../content/kingdoms-call-data.ts';
import { kcRng } from '../../rng.ts';
import { theHullAUnitSinksBeforeTheBattle } from '../../rules/the-registry-of-content-effects.ts';
import {
  theStrongestUnitsAHerosItemsLetHisFireballStrike,
  theVolleysTheCommandersItemsLoose,
} from '../../rules/the-registry-of-magic-item-effects.ts';
import { whatABattleSpellDoesBeforeTheBattle } from '../../rules/the-registry-of-spell-effects.ts';
import { BATTLE_MAGIC_SPELL_NAMES } from '../../army-tables.ts';
import { SEA_TYPES } from '../../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import {
  abilityMissileUnits,
  applyFlakScreen,
  archeryBlockedBy,
  eyesOfTheForestLine,
  missileDamageMult,
  missileTargetPool,
} from '../strength.ts';
import { unitBaseStrength } from '../../rules-on-plain-values/unit-types-and-base-strength.ts';
import { shuffleP } from '../fortune.ts';
import { recordBattleGraves } from '../../graves.ts';
import { activeItems } from '../../items/equipment.ts';
import { d100 } from '../../dice-and-army-names.ts';
import { dispFloor } from '../../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { applyWraithTouch } from '../../world/map-helpers.ts';
import { SPELL_CAST_BASE, magicL8CastBonus } from '../../chances-and-lair-grades.ts';
import { whatARealmsDiscoveriesAddToACastersChance } from '../../rules/the-registry-of-discovery-effects.ts';
import { telSpell } from '../../turn/log-line-helpers.ts';
import { charMinor } from '../../titles/title-holders-and-battle-merit.ts';
import { theLevelsAHerosTitlesAddToHisTacticalInABattle } from '../../rules/the-registry-of-the-minor-titles-perks.ts';
import { effStat } from '../../heroes/effective-skills-and-hidden-heroes.ts';
import {
  MISSILE_CAP_FRACTION,
  applyMissileHit,
  bestCurseSkill,
  theBonusACommandersTacticalGivesHisHost,
  theLevelACommanderFightsWithOnceACurseHasTakenEffect,
} from '../terrain-and-unit-strength.ts';
import { pickBattleSpell } from '../../magic/pre-battle-spell-choice.ts';
import { ensureEncounterPlan } from '../../personal-combat/speed-encounter-plans-and-combatants.ts';
import { narrate } from '../../turn/events-and-their-audiences.ts';
import type { TurnContext } from '../../turn/context.ts';
import type { HeroInABattle, ProvinceInABattle } from '../../army-tables.ts';
import type { AnEnemyUnitStruck } from '../../rules/the-registry-of-content-effects.ts';
import { asItsGuardReadsIt } from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import {
  type AUnitInTheBattleAgainstTheDefenders,
  type theSetUpTheDuelAndTheSidesOfTheBattleAgainstTheDefenders,
} from './n0-to-n2-the-set-up-the-duel-and-the-sides-to-the-home-ground.ts';
import { theLineThisCopyOfTheBattleWrites } from './the-line-a-copy-of-the-battle-writes.ts';

/** The commander a battle spell strikes: the registry names an outcome on a commander only where one was handed it, so
 *  there is one; for none, a TypeError, as the first write to him threw. (Moved as it was from combatVsNPC's file,
 *  B-06ba: only this stage reads it.) */
function theCommanderTheSpellStrikesIsThere(hero: HeroInABattle | null): asserts hero is HeroInABattle {
  if (!hero) throw new TypeError("Cannot set properties of null (setting '_tacticalHalved')");
}

/** The battle's state: the lets of the battle against a province's defenders that a stage writes after another has
 *  read them, shared by reference (the table above), read and written through it. */
export interface TheStateTheStagesOfTheBattleAgainstTheDefendersShare {
  /** The defenders' hulls Breach and Swamp sink before a shot is fired (N4): spliced out of their list, so counted here
   *  into the defenders' losses the battle hands back (N13). */
  _npcSunkLost: number;
  /** The defenders a winning garrison loses (N12), cleared before the battle returns, so counted here likewise. */
  _npcDefWinLost: number;
}

/** What the set-up, the duel and the sides hand on to the later stages, as they returned it. */
export type WhatTheSetUpOfTheBattleAgainstTheDefendersHandsOn = ReturnType<
  typeof theSetUpTheDuelAndTheSidesOfTheBattleAgainstTheDefenders
>;

/** The second stage of the battle against a province's defenders: the attacker's pre-battle magic, then his archery,
 *  Flak and Breach. It returns what the later stages read, and the battle's state, made here. */
export function theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders(
  turnContext: TurnContext,
  c: HeroInABattle,
  prov: ProvinceInABattle,
  theSetUp: WhatTheSetUpOfTheBattleAgainstTheDefendersHandsOn,
) {
  const {
    G,
    theAttackerAsTheGuardsReadHim,
    narrative,
    armies,
    defenders,
    theAttackersRealm,
    atkCmdrSlain,
    atkSide,
    defHero,
    MISSILE_ARMIES,
    skillLabels,
    archSkillAtk,
  } = theSetUp;
  // ════
  // PRE-BATTLE PHASE 1: MAGIC Hero casts first CA: spell from their encounter plan that is
  // relevant to army combat (hits provinces/armies)
  // ════
  const BATTLE_MAGIC_SPELLS = new Set(BATTLE_MAGIC_SPELL_NAMES);
  applyWraithTouch(armies, defenders, narrative);
  applyWraithTouch(defenders, armies, narrative); // Wraith's Touch
  if (theAttackerAsTheGuardsReadHim) ensureEncounterPlan(turnContext, c); // bots/NPCs get an auto battle-magic plan so they cast when attacking
  const heroTactics = c.encounterPlan?.tactics ?? [];
  const heroPick = pickBattleSpell(turnContext, heroTactics, c, defHero, defenders);
  if (heroPick && !atkCmdrSlain) {
    const spellName = heroPick.spellName;
    // (a spell picked from a school's useful spells is one of them: the pick falls in a list just found not empty)
    if (spellName === undefined) throw new TypeError('a battle spell picked from an empty list');
    const school = heroPick.school;
    const spellLvl = effStat(turnContext, c, school);
    if (spellLvl >= 1) {
      const castChance = Math.min(
        KC_A_SPELLS_CAST_CHANCE_THE_RISE_EACH_SCHOOL_LEVEL_GIVES_AND_THE_MOST.theMost,
        SPELL_CAST_BASE +
          spellLvl * KC_A_SPELLS_CAST_CHANCE_THE_RISE_EACH_SCHOOL_LEVEL_GIVES_AND_THE_MOST.theRiseEachSchoolLevelGives +
          magicL8CastBonus(c) +
          whatARealmsDiscoveriesAddToACastersChance(theAttackersRealm, { theSchool: school, whereHeCasts: 'battle' }),
      ); // cast discoveries · 2026-09-11: base 30
      const castRoll = d100();
      telSpell(turnContext, c, spellName, school, spellLvl, castChance, castRoll, 'battle');
      narrate(narrative, {
        kind: 'the attacker casts a spell before the battle against the defenders',
        cName: atkSide,
        spellName,
        schoolLabel: (skillLabels[school] ?? '') || school,
        spellLevel: spellLvl,
        castChance,
        castRoll,
      });
      if (castRoll <= castChance) {
        // pre-battle magic no longer trains the school. Casting into a battle is not the same
        // test as casting in a duel, and it was the cheapest experience in the game — one order,
        // no risk, a roll every battle. In-duel casting (pcCastCombatSpell) still trains.
        // What the spell does is the spells' registry's (plan P1-19u); this copy draws where it drew, applies it and
        // writes its line.
        const done = whatABattleSpellDoesBeforeTheBattle(spellName, {
          theCopy: 'a hero against the guards',
          theCastersLevel: spellLvl,
          theEnemysUnits: defenders.map((d) => ({
            type: d.type || '',
            race: d.race,
            isSkeletal: !!d._isSkeletal,
            baseStrength: unitBaseStrength(d),
            isAMissileUnit: MISSILE_ARMIES.has(d.type),
          })),
          theEnemyCommander: defHero
            ? {
                tactical: effStat(turnContext, defHero, 'tactical'),
                theSkillACurseWithers: bestCurseSkill(turnContext, defHero),
              }
            : null,
          atSea: prov.terrain === 'sea',
          theStrongestUnitsTheCastersItemsLetAFireballStrike: theAttackerAsTheGuardsReadHim
            ? theStrongestUnitsAHerosItemsLetHisFireballStrike(activeItems(c))
            : null,
        });
        // a defender the spell strikes, by his place in the list handed it
        const theDefenderStruck = (s: AnEnemyUnitStruck) => {
          const d = defenders[s.theUnit];
          if (!d) throw new TypeError('a battle spell struck a unit not among the defenders');
          return d;
        };
        const strike = (s: AnEnemyUnitStruck) => {
          const d = theDefenderStruck(s);
          d._tempStrReduction = (Number(d._tempStrReduction) || 0) + s.theStrengthItLoses;
        };
        switch (done?.kind) {
          case 'the strongest units lose strength':
            done.theUnitsStruck.forEach(strike);
            narrate(narrative, {
              kind: theLineThisCopyOfTheBattleWrites(done.theLine, "a fireball engulfs the defenders' strongest units"),
              fireballHitUnitNames: done.theUnitsStruck.map((s) => {
                const d = theDefenderStruck(s);
                return d.unitName || d.type;
              }),
            });
            break;
          case 'units drawn at random lose strength': {
            const theLoss = new Map(
              defenders.map((d, i): [AUnitInTheBattleAgainstTheDefenders, number | undefined] => [
                d,
                done.theStrengthEachWouldLose[i],
              ]),
            );
            const picks = shuffleP(defenders).slice(0, done.howMany);
            picks.forEach((d) => {
              d._tempStrReduction = (Number(d._tempStrReduction) || 0) + Number(theLoss.get(d));
            });
            narrate(narrative, {
              kind: theLineThisCopyOfTheBattleWrites(done.theLine, 'a lightning bolt sears the defending units'),
              unitCount: done.howMany,
            });
            break;
          }
          case 'the undead lose strength':
            done.theUnitsStruck.forEach(strike);
            narrate(narrative, {
              kind: theLineThisCopyOfTheBattleWrites(done.theLine, 'a holy symbol sears the defending undead'),
              undeadUnitCount: done.theUnitsStruck.length,
            });
            break;
          case 'the missile units lose strength':
            done.theUnitsStruck.forEach(strike);
            narrate(narrative, {
              kind: theLineThisCopyOfTheBattleWrites(done.theLine, "spiritwrack halves the defenders' missile units"),
              missileUnitCount: done.theUnitsStruck.length,
            });
            break;
          case "the enemy commander's Tactical is cut":
            theCommanderTheSpellStrikesIsThere(defHero);
            defHero._tacticalHalved = true;
            defHero._tacticalMult = done.theMultiplier;
            narrate(narrative, {
              kind: theLineThisCopyOfTheBattleWrites(
                done.theLine,
                "a telekinetic storm scatters the enemy commander's formations",
              ),
              enemyCommanderName: { heroName: defHero.name, leaderless: false },
            });
            break;
          case "the enemy commander's Tactical is marked, with none to cut":
            theCommanderTheSpellStrikesIsThere(defHero);
            defHero._tacticalHalved = true;
            narrate(narrative, {
              kind: theLineThisCopyOfTheBattleWrites(
                done.theLine,
                'a telekinetic storm finds no tactical command to disrupt',
              ),
              enemyCommanderName: { heroName: defHero.name, leaderless: false },
            });
            break;
          case "the enemy commander's Druid is negated":
            theCommanderTheSpellStrikesIsThere(defHero);
            defHero._druidNegated = true;
            narrate(narrative, {
              kind: theLineThisCopyOfTheBattleWrites(
                done.theLine,
                "a psychic blast severs the enemy commander's bond with his beasts",
              ),
              enemyCommanderName: { heroName: defHero.name, leaderless: false },
            });
            break;
          case "the enemy commander's skill is withered":
            theCommanderTheSpellStrikesIsThere(defHero);
            defHero._curseHalveStat = done.theSkill;
            narrate(narrative, {
              kind: theLineThisCopyOfTheBattleWrites(done.theLine, "a curse withers the enemy commander's skill"),
              enemyCommanderName: { heroName: defHero.name, leaderless: false },
              cursedSkill: defHero._curseHalveStat,
            });
            break;
          case 'an undead unit drawn at random defects': {
            const pick = done.theUndead[Math.floor(kcRng() * done.theUndead.length)];
            const [unit] = defenders.splice(Number(pick), 1);
            if (!unit) throw new TypeError('an undead unit drawn among the defenders is not there');
            armies.push(unit);
            const rc = G.characters[c.id];
            if (rc) {
              rc.armies = asItsGuardReadsIt(rc.armies) ?? [];
              rc.armies.push(unit);
            }
            narrate(narrative, {
              kind: theLineThisCopyOfTheBattleWrites(
                done.theLine,
                "control undead turns a defending undead unit to the attacker's side",
              ),
              turnedUnitName: unit.unitName || unit.type,
              cName: atkSide,
            });
            break;
          }
          case 'nothing to strike':
            if (done.theLine)
              narrate(narrative, {
                kind: theLineThisCopyOfTheBattleWrites(
                  done.theLine,
                  'a telekinetic storm finds no command among leaderless defenders',
                  'a psychic blast finds no commander among the defenders',
                  'a curse finds no commander among leaderless defenders',
                  'control undead finds no undead among the defenders',
                  'a holy symbol finds no undead among the defenders',
                  'spiritwrack finds no missile troops among the defenders',
                ),
              });
            break;
        }
        // NOTE: the magic-school skill-up is handled ONCE by trySkillGain(c, school, …, narrative)
        // above.
      } else {
        narrate(narrative, { kind: "the attacker's spell before the battle fizzles" });
      }
    }
  }

  // Neutral guard hero tactical skill adds to their defense (declared here, used in rawDefStr
  // below)
  const defTactLvl = theLevelACommanderFightsWithOnceACurseHasTakenEffect(
    defHero,
    'tactical',
    defHero
      ? defHero._tacticalNegated
        ? 0
        : effStat(turnContext, defHero, 'tactical') +
          theLevelsAHerosTitlesAddToHisTacticalInABattle((title) => charMinor(turnContext, defHero, title))
      : 0,
  );
  const defTactBonus = theBonusACommandersTacticalGivesHisHost(defTactLvl, true); // cap ×2.0
  // (The army and defender counts once kept here, read by nothing, went with P1-10b24.)

  // ════
  // PRE-BATTLE PHASE 2: ARCHERY Each attacker missile unit fires at a random defender Quiver of
  // Many Arrows = 2 volleys per unit
  // ════
  // the items' registry's "volley: the commander adds volleys" (plan P1-19n: the Quivers)
  const _itemVolleys = theVolleysTheCommandersItemsLoose(activeItems(c));
  const hasQuiver = _itemVolleys.theLines.includes('each missile unit looses two volleys instead of one');
  const _manyArrows = _itemVolleys.theLines.includes('each missile unit looses one more shot'); // one extra shot per missile unit
  applyFlakScreen(armies, defenders, { heroName: c.name, leaderless: false }, narrative);
  // PRIMAL — Breach and Swamp: whale cohorts roll a hull over before a shot is fired. The rule registry's
  // "fate: a hull is sunk before the battle" picks the hull, with the dice it is handed (plan P1-19i).
  // 2026-09-23d: defenders lost OUTSIDE the `_died` flag — hulls sunk here (spliced out of the list)
  // and units a WINNING garrison loses (`_defDied`, cleared before return) — are counted into
  // these so the returned defLost is the true figure (it pays merit when the attacker wins).
  const theBattlesState: TheStateTheStagesOfTheBattleAgainstTheDefendersShare = { _npcSunkLost: 0, _npcDefWinLost: 0 };
  (function () {
    armies.forEach((a: AUnitInTheBattleAgainstTheDefenders | null | undefined) => {
      if (!a) return;
      const hulls = defenders.filter(
        (d: AUnitInTheBattleAgainstTheDefenders | null | undefined) => d && SEA_TYPES.has(d.type) && !d._sunk,
      );
      const at = theHullAUnitSinksBeforeTheBattle({ unitType: a.type, theEnemyHullsAfloat: hulls, theDice: kcRng });
      if (at === null) return;
      const t = hulls[at];
      if (!t) throw new TypeError('a hull sunk that is not afloat'); // (the registry picks one of the hulls handed)
      t._sunk = true;
      narrate(narrative, {
        kind: 'a whale cohort sinks a defending ship before a shot is fired',
        targetUnitName: t.unitName || t.type,
        targetUnitType: t.type,
      });
    });
    if (defenders.some((a) => a._sunk)) {
      const lost = defenders.filter((a) => a._sunk);
      theBattlesState._npcSunkLost += lost.filter(
        (a: AUnitInTheBattleAgainstTheDefenders | null | undefined) => a && !a._phantom,
      ).length; // 2026-09-23d: spliced out below, so counted here for defLost
      recordBattleGraves(turnContext, prov, lost);
      // (a gap in the list has thrown in the test above, so each is a unit here)
      for (let i = defenders.length - 1; i >= 0; i--) if (defenders[i]?._sunk) defenders.splice(i, 1);
      if (defHero)
        defHero.armies = (asItsGuardReadsIt(defHero.armies) ?? []).filter(
          (a: AUnitInTheBattleAgainstTheDefenders) => !a._sunk,
        );
      prov.neutralDefenders = (asItsGuardReadsIt(prov.neutralDefenders) ?? []).filter(
        (a: AUnitInTheBattleAgainstTheDefenders) => !a._sunk,
      );
    }
  })();
  {
    const _eyes = eyesOfTheForestLine(defenders, prov.terrain, armies, atkSide);
    if (_eyes) narrate(narrative, _eyes);
  } // ELF — Eyes of the Forest
  const missileAtk = archeryBlockedBy(defenders, prov.terrain, armies) ? [] : abilityMissileUnits(armies, prov.terrain);
  if (archeryBlockedBy(defenders, prov.terrain, armies) && armies.some((a) => MISSILE_ARMIES.has(a.type)))
    narrate(narrative, { kind: "the hero's archers find no target among the forest wardens", heroName: atkSide });
  if (missileAtk.length > 0 && defenders.length > 0) {
    narrate(narrative, {
      kind: "the attacker's archery volley begins",
      missileUnitCount: missileAtk.length,
      doubleVolleys: hasQuiver,
      oneMoreShot: _manyArrows,
    });
    const volleys = _itemVolleys.theVolleys;
    let totalArrowDmg = 0;
    missileAtk.forEach((atk) => {
      for (let v = 0; v < volleys; v++) {
        // Archers loose at the enemy's flyers first if any are present (double damage vs flyers);
        // otherwise they target a random front-row defender.
        const pool = missileTargetPool(defenders, 0, atk, armies); // winged riders first, else any random target not yet at its cap (Eyes of the Forest reads the shooters' force)
        if (!pool.length) break;
        const target = pool[Math.floor(kcRng() * pool.length)];
        if (!target) throw new TypeError('a volley loosed at no target'); // (the pool has just been found not empty)
        const dmgMult = missileDamageMult(atk, armies, prov.terrain, target, true);
        const hit = applyMissileHit(target, archSkillAtk, atk, { dmgMult });
        totalArrowDmg += hit.dmg;
        if (hit.immune)
          narrate(narrative, {
            kind: 'a unit fires at its target and the shot glances off',
            shooterName: atk.unitName || atk.type,
            targetUnitName: target.unitName || target.type,
            whyTheShotGlances: hit.why,
          });
        else if (hit.dmg > 0)
          narrate(narrative, {
            kind: 'a unit fires at its target and weakens it',
            shooterName: atk.unitName || atk.type,
            targetUnitName: target.unitName || target.type,
            damage: hit.dmg,
            againstAFlyer: hit.isFly,
            thickHideHalvesIt: hit.thickHide,
            shootersUnitType: atk.type,
            shootersAbilityMultiplier: dmgMult,
            softenedToTheLimit: hit.capped,
          });
        else
          narrate(narrative, {
            kind: "an attacking unit's target is already softened as far as arrows allow",
            shooterName: atk.unitName || atk.type,
            targetUnitName: target.unitName || target.type,
          });
      }
    });
    narrate(narrative, {
      kind: "the attacker's archery volley's total",
      totalDamage: totalArrowDmg,
      arrowSofteningCapPct: dispFloor(MISSILE_CAP_FRACTION * 100),
    });
  }
  return { BATTLE_MAGIC_SPELLS, defTactLvl, defTactBonus, theBattlesState };
}
