// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcHtml } from '../shared/kc-safe.ts';
import {
  KC_ITEM_UNCAPPED_SKILLS,
  KC_MAGIC_SCHOOLS,
  KC_SKILLS,
  KC_UNIT_CLASS,
} from '../../content/kingdoms-call-data.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
  aSkillAtThisLevelIsPractisedNoFurther,
  dispFloor,
  everySpellBySchool,
  theLevelEachMasterySpellNeeds,
  theChanceAHeroPractisingAloneRaisesHisSkill,
  theLevelAHerosSkillCountsAt,
  theSchoolOfEachSpell,
  unitBaseStrength,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { SKILL_LABELS } from './move-analysis.ts';
import { syncCharmCard, syncResurrectCard } from './pre-orders.ts';
import { HUMANOID_RACES_UI, formatRace } from './skills-and-projections.ts';
import { buildTargetField } from './order-targets.ts';
import {
  getOrderExtra,
  getOrderTarget,
} from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';

// ── ORDERS FORM ────
// ── SPELLS LIST ────
export const SPELLS_BY_SCHOOL = everySpellBySchool();
// ── CAST CHANCE NOTE ────
// What the player is quoted before ordering a spell. The GM ships `castChance` per school, computed
// by the same castChanceFor() the action phase rolls against, so this is not an estimate — it is
// the number. A spell worked from an ITEM is a flat 95%; a Wailing Phylactery makes the realm's
// first Necromancy spell of the turn certain. Falls back to the plain formula for an older report.
export function castChanceNote(c, spellName, opts) {
  opts = opts || {};
  const school = SPELL_TO_SCHOOL[spellName];
  if (!school) return '';
  const rec = (c && c.castChance && c.castChance[school]) || null;
  if (opts.itemCast)
    return kcHtml`<div style="font-size:.72rem;color:var(--forest);margin-top:2px">🎲 Cast chance: <strong>95%</strong> — worked from the item, whatever your own skill.</div>`;
  const lvl = rec ? rec.level : effMagicLvl(c, school);
  if (lvl <= 0)
    return kcHtml`<div style="font-size:.72rem;color:var(--crimson);margin-top:2px">🎲 No ${SKILL_LABELS[school] || school} skill yet — this cast will fail unless a Practice order earlier this turn raises it.</div>`;
  if (school === 'necromancy' && c && c.necroAutoReady)
    return kcHtml`<div style="font-size:.72rem;color:var(--forest);margin-top:2px">🎲 Cast chance: <strong>100%</strong> — your Wailing Phylactery makes this turn's first Necromancy spell certain.</div>`;
  const chance = rec ? rec.chance : Math.min(95, 30 + lvl * 10); // base 30 everywhere
  // Name what lifted it above the base, so the number is explainable.
  const bits = [`${SKILL_LABELS[school] || school} ${lvl}`];
  if (rec && rec.arcane) bits.push(`+${rec.arcane}% Arcane Codex`);
  if (rec && rec.mastery) bits.push(`+${rec.mastery}% school mastery`);
  if (rec && rec.discovery) bits.push(`+${rec.discovery}% discoveries`);
  const capped = chance >= 95 ? ' — the 95% cap' : '';
  return kcHtml`<div style="font-size:.72rem;color:var(--forest);margin-top:2px">🎲 Cast chance: <strong>${chance}%</strong> (${bits.join(', ')}${capped}). A failed cast is spent — the spell fizzles and the phase is used.</div>`;
}

