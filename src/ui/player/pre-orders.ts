import { kcArg, kcHtml } from '../shared/kc-safe.ts';
import { KC_SEASONS } from '../../content/kingdoms-call-data.ts';
import {
  skillFameLabelM,
  theNameTheFormWritesOfTheAlignmentOrder,
} from '../../shared/the-engines-rules-the-player-portal-shares.ts';
import { L79_ORDERS } from './l79-orders.ts';
import { SEASONS, _pendingDiscChoices, renderPreSchool } from './items-and-heroes.ts';
import { SPELL_TO_SCHOOL } from './order-chances.ts';
import {
  DUEL_STANCES,
  ENCOUNTER_TACTICS,
  HEIR_TEMPERS_LIST,
  refreshAllMoveModeNotes,
  refreshMoveModeNote,
  refreshEncounterPlan,
} from './move-analysis.ts';
import { doSaveOrders, doSubmitOrders, restoreSubmitWrap } from './briefing-and-submit.ts';
import { buildTargetField, refreshExploreNotes, theBloodOfferingsHint } from './order-targets.ts';
import type { AHeroAsTheTargetFieldsReadHim, TheReportAsTheTargetFieldsReadIt } from './order-targets.ts';
import { leadsArmiesP, provLinkHtml } from './map-symbols.ts';
import {
  actionsFor,
  getOrderExtra,
  getOrderTarget,
  predictedLocation,
  projectedLedArmies,
  theValueOfThePagesField,
} from './the-orders-the-form-holds-handed-to-its-forecasts.ts';
import {
  inWords,
  theFieldOrNoWords,
} from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';
import {
  SKILL_LABELS,
  heroHireWageOfP,
} from './the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';

/** A hero as the pre-order cards hold him: the target fields' hero, with the name and temper an heir's fields write,
 *  and what a card's placeholder carries (his wage, health and encounter plan). */
export interface AHeroAsThePreOrderCardsHoldHim extends AHeroAsTheTargetFieldsReadHim {
  name?: string | undefined;
  temper?: string | undefined;
  readonly _isHeir?: unknown;
  readonly pay?: unknown;
  readonly hp?: unknown;
  readonly maxHp?: unknown;
  readonly encounterPlan?: unknown;
}
/** A fallen hero a Resurrect card is written for, as the card reads him. */
type AFallenHeroAsTheCardReadsHim = NonNullable<TheReportAsTheTargetFieldsReadIt['knownDeadHeroes']>[number] & {
  readonly race?: string | undefined;
  readonly alignment?: string | undefined;
  readonly temper?: string | undefined;
  readonly skills?: AHeroAsTheTargetFieldsReadHim['skills'];
  readonly locationId?: number | null | undefined;
};
/** A hero another realm or none leads, as the Charm card reads him. */
type AHeroTheCharmCardReads = NonNullable<TheReportAsTheTargetFieldsReadIt['visibleChars']>[number] & {
  readonly race?: string | undefined;
  readonly alignment?: string | undefined;
  readonly temper?: string | undefined;
  readonly pay?: number | undefined;
  readonly hp?: unknown;
  readonly maxHp?: unknown;
  readonly locationId?: number | null | undefined;
};
/** A province's order data, as the target fields read it. */
type AProvincesOrderData = NonNullable<NonNullable<TheReportAsTheTargetFieldsReadIt['provinceOrderData']>[string]>;
/** A hero for hire, as the Hire Hero card reads him: what the target fields read, and his temper, wage, health, place and
 *  best skill. */
type AHeroForHireAsTheHireCardReadsHim = NonNullable<AProvincesOrderData['availableHeroes']>[number] & {
  readonly alignment?: string | undefined;
  readonly temper?: string | undefined;
  readonly pay?: number | null | undefined;
  readonly hp?: number | undefined;
  readonly maxHp?: number | undefined;
  readonly locationId?: number | null | undefined;
  readonly topSkill?: { readonly skill: string; readonly level: number } | null | undefined;
};
/** A province's order data as the Hire Hero card reads it: its heroes for hire, with what the card shows of each. */
type AProvincesOrderDataAsTheHireCardReadsIt = Omit<AProvincesOrderData, 'availableHeroes'> & {
  readonly availableHeroes?: readonly AHeroForHireAsTheHireCardReadsHim[] | null | undefined;
};
/** The report as the pre-order cards read and write it: the target fields' report, whose heroes the cards add their
 *  placeholders to, with the fallen heroes, the heroes seen and the heroes for hire the cards read. */
export interface TheReportAsThePreOrderCardsHoldIt extends TheReportAsTheTargetFieldsReadIt {
  characters?: AHeroAsThePreOrderCardsHoldHim[] | null | undefined;
  readonly knownDeadHeroes?: readonly AFallenHeroAsTheCardReadsHim[] | null | undefined;
  readonly deadHeroes?: readonly AFallenHeroAsTheCardReadsHim[] | null | undefined;
  readonly visibleChars?: readonly AHeroTheCharmCardReads[] | null | undefined;
  readonly provinceOrderData?:
    Readonly<Partial<Record<string, AProvincesOrderDataAsTheHireCardReadsIt>>> | null | undefined;
}

// ── ONCE-PER-TURN ORDERS (2026-09-24, Toby) ── The engine refuses a second use in one turn of any
// L7/L9 mastery order (GM MASTERY_ORDER_KEYS — exactly the L79_ORDERS set: both are the content's rows, P1-11d10)
// and of Call to Arms. Once a
// character has one of them in a phase, every LATER phase's action dropdown stops offering it. Each
// select remembers its full option list (data-all-opts) so an option comes back the moment the earlier
// phase is changed; a later phase already holding the order is cleared (with a note) rather than
// left to be refused at resolution.
export const ONCE_PER_TURN_ACTIONS = new Set([
  ...Object.keys(L79_ORDERS),
  theNameTheFormWritesOfTheAlignmentOrder('call-to-arms'),
]);
export function refreshOncePerTurnOptions(charId: unknown): void {
  const taken = new Set<unknown>();
  for (let ph = 0; ph < 5; ph++) {
    const sel = document.getElementById(`po-action-${String(charId)}-${String(ph)}`);
    if (!(sel instanceof HTMLSelectElement)) continue;
    const allOptsHeld = sel.dataset['allOpts'];
    if (allOptsHeld === undefined || allOptsHeld === '')
      sel.dataset['allOpts'] = JSON.stringify([...sel.options].map((o) => o.value).filter(Boolean));
    const all = theListParsed(JSON.parse(theWordsHeld(sel.dataset['allOpts'])));
    const want = all.filter((a) => !taken.has(a));
    const have = [...sel.options].map((o) => o.value).filter(Boolean);
    let cur = sel.value;
    let cleared: string | false = false;
    if (cur && taken.has(cur)) {
      cleared = cur;
      cur = '';
    }
    if (want.join('|') !== have.join('|')) {
      const firstOption = sel.options[0];
      const blank = firstOption && !firstOption.value ? firstOption.textContent : '\u2014 Choose \u2014';
      sel.innerHTML = String(
        kcHtml`<option value="">${blank}</option>${want.map((a) => kcHtml`<option value="${a}">${a}</option>`)}`,
      );
      sel.value = cur;
    }
    if (cleared) {
      const wrap = document.getElementById(`po-target-wrap-${String(charId)}-${String(ph)}`);
      const ch = (currentReport?.characters ?? []).find((c) => String(c.id) === String(charId));
      if (wrap) {
        try {
          wrap.innerHTML = String(
            kcHtml`${ch ? buildTargetField(ch, ph, { action: '' }) : ''}<div style="font-size:.72rem;color:#8a2a2a;margin-top:3px">${cleared} can be ordered only once a turn and is already set in an earlier phase \u2014 choose another action here.</div>`,
          );
        } catch {
          // a field that fails to build leaves the note unwritten, as it always has
        }
      }
    }
    if (ONCE_PER_TURN_ACTIONS.has(sel.value)) taken.add(sel.value);
  }
}
/** Words a select's mark holds (`data-all-opts`, set just before it is read), or the TypeError `JSON.parse` threw for
 *  none, when it read `undefined` as words. */
