import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { KC_MAGIC_SCHOOLS, KC_SEASONS } from '../../content/kingdoms-call-data.ts';
import {
  combatSpellsAllowedPerSchoolEachFight,
  itemUsableBy,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { kcJoinP } from './a-list-of-kchtml-pieces-joined-by-a-separator.ts';
import {
  discoveryChoiceBlockHTML,
  isPreOrderIdP,
  itemBoundTag,
  itemsForDisplayP,
  itemSlotTag,
  itemTierTagP,
  renderConcede,
  renderDiscoveryChoices,
  SEASONS,
  renderPreSchool,
} from './items-and-heroes.ts';
import { renderReckoningOrders } from './titles.ts';
import { SPELL_TO_SCHOOL, unitEmoji } from './order-chances.ts';
import {
  DUEL_STANCES,
  ENCOUNTER_TACTICS,
  ENCOUNTER_VALID,
  applyHeroOrderP,
  heirSelectorHTML,
  heroOrderFromOrdersP,
  refreshAllMoveModeNotes,
  epRowHtml,
  heirAddedTo,
  heirPointsRemaining,
  heirTotalAdded,
  refreshEncounterPlan,
} from './move-analysis.ts';
import {
  refreshAllOncePerTurn,
  syncAllPreOrderCards,
  syncAllResurrectCards,
  syncResurrectCard,
  refreshLaterCastSpells,
  theEmptyHero,
} from './pre-orders.ts';
import {
  itemAcquiredTagP,
  itemLoreTip,
  restoreSubmitWrap,
  doSaveOrders,
  setOrdersSubmittedUI,
} from './briefing-and-submit.ts';
import { druidNeedP, formatRace, skillRowHTML, armyLabel } from './skills-and-projections.ts';
import { buildTargetField, refreshExploreNotes } from './order-targets.ts';
import { provLinkHtml, renderDiplomacy } from './map-symbols.ts';
import { effSkillP } from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';
import {
  actionsFor,
  computeOrderLedgerP,
  getOrderTarget,
  theValueOfAField,
} from './the-orders-the-form-holds-handed-to-its-forecasts.ts';
import {
  SKILL_LABELS,
  effMagicLvl,
  skillsUnseenP,
} from './the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts';
import { sb } from './startup.ts';
import { asItsGuardReadsIt } from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import { inWords } from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';
import type { AHeroAsThePreOrderCardsHoldHim, TheReportAsThePreOrderCardsHoldIt } from './pre-orders.ts';

/** A hero as the order form builds his block and the heir's points write his skills (P1-16h). */
export interface AHeroAsTheOrderFormBuildsHim extends AHeroAsThePreOrderCardsHoldHim {
  readonly hiredInPhase?: number | null | undefined;
  readonly effectiveSpeed?: number | null | undefined;
  readonly effectiveSeaSpeed?: number | null | undefined;
  readonly alignment?: string | null | undefined;
  skills?: Partial<Record<string, number>> | null | undefined;
  _pendingSkillAllocation?: unknown;
}
/** The report as the order form holds it: its heroes (which it orders and filters), the order of them the engine kept,
 *  and the fallen the read-only view names. */
export interface TheReportAsTheOrderFormHoldsIt extends TheReportAsThePreOrderCardsHoldIt {
  characters?: AHeroAsTheOrderFormBuildsHim[] | null | undefined;
  readonly heroOrder?: unknown;
  readonly graveyard?: readonly { readonly id?: unknown; readonly name?: string | undefined }[] | null | undefined;
}
/** An item the hero's block shows: the pack's item, with the words that describe it. */
interface AnItemTheFormShows extends NonNullable<ReturnType<typeof itemsForDisplayP>[number]> {
  readonly desc?: unknown;
}
/** `value[key]` as JavaScript reads it (a draft parsed from JSON): for none, the TypeError that read throws. */
function theDraftsField(value: unknown, key: string): unknown {
  if (value === null || value === undefined) {
    throw new TypeError(`Cannot read properties of ${String(value)} (reading '${key}')`);
  }
  return Reflect.get(Object(value), key);
}
/** `a || b` on values of any kind: `a` where it is truthy, else `b`. */
function thisOrThat(a: unknown, b: unknown): unknown {
  if (a) return a;
  return b;
}
/** Any value but none (`null` or `undefined`): what `x || {}` gives. */
type AValueButNone = string | number | boolean | bigint | symbol | object;
/** `x || {}` on a draft's part: itself where it is truthy, else an empty object. */
function itOrAnEmptyRecord(value: unknown): AValueButNone {
  if (value) return value;
  return {};
}
/** A saved list the form calls a list's method on: itself, and for any other value the TypeError that call threw. */
function theSavedList(value: unknown, what: string): readonly unknown[] {
  if (Array.isArray(value)) return value;
  throw new TypeError(`${what} is not a function`);
}
/** A phase's saved order as the target field reads it (its action, target and extra): an object as it is; any other
 *  value reads none of them, as an empty object does. */
function theSavedOrderAsTheFieldReadsIt(saved: AValueButNone): Parameters<typeof buildTargetField>[2] {
  return typeof saved === 'object' ? saved : {};
}
/** A saved tactic the code slices or tests the start of: words, handed back as they are; any other value throws the
 *  TypeError that call on it threw. */
function theSavedWords(value: unknown): string {
  if (typeof value === 'string') return value;
  throw new TypeError(`${typeof value} is not words: it has no startsWith or toLowerCase`);
}
/** The value of the page's field with the id `id`, as `document.getElementById(id)?.value` read it. */
function theValueOfThePagesFieldOrNone(id: string): unknown {
  const el = document.getElementById(id);
  return el ? theValueOfAField(el) : undefined;
}
/** The skills' names, read by any school. */
const theSkillsNames: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
/** A value the code reads a field of: itself, and for none the TypeError that read threw. */
function thereForItsField<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined)
    throw new TypeError(`Cannot read properties of ${String(value)} (reading '${what}')`);
  return value;
}

// ── TREASURY LEDGER (2026-09-23, Toby item 6) ────
export function renderOrderLedgerP(): void {
  const el = document.getElementById('orders-ledger');
  if (!el) return;
  if (!currentReport?.kingdom || !document.querySelector('#orders-form select[id^="po-action-"]')) {
    el.style.display = 'none';
    return;
  }
  const L = computeOrderLedgerP();
  const LBL: Readonly<Partial<Record<string, string>>> = {
    armies: '⚔ Armies',
    mercs: '🗡 Mercenaries',
    heroes: '🧙 Heroes',
    intel: '🕵 Intelligence',
    other: '✦ Rites',
  };
  const parts = Object.entries(L.cats)
    .filter(([, x]) => x.g > 0)
    .map(
      ([key, x]) =>
        kcHtml`<span style="white-space:nowrap">${LBL[key]} <strong>${x.g}g</strong>${x.n > 1 ? kcHtml` <span style="color:var(--stone)">(${x.n})</span>` : ''}</span>`,
    );
  const neg = L.left < 0,
    pneg = L.projected < 0;
  el.style.display = 'block';
  el.innerHTML = String(kcHtml`<div style="font-size:.78rem;line-height:1.45;padding:3px 2px 6px">
    <div style="display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline">
      <span>💰 Treasury <strong>${L.gold}g</strong></span>
      <span>Spent in orders <strong style="color:${L.spend > 0 ? '#8a1c1c' : 'inherit'}">${L.spend}g</strong></span>
      <span>Left <strong style="color:${neg ? '#c00' : 'var(--forest)'}">${L.left}g</strong></span>
    </div>
    ${parts.length ? kcHtml`<div style="display:flex;flex-wrap:wrap;gap:2px 10px;font-size:.72rem;margin-top:1px">${parts}</div>` : ''}
    ${neg ? kcHtml`<div style="font-size:.7rem;color:#c00;margin-top:2px">⚠ These orders cost more than the treasury holds — tax only arrives at the end of the turn, so whatever is paid for last will fail for want of gold.</div>` : ''}
    <div style="font-size:.72rem;color:#4a3a1a;margin-top:2px" title="Estimate: treasury − orders + this turn's tax − army wages − hero wages − the wages of units and heroes these orders add. Failed orders cost nothing; disbanding or releasing lowers wages.">📅 End of turn ≈ <strong style="color:${pneg ? '#c00' : 'inherit'}">${L.projected}g</strong> <span style="color:var(--stone)">(+${L.tax} tax − ${L.armyW} army wages − ${L.heroW} hero wages${L.newWages ? ` − ${String(L.newWages)} new wages` : ''})</span></div>
    ${L.notes.length ? kcHtml`<div style="font-size:.66rem;color:var(--stone)">${L.notes.join(' · ')}</div>` : ''}
  </div>`);
}
export let _ledgerT: ReturnType<typeof setTimeout> | null = null;
export function scheduleOrderLedgerP(): void {
  clearTimeout(_ledgerT ?? undefined);
  _ledgerT = setTimeout(() => {
    try {
      renderOrderLedgerP();
    } catch (e) {
      console.warn('ledger', e);
    }
  }, 120);
}
document.addEventListener(
  'change',
  (ev) => {
    if (ev.target instanceof Element && ev.target.closest('#orders-column')) scheduleOrderLedgerP();
  },
  true,
);
document.addEventListener(
  'input',
  (ev) => {
    if (ev.target instanceof Element && ev.target.closest('#orders-column')) scheduleOrderLedgerP();
  },
  true,
);