// ── ORDER SUCCESS CHANCE ────
// Quotes the odds the engine will roll for an order, from the `orderChance` block the GM ships (its
// own formulas, computed from the same effective skills the turn resolves with). Where a factor
// cannot be known at order time — an enemy's counter-espionage, whether a vault is guarded, who
// ends up practising alongside — the note says so instead of pretending the number is final.
export function chanceLine(txt, tone) {
  const col = tone === 'bad' ? 'var(--crimson)' : tone === 'sure' ? '#2d6a2d' : 'var(--forest)';
  return kcHtml`<div style="font-size:.72rem;color:${col};margin-top:2px">🎲 ${txt}</div>`;
}
// Rebuild one order's target field in place — used when a choice within the field changes the odds
// quoted beneath it (picking a different skill to practise). Mirrors what onSpellChange does.
export function rebuildTargetWrap(charId, ph) {
  const wrap = document.getElementById(`po-target-wrap-${charId}-${ph}`);
  const c = ((currentReport && currentReport.characters) || []).find((x) => String(x.id) === String(charId));
  if (!wrap || !c) return;
  const saved = {
    action: document.getElementById(`po-action-${charId}-${ph}`)?.value || '',
    target: getOrderTarget(charId, ph),
    extra: getOrderExtra(charId, ph),
  };
  try {
    wrap.innerHTML = buildTargetField(c, ph, saved);
  } catch (e) {
    console.warn('target rebuild failed', e);
  }
  if (saved.action === 'Practice Skill') refreshLaterCastSpells(charId, ph); // a re-aimed practice moves later casts' limits
}
export function orderChanceNote(c, action, ph) {
  const oc = (c && c.orderChance) || null;
  if (!oc) return '';
  const pct = (n) => kcHtml`<strong>${Math.max(0, Math.min(100, dispFloor(n)))}%</strong>`;
  switch (action) {
    case 'Spy': {
      const o = oc.spy || {};
      if (o.auto)
        return chanceLine(
          kcHtml`Success is <strong>certain</strong> — ${o.autoWhy || 'your craft'} never fails. Only an enemy's counter-espionage could trouble it.`,
          'sure',
        );
      if (!o.level)
        return chanceLine(kcHtml`No Spy skill — ${pct(o.chance || 20)} at best. Espionage rewards training.`, 'bad');
      return chanceLine(
        kcHtml`Success: ${pct(o.chance)} (Spy ${o.level}). A realm with Cipher Scripts is up to 25% harder to spy on.`,
      );
    }
    case 'Research': {
      const o = oc.research || {};
      if ((o.rawLevel || 0) < 1)
        return chanceLine('Research needs Sage 1+ — without it the archives yield nothing.', 'bad');
      return chanceLine(
        kcHtml`Discovery: ${pct(o.chance)} (Sage ${o.level}). A failed search still passes the season; nothing else is lost. Each failed Research this turn makes the hero's next one ×1.2 likelier (a discovery resets it).`,
      );
    }
    case 'Assassinate': {
      const o = oc.assassinate || {};
      return chanceLine(
        kcHtml`Success: ${pct(o.chance)} (Spy ${o.level}) — but only ${pct(Math.max(0, o.chance - (o.kingPenalty || 25)))} against a king, who is heavily guarded. Failure is noticed.`,
      );
    }
    case 'Steal': {
      const o = oc.steal || {};
      return chanceLine(
        kcHtml`Success: ${pct(o.chance)} (Thief ${o.level}), halved if the target leads troops or the paymaster is guarded. Fail and you are seen unless you slip away (${pct(o.escape)}).`,
      );
    }
    case 'Grand Heist': {
      const o = oc.grandHeist || {};
      return chanceLine(
        kcHtml`Success: ${pct(o.chance)} (Thief ${o.level}), halved if the vaults are guarded — a garrison, or an enemy commander here with troops. Fail and you are seen unless you slip away (${pct(o.escape)}).`,
      );
    }
    case 'Blockade':
      return chanceLine(
        kcHtml`The blockade forms ${pct((oc.blockade || {}).chance || 50)} of the time — wind and tide decide the rest.`,
      );
    case 'Practice Skill': {
      const o = oc.practice || {};
      const by = o.byLevel || [25, 20, 15, 10, 5];
      const _pick = KC_SKILLS.indexOf(document.getElementById(`po-target-${c.id}-${ph}`)?.value || '');
      const sel = _pick >= 0 ? KC_SKILLS[_pick] : ''; // only a skill the game knows is named in the note
      // the level he holds as the report gives it (the turn reads it as the phase begins: a rise earlier this turn is
      // a forecast limit, as is a failed practice's perseverance), and the chance the turn rolls when he practises
      // alone (R-134): the base by his level and his realm's practice discoveries (in percent on the report), x1.5 for
      // a Human of a Human realm; no roll at all once practice can raise it no further
      const lvl = sel ? (c.skills || {})[sel] || 0 : null;
      const scale = `Chance falls as mastery grows: ${by.map((v, i) => `${v}% at ${i}`).join(', ')}.`;
      const extra = `Practising alongside someone of equal level adds half again; anyone of HIGHER level teaches you, and the lesson cannot fail. A run of failures makes the next attempt likelier.`;
      if (lvl == null) return chanceLine(`${scale} ${extra}`);
      const label = SKILL_LABELS[sel] || sel;
      if (aSkillAtThisLevelIsPractisedNoFurther(lvl))
        return chanceLine(
          kcHtml`No roll is made: practice raises a skill only to level 5, and ${label} is at ${lvl}. Higher levels come only from experience in the field.`,
        );
      const discoveries = (o.astro || 0) + (o.discovery || 0) + (o.bySkill ? o.bySkill[sel] || 0 : 0); // + skill-scoped practice discoveries
      const quick = c.race === 'Human' && (currentReport?.kingdom || {}).race === 'Human';
      const chance = theChanceAHeroPractisingAloneRaisesHisSkill(lvl, discoveries / 100, 0, quick) * 100;
      return chanceLine(
        kcHtml`Improvement: ${pct(chance)} at ${label} ${lvl}.${quick ? ' A Human of a Human realm learns half as fast again (×1.5).' : ''} ${extra}`,
      );
    }
    default:
      return '';
  }
}

