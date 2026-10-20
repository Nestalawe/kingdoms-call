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

// Every humanoid land unit has a MATCHUP ability (what it does to the unit it meets in the battle line,
// or shoots over its fighter at) and ONE more; the fleets keep theirs. 2026-10-11 (Toby, the unit
// abilities). Kept in step with battleFaceSide / abilityFront / abilityBack, the volley helpers and
// rollUnitFates in the GM portal; tests/abilities-words holds the names to the rulebook's roster.
export const UNIT_ABILITIES = {
  'Shieldwall Levies':
    "Spear Hedge — cavalry facing them in the line fights at no better than ×0.75 (the Unicorn Herd's Purity breaks it). Shieldwall — ×1.25 when an archer stands in the second line behind them.",
  'Men-at-Arms': 'Halberds — ×1.25 facing cavalry. Sergeants — Levies beside them in the front line fight ×1.1.',
  'Free Lances':
    'Harriers — ×1.15 in a flank duel. Ride Them Down — in plains and desert only, each adds +6% to enemy losses when your side wins (max +18%). Works the same against neutral defenders — and theirs works the same against you.',
  'Yeoman Longbows':
    'Bodkin Points — no penalty shooting cavalry from the second line (other archers fire at ×0.75). Prepared Ground — defending, they loose two pre-battle volleys.',
  'Gilded Lances':
    'Lance Charge — ×1.15 facing foot, where cavalry is usually ×0.85 (a Spear Hedge still stops it). Knightly Example — while a Gilded Lances unit is in the army, your Levies and Men-at-Arms never lose a tier in defeat.',
  'Noble Griffons':
    'Dive on the Bowmen — the enemy’s strongest second-line archer fights ×0.75. Screech Dive — a diving pre-battle strike scatters one enemy unit (2–4), one chance in two whatever the commander’s Druid.',
  'Human Garrison':
    'Hold the Gate — defending, never hit from the side when the enemy line wraps its end. Town Watch — counts as Levies for Shieldwall and for anchoring the line.',
  'Galleon Fleet': 'Broadside — fires in the pre-battle archery phase during sea battles.',
  'Forest Wardens':
    'Woodland Skirmish — ×1.15 in forest and jungle, whatever they face. Ambush — in forest or jungle, the side facing them gets no archery phase at all (unless Eagle Riders fly with it). Works attacking or defending, and against province defenders as well as another realm.',
  'Elven Bowmen':
    'Volley at the Charge — ×1.25 shooting cavalry from the second line. Woodland Volley — double volley damage in forest and jungle.',
  'Shadow Archers':
    'Marksmen — ×1.25 shooting archers from the second line, and they pick the best target anywhere along the enemy front. Loosed From Cover — cannot be targeted by enemy volleys (unless Eagle Riders fly with the shooters).',
  'Stag Riders':
    'Through the Trees — the one cavalry that takes a flank in forest and jungle. Forest Runners — ×1.1 in forest and no penalty in jungle (see the roster).',
  'Eagle Riders':
    'Stoop on the Horses — on open ground they may hold a flank slot no rider fills, and fight cavalry at ×1.25. Eyes of the Forest — while they fly with your shooters, an enemy Ambush is spoiled and Shadow Archers can be shot at.',
  'Elven Garrison':
    'Thorn Hedge — cavalry facing it in forest or jungle ×0.85. Tree Watch — in forest or jungle it shoots in the archery step like an archer unit.',
  'Elven Galleys': 'Sea Archers — your ranged units ignore the land-unit penalty at sea.',
  'Dwarven Guard':
    "Unbreakable — foot facing them in the line ×0.85, and they are never hit from the side. Shield Fort — when at least half the front line is Guard (a Dwarf Garrison counts), a beaten force never routs: with a retreat open it withdraws in good order (immune to pursuit losses and to demotion in retreat); trapped, it locks shields and holds the province contested with no flight casualties. In every battle, and for a province's own Guard defenders too.",
  'Ironwood Crossbows':
    'Armour-Piercing — ×1.25 shooting a unit of base strength 6 or more from the second line. Punch Through — can soften a target to 55% instead of the usual 40% limit (90% instead of 80% against a winged rider).',
  'Mountain Guns':
    'Bombard — ×1.15 from the second line, whatever they shoot. Bombardment — fire before all other ranged units, and +50% volley damage against garrisons.',
  'Ironhoof Rams':
    'Battering Horns — a Ram riding free turns the enemy flank even when infantry anchor both ends of its line. Crag Charge — the one cavalry that takes a flank in the mountains.',
  'Gnomish Gyrocopters':
    'Flak Gunners — ×1.25 when the enemy has flyers. Flak Screen — each engages one enemy flying unit before the battle (−30% strength). No two gyrocopters engage the same flyer.',
  'Dwarf Garrison': 'Stone Halls — foot facing it in the mountains ×0.9. Deep Halls — counts as Guard for Shield Fort.',
  'Dwarf Ironclads': 'Armoured Hulls — immune to pre-battle volleys.',
  'Goblin Horde':
    'Arrow Fodder — second-line archers shooting them fire at ×0.75. Sheer Numbers — +10% strength per other orc foot unit in the force (Goblin Hordes, Berserkers, the Orc Garrison), max +30%.',
  'Orc Berserkers':
    'Frenzy — ×1.15 facing foot. Driven Before Them — +10% for each Goblin Horde beside them in the front line.',
  'Black Arrows':
    'Brawling Archers — full strength when forced into the front line, where other archers fight ×0.75. Raiders’ Volley — their pre-battle volley does ×1.5 when attacking.',
  'Warg Riders':
    'Wolves Panic Horses — ×1.25 facing cavalry. Run Them Down — if at least half your winning force are Wargs, they run the beaten army down on the field: every beaten unit is 15% more likely to be destroyed in the rout, on any ground (not against a Dwarven Shield Fort). There is no chase afterwards. Against neutral guards, who never flee, they end the fight fast instead: half casualties for you on a win.',
  'Wyvern Riders':
    'Terror From Above — the enemy’s strongest front-line unit fights ×0.85. Acid Spit — a pre-battle strike on one enemy unit (2–5), one chance in two whatever the commander’s Druid.',
  'Orc Garrison':
    'Bloodthirsty — defending, ×1.15 facing foot. Raiders’ Muster — an orcish province that sees an orc realm win there gains a Goblin Horde in its garrison at turn’s end, for nothing.',
  'Orcish Longships':
    'Reaver Crews — the whole force fights at +25% in any battle the phase it lands from these ships, even if another hero takes command of the combined host.',
  'Whale Cohort': 'Breach and Swamp — 25% chance each to sink one enemy fleet outright before the battle is fought.',
  // ── Creature / Monster / primal army abilities ── Each carries an always-on signature multiplier
  // PLUS a pre-battle strike (fires in the pre-battle magic phase; its chance rises with the
  // commanding hero’s Druid skill — 30% base, +10% per level, hard cap 90%; see primalStrikeChance (the winged riders’ own strikes: a flat 50%, 2026-10-11)
  // in the GM portal. 2026-09-27: this comment read "20% base" and had done for some time.
  // (The Noble Griffons' blurb is with the other human units above: a second key here would silently replace it.)
  Thunderbirds:
    'Storm Wings — every enemy unit in the air fights ×0.85. Lightning Strike: a pre-battle strike on one enemy unit (4–8). Storm-birds of the high crags that fight from the air, taking no place in the line.',
  'Forest Ents':
    'Rooted — never hit from the side when the enemy line wraps their end. Choking Spores: a pre-battle strike across the whole enemy line (2–4 each). At home in forest and jungle (terrain ×1.15), withering in the desert.',
  'Stone Giants':
    "Boulder Wall — cavalry facing them fights at no better than ×0.75 (the Unicorn Herd's Purity breaks it). Boulder Barrage: a pre-battle strike that shatters one enemy unit (4–7). At home in the mountains (terrain ×1.15); slow.",
  'Cave Trolls':
    'Regenerating Hide — after a lost battle, a 30% chance to shrug off a death roll. Hurled Rubble: a pre-battle strike on one enemy unit (4–7). At home in the mountains and the forest (terrain ×1.15 and ×1.1).',
  'Manticore Pride':
    'Relentless Hunt — ×1.25 strength when their side is the attacker, and when at least half the winning force are Manticores the beaten foe takes +15% rout losses. Spine Volley: a pre-battle strike across every enemy unit (2–4 each). Fights from the air.',
  'Basilisk Brood':
    'Stone Deterrent — ×1.25 strength when their side is defending. Petrifying Gaze: a pre-battle strike across the whole enemy line (2–4 each).',
  'Crimson Rocs':
    'Air Superiority — ×1.3 strength when the enemy fields ranged troops. Thunderous Stoop: a pre-battle strike scatters one enemy unit (5–9). Fights from the air, taking no place in the line.',
  'Elder Dragons':
    'Wyrmscale — ×1.25 strength in every battle. Dragonfire Breath: a pre-battle strike that washes every enemy unit in fire (3–6 each). Fights from the air, taking no place in the line.',
  'Titan Warbeasts':
    'Colossal Bulk — fights from the second line at full strength. World-Shaking Charge: a pre-battle strike that unbalances every enemy unit (3–6 each). At home on the plain and in the desert (terrain ×1.1).',
  'Sea Giants':
    'Tidal Might — ×1.2 strength in a coastal land province (one bordering the sea). Tidal Surge: a pre-battle strike on one enemy unit (4–8).',
  'Eldritch Kraken':
    'Deepwater Grasp — ×1.35 strength at sea. Crushing Coils: a pre-battle strike that drags one enemy unit under (5–9).',
  'Dread Hydras':
    'Many Heads — ×1.25 facing foot. Venom Breath: a pre-battle strike across the whole enemy line (3–6 each). The greatest of the Monsters, at home in jungle and forest (terrain ×1.1 and ×1.05).',
  'Shark Shoals':
    'Shoal Swarm — +10% strength per other Shark Shoals in the force, to +30%. Feeding Frenzy — when at least half the winning force are shoals, a foe beaten at sea takes +15% rout losses. A shoal is no hull: it carries nothing.',
  'Great Bears':
    'Maul — ×1.15 facing foot. Thick Hide — pre-battle volleys against them do half. At home in forest and mountain (terrain ×1.1), poor in the desert; move 3.',
  'Unicorn Herd':
    'Purity — ×1.25 facing Monsters and skeletons, and it breaks a Spear Hedge or a Boulder Wall (no ×0.75 cap). Through the Glades — the one cavalry, with the Stag Riders, that takes a flank in forest and jungle. At home on the plain and in the forest (terrain ×1.1).',
  'Mammoth Host':
    'Trample — ×1.15 facing foot. Stampede: a pre-battle strike across the whole enemy line (2–4 each). At home on the open plain (terrain ×1.1), ill at ease under trees; slow.',
  'Great Turtles':
    'Island Back — carries two land units a hull, where a fleet carries one. Shell Wall — immune to pre-battle volleys, as the Ironclads. Island-backed turtles of the prosperous seas that swim under their own power; slow.',
};
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