export function buildOrdersForm(
  charsHanded: readonly AHeroAsTheOrderFormBuildsHim[] | null | undefined,
  alreadySubmitted: unknown,
  existingOrders: unknown,
  turnNum: unknown,
): void {
  // `report` is a LOCAL of openReport, not a global — referencing it here threw a ReferenceError
  // that aborted the whole form build (and, because renderPlayerMap is called on the next line of
  // openReport, silently blanked the map too). Use the module-level currentReport, as every other
  // helper in this file does. Do not reintroduce a bare `report` reference in this function.
  const report: TheReportAsTheOrderFormHoldsIt = currentReport ?? {};
  // ── PRE-ORDER PLACEHOLDERS NEVER RENDER AS HEROES (2026-09-23, Toby item 4) ── A hire / Broker /
  // resurrect / charm card registers a placeholder (hired_… / resurrect_… / charm_…) in
  // currentReport.characters so the order fields can look it up. Those placeholders outlived the
  // card: after Submit, the read-only view (and then Revise Orders, or any other rebuild of this
  // form without a page reload) was handed a character list still holding them, so the hero was
  // drawn TWICE — once as an ordinary hero block (with the placeholder's DOM ids) and once as the
  // re-injected pre-order card. Strip them here; the card sync below re-registers the ones still
  // wanted.
  let chars = (charsHanded ?? []).filter((c) => !(asItsGuardReadsIt(c) && isPreOrderIdP(c.id)));
  if (currentReport && Array.isArray(currentReport.characters))
    currentReport.characters = currentReport.characters.filter((c) => !(asItsGuardReadsIt(c) && isPreOrderIdP(c.id)));
  // ── HERO ORDER ────
  // Precedence: an arrangement saved with THIS turn's draft/submission → the arrangement the engine
  // persisted on the realm (report.heroOrder) → the default, which puts the King (or a newly-crowned
  // heir) at the top and leaves everyone else in engine order. Array.sort is stable in modern
  // engines, so heroes the arrangement does not name (newly hired, raised or crowned) fall in after
  // the named ones, keeping their report order. Once the player reorders, the King is no longer
  // pinned to the top — the arrangement is theirs.
  chars = applyHeroOrderP(
    chars,
    heroOrderFromOrdersP(existingOrders) ??
      (Array.isArray(report.heroOrder) && report.heroOrder.length ? report.heroOrder.map(String) : null),
  );
  // Keep currentReport.characters in the same order so index-based lookups, the report column and
  // the orders column can never disagree about which hero is which.
  if (currentReport && Array.isArray(currentReport.characters)) currentReport.characters = chars;
  _heroOrder = chars.filter((c) => asItsGuardReadsIt(c) && c.alive !== false).map((c) => String(c.id));
  // NB: #submit-btn is NOT grabbed here. The submit control (orders-submit-wrap) is a live DOM node
  // that survives openReport calls; a previous submission replaces it with a "success / ↺ Resubmit"
  // block that has NO #submit-btn. Each branch below rebuilds the wrap from the true submitted
  // state, then re-fetches #submit-btn — so a stale success block can never bleed onto a fresh,
  // un-submitted turn (the reported "already submitted" ghost) and no branch ever dereferences a
  // null button.

  if (alreadySubmitted) {
    theElementWithTheId('orders-msg', HTMLElement).innerHTML =
      String(kcHtml`<div class="msg-success" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <span>✓ Orders submitted — awaiting the GM to run the turn.</span>
      <button class="btn btn-ghost" style="padding:6px 14px;font-size:.8rem" onclick="reviseOrders()">✏ Revise Orders</button>
    </div>`);
    // Rebuild the submit control as a single disabled indicator. (Deliberately NO "Save Draft"
    // button here — the orders below are read-only, so a Save Draft would write a blank draft and
    // un-submit.)
    {
      const _w = document.getElementById('orders-submit-wrap');
      if (_w) {
        _w.innerHTML = String(
          kcHtml`<button class="btn btn-crimson btn-full" id="submit-btn" disabled style="flex:1;padding:12px;font-size:.85rem;opacity:.7;cursor:default">Orders Submitted ✓</button>`,
        );
        _w.style.display = 'flex';
      }
    }
    {
      const _lg = document.getElementById('orders-ledger');
      if (_lg) _lg.style.display = 'none';
    } // no live orders → no running account
    // Show existing orders read-only so the player can see what they sent
    const savedOrders: unknown =
      typeof existingOrders === 'string' ? JSON.parse(existingOrders) : thisOrThat(existingOrders, {});
    const savedO = itOrAnEmptyRecord(thisOrThat(theDraftsField(savedOrders, 'orders'), savedOrders));
    const SEASONS_RO = KC_SEASONS.slice();
    const theSubmittedOrders = String(kcHtml`<div style="opacity:.65;pointer-events:none;user-select:none">
      <div style="font-family:Cinzel,serif;font-size:.72rem;color:var(--stone);text-transform:uppercase;letter-spacing:.08em;padding:6px 0 8px">Submitted orders (read-only):</div>
      ${chars
        .filter((c) => c.alive !== false)
        .map((c) => {
          const cOrders = theSavedList(thisOrThat(theDraftsField(savedO, String(c.id)), []), 'cOrders.some');
          return kcHtml`<div style="margin-bottom:12px;border:1px solid var(--stone);border-radius:3px;overflow:hidden">
          <div style="font-family:Cinzel,serif;font-size:.85rem;padding:6px 10px;background:var(--parchment-dark)">${c.isKing ? '👑' : '⚔'} ${c.name}</div>
          <div style="padding:6px 10px">
            ${SEASONS_RO.map((season, ph) => {
              const o = cOrders[ph];
              const action = o ? theDraftsField(o, 'action') : undefined;
              if (!o || !action || action === 'Defend' || action === 'defend')
                return kcHtml`<div style="font-size:.78rem;padding:2px 0;color:var(--stone)">${season}: <em>Defend</em></div>`;
              const target = theDraftsField(o, 'target');
              return kcHtml`<div style="font-size:.78rem;padding:2px 0">${season}: <strong>${action}</strong>${target ? ' — ' + inWords(target) : ''}</div>`;
            })}
          </div>
        </div>`;
        })}
      ${(() => {
        // pre-order cards (hire / raise / charm) are synthetic ids that are not in `chars`, so the
        // read-only view showed nothing for them — a player who reloaded after submitting could not
        // tell whether the orders for a hero they were hiring had gone in.
        const SEASONS_SY = SEASONS_RO;
        const rows: [string, unknown][] = Object.entries(savedO).filter(([k]) =>
          /^(?:hired|resurrect|charm)_\d+_via_.+_ph\d+$/.test(k),
        );
        if (!rows.length) return '';
        const LABEL: Readonly<Partial<Record<string, string>>> = {
          hired: 'newly hired',
          resurrect: 'if raised',
          charm: 'if charmed',
        };
        return rows.map(([k, ords]) => {
          const kind = k.split('_')[0];
          const heroId = k.split('_')[1];
          const _rp: TheReportAsTheOrderFormHoldsIt = currentReport ?? {};
          const nm =
            ((_rp.visibleChars ?? []).find((x) => String(x.id) === heroId)?.name ?? '') ||
            (Object.values(_rp.provinceOrderData ?? {})
              .flatMap((pd) => thereForItsField(pd, 'availableHeroes').availableHeroes ?? [])
              .find((x) => String(x.id) === heroId)?.name ??
              '') || // a Broker hire stands elsewhere
            ((_rp.knownDeadHeroes ?? _rp.graveyard ?? []).find((x) => String(x.id) === heroId)?.name ?? '') ||
            'Hero';
          const from = parseInt((/_ph(\d+)$/.exec(k)?.[1] ?? '') || '0');
          return kcHtml`<div style="margin-bottom:12px;border:1px dashed var(--stone);border-radius:3px;overflow:hidden">
            <div style="font-family:Cinzel,serif;font-size:.85rem;padding:6px 10px;background:var(--parchment-dark)">\u2694 ${nm} <span style="font-size:.68rem;color:var(--stone)">(${((kind === undefined ? undefined : LABEL[kind]) ?? '') || kind})</span></div>
            <div style="padding:6px 10px">
              ${SEASONS_SY.map((season, ph) => {
                if (ph <= from)
                  return kcHtml`<div style="font-size:.78rem;padding:2px 0;color:var(--stone)"><em>${season}: \u2014</em></div>`;
                const o = theDraftsField(thisOrThat(ords, []), String(ph));
                const action = o ? theDraftsField(o, 'action') : undefined;
                if (!o || !action || action === 'Defend' || action === 'defend')
                  return kcHtml`<div style="font-size:.78rem;padding:2px 0;color:var(--stone)">${season}: <em>Defend</em></div>`;
                const target = theDraftsField(o, 'target');
                return kcHtml`<div style="font-size:.78rem;padding:2px 0">${season}: <strong>${action}</strong>${target ? ' \u2014 ' + inWords(target) : ''}</div>`;
              })}
            </div>
          </div>`;
        });
      })()}
    </div>`);
    theElementWithTheId('orders-form', HTMLElement).innerHTML = theSubmittedOrders;
    return;
  }

  // NOT submitted: guarantee a live "💾 Save Draft + Submit" control. This clears any stale
  // "success / ↺ Resubmit" (or "Submit Anyway / Go Back") block left in the wrap by an earlier
  // submission on this or another game — the fix for the ghost "orders submitted" state.
  restoreSubmitWrap('Submit');

  let rawSaved: unknown;
  try {
    rawSaved = typeof existingOrders === 'string' ? JSON.parse(existingOrders || '{}') : thisOrThat(existingOrders, {});
  } catch {
    rawSaved = {};
  }
  // STALE-DRAFT GUARD. Drafts are stamped with the turn they were written for, exactly as
  // submissions are. A draft left over from a turn the GM has since resolved must NOT be poured
  // into this turn's form: its move orders were written from last turn's positions, so every later
  // phase would be projected from the wrong ground. (Submissions were already turn-stamped and
  // rejected by the engine; drafts carried no stamp at all, so they were silently reused.)
  {
    const _liveTurn = thisOrThat(
      thisOrThat(currentReport ? thisOrThat(currentReport._liveTurn, currentReport.turn) : currentReport, turnNum),
      1,
    );
    if (theDraftsField(rawSaved, 'forTurn') != null && theDraftsField(rawSaved, 'forTurn') !== _liveTurn) {
      const _staleTurn = theDraftsField(rawSaved, 'forTurn');
      console.warn('Discarding draft written for turn', _staleTurn, '— this is turn', _liveTurn);
      rawSaved = {};
      const _m = document.getElementById('orders-msg');
      if (_m)
        _m.innerHTML = String(
          kcHtml`<div class="msg-info">Your saved draft was written for Turn ${_staleTurn} and has been set aside — the GM has resolved that turn since. These orders start fresh.</div>`,
        );
    }
  }
  const savedOrders = thisOrThat(theDraftsField(rawSaved, 'orders'), rawSaved); // unwrap {orders:{...}, encounterPlans:{...}}
  _draftOrdersSnapshot = itOrAnEmptyRecord(savedOrders); // lets target defaults see companions' saved orders on first paint
  const savedEncounterPlans = itOrAnEmptyRecord(theDraftsField(rawSaved, 'encounterPlans'));
  // Restore any diplomacy declarations saved in this turn's draft so they survive a re-render.
  const theDiplomacySaved = theDraftsField(rawSaved, 'diplomacy');
  if (theDiplomacySaved && typeof theDiplomacySaved === 'object') diploChoices = { ...theDiplomacySaved };
  if (theDraftsField(rawSaved, 'callReckoning') === true) reckoningCall = true;
  const theDiscoveryChoicesSaved = theDraftsField(rawSaved, 'discoveryChoices');
  if (theDiscoveryChoicesSaved && typeof theDiscoveryChoicesSaved === 'object')
    discoveryChoices = { ...theDiscoveryChoicesSaved };
  setTimeout(renderDiscoveryChoices, 0);
  concedeGame = theDraftsField(rawSaved, 'concede') === true;
  setTimeout(renderConcede, 0);
  setTimeout(renderReckoningOrders, 0); // the Reckoning control lives here too

  // realm-level controls FIRST — the diplomacy declarations (moved here from the report's Diplomacy
  // card, which keeps the information) and the Concede control (moved up from the sticky submit
  // block, where it was easy to miss on a phone).
  // 2026-09-27 (Toby item 4): the old turn-bound dispatch composer that used to head this block is
  // GONE. It let you queue one message per turn, delivered with the next report; the ✉ Dispatches
  // tab supersedes it completely — messages there are written and delivered at once, threaded, and
  // read without waiting for a turn. Nothing else changes: the engine still understands an
  // `orders.messages` payload, and dispatch lines already written into past turn reports still
  // render in the Chronicle, so no history is lost.
  const _realmTop = kcHtml`<div id="orders-realm-top" class="orders-char-block" style="background:#fdf8ee">
      <div class="orders-char-head" style="background:#5c3d14">
        <button type="button" class="sec-toggle" aria-expanded="true" title="Minimise / maximise" onclick="toggleSection(this)">&#9662;</button>
        🏰 Realm — diplomacy &amp; concession
      </div>
      <div style="padding:6px 10px 10px">
        <div style="font-family:Cinzel,serif;font-size:.8rem;color:var(--ink);display:flex;align-items:center;gap:8px;padding:2px 0 4px">
          <span style="font-size:1rem">🤝</span><span style="font-weight:600">Diplomacy — declarations this turn</span></div>
        <div id="orders-diplomacy"></div>
        <div style="font-family:Cinzel,serif;font-size:.8rem;color:var(--ink);display:flex;align-items:center;gap:8px;padding:8px 0 4px;border-top:1px solid var(--parchment-dark);margin-top:8px">
          <span style="font-size:1rem">👑</span><span style="font-weight:600">Call the Reckoning</span></div>
        <div id="reckoning-wrap" style="font-size:.72rem"></div>
        <div style="font-family:Cinzel,serif;font-size:.8rem;color:var(--ink);display:flex;align-items:center;gap:8px;padding:8px 0 4px;border-top:1px solid var(--parchment-dark);margin-top:8px">
          <span style="font-size:1rem">🏳</span><span style="font-weight:600">Concede</span></div>
        <div id="concede-wrap" style="font-size:.72rem"></div>
      </div>
    </div>`;
  const _orderChars = chars.filter((c) => c.alive !== false);
  // tell players the arrows exist — the feature is invisible otherwise.
  const _reorderNote =
    _orderChars.length > 1
      ? kcHtml`<div style="font-size:.72rem;color:var(--stone);padding:2px 2px 8px">Use the <strong>▲ ▼</strong> arrows on a hero's header to move them up or down this column — group your heroes however suits your planning. The arrangement is kept from turn to turn.</div>`
      : '';
  const theForm = String(
    kcHtml`${_realmTop}${discoveryChoiceBlockHTML()}${_reorderNote}${heirSelectorHTML(chars)}${_orderChars.map(
      (c, _hi) => {
        const _hn = _orderChars.length; // for the ▲ ▼ reorder arrows below
        const hiredPh = c.hiredInPhase ?? -1; // -1 = available all turn
        const savedEP = itOrAnEmptyRecord(
          thisOrThat(thisOrThat(theDraftsField(savedEncounterPlans, String(c.id)), c.encounterPlan), {
            tactics: ['ME'],
            notes: '',
          }),
        );
        const currentTactics = theSavedList(
          thisOrThat(theDraftsField(savedEP, 'tactics'), ['ME']),
          'currentTactics.filter',
        );
        // Separate the pre-battle "Cast from School" choice out of the round-by-round encounter
        // tactics. CS is not an encounter tactic (it does nothing in the personal-combat loop) — it
        // only sets a random spell for the pre-battle magic phase of army battles. Stored separately in
        // the UI, then merged back into the tactics payload at submit so the GM engine is unchanged.
        const epOrdered = currentTactics.filter((t) => !String(t).toUpperCase().startsWith('CS:'));
        const epPreSchool = theSavedWords(
          thisOrThat(
            currentTactics.find((t) => String(t).toUpperCase().startsWith('CS:')),
            '',
          ),
        )
          .slice(3)
          .toLowerCase();

        return kcHtml`
    <div class="orders-char-block" data-hero="${c.id}">
      <div class="orders-char-head">
        <button type="button" class="sec-toggle" aria-expanded="true" title="Minimise / maximise this hero's orders" onclick="toggleSection(this)">&#9662;</button>
        ${c.isKing ? '👑' : '⚔'} ${c.name}
        ${hiredPh >= 0 ? kcHtml`<span style="background:#c8922a;color:#1a1208;font-size:.65rem;padding:1px 6px;border-radius:2px;margin-left:6px">Hired ${SEASONS[hiredPh]} — acts from ${SEASONS[hiredPh + 1] ?? 'next turn'}</span>` : ''}
        <span style="margin-left:auto;font-size:.7rem;opacity:.85">📍 ${provLinkHtml(c.locationId, (c.locationName ?? '') || '?', 'on-dark')} · Land: ${(c.effectiveSpeed ?? 0) || 3}/turn${(c.skills?.['march'] ?? 0) > 0 ? ` (March ${String(c.skills?.['march'])})` : ''}${c.effectiveSeaSpeed ? ` · Sea: ${String(c.effectiveSeaSpeed)}/turn${(c.skills?.['naval'] ?? 0) > 0 ? ` (Naval ${String(c.skills?.['naval'])})` : ''}` : ''}</span>
        <button type="button" class="hero-move hero-move-up" ${_hi === 0 ? 'disabled' : ''} title="Move this hero up the orders column" onclick="moveHeroBlock(${kcArg(String(c.id))},-1)">&#9650;</button>
        <button type="button" class="hero-move hero-move-down" ${_hi >= _hn - 1 ? 'disabled' : ''} title="Move this hero down the orders column" onclick="moveHeroBlock(${kcArg(String(c.id))},1)">&#9660;</button>
      </div>
      <div style="padding:5px 10px 6px;background:#fdf5e0;border-bottom:1px solid var(--parchment-dark);font-size:.76rem;display:flex;flex-wrap:wrap;gap:8px;line-height:1.6">
        <span style="flex-basis:100%;width:100%;color:var(--stone)">${formatRace(c.race)} · ${(c.alignment ?? '') || '—'} · ${(c.temper ?? '') || '—'}</span>
        <span><strong>HP:</strong> ${thisOrThat(c.hp, '?')}/${thisOrThat(c.maxHp, '?')}</span>
        ${skillRowHTML(c, 'inline')}
        ${(() => {
          const armies = c.armies ?? [];
          if (armies.length === 0) return kcHtml`<span style="color:#aaa">No armies</span>`;
          return armies.map((a) => {
            // 2026-09-27: this copy ignored the Druidic, Dragon Taming and skeleton waivers and lacked
            // level 1, so it showed penalties the engine never applies (and missed one it does).
            const { req, effDru, shortfall } = druidNeedP(a, c);
            const penalty =
              shortfall > 0
                ? kcHtml` <span style="color:var(--crimson);font-size:.7rem">−${shortfall * 20}% str (Druid ${effDru}/${req})</span>`
                : '';
            return kcHtml`<div style="flex-basis:100%;width:100%;color:var(--crimson)">${unitEmoji(a.type)} ${armyLabel(a)}${penalty}</div>`;
          });
        })()}
        ${itemsForDisplayP(c).map((itHeld) => {
          const it: AnItemTheFormShows = thereForItsField(itHeld, 'name');
          return kcHtml`<div style="flex-basis:100%;width:100%;color:var(--item-ink);font-weight:600">${itemAcquiredTagP(it)}🔮 ${itemLoreTip(it, it.name)}${itemTierTagP(it)}${itemBoundTag(it, c)}${itemUsableBy(it, c) ? itemSlotTag(it, c) : ''}${it.desc ? kcHtml` <span style="color:var(--item-desc);font-weight:400">(${it.desc})</span>` : ''}</div>`;
        })}
      </div>
      <div class="orders-char-body">
        ${SEASONS.map((season, ph) => {
          // Lock phases where hero wasn't yet hired
          const locked = hiredPh >= 0 && ph <= hiredPh;
          const saved = itOrAnEmptyRecord(
            theDraftsField(thisOrThat(theDraftsField(savedOrders, String(c.id)), []), String(ph)),
          );
          if (locked) {
            return kcHtml`<div class="phase-order" style="opacity:.45;pointer-events:none">
              <div class="phase-label">${season}</div>
              <div style="font-size:.78rem;color:var(--stone);font-style:italic;grid-column:2/-1;padding:5px 0">
                (Not yet hired this phase)
              </div>
            </div>`;
          }
          return kcHtml`<div class="phase-order">
            <div class="phase-label">${season}</div>
            <select id="po-action-${c.id}-${ph}" onchange="onActionChange(${kcArg(String(c.id))},${kcArg(ph)},${kcArg(chars.indexOf(c))})">
              <option value="">— Choose —</option>
              ${actionsFor(c).map((a) => kcHtml`<option value="${a}" ${theDraftsField(saved, 'action') === a ? 'selected' : ''}>${a}</option>`)}
            </select>
            <div id="po-target-wrap-${c.id}-${ph}" style="position:relative">
              ${buildTargetField(c, ph, theSavedOrderAsTheFieldReadsIt(saved))}
            </div>
          </div>`;
        })}

        <!-- Encounter Plan -->
        <div style="margin-top:10px;padding:8px;background:#fdf5e0;border:1px solid #c8922a;border-radius:2px">
          <div style="font-family:'Cinzel',serif;font-size:.72rem;color:#5a4208;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">
            ⚔ Encounter Plan <span style="font-weight:normal;font-family:serif;text-transform:none;letter-spacing:0;font-size:.75rem;color:#3a3224">— used when searching lairs or in random encounters</span>
          </div>
          <div style="font-size:.78rem;color:var(--stone);margin-bottom:6px">
            Drag a tactic (or use ▲ ▼) to reorder. The plan is executed in order until the encounter ends. If you run out of tactics, Melee is used.
          </div>
          <div id="ep-list-${c.id}" style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px"
            ondragover="event.preventDefault()"
            ondrop="epDropTactic(event,${kcArg(String(c.id))})">
            ${epOrdered.map((t, i) => epRowHtml(String(c.id), theSavedWords(t), i, epOrdered.length))}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${ENCOUNTER_TACTICS.filter((t) => t.code !== 'CS' && !t.retired).map((t) => {
              const noThief = t.code === 'ST' && ((c.skills?.['thief'] ?? 0) || 0) < 1 && !skillsUnseenP(c); // skills unseen → offer it; the engine judges
              return kcHtml`<button onclick="addEncounterTactic(${kcArg(String(c.id))},${kcArg(t.code)})" ${noThief ? 'disabled' : ''}
              style="font-size:.7rem;padding:3px 8px;border:1px solid ${noThief ? '#ddd' : 'var(--stone)'};background:${noThief ? '#f0f0f0' : 'var(--parchment-dark)'};color:${noThief ? '#bbb' : 'inherit'};cursor:${noThief ? 'not-allowed' : 'pointer'};border-radius:2px"
              title="${noThief ? 'Requires Thief skill (level 1+)' : t.label}">+ ${t.code}</button>`;
            })}
          </div>
          <input type="hidden" id="ep-tactics-${c.id}" value="${epOrdered.join(',')}">

          <!-- Pre-battle magic (army battles) — separate from the round-by-round encounter tactics -->
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #d8c48a">
            <div style="font-family:'Cinzel',serif;font-size:.68rem;color:#5a4208;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">
              ✨ Pre-battle magic <span style="font-weight:normal;font-family:serif;text-transform:none;letter-spacing:0;font-size:.72rem;color:#3a3224">— one random spell cast in army battles (not encounters)</span>
            </div>
            <input type="hidden" id="ep-preschool-${c.id}" value="${epPreSchool || ''}">
            <div id="ep-preschool-display-${c.id}" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"></div>
          </div>

          <!-- Duel stance (army battles) — sits beside pre-battle magic, as both are battle-only -->
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #d8c48a">
            <div style="font-family:'Cinzel',serif;font-size:.68rem;color:#5a4208;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">
              🤺 Duel stance <span style="font-weight:normal;font-family:serif;text-transform:none;letter-spacing:0;font-size:.72rem;color:#3a3224">— single combat at the start of an army battle (not encounters)</span>
            </div>
            <select id="ep-duel-${c.id}" style="font-size:.8rem;width:100%">
              ${DUEL_STANCES.map((d) => kcHtml`<option value="${d.code}"${thisOrThat(theDraftsField(savedEP, 'duelStance'), 'refuse') === d.code ? ' selected' : ''}>${d.label}</option>`)}
            </select>
            <div style="font-size:.68rem;color:#2f281c;margin-top:2px">
              A refused challenge costs the refusing commander's force <strong>20% strength</strong>. So does losing the duel — whether by falling or by breaking off.
            </div>
          </div>
          ${
            report.kingdom?.alignment === 'Evil'
              ? kcHtml`
          <!-- EVIL — conquest doctrine: Terror (loot + fear) or Enslave (chained garrisons) -->
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #d8c48a">
            <div style="font-family:'Cinzel',serif;font-size:.68rem;color:#7a1010;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">
              ⛓ Conquest doctrine <span style="font-weight:normal;font-family:serif;text-transform:none;letter-spacing:0;font-size:.72rem;color:#3a3224">— how ${c.name} treats the conquered</span>
            </div>
            <select id="ep-evilmode-${c.id}" style="font-size:.8rem;width:100%">
              <option value="terror" ${thisOrThat(theDraftsField(savedEP, 'evilMode'), 'terror') === 'terror' ? 'selected' : ''}>Terror — plunder 50% of the province's tax; decisive wins spread Terror (−10% to the next defenders)</option>
              <option value="enslave" ${thisOrThat(theDraftsField(savedEP, 'evilMode'), 'terror') === 'enslave' ? 'selected' : ''}>Enslave — no plunder; a free Green native garrison unit is pressed into service, but the province pays −1 tax for 3 turns (humanoid provinces only)</option>
            </select>
          </div>`
              : ''
          }

          <div style="margin-top:6px">
            <label style="font-size:.72rem">Describe your battlecry:</label>
            <input type="text" id="ep-notes-${c.id}" value="${thisOrThat(theDraftsField(savedEP, 'notes'), '')}"
              placeholder="e.g. For glory and the fallen — none shall pass!"
              style="font-size:.8rem;margin-top:2px">
            <div style="font-size:.68rem;color:#2f281c;margin-top:2px">Shouted at any enemy — monster or rival — as combat begins.</div>
          </div>
        </div>

      </div>
    </div>`;
      },
    )}`,
  );
  theElementWithTheId('orders-form', HTMLElement).innerHTML = theForm;

  // (The turn-bound dispatch composer that used to be restored here was retired 2026-09-27 — see
  // collectMessages. A saved draft in `rawSaved.messages` is simply ignored; the ✉ Dispatches tab
  // is where realm-to-realm messages are written now.)
  renderDiplomacy(report); // the declaration buttons live in #orders-diplomacy
  renderConcede();

  // ── SECOND PASS: rebuild every target field now the DOM actually exists ────
  //
  // The whole form above is assembled as ONE innerHTML string, and buildTargetField() for a later
  // phase asks predictedLocation() / projectedLedArmies() / projectedGarrison() where the character
  // will be standing — all of which read the phase-0..n-1 <select> elements out of the DOM. While
  // the string is still being built NONE of those elements exist, so every field for phases 1-4 was
  // built against the START-OF-TURN province: wrong direction lists (an option pointing off-map
  // from the start province is dropped entirely), wrong recruit/leave/pick-up/search lists, wrong
  // Blood Offering army list — and any saved value that wasn't among those wrong options was
  // silently lost. Editing by hand hid the bug, because onActionChange() rebuilds one wrap when the
  // DOM is live. Now that the form is in the document, rebuild each field IN PHASE ORDER from the
  // same saved order, so each phase sees the resolved position of every earlier one. Two passes:
  // the first settles each character's own chain, the second settles fields that depend on OTHER
  // characters'
  // orders (a garrison left by an ally, an army transferred in). buildTargetField is a pure function
  // of (character, phase, saved order) plus current DOM, so re-running it is idempotent.
  const _liveChars = chars.filter((c) => c.alive !== false);
  for (let pass = 0; pass < 2; pass++) {
    for (let ph = 0; ph < SEASONS.length; ph++) {
      _liveChars.forEach((c) => {
        const hiredPh = c.hiredInPhase ?? -1;
        if (hiredPh >= 0 && ph <= hiredPh) return; // locked phase — no field was rendered
        const wrap = document.getElementById(`po-target-wrap-${String(c.id)}-${String(ph)}`);
        if (!wrap) return;
        const saved = itOrAnEmptyRecord(
          theDraftsField(thisOrThat(theDraftsField(savedOrders, String(c.id)), []), String(ph)),
        );
        const action = thisOrThat(
          thisOrThat(
            theValueOfThePagesFieldOrNone(`po-action-${String(c.id)}-${String(ph)}`),
            theDraftsField(saved, 'action'),
          ),
          '',
        );
        if (!action) return; // "— Choose —": nothing to rebuild
        try {
          wrap.innerHTML = String(buildTargetField(c, ph, { ...theSavedOrderAsTheFieldReadsIt(saved), action }));
        } catch (e) {
          console.warn('target field rebuild failed', c.id, ph, e);
        }
      });
    }
  }
  // Any projection note that reads the finished form is refreshed once the fields are settled.
  refreshExploreNotes();
  refreshAllMoveModeNotes(); // move notices read every other order
  setTimeout(refreshAllOncePerTurn, 0); // 2026-09-24: once-per-turn orders — after every card is restored
  // rebuild the shared Resurrect order cards from the reopened draft, orders and all.
  {
    const _savedRes: NonNullable<Parameters<typeof syncAllResurrectCards>[0]> = {};
    Object.entries(itOrAnEmptyRecord(savedOrders)).forEach(([k, v]: [string, unknown]) => {
      const m = /^resurrect_(\d+)_via_\d+_ph\d+$/.exec(k);
      if (!m || !Array.isArray(v)) return;
      const phases: readonly unknown[] = v;
      const ep = itOrAnEmptyRecord(theDraftsField(savedEncounterPlans, k));
      _savedRes[String(m[1])] = {
        phases: phases.map((o) => thisOrThat(o, {})),
        tactics: theSavedList(thisOrThat(theDraftsField(ep, 'tactics'), []), '(ep.tactics || []).join').join(','),
        notes: thisOrThat(theDraftsField(ep, 'notes'), ''),
        duel: thisOrThat(theDraftsField(ep, 'duelStance'), ''),
      };
    });
    try {
      syncAllResurrectCards(_savedRes);
    } catch (e) {
      console.warn('resurrect card rebuild failed', e);
    }
  }
  // and rebuild the HIRED-HERO and CHARM pre-order cards the same way. Without this the orders
  // written for a hero you are about to hire survive only until the form is next re-rendered.
  try {
    syncAllPreOrderCards(savedOrders, savedEncounterPlans);
  } catch (e) {
    console.warn('pre-order card rebuild failed', e);
  }
  setTimeout(scheduleOrderLedgerP, 300); // treasury ledger (item 6) once the form and its pre-order cards are in place

  // Populate the per-character pre-battle magic (Cast from School) control.
  chars
    .filter((c) => c.alive !== false)
    .forEach((c) => {
      renderPreSchool(c.id);
    });

  const btn = document.getElementById('submit-btn'); // freshly rebuilt by restoreSubmitWrap above
  if (btn instanceof HTMLButtonElement) {
    btn.disabled = false;
    btn.textContent = `Submit Orders for Turn ${inWords(thisOrThat(turnNum, 1))}`;
  }
}

