import { kcArg, kcHtml, type KcSafeHtml } from '../shared/kc-safe.ts';
import { KC_HEX_DIRS, KC_TEMPERS, KC_MAGIC_SCHOOLS } from '../../content/kingdoms-call-data.ts';
import { SKILL_LABELS } from './the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts';
import {
  theCombatSpellsBySchool,
  theHexNextToAProvinceInADirection,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { kcJoinP } from './a-list-of-kchtml-pieces-joined-by-a-separator.ts';
import {
  PO_SEA_TYPES,
  poSeaAnalysis,
  type ACompanyAsTheFormCarriesIt,
  type TheLevelsBySkill,
} from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';
import {
  getOrderTarget,
  predictedLocation,
  projectedMoveHost,
  theValueOfAField,
} from './the-orders-the-form-holds-handed-to-its-forecasts.ts';

/** A hero as the Move notice reads him: his name, the companies he leads and his Naval level. */
interface AHeroAsTheMoveNoticeReadsHim {
  readonly name?: string | undefined;
  readonly armies?: readonly ACompanyAsTheFormCarriesIt[] | null | undefined;
  readonly skills?: TheLevelsBySkill | null | undefined;
}
/** A province as the Move notice reads it (a worldMeta province, or only its id and name). */
interface AProvinceAsTheMoveNoticeReadsIt {
  readonly terrain?: string | undefined;
  readonly name?: string | undefined;
}
/** The column a hero marches with at a phase, as the forecasts give it (projectedMoveHost). */
interface TheColumnAsTheMoveNoticeReadsIt {
  readonly armies: readonly ACompanyAsTheFormCarriesIt[];
  readonly uncounted: readonly string[];
  readonly gained: number;
  readonly base: number;
  readonly sameFrom?: readonly string[] | undefined;
}
/** A hero as the succession panel and the hero order read him. */
interface AHeroAsTheSuccessionReadsHim {
  readonly id?: unknown;
  readonly name?: string | undefined;
  readonly temper?: string | undefined;
  readonly isKing?: unknown;
  readonly _isHeir?: unknown;
  readonly _heirBase?: TheLevelsBySkill | null | undefined;
  readonly skills?: TheLevelsBySkill | null | undefined;
}
/** A province's row on the map, read where an older report may lack it (the map's province type holds one). */
function theRowOf(p: { readonly row?: number | null | undefined }): number | null | undefined {
  return p.row;
}
/** The skills' names, read by any skill. */
const theSkillsNames: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
/** The hero's name, read where the notice reads it: a TypeError for no hero, as the read on none threw. */
function theNameOfTheHero(ch: AHeroAsTheMoveNoticeReadsHim | null | undefined): string | undefined {
  if (ch === null || ch === undefined) throw new TypeError(`Cannot read properties of ${String(ch)} (reading 'name')`);
  return ch.name;
}
/** A Move order's target in words (the field's value, else ''): a TypeError for one that isn't words, as its `trim`
 *  threw. */
function theTargetOfTheOrderInWords(charId: unknown, ph: number): string {
  const target = getOrderTarget(charId, ph);
  if (typeof target !== 'string') throw new TypeError("the order's target has no trim: it is not words");
  return target;
}
/** The orders as held (words of JSON, or the object), read for its hero order: a TypeError for none, as the read did. */
function theHeroOrderHeld(r: unknown): unknown {
  if (r === null || r === undefined) throw new TypeError(`Cannot read properties of ${String(r)} (reading 'heroOrder')`);
  return Reflect.get(Object(r), 'heroOrder');
}
/** The orders as handed, else an empty object (`existingOrders || {}`). */
function theOrdersOrNone(existingOrders: unknown): unknown {
  if (existingOrders) return existingOrders;
  return {};
}

// The notice shown under a Move order's dropdown: what kind of move this is, and a warning when the
// column cannot be carried to a sea province. `destProv` is a worldMeta province (may be undefined
// for an unmapped hex, in which case only the column's own capability is described).
export function poMoveModeNote(
  ch: AHeroAsTheMoveNoticeReadsHim | null | undefined,
  destProv: AProvinceAsTheMoveNoticeReadsIt | null | undefined,
  host: TheColumnAsTheMoveNoticeReadsIt | null | undefined,
  fromProv: AProvinceAsTheMoveNoticeReadsIt | null | undefined,
): KcSafeHtml {
  const H: TheColumnAsTheMoveNoticeReadsIt = host ?? {
    armies: (ch?.armies ?? []).map((a) => ({ ...a })),
    uncounted: [],
    gained: 0,
    base: (ch?.armies ?? []).length,
  };
  const A = H.armies;
  const an = poSeaAnalysis(A, Number(ch?.skills?.['naval']) || 0);
  const destSea = destProv?.terrain === 'sea';
  const destKnown = Boolean(destProv?.terrain);
  // Where the column SETS OUT FROM at this phase — after any earlier move this turn, not where the
  // hero stands now (2026-09-27, Toby item 6). Needed because the land→land ban on naval units only
  // bites when the leg starts on land.
  const fromSea = fromProv?.terrain === 'sea';
  const fromKnown = Boolean(fromProv?.terrain);
  // One footnote for every verdict: what the count is based on, and what could not be counted.
  const _foot = (() => {
    const bits: (string | KcSafeHtml)[] = [];
    const diff = A.length - (H.base || 0);
    const _same = H.sameFrom ?? [];
    if (diff !== 0 || H.gained)
      bits.push(
        `counting your ${_same.length ? `orders this turn, including this phase's hand-overs (${_same.join('; ')} — these resolve before any move)` : 'earlier orders this turn'} — ${String(A.length)} unit${A.length !== 1 ? 's' : ''} under command by then${diff > 0 ? ` (${String(diff)} more than now)` : diff < 0 ? ` (${String(-diff)} fewer than now)` : ''}`,
      );
    if (H.uncounted.length)
      bits.push(
        kcHtml`<strong>not counted:</strong> ${H.uncounted.join(', ')} — there is no telling in advance what they will bring`,
      );
    return bits.length ? kcHtml`<div style="opacity:.85;margin-top:2px">${kcJoinP(bits, ' · ')}.</div>` : '';
  })();
  const box = (bg: string, bd: string, fg: string, html: KcSafeHtml) =>
    kcHtml`<div style="font-size:.72rem;color:${fg};background:${bg};border:1px solid ${bd};border-radius:2px;padding:3px 6px;margin-top:3px">${html}${_foot}</div>`;
  const good = (h: KcSafeHtml) => box('#eaf5e2', '#7ea45f', '#1f4410', h);
  const warn = (h: KcSafeHtml) => box('#fff3e0', '#e0b070', '#7a3c00', h);
  const bad = (h: KcSafeHtml) => box('#fdeaea', '#c06060', '#7a1010', h);
  const where = destProv ? kcHtml` into <strong>${(destProv.name ?? '') || 'that province'}</strong>` : '';
  if (!A.length)
    return good(
      kcHtml`🚶 <strong>Solo ride</strong> — ${theNameOfTheHero(ch)} leads no troops${where}, and travels by land or takes passage over water freely.`,
    );
  // ── SHIPS CANNOT CROSS LAND (2026-09-27, Toby item 6) ───────────────────────────────────────────
  // The engine refuses a land→land step outright while the column leads ANY naval unit — fleet or
  // sea-beast, coastal or not ("cannot march overland while leading naval units"). The old note
  // said only that the hulls "can only follow along a coast", which read as though a coast-to-coast
  // march were legal; it is not, and the order was silently wasted. This is now a hard red warning,
  // raised BEFORE every other verdict so it cannot be buried, and it names the way out.
  const _navalAboard = an.hulls + an.seaBeasts;
  if (_navalAboard > 0 && !fromSea && !destSea && fromKnown && destKnown) {
    const _names = [...new Set(A.filter((a) => PO_SEA_TYPES.has(a.type)).map((a) => (a.unitName ?? '') || a.type))];
    return bad(
      kcHtml`⛔ <strong>This move will be refused — ships cannot cross land.</strong> ${theNameOfTheHero(ch)} would be marching from one land province${fromProv ? kcHtml` (<strong>${(fromProv.name ?? '') || 'here'}</strong>)` : ''} to another${where} while leading ${_navalAboard} naval unit${_navalAboard !== 1 ? 's' : ''} (${_names.slice(0, 3).join(', ')}${_names.length > 3 ? '…' : ''}). There is no coast-to-coast march for a fleet. Either <strong>Leave/Transfer</strong> the ships into this province's garrison in an earlier phase and march without them, or sail instead — from a land province a fleet may only move to an <strong>adjacent sea province</strong>.`,
    );
  }
  // A column that can fly crosses anything.
  if (an.allAerial)
    return good(
      kcHtml`🦅 <strong>Flying move</strong> — every unit is winged, so the column crosses land and sea alike and needs no fleet.`,
    );
  if (an.lifted)
    return good(
      kcHtml`🦅 <strong>Flying move</strong> — the ${an.flyers} humanoid flyer${an.flyers !== 1 ? 's' : ''} lift the whole column${where}; land and sea are both open to it.`,
    );
  if (an.allSea) {
    if (destSea) return good(kcHtml`⛵ <strong>Naval move</strong> — a fleet of ${an.total} at sea${where}.`);
    return fromSea
      ? good(
          kcHtml`⛵ <strong>Coastal landing</strong> — the fleet puts in${where}. A landing is only possible on a <strong>coastal</strong> province; an inland hex will turn it back.`,
        )
      : warn(
          kcHtml`⛵ <strong>Naval move</strong> — this column is all ships and sea-beasts. From a land province its only legal move is to an <strong>adjacent sea province</strong>; it cannot march overland.`,
        );
  }
  if (destSea) {
    if (an.cap !== 'land') {
      const carried = an.landCount;
      return good(
        kcHtml`⛵ <strong>Naval move</strong> — ${String(an.hulls)} hull${an.hulls !== 1 ? 's' : ''}${an.navalL8 ? ' (Naval 8: each carries double)' : ''}${an.flyers ? ` and ${String(an.flyers)} flyer${an.flyers !== 1 ? 's' : ''}` : ''} carry ${String(carried)} land unit${carried !== 1 ? 's' : ''} out to sea.`,
      );
    }
    return bad(
      kcHtml`⚠ <strong>Not enough lift for a sea crossing.</strong> ${theNameOfTheHero(ch)} leads ${String(an.landCount)} land unit${an.landCount !== 1 ? 's' : ''} but only ${String(an.hulls)} hull${an.hulls !== 1 ? 's' : ''}${an.flyers ? ` and ${String(an.flyers)} humanoid flyer${an.flyers !== 1 ? 's' : ''}` : ' and no flyers'}. About ${String(an.short)} unit${an.short !== 1 ? 's' : ''} would be left ashore${an.shortNames.length ? ` (${an.shortNames.slice(0, 3).join(', ')}${an.shortNames.length > 3 ? '…' : ''})` : ''}. Recruit or bring more ships, send the surplus elsewhere, or choose a land province.`,
    );
  }
  // Land destination (or an unmapped hex).
  const bits: string[] = [];
  if (an.aerial)
    bits.push(`${String(an.aerial)} winged unit${an.aerial !== 1 ? 's' : ''} march with the rest`);
  if (_navalAboard > 0) {
    // Reaching here means the hard case above did not apply: either the column sets out from SEA
    // (a legal coastal landing), or one of the two hexes is not mapped yet and the ban cannot be
    // confirmed — which is a risk worth naming.
    if (fromSea)
      return good(
        kcHtml`⛵ <strong>Coastal landing</strong>${where} — the ships put in and the land units come ashore.${bits.length ? ` (${bits.join('; ')}.)` : ''} Once ashore the column cannot march on while it still leads ships: leave them in the garrison first.`,
      );
    return warn(
      kcHtml`⚠ <strong>Land march with ships in the column.</strong> ${theNameOfTheHero(ch)} leads ${_navalAboard} naval unit${_navalAboard !== 1 ? 's' : ''}, and a column carrying ships or sea-beasts <strong>cannot step from one land province to another</strong> — if this leg turns out to start and end on land the order will be refused. Leave the hulls behind to march, or sail to an adjacent sea province.${bits.length ? ` (${bits.join('; ')}.)` : ''}`,
    );
  }
  return good(
    kcHtml`🛡 <strong>Land march</strong>${where}${destKnown ? '' : ' (destination not yet mapped)'}${bits.length ? ` — ${bits.join('; ')}.` : '.'}`,
  );
}
// The province a Move order SETS OUT from at this phase, with its terrain — predictedLocation gives
// only {id,name}, so the full worldMeta record is looked up for the terrain the note needs.
export function moveOriginProv(charId: unknown, ph: number) {
  const provs = currentReport?.worldMeta?.provinces ?? [];
  const loc = predictedLocation(charId, ph);
  if (!loc) return null;
  return provs.find((p) => p.id === loc.id) ?? { id: loc.id, name: loc.name };
}
// Recompute the notice under one Move order (the dropdown's onchange; later phases are rebuilt
// wholesale by onMoveEdited, which regenerates the note with them).
export function refreshMoveModeNote(charId: unknown, ph: number) {
  const charIdInWords = String(charId);
  const host = document.getElementById(`po-move-mode-${charIdInWords}-${String(ph)}`);
  if (!host) return;
  const ch = (currentReport?.characters ?? []).find((c) => String(c.id) === charIdInWords);
  if (!ch) {
    host.innerHTML = '';
    return;
  }
  const tgt = theTargetOfTheOrderInWords(charId, ph).trim();
  const provs = currentReport?.worldMeta?.provinces ?? [];
  let dest = null;
  if (tgt.startsWith('prov:')) {
    const id = parseInt(tgt.slice(5));
    if (!isNaN(id)) dest = provs.find((p) => p.id === id) ?? null;
  }
  host.innerHTML = String(poMoveModeNote(ch, dest, projectedMoveHost(charId, ph), moveOriginProv(charId, ph)));
}
// Every Move notice on the form, rebuilt. A Recruit, Pick Up, Leave/Transfer, Disband, rite or
// summoning in ANY phase — this hero's or another of the player's — changes the host a later move
// sets out with, so the notices are refreshed wholesale whenever an order changes rather than only
// when the move's own dropdown is touched.
export function refreshAllMoveModeNotes() {
  // an older report's list may hold a gap: the guard on it stays
  const chars: readonly ({ readonly id: unknown; readonly alive?: boolean | undefined } | null | undefined)[] =
    currentReport?.characters ?? [];
  chars.forEach((c) => {
    if (!c || c.alive === false) return;
    for (let p = 0; p <= 4; p++) {
      if (document.getElementById(`po-move-mode-${String(c.id)}-${String(p)}`)) refreshMoveModeNote(c.id, p);
    }
  });
}
// ── The direction a Move order should DEFAULT to (2026-09-26, Toby item 2) ────
// A fresh Move order opened North West every time, whatever the player had already ordered this
// turn, so a column marching east had to be re-pointed in every phase. It now opens on the compass
// direction of the most recent EARLIER move order this turn (the options carry absolute province
// ids, so the direction is recovered by matching the target against the six neighbours of wherever
// the character set out from). No earlier move — or that direction is off the map from here — and
// the list simply opens as it always did.
export function lastMoveDirOf(charId: unknown, beforePhase: number) {
  const report = currentReport;
  if (!report?.worldMeta) return null;
  const wm = report.worldMeta,
    cols = wm.cols,
    rows = wm.rows,
    provs = wm.provinces;
  const HEX = KC_HEX_DIRS.slice();
  let found: string | null = null;
  for (let ph = 0; ph < beforePhase; ph++) {
    const actionField = document.getElementById(`po-action-${String(charId)}-${String(ph)}`);
    const action = actionField ? theValueOfAField(actionField) : undefined;
    if (action !== 'Move') continue;
    const tgt = theTargetOfTheOrderInWords(charId, ph).trim();
    if (!tgt) continue;
    if (tgt.startsWith('dir:')) {
      const d = tgt.slice(4);
      if (HEX.includes(d)) found = d;
      continue;
    }
    if (!tgt.startsWith('prov:')) continue;
    const toId = parseInt(tgt.slice(5));
    if (isNaN(toId)) continue;
    const from = predictedLocation(charId, ph);
    if (!from) continue;
    const fp = provs.find((p) => p.id === from.id);
    if (!fp || theRowOf(fp) == null) continue;
    if (toId === fp.id) continue; // "stay here" is not a direction
    for (const d of HEX) {
      if (theHexNextToAProvinceInADirection(fp, d, cols, rows) === toId) {
        found = d;
        break;
      }
    }
  }
  return found;
}

// Encounter plan tactics (AK 5.0-5.8) How a commander answers the call to single combat at the
// start of an army battle.
export const DUEL_STANCES = [
  { code: 'challenge', label: '⚔ Challenge — ride out and demand single combat' },
  { code: 'accept', label: '🛡 Accept — will not initiate, but will answer a challenge' },
  { code: 'refuse', label: '🏳 Refuse — will not duel (−20% strength if challenged)' },
];
export const ENCOUNTER_TACTICS = [
  { code: 'ME', label: 'Melee — close and fight in hand-to-hand combat' },
  { code: 'FI', label: 'Fire Arrow — move to bow range and shoot (requires Archery skill; 2 arrows at Archery 3+)' },
  {
    code: 'CA',
    label:
      'Cast Spell — combat spells: Lightning Bolt, Fireball, Psychic Blast, Telekinetic Storm, Hand of Death, Curse, Control Undead, Holy Symbol, Spiritwrack, Mirror Image, Invisibility, Charm',
    hasSpell: true,
  },
  {
    code: 'CS',
    label:
      'Cast from School — during the pre-battle magic phase, cast a RANDOM battle spell from a chosen school (White, Elemental, Psychic or Necromancy)',
    hasSchool: true,
  },
  // Parley is withdrawn for now. `retired` keeps the label resolvable for an older Chronicle entry
  // while every picker below filters it out. Mirrors ENCOUNTER_TACTICS in the GM engine.
  { code: 'TA', label: 'Talk — attempt to negotiate or parley', retired: true },
  { code: 'ST', label: 'Steal — attempt to steal treasure (requires Thief skill)' },
  { code: 'FL', label: 'Flee — attempt to escape from the encounter (does not affect duels; see Duel stance)' },
  { code: 'SC', label: 'Scout — scout the lair for secrets and special functions', retired: true }, // withdrawn; mirrors SCOUT_ENABLED in the GM engine
];
// Encounter-valid spells: direct damage, debuffs, or Mirror Image
export const ENCOUNTER_VALID = theCombatSpellsBySchool();

// ── Royal succession skill allocation ────
// The crowned heir keeps their base skills; the player spends 4 points on top of that, max +2 into
// any single skill — exactly the join-screen rule (join skills add on top of the king's base
// {melee:2,archery:1,sage:1}). _heirBase is the untouchable floor.
export const HEIR_TEMPERS_LIST = KC_TEMPERS.slice();
export function heirBaseSkills(c: AHeroAsTheSuccessionReadsHim | null | undefined): TheLevelsBySkill {
  return c?._heirBase ?? c?.skills ?? {};
}
export function heirAddedTo(c: AHeroAsTheSuccessionReadsHim, skill: string) {
  const b = heirBaseSkills(c);
  return (Number(c.skills?.[skill]) || 0) - (Number(b[skill]) || 0);
}
export function heirTotalAdded(c: AHeroAsTheSuccessionReadsHim) {
  const b = heirBaseSkills(c),
    s = c.skills ?? {},
    keys = new Set([...Object.keys(s), ...Object.keys(b)]);
  let t = 0;
  keys.forEach((k) => {
    t += Math.max(0, (Number(s[k]) || 0) - (Number(b[k]) || 0));
  });
  return t;
}
export function heirPointsRemaining(c: AHeroAsTheSuccessionReadsHim) {
  return 4 - heirTotalAdded(c);
}

// Build the succession panel (name + temper + skill pips, styled like the join screen). Returns ''
// when the player has no heir awaiting setup.
export function heirSelectorHTML(chars: readonly AHeroAsTheSuccessionReadsHim[] | null | undefined) {
  const heir = (chars ?? []).find((c) => c._isHeir);
  if (!heir) return '';
  const remaining = heirPointsRemaining(heir);
  const pip = (skill: string) => {
    const lvl = Number(heir.skills?.[skill]) || 0; // resulting level (base + allocated)
    const added = heirAddedTo(heir, skill);
    const displayName = (theSkillsNames[skill] ?? '') || skill;
    const minusOff = added <= 0; // may not reduce below the crowned base
    const plusOff = remaining <= 0 || added >= 2; // 4-point budget, +2-per-skill cap
    return kcHtml`<div class="skill-pip">
      <button onclick="allocateHeirSkill(${kcArg(heir.id)},${kcArg(skill)},-1)" ${minusOff ? 'disabled' : ''}>−</button>
      <span class="sk-name" onmousemove="showSkillTip(event,${kcArg(skill)})" onmouseleave="hideSkillTip()">${displayName}</span>
      <span class="sk-val">${lvl}</span>
      <button onclick="allocateHeirSkill(${kcArg(heir.id)},${kcArg(skill)},1)" ${plusOff ? 'disabled' : ''}>+</button>
    </div>`;
  };
  const grid = kcHtml`<div class="skill-cols">${SKILL_COLUMNS.map(
    (col) => kcHtml`<div class="skill-col"><div class="skill-col-head">${col.head}</div>${col.skills.map(pip)}</div>`,
  )}</div>`;
  return kcHtml`<div style="background:#fff8e8;border:2px solid var(--gold);border-radius:3px;padding:10px 12px;margin-bottom:14px">
    <div style="font-family:'Cinzel',serif;font-size:.82rem;color:var(--gold);margin-bottom:4px">👑 Royal Succession — Name, Temper &amp; Skills</div>
    <div style="font-size:.76rem;color:#444;margin-bottom:8px">A new monarch has risen. Name them, choose their Temper, and spend their <strong>${remaining}</strong> remaining skill point${remaining !== 1 ? 's' : ''} before submitting orders. New skills take effect this turn — buy a magic school and you can cast from it right away.</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px">
      <label style="font-size:.74rem;color:#231e16">Name
        <input id="heir-name" value="${heir.name ?? ''}" maxlength="40" oninput="setHeirName(${kcArg(heir.id)},this.value)"
          style="margin-left:4px;font-size:.76rem;padding:3px 6px;border:1px solid var(--stone);border-radius:2px;width:200px">
      </label>
      <label style="font-size:.74rem;color:#231e16">Temper
        <select id="heir-temper" onchange="setHeirTemper(${kcArg(heir.id)},this.value)"
          style="margin-left:4px;font-size:.76rem;padding:3px 6px;border:1px solid var(--stone);border-radius:2px">
          ${HEIR_TEMPERS_LIST.map((t) => kcHtml`<option value="${t}"${heir.temper === t ? ' selected' : ''}>${t}</option>`)}
        </select>
      </label>
      <span class="pts-remaining" style="margin-left:auto">${remaining} point${remaining !== 1 ? 's' : ''} remaining</span>
    </div>
    ${grid}
  </div>`;
}

// ════
// HERO ORDER — players reorder their heroes in the orders column
// ════
// The ▲ ▼ buttons move the hero's whole CARD in the DOM rather than rebuilding the form, so every
// half-typed order, target and encounter plan in the column survives a reorder untouched. Any cards
// injected under a hero (a hired hero, a resurrection or charm pre-order) are siblings that follow
// their parent block, so they travel with it as a group — see heroGroupP().
export function heroOrderFromOrdersP(existingOrders: unknown) {
  try {
    const r: unknown =
      typeof existingOrders === 'string' ? JSON.parse(existingOrders || '{}') : theOrdersOrNone(existingOrders);
    const heroOrder = theHeroOrderHeld(r);
    return Array.isArray(heroOrder) && heroOrder.length ? heroOrder.map(String) : null;
  } catch {
    return null;
  }
}
export function applyHeroOrderP(
  chars: readonly AHeroAsTheSuccessionReadsHim[] | null | undefined,
  order: readonly unknown[] | null | undefined,
) {
  const list = [...(chars ?? [])];
  if (order?.length) {
    const rank = new Map(order.map((id, i) => [String(id), i]));
    list.sort((a, b) => (rank.get(String(a.id)) ?? 1e9) - (rank.get(String(b.id)) ?? 1e9));
    return list;
  }
  return list.sort((a, b) => (a.isKing || a._isHeir ? 0 : 1) - (b.isKing || b._isHeir ? 0 : 1));
}
export function heroBlocksP() {
  const form = document.getElementById('orders-form');
  return form ? [...form.querySelectorAll(':scope > .orders-char-block[data-hero]')] : [];
}
// A hero's block plus every element that follows it up to the next hero block — i.e. the injected
// hired-hero / resurrect / charm cards that `charBlock.after(card)` parked underneath it.
export function heroGroupP(block: Element) {
  const g = [block];
  let n = block.nextElementSibling;
  while (n && !(n.classList.contains('orders-char-block') && n.hasAttribute('data-hero'))) {
    g.push(n);
    n = n.nextElementSibling;
  }
  return g;
}
// The arrangement as it stands right now: read from the DOM when the editable column is on screen,
// otherwise the last known copy (the read-only submitted view has no hero blocks to read).
export function currentHeroOrderP() {
  const fromDom = heroBlocksP().map((b) => b.getAttribute('data-hero'));
  return fromDom.length ? fromDom : (_heroOrder ?? []).slice();
}
// Re-disable the first ▲ and the last ▼ after every move.
export function refreshHeroMoveButtonsP() {
  const blocks = heroBlocksP();
  blocks.forEach((b, i) => {
    const up = b.querySelector('.hero-move-up'),
      dn = b.querySelector('.hero-move-down');
    if (up instanceof HTMLButtonElement) up.disabled = i === 0;
    if (dn instanceof HTMLButtonElement) dn.disabled = i >= blocks.length - 1;
  });
}

// ONE row renderer for the encounter plan, used by the initial build AND refreshEncounterPlan. ▲/▼
// buttons give touch devices — which have no HTML5 drag — the same reordering.
export function epRowHtml(charId: unknown, t: string, i: number, n: number) {
  return kcHtml`<div draggable="true" data-char="${charId}" data-idx="${i}"
      ondragstart="epDragStart(event,${kcArg(String(charId))},${kcArg(i)})"
      ondragover="event.preventDefault();this.style.outline='2px solid var(--crimson)'"
      ondragleave="this.style.outline=''"
      ondrop="epDropTactic(event,${kcArg(String(charId))},${kcArg(i)});this.style.outline=''"
      style="display:flex;align-items:center;gap:6px;background:#fdf8ee;border:1px solid var(--stone);border-radius:2px;padding:4px 8px;cursor:grab">
      <span style="color:#bbb;font-size:.9rem;cursor:grab" title="Drag to reorder">⠿</span>
      <span style="font-family:'Cinzel',serif;font-size:.72rem;color:var(--stone);min-width:16px">${i + 1}.</span>
      <span style="font-size:.8rem;flex:1">${tacticLabel(t)}</span>
      <button type="button" onclick="epMoveTactic(${kcArg(String(charId))},${kcArg(i)},-1)" ${i === 0 ? 'disabled' : ''} title="Move up" style="background:var(--parchment-dark);border:1px solid var(--stone);border-radius:2px;padding:1px 5px;cursor:pointer;font-size:.7rem">▲</button>
      <button type="button" onclick="epMoveTactic(${kcArg(String(charId))},${kcArg(i)},1)" ${i >= n - 1 ? 'disabled' : ''} title="Move down" style="background:var(--parchment-dark);border:1px solid var(--stone);border-radius:2px;padding:1px 5px;cursor:pointer;font-size:.7rem">▼</button>
      <button type="button" onclick="removeEncounterTactic(${kcArg(String(charId))},${kcArg(i)})" style="background:var(--crimson);color:#fff;border:none;border-radius:2px;padding:1px 6px;cursor:pointer;font-size:.7rem">✕</button>
    </div>`;
}

export function tacticLabel(code: string) {
  if (code.startsWith('CA:')) {
    const spell = code.slice(3);
    return `Cast Spell — ${spell}`;
  }
  if (code.startsWith('CS:')) {
    const school = code.slice(3);
    return `Pre-battle: random ${(theSkillsNames[school] ?? '') || school} spell`;
  }
  const baseCode = code.split(':')[0];
  return (ENCOUNTER_TACTICS.find((et) => et.code === baseCode)?.label ?? '') || code;
}

export function refreshEncounterPlan(charId: unknown, tactics: readonly string[]) {
  const list = document.getElementById(`ep-list-${String(charId)}`);
  if (!list) return;
  list.innerHTML = String(kcHtml`${tactics.map((t, i) => epRowHtml(String(charId), t, i, tactics.length))}`);
}
// Column grouping for the join screen: martial | special | magic
export const SKILL_COLUMNS = [
  { head: '⚔ Martial', skills: ['melee', 'archery', 'tactical', 'march', 'naval'] },
  { head: '✦ Special', skills: ['sage', 'spy', 'thief', 'druid', 'explorer'] },
  { head: '✨ Magic', skills: KC_MAGIC_SCHOOLS.slice() },
];
