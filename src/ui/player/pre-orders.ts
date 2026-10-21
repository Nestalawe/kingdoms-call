// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { KC_SEASONS } from '../../content/kingdoms-call-data.ts';
import { skillFameLabelM } from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { L79_ORDERS } from './l79-orders.ts';
import { SEASONS, _pendingDiscChoices, actionsFor } from './items-and-heroes.ts';
import { refreshLaterCastSpells } from './order-chances.ts';
import {
  DUEL_STANCES,
  ENCOUNTER_TACTICS,
  HEIR_TEMPERS_LIST,
  SKILL_LABELS,
  heirAddedTo,
  heirPointsRemaining,
  heirTotalAdded,
  refreshAllMoveModeNotes,
  refreshMoveModeNote,
} from './move-analysis.ts';
import { buildOrdersForm, refreshEncounterPlan, renderPreSchool } from './orders-form.ts';
import { doSaveOrders, doSubmitOrders, restoreSubmitWrap } from './briefing-and-submit.ts';
import { heroHireWageOfP } from './skills-and-projections.ts';
import { buildTargetField, predictedLocation, refreshExploreNotes } from './order-targets.ts';
import { leadsArmiesP, provLinkHtml } from './map-symbols.ts';

// ── ONCE-PER-TURN ORDERS (2026-09-24, Toby) ── The engine refuses a second use in one turn of any
// L7/L9 mastery order (GM MASTERY_ORDER_KEYS — exactly the L79_ORDERS set) and of Call to Arms. Once a
// character has one of them in a phase, every LATER phase's action dropdown stops offering it. Each
// select remembers its full option list (data-all-opts) so an option comes back the moment the earlier
// phase is changed; a later phase already holding the order is cleared (with a note) rather than
// left to be refused at resolution.
export const ONCE_PER_TURN_ACTIONS = new Set([...Object.keys(L79_ORDERS), 'Call to Arms']);
export function refreshOncePerTurnOptions(charId) {
  const taken = new Set();
  for (let ph = 0; ph < 5; ph++) {
    const sel = document.getElementById(`po-action-${charId}-${ph}`);
    if (!sel) continue;
    if (!sel.dataset.allOpts)
      sel.dataset.allOpts = JSON.stringify([...sel.options].map((o) => o.value).filter(Boolean));
    const all = JSON.parse(sel.dataset.allOpts);
    const want = all.filter((a) => !taken.has(a));
    const have = [...sel.options].map((o) => o.value).filter(Boolean);
    let cur = sel.value,
      cleared = false;
    if (cur && taken.has(cur)) {
      cleared = cur;
      cur = '';
    }
    if (want.join('|') !== have.join('|')) {
      const blank = sel.options[0] && !sel.options[0].value ? sel.options[0].textContent : '\u2014 Choose \u2014';
      sel.innerHTML = kcHtml`<option value="">${blank}</option>${want.map((a) => kcHtml`<option value="${a}">${a}</option>`)}`;
      sel.value = cur;
    }
    if (cleared) {
      const wrap = document.getElementById(`po-target-wrap-${charId}-${ph}`);
      const ch = (currentReport?.characters || []).find((c) => String(c.id) === String(charId));
      if (wrap) {
        try {
          wrap.innerHTML = kcHtml`${ch ? buildTargetField(ch, ph, { action: '' }) : ''}<div style="font-size:.72rem;color:#8a2a2a;margin-top:3px">${cleared} can be ordered only once a turn and is already set in an earlier phase \u2014 choose another action here.</div>`;
        } catch (_) {}
      }
    }
    if (ONCE_PER_TURN_ACTIONS.has(sel.value)) taken.add(sel.value);
  }
}
export function refreshAllOncePerTurn() {
  const ids = new Set(
    [...document.querySelectorAll('select[id^="po-action-"]')].map((el) =>
      el.id.replace(/^po-action-/, '').replace(/-\d+$/, ''),
    ),
  );
  ids.forEach((id) => {
    try {
      refreshOncePerTurnOptions(id);
    } catch (_) {}
  });
}
export function onActionChange(charId, ph, charIdx) {
  const action = document.getElementById(`po-action-${charId}-${ph}`)?.value;
  const wrap = document.getElementById(`po-target-wrap-${charId}-${ph}`);
  if (!wrap) return;
  const char =
    (currentReport?.characters || []).find((c) => String(c.id) === String(charId)) ||
    (currentReport?.characters || [])[charIdx] ||
    {};
  const saved = { action };
  wrap.innerHTML = buildTargetField(char, ph, saved);
  refreshOncePerTurnOptions(charId); // 2026-09-24: once-per-turn orders leave later phases' dropdowns
  refreshLaterCastSpells(charId, ph); // 2026-10-13: a Practice or Cast here changes later casts' limits
  setTimeout(refreshExploreNotes, 0); // earlier/later Explore projections depend on every order
  setTimeout(refreshAllMoveModeNotes, 0); // …and so does every Move order's land/naval/flying notice

  // Sync the hired-hero future-order card. syncHiredHeroCard injects it when this is a Hire Hero
  // order with a hero selected, and tears it down (and unregisters the placeholder) the moment the
  // action moves to anything else — so the prospective hero's order window can't linger after the
  // player changes their mind.
  setTimeout(() => syncHiredHeroCard(charId, ph), 100);
  // Likewise for Resurrect — and this also tears the card down when the action moves away from Cast
  // Spell, so a stale card can't survive and be submitted.
  setTimeout(() => syncResurrectCard(charId, ph), 100);
  // Likewise for Charm — pops an order window for a charmed wandering hero (they join your
  // service), and tears it down when the action or spell moves away.
  setTimeout(() => syncCharmCard(charId, ph), 100);
}

// when a Move order is (re)picked, every LATER phase's starting province may change, so re-render
// this character's later MOVE orders — their direction dropdowns relabel to the new predicted path
// — and flag each later move with an "update me" note so the player re-checks it. Re-picking a
// flagged later move clears its own note and cascades to the moves after it.
export function onMoveEdited(charId, ph) {
  const char = (currentReport?.characters || []).find((c) => String(c.id) === String(charId));
  if (!char) return;
  setTimeout(refreshExploreNotes, 0); // a changed path moves where later Explore orders land
  setTimeout(refreshAllMoveModeNotes, 0); // …and changes which province each later move sets out for
  refreshMoveModeNote(charId, ph); // land / naval / flying notice for the newly chosen destination
  // The player just addressed THIS move — clear its own flag.
  const ownNote = document.getElementById(`po-move-note-${charId}-${ph}`);
  if (ownNote) {
    ownNote.style.display = 'none';
    ownNote.innerHTML = '';
  }
  for (let later = ph + 1; later <= 4; later++) {
    const laterAction = document.getElementById(`po-action-${charId}-${later}`)?.value || '';
    // a later FORCED MARCH sets out from the changed province too — its move_adjacent dropdown is
    // built from predictedLocation, so it goes stale exactly as a Move does. Rebuild with the
    // order's OWN action, not a hardcoded 'Move', or a Forced March would be handed the plain move
    // field.
    if (laterAction !== 'Move' && laterAction !== 'Forced March') continue; // scoped to move orders
    const wrap = document.getElementById(`po-target-wrap-${charId}-${later}`);
    if (!wrap) continue;
    const savedT = getOrderTarget(charId, later);
    wrap.innerHTML = buildTargetField(char, later, { action: laterAction, target: savedT });
    if (savedT) {
      const note = document.getElementById(`po-move-note-${charId}-${later}`);
      if (note) {
        note.style.display = 'block';
        note.innerHTML =
          '⚠ <strong>Update me</strong> — an earlier move changed, so this order now sets out from a different province. Re-check its direction.';
      }
    }
  }
}