// Open the school picker for the pre-battle magic control.
export function openPreSchoolPicker(charId: unknown): void {
  const char = (currentReport?.characters ?? []).find((c) => String(c.id) === String(charId));
  const skills = char?.skills ?? {};
  const BATTLE_SCHOOLS: readonly (readonly [string, string])[] = [
    ['white', 'White'],
    ['elemental', 'Elemental'],
    ['psychic', 'Psychic'],
    ['necromancy', 'Necromancy'],
  ];
  const MAGIC_SCHOOLS_CS = new Set<unknown>(['white', 'elemental', 'psychic', 'necromancy']);
  const practisingCS = new Set<unknown>();
  for (let prevPh = 0; prevPh < 5; prevPh++) {
    const prevAction = thisOrThat(theValueOfThePagesFieldOrNone(`po-action-${String(charId)}-${String(prevPh)}`), '');
    if (prevAction === 'Practice Skill') {
      const prevTarget = getOrderTarget(charId, prevPh);
      if (prevTarget && MAGIC_SCHOOLS_CS.has(prevTarget)) practisingCS.add(prevTarget);
    }
  }
  // 2026-09-24 (Toby): a hero being hired this turn (skills:{}, _unknownSkills) matched no school,
  // so this alert declared they "know no battle-magic school" — a claim the player has no business
  // being told — and barred them from setting pre-battle magic at all. Offer all four with no level
  // shown; the engine finds nothing to cast if they never learned the school.
  const _csUnknown = skillsUnseenP(char);
  const options = BATTLE_SCHOOLS.map(([key, label]) => {
    const lvl = (skills[key] ?? 0) || 0;
    const practising = practisingCS.has(key) && lvl === 0;
    const known = _csUnknown || lvl >= 1 || practisingCS.has(key);
    return { key, label, lvl: _csUnknown ? null : lvl, practising: _csUnknown ? false : practising, known };
  }).filter((o) => o.known);
  if (options.length === 0) {
    alert(
      'This character knows no battle-magic school (White, Elemental, Psychic or Necromancy).\n\nTip: Practise one of these schools earlier in your orders to unlock it.',
    );
    return;
  }
  const disp = document.getElementById(`ep-preschool-display-${String(charId)}`);
  if (!disp) return;
  const existingS = document.getElementById(`ep-school-picker-${String(charId)}`);
  if (existingS) existingS.remove();
  const spicker = document.createElement('div');
  spicker.id = `ep-school-picker-${String(charId)}`;
  spicker.style.cssText =
    'background:#fff8e8;border:1px solid #c8922a;border-radius:3px;padding:8px 10px;margin:4px 0;flex-basis:100%';
  spicker.innerHTML =
    String(kcHtml`<div style="font-family:Cinzel,serif;font-size:.7rem;color:#5a4208;margin-bottom:6px">Choose a school — a random battle spell from it is cast in the pre-battle magic phase:${_csUnknown ? kcHtml`<div style="font-weight:normal;font-family:serif;color:var(--stone);font-size:.68rem;margin-top:3px">All four are offered — ${(char?.name ?? '') || 'this hero'}’s training is not known to you, and a school they never learned yields no spell.</div>` : ''}</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px">
      ${options.map(
        (o) => kcHtml`<button onclick="confirmEPSchool(${kcArg(String(charId))},${kcArg(o.key)})"
          style="font-size:.75rem;padding:4px 9px;border:1px solid ${o.practising ? '#c8922a' : 'var(--stone)'};background:${o.practising ? '#fffbef' : '#fdf8ee'};cursor:pointer;border-radius:2px">
          ${o.label}${o.lvl == null && !o.practising ? '' : kcHtml` <span style="color:var(--stone);font-size:.63rem">(${o.practising ? 'practising' : 'Lv ' + String(o.lvl)})</span>`}
        </button>`,
      )}
      <button onclick="document.getElementById(${kcArg(`ep-school-picker-${String(charId)}`)}).remove()"
        style="font-size:.75rem;padding:4px 9px;border:1px solid var(--stone);background:#f0e8d8;cursor:pointer;border-radius:2px;color:var(--stone)">Cancel</button>
    </div>`);
  disp.after(spicker);
}

