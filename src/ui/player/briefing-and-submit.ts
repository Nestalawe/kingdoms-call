// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcHtml } from '../shared/kc-safe.ts';
import { sb } from './startup.ts';
import { SEASONS } from './items-and-heroes.ts';
import { collectMessages } from './init.ts';
import { setMobileView } from './layout.ts';
import { currentHeroOrderP } from './move-analysis.ts';
import { buildOrdersForm } from './orders-form.ts';
import { getOrderExtra, getOrderTarget } from './pre-orders.ts';
import { predictedLocation } from './order-targets.ts';
import { bulletizeDesc } from './map-symbols.ts';
import { UNIT_ABILITIES } from '../../content/unit-abilities-their-names-numbers-and-words.ts';

// ══ THE NEW PLAYER'S BRIEFING — RACE, ALIGNMENT, TEMPER ═══════════════════════════════════
// STANDING RULE (Toby, 2026-09-27): these three boxes are the ONLY thing most players read before
// committing to a realm for a whole game, and they are the first thing that goes stale. Keep them
// SHORT — the main things a newcomer needs to choose — and update them in the SAME change as any
// rule they describe. The deep detail lives in the rulebook; this is the shop window.
export function updateAlignmentDesc() {
  const sel = document.getElementById('join-alignment');
  const desc = document.getElementById('join-alignment-desc');
  if (!sel || !desc) return;
  // Alignment decides your realm's signature order, its battle fervour, and which heroes will
  // serve you (the further a hero's own alignment sits from yours, the more they cost; Divine and
  // Undead will never serve one another). Only ONE realm per game may be Divine, and one Undead.
  const DESCS = {
    Divine:
      '✨ **Divine:** The holy crown. Best battle fervour in the game (50% chance your host fights fanatically). Your king may **Consecrate** provinces: +50% tax and much stiffer defence. A fallen character returns to life one turn later on consecrated ground — no other realm can do that. Heroes heal twice as fast resting. Will not hire Undead heroes, and dark ones cost extra. One Divine realm per game.',
    Good: '⚔ **Good:** The steady defender. 40% fervour, +10% strength defending land you own, and better odds that your armies join up for a combined attack. **Call to Arms** gives the king a free garrison unit in one of your provinces every turn. Heroes of most alignments are cheap to hire. A forgiving choice.',
    Druidic:
      '🌿 **Druidic:** The wild crown. Your king starts with Druid +1, and every character leads **Creature** armies (thunderbirds, ents, bears, giants, unicorns, mammoths, rocs, whales and great turtles) with no Druid penalty, and every level of Druid they do hold makes those beasts stronger; a hero leads at most as many beasts as his Druid level. Creature armies fight at ×1.5 in forest and jungle.',
    Neutral:
      '⚖ **Neutral:** The merchant crown, and the easiest to learn. **+20% tax from every province**, the cheapest heroes in the world (2–3g whatever their alignment), and Sage discoveries come twice as often. **Broker** lets the king hire a distant wandering hero, or buy a spy report on anywhere you have seen, without leaving home.',
    Pagan:
      "\u{1F525} **Pagan:** The old gods, for a price. King starts with Explorer +1. At a discovered ritual site you may **Perform Rite**: the **Wild Hunt** binds that province's beasts to your host — the only way to field Creatures or Monsters with no Druid magic — or a **Blood Offering** sacrifices units to make an equal number far better. You also earn +1g for every enemy unit you destroy in a victory.",
    Evil: "💀 **Evil:** The tyrant. Your king starts with Druid +1, and every character leads **Monster** armies (trolls, basilisks, manticores, dragons, krakens) with no Druid penalty, at most as many as his Druid level; a Monster in the host lifts the whole host to ×1.25 in every battle. A crushing win leaves the enemy in Terror (−10% in their next fight), and your Monsters fight ×1.5 attacking ground your Terror grips (**Reign of Fear**). Each conquest is either **looted** for half the province's tax value in gold, or **enslaved** for a free garrison unit at the cost of its tax for three turns — your choice, character by character.",
    Undead:
      '💀 **Undead:** The deathless. King starts with Necromancy +1 and a free skeletal unit. Skeletal armies cost just 1g, need no Druid skill, **always** fight fanatically (+50% under the king, +30% under a hero), and never lose men fleeing a lost battle. **Harvest the Field** raises a grave as a soldier for 2g with no magic at all. Will not hire Divine heroes. One Undead realm per game.',
  };
  desc.innerHTML = bulletizeDesc(DESCS[sel.value] || '');
}

