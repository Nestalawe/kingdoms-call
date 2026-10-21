// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcHtml } from '../shared/kc-safe.ts';
import {
  KC_ITEM_UNCAPPED_SKILLS,
  KC_MAGIC_SCHOOLS,
  KC_SKILLS,
  KC_UNIT_CLASS,
} from '../../content/kingdoms-call-data.ts';
import {
  dispFloor,
  itemSlot,
  itemUsableBy,
  unitBaseStrength,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { SKILL_LABELS } from './move-analysis.ts';
import { getOrderExtra, getOrderTarget, syncCharmCard, syncResurrectCard } from './pre-orders.ts';
import { CREATURE_ARMIES_UI, HUMANOID_RACES_UI, MONSTER_ARMIES_UI, formatRace } from './skills-and-projections.ts';
import { buildTargetField } from './order-targets.ts';

// ── ORDERS FORM ────
// ── SPELLS LIST ────
export const SPELLS_BY_SCHOOL = {
  white: ['Resurrect', 'Part Sea', 'Bless Province', 'Holy Symbol', 'Spiritwrack', 'Sanctuary', 'Divine Judgment'],
  psychic: ['Charm', 'Oratory', 'Clairvoyance', 'Psychic Blast', 'Telekinetic Storm', 'Mass Confusion', 'Dominate'],
  illusory: [
    'Illusory Terrain',
    'Phantasmal Armies',
    'Hide Lairs',
    'Invisibility',
    'Mirror Image',
    'Phantom Host',
    'Veil',
  ],
  elemental: ['Lightning Bolt', 'Fireball', 'Earthquake', 'Flood', 'Elemental Summon', 'Chain Lightning', 'Cataclysm'],
  necromancy: [
    'Control Undead',
    'Skeletal Armies',
    'Curse',
    'Hand of Death',
    'Plague',
    'Raise Wraiths',
    "Death's Dominion",
  ],
};
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
      const lvl = sel ? Math.min(4, (c.skills || {})[sel] || 0) : null;
      const base =
        lvl == null
          ? null
          : by[lvl] + (o.astro || 0) + (o.discovery || 0) + (o.bySkill && sel ? o.bySkill[sel] || 0 : 0); // + skill-scoped practice discoveries
      const scale = `Chance falls as mastery grows: ${by.map((v, i) => `${v}% at ${i}`).join(', ')}.`;
      const extra = `Practising alongside someone of equal level adds half again; anyone of HIGHER level teaches you, and the lesson cannot fail. A run of failures makes the next attempt likelier.`;
      return chanceLine(
        base == null
          ? `${scale} ${extra}`
          : kcHtml`Improvement: ${pct(base)} at ${SKILL_LABELS[sel] || sel} ${lvl}. ${extra}`,
      );
    }
    default:
      return '';
  }
}

// Reverse lookup: spell name → school
export const SPELL_TO_SCHOOL = {};
Object.entries(SPELLS_BY_SCHOOL).forEach(([school, list]) =>
  list.forEach((s) => {
    SPELL_TO_SCHOOL[s] = school;
  }),
);
// L7/L9 mastery spells require the caster's RAW school level (past-5 comes from experience only).
export const SPELL_REQ_LEVEL = {
  Sanctuary: 7,
  'Divine Judgment': 9,
  'Mass Confusion': 7,
  Dominate: 9,
  'Phantom Host': 7,
  Veil: 9,
  'Chain Lightning': 7,
  Cataclysm: 9,
  'Raise Wraiths': 7,
  "Death's Dominion": 9,
};
export const rawMagicLvl = (charObj, school) => ((charObj && charObj.skills) || {})[school] || 0;

// Effective magic-skill level for a character = base skill + any magic-item bonuses to that school,
// clamped 0..5. Mirrors the GM engine's effStat() for the spell schools, so an item that grants a
// magic-skill bonus (e.g. Death's Finger Ring → Necromancy +1) lets a hero with 0 base skill cast at
// the item's effective level. The engine already casts off effStat; this keeps the ORDER-ENTRY
// spell dropdowns in step so those spells can actually be selected. 2026-09-16: the five magic
// schools join melee and archery as skills whose ITEM bonuses carry
// past a trained 5 to the ceiling of 9. Declared HERE, above effMagicLvl, its first reader — a const
// declared further down the file is in the temporal dead zone for everything above it, which is
// this project's oldest and most expensive bug class.
export const ITEM_UNCAPPED_SKILLS_P = new Set(KC_ITEM_UNCAPPED_SKILLS);
export function effMagicLvl(charObj, school) {
  const base = ((charObj && charObj.skills) || {})[school] || 0;
  // only EQUIPPED slot items count (unslotted items are always active).
  const bonus = ((charObj && charObj.items) || []).reduce(
    (s, it) =>
      s +
      (it &&
      it.effect &&
      it.effect.stat === school &&
      itemUsableBy(it, charObj) &&
      (!itemSlot(it) || it.equipped !== false)
        ? it.effect.bonus || 0
        : 0),
    0,
  );
  // reads the same set the engine does, so the spell dropdown and the cast chance it quotes cannot
  // drift from what will actually be rolled. Spell EFFECTS still read the level counted to 5.
  return Math.max(0, Math.min(ITEM_UNCAPPED_SKILLS_P.has(school) ? 9 : 5, base + bonus));
}

