// Consecrate (plan P1-19's alignment abilities family, row P1-19aw2): a Divine king's order to sanctify one province of
// his realm. Who may give it (the king, then the creed) is the alignment abilities' registry's, at "orderValidity: who
// may give an alignment order"; the rest is the order's own, as processOrder's case wrote it (plan P1-08j3) and the
// realm's works' file held it until P1-19aw2. It draws no die.
import { THE_ALIGNMENT_ORDERS } from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { homeProvinceIdFor } from '../../grand-design.ts';
import {
  consecratedIds,
  layConsecratedGround,
} from '../../world/the-marks-on-a-province-consecrated-ground-terror-and-enslave.ts';
import { getNeighborsP } from '../../world/map-helpers.ts';
import { theConsecrationsAKingMayHold } from '../../heroes/fame-and-consecration.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../../turn/events-and-their-audiences.ts';
import { theProvinceIsHanded } from '../recruit-and-hire-orders-companies-mercenaries-and-heroes.ts';
import { whyAKingMayNotConsecrateAProvince } from '../../rules-on-plain-values/the-company-a-call-to-arms-musters-a-blood-offerings-companies-and-a-consecrations-checks.ts';
import { servesARealm } from '../spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type { Character, Province, Realm } from '../../../schemas/saved-game-state.ts';
import type { TurnContext } from '../../turn/context.ts';
import { theCheckAnAlignmentOrderRefusesAHeroOn } from '../../rules/the-registry-of-alignment-abilities.ts';
/** A province of the map a realm's home names: every realm's home is one, so there is one; for none, the TypeError the
 *  reading of its neighbours throws. */
function theHomeOnTheMap(home: Province | undefined): Province {
  if (!home) throw new TypeError("Cannot destructure property 'row' of 'prov' as it is undefined.");
  return home;
}
// DIVINE — Consecrate: sanctify ONE owned province as the realm's holy heart.
export function resolveConsecrateOrder(
  turnContext: TurnContext,
  c: Character,
  prov: Province | undefined,
  player: Realm | undefined,
) {
  const { G } = turnContext;
  // Only a hero of a realm acts in a phase (actingThisPhase passes none without one, and Release Hero frees only the
  // hero who gives it, for the phases after), so he serves one; for none, a TypeError.
  if (!servesARealm(c)) throw new TypeError('a hero who serves no realm consecrates');
  const whoMayGiveIt = theCheckAnAlignmentOrderRefusesAHeroOn(THE_ALIGNMENT_ORDERS.consecrate, {
    isHeTheKing: c.isKing,
    theAlignmentOfHisRealm: G.players[c.player]?.alignment,
  });
  if (whoMayGiveIt === 'he is not the king') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'only the king can consecrate ground', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (whoMayGiveIt === 'his realm is not of its creed') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the gods answer a consecration only from a Divine crown', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  theProvinceIsHanded(prov); // the province he stands in (processOrder's: there is one)
  // the checks on plain values (plan P1-11e22), each fact asked only once the checks before it have passed
  const theAnswer = whyAKingMayNotConsecrateAProvince({
    theProvinceId: prov.id,
    itIsHisRealms: prov.owner === c.player,
    theHomeMarches: () => {
      const _homeId = homeProvinceIdFor(G, c.player);
      return {
        theHomeId: _homeId,
        theProvincesBesideIt:
          _homeId != null
            ? getNeighborsP(
                theHomeOnTheMap(G.world.provinces[_homeId]),
                G.world.cols,
                G.world.rows,
                G.world.provinces,
              ).map((x) => x.id)
            : [],
      };
    },
    theConsecrated: () => consecratedIds(player),
    theProvincesBesideIt: () => getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces).map((x) => x.id),
    theConsecrationsHeMayHold: () => theConsecrationsAKingMayHold(c, G.players[c.player]),
  });
  if (theAnswer.refused === 'it is not a province of his realm') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'only a province of the realm can be consecrated', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (theAnswer.refused === 'it lies in the home marches') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the home marches were anointed at the coronation', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (theAnswer.refused === 'it is consecrated already') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the province is already consecrated', provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (theAnswer.refused === 'a consecrated province lies beside it') {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'two consecrated provinces may not lie side by side',
        heroName: c.name,
        provinceName: prov.name,
        neighbourName: (G.world.provinces[theAnswer.theNeighbourId]?.name ?? '') || null,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (theAnswer.refused === 'he knows no White') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'consecration flows from the White arts', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (theAnswer.refused === 'he holds as many as he may') {
    const { theConsecrated: _cList, theLimit: _cLimit } = theAnswer;
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'the White faith can sustain no more consecrated provinces',
        heroName: c.name,
        limit: _cLimit,
        consecratedNames: _cList.map((id) => G.world.provinces[id]?.name).filter((n): n is string => Boolean(n)),
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const { theConsecrated: _cList, theLimit: _cLimit } = theAnswer;
  layConsecratedGround(_cList, prov.id); // the marks' module lays it (plan P1-19ay2)
  // 2026-10-15 (Toby, D8): no Hierophant merit — only a Divine king can consecrate, so it was a
  // creed-only route to a title. Bless Province, Holy Symbol and Resurrect still count.
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: 'a king consecrates a province',
      heroName: c.name,
      provinceName: prov.name,
      consecrated: _cList.length,
      limit: _cLimit,
    },
    audience: { actor: c.player, realms: [c.player], seen: 'there' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    province: prov.id,
    env: true,
  });
  return;
}
