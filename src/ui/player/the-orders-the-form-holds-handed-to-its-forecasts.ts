// The page's side of the order form's forecasts (plan P1-11e41; since P1-11e42 its ledger, chance notes, order list and
// magic levels too): the forecasts' file reads no field of the page, so the
// page hands each forecast the report it shows (currentReport) and a snapshot of the orders its form holds, taken as the
// forecast is asked: one snapshot for the forecast and everything it asks in turn. The page's files ask the forecasts
// by these names; a test asks the forecasts' file with orders of its own.
import { KC_PHASE_NAMES } from '../../content/kingdoms-call-data.ts';
import {
  theColumnAHeroMarchesWithInAPhase,
  whatAGarrisonHoldsAsAPhaseBegins,
  whatAHeroCarriesAsAPhaseBegins,
  whatAHeroLeadsAsAPhaseBegins,
  whereAHeroStandsAfterTheOrdersBefore,
} from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';
import {
  theMagicLevelsAHerosPractisesBeforeAPhaseMayRaise,
  theNoteUnderAnOrderThatQuotesItsChance,
  theOrdersTheFormOffersAHero,
  theTreasuryLedgerOnTheseOrders,
  type AHeroAsTheOrderFormReadsHim,
} from './the-order-forms-ledger-practice-note-order-list-and-magic-levels-on-the-orders-handed-them.ts';

// The value a page's field holds (an input's, a select's), or undefined where the element holds none.
export function theValueOfAField(el: Element): unknown {
  return 'value' in el ? el.value : undefined;
}
/** The value of the page's field with the id `id`, as `document.getElementById(id)?.value` read it. */
export function theValueOfThePagesField(id: string): unknown {
  const el = document.getElementById(id);
  return el ? theValueOfAField(el) : undefined;
}

// Get target value — handles both regular selects/inputs and recruit checkbox lists
export function getOrderTarget(charId: unknown, ph: unknown): unknown {
  // For recruit, the hidden input holds the comma-joined checkbox values
  const hidden = document.getElementById(`po-target-${String(charId)}-${String(ph)}`);
  if (hidden) {
    const value = theValueOfAField(hidden);
    if (value) return value;
    return '';
  }
  return '';
}
export function getOrderExtra(charId: unknown, ph: unknown): unknown {
  const el = document.getElementById(`po-extra-${String(charId)}-${String(ph)}`);
  const value = el ? theValueOfAField(el) : undefined;
  if (value) return value;
  return '';
}

/** One phase's order of a hero as the form holds it: each part the form shows a field for (its value), and a Recruit's
 *  boxes. */
interface AnOrderTheFormHolds {
  action?: unknown;
  target?: unknown;
  extra?: unknown;
  recruit?: { musterTo: unknown; ticked: unknown[] };
}
/** The orders the form holds, as the forecasts' file reads them (its theOrderField and theRecruitBoxesOf). */
export interface TheOrdersTheFormHolds {
  byHero: Record<string, AnOrderTheFormHolds[]>;
  declarations: unknown;
}

// The orders the form holds now, for each hero of the report and each phase: the snapshot a forecast reads.
export function theOrdersTheFormHolds(report: unknown): TheOrdersTheFormHolds {
  const byHero: Record<string, AnOrderTheFormHolds[]> = {};
  const characters: unknown =
    typeof report === 'object' && report !== null && 'characters' in report ? report.characters : null;
  (Array.isArray(characters) ? characters : []).forEach((o: unknown) => {
    const id = String(typeof o === 'object' && o !== null && 'id' in o ? o.id : undefined);
    const phases: AnOrderTheFormHolds[] = [];
    for (let ph = 0; ph < KC_PHASE_NAMES.length; ph++) {
      const order: AnOrderTheFormHolds = {};
      const action = document.getElementById(`po-action-${id}-${String(ph)}`);
      if (action) order.action = theValueOfAField(action);
      const target = document.getElementById(`po-target-${id}-${String(ph)}`);
      if (target) order.target = theValueOfAField(target);
      const extra = document.getElementById(`po-extra-${id}-${String(ph)}`);
      if (extra) order.extra = theValueOfAField(extra);
      const wrap = document.getElementById(`po-target-wrap-${id}-${String(ph)}`);
      if (wrap) {
        const dest = wrap.querySelector('.po-recruit-dest');
        order.recruit = {
          musterTo: dest ? theValueOfAField(dest) : null,
          ticked: [...wrap.querySelectorAll('input[type="checkbox"]:checked')].map(theValueOfAField),
        };
      }
      phases.push(order);
    }
    byHero[id] = phases;
  });
  return { byHero, declarations: typeof diploChoices === 'object' && diploChoices ? diploChoices : null };
}