// ── PRE-ORDER CARD REBUILD ────
// The hired-hero and charm cards are injected by an onchange handler and live ONLY in the DOM.
// buildOrdersForm rebuilt the resurrect cards from the saved draft but not these two, so every
// re-render of the orders form (a page reload, Revise Orders, an heir skill allocation) silently
// dropped them: the Hire Hero order itself was restored from the draft, the hero's own orders were
// not, and the next submit sent the hire with no orders behind it. The hero then joined in Spring
// and idled the rest of the turn, with nothing in their Chronicle after the hire line.
// _fillSyntheticOrderCard pours a saved order set back into a freshly injected card, exactly as
// _fillResurrectCard does for a resurrect card.
export function _fillSyntheticOrderCard(fakeId, savedPhases, savedEP) {
  const fake = ((currentReport && currentReport.characters) || []).find((c) => String(c.id) === String(fakeId));
  if (!fake) return;
  const first = (fake.hiredInPhase ?? -1) + 1;
  for (let p = first; p < 5; p++) {
    const o = (savedPhases || [])[p];
    if (!o || !o.action) continue;
    const sel = document.getElementById(`po-action-${fakeId}-${p}`);
    if (!sel || ![...sel.options].some((x) => x.value === o.action)) continue;
    sel.value = o.action;
    const wrap = document.getElementById(`po-target-wrap-${fakeId}-${p}`);
    if (wrap) {
      try {
        wrap.innerHTML = buildTargetField(fake, p, { action: o.action, target: o.target || '', extra: o.extra || '' });
      } catch (_) {}
    }
  }
  try {
    refreshOncePerTurnOptions(fakeId);
  } catch (_) {} // 2026-09-24
  if (!savedEP) return;
  const allTac = (savedEP.tactics || []).map(String);
  const tac = allTac.filter((t) => !t.toUpperCase().startsWith('CS:'));
  const cs = allTac.find((t) => t.toUpperCase().startsWith('CS:'));
  const h = document.getElementById(`ep-tactics-${fakeId}`);
  if (h && tac.length) {
    h.value = tac.join(',');
    try {
      refreshEncounterPlan(fakeId, tac);
    } catch (_) {}
  }
  if (cs) {
    const pre = document.getElementById(`ep-preschool-${fakeId}`);
    if (pre) {
      pre.value = cs.slice(3).toLowerCase();
      try {
        renderPreSchool(fakeId);
      } catch (_) {}
    }
  }
  const n = document.getElementById(`ep-notes-${fakeId}`);
  if (n) n.value = savedEP.notes || '';
  const d = document.getElementById(`ep-duel-${fakeId}`);
  if (d && savedEP.duelStance) d.value = savedEP.duelStance;
}
// Walk every rendered order row and re-inject whichever hired-hero / charm cards the restored form
// calls for, filling each from the draft. Repeated a few times so a NESTED hire (a hero hired this
// turn who himself hires another) gets his own card once his card exists to be read from.
export function syncAllPreOrderCards(savedOrders, savedEncounterPlans) {
  savedOrders = savedOrders || {};
  savedEncounterPlans = savedEncounterPlans || {};
  const SEL = '[id^="hired-hero-orders-"],[id^="charm-orders-"]';
  for (let round = 0; round < 3; round++) {
    const before = document.querySelectorAll(SEL).length;
    const ids = [
      ...new Set(
        [...document.querySelectorAll('select[id^="po-action-"]')].map((el) =>
          el.id.replace(/^po-action-/, '').replace(/-\d+$/, ''),
        ),
      ),
    ];
    ids.forEach((cid) => {
      for (let ph = 0; ph < 5; ph++) {
        [
          ['hired-hero-orders', syncHiredHeroCard],
          ['charm-orders', syncCharmCard],
        ].forEach(([prefix, fn]) => {
          const cardId = `${prefix}-${cid}-${ph}`;
          if (document.getElementById(cardId)) return; // already rebuilt this round
          try {
            fn(cid, ph);
          } catch (_) {
            return;
          }
          const card = document.getElementById(cardId);
          const fid = card && card.getAttribute('data-fakeid');
          if (fid) _fillSyntheticOrderCard(fid, savedOrders[fid], savedEncounterPlans[fid]);
        });
      }
    });
    if (document.querySelectorAll(SEL).length === before) break;
  }
}

// Inject the hired-hero card when Hire Hero is selected with a target; otherwise remove it and
// unregister its placeholder character. Mirrors syncResurrectCard. the Neutral king's Broker action
// ALSO hires a hero (a remote hire, target 'hire:<id>'), so it must pop the same future-orders
// window. A Broker 'spy:<provId>' target is not a hire and gets no card.
export function syncHiredHeroCard(charId, ph) {
  const containerId = `hired-hero-orders-${charId}-${ph}`;
  const existing = document.getElementById(containerId);
  const action = document.getElementById(`po-action-${charId}-${ph}`)?.value || '';
  const rawTarget = getOrderTarget(charId, ph);
  const isHire = action === 'Hire Hero' && rawTarget;
  const isBrokerHire = action === 'Broker' && typeof rawTarget === 'string' && rawTarget.startsWith('hire:');
  const wanted = isHire || isBrokerHire;
  if (!wanted) {
    if (existing) {
      const stale = existing.getAttribute('data-fakeid');
      if (stale && currentReport)
        currentReport.characters = (currentReport.characters || []).filter((c) => c.id !== stale);
      existing.remove();
    }
    return;
  }
  injectHiredHeroOrders(charId, ph, 99);
}

