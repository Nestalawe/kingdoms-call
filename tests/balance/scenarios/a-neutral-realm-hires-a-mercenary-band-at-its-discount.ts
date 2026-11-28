// A Neutral realm hires a mercenary band at its discount (B-17e): the Neutral mercenary discount, which the matrix's
// games never show (no bot hires a mercenary band: KD-528), staged so it can't miss, and required by every
// `npm run balance` (run.ts): the ability check (the-check-that-every-alignment-ability-is-used-in-some-game.ts) lets
// the discount stand in this scenario, by its name, until the bots hire mercenaries.
//
// The scene: two Human realms, realm 0 Neutral, realm 1 Divine. A band of Veteran Gilded Lances roams the province
// where realm 0's king stands. Realm 0's treasury holds exactly the band's price after the Neutral discount (4g less
// 2g: 2g), so the king can hire it only at the discount; he gives Recruit Armies for the band in Spring. Every other
// hero rests.
//
// Why it can't miss (src/engine/orders/recruit-and-hire-orders-companies-mercenaries-and-heroes.ts): a band roaming
// the province is hired by Recruit Armies on any ground, at its type's price less the realm's alignment's cut, never
// below the least price; a realm that can't pay hires nothing ("a hero cannot afford a mercenary band"). No die is
// rolled. So a hire line shows the discount used: at the full price the treasury falls short. The staging throws if
// the band's price after the discount isn't below its full price, so a change to the price or the discount shows as
// "could not stage", never as luck.
import { order, plan } from '../../lib/scenario.ts';
import { ALIGNMENT_ABILITIES } from '../../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import {
  thePriceOfACompanyOfAType,
  thePriceOfAMercenaryBand,
} from '../../../src/engine/rules-on-plain-values/the-price-of-a-company-of-a-type-and-the-wage-a-company-draws-before-its-cuts.ts';
import { measure, type Hero, type Scenario, type World } from '../../../tools/balance/scenario.ts';
import type { Stats } from '../../../tools/balance/stats.ts';
import { ABILITY_USED } from '../../../tools/balance/the-bots-statistics-by-realm-summed-by-alignment-and-race.ts';
import { HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED } from '../../../tools/balance/the-count-of-each-alignment-abilitys-use-by-its-key.ts';

/** The figure: the Neutral king's hires of a band, read as the matrix's count reads the discount's use, under the
 *  base the bots' statistics give its uses (with no slice: the scenario has one Neutral realm). */
export const HIRED_AT_THE_DISCOUNT = `${ABILITY_USED}the-neutral-mercenary-discount`;
const THE_BAND = { id: 'merc_scenario', type: 'Gilded Lances', quality: 'Veteran', race: 'Human', isSea: false };

// The figure reads the count's own rule (its kinds), not its countATurn: that reads a vm turn (the lines with their
// facts, the worlds before and after, the telemetry's orders), and a scenario has only the stored GM log, whose lines
// keep their kind but not their fact. The rule's realm is the line's actor: here the king's own line (his charId).
/** The line kinds the matrix's count reads the discount's use from (a rule of another kind fails to compile here). */
const THE_KINDS_OF_THE_DISCOUNTS_USE: ReadonlySet<unknown> = new Set(
  HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED['the-neutral-mercenary-discount'].lines.map((l) => l.kind),
);

const scenario: Scenario = {
  title: 'A Neutral king hires a roaming mercenary band his treasury can pay only at the Neutral discount',
  runs: 20,
  figures: [HIRED_AT_THE_DISCOUNT],
  requires: [
    { figure: HIRED_AT_THE_DISCOUNT, in: 'every run', what: 'the Neutral king hires the band at the discount' },
  ],
  async play(sc) {
    const fullPrice = thePriceOfACompanyOfAType(THE_BAND.type);
    const atTheDiscount = thePriceOfAMercenaryBand({
      itsTypesPrice: fullPrice,
      theGoldTheRealmsAlignmentCuts: ALIGNMENT_ABILITIES['the-neutral-mercenary-discount'].theNumbers.theGoldLess.value,
      whatTheRealmsDiscoveriesAdd: 0,
    });
    if (!(atTheDiscount < fullPrice))
      throw new Error(
        `could not stage: the band costs ${String(atTheDiscount)}g at the discount, not less than its ${String(fullPrice)}g`,
      );
    const turn = await sc.turn<World, { king: Hero }>({
      realms: 2,
      seaPct: 10,
      races: ['Human', 'Human'],
      alignments: ['Neutral', 'Divine'],
      prepare(S) {
        const king = S.characters.find((c) => c.alive && c.player === 0 && c.isKing);
        const realm = S.players[0];
        if (!king || !realm) throw new Error('could not stage: realm 0 has no king');
        realm.gold = atTheDiscount;
        (S.mercenaries ??= []).push({ ...THE_BAND, unitName: 'Scenario Company', location: king.location });
        return { king };
      },
      orders: (_S, x) => ({ [x.king.id]: plan(order('recruit', `merc:${THE_BAND.id}`)) }),
    });
    const stats: Stats = measure(turn);
    stats[HIRED_AT_THE_DISCOUNT] = [
      turn.log.filter((e) => e.charId === turn.extra.king.id && THE_KINDS_OF_THE_DISCOUNTS_USE.has(e['kind'])).length,
      1,
    ];
    return stats;
  },
};
export default scenario;
