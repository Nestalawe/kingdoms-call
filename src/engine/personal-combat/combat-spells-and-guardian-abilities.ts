// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_MAGIC_SCHOOLS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { combatSpellsAllowedPerSchoolEachFight } from '../rules-on-plain-values/spells-each-school-allows-a-turn-and-a-fight.ts';
import { SKILL_LABELS } from '../army-tables.ts';
import { hasItemBase } from '../items/equipment.ts';
import { PC_SPELL_SCHOOL_MAP, PC_WEAK_MULT, pcDeferEffect, pcLearnWeakness, pcPushDot } from './helpers.ts';
import { d100, rng } from '../dice-and-army-names.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { pcFoeCat, skillLevel } from '../titles/perks.ts';
import { SPELL_CAST_BASE, magicL8CastBonus } from '../chances-and-lair-grades.ts';
import { discSum } from '../discoveries.ts';
import { telSpell } from '../turn/log-line-helpers.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { pcNewStatus } from './speed-encounter-plans-and-combatants.ts';
import {
  pcCourageChance,
  pcHitSkill,
  pcLandStun,
  pcMeleeDamage,
  pcStunTurned,
  pcTakeHit,
} from './to-hit-wounds-stuns-and-courage.ts';
import { pcCombatXP } from './melee-flight-and-archery.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';
import { aFightersWardAsTheLineTellsIt } from './the-facts-a-personal-combats-lines-record.ts';

// ── PERSONAL COMBAT: COMBAT SPELLS AND GUARDIAN ABILITIES (plan P1-08e: lifted out of resolveTurn) ────
// A spell cast in a personal fight (pcCastCombatSpell, with the spell-balance figures above it) and a guardian's
// special ability (pcMonsterSpecial). Both take the turn's context first (src/engine/turn/context.ts).
// --- Combat spell dispatch (per-school CSV effects slot in here) ------------- Returns true if
// the spell resolved (successfully cast), false if it fizzled/was invalid.
// NOTE: school-by-school CSV combat effects will be implemented here. For now it reproduces the
// previous encounter behaviour so nothing regresses while schools are migrated.
// ── PERSONAL-COMBAT SPELL BALANCE ────
// Measured across the whole bestiary at hero level 6, the five schools were not close: Elemental
// 80%, Necromancy 78%, Illusory 74%, Psychic 72%, White 66% — against 72% for a plain Blade with
// no magic at all, which is to say White was worse than carrying nothing. Two faults ran through
// the set. First, the best spells did not read the caster: Fireball, Psychic Blast, Telekinetic
// Storm and Invisibility were identical at school level 1 and level 5, so a dabbler got a
// master's spell. Second, White had no way to convert an action into an advantage at all. Each
// spell keeps what it does; the numbers below are what changed.
export const SPELL_FIREBALL_BASE_PCT = 10,
  SPELL_FIREBALL_PCT_PER_LVL = 2; // burn, % of target max HP a round (2026-10-14, batch item 6: was 3 + 1 a level)
export const SPELL_HOLY_PEN_PER_LVL = 8; // Holy Symbol to-hit penalty a level
export const SPELL_HOLY_HEAL_PCT = 10; // …and the light closes the caster's hurts
export const SPELL_HOLY_BURN_PCT = 6; // …and sears the foe (×1.5 vs undead and fiends)
export const SPELL_HOLY_UNCLEAN_MULT = 1.5; // penalty and burn against the undead and fiends (was ×2 until 2026-10-14)
export const SPELL_SPIRITWRACK_BASE_ROUNDS = 1,
  SPELL_SPIRITWRACK_MAX_ROUNDS = 3; // 1 + floor(level/2), level counted to 5: max 3 (4 vs a White-weak guardian)
// 2026-09-26 (Toby item 3): a Powerful or Legendary guardian may shrug the binding off at the start
// of every round after the first in which it held — this chance a round.
export const SPIRITWRACK_SHRUG_PCT = { Powerful: 25, Legendary: 40 };
export const SPELL_BLAST_BASE_ROUNDS = 1; // +1 per two levels
export const SPELL_TKS_BASE_PCT = 12,
  SPELL_TKS_PCT_PER_LVL = 3; // Telekinetic Storm, % of target max HP
export const SPELL_INVIS_BASE_PCT = 10,
  SPELL_INVIS_PCT_PER_LVL = 4; // Invisibility, foe to-hit reduction
export const SPELL_HOD_BITE_PCT = 40,
  SPELL_HOD_MAX_PCT = 60; // Hand of Death