// ── RESURRECTION PRE-ORDERS ────
// A hero raised by Resurrect in phase PH is alive and under your command for phases PH+1..4, and
// the engine will act on orders for them (actingThisPhase() tests c.alive at the time each phase
// runs, not at the start of the turn). Until now there was no way to WRITE those orders: the form
// only ever renders characters with alive!==false, so a raised hero idled away the rest of the
// turn. This mirrors the hired-hero card exactly, including the synthetic id, which the GM engine
// parses.
//
// The id encodes the caster and the cast phase because a corpse can be targeted by more than one
// player in the same turn. The GM holds these as PENDING orders and only honours them inside a
// SUCCESSFUL white_resurrect cast by this caster, so losing the race to raise a body cannot hand
// you control of a hero someone else raised. 2026-09-12: ONE order card per fallen hero. Now every
// Resurrect order on a body (any caster, any phase) shares a single card, anchored under the
// earliest caster; the GM applies it whichever of your casters actually raises the hero. The card
// is also rebuilt when a saved draft is reopened.
export function syncResurrectCard(charId, ph) {
  syncAllResurrectCards();
}
export function _resurrectCastersByHero() {
  const out = {};
  const chars = (currentReport && currentReport.characters) || [];
  chars.forEach((c) => {
    if (!c || c.alive === false || !/^\d+$/.test(String(c.id))) return;
    for (let ph = 0; ph < 5; ph++) {
      if ((document.getElementById(`po-action-${c.id}-${ph}`)?.value || '') !== 'Cast Spell') continue;
      if (getOrderTarget(c.id, ph) !== 'Resurrect') continue;
      const hid = String(document.getElementById(`po-extra-${c.id}-${ph}`)?.value || '');
      if (!/^\d+$/.test(hid)) continue;
      (out[hid] = out[hid] || []).push({ charId: String(c.id), ph, name: c.name });
    }
  });
  Object.values(out).forEach((list) => list.sort((x, y) => x.ph - y.ph));
  return out;
}
export function _readResurrectCardOrders(fakeId) {
  return {
    phases: [0, 1, 2, 3, 4].map((p) => ({
      action: document.getElementById(`po-action-${fakeId}-${p}`)?.value || '',
      target: getOrderTarget(fakeId, p),
      extra: getOrderExtra(fakeId, p),
    })),
    tactics: document.getElementById(`ep-tactics-${fakeId}`)?.value || '',
    notes: document.getElementById(`ep-notes-${fakeId}`)?.value || '',
    duel: document.getElementById(`ep-duel-${fakeId}`)?.value || '',
  };
}
export function _teardownResurrectCard(card) {
  const stale = card.getAttribute('data-fakeid');
  if (stale && currentReport) currentReport.characters = (currentReport.characters || []).filter((c) => c.id !== stale);
  card.remove();
}
export function _fillResurrectCard(fakeId, saved) {
  const fake = ((currentReport && currentReport.characters) || []).find((c) => c.id === fakeId);
  if (!fake || !saved) return;
  const first = (fake.hiredInPhase ?? -1) + 1;
  for (let p = first; p < 5; p++) {
    const o = (saved.phases || [])[p];
    if (!o || !o.action) continue;
    const sel = document.getElementById(`po-action-${fakeId}-${p}`);
    if (!sel || ![...sel.options].some((x) => x.value === o.action)) continue;
    sel.value = o.action;
    const wrap = document.getElementById(`po-target-wrap-${fakeId}-${p}`);
    if (wrap) {
      try {
        wrap.innerHTML = buildTargetField(fake, p, { action: o.action, target: o.target || '', extra: o.extra || '' });
      } catch (_) {}
    }
  }
  if (saved.tactics) {
    const h = document.getElementById(`ep-tactics-${fakeId}`);
    if (h) {
      h.value = saved.tactics;
      try {
        refreshEncounterPlan(fakeId, saved.tactics.split(',').filter(Boolean));
      } catch (_) {}
    }
  }
  if (saved.notes) {
    const n = document.getElementById(`ep-notes-${fakeId}`);
    if (n) n.value = saved.notes;
  }
  if (saved.duel) {
    const d = document.getElementById(`ep-duel-${fakeId}`);
    if (d) d.value = saved.duel;
  }
}
export function _setResurrectCasterNote(card, casters) {
  const el = card.querySelector('.resurrect-casters');
  if (!el) return;
  const SEASONS_R = KC_SEASONS.slice();
  const who = casters.map((x) => `${x.name} (${SEASONS_R[x.ph] || '?'})`);
  el.textContent =
    casters.length > 1
      ? `Raised by any of: ${who.join(', ')} — whichever succeeds, these orders apply.`
      : `Raised by ${who[0]}.`;
}
// savedByHero: { heroId: {phases, tactics, notes, duel} } — orders to pour into a card as it is
// (re)built.
export function syncAllResurrectCards(savedByHero) {
  savedByHero = savedByHero || {};
  // clear last pass's "no orders to give" notes — injectResurrectOrders rebuilds whichever are
  // still wanted. They carry no orders, so nothing is lost by dropping them.
  document.querySelectorAll('[id^="resurrect-note-"]').forEach((n) => n.remove());
  const groups = _resurrectCastersByHero();
  const kept = {};
  document.querySelectorAll('[id^="resurrect-orders-"]').forEach((card) => {
    const hid = card.getAttribute('data-heroid');
    const g = hid ? groups[hid] : null;
    if (!g || kept[hid]) {
      _teardownResurrectCard(card);
      return;
    }
    if (card.getAttribute('data-firstph') !== String(g[0].ph) || card.getAttribute('data-anchor') !== g[0].charId) {
      // The earliest caster changed — rebuild in the right place with the right phases, carrying
      // the orders over.
      if (!savedByHero[hid]) savedByHero[hid] = _readResurrectCardOrders(card.getAttribute('data-fakeid'));
      _teardownResurrectCard(card);
      return;
    }
    kept[hid] = card;
    _setResurrectCasterNote(card, g);
  });
  // Placeholders whose card is gone (e.g. the form was rebuilt) must not linger in the character
  // list.
  if (currentReport) {
    const live = new Set(
      [...document.querySelectorAll('[id^="resurrect-orders-"]')].map((c) => c.getAttribute('data-fakeid')),
    );
    currentReport.characters = (currentReport.characters || []).filter(
      (c) => !(typeof c.id === 'string' && c.id.startsWith('resurrect_') && !live.has(c.id)),
    );
  }
  Object.entries(groups).forEach(([hid, g]) => {
    if (kept[hid]) return;
    const card = injectResurrectOrders(g[0].charId, g[0].ph, hid, g);
    if (card && savedByHero[hid]) _fillResurrectCard(card.getAttribute('data-fakeid'), savedByHero[hid]);
  });
}