export function clearPreSchool(charId: unknown): void {
  const hidden = document.getElementById(`ep-preschool-${String(charId)}`);
  if (hidden instanceof HTMLInputElement) hidden.value = '';
  const picker = document.getElementById(`ep-school-picker-${String(charId)}`);
  if (picker) picker.remove();
  renderPreSchool(charId);
}

export function addEncounterTactic(charId: unknown, code: string): void {
  const hidden = document.getElementById(`ep-tactics-${String(charId)}`);
  if (!(hidden instanceof HTMLInputElement)) return;
  const current = hidden.value ? hidden.value.split(',').filter(Boolean) : [];
  if (current.length >= 6) {
    alert('Maximum 6 tactics per encounter plan.');
    return;
  }

  // For CA (Cast Spell), show a spell picker — only combat-useful spells
  if (code === 'CA') {
    const char = (currentReport?.characters ?? []).find((c) => String(c.id) === String(charId));

    // Also include schools being practised in any phase this turn
    // (same logic as Cast Spell phase orders — the player sets their plan after their orders)
    const MAGIC_SCHOOLS_EP = new Set<unknown>(KC_MAGIC_SCHOOLS);
    const practisingSchoolsEP = new Set<unknown>();
    for (let prevPh = 0; prevPh < 5; prevPh++) {
      const prevAction = thisOrThat(theValueOfThePagesFieldOrNone(`po-action-${String(charId)}-${String(prevPh)}`), '');
      if (prevAction === 'Practice Skill') {
        const prevTarget = getOrderTarget(charId, prevPh);
        if (prevTarget && MAGIC_SCHOOLS_EP.has(prevTarget)) practisingSchoolsEP.add(prevTarget);
      }
    }

    // Count existing CA spells in plan per school, and track duplicates
    const epHidden = document.getElementById(`ep-tactics-${String(charId)}`);
    const existingTactics = theSavedWords(thisOrThat(epHidden ? theValueOfAField(epHidden) : undefined, ''))
      .split(',')
      .filter(Boolean);
    const epSchoolCount: Partial<Record<string, number>> = {};
    const epSpellsUsed = new Set<string>();
    existingTactics.forEach((t) => {
      if (!t.startsWith('CA:')) return;
      const spellName = t.slice(3);
      epSpellsUsed.add(spellName);
      const school = SPELL_TO_SCHOOL[spellName];
      if (school) epSchoolCount[school] = ((epSchoolCount[school] ?? 0) || 0) + 1;
    });

    // 2026-09-24 (Toby): a hero being hired this turn has skills:{} and _unknownSkills, so this
    // filter left NOTHING available and the alert below claimed "no magic skills" — and the option
    // labels print "(School N)", which would have read out their levels had any shipped. Offer every
    // encounter-valid spell, unlabelled by level, at the level-1 combat limit (one per school); the
    // engine refuses a school they never learned at resolution, as it does for a charmed hero.
    const _epUnknown = skillsUnseenP(char);
    const availSpells = _epUnknown
      ? Object.entries(ENCOUNTER_VALID).flatMap(([school, spells]) =>
          spells.map((s) => {
            const limit = combatSpellsAllowedPerSchoolEachFight(1); // levels unseen → the base allowance of one per school
            const used = (epSchoolCount[school] ?? 0) || 0;
            const isDuplicate = epSpellsUsed.has(s);
            const atSchoolLimit = used >= limit;
            const blocked = isDuplicate || atSchoolLimit;
            const reason = isDuplicate
              ? 'already in plan'
              : atSchoolLimit
                ? `school limit ${String(used)}/${String(limit)}`
                : '';
            return { school, spell: s, level: null, practising: false, blocked, reason, used, limit };
          }),
        )
      : Object.entries(ENCOUNTER_VALID)
          .filter(([school]) => effMagicLvl(char, school) >= 1 || practisingSchoolsEP.has(school))
          .flatMap(([school, spells]) =>
            spells.map((s) => {
              const lvl = effMagicLvl(char, school);
              // A character practising this school this turn will end the turn one level higher. Their
              // *effective* level for the combat-spell limit is therefore lvl+1 (min 1). "practising"
              // (for the label) means they don't know the school yet (unlocking it).
              const practisingThis = practisingSchoolsEP.has(school);
              const practising = practisingThis && lvl === 0;
              const effLvl = practisingThis ? Math.min(5, lvl + 1) : lvl;
              const limit = combatSpellsAllowedPerSchoolEachFight(effLvl);
              const used = (epSchoolCount[school] ?? 0) || 0;
              const isDuplicate = epSpellsUsed.has(s);
              const atSchoolLimit = used >= limit;
              const blocked = isDuplicate || atSchoolLimit;
              const reason = isDuplicate
                ? 'already in plan'
                : atSchoolLimit
                  ? `school limit ${String(used)}/${String(limit)}`
                  : '';
              return { school, spell: s, level: lvl, practising, blocked, reason, used, limit };
            }),
          );

    if (availSpells.length === 0) {
      alert(
        'This character has no magic skills and cannot cast spells in encounters.\n\nTip: if you set a Practice Skill order for a magic school earlier in your orders, those spells will become available here.',
      );
      return;
    }
    // Levels unseen (hired this turn / charmed): every school is listed without a level, so the
    // picker's heading says why rather than implying the hero knows them all.
    const _epUnknownNote = _epUnknown
      ? kcHtml`<div style="font-size:.68rem;color:var(--stone);margin-top:6px">Every school is offered — ${(char?.name ?? '') || 'this hero'}’s training is not known to you, and a spell from a school they never learned simply fails when the encounter comes.</div>`
      : '';

    // Show a mini-picker inline
    const wrap = document.getElementById(`ep-list-${String(charId)}`);
    if (!wrap) return;
    // Remove any existing picker
    const existing = document.getElementById(`ep-spell-picker-${String(charId)}`);
    if (existing) existing.remove();

    const picker = document.createElement('div');
    picker.id = `ep-spell-picker-${String(charId)}`;
    picker.style.cssText =
      'background:#fff8e8;border:1px solid #c8922a;border-radius:3px;padding:8px 10px;margin:4px 0';
    // Per-school casts tally: how many combat spells of each school this character may cast in one
    // encounter (the limit, from their level) and how many are already in the plan (used).
    // used/limit is tracked INDEPENDENTLY per school, so exhausting one school never affects
    // another.
    const _epTally: Record<string, { readonly limit: number; readonly used: number }> = {};
    availSpells.forEach((x) => {
      _epTally[x.school] ??= { limit: x.limit, used: x.used };
    });
    const _epTallyHtml = kcJoinP(
      Object.entries(_epTally).map(([sch, t]) => {
        const full = t.used >= t.limit;
        return kcHtml`<span style="font-size:.62rem;padding:1px 6px;border-radius:2px;background:${full ? '#f2dede' : '#e8f0e0'};color:${full ? '#a33' : '#3a5a2a'};border:1px solid ${full ? '#d8a0a0' : '#b8c9a8'}">${(theSkillsNames[sch] ?? '') || sch} ${t.used}/${t.limit}${full ? ' — full' : ''}</span>`;
      }),
      ' ',
    );
    picker.innerHTML =
      String(kcHtml`<div style="font-family:Cinzel,serif;font-size:.7rem;color:#5a4208;margin-bottom:4px">Choose a combat spell — casts used this encounter, per school:</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px">${_epTallyHtml}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${availSpells.map(({ school, spell, level, practising, blocked, reason, used, limit }) => {
          const limitNote = ` ${String(used)}/${String(limit)}`;
          const labelExtra = practising
            ? kcHtml`<span style="color:#5a3f08;font-size:.63rem">(${(theSkillsNames[school] ?? '') || school} — practising${limitNote})</span>`
            : kcHtml`<span style="color:${blocked ? '#bbb' : 'var(--stone)'};font-size:.63rem">(${(theSkillsNames[school] ?? '') || school}${level == null ? '' : ' ' + String(level)}${limitNote})</span>`;
          const blockedNote = blocked ? kcHtml`<span style="color:#c44;font-size:.6rem"> ✗ ${reason}</span>` : '';
          return blocked
            ? kcHtml`<button disabled style="font-size:.75rem;padding:4px 9px;border:1px solid #ddd;background:#f5f5f5;color:#bbb;border-radius:2px;cursor:not-allowed">
                ${spell} ${labelExtra}${blockedNote}
              </button>`
            : kcHtml`<button onclick="confirmEPSpell(${kcArg(String(charId))},${kcArg(spell)},${kcArg(school)},${kcArg(level)},${kcArg(limit)})" 
                style="font-size:.75rem;padding:4px 9px;border:1px solid ${practising ? '#c8922a' : 'var(--stone)'};background:${practising ? '#fffbef' : '#fdf8ee'};cursor:pointer;border-radius:2px">
                ${spell} ${labelExtra}
              </button>`;
        })}
        <button onclick="document.getElementById(${kcArg(`ep-spell-picker-${String(charId)}`)}).remove()" 
          style="font-size:.75rem;padding:4px 9px;border:1px solid var(--stone);background:#f0e8d8;cursor:pointer;border-radius:2px;color:var(--stone)">
          Cancel
        </button>
      </div>
      ${practisingSchoolsEP.size > 0 ? kcHtml`<div style="font-size:.68rem;color:#5a3f08;margin-top:6px">⚠ Spells marked "practising, may unlock" are only available if your practice order succeeds this turn.</div>` : ''}${_epUnknownNote}`);
    wrap.after(picker);
    return;
  }

  // ST (Steal) requires at least one level of Thief skill.
  if (code === 'ST') {
    const char = (currentReport?.characters ?? []).find((c) => String(c.id) === String(charId));
    const thiefLvl = effSkillP(char, 'thief');
    // 2026-09-24 (Toby): a hired hero's placeholder carries skills:{}, so this gate always fired and
    // the alert announced "no Thief skill" for a hero whose training is not known yet — and it took
    // the tactic off the table for a thief who may well have it. The +ST button is already offered
    // for such a card (see the noThief guard in the order form); let it through and let the engine
    // judge at resolution, exactly as the phase-order Steal does.
    if (thiefLvl < 1 && !skillsUnseenP(char)) {
      alert(
        'This character has no Thief skill and cannot attempt to steal.\n\nThe Steal tactic requires at least Thief level 1. Practise the Thief skill first.',
      );
      return;
    }
  }

  current.push(code);
  hidden.value = current.join(',');
  refreshEncounterPlan(charId, current);
}

