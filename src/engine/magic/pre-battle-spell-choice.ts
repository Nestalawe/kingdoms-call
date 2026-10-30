import { SPELL_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { BATTLE_MAGIC_SPELL_NAMES } from '../army-tables.ts';
import { MISSILE_ARMIES_MASTER } from '../battle/ladder.ts';
import { effStat } from '../heroes/effective-skills-and-hidden-heroes.ts';
import type { Army, Character } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';

/** The enemy commander as the spell's use reads him: a hero, his Tactical halved or his Druid negated this battle. */
type AnEnemyCommanderAsTheSpellChoiceReadsHim = Character & {
  readonly _tacticalHalved?: boolean | undefined;
  readonly _druidNegated?: boolean | undefined;
};
/** The enemy's units as the spell's use reads them (or none): each one's type, and whether it is risen dead. */
type TheEnemysUnitsAsTheSpellChoiceReadsThem = readonly Pick<Army, 'type' | '_isSkeletal'>[] | null | undefined;

// ── PRE-BATTLE SPELL CHOICE (plan P1-08c: lifted out of resolveTurn) ────
// Which battle spell a commander casts before the armies meet: one from the school in the Encounter Plan that has
// something to hit on this field, or the spell named. Both functions take the turn's context first
// (src/engine/turn/context.ts).
// ── PRE-BATTLE MAGIC SCHOOL CHOICE ────
// Players choose a magic SCHOOL in their Encounter Plan (tactic 'CS:<school>'); during the
// pre-battle magic phase a RANDOM battle spell the commander can cast from that school is chosen.
// Legacy 'CA:<spell>' tactics still cast that exact spell.
export const BATTLE_SPELLS_BY_SCHOOL = {
  white: ['Holy Symbol', 'Spiritwrack'],
  elemental: ['Fireball', 'Lightning Bolt'],
  psychic: ['Psychic Blast', 'Telekinetic Storm'],
  necromancy: ['Curse', 'Control Undead'],
};
export const BATTLE_MAGIC_SPELL_SET = new Set(BATTLE_MAGIC_SPELL_NAMES);
// A battle spell is only worth choosing if the field offers it a valid target/effect: Storm and
// Blast need an enemy commander with the skill they negate; Curse needs a commander with any
// curseable skill; Control Undead and Holy Symbol need enemy undead; Spiritwrack needs enemy
// missile troops. Fireball and Lightning Bolt need only enemies on the field.
export function battleSpellUseful(
  turnContext: TurnContext,
  spellName: string,
  enemyCmdr: AnEnemyCommanderAsTheSpellChoiceReadsHim | null | undefined,
  enemyArmies: TheEnemysUnitsAsTheSpellChoiceReadsThem,
) {
  const armies = enemyArmies ?? [];
  const hasUndead = armies.some(
    (a) => (a._isSkeletal ?? false) || /Skelet|Bone|Wraith|Zombie|Ghoul|Lich|Undead/i.test(a.type || ''),
  );
  switch (spellName) {
    case 'Telekinetic Storm':
      return !!enemyCmdr && !enemyCmdr._tacticalHalved && effStat(turnContext, enemyCmdr, 'tactical') > 0;
    case 'Psychic Blast':
      return !!enemyCmdr && !enemyCmdr._druidNegated && effStat(turnContext, enemyCmdr, 'druid') > 0;
    case 'Curse':
      return (
        !!enemyCmdr &&
        (effStat(turnContext, enemyCmdr, 'tactical') > 0 ||
          effStat(turnContext, enemyCmdr, 'druid') > 0 ||
          effStat(turnContext, enemyCmdr, 'naval') > 0)
      );
    case 'Control Undead':
      return hasUndead;
    case 'Holy Symbol':
      return hasUndead;
    case 'Spiritwrack':
      return armies.some((a) => MISSILE_ARMIES_MASTER.has(a.type)); // MASTER set — the similarly named MISSILE_ARMIES is combatVsNPC-local (scope trap)
    default:
      return armies.length > 0;
  }
}
export function pickBattleSpell(
  turnContext: TurnContext,
  tactics: readonly (string | null | undefined)[] | null | undefined,
  heroChar: Character,
  enemyCmdr: AnEnemyCommanderAsTheSpellChoiceReadsHim | null | undefined,
  enemyArmies: TheEnemysUnitsAsTheSpellChoiceReadsThem,
) {
  tactics = tactics ?? [];
  // the battle spells by any school a plan names
  const spellsBySchool: Readonly<Partial<Record<string, readonly string[]>>> = BATTLE_SPELLS_BY_SCHOOL;
  // Preferred: an explicit school choice — cast a random USEFUL spell the commander knows from
  // that school. Spells with no valid target on this field (e.g. Control Undead against a living
  // enemy) are excluded from the auto-pick, so the phase is never wasted on a guaranteed no-op.
  for (const t of tactics) {
    const tactic = t ?? ''; // a tactic, or none (which names no school)
    if (tactic.toUpperCase().startsWith('CS:')) {
      const school = tactic.slice(3).toLowerCase().trim();
      const pool = (spellsBySchool[school] ?? []).filter((sp) =>
        battleSpellUseful(turnContext, sp, enemyCmdr, enemyArmies),
      );
      if (pool.length && effStat(turnContext, heroChar, school) >= 1) {
        return { spellName: pool[Math.floor(kcRng() * pool.length)], school };
      }
    }
  }
  // Legacy: an explicit single-spell choice. An explicitly named spell is HONOURED even if it has
  // no valid target — the player asked for it by name, and the handler narrates the miss.
  // the spells' rows by any name a plan gives
  const spellDefs: Readonly<Partial<Record<string, { readonly school: string }>>> = SPELL_DEFS_P;
  for (const t of tactics) {
    const tactic = t ?? ''; // a tactic, or none (which names no spell)
    if (tactic.toUpperCase().startsWith('CA:')) {
      const spellName = tactic.slice(3);
      if (BATTLE_MAGIC_SPELL_SET.has(spellName)) {
        const school = (spellDefs[spellName]?.school ?? '') || 'elemental';
        if (effStat(turnContext, heroChar, school) >= 1) return { spellName, school };
      }
    }
  }
  return null;
}
