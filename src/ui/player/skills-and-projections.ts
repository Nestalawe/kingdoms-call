// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcHtml } from '../shared/kc-safe.ts';
import { KC_HUMANOID_RACES, KC_UNIT_CLASS, PRIMAL_ARMY_DEFS_P } from '../../content/kingdoms-call-data.ts';
import {
  TAMED_FLYER_TYPES_D,
  druidALeaderBringsToAUnit,
  druidLevelALeaderNeeds,
  druidShortfall,
  heroHireWage,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { kcJoinP } from './startup.ts';
import { ITEM_UNCAPPED_SKILLS_P } from './order-chances.ts';
import { SKILL_LABELS } from './move-analysis.ts';
import { effSkillP } from './briefing-and-submit.ts';
import { predictedLocation, projectedLedArmies } from './order-targets.ts';

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
// Every primal sub-race is either a Creature or a Monster (mirrors the GM engine's CREATURE_ARMIES
// / MONSTER_ARMIES sets — Druidic favours Creatures, Evil favours Monsters). "Primal" is an
// internal engine term; players only ever see Creature or Monster. Player-facing class of each
// primal unit TYPE, mirroring the engine's CREATURE_ARMIES / MONSTER_ARMIES sets. Used where only
// the unit type is known (race stored as a bare 'Primal').
export const HUMANOID_RACES_UI = new Set(KC_HUMANOID_RACES);
export const CREATURE_ARMIES_UI = new Set(KC_UNIT_CLASS.creature);
export const MONSTER_ARMIES_UI = new Set(KC_UNIT_CLASS.monster);
// ── DRUID: WHAT DOES THIS COMMANDER NEED TO LEAD THIS UNIT? (2026-09-27) ────────────────────────
// The order form's Druid line and the army card ask this. The rule is the engine's own, shared through src/shared/
// (plan P1-11b3): the Druid a unit needs with its waivers (druidLevelALeaderNeeds, which reads KC_DRUID_LEVELS, the
// one table), the same-race Druid 1 (druidALeaderBringsToAUnit) and the shortfall (druidShortfall). What stays the
// portal's is the commander's Druid it feeds in: the report's effective level (effSkillP), which counts a Crown of
// Command's +1 where the battle's druIdPenaltyMult doesn't (plan P1-11b, question 13 for Toby).
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
    if (unitType) return MONSTER_ARMIES_UI.has(unitType) ? 'Monster' : 'Creature';
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

// Predict each character's item list at the given phase by replaying the Give Item orders of all
// EARLIER phases exactly as the GM engine resolves them (splice from giver, push to recipient — so
// item INDICES stay aligned with what the engine will see at resolution time). This lets a
// character who RECEIVES an item in an earlier phase pass it on in a later one.
export function predictedItems(charId, upToPhaseExclusive) {
  const report = currentReport;
  if (!report) return [];
  // ── 2026-09-24 (Toby): keyed by String(id) throughout ──────────────────────────────────────────
  // This used to open with
  //     const cid=typeof charId==='string'?parseInt(charId):charId;
  // and read the recipient with `parseInt(...)` as well. Both are NaN for a PRE-ORDER card's
  // synthetic id ('hired_77_via_1_ph0', 'charm_88_via_1_ph0', 'resurrect_…'), so an item SENT to a
  // hero being hired, raised or charmed this turn never entered their predicted pack, and the
  // lookup for the card itself never found their own row either.
  // The GM resolves the send correctly — `orderCharRef` maps the synthetic id to the real hero and
  // same-province delivery is immediate — so the item genuinely WAS in that hero's hands from the
  // phase after the hand-over. Only the order form could not see it, which left the player unable
  // to order the hero to equip or use the very thing they had just been handed, and made the
  // "what they carry is not yours to see" notice (§150) permanent even for gear the player had
  // supplied themselves.
  // The Map is local to this function, so re-keying it is contained; `predictedLocation` still needs
  // the character's REAL id (it compares with ===), hence the byKey lookup rather than passing the
  // select's string value straight through — that was how the old code got away with parseInt for
  // ordinary numeric recipients.
  const cid = String(charId);
  const items = new Map();
  const byKey = new Map();
  (report.characters || []).forEach((x) => {
    items.set(String(x.id), [...(x.items || [])]);
    byKey.set(String(x.id), x);
  });
  for (let p = 0; p < upToPhaseExclusive; p++) {
    (report.characters || []).forEach((x) => {
      const action = document.getElementById(`po-action-${x.id}-${p}`)?.value || '';
      if (action !== 'Send Item' && action !== 'Give Item') return;
      // a Give Item order can now hand over MULTIPLE items (comma-separated indices, or
      // "all"). Splice high→low so earlier removals don't shift the indices still to be moved.
      const recipKey = String(document.getElementById(`po-extra-${x.id}-${p}`)?.value || '').trim();
      const arr = items.get(String(x.id)) || [];
      if (!recipKey || !items.has(recipKey)) return;
      const recipCh = byKey.get(recipKey);
      if (!recipCh) return;
      const rawT = (document.getElementById(`po-target-${x.id}-${p}`)?.value || '').trim();
      let idxs;
      if (rawT.toLowerCase() === 'all') idxs = arr.map((_, i) => i);
      // A CHARMED sender writes target='auto' — the engine picks the item and the player never sees
      // which, so nothing can be projected into the recipient's pack. 'auto' resolves to no index
      // below, which is the right outcome; noted so it is not later "fixed".
      // Token grammar MIRRORS the engine's give_item exactly: a plain in-range integer is positional,
      // anything else is matched by item id or name (a pre-order card ticks names, because its index
      // space is not the engine's — see the Send Item branch). These two must change together.
      else
        idxs = rawT
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((t) => {
            const n = parseInt(t);
            if (Number.isInteger(n) && String(n) === t && n >= 0 && n < arr.length) return n;
            return arr.findIndex((it) => it && (String(it.id) === t || it.name === t));
          })
          .filter((n) => Number.isInteger(n) && n >= 0 && n < arr.length);
      const uniq = [...new Set(idxs)].sort((a, b) => b - a);
      // only DELIVER into the recipient's list this turn if they are co-located this phase; a
      // cross-province send leaves the giver now but arrives with the recipient only at turn's end.
      const _same = predictedLocation(x.id, p)?.id === predictedLocation(recipCh.id, p)?.id;
      uniq.forEach((i) => {
        const [it] = arr.splice(i, 1);
        if (_same) (items.get(recipKey) || []).push(it);
      });
    });
  }
  return items.get(cid) || [];
}

// the army list a character is LEADING at the start of a given phase, projected from the report by
// replaying every earlier-phase order that adds or removes armies — Recruit and Pick Up
// (add), Leave/Transfer and Disband (remove). This is what the Leave/Transfer and Disband forms show,
// so an army handed off or disbanded in an earlier phase no longer appears, and one recruited or
// picked up earlier does. (predictedLocation already accounts for earlier moves / conquests, so the
// recipient and garrison-eligibility lists reflect where the character will actually be.) Armies
// TRANSFERRED to this character by ANOTHER of yours earlier this turn — a Leave/Transfer handed over, or
// a Recruit mustered "to:<this id>" — ARE projected in, through chains of any length (2026-09-24; the
// comment that used to stand here still called that a known limitation long after it was implemented,
// and a _depth<2 cap meant it was true again past two hops. Both fixed — see projectedLedArmies).
// The units a Recruit order actually produces, in the ORDER the engine creates them: mercenary
// bands first (hired from the province's roaming bands, keeping their own name and quality), then
// native recruits at Average. Blood Offering, Leave/Transfer and Disband all address units by INDEX
// into the character's army list, so a projection that skipped mercenaries — as this one did until
// 2026-09-09 — both hid a band hired earlier in the turn and shifted every index after it.
// Garrison units always muster straight into the province garrison when recruited, whatever the
// "Muster to" choice (GM engine, 2026-09-23c). Native recruiting needs the province, so any
// non-mercenary garrison-type recruit is projected into the garrison, never onto a character.
export const GARRISON_UNIT_TYPES_P = new Set(KC_UNIT_CLASS.garrison);
export function _isAutoGarrisonRecruit(u) {
  return !!u && !u._merc && GARRISON_UNIT_TYPES_P.has(u.type);
}
export function _projRecruitUnits(tokens) {
  const out = [];
  const mercs = (currentReport || {}).mercIntel || [];
  const toks = (tokens || []).map((t) => String(t || '').trim()).filter(Boolean);
  // The engine walks the PROVINCE'S band list and hires whichever are ticked, so bands join in that
  // list's order — not the order the boxes happen to be ticked in. Mirror that exactly.
  const _picked = new Set(toks.filter((t) => t.startsWith('merc:')));
  mercs.forEach((m) => {
    if (_picked.has('merc:' + m.id))
      out.push({
        type: m.type,
        quality: m.quality || 'Average',
        unitName: m.unitName,
        race: m.race || null,
        _merc: true,
      });
  });
  const _known = new Set(mercs.map((m) => 'merc:' + m.id));
  _picked.forEach((t) => {
    if (!_known.has(t)) out.push({ type: 'Mercenary band', quality: 'Average', unitName: 'a hired band', _merc: true });
  }); // band no longer in view — still occupies its slot
  toks.forEach((v) => {
    if (!v || v === 'all' || v.startsWith('to:') || v.startsWith('merc:')) return;
    // one recruit token = ONE unit (the `|n` suffix is not a quantity here).
    const bar = v.indexOf('|');
    const type = bar >= 0 ? v.slice(0, bar) : v;
    out.push({ type, quality: 'Average' });
  });
  return out;
}

// the unled GARRISON of a province at a given phase, projected by replaying this player's earlier
// orders in the SAME order the GM engine resolves them — Leave/Transfer-to-garrison and Recruit
// "to:garrison" APPEND (in army/checkbox order), Pick Up REMOVES (by index, highest first). The
// engine makes a Pick Up wait for any Leave in the same province in the same phase, so leaves at
// `phase` itself by OTHER characters are included when includeSamePhase is set (the Pick Up form);
// pick-ups are only replayed for strictly earlier phases. This keeps the `g:i` indices the form
// emits aligned with the engine's live garrison. Rival/neutral changes to the garrison can't be
// foreseen.
export function projectedGarrison(provId, phase, includeSamePhase, excludeCharId, _memo) {
  // _memo: the shared projection cache threaded down from the top-level call (see
  // projectedLedArmies). projectedGarrison and projectedLedArmies call EACH OTHER — a Pick Up reads
  // the garrison, and the garrison is built from other characters' Leave orders — so they share one
  // cache or the pair blows up combinatorially on a five-phase turn.
  const memo = _memo instanceof Map ? _memo : new Map();
  const _gk = `g|${provId}|${phase}|${includeSamePhase ? 1 : 0}|${String(excludeCharId)}`;
  if (memo.has(_gk)) return memo.get(_gk).map((a) => ({ ...a }));
  const report = currentReport || {};
  const pd = (report.provinceOrderData || {})[provId];
  let garr = ((pd && pd.garrisonArmies) || []).map((a) => ({
    type: a.type,
    quality: a.quality,
    unitName: a.unitName,
    race: a.race,
  }));
  const chars = (report.characters || []).filter((x) => x && x.alive !== false);
  const lastPh = includeSamePhase ? phase : phase - 1;
  for (let ph = 0; ph <= lastPh; ph++) {
    // (1) additions this phase
    chars.forEach((o) => {
      if (ph === phase && String(o.id) === String(excludeCharId)) return;
      const act = document.getElementById(`po-action-${o.id}-${ph}`)?.value || '';
      const tgt = document.getElementById(`po-target-${o.id}-${ph}`)?.value || '';
      const loc = predictedLocation(o.id, ph);
      if (!loc || loc.id !== provId) return;
      if (act === 'Leave/Transfer Army') {
        const extra = document.getElementById(`po-extra-${o.id}-${ph}`)?.value;
        if (extra !== '' && extra != null && String(extra) !== '-1') return; // handed to a character, not the garrison
        const led = projectedLedArmies(o.id, ph, memo);
        if (
          tgt
            .split(',')
            .map((t) => t.trim())
            .includes('all')
        )
          led.forEach((a) => garr.push(a));
        else {
          const pool = led.slice();
          tgt
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .forEach((val) => {
              const i = pool.findIndex((a) => a.type === val || a.unitName === val);
              if (i >= 0) garr.push(pool.splice(i, 1)[0]);
            });
        }
      } else if (act === 'Recruit Armies') {
        const wrap = document.getElementById(`po-target-wrap-${o.id}-${ph}`);
        if (!wrap) return;
        const destSel = wrap.querySelector('.po-recruit-dest');
        const _toG = !!destSel && destSel.value === 'to:garrison';
        _projRecruitUnits(
          [...wrap.querySelectorAll('input[type="checkbox"]:checked')].map((cb) => cb.value || ''),
        ).forEach((u) => {
          if (_toG || _isAutoGarrisonRecruit(u)) garr.push(u);
        });
      }
    });
    // (2) removals this phase — only strictly earlier phases (same-phase pick-ups race on initiative)
    if (ph < phase)
      chars.forEach((o) => {
        const act = document.getElementById(`po-action-${o.id}-${ph}`)?.value || '';
        if (act !== 'Pick Up Army') return;
        const loc = predictedLocation(o.id, ph);
        if (!loc || loc.id !== provId) return;
        const tgt = document.getElementById(`po-target-${o.id}-${ph}`)?.value || '';
        if (
          tgt
            .split(',')
            .map((t) => t.trim())
            .includes('all')
        ) {
          garr = [];
          return;
        }
        const idxs = [
          ...new Set(
            tgt
              .split(',')
              .map((t) => t.trim())
              .filter((t) => /^(g:|-1:)\d+$/.test(t))
              .map((t) => parseInt(t.slice(t.indexOf(':') + 1))),
          ),
        ]
          .filter((i) => i >= 0 && i < garr.length)
          .sort((a, b) => b - a);
        idxs.forEach((i) => garr.splice(i, 1));
      });
  }
  memo.set(
    _gk,
    garr.map((a) => ({ ...a })),
  );
  return garr;
}
