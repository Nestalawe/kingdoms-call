// Who may give an alignment order, at the stage "orderValidity: who may give an alignment order" (plan P1-19's
// alignment abilities family, row P1-19aw2): a realm of the order's creed alone may give it, and a hero who isn't the
// king may not give one the king alone gives. Each order asks its checks in its own order, as its resolver asked them
// before (one shared order would change a refusal's line: a Consecration asks the king before the creed, a Call to Arms
// and a Broker the creed first, a Harvest of the Field and a Rite the creed alone), and gives the first that refuses the
// hero, or null. The checks themselves are the ones the order form shares (src/engine/rules-on-plain-values/, plan
// P1-11d7), which read the order's row; each order's resolver (src/engine/orders/alignment/) refuses with its own line.
import { THE_ALIGNMENT_ORDERS } from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import {
  aHeroMayGiveTheAlignmentOrderAsKingOrNot,
  aRealmOfThisCreedMayGiveTheAlignmentOrder,
} from '../../rules-on-plain-values/the-alignment-orders-the-names-the-form-writes-and-who-may-give-each.ts';
import type {
  AHeroAsTheChecksOfAnAlignmentOrderReadHim,
  TheCheckAnAlignmentOrderRefusesAHeroOn,
  TheStagesOfEachHookPoint,
} from '../the-registry-of-content-effects.ts';

type TheChecks = TheStagesOfEachHookPoint['orderValidity'];

/** An alignment order's row, as its checks read it. */
type AnAlignmentOrdersRow = (typeof THE_ALIGNMENT_ORDERS)[keyof typeof THE_ALIGNMENT_ORDERS];

/** One check of who may give an order: the refusal it gives the hero, or null when it passes him. */
type ACheckOfWhoMayGiveIt = (
  theOrder: AnAlignmentOrdersRow,
  facts: AHeroAsTheChecksOfAnAlignmentOrderReadHim,
) => TheCheckAnAlignmentOrderRefusesAHeroOn | null;

/** Its creed: a realm of the order's creed alone may give it. */
const ITS_CREED: ACheckOfWhoMayGiveIt = (theOrder, facts) =>
  aRealmOfThisCreedMayGiveTheAlignmentOrder(theOrder, facts.theAlignmentOfHisRealm)
    ? null
    : 'his realm is not of its creed';

/** The king: a hero who isn't the king may not give an order the king alone gives. */
const THE_KING: ACheckOfWhoMayGiveIt = (theOrder, facts) =>
  aHeroMayGiveTheAlignmentOrderAsKingOrNot(theOrder, facts.isHeTheKing) ? null : 'he is not the king';

/** The first of the checks, in their order, that refuses the hero (each asked only once those before it passed him), or
 *  null. */
const theFirstOf =
  (theOrder: AnAlignmentOrdersRow, theChecks: readonly ACheckOfWhoMayGiveIt[]) =>
  (facts: AHeroAsTheChecksOfAnAlignmentOrderReadHim): TheCheckAnAlignmentOrderRefusesAHeroOn | null => {
    for (const check of theChecks) {
      const theRefusal = check(theOrder, facts);
      if (theRefusal !== null) return theRefusal;
    }
    return null;
  };

// Each order's checks in its own order, as its resolver asked them.
export const WHO_MAY_GIVE_AN_ALIGNMENT_ORDER = {
  consecrate: theFirstOf(THE_ALIGNMENT_ORDERS.consecrate, [THE_KING, ITS_CREED]),
  'call-to-arms': theFirstOf(THE_ALIGNMENT_ORDERS['call-to-arms'], [ITS_CREED, THE_KING]),
  broker: theFirstOf(THE_ALIGNMENT_ORDERS.broker, [ITS_CREED, THE_KING]),
  'harvest-the-field': theFirstOf(THE_ALIGNMENT_ORDERS['harvest-the-field'], [ITS_CREED]),
  'perform-rite': theFirstOf(THE_ALIGNMENT_ORDERS['perform-rite'], [ITS_CREED]),
} satisfies Record<keyof typeof THE_ALIGNMENT_ORDERS, TheChecks['who may give an alignment order']>;
