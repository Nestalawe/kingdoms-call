// Broker (plan P1-19's alignment abilities family, row P1-19aw2): a Neutral king's order to hire a wandering hero from
// afar, or to buy word from a province the realm has seen. Who may give it (the creed, then the king) is the alignment
// abilities' registry's, at "orderValidity: who may give an alignment order"; the rest is the order's own, as the realm's
// works' file held it until P1-19aw2. It draws no die of its own.
import { THE_ALIGNMENT_ORDERS } from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { heroHireWage } from '../../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { grantMithrilTo } from '../../personal-combat/helpers.ts';
import { doARealmsDiscoveriesWaiveTheHiringBan } from '../../rules/the-registry-of-discovery-effects.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../../turn/events-and-their-audiences.ts';
import { setMovePool } from '../../units/movement-pools.ts';
import { applySpySuccess } from '../../espionage/what-a-spy-learns.ts';
import {
  landHirePreOrders,
  theRealmIsHanded,
  type TheStateAsTheHireReadsIt,
} from '../recruit-and-hire-orders-companies-mercenaries-and-heroes.ts';
import { asItsGuardReadsIt } from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { servesARealm } from '../spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type { TheFactOfTheRealmWorksOrdersLine } from '../the-facts-the-realm-works-orders-lines-record.ts';
import type { Character, Realm } from '../../../schemas/saved-game-state.ts';
import type { TurnContext } from '../../turn/context.ts';
import { theCheckAnAlignmentOrderRefusesAHeroOn } from '../../rules/the-registry-of-alignment-abilities.ts';
// NEUTRAL — Broker: money moves what armies cannot. Remote hire, or a paid remote spy.
export function resolveBrokerOrder(
  turnContext: TurnContext,
  c: Character,
  ph: number,
  target: string,
  player: Realm | undefined,
) {
  const { G, SEASONS }: Pick<TurnContext, 'SEASONS'> & { readonly G: TheStateAsTheHireReadsIt } = turnContext;
  // Only a hero of a realm acts in a phase, and processOrder hands him his realm (as for a Consecration); for none, a
  // TypeError.
  if (!servesARealm(c)) throw new TypeError('a hero who serves no realm keeps brokers');
  theRealmIsHanded(player);
  const whoMayGiveIt = theCheckAnAlignmentOrderRefusesAHeroOn(THE_ALIGNMENT_ORDERS.broker, {
    isHeTheKing: c.isKing,
    theAlignmentOfHisRealm: G.players[c.player]?.alignment,
  });
  if (whoMayGiveIt === 'his realm is not of its creed') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'only a Neutral crown keeps brokers', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (whoMayGiveIt === 'he is not the king') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "only the king commands the realm's brokers", heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const _bk = (target || '').split(':');
  if (_bk[0] === 'hire') {
    const bh = G.characters[parseInt(String(_bk[1]))];
    const bhProv = bh ? G.world.provinces[bh.location] : null;
    const _visible =
      bhProv && (bhProv.owner === c.player || (asItsGuardReadsIt(bhProv.visitedBy) ?? []).includes(c.player));
    if (bh?.player !== null || !bh.alive || bh._isNeutralGuard || bh._justDefeated || !_visible) {
      emit(turnContext, {
        type: 'hire',
        fact: { kind: 'the brokers find no such hero within reach', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      return;
    }
    if (bh._releasedTurn === G.turn) {
      emit(turnContext, {
        type: 'hire',
        fact: { kind: 'a hero just released from service hears no offers this turn', heroName: bh.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      return;
    } // same rule as Hire Hero
    // sd31 Diplomatic Protocols (the discoveries' registry's since plan P1-19ae: "orderValidity: a realm's discoveries
    // waive the hiring ban")
    const bWage = heroHireWage(
      (G.players[c.player]?.alignment ?? '') || 'Neutral',
      bh.alignment,
      doARealmsDiscoveriesWaiveTheHiringBan(G.players[c.player]),
      bh,
    );
    if (bWage == null) {
      emit(turnContext, {
        type: 'hire',
        fact: { kind: 'a hero will not treat with the brokers across the alignment gulf', heroName: bh.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      return;
    }
    if ((player.gold || 0) < bWage) {
      emit(turnContext, {
        type: 'hire',
        fact: { kind: 'a king cannot afford a brokered hero', heroName: c.name, wantedName: bh.name, wage: bWage },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      return;
    }
    bh.pay = bWage;
    player.gold -= bWage;
    bh.player = c.player;
    bh.name = bh.name.replace(' (wandering)', '');
    // a brokered hire is a HIRE.
    if (bh.race === 'Dwarven' && G.players[c.player]?.race === 'Dwarven') grantMithrilTo(bh, G); // mithril on hire into a dwarf realm
    player.heroes = asItsGuardReadsIt(player.heroes) ?? [];
    player.heroes.push(bh.id);
    bh.hiredInPhase = ph;
    const brokeredsId = bh.id; // (a plain name as the key: the compiler sees his orders made sure below)
    G.turnOrders[brokeredsId] ??= [null, null, null, null, null];
    for (let p2 = 0; p2 <= ph; p2++)
      G.turnOrders[brokeredsId][p2] = G.turnOrders[brokeredsId][p2] ?? {
        action: 'defend',
        target: '',
        extra: '',
        desc: '(not yet hired)',
      };
    landHirePreOrders(turnContext, bh, c, ph, player); // 2026-09-23: the brokered hero's pre-written orders + plan
    setMovePool(turnContext, bh);
    const _brokerFact: Extract<
      TheFactOfTheRealmWorksOrdersLine,
      { kind: "a wandering hero accepts the realm's terms by courier" }
    > = {
      kind: "a wandering hero accepts the realm's terms by courier",
      heroName: bh.name,
      race: bh.race,
      alignment: bh.alignment,
      provinceName: bhProv.name,
      realmName: player.name,
      wage: bWage,
      seasonName: (SEASONS[ph + 1] ?? '') || null,
    };
    emit(turnContext, {
      type: 'hire',
      fact: _brokerFact,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: bhProv.id,
    });
    // mirror into the brokered hero's own Chronicle section at the hire phase.
    emit(turnContext, {
      type: 'hire',
      fact: _brokerFact,
      audience: { actor: c.player, realms: [c.player] },
      province: bhProv.id,
      hero: bh.id,
      phase: ph,
    });
  } else if (_bk[0] === 'spy') {
    const sp2 = G.world.provinces[parseInt(String(_bk[1]))];
    const _seen =
      sp2 &&
      (sp2.owner === c.player ||
        (asItsGuardReadsIt(sp2.visitedBy) ?? []).includes(c.player) ||
        (sp2.exploredBy?.[c.player] ?? 0) > 0);
    if (!sp2 || !_seen) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'the brokers reach only provinces the realm has seen', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      return;
    }
    if ((player.gold || 0) < THE_ALIGNMENT_ORDERS.broker.theNumbers.thePriceOfWordFromAProvince.value) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'the treasury cannot pay for brokered word', heroName: c.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      return;
    }
    player.gold -= THE_ALIGNMENT_ORDERS.broker.theNumbers.thePriceOfWordFromAProvince.value;
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the brokers buy word from a province', heroName: c.name, provinceName: sp2.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    applySpySuccess(turnContext, c, sp2);
  } else {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Broker order names no target', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
  }
  return;
}
