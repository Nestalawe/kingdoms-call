// Harvest the Field (plan P1-19's alignment abilities family, row P1-19aw2): an Undead realm's order to raise the best
// grave of a province as a skeletal company, for the corpse-carters' price. Who may give it (the creed alone) is the
// alignment abilities' registry's, at "orderValidity: who may give an alignment order"; the rest is the order's own, as
// the realm's works' file held it until P1-19aw2. Its one die in its place: a name for a grave that has none.
import { KC_QUALITY_UP } from '../../../content/kingdoms-call-data.ts';
import { THE_ALIGNMENT_ORDERS } from '../../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { takeBestGrave } from '../../graves.ts';
import { armyUnitName } from '../../dice-and-army-names.ts';
import { gdActive } from '../../discoveries.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../../turn/events-and-their-audiences.ts';
import { theCorpseCartersPriceForARealm } from '../../realms/the-corpse-carters-price-for-a-realm.ts';
import { effStat } from '../../heroes/effective-skills-and-hidden-heroes.ts';
import { resolveUnitGainInProvince } from '../../battle/hosts-gained-in-a-province.ts';
import { theProvinceIsHanded, theRealmIsHanded } from '../recruit-and-hire-orders-companies-mercenaries-and-heroes.ts';
import { asItsGuardReadsIt } from '../../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import { servesARealm } from '../spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type { Character, Province, Realm } from '../../../schemas/saved-game-state.ts';
import type { TurnContext } from '../../turn/context.ts';
import { theCheckAnAlignmentOrderRefusesAHeroOn } from '../../rules/the-registry-of-alignment-abilities.ts';
// UNDEAD — Harvest the Field: no spell, just the grim trade. One grave becomes one soldier.
export function resolveHarvestTheFieldOrder(
  turnContext: TurnContext,
  c: Character,
  ph: number,
  prov: Province | undefined,
  player: Realm | undefined,
) {
  const { G } = turnContext;
  // Only a hero of a realm acts in a phase, and processOrder hands him his realm (as for a Consecration); for none, a
  // TypeError.
  if (!servesARealm(c)) throw new TypeError('a hero who serves no realm harvests the field');
  theRealmIsHanded(player);
  const whoMayGiveIt = theCheckAnAlignmentOrderRefusesAHeroOn(THE_ALIGNMENT_ORDERS['harvest-the-field'], {
    isHeTheKing: c.isKing,
    theAlignmentOfHisRealm: G.players[c.player]?.alignment,
  });
  if (whoMayGiveIt === 'his realm is not of its creed') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'only Undead realms keep corpse-carters', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  theProvinceIsHanded(prov); // the province he stands in (processOrder's: there is one)
  const hGraves = prov.battleGraves ?? [];
  if (hGraves.length === 0) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'no battlefield dead lie here to raise', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const _hCost = theCorpseCartersPriceForARealm(G.players[c.player]);
  if ((player.gold || 0) < _hCost) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the treasury cannot pay the corpse-carters', heroName: c.name, cost: _hCost },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  player.gold -= _hCost;
  const hGrave = takeBestGrave(prov); // the most experienced dead are worked first
  // the graves just found not empty give one (a gap among them none: the TypeError its read throws)
  if (!hGrave) throw new TypeError("Cannot read properties of null (reading 'type')");
  // the qualities a tier up, by any quality's name
  const qualityUp: Readonly<Partial<Record<string, string>>> = KC_QUALITY_UP;
  const _uTierH = gdActive(turnContext, c.player, 'Undead'); // GRAND DESIGN — Undead
  const hSkel = {
    type: hGrave.type,
    quality: _uTierH ? (qualityUp[hGrave.quality] ?? '') || hGrave.quality : hGrave.quality,
    race: 'Undead',
    _isSkeletal: true,
    unitName: `${String(hGrave.unitName || armyUnitName(hGrave.type))} (Skeletal)`,
  };
  c.armies = asItsGuardReadsIt(c.armies) ?? [];
  c.armies.push(hSkel);
  emit(turnContext, {
    type: 'hire',
    fact: {
      kind: 'the corpse-carters raise a skeletal company',
      heroName: c.name,
      provinceName: prov.name,
      unitName: hSkel.unitName,
      quality: hSkel.quality,
      cost: _hCost,
    },
    audience: { actor: c.player, realms: [c.player], seen: 'there' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    province: prov.id,
  });
  // Harvest the Field is the ONE way to raise the dead without any Necromancy — an Undead
  // realm's carters do it by hand. But a skeletal unit still needs a necromancer to hold it
  // together, so a raiser with no Necromancy is warned at once, while there is still time in
  // the turn to hand the unit to one. Without this the player would simply find it gone at
  // end of turn, having paid for it.
  if (effStat(turnContext, c, 'necromancy') < 1)
    emit(turnContext, {
      type: 'hire',
      fact: {
        kind: 'a raiser with no Necromancy is warned his dead will crumble',
        heroName: c.name,
        unitName: hSkel.unitName,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    });
  resolveUnitGainInProvince(turnContext, c, prov, ph);
  return;
}
