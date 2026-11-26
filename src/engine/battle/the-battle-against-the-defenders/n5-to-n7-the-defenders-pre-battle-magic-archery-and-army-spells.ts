// The battle against a province's defenders (combatVsNPC, src/engine/battle/battles-against-province-defenders.ts), its
// third stage, B-06bb: the defenders' pre-battle phases, their commander's magic (the battle proof's N5), their archery
// with the Lightning Advance line and their Flak Screen (N6), and their units' army spells (N7), moved here as they
// were, the same statements in the same order. combatVsNPC calls it where they stood, after the attacker's pre-battle
// phases (n3-to-n4-…), and hands it what the set-up and those phases returned, as they are. It returns nothing: it
// changes only the objects it is handed (the two hosts, the commanders, the narrative), and declares no value a later
// stage reads, so the battle's state (its type and table in n3-to-n4-…) gains no field. The battle proof
// (tools/proof/README.md, section 8) finds N5's, N6's and N7's anchors in this file; nothing above N5's draws a die.
import { SPELL_DEFS_P } from '../../../content/kingdoms-call-data.ts';
import { kcRng } from '../../rng.ts';
import {
  whatABattleSpellDoesBeforeTheBattle,
  whatAUnitsStrikeMayDoBeforeTheBattle,
} from '../../rules/the-registry-of-spell-effects.ts';
import {
  abilityMissileUnits,
  abilityVolleys,
  applyFlakScreen,
  archeryBlockedBy,
  eyesOfTheForestLine,
  missileDamageMult,
  missileTargetPool,
} from '../strength.ts';
import { unitBaseStrength } from '../../rules-on-plain-values/unit-types-and-base-strength.ts';
import { shuffleP } from '../fortune.ts';
import { d100, rng } from '../../dice-and-army-names.ts';
import { dispFloor } from '../../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { guardCastChance, primalStrikeItemBonus } from '../../chances-and-lair-grades.ts';
import { telSpell } from '../../turn/log-line-helpers.ts';
import { effStat } from '../../heroes/effective-skills-and-hidden-heroes.ts';
import { MISSILE_CAP_FRACTION, applyMissileHit, bestCurseSkill } from '../terrain-and-unit-strength.ts';
import { battleSpellUseful, pickBattleSpell } from '../../magic/pre-battle-spell-choice.ts';
import { ensureEncounterPlan } from '../../personal-combat/speed-encounter-plans-and-combatants.ts';
import { narrate } from '../../turn/events-and-their-audiences.ts';
import type { TurnContext } from '../../turn/context.ts';
import type { HeroInABattle, ProvinceInABattle } from '../../army-tables.ts';
import type { ASideAsABattlesReportLinesNameIt } from '../the-facts-a-battles-lines-record.ts';
import type { AnEnemyUnitStruck } from '../../rules/the-registry-of-content-effects.ts';
import { asItsGuardReadsIt } from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { AUnitInTheBattleAgainstTheDefenders } from './n0-to-n2-the-set-up-the-duel-and-the-sides-to-the-home-ground.ts';
import {
  type WhatTheSetUpOfTheBattleAgainstTheDefendersHandsOn,
  type theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders,
} from './n3-to-n4-the-attackers-pre-battle-magic-army-spells-archery-flak-and-breach.ts';
import { theLineThisCopyOfTheBattleWrites } from './the-line-a-copy-of-the-battle-writes.ts';

/** What the attacker's pre-battle phases hand on to the later stages, as they returned it. */
export type WhatTheAttackersPreBattlePhasesInTheBattleAgainstTheDefendersHandOn = ReturnType<
  typeof theAttackersPreBattlePhasesInTheBattleAgainstTheDefenders
>;

/** The third stage of the battle against a province's defenders: their commander's pre-battle magic, their archery
 *  and their units' army spells, each striking the attacker's host before the lines meet. */