export function confirmEPSpell(
  charId: unknown,
  spell: string,
  school: string,
  level: number | null,
  limitShown: number | null | undefined,
): void {
  const picker = document.getElementById(`ep-spell-picker-${String(charId)}`);
  if (picker) picker.remove();
  const hidden = document.getElementById(`ep-tactics-${String(charId)}`);
  if (!(hidden instanceof HTMLInputElement)) return;
  const current = hidden.value ? hidden.value.split(',').filter(Boolean) : [];
  if (current.length >= 6) {
    alert('Maximum 6 tactics in an encounter plan.');
    return;
  }

  // Enforce: same spell not twice
  if (current.includes(`CA:${spell}`)) {
    alert(
      `${spell} is already in your encounter plan. The same combat spell cannot be cast more than once per encounter.`,
    );
    return;
  }

  // Enforce: per-school combat spell limit (1 at level 1, 2 at level 2+). A school being PRACTISED
  // this turn (raw level 0) ends the turn at level 1, so it still gets a limit of 1 — the guard
  // must fire at used>=limit for it too, hence no "level>0" escape hatch. 2026-10-13 (item 16): the
  // limit is the one the picker showed, which counts a practice of this school this turn as a
  // success; the hero's current level alone refused a second spell the picker had offered.
  const limit =
    limitShown != null && isFinite(limitShown) ? limitShown : combatSpellsAllowedPerSchoolEachFight(level ?? 0);
  const used = current.filter((t) => t.startsWith('CA:') && SPELL_TO_SCHOOL[t.slice(3)] === school).length;
  if (used >= limit) {
    alert(
      `${(theSkillsNames[school] ?? '') || school}${(level ?? 0) > 0 ? ` Lv${String(level)}` : ''}: you can cast at most ${String(limit)} combat spell${limit !== 1 ? 's' : ''} of this school per encounter. Remove one first.`,
    );
    return;
  }

  current.push(`CA:${spell}`);
  hidden.value = current.join(',');
  refreshEncounterPlan(charId, current);
}