// 2026-10-13 (item 2, Toby): the level each magic school may have reached by phase `ph`, assuming
// every Practice Skill order on it in an earlier phase succeeds (+1 each). Practice trains a skill
// only up to 5 (6–9 come from experience), so a school already at 5 or more gains nothing; item
// bonuses are then added as effMagicLvl does. `practising` is the set of schools with such an order.
export function projectedMagicLevels(c, ph) {
  const practice = {};
  for (let prevPh = 0; prevPh < ph; prevPh++) {
    const prevAction = document.getElementById(`po-action-${c.id}-${prevPh}`)?.value || '';
    if (prevAction !== 'Practice Skill') continue;
    const t = getOrderTarget(c.id, prevPh);
    if (t && KC_MAGIC_SCHOOLS.includes(t)) practice[t] = (practice[t] || 0) + 1;
  }
  const projected = {};
  KC_MAGIC_SCHOOLS.forEach((school) => {
    const raw = rawMagicLvl(c, school),
      n = practice[school] || 0;
    const rawProj = raw >= 5 ? raw : Math.min(5, raw + n);
    projected[school] = effMagicLvl({ ...c, skills: { ...((c && c.skills) || {}), [school]: rawProj } }, school);
  });
  return { practising: new Set(Object.keys(practice)), projected, practice };
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

// Spell hints shown below the order form
export const SPELL_HINTS = {
  Resurrect:
    'Target: a dead hero whose body lies in your caster\u2019s province. Revives at full HP, stripped of all items and armies, and joins your command. Only a hero who never served ANOTHER realm can be raised \u2014 your own fallen, or a wanderer who was never in a rival\u2019s pay; a hero who ever served another crown (even one later released or who deserted) will not answer. Your own fallen KING can also be recalled — their body is borne to your home province (or wealthiest if home is lost); only your most recently fallen monarch may be raised, and only by your realm. A resurrected king reclaims the throne; any reigning heir steps down to a normal hero.',
  'Part Sea':
    'Target: any sea OR land province you\u2019re in or next to (so you can pre-empt a Flood). A sea province \u2014 including a land province flooded to sea earlier this turn \u2014 becomes dry plains for the rest of the turn (land armies may cross); no fleet may enter or leave from the next phase on. Cast on still-dry land it simply finds no sea to part. Cancels Flood.',
  'Bless Province':
    'Target: a province you\u2019re in or adjacent to. +60% tax base at collection this turn (+80% for Divine realms; +100% when the Divine KING casts it). The ground is also warded \u2014 50% + 5% per White level (counted to 5, so 50\u201375%) to turn aside each enemy Flood, Earthquake, Plague or Part Sea cast here this turn. One Bless per province \u2014 does not stack.',
  'Holy Symbol':
    'Action: no target \u2014 cleanses the province you stand in of ALL its battlefield dead. Every grave there is laid to rest and can never be raised by a necromancer. Combat: enemy \u22128%/level to hit and seared for 6% of its health, both \u00d71.5 against undead and fiends; you recover 10% of your health. Battle: enemy undead units fight at 75% strength.',
  Spiritwrack:
    'Combat: silences the target for 1 round + 1 per two White levels (max 3) \u2014 it can\u2019t cast or use archery (it attacks instead) and its melee is halved. Against a guardian weak to White Magic it takes at 95% and lasts 1 round longer (max 4); Powerful and Legendary guardians may shrug it off each round after the first. Battle: all missile units fight at half strength.',
  Charm:
    "Target: a lone hero (wandering or enemy) leading NO armies, in your province. Wandering joins you free (you still pay upkeep); enemy comes under your command until end of turn, then returns to their lord (and will not attack their own lord's heroes). On success you learn their skills and magic items. Kings and army-leaders are immune; each past Charm gives a hero +30% resistance (cumulative). A Charm that fails may provoke a personal encounter with the target — unless either leads their encounter plan with Flee. Combat: doubles a later Flee attempt.",
  Oratory:
    'Target: yourself or an ally in your province. Every army travelling with them fights one quality tier higher for the rest of the turn. Not cumulative.',
  Clairvoyance:
    'Target: any enemy character you\u2019ve ever seen, anywhere (not neutral or wandering heroes). You learn all that happens to them this turn — reported in your Realm Events — and see their full skills. At turn\u2019s end you also know exactly where they stand: they are marked on your map and open to Encounter, even through Invisibility. Only one active at a time.',
  'Psychic Blast':
    'Target: an enemy/neutral hero in your province. They permanently lose TWO skill levels, each taken from a randomly chosen skill they hold (both picks can land on the same skill, dropping it by 2). Combat: they can do nothing at all for 1 round + 1 per two Psychic levels (3 at Psychic 5; doubled against a foe weak to Psychic; Dreamstone +1, after any doubling), unless a stun ward turns it. Battle: negates the enemy commander\u2019s Druid.',
  'Telekinetic Storm':
    'Target: an enemy hero leading armies in your province. A number of their units equal to your skill level are struck: Green units are destroyed and every other struck unit PERMANENTLY drops one experience level (skeletal units unaffected). Combat: 12% of the target\u2019s max HP, +3% per Psychic level (15% at 1, 27% at 5), as damage (you take a quarter of that). Battle: negates the enemy commander\u2019s Tactical.',
  'Illusory Terrain':
    'Target: a province you\u2019re in or adjacent to. Cloaks it in a false, ever-shifting terrain: enemies who fight there are disoriented, each unit fighting as if in the worst terrain for its kind (at least \u221215%). An enemy hero who enters dispels it at the end of that turn; 20%/turn natural fade.',
  'Phantasmal Armies':
    'Target: yourself or any friendly hero in your province. Spectral duplicates of their humanoid armies \u2014 10% of the host per caster level, counted to level 5, at least one \u2014 march and fight with the real host for the rest of the turn. The doubles never appear in the roster, need no berth aboard ship, and melt away if their originals fall or the force is beaten.',
  'Hide Lairs':
    'Target: a province you\u2019re in or adjacent to. Hides every lair there from all other players \u2014 they cannot discover any lair in it while the glamour holds (one already found stays theirs). 20% chance to fade each turn.',
  Invisibility:
    'Combat: enemies suffer \u221210%, and a further \u22124% per Illusory level (\u221214% at 1, \u221230% at 5), to hit you (melee and arrows) for the fight, +30% to Flee, and +15% to a following Steal. Action: cast on yourself — 80% chance no enemy player sees you (sightings, spies, Encounter targeting, the map) for the rest of the turn.',
  'Lightning Bolt':
    'Combat: 1\u20133 damage per caster level to your opponent. Battle: your-level enemy armies each lose 20% strength.',
  Fireball:
    'Combat: burns the target for 10% of its health each round, +2% per Elemental level (12% at 1, 20% at 5), for 3 rounds. Battle: the strongest enemy unit\u2019s strength is halved.',
  Earthquake: 'Target: a province you\u2019re in or adjacent to. It yields no tax at the end of this turn.',
  Flood:
    'Target: a land province you\u2019re in or adjacent to. It acts as a sea province for the rest of the turn (land armies stranded). Cancels Part Sea.',
  'Elemental Summon':
    'Summons a random elemental (Air/Fire/Earth/Water/Darkness, Veteran) to fight under you for the rest of the turn, then it dissolves. One per turn.',
  'Control Undead':
    'Target: an enemy/neutral hero here to seize one random undead unit \u2014 OR cast on THIS province to reveal the dead army units lying here one by one, AND to sense which surrounding provinces hold graves of their own (that they do, not how many or what). All of it is filed under Graveyards Known in your report. Combat: an undead foe is frozen for a round per Necromancy level (counted to 5), unless a stun ward turns it. Battle: one enemy undead unit defects.',
  'Skeletal Armies':
    'Raises the most experienced battlefield-grave units in your province as Skeletal (Undead) units under your command (1g upkeep each): 1 unit at Necromancy 1–2, 2 at Necromancy 3–4, 3 at Necromancy 5+ — never more than lie buried there. Needs fallen armies present.',
  Curse:
    'Target: an enemy/neutral hero here. EVERY skill they have is halved (rounded down) for the rest of the turn. Combat: their best combat ability halved. Battle: the enemy commander\u2019s best combat skill (Tactical/Druid/Naval) halved.',
  'Hand of Death':
    'Combat: 10% per Necromancy level (at most 60%) to strike for 40% of the target\u2019s max HP (\u00d71.1 with Death\u2019s Finger Ring).',
  Plague:
    'Target: your province or an adjacent one. Each humanoid unit has a (10% + 5%/level) chance to lose a level; survivors are immunised. Spreads to neighbours over the turn. Not cumulative.',
};
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
  const primalWord = CREATURE_ARMIES_UI.has(a.type) ? 'Creature' : MONSTER_ARMIES_UI.has(a.type) ? 'Monster' : null;
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