export function injectResurrectOrders(charId, ph, heroId, casters) {
  const report = currentReport || {};
  // The GM's id grammar is resurrect_<heroId>_via_<casterId>_ph<N>, all numeric (a caster hired
  // this same turn has a synthetic id and cannot anchor a card — rare, and the cast still resolves;
  // the raised hero simply defends).
  if (!/^\d+$/.test(String(charId)) || !/^\d+$/.test(String(heroId))) return null;
  const dead = (report.knownDeadHeroes || report.deadHeroes || []).find((x) => String(x.id) === String(heroId));
  if (!dead) return null;
  const firstActable = ph + 1;
  const containerId = `resurrect-orders-${heroId}`;
  document.getElementById(containerId)?.remove();
  const casterBlock = document.getElementById(`po-action-${charId}-0`)?.closest('.orders-char-block');
  if (!casterBlock) return null;
  // a hero raised in EARLY WINTER has no phase left to act in this turn, so there is nothing to
  // pre-order — the card was correct to be absent, but it vanished SILENTLY, which read as a
  // missing form beside the Late Summer and Fall cards. Say so instead. The note deliberately uses
  // a DIFFERENT id prefix (resurrect-note-) so no card selector, order collector or placeholder
  // sweep ever picks it up; syncAllResurrectCards clears the notes itself each rebuild.
  if (firstActable > 4) {
    const note = document.createElement('div');
    note.id = `resurrect-note-${heroId}`;
    note.className = 'orders-char-block';
    note.style.cssText = 'border:2px dashed #b9a7c9;opacity:0.85;margin-top:8px';
    note.innerHTML = kcHtml`
      <div class="orders-char-head" style="background:#f5eeff;color:#2e2e2e">
        \u2728 ${dead.name}
        <span style="color:#46275f;font-size:.7rem;margin-left:6px">(raised in Early Winter \u2014 no orders to give)</span>
      </div>
      <div style="padding:6px 10px 8px;background:#f5eeff;font-size:.76rem;line-height:1.6;color:#46275f">
        Early Winter is the last phase of the turn, so ${dead.name} returns with no phase left in which to act.
        There are no orders to pre-write. If the cast succeeds they stand in your caster's province at full
        health, stripped of items and armies, and take your orders normally from Spring next turn.
      </div>`;
    casterBlock.after(note);
    return null;
  }

  const SEASONS_R = KC_SEASONS.slice();
  const fakeId = `resurrect_${heroId}_via_${charId}_ph${ph}`;
  // A raised hero returns at full health, STRIPPED of items and armies, where the body lies — i.e.
  // where the caster stands when Resurrect resolves — so their order options (Recruit Armies,
  // Search Lair…) populate from there.
  const _casterLoc = predictedLocation(charId, ph);
  const fakeChar = {
    id: fakeId,
    name: dead.name,
    isKing: false,
    race: dead.race || 'Unknown',
    alignment: dead.alignment || 'Neutral',
    temper: dead.temper || 'Brave',
    skills: dead.skills || {},
    armies: [],
    items: [],
    pay: 1,
    locationId: dead.locationId != null ? dead.locationId : _casterLoc ? _casterLoc.id : null,
    locationName: _casterLoc && _casterLoc.name ? _casterLoc.name : dead.locationName || '(raised where they fell)',
    effectiveSpeed: 5,
    effectiveSeaSpeed: 0,
    hiredInPhase: ph,
    encounterPlan: { tactics: ['ME'], notes: '' },
    hp: null,
    maxHp: null,
  };
  if (currentReport) {
    currentReport.characters = (currentReport.characters || []).filter(
      (c) => !(typeof c.id === 'string' && c.id.startsWith(`resurrect_${heroId}_via_`)),
    );
    currentReport.characters.push(fakeChar);
  }

  const card = document.createElement('div');
  card.id = containerId;
  card.setAttribute('data-fakeid', fakeId);
  card.setAttribute('data-heroid', String(heroId));
  card.setAttribute('data-anchor', String(charId));
  card.setAttribute('data-firstph', String(ph));
  card.className = 'orders-char-block';
  card.style.cssText = 'border:2px dashed #5a3a7a;opacity:0.9;margin-top:8px';
  card.innerHTML = kcHtml`
    <div class="orders-char-head" style="background:#f5eeff;color:#2e2e2e">
      <button type="button" class="sec-toggle" aria-expanded="true" title="Minimise / maximise" onclick="toggleSection(this)">&#9662;</button>
      \u2728 ${dead.name}
      <span style="color:#46275f;font-size:.7rem;margin-left:6px">(if raised \u2014 can act from ${SEASONS_R[firstActable] || 'next turn'})</span>
      <span style="margin-left:auto;font-size:.7rem;color:#231e16">📍 ${provLinkHtml(fakeChar.locationId, fakeChar.locationName || '?')} · Land: 5/turn · Sea: 5/turn</span>
    </div>
    <div style="padding:5px 10px 6px;background:#f5eeff;border-bottom:1px solid var(--parchment-dark);font-size:.76rem;line-height:1.6">
      <div class="resurrect-casters" style="color:#46275f;font-weight:600"></div>
      <div style="color:#46275f">These orders only take effect if one of your Resurrect casts succeeds. If every cast
      fails, or another realm raises ${dead.name} first, they are simply ignored. A phase before the hero is actually raised is skipped.</div>
      <div style="color:var(--stone);margin-top:2px">Returns at full health, stripped of all items and armies.</div>
    </div>
    <div class="orders-char-body"></div>`;
  casterBlock.after(card);
  _setResurrectCasterNote(
    card,
    casters && casters.length
      ? casters
      : [
          {
            charId: String(charId),
            ph,
            name: ((report.characters || []).find((x) => String(x.id) === String(charId)) || {}).name || 'your caster',
          },
        ],
  );

  const body = card.querySelector('.orders-char-body');
  SEASONS_R.forEach((season, phIdx) => {
    const row = document.createElement('div');
    row.className = 'phase-order';
    if (phIdx < firstActable) {
      row.style.cssText = 'opacity:.35;pointer-events:none';
      row.innerHTML = kcHtml`<div class="phase-label">${season}</div>
        <div style="font-size:.76rem;color:var(--stone);font-style:italic;grid-column:2/-1">(still dead)</div>`;
    } else {
      row.innerHTML = kcHtml`
        <div class="phase-label">${season}</div>
        <select id="po-action-${fakeId}-${phIdx}" onchange="onActionChange(${kcArg(String(fakeId))},${kcArg(phIdx)},99)">
          <option value="">\u2014 Choose \u2014</option>
          ${actionsFor(fakeChar).map((a) => kcHtml`<option value="${a}">${a}</option>`)}
        </select>
        <div id="po-target-wrap-${fakeId}-${phIdx}">
          <input id="po-target-${fakeId}-${phIdx}" type="text" placeholder="Details">
        </div>`;
    }
    body.appendChild(row);
  });

  const epDiv = document.createElement('div');
  epDiv.style.cssText = 'padding:10px;border-top:1px solid var(--parchment-dark);background:#faf6ff';
  epDiv.innerHTML = kcHtml`
    <div style="font-family:Cinzel,serif;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">\u2694 Encounter Plan</div>
    <div id="ep-list-${fakeId}" style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px">
      <div style="font-size:.8rem;padding:4px 8px;background:#faf6ff;border:1px solid var(--stone);border-radius:2px">ME \u2014 Melee</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${ENCOUNTER_TACTICS.filter((t) => t.code !== 'CS' && !t.retired).map(
        (t) => kcHtml`<button onclick="addEncounterTactic(${kcArg(String(fakeId))},${kcArg(String(t.code))})"
        style="font-size:.7rem;padding:3px 8px;border:1px solid var(--stone);background:var(--parchment-dark);cursor:pointer;border-radius:2px"
        title="${t.label}">+ ${t.code}</button>`,
      )}
    </div>
    <input type="hidden" id="ep-tactics-${fakeId}" value="ME">
    <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cdb8e0">
      <div style="font-family:'Cinzel',serif;font-size:.68rem;color:#46275f;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">\u{1F93A} Duel stance</div>
      <select id="ep-duel-${fakeId}" style="font-size:.8rem;width:100%">
        ${DUEL_STANCES.map((d) => kcHtml`<option value="${d.code}"${d.code === 'refuse' ? ' selected' : ''}>${d.label}</option>`)}
      </select>
    </div>
    <input type="hidden" id="ep-preschool-${fakeId}" value="">
    <div style="margin-top:6px">
      <label style="font-size:.72rem">Describe their battlecry:</label>
      <input type="text" id="ep-notes-${fakeId}" placeholder="e.g. Death held me only briefly." style="font-size:.8rem;margin-top:2px">
    </div>`;
  card.appendChild(epDiv);
  return card;
}

