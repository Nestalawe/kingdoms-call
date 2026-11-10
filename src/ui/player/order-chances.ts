import { kcHtml, type KcSafeHtml } from '../shared/kc-safe.ts';

import { KC_ITEM_UNCAPPED_SKILLS, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import {
  dispFloor,
  everySpellBySchool,
  theLevelEachMasterySpellNeeds,
  theSchoolOfEachSpell,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import type { AHerosSkillsAsTheFormReadsThem } from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';
import {
  SKILL_LABELS,
  effMagicLvl,
} from './the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts';

/** A school's cast chance as the report gives it (castChance: the GM's own figure, its level and what lifts it). */
interface ASchoolsCastChanceTheReportGives {
  readonly level?: number | undefined;
  readonly chance?: number | undefined;
  readonly arcane?: number | undefined;
  readonly mastery?: number | undefined;
  readonly discovery?: number | undefined;
}
/** A hero as the cast chance note reads him: his levels, his cast chance by school, and the Wailing Phylactery's mark. */
interface AHeroAsTheCastChanceNoteReadsHim extends AHerosSkillsAsTheFormReadsThem {
  readonly castChance?: Readonly<Partial<Record<string, ASchoolsCastChanceTheReportGives | null>>> | null | undefined;
  readonly necroAutoReady?: unknown;
}
/** The skills' names by key, read by any key (none is empty words). */
const theSkillsNames: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;

// ── ORDERS FORM ────
// ── SPELLS LIST ────
export const SPELLS_BY_SCHOOL = everySpellBySchool();
// ── CAST CHANCE NOTE ────
// What the player is quoted before ordering a spell. The GM ships `castChance` per school, computed
// by the same castChanceFor() the action phase rolls against, so this is not an estimate — it is
// the number. A spell worked from an ITEM is a flat 95%; a Wailing Phylactery makes the realm's
// first Necromancy spell of the turn certain. Falls back to the plain formula for an older report.
export function castChanceNote(
  c: AHeroAsTheCastChanceNoteReadsHim | null | undefined,
  spellName: string,
  optsHanded?: { readonly itemCast?: unknown } | null,
): KcSafeHtml | '' {
  const opts = optsHanded ?? {};
  const school = SPELL_TO_SCHOOL[spellName];
  if (!school) return '';
  const rec = c?.castChance?.[school] ?? null;
  if (opts.itemCast)
    return kcHtml`<div style="font-size:.72rem;color:var(--forest);margin-top:2px">🎲 Cast chance: <strong>95%</strong> — worked from the item, whatever your own skill.</div>`;
  const lvl = rec ? rec.level : effMagicLvl(c, school);
  if (Number(lvl) <= 0)
    return kcHtml`<div style="font-size:.72rem;color:var(--crimson);margin-top:2px">🎲 No ${(theSkillsNames[school] ?? '') || school} skill yet — this cast will fail unless a Practice order earlier this turn raises it.</div>`;
  if (school === 'necromancy' && c?.necroAutoReady)
    return kcHtml`<div style="font-size:.72rem;color:var(--forest);margin-top:2px">🎲 Cast chance: <strong>100%</strong> — your Wailing Phylactery makes this turn's first Necromancy spell certain.</div>`;
  const chance = rec ? rec.chance : Math.min(95, 30 + Number(lvl) * 10); // base 30 everywhere
  // Name what lifted it above the base, so the number is explainable.
  const bits = [`${(theSkillsNames[school] ?? '') || school} ${String(lvl)}`];
  if (rec?.arcane) bits.push(`+${String(rec.arcane)}% Arcane Codex`);
  if (rec?.mastery) bits.push(`+${String(rec.mastery)}% school mastery`);
  if (rec?.discovery) bits.push(`+${String(rec.discovery)}% discoveries`);
  const capped = Number(chance) >= 95 ? ' — the 95% cap' : '';
  return kcHtml`<div style="font-size:.72rem;color:var(--forest);margin-top:2px">🎲 Cast chance: <strong>${chance}%</strong> (${bits.join(', ')}${capped}). A failed cast is spent — the spell fizzles and the phase is used.</div>`;
}

// Reverse lookup: spell name → school
export const SPELL_TO_SCHOOL = theSchoolOfEachSpell();
// L7/L9 mastery spells require the caster's RAW school level (past-5 comes from experience only).
export const SPELL_REQ_LEVEL = theLevelEachMasterySpellNeeds();

// The skills whose item bonuses carry past a trained 5 to the ceiling of 9 (the army card's "capped at" reads them).
export const ITEM_UNCAPPED_SKILLS_P = new Set(KC_ITEM_UNCAPPED_SKILLS);

// ── DISPLAY ROUNDING (report text) ────
// Belt-and-braces partner to the GM engine's n0(): the engine now rounds every battle statistic at
// source, but this catches anything a future edit forgets. Rounds any decimal number in a report
// line to a whole number — EXCEPT one immediately preceded by '×', because multipliers are the one
// place a decimal carries meaning ('× tactical ×1.2' rounded to '×1' would say nothing at all).
// Percentages already arrive as integers from the engine, so they pass through untouched.
// 2026-09-12: every figure a player is shown is ROUNDED DOWN (toward zero), by the engine's own
// dispFloor (src/shared/): a float a hair under an integer (0.29*100) snaps to that integer rather
// than losing a point.
export function roundReportNumbers(text: string | null | undefined): string {
  // The lookarounds matter: without them a dotted sequence such as a build stamp (2026.07.23) or a
  // rules citation (AK 7.6.1) gets partially rewritten, because the engine would happily match the
  // '2026.07' inside it. Only a decimal that is not adjacent to another dot or digit is rounded.
  // 2026-09-08: a decimal FOLLOWED by × ("a 6.1× edge") is a multiplier too and is kept. (Root
  // cause of the "× fortune 1" report: the old "fortune 0.50" had no × directly before it and was
  // rounded to 1.)
  return (text ?? '').replace(
    /(\u00d7\s*)?(?<![\d.])(\d+)\.(\d+)(?![.\d\u00d7])/g,
    (m: string, mult: string | undefined, whole: string, frac: string) =>
      mult ? m : String(dispFloor(Number(whole + '.' + frac))),
  ); // rounded DOWN, never to nearest
}

// an icon representing the *kind* of unit (land / sea / flying / creature / monster) so players can
// tell them apart at a glance. Priority resolves overlaps (a Wyvern is a flying monster
// → monster; a Whale Cohort is a sea creature → sea).
export function unitEmoji(type: string): string {
  // Icons signal MOVEMENT CLASS first, then creature/monster nature — that is what a player needs
  // at a glance. Sea monsters therefore get their own icon rather than the land-dragon one, and the
  // winged primals are counted as flying because they genuinely cross water without a fleet. These
  // sets mirror the GM engine's AERIAL_TYPES / SEA_TYPES / CREATURE_ARMIES / MONSTER_ARMIES.
  const _SEAMON = new Set(KC_UNIT_CLASS.primalSea);
  const _MON = new Set(KC_UNIT_CLASS.monster.filter((t) => !KC_UNIT_CLASS.primalSea.includes(t)));
  const _FLY = new Set(KC_UNIT_CLASS.aerial);
  const _SEA = new Set(KC_UNIT_CLASS.carrier);
  const _CRE = new Set(KC_UNIT_CLASS.creature);
  const _ELEM = new Set([
    'Air Elemental',
    'Fire Elemental',
    'Earth Elemental',
    'Water Elemental',
    'Darkness Elemental',
  ]);
  if (_ELEM.has(type)) return '\u{1F300}'; // 🌀 summoned elemental
  if (_SEAMON.has(type)) return '\u{1F30A}'; // 🌊 sea monster
  if (_SEA.has(type)) return '\u26F5'; // ⛵ fleet / sea
  if (_MON.has(type)) return '\u{1F409}'; // 🐉 monster
  if (_FLY.has(type)) return '\u{1F985}'; // 🦅 flying
  if (_CRE.has(type)) return '\u{1F43E}'; // 🐾 creature
  return '\u{1F6E1}\uFE0F'; // 🛡️ land
}
