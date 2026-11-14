import { THE_ALIGNMENT_ORDERS } from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import {
  whatARealmsDiscoveriesAddToTheCorpseCartersCost,
  type ARealmAsTheDiscoveriesReadIt,
} from '../rules/the-registry-of-discovery-effects.ts';

/** The corpse-carters' price for a realm, as Harvest the Field charges it and the report shows it: its row's price, plus
 *  what the realm's discoveries add (a cut is less than 0: az06 Corpse-Carters, the discoveries' registry's since plan
 *  P1-19ae: "orderOutcome: a realm's discoveries cut the corpse-carters' cost"), never below nothing. */
export function theCorpseCartersPriceForARealm(realm: ARealmAsTheDiscoveriesReadIt | null | undefined): number {
  return Math.max(
    0,
    THE_ALIGNMENT_ORDERS['harvest-the-field'].theNumbers.thePrice.value +
      whatARealmsDiscoveriesAddToTheCorpseCartersCost(realm),
  );
}