// ── CHARM PRE-ORDERS ────
// Charming a WANDERING hero brings them into your service for the rest of the game (exactly like a
// hire — see psychic_charm), so from the phase after the cast they act on YOUR orders. This card
// lets you pre-write those orders, mirroring the resurrect card: a synthetic id the GM parses and
// holds PENDING until the Charm actually lands, so a failed cast (or a rival charming the hero
// first) simply drops them. Only offered for a wandering target; commanding an ENEMY hero is not
// modelled.
export function syncCharmCard(charId, ph) {
  const containerId = `charm-orders-${charId}-${ph}`;
  const existing = document.getElementById(containerId);
  const action = document.getElementById(`po-action-${charId}-${ph}`)?.value || '';
  const spell = getOrderTarget(charId, ph);
  const heroId = document.getElementById(`po-extra-${charId}-${ph}`)?.value || '';
  const report = currentReport || {};
  const tgt = (report.visibleChars || []).find((x) => String(x.id) === String(heroId));
  // A charm target is any non-king hero leading NO armies — wandering (joins you) or an enemy
  // (their command is seized for the rest of the turn). Either way you write their orders here.
  const wanted = action === 'Cast Spell' && spell === 'Charm' && heroId && tgt && !tgt.isKing && !leadsArmiesP(tgt);
  if (!wanted) {
    if (existing) {
      const stale = existing.getAttribute('data-fakeid');
      if (stale && currentReport)
        currentReport.characters = (currentReport.characters || []).filter((c) => c.id !== stale);
      existing.remove();
    }
    return;
  }
  injectCharmOrders(charId, ph, heroId, containerId);
}

export function injectCharmOrders(charId, ph, heroId, containerId) {
  const report = currentReport || {};
  // The GM id grammar is charm_<heroId>_via_<casterId>_ph<N>, all numeric — a caster who is
  // themselves a synthetic (hired/raised/charmed) hero this same turn can't anchor a charm
  // pre-order chain.
  if (!/^\d+$/.test(String(charId)) || !/^\d+$/.test(String(heroId))) return;
  const wanderer = (report.visibleChars || []).find(
    (x) => String(x.id) === String(heroId) && !x.isKing && !leadsArmiesP(x),
  );
  if (!wanderer) return;
  const isEnemy = wanderer.player != null; // enemy → command seized for the turn; else → joins you

  const firstActable = ph + 1;
  if (firstActable > 4) return; // charmed in Early Winter — no phases left to act in

  document.getElementById(containerId)?.remove();
  const casterBlock = document.getElementById(`po-action-${charId}-0`)?.closest('.orders-char-block');
  if (!casterBlock) return;

  const SEASONS_C = KC_SEASONS.slice();
  const fakeId = `charm_${heroId}_via_${charId}_ph${ph}`;

  // Register a placeholder so buildTargetField/onActionChange can resolve this id. A charmed
  // wanderer keeps whatever they command, but the order form only needs their skills/location to
  // populate; the engine applies their real armies at resolution. armies:[] keeps the card in step
  // with the hired/resurrect cards (order ENTRY, not a claim about their host).
  const fakeChar = {
    id: fakeId,
    name: wanderer.name,
    isKing: false,
    race: wanderer.race || 'Unknown',
    alignment: wanderer.alignment || 'Neutral',
    temper: wanderer.temper || 'Brave',
    // the charmer does not see the charmed hero's skills or items. skills stays empty and
    // _hiddenSkills tells the order fields to list choices without levels; Send Item is not offered
    // at all.
    skills: {},
    _hiddenSkills: true,
    armies: [],
    items: [],
    pay: wanderer.pay || 1,
    // only a seized ENEMY hero is restricted; a charmed wanderer joins freely.
    _charmEnemy: isEnemy,
    locationId: wanderer.locationId != null ? wanderer.locationId : null,
    locationName: wanderer.locationName || '(in your province)',
    effectiveSpeed: 5,
    effectiveSeaSpeed: 0,
    hiredInPhase: ph,
    encounterPlan: { tactics: ['ME'], notes: '' },
    hp: wanderer.hp != null ? wanderer.hp : null,
    maxHp: wanderer.maxHp != null ? wanderer.maxHp : null,
  };
  if (currentReport) {
    // Remove ANY charm placeholder previously registered for THIS slot (same caster + phase), not
    // merely the same hero — swapping the charm target within a phase would otherwise orphan the
    // old hero's placeholder (no card, but still registered), which submit-time validation then
    // flags as a phase with no action. The card element is slot-keyed (containerId), so only the
    // character registration needs this. Mirrors the hired-hero §45.2 fix.
    const slotSuffix = `_via_${charId}_ph${ph}`;
    currentReport.characters = (currentReport.characters || []).filter(
      (c) => !(typeof c.id === 'string' && c.id.startsWith('charm_') && c.id.endsWith(slotSuffix)),
    );
    currentReport.characters.push(fakeChar);
  }

  const card = document.createElement('div');
  card.id = containerId;
  card.setAttribute('data-fakeid', fakeId);
  card.className = 'orders-char-block';
  card.style.cssText = 'border:2px dashed #2a7a8a;opacity:0.9;margin-top:8px';
  card.innerHTML = kcHtml`
    <div class="orders-char-head" style="background:#eaf6f8;color:#2e2e2e">
      <button type="button" class="sec-toggle" aria-expanded="true" title="Minimise / maximise" onclick="toggleSection(this)">&#9662;</button>
      \u2728 ${wanderer.name}
      <span style="color:#185562;font-size:.7rem;margin-left:6px">(if charmed \u2014 can act from ${SEASONS_C[firstActable] || 'next turn'})</span>
      <span style="margin-left:auto;font-size:.7rem;color:#231e16">📍 ${provLinkHtml(fakeChar.locationId, fakeChar.locationName || '?')} · Land: 5/turn · Sea: 5/turn</span>
    </div>
    <div style="padding:5px 10px 6px;background:#eaf6f8;border-bottom:1px solid var(--parchment-dark);font-size:.76rem;line-height:1.6">
      <div style="color:#185562">These orders only take effect if the Charm succeeds. If the cast fails,
      or another realm charms ${wanderer.name} first, they are simply ignored.</div>
      <div style="color:var(--stone);margin-top:2px">${
        isEnemy
          ? 'Their command is seized for the rest of this turn; at the season\u2019s end they return to their own lord (who still pays their wages). They will not attack their own lord\u2019s heroes, and they handle no items at all while enchanted \u2014 you cannot give them anything, have them use anything, or have them hand anything over. They keep their own gear and fight with it.'
          : 'Joins your service at no hiring cost (you still pay their upkeep). For the rest of this turn the enchantment still holds them, so they handle no items — nothing given to them, nothing used, nothing handed over. From next turn they are an ordinary hero of your realm and all of it is open to them.'
      }</div>
    </div>
    <div class="orders-char-body"></div>`;
  casterBlock.after(card);

  const body = card.querySelector('.orders-char-body');
  SEASONS_C.forEach((season, phIdx) => {
    const row = document.createElement('div');
    row.className = 'phase-order';
    if (phIdx < firstActable) {
      row.style.cssText = 'opacity:.35;pointer-events:none';
      row.innerHTML = kcHtml`<div class="phase-label">${season}</div>
        <div style="font-size:.76rem;color:var(--stone);font-style:italic;grid-column:2/-1">(not yet charmed)</div>`;
    } else {
      row.innerHTML = kcHtml`
        <div class="phase-label">${season}</div>
        <select id="po-action-${fakeId}-${phIdx}" onchange="onActionChange(${kcArg(String(fakeId))},${kcArg(phIdx)},99)">
          <option value="">\u2014 Choose \u2014</option>
          ${actionsFor(fakeChar).map((a) => kcHtml`<option value="${a}">${a}</option>`)}
        </select>
        <div id="po-target-wrap-${fakeId}-${phIdx}">
          <input id="po-target-${fakeId}-${phIdx}" type="text" placeholder="Details">
        </div>`;
    }
    body.appendChild(row);
  });

  // Encounter plan, matching the hired-hero / resurrect cards.
  const epDiv = document.createElement('div');
  epDiv.style.cssText = 'padding:10px;border-top:1px solid var(--parchment-dark);background:#f2fafb';
  epDiv.innerHTML = kcHtml`
    <div style="font-family:Cinzel,serif;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">\u2694 Encounter Plan</div>
    <div id="ep-list-${fakeId}" style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px">
      <div style="font-size:.8rem;padding:4px 8px;background:#f2fafb;border:1px solid var(--stone);border-radius:2px">ME \u2014 Melee</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${ENCOUNTER_TACTICS.filter((t) => t.code !== 'CS' && !t.retired).map(
        (t) => kcHtml`<button onclick="addEncounterTactic(${kcArg(String(fakeId))},${kcArg(String(t.code))})"
        style="font-size:.7rem;padding:3px 8px;border:1px solid var(--stone);background:var(--parchment-dark);cursor:pointer;border-radius:2px"
        title="${t.label}">+ ${t.code}</button>`,
      )}
    </div>
    <input type="hidden" id="ep-tactics-${fakeId}" value="ME">
    <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #b8dde0">
      <div style="font-family:'Cinzel',serif;font-size:.68rem;color:#185562;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">\u{1F93A} Duel stance</div>
      <select id="ep-duel-${fakeId}" style="font-size:.8rem;width:100%">
        ${DUEL_STANCES.map((d) => kcHtml`<option value="${d.code}"${d.code === 'refuse' ? ' selected' : ''}>${d.label}</option>`)}
      </select>
    </div>
    <input type="hidden" id="ep-preschool-${fakeId}" value="">
    <div style="margin-top:6px">
      <label style="font-size:.72rem">Describe their battlecry:</label>
      <input type="text" id="ep-notes-${fakeId}" placeholder="e.g. Your cause is mine now." style="font-size:.8rem;margin-top:2px">
    </div>`;
  card.appendChild(epDiv);
}