export function unitAbilityText(type) {
  return UNIT_ABILITIES[type] || '';
}
// the unit ability descriptions were removed from the map pop-ups; instead they surface as a hover
// tooltip on the unit's icon+label wherever units are listed in Your Realm and Your Provinces. Only
// wraps when the unit actually has an always-on ability. Item 1: magic-item lore — the engine
// attaches `lore` (a short narrative that states the effect in plain words) to every item in the
// report; hovering the item's name shows it, like a unit's ability tip.
export function itemLoreTip(it, inner) {
  // the description is printed after every item, so the hover pop-up is retired.
  return inner;
}
// ── "Acquired this turn" (2026-09-26, Toby item 3) ────
// A pack says nothing about when each piece was won, so a relic taken from a lair this turn read
// exactly like one carried since the founding. The GM report flags every item that was not in the
// character's pack when the turn began (buildTurnReport → acquiredThisTurn); this prints that flag
// as a small badge at the START of the item's line (2026-09-26b: was a separate line under it, with ✨,
// which the game already uses elsewhere — now 🆕), in the Chronicle and in the orders form alike.
export function itemAcquiredTagP(it) {
  if (!it || !it.acquiredThisTurn) return '';
  return kcHtml`<span title="Acquired this turn" style="display:inline-block;font-size:.7rem;color:#123008;background:#eaf5e2;border:1px solid #5d8a3c;border-radius:2px;padding:0 5px;margin-right:5px;vertical-align:1px;white-space:nowrap">🆕 Acquired this turn</span>`;
}
export function unitAbilityTip(type, inner) {
  const ab = unitAbilityText(type);
  if (!ab) return inner;
  return kcHtml`<span title="${ab}" style="cursor:help;border-bottom:1px dotted var(--stone)">${inner}</span>`;
}

export function updateRaceDesc() {
  const sel = document.getElementById('join-race');
  const desc = document.getElementById('join-race-desc');
  if (!sel || !desc) return;
  // Race decides which troops your home province can raise, and carries one signature strength.
  // Two rules apply to everybody: a commander leading troops of their OWN race fights at +20% and
  // needs no Druid skill for them, and the two ancient feuds (Human↔Orc, Elf↔Dwarf) cost a
  // commander 20% when leading the rival kin's troops.
  const DESCS = {
    Human:
      '🛡 **Human:** The all-rounders — the widest choice of troops (Levies and sturdy Men-at-Arms, Longbows, the best horse in the game) and the strongest navy (the Galleons). Their units also **learn twice as fast**, so a Human army improves quickly with drilling and battle. No terrain is closed to them. Feud with Orcs. The easiest race to play.',
    Elven:
      '🏹 **Elven:** Archers and woodsmen. Elven troops fight at **×1.5 in forest and jungle**, and an Elven unit that would be destroyed often slips away home instead of dying. Swift Eagle Riders scout and strike, and Stag Riders are the one cavalry at home among the trees. Weakest in the open. Feud with Dwarves.',
    Dwarven:
      '⛏ **Dwarven:** The anvil. Dwarven troops fight at **×1.5 whenever they defend**, and every Dwarven character of a Dwarven realm wears **Mithril Armour** — 2 less damage from every blow and arrow they take. Mountain Guns and armoured Ironclads hit very hard, and Ironhoof Rams are the one cavalry sure-footed in the mountains. Slow to march. Feud with Elves.',
    Orcish:
      '⚔ **Orcish:** The horde. Cheap, fast troops you can afford in numbers — Goblin Hordes (two a turn), Black Arrows, Warg Riders, Berserkers and flying Wyvern Riders. Orcish characters start with **18 HP instead of 15** and harden faster. Quality is poor; you win by numbers and speed. Feud with Humans.',
  };
  desc.innerHTML = bulletizeDesc(DESCS[sel.value] || '');
}