export function confirmEPSchool(charId: unknown, school: string): void {
  const picker = document.getElementById(`ep-school-picker-${String(charId)}`);
  if (picker) picker.remove();
  const hidden = document.getElementById(`ep-preschool-${String(charId)}`);
  if (!(hidden instanceof HTMLInputElement)) return;
  hidden.value = school;
  renderPreSchool(charId);
}
export function epMoveTactic(charId: unknown, idx: number, dir: number): void {
  const hidden = document.getElementById(`ep-tactics-${String(charId)}`);
  if (!(hidden instanceof HTMLInputElement)) return;
  const tactics = hidden.value ? hidden.value.split(',').filter(Boolean) : [];
  const j = idx + dir;
  if (idx < 0 || idx >= tactics.length || j < 0 || j >= tactics.length) return;
  const theOne = tactics[idx];
  const theOther = tactics[j];
  if (theOne === undefined || theOther === undefined) return;
  [tactics[idx], tactics[j]] = [theOther, theOne];
  hidden.value = tactics.join(',');
  refreshEncounterPlan(charId, tactics);
}
export function epDragStart(event: DragEvent, charId: unknown, fromIdx: number): void {
  thereForItsField(event.dataTransfer, 'setData').setData(
    'text/plain',
    JSON.stringify({ charId: String(charId), fromIdx }),
  );
  thereForItsField(event.dataTransfer, 'effectAllowed').effectAllowed = 'move';
}

