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
function projectedLedArmies(charId, upToPhaseExclusive, _memo) {
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

// projected exploration gain for ONE Explore order — mirror of the GM engine's explore formula
// (terrainBase × (Explorer+1) × Scouts&Rangers × Compass × race/alignment explore discoveries ×
// Loremaster/Trailblazer, capped at 100). Explorer-boosting items aren't visible here.
function exploreGainFor(c, terr) {
  const report = currentReport || {};
  const BASIC_EXPLORE_P = { ...KC_BASIC_EXPLORE };
  const basicRate = BASIC_EXPLORE_P[terr] || 15;
  const disc = report.discoveries || [];
  const hasSD = (id) => disc.some((d) => d.id === id);
  const explorerSkill = Math.min(5, effSkillP(c, 'explorer'));
  // 2026-09-21: the GM ships the realm's per-terrain explore multiplier (every `explore` discovery,
  // terrain-scoped ones included). Old reports without it fall back to the old desc parse.
  const scoutBonus = 1,
    compass = 1;
  let discMult = 1;
  if (report.exploreDiscMult && report.exploreDiscMult[terr] != null) discMult = report.exploreDiscMult[terr];
  else
    disc.forEach((d) => {
      const m = /map(?:s)? (\d+)% more/i.exec(d.desc || '');
      if (m && (!/mountain/i.test(d.desc) || terr === 'mountain')) discMult *= 1 + parseInt(m[1]) / 100;
    });
  const hasLore = (c.titlesHeld || []).some((t) => /Loremaster/i.test(t.name || ''));
  const hasTrail = (c.minorHeld || []).some((t) => /Trailblazer/i.test(t.name || ''));
  const loreMult = (hasLore ? 1.05 : 1) * (hasTrail ? 1.05 : 1);
  return Math.min(100, Math.floor(basicRate * (explorerSkill + 1) * scoutBonus * compass * discMult * loreMult));
}
// Sum of exploration already queued for a province by EARLIER Explore orders (this hero's earlier
// phases, and every other hero's orders in this phase or earlier).
function exploreQueuedBefore(charId, ph, provId) {
  let sum = 0;
  const chars = (currentReport && currentReport.characters) || [];
  chars.forEach((o) => {
    if (!o || o.alive === false) return;
    for (let p = 0; p <= 4; p++) {
      const isSelf = String(o.id) === String(charId);
      if (isSelf && p >= ph) break;
      if (!isSelf && p > ph) break;
      const act = document.getElementById(`po-action-${o.id}-${p}`)?.value;
      if (act !== 'Explore') continue;
      const loc = predictedLocation(o.id, p);
      if (!loc || loc.id !== provId) continue;
      const pd = ((currentReport && currentReport.provinceOrderData) || {})[provId];
      sum += exploreGainFor(o, (pd && pd.terrain) || null);
    }
  });
  return sum;
}
// Exploration a character gains simply by MARCHING INTO a province — the engine grants it on every
// move in, before any Explore order resolves (10% + 5% per Explorer level, + a Traveller's Cloak, +
// 2% per army led at March 6+). Mirrors the engine's explGainMove so the projection below counts
// ground the hero will have mapped on arrival. Returns 0 if they do not move in during `upTo`
// phases.
function exploreMoveGainBefore(c, upToPhaseExclusive, provId) {
  let gain = 0;
  for (let p = 0; p < upToPhaseExclusive; p++) {
    const act = document.getElementById(`po-action-${c.id}-${p}`)?.value;
    // a Forced March IS a move in the engine (`_fmSlip=true; action='move'`), so it grants the same
    // move-in exploration. The projection has to count it or the forecast undershoots.
    if (act !== 'Move' && act !== 'Forced March') continue;
    const dest = predictedLocation(c.id, p + 1); // where this move LANDS them
    const from = predictedLocation(c.id, p);
    if (!dest || !from || dest.id === from.id || dest.id !== provId) continue;
    const lvl = Math.min(5, effSkillP(c, 'explorer'));
    const cloak = (c.items || []).some((it) => it && /Traveller's Cloak/i.test(it.name || '')) ? 20 : 0;
    const marchPerk = ((c.skills || {}).march || 0) >= 6 ? 2 * (c.armies || []).length : 0;
    gain += 10 + 5 * lvl + cloak + marchPerk;
  }
  return gain;
}
function exploreProjectionNote(c, ph) {
  const loc = predictedLocation(c.id, ph);
  const report = currentReport || {};
  const pd = loc ? (report.provinceOrderData || {})[loc.id] : null;
  const wm = loc ? ((report.worldMeta && report.worldMeta.provinces) || []).find((x) => x.id === loc.id) : null;
  const terr = (pd && pd.terrain) || (wm && wm.terrain) || null;
  if (!loc) return kcHtml`🧭 Explores the province ${c.name} stands in.`;
  // 2026-09-24 (Toby): was _unknownSkills only, so a CHARMED hero fell through to the real note below
  // and its figure — computed from Explorer 0 — told the charmer exactly what the hero has not got.
  if (skillsUnseenP(c))
    return kcHtml`🧭 Explores ${loc.name}. The gain depends on an Explorer level ${c._unknownSkills ? `not known until ${c.name} has joined` : `hidden from you`}.`;
  if (!terr)
    return kcHtml`🧭 Explores ${loc.name || 'the province'} — its ground is still unknown to you, so how much it will yield cannot be judged from here.`;
  const gain = exploreGainFor(c, terr);
  // Everything already mapped, or that WILL be mapped before this order resolves:
  // known — what this realm has charted of the province so far
  // moved — what marching in this turn adds on arrival
  // queued — earlier Explore orders this turn, this hero's and every other's
  // test pd.explored, NOT pd. The old ternary keyed on whether the order-data entry existed at all,
  // so whenever it did (owned/visited/adjacent — i.e. almost always) it read pd.explored and never
  // fell through to the map's figure. Reports snapshotted before the GM portal began emitting
  // pd.explored therefore showed "0% mapped" in the orders section while the map pop-up showed the
  // truth. Keying on the value itself makes old reports fall back to worldMeta.
  const known = Math.min(100, (pd && pd.explored != null ? pd.explored : wm && wm.explored) || 0);
  const moved = exploreMoveGainBefore(c, ph, loc.id);
  const queued = exploreQueuedBefore(c.id, ph, loc.id);
  const before = Math.min(100, known + moved + queued);
  const after = Math.min(100, before + gain);
  const priorBits = [];
  if (moved > 0) priorBits.push(`+${moved}% from marching in`);
  if (queued > 0) priorBits.push(`+${queued}% from earlier Explore orders this turn`);
  const prior = priorBits.length ? ` (${known}% mapped now, ${priorBits.join(', ')})` : '';
  if (before >= 100)
    return kcHtml`🧭 ${loc.name} is already fully mapped${prior ? ` ${prior}` : ''} — this Explore order would add nothing.`;
  return kcHtml`🧭 ${loc.name} (${capitalise(terr)}) is <strong>${before}%</strong> mapped; this order adds about <strong>+${gain}%</strong> → <strong>${after}%</strong>${after >= 100 ? ' — fully explored' : ''}${prior}.`;
}
function refreshExploreNotes() {
  const chars = (currentReport && currentReport.characters) || [];
  chars.forEach((c) => {
    if (!c || c.alive === false) return;
    for (let p = 0; p <= 4; p++) {
      const el = document.getElementById(`po-explore-note-${c.id}-${p}`);
      if (el) el.innerHTML = exploreProjectionNote(c, p);
    }
  });
}
function predictedLocation(charId, upToPhaseExclusive) {
  const report = currentReport;
  if (!report) return null;
  const char = (report.characters || []).find((c) => c.id === charId);
  if (!char) return null;
  let locId = char.locationId;
  const worldMeta = report.worldMeta;
  if (!worldMeta) return { id: locId, name: char.locationName };
  for (let ph = 0; ph < upToPhaseExclusive; ph++) {
    const action = document.getElementById(`po-action-${charId}-${ph}`)?.value;
    // FORCED MARCH relocates the character exactly as a Move does (the engine turns it into a
    // move), so later-phase order forms must follow it. Its target is a BARE province id from the
    // move_adjacent select, not the `prov:`/`dir:` form a Move uses, so it is resolved first.
    // Mirrors the GM portal's predictedLocation — both must change together or the forms disagree.
    if (action === 'Forced March') {
      const fmT = (getOrderTarget(charId, ph) || '').trim();
      const fmId = parseInt(fmT.startsWith('prov:') ? fmT.slice(5) : fmT);
      if (!isNaN(fmId) && worldMeta.provinces.some((p) => p.id === fmId)) locId = fmId;
      continue;
    }
    if (action !== 'Move') continue;
    const tgt = getOrderTarget(charId, ph);
    if (!tgt) continue;
    if (tgt.startsWith('prov:')) {
      const pid = parseInt(tgt.slice(5));
      if (!isNaN(pid) && worldMeta.provinces.some((p) => p.id === pid)) locId = pid;
      continue;
    }
    if (!tgt.startsWith('dir:')) continue;
    const dir = tgt.slice(4);
    const curProv = worldMeta.provinces.find((p) => p.id === locId);
    if (!curProv) continue;
    const HEX_DIRS = KC_HEX_DIRS.slice();
    const even = [
      [-1, -1],
      [-1, 0],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
    ];
    const odd = [
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, 0],
      [1, 1],
    ];
    const idx = HEX_DIRS.indexOf(dir);
    if (idx < 0) continue;
    const [dr, dc] = (curProv.row % 2 === 0 ? even : odd)[idx];
    const nr = curProv.row + dr;
    const cols = worldMeta.cols,
      rows = worldMeta.rows;
    if (nr < 0 || nr >= rows) continue;
    const nc = (((curProv.col + dc) % cols) + cols) % cols;
    const nid = nr * cols + nc;
    const nbProv = worldMeta.provinces.find((p) => p.id === nid);
    if (nbProv) locId = nid;
  }
  const prov = worldMeta.provinces.find((p) => p.id === locId);
  return prov ? { id: locId, name: prov.name || 'Unknown' } : { id: locId, name: 'Unknown' };
}

// Track recruit orders already placed in earlier phases (client-side) Compass direction from one
// province to another on the offset-hex map, used to label an as-yet unexplored target province as
// e.g. "Unknown province (West)" instead of a meaningless internal number. Rows shift by half a
// column with parity (pointy-top offset), and columns wrap around the map edge.
function provDirectionLabel(fromId, toId, provs, cols) {
  if (!Array.isArray(provs)) return null;
  const a = provs.find((p) => p.id === fromId),
    b = provs.find((p) => p.id === toId);
  if (!a || !b || a.row == null || b.row == null) return null;
  let dc = b.col - a.col;
  if (cols) {
    if (dc > cols / 2) dc -= cols;
    if (dc < -cols / 2) dc += cols;
  } // shortest way around the wrap
  const dr = b.row - a.row;
  if (dr === 0 && dc === 0) return null;
  const x1 = a.col + (a.row & 1) * 0.5,
    y1 = a.row * 0.866;
  const x2 = a.col + dc + (b.row & 1) * 0.5,
    y2 = b.row * 0.866;
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI; // y grows southward: 0=E, 90=S, 180=W, 270=N
  const dirs = ['East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest', 'North', 'Northeast'];
  return dirs[Math.round(((ang + 360) % 360) / 45) % 8];
}

function getAlreadyRecruitedThisTurn(charId, upToPhaseExclusive) {
  // The recruit cap is PER PROVINCE per unit type (the GM engine keys it `provId:type`), so this
  // tally must be keyed the same way — otherwise recruiting a type in one province wrongly zeroes
  // it out in every OTHER province this character musters in this turn. Returns counts keyed
  // `${provId}:${type}`.
  const recruited = {};
  const savedOrders = currentGamePlayer?.orders;
  let parsedOrders = {};
  if (savedOrders) {
    try {
      const raw = typeof savedOrders === 'string' ? JSON.parse(savedOrders) : savedOrders;
      parsedOrders = (raw.orders || raw)[charId] || [];
    } catch (e) {}
  }
  for (let ph = 0; ph < upToPhaseExclusive; ph++) {
    // Check DOM first, fall back to saved
    const domAction = document.getElementById(`po-action-${charId}-${ph}`)?.value;
    const action = domAction || parsedOrders[ph]?.action || '';
    if (action !== 'Recruit Armies') continue;
    const tgt = domAction ? getOrderTarget(charId, ph) : parsedOrders[ph]?.target || '';
    if (!tgt) continue;
    // The province is wherever the character stands in THIS phase (recruit happens at its
    // location).
    const loc = predictedLocation(charId, ph);
    const provKey = loc ? loc.id : 'unknown' + ph; // keep unknown-location phases from cross-counting
    tgt.split(',').forEach((sel) => {
      const s = sel.trim();
      if (s.startsWith('merc:')) return; // mercenary hire — not a native recruit, no per-turn cap
      if (s.startsWith('to:')) return; // muster-destination selector, not a unit type
      const parts = s.split('|');
      if (parts[0]) {
        const key = `${provKey}:${parts[0].trim()}`;
        recruited[key] = (recruited[key] || 0) + 1;
      }
    });
  }
  return recruited;
}

// Skill another of this realm's characters is practising in phase `ph` in the province `c` is
// predicted to be in that phase (mirrors the engine's co-trainer rule: same realm, same province,
// same phase). Reads the live order form, so it reflects what the player has entered so far. If
// several companions drill different skills, the most common one wins (first seen on a tie).
// 2026-09-11 (items 7 & 12): ONE way to read what any character is ordered to do in any phase. The
// live form (DOM) wins; before the form exists — the very first paint — the saved draft is
// consulted, so "default to what a companion is doing" works on load as well as after a change.
// A declared global (plan P1-09b): one binding the page's files and its tests share (ui/player/globals.js says why).
globalThis._draftOrdersSnapshot = {};
function draftOrderAt(charId, ph) {
  const actEl = document.getElementById(`po-action-${charId}-${ph}`);
  if (actEl) return { action: actEl.value || '', target: getOrderTarget(charId, ph) };
  const sv = ((_draftOrdersSnapshot || {})[charId] || [])[ph] || {};
  return { action: sv.action || '', target: sv.target || '' };
}
const LAIR_POWER_RANK = { Weak: 0, Moderate: 1, Powerful: 2, Legendary: 3 };
// the default Search Lair target is the LOWEST-power lair known in the province the character will
// stand in, skipping any lair already chosen by an earlier Search Lair order — this character's
// earlier phases, or any other of the realm's characters in any phase (same province, same lair).
function defaultLairTarget(c, ph, provId, feats) {
  const taken = new Set();
  ((currentReport && currentReport.characters) || []).forEach((o) => {
    if (!o || o.alive === false) return;
    for (let q = 0; q < SEASONS.length; q++) {
      if (o.id === c.id && q >= ph) continue; // own later phases don't count
      const d = draftOrderAt(o.id, q);
      if (d.action !== 'Search Lair' && d.action !== 'Search Feature') continue;
      if (d.target === '') continue;
      const loc = predictedLocation(o.id, q);
      if ((loc ? loc.id : o.locationId) !== provId) continue;
      taken.add(String(d.target));
    }
  });
  const ranked = (feats || [])
    .filter((f) => !f.ritualSite && !taken.has(String(f.idx)))
    .sort(
      (a, b) =>
        (a.ritualSite ? 9 : (LAIR_POWER_RANK[a.monsterPower] ?? 5)) -
          (b.ritualSite ? 9 : (LAIR_POWER_RANK[b.monsterPower] ?? 5)) || a.idx - b.idx,
    );
  return ranked.length ? String(ranked[0].idx) : '';
}
// Research defaults to the field a companion is researching in the SAME province and phase, else
// this character's own earlier Research this turn, else any other character's Research this turn.
function defaultResearchField(c, ph) {
  const here = predictedLocation(c.id, ph);
  const hereId = here ? here.id : c.locationId;
  const chars = ((currentReport && currentReport.characters) || []).filter((o) => o && o.alive !== false);
  const counts = {};
  let best = '',
    bestN = 0;
  chars.forEach((o) => {
    if (o.id === c.id) return;
    const d = draftOrderAt(o.id, ph);
    if (d.action !== 'Research' || !d.target) return;
    const loc = predictedLocation(o.id, ph);
    if ((loc ? loc.id : o.locationId) !== hereId) return;
    counts[d.target] = (counts[d.target] || 0) + 1;
    if (counts[d.target] > bestN) {
      bestN = counts[d.target];
      best = d.target;
    }
  });
  if (best) return best;
  for (let q = ph - 1; q >= 0; q--) {
    const d = draftOrderAt(c.id, q);
    if (d.action === 'Research' && d.target) return d.target;
  }
  for (const o of chars) {
    if (o.id === c.id) continue;
    for (let q = 0; q < SEASONS.length; q++) {
      const d = draftOrderAt(o.id, q);
      if (d.action === 'Research' && d.target) return d.target;
    }
  }
  return '';
}
// both Practice Skill defaults now go through `draftOrderAt`, the same way the Search Lair and
// Research defaults have since 2026-09-11. The companion lookup therefore always came back empty on
// first paint and the default never fired; it appeared to work only while the player was clicking
// dropdowns, and vanished the moment they reloaded or reopened the report. `draftOrderAt` reads the
// live form when there is one and falls back to `_draftOrdersSnapshot` (this turn's saved draft)
// when there is not, so the group-drill default now survives a first paint. This reverses the
// earlier "no other orders get this system" call — Practice Skill was the one order that visibly
// needed it.
function practiceCompanionSkill(c, ph) {
  const report = currentReport || {};
  const here = predictedLocation(c.id, ph);
  const hereId = here ? here.id : c.locationId;
  const counts = {};
  let best = '',
    bestN = 0;
  (report.characters || []).forEach((o) => {
    if (!o || o.id === c.id || o.alive === false) return;
    const d = draftOrderAt(o.id, ph);
    if (d.action !== 'Practice Skill') return;
    const sk = d.target;
    if (!sk || !ALL_SKILLS.includes(sk)) return;
    const loc = predictedLocation(o.id, ph);
    if ((loc ? loc.id : o.locationId) !== hereId) return;
    counts[sk] = (counts[sk] || 0) + 1;
    if (counts[sk] > bestN) {
      bestN = counts[sk];
      best = sk;
    }
  });
  return best;
}
function practiceOwnEarlierSkill(c, ph) {
  for (let q = ph - 1; q >= 0; q--) {
    const d = draftOrderAt(c.id, q);
    if (d.action !== 'Practice Skill') continue;
    if (d.target && ALL_SKILLS.includes(d.target)) return d.target;
  }
  return '';
}
function buildTargetField(c, ph, saved) {
  const action = saved.action || '';
  const target = saved.target || '';
  const extra = saved.extra || '';
  const report = currentReport || {};
  const provOrderData = report.provinceOrderData || {};

  // ── L7/L9 MASTERY ORDERS — generic target field by declared target type ──
  if (L79_ORDERS[action]) {
    const cfg = L79_ORDERS[action];
    // Every mastery-order branch appends hintHtml, so folding the odds in here covers them all at
    // once — Assassinate, Blockade, Grand Heist and any future one. orderChanceNote returns '' for
    // an order with no roll behind it, so the deterministic masteries are unaffected.
    const hintHtml = kcHtml`<div style="font-size:.68rem;color:var(--stone);margin-top:2px">${action === 'Grand Design' ? gdHintFor(report) : cfg.hint}</div>${orderChanceNote(c, action, ph)}`;
    if (cfg.target === 'none') {
      return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="${action} — no target needed" readonly>${hintHtml}`;
    }
    if (cfg.target === 'province') {
      const wmProvs = report.worldMeta?.provinces || [];
      if (cfg.provKind === 'move_adjacent') {
        const curLoc = predictedLocation(c.id, ph);
        const curId = curLoc ? curLoc.id : c.locationId;
        const curP = wmProvs.find((p) => p.id === curId);
        const candIds = (curP && curP.neighbors) || [];
        const opts = candIds
          .map((pid) => {
            const p = wmProvs.find((x) => x.id === pid);
            if (!p) return '';
            return kcHtml`<option value="${pid}" ${target == pid ? 'selected' : ''}>${p.name || 'Unknown province (' + (provDirectionLabel(curId, pid, wmProvs, report.worldMeta?.cols) || '?') + ')'}${p.ownerName ? ` — ${p.ownerName}` : ''}</option>`;
          })
          .filter(Boolean);
        return opts.length
          ? kcHtml`<select id="po-target-${c.id}-${ph}">${opts}</select>${hintHtml}`
          : kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="No adjacent province to march into" disabled>${hintHtml}`;
      }
      if (cfg.provKind === 'sea_adjacent') {
        const curLoc = predictedLocation(c.id, ph);
        const curId = curLoc ? curLoc.id : c.locationId;
        const curP = wmProvs.find((p) => p.id === curId);
        const candIds = [curId, ...((curP && curP.neighbors) || [])];
        const opts = candIds
          .map((pid) => {
            const p = wmProvs.find((x) => x.id === pid);
            if (!p || p.terrain !== 'sea') return '';
            return kcHtml`<option value="${pid}" ${target == pid ? 'selected' : ''}>${p.name || 'Sea (' + pid + ')'}${pid === curId ? ' (here)' : ''}</option>`;
          })
          .filter(Boolean);
        return opts.length
          ? kcHtml`<select id="po-target-${c.id}-${ph}">${opts}</select>${hintHtml}`
          : kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="No sea province here or adjacent to seal" disabled>${hintHtml}`;
      }
      const seen = wmProvs.filter(
        (p) => p.name && p.terrain && p.terrain !== 'sea' && p.owner != null && p.owner !== c.player,
      );
      const opts = seen.map(
        (p) =>
          kcHtml`<option value="${p.id}" ${target == p.id ? 'selected' : ''}>${p.name}${p.ownerName ? ` — ${p.ownerName}` : ''}</option>`,
      );
      return opts.length
        ? kcHtml`<select id="po-target-${c.id}-${ph}">${opts}</select>${hintHtml}`
        : kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="No enemy province in view to strike" disabled>${hintHtml}`;
    }
    // ── 'here_or_adjacent' — this province or one bordering it (Chart the Unknown). ──
    if (cfg.target === 'here_or_adjacent') {
      const here = predictedLocation(c.id, ph)?.id ?? c.locationId;
      const wm = report.worldMeta?.provinces || [];
      const hp = wm.find((p) => p.id === here);
      const ids = [here, ...((hp && hp.neighbors) || [])];
      const opts = ids.map((pid) => {
        const p = wm.find((x) => x.id === pid);
        const nm =
          (p && p.name) ||
          (pid === here
            ? 'this province'
            : `Unknown province (${provDirectionLabel(here, pid, wm, report.worldMeta?.cols) || '?'})`);
        const sel = String(target) === String(pid) || (!target && pid === here) ? 'selected' : '';
        return kcHtml`<option value="${pid}" ${sel}>${nm}${pid === here ? ' (here)' : ''}${p && p.explored != null ? ` — ${Math.min(100, p.explored)}% mapped` : ''}</option>`;
      });
      return kcHtml`<select id="po-target-${c.id}-${ph}">${opts}</select>${hintHtml}`;
    }
    // ── 'lair_tier' — name a class of lair (Discover Lost Ruin). ──
    if (cfg.target === 'lair_tier') {
      const TIERS = [
        ['Weak', 'Weak lairs'],
        ['Moderate', 'Moderate lairs'],
        ['Powerful', 'Powerful lairs'],
        ['Legendary', 'Legendary lairs'],
        ['Ritual', 'Ritual sites (the old stones)'],
      ];
      const opts = TIERS.map(
        ([v, lbl]) =>
          kcHtml`<option value="${v}" ${target === v || (!target && v === 'Weak') ? 'selected' : ''}>${lbl}</option>`,
      );
      return kcHtml`<select id="po-target-${c.id}-${ph}">${opts}</select>${hintHtml}`;
    }
    // ── 'here' — the order acts on the province this character stands in (Grand Heist). No target
    // is chosen; the field simply reports whether this ground can be robbed and why.
    if (cfg.target === 'here') {
      const here = predictedLocation(c.id, ph)?.id ?? c.locationId;
      const wm = report.worldMeta?.provinces || [];
      const hp = wm.find((p) => p.id === here);
      const atWar = (pi) =>
        ((report.diplomacy && report.diplomacy.known) || []).some((k) => k.index === pi && k.relation === 'enemy');
      const owner = hp ? hp.owner : null;
      const rich = !!hp && (hp.wealth === 'Rich' || (hp.tax != null && hp.tax >= 7));
      const home = !!(hp && hp.isHomeCapitalOfOwner);
      const no = (why) =>
        kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="${why}" disabled>${hintHtml}`;
      if (owner == null || owner === c.player)
        return no('A Grand Heist needs enemy ground — this province is not held by a rival realm');
      if (!atWar(owner)) return no(`You are not at war with ${hp.ownerName || 'this realm'} — declare war first`);
      if (!rich && !home)
        return no(
          `${hp.name || 'This province'} is not worth robbing — a heist needs their capital or rich country (tax 7+)`,
        );
      return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="${hp.name} — ${hp.ownerName || 'the enemy realm'}" readonly>
        <div style="font-size:.68rem;color:var(--stone);margin-top:2px">🏦 You will crack the vaults of <strong>${hp.name}</strong> — ${home ? `${hp.ownerName || 'the enemy'}'s home capital` : 'rich country'}.</div>${hintHtml}`;
    }
    if (cfg.target === 'character') {
      const here = predictedLocation(c.id, ph)?.id ?? c.locationId;
      const foes = (report.visibleChars || []).filter(
        (x) => x.locationId === here && (x.player === null || x.player !== c.player),
      );
      const opts = foes.map(
        (x) =>
          kcHtml`<option value="${x.id}"${realmOptStyleP(x.player, report)} ${target == x.id ? 'selected' : ''}>${x.name}${x.isKing ? ' 👑' : ''}${x.player === null ? ' (wandering)' : ` ⚔ (${realmNameP(x.player, report)})`} — ${x.locationName || '?'}</option>`,
      );
      return opts.length
        ? kcHtml`<select id="po-target-${c.id}-${ph}">${opts}</select>${hintHtml}`
        : kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="No enemy hero in your province this phase" disabled>${hintHtml}`;
    }
  }

  // Build direction options with adjacent province names where known
  const HEX_DIRS_BUILD = KC_HEX_DIRS.slice();
  const EVEN_OFF = [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
  ];
  const ODD_OFF = [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  const worldMeta_ = report.worldMeta || {};
  const wCols = worldMeta_.cols || 20;
  const wRows = worldMeta_.rows || 10;
  const wProvs = worldMeta_.provinces || [];

  // Find character's current predicted location
  const curLocObj = predictedLocation(c.id, ph);
  const curProv_ = curLocObj ? wProvs.find((p) => p.id === curLocObj.id) : null;

  // Build direction options, but ONLY for legal moves. The world wraps east-west, so W/E always
  // lead somewhere; north-south do not wrap — beyond the top and bottom rows lie the impassable icy
  // wastelands. Those off-map directions are omitted from the dropdown, and a note explains why.
  let blockedNorth = false,
    blockedSouth = false;
  // With nothing saved for this phase, open on the direction this character last moved in earlier
  // this turn instead of always North West (2026-09-26, Toby item 2).
  const _defaultDir = action === 'Move' && !target ? lastMoveDirOf(c.id, ph) : null;
  const dirOpts = Object.entries(DIRECTIONS)
    .map(([v, l]) => {
      let provLabel = '',
        offMap = false;
      if (curProv_) {
        const idx2 = HEX_DIRS_BUILD.indexOf(v);
        if (idx2 >= 0) {
          const offs = curProv_.row % 2 === 0 ? EVEN_OFF : ODD_OFF;
          const [dr, dc] = offs[idx2];
          const nr = curProv_.row + dr;
          const nc = (((curProv_.col + dc) % wCols) + wCols) % wCols;
          if (nr >= 0 && nr < wRows) {
            const nid = nr * wCols + nc;
            const nbProv = wProvs.find((p) => p.id === nid);
            if (nbProv && nbProv.name) provLabel = ` (${nbProv.name})`;
            else if (!nbProv) offMap = true;
          } else {
            offMap = true; // beyond the north or south edge of the world
            if (dr < 0) blockedNorth = true;
            else blockedSouth = true;
          }
        }
      }
      if (offMap) return null; // legal moves only
      // Emit the ABSOLUTE province id (prov:<id>) rather than the compass direction, so if the
      // character is displaced earlier in the turn (retreat after a lost battle) the engine still
      // heads for the province the player actually chose, not "one hex east of wherever they ended
      // up". Legacy dir: orders still parse, so a previously-saved direction is shown as selected
      // too.
      const nidOut = curProv_
        ? (curProv_.row + (curProv_.row % 2 === 0 ? EVEN_OFF : ODD_OFF)[HEX_DIRS_BUILD.indexOf(v)][0]) * wCols +
          ((((curProv_.col + (curProv_.row % 2 === 0 ? EVEN_OFF : ODD_OFF)[HEX_DIRS_BUILD.indexOf(v)][1]) % wCols) +
            wCols) %
            wCols)
        : null;
      const valOut = nidOut != null ? `prov:${nidOut}` : `dir:${v}`;
      const selOut =
        target === valOut || target === 'dir:' + v ? 'selected' : !target && _defaultDir === v ? 'selected' : '';
      return kcHtml`<option value="${valOut}" ${selOut}>${l}${provLabel}</option>`;
    })
    .filter(Boolean);
  // the character's OWN province is offered as a move target too. Orders are written before the
  // turn resolves, so a character can be displaced mid-turn — thrown back by a lost battle, routed
  // by Terror — and land somewhere the player never chose. Naming the province they expected to be
  // standing in lets a later phase march straight back into it. If they were NOT displaced the
  // engine simply logs "already in X — the move order is moot" and spends no movement, so it is
  // safe either way.
  const stayOpt = curProv_
    ? kcHtml`<option value="prov:${curProv_.id}" ${target === `prov:${curProv_.id}` ? 'selected' : ''}>Stay in ${curProv_.name || 'this province'} (return here if displaced)</option>`
    : '';

  switch (action) {
    // ── MOVE ──
    case 'Move': {
      const edgeNote =
        blockedNorth || blockedSouth
          ? kcHtml`<div style="font-size:.72rem;color:var(--stone);margin-top:3px">\u2744 The impassable icy wastelands to the ${blockedNorth && blockedSouth ? 'north and south' : blockedNorth ? 'north' : 'south'} bar any further movement in that direction — the world does not extend beyond them.</div>`
          : '';
      // editing THIS move changes where the character stands for every later phase, so onMoveEdited
      // re-renders the character's later Move orders (their direction labels update relative to the
      // new path) and flags each with an "update me" note to re-check.
      // ── MOVE ANALYSIS (2026-09-26, Toby item 1) ── the notice under the dropdown says whether this
      // is a land march, a voyage or a flight, and warns when the column is being sent to sea with
      // too little lift. Built here for whichever option opens selected, and recomputed by
      // refreshMoveModeNote whenever the player changes it.
      const _allOpts = String(kcHtml`${dirOpts}${stayOpt}`); // the options' markup, read for the one that opens selected
      const _initSel = (() => {
        const m = _allOpts.match(/<option value="([^"]+)" selected>/);
        if (m) return m[1];
        const f = _allOpts.match(/<option value="([^"]+)"/);
        return f ? f[1] : '';
      })();
      const _initDest = (() => {
        if (!_initSel.startsWith('prov:')) return null;
        const id = parseInt(_initSel.slice(5));
        return isNaN(id) ? null : wProvs.find((p) => p.id === id) || null;
      })();
      return kcHtml`<select id="po-target-${c.id}-${ph}" onchange="onMoveEdited(${kcArg(String(c.id))},${kcArg(ph)})">${dirOpts}${stayOpt}</select>${edgeNote}
        <div id="po-move-mode-${c.id}-${ph}">${poMoveModeNote(c, _initDest, projectedMoveHost(c.id, ph), moveOriginProv(c.id, ph))}</div>
        <div id="po-move-note-${c.id}-${ph}" style="display:none;font-size:.72rem;color:#8a4a00;background:#fff3e0;border:1px solid #e0b070;border-radius:2px;padding:3px 6px;margin-top:3px"></div>`;
    }

    // ── EXPLORE ── show how much of the province this order will map Item 10: the projection now
    // also counts every EARLIER Explore order in the same
    // province — this hero's own earlier phases and other heroes' orders — so the "→ after" figure is
    // the province's exploration once this order resolves. Recomputed live by
    // refreshExploreNotes().
    case 'Explore': {
      return kcHtml`<input type="hidden" id="po-target-${c.id}-${ph}" value="">
        <div id="po-explore-note-${c.id}-${ph}" style="font-size:.72rem;color:var(--forest)">${exploreProjectionNote(c, ph)}</div>
        <div style="font-size:.68rem;color:var(--stone);margin-top:2px">Higher Explorer skill and better terrain reveal more each time; lairs surface as the map fills.</div>`;
    }

    // ── SPY / REST ──
    case 'Spy': {
      // spy on the PROVINCE (as before, target '') or on a non-own CHARACTER you can see standing
      // in the same province (target 'char:<id>').
      const here = predictedLocation(c.id, ph);
      const hereId = here ? here.id : c.locationId;
      const foes = (report.visibleChars || []).filter(
        (x) => x.id !== c.id && x.locationId === hereId && (x.player === null || x.player !== c.player),
      );
      const spyLvl = effSkillP(c, 'spy');
      const charPct = Math.max(5, Math.min(95, 25 + 10 * spyLvl));
      // 2026-09-24 (Toby): item 8 covered the Spy NOTE but not these option labels, which quote
      // 25% +10% per Spy level — so a hired hero's card read "~25%" and gave away that he has no Spy
      // training. Drop the figure until he has joined; the note below carries the formula.
      const _spHide = skillsUnseenP(c);
      const opts = foes.map(
        (x) =>
          kcHtml`<option value="char:${x.id}"${realmOptStyleP(x.player, report)} ${target === `char:${x.id}` ? 'selected' : ''}>Spy on ${x.name}${x.isKing ? ' 👑 (king)' : ''}${x.isWandering ? ' (wandering)' : x.player != null ? ` ⚔ (${realmNameP(x.player, report)})` : ''}${_spHide ? ' — learns their skills, items and army' : ` — ~${charPct}% to learn their skills, items and army`}</option>`,
      );
      return kcHtml`<select id="po-target-${c.id}-${ph}" onchange="rebuildTargetWrap(${kcArg(String(c.id))},${kcArg(ph)})"><option value="" ${!target ? 'selected' : ''}>Spy on the province (${here ? here.name : 'here'})</option>${opts}</select>
        ${
          _spHide
            ? kcHtml`<div style="font-size:.72rem;color:var(--stone);margin-top:3px">Success: 25% +10% per Spy level — ${unseenSuffixP(c)}.</div>`
            : String(target || '').startsWith('char:')
              ? kcHtml`<div style="font-size:.72rem;color:var(--stone);margin-top:3px">Success: <strong>${charPct}%</strong> (25% +10% per Spy level) — reveals every skill level, magic item and army unit. Win or lose, you may be <strong>caught</strong>: 20% +10% per level of their Spy, −10% per level of yours, +15% in their realm's land, −15% in yours. A caught spy is brought to a personal fight unless the target's Encounter Plan is set to Refuse — put <strong>Flee</strong> at the head of your plan if you would rather not fight.</div>`
              : orderChanceNote(c, 'Spy', ph)
        }`;
    }
    case 'Rest':
      return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="(acts in current province)" disabled>`;

    // ── DEFEND (AK [3.15]) ── A general on Defend keeps watch for the REST of the turn over the
    // province he stands in and the provinces of his realm adjacent to it, reacting to enemy
    // incursions — a column marching in, or a host raised/summoned/seized inside one.
    case 'Defend': {
      if ((c.armies || []).length === 0) {
        return kcHtml`<input type="hidden" id="po-target-${c.id}-${ph}" value="">
          <div style="font-size:.72rem;color:var(--forest)">🗡 Lies in wait around ${curProv_ ? curProv_.name : 'the province they stand in'} and its neighbours.</div>
          <div style="font-size:.7rem;color:var(--stone);margin-top:3px">With no column at their back they cannot bar a road, but they will try to <em>ambush</em> any enemy character who marches into their province or one adjacent — springing a personal battle. Their <strong>Spy</strong> skill decides the odds of catching them (harder against a commander leading an army). A crowned king cannot be ambushed this way unless the ambusher is also a king. Done once an ambush is sprung (a Defend order in a later season sets a new watch); cancelled by a later Move or Encounter order.</div>`;
      }
      // Defend no longer takes a target — it always guards the province the character stands in.
      // The engine reads no target for Defend; a hidden field keeps the order shape consistent.
      return kcHtml`<input type="hidden" id="po-target-${c.id}-${ph}" value="">
        <div style="font-size:.72rem;color:var(--forest)">🛡 Guards ${curProv_ ? curProv_.name : 'the province they stand in'} and its neighbours.</div>
        <div style="font-size:.7rem;color:var(--stone);margin-top:3px">Keeps watch for the rest of the turn, starting this phase. If an enemy army marches into a neighbouring province <em>of yours</em> — or an enemy hero <strong>raises, summons or seizes troops</strong> inside one — they march there at once (1 movement point) and are in the line <em>before</em> the enemy can take it, fighting as the <strong>defender</strong> with the garrison at their side, however strong the foe. A column with ships or sea-beasts in it can only answer by sea — it never rides overland from one land province to another. One ride-out per phase; if their own province is attacked they hold it instead. The watch then carries on from wherever they stand — until it brings them to a battle: win or lose, the Defend order is then done, and only a Defend order in a <em>later</em> season sets a new watch. Also ended by a later Move or Encounter order.</div>
        <div style="font-size:.7rem;color:var(--stone);margin-top:3px">They ride out only <em>after</em> every non-moving order of the phase has resolved — so a spell cast on them, a column handed over or an item passed to them <strong>in the same phase</strong> reaches them first, and they still arrive before any invader marches in. Only support ordered for a phase <em>after</em> they have gone misses them: a spell on them is then never worked (no casting slot lost), a transfer is refused with the troops kept, and a Send Item follows by courier.</div>`;
    }

    // ── PURSUE (AK [3.16]) ── ── ENCOUNTER CHARACTER ──
    case 'Encounter Character': {
      // Target any enemy character you can SEE — one standing in a province you own, a province
      // where you have a character, or a province you spied. Your hero then CHASES them wherever
      // they go and forces the meeting when he catches them (report.encounterTargets carries
      // exactly these). only a king may run down an enemy king, so a common hero never sees enemy
      // kings here
      // (the engine enforces the same rule server-side). Own-side characters are never in this list.
      // Items 1 & 12: the list is now exactly what the map shows. A hero you can SEE but cannot
      // hunt is still listed — greyed out with the reason — so the dropdown never silently
      // disagrees with the map.
      const allSeen = (report.encounterTargets || []).filter((x) => x.id !== c.id);
      const reasonOf = (x) =>
        x.untargetable === 'faceless'
          ? 'no face anyone can remember — cannot be hunted'
          : x.isKing && !c.isKing
            ? 'only your king may hunt a king'
            : null;
      const targets = allSeen.filter((x) => !reasonOf(x));
      if (allSeen.length === 0)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="No enemy characters in sight (own / occupied / spied provinces)" disabled>`;
      const opts = allSeen.map((x) => {
        const why = reasonOf(x);
        return kcHtml`<option value="${why ? '' : x.id}"${realmOptStyleP(x.player, report)} ${why ? 'disabled' : ''} ${!why && target == x.id ? 'selected' : ''}>${x.name}${x.isKing ? ' 👑 (king)' : ''}${x.player === null ? ' (wandering)' : ` ⚔ (${realmNameP(x.player, report)})`} — ${x.locationName || '?'}${x.leadsArmy ? ' (leads troops)' : ''}${why ? ` — ${why}` : ''}</option>`;
      });
      if (targets.length === 0)
        return kcHtml`<select id="po-target-${c.id}-${ph}"><option value="" selected>— No character here can be hunted by ${c.name} —</option>${opts}</select>`;
      return kcHtml`<select id="po-target-${c.id}-${ph}"><option value="">— Choose character to hunt down —</option>${opts}</select>
        <div style="font-size:.72rem;color:var(--stone);margin-top:3px">Your hero sets out after this character and chases them across provinces — one province per phase, a movement point each (the chase stalls if they run out of movement). Once you share a province, the chance to corner them each phase is 70%, +5% per level of your Spy, −5% per level of theirs (5–100%). When they catch up: two columns give battle; otherwise it is a personal duel — but to reach a quarry leading troops your hero must first slip through their camp: 60% less 8% per unit they lead, plus 5% per level of your Spy, less 5% per level of their Tactical (5–95%). Turned away by the sentries, the chase ends. Talk/Steal/Scout tactics don't apply — only combat tactics.</div>`;
    }

    // ── STEAL ──
    case 'Steal': {
      // Thief revision: a thief may lift a MAGIC ITEM, skim 5% of the target realm's TREASURY, or
      // rob the province's garrison paymaster (1g per garrison unit). The choice of prize rides in
      // `extra` ('item' | 'gold'); 'garrison' is a target value of its own.
      const thiefLvl = effSkillP(c, 'thief');
      const loc = predictedLocation(c.id, ph);
      // only characters standing where the thief will BE this phase are offered. The engine (`case
      // 'steal'`) requires `victim.location===c.location` and never chases — a target in another
      // province was accepted by the form, then wasted the phase with "finds no suitable target".
      const _allVisEnemy = (report.visibleChars || []).filter((x) => x.player !== null && x.player !== c.player);
      const visibleEnemyChars = loc ? _allVisEnemy.filter((x) => x.locationId === loc.id) : [];
      const _elsewhere = _allVisEnemy.length - visibleEnemyChars.length;
      const pdS = loc ? provOrderData[loc.id] : null;
      const garrN = pdS && pdS.owner != null && pdS.owner !== c.player ? (pdS.garrisonArmies || []).length : 0;
      if (visibleEnemyChars.length === 0 && garrN === 0)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="Nothing to steal from in ${loc ? loc.name : 'this province'}${_elsewhere > 0 ? ` (${_elsewhere} rival${_elsewhere !== 1 ? 's' : ''} in sight elsewhere — a thief must stand in the same province; move there first)` : ' — you need a rival character or an enemy garrison'}" disabled>`;
      const base = 50 + 10 * Math.min(thiefLvl, 5);
      // 2026-09-24 (Toby): the per-target "~N% chance" is 50% +10% per Thief level, so a hired
      // hero's placeholder card (skills:{} → thiefLvl 0) quoted a flat ~50% and told the player the
      // hero has no Thief training. Print the formula instead until they have joined. Same treatment
      // as the Spy / Research / Explore notes.
      const _stHide = skillsUnseenP(c);
      const _stPct = (halved) => (_stHide ? '' : ` — ~${halved ? Math.floor(base / 2) : base}% chance`);
      // the target's pack is NEVER described — the thief takes a random magic item if one can be
      // lifted (weighted toward the lesser ones), or gold if there is none.
      const opts = visibleEnemyChars.map((x) => {
        return kcHtml`<option value="${x.id}"${realmOptStyleP(x.player, report)} ${target == x.id ? 'selected' : ''}>${x.name}${x.isKing ? ' 👑' : ''} ⚔ (${realmNameP(x.player, report)})${x.armies > 0 ? ' — leads troops (halved)' : ''}${_stPct(x.armies > 0)}</option>`;
      });
      const garrOpt =
        garrN > 0
          ? kcHtml`<option value="garrison" ${target === 'garrison' ? 'selected' : ''}>The garrison paymaster of ${pdS.name || 'this province'} (${garrN} unit${garrN !== 1 ? 's' : ''})${_stPct(true)}</option>`
          : '';
      const _stNote = _stHide
        ? kcHtml`<div style="font-size:.72rem;color:var(--stone);margin-top:3px">Success: 50% +10% per Thief level (halved if the mark leads troops or the paymaster is guarded) — ${unseenSuffixP(c)}, and without Thief training the attempt fails.</div>`
        : '';
      return kcHtml`<select id="po-target-${c.id}-${ph}"><option value="">— Choose target —</option>${opts}${garrOpt}</select>
        <div style="font-size:.72rem;color:var(--stone);margin-top:3px">Only characters in ${loc ? loc.name : 'the same province'} are listed — a thief never chases; move there in an earlier phase first.${_elsewhere > 0 ? ` (${_elsewhere} other rival${_elsewhere !== 1 ? 's' : ''} in sight elsewhere.)` : ''} You cannot tell what a rival carries: a successful theft lifts one of their magic items at random (the lesser trinkets come to hand far more readily than a legendary relic), or 5% of their realm's treasury if they carry no magic. <strong>If you fail and are spotted, the victim draws steel</strong> — put <strong>Flee</strong> at the head of this character's Encounter Plan if you would rather not fight.</div>${_stNote}${orderChanceNote(c, 'Steal', ph)}`;
    }

    // ── SEARCH LAIR ──
    case 'Search Feature': // legacy label (pre-Lair rename) — falls through
    case 'Search Lair': {
      // Use the character's projected province for THIS phase (accounting for earlier-phase moves),
      // and list every feature known there — including ones discovered by another of your
      // characters.
      const loc = predictedLocation(c.id, ph);
      const pd = (loc ? provOrderData[loc.id] : null) || provOrderData[c.locationId] || null;
      const _provId = loc ? loc.id : c.locationId;
      //no saved target → the weakest lair not already chosen by another Search Lair order here.
      const _lairSel =
        target !== '' && target != null ? String(target) : defaultLairTarget(c, ph, _provId, pd?.features || []);
      // the dropdown names the guardian and its KIND as well as the grade, so a player choosing
      // which lair to send a hero to can see they are picking a fight with an undead thing (White
      // Magic doubles) rather than a beast, without opening the Known Lairs card.
      const feats = (pd?.features || [])
        .filter((f) => !f.ritualSite)
        .map((f) => {
          const diff = f.ritualSite ? 'Ritual Site' : f.monsterPower || '';
          /* ritual sites cannot be searched — only a Pagan's Perform Rite uses them */ const _g = f.ritualSite
            ? ''
            : [f.monster, f.monsterCat ? f.monsterCat.toLowerCase() : ''].filter(Boolean).join(', ');
          return kcHtml`<option value="${f.idx}" ${_lairSel === String(f.idx) ? 'selected' : ''}>${f.name}${diff ? ` (${diff})` : ''}${_g ? ` — ${_g}` : ''}</option>`;
        });
      return feats.length
        ? kcHtml`<select id="po-target-${c.id}-${ph}">${feats}</select>`
        : kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="No known lairs in current province" disabled>`;
    }

    // ── HUNTING RUMOURS (2026-09-17 (late), Toby item 3) ── Tick any of the known lairs in the
    // province the character will stand in; target = comma-separated feature idx (the same idx
    // Search Lair uses). Each lair costs gold by grade — Weak 1, Moderate 2, Powerful 3, Legendary
    // 4 — and for each one paid for, three facts are learned (2026-09-23d: no roll): the guardian's
    // weakness, its hoard, and this hero's own odds of beating it (measured by the engine fighting
    // the lair in the background).
    case 'Hunting Rumours': {
      const loc = predictedLocation(c.id, ph);
      const pd = (loc ? provOrderData[loc.id] : null) || provOrderData[c.locationId] || null;
      const feats = (pd?.features || []).filter((f) => !f.ritualSite && f.monster);
      if (!feats.length)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="No known lairs in ${loc ? loc.name : 'this province'} to ask about — explore, or move to a province with a known lair" disabled>`;
      const chosen = new Set(
        String(target || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      );
      const gold = report.kingdom && report.kingdom.gold != null ? report.kingdom.gold : null;
      const rows = feats.map((f) => {
        const price = RUMOUR_COST_BY_POWER_P[f.monsterPower] || 1;
        const kind = [f.monster, f.monsterCat ? f.monsterCat.toLowerCase() : ''].filter(Boolean).join(', ');
        return kcHtml`<label style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:.78rem;cursor:pointer"><input type="checkbox" value="${f.idx}" ${chosen.has(String(f.idx)) ? 'checked' : ''} onchange="updateRumourTarget(${kcArg(String(c.id))},${kcArg(ph)})"> <span>${f.name} <span style="color:var(--stone)">(${f.monsterPower || '?'})</span> — ${kind} — <strong>${price}g</strong></span></label>`;
      });
      const total = [...chosen].reduce((s, ix) => {
        const f = feats.find((x) => String(x.idx) === String(ix));
        return s + (f ? RUMOUR_COST_BY_POWER_P[f.monsterPower] || 1 : 0);
      }, 0);
      return kcHtml`<div id="po-rumour-wrap-${c.id}-${ph}" style="background:#fdf8ee;border:1px solid var(--stone);border-radius:2px;padding:4px 6px">${rows}
        <div id="po-rumour-total-${c.id}-${ph}" style="font-size:.72rem;color:var(--stone);margin-top:3px">Cost of the ticked lairs: <strong>${total}g</strong>${gold != null ? ` (treasury ${gold}g)` : ''} — paid per lair, in the order listed, until the purse runs dry.</div>
        <div style="font-size:.72rem;color:var(--stone);margin-top:3px">For every lair paid for, ${c.name} learns all three: the guardian's <strong>weakness</strong> (marked on your Known Lairs for good), its <strong>hoard</strong> (exact gold and the magic that lies there), and <strong>your own odds</strong> of defeating it as you stand today — told as one of five bands, from no chance to almost certain.</div>
        <input type="hidden" id="po-target-${c.id}-${ph}" value="${[...chosen].join(',')}"></div>`;
    }

    // ── USE ITEM (active magic items only) ──
    case 'Equip Items': {
      // one select per slot (two for rings) listing the slot items this character will hold at this
      // phase; target = comma-separated chosen item names. Unlisted slot items are unequipped; a
      // slot left on '— none —' is auto-filled by the engine with the first item held for it.
      const held = predictedItems(c.id, ph).filter((it) => it && itemSlotP(it) && itemUsableByP(it, c)); // bound items you can't use aren't offered
      // 2026-09-24 (Toby): a card whose sheet you cannot read carries `items:[]` — an ABSENCE of
      // information, not an empty pack. The old placeholder read it as fact and announced "Nothing to
      // wear or wield", which tells the player something definite about a pack they have no right to
      // see (and is very likely false — a wandering hero of any standing is carrying something).
      if (held.length === 0)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="${skillsUnseenP(c) ? `What ${c.name} carries is not yours to see — they wear and wield their own gear as they see fit` : 'Nothing to wear or wield (no weapon, armour, shield, cloak, helm, ring, amulet or combat items)'}" disabled>`;
      const chosen = (target || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const rows = ITEM_SLOT_ORDER_P.map((sl) => {
        const opts = held.filter((it) => itemSlotP(it) === sl);
        if (opts.length === 0) return '';
        const cap = ITEM_SLOT_CAP_P[sl];
        const pre = chosen.length
          ? chosen.filter((n) => opts.some((o) => o.name === n))
          : opts.filter((o) => o.equipped !== false).map((o) => o.name);
        const sels = Array.from(
          { length: cap },
          (_, k) =>
            kcHtml`<select data-slot="${sl}" onchange="updateEquipTarget(${kcArg(String(c.id))},${kcArg(ph)})" style="font-size:.75rem;flex:1"><option value="">— none —</option>${opts.map((o) => kcHtml`<option value="${o.name}" ${pre[k] === o.name ? 'selected' : ''}>${o.name}${isLegendaryItemP(o) ? '✨ ' : ''}</option>`)}</select>`,
        );
        return kcHtml`<div style="display:flex;align-items:center;gap:6px;padding:2px 0"><span style="font-family:'Cinzel',serif;font-size:.68rem;color:var(--stone);min-width:110px">${ITEM_SLOT_LABEL_P[sl]}</span>${sels}</div>`;
      });
      const init = chosen.length ? chosen : held.filter((o) => o.equipped !== false).map((o) => o.name);
      return kcHtml`<div id="po-equip-wrap-${c.id}-${ph}" style="background:#fdf8ee;border:1px solid var(--stone);border-radius:2px;padding:4px 6px">${rows}
        <div style="font-size:.68rem;color:#2f281c;margin-top:3px">Only equipped items in these slots give their bonus; everything else you carry is always active. Equipped items can still be sent to other characters.</div>
        <input type="hidden" id="po-target-${c.id}-${ph}" value="${init.join(',')}"></div>`;
    }
    case 'Use Item': {
      const ACTIVE_ITEM_STATS = new Set(['massPromote', 'castSpell']);
      // Items received via Give Item in an earlier phase are usable here too.
      const active = predictedItems(c.id, ph).filter(
        (it) => it && it.effect && ACTIVE_ITEM_STATS.has(it.effect.stat) && !it._spent,
      );
      // Same reasoning as Equip Items above: "No usable items" is a claim about a pack the player
      // cannot see. A charmed hero will use their own tricks or not; you do not get to inventory them.
      if (active.length === 0)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="${skillsUnseenP(c) ? `Whatever ${c.name} carries is hidden from you — you cannot order the use of an item you cannot see` : 'No usable (active) items — most items are passive'}" disabled>`;
      const opts = active.map(
        (it) =>
          kcHtml`<option value="${it.id}" ${target == it.id ? 'selected' : ''}>${isLegendaryItemP(it) ? '✨ Legendary — ' : ITEM_TIER_NAME_P[it.tier || 1] + ' — '}${it.name} — ${it.desc}</option>`,
      );
      // a spell item needs the spell's own target (province / character) — same field as Cast
      // Spell.
      const selIt = active.find((it) => String(it.id) === String(target)) || active[0];
      const sec =
        selIt && selIt.effect && selIt.effect.stat === 'castSpell'
          ? kcHtml`${castChanceNote(c, selIt.effect.spell, { itemCast: true })}${spellSecondaryHtml(report, c, ph, selIt.effect.spell, extra, selIt.effect.spell)}`
          : '';
      return kcHtml`<select id="po-target-${c.id}-${ph}" onchange="onSpellChange(${kcArg(String(c.id))},${kcArg(ph)},this.value)">${opts}</select>${sec}`;
    }

    // ── CAST SPELL ── ── DIVINE: CONSECRATE ──
    case 'Consecrate': {
      if (report.kingdom?.alignment !== 'Divine')
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="Only Divine realms may consecrate" disabled>`;
      if (!c.isKing)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="King only" disabled>`;
      const loc = predictedLocation(c.id, ph);
      const wmP = (report.worldMeta && report.worldMeta.provinces) || [];
      const curP = loc ? wmP.find((p) => p.id === loc.id) : null;
      const ownedHere = !!(curP && curP.tier === 'owned');
      const homeP = wmP.find((p) => p.tier === 'owned' && p.tax >= 10); // home = the tax-10 seat
      const homeId = homeP ? homeP.id : null;
      // Only YOUR OWN consecrated provinces bear on the placement rules (adjacency ban +
      // White-skill limit). Enemy holy ground is now visible on the map too, so it must be excluded
      // here or it would wrongly block your placements / inflate your consecrated count.
      const consecIds = new Set(wmP.filter((p) => p.consecrated && p.tier === 'owned').map((p) => p.id));
      const nbrs = (curP && curP.neighbors) || [];
      const white = effSkillP(c, 'white');
      // reflect the placement rules — owned, not home / home-adjacent, not already consecrated, not
      // adjacent to another consecrated province, and within the White-skill limit.
      let warn = '';
      if (!loc) warn = 'Province unknown this phase.';
      else if (!ownedHere) warn = `${loc.name} is not yours this phase — you may only consecrate land you hold.`;
      else if (homeId != null && loc.id === homeId)
        warn = `${loc.name} is your home province — already anointed at the coronation. Carry the light outward.`;
      else if (homeId != null && nbrs.includes(homeId))
        warn = `${loc.name} borders your home province — the crown's hearth already shelters it. Consecrate ground beyond the home marches.`;
      else if (curP && curP.consecrated) warn = `${loc.name} is already consecrated.`;
      else if (nbrs.some((id) => consecIds.has(id)))
        warn = `${loc.name} borders one of your consecrated provinces — two may not lie side by side. Choose ground set apart.`;
      else if (white <= 0)
        warn = `Consecration flows from the White arts — learn White magic before you can sanctify ground.`;
      else if (consecIds.size >= white)
        warn = `You already hold ${consecIds.size}/${white} consecrated province${white !== 1 ? 's' : ''} (your White limit). One must be lost or captured first, or raise White to hold more.`;
      const okMsg = `Consecrates ${loc ? loc.name : 'current province'} — holy ground (${consecIds.size}/${white || 0} held).`;
      const inputBox = warn
        ? kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="⚠ ${warn}" readonly style="border-color:var(--crimson);color:var(--crimson)">`
        : kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="${okMsg}" readonly>`;
      return kcHtml`${inputBox}
        <div style="font-size:.68rem;color:var(--stone);margin-top:2px">Sanctifies the province ${c.name} stands in: +50% tax, defenders twice as likely to fight fanatically, Undead/Evil invaders −15%. Your fallen characters can ONLY be restored on consecrated ground — they rise in the nearest consecrated province, which then loses its consecration. Rules: it must be a province you own; <strong>not</strong> your home province or any province next to it; and <strong>no two consecrated provinces may be adjacent</strong>. You may hold up to your <strong>White skill level</strong> at once; a consecrated province that is captured loses its consecration at once and frees a slot (an Undead conqueror's units each gain an experience level for the sacrilege; an Evil conqueror's have a 50% chance; other realms gain nothing).</div>`;
    }
    // ── GOOD: CALL TO ARMS ──
    case 'Call to Arms': {
      if (report.kingdom?.alignment !== 'Good')
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="Only Good realms may call the folk to arms" disabled>`;
      if (!c.isKing)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="Only the KING's voice carries the Call" disabled>`;
      const human = (report.ownedProvinces || []).filter(
        (p) => p.terrain !== 'sea' && !(p.race || '').startsWith('Primal'),
      );
      if (!human.length)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="No owned humanoid provinces to raise" disabled>`;
      const ctaOpts = human.map(
        (p) =>
          kcHtml`<option value="${p.id}" ${target == p.id ? 'selected' : ''}>${p.name} — raises a Green ${(p.armyTypes && p.armyTypes[0] && (p.armyTypes[0].type || p.armyTypes[0])) || 'levy'}</option>`,
      );
      return kcHtml`<select id="po-target-${c.id}-${ph}">${ctaOpts}</select>
        <div style="font-size:.68rem;color:var(--stone);margin-top:2px">Free Green garrison unit of the province's native type. The king need not be present — the province just has to be yours when the order resolves. Once per turn.</div>`;
    }
    // ── NEUTRAL: BROKER ──
    case 'Broker': {
      if (report.kingdom?.alignment !== 'Neutral')
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="Only Neutral realms keep brokers" disabled>`;
      if (!c.isKing)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="Only the KING commands the brokers" disabled>`;
      const hireOpts = Object.values(provOrderData || {})
        .flatMap((pd) => pd.availableHeroes || [])
        .map((h) => {
          const w = heroHireWageOfP(h, report);
          if (w == null) return '';
          return kcHtml`<option value="hire:${h.id}" ${target === 'hire:' + h.id ? 'selected' : ''}>🤝 Hire remotely: ${h.name} (${h.race}/${h.alignment}) in ${h.locationName} — ${heroFameTextP(h)} — ${w}g/turn</option>`;
        })
        .filter(Boolean);
      const spyOpts = (report.worldMeta?.provinces || [])
        .filter((p) => p.name && p.terrain)
        .map(
          (p) =>
            kcHtml`<option value="spy:${p.id}" ${target === 'spy:' + p.id ? 'selected' : ''}>🕵 Buy word from ${p.name} (2g — full Spy result)</option>`,
        );
      if (!hireOpts.length && !spyOpts.length)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="Your brokers have nothing within reach" disabled>`;
      // BROKER BUG. The select had no placeholder and no onchange, so (a) the browser silently
      // pre-selected the FIRST hire option the moment Broker was chosen, which popped that hero's
      // future-orders card unasked, and (b) changing the choice — to another hero, or to a Spy
      // purchase — never told syncHiredHeroCard, so the stale card sat there for the rest of the
      // session. Both fixed the way Hire Hero already does it: an explicit "choose" placeholder,
      // and the card re-synced on change.
      const _bHasPick = typeof target === 'string' && (target.startsWith('hire:') || target.startsWith('spy:'));
      const _bPh = kcHtml`<option value="" ${_bHasPick ? '' : 'selected'}>— choose what the brokers are to buy —</option>`;
      return kcHtml`<select id="po-target-${c.id}-${ph}" onchange="syncHiredHeroCard(${kcArg(String(c.id))},${kcArg(ph)})">${_bPh}${hireOpts}${spyOpts}</select>
        <div style="font-size:.68rem;color:var(--stone);margin-top:2px">Money moves what armies cannot: hire any wandering hero the realm can see (they stay where they are and act next phase), or buy a guaranteed Spy report on any province the realm has seen — 2g.</div>`;
    }
    // ── UNDEAD: HARVEST THE FIELD ──
    case 'Harvest the Field': {
      if (report.kingdom?.alignment !== 'Undead')
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="Only Undead realms keep corpse-carters" disabled>`;
      const loc = predictedLocation(c.id, ph);
      return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="Harvests the graves of ${loc ? loc.name : 'current province'}" readonly>
        <div style="font-size:.68rem;color:var(--stone);margin-top:2px">No magic required: 2g raises ONE random battlefield grave in the province ${c.name} stands in as a Skeletal unit (keeps its type and quality; 1g upkeep). Needs battlefield dead present — fields where armies have fallen.</div>`;
    }
    case 'Perform Rite': {
      // PAGAN only — rites are performed at a DISCOVERED ritual site (Standing Stones and their
      // kin) in the province the character will be standing in this phase.
      if ((report.kingdom?.alignment || 'Neutral') !== 'Pagan')
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="Only Pagan realms keep the old rites" disabled>`;
      const loc = predictedLocation(c.id, ph);
      const pd = loc ? (report.provinceOrderData || {})[loc.id] : null;
      const site = (pd?.features || []).find((f) => f.ritualSite);
      if (!site)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="${loc ? `No known ritual site in ${loc.name} — Explore to find standing stones` : 'Province unknown'}" disabled>`;
      // Wild Hunt needs wild creatures to bind: only offered where the province's recruitable pool
      // still holds a primal unit (Creature or Monster country). The GM report names the exact type
      // the engine will bind and its price (the cost of ONE beast, however many answer), so this
      // form never has to re-derive it and drift from the engine.
      const canHunt = !!pd?.wildHuntType;
      const huntCost = pd?.wildHuntCost;
      // list the armies this character will be LEADING at this phase — start-of- turn units plus
      // anything recruited, picked up, transferred in or otherwise gained earlier in the turn (the
      // engine resolves the S:/E: indices against the actual army list at that phase, which is
      // built in the same order: existing units first, gains appended in phase order).
      const _boArmy = projectedLedArmies(c.id, ph);
      // Pre-select from any saved order (extra encodes "S:i,j|E:a,b").
      const _boSaved = { S: new Set(), E: new Set() };
      {
        const m = /S:([0-9,]*)\|E:([0-9,]*)/.exec(extra || '');
        if (m) {
          m[1]
            .split(',')
            .filter(Boolean)
            .forEach((x) => _boSaved.S.add(+x));
          m[2]
            .split(',')
            .filter(Boolean)
            .forEach((x) => _boSaved.E.add(+x));
        }
      }
      const _boRows = _boArmy.length
        ? _boArmy.map(
            (a, i) => kcHtml`<div style="display:flex;align-items:center;gap:6px;font-size:.72rem;padding:1px 0">
            <span style="flex:1">${typeof unitEmoji === 'function' ? unitEmoji(a.type) : ''} ${armyLabel(a)}</span>
            <select class="bo-sel" data-cid="${c.id}" data-ph="${ph}" data-idx="${i}" onchange="updateBloodOffering(${kcArg(String(c.id))},${kcArg(ph)})" style="font-size:.7rem">
              <option value="K" ${!_boSaved.S.has(i) && !_boSaved.E.has(i) ? 'selected' : ''}>Keep</option>
              <option value="S" ${_boSaved.S.has(i) ? 'selected' : ''}>Sacrifice ✝</option>
              <option value="E" ${_boSaved.E.has(i) ? 'selected' : ''}>Empower +2</option>
            </select></div>`,
          )
        : kcHtml`<div style="font-size:.72rem;color:var(--stone)">This character leads no army units to offer.</div>`;
      return kcHtml`<select id="po-target-${c.id}-${ph}" onchange="updateBloodOffering(${kcArg(String(c.id))},${kcArg(ph)})">
        ${canHunt ? kcHtml`<option value="Wild Hunt" ${target === 'Wild Hunt' ? 'selected' : ''}>\u{1F525} Rite of the Wild Hunt — bind 2 VETERAN ${pd?.wildHuntType || 'wild creatures'} (${huntCost}g — the price of one, no wages, serve until end of NEXT turn)</option>` : ''}
        <option value="Blood Offering" ${target === 'Blood Offering' || !target ? 'selected' : ''}>\u{1FA78} Blood Offering — sacrifice units to empower others (+2 tiers each)</option>
      </select>
      <input id="po-extra-${c.id}-${ph}" type="hidden" value="${extra || ''}">
      <div id="bo-block-${c.id}-${ph}" style="margin-top:5px;border:1px solid var(--parchment-dark);border-radius:3px;padding:6px;background:#fdf5e0">
        <div style="font-size:.7rem;font-weight:600;color:#7a4a00;margin-bottom:3px">Blood Offering — mark units to Sacrifice, and an equal number to Empower (+2 quality tiers each, max Elite):</div>
        ${_boRows}
        <div id="bo-hint-${c.id}-${ph}" style="font-size:.7rem;color:var(--stone);margin-top:3px"></div>
      </div>
      <div style="font-size:.68rem;color:#7a4a00;margin-top:3px">At the ${site.name}. The old gods always take payment.</div>
      <div style="font-size:.68rem;color:var(--stone);margin-top:2px">Only one rite per province per turn — if anyone (your own characters included) performs a rite here earlier in the turn, this one fails.</div>`;
    }
    case 'Cast Spell': {
      const skills = c.skills || {};
      // a charmed hero's schools and levels are hidden — offer every core phase spell without
      // levels. 2026-09-18: every BASE spell (levels 1-5) that can be a phase order is listed,
      // whatever the school; L7/L9 mastery spells (SPELL_REQ_LEVEL) are not. Combat-only spells
      // (Lightning Bolt, Fireball, Spiritwrack, Mirror Image, Hand of Death) are never phase orders.
      // Holy Symbol has an action form (cleanses the caster's province of its graves). A spell the hero has not learned simply fails.
      if (skillsUnseenP(c)) {
        const _hsPhase = new Set([
          'Resurrect',
          'Part Sea',
          'Bless Province',
          'Holy Symbol',
          'Charm',
          'Oratory',
          'Clairvoyance',
          'Psychic Blast',
          'Telekinetic Storm',
          'Illusory Terrain',
          'Phantasmal Armies',
          'Hide Lairs',
          'Invisibility',
          'Earthquake',
          'Flood',
          'Elemental Summon',
          'Control Undead',
          'Skeletal Armies',
          'Curse',
          'Plague',
        ]);
        const _hsList = Object.entries(SPELLS_BY_SCHOOL).flatMap(([school, list]) =>
          list.filter((sp) => _hsPhase.has(sp) && !SPELL_REQ_LEVEL[sp]).map((sp) => [sp, school]),
        );
        // same one-list rule as the visible-skills branch below: the option marked `selected` and
        // the spell the target field is built for must be the same one, even when the saved spell
        // is no longer in the list.
        const _hsSel = target && _hsList.some(([sp]) => sp === target) ? target : (_hsList[0] && _hsList[0][0]) || '';
        return kcHtml`<select id="po-target-${c.id}-${ph}" onchange="onSpellChange(${kcArg(String(c.id))},${kcArg(ph)},this.value)">${_hsList.map(([sp, school]) => kcHtml`<option value="${sp}" ${sp === _hsSel ? 'selected' : ''}>${sp} (${SKILL_LABELS[school]})</option>`)}</select>
          <div style="font-size:.7rem;color:var(--stone)">${c._unknownSkills ? `${c.name}'s training is unknown until they have joined — every base spell is offered; one from a school they have not learned simply fails.` : `You cannot see this hero's skills — a spell from a school they have not learned simply fails.`}</div>${spellSecondaryHtml(report, c, ph, _hsSel, _hsSel === target ? extra : '', target)}`;
      }
      // Only show spells that are usable as phase orders
      const PHASE_SPELLS = new Set([
        'Resurrect',
        'Part Sea',
        'Bless Province',
        'Holy Symbol',
        'Charm',
        'Oratory',
        'Clairvoyance',
        'Psychic Blast',
        'Telekinetic Storm',
        'Illusory Terrain',
        'Phantasmal Armies',
        'Hide Lairs',
        'Invisibility',
        'Earthquake',
        'Flood',
        'Elemental Summon',
        'Control Undead',
        'Skeletal Armies',
        'Curse',
        'Plague',
        'Sanctuary',
        'Divine Judgment',
        'Mass Confusion',
        'Dominate',
        'Phantom Host',
        'Veil',
        'Chain Lightning',
        'Cataclysm',
        'Raise Wraiths',
        "Death's Dominion",
      ]);

      // Also include schools being practised in an earlier phase this turn. The practice may or may
      // not succeed, but the player should be able to pre-order a cast in case it does. If the
      // skill is still 0 when the phase resolves, the cast will simply fail with a clear message.
      // 2026-10-13 (item 2, Toby): each earlier Practice order on a school is assumed to succeed, so
      // the casting limit quoted (and enforced in the dropdown) is the one the hero may have reached
      // by this phase. The engine counts the limit from the level at the moment of casting, so a
      // practice that lands does raise it.
      const { practising: practisingSchools, projected: _projLvl } = projectedMagicLevels(c, ph);

      // Count how many Cast Spell orders from each school already exist in earlier phases
      const schoolCastCount = {};
      for (let prevPh = 0; prevPh < ph; prevPh++) {
        const prevAction = document.getElementById(`po-action-${c.id}-${prevPh}`)?.value || '';
        if (prevAction !== 'Cast Spell') continue;
        const prevSpell = getOrderTarget(c.id, prevPh);
        const prevSchool = prevSpell ? SPELL_TO_SCHOOL[prevSpell] : null;
        if (prevSchool) schoolCastCount[prevSchool] = (schoolCastCount[prevSchool] || 0) + 1;
      }

      // ── 2026-09-21: THE DROPDOWN AND THE TARGET FIELD ARE DECIDED FROM ONE LIST ──
      // They used to be worked out separately: the <option> markup here, and `selSpell` (which
      // picks the secondary target field — province vs character) from a second pass over the same
      // tables. When nothing was saved yet, `selSpell` took the FIRST spell in that list while the
      // BROWSER, per the HTML spec, selects the first NON-DISABLED option. Those are different
      // spells the moment an earlier phase has spent a school's casting limit, so a hero who had
      // already cast his one Psychic spell this turn opened the form showing "Earthquake" over a
      // "— Target character —" box built for Charm. The same drift hit any saved spell whose option
      // is no longer offered (a level lost, a mastery spell gated). Now the rows are built ONCE as
      // data, the selection is resolved against them (saved spell if it is still offered and
      // castable, else the first castable one), and that single answer both marks `selected` and
      // builds the target field — so the two cannot disagree.
      const _spellRows = Object.entries(SPELLS_BY_SCHOOL)
        .filter(([school]) => effMagicLvl(c, school) >= 1 || practisingSchools.has(school))
        .flatMap(([school, list]) =>
          list
            .filter((s) => PHASE_SPELLS.has(s) && (!SPELL_REQ_LEVEL[s] || rawMagicLvl(c, school) >= SPELL_REQ_LEVEL[s]))
            .map((s) => {
              const currentLvl = effMagicLvl(c, school);
              const projLvl = _projLvl[school];
              const isPractising = practisingSchools.has(school) && currentLvl === 0;
              const limit = actionSpellLimit(projLvl);
              const used = schoolCastCount[school] || 0;
              const atLimit = used >= limit;
              const lvlTxt =
                projLvl > currentLvl ? `Lv${currentLvl}→${projLvl} if practice succeeds` : `Lv${currentLvl}`;
              let label;
              if (isPractising && !atLimit) {
                label = `${s} (${SKILL_LABELS[school]} — practising, may unlock: Lv${projLvl}, ${used}/${limit} used)`;
              } else if (atLimit) {
                label = `${s} (${SKILL_LABELS[school]} ${lvlTxt} — limit reached: ${used}/${limit} this turn)`;
              } else {
                label = `${s} (${SKILL_LABELS[school]} ${lvlTxt} — ${used}/${limit} used)`;
              }
              return { spell: s, atLimit, label };
            }),
        );
      const _castable = _spellRows.filter((r) => !r.atLimit);
      const _selSpell =
        target && _castable.some((r) => r.spell === target)
          ? target
          : (_castable[0] && _castable[0].spell) || (_spellRows[0] && _spellRows[0].spell) || '';
      const spells = _spellRows.map(
        (r) =>
          kcHtml`<option value="${r.spell}" ${r.spell === _selSpell ? 'selected' : ''} ${r.atLimit ? 'disabled' : ''} style="${r.atLimit ? 'color:#aaa;' : ''}">  ${r.label}</option>`,
      );

      // Check if ALL spells from known AND practising schools are at limit Note: [].every() returns
      // true in JS (vacuous truth) — guard against empty set
      const knownOrPractisingSchools = Object.entries(SPELLS_BY_SCHOOL).filter(
        ([school]) => effMagicLvl(c, school) >= 1 || practisingSchools.has(school),
      );
      const allAtLimit =
        knownOrPractisingSchools.length > 0 &&
        knownOrPractisingSchools.every(
          ([school]) => (schoolCastCount[school] || 0) >= actionSpellLimit(_projLvl[school]),
        );

      if (!spells.length)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="No spells known — need a magic skill ≥ 1, or practise one earlier this turn" disabled>`;
      if (allAtLimit)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="All magic school casting limits reached for this turn" disabled>`;

      // The secondary target field is built for the SAME spell the dropdown will show — see the
      // note above _spellRows. `extra` (the saved target) is only meaningful for the saved spell,
      // so it is dropped when the selection has fallen back to a different one.
      const selSpell = _selSpell;
      const secondaryHtml = spellSecondaryHtml(report, c, ph, selSpell, selSpell === target ? extra : '', target);
      return kcHtml`<select id="po-target-${c.id}-${ph}" onchange="onSpellChange(${kcArg(String(c.id))},${kcArg(ph)},this.value)">${spells}</select>${castChanceNote(c, selSpell)}${secondaryHtml}`;
    }

    // ── PRACTICE SKILL ──
    case 'Practice Skill': {
      // Default: when no skill is saved yet, pre-select whatever another of this realm's characters
      // is already practising in the SAME province (predicted for this phase) in the SAME phase -
      // the engine's co-trainer rule - so a group drill takes one click to line up. All skills stay
      // listed; an explicitly saved target always wins. Item 4: failing a companion, default to
      // whatever THIS character practised in an earlier phase this turn (the latest one), so a
      // training week takes one click per phase.
      const defaultSk = target || practiceCompanionSkill(c, ph) || practiceOwnEarlierSkill(c, ph) || '';
      const skillOpts = ALL_SKILLS.map(
        (sk) =>
          kcHtml`<option value="${sk}" ${defaultSk === sk ? 'selected' : ''}>${SKILL_LABELS[sk]}${skillsUnseenP(c) ? '' : ` (Lv ${(c.skills || {})[sk] || 0})`}</option>`,
      );
      if (skillsUnseenP(c))
        return kcHtml`<select id="po-target-${c.id}-${ph}">${skillOpts}</select><div style="font-size:.7rem;color:var(--stone)">${c._unknownSkills ? `${c.name}'s skill levels are not known until they have joined.` : `A charmed hero's skill levels are hidden from you.`}</div>`; // item 7 · 2026-09-24 item 8
      return kcHtml`<select id="po-target-${c.id}-${ph}" onchange="rebuildTargetWrap(${kcArg(String(c.id))},${kcArg(ph)})">${skillOpts}</select>${orderChanceNote(c, 'Practice Skill', ph)}`;
    }

    // ── RESEARCH (Sage 1+) ── the discovery roll, split out of Practice Sage.
    case 'Research': {
      const sg = Math.min(5, effSkillP(c, 'sage'));
      const disc = report.discoveries || [];
      const per = 5;
      const neutral = report.kingdom?.alignment === 'Neutral' ? sg * 5 : 0;
      const chance = sg * per + neutral;
      // choose a FIELD of study. Categories with every discovery already made are greyed out.
      const cats = report.researchCategories || [];
      //no saved field → what a companion researches here this phase, else this
      // character's earlier Research this turn, else any other character's. An open field (all
      // found) is never defaulted.
      let _rsel = target || defaultResearchField(c, ph);
      if (_rsel && cats.some((k) => k.name === _rsel && k.known >= k.total)) _rsel = '';
      const catOpts = [
        kcHtml`<option value="" ${!_rsel ? 'selected' : ''}>Any field of study</option>`,
        ...cats.map((k) => {
          const done = k.known >= k.total;
          return kcHtml`<option value="${k.name}" ${done ? 'disabled' : ''} ${_rsel === k.name ? 'selected' : ''}>${k.name} (${k.known}/${k.total} found${done ? ' — all discoveries in this field have been found' : ''})</option>`;
        }),
      ];
      return kcHtml`<select id="po-target-${c.id}-${ph}">${catOpts}</select>
        <div style="font-size:.72rem;color:var(--forest)">📜 ${skillsUnseenP(c) ? `Rolls for a Sage discovery: 5% per Sage level${neutral ? ' (doubled for Neutral scholars)' : ''} — ${unseenSuffixP(c)}; without Sage training the search fails.` : kcHtml`Rolls for a Sage discovery: about <strong>${chance}%</strong> (Sage ${sg}${neutral ? ', Neutral scholars' : ''}).`}</div>
        <div style="font-size:.68rem;color:var(--stone);margin-top:2px">Discoveries are permanent realm-wide upgrades. A successful roll turns up <strong>two</strong> discoveries in the field; in next turn's orders you keep one and the other is forgotten for good. Research trains Sage only when it makes a discovery — use Practice Skill to train it reliably. A scholar sometimes turns up a find from a field you never chose; when that happens it is the discovery you make this season <em>instead</em> of an ordinary one, not as well as it.</div>${orderChanceNote(c, 'Research', ph)}`;
    }

    // ── RECRUIT ARMIES ──
    case 'Recruit Armies': {
      const loc = predictedLocation(c.id, ph);
      const pd = loc ? provOrderData[loc.id] : null;
      // Also show mercenaries available in this province
      const mercsAvail = (report.mercIntel || []).filter((m) => m.locationId === loc?.id);
      const gold = report.kingdom?.gold || 0;
      // conditional recruit in a NON-owned province. Normally recruiting is limited to provinces
      // you control. But if (a) you already knew this province's recruitable units at the start of
      // this turn (its army types are present in your intel below) AND (b) this character moved in
      // with an army during an earlier phase — potentially seizing control — then offer the recruit
      // here. The GM engine still enforces that you actually took control before the recruit
      // resolves; if you didn't, the order is skipped at resolution. a recruit order can be ENTERED
      // for any seen-but-not-yet-owned province whose recruitable units you already know
      // (owned/visited/adjacent), so you can PLAN a muster you intend to take. No longer gated on a
      // pre-planned move-in — the GM engine re-checks that you actually control the province
      // (prov.owner===player) when the order resolves; if you don't, the recruit is simply skipped.
      // A ⚑ notice makes the conditional nature clear.
      const conditionalRecruit = !!(pd && !pd.canRecruit && (pd.armyTypes || []).length > 0 && loc);
      // Mercenary bands answer to gold, not to borders: they can be hired in ANY province this
      // character occupies, owned or not, and are never subject to the native per-turn recruit cap.
      // They are therefore listed independently of every gate below.
      const savedSelsM = (target || '').split(',').filter(Boolean);
      const mercRows = mercsAvail.map((m) => {
        const val = `merc:${m.id}`;
        return kcHtml`<label style="display:flex;align-items:center;gap:6px;padding:2px 4px;font-size:.8rem;cursor:pointer;background:#fbeeee;border-radius:2px">
          <input type="checkbox" value="${val}" ${savedSelsM.includes(val) ? 'checked' : ''} onchange="updateRecruitTarget(${kcArg(String(c.id))},${kcArg(ph)})" style="width:auto;margin:0">
          \u2694 ${m.unitName || m.type} (${m.quality} ${m.type}, ${m.cost ?? '?'}g) <span style="color:#701010;font-size:.72rem">[mercenary]</span>
        </label>`;
      });
      // ── Recruit destination ── self (default), a friendly character standing in this province
      // this phase, or (in a controlled province) straight into the garrison.
      const _destSaved =
        (target || '')
          .split(',')
          .map((t) => t.trim())
          .find((t) => t.startsWith('to:')) || 'to:self';
      const _destAllies = orderTargetCharsP(report, ph).filter(
        (x) => x.id !== c.id && (predictedLocation(x.id, ph)?.id ?? x.locationId) === (loc && loc.id),
      );
      const _destRow = (
        allowGarrison,
      ) => kcHtml`<div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;font-size:.75rem">
          <span style="color:var(--stone)">Muster to:</span>
          <select class="po-recruit-dest" onchange="updateRecruitTarget(${kcArg(String(c.id))},${kcArg(ph)})" style="flex:1;font-size:.75rem;padding:1px 3px">
            <option value="to:self" ${_destSaved === 'to:self' ? 'selected' : ''}>${c.name} (this character)</option>
            ${_destAllies.map((x) => kcHtml`<option value="to:${x.id}" ${_destSaved === 'to:' + x.id ? 'selected' : ''}>${x.name} (also here this phase${preOrderTagP(x)})</option>`)}
            ${allowGarrison ? kcHtml`<option value="to:garrison" ${_destSaved === 'to:garrison' ? 'selected' : ''}>Province garrison (defends ${loc ? loc.name : 'the province'})</option>` : ''}
          </select>
        </div>${allowGarrison ? kcHtml`<div style="font-size:.68rem;color:var(--stone);margin:-2px 0 4px;line-height:1.35">Garrison units always muster straight into the province garrison, whoever is named above.</div>` : ''}`;
      const mercWrap = (
        inner,
      ) => kcHtml`<div id="po-target-wrap-inner-${c.id}-${ph}" style="max-height:160px;overflow-y:auto;background:#fdf8ee;border:1px solid var(--stone);border-radius:2px;padding:4px">
        ${_destRow(false)}
        ${inner}
        <input type="hidden" id="po-target-${c.id}-${ph}" value="${target || ''}">
      </div>`;
      if (!pd || (!pd.canRecruit && !conditionalRecruit)) {
        // No native recruitment here — but if mercenaries are roaming the province, offer those.
        if (mercRows.length)
          return mercWrap(
            kcHtml`<div style="font-size:.68rem;color:#6a3030;margin-bottom:4px;line-height:1.35">Mercenaries can be hired anywhere. Native troops need control of the province.</div>${mercRows}`,
          );
        const why = !pd
          ? 'Province unknown'
          : (pd.armyTypes || []).length === 0
            ? `${loc.name} is not your territory — cannot recruit here`
            : `${loc.name} is not yours yet — move in with an army in an earlier phase to recruit here if you take control`;
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="${why}" disabled>`;
      }
      const alreadyRecruited = getAlreadyRecruitedThisTurn(c.id, ph);
      // Show the recruit list whenever the province has army types with capacity left this turn.
      // (Don't hard-block on current gold — gold can change across phases and affordability is
      // enforced when the turn resolves.
      const anyRecruitable = (pd.armyTypes || []).some(
        (at) => at.maxPerTurn - (alreadyRecruited[`${loc.id}:${at.type}`] || 0) > 0,
      );
      if (!anyRecruitable) {
        if (mercRows.length) return mercWrap(mercRows);
        const why =
          (pd.armyTypes || []).length === 0
            ? `No native recruitable armies in ${pd.name}`
            : `Already recruited the maximum in ${pd.name} this turn`;
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="${why}" disabled>`;
      }
      // Multi-select: use checkboxes rendered as a scrollable list
      const checkId = `po-recruit-${c.id}-${ph}`;
      const savedSels = (target || '').split(',').filter(Boolean);
      return kcHtml`<div id="po-target-wrap-inner-${c.id}-${ph}" style="max-height:160px;overflow-y:auto;background:#fdf8ee;border:1px solid var(--stone);border-radius:2px;padding:4px">
        ${conditionalRecruit ? kcHtml`<div style="font-size:.68rem;color:#6a3030;background:#f7ece0;border-radius:2px;padding:3px 5px;margin-bottom:4px;line-height:1.35">⚑ ${loc.name} is not yours yet — plan freely. This recruit only takes effect if you <strong>control the province</strong> when the order resolves (e.g. this character seizes it in an earlier phase); otherwise it is skipped.</div>` : ''}
        ${
          /* once you conquer a province earlier in the turn it is yours when the
 recruit resolves, so the garrison is a valid muster target — offer it here too. The engine
 re-checks ownership at resolution (prov.owner===player) before mustering into the garrison. */ ''
        }
        ${_destRow(true)}
        ${mercRows}
        ${(pd.armyTypes || []).flatMap((at) => {
          const done = alreadyRecruited[`${loc.id}:${at.type}`] || 0;
          const remaining = at.maxPerTurn - done;
          if (remaining <= 0) return [];
          const costEach = at.cost || 2;
          // 2026-09-07 batch 3: every checkbox is ONE unit, so every token is `type|1`. The old
          // `type|<slot>` values were read by the GM engine (and by projectedLedArmies) as a
          // QUANTITY —
          // ticking the 1st and 2nd garrison boxes sent `Garrison|1,Garrison|2` = three units. The k-th
          // box is checked when the saved order holds at least k tokens of this type (legacy
          // `type|n` tokens count as one each).
          const _savedOfType = savedSels.filter((v) => v.split('|')[0].trim() === at.type).length;
          return Array.from({ length: remaining }, (_, i) => {
            const val = `${at.type}|1`;
            const chk = _savedOfType > i ? 'checked' : '';
            return kcHtml`<label style="display:flex;align-items:center;gap:6px;padding:2px 4px;font-size:.8rem;cursor:pointer">
              <input type="checkbox" value="${val}" ${chk} onchange="updateRecruitTarget(${kcArg(String(c.id))},${kcArg(ph)})" style="width:auto;margin:0">
              1× ${at.type} (${costEach}g)${
                CREATURE_ARMIES_UI.has(at.type)
                  ? kcHtml` <span style="color:#1d5a1d;font-size:.72rem">[Creature]</span>`
                  : MONSTER_ARMIES_UI.has(at.type)
                    ? kcHtml` <span style="color:#701010;font-size:.72rem">[Monster]</span>`
                    : ''
              }
            </label>`;
          });
        })}
        <input type="hidden" id="po-target-${c.id}-${ph}" value="${target || ''}">
      </div>`;
    }

    // ── HIRE HERO ──
    case 'Hire Hero': {
      const loc = predictedLocation(c.id, ph);
      const pd = loc ? provOrderData[loc.id] : null;
      const heroes = pd?.availableHeroes || [];
      if (heroes.length === 0) {
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="${loc ? `No wandering heroes in ${loc.name}` : 'No heroes available'}" disabled>`;
      }
      const opts = heroes.map((h) => {
        // the hero's best skill is DESCRIBED, exactly as the Intelligence report describes it —
        // "legendary for Tactical" — never given as a bare level number.
        const topSkill = heroFameTextP(h);
        // Alignment-distance pricing: wage = 2g +1g per 2 spectrum steps between the hero's
        // alignment and YOUR KINGDOM's. Divine and Undead crowns cannot hire one another
        // (Diplomatic Protocols discovery waives the ban — the GM engine handles that at resolution).
        const kAlign = report.kingdom?.alignment || 'Neutral';
        const wage = heroHireWageOfP(h, report);
        if (wage == null)
          return kcHtml`<option value="" disabled>${h.name} (${h.race}/${h.alignment}) — will NOT serve a ${kAlign} crown</option>`;
        const d = alignDistPP(kAlign, h.alignment);
        const _base = heroHireWagePP(kAlign, h.alignment),
          _prem = _base != null && wage > _base ? wage - _base : 0;
        const costNote =
          (d <= 1 ? '(kindred outlook' : `(${d} steps from ${kAlign}`) +
          (_prem ? `, +${_prem}g for proven skill)` : d <= 1 ? ' — base rate)' : ')');
        return kcHtml`<option value="${h.id}" ${target == h.id ? 'selected' : ''}>${h.name} (${h.race}/${h.alignment}) — best: ${topSkill} — ${wage}g/turn ${costNote}</option>`;
      });
      // never let the browser silently pre-select the FIRST hero. If the saved target is not one of
      // the heroes listed here (e.g. an earlier-phase move was changed and this character's
      // predicted province — and its heroes — changed with it), show an explicit "choose"
      // placeholder so the player picks again rather than hiring someone they never chose.
      const _hasPick = heroes.some((h) => String(h.id) === String(target) && heroHireWageOfP(h, report) != null);
      const _ph = kcHtml`<option value="" ${_hasPick ? '' : 'selected'}>— choose a hero to hire —</option>`;
      return kcHtml`<select id="po-target-${c.id}-${ph}" onchange="syncHiredHeroCard(${kcArg(String(c.id))},${kcArg(ph)})">${_ph}${opts}</select>`;
    }

    // ── GIVE ITEM ──
    case 'Send Item':
    case 'Give Item': {
      // 2026-09-24 (Toby): the CHARMED-hero branch that used to live here — one engine-chosen item a
      // turn, recipient only, no list — is gone with the rule it served. A charmed hero sends nothing
      // at all now, so `actionsFor` no longer offers them Send Item and this case is unreachable for
      // them; the engine refuses it outright as well. Nothing else fell out of that branch: its
      // "already ordered in <season>" once-a-turn guard existed only for that one allowance.
      // Predicted item list: starts from the report, then applies every earlier phase's Give Item
      // orders — so an item HANDED TO this character in an earlier phase can be given onward here,
      // and an item already given away no longer appears. Indices match GM resolution order. hand
      // over MORE THAN ONE item at once — tick each item (or "All items") and choose a single
      // recipient. Item ticks write "all" or a comma-separated list of item indices to the hidden
      // po-target field (reusing the shared checkbox helpers).
      const items = predictedItems(c.id, ph);
      const startNames = new Set((c.items || []).map((it) => it && it.name));
      // 2026-09-24 (Toby): a HIRED hero reaches this branch (only _hiddenSkills takes the auto-pick
      // path above) with predictedItems → [], and the old text announced "none held" — a claim about a
      // pack the player has not seen. A charmed hero never gets here.
      if (items.length === 0)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="${skillsUnseenP(c) ? `What ${c.name} carries is not known to you until they have joined — you can only send on something you handed them yourself this turn` : 'No items to give (none held, or all given away earlier this turn)'}" disabled>`;
      // ── 2026-09-24 (Toby): ADDRESS BY NAME WHEN POSITION CANNOT BE TRUSTED ──────────────────────
      // The tick values are normally indices into the engine's own item list, which is only safe while
      // this form's list and the engine's `c.items` are the same list in the same order. For a hero
      // being HIRED they are not: `predictedItems` can only show what the player handed them this turn,
      // while at resolution that sits at the end of a real pack the player has never seen — so index 0
      // here is a different item there. Those cards tick item NAMES instead (the engine's give_item now
      // resolves an id-or-name token), and lose the "All items" box, which would otherwise sweep up the
      // hidden pack the player cannot see and never chose.
      const _giByName = skillsUnseenP(c);
      const _giSaved = (target || '').split(',').filter(Boolean);
      const _giAll = !_giByName && _giSaved.includes('all');
      const _giBoxes = items.map((it, i) => {
        // A granted Mithril suit is forged to its wearer and cannot be sent on. The row still has
        // to be RENDERED — when the tick values are indices into the engine's own item list — so it is
        // shown greyed and disabled rather than dropped, which would slide every later index by
        // one.
        const _bound = !!(it && it.effect && it.effect.stat === 'mithrilArmour');
        const _val = _giByName ? String(it.name || '') : String(i);
        const chk = !_bound && (_giAll || _giSaved.includes(_val)) ? 'checked' : '';
        return kcHtml`<label style="display:flex;align-items:center;gap:6px;padding:2px 4px;font-size:.8rem;cursor:${_bound ? 'not-allowed' : 'pointer'};${_bound ? 'opacity:.55' : ''}">
          <input type="checkbox" value="${_val}" ${chk} ${_bound ? 'disabled' : ''} onchange="updateLeaveTarget(${kcArg(String(c.id))},${kcArg(ph)})" style="width:auto;margin:0">
          🔮 ${it.name}${itemTierTagP(it)}${_bound ? kcHtml` <span style="color:var(--stone)">— bound to its wearer, cannot be sent</span>` : startNames.has(it.name) ? '' : ' (received earlier this turn)'}
        </label>`;
      });
      const _giWrap = kcHtml`<div style="background:#fdf8ee;border:1px solid var(--stone);border-radius:2px;padding:4px;max-height:120px;overflow-y:auto">
        ${
          _giByName
            ? kcHtml`<div style="font-size:.68rem;color:var(--stone);padding:2px 4px;border-bottom:1px solid var(--parchment-dark);margin-bottom:2px">Only what you handed ${c.name} this turn is listed — the rest of their pack is not yours to see, or to send on.</div>`
            : kcHtml`<label style="display:flex;align-items:center;gap:6px;padding:2px 4px;font-size:.8rem;cursor:pointer;border-bottom:1px solid var(--parchment-dark);margin-bottom:2px">
          <input type="checkbox" value="all" id="po-leave-all-${c.id}-${ph}" ${_giAll ? 'checked' : ''} onchange="leaveToggleAll(${kcArg(String(c.id))},${kcArg(ph)},this.checked)" style="width:auto;margin:0">
          <strong>All items (${items.length})</strong>
        </label>`
        }
        ${_giBoxes}
        <input type="hidden" id="po-target-${c.id}-${ph}" value="${target || ''}">
      </div>`;
      // Send Item can now reach ANY of your living characters, wherever they stand. A recipient in
      // the SAME province gets the item at once (usable later this turn); one ELSEWHERE receives it
      // at the END of the turn — a courier carries it — ready to use from next turn.
      const loc4 = predictedLocation(c.id, ph);
      // 2026-09-24 (Toby): a CHARMED hero is not a valid recipient — you may not hand items to a mind
      // you have merely borrowed. (`_hiddenSkills` is the charm placeholder; the engine refuses the
      // real hero as a recipient too, so a stale draft naming one cannot slip an item across.)
      const chars = orderTargetCharsP(report, ph).filter(
        (x) => x.id !== c.id && x.player === c.player && !x._hiddenSkills,
      );
      if (chars.length === 0)
        return kcHtml`${_giWrap}
        <input id="po-extra-${c.id}-${ph}" type="text" value="" placeholder="No other characters to send to" disabled>`;
      const recipOpts = chars.map((x) => {
        // 2026-09-24 (Toby): name the province each recipient is in at this phase (projected from
        // earlier-phase moves) instead of a bare "elsewhere".
        const _xl = predictedLocation(x.id, ph),
          _xn = (_xl && _xl.name) || 'unknown province';
        const _same = _xl?.id === loc4?.id;
        const _where = _same ? `here in ${_xn} — at once` : `in ${_xn} — arrives end of turn`;
        return kcHtml`<option value="${x.id}" ${extra == x.id ? 'selected' : ''}>${x.name} (${_where}${preOrderTagP(x)})</option>`;
      });
      return kcHtml`${_giWrap}
        <select id="po-extra-${c.id}-${ph}" style="margin-top:4px">${recipOpts}</select>`;
    }

    // ── LEAVE / TRANSFER ARMY ──
    case 'Leave/Transfer Army': {
      // the list of armies this character LEADS at this phase — projected from earlier-phase
      // Recruit / Pick Up (added) and Leave/Transfer / Disband (removed) orders, so an army handed
      // off or disbanded earlier no longer shows, and one gained earlier does.
      const baseArmies = projectedLedArmies(c.id, ph);
      const savedTgts = (target || '').split(',').filter(Boolean);
      // Where is this character predicted to be at this phase (accounting for earlier-phase moves)?
      const cLoc = predictedLocation(c.id, ph);
      const cLocId = cLoc ? cLoc.id : null;
      const ownedIds = new Set((report.ownedProvinces || []).map((p) => p.id));
      // Garrison recipient: allowed outright in a province you OWN now, and ALSO offered
      // CONDITIONALLY in a province you don't yet own — you may seize it earlier this turn. The GM
      // engine re-checks ownership (prov.owner===player) when the order resolves and simply skips
      // the garrison if you don't control the province by then (the troops stay under command).
      const ownsHere = cLocId != null && ownedIds.has(cLocId);
      const canGarrison = cLocId != null; // offer garrison wherever this character stands this phase
      // Recipients: only the player's OWN characters predicted to be in the SAME province this
      // phase.
      // (orderTargetCharsP drops anyone who fell — report.characters still carries a hero killed
      // this turn so the Chronicle can print their last section; neutral and enemy characters are
      // never in report.characters at all.)
      const othersHere = orderTargetCharsP(report, ph).filter((x) => {
        if (x.id === c.id) return false;
        const xl = predictedLocation(x.id, ph);
        return xl && cLocId != null && xl.id === cLocId;
      });
      const recipParts = [];
      if (canGarrison)
        recipParts.push(
          kcHtml`<option value="-1" ${extra === '-1' || !extra ? 'selected' : ''}>${ownsHere ? `Garrison in ${cLoc.name || 'province'}` : `Garrison in ${cLoc.name || 'province'} \u2691 (only if you control it when this resolves)`}</option>`,
        );
      othersHere.forEach((x) =>
        recipParts.push(
          kcHtml`<option value="${x.id}" ${extra == x.id ? 'selected' : ''}>${x.name}${preOrderTagP(x)}</option>`,
        ),
      );
      if (recipParts.length === 0)
        recipParts.push(
          kcHtml`<option value="" disabled selected>No valid recipient here — place another of your characters here first</option>`,
        );
      const recipOpts = recipParts;
      const allChk = savedTgts.includes('all') ? 'checked' : '';
      // ALWAYS offer an "All armies" option, even when the projected army list is empty. A
      // character may gain armies earlier in this SAME phase in ways the order form can't foresee
      // (e.g. a successful Skeletal Armies cast, Elemental Summon, Control Undead, or mercenary hire).
      // The GM resolves "all" against the character's ACTUAL armies at that phase, so it correctly
      // moves whatever they hold when the order fires — nothing if they gained none.
      if (baseArmies.length === 0) {
        return kcHtml`<div style="background:#fdf8ee;border:1px solid var(--stone);border-radius:2px;padding:4px">
          <div style="font-size:.68rem;color:#6a3030;margin-bottom:4px;line-height:1.35">No armies to leave right now, but you can still queue <strong>All armies</strong> in case this character gains a force earlier this phase (e.g. Skeletal Armies).</div>
          <label style="display:flex;align-items:center;gap:6px;padding:2px 4px;font-size:.8rem;cursor:pointer">
            <input type="checkbox" value="all" id="po-leave-all-${c.id}-${ph}" ${allChk} onchange="leaveToggleAll(${kcArg(String(c.id))},${kcArg(ph)},this.checked)" style="width:auto;margin:0">
            <strong>All armies</strong>
          </label>
          <input type="hidden" id="po-target-${c.id}-${ph}" value="${target || ''}">
        </div>
        <select id="po-extra-${c.id}-${ph}" style="margin-top:4px" onchange="setTimeout(refreshAllMoveModeNotes,0)">${recipOpts}</select>`;
      }
      const checkboxes = baseArmies.map((a, i) => {
        const val = a.unitName || a.type;
        const chk = savedTgts.includes(val) || savedTgts.includes('all') ? 'checked' : '';
        return kcHtml`<label style="display:flex;align-items:center;gap:6px;padding:2px 4px;font-size:.8rem;cursor:pointer">
          <input type="checkbox" value="${val}" ${chk} onchange="updateLeaveTarget(${kcArg(String(c.id))},${kcArg(ph)})" style="width:auto;margin:0">
          ${armyLabel(a)}
        </label>`;
      });
      return kcHtml`<div style="background:#fdf8ee;border:1px solid var(--stone);border-radius:2px;padding:4px;max-height:120px;overflow-y:auto">
        <label style="display:flex;align-items:center;gap:6px;padding:2px 4px;font-size:.8rem;cursor:pointer;border-bottom:1px solid var(--parchment-dark);margin-bottom:2px">
          <input type="checkbox" value="all" id="po-leave-all-${c.id}-${ph}" ${allChk} onchange="leaveToggleAll(${kcArg(String(c.id))},${kcArg(ph)},this.checked)" style="width:auto;margin:0">
          <strong>All armies</strong>
        </label>
        ${checkboxes}
        <input type="hidden" id="po-target-${c.id}-${ph}" value="${target || ''}">
      </div>
      <select id="po-extra-${c.id}-${ph}" style="margin-top:4px" onchange="setTimeout(refreshAllMoveModeNotes,0)">${recipOpts}</select>`;
    }

    // ── DISBAND ARMY ── ── RELEASE HERO ── dismiss this hero from your service; they become a
    // wandering hero (keeping every magic item they carry) and take no further orders this turn.
    // Refused if they lead any army at that phase — hand the troops off or disband them first.
    case 'Release Hero': {
      if (c.isKing)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="A king cannot release himself" disabled>`;
      const led = projectedLedArmies(c.id, ph);
      const warn = led.length
        ? kcHtml`<div style="font-size:.72rem;color:#a33;margin-top:2px">⚠ ${c.name} is still leading ${led.length} unit${led.length !== 1 ? 's' : ''} at this phase — the release will be refused unless they are handed off (Leave/Transfer Army) or disbanded in an earlier phase.</div>`
        : '';
      return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="Releases ${c.name} from your service — no wage from next turn" readonly>
        <div style="font-size:.72rem;color:var(--stone);margin-top:2px">${c.name} becomes a wandering hero, keeping their magic items, and cannot be re-hired this turn. Later phases' orders for them are dropped.</div>${warn}`;
    }
    case 'Disband Army': {
      // Item 7/11: the armies this character LEADS at this phase — including any PICKED UP or
      // RECRUITED earlier this turn, and minus any handed off or disbanded earlier this turn.
      const armies = projectedLedArmies(c.id, ph);
      if (armies.length === 0)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="No armies to disband" disabled>`;
      const savedTgts = (target || '').split(',').filter(Boolean);
      const checkboxes = armies.map((a, i) => {
        const val = a.unitName || a.type;
        const chk = savedTgts.includes(val) || savedTgts.includes('all') ? 'checked' : '';
        return kcHtml`<label style="display:flex;align-items:center;gap:6px;padding:2px 4px;font-size:.8rem;cursor:pointer">
          <input type="checkbox" value="${val}" ${chk} onchange="updateLeaveTarget(${kcArg(String(c.id))},${kcArg(ph)})" style="width:auto;margin:0">
          ${armyLabel(a)}
        </label>`;
      });
      const allChk = savedTgts.includes('all') ? 'checked' : '';
      return kcHtml`<div style="background:#fff0f0;border:1px solid #c84a4a;border-radius:2px;padding:4px">
        <div style="font-size:.72rem;color:#701010;margin-bottom:4px">⚠ Disbanded armies become wandering mercenaries — they may move away or retire (25% chance/turn).</div>
        <label style="display:flex;align-items:center;gap:6px;padding:2px 4px;font-size:.8rem;cursor:pointer;border-bottom:1px solid #f0c0c0;margin-bottom:2px">
          <input type="checkbox" value="all" id="po-leave-all-${c.id}-${ph}" ${allChk} onchange="leaveToggleAll(${kcArg(String(c.id))},${kcArg(ph)},this.checked)" style="width:auto;margin:0">
          <strong>All armies</strong>
        </label>
        ${checkboxes}
        <input type="hidden" id="po-target-${c.id}-${ph}" value="${target || ''}">
      </div>`;
    }

    // ── PICK UP ARMY ──
    case 'Pick Up Army': {
      // pick up unled GARRISON units the same way Leave/Transfer lists armies — tick "All", or tick
      // a selection. The hidden field carries "all" or a comma-separated list of garrison indices
      // (g:0,g:2,…). Reuses updateLeaveTarget / leaveToggleAll (shared checkbox helpers) via the
      // same po-leave-all-… id. Mercenaries are still hired through Recruit Armies; armies led by
      // another of your characters move via Leave/Transfer Army.
      const loc2 = predictedLocation(c.id, ph);
      // the garrison as it will stand at THIS phase — armies left to the garrison in an earlier
      // phase (or by another of your characters in this very phase) are now offered for pick-up.
      const garrArr = loc2 ? projectedGarrison(loc2.id, ph, true, c.id) : [];
      if (garrArr.length === 0)
        return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="" placeholder="No garrison armies here to pick up (hire mercenaries via Recruit Armies)" disabled>`;
      const savedTgts = (target || '').split(',').filter(Boolean);
      const allSel = savedTgts.includes('all');
      const checkboxes = garrArr.map((a, i) => {
        const val = `g:${i}`;
        const chk = allSel || savedTgts.includes(val) ? 'checked' : '';
        return kcHtml`<label style="display:flex;align-items:center;gap:6px;padding:2px 4px;font-size:.8rem;cursor:pointer">
          <input type="checkbox" value="${val}" ${chk} onchange="updateLeaveTarget(${kcArg(String(c.id))},${kcArg(ph)})" style="width:auto;margin:0">
          ${armyLabel(a)} — garrison
        </label>`;
      });
      return kcHtml`<div style="background:#fdf8ee;border:1px solid var(--stone);border-radius:2px;padding:4px;max-height:120px;overflow-y:auto">
        <label style="display:flex;align-items:center;gap:6px;padding:2px 4px;font-size:.8rem;cursor:pointer;border-bottom:1px solid var(--parchment-dark);margin-bottom:2px">
          <input type="checkbox" value="all" id="po-leave-all-${c.id}-${ph}" ${allSel ? 'checked' : ''} onchange="leaveToggleAll(${kcArg(String(c.id))},${kcArg(ph)},this.checked)" style="width:auto;margin:0">
          <strong>All garrison armies (${garrArr.length})</strong>
        </label>
        ${checkboxes}
        <input type="hidden" id="po-target-${c.id}-${ph}" value="${target || ''}">
      </div>`;
    }

    default:
      return kcHtml`<input id="po-target-${c.id}-${ph}" type="text" value="${target || ''}" placeholder="Details / notes">`;
  }
}

// Helper: update hidden leave target from checkboxes
function updateLeaveTarget(charId, ph) {
  const wrap = document.querySelector(`#po-target-${charId}-${ph}`)?.parentElement;
  if (!wrap) return;
  const allChk = document.getElementById(`po-leave-all-${charId}-${ph}`);
  if (allChk) allChk.checked = false; // deselect 'all' when individual checked
  const checked = [...wrap.querySelectorAll('input[type=checkbox]:not([value=all]):checked')].map((cb) => cb.value);
  const hidden = document.getElementById(`po-target-${charId}-${ph}`);
  if (hidden) hidden.value = checked.join(',');
  if (typeof refreshAllMoveModeNotes === 'function') setTimeout(refreshAllMoveModeNotes, 0); // the host a later move sets out with has changed
}
function leaveToggleAll(charId, ph, checked) {
  const wrap = document.querySelector(`#po-target-${charId}-${ph}`)?.parentElement;
  if (!wrap) return;
  wrap.querySelectorAll('input[type=checkbox]:not([value=all])').forEach((cb) => {
    cb.checked = false;
  });
  const hidden = document.getElementById(`po-target-${charId}-${ph}`);
  if (hidden) hidden.value = checked ? 'all' : '';
  if (typeof refreshAllMoveModeNotes === 'function') setTimeout(refreshAllMoveModeNotes, 0); // the host a later move sets out with has changed
}

// Helper: update hidden recruit target from checkboxes
function updateRecruitTarget(charId, ph) {
  const wrap = document.getElementById(`po-target-wrap-inner-${charId}-${ph}`);
  if (!wrap) return;
  const checked = [...wrap.querySelectorAll('input[type=checkbox]:checked')].map((cb) => cb.value);
  // Destination token: only written when a non-default destination is chosen.
  const destSel = wrap.querySelector('.po-recruit-dest');
  if (destSel && destSel.value && destSel.value !== 'to:self') checked.push(destSel.value);
  const hidden = document.getElementById(`po-target-${charId}-${ph}`);
  if (hidden) hidden.value = checked.join(',');
  if (typeof refreshAllMoveModeNotes === 'function') setTimeout(refreshAllMoveModeNotes, 0); // recruits change what a later move has to carry
}
