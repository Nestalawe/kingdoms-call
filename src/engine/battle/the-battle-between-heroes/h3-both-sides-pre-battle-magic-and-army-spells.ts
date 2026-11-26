// The battle between two heroes' hosts (combatVsChar, src/engine/battle/battles-between-heroes.ts), its second stage,
// B-06bg: both sides' pre-battle phases of magic, each commander's battle spell (the attacker's first) and each side's
// units' army spells (the battle proof's H3), moved here as they were, the same statements in the same order.
// combatVsChar calls it where they stood, after the set-up (h0-to-h2-…), and hands it what the set-up returned, as it
// is. It returns nothing: it changes only the objects it is handed (the two hosts' units, the two commanders, the
// narrative, and a cursed commander's Tactical or Naval and its bonus among the set-up's values, R-162), and declares
// no value a later stage reads, so the battle's state gains no field. The battle proof (tools/proof/README.md, section 8) finds H3's anchor in this file;
// nothing above it draws a die.
import {
  KC_A_COMMANDERS_TACTICAL_AND_NAVAL_IN_A_BATTLE,
  KC_A_SPELLS_CAST_CHANCE_THE_RISE_EACH_SCHOOL_LEVEL_GIVES_AND_THE_MOST,
} from '../../../content/kingdoms-call-data.ts';
import { kcRng } from '../../rng.ts';
import { theStrongestUnitsAHerosItemsLetHisFireballStrike } from '../../rules/the-registry-of-magic-item-effects.ts';
import {
  whatABattleSpellDoesBeforeTheBattle,
  whatAUnitsStrikeMayDoBeforeTheBattle,
} from '../../rules/the-registry-of-spell-effects.ts';
import { SKILL_LABELS } from '../../army-tables.ts';
import { unitBaseStrength } from '../../rules-on-plain-values/unit-types-and-base-strength.ts';
import { shuffleP } from '../fortune.ts';
import { activeItems } from '../../items/equipment.ts';
import { d100, rng } from '../../dice-and-army-names.ts';
import { SPELL_CAST_BASE, magicL8CastBonus, primalStrikeItemBonus } from '../../chances-and-lair-grades.ts';
import { whatARealmsDiscoveriesAddToACastersChance } from '../../rules/the-registry-of-discovery-effects.ts';
import { telSpell } from '../../turn/log-line-helpers.ts';
import { effStat } from '../../heroes/effective-skills-and-hidden-heroes.ts';
import { bestCurseSkill, theLevelACommanderFightsWithOnceACurseHasTakenEffect } from '../terrain-and-unit-strength.ts';
import { pickBattleSpell } from '../../magic/pre-battle-spell-choice.ts';
import { narrate } from '../../turn/events-and-their-audiences.ts';
import type { TurnContext } from '../../turn/context.ts';
import type { NarrativeLine } from '../../turn/events-and-their-audiences.ts';
import type { ArmyInABattle, HeroInABattle } from '../../army-tables.ts';
import type { AnEnemyUnitStruck } from '../../rules/the-registry-of-content-effects.ts';
import { asItsGuardReadsIt } from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { theSetUpTheDuelAndTheSidesOfTheBattleBetweenHeroes } from './h0-to-h2-the-set-up-the-duel-and-the-sides-to-the-front.ts';

/** The line the registry names for what a battle spell or a unit's strike does, read as one of the kinds this copy of
 *  the battle writes there with the facts it hands: the registry's tables name one line for each copy and each outcome,
 *  so it is always one of them; for any other, a TypeError. */
function theLineTheBattleBetweenHeroesWrites<Line extends string>(line: string, ...lines: readonly Line[]): Line {
  const theLine = lines.find((l) => l === line);
  if (theLine === undefined) throw new TypeError(`a line the battle between heroes doesn't write: ${line}`);
  return theLine;
}

/** What the set-up, the duel and the sides hand on to the later stages, as they returned it. */
export type WhatTheSetUpOfTheBattleBetweenHeroesHandsOn = ReturnType<
  typeof theSetUpTheDuelAndTheSidesOfTheBattleBetweenHeroes
>;

/** The second stage of the battle between two heroes' hosts: both sides' pre-battle magic, then their units' army
 *  spells. It returns nothing: what it does stands in the objects it is handed. */