// Reverse lookup: spell name → school
export const SPELL_TO_SCHOOL = theSchoolOfEachSpell();
// L7/L9 mastery spells require the caster's RAW school level (past-5 comes from experience only).
export const SPELL_REQ_LEVEL = theLevelEachMasterySpellNeeds();
export const rawMagicLvl = (charObj, school) => ((charObj && charObj.skills) || {})[school] || 0;

// The level of a magic school the order form offers spells by: the level the turn casts at (R-135, question 45 (c)),
// asked of the turn's own rule (theLevelAHerosSkillCountsAt: his trained level counts to 5, then his items' bonus and
// the aura stack to 9). The items' bonus and the aura are the report's (skillEff: each item name once, an equipped
// slot item only, a Crown of Command worn by a hero of his realm in his province, R-120); the trained level is the
// hero's own, or the one his earlier Practice orders project (projectedMagicLevels). A Curse ends with the turn, so no
// report shows one. The form forecasts from the report: if the Crown's wearer leaves before the cast, the turn casts
// without it.
// The skills whose item bonuses carry past a trained 5 to the ceiling of 9 (the army card's "capped at" reads them).
export const ITEM_UNCAPPED_SKILLS_P = new Set(KC_ITEM_UNCAPPED_SKILLS);
export function effMagicLvl(charObj, school) {
  const trained = ((charObj && charObj.skills) || {})[school] || 0;
  const eff = charObj && charObj.skillEff && charObj.skillEff[school];
  return theLevelAHerosSkillCountsAt(school, trained, (eff && eff.items) || 0, (eff && eff.aura) || 0, 0);
}

// 2026-10-13 (item 2, Toby): the level each magic school may have reached by phase `ph`, assuming
// every Practice Skill order on it in an earlier phase succeeds (+1 each). Practice trains a skill
// only up to 5 (6–9 come from experience), so a school already at 5 or more gains nothing; item
// bonuses and the aura are then added as effMagicLvl does. `practising` is the set of schools with such an order.
export function projectedMagicLevels(c, ph) {
  const practice = {};
  for (let prevPh = 0; prevPh < ph; prevPh++) {
    const prevAction = document.getElementById(`po-action-${c.id}-${prevPh}`)?.value || '';
    if (prevAction !== 'Practice Skill') continue;
    const t = getOrderTarget(c.id, prevPh);
    if (t && KC_MAGIC_SCHOOLS.includes(t)) practice[t] = (practice[t] || 0) + 1;
  }
  const projected = {},
    trained = {};
  KC_MAGIC_SCHOOLS.forEach((school) => {
    const raw = rawMagicLvl(c, school),
      n = practice[school] || 0;
    const rawProj = raw >= 5 ? raw : Math.min(5, raw + n);
    trained[school] = rawProj;
    projected[school] = effMagicLvl({ ...c, skills: { ...((c && c.skills) || {}), [school]: rawProj } }, school);
  });
  // `trained`: each school's trained level after those practices (the Warlock's best school is read from it, R-123)
  return { practising: new Set(Object.keys(practice)), projected, practice, trained };
}

// After an earlier phase's order changes (a Practice Skill picked or re-aimed, a spell cast), every
// LATER Cast Spell order's dropdown is rebuilt so its projected level and casting limit stay true.
export function refreshLaterCastSpells(charId, fromPh) {
  const c = ((currentReport && currentReport.characters) || []).find((x) => String(x.id) === String(charId));
  if (!c) return;
  for (let later = fromPh + 1; later <= 4; later++) {
    if ((document.getElementById(`po-action-${charId}-${later}`)?.value || '') !== 'Cast Spell') continue;
    const wrap = document.getElementById(`po-target-wrap-${charId}-${later}`);
    if (!wrap) continue;
    const before = getOrderTarget(charId, later);
    // only a spell the table knows goes back into the rebuilt markup; the spell's own target is put
    // back afterwards as the field's value, never as markup
    const known = Object.keys(SPELL_TO_SCHOOL),
      at = known.indexOf(before);
    const spell = at >= 0 ? known[at] : '';
    const savedExtra = getOrderExtra(charId, later);
    try {
      wrap.innerHTML = buildTargetField(c, later, { action: 'Cast Spell', target: spell, extra: '' });
    } catch (e) {
      console.warn('cast refresh failed', e);
    }
    const ex = document.getElementById(`po-extra-${charId}-${later}`);
    if (
      ex &&
      savedExtra &&
      getOrderTarget(charId, later) === spell &&
      (ex.tagName !== 'SELECT' || [...ex.options].some((o) => o.value === savedExtra))
    )
      ex.value = savedExtra;
    if (getOrderTarget(charId, later) !== before) {
      const l = later;
      setTimeout(() => {
        syncResurrectCard(charId, l);
        syncCharmCard(charId, l);
      }, 0);
    } // the spell itself changed
  }
}

