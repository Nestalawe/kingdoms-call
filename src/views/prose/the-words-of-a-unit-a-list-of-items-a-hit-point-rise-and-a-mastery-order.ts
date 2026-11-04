// ── THE WORDS OF A UNIT, A LIST OF ITEMS, A HIT-POINT RISE AND A MASTERY ORDER (plan P1-13g: P1-13's Decisions of
// 2026-11-03, Decision 2) ──
// Words helpers the prose's move (P1-12d) left behind in the engine, with no engine caller: a unit with its owner
// (ownedUnitName, unitRef: from engine/army-tables.ts), the masteries' names by their keys (MASTERY_ORDER_LABEL, built
// from the content's rows: army-tables.ts), a hero's hit-point rise (hpGainLine: heroes/skills-and-hp.ts), a list of
// items (itemNameList: heroes/fame-and-consecration.ts) and a unit left on the shore (strandLabel: units/sea-lift-
// stranding-and-retreats.ts), each with the shape it reads.
import { THE_MASTERY_ORDERS } from '../../content/mastery-orders-their-keys-names-skills-and-levels.ts';
import { isLegendaryItem } from '../../engine/rules-on-plain-values/items-slots-races-and-who-may-use-them.ts';
import type { AUnitAsDescribeArmyNamesIt } from '../../engine/dice-and-army-names.ts';
import type { Army, Item } from '../../schemas/saved-game-state.ts';

// "Atk's Warg Riders" / "the Red Hand (Atk's Eagle Riders)" — an owner plus a unit's name or type,
// never "Atk's the Red Hand" (2026-09-23d). Module level since 2026-10-11 (they were inside runTurn).
export function ownedUnitName(
  ownerName: string | null | undefined,
  a: Pick<Army, 'type' | 'unitName'> | null | undefined,
): string {
  if (a?.unitName && /^the\s/i.test(a.unitName))
    return `${a.unitName} (${ownerName ? ownerName + "'s " : ''}${a.type})`;
  const nameOrType = a ? a.unitName || a.type : '';
  return `${ownerName ? ownerName + "'s " : ''}${nameOrType || 'unit'}`;
}
export function unitRef(ownerName: string | null | undefined, a: Pick<Army, 'type' | 'unitName' | 'quality'>): string {
  // 2026-09-23d: "the Pale Shades (Vervain's Shadow Archers, Average)" — never "Vervain's the Pale Shades".
  if (a.unitName && /^the\s/i.test(a.unitName))
    return `${a.unitName} (${ownerName ? ownerName + "'s " : ''}${a.type}, ${a.quality})`;
  const core = a.unitName ? `${a.unitName} (${a.type}, ${a.quality})` : `${a.quality} ${a.type}`;
  return ownerName ? `${ownerName}'s ${core}` : core;
}

// The masteries' names, by the key the turn dispatches each by: the content's rows' keys and names, in their order
// (src/content/mastery-orders-their-keys-names-skills-and-levels.ts, P1-11d10).
export const MASTERY_ORDER_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
  Object.values(THE_MASTERY_ORDERS).map((order) => [order.key, order.name]),
);

/** A hero's maximum hit points rising, as its line reads it (rollHpGain's result, or a fight's fact). */
interface AHitPointRiseAsItsLineReadsIt {
  readonly gain: number;
  readonly maxHp?: number | null | undefined;
  readonly wound?: boolean | undefined;
  readonly winBonus?: number | undefined;
  readonly sd35?: boolean | undefined;
}
export function hpGainLine(
  ch: { readonly name?: string | undefined },
  r: AHitPointRiseAsItsLineReadsIt | null | undefined,
) {
  if (!r) return '';
  // 2026-10-08/09 (Toby item 16): a wounded hero rolls too (r.wound); a winner gets +1 on the roll
  // (r.winBonus). Every roll gains — there is no longer a chance of nothing.
  if (!(r.gain > 0)) return '';
  if (r.wound)
    return `💪 ${String(ch.name)} is hardened by the wounds of the fight — maximum HP +${String(r.gain)} → ${String(r.maxHp)}.`;
  return `💪 ${String(ch.name)} is hardened by the victory — maximum HP +${String(r.gain)} → ${String(r.maxHp)}${r.winBonus ? ' (including +1 for the win)' : ''}.${r.sd35 ? ' (Order of the Golden Shield: doubled.)' : ''}`;
}

/** An item as its name is listed: its name, its words and its tier (the LEGENDARY mark). */
type AnItemAsListed = Pick<Item, 'name'> & Partial<Pick<Item, 'desc' | 'tier'>>;
export function itemNameList(items: readonly AnItemAsListed[] | null | undefined, withDesc?: boolean) {
  const wd = withDesc !== false;
  return (items ?? [])
    .map((d) => (isLegendaryItem(d) ? 'the LEGENDARY ' : 'the ') + d.name + (wd && d.desc ? ' (' + d.desc + ')' : ''))
    .join(', ');
}

// A unit as a stranding names it: typed on the way (its file was untyped): a unit as the line copied it.
export function strandLabel(a: AUnitAsDescribeArmyNamesIt) {
  return a.unitName ? `${a.unitName} (${a.quality} ${a.type})` : `a ${a.quality} ${a.type}`;
}