export const SPELL_MIRROR_HP_PCT = 40,
  SPELL_MIRROR_ROUNDS = 3; // Mirror Image, see the case below
export const PC_CAST_BASE = SPELL_CAST_BASE; // personal-combat casting is 30 + school level × 10 · 2026-09-11: every path now shares SPELL_CAST_BASE
export function pcCastCombatSpell(turnContext, caster, target, spellName, narrative, state): boolean {
  const { G } = turnContext;
  const SPELL_SCHOOL = PC_SPELL_SCHOOL_MAP; // one shared table (pcTakeHit reads it too)
  const school = SPELL_SCHOOL[spellName];
  if (!school) {
    return false;
  }
  const lvl = caster.school[school] || 0;
  const lvlEff = Math.min(lvl, 5); // every EFFECT scales with caster level capped at 5 (cast chance still uses the full level)
  if (lvl < 1) {
    narrate(narrative, {
      kind: 'the caster cannot cast a spell without its skill',
      casterName: caster.name,
      spellName,
      schoolLabel: SKILL_LABELS[school] || school,
    });
    return false;
  }
  // Per-combat spell limits: same spell once; per school 1 at Lv1, 2 at Lv2+.
  const limit = combatSpellsAllowedPerSchoolEachFight(lvl);
  if (caster.castSpells.includes(spellName)) {
    narrate(narrative, { kind: "the caster's spell already cast this combat", casterName: caster.name, spellName });
    return false;
  }
  if ((caster.castSchool[school] || 0) >= limit) {
    narrate(narrative, {
      kind: "the caster's spell limit reached this combat",
      casterName: caster.name,
      schoolLabel: SKILL_LABELS[school] || school,
    });
    return false;
  }
  // ── WEAKNESS ── a guardian open to this school cannot shrug the weave off: the cast always
  // takes hold (95%), and `wx` doubles every NON-damaging effect below. Damage itself is doubled
  // once, in pcTakeHit — never here, or it would double twice.
  const _wkSch = !!(
    target &&
    target.kind === 'monster' &&
    target.weak &&
    target.weak.kind === 'school' &&
    target.weak.key === school
  );
  const wx = _wkSch ? PC_WEAK_MULT : 1;
  const _castBase = _wkSch
    ? 95
    : Math.min(
        95,
        PC_CAST_BASE +
          lvl * 10 +
          magicL8CastBonus(caster.ref) +
          (caster.player != null
            ? discSum(
                turnContext,
                caster.player,
                'cast',
                'pct',
                (e) => (!e.school || e.school === school) && (!e.ctx || e.ctx === 'duel'),
              )
            : 0),
      ); // sd27 Arcane Codex + cast discoveries now apply in personal combat too (were pre-battle/action-phase only) · item 2: base 30 in PERSONAL combat (action/battle phases stay 20)
  // ── SCHOOL WARD (2026-10-14, batch item 7) ── a guardian's ward against this school takes its
  // points off the (already capped) cast chance; never below 5. A guardian is never warded against
  // the school it is weak to.
  const _sw = (!_wkSch && target && target.arm && target.arm.schoolWard && target.arm.schoolWard[school]) || 0;
  const castChance = _sw > 0 ? Math.max(5, _castBase - _sw) : _castBase;
  // narrate the cast as a deliberate ATTEMPT, so both outcomes read clearly — the reader sees the
  // character reach for the spell, then whether the weave holds or collapses.
  // show the roll alongside the chance, and say what the chance IS (a cast, not a "hold").
  // 2026-09-10 item 1: use the canonical d100 (1–100, success on roll<=chance) so a roll equal to
  // the chance succeeds, matching every other percentage check in the engine.
  const _castRoll = d100();
  telSpell(turnContext, caster.ref, spellName, school, lvl, castChance, _castRoll, 'duel');
  narrate(narrative, {
    kind: "the caster calls on a school's arts, weaving a spell",
    casterName: caster.name,
    school,
    spellName,
    castChance,
    schoolWard: _sw,
    targetsWard: aFightersWardAsTheLineTellsIt(target, 'schoolWard'),
    castRoll: _castRoll,
  });
  if (_castRoll > castChance) {
    narrate(narrative, { kind: 'but the spell guts and fizzles' });
    return false;
  }
  caster.castSpells.push(spellName);
  caster.castSchool[school] = (caster.castSchool[school] || 0) + 1;
  if (_wkSch) {
    narrate(narrative, {
      kind: "the target is open to the school's arts",
      targetName: target.name,
      school,
      targetWeakName: target.weak.name,
    });
    if (caster.player != null && pcLearnWeakness(G, caster.player, target.name))
      narrate(narrative, {
        kind: "the caster marks the target's weakness well",
        casterName: caster.name,
        targetWeakDesc: target.weak.desc,
        targetName: target.name,
      });
  }

  // ----- effects (placeholder = pre-CSV behaviour; replaced per-school later) -----
  switch (spellName) {
    case 'Lightning Bolt': {
      let d = 0;
      const _lbLvl = Math.min(Math.max(1, lvl), 5);
      for (let i = 0; i < _lbLvl; i++) d += rng(1, 3);
      /* 1–3 a level (2026-10-14, Toby item 9; was 2–4) */ const dealt = pcTakeHit(
        turnContext,
        target,
        d,
        narrative,
        caster.name,
        'Lightning Bolt',
      );
      if (dealt)
        narrate(narrative, {
          kind: "the caster's lightning bolt arcs into the target",
          casterName: caster.name,
          targetName: target.name,
          dealt,
          targetHp: Math.max(0, Math.round(target.hp)),
        });
      break;
    }
    case 'Fireball': {
      // 2026-09-15 rebalance: the burn now reads the caster. It was a flat 10% of the target's
      // maximum health a round whoever threw it, which made Elemental the strongest school at
      // level 1 and no stronger at level 5. 3% + 1% a level: 4% a round at Elemental 1, 8% at
      // Elemental 5.
      // 2026-10-14 (batch item 6): 10% + 2% a level (12% at Elemental 1, 20% at 5). A spell ward
      // (spellPct) cuts the burn as it cuts any spell's harm — the burn ticks outside pcTakeHit, so
      // the ward is applied here.
      const _fbWard = (target.arm && target.arm.spellPct) || 0;
      const _fbPct = (SPELL_FIREBALL_BASE_PCT + SPELL_FIREBALL_PCT_PER_LVL * lvlEff) * wx * (1 - _fbWard / 100);
      const _fbD = Math.max(1, Math.round((target.maxHp * _fbPct) / 100));
      const _fbE = pcPushDot(target, _fbD, 3, 'Fireball burns');
      narrate(narrative, {
        kind: 'a fireball engulfs the target and will burn',
        targetName: target.name,
        fbPct: dispFloor(_fbPct),
        burnRounds: _fbE ? _fbE.rounds : 3,
        fbWard: _fbWard,
      });
      break;
    }
    // ── WHITE (CSV) ──
    case 'Holy Symbol': {
      // 2026-09-15 rebalance: measured, a White adept was WORSE in a duel than carrying no
      // magic at all — both its spells cost an action and neither did any harm. The symbol keeps
      // its identity (a ward, not a weapon) but now sustains the one who raises it, and against
      // the unclean it burns as well as blinds. The to-hit penalty comes down from 10 to 8 a
      // level to pay for it.
      // 2026-10-14 (batch item 5): the unclean are told by their KIND — every undead and every
      // fiend — not by a name pattern (which doubled the Dust Devil, an elemental, and missed the
      // Chaos Knight, a fiend), and the symbol bites them ×1.5 rather than ×2.
      const holy = !!target.isUndead || pcFoeCat(target) === 'fiend';
      const _hm = holy ? SPELL_HOLY_UNCLEAN_MULT : 1;
      const pen = Math.round(lvlEff * SPELL_HOLY_PEN_PER_LVL * _hm * wx);
      target.status.hitPenalty = (target.status.hitPenalty || 0) + pen;
      narrate(narrative, {
        kind: 'the caster raises a holy symbol',
        casterName: caster.name,
        targetName: target.name,
        pen,
        againstTheUnclean: holy,
      });
      const _hsHeal = Math.max(1, Math.round(((caster.maxHp || 20) * SPELL_HOLY_HEAL_PCT) / 100));
      if (caster.hp < (caster.maxHp || 20)) {
        const _h = Math.min(_hsHeal, (caster.maxHp || 20) - caster.hp);
        caster.hp += _h;
        narrate(narrative, {
          kind: "the light closes the caster's hurts",
          casterName: caster.name,
          healed: _h,
          casterHp: dispFloor(caster.hp),
        });
      }
      // The light burns whatever stands between a hero and a barrow, and burns the unclean twice
      // as deep. Measured, a symbol that only blinded left White worse than carrying no magic at
      // all against anything that was neither undead nor a fiend.
      {
        const _hsD = Math.max(1, Math.round((target.maxHp * SPELL_HOLY_BURN_PCT * _hm) / 100));
        const _dealt = pcTakeHit(turnContext, target, _hsD, narrative, caster.name, 'Holy Symbol');
        if (_dealt)
          narrate(narrative, {
            kind: "the holy light's damage",
            againstTheUnclean: holy,
            targetName: target.name,
            dealt: _dealt,
            targetHp: Math.max(0, Math.round(target.hp)),
          });
      }
      break;
    }
    case 'Spiritwrack': {
      // 2026-09-26 (Toby item 3): silenced for 1 + floor(level/2) rounds.
      // 2026-10-15 (Toby, D5): the level is counted to 5, like every other spell's effect, so at most 3.
      // Against a guardian WEAK to White Magic the cast already takes hold at 95% (above) and the
      // binding runs one round longer — up to 4 — instead of doubling.
      let _swR = Math.min(
        SPELL_SPIRITWRACK_MAX_ROUNDS,
        SPELL_SPIRITWRACK_BASE_ROUNDS + Math.floor(Math.max(1, lvlEff) / 2),
      );
      if (_wkSch) _swR = Math.min(SPELL_SPIRITWRACK_MAX_ROUNDS + 1, _swR + 1);
      target.status.silenceRounds = Math.max(target.status.silenceRounds, _swR);
      target.status.meleeHalvedRounds = Math.max(target.status.meleeHalvedRounds, _swR);
      const _shr = target.kind === 'monster' ? SPIRITWRACK_SHRUG_PCT[target.power] || 0 : 0;
      target.status._swShrugPct = _shr;
      narrate(narrative, {
        kind: 'the caster binds the target with spiritwrack',
        casterName: caster.name,
        targetName: target.name,
        swR: _swR,
        shr: _shr,
        targetPower: target.power,
      });
      break;
    }
    case 'Psychic Blast': {
      // three rounds of total helplessness was the same at Psychic 1 as at
      // Psychic 5. Now 1 round + 1 per two levels (1 at Psychic 1, 3 at Psychic 5), doubled against a
      // guardian weak to Psychic; 2026-10-15 (Toby, D4): the Dreamstone's +1 comes after the doubling.
      const _stunN =
        (SPELL_BLAST_BASE_ROUNDS + Math.floor(lvlEff / 2)) * wx +
        (caster.ref && hasItemBase(caster.ref, 'Dreamstone') ? 1 : 0);
      if (pcLandStun(target, _stunN, narrative, 'the blast'))
        narrate(narrative, { kind: "psychic blast sears the target's mind", targetName: target.name, stunN: _stunN });
      break;
    }
    case 'Telekinetic Storm': {
      // a quarter of the target's health whoever threw it. Now 10% + 3% a
      // level — 27% at Psychic 5, half that from an apprentice. The recoil is unchanged.
      const d = Math.max(1, Math.round((target.maxHp * (SPELL_TKS_BASE_PCT + SPELL_TKS_PCT_PER_LVL * lvlEff)) / 100));
      const self = Math.max(0, Math.round(d * 0.25));
      const dealt = pcTakeHit(turnContext, target, d, narrative, caster.name, 'Telekinetic Storm');
      caster.hp -= self;
      if (dealt)
        narrate(narrative, {
          kind: 'a telekinetic storm rips the target',
          targetName: target.name,
          dealt,
          casterName: caster.name,
          self,
          targetHp: Math.max(0, Math.round(target.hp)),
        });
      break;
    }
    case 'Mirror Image': {
      if (!state) {
        narrate(narrative, { kind: 'the caster conjures a mirror image', casterName: caster.name });
        break;
      }
      if (state.mirror) {
        // casting again while an illusion fights dissipates both images
        narrate(narrative, { kind: 'the caster weaves a second mirror image', casterName: caster.name });
        state.mirror = null;
        break;
      }
      // Conjure a phantom duplicate of the OPPONENT, with their characteristics at this moment.
      // the phantom is a FULL clone of the mirrored combatant so it fights back exactly as they
      // would — running THEIR Encounter Plan from the very start (spells, archery and tactics,
      // not just melee). It gets its own fresh status, spell-limit trackers and plan pointer
      // (tacIdx 0) so nothing bleeds back into the real character, and its own Mirror Image casts
      // are stripped from the copied plan (an illusion casting illusions is meaningless and would
      // only end its own duel).
      let _phTactics = (target.tactics || ['ME']).slice().filter((t) => !/mirror\s*image/i.test(t));
      if (!_phTactics.length) _phTactics = ['ME'];
      // MIRROR IMAGE, REBUILT. Measured, it was the worst thing a hero could do with an action: a
      // fully trained Illusory adept beat a Lich Acolyte 100% of the time casting nothing at all,
      // and 94.3% casting this. Two faults. The phantom was a FULL-strength copy of the victim,
      // so shattering it took as long as winning the real fight; and the caster "concentrated",
      // meaning they stood still for every round the illusion lasted. An illusion now carries a
      // share of the victim's health, fades of its own accord after a few rounds, and — the
      // change that matters — the caster is free to act while the victim's attention is on it.
      const _phHp = Math.max(1, Math.round((target.hp * SPELL_MIRROR_HP_PCT) / 100));
      const ph = {
        ...target,
        kind: 'phantasm',
        name: target.name + "'s mirror image",
        ref: target.ref,
        hp: _phHp,
        maxHp: _phHp,
        school: { ...(target.school || {}) },
        specials: (target.specials || []).slice(),
        tactics: _phTactics,
        tacIdx: 0,
        planExhausted: false,
        neverFlees: true, // an illusion never runs
        castSpells: [],
        castSchool: {},
        status: pcNewStatus(),
      };
      state.mirror = { caster, victim: target, phantasm: ph, life: SPELL_MIRROR_ROUNDS };
      narrate(narrative, {
        kind: 'the caster conjures a phantom of the target',
        casterName: caster.name,
        targetName: target.name,
        targetName2: target.name,
        casterName2: caster.name,
      });
      break;
    }
    case 'Invisibility': {
      // 10% + 4% a level (14% at Illusory 1, 30% at Illusory 5) instead of a
      // flat 25 at every level. 2026-09-16: the line printed a hard-coded "\u221225%" — the flat
      // figure this spell had BEFORE the 2026-09-15 rebalance — while the code applied 10 +
      // 4/level. A player reading their own report was told the wrong number at every level.
      // Quote the figure actually applied.
      const _invPct = SPELL_INVIS_BASE_PCT + SPELL_INVIS_PCT_PER_LVL * lvlEff;
      caster.status.toHitReduce = Math.max(caster.status.toHitReduce || 0, _invPct);
      caster.status.fleeBonus = (caster.status.fleeBonus || 0) + 30;
      narrate(narrative, { kind: 'the caster fades from sight', casterName: caster.name, invPct: _invPct });
      break;
    }
    case 'Hand of Death': {
      // half the target's health on a coin flip was the single strongest thing a
      // hero could do in a duel. The grip is the same, the bite is 40% rather than 50%, and the
      // chance is capped at 60 rather than 95 so an item cannot push it to a near-certainty.
      if (kcRng() * 100 < Math.min(SPELL_HOD_MAX_PCT, lvlEff * 10 * wx)) {
        const _dfMult = caster.ref && hasItemBase(caster.ref, "Death's Finger Ring") ? 1.1 : 1;
        const d = Math.max(1, Math.round(((target.maxHp * SPELL_HOD_BITE_PCT) / 100) * _dfMult));
        const dealt = pcTakeHit(turnContext, target, d, narrative, caster.name, 'Hand of Death');
        if (dealt)
          narrate(narrative, {
            kind: "the hand of death claims part of the target's health",
            handOfDeathBitePct: SPELL_HOD_BITE_PCT,
            targetName: target.name,
            dealt,
            targetHp: Math.max(0, Math.round(target.hp)),
          });
      } else
        narrate(narrative, {
          kind: "the caster's hand of death fails",
          casterName: caster.name,
          handOfDeathChancePct: Math.min(SPELL_HOD_MAX_PCT, lvlEff * 10 * wx),
        });
      break;
    }
    case 'Curse': {
      // Halve (round down) the target's best combat ability for the duration of the fight.
      const bestSchool = KC_MAGIC_SCHOOLS.reduce(
        (b, s) => ((target.school[s] || 0) > (target.school[b] || 0) ? s : b),
        'white',
      );
      const cands = [
        ['melee', target.melee],
        ['archery', target.archery],
        ['magic', target.school[bestSchool] || 0],
      ];
      cands.sort((a, b) => b[1] - a[1]);
      const [bestKey, bestVal] = cands[0];
      if (bestVal > 0) {
        if (bestKey === 'melee') target.melee = Math.floor(target.melee / 2);
        else if (bestKey === 'archery') target.archery = Math.floor(target.archery / 2);
        else target.school[bestSchool] = Math.floor(target.school[bestSchool] / 2);
        narrate(narrative, {
          kind: "the caster's curse withers the target",
          casterName: caster.name,
          targetName: target.name,
          bestKey,
          bestSchool,
          bestAbilityLevel:
            bestKey === 'melee' ? target.melee : bestKey === 'archery' ? target.archery : target.school[bestSchool],
        });
      } else
        narrate(narrative, {
          kind: "the caster's curse finds no ability",
          casterName: caster.name,
          targetName: target.name,
        });
      break;
    }
    case 'Control Undead': {
      if (target.isUndead) {
        const _cuR = Math.max(1, lvlEff);
        if (!pcLandStun(target, _cuR, narrative, `${caster.name}'s grip`)) break; // printed the RAW level while applying the capped one — a Necromancy 8 caster was told "8 rounds" and got 5.
        narrate(narrative, {
          kind: 'the caster seizes the undead target',
          casterName: caster.name,
          targetName: target.name,
          cuR: _cuR,
        });
      } else narrate(narrative, { kind: 'control undead has no hold over the living', targetName: target.name });
      break;
    }
    case 'Charm': {
      // a king's will is beyond a Charm — no effect whatsoever (matches the action-phase rule).
      if (target && target.kind === 'character' && target.ref && target.ref.isKing) {
        narrate(narrative, {
          kind: "the caster's charm washes over a crowned will",
          casterName: caster.name,
          targetName: target.name,
        });
        break;
      }
      // ...and so is a mind swayed only last season — the same immunity the action-phase Charm
      // honours.
      if (target && target.kind === 'character' && target.ref && target.ref._charmImmuneTurn === G.turn) {
        narrate(narrative, {
          kind: "the caster's charm slides off a mind lately swayed",
          casterName: caster.name,
          targetName: target.name,
        });
        break;
      }
      // a mind swayed before resists any later Charm, combat casts included (30% per past charm,
      // cumulative).
      if (
        target &&
        target.kind === 'character' &&
        target.ref &&
        (target.ref._charmResist || 0) > 0 &&
        d100() <= target.ref._charmResist
      ) {
        narrate(narrative, {
          kind: "the caster's charm breaks against the target's will",
          casterName: caster.name,
          targetName: target.name,
          targetRefCharmResist: target.ref._charmResist,
        });
        break;
      }
      caster.status.fleeDoubled = true;
      narrate(narrative, {
        kind: "the caster charms the target's wits",
        casterName: caster.name,
        targetName: target.name,
      });
      break;
    }
    default:
      narrate(narrative, { kind: 'the caster casts a spell', casterName: caster.name, spellName });
  }
  // small skill-up chance — pass narrative so the "X rises to level N" line appears at the end of
  // the encounter report, not emitted ahead of it at the top of the phase.
  if (caster.kind === 'character' && caster.ref) {
    // 2026-09-21 (found with Toby's "Illusory 3 … rises to level 1"): after the roll this used to
    // write the RAW trained level back into the fighter's school — `ref.skills[school]||…` — so a
    // mage casting on item bonuses (Illusory 0 + a +3 diadem) dropped to Illusory 1 for the rest of
    // the fight the moment the skill rose, and a trained 6+ mage jumped past the level-5 cap. The
    // level in play is re-read exactly as pcCharCombatant built it, and only when it actually rose.
    const _lvB = skillLevel(caster.ref, school);
    pcCombatXP(turnContext, caster, school, narrative); // 2026-09-29: per successful cast, until the first success
    if (skillLevel(caster.ref, school) > _lvB)
      caster.school[school] = Math.max(caster.school[school] || 0, effStat(turnContext, caster.ref, school));
  }
  return true;
}