export function epDropTactic(event: DragEvent, charId: unknown, toIdx?: number): void {
  event.preventDefault();
  let data: unknown;
  try {
    data = JSON.parse(thereForItsField(event.dataTransfer, 'getData').getData('text/plain'));
  } catch {
    return;
  }
  if (inWords(theDraftsField(data, 'charId')) !== String(charId)) return; // can't drag between characters
  const fromIdx = theDraftsField(data, 'fromIdx');
  const hidden = document.getElementById(`ep-tactics-${String(charId)}`);
  if (!(hidden instanceof HTMLInputElement)) return;
  const tactics = hidden.value ? hidden.value.split(',').filter(Boolean) : [];
  // `fromIdx < 0` and `splice(fromIdx, …)` read it as a number (Number does the same).
  if (Number(fromIdx) < 0 || Number(fromIdx) >= tactics.length) return;
  toIdx ??= tactics.length - 1; // dropped on the list background → send to the end
  if (fromIdx === toIdx) return;
  const moved = thereForItsField(tactics.splice(Number(fromIdx), 1)[0], 'the tactic moved');
  // Drop ONTO a row: dragging down places the tactic after that row, dragging up places it before —
  // so after removal the target index itself is the insertion point in both directions.
  tactics.splice(Math.min(toIdx, tactics.length), 0, moved);
  hidden.value = tactics.join(',');
  refreshEncounterPlan(charId, tactics);
}