export function updateTemperDesc() {
  const sel = document.getElementById('join-temper');
  const desc = document.getElementById('join-temper-desc');
  if (!sel || !desc) return;
  // Temper is how your KING behaves in personal combat — duels, lair guardians, ambushes. It does
  // nothing in army battles. It is the single biggest factor in whether your king survives.
  const DESCS = {
    Berserk:
      '🔥 **Berserk:** The hammer. +18% to hit and +3 damage in melee — far the hardest hitter — and shrugs off 12% of every blow and arrow. But enemies hit them 10% more easily, and they fight on until nearly dead. The most likely of all to be killed.',
    Brave:
      '🦁 **Brave:** The soldier. Good at everything (+12% melee, +8% archery, +1 damage) and, once per fight, **Second Wind**: when first badly wounded they recover about a quarter of their health. No weakness. The safe default.',
    Cautious:
      '🧭 **Cautious:** The survivor. Enemies are 14% less likely to hit them (and can never beat 66% however skilled), every melee blow that does land does 2 less damage, and a missed attack draws a **40% riposte**. No attack bonus — they win by outlasting. The hardest king to kill.',
    Cowardly:
      '🏃 **Cowardly:** The archer and the spy. +22% archery, +15% to Steal, best in the game at breaking off and fleeing, and if struck down they may beg for mercy and be spared. Poor with a blade. The sensible choice for a king you cannot afford to lose.',
  };
  desc.innerHTML = bulletizeDesc(DESCS[sel.value] || '');
}

// ── SUBMIT-WRAP MARKUP — ONE SOURCE OF TRUTH ────
// The submit buttons are torn down and rebuilt in four different situations (past-turn view,
// by hand at each site, which is how the "Submit Anyway / Go Back" pair ended up somewhere else on
// the page from the button they replace. Everything now routes through these two helpers so the
// whole submit control stays in the sticky bottom block, together, at all times.
export function normalSubmitWrapHtml(verb) {
  const turn = currentReport?._liveTurn || currentReport?.turn || 1;
  return kcHtml`
    <button class="btn btn-ghost" onclick="doSaveOrders()" style="flex:0 0 auto;padding:10px 16px">💾 Save Draft</button>
    <button class="btn btn-crimson btn-full" id="submit-btn" onclick="submitOrders()" style="flex:1;padding:12px;font-size:.85rem">
      ${verb || 'Submit'} Orders for Turn ${turn}
    </button>`;
}
// ── SUBMITTED-STATE INDICATOR ────
// The "✓ Orders submitted" pill was written ONCE when a report opened and never revised, so every
// path that un-submits a turn in the database left it standing: Revise Orders, and — the one that
// actually misleads — saving a draft after hitting Resubmit, which writes orders_submitted=false
// while the pill still claims the orders are in. This is the single place the flag and its
// indicator are changed together; call it instead of touching either by hand.
export function setOrdersSubmittedUI(submitted) {
  if (currentGamePlayer) currentGamePlayer.orders_submitted = !!submitted;
  const pill = document.getElementById('report-status-pill');
  if (pill)
    pill.innerHTML = submitted
      ? '<span class="pill pill-blue">✓ Orders submitted</span>'
      : '<span class="pill pill-amber">⏳ Orders needed</span>';
}

export function restoreSubmitWrap(verb) {
  const w = document.getElementById('orders-submit-wrap');
  if (!w) return;
  w.innerHTML = normalSubmitWrapHtml(verb);
  w.style.display = 'flex';
  w.style.gap = '8px';
}

export function cancelSubmit() {
  document.getElementById('orders-msg').innerHTML = '';
  restoreSubmitWrap('Submit');
}

