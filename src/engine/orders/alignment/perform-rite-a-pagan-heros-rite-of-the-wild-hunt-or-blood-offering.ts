// Perform Rite (plan P1-19's alignment abilities family, row P1-19aw2): a Pagan hero's rite at a ritual site, the Rite
// of the Wild Hunt or the Blood Offering, one rite a province a turn (R-008). Who may give it (the creed alone) is the
// alignment abilities' registry's, at "orderValidity: who may give an alignment order"; the rest is the order's own, as
// the explore and search orders' file held it until P1-19aw2. Its dice in their place: the Wild Hunt's beasts' names,
// drawn in its loop.
import { PRIMAL_ARMY_DEFS_P } from '../../../content/kingdoms-call-data.ts';
import { THE_ALIGNMENT_ORDERS } from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { QUALITY_TIERS } from '../../army-tables.ts';
import { WILD_HUNT_UNITS, theTurnsAWildHuntServesBeyondThisOne, wildHuntPrice } from '../../items/tiers-and-hoards.ts';
import { recordBattleGraves } from '../../graves.ts';
import { featDiscovered } from '../../sight/heroes-in-sight-features-discovered-and-army-size-bands.ts';
import { armyUnitName } from '../../dice-and-army-names.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../../turn/events-and-their-audiences.ts';
import { refreshMovePool } from '../../units/movement-pools.ts';
import { resolveUnitGainInProvince } from '../../battle/hosts-gained-in-a-province.ts';
import { asItsGuardReadsIt } from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { theCompaniesABloodOfferingGivesAndRaises } from '../../rules-on-plain-values/the-company-a-call-to-arms-musters-a-blood-offerings-companies-and-a-consecrations-checks.ts';
import { unitAsItsRealmSeesIt } from '../../rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import { servesARealm } from '../spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import {
  theNameDrawn,
  theProvinceIsHanded,
  theRealmIsHanded,
} from '../recruit-and-hire-orders-companies-mercenaries-and-heroes.ts';
import type { ABeastBoundAsTheLineNamesIt } from '../the-facts-the-explore-and-search-orders-lines-record.ts';
import type { Army, Character, Province, Realm } from '../../../schemas/saved-game-state.ts';
import type { TurnContext } from '../../turn/context.ts';
import { theCheckAnAlignmentOrderRefusesAHeroOn } from '../../rules/the-registry-of-alignment-abilities.ts';
/** A company as the Blood Offering reads it: a hero's, and whether it is borrowed for a while (summoned, charmed). */
type ACompanyAsTheBloodOfferingReadsIt = Army & { readonly _temporary?: boolean | undefined };
// Perform Rite (Pagan realms, at a ritual site): the Rite of the Wild Hunt, or the Blood Offering.
export function resolvePerformRiteOrder(
  turnContext: TurnContext,
  c: Character,
  ph: number,
  target: string,
  extra: string,
  prov: Province | undefined,
  player: Realm | undefined,
) {
  const { G } = turnContext;
  // Only a hero of a realm acts in a phase, and processOrder hands him his realm and the province he stands in (as for
  // an Explore); for none, a TypeError.
  if (!servesARealm(c)) throw new TypeError('a hero who serves no realm performs a rite');
  // ── PAGAN: Perform Rite ── Only Pagan realms; only at a DISCOVERED ritual site.
  const whoMayGiveIt = theCheckAnAlignmentOrderRefusesAHeroOn(THE_ALIGNMENT_ORDERS['perform-rite'], {
    isHeTheKing: c.isKing,
    theAlignmentOfHisRealm: G.players[c.player]?.alignment,
  });
  if (whoMayGiveIt === 'his realm is not of its creed') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero who does not keep the old faith cannot perform rites', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  // a ritual site in your OWN province is always known to you (it shows on your map), so the
  // rite may be performed there without first Exploring. Elsewhere, the site must be
  // discovered.
  theProvinceIsHanded(prov);
  const _riteSite = (asItsGuardReadsIt(prov.features) ?? []).find(
    (f) => f.ritualSite && (featDiscovered(f, c.player) || prov.owner === c.player),
  );
  if (!_riteSite) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero finds no ritual site for a rite', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  // ONE RITE PER PROVINCE PER TURN (2026-09-19, Toby): once any realm's rite has been
  // performed here this turn, every later attempt in the province fails, whoever makes it.
  // Stamped with the turn number (prov._riteTurn) rather than a per-turn scratch flag, so there
  // is nothing to clear. Only a rite that actually HAPPENS stamps it — one that fails for want
  // of gold, creatures or units leaves the stones free for someone else.
  if (prov._riteTurn === G.turn) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'the stones have already answered a rite this turn',
        heroName: c.name,
        siteName: _riteSite.name,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    });
    return;
  }
  const _rite = (target || '').toLowerCase();
  if (_rite.startsWith('wild')) {
    // ── Rite of the Wild Hunt ── Bind the province's native primal creatures for this turn
    // and WILD_HUNT_TURNS more. The ONLY way to field Creatures/Monsters without Druid magic.
    const primalDefs: Readonly<Partial<Record<string, object>>> = PRIMAL_ARMY_DEFS_P; // read by any unit's type
    const _wildType = (asItsGuardReadsIt(prov.armyTypes) ?? []).find((t) => primalDefs[t]);
    if (!_wildType) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'nothing wild answers the Wild Hunt',
          heroName: c.name,
          siteName: _riteSite.name,
          provinceName: prov.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: prov.id,
      });
      return;
    }
    const _huntCost = wildHuntPrice(_wildType);
    theRealmIsHanded(player);
    if ((player.gold || 0) < _huntCost) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a hero cannot afford the Wild Hunt offerings', heroName: c.name, price: _huntCost },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      return;
    }
    player.gold -= _huntCost;
    prov._riteTurn = G.turn; // the province's one rite this turn is spent
    c.armies = asItsGuardReadsIt(c.armies) ?? [];
    const _bound: ABeastBoundAsTheLineNamesIt[] = [];
    for (let wi = 0; wi < WILD_HUNT_UNITS; wi++) {
      // the bound beasts are VETERAN. _wildHuntUntilTurn is the LAST turn they serve
      // (released by the end-of-turn sweep once G.turn has advanced PAST it).
      const _u: Army = {
        type: _wildType,
        quality: 'Veteran',
        race: (prov.race ?? '') || 'Primal',
        unitName: theNameDrawn(armyUnitName(_wildType)),
        _wildHuntUntilTurn: G.turn + theTurnsAWildHuntServesBeyondThisOne(G.players[c.player]),
      };
      c.armies.push(_u);
      _bound.push({ unitName: _u.unitName, type: _wildType });
    }
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: 'a hero performs the Rite of the Wild Hunt',
        heroName: c.name,
        siteName: _riteSite.name,
        price: _huntCost,
        beasts: _bound,
      },
      audience: { actor: c.player, realms: [c.player], seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    });
    // Gaining a force in a province you don't own is resolved like any other unit gain:
    // defenders present means a battle, none means the character takes control.
    resolveUnitGainInProvince(turnContext, c, prov, ph);
    return;
  }
  // ── Blood Offering (default) ── The player names units to SACRIFICE and an EQUAL number of
  // units to EMPOWER; each empowered unit gains TWO experience tiers (capped at Elite). Some
  // units are given up to make others stronger. Encoded in the order's `extra` as
  // "S:i,j|E:a,b" — indices into the character's army. Borrowed/temporary/skeletal units can
  // be neither offered nor raised.
  const _tiers = QUALITY_TIERS.slice();
  const _army: ACompanyAsTheBloodOfferingReadsIt[] = asItsGuardReadsIt(c.armies) ?? [];
  // a company the offering names, by an index the rite may take (so there is one); for none, a TypeError
  const theCompanyNamed = (i: number) => {
    const a = _army[i];
    if (!a) throw new TypeError('a company the Blood Offering names is none');
    return a;
  };
  // the companies it gives and raises, on plain values (plan P1-11e22)
  const theMarked = theCompaniesABloodOfferingGivesAndRaises(_army, extra, unitAsItsRealmSeesIt);
  if (!theMarked) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero makes no Blood Offering', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const _bn = theMarked.given.length; // each sacrifice funds exactly one empowerment
  const _sac = theMarked.given.map(theCompanyNamed);
  const _ben = theMarked.raised.map(theCompanyNamed);
  prov._riteTurn = G.turn; // the province's one rite this turn is spent
  c.armies = _army.filter((a) => !_sac.includes(a));
  recordBattleGraves(turnContext, prov, _sac);
  _ben.forEach((b) => {
    const cur = _tiers.indexOf(b.quality);
    if (cur > -1) {
      // its row's tiers up (two), Elite at most: a tier of the five
      const risen =
        _tiers[Math.min(4, cur + THE_ALIGNMENT_ORDERS['perform-rite'].theNumbers.theBloodOfferingsGrades.value)];
      if (risen === undefined) throw new TypeError('a quality two tiers up is none');
      b.quality = risen;
    }
  });
  if (typeof refreshMovePool === 'function') refreshMovePool(turnContext, c); // the host is smaller now — pace may change
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: 'a hero makes a Blood Offering',
      heroName: c.name,
      siteName: _riteSite.name,
      offered: _sac.map((a) => a.unitName || a.type),
      count: _bn,
      empowered: _ben.map((a) => ({ name: a.unitName || a.type, quality: a.quality })),
    },
    audience: { actor: c.player, realms: [c.player], seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    province: prov.id,
  });
  return;
}