function theWordsHeld(held: string | undefined): string {
  if (held === undefined) throw new TypeError('the select holds no list of its options');
  return held;
}
/** A list the page wrote as JSON, as `.filter` read it: anything else throws the TypeError the call threw. */
function theListParsed(parsed: unknown): readonly unknown[] {
  if (!Array.isArray(parsed)) throw new TypeError('the select’s list of its options is not a list');
  const list: readonly unknown[] = parsed;
  return list;
}
export function refreshAllOncePerTurn(): void {
  const ids = new Set(
    [...document.querySelectorAll('select[id^="po-action-"]')].map((el) =>
      el.id.replace(/^po-action-/, '').replace(/-\d+$/, ''),
    ),
  );
  ids.forEach((id) => {
    try {
      refreshOncePerTurnOptions(id);
    } catch {
      // one hero's dropdowns that fail to refresh leave the others to refresh
    }
  });
}
export function onActionChange(charId: unknown, ph: number, charIdx: number): void {
  const action = theValueOfThePagesField(`po-action-${String(charId)}-${String(ph)}`);
  const wrap = document.getElementById(`po-target-wrap-${String(charId)}-${String(ph)}`);
  if (!wrap) return;
  const char = theHeroOrTheOneAtHisPlace(charId, charIdx);
  const saved = { action: theActionOrNone(action) };
  wrap.innerHTML = String(buildTargetField(char, ph, saved));
  refreshOncePerTurnOptions(charId); // 2026-09-24: once-per-turn orders leave later phases' dropdowns
  refreshLaterCastSpells(charId, ph); // 2026-10-13: a Practice or Cast here changes later casts' limits
  setTimeout(refreshExploreNotes, 0); // earlier/later Explore projections depend on every order
  setTimeout(refreshAllMoveModeNotes, 0); // …and so does every Move order's land/naval/flying notice

  // Sync the hired-hero future-order card. syncHiredHeroCard injects it when this is a Hire Hero
  // order with a hero selected, and tears it down (and unregisters the placeholder) the moment the
  // action moves to anything else — so the prospective hero's order window can't linger after the
  // player changes their mind.
  setTimeout(() => {
    syncHiredHeroCard(charId, ph);
  }, 100);
  // Likewise for Resurrect — and this also tears the card down when the action moves away from Cast
  // Spell, so a stale card can't survive and be submitted.
  setTimeout(() => {
    syncResurrectCard();
  }, 100);
  // Likewise for Charm — pops an order window for a charmed wandering hero (they join your
  // service), and tears it down when the action or spell moves away.
  setTimeout(() => {
    syncCharmCard(charId, ph);
  }, 100);
}
/** The hero with the id `charId`, else the one at `charIdx` in the report's list, else an empty hero, as
 *  `find(…) || list[charIdx] || {}` gave him: the empty hero's id is unread by the field built for him. */
function theHeroOrTheOneAtHisPlace(charId: unknown, charIdx: number): AHeroAsThePreOrderCardsHoldHim {
  const found = (currentReport?.characters ?? []).find((c) => String(c.id) === String(charId));
  if (found) return found;
  const atHisPlace = (currentReport?.characters ?? [])[charIdx];
  if (atHisPlace) return atHisPlace;
  return theEmptyHero();
}
/** `{}`, the hero the form builds a field for when the report holds none: an object of no fields, its id read as
 *  `undefined` as `{}.id` was. */
export function theEmptyHero(): AHeroAsThePreOrderCardsHoldHim {
  const none: unknown = undefined;
  return Object.defineProperties({ id: '' }, { id: { get: () => none, enumerable: false } });
}
/** An action as the saved order holds it: words, or none where the field held none. */
function theActionOrNone(action: unknown): string | undefined {
  if (action === undefined || typeof action === 'string') return action;
  throw new TypeError('an order’s action is not words');
}