export async function doSaveOrders() {
  const chars = currentReport?.characters || [];
  const orders = {};
  const encounterPlans = {};
  chars.forEach((c) => {
    orders[c.id] = SEASONS.map((_, ph) => {
      const action = document.getElementById(`po-action-${c.id}-${ph}`)?.value || '';
      const target = getOrderTarget(c.id, ph);
      const extra = getOrderExtra(c.id, ph);
      return { action, target, extra, desc: action + (target ? ' — ' + target : '') };
    });
    const tacHidden = document.getElementById(`ep-tactics-${c.id}`);
    const notesEl = document.getElementById(`ep-notes-${c.id}`);
    const preSchool = (document.getElementById(`ep-preschool-${c.id}`)?.value || '').toLowerCase();
    if (tacHidden) {
      const tacts = (tacHidden.value || 'ME').split(',').filter(Boolean);
      if (preSchool) tacts.push(`CS:${preSchool}`);
      encounterPlans[c.id] = {
        tactics: tacts,
        notes: notesEl?.value || '',
        duelStance: document.getElementById(`ep-duel-${c.id}`)?.value || 'refuse',
        evilMode: document.getElementById(`ep-evilmode-${c.id}`)?.value || undefined,
      };
    }
  });
  const gp = currentGamePlayer;
  if (!gp?.id) {
    console.warn('doSaveOrders: no currentGamePlayer');
    return;
  }
  // Don't save if we're viewing a past turn report
  if (document.getElementById('prev-report-banner')?.style.display === 'block') {
    console.warn('doSaveOrders: blocked — viewing past turn report');
    return;
  }
  const kingSkills = {};
  chars.forEach((c) => {
    if (c._isHeir)
      kingSkills[c.id] = {
        skills: c.skills || {},
        pending: c._pendingSkillAllocation || 0,
        name: c.name || '',
        temper: c.temper || '',
        base: c._heirBase || c.skills || {},
      };
  });
  // Stamp the draft with the turn it belongs to, as a submission is — so neither this form nor the
  // GM engine can mistake last turn's draft for this turn's orders.
  const _draftTurn = currentReport?._liveTurn || currentReport?.turn || 1;
  const _payload = JSON.stringify({
    orders,
    encounterPlans,
    kingSkills,
    diplomacy: diploChoices,
    discoveryChoices,
    callReckoning: reckoningCall,
    concede: concedeGame,
    messages: collectMessages(),
    heroOrder: currentHeroOrderP(),
    forTurn: _draftTurn,
  });
  const { error: saveErr } = await sb
    .from('game_players')
    .update({
      orders: _payload,
      orders_submitted: false,
    })
    .eq('id', gp.id);
  if (saveErr) {
    console.error('Save draft error:', saveErr.message);
    return;
  }
  if (currentGamePlayer) currentGamePlayer.orders = _payload; // keep the in-memory draft fresh for light re-renders
  // Saving a draft writes orders_submitted=false, so the turn is NOT submitted from this moment on
  // — the indicator has to say so, or a player who saves a draft after a Resubmit walks away
  // believing orders are with the GM when they are not.
  setOrdersSubmittedUI(false);
  const msg = document.getElementById('save-msg');
  if (msg) {
    msg.style.display = 'block';
    setTimeout(() => {
      msg.style.display = 'none';
    }, 3000);
  }
}

export async function reviseOrders() {
  // Mark orders as not submitted so the player can edit and resubmit
  const gp = currentGamePlayer;
  if (!gp) return;
  const { error } = await sb.from('game_players').update({ orders_submitted: false }).eq('id', gp.id);
  if (error) {
    console.error(error);
    return;
  }
  // Update local state and rebuild form with existing orders pre-filled
  setOrdersSubmittedUI(false); // the turn is no longer submitted — say so at the top of the column
  const chars = currentReport?.characters || [];
  buildOrdersForm(chars, false, gp.orders, currentReport?.turn || 1);
  document.getElementById('orders-msg').innerHTML =
    '<div class="msg-warning">✏ Revising orders — your previous orders are pre-filled. Make changes and resubmit.</div>';
  document.getElementById('submit-btn').disabled = false;
  document.getElementById('submit-btn').textContent =
    `Resubmit Orders for Turn ${currentReport?._liveTurn || currentReport?.turn || 1}`;
}