// ── DISPLAY ROUNDING (report text) ────
// Belt-and-braces partner to the GM engine's n0(): the engine now rounds every battle statistic at
// source, but this catches anything a future edit forgets. Rounds any decimal number in a report
// line to a whole number — EXCEPT one immediately preceded by '×', because multipliers are the one
// place a decimal carries meaning ('× tactical ×1.2' rounded to '×1' would say nothing at all).
// Percentages already arrive as integers from the engine, so they pass through untouched.
// 2026-09-12: every figure a player is shown is ROUNDED DOWN (toward zero), by the engine's own
// dispFloor (src/shared/): a float a hair under an integer (0.29*100) snaps to that integer rather
// than losing a point.
export function roundReportNumbers(text) {
  // The lookarounds matter: without them a dotted sequence such as a build stamp (2026.07.23) or a
  // rules citation (AK 7.6.1) gets partially rewritten, because the engine would happily match the
  // '2026.07' inside it. Only a decimal that is not adjacent to another dot or digit is rounded.
  // 2026-09-08: a decimal FOLLOWED by × ("a 6.1× edge") is a multiplier too and is kept. (Root
  // cause of the "× fortune 1" report: the old "fortune 0.50" had no × directly before it and was
  // rounded to 1.)
  return String(text || '').replace(/(\u00d7\s*)?(?<![\d.])(\d+)\.(\d+)(?![.\d\u00d7])/g, (m, mult, whole, frac) =>
    mult ? m : String(dispFloor(Number(whole + '.' + frac))),
  ); // rounded DOWN, never to nearest
}

// Army display helper — shows unit name if known, falls back to plain type+quality
export function armyLabel(a, opts = {}) {
  const name = a.unitName ? `${a.unitName}` : '';
  if (opts.short) return name ? `${name}` : `${a.quality} ${a.type}`;
  // Classification first, then type, quality and the unit's base strength (type × quality tier) —
  // enough to judge a force at a glance without opening the rules. primal armies always lead with
  // the full word 'Creature' or 'Monster' (derived from the unit TYPE, so it shows even when the
  // army carries no race field — e.g. awakened/recruited beasts), and no separate [C]/[M] tag is
  // used.
  const primalWord = CREATURE_ARMIES.has(a.type) ? 'Creature' : MONSTER_ARMIES.has(a.type) ? 'Monster' : null;
  const race = a.race ? formatRace(a.race, a.type) : null;
  // a unit with a HUMANOID race leads with that race — "Orcish (Monster), Wyvern Riders" — so an
  // Orc garrison of wyverns is not mistaken for a primal band. Only raceless / primal units lead
  // with the bare Creature / Monster word.
  const _humanoidRace = !!(a.race && HUMANOID_RACES_UI.has(a.race));
  const lead = _humanoidRace ? (primalWord ? `${race} (${primalWord})` : race) : primalWord || race;
  const str = unitBaseStrength(a);
  // 2026-09-23 (Toby item 7): the unit's own movement rate after its strength — computed by the GM
  // report with every bonus the engine applies (March / Naval incl. items, Road & race `move`
  // discoveries, the Swift / Sea-Wolf titles). Shown only where the report supplies it (your led
  // units and garrisons); a column still moves at its slowest unit.
  const _mv =
    a.moveRate != null && !opts.noMove
      ? `Move ${a.moveRate}${a.moveKind === 'sea' ? ' (sea)' : a.moveKind === 'air' ? ' (air)' : ''}`
      : null;
  // 2026-09-23b: labelled BASE — it is type × quality only (no kinship, terrain, Tactical…), so it
  // never matches a battle figure; the Battle stats ladder starts from exactly this number.
  const detail = [lead, a.type, a.quality, `Base str ${str}`, _mv].filter(Boolean).join(', ');
  // beasts bound by the Rite of the Wild Hunt are flagged wherever an army line is rendered — they
  // draw no wages and leave when the binding fails.
  const wild =
    a.wildHunt || a._wildHuntUntilTurn != null
      ? kcHtml` <span style="color:#7a4a10;font-size:.72rem">[Wild Hunt — bound until end of turn ${a.wildHuntUntil != null ? a.wildHuntUntil : a._wildHuntUntilTurn != null ? a._wildHuntUntilTurn : '?'}, no wages]</span>`
      : '';
  return kcHtml`${name ? `${name} (${detail})` : detail}${wild}`;
}

// an icon representing the *kind* of unit (land / sea / flying / creature / monster) so players can
// tell them apart at a glance. Priority resolves overlaps (a Wyvern is a flying monster
// → monster; a Whale Cohort is a sea creature → sea).
export function unitEmoji(type) {
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