// when a Move order is (re)picked, every LATER phase's starting province may change, so re-render
// this character's later MOVE orders — their direction dropdowns relabel to the new predicted path
// — and flag each later move with an "update me" note so the player re-checks it. Re-picking a
// flagged later move clears its own note and cascades to the moves after it.
export function onMoveEdited(charId: unknown, ph: number): void {
  const char = (currentReport?.characters ?? []).find((c) => String(c.id) === String(charId));
  if (!char) return;
  setTimeout(refreshExploreNotes, 0); // a changed path moves where later Explore orders land
  setTimeout(refreshAllMoveModeNotes, 0); // …and changes which province each later move sets out for
  refreshMoveModeNote(charId, ph); // land / naval / flying notice for the newly chosen destination
  // The player just addressed THIS move — clear its own flag.
  const ownNote = document.getElementById(`po-move-note-${String(charId)}-${String(ph)}`);
  if (ownNote) {
    ownNote.style.display = 'none';
    ownNote.innerHTML = '';
  }
  for (let later = ph + 1; later <= 4; later++) {
    const laterAction = theFieldOrNoWords(theValueOfThePagesField(`po-action-${String(charId)}-${String(later)}`));
    // a later FORCED MARCH sets out from the changed province too — its move_adjacent dropdown is
    // built from predictedLocation, so it goes stale exactly as a Move does. Rebuild with the
    // order's OWN action, not a hardcoded 'Move', or a Forced March would be handed the plain move
    // field.
    if (laterAction !== 'Move' && laterAction !== 'Forced March') continue; // scoped to move orders
    const wrap = document.getElementById(`po-target-wrap-${String(charId)}-${String(later)}`);
    if (!wrap) continue;
    const savedT = getOrderTarget(charId, later);
    wrap.innerHTML = String(buildTargetField(char, later, { action: laterAction, target: savedT }));
    if (savedT) {
      const note = document.getElementById(`po-move-note-${String(charId)}-${String(later)}`);
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
export function _fillSyntheticOrderCard(fakeId: unknown, savedPhases: unknown, savedEP: unknown): void {
  const fake = (currentReport?.characters ?? []).find((c) => String(c.id) === String(fakeId));
  if (!fake) return;
  const first = (fake.hiredInPhase ?? -1) + 1;
  for (let p = first; p < 5; p++) {
    const o = aFieldOfTheDraft(savedPhases ?? [], String(p));
    const action = o === null || o === undefined ? undefined : aFieldOfTheDraft(o, 'action');
    if (!action) continue;
    const sel = document.getElementById(`po-action-${String(fakeId)}-${String(p)}`);
    if (
      !(sel instanceof HTMLSelectElement) ||
      typeof action !== 'string' ||
      ![...sel.options].some((x) => x.value === action)
    )
      continue;
    sel.value = action;
    const wrap = document.getElementById(`po-target-wrap-${String(fakeId)}-${String(p)}`);
    if (wrap) {
      try {
        wrap.innerHTML = String(
          buildTargetField(fake, p, {
            action,
            target: theFieldOrNoWords(aFieldOfTheDraft(o, 'target')),
            extra: theFieldOrNoWords(aFieldOfTheDraft(o, 'extra')),
          }),
        );
      } catch {
        // a field that fails to build is left as the card drew it
      }
    }
  }
  try {
    refreshOncePerTurnOptions(fakeId);
  } catch {
    // 2026-09-24: the card's dropdowns stay as drawn
  }
  if (!savedEP) return;
  const allTac = theTacticsOf(savedEP).map(String);
  const tac = allTac.filter((t) => !t.toUpperCase().startsWith('CS:'));
  const cs = allTac.find((t) => t.toUpperCase().startsWith('CS:'));
  const h = document.getElementById(`ep-tactics-${String(fakeId)}`);
  if (h instanceof HTMLInputElement && tac.length) {
    h.value = tac.join(',');
    try {
      refreshEncounterPlan(fakeId, tac);
    } catch {
      // the plan's list stays as drawn
    }
  }
  if (cs) {
    const pre = document.getElementById(`ep-preschool-${String(fakeId)}`);
    if (pre instanceof HTMLInputElement) {
      pre.value = cs.slice(3).toLowerCase();
      try {
        renderPreSchool(fakeId);
      } catch {
        // the pre-battle magic's display stays as drawn
      }
    }
  }
  const n = document.getElementById(`ep-notes-${String(fakeId)}`);
  if (n instanceof HTMLInputElement) n.value = inWords(theFieldOrNoWords(aFieldOfTheDraft(savedEP, 'notes')));
  const d = document.getElementById(`ep-duel-${String(fakeId)}`);
  if (d instanceof HTMLSelectElement && aFieldOfTheDraft(savedEP, 'duelStance'))
    d.value = inWords(aFieldOfTheDraft(savedEP, 'duelStance'));
}
/** `value[key]` on a saved draft's part, parsed from JSON (any value: a hero's phases, a phase's order, an encounter
 *  plan), as JavaScript reads it: for none, the TypeError that read throws. */
function aFieldOfTheDraft(value: unknown, key: string): unknown {
  if (value === null || value === undefined) {
    throw new TypeError(`Cannot read properties of ${String(value)} (reading '${key}')`);
  }
  return Reflect.get(Object(value), key);
}
/** The plan's tactics as `(plan.tactics || [])` read them for `.map`: a list, none for a falsy value, and the TypeError
 *  `.map` threw for anything else. */
function theTacticsOf(plan: unknown): readonly unknown[] {
  const tactics = aFieldOfTheDraft(plan, 'tactics');
  if (!tactics) return [];
  if (!Array.isArray(tactics)) throw new TypeError('a saved encounter plan’s tactics are not a list');
  const list: readonly unknown[] = tactics;
  return list;
}
// Walk every rendered order row and re-inject whichever hired-hero / charm cards the restored form
// calls for, filling each from the draft. Repeated a few times so a NESTED hire (a hero hired this
// turn who himself hires another) gets his own card once his card exists to be read from.
export function syncAllPreOrderCards(savedOrdersHeld: unknown, savedEncounterPlansHeld: unknown): void {
  const savedOrders = savedOrdersHeld ?? {};
  const savedEncounterPlans = savedEncounterPlansHeld ?? {};
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
        const theCards: readonly (readonly [string, (charId: unknown, ph: number) => void])[] = [
          ['hired-hero-orders', syncHiredHeroCard],
          ['charm-orders', syncCharmCard],
        ];
        theCards.forEach(([prefix, fn]) => {
          const cardId = `${prefix}-${cid}-${String(ph)}`;
          if (document.getElementById(cardId)) return; // already rebuilt this round
          try {
            fn(cid, ph);
          } catch {
            return;
          }
          const card = document.getElementById(cardId);
          const fid = card?.getAttribute('data-fakeid');
          if (fid)
            _fillSyntheticOrderCard(
              fid,
              aFieldOfTheDraft(savedOrders, fid),
              aFieldOfTheDraft(savedEncounterPlans, fid),
            );
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
export function syncHiredHeroCard(charId: unknown, ph: number): void {
  const containerId = `hired-hero-orders-${String(charId)}-${String(ph)}`;
  const existing = document.getElementById(containerId);
  const action = theFieldOrNoWords(theValueOfThePagesField(`po-action-${String(charId)}-${String(ph)}`));
  const rawTarget = getOrderTarget(charId, ph);
  const isHire = action === 'Hire Hero' && rawTarget;
  const isBrokerHire = action === 'Broker' && typeof rawTarget === 'string' && rawTarget.startsWith('hire:');
  const wanted = Boolean(isHire) || isBrokerHire;
  if (!wanted) {
    if (existing) {
      const stale = existing.getAttribute('data-fakeid');
      if (stale && currentReport)
        currentReport.characters = (currentReport.characters ?? []).filter((c) => c.id !== stale);
      existing.remove();
    }
    return;
  }
  injectHiredHeroOrders(charId, ph);
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
export function syncResurrectCard(): void {
  syncAllResurrectCards();
}
/** A Resurrect caster as the card names him: his id, the phase of his cast and his name. */
interface AResurrectCaster {
  readonly charId: string;
  readonly ph: number;
  readonly name: string | undefined;
}
export function _resurrectCastersByHero(): Record<string, AResurrectCaster[]> {
  const out: Record<string, AResurrectCaster[]> = {};
  const chars: readonly (AHeroAsThePreOrderCardsHoldHim | null | undefined)[] = currentReport?.characters ?? [];
  chars.forEach((c) => {
    if (!c || c.alive === false || !/^\d+$/.test(String(c.id))) return;
    for (let ph = 0; ph < 5; ph++) {
      if (theFieldOrNoWords(theValueOfThePagesField(`po-action-${String(c.id)}-${String(ph)}`)) !== 'Cast Spell')
        continue;
      if (getOrderTarget(c.id, ph) !== 'Resurrect') continue;
      const hid = inWords(theFieldOrNoWords(theValueOfThePagesField(`po-extra-${String(c.id)}-${String(ph)}`)));
      if (!/^\d+$/.test(hid)) continue;
      (out[hid] ??= []).push({ charId: String(c.id), ph, name: c.name });
    }
  });
  Object.values(out).forEach((list) => list.sort((x, y) => x.ph - y.ph));
  return out;
}
/** A Resurrect card's orders as the card holds them, carried to the card rebuilt. */
interface AResurrectCardsOrders {
  readonly phases?: readonly unknown[] | null | undefined;
  readonly tactics?: unknown;
  readonly notes?: unknown;
  readonly duel?: unknown;
}
export function _readResurrectCardOrders(fakeId: unknown): AResurrectCardsOrders {
  return {
    phases: [0, 1, 2, 3, 4].map((p) => ({
      action: theActionOrNone(theFieldOrNoWords(theValueOfThePagesField(`po-action-${String(fakeId)}-${String(p)}`))),
      target: getOrderTarget(fakeId, p),
      extra: getOrderExtra(fakeId, p),
    })),
    tactics: theFieldOrNoWords(theValueOfThePagesField(`ep-tactics-${String(fakeId)}`)),
    notes: theFieldOrNoWords(theValueOfThePagesField(`ep-notes-${String(fakeId)}`)),
    duel: theFieldOrNoWords(theValueOfThePagesField(`ep-duel-${String(fakeId)}`)),
  };
}
export function _teardownResurrectCard(card: Element): void {
  const stale = card.getAttribute('data-fakeid');
  if (stale && currentReport) currentReport.characters = (currentReport.characters ?? []).filter((c) => c.id !== stale);
  card.remove();
}
export function _fillResurrectCard(fakeId: unknown, saved: AResurrectCardsOrders | null | undefined): void {
  const fake = (currentReport?.characters ?? []).find((c) => c.id === fakeId);
  if (!fake || !saved) return;
  const first = (fake.hiredInPhase ?? -1) + 1;
  for (let p = first; p < 5; p++) {
    const o = aFieldOfTheDraft(saved.phases ?? [], String(p));
    const action = o === null || o === undefined ? undefined : aFieldOfTheDraft(o, 'action');
    if (!action) continue;
    const sel = document.getElementById(`po-action-${String(fakeId)}-${String(p)}`);
    if (
      !(sel instanceof HTMLSelectElement) ||
      typeof action !== 'string' ||
      ![...sel.options].some((x) => x.value === action)
    )
      continue;
    sel.value = action;
    const wrap = document.getElementById(`po-target-wrap-${String(fakeId)}-${String(p)}`);
    if (wrap) {
      try {
        wrap.innerHTML = String(
          buildTargetField(fake, p, {
            action,
            target: theFieldOrNoWords(aFieldOfTheDraft(o, 'target')),
            extra: theFieldOrNoWords(aFieldOfTheDraft(o, 'extra')),
          }),
        );
      } catch {
        // a field that fails to build is left as the card drew it
      }
    }
  }
  if (saved.tactics) {
    const tactics = saved.tactics;
    const h = document.getElementById(`ep-tactics-${String(fakeId)}`);
    if (h instanceof HTMLInputElement) {
      h.value = inWords(tactics);
      try {
        refreshEncounterPlan(fakeId, theWordsSplit(tactics).filter(Boolean));
      } catch {
        // the plan's list stays as drawn
      }
    }
  }
  if (saved.notes) {
    const n = document.getElementById(`ep-notes-${String(fakeId)}`);
    if (n instanceof HTMLInputElement) n.value = inWords(saved.notes);
  }
  if (saved.duel) {
    const d = document.getElementById(`ep-duel-${String(fakeId)}`);
    if (d instanceof HTMLSelectElement) d.value = inWords(saved.duel);
  }
}
/** Words split at their commas, as `.split(',')` read them: anything else throws the TypeError the call threw. */
function theWordsSplit(words: unknown): string[] {
  if (typeof words !== 'string') throw new TypeError('a card’s saved tactics are not words');
  return words.split(',');
}
export function _setResurrectCasterNote(card: Element, casters: readonly AResurrectCaster[]): void {
  const el = card.querySelector('.resurrect-casters');
  if (!el) return;
  const SEASONS_R = KC_SEASONS.slice();
  // the seasons' names are never empty, so `??` keeps what `||` gave
  const who = casters.map((x) => `${String(x.name)} (${SEASONS_R[x.ph] ?? '?'})`);
  el.textContent =
    casters.length > 1
      ? `Raised by any of: ${who.join(', ')} — whichever succeeds, these orders apply.`
      : `Raised by ${String(who[0])}.`;
}
// savedByHero: { heroId: {phases, tactics, notes, duel} } — orders to pour into a card as it is
// (re)built.
export function syncAllResurrectCards(savedByHeroHeld?: Partial<Record<string, AResurrectCardsOrders>> | null): void {
  const savedByHero = savedByHeroHeld ?? {};
  // clear last pass's "no orders to give" notes — injectResurrectOrders rebuilds whichever are
  // still wanted. They carry no orders, so nothing is lost by dropping them.
  document.querySelectorAll('[id^="resurrect-note-"]').forEach((n) => {
    n.remove();
  });
  const groups = _resurrectCastersByHero();
  const kept: Partial<Record<string, Element>> = {};
  document.querySelectorAll('[id^="resurrect-orders-"]').forEach((card) => {
    const hid = card.getAttribute('data-heroid');
    const g = hid ? groups[hid] : null;
    if (!hid || !g || kept[hid]) {
      _teardownResurrectCard(card);
      return;
    }
    const earliest = theFirstCaster(g);
    if (
      card.getAttribute('data-firstph') !== String(earliest.ph) ||
      card.getAttribute('data-anchor') !== earliest.charId
    ) {
      // The earliest caster changed — rebuild in the right place with the right phases, carrying
      // the orders over.
      savedByHero[hid] ??= _readResurrectCardOrders(card.getAttribute('data-fakeid'));
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
    currentReport.characters = (currentReport.characters ?? []).filter(
      (c) => !(typeof c.id === 'string' && c.id.startsWith('resurrect_') && !live.has(c.id)),
    );
  }
  Object.entries(groups).forEach(([hid, g]) => {
    if (kept[hid]) return;
    const earliest = theFirstCaster(g);
    const card = injectResurrectOrders(earliest.charId, earliest.ph, hid, g);
    if (card && savedByHero[hid]) _fillResurrectCard(card.getAttribute('data-fakeid'), savedByHero[hid]);
  });
}
/** The earliest of a fallen hero's casters (the list is never empty: a caster starts it); none throws the TypeError
 *  reading his phase threw. */
function theFirstCaster(casters: readonly AResurrectCaster[]): AResurrectCaster {
  const first = casters[0];
  if (!first) throw new TypeError('a fallen hero with no caster');
  return first;
}
/** A card's body, the `.orders-char-body` its markup has just written; none throws the TypeError appending a row to it
 *  threw. */
function theCardsBody(card: Element): Element {
  const body = card.querySelector('.orders-char-body');
  if (!body) throw new TypeError('the card holds no body');
  return body;
}

export function injectResurrectOrders(
  charId: unknown,
  ph: number,
  heroId: unknown,
  casters: readonly AResurrectCaster[] | null | undefined,
): HTMLDivElement | null {
  const report: TheReportAsThePreOrderCardsHoldIt = currentReport ?? {};
  // The GM's id grammar is resurrect_<heroId>_via_<casterId>_ph<N>, all numeric (a caster hired
  // this same turn has a synthetic id and cannot anchor a card — rare, and the cast still resolves;
  // the raised hero simply defends).
  if (!/^\d+$/.test(String(charId)) || !/^\d+$/.test(String(heroId))) return null;
  const dead = (report.knownDeadHeroes ?? report.deadHeroes ?? []).find((x) => String(x.id) === String(heroId));
  if (!dead) return null;
  const firstActable = ph + 1;
  const containerId = `resurrect-orders-${String(heroId)}`;
  document.getElementById(containerId)?.remove();
  const casterBlock = document.getElementById(`po-action-${String(charId)}-0`)?.closest('.orders-char-block');
  if (!casterBlock) return null;
  // a hero raised in EARLY WINTER has no phase left to act in this turn, so there is nothing to
  // pre-order — the card was correct to be absent, but it vanished SILENTLY, which read as a
  // missing form beside the Late Summer and Fall cards. Say so instead. The note deliberately uses
  // a DIFFERENT id prefix (resurrect-note-) so no card selector, order collector or placeholder
  // sweep ever picks it up; syncAllResurrectCards clears the notes itself each rebuild.
  if (firstActable > 4) {
    const note = document.createElement('div');
    note.id = `resurrect-note-${String(heroId)}`;
    note.className = 'orders-char-block';
    note.style.cssText = 'border:2px dashed #b9a7c9;opacity:0.85;margin-top:8px';
    note.innerHTML = String(kcHtml`
      <div class="orders-char-head" style="background:#f5eeff;color:#2e2e2e">
        \u2728 ${dead.name}
        <span style="color:#46275f;font-size:.7rem;margin-left:6px">(raised in Early Winter \u2014 no orders to give)</span>
      </div>
      <div style="padding:6px 10px 8px;background:#f5eeff;font-size:.76rem;line-height:1.6;color:#46275f">
        Early Winter is the last phase of the turn, so ${dead.name} returns with no phase left in which to act.
        There are no orders to pre-write. If the cast succeeds they stand in your caster's province at full
        health, stripped of items and armies, and take your orders normally from Spring next turn.
      </div>`);
    casterBlock.after(note);
    return null;
  }

  const SEASONS_R = KC_SEASONS.slice();
  const fakeId = `resurrect_${String(heroId)}_via_${String(charId)}_ph${String(ph)}`;
  // A raised hero returns at full health, STRIPPED of items and armies, where the body lies — i.e.
  // where the caster stands when Resurrect resolves — so their order options (Recruit Armies,
  // Search Lair…) populate from there.
  const _casterLoc = predictedLocation(charId, ph);
  const fakeChar = {
    id: fakeId,
    name: dead.name,
    isKing: false,
    race: (dead.race ?? '') || 'Unknown',
    alignment: (dead.alignment ?? '') || 'Neutral',
    temper: (dead.temper ?? '') || 'Brave',
    skills: dead.skills ?? {},
    armies: [],
    items: [],
    pay: 1,
    locationId: dead.locationId ?? (_casterLoc ? _casterLoc.id : null),
    locationName: (_casterLoc?.name ?? '') || (dead.locationName ?? '') || '(raised where they fell)',
    effectiveSpeed: 5,
    effectiveSeaSpeed: 0,
    hiredInPhase: ph,
    encounterPlan: { tactics: ['ME'], notes: '' },
    hp: null,
    maxHp: null,
  };
  if (currentReport) {
    currentReport.characters = (currentReport.characters ?? []).filter(
      (c) => !(typeof c.id === 'string' && c.id.startsWith(`resurrect_${String(heroId)}_via_`)),
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
  card.innerHTML = String(kcHtml`
    <div class="orders-char-head" style="background:#f5eeff;color:#2e2e2e">
      <button type="button" class="sec-toggle" aria-expanded="true" title="Minimise / maximise" onclick="toggleSection(this)">&#9662;</button>
      \u2728 ${dead.name}
      <span style="color:#46275f;font-size:.7rem;margin-left:6px">(if raised \u2014 can act from ${SEASONS_R[firstActable] ?? 'next turn'})</span>
      <span style="margin-left:auto;font-size:.7rem;color:#231e16">📍 ${provLinkHtml(fakeChar.locationId, fakeChar.locationName || '?')} · Land: 5/turn · Sea: 5/turn</span>
    </div>
    <div style="padding:5px 10px 6px;background:#f5eeff;border-bottom:1px solid var(--parchment-dark);font-size:.76rem;line-height:1.6">
      <div class="resurrect-casters" style="color:#46275f;font-weight:600"></div>
      <div style="color:#46275f">These orders only take effect if one of your Resurrect casts succeeds. If every cast
      fails, or another realm raises ${dead.name} first, they are simply ignored. A phase before the hero is actually raised is skipped.</div>
      <div style="color:var(--stone);margin-top:2px">Returns at full health, stripped of all items and armies.</div>
    </div>
    <div class="orders-char-body"></div>`);
  casterBlock.after(card);
  _setResurrectCasterNote(
    card,
    casters?.length
      ? casters
      : [
          {
            charId: String(charId),
            ph,
            name: ((report.characters ?? []).find((x) => String(x.id) === String(charId))?.name ?? '') || 'your caster',
          },
        ],
  );

  const body = theCardsBody(card);
  SEASONS_R.forEach((season, phIdx) => {
    const row = document.createElement('div');
    row.className = 'phase-order';
    if (phIdx < firstActable) {
      row.style.cssText = 'opacity:.35;pointer-events:none';
      row.innerHTML = String(kcHtml`<div class="phase-label">${season}</div>
        <div style="font-size:.76rem;color:var(--stone);font-style:italic;grid-column:2/-1">(still dead)</div>`);
    } else {
      row.innerHTML = String(kcHtml`
        <div class="phase-label">${season}</div>
        <select id="po-action-${fakeId}-${phIdx}" onchange="onActionChange(${kcArg(fakeId)},${kcArg(phIdx)},99)">
          <option value="">\u2014 Choose \u2014</option>
          ${actionsFor(fakeChar).map((a) => kcHtml`<option value="${a}">${a}</option>`)}
        </select>
        <div id="po-target-wrap-${fakeId}-${phIdx}">
          <input id="po-target-${fakeId}-${phIdx}" type="text" placeholder="Details">
        </div>`);
    }
    body.appendChild(row);
  });

  const epDiv = document.createElement('div');
  epDiv.style.cssText = 'padding:10px;border-top:1px solid var(--parchment-dark);background:#faf6ff';
  epDiv.innerHTML = String(kcHtml`
    <div style="font-family:Cinzel,serif;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">\u2694 Encounter Plan</div>
    <div id="ep-list-${fakeId}" style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px">
      <div style="font-size:.8rem;padding:4px 8px;background:#faf6ff;border:1px solid var(--stone);border-radius:2px">ME \u2014 Melee</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${ENCOUNTER_TACTICS.filter((t) => t.code !== 'CS' && !t.retired).map(
        (t) => kcHtml`<button onclick="addEncounterTactic(${kcArg(fakeId)},${kcArg(t.code)})"
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
    </div>`);
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
export function syncCharmCard(charId: unknown, ph: number): void {
  const containerId = `charm-orders-${String(charId)}-${String(ph)}`;
  const existing = document.getElementById(containerId);
  const action = theFieldOrNoWords(theValueOfThePagesField(`po-action-${String(charId)}-${String(ph)}`));
  const spell = getOrderTarget(charId, ph);
  const heroId = theFieldOrNoWords(theValueOfThePagesField(`po-extra-${String(charId)}-${String(ph)}`));
  const report: TheReportAsThePreOrderCardsHoldIt = currentReport ?? {};
  const tgt = (report.visibleChars ?? []).find((x) => String(x.id) === String(heroId));
  // A charm target is any non-king hero leading NO armies — wandering (joins you) or an enemy
  // (their command is seized for the rest of the turn). Either way you write their orders here.
  const wanted = action === 'Cast Spell' && spell === 'Charm' && heroId && tgt && !tgt.isKing && !leadsArmiesP(tgt);
  if (!wanted) {
    if (existing) {
      const stale = existing.getAttribute('data-fakeid');
      if (stale && currentReport)
        currentReport.characters = (currentReport.characters ?? []).filter((c) => c.id !== stale);
      existing.remove();
    }
    return;
  }
  injectCharmOrders(charId, ph, heroId, containerId);
}

export function injectCharmOrders(charId: unknown, ph: number, heroId: unknown, containerId: string): void {
  const report: TheReportAsThePreOrderCardsHoldIt = currentReport ?? {};
  // The GM id grammar is charm_<heroId>_via_<casterId>_ph<N>, all numeric — a caster who is
  // themselves a synthetic (hired/raised/charmed) hero this same turn can't anchor a charm
  // pre-order chain.
  if (!/^\d+$/.test(String(charId)) || !/^\d+$/.test(String(heroId))) return;
  const wanderer = (report.visibleChars ?? []).find(
    (x) => String(x.id) === String(heroId) && !x.isKing && !leadsArmiesP(x),
  );
  if (!wanderer) return;
  const isEnemy = wanderer.player != null; // enemy → command seized for the turn; else → joins you

  const firstActable = ph + 1;
  if (firstActable > 4) return; // charmed in Early Winter — no phases left to act in

  document.getElementById(containerId)?.remove();
  const casterBlock = document.getElementById(`po-action-${String(charId)}-0`)?.closest('.orders-char-block');
  if (!casterBlock) return;

  const SEASONS_C = KC_SEASONS.slice();
  const fakeId = `charm_${String(heroId)}_via_${String(charId)}_ph${String(ph)}`;

  // Register a placeholder so buildTargetField/onActionChange can resolve this id. A charmed
  // wanderer keeps whatever they command, but the order form only needs their skills/location to
  // populate; the engine applies their real armies at resolution. armies:[] keeps the card in step
  // with the hired/resurrect cards (order ENTRY, not a claim about their host).
  const fakeChar = {
    id: fakeId,
    name: wanderer.name,
    isKing: false,
    race: (wanderer.race ?? '') || 'Unknown',
    alignment: (wanderer.alignment ?? '') || 'Neutral',
    temper: (wanderer.temper ?? '') || 'Brave',
    // the charmer does not see the charmed hero's skills or items. skills stays empty and
    // _hiddenSkills tells the order fields to list choices without levels; Send Item is not offered
    // at all.
    skills: {},
    _hiddenSkills: true,
    armies: [],
    items: [],
    pay: (wanderer.pay ?? 0) || 1,
    // only a seized ENEMY hero is restricted; a charmed wanderer joins freely.
    _charmEnemy: isEnemy,
    locationId: wanderer.locationId ?? null,
    locationName: (wanderer.locationName ?? '') || '(in your province)',
    effectiveSpeed: 5,
    effectiveSeaSpeed: 0,
    hiredInPhase: ph,
    encounterPlan: { tactics: ['ME'], notes: '' },
    hp: wanderer.hp ?? null,
    maxHp: wanderer.maxHp ?? null,
  };
  if (currentReport) {
    // Remove ANY charm placeholder previously registered for THIS slot (same caster + phase), not
    // merely the same hero — swapping the charm target within a phase would otherwise orphan the
    // old hero's placeholder (no card, but still registered), which submit-time validation then
    // flags as a phase with no action. The card element is slot-keyed (containerId), so only the
    // character registration needs this. Mirrors the hired-hero §45.2 fix.
    const slotSuffix = `_via_${String(charId)}_ph${String(ph)}`;
    currentReport.characters = (currentReport.characters ?? []).filter(
      (c) => !(typeof c.id === 'string' && c.id.startsWith('charm_') && c.id.endsWith(slotSuffix)),
    );
    currentReport.characters.push(fakeChar);
  }

  const card = document.createElement('div');
  card.id = containerId;
  card.setAttribute('data-fakeid', fakeId);
  card.className = 'orders-char-block';
  card.style.cssText = 'border:2px dashed #2a7a8a;opacity:0.9;margin-top:8px';
  card.innerHTML = String(kcHtml`
    <div class="orders-char-head" style="background:#eaf6f8;color:#2e2e2e">
      <button type="button" class="sec-toggle" aria-expanded="true" title="Minimise / maximise" onclick="toggleSection(this)">&#9662;</button>
      \u2728 ${wanderer.name}
      <span style="color:#185562;font-size:.7rem;margin-left:6px">(if charmed \u2014 can act from ${SEASONS_C[firstActable] ?? 'next turn'})</span>
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
    <div class="orders-char-body"></div>`);
  casterBlock.after(card);

  const body = theCardsBody(card);
  SEASONS_C.forEach((season, phIdx) => {
    const row = document.createElement('div');
    row.className = 'phase-order';
    if (phIdx < firstActable) {
      row.style.cssText = 'opacity:.35;pointer-events:none';
      row.innerHTML = String(kcHtml`<div class="phase-label">${season}</div>
        <div style="font-size:.76rem;color:var(--stone);font-style:italic;grid-column:2/-1">(not yet charmed)</div>`);
    } else {
      row.innerHTML = String(kcHtml`
        <div class="phase-label">${season}</div>
        <select id="po-action-${fakeId}-${phIdx}" onchange="onActionChange(${kcArg(fakeId)},${kcArg(phIdx)},99)">
          <option value="">\u2014 Choose \u2014</option>
          ${actionsFor(fakeChar).map((a) => kcHtml`<option value="${a}">${a}</option>`)}
        </select>
        <div id="po-target-wrap-${fakeId}-${phIdx}">
          <input id="po-target-${fakeId}-${phIdx}" type="text" placeholder="Details">
        </div>`);
    }
    body.appendChild(row);
  });

  // Encounter plan, matching the hired-hero / resurrect cards.
  const epDiv = document.createElement('div');
  epDiv.style.cssText = 'padding:10px;border-top:1px solid var(--parchment-dark);background:#f2fafb';
  epDiv.innerHTML = String(kcHtml`
    <div style="font-family:Cinzel,serif;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">\u2694 Encounter Plan</div>
    <div id="ep-list-${fakeId}" style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px">
      <div style="font-size:.8rem;padding:4px 8px;background:#f2fafb;border:1px solid var(--stone);border-radius:2px">ME \u2014 Melee</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${ENCOUNTER_TACTICS.filter((t) => t.code !== 'CS' && !t.retired).map(
        (t) => kcHtml`<button onclick="addEncounterTactic(${kcArg(fakeId)},${kcArg(t.code)})"
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
    </div>`);
  card.appendChild(epDiv);
}

// After a player selects Hire Hero in phase ph, add an order card for that hero covering phases
// ph+1 to 4 (they can't act in ph or earlier)
export function injectHiredHeroOrders(charId: unknown, ph: number): void {
  let heroId = getOrderTarget(charId, ph);
  if (!heroId) return;
  // the Broker action encodes its hire target as 'hire:<id>' (and 'spy:<provId>' for a paid spy,
  // which is NOT a hire). Strip the 'hire:' prefix; bail on anything else non-numeric.
  if (typeof heroId === 'string' && heroId.startsWith('hire:')) heroId = heroId.slice(5);
  if (!/^\d+$/.test(String(heroId))) return;

  const report: TheReportAsThePreOrderCardsHoldIt = currentReport ?? {};
  // A newly hired hero acts from the phase AFTER the hire (sd34 Mounted Couriers retired 2026-09-21).
  const firstActable = ph + 1;
  const theHeroFound: { hero: AHeroForHireAsTheHireCardReadsHim | null } = { hero: null };
  Object.values(report.provinceOrderData ?? {}).forEach((pd) => {
    if (!pd) throw new TypeError('a province with no order data');
    (pd.availableHeroes ?? []).forEach((h) => {
      if (String(h.id) === String(heroId)) theHeroFound.hero = h;
    });
  });
  const heroData = theHeroFound.hero;
  if (!heroData) return;

  const containerId = `hired-hero-orders-${String(charId)}-${String(ph)}`;
  document.getElementById(containerId)?.remove();

  let charBlock: Element | null | undefined = document
    .getElementById(`po-action-${String(charId)}-0`)
    ?.closest('.orders-char-block');
  if (!charBlock) {
    // NESTED hire: the hiring character is itself a hero hired earlier this turn (a synthetic id),
    // whose phase-0 row may be a "not yet hired" placeholder with no action select. Find their card
    // block by any of their phase selects, or by the data-fakeid marker on their injected card, so
    // the newly-hired hero's own order window still appears and can be given orders straight away.
    for (let _p = 0; _p < 5 && !charBlock; _p++) {
      const el = document.getElementById(`po-action-${String(charId)}-${String(_p)}`);
      if (el) charBlock = el.closest('.orders-char-block');
    }
    if (!charBlock) {
      const fake = document.querySelector(`[data-fakeid="${String(charId)}"]`);
      if (fake) charBlock = fake;
    }
  }
  if (!charBlock) return;

  const SEASONS_H = KC_SEASONS.slice();
  const hiredCharId = `hired_${String(heroId)}_via_${String(charId)}_ph${String(ph)}`;

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
    pay: heroHireWageOfP(heroData, currentReport) ?? heroData.pay, // item 12: the wage they will be hired at
    // A hero hired via Hire Hero stands in the SAME province as the hiring character (the hire
    // requires it), so the newly-hired hero acts from there. Without a real locationId every
    // province-dependent order option (Recruit Armies, Search Lair, …) came up empty.
    locationId: heroData.locationId ?? null,
    locationName: (heroData.locationName ?? '') || '(joining after hire)',
    effectiveSpeed: 5,
    effectiveSeaSpeed: 0,
    hiredInPhase: ph,
    encounterPlan: { tactics: ['ME'], notes: '' },
    hp: (heroData.hp ?? 0) || 14,
    maxHp: (heroData.maxHp ?? 0) || 14,
  };

  // Register in currentReport.characters so buildTargetField and onActionChange can look it up.
  // Remove any placeholder previously registered for THIS hire slot (same hiring character +
  // phase), not merely the same hero — otherwise swapping the chosen hero in a Hire Hero phase
  // leaves the OLD hero's fake character registered with no card in the DOM, and the submit-time
  // validation then flags its (now cardless) phases as "no action selected". The card element is
  // already slot-keyed (containerId above), so only the character registration needed the same
  // treatment. Slot id suffix: _via_<charId>_ph<ph>.
  if (currentReport) {
    const slotSuffix = `_via_${String(charId)}_ph${String(ph)}`;
    currentReport.characters = (currentReport.characters ?? []).filter(
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
  let hireTop = heroData.topSkill ?? null;
  if (!hireTop) {
    const sk = Object.entries(heroData.skills ?? {})
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const best = sk[0];
    if (best) hireTop = { skill: best[0], level: best[1] };
  }
  const skillStr = hireTop
    ? kcHtml`<span style="color:var(--forest)"><strong>${skillFameLabelM(hireTop.level)}</strong> ${theSkillsLabel(hireTop.skill)}</span>`
    : kcHtml`<span style="color:#aaa">No notable skills</span>`;

  card.innerHTML = String(kcHtml`
    <div class="orders-char-head" style="background:#fdf5e0;color:#2e2e2e">
      <button type="button" class="sec-toggle" aria-expanded="true" title="Minimise / maximise this hero's orders" onclick="toggleSection(this)">&#9662;</button>
      ⚔ ${heroData.name}
      <span style="color:#c8922a;font-size:.7rem;margin-left:6px">(newly hired — can act from ${SEASONS_H[firstActable] ?? 'next turn'})</span>
      <span style="margin-left:auto;font-size:.7rem;color:#231e16">📍 ${provLinkHtml(fakeChar.locationId, fakeChar.locationName || '?')} · Land: 5/turn · Sea: 5/turn</span>
    </div>
    <div style="padding:5px 10px 6px;background:#fdf5e0;border-bottom:1px solid var(--parchment-dark);font-size:.76rem;display:flex;flex-wrap:wrap;gap:8px">
      <span><strong>Race:</strong> ${heroData.race}</span>
      ${skillStr}
    </div>
    <div class="orders-char-body" id="hired-body-${hiredCharId}">
    </div>`);

  charBlock.after(card);

  // Now build each phase row properly using buildTargetField
  const body = theCardsBody(card);
  SEASONS_H.forEach((season, phIdx) => {
    const row = document.createElement('div');
    row.className = 'phase-order';
    if (phIdx < firstActable) {
      row.style.cssText = 'opacity:.35;pointer-events:none';
      row.innerHTML = String(kcHtml`<div class="phase-label">${season}</div>
        <div style="font-size:.76rem;color:var(--stone);font-style:italic;grid-column:2/-1">(not yet hired)</div>`);
    } else {
      const actionSelId = `po-action-${hiredCharId}-${String(phIdx)}`;
      const targetWrapId = `po-target-wrap-${hiredCharId}-${String(phIdx)}`;
      row.innerHTML = String(kcHtml`
        <div class="phase-label">${season}</div>
        <select id="${actionSelId}" onchange="onActionChange(${kcArg(hiredCharId)},${kcArg(phIdx)},99)">
          <option value="">— Choose —</option>
          ${actionsFor(fakeChar).map((a) => kcHtml`<option value="${a}">${a}</option>`)}
        </select>
        <div id="${targetWrapId}">
          <input id="po-target-${hiredCharId}-${phIdx}" type="text" placeholder="Details">
        </div>`);
    }
    body.appendChild(row);
  });

  // Build encounter plan section for the hired hero
  const epDiv = document.createElement('div');
  epDiv.style.cssText = 'padding:10px;border-top:1px solid var(--parchment-dark);background:#fdf8ee';
  epDiv.innerHTML = String(kcHtml`
    <div style="font-family:Cinzel,serif;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">⚔ Encounter Plan</div>
    <div id="ep-list-${hiredCharId}" style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px">
      <div style="font-size:.8rem;padding:4px 8px;background:#fdf8ee;border:1px solid var(--stone);border-radius:2px">ME — Melee</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${ENCOUNTER_TACTICS.filter((t) => t.code !== 'CS' && !t.retired).map(
        (t) => kcHtml`<button onclick="addEncounterTactic(${kcArg(hiredCharId)},${kcArg(t.code)})"
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
    </div>`);
  card.appendChild(epDiv);
  renderPreSchool(hiredCharId);
}

// read the Blood Offering per-unit Sacrifice/Empower selectors into the hidden extra field
// ("S:i,j|E:a,b"), show the block only for the Blood Offering rite, and say what the turn gives and raises
// (theBloodOfferingsHint: a side left empty or the counts unmatched too; R-133, plan P1-11e27).
export function updateBloodOffering(charId: unknown, ph: number): void {
  const rite = theFieldOrNoWords(theValueOfThePagesField(`po-target-${String(charId)}-${String(ph)}`));
  const block = document.getElementById(`bo-block-${String(charId)}-${String(ph)}`);
  const extra = document.getElementById(`po-extra-${String(charId)}-${String(ph)}`);
  const hint = document.getElementById(`bo-hint-${String(charId)}-${String(ph)}`);
  if (block) block.style.display = rite === 'Blood Offering' ? 'block' : 'none';
  if (rite !== 'Blood Offering') {
    if (extra instanceof HTMLInputElement) extra.value = '';
    return;
  }
  const sels = [...document.querySelectorAll(`.bo-sel[data-cid="${String(charId)}"][data-ph="${String(ph)}"]`)].filter(
    (s) => s instanceof HTMLSelectElement,
  );
  const sac: number[] = [];
  const ben: number[] = [];
  sels.forEach((s) => {
    const idx = parseInt(String(s.getAttribute('data-idx')));
    if (s.value === 'S') sac.push(idx);
    else if (s.value === 'E') ben.push(idx);
  });
  if (extra instanceof HTMLInputElement) extra.value = `S:${sac.join(',')}|E:${ben.join(',')}`;
  if (hint) {
    const said = theBloodOfferingsHint(projectedLedArmies(charId, ph), sac, ben);
    hint.textContent = said.words;
    hint.style.color = said.colour;
  }
  // Persist the selection into the saved draft immediately. Without this, the per-unit choices live
  // ONLY in the DOM: any later full re-render of the orders form (e.g. heir-skill allocation) or a
  // reload rebuilds this field from the saved draft, resetting every unit to "Keep" and emptying
  // the hidden field — so only the engine's 1-for-1 fallback fired. Saving on each change keeps the
  // draft
  // (and currentGamePlayer.orders, used by rebuilds) in step with what the player actually chose.
  void doSaveOrders();
}

export async function submitOrders(): Promise<void> {
  const chars = currentReport?.characters ?? [];
  const btn = theElementWithTheId('submit-btn', HTMLButtonElement);
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
        const action = theFieldOrNoWords(theValueOfThePagesField(`po-action-${String(c.id)}-${String(ph)}`));
        if (!action) missingCount++;
      });
      // Also check hired heroes (injected cards) These use a different charId format:
      // hired_X_via_Y_phZ
    });
  const _dcUnpicked = _pendingDiscChoices().filter(
    (pc) => !theLeadsOf(pc).some((o) => o.id === discoveryChoices[String(pc.key)]),
  ).length;
  if (missingCount > 0 || _dcUnpicked > 0) {
    // The warning goes in the bottom block's message slot and its buttons REPLACE the submit
    // buttons in the wrap directly beneath it, so every control to do with submitting stays in one
    // place.
    theElementFound(msg, 'orders-msg').innerHTML = String(
      kcHtml`<div class="msg-warning">${missingCount > 0 ? `⚠ ${String(missingCount)} phase${missingCount !== 1 ? 's' : ''} still have no action selected. You can submit anyway, and the GM will treat unfilled phases as Defend.` : ''}${_dcUnpicked > 0 ? kcHtml`${missingCount > 0 ? kcHtml`<br>` : ''}⚠ ${_dcUnpicked} research discover${_dcUnpicked !== 1 ? 'ies are' : 'y is'} still unchosen (💡 Research box near the top of your orders). If you submit anyway, one of each pair will be kept at random.` : ''}</div>`,
    );
    const w = document.getElementById('orders-submit-wrap');
    if (w) {
      w.innerHTML = String(kcHtml`
        <button class="btn btn-crimson btn-full" style="flex:1;padding:12px;font-size:.85rem" onclick="doSubmitOrders()">Submit Anyway</button>
        <button class="btn btn-ghost" style="flex:0 0 auto;padding:10px 16px" onclick="cancelSubmit()">← Go Back</button>`);
      w.style.display = 'flex';
      w.style.gap = '8px';
    }
    return;
  }
  await doSubmitOrders();
}

export function setHeirName(charId: unknown, value: unknown): void {
  if (!currentReport) return;
  const c = theHeroesOf(currentReport).find((x) => x.id === charId);
  if (!c?._isHeir) return;
  c.name = inWords(theFieldOrNoWords(value)).slice(0, 40);
  void doSaveOrders(); // persist without re-rendering, so the field keeps focus
}

export function setHeirTemper(charId: unknown, value: unknown): void {
  if (!currentReport) return;
  const c = theHeroesOf(currentReport).find((x) => x.id === charId);
  if (!c?._isHeir) return;
  if (typeof value !== 'string' || !HEIR_TEMPERS_LIST.includes(value)) return;
  c.temper = value;
  void doSaveOrders(); // temper doesn't change order options, so no rebuild needed
}
/** The element `el` looked up by the id `id`, read where the old code read it unguarded: none throws the TypeError
 *  that read threw. */
function theElementFound<T extends Element>(el: T | null, id: string): T {
  if (!el) throw new TypeError(`the page holds no element with the id "${id}"`);
  return el;
}
/** The report's heroes, read where the old code read `.find` on them unguarded: none throws the TypeError that read
 *  threw. */
function theHeroesOf(report: TheReportAsThePreOrderCardsHoldIt): readonly AHeroAsThePreOrderCardsHoldHim[] {
  const heroes = report.characters;
  if (!heroes) throw new TypeError('the report lists no heroes');
  return heroes;
}
/** A pair of leads' options, read where `.some` read them unguarded: none throws the TypeError that read threw. */
function theLeadsOf(pair: ReturnType<typeof _pendingDiscChoices>[number]): readonly { readonly id?: unknown }[] {
  const options = pair.options;
  if (!options) throw new TypeError('a pair of leads with no options');
  return options;
}
/** A skill's label (the skills' labels are never empty words), else its own name, as `LABELS[s] || s` gave it. */
function theSkillsLabel(skill: string): string {
  const labels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
  return labels[skill] ?? skill;
}

export function resubmitOrders(): void {
  // Re-enable all order form inputs so the player can update before resubmitting
  const gp = currentGamePlayer;
  if (!gp) return;
  // Restore the submit wrap with the normal buttons
  restoreSubmitWrap('Resubmit');
  theElementWithTheId('orders-msg', HTMLElement).innerHTML =
    '<div class="msg-info">✏ Update your orders below and hit Resubmit — your new orders will replace the previous submission.</div>';
  // Make sure all form inputs are enabled
  document.querySelectorAll('#orders-form select, #orders-form input, #orders-form button').forEach((el) => {
    if (!el.id.includes('po-leave-all') && 'disabled' in el) el.disabled = false;
  });
}

// Rebuild one order's target field in place — used when a choice within the field changes the odds
// quoted beneath it (picking a different skill to practise). Mirrors what onSpellChange does.
export function rebuildTargetWrap(charId: unknown, ph: number): void {
  const wrap = document.getElementById(`po-target-wrap-${String(charId)}-${String(ph)}`);
  const c = (currentReport?.characters ?? []).find((x) => String(x.id) === String(charId));
  if (!wrap || !c) return;
  const saved = {
    action: theActionOrNone(theFieldOrNoWords(theValueOfThePagesField(`po-action-${String(charId)}-${String(ph)}`))),
    target: getOrderTarget(charId, ph),
    extra: getOrderExtra(charId, ph),
  };
  try {
    wrap.innerHTML = String(buildTargetField(c, ph, saved));
  } catch (e) {
    console.warn('target rebuild failed', e);
  }
  if (saved.action === 'Practice Skill') refreshLaterCastSpells(charId, ph); // a re-aimed practice moves later casts' limits
}

// After an earlier phase's order changes (a Practice Skill picked or re-aimed, a spell cast), every
// LATER Cast Spell order's dropdown is rebuilt so its projected level and casting limit stay true.
export function refreshLaterCastSpells(charId: unknown, fromPh: number): void {
  const c = (currentReport?.characters ?? []).find((x) => String(x.id) === String(charId));
  if (!c) return;
  for (let later = fromPh + 1; later <= 4; later++) {
    if (theFieldOrNoWords(theValueOfThePagesField(`po-action-${String(charId)}-${String(later)}`)) !== 'Cast Spell')
      continue;
    const wrap = document.getElementById(`po-target-wrap-${String(charId)}-${String(later)}`);
    if (!wrap) continue;
    const before = getOrderTarget(charId, later);
    // only a spell the table knows goes back into the rebuilt markup; the spell's own target is put
    // back afterwards as the field's value, never as markup
    const known = Object.keys(SPELL_TO_SCHOOL),
      at = known.findIndex((k) => k === before);
    const spell = at >= 0 ? known[at] : '';
    const savedExtra = getOrderExtra(charId, later);
    try {
      wrap.innerHTML = String(buildTargetField(c, later, { action: 'Cast Spell', target: spell, extra: '' }));
    } catch (e) {
      console.warn('cast refresh failed', e);
    }
    const ex = document.getElementById(`po-extra-${String(charId)}-${String(later)}`);
    if (
      ex &&
      savedExtra &&
      getOrderTarget(charId, later) === spell &&
      (ex.tagName !== 'SELECT' ||
        (ex instanceof HTMLSelectElement && [...ex.options].some((o) => o.value === savedExtra)))
    )
      Reflect.set(ex, 'value', savedExtra);
    if (getOrderTarget(charId, later) !== before) {
      const l = later;
      setTimeout(() => {
        syncResurrectCard();
        syncCharmCard(charId, l);
      }, 0);
    } // the spell itself changed
  }
}