// After a player selects Hire Hero in phase ph, add an order card for that hero covering phases
// ph+1 to 4 (they can't act in ph or earlier)
export function injectHiredHeroOrders(charId, ph, charIdx) {
  let heroId = getOrderTarget(charId, ph);
  if (!heroId) return;
  // the Broker action encodes its hire target as 'hire:<id>' (and 'spy:<provId>' for a paid spy,
  // which is NOT a hire). Strip the 'hire:' prefix; bail on anything else non-numeric.
  if (typeof heroId === 'string' && heroId.startsWith('hire:')) heroId = heroId.slice(5);
  if (!/^\d+$/.test(String(heroId))) return;

  const report = currentReport || {};
  // A newly hired hero acts from the phase AFTER the hire (sd34 Mounted Couriers retired 2026-09-21).
  const firstActable = ph + 1;
  let heroData = null;
  Object.values(report.provinceOrderData || {}).forEach((pd) => {
    (pd.availableHeroes || []).forEach((h) => {
      if (String(h.id) === String(heroId)) heroData = h;
    });
  });
  if (!heroData) return;

  const containerId = `hired-hero-orders-${charId}-${ph}`;
  document.getElementById(containerId)?.remove();

  let charBlock = document.getElementById(`po-action-${charId}-0`)?.closest('.orders-char-block');
  if (!charBlock) {
    // NESTED hire: the hiring character is itself a hero hired earlier this turn (a synthetic id),
    // whose phase-0 row may be a "not yet hired" placeholder with no action select. Find their card
    // block by any of their phase selects, or by the data-fakeid marker on their injected card, so
    // the newly-hired hero's own order window still appears and can be given orders straight away.
    for (let _p = 0; _p < 5 && !charBlock; _p++) {
      const el = document.getElementById(`po-action-${charId}-${_p}`);
      if (el) charBlock = el.closest('.orders-char-block');
    }
    if (!charBlock) {
      const fake = document.querySelector(`[data-fakeid="${charId}"]`);
      if (fake) charBlock = fake;
    }
  }
  if (!charBlock) return;

  const SEASONS_H = KC_SEASONS.slice();
  const hiredCharId = `hired_${heroId}_via_${charId}_ph${ph}`;

  // Build a full character object and register it so onActionChange/buildTargetField can find it
  const fakeChar = {
    id: hiredCharId,
    name: heroData.name,
    isKing: false,
    race: heroData.race,
    alignment: heroData.alignment,
    temper: heroData.temper,
    // 2026-09-24 (Toby item 8): a wandering hero's skills are NOT known at hire — only their fame
    // (best skill). The placeholder carries no levels, and _unknownSkills tells every order field
    // to offer the full choice (all base spells, every skill, no percentages), so a player cannot
    // read the hero's training off the dropdowns before they have joined.
    skills: {},
    _unknownSkills: true,
    armies: [],
    items: [],
    pay: heroHireWageOfP(heroData) ?? heroData.pay, // item 12: the wage they will be hired at
    // A hero hired via Hire Hero stands in the SAME province as the hiring character (the hire
    // requires it), so the newly-hired hero acts from there. Without a real locationId every
    // province-dependent order option (Recruit Armies, Search Lair, …) came up empty.
    locationId: heroData.locationId != null ? heroData.locationId : null,
    locationName: heroData.locationName || '(joining after hire)',
    effectiveSpeed: 5,
    effectiveSeaSpeed: 0,
    hiredInPhase: ph,
    encounterPlan: { tactics: ['ME'], notes: '' },
    hp: heroData.hp || 14,
    maxHp: heroData.maxHp || 14,
  };

  // Register in currentReport.characters so buildTargetField and onActionChange can look it up.
  // Remove any placeholder previously registered for THIS hire slot (same hiring character +
  // phase), not merely the same hero — otherwise swapping the chosen hero in a Hire Hero phase
  // leaves the OLD hero's fake character registered with no card in the DOM, and the submit-time
  // validation then flags its (now cardless) phases as "no action selected". The card element is
  // already slot-keyed (containerId above), so only the character registration needed the same
  // treatment. Slot id suffix: _via_<charId>_ph<ph>.
  if (currentReport) {
    const slotSuffix = `_via_${charId}_ph${ph}`;
    currentReport.characters = (currentReport.characters || []).filter(
      (c) => !(typeof c.id === 'string' && c.id.startsWith('hired_') && c.id.endsWith(slotSuffix)),
    );
    currentReport.characters.push(fakeChar);
  }

  const card = document.createElement('div');
  card.id = containerId;
  card.className = 'orders-char-block';
  card.style.cssText = 'border:2px dashed #c8922a;opacity:0.9;margin-top:8px';
  card.setAttribute('data-fakeid', hiredCharId); // lets syncHiredHeroCard unregister the placeholder on teardown

  // Build the char summary bar — show only the single highest skill, matching the "Best skill"
  // shown for this hero in the Intelligence report (not the full skill list).
  let hireTop = heroData.topSkill || null;
  if (!hireTop) {
    const sk = Object.entries(heroData.skills || {})
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    if (sk.length) hireTop = { skill: sk[0][0], level: sk[0][1] };
  }
  const skillStr = hireTop
    ? kcHtml`<span style="color:var(--forest)"><strong>${skillFameLabelM(hireTop.level)}</strong> ${SKILL_LABELS[hireTop.skill] || hireTop.skill}</span>`
    : kcHtml`<span style="color:#aaa">No notable skills</span>`;

  card.innerHTML = kcHtml`
    <div class="orders-char-head" style="background:#fdf5e0;color:#2e2e2e">
      <button type="button" class="sec-toggle" aria-expanded="true" title="Minimise / maximise this hero's orders" onclick="toggleSection(this)">&#9662;</button>
      ⚔ ${heroData.name}
      <span style="color:#c8922a;font-size:.7rem;margin-left:6px">(newly hired — can act from ${SEASONS_H[firstActable] || 'next turn'})</span>
      <span style="margin-left:auto;font-size:.7rem;color:#231e16">📍 ${provLinkHtml(fakeChar.locationId, fakeChar.locationName || '?')} · Land: 5/turn · Sea: 5/turn</span>
    </div>
    <div style="padding:5px 10px 6px;background:#fdf5e0;border-bottom:1px solid var(--parchment-dark);font-size:.76rem;display:flex;flex-wrap:wrap;gap:8px">
      <span><strong>Race:</strong> ${heroData.race}</span>
      ${skillStr}
    </div>
    <div class="orders-char-body" id="hired-body-${hiredCharId}">
    </div>`;

  charBlock.after(card);

  // Now build each phase row properly using buildTargetField
  const body = card.querySelector('.orders-char-body');
  SEASONS_H.forEach((season, phIdx) => {
    const row = document.createElement('div');
    row.className = 'phase-order';
    if (phIdx < firstActable) {
      row.style.cssText = 'opacity:.35;pointer-events:none';
      row.innerHTML = kcHtml`<div class="phase-label">${season}</div>
        <div style="font-size:.76rem;color:var(--stone);font-style:italic;grid-column:2/-1">(not yet hired)</div>`;
    } else {
      const actionSelId = `po-action-${hiredCharId}-${phIdx}`;
      const targetWrapId = `po-target-wrap-${hiredCharId}-${phIdx}`;
      row.innerHTML = kcHtml`
        <div class="phase-label">${season}</div>
        <select id="${actionSelId}" onchange="onActionChange(${kcArg(String(hiredCharId))},${kcArg(phIdx)},99)">
          <option value="">— Choose —</option>
          ${actionsFor(fakeChar).map((a) => kcHtml`<option value="${a}">${a}</option>`)}
        </select>
        <div id="${targetWrapId}">
          <input id="po-target-${hiredCharId}-${phIdx}" type="text" placeholder="Details">
        </div>`;
    }
    body.appendChild(row);
  });

  // Build encounter plan section for the hired hero
  const epDiv = document.createElement('div');
  epDiv.style.cssText = 'padding:10px;border-top:1px solid var(--parchment-dark);background:#fdf8ee';
  epDiv.innerHTML = kcHtml`
    <div style="font-family:Cinzel,serif;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">⚔ Encounter Plan</div>
    <div id="ep-list-${hiredCharId}" style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px">
      <div style="font-size:.8rem;padding:4px 8px;background:#fdf8ee;border:1px solid var(--stone);border-radius:2px">ME — Melee</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${ENCOUNTER_TACTICS.filter((t) => t.code !== 'CS' && !t.retired).map(
        (t) => kcHtml`<button onclick="addEncounterTactic(${kcArg(String(hiredCharId))},${kcArg(String(t.code))})"
        style="font-size:.7rem;padding:3px 8px;border:1px solid var(--stone);background:var(--parchment-dark);cursor:pointer;border-radius:2px"
        title="${t.label}">+ ${t.code}</button>`,
      )}
    </div>
    <input type="hidden" id="ep-tactics-${hiredCharId}" value="ME">
    <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #d8c48a">
      <div style="font-family:'Cinzel',serif;font-size:.68rem;color:#5a4208;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">
        🤺 Duel stance <span style="font-weight:normal;font-family:serif;text-transform:none;letter-spacing:0;font-size:.72rem;color:#3a3224">— single combat at the start of an army battle</span>
      </div>
      <select id="ep-duel-${hiredCharId}" style="font-size:.8rem;width:100%">
        ${DUEL_STANCES.map((d) => kcHtml`<option value="${d.code}"${d.code === 'refuse' ? ' selected' : ''}>${d.label}</option>`)}
      </select>
    </div>
    <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #d8c48a">
      <div style="font-family:'Cinzel',serif;font-size:.68rem;color:#5a4208;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">
        ✨ Pre-battle magic <span style="font-weight:normal;font-family:serif;text-transform:none;letter-spacing:0;font-size:.72rem;color:#3a3224">— one random spell cast in army battles (not encounters)</span>
      </div>
      <input type="hidden" id="ep-preschool-${hiredCharId}" value="">
      <div id="ep-preschool-display-${hiredCharId}" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"></div>
    </div>
    <div style="margin-top:6px">
      <label style="font-size:.72rem">Describe your battlecry:</label>
      <input type="text" id="ep-notes-${hiredCharId}" placeholder="e.g. For glory and the fallen — none shall pass!"
        style="font-size:.8rem;margin-top:2px">
    </div>`;
  card.appendChild(epDiv);
  renderPreSchool(hiredCharId);
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

// read the Blood Offering per-unit Sacrifice/Empower selectors into the hidden extra field
// ("S:i,j|E:a,b"), show the block only for the Blood Offering rite, and warn if the counts don't match.
export function updateBloodOffering(charId, ph) {
  const rite = document.getElementById(`po-target-${charId}-${ph}`)?.value || '';
  const block = document.getElementById(`bo-block-${charId}-${ph}`);
  const extra = document.getElementById(`po-extra-${charId}-${ph}`);
  const hint = document.getElementById(`bo-hint-${charId}-${ph}`);
  if (block) block.style.display = rite === 'Blood Offering' ? 'block' : 'none';
  if (rite !== 'Blood Offering') {
    if (extra) extra.value = '';
    return;
  }
  const sels = document.querySelectorAll(`.bo-sel[data-cid="${charId}"][data-ph="${ph}"]`);
  const sac = [],
    ben = [];
  sels.forEach((s) => {
    const idx = parseInt(s.getAttribute('data-idx'));
    if (s.value === 'S') sac.push(idx);
    else if (s.value === 'E') ben.push(idx);
  });
  if (extra) extra.value = `S:${sac.join(',')}|E:${ben.join(',')}`;
  if (hint) {
    if (sac.length === 0 && ben.length === 0) {
      hint.textContent = 'Mark units to sacrifice and an equal number to empower.';
      hint.style.color = 'var(--stone)';
    } else if (sac.length !== ben.length) {
      hint.textContent = `⚠ ${sac.length} to sacrifice vs ${ben.length} to empower — only ${Math.min(sac.length, ben.length)} pair(s) will take effect (each sacrifice funds one empowerment).`;
      hint.style.color = '#b04a4a';
    } else {
      hint.textContent = `✓ ${sac.length} unit(s) sacrificed to empower ${ben.length} other(s) by +2 tiers.`;
      hint.style.color = '#2d6a2d';
    }
  }
  // Persist the selection into the saved draft immediately. Without this, the per-unit choices live
  // ONLY in the DOM: any later full re-render of the orders form (e.g. heir-skill allocation) or a
  // reload rebuilds this field from the saved draft, resetting every unit to "Keep" and emptying
  // the hidden field — so only the engine's 1-for-1 fallback fired. Saving on each change keeps the
  // draft
  // (and currentGamePlayer.orders, used by rebuilds) in step with what the player actually chose.
  if (typeof doSaveOrders === 'function') doSaveOrders();
}

export async function submitOrders() {
  const chars = currentReport?.characters || [];
  const btn = document.getElementById('submit-btn');
  const msg = document.getElementById('orders-msg');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  // Validate: all phases filled? Skip phases that are locked because the character was hired
  // mid-turn
  let missingCount = 0;
  chars
    .filter((c) => c.alive !== false)
    .forEach((c) => {
      const hiredPh = c.hiredInPhase ?? -1; // -1 = available all turn
      SEASONS.forEach((_, ph) => {
        if (ph <= hiredPh) return; // legitimately locked — no order possible before hire
        const action = document.getElementById(`po-action-${c.id}-${ph}`)?.value || '';
        if (!action) missingCount++;
      });
      // Also check hired heroes (injected cards) These use a different charId format:
      // hired_X_via_Y_phZ
    });
  const _dcUnpicked = _pendingDiscChoices().filter(
    (pc) => !pc.options.some((o) => o.id === discoveryChoices[pc.key]),
  ).length;
  if (missingCount > 0 || _dcUnpicked > 0) {
    // The warning goes in the bottom block's message slot and its buttons REPLACE the submit
    // buttons in the wrap directly beneath it, so every control to do with submitting stays in one
    // place.
    msg.innerHTML = kcHtml`<div class="msg-warning">${missingCount > 0 ? `⚠ ${missingCount} phase${missingCount !== 1 ? 's' : ''} still have no action selected. You can submit anyway, and the GM will treat unfilled phases as Defend.` : ''}${_dcUnpicked > 0 ? kcHtml`${missingCount > 0 ? kcHtml`<br>` : ''}⚠ ${_dcUnpicked} research discover${_dcUnpicked !== 1 ? 'ies are' : 'y is'} still unchosen (💡 Research box near the top of your orders). If you submit anyway, one of each pair will be kept at random.` : ''}</div>`;
    const w = document.getElementById('orders-submit-wrap');
    if (w) {
      w.innerHTML = kcHtml`
        <button class="btn btn-crimson btn-full" style="flex:1;padding:12px;font-size:.85rem" onclick="doSubmitOrders()">Submit Anyway</button>
        <button class="btn btn-ghost" style="flex:0 0 auto;padding:10px 16px" onclick="cancelSubmit()">← Go Back</button>`;
      w.style.display = 'flex';
      w.style.gap = '8px';
    }
    return;
  }
  await doSubmitOrders();
}

export function setHeirName(charId, value) {
  if (!currentReport) return;
  const c = currentReport.characters.find((x) => x.id === charId);
  if (!c || !c._isHeir) return;
  c.name = String(value || '').slice(0, 40);
  doSaveOrders(); // persist without re-rendering, so the field keeps focus
}

export function setHeirTemper(charId, value) {
  if (!currentReport) return;
  const c = currentReport.characters.find((x) => x.id === charId);
  if (!c || !c._isHeir) return;
  if (!HEIR_TEMPERS_LIST.includes(value)) return;
  c.temper = value;
  doSaveOrders(); // temper doesn't change order options, so no rebuild needed
}

// Spend or refund a succession skill point. delta is +1 or −1. Caps mirror the join screen: a
// 4-point budget, at most +2 into any single skill, never reducing a skill below its crowned base.
export async function allocateHeirSkill(charId, skill, delta) {
  if (!currentReport) return;
  const c = currentReport.characters.find((x) => x.id === charId);
  if (!c || !c._isHeir) return;
  c.skills = c.skills || {};
  const cur = c.skills[skill] || 0;
  const added = heirAddedTo(c, skill);
  if ((delta || 0) > 0) {
    if (heirTotalAdded(c) >= 4) return; // no points left to spend
    if (added >= 2) return; // +2-per-skill cap
    c.skills[skill] = cur + 1;
  } else {
    if (added <= 0) return; // can't dip below the crowned base
    c.skills[skill] = cur - 1;
    if (c.skills[skill] === 0) delete c.skills[skill];
  }
  c._pendingSkillAllocation = heirPointsRemaining(c); // keep the banner/payload count in sync
  await doSaveOrders(); // persist first (also refreshes currentGamePlayer.orders)
  // Rebuild ONLY the orders form from the freshly-saved draft. This redraws the pips + points AND
  // re-reads c.skills for every character's spell controls, so a magic school just purchased offers
  // its spells immediately — all without a full report re-fetch (which would blank the map/titles).
  buildOrdersForm(
    currentReport.characters,
    false,
    currentGamePlayer?.orders,
    currentReport?._liveTurn || currentReport?.turn || 1,
  );
}

export async function resubmitOrders() {
  // Re-enable all order form inputs so the player can update before resubmitting
  const gp = currentGamePlayer;
  if (!gp) return;
  // Restore the submit wrap with the normal buttons
  restoreSubmitWrap('Resubmit');
  document.getElementById('orders-msg').innerHTML =
    '<div class="msg-info">✏ Update your orders below and hit Resubmit — your new orders will replace the previous submission.</div>';
  // Make sure all form inputs are enabled
  document.querySelectorAll('#orders-form select, #orders-form input, #orders-form button').forEach((el) => {
    if (!el.id?.includes('po-leave-all')) el.disabled = false;
  });
}