export function removeEncounterTactic(charId: unknown, idx: number): void {
  const hidden = document.getElementById(`ep-tactics-${String(charId)}`);
  if (!(hidden instanceof HTMLInputElement)) return;
  const current = hidden.value ? hidden.value.split(',').filter(Boolean) : [];
  current.splice(idx, 1);
  hidden.value = current.join(',');
  refreshEncounterPlan(charId, current);
}

export function onSpellChange(charId: unknown, ph: number, selectedSpell: unknown): void {
  // The resurrection order card belongs to a specific spell choice — rebuild/remove it whenever the
  // spell changes, not just when the corpse does. Deferred so the new secondary select exists
  // first.
  setTimeout(() => {
    syncResurrectCard();
  }, 0);
  // When the player picks a different spell, rebuild the WHOLE target field via buildTargetField —
  // exactly as the GM portal's onGMSpellChange does.
  const wrap = document.getElementById(`po-target-wrap-${String(charId)}-${String(ph)}`);
  if (!wrap) return;
  const char = (currentReport?.characters ?? []).find((c) => String(c.id) === String(charId)) ?? theEmptyHero();
  // the Use Item form reuses this handler for spell items — rebuild under the live action.
  const liveAction = thisOrThat(
    theValueOfThePagesFieldOrNone(`po-action-${String(charId)}-${String(ph)}`),
    'Cast Spell',
  );
  wrap.innerHTML = String(
    buildTargetField(char, ph, {
      action: liveAction === 'Use Item' ? 'Use Item' : 'Cast Spell',
      target: selectedSpell,
    }),
  );
  if (liveAction === 'Cast Spell') refreshLaterCastSpells(charId, ph); // a spell from another school frees or spends a later slot
}

// Spend or refund a succession skill point. delta is +1 or −1. Caps mirror the join screen: a
// 4-point budget, at most +2 into any single skill, never reducing a skill below its crowned base.
export async function allocateHeirSkill(charId: unknown, skill: string, delta: number): Promise<void> {
  if (!currentReport) return;
  const c = thereForItsField(currentReport.characters, 'find').find((x) => x.id === charId);
  if (!c?._isHeir) return;
  const theSkills = c.skills ?? {};
  c.skills = theSkills;
  const cur = (theSkills[skill] ?? 0) || 0;
  const added = heirAddedTo(c, skill);
  if ((delta || 0) > 0) {
    if (heirTotalAdded(c) >= 4) return; // no points left to spend
    if (added >= 2) return; // +2-per-skill cap
    theSkills[skill] = cur + 1;
  } else {
    if (added <= 0) return; // can't dip below the crowned base
    theSkills[skill] = cur - 1;
    if (theSkills[skill] === 0) Reflect.deleteProperty(theSkills, skill);
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
    thisOrThat(thisOrThat(currentReport._liveTurn, currentReport.turn), 1),
  );
}

export async function reviseOrders(): Promise<void> {
  // Mark orders as not submitted so the player can edit and resubmit
  const gp = currentGamePlayer;
  if (!gp) return;
  const { error } = await sb.from('game_players').update({ orders_submitted: false }).eq('id', String(gp.id));
  if (error) {
    console.error(error);
    return;
  }
  // Update local state and rebuild form with existing orders pre-filled
  setOrdersSubmittedUI(false); // the turn is no longer submitted — say so at the top of the column
  const chars = currentReport?.characters ?? [];
  buildOrdersForm(chars, false, gp.orders, thisOrThat(currentReport?.turn, 1));
  theElementWithTheId('orders-msg', HTMLElement).innerHTML =
    '<div class="msg-warning">✏ Revising orders — your previous orders are pre-filled. Make changes and resubmit.</div>';
  theElementWithTheId('submit-btn', HTMLButtonElement).disabled = false;
  theElementWithTheId('submit-btn', HTMLButtonElement).textContent =
    `Resubmit Orders for Turn ${inWords(thisOrThat(thisOrThat(currentReport?._liveTurn, currentReport?.turn), 1))}`;
}