export function bothSidesPreBattleMagicAndArmySpellsInTheBattleBetweenHeroes(
  turnContext: TurnContext,
  atk: HeroInABattle,
  def: HeroInABattle,
  theSetUp: WhatTheSetUpOfTheBattleBetweenHeroesHandsOn,
) {
  const { G, narrative, _atkLA, atkArmies, defArmies, isPvPSea, atkCmdrSlain, defCmdrSlain, MISSILE_A } = theSetUp;
  // ════
  // PRE-BATTLE PHASE 1: MAGIC (both sides)
  // ════
  // the skills' labels, read by any school a plan names
  const skillLabels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;

  function applyPreBattleMagic(
    caster: HeroInABattle,
    targets: ArmyInABattle[],
    narr: NarrativeLine[],
    enemyCmdr: HeroInABattle,
  ) {
    const tactics = caster.encounterPlan?.tactics ?? [];
    const pick = pickBattleSpell(turnContext, tactics, caster, enemyCmdr, targets);
    if (!pick || targets.length === 0) return;
    const spellName = pick.spellName;
    // (a spell picked from a school's useful spells is one of them: the pick falls in a list just found not empty)
    if (spellName === undefined) throw new TypeError('a battle spell picked from an empty list');
    const school = pick.school;
    const spellLvl = effStat(turnContext, caster, school);
    if (spellLvl < 1) return;
    const castChance = Math.min(
      KC_A_SPELLS_CAST_CHANCE_THE_RISE_EACH_SCHOOL_LEVEL_GIVES_AND_THE_MOST.theMost,
      SPELL_CAST_BASE +
        spellLvl * KC_A_SPELLS_CAST_CHANCE_THE_RISE_EACH_SCHOOL_LEVEL_GIVES_AND_THE_MOST.theRiseEachSchoolLevelGives +
        magicL8CastBonus(caster) +
        whatARealmsDiscoveriesAddToACastersChance(caster.player === null ? undefined : G.players[caster.player], {
          theSchool: school,
          whereHeCasts: 'battle',
        }),
    ); // cast discoveries · 2026-09-11: base 30
    const castRoll = d100();
    telSpell(turnContext, caster, spellName, school, spellLvl, castChance, castRoll, 'battle');
    narrate(narr, {
      kind: 'the caster casts a spell before the battle',
      casterName: caster.name,
      spellName,
      schoolLabel: (skillLabels[school] ?? '') || school,
      spellLevel: spellLvl,
      castChance,
      castRoll,
    });
    if (castRoll > castChance) {
      narrate(narr, { kind: 'the spell before the battle fizzles' });
      return;
    }
    // no school gain from pre-battle magic — see resolveBattle's cast.
    // What the spell does is the spells' registry's (plan P1-19u); this copy draws where it drew, applies it and writes
    // its line.
    const done = whatABattleSpellDoesBeforeTheBattle(spellName, {
      theCopy: 'between heroes',
      theCastersLevel: spellLvl,
      theEnemysUnits: targets.map((d) => ({
        type: d.type || '',
        race: d.race,
        isSkeletal: !!d._isSkeletal,
        baseStrength: unitBaseStrength(d),
        isAMissileUnit: MISSILE_A.has(d.type),
      })),
      theEnemyCommander: asItsGuardReadsIt(enemyCmdr)
        ? {
            tactical: effStat(turnContext, enemyCmdr, 'tactical'),
            theSkillACurseWithers: bestCurseSkill(turnContext, enemyCmdr),
          }
        : null,
      atSea: isPvPSea,
      theStrongestUnitsTheCastersItemsLetAFireballStrike: theStrongestUnitsAHerosItemsLetHisFireballStrike(
        activeItems(caster),
      ),
    });
    if (!done) return;
    // an enemy unit the spell strikes, by its place in the list handed it
    const theTargetStruck = (s: AnEnemyUnitStruck) => {
      const d = targets[s.theUnit];
      if (!d) throw new TypeError('a battle spell struck a unit not among the enemy');
      return d;
    };
    const strike = (s: AnEnemyUnitStruck) => {
      const d = theTargetStruck(s);
      d._tempStrReduction = (Number(d._tempStrReduction) || 0) + s.theStrengthItLoses;
    };
    switch (done.kind) {
      case 'the strongest units lose strength':
        done.theUnitsStruck.forEach(strike);
        narrate(narr, {
          kind: theLineTheBattleBetweenHeroesWrites(done.theLine, "a fireball halves the enemy's strongest units"),
          fireballHitUnitNames: done.theUnitsStruck.map((s) => {
            const d = theTargetStruck(s);
            return d.unitName || d.type;
          }),
        });
        break;
      case 'units drawn at random lose strength': {
        const theLoss = new Map(
          targets.map((d, i): [ArmyInABattle, number | undefined] => [d, done.theStrengthEachWouldLose[i]]),
        );
        shuffleP(targets)
          .slice(0, done.howMany)
          .forEach((d) => {
            d._tempStrReduction = (Number(d._tempStrReduction) || 0) + Number(theLoss.get(d));
          });
        narrate(narr, {
          kind: theLineTheBattleBetweenHeroesWrites(done.theLine, 'a lightning bolt weakens enemy units'),
          unitCount: done.howMany,
        });
        break;
      }
      case 'the undead lose strength':
        done.theUnitsStruck.forEach(strike);
        narrate(narr, {
          kind: theLineTheBattleBetweenHeroesWrites(done.theLine, 'a holy symbol weakens enemy undead units'),
          undeadUnitCount: done.theUnitsStruck.length,
        });
        break;
      case 'the missile units lose strength':
        done.theUnitsStruck.forEach(strike);
        narrate(narr, {
          kind: theLineTheBattleBetweenHeroesWrites(done.theLine, 'spiritwrack halves enemy missile units'),
          missileUnitCount: done.theUnitsStruck.length,
        });
        break;
      case "the enemy commander's Tactical is cut":
        enemyCmdr._tacticalHalved = true;
        enemyCmdr._tacticalMult = done.theMultiplier;
        narrate(narr, {
          kind: theLineTheBattleBetweenHeroesWrites(
            done.theLine,
            "a telekinetic storm scatters the enemy commander's formations",
          ),
          enemyCommanderName: { heroName: enemyCmdr.name, leaderless: false },
        });
        break;
      case "the enemy commander's Tactical is marked, with none to cut":
        enemyCmdr._tacticalHalved = true;
        narrate(narr, {
          kind: theLineTheBattleBetweenHeroesWrites(
            done.theLine,
            'a telekinetic storm finds no tactical command to disrupt',
          ),
          enemyCommanderName: { heroName: enemyCmdr.name, leaderless: false },
        });
        break;
      case "the enemy commander's Druid is negated":
        enemyCmdr._druidNegated = true;
        narrate(narr, {
          kind: theLineTheBattleBetweenHeroesWrites(
            done.theLine,
            "a psychic blast severs the enemy commander's bond with his beasts",
          ),
          enemyCommanderName: { heroName: enemyCmdr.name, leaderless: false },
        });
        break;
      case "the enemy commander's skill is withered":
        enemyCmdr._curseHalveStat = done.theSkill;
        narrate(narr, {
          kind: theLineTheBattleBetweenHeroesWrites(done.theLine, "a curse withers the enemy commander's skill"),
          enemyCommanderName: { heroName: enemyCmdr.name, leaderless: false },
          cursedSkill: enemyCmdr._curseHalveStat,
        });
        break;
      case 'an undead unit drawn at random defects': {
        const pick = done.theUndead[Math.floor(kcRng() * done.theUndead.length)];
        const [unit] = targets.splice(Number(pick), 1);
        if (!unit) throw new TypeError('an undead unit drawn among the enemy is not there');
        caster.armies = asItsGuardReadsIt(caster.armies) ?? [];
        caster.armies.push(unit);
        const rc = G.characters[caster.id];
        if (rc && rc !== caster) {
          rc.armies = asItsGuardReadsIt(rc.armies) ?? [];
          rc.armies.push(unit);
        }
        narrate(narr, {
          kind: theLineTheBattleBetweenHeroesWrites(
            done.theLine,
            "control undead turns an enemy undead unit to the caster's side",
          ),
          turnedUnitName: unit.unitName || unit.type,
          casterName: caster.name,
        });
        break;
      }
      case 'nothing to strike':
        if (done.theLine)
          narrate(narr, {
            kind: theLineTheBattleBetweenHeroesWrites(
              done.theLine,
              'control undead finds no enemy undead to turn',
              'a holy symbol finds no enemy undead to smite',
              'spiritwrack finds no enemy missile troops',
            ),
          });
        break;
    }
  }
  if (!atkCmdrSlain) applyPreBattleMagic(atk, defArmies, narrative, def);
  if (!defCmdrSlain && !_atkLA) applyPreBattleMagic(def, atkArmies, narrative, atk);

  // Army battle spells (primal/special units)
  function applyArmyBattleSpells(
    heroChar: HeroInABattle,
    myArmies: readonly ArmyInABattle[],
    enemyArmies: readonly ArmyInABattle[],
    narr: NarrativeLine[],
  ) {
    const druLvl = heroChar._druidNegated ? 0 : effStat(turnContext, heroChar, 'druid');
    myArmies.forEach((a) => {
      // the spells' registry's "strength: a unit strikes before the battle" (plan P1-19v); this copy rolls as it rolled
      const may = whatAUnitsStrikeMayDoBeforeTheBattle({
        theCopy: 'between heroes',
        theUnitsType: a.type,
        theEnemyHasAUnit: enemyArmies.length > 0,
        theDruidLevel: druLvl || 0,
        whatTheCommandersItemsAdd: () => primalStrikeItemBonus(heroChar._druidNegated ? null : heroChar),
      });
      if (!may) return;
      const sp = may.theStrikes[Math.floor(kcRng() * may.theStrikes.length)];
      if (!sp) throw new TypeError("a unit's strike picked from an empty list"); // (the registry hands at least one)
      const _pvpStrikeChance = may.theChance;
      const _pvpHit = kcRng() * 100 < _pvpStrikeChance;
      if (!_pvpHit && may.theLineIfItMisses)
        narrate(narr, {
          kind: theLineTheBattleBetweenHeroesWrites(may.theLineIfItMisses, "a unit's power gathers but never strikes"),
          unitName: a.unitName || a.type,
          powerName: sp.name,
          strikeChancePct: _pvpStrikeChance,
          druidLevel: druLvl,
        });
      if (_pvpHit) {
        narrate(narr, {
          kind: theLineTheBattleBetweenHeroesWrites(may.theLineIfItStrikes, 'a unit uses its power in battle'),
          unitName: a.unitName || a.type,
          powerName: sp.name,
          powerFlavour: sp.flavour,
        });
        if (sp.theBlow.reaches === 'every enemy unit') {
          const dmg = rng(Number(sp.theBlow.theDamage[0]), Number(sp.theBlow.theDamage[1]));
          enemyArmies.forEach((d) => {
            d._tempStrReduction = (Number(d._tempStrReduction) || 0) + dmg;
          });
          narrate(narr, {
            kind: theLineTheBattleBetweenHeroesWrites(sp.theBlow.theLine, "a unit's power hits all enemy units"),
            enemyUnitCount: enemyArmies.length,
            damage: dmg,
          });
        } else {
          const d = enemyArmies[Math.floor(kcRng() * enemyArmies.length)];
          if (!d) throw new TypeError("a unit's strike fell on no enemy unit"); // (the registry strikes only where there is one)
          const dmg = rng(Number(sp.theBlow.theDamage[0]), Number(sp.theBlow.theDamage[1]));
          d._tempStrReduction = (Number(d._tempStrReduction) || 0) + dmg;
          narrate(narr, {
            kind: theLineTheBattleBetweenHeroesWrites(sp.theBlow.theLine, "a unit's power hits one enemy unit"),
            struckUnitName: d.unitName || d.type,
            damage: dmg,
          });
        }
      }
    });
  }
  applyArmyBattleSpells(atk, atkArmies, defArmies, narrative);
  if (!_atkLA) applyArmyBattleSpells(def, defArmies, atkArmies, narrative);

  // Each commander's Tactical and Naval as the battle counts them, once both sides' magic has taken effect: a Curse
  // cast here withers the skill the set-up counted (R-162), as against guards. The later stages read them from the
  // set-up's values, so they are written there.
  const theTacticalBonus = (level: number) =>
    isPvPSea
      ? 1
      : Math.min(
          KC_A_COMMANDERS_TACTICAL_AND_NAVAL_IN_A_BATTLE.theMostTimesTacticalLiftsHisHost,
          1 + level * KC_A_COMMANDERS_TACTICAL_AND_NAVAL_IN_A_BATTLE.theRiseEachLevelOfTacticalGivesHisHost,
        );
  const theNavalBonus = (level: number) =>
    1 + level * KC_A_COMMANDERS_TACTICAL_AND_NAVAL_IN_A_BATTLE.theRiseEachLevelOfNavalGivesHisFleetsAndSeaBeasts;
  if (atk._curseHalveStat === 'tactical') {
    theSetUp.atkTact = theLevelACommanderFightsWithOnceACurseHasTakenEffect(atk, 'tactical', theSetUp.atkTact);
    theSetUp.atkTactBonus = theTacticalBonus(theSetUp.atkTact);
  }
  if (def._curseHalveStat === 'tactical') {
    theSetUp.defTact = theLevelACommanderFightsWithOnceACurseHasTakenEffect(def, 'tactical', theSetUp.defTact);
    theSetUp.defTactBonus = theTacticalBonus(theSetUp.defTact);
  }
  if (atk._curseHalveStat === 'naval') {
    theSetUp.atkNav = theLevelACommanderFightsWithOnceACurseHasTakenEffect(atk, 'naval', theSetUp.atkNav);
    theSetUp.atkNavBonus = theNavalBonus(theSetUp.atkNav);
  }
  if (def._curseHalveStat === 'naval') {
    theSetUp.defNav = theLevelACommanderFightsWithOnceACurseHasTakenEffect(def, 'naval', theSetUp.defNav);
    theSetUp.defNavBonus = theNavalBonus(theSetUp.defNav);
  }
}
