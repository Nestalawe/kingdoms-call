// Call to Arms (plan P1-19's alignment abilities family, row P1-19aw2): a Good king's order to muster one free company
// from the folk of a province of his realm, once a turn. Who may give it (the creed, then the king) is the alignment
// abilities' registry's, at "orderValidity: who may give an alignment order"; the rest is the order's own, as the realm's
// works' file held it until P1-19aw2. Its dice in their place: one kcRng() for each Muster Rolls chance, then the
// company's name.
import { THE_ALIGNMENT_ORDERS } from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { kcRng } from '../../rng.ts';
import { QUALITY_TIERS } from '../../army-tables.ts';
import { armyUnitName } from '../../dice-and-army-names.ts';
import { theQualitiesARealmsDiscoveriesMayRaiseACallToArmsAt } from '../../rules/the-registry-of-discovery-effects.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../../turn/events-and-their-audiences.ts';
import { theNameDrawn, theRealmIsHanded } from '../recruit-and-hire-orders-companies-mercenaries-and-heroes.ts';
import { asItsGuardReadsIt } from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { theCompanyACallToArmsMusters } from '../../rules-on-plain-values/the-company-a-call-to-arms-musters-a-blood-offerings-companies-and-a-consecrations-checks.ts';
import { servesARealm } from '../spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type { Character, Realm } from '../../../schemas/saved-game-state.ts';
import type { TurnContext } from '../../turn/context.ts';
import { theCheckAnAlignmentOrderRefusesAHeroOn } from '../../rules/the-registry-of-alignment-abilities.ts';
// GOOD — Call to Arms: the folk answer the king; a free Green garrison unit musters.
export function resolveCallToArmsOrder(
  turnContext: TurnContext,
  c: Character,
  target: string,
  player: Realm | undefined,
) {
  const { G } = turnContext;
  // Only a hero of a realm acts in a phase, and processOrder hands him his realm (as for a Consecration); for none, a
  // TypeError.
  if (!servesARealm(c)) throw new TypeError('a hero who serves no realm calls to arms');
  theRealmIsHanded(player);
  const whoMayGiveIt = theCheckAnAlignmentOrderRefusesAHeroOn(THE_ALIGNMENT_ORDERS['call-to-arms'], {
    isHeTheKing: c.isKing,
    theAlignmentOfHisRealm: G.players[c.player]?.alignment,
  });
  if (whoMayGiveIt === 'his realm is not of its creed') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "only a Good realm's folk answer a Call to Arms", heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (whoMayGiveIt === 'he is not the king') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "only the king's voice carries the Call to Arms", heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (player._calledToArmsTurn === G.turn) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the realm has already answered a Call to Arms this turn', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const ctaProv = G.world.provinces[parseInt(target)];
  if (ctaProv?.owner !== c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Call to Arms must name a province of the realm', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  if (ctaProv.terrain === 'sea' || (ctaProv.race ?? '').startsWith('Primal')) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'only the folk of settled land answer a Call to Arms',
        heroName: c.name,
        provinceName: ctaProv.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  // Elven Bowmen). Take the province's garrison type from its own pool; fall back to the
  // racial garrison, then a plain levy (plan P1-11e22: on plain values, with its race).
  const theCompany = theCompanyACallToArmsMusters(ctaProv);
  const ctaType = theCompany.type;
  ctaProv.garrisonArmies = asItsGuardReadsIt(ctaProv.garrisonArmies) ?? [];
  // the tiers, looked up by a quality of any form a discovery gives (a list of them is none)
  const tiers: readonly unknown[] = QUALITY_TIERS;
  const _ctaQ =
    (theQualitiesARealmsDiscoveriesMayRaiseACallToArmsAt(G.players[c.player])
      .filter((e) => e.theChance == null || kcRng() < e.theChance)
      .map((e) => e.theQuality)
      .find((q): q is string => Boolean(q && tiers.includes(q))) ??
      '') ||
    THE_ALIGNMENT_ORDERS['call-to-arms'].theNumbers.theGradeMustered.value; // ag05 Muster Rolls (a chance per muster; the discoveries'
  // registry's since plan P1-19ae: "orderOutcome: a realm's discoveries raise a call to arms' quality", each chance
  // rolled here, in turn, as before)
  ctaProv.garrisonArmies.push({
    type: ctaType,
    quality: _ctaQ,
    race: theCompany.race,
    unitName: theNameDrawn(armyUnitName(ctaType)),
  });
  player._calledToArmsTurn = G.turn;
  emit(turnContext, {
    type: 'hire',
    fact: { kind: 'the folk answer a Call to Arms', provinceName: ctaProv.name, quality: _ctaQ, unitType: ctaType },
    audience: { actor: c.player, realms: [c.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    province: ctaProv.id,
  });
  return;
}
