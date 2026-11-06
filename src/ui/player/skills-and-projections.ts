// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcHtml } from '../shared/kc-safe.ts';
import { KC_HUMANOID_RACES, PRIMAL_ARMY_DEFS_P } from '../../content/kingdoms-call-data.ts';
import {
  MONSTER_ARMIES,
  TAMED_FLYER_TYPES_D,
  druidALeaderBringsToAUnit,
  druidLevelALeaderNeeds,
  druidShortfall,
  heroHireWage,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { kcJoinP } from './startup.ts';
import { ITEM_UNCAPPED_SKILLS_P } from './order-chances.ts';
import { SKILL_LABELS } from './move-analysis.ts';
import { effSkillP } from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';

// (ITEM_UNCAPPED_SKILLS_P is declared above effMagicLvl — see the note there.)
// ── BONUS SOURCE COLOURS ────
// Every skill bonus is coloured by WHERE it comes from, and every one is named in full beneath the
// skill list rather than hidden in a hover tooltip (a tooltip is unreachable on a phone, which is
// how half of these were effectively invisible). `kind` colours it; `scope` says when it applies.
export const BONUS_KIND_P = {
  item: { c: '#9a6b12', bg: '#f7edd4', label: 'Item' },
  aura: { c: '#b05e12', bg: '#fbe8d6', label: 'Aura' },
  title: { c: '#6a4a9a', bg: '#ece5f6', label: 'Title' },
  perk: { c: '#1f6f6f', bg: '#dcefef', label: 'Perk' },
  discovery: { c: '#2a5a8a', bg: '#dde9f5', label: 'Discovery' },
  // was a hardcoded #8b1a1a — an off-palette near-miss for the portal's own --crimson, and it
  // disagreed with the no-sources fallback a few lines below, which already paints a negative delta
  // with var(--crimson). One token, used by both branches, so every penalty reads the same red.
  curse: { c: 'var(--crimson)', bg: '#f6dede', label: 'Curse' },
};
export const BONUS_SCOPE_MARK_P = { combat: '⚔', battle: '⚑', move: '➤', order: '✎' };
export const BONUS_SCOPE_TEXT_P = {
  combat: 'personal combat only',
  battle: 'army battles only',
  move: 'movement points only',
  order: 'that order’s own roll only',
};
export function _bonusKindP(k) {
  return BONUS_KIND_P[k] || { c: '#555', bg: '#eeeeee', label: 'Other' };
}
// Every source for one skill: the always-on ones the engine has already folded into the skill, then
// the scoped extras (minor titles, discoveries) that bite only at their own moment.
// `x.kind||'title'`. A report SNAPSHOTTED BEFORE the engine began tagging sources carries no `kind`
// at all, so every source in it fell to the default, and a Curse of −1 was therefore painted in the
// gold ITEM colour: a penalty that read on screen as a bonus. Old reports stay readable in the
// Chronicle for the life of a game, so the fallback has to be sign-aware — nothing that subtracts
// from a skill can be an item or a title.
export const _kindFallbackP = (delta, pos) => ((delta || 0) < 0 ? 'curse' : pos);
export function _skillSourcesP(c, k) {
  const e = (c && c.skillEff && c.skillEff[k]) || null;
  const out = [];
  if (e && Array.isArray(e.sources))
    e.sources.forEach((x) =>
      out.push({ label: x.label, delta: x.delta, kind: x.kind || _kindFallbackP(x.delta, 'item'), scope: 'always' }),
    );
  const extra = (c && (c.skillExtra || c.combatSkillBonus)) || {};
  (extra[k] || []).forEach((x) =>
    out.push({
      label: x.label,
      delta: x.delta,
      kind: x.kind || _kindFallbackP(x.delta, 'title'),
      scope: x.scope || 'combat',
    }),
  );
  return out;
}
export function skillRowHTML(c, style) {
  const eff = c && c.skillEff,
    raw = (c && c.skills) || {};
  const extra = (c && (c.skillExtra || c.combatSkillBonus)) || {};
  const keys = eff ? Object.keys(eff) : Object.keys(raw).filter((k) => (raw[k] || 0) > 0);
  // A skill with no training can still carry a bonus (an item that grants a school, a title perk);
  // make sure those rows appear instead of being filtered out along with the untrained zeroes.
  Object.keys(extra).forEach((k) => {
    if (!keys.includes(k)) keys.push(k);
  });
  const legendKinds = new Set();
  const detail = [];
  const rows = keys
    .map((k) => {
      const e = eff ? eff[k] : null;
      const base = e ? e.base : raw[k] || 0;
      const bonus = e ? e.bonus || 0 : 0;
      const srcs = _skillSourcesP(c, k);
      const cb = srcs.filter((s) => s.scope !== 'always').reduce((sm, x) => sm + (x.delta || 0), 0);
      if (base <= 0 && bonus <= 0 && cb <= 0) return '';
      const label = SKILL_LABELS[k] || k;
      const always = srcs.filter((s) => s.scope === 'always');
      const rawTotal = always.reduce((s, x) => s + (x.delta || 0), 0);
      // ── one coloured delta per SOURCE KIND, on the skill itself ── `bonus` is what the always-on
      // extras are actually WORTH after the engine's cap, so the kinds are shaved pro-rata to it: the
      // chips can never add up to more than the turn will use.
      const chips = [];
      if (always.length && bonus !== 0) {
        const byKind = {};
        const order = [];
        always.forEach((s) => {
          if (byKind[s.kind] === undefined) {
            byKind[s.kind] = 0;
            order.push(s.kind);
          }
          byKind[s.kind] += s.delta || 0;
        });
        const posRaw = order.filter((x) => byKind[x] > 0).reduce((s, x) => s + byKind[x], 0);
        const neg = order.filter((x) => byKind[x] < 0).reduce((s, x) => s + byKind[x], 0);
        const posShown = Math.max(0, bonus - neg);
        let left = posShown;
        order.forEach((kind) => {
          const v = byKind[kind];
          const st = _bonusKindP(kind);
          let shown = v;
          if (v > 0) {
            shown = posRaw > 0 ? Math.min(left, Math.round((v * posShown) / posRaw)) : 0;
            left -= shown;
          }
          if (!shown) return;
          legendKinds.add(kind);
          chips.push(kcHtml`<span style="color:${st.c};font-weight:600">${shown > 0 ? '+' : ''}${shown}</span>`);
        });
      } else if (bonus !== 0) {
        chips.push(
          kcHtml`<span style="color:${bonus > 0 ? 'var(--gold)' : 'var(--crimson)'};font-weight:600">${bonus > 0 ? '+' : ''}${bonus}</span>`,
        );
      }
      // ── the scoped extras, each with the marker that says WHEN it bites ──
      const scoped = {};
      const scOrder = [];
      srcs
        .filter((s) => s.scope !== 'always')
        .forEach((s) => {
          if (!scoped[s.scope]) {
            scoped[s.scope] = {};
            scOrder.push(s.scope);
          }
          scoped[s.scope][s.kind] = (scoped[s.scope][s.kind] || 0) + (s.delta || 0);
        });
      scOrder.forEach((sc) =>
        Object.keys(scoped[sc]).forEach((kind) => {
          const v = scoped[sc][kind];
          if (!v) return;
          const st = _bonusKindP(kind);
          legendKinds.add(kind);
          chips.push(
            kcHtml`<span style="color:${st.c};font-weight:600">(${v > 0 ? '+' : ''}${v}${BONUS_SCOPE_MARK_P[sc] || ''})</span>`,
          );
        }),
      );
      // ── every source NAMED, collected for the breakdown line under the skills ──
      if (srcs.length) {
        const bits = srcs.map((s) => {
          const st = _bonusKindP(s.kind);
          return kcHtml`<span style="background:${st.bg};color:${st.c};border-radius:2px;padding:0 4px;white-space:nowrap">${s.delta > 0 ? '+' : ''}${s.delta} ${s.label}${s.scope !== 'always' ? ` ${BONUS_SCOPE_MARK_P[s.scope] || ''}` : ''}</span>`;
        });
        if (rawTotal > 0 && bonus < rawTotal)
          bits.push(
            kcHtml`<span style="color:#3a3224">(capped at ${ITEM_UNCAPPED_SKILLS_P.has(k) || k === 'druid' ? 9 : 5})</span>`,
          );
        detail.push(
          kcHtml`<span style="white-space:normal"><strong style="color:#231e16">${label}</strong> ${kcJoinP(bits, ' ')}</span>`,
        );
      }
      // melee and archery let item/aura bonuses stack above trained 5 to the ceiling of 9; every
      // other skill still stops at 5. Mirrors ITEM_UNCAPPED_SKILLS in the GM engine.
      const _ceil = ITEM_UNCAPPED_SKILLS_P.has(k) || k === 'druid' ? 9 : 5;
      const parts = srcs.map(
        (s) =>
          `${s.delta > 0 ? '+' : ''}${s.delta} ${s.label}${s.scope !== 'always' ? ` (${BONUS_SCOPE_TEXT_P[s.scope] || ''})` : ''}`,
      );
      if (rawTotal > 0 && bonus < rawTotal) parts.push('capped at ' + _ceil);
      const tip = parts.length ? kcHtml` title="${label + ' ' + base + ' — ' + parts.join(', ')}"` : '';
      return style === 'tags'
        ? kcHtml`<span class="skill-tag"${tip}>${label} ${base}${chips}</span>`
        : kcHtml`<span style="color:var(--forest)"${tip}><strong>${label}:</strong> ${base}${chips}</span>`;
    })
    .filter(Boolean);
  if (!rows.length) return style === 'tags' ? '' : kcHtml`<span style="color:#aaa">No skills</span>`;
  const out = [rows];
  if (detail.length) {
    const legend = kcJoinP(
      [...legendKinds].map((kd) => {
        const st = _bonusKindP(kd);
        return kcHtml`<span style="color:${st.c}">● ${st.label}</span>`;
      }),
      ' ',
    );
    out.push(
      kcHtml`<span style="flex-basis:100%;width:100%;margin-top:3px;font-size:.68rem;color:#2a2419;line-height:1.8;display:block">${[
        kcHtml`<span style="color:#3a3224;text-transform:uppercase;letter-spacing:.04em">Skill bonuses</span> ${legend}`,
        kcHtml`<span style="display:block;margin-top:2px">${kcJoinP(detail, kcHtml` &nbsp; `)}</span>`,
        kcHtml`<span style="display:block;color:#3a3224;margin-top:1px">⚔ personal combat &middot; ⚑ army battles &middot; ➤ movement &middot; ✎ that order&rsquo;s roll — these never change the skill itself</span>`,
      ]}</span>`,
    );
  }
  return kcHtml`${out}`;
}

export function capitalise(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}
// Every primal sub-race is either a Creature or a Monster (the engine's CREATURE_ARMIES / MONSTER_ARMIES sets, which
// src/shared/ hands the portal since P1-11d12 — Druidic favours Creatures, Evil favours Monsters). "Primal" is an
// internal engine term; players only ever see Creature or Monster. Where only the unit type is known (race stored as a
// bare 'Primal'), formatRace reads the unit's class from those sets.
export const HUMANOID_RACES_UI = new Set(KC_HUMANOID_RACES);
// ── DRUID: WHAT DOES THIS COMMANDER NEED TO LEAD THIS UNIT? (2026-09-27) ────────────────────────
// The order form's Druid line and the army card ask this. The rule is the engine's own, shared through src/shared/
// (plan P1-11b3): the Druid a unit needs with its waivers (druidLevelALeaderNeeds, which reads KC_DRUID_LEVELS, the
// one table), the same-race Druid 1 (druidALeaderBringsToAUnit) and the shortfall (druidShortfall). What stays the
// portal's is the commander's Druid it feeds in: the report's effective level (effSkillP), which counts a Crown of
// Command's +1 as the battle's druIdPenaltyMult does (R-120).
//   req       — Druid needed after waivers: skeletons 0; a creature under a Druidic realm OR a
//               personally Druidic commander 0; a monster under an Evil realm OR a personally Evil
//               commander 0; a winged beast with sd40 Dragon Taming 0
//   effDru    — the commander's Druid, counted as at least 1 for units of his own race
//   shortfall — levels short (each costs 20% strength in battle)
//   counts    — whether leading this unit depends on Druid training at all (an own-race unit's
//               level-1 need is met by birth, so it does not count)
export function druidNeedP(a, c, report) {
  const rep = report || currentReport || {};
  if (!a || a.skeletal || a._isSkeletal) return { req: 0, effDru: 0, shortfall: 0, counts: false };
  const realmAlign = (rep.kingdom && rep.kingdom.alignment) || null;
  const tamed = TAMED_FLYER_TYPES_D.has(a.type) && (rep.discoveries || []).some((d) => d && d.id === 'sd40');
  const req = druidLevelALeaderNeeds(a.type, realmAlign, c && c.alignment, tamed);
  const druLevel = effSkillP(c, 'druid');
  const sameRace = !!(a.race && c && a.race === c.race);
  const effDru = druidALeaderBringsToAUnit(druLevel, sameRace);
  return { req, effDru, shortfall: druidShortfall(req, effDru), counts: req > 0 && !(sameRace && req <= 1) };
}
export const PRIMAL_SUBRACE_CLASS = {
  'Stone Giant': 'Creature',
  'Forest Ent': 'Creature',
  Thunderbird: 'Creature',
  'Giant Eagle': 'Creature',
  Roc: 'Creature',
  Whale: 'Creature', // 'Giant Eagle' and 'Leviathan': older reports, before the renames of 2026-10-13
  'Great Bear': 'Creature',
  Unicorn: 'Creature',
  Mammoth: 'Creature',
  'Great Turtle': 'Creature', // 2026-10-13 (Creatures and Monsters IV)
  'Cave Troll': 'Monster',
  Manticore: 'Monster',
  Basilisk: 'Monster',
  Dragon: 'Monster',
  Titan: 'Monster',
  'Sea Giant': 'Monster',
  Kraken: 'Monster',
  Hydra: 'Monster',
  Leviathan: 'Monster',
  Shark: 'Monster',
};
// Present a province/unit race cleanly: humanoid races as-is, primal provinces as their
// player-facing
// category — 'Primal:Stone Giant' → 'Creature (Stone Giant)', 'Primal:Cave Troll' → 'Monster (Cave
// Troll)' — and empty/sea provinces as 'Uninhabited'. Never shows the word "Primal".
export function formatRace(race, unitType) {
  if (!race) return 'Uninhabited';
  if (race.startsWith('Primal')) {
    const sub = race.slice(7).trim(); // '' for bare 'Primal', else the sub-race after 'Primal:'
    // Bare 'Primal' (as stored on sea beasts and recruited Whale Cohorts) carries no sub-race, so
    // fall back to classifying the UNIT TYPE — otherwise every Kraken and Leviathan read
    // "Creature".
    if (sub) return PRIMAL_SUBRACE_CLASS[sub] || 'Creature';
    if (unitType) return MONSTER_ARMIES.has(unitType) ? 'Monster' : 'Creature';
    return 'Creature';
  }
  return race;
}

// Primal army speeds (for UI calculations) — built from the one primal table in the data file (2026-10-13:
// this was a hand-typed copy, and the roster PR would have left it a move behind).
export const PRIMAL_ARMY_SPEEDS = Object.fromEntries(Object.entries(PRIMAL_ARMY_DEFS_P).map(([t, d]) => [t, d.speed]));

// 2026-10-08 (Toby item 12): the price of hiring THIS hero, as the engine will charge it. The report
// now sends it with every hireable hero (hireWage: alignment distance + the hero's skill premium, null
// for a hero who will not serve); the alignment-only estimate above is kept only for a report from an
// older engine that does not send it. Every hire price the order form shows goes through here, so the
// dropdown, the Broker list, the hired hero's card and the order ledger agree with the report.
export function heroHireWageOfP(h, report) {
  if (h && Object.prototype.hasOwnProperty.call(h, 'hireWage')) return h.hireWage;
  return heroHireWage(((report || currentReport || {}).kingdom || {}).alignment || 'Neutral', h && h.alignment);
}
