// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { KC_GRAND_DESIGNS, KC_ITEM_SLOT_CAP, KC_SEASONS } from '../../content/kingdoms-call-data.ts';
import { itemRaceOf, itemSlot, itemUsableBy } from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { L79_ORDERS } from './l79-orders.ts';
import { SKILL_LABELS } from './the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts';

// ── EQUIPMENT SLOTS — slot caps from the shared table in kingdoms-call-data.ts (KC_ITEM_SLOT_CAP) ──
export const ITEM_SLOT_CAP_P = { ...KC_ITEM_SLOT_CAP };
// Lair-guardian grade colours (map rings, lair cards, tooltips). One copy — it was typed four times.
export const GUARD_POWER_COLORS_P = { Weak: '#4a8a4a', Moderate: '#c8922a', Powerful: '#8a1c1c', Legendary: '#5a0a9a' };
export const ITEM_SLOT_LABEL_P = {
  weapon: 'Weapon',
  armour: 'Armour',
  shield: 'Shield',
  cloak: 'Cloak / clothing',
  helm: 'Helm / crown',
  ring: 'Rings (up to two)',
  amulet: 'Amulet / talisman',
  combat: 'Combat Items (up to two)',
};
export const ITEM_SLOT_ORDER_P = ['weapon', 'armour', 'shield', 'cloak', 'helm', 'ring', 'amulet', 'combat'];
// ── ONLY THE LIVING TAKE ORDERS ────
// `report.characters` deliberately carries a hero (or king) who FELL THIS TURN, so the Chronicle
// can still print their final section. Every ORDER form that lists characters as targets or
// recipients must therefore filter them out: a corpse cannot be handed an item, take command of
// armies, be mustered fresh recruits, or be the target of a spell. Resurrect is the one exception,
// and it works off knownDeadHeroes / the graveyard, never off this list.
// 2026-09-23 (Toby item 3): heroes on a PRE-ORDER card (hired_/resurrect_/charm_ placeholders) are
// in report.characters too. They may be named as a recipient (Send Item, Transfer Army, Muster to,
// Oratory…) only for a phase AFTER the one in which they join — before that they are not yet yours
// — and an ENEMY hero seized by Charm (who goes home at turn's end) never receives items or troops
// (opts.allowCharmEnemy lets a friendly spell reach them). The engine resolves these ids to the
// real hero and refuses the order if the hire / raise / charm did not land.
export function isPreOrderIdP(id) {
  return typeof id === 'string' && /^(?:hired|resurrect|charm)_\d+_via_/.test(id);
}
export function orderTargetCharsP(report, ph, opts) {
  return ((report && report.characters) || []).filter((x) => {
    if (!x || x.alive === false) return false;
    if (isPreOrderIdP(x.id)) {
      if (ph == null) return false;
      if (ph <= (x.hiredInPhase ?? -1)) return false;
      if (x._charmEnemy && !(opts && opts.allowCharmEnemy)) return false;
    }
    return true;
  });
}
// the suffix a pre-order hero carries in a recipient list, so the player knows it depends on the
// hire / raise / charm landing.
export function preOrderTagP(x) {
  if (!x || !isPreOrderIdP(x.id)) return '';
  const k = String(x.id).split('_')[0];
  return k === 'hired' ? ' — if the hire lands' : k === 'resurrect' ? ' — if raised' : ' — if charmed';
}
// ── REALM NAMES IN TARGET LISTS ────
// Every realm's name and colour ship on report.allKingdoms, so a rival's character is now labelled
// with their realm's name, and the <option> is tinted in that realm's colour (browsers honour an
// inline colour on <option> in the open list; the closed control shows plain text). A wandering
// hero has no realm and keeps its "(wandering)" label.
export function realmOfP(playerIdx, report) {
  const rep = report || currentReport || {};
  if (playerIdx == null) return null;
  return (rep.allKingdoms || []).find((k) => k && k.index === playerIdx) || null;
}
export function realmNameP(playerIdx, report) {
  const k = realmOfP(playerIdx, report);
  return k ? k.name : 'enemy';
}
// ── PACK ORDER ────
// A hero's pack is LISTED equipped-first, in slot order (weapon, armour, shield, cloak, helm,
// rings, amulet, combat items), with everything else — unequipped slot items, and the unslotted
// trinkets that are always active — below. DISPLAY ONLY: the returned array is a copy, because the
// Send Item order addresses items by their INDEX into the character's real `items` array and the GM
// engine splices by that same index. Reordering the underlying array would hand the wrong item to
// the courier, so nothing here ever touches `c.items`.
export function itemsForDisplayP(c) {
  const src = (c && c.items) || [];
  const rank = (it) => {
    const sl = itemSlot(it);
    const equipped = !!sl && it && it.equipped !== false && itemUsableBy(it, c);
    if (equipped) {
      const i = ITEM_SLOT_ORDER_P.indexOf(sl);
      return [0, i < 0 ? 99 : i];
    }
    return [1, sl ? ITEM_SLOT_ORDER_P.indexOf(sl) : 99];
  };
  return src
    .map((it, i) => ({ it, i, r: rank(it) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.i - b.i) // stable within a slot group
    .map((x) => x.it);
}
// FOUR item tiers, mirroring the GM engine - 1 Weak, 2 Moderate, 3 Powerful, 4 LEGENDARY. Since
// 2026-09-24 the tier says what an item is FOR as well as how strong it is: Weak = field and office kit
// that does nothing in a fight; Moderate = the first rung of combat kit; Powerful = the second. A lair
// holds exactly one item, of its own guardian's tier, so the tier a player is shown is the danger
// they beat for it. Only a legendary relic scores a point.
export const ITEM_TIER_NAME_P = { 1: 'Weak', 2: 'Moderate', 3: 'Powerful', 4: 'Legendary' };
// 2026-09-27 (Toby item 5): darkened for readability on parchment — the old tier pills (mid-green,
// tan, #b8860b goldenrod) and the gold item name sat at ~2.3:1 against #f2e8d0 and were hard to
// read. Every tier now clears 5:1, and the item name/description use --item-ink / --item-desc.
export const ITEM_TIER_COLOUR_P = { 1: 'var(--stone)', 2: '#2c4a1e', 3: '#6a3d08', 4: '#7a5806' };
// The small pill shown beside an item name wherever a pack is listed.
export function itemTierTagP(it) {
  const n = (it && it.tier) || 1;
  const leg = n === 4;
  return kcHtml`<span style="color:${ITEM_TIER_COLOUR_P[n]};font-weight:${leg ? 700 : 600};font-size:.9em">${leg ? ' \u2728 Legendary' : ' \u00b7 ' + ITEM_TIER_NAME_P[n]}</span>`;
}
// Small tag shown after an item name: its slot and whether it is currently worn/wielded. Item 4:
// race/alignment-bound items are inert in the wrong hands.
export function itemBoundTag(it, c) {
  if (!it || (!it.race && !it.alignment)) return '';
  const who = it.race ? `${itemRaceOf(it)} characters` : `${it.alignment} characters`;
  return itemUsableBy(it, c)
    ? ''
    : kcHtml` <span style="color:#7a1010;font-size:.72rem">[${who} only — unusable by this character]</span>`;
}
export function itemSlotTag(it, c) {
  // name the slot AND how many of that slot the character still has free.
  const sl = itemSlot(it);
  if (!sl) return kcHtml` <span style="color:#2a2419;font-size:.72rem">[carried — needs no slot]</span>`;
  const cap = ITEM_SLOT_CAP_P[sl] || 1;
  const used = c
    ? (c.items || []).filter((o) => o && itemSlot(o) === sl && o.equipped !== false && itemUsableBy(o, c)).length
    : it.equipped === false
      ? 0
      : 1;
  const free = Math.max(0, cap - used);
  const st = it.equipped === false ? 'not equipped' : 'equipped';
  return kcHtml` <span style="color:${it.equipped === false ? '#5b5b5b' : '#43350f'};font-size:.72rem">[${ITEM_SLOT_LABEL_P[sl]} slot — ${st} · ${free} of ${cap} free]</span>`;
}
// Hunting Rumours (2026-09-17 (late)): the ticked lairs → the hidden target field, comma-separated feature idx.
export function updateRumourTarget(charId, ph) {
  const wrap = document.getElementById(`po-rumour-wrap-${charId}-${ph}`);
  const hidden = document.getElementById(`po-target-${charId}-${ph}`);
  if (!wrap || !hidden) return;
  const boxes = [...wrap.querySelectorAll('input[type=checkbox]')];
  hidden.value = boxes
    .filter((b) => b.checked)
    .map((b) => b.value)
    .join(',');
  const tot = document.getElementById(`po-rumour-total-${charId}-${ph}`);
  if (tot) {
    let sum = 0;
    boxes
      .filter((b) => b.checked)
      .forEach((b) => {
        const m = (b.parentNode.textContent || '').match(/(\d+)g\s*$/);
        if (m) sum += parseInt(m[1]);
      });
    const cost = tot.querySelector('strong');
    if (cost) cost.textContent = `${sum}g`;
  } // the first <strong> is the cost of the ticked lairs
}
export function updateEquipTarget(charId, ph) {
  const wrap = document.getElementById(`po-equip-wrap-${charId}-${ph}`);
  const hidden = document.getElementById(`po-target-${charId}-${ph}`);
  if (!wrap || !hidden) return;
  const vals = [...wrap.querySelectorAll('select')].map((s) => s.value).filter(Boolean);
  hidden.value = [...new Set(vals)].join(',');
}

export const SEASONS = KC_SEASONS.slice();
export const DIRECTIONS = {
  NW: 'North West',
  NE: 'North East',
  W: 'West',
  E: 'East',
  SW: 'South West',
  SE: 'South East',
};
// ── THE SEVEN WONDERS ────
// One per alignment, mirroring _GD_DEFS in the GM engine. Keep the two in step: the engine decides
// what the Wonder DOES, this decides what the player is told it will do before they spend the order.
export const GD_BY_ALIGNMENT = { ...KC_GRAND_DESIGNS };
// The Grand Design hint for the reader's own realm, naming the Wonder they would actually raise.
export function gdHintFor(report) {
  const r = report || currentReport || {};
  const al = (r.kingdom && r.kingdom.alignment) || null;
  const gd = al ? GD_BY_ALIGNMENT[al] : null;
  if (!gd) return L79_ORDERS['Grand Design'].hint;
  return kcHtml`Sage 9 · ONCE EVER, and only in a province you hold. Your ${al} realm raises the <strong>${gd.name}</strong> — ${gd.desc} The Wonder stands in the province it is built in: hold that ground and its blessing flows, lose the province and the blessing lapses until you take it back. The Wonder itself is never destroyed, and a conqueror gains nothing from it but the view.`;
}
// ── SKILL ROW ────
// One renderer for both places a character's abilities are listed: the report's character card and
// the orders column. The GM ships `skillEff` for each character — base level, EFFECTIVE level, and
// the sources of the difference — computed by the same function the engine resolves turns with, so
// what is shown here IS what the turn will use. `combatSkillBonus` carries bonuses that apply only
// in personal combat (minor titles, Veteran Training); those are shown separately, because they do
// not change the skill itself. Falls back to the raw skills for an older report with no breakdown.
// style: 'tags' — the compact pills on the report card; 'inline' — the orders column's label list.
// …and the two reasons, phrased for the player. `hidden` never becomes visible; `unknown` does, next turn.
export const unseenSuffixP = (c) =>
  c && c._unknownSkills
    ? `${(c && c.name) || 'this hero'}’s level is not known until they have joined`
    : `${(c && c.name) || 'this hero'}’s level is hidden from you`;

// Declared globals (plan P1-09b): one binding the page's files and its tests share (ui/player/globals.ts says why).
globalThis.currentUser = null;
globalThis.currentProfile = null;
globalThis.joiningGame = null;
globalThis.joinSkills = {};
globalThis.currentGamePlayer = null;
globalThis.currentReport = null;
// Diplomacy (alliance system): pending declarations for THIS turn, keyed by rival realm index →
// 'treat' (propose alliance/peace) | 'enemy' (declare war). Submitted with orders; applied at end
// of turn (Evil/Undead war: at the start of the turn).
globalThis.diploChoices = {};
// Victory: whether the player is Calling the Reckoning this turn (king-only, when dominant).
// Submitted with orders.
globalThis.reckoningCall = false;
// the player's own arrangement of their heroes in the orders column, as an array of character ids
// (strings), most-recent order first-to-last. Players asked to be able to group similar heroes
// together while planning. Submitted with orders; the engine stores it on the realm
// (player.heroOrder) and hands it back on every later report, so the arrangement survives turn runs.
globalThis._heroOrder = [];
// the player may concede the game with their orders. Once the GM runs a turn with concede=true the
// realm is out for good — its heroes only Defend from then on.
globalThis.concedeGame = false;
// RESEARCH CHOICE (2026-09-21): a successful Research order turns up TWO discoveries; in the next
// turn's orders the player keeps one and the other is forgotten for good. Keyed by the pending
// pair's key → the kept discovery id. Submitted with orders as `discoveryChoices`.
globalThis.discoveryChoices = {};
export function _pendingDiscChoices() {
  return ((currentReport && currentReport.pendingDiscoveryChoices) || []).filter(
    (p) => p && p.key && Array.isArray(p.options) && p.options.length,
  );
}
export function discoveryChoiceBlockHTML() {
  const pend = _pendingDiscChoices();
  if (!pend.length) return '';
  return kcHtml`<div id="orders-discovery-top" class="orders-char-block" style="background:#f4f7ec">
      <div class="orders-char-head" style="background:#3e5a1c">
        <button type="button" class="sec-toggle" aria-expanded="true" title="Minimise / maximise" onclick="toggleSection(this)">&#9662;</button>
        💡 Research — choose which discover${pend.length !== 1 ? 'ies' : 'y'} to keep
      </div>
      <div id="orders-discovery-choice" style="padding:6px 10px 10px"></div>
    </div>`;
}
export function renderDiscoveryChoices() {
  const w = document.getElementById('orders-discovery-choice');
  if (!w) return;
  const pend = _pendingDiscChoices();
  w.innerHTML = kcHtml`<div style="font-size:.72rem;color:var(--stone);margin-bottom:6px">Your scholars turned up two leads for each discovery below, but only one can be pursued. Keep one — the other is <strong>forgotten for good</strong> and will never come up again. Left unchosen, one is kept at random.</div>${pend.map(
    (
      p,
      i,
    ) => kcHtml`<div style="${i ? 'border-top:1px solid var(--parchment-dark);margin-top:8px;padding-top:8px;' : ''}">
      <div style="font-family:Cinzel,serif;font-size:.78rem;font-weight:600;color:var(--ink);margin-bottom:4px">Found by ${p.charName || 'a scholar'}${p.category ? ` — ${p.category} research` : ''}${p.turn ? ` (turn ${p.turn})` : ''}</div>
      ${p.options.map(
        (
          o,
        ) => kcHtml`<label style="display:flex;align-items:flex-start;gap:8px;padding:5px 6px;margin:3px 0;border:1px solid ${discoveryChoices[p.key] === o.id ? 'var(--forest)' : 'var(--parchment-dark)'};border-radius:3px;background:${discoveryChoices[p.key] === o.id ? '#e8f1dc' : '#fffdf6'};cursor:pointer;font-size:.76rem;line-height:1.4">
          <input type="radio" name="dc-${p.key}" value="${o.id}" ${discoveryChoices[p.key] === o.id ? 'checked' : ''} onchange="setDiscoveryChoice(${kcArg(String(p.key))},${kcArg(String(o.id))})" style="margin-top:3px">
          <span><strong>${o.name}</strong> <span style="color:var(--stone)">(${o.category})</span><br>${o.desc}</span>
        </label>`,
      )}
    </div>`,
  )}`;
}
export function setDiscoveryChoice(key, id) {
  discoveryChoices[key] = id;
  renderDiscoveryChoices();
}
export function renderConcede() {
  const w = document.getElementById('concede-wrap');
  if (!w) return;
  const k = currentReport?.kingdom || {};
  if (k.conceded) {
    w.innerHTML = `<div style="background:#eee;border:1px solid #999;border-radius:3px;padding:6px 8px;color:#231e16">\u{1F3F3} <strong>Your realm has conceded.</strong> Your heroes hold their ground and take no further orders.</div>`;
    return;
  }
  w.innerHTML = concedeGame
    ? `<div style="background:#fdeaea;border:1px solid var(--crimson);border-radius:3px;padding:6px 8px">\u{1F3F3} <strong>You will CONCEDE the game with these orders.</strong> This cannot be undone once the turn runs. <button type="button" onclick="setConcede(false)" style="margin-left:6px;font-size:.7rem;padding:2px 8px;cursor:pointer">Cancel</button></div>`
    : `<button type="button" onclick="setConcede(true)" style="font-family:'Cinzel',serif;font-size:.66rem;padding:4px 10px;border:1px solid #999;background:#f4f0e6;color:#2a2419;border-radius:2px;cursor:pointer" title="Withdraw your realm from the game">\u{1F3F3} Concede the game\u2026</button>`;
}
export function setConcede(v) {
  if (
    v &&
    !confirm(
      'Concede the game?\n\nYour realm withdraws for good: from the turn this is submitted your heroes will only Defend, you send no private dispatches until the game is over, and you can never rejoin. If every other realm has conceded, or all those left are one alliance, the game ends at once and the results are shown.\n\nSubmit your orders to confirm.',
    )
  )
    return;
  concedeGame = !!v;
  renderConcede();
}
// Track recruit orders already placed in earlier phases (client-side) Compass direction from one
// province to another on the offset-hex map, used to label an as-yet unexplored target province as
// e.g. "Unknown province (West)" instead of a meaningless internal number. Rows shift by half a
// column with parity (pointy-top offset), and columns wrap around the map edge.
export function provDirectionLabel(fromId, toId, provs, cols) {
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

// Render the "Pre-battle magic" control for a character from its hidden ep-preschool field.
export function renderPreSchool(charId) {
  const disp = document.getElementById(`ep-preschool-display-${charId}`);
  const hidden = document.getElementById(`ep-preschool-${charId}`);
  if (!disp || !hidden) return;
  const school = (hidden.value || '').toLowerCase();
  if (school) {
    disp.innerHTML = kcHtml`<span style="display:inline-flex;align-items:center;gap:6px;background:#fff8e8;border:1px solid #c8922a;border-radius:2px;padding:3px 8px;font-size:.78rem">
        <span style="color:#5a4208">Random <strong>${SKILL_LABELS[school] || school}</strong> spell</span>
        <button onclick="clearPreSchool(${kcArg(String(charId))})" title="Remove" style="background:var(--crimson);color:#fff;border:none;border-radius:2px;padding:0 6px;cursor:pointer;font-size:.7rem">✕</button>
      </span>
      <button onclick="openPreSchoolPicker(${kcArg(String(charId))})" style="font-size:.7rem;padding:3px 8px;border:1px solid var(--stone);background:var(--parchment-dark);cursor:pointer;border-radius:2px">Change</button>`;
  } else {
    disp.innerHTML = kcHtml`<button onclick="openPreSchoolPicker(${kcArg(String(charId))})" style="font-size:.72rem;padding:3px 10px;border:1px solid var(--stone);background:var(--parchment-dark);cursor:pointer;border-radius:2px">+ Choose spell school</button>
      <span style="font-size:.72rem;color:#aaa">None set</span>`;
  }
}