// --- Monster special abilities ---------------------------------------------- A monster's
// special is its equivalent of a Cast action: it appears in the creature's action plan as
// MS:<name> and resolves here. Effects are parsed from the ability's `effect` text so new
// monsters can be added as data without touching the engine.
export function pcMonsterSpecial(turnContext, actor, foe, sp, narrative, state): void {
  narrate(narrative, {
    kind: 'a fighter uses a power',
    actorName: actor.name,
    spName: sp.name,
    spFlavour: sp.flavour,
  });
  const eff = String(sp.effect || '');
  let dealt = 0;
  // a special's damage is the guardian's own MELEE-FORMULA blow (pcMeleeDamage — its tier's base + ⌈melee/2⌉)
  // × the special's weight: 1.0 light, 1.5 heavy, 2.0 breath. Legacy saved creatures
  // still carrying a dmg:[lo,hi] range roll that range instead.
  const _w = sp.dmgW != null ? sp.dmgW : sp.dmg && (sp.dmg[0] > 0 || sp.dmg[1] > 0) ? null : 0;
  if (_w !== 0) {
    let d = _w != null ? Math.max(1, Math.round(pcMeleeDamage(actor, foe) * _w)) : rng(sp.dmg[0], sp.dmg[1]);
    if (/hits twice/i.test(eff)) d *= 2;
    dealt = pcTakeHit(turnContext, foe, d, narrative, actor.name, sp.name);
    if (dealt)
      narrate(narrative, {
        kind: 'a power tears into the foe',
        spName: sp.name,
        foeName: foe.name,
        dealt,
        foeHp: Math.max(0, Math.round(foe.hp)),
      });
  }
  // ── Self-healing ──
  let heal = 0;
  if (/heals half/i.test(eff)) heal = Math.ceil(dealt / 2);
  else {
    const hm = eff.match(/(?:regains|gains)\s*\+?(\d+)\s*HP/i);
    if (hm) heal = parseInt(hm[1]);
    else if (/heal|regenerat/i.test(eff)) heal = rng(3, 8);
  }
  // a guardian may mend itself ONCE in the whole combat, whichever ability does it and however
  // many healing abilities it has. The plan already appends each heal once and only at the tail,
  // so this is the belt-and-braces half of the rule — it also covers the stalled-fight and
  // resumed-encounter paths, where a plan can be walked more than once.
  if (heal > 0 && actor._selfHealUsed) {
    heal = 0;
    if (dealt === 0)
      narrate(narrative, {
        kind: 'the guardian reaches for its own wounds again but the well is dry',
        actorName: actor.name,
      });
  }
  if (heal > 0) {
    actor._selfHealUsed = true;
    actor.hp = Math.min(actor.maxHp, actor.hp + heal);
    narrate(narrative, {
      kind: 'the guardian knits its wounds',
      actorName: actor.name,
      heal,
      actorHp: dispFloor(actor.hp),
    });
  }
  // ── Lost actions ──
  let stun = 0;
  if (/loses 3 rounds/i.test(eff)) stun = 3;
  else if (/loses 2 (?:attack )?rounds/i.test(eff)) stun = 2;
  else if (/loses (?:one|1|next) attack|loses next attack|knocked back|entranced|loses all Archery/i.test(eff))
    stun = 1;
  if (stun > 0) {
    // if the special ALSO struck a blow, the daze is a rider on that blow and grips from the next
    // round. A special that does nothing but daze still takes hold at once.
    // the target's stun ward is asked as the daze LANDS — a deferred rider that a ward turns is
    // never queued at all (batch item 3).
    if (pcStunTurned(foe, narrative, `${sp.name}'s daze`)) {
      /* turned */
    } else if (
      dealt > 0 &&
      pcDeferEffect(foe, () => {
        foe.status.stun = (foe.status.stun || 0) + stun;
      })
    )
      narrate(narrative, {
        kind: 'the foe reels from the blow, losing actions',
        foeName: foe.name,
        stun,
      });
    else {
      foe.status.stun = (foe.status.stun || 0) + stun;
      narrate(narrative, {
        kind: 'the foe is caught helpless, losing actions',
        foeName: foe.name,
        stun,
      });
    }
  }
  // ── To-hit penalties ──
  const pm = eff.match(/[-−](\d+)%/);
  if (pm) {
    const pen = parseInt(pm[1]);
    // a rider on a landed blow — it starts biting from the next round.
    if (
      dealt > 0 &&
      pcDeferEffect(foe, () => {
        foe.status.hitPenalty = (foe.status.hitPenalty || 0) + pen;
      })
    )
      narrate(narrative, { kind: 'the foe is thrown off balance from the next round', foeName: foe.name, pen });
    else {
      foe.status.hitPenalty = (foe.status.hitPenalty || 0) + pen;
      narrate(narrative, { kind: 'the foe is thrown off balance', foeName: foe.name, pen });
    }
  }
  // ── Stat swings ──
  // 2026-10-08 (Toby item 2): "hero −1 melee for next round" used to lower `melee`, which neither
  // to-hit (pcHitSkill) nor damage (meleeRaw) reads for a hero, so it did nothing. It is now a
  // status both read, lasting one round: a rider on a landed blow bites from the next round.
  if (/hero\s*[-−]1 melee/i.test(eff)) {
    const _chill = () => {
      foe.status.meleeDown = 1;
      foe.status.meleeDownRounds = 1;
    };
    const _now = Math.max(0, pcHitSkill(foe, 'melee') - 1);
    if (dealt > 0 && pcDeferEffect(foe, _chill))
      narrate(narrative, { kind: "the foe's guard is beaten down next round", foeName: foe.name, now: _now });
    else {
      _chill();
      narrate(narrative, { kind: "the foe's guard is beaten down now", foeName: foe.name, now: _now });
    }
  }
  const bm = eff.match(/gains \+(\d+) melee/i);
  if (bm) {
    actor.melee = (actor.melee || 0) + parseInt(bm[1]);
    narrate(narrative, { kind: "the guardian's melee surges", actorName: actor.name, actorMelee: actor.melee });
  }
  // ── Lingering harm ──
  const dm = eff.match(/takes (\d+) dmg at start of each round for (\d+) rounds/i);
  if (dm) {
    const _e = pcPushDot(foe, parseInt(dm[1]), parseInt(dm[2]), sp.name);
    if (_e)
      narrate(narrative, {
        kind: 'a power festers on the foe',
        spName: sp.name,
        foeName: foe.name,
        eDmg: _e.dmg,
        eRounds: _e.rounds,
      });
  }
  // ── Wards and shields ──
  const rf = eff.match(/reflects (\d+) dmg/i);
  if (rf) {
    actor.status.reflect = (actor.status.reflect || 0) + parseInt(rf[1]);
    narrate(narrative, {
      kind: 'every blow against the guardian will bite back',
      actorName: actor.name,
      actorStatusReflect: actor.status.reflect,
    });
  }
  const ab = eff.match(/absorbs next (\d+) dmg/i);
  if (ab) {
    actor.status.absorb = (actor.status.absorb || 0) + parseInt(ab[1]);
    narrate(narrative, {
      kind: 'a ward shrouds the guardian',
      actorName: actor.name,
      actorStatusAbsorb: actor.status.absorb,
    });
  }
  if (/ignores all armour/i.test(eff)) foe.status.incomingDmgBonus = (foe.status.incomingDmgBonus || 0) + 3;
  // ── Halving (Sept 2026: replaced Finger of Death's 10% instant kill) — a chance to cut the
  // foe's CURRENT HP in half.
  const hv = eff.match(/(\d+)% halves current hp/i);
  if (hv && foe.hp > 1 && kcRng() * 100 < parseInt(hv[1])) {
    const _cut = Math.floor(foe.hp / 2);
    foe.hp -= _cut;
    narrate(narrative, {
      kind: "death's touch tears the foe's strength in half",
      foeName: foe.name,
      cut: _cut,
      foeHp: Math.max(0, Math.round(foe.hp)),
    });
  }
  // ── Instant kill ──
  const ik = eff.match(/(\d+)% instant kill/i);
  if (ik && kcRng() * 100 < parseInt(ik[1])) {
    foe.hp = 0;
    narrate(narrative, { kind: 'the foe is struck down where they stand', foeName: foe.name });
  }
  // A demigod was still routed by a Banshee a quarter of the time. It is now a real contest (see
  // pcCourageChance): nerve comes from martial mastery, temper and faith, and the creature's own
  // stature sets how hard it presses.
  if (/courage test or flee/i.test(eff) && !foe.neverFlees) {
    if (foe.arm && foe.arm.stunImmune) {
      narrate(narrative, { kind: 'the foe cannot be gripped by it', foeName: foe.name });
    } else {
      const _tc = pcCourageChance(foe, actor),
        _tr = d100();
      narrate(narrative, {
        kind: 'the foe must hold their nerve',
        foeName: foe.name,
        tc: _tc,
        tr: _tr,
      });
      if (_tr <= _tc) {
        state.fledBy = foe;
        narrate(narrative, { kind: 'the foe is overcome with sheer terror', foeName: foe.name });
      } else narrate(narrative, { kind: 'the foe steels their nerve', foeName: foe.name });
    }
  }
  if (/flee chance/i.test(eff)) {
    foe.status.fleePenalty = (foe.status.fleePenalty || 0) + 30;
    narrate(narrative, { kind: 'the foe feels dragged towards the creature', foeName: foe.name });
  }
  // ── Rebirth (Phoenix) — banked, spent if the creature is felled ──
  if (/rebirth/i.test(sp.name || '')) actor._rebirth = true;
}