export async function doSubmitOrders() {
  const chars = currentReport?.characters || [];
  const btn = document.getElementById('submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving…';
  }

  // Safety: verify the turn hasn't advanced since the player loaded the form
  const { data: freshGame } = await sb.from('games').select('turn').eq('id', currentGamePlayer?.game_id).single();
  const expectedTurn = currentReport?._liveTurn || currentReport?.turn || 1;
  if (freshGame && freshGame.turn !== expectedTurn) {
    document.getElementById('orders-msg').innerHTML =
      kcHtml`<div class="msg-error">⚠ The GM has already resolved this turn. Your orders were not saved — please reload the page to see your new turn report.</div>`;
    restoreSubmitWrap('Submit');
    return; // rebuild a live #submit-btn (the Submit-Anyway path removed it)
  }
  if (!currentGamePlayer?.id) {
    document.getElementById('orders-msg').innerHTML =
      '<div class="msg-error">Session error — please reload the page.</div>';
    restoreSubmitWrap('Submit');
    return; // rebuild a live #submit-btn (the Submit-Anyway path removed it)
  }

  const orders = {};
  const encounterPlans = {};
  chars.forEach((c) => {
    orders[c.id] = SEASONS.map((_, ph) => {
      const action = document.getElementById(`po-action-${c.id}-${ph}`)?.value || 'Defend';
      const target = getOrderTarget(c.id, ph);
      const extra = getOrderExtra(c.id, ph);
      const _spyName =
        action === 'Spy' && String(target || '').startsWith('char:')
          ? ((currentReport || {}).visibleChars || []).find((x) => String(x.id) === String(target).slice(5))?.name ||
            null
          : null;
      const desc =
        action +
        (target &&
        action !== 'Move' &&
        action !== 'Defend' &&
        action !== 'Rest' &&
        action !== 'Spy' &&
        action !== 'Explore'
          ? ` — ${target}`
          : '') +
        (_spyName ? ` — on ${_spyName}` : '');
      // 2026-09-29: a Search Lair order names its lair by index within a province — send the province
      // this form was written for, so the engine never searches a different lair if the move there fails.
      if (action === 'Search Lair' || action === 'Search Feature') {
        const _pl = predictedLocation(c.id, ph);
        if (_pl && _pl.id != null) return { action, target, extra, desc, prov: _pl.id };
      }
      return { action, target, extra, desc };
    });
    // Collect encounter plan
    const tacHidden = document.getElementById(`ep-tactics-${c.id}`);
    const notesEl = document.getElementById(`ep-notes-${c.id}`);
    const preSchool = (document.getElementById(`ep-preschool-${c.id}`)?.value || '').toLowerCase();
    if (tacHidden) {
      const tacts = (tacHidden.value || 'ME').split(',').filter(Boolean);
      if (preSchool) tacts.push(`CS:${preSchool}`);
      encounterPlans[c.id] = {
        tactics: tacts,
        notes: notesEl?.value || '',
        duelStance: document.getElementById(`ep-duel-${c.id}`)?.value || 'refuse',
        evilMode: document.getElementById(`ep-evilmode-${c.id}`)?.value || undefined,
      };
    }
  });
  // Also collect orders for any dynamically-injected hired hero cards
  document.querySelectorAll('[id^="hired-hero-orders-"]').forEach((card) => {
    const sel = card.querySelector('select[id^="po-action-hired_"]');
    if (!sel) return;
    const cid = sel.id.replace(/^po-action-/, '').replace(/-\d+$/, '');
    orders[cid] = SEASONS.map((_, ph) => ({
      action: document.getElementById(`po-action-${cid}-${ph}`)?.value || 'Defend',
      target: getOrderTarget(cid, ph),
      extra: getOrderExtra(cid, ph),
      desc: '',
    }));
    const hTac = document.getElementById(`ep-tactics-${cid}`);
    if (hTac) {
      const hTacts = (hTac.value || 'ME').split(',').filter(Boolean);
      const hPre = (document.getElementById(`ep-preschool-${cid}`)?.value || '').toLowerCase();
      if (hPre) hTacts.push(`CS:${hPre}`);
      encounterPlans[cid] = {
        tactics: hTacts,
        notes: document.getElementById(`ep-notes-${cid}`)?.value || '',
        duelStance: document.getElementById(`ep-duel-${cid}`)?.value || 'refuse',
        evilMode: document.getElementById(`ep-evilmode-${cid}`)?.value || undefined,
      };
    }
  });
  // Resurrection pre-order cards. Same shape as the hired-hero collection above; the GM parses the
  // synthetic id and holds these as pending until the raise actually succeeds.
  document.querySelectorAll('[id^="resurrect-orders-"]').forEach((card) => {
    const sel = card.querySelector('select[id^="po-action-resurrect_"]');
    if (!sel) return;
    const rid = sel.id.replace(/^po-action-/, '').replace(/-\d+$/, '');
    orders[rid] = SEASONS.map((_, ph) => ({
      action: document.getElementById(`po-action-${rid}-${ph}`)?.value || 'Defend',
      target: getOrderTarget(rid, ph),
      extra: getOrderExtra(rid, ph),
      desc: '',
    }));
    const rTac = document.getElementById(`ep-tactics-${rid}`);
    if (rTac) {
      encounterPlans[rid] = {
        tactics: (rTac.value || 'ME').split(',').filter(Boolean),
        notes: document.getElementById(`ep-notes-${rid}`)?.value || '',
        duelStance: document.getElementById(`ep-duel-${rid}`)?.value || 'refuse',
      };
    }
  });
  // Charm pre-order cards — same shape as the resurrect collection above; the GM parses the
  // synthetic 'charm_…' id and holds these pending until the Charm actually lands on the wandering
  // hero.
  document.querySelectorAll('[id^="charm-orders-"]').forEach((card) => {
    const sel = card.querySelector('select[id^="po-action-charm_"]');
    if (!sel) return;
    const cid = sel.id.replace(/^po-action-/, '').replace(/-\d+$/, '');
    orders[cid] = SEASONS.map((_, ph) => ({
      action: document.getElementById(`po-action-${cid}-${ph}`)?.value || 'Defend',
      target: getOrderTarget(cid, ph),
      extra: getOrderExtra(cid, ph),
      desc: '',
    }));
    const cTac = document.getElementById(`ep-tactics-${cid}`);
    if (cTac) {
      encounterPlans[cid] = {
        tactics: (cTac.value || 'ME').split(',').filter(Boolean),
        notes: document.getElementById(`ep-notes-${cid}`)?.value || '',
        duelStance: document.getElementById(`ep-duel-${cid}`)?.value || 'refuse',
      };
    }
  });
  // Collect royal-succession skill allocations for any newly-crowned heir.
  const kingSkills = {};
  chars.forEach((c) => {
    if (c._isHeir)
      kingSkills[c.id] = {
        skills: c.skills || {},
        pending: c._pendingSkillAllocation || 0,
        name: c.name || '',
        temper: c.temper || '',
        base: c._heirBase || c.skills || {},
      };
  });
  const _subPayload = JSON.stringify({
    orders,
    encounterPlans,
    kingSkills,
    diplomacy: diploChoices,
    discoveryChoices,
    callReckoning: reckoningCall,
    concede: concedeGame,
    messages: collectMessages(),
    heroOrder: currentHeroOrderP(),
    forTurn: expectedTurn,
  });
  const { error } = await sb
    .from('game_players')
    .update({
      orders: _subPayload,
      orders_submitted: true,
      last_submitted_at: new Date().toISOString(),
    })
    .eq('id', currentGamePlayer.id);
  if (error) {
    document.getElementById('orders-msg').innerHTML = kcHtml`<div class="msg-error">Error: ${error.message}</div>`;
    restoreSubmitWrap('Submit');
    return; // rebuild a live #submit-btn (the Submit-Anyway path removed it)
  }
  // 2026-09-23: keep the in-memory copy equal to what was SUBMITTED. Only a draft save updated it,
  // so Revise Orders (without a reload) re-filled the form from the last DRAFT — any change made
  // after that draft was silently lost from the revised form.
  if (currentGamePlayer) currentGamePlayer.orders = _subPayload;
  document.getElementById('orders-msg').innerHTML = '';
  document.getElementById('orders-submit-wrap').innerHTML = kcHtml`
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%">
      <span style="color:var(--forest);font-size:.85rem;flex:1">✓ Orders submitted successfully! The GM will be notified.</span>
      <button class="btn btn-ghost" style="padding:8px 16px;font-size:.8rem" onclick="resubmitOrders()">↺ Resubmit Orders</button>
    </div>`;
  setOrdersSubmittedUI(true);
  // On mobile, drop the player back to the Turn Report now their orders are in.
  setMobileView('report');
}

// ── SKILL ROW ────
// One renderer for both places a character's abilities are listed: the report's character card and
// the orders column. The GM ships `skillEff` for each character — base level, EFFECTIVE level, and
// the sources of the difference — computed by the same function the engine resolves turns with, so
// what is shown here IS what the turn will use. `combatSkillBonus` carries bonuses that apply only
// in personal combat (minor titles, Veteran Training); those are shown separately, because they do
// not change the skill itself. Falls back to the raw skills for an older report with no breakdown.
// style: 'tags' — the compact pills on the report card; 'inline' — the orders column's label list.
// The EFFECTIVE level of a skill as the engine will use it — base plus items, aura and any Curse,
// straight from the breakdown the GM shipped. Every success-chance preview in the order forms reads
// this, so a "+2 Thief" blade shows in the odds the player is quoted. Falls back to the raw level
// for an older report.
export function effSkillP(c, k) {
  const e = c && c.skillEff && c.skillEff[k];
  if (e && typeof e.total === 'number') return e.total;
  return ((c && c.skills) || {})[k] || 0;
}
