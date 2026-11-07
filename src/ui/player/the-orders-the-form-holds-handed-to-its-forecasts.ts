// The page's side of the order form's forecasts (plan P1-11e41): the forecasts' file reads no field of the page, so the
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
  whereTheCompaniesAHerosRecruitRaisesMusterOnTheseOrders,
} from './the-order-forms-forecast-where-a-hero-stands-what-he-carries-and-leads.ts';

// The value a page's field holds (an input's, a select's), or undefined where the element holds none.
function theValueOfAField(el: Element): unknown {
  return 'value' in el ? el.value : undefined;
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
export function predictedLocation(charId: unknown, upToPhaseExclusive: number): unknown {
  return whereAHeroStandsAfterTheOrdersBefore(
    currentReport,
    theOrdersTheFormHolds(currentReport),
    charId,
    upToPhaseExclusive,
  );
}
export function projectedMoveHost(charId: unknown, ph: number): unknown {
  return theColumnAHeroMarchesWithInAPhase(currentReport, theOrdersTheFormHolds(currentReport), charId, ph);
}
export function predictedItems(charId: unknown, upToPhaseExclusive: number): unknown {
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
): unknown {
  return whatAGarrisonHoldsAsAPhaseBegins(
    currentReport,
    theOrdersTheFormHolds(currentReport),
    provId,
    phase,
    includeSamePhase,
    excludeCharId,
  );
}
export function projectedLedArmies(charId: unknown, upToPhaseExclusive: number): unknown {
  return whatAHeroLeadsAsAPhaseBegins(currentReport, theOrdersTheFormHolds(currentReport), charId, upToPhaseExclusive);
}
export function whereTheCompaniesAHerosRecruitRaisesMuster(o: unknown, ph: number, ticks: unknown): unknown {
  return whereTheCompaniesAHerosRecruitRaisesMusterOnTheseOrders(
    currentReport,
    theOrdersTheFormHolds(currentReport),
    o,
    ph,
    ticks,
  );
}