// Each forecast as the page's files ask it: on the report the page shows and the orders its form holds.
export function predictedLocation(
  charId: unknown,
  upToPhaseExclusive: number,
): ReturnType<typeof whereAHeroStandsAfterTheOrdersBefore> {
  return whereAHeroStandsAfterTheOrdersBefore(
    currentReport,
    theOrdersTheFormHolds(currentReport),
    charId,
    upToPhaseExclusive,
  );
}
export function projectedMoveHost(charId: unknown, ph: number): ReturnType<typeof theColumnAHeroMarchesWithInAPhase> {
  return theColumnAHeroMarchesWithInAPhase(currentReport, theOrdersTheFormHolds(currentReport), charId, ph);
}
export function predictedItems(
  charId: unknown,
  upToPhaseExclusive: number,
): ReturnType<typeof whatAHeroCarriesAsAPhaseBegins> {
  return whatAHeroCarriesAsAPhaseBegins(
    currentReport,
    theOrdersTheFormHolds(currentReport),
    charId,
    upToPhaseExclusive,
  );
}
export function projectedGarrison(
  provId: unknown,
  phase: number,
  includeSamePhase?: boolean,
  excludeCharId?: unknown,
): ReturnType<typeof whatAGarrisonHoldsAsAPhaseBegins> {
  return whatAGarrisonHoldsAsAPhaseBegins(
    currentReport,
    theOrdersTheFormHolds(currentReport),
    provId,
    phase,
    includeSamePhase,
    excludeCharId,
  );
}
export function projectedLedArmies(
  charId: unknown,
  upToPhaseExclusive: number,
): ReturnType<typeof whatAHeroLeadsAsAPhaseBegins> {
  return whatAHeroLeadsAsAPhaseBegins(currentReport, theOrdersTheFormHolds(currentReport), charId, upToPhaseExclusive);
}

// The orders the form holds for the hero `c` alone (a pre-order card's too, which the report may not list yet): the
// snapshot read by what reads only his own orders (P1-11e42).
function theOrdersTheFormHoldsForTheHero(c: unknown): TheOrdersTheFormHolds {
  return theOrdersTheFormHolds({ characters: [c] });
}
// The ledger, the note under an order that quotes its chance, the orders the form offers a hero and the levels of
// magic his earlier practices may raise (P1-11e42), as the page's files ask them.
export function computeOrderLedgerP(): ReturnType<typeof theTreasuryLedgerOnTheseOrders> {
  return theTreasuryLedgerOnTheseOrders(currentReport, theOrdersTheFormHolds(currentReport));
}
export function orderChanceNote(
  c: AHeroAsTheOrderFormReadsHim | null | undefined,
  action: unknown,
  ph: number,
): unknown {
  return theNoteUnderAnOrderThatQuotesItsChance(currentReport, theOrdersTheFormHoldsForTheHero(c), c, action, ph);
}
export function actionsFor(c: AHeroAsTheOrderFormReadsHim | null | undefined): string[] {
  return theOrdersTheFormOffersAHero(currentReport, c);
}
export function projectedMagicLevels(
  c: AHeroAsTheOrderFormReadsHim | null | undefined,
  ph: number,
): ReturnType<typeof theMagicLevelsAHerosPractisesBeforeAPhaseMayRaise> {
  return theMagicLevelsAHerosPractisesBeforeAPhaseMayRaise(theOrdersTheFormHoldsForTheHero(c), c, ph);
}
