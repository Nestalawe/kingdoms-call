// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import {
  KC_GRAND_DESIGNS,
  KC_ITEM_SLOT_CAP,
  KC_RUMOUR_COST_BY_POWER,
  KC_SEASONS,
} from '../../content/kingdoms-call-data.ts';
import { itemRaceOf, itemSlot, itemUsableBy } from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { L79_ORDERS } from './l79-orders.ts';
import { _tintForDarkTooltip, reportColour } from './map-symbols.ts';

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
export function realmOptStyleP(playerIdx, report) {
  const k = realmOfP(playerIdx, report);
  return k && k.color ? kcHtml` style="color:${reportColour(k.color)};font-weight:600"` : '';
}
// ── WHOSE HERO WAS THIS? (2026-09-27, Toby item 10) ────
// Resurrect will raise only your OWN fallen and true wanderers — a body that ever served another
// crown is refused — so every place a dead hero is shown must say which realm held them when they
// fell. `player` is null for a hero who never served anyone. `opts.dark` tints for the map tooltip's
// dark background; `opts.bare` drops the leading em-dash for callers that supply their own.
export function deadHeroRealmTagP(h, report, opts) {
  opts = opts || {};
  const rep = report || currentReport || {};
  const own = rep.playerIndex != null ? rep.playerIndex : null;
  const lead = opts.bare ? '' : '— ';
  if (h && h.player == null) return `${lead}a neutral hero, sworn to no crown`;
  if (h && own != null && h.player === own) return `${lead}your own hero`;
  const k = realmOfP(h ? h.player : null, rep);
  const nm = (k && k.name) || 'another realm';
  const col = k && k.color ? (opts.dark ? _tintForDarkTooltip(k.color) || '#e8b84b' : reportColour(k.color)) : null;
  return kcHtml`${lead}a hero of <span style="${col ? `color:${col};` : ''}font-weight:600">${nm}</span>`;
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
export const RUMOUR_COST_BY_POWER_P = { ...KC_RUMOUR_COST_BY_POWER }; // keep in step with the GM portal's RUMOUR_COST_BY_POWER
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
export const ACTIONS = [
  'Move',
  'Explore',
  'Search Lair',
  'Hunting Rumours',
  'Recruit Armies',
  'Hire Hero',
  'Release Hero',
  'Encounter Character',
  'Steal',
  'Disband Army',
  'Leave/Transfer Army',
  'Pick Up Army',
  'Send Item',
  'Cast Spell',
  'Use Item',
  'Equip Items',
  'Spy',
  'Practice Skill',
  'Research',
  'Perform Rite',
  'Consecrate',
  'Call to Arms',
  'Broker',
  'Harvest the Field',
  'Sabotage',
  'Forced March',
  'Grand Heist',
  'Awaken Grove',
  'Chart the Unknown',
  'Discover Lost Ruin',
  'Blockade',
  'Research Breakthrough',
  'Assassinate',
  'Vanish',
  'Challenge',
  'Rampage',
  'Rain of Arrows',
  "Sniper's Mark",
  'Feigned Retreat',
  'Grand Stratagem',
  'Lightning Advance',
  'Raid the Coast',
  'Wild Calling',
  'Grand Design',
  'Defend',
  'Rest',
];
// Alignment-signature actions: shown only to the realm that owns them (and Perform Rite joins the
// same gating — no more dangling Pagan action in every dropdown). King-only actions are hidden from
// heroes' dropdowns entirely.
export const ALIGN_ACTIONS = {
  'Perform Rite': 'Pagan',
  Consecrate: 'Divine',
  'Call to Arms': 'Good',
  Broker: 'Neutral',
  'Harvest the Field': 'Undead',
}; // Druidic and Evil have no signature order since 2026-10-12 (item 22)
// King-only actions — the engine rejects these from a hero, so they are hidden from heroes'
// dropdowns entirely (Consecrate is king-only: only the anointed crown can hallow ground — see the
// engine handler).
export const KING_ONLY_ACTIONS = new Set(['Call to Arms', 'Broker', 'Consecrate']);
// ── THE SEVEN WONDERS ────
// One per alignment, mirroring _GD_DEFS in the GM engine. Keep the two in step: the engine decides
// what the Wonder DOES, this decides what the player is told it will do before they spend the order.
export const GD_BY_ALIGNMENT = { ...KC_GRAND_DESIGNS };
// 2026-09-27 (Toby item 4): ONE Wonder per realm, ever. The engine pushes the discovery with id 'gd'
// and refuses a second outright, so once it is there the order is withdrawn from every hero of the
// realm rather than being offered and then rejected at resolution.
export function gdAlreadyBuiltP(report) {
  const r = report || currentReport || {};
  return (r.discoveries || []).some((d) => d && d.id === 'gd');
}
// The Grand Design hint for the reader's own realm, naming the Wonder they would actually raise.
export function gdHintFor(report) {
  const r = report || currentReport || {};
  const al = (r.kingdom && r.kingdom.alignment) || null;
  const gd = al ? GD_BY_ALIGNMENT[al] : null;
  if (!gd) return L79_ORDERS['Grand Design'].hint;
  return kcHtml`Sage 9 · ONCE EVER, and only in a province you hold. Your ${al} realm raises the <strong>${gd.name}</strong> — ${gd.desc} The Wonder stands in the province it is built in: hold that ground and its blessing flows, lose the province and the blessing lapses until you take it back. The Wonder itself is never destroyed, and a conqueror gains nothing from it but the view.`;
}
export const rawSkillLvl = (charObj, sk) => ((charObj && charObj.skills) || {})[sk] || 0;
// ── A CHARACTER WHOSE SHEET THE PLAYER CANNOT READ ──────────────────────────────────────────────
// Two pre-order cards carry one: a hero being HIRED this turn (`_unknownSkills` — the GM ships only
// their fame, never their levels) and a hero being CHARMED (`_hiddenSkills` — you have borrowed a
// mind, not read a life; their pack is not yours to rummage). For every order field the two mean the
// same thing: the placeholder's `skills:{}` and `items:[]` are NOT facts about the character, they are
// an ABSENCE of information. So nothing may be printed that is computed from them — no level, no
// level-derived percentage, no greyed-out tier, no "you have no Thief skill", and no claim that a pack
// is empty. Offer the full choice and let the engine judge at resolution.
// 2026-09-24 (Toby): these two flags had drifted badly apart — each was patched at a different site on
// a different day, so gates closed for a hired hero stood wide open for a charmed one (the Steal and
// Spy percentages, the Research and Explore notes, and the whole L7/L9 set). ONE
// predicate now serves every site. Add future gates through it; never test either flag directly.
export const skillsUnseenP = (c) => !!(c && (c._hiddenSkills || c._unknownSkills));
// …and the two reasons, phrased for the player. `hidden` never becomes visible; `unknown` does, next turn.
export const unseenSuffixP = (c) =>
  c && c._unknownSkills
    ? `${(c && c.name) || 'this hero'}’s level is not known until they have joined`
    : `${(c && c.name) || 'this hero'}’s level is hidden from you`;
// dropdown display order — most-used orders near the top, and any alignment-signature order
// (Broker, Consecrate, Call to Arms, Perform Rite, Harvest the Field)
// pinned to the VERY TOP (each is only shown to its own realm, so this simply puts a realm's special order
// first when it appears). Mastery (L7/L9) orders sink to the bottom as rare, situational picks.
// Adjust freely — this array is the single source of the ordering.
export const ACTION_DISPLAY_ORDER = [
  // ── SPECIAL actions the character can take — pinned to the very top ── Alignment-signature
  // orders (each shown only to its own realm)…
  'Broker',
  'Consecrate',
  'Call to Arms',
  'Perform Rite',
  'Harvest the Field',
  // …and MASTERY (L7/L9) orders, which surface only when the hero's skill is high enough.
  // actionsFor() already filters both groups down to what THIS character actually qualifies for, so
  // only the specials available to them appear here.
  'Sabotage',
  'Forced March',
  'Grand Heist',
  'Awaken Grove',
  'Chart the Unknown',
  'Discover Lost Ruin',
  'Blockade',
  'Research Breakthrough',
  'Assassinate',
  'Vanish',
  'Challenge',
  'Rampage',
  'Rain of Arrows',
  "Sniper's Mark",
  'Feigned Retreat',
  'Grand Stratagem',
  'Lightning Advance',
  'Raid the Coast',
  'Wild Calling',
  'Grand Design',
  // ── Everyday orders — exact order requested ──
  'Move',
  'Practice Skill',
  'Research',
  'Cast Spell',
  'Explore',
  'Search Lair',
  'Hunting Rumours',
  'Recruit Armies',
  'Pick Up Army',
  'Leave/Transfer Army',
  'Disband Army',
  'Hire Hero',
  'Release Hero',
  'Defend',
  'Encounter Character',
  'Spy',
  'Send Item',
  'Use Item',
  'Equip Items',
  'Steal',
  'Rest',
];
export const _actionRank = (a) => {
  const i = ACTION_DISPLAY_ORDER.indexOf(a);
  return i < 0 ? ACTION_DISPLAY_ORDER.length : i;
};
export function actionsFor(c) {
  const align = currentReport?.kingdom?.alignment;
  return ACTIONS.filter((a) => {
    if (ALIGN_ACTIONS[a] && ALIGN_ACTIONS[a] !== align) return false;
    if (KING_ONLY_ACTIONS.has(a) && !(c && c.isKing)) return false;
    // 2026-09-24 (Toby): a character whose sheet you cannot read gets NO mastery orders at all.
    // Item 8 had offered the whole L7/L9 set to such a card — since the levels are unseen, filtering
    // by level would have leaked them. But offering all twenty is its own leak in reverse: a player
    // could fish for hidden mastery by ordering Assassinate / Grand Heist / Wild Calling and reading
    // the result. Mastery is the mark of a hero who has served under you; it is not on the table for a
    // hero still being hired, nor for a mind you have merely charmed. A charmed WANDERER who joins
    // for good is an ordinary hero from next turn and the level gate below applies as usual.
    if (L79_ORDERS[a] && skillsUnseenP(c)) return false;
    // 2026-09-27 (Toby item 4): a realm raises ONE Grand Design in the whole game. Once the Wonder
    // stands, the order leaves every hero's dropdown — the engine already refuses a second, and an
    // order that can only ever be refused should not be on the form.
    if (a === 'Grand Design' && gdAlreadyBuiltP(currentReport)) return false;
    if (L79_ORDERS[a] && !skillsUnseenP(c) && rawSkillLvl(c, L79_ORDERS[a].skill) < L79_ORDERS[a].lvl) return false;
    // Research (Sage 1+) and Steal (Thief 1+) are gated on the character's BASE skill, matching the
    // engine (`case 'research'` / `case 'steal'` both read the raw level). A CHARMED hero is the
    // one exception: the charmer cannot see their levels, so the placeholder card carries
    // `skills:{}` and every raw lookup returns 0 — which silently stripped both orders from a hero
    // who may well have the training. Offer them and let the engine enforce the real requirement at
    // resolution.
    if (a === 'Research' && !skillsUnseenP(c) && rawSkillLvl(c, 'sage') < 1) return false; // Research: Sage 1+ only (discovery roll)
    if (a === 'Steal' && !skillsUnseenP(c) && rawSkillLvl(c, 'thief') < 1) return false; // Steal: Thief 1+ only — light fingers take training
    if (a === 'Release Hero' && c && c.isKing) return false; // a king cannot release himself
    // ── A CHARMED HERO AND ITEMS: NONE OF IT ──────────────────────────────────────────────────────
    // 2026-09-12 hid Send Item from a charmed hero; 2026-09-18 replaced that with ONE engine-chosen
    // Send Item per turn; 2026-09-24 (Toby) SUPERSEDES both and settles the rule the other way, for
    // every direction items could travel: a charmed hero may not be GIVEN items, may not USE an item,
    // and may not SEND one to anybody. An enchanter borrows a mind for a season — they do not gain a
    // quartermaster. Nothing about the hero's own gear changes: they keep it, they fight with it, and
    // whatever passive magic they carry still works.
    // Enforced in the ENGINE too (give_item as sender AND as recipient, use_item — see isCharmedNow
    // in the GM portal), because a stale or hand-crafted submission would otherwise walk straight
    // past this form-level gate. Equip Items is deliberately left: it addresses the hero's OWN gear,
    // and the form can only ever show it as "not yours to see", so there is nothing to order.
    if (c && c._hiddenSkills && (a === 'Send Item' || a === 'Give Item' || a === 'Use Item' || a === 'Release Hero'))
      return false;
    // an ENEMY hero whose command you have seized for the turn is held by an enchantment, not an
    // oath — they will not disband companies that are not theirs, perform your realm's alignment
    // rites, or spend their own mastery for you. The engine refuses these orders at resolution too
    // (see the _charmTempControl guard in processOrder); this keeps them off the form. A WANDERING
    // hero charmed into permanent service has genuinely joined the realm and is unrestricted.
    if (c && c._charmEnemy && (L79_ORDERS[a] || ALIGN_ACTIONS[a] || a === 'Disband Army')) return false;
    return true;
  }).sort((a, b) => _actionRank(a) - _actionRank(b));
}

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
