// ── THE WORDS OF THE ORDER DISPATCH'S LINES (plan P1-12d6: P1-12's Decisions of 2026-10-26, Decisions 6 and 7) ──
// The views write the words of each fact the order dispatch's lines record (src/engine/orders/the-facts-the-order-
// dispatchs-lines-record.ts), in the same words the engine wrote before (orders/order-dispatch-the-checks-before-a-
// hero-order-and-the-switch.ts). The tables of the orders' keys and the masteries' names are the engine's
// (army-tables.ts), read here on the order's action. A kind with no words here is a compile error (the `never` below).
import type { TheFactOfTheOrderDispatchsLine } from '../../engine/orders/the-facts-the-order-dispatchs-lines-record.ts';
import { ALIGNMENT_ORDER_KEYS, MASTERY_ORDER_LABEL } from '../../engine/army-tables.ts';

/** A key's words in a table of the engine's words (the masteries', the skills' names), or undefined when it has
 *  none: the table read as its words are, typed. */
export function theWordsInATableFor(table: Readonly<Record<string, string>>, key: string): string | undefined {
  return table[key];
}

/** What a charmed hero will not do, by the order's action: disband, perform a rite, or spend a mastery. */
function whatACharmedHeroWillNotDo(action: string): string {
  return action === 'disband_army'
    ? 'break up companies that are not theirs to disband'
    : ALIGNMENT_ORDER_KEYS.has(action)
      ? 'perform the rites of a realm they do not serve'
      : 'spend their own mastery for a crown that merely holds their mind';
}

/** The words of one fact of the order dispatch's lines. */
export function theWordsOfTheOrderDispatchsLine(fact: TheFactOfTheOrderDispatchsLine): string {
  switch (fact.kind) {
    case "a hero's order is superseded: he joined another hero's battle":
      return `${fact.heroName}'s order superseded — they unified with ${fact.joinedHeroName ?? 'another hero'}'s forces this phase.`;
    case 'a hero too badly hurt to face another guardian rests instead':
      return `${fact.heroName} is too badly hurt to face another guardian this season and rests instead.`;
    case 'a hero weighs the rumour of a lair and leaves it for another day':
      return `${fact.heroName} weighs what the taverns said of the ${fact.lairName ?? 'lair'} and leaves it for another day.`;
    case 'a hero never reaches the lair he set out for and rests instead':
      return `${fact.heroName} never reaches the lair they set out for${fact.provinceName === null ? '' : ` in ${fact.provinceName}`}, and will not go blind into another — the search is abandoned and they rest instead.`;
    case 'a hero locked in an unresolved battle cannot march away':
      return `${fact.heroName} is still locked in the unresolved battle for ${fact.provinceName} and cannot march away — the enemy is on the field and the fight must be seen through before the column can move on.`;
    case 'a charmed hero will not carry out an order of his captor':
      return `${fact.heroName} is held by an enchantment, not an oath — they will not ${whatACharmedHeroWillNotDo(fact.action)}. The order comes to nothing.`;
    case 'a hero who joined the realm this turn has no mastery to give yet':
      return `${fact.heroName} has only just joined the realm — a mastery must wait until next turn. The order comes to nothing.`;
    case 'a hero has already used a mastery this turn':
      return `${fact.heroName} has already used their ${theWordsInATableFor(MASTERY_ORDER_LABEL, fact.action) ?? fact.action} mastery this turn — it may be commanded but once per turn.`;
    case 'a hero lacks the March mastery for a Forced March':
      return `${fact.heroName} lacks the March mastery (7) for a Forced March.`;
    default: {
      const aKindWithNoWords: never = fact;
      throw new Error(`the order dispatch's lines have no words for ${JSON.stringify(aKindWithNoWords)}`);
    }
  }
}