export function theDefendersPreBattlePhasesInTheBattleAgainstTheDefenders(
  turnContext: TurnContext,
  c: HeroInABattle,
  prov: ProvinceInABattle,
  theSetUp: WhatTheSetUpOfTheBattleAgainstTheDefendersHandsOn,
  theAttackersPhases: WhatTheAttackersPreBattlePhasesInTheBattleAgainstTheDefendersHandOn,
) {
  const {
    G,
    theAttackerAsTheGuardsReadHim,
    narrative,
    _cLA,
    armies,
    defenders,
    atkCmdrSlain,
    atkSide,
    defHero,
    MISSILE_ARMIES,
    skillLabels,
  } = theSetUp;
  const { BATTLE_MAGIC_SPELLS } = theAttackersPhases;
  // ════
  // DEFENDER PRE-BATTLE PHASES — neutral guard heroes and their armies fight back with magic,
  // army spells, and missile fire (reduces ATTACKER strength)
  // ════
  // Lightning Advance stops their commander's battle spell, as it stops a hero's between heroes (R-162).
  if (defHero && !_cLA) {
    // DEFENDER MAGIC: guard casts a battle spell from their encounter plan (school or specific),
    // or picks one they know
    ensureEncounterPlan(turnContext, defHero);
    const defTactics = defHero.encounterPlan?.tactics ?? [];
    let defSpellName: string | null | undefined = null;
    // the spells' rows, read by any battle spell's name
    const spellDefs: Readonly<Partial<Record<string, { readonly school: string }>>> = SPELL_DEFS_P;
    // First: honour an explicit school ('CS:') or spell ('CA:') choice from the plan
    const defPick = pickBattleSpell(turnContext, defTactics, defHero, atkCmdrSlain ? null : c, armies);
    if (defPick) defSpellName = defPick.spellName;
    // Otherwise: auto-pick a battle spell the guard has the school skill for — preferring one
    // that actually has a valid target/effect on this field, so the cast is not wasted.
    if (!defSpellName) {
      for (const sname of BATTLE_MAGIC_SPELLS) {
        const sdef = spellDefs[sname];
        if (
          sdef &&
          effStat(turnContext, defHero, sdef.school) > 0 &&
          battleSpellUseful(turnContext, sname, atkCmdrSlain ? null : c, armies)
        ) {
          defSpellName = sname;
          break;
        }
      }
    }
    if (!defSpellName) {
      for (const sname of BATTLE_MAGIC_SPELLS) {
        const sdef = spellDefs[sname];
        if (sdef && effStat(turnContext, defHero, sdef.school) > 0) {
          defSpellName = sname;
          break;
        }
      }
    }
    if (defSpellName && armies.length > 0) {
      const sdef = spellDefs[defSpellName];
      const school = (sdef?.school ?? '') || 'elemental';
      const defSpellLvl = effStat(turnContext, defHero, school);
      if (defSpellLvl > 0) {
        const castChance = guardCastChance(defHero, school, G.characters); // D7: the same odds as a player's hero
        const castRoll = d100();
        telSpell(turnContext, defHero, defSpellName, school, defSpellLvl, castChance, castRoll, 'battle');
        narrate(narrative, {
          kind: 'the defender casts a spell before the battle',
          casterName: defHero.name,
          spellName: defSpellName,
          schoolLabel: (skillLabels[school] ?? '') || school,
          spellLevel: defSpellLvl,
          castChance,
          castRoll,
        });
        if (castRoll <= castChance) {
          // no school gain from pre-battle magic — see the attacker's cast above.
          // What the spell does is the spells' registry's (plan P1-19u); this copy draws where it drew, applies it and
          // writes its line.
          const done = whatABattleSpellDoesBeforeTheBattle(defSpellName, {
            theCopy: "the guards' commander",
            theCastersLevel: defSpellLvl,
            theEnemysUnits: armies.map((a) => ({
              type: a.type || '',
              race: a.race,
              isSkeletal: !!a._isSkeletal,
              baseStrength: unitBaseStrength(a),
              isAMissileUnit: MISSILE_ARMIES.has(a.type),
            })),
            theEnemyCommander: theAttackerAsTheGuardsReadHim
              ? { tactical: effStat(turnContext, c, 'tactical'), theSkillACurseWithers: bestCurseSkill(turnContext, c) }
              : null,
            atSea: prov.terrain === 'sea',
            theStrongestUnitsTheCastersItemsLetAFireballStrike: null,
          });
          // an attacking unit the spell strikes, by its place in the list handed it
          const theAttackerStruck = (s: AnEnemyUnitStruck) => {
            const a = armies[s.theUnit];
            if (!a) throw new TypeError("a battle spell struck a unit not among the attacker's");
            return a;
          };
          const strike = (s: AnEnemyUnitStruck) => {
            const a = theAttackerStruck(s);
            a._tempStrReduction = (Number(a._tempStrReduction) || 0) + s.theStrengthItLoses;
          };
          switch (done?.kind) {
            case 'the strongest units lose strength': {
              const [hit] = done.theUnitsStruck;
              if (!hit) throw new TypeError("Cannot read properties of undefined (reading 'theUnit')"); // (the guards' fireball strikes one)
              strike(hit);
              const theUnitStruck = theAttackerStruck(hit);
              narrate(narrative, {
                kind: theLineThisCopyOfTheBattleWrites(done.theLine, "a fireball halves the attackers' strongest unit"),
                targetUnitName: theUnitStruck.unitName || theUnitStruck.type,
                strengthLost: hit.theStrengthItLoses,
              });
              break;
            }
            case 'units drawn at random lose strength': {
              const theLoss = new Map(
                armies.map((a, i): [AUnitInTheBattleAgainstTheDefenders, number | undefined] => [
                  a,
                  done.theStrengthEachWouldLose[i],
                ]),
              );
              shuffleP(armies)
                .slice(0, done.howMany)
                .forEach((a) => {
                  a._tempStrReduction = (Number(a._tempStrReduction) || 0) + Number(theLoss.get(a));
                });
              narrate(narrative, {
                kind: theLineThisCopyOfTheBattleWrites(done.theLine, 'a lightning bolt sears the attacking units'),
                unitCount: done.howMany,
              });
              break;
            }
            case 'the undead lose strength':
              done.theUnitsStruck.forEach(strike);
              narrate(narrative, {
                kind: theLineThisCopyOfTheBattleWrites(done.theLine, 'a holy symbol sears the attacking undead'),
                undeadUnitCount: done.theUnitsStruck.length,
              });
              break;
            case 'the missile units lose strength':
              done.theUnitsStruck.forEach(strike);
              narrate(narrative, {
                kind: theLineThisCopyOfTheBattleWrites(done.theLine, "spiritwrack halves the attackers' missile units"),
                missileUnitCount: done.theUnitsStruck.length,
              });
              break;
            case "the enemy commander's Tactical is cut":
              c._tacticalHalved = true;
              c._tacticalMult = done.theMultiplier;
              narrate(narrative, {
                kind: theLineThisCopyOfTheBattleWrites(
                  done.theLine,
                  "a telekinetic storm scatters the enemy commander's formations",
                ),
                enemyCommanderName: atkSide,
              });
              break;
            case "the enemy commander's Tactical is marked, with none to cut":
              c._tacticalHalved = true;
              narrate(narrative, {
                kind: theLineThisCopyOfTheBattleWrites(
                  done.theLine,
                  'a telekinetic storm finds no tactical command to disrupt',
                ),
                enemyCommanderName: atkSide,
              });
              break;
            case "the enemy commander's Druid is negated":
              c._druidNegated = true;
              narrate(narrative, {
                kind: theLineThisCopyOfTheBattleWrites(
                  done.theLine,
                  "a psychic blast severs the enemy commander's bond with his beasts",
                ),
                enemyCommanderName: atkSide,
              });
              break;
            case "the enemy commander's skill is withered":
              c._curseHalveStat = done.theSkill;
              narrate(narrative, {
                kind: theLineThisCopyOfTheBattleWrites(done.theLine, "a curse withers the enemy commander's skill"),
                enemyCommanderName: atkSide,
                cursedSkill: c._curseHalveStat,
              });
              break;
            case 'an undead unit drawn at random defects': {
              const pick = done.theUndead[Math.floor(kcRng() * done.theUndead.length)];
              const [unit] = armies.splice(Number(pick), 1);
              if (!unit) throw new TypeError("an undead unit drawn among the attacker's is not there");
              defHero.armies = asItsGuardReadsIt(defHero.armies) ?? [];
              defHero.armies.push(unit);
              const rc = G.characters[defHero.id];
              if (rc && rc !== defHero) {
                rc.armies = asItsGuardReadsIt(rc.armies) ?? [];
                rc.armies.push(unit);
              }
              narrate(narrative, {
                kind: theLineThisCopyOfTheBattleWrites(
                  done.theLine,
                  "control undead turns an enemy undead unit to the caster's side",
                ),
                turnedUnitName: unit.unitName || unit.type,
                casterName: defHero.name,
              });
              break;
            }
            case 'nothing to strike':
              if (done.theLine)
                narrate(narrative, {
                  kind: theLineThisCopyOfTheBattleWrites(
                    done.theLine,
                    'control undead finds no undead among the attackers',
                    'a holy symbol finds no undead among the attackers',
                    'spiritwrack finds no missile troops among the attackers',
                  ),
                });
              break;
          }
        } else {
          narrate(narrative, { kind: "the defender's spell before the battle fizzles" });
        }
      }
    }
  }

  // DEFENDER ARCHERY — 2026-09-24 (Toby): moved OUT of the if(defHero) block, so a garrison with no
  // commander still shoots back (at Archery 0). The Lightning Advance line and the defenders' Flak
  // Screen came out with it — both had also been skipped for a leaderless garrison.
  // DEFENDER ARCHERY: defending missile units fire at the attackers
  if (_cLA) {
    defenders.forEach((d: AUnitInTheBattleAgainstTheDefenders | null | undefined) => {
      if (d) d._laNoTerrain = true;
    });
    narrate(narrative, { kind: "the attacker's lightning advance catches the defenders unready", cName: c.name });
  }
  // The defenders as the lines before the volleys name them (plan P1-12d31: a record; the prose writes the label): their
  // guard, or "The defenders" with no guard (or a guard with no name) to name them.
  const _defSideBeforeTheVolleys: ASideAsABattlesReportLinesNameIt = defHero?.name
    ? { kind: 'the defenders led by their guard', guardName: defHero.name }
    : { kind: "a province's defenders with no guard to name them, as the lines before the volleys name them" };
  applyFlakScreen(_cLA ? [] : defenders, armies, _defSideBeforeTheVolleys, narrative);
  // ELF — Ambush, the other direction (2026-09-27, Toby): only the ATTACKER's volley was gated here,
  // so Forest Wardens marching on a neutral garrison did not silence its archers, while the very
  // same Wardens attacking another PLAYER did (the PvP path tests the OTHER side's force whichever
  // way round it is). Both paths now agree: a force facing Wardens in forest or jungle loses its
  // volley, attacking or defending.
  if (!_cLA) {
    const _eyes = eyesOfTheForestLine(armies, prov.terrain, defenders, _defSideBeforeTheVolleys);
    if (_eyes) narrate(narrative, _eyes);
  } // ELF — Eyes of the Forest
  const _defArchBlocked = !_cLA && archeryBlockedBy(armies, prov.terrain, defenders);
  if (_defArchBlocked && defenders.some((a) => MISSILE_ARMIES.has(a.type)))
    narrate(narrative, {
      kind: "the defenders' archers find no target among the attacker's forest wardens",
      cName: atkSide,
    });
  const missileDef = _cLA || _defArchBlocked ? [] : abilityMissileUnits(defenders, prov.terrain);
  if (missileDef.length > 0 && armies.length > 0) {
    const defArchSkill = defHero ? effStat(turnContext, defHero, 'archery') : 0; // a leaderless garrison shoots at Archery 0
    const _prepared = missileDef.some((d) => abilityVolleys(d, false) > 1); // HUMAN — Prepared Ground: defending Longbows loose twice
    narrate(narrative, {
      kind: "the defenders' archery volley begins",
      missileUnitCount: missileDef.length,
      preparedGround: _prepared,
    });
    let totalDefArrow = 0;
    missileDef.forEach((def) => {
      for (let v = 0; v < abilityVolleys(def, false); v++) {
        // winged riders first (a random one each shot), else any random attacker not yet at its cap
        const pool = missileTargetPool(armies, 0, def, defenders);
        if (!pool.length) break;
        const target = pool[Math.floor(kcRng() * pool.length)];
        if (!target) throw new TypeError('a volley loosed at no target'); // (the pool has just been found not empty)
        const dmgMult = missileDamageMult(def, defenders, prov.terrain, target, false);
        const hit = applyMissileHit(target, defArchSkill, def, { dmgMult });
        totalDefArrow += hit.dmg;
        if (hit.immune)
          narrate(narrative, {
            kind: 'a unit fires at its target and the shot glances off',
            shooterName: def.unitName || def.type,
            targetUnitName: target.unitName || target.type,
            whyTheShotGlances: hit.why,
          });
        else if (hit.dmg > 0)
          narrate(narrative, {
            kind: 'a unit fires at its target and weakens it',
            shooterName: def.unitName || def.type,
            targetUnitName: target.unitName || target.type,
            damage: hit.dmg,
            againstAFlyer: hit.isFly,
            thickHideHalvesIt: hit.thickHide,
            shootersUnitType: def.type,
            shootersAbilityMultiplier: dmgMult,
            softenedToTheLimit: hit.capped,
          });
        else
          narrate(narrative, {
            kind: "a defending unit's target is already softened as far as arrows allow",
            unitName: def.unitName || def.type,
            targetUnitName: target.unitName || target.type,
          });
      }
    });
    narrate(narrative, {
      kind: "the defenders' archery volley's total",
      totalDamage: totalDefArrow,
      arrowSofteningCapPct: dispFloor(MISSILE_CAP_FRACTION * 100),
    });
  }

  // DEFENDER ARMY SPELLS: primal/special defending units cast their innate battle spells. MOVED
  // OUT of the if(defHero) guard: commanderless defenders (garrisons, guardian-less primal
  // provinces, leaderless survivors) previously never rolled their strikes AT ALL — a Basilisk
  // Brood defending without a hero was silently inert. No commander = druid 0 (20% base chance).
  const defDruIdLvl = defHero && !defHero._druidNegated ? effStat(turnContext, defHero, 'druid') : 0;
  (_cLA ? [] : defenders).forEach((def) => {
    // the spells' registry's "strength: a unit strikes before the battle" (plan P1-19v); this copy rolls as it rolled
    const may = whatAUnitsStrikeMayDoBeforeTheBattle({
      theCopy: "the guards' units against a hero",
      theUnitsType: def.type,
      theEnemyHasAUnit: armies.length > 0,
      theDruidLevel: defDruIdLvl || 0,
      whatTheCommandersItemsAdd: () => primalStrikeItemBonus(defHero && !defHero._druidNegated ? defHero : null),
    });
    if (!may) return;
    const sp = may.theStrikes[Math.floor(kcRng() * may.theStrikes.length)];
    if (!sp) throw new TypeError("a unit's strike picked from an empty list"); // (the registry hands at least one)
    const armySpellChance = may.theChance;
    if (kcRng() * 100 < armySpellChance) {
      narrate(narrative, {
        kind: theLineThisCopyOfTheBattleWrites(may.theLineIfItStrikes, 'a defending unit uses its power in battle'),
        unitName: def.unitName || def.type,
        powerName: sp.name,
        powerFlavour: sp.flavour,
      });
      if (sp.theBlow.reaches === 'every enemy unit') {
        const dmg = rng(Number(sp.theBlow.theDamage[0]), Number(sp.theBlow.theDamage[1]));
        armies.forEach((a) => {
          a._tempStrReduction = (Number(a._tempStrReduction) || 0) + dmg;
        });
        narrate(narrative, {
          kind: theLineThisCopyOfTheBattleWrites(sp.theBlow.theLine, "a unit's power hits every attacking unit"),
          powerName: sp.name,
          unitCount: armies.length,
          damage: dmg,
        });
      } else {
        const a = armies[Math.floor(kcRng() * armies.length)];
        if (!a) throw new TypeError("a unit's strike fell on no attacking unit"); // (the registry strikes only where there is one)
        const dmg = rng(Number(sp.theBlow.theDamage[0]), Number(sp.theBlow.theDamage[1]));
        a._tempStrReduction = (Number(a._tempStrReduction) || 0) + dmg;
        narrate(narrative, {
          kind: theLineThisCopyOfTheBattleWrites(sp.theBlow.theLine, "a unit's power hits one unit of the other side"),
          powerName: sp.name,
          struckUnitName: a.unitName || a.type,
          damage: dmg,
        });
      }
    } else if (may.theLineIfItMisses) {
      // Primal strikes now announce a miss (standard units stay quiet to keep reports lean).
      narrate(narrative, {
        kind: theLineThisCopyOfTheBattleWrites(may.theLineIfItMisses, "a unit's power gathers but never strikes"),
        unitName: def.unitName || def.type,
        powerName: sp.name,
        strikeChancePct: armySpellChance,
        druidLevel: defDruIdLvl,
      });
    }
  });
}
