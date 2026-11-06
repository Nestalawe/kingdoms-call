// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_HEX_DIRS, KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import {
  aColumnIsTurnedBackAtANeutralRealmsBorder,
  aColumnLeadingShipsMayNotStepFromLandToLand,
  canEnterTerrain,
  theHexNextToAProvinceInADirection,
  whatAMarchsOrderNames,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { PO_SEA_TYPES, poSeaAnalysis, projectedMoveHost } from './move-analysis.ts';

// The order form's forecasts (plan P1-11e3): where a hero will stand, what he will carry and what he will lead, and what a
// province's garrison will hold, after the orders the form holds for the phases before. They read the page's fields (the
// DOM) and the report the page holds (currentReport): the declared globals the page's files share (globals.ts).

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

// Get target value — handles both regular selects/inputs and recruit checkbox lists
export function getOrderTarget(charId, ph) {
  // For recruit, the hidden input holds the comma-joined checkbox values
  const hidden = document.getElementById(`po-target-${charId}-${ph}`);
  if (hidden) return hidden.value || '';
  return '';
}
export function getOrderExtra(charId, ph) {
  const el = document.getElementById(`po-extra-${charId}-${ph}`);
  return el?.value || '';
}

// ── A MARCH THE TURN REFUSES (R-128, plan P1-11e10) ────
// The turn turns a march back before it takes a step, and the hero stays where he is for his later orders (and his
// Search Lair names the lair where he stands: doSubmitOrders sends predictedLocation's province). Asked here in the
// turn's order, by the engine's own rules (src/shared/), on the column the Move note counts (projectedMoveHost: the
// companies he will lead as the march sets out, this phase's hand-overs among them):
//   1. a neutral realm's border: a province of a realm his own is neither allied with nor at war with, and he leads
//      companies (a lone hero passes). The relation is the report's; a war his realm declares on the form this turn
//      stands from the first phase only for an Evil or Undead realm (war without warning: the turn's step before the
//      first phase), every other declaration from next turn;
//   2. the sea, with too little lift to put to sea (hulls and flyers: the note's sea lift);
//   3. ships over land: a column leading any fleet or sea-beast steps from land only to the sea.
// Forecast limits (plan P1-11's Decision 3), left to the turn: an owner the report can't show (a province he hasn't
// seen: no border is forecast), a terrain an Illusory Terrain hides, a war a rival declares, a blockade, a flood, his
// pace (P1-11e11) and a far province (P1-11e12).
function theRelationAMarchMeetsAtTheBorderOf(report, owner) {
  if (owner === report.playerIndex) return 'self';
  const known = ((report.diplomacy || {}).known || []).find((k) => k && k.index === owner);
  const now = (known && known.relation) || 'neutral';
  const declared = known && typeof diploChoices === 'object' && diploChoices ? diploChoices[owner] : null;
  const withoutWarning = ['Evil', 'Undead'].includes((report.kingdom || {}).alignment);
  return declared === 'enemy' && withoutWarning ? 'enemy' : now;
}
function aMarchTheTurnRefuses(report, char, ph, from, to) {
  const column = projectedMoveHost(char.id, ph).armies;
  const turnedBack = aColumnIsTurnedBackAtANeutralRealmsBorder(
    report.playerIndex,
    to.owner,
    column.length,
    to.owner == null ? 'neutral' : theRelationAMarchMeetsAtTheBorderOf(report, to.owner),
  );
  if (turnedBack) return true;
  const lift = poSeaAnalysis(column, (char.skills || {}).naval || 0).cap;
  if (to.terrain === 'sea') return !canEnterTerrain({ armies: column }, 'sea', lift);
  if (from.terrain === 'sea') return false; // a landing: the turn asks only his sea points
  // (the turn's own check of the ground after it, that a column of ships alone may not stand on land, can't refuse a
  // march this one lets through: such a column leads ships)
  const leadsShips = column.some((a) => a && PO_SEA_TYPES.has(a.type));
  return aColumnLeadingShipsMayNotStepFromLandToLand(leadsShips, from.terrain, to.terrain);
}
// ── ONE ANSWER A REFRESH (plan P1-11e10) ────
// A march's refusal reads the column he will lead, and that column reads where he and his comrades stand in the
// phases before (projectedMoveHost, projectedLedArmies), so every phase's answer would be worked out again for each
// later one. Each answer is kept while what it was worked out from stands: the report and every order field the
// forecasts read (each hero's action, target and extra, a Recruit's boxes and muster) of the phases before it, and the
// war the form declares. A field changed is a new key, so no answer outlives the orders it was worked out from.
let theForecastsReport = null;
const theForecastsAnswers = new Map();
function whatTheForecastOfThePhasesBeforeReads(report, upToPhaseExclusive) {
  const parts = [typeof diploChoices === 'object' && diploChoices ? JSON.stringify(diploChoices) : ''];
  const value = (id) => {
    const el = document.getElementById(id);
    return el ? String(el.value ?? '') : '';
  };
  (report.characters || []).forEach((o) => {
    for (let ph = 0; ph < upToPhaseExclusive; ph++) {
      parts.push(value(`po-action-${o.id}-${ph}`), value(`po-target-${o.id}-${ph}`), value(`po-extra-${o.id}-${ph}`));
      const wrap = document.getElementById(`po-target-wrap-${o.id}-${ph}`);
      if (!wrap) continue;
      const dest = wrap.querySelector('.po-recruit-dest');
      const ticked = [...wrap.querySelectorAll('input[type="checkbox"]:checked')].map((x) => x.value);
      parts.push(dest ? String(dest.value) : '', ticked.join(','));
    }
  });
  return JSON.stringify(parts);
}
export function predictedLocation(charId, upToPhaseExclusive) {
  const report = currentReport;
  if (!report) return null;
  if (theForecastsReport !== report || theForecastsAnswers.size > 5000) {
    theForecastsReport = report;
    theForecastsAnswers.clear();
  }
  const key = `${String(charId)}|${upToPhaseExclusive}|${whatTheForecastOfThePhasesBeforeReads(report, upToPhaseExclusive)}`;
  if (theForecastsAnswers.has(key)) {
    const kept = theForecastsAnswers.get(key);
    return kept ? { ...kept } : kept;
  }
  const answer = whereTheFormSaysAHeroWillStand(report, charId, upToPhaseExclusive);
  theForecastsAnswers.set(key, answer ? { ...answer } : answer);
  return answer;
}
function whereTheFormSaysAHeroWillStand(report, charId, upToPhaseExclusive) {
  const char = (report.characters || []).find((c) => c.id === charId);
  if (!char) return null;
  let locId = char.locationId;
  const worldMeta = report.worldMeta;
  if (!worldMeta) return { id: locId, name: char.locationName };
  for (let ph = 0; ph < upToPhaseExclusive; ph++) {
    const action = document.getElementById(`po-action-${charId}-${ph}`)?.value;
    // A FORCED MARCH is a Move in the turn (one that may slip past a battle), so later phases' forms follow it as they
    // follow a Move. Both read their target as the turn does (R-128: the engine's whatAMarchsOrderNames, through
    // src/shared/): `dir:<compass>` a step that way, `prov:<id>` or the province's bare number (as the Forced March's
    // field writes it) a province.
    if (action !== 'Move' && action !== 'Forced March') continue;
    const named = whatAMarchsOrderNames(getOrderTarget(charId, ph) || '');
    const curProv = worldMeta.provinces.find((p) => p.id === locId);
    let toId = null;
    if (named.by === 'province') {
      if (worldMeta.provinces.some((p) => p.id === named.provinceId)) toId = named.provinceId;
    } else if (curProv) {
      const nid = theHexNextToAProvinceInADirection(curProv, named.direction, worldMeta.cols, worldMeta.rows);
      if (nid !== null && worldMeta.provinces.some((p) => p.id === nid)) toId = nid;
    }
    if (toId === null || toId === locId) continue;
    // a province next door: the step the turn may refuse (a far one is taken as named: P1-11e12)
    const toProv = worldMeta.provinces.find((p) => p.id === toId);
    const nextDoor =
      curProv &&
      KC_HEX_DIRS.some((d) => theHexNextToAProvinceInADirection(curProv, d, worldMeta.cols, worldMeta.rows) === toId);
    if (nextDoor && aMarchTheTurnRefuses(report, char, ph, curProv, toProv)) continue;
    locId = toId;
  }
  const prov = worldMeta.provinces.find((p) => p.id === locId);
  return prov ? { id: locId, name: prov.name || 'Unknown' } : { id: locId, name: 'Unknown' };
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

// ── 2026-09-24 (Toby): TRANSFER CHAINS ──────────────────────────────────────────────────────────
// This used to take a `_depth` counter and refuse to recurse past `_depth<2`, added to stop "mutual
// transfers recursing forever". That worry was unfounded: a transfer always recurses with a STRICTLY
// SMALLER phase bound (`projectedLedArmies(o.id, prevPh, …)` where prevPh < upToPhaseExclusive), so the
// recursion bottoms out at phase 0 on its own and no cycle is possible. What the guard actually did was
// silently truncate legitimate chains — hand a company king → Bryn in Spring and Bryn → Cara in Early
// Summer and it projected; add Cara → Dain in Late Summer and the company VANISHED from every later
// form, so Dain could not be ordered to do anything with troops he would really be leading.
// The cap was NOT needed for performance either, which is worth recording because it looks as though it
// should be: only the ONE character whose `po-extra` names this one recurses (the rest return at the
// `String(oExtra)!==String(charId)` check), so a transfer chain is linear, not exponential. Measured in
// the worst shape available — every character leaving troops to the garrison and picking up from it in
// alternate phases, which is the N-way fan-out through projectedGarrison — all 5N projections cost
// 4ms at 4 characters and 7ms at 10, indistinguishable with the memo below removed.
// The memoisation on (character, phase bound), shared with projectedGarrison, is therefore kept as cheap
// insurance against repeated subtree work rather than as a fix for a measured problem. The cache lives
// for ONE top-level call, so it can never serve a stale answer after the player changes an order.
// Callers mutate what they get back (splice/push), so every hit returns fresh copies.
export function projectedLedArmies(charId, upToPhaseExclusive, _memo) {
  const report = currentReport || {};
  const char = (report.characters || []).find((x) => x.id === charId);
  if (!char) return [];
  const memo = _memo instanceof Map ? _memo : new Map();
  const _ck = `c|${String(charId)}|${upToPhaseExclusive}`;
  if (memo.has(_ck)) return memo.get(_ck).map((a) => ({ ...a }));
  memo.set(_ck, []); // sentinel: belt-and-braces against a cycle the phase bound should already prevent
  let armies = (char.armies || []).map((a) => ({
    type: a.type,
    quality: a.quality,
    unitName: a.unitName,
    race: a.race,
    _isSkeletal: a._isSkeletal,
  }));
  const provOrderData = report.provinceOrderData || {};
  for (let prevPh = 0; prevPh < upToPhaseExclusive; prevPh++) {
    const prevAction = document.getElementById(`po-action-${charId}-${prevPh}`)?.value || '';
    const prevTarget = document.getElementById(`po-target-${charId}-${prevPh}`)?.value || '';
    // armies gained FROM OTHER characters of yours earlier this turn — a Recruit mustered "to:<this
    // id>" or a Leave/Transfer handed to this character — now project in too (depth-limited so
    // mutual transfers cannot recurse forever).
    (report.characters || []).forEach((o) => {
      if (o.id === charId) return;
      const oAct = document.getElementById(`po-action-${o.id}-${prevPh}`)?.value || '';
      const oTgt = document.getElementById(`po-target-${o.id}-${prevPh}`)?.value || '';
      if (
        oAct === 'Recruit Armies' &&
        oTgt
          .split(',')
          .map((t) => t.trim())
          .includes('to:' + charId)
      ) {
        // The engine hires MERCENARIES first and appends native recruits after, so the projection
        // must use the same order or the Blood Offering S:/E: indices would point at the wrong
        // units.
        _projRecruitUnits(oTgt.split(',').map((t) => t.trim())).forEach((u) => {
          if (!_isAutoGarrisonRecruit(u)) armies.push(u);
        }); // garrison units never join a character
      } else if (oAct === 'Leave/Transfer Army') {
        const oExtra = document.getElementById(`po-extra-${o.id}-${prevPh}`)?.value || '';
        if (String(oExtra) !== String(charId)) return;
        const oArm = projectedLedArmies(o.id, prevPh, memo);
        if (oTgt.split(',').includes('all')) oArm.forEach((a) => armies.push(a));
        else
          oTgt
            .split(',')
            .filter(Boolean)
            .forEach((val) => {
              val = val.trim();
              const a = oArm.find((x) => (x.unitName || x.type) === val);
              if (a) armies.push(a);
            });
      }
    });
    if (prevAction === 'Recruit Armies') {
      const wrap = document.getElementById(`po-target-wrap-${charId}-${prevPh}`);
      if (wrap) {
        // the default muster destination is still THIS character, but recruits sent to the province
        // garrison ("to:garrison") or handed to a friendly hero ("to:<id>") do NOT join this
        // character — so they must not show in this hero's projected led-army preview (that stale
        // display was what made garrison-bound units look as though they marched off with the
        // hero).
        const destSel = wrap.querySelector('.po-recruit-dest');
        const destTok = destSel ? destSel.value : 'to:self';
        const goesToThisHero = !(
          destTok === 'to:garrison' ||
          (destTok && destTok.startsWith('to:') && destTok !== 'to:self')
        );
        if (goesToThisHero) {
          const _ticks = [...wrap.querySelectorAll('input[type="checkbox"]:checked')].map((cb) => cb.value || '');
          _projRecruitUnits(_ticks).forEach((u) => {
            if (!_isAutoGarrisonRecruit(u)) armies.push(u);
          }); // garrison units never join a character
        }
      }
    } else if (prevAction === 'Pick Up Army') {
      const ploc = predictedLocation(charId, prevPh);
      const pgarr = ploc ? projectedGarrison(ploc.id, prevPh, true, charId, memo) : []; // garrison as it stands at THAT phase
      if (prevTarget === 'all') {
        pgarr.forEach((a) => armies.push({ type: a.type, quality: a.quality, unitName: a.unitName }));
      } else
        prevTarget
          .split(',')
          .filter(Boolean)
          .forEach((sel) => {
            sel = sel.trim();
            let gi = null;
            if (sel.startsWith('g:')) gi = parseInt(sel.slice(2));
            else if (sel.startsWith('-1:')) gi = parseInt(sel.slice(3)); // legacy form
            if (gi != null && pgarr[gi])
              armies.push({ type: pgarr[gi].type, quality: pgarr[gi].quality, unitName: pgarr[gi].unitName });
          });
    } else if (prevAction === 'Leave/Transfer Army' || prevAction === 'Disband Army') {
      if (prevTarget === 'all') {
        armies = [];
      } else
        prevTarget
          .split(',')
          .filter(Boolean)
          .forEach((val) => {
            val = val.trim();
            const idx = armies.findIndex((a) => (a.unitName || a.type) === val);
            if (idx >= 0) armies.splice(idx, 1);
          });
    }
  }
  memo.set(
    _ck,
    armies.map((a) => ({ ...a })),
  );
  return armies;
}
