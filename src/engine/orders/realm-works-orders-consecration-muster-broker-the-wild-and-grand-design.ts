import { KC_GRAND_DESIGNS, PRIMAL_ARMY_DEFS_P } from '../../content/kingdoms-call-data.ts';
import { THE_MASTERY_ORDERS } from '../../content/mastery-orders-their-keys-names-skills-and-levels.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { beastCommandCount, beastCommandRoom } from '../world/tables.ts';
import { d100 } from '../dice-and-army-names.ts';
import { TM, skillLevel } from '../titles/perks.ts';
import {
  emit,
  logSplit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../turn/events-and-their-audiences.ts';
import { areEnemies } from '../realms/relations-and-captures.ts';
import { refreshMovePool } from '../units/movement-pools.ts';
import { SKILLGAIN_STD, trySkillGain } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { resolveUnitGainInProvince } from '../battle/hosts-gained-in-a-province.ts';
import { theProvinceIsHanded } from './recruit-and-hire-orders-companies-mercenaries-and-heroes.ts';
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import {
  aRealmsNameOrNone,
  servesARealm,
  theOneTakenOut,
} from './spells/what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type { WhereAWildCallingToreBeastsFrom } from './the-facts-the-realm-works-orders-lines-record.ts';
import type { Army, Character, Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';

// ── THE REALM'S WORKS (plan P1-08j3: the third family taken out of processOrder in resolveTurn) ──
// The refusal of a creed's removed orders (Awaken the Wild and Call from the Pit) and three masteries (Awaken Grove,
// Wild Calling, Grand Design); the creeds' own orders are in src/engine/orders/alignment/ (P1-19aw2). Each runs once
// processOrder has read the order and checked he may act (a mastery once a turn; a charmed hero refuses a creed's rite
// or a mastery). Each takes the turn's context first (src/engine/turn/context.ts), then the values processOrder worked
// out before it that it reads, in the order processOrder declares them. Each body keeps processOrder's indent (plan
// P1-08's Decisions); a case-level break became a return.
/** Where a Wild Calling tore beasts from, as its check for one named already compares it (a field the kind lacks is
 *  none). */
interface WhereAsAWildCallingComparesIt {
  readonly kind: string;
  readonly provinceName?: string;
  readonly heroName?: string;
}
/** Whether a place a Wild Calling tore beasts from is one it has named already: the same kind, province and hero, each
 *  compared as it is. */
function theSamePlaceAsNamed(h: WhereAsAWildCallingComparesIt, from: WhereAsAWildCallingComparesIt) {
  return h.kind === from.kind && h.provinceName === from.provinceName && h.heroName === from.heroName;
}
// DRUIDIC Awaken the Wild and EVIL Call from the Pit: REMOVED 2026-10-12 (Toby item 22 — they made Creatures
// and Monsters too easy to come by). An order a save still holds from before is refused in plain words.
export function resolveRemovedAwakenTheWildAndCallFromThePitOrders(
  turnContext: TurnContext,
  c: Pick<Character, 'name' | 'player'>,
  action: string,
) {
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: 'the orders that called beasts are no more',
      heroName: c.name,
      itWasCallFromThePit: action === 'call_pit',
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
  });
  return;
}
// Awaken Grove (Druid 7, once a turn): Forest Ents march with the druid until the turn's end.
export function resolveAwakenGroveOrder(
  turnContext: TurnContext,
  c: Character,
  ph: number,
  prov: Province | undefined,
) {
  if (skillLevel(c, 'druid') < THE_MASTERY_ORDERS.awaken_grove.level) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Druid mastery to Awaken a Grove', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  theProvinceIsHanded(prov); // the province he stands in (processOrder's: there is one)
  const okTerrain = prov.terrain === 'forest' || prov.terrain === 'jungle' || (prov.race ?? '').startsWith('Primal');
  if (prov.owner !== c.player || !okTerrain) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Awaken Grove works only in an owned forest, jungle or wild province', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const grove = {
    type: 'Forest Ents',
    quality: 'Veteran',
    race: 'Forest Ent',
    unitName: 'an awakened Grove',
    _temporary: true,
    _expiresAfterPhase: -1,
  };
  c.armies = asItsGuardReadsIt(c.armies) ?? [];
  c.armies.push(grove);
  logSplit(
    turnContext,
    'explore',
    { kind: 'a druid awakens the grove', heroName: c.name, provinceName: prov.name },
    {
      kind: 'onlookers see a druid awaken the grove',
      heroName: c.name,
      realmName: aRealmsNameOrNone(turnContext.G.players, c.player),
      provinceName: prov.name,
    },
    {
      audience: { actor: c.player },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    },
  );
  resolveUnitGainInProvince(turnContext, c, prov, ph);
  trySkillGain(turnContext, c, 'druid', SKILLGAIN_STD);
  return;
}
// Wild Calling (Druid 9, once a turn): wild beasts in the province that serve another may break and follow the caller.
export function resolveWildCallingOrder(
  turnContext: TurnContext,
  c: Character,
  ph: number,
  prov: Province | undefined,
) {
  const { G } = turnContext;
  // the wild's units, by any unit's type
  const primalDefs: Readonly<Partial<Record<string, object>>> = PRIMAL_ARMY_DEFS_P;
  // ── WILD CALLING ── every primal creature or monster in this province that does not
  // already serve you — a neutral primal host, an enemy commander's beasts, or unled garrison
  // beasts — has a 50% chance to defect and fall in behind the caller. Humanoid troops,
  // fleets, machines and the walking dead are deaf to it.
  if (skillLevel(c, 'druid') < THE_MASTERY_ORDERS.wild_calling.level) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Druid mastery to sound a Wild Calling', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  theProvinceIsHanded(prov); // the province he stands in (processOrder's: there is one)
  const _wcIsBeast = (u: Army | null | undefined) =>
    !!u && !u._isSkeletal && (CREATURE_ARMIES.has(u.type) || MONSTER_ARMIES.has(u.type) || !!primalDefs[u.type]);
  const _wcWon: Army[] = [];
  const _wcHeard: WhereAWildCallingToreBeastsFrom[] = [];
  let _wcCalled = 0;
  const _wcRoom = beastCommandRoom(c, G.characters); // item 24: no more answer than the caller's Druid has room for
  const _wcSift = (
    arr: (Army | null | undefined)[] | null | undefined,
    from: WhereAWildCallingToreBeastsFrom | null,
  ) => {
    if (!Array.isArray(arr)) return;
    for (let i = arr.length - 1; i >= 0; i--) {
      const u = arr[i];
      if (!_wcIsBeast(u)) continue;
      _wcCalled++;
      if (_wcWon.filter(beastCommandCount).length >= _wcRoom) continue;
      if (d100() <= 50) {
        _wcWon.push(Object.assign({}, theOneTakenOut(arr, i), { _pacified: true }));
        // named once however many of its beasts answer (the same garrison, or a hero of the same name)
        if (from && !_wcHeard.some((h) => theSamePlaceAsNamed(h, from))) _wcHeard.push(from);
      }
    }
  };
  _wcSift(prov.neutralDefenders, null); // the wild host of a primal province
  if (prov.owner != null && prov.owner !== c.player)
    _wcSift(prov.garrisonArmies, { kind: 'the garrison of a province', provinceName: prov.name });
  else if (prov.owner == null) _wcSift(prov.garrisonArmies, null);
  (asItsGuardReadsIt(G.characters) ?? []).forEach((o: Character | null | undefined) => {
    if (!o?.alive || o.id === c.id || o.location !== c.location) return;
    if (o.player === c.player) return; // never poached from your own commanders
    if (o.player != null && !areEnemies(turnContext, c.player, o.player)) return; // and never from a realm you are not at war with
    const before = _wcWon.length;
    _wcSift(o.armies, { kind: "a hero's host", heroName: o.name });
    if (_wcWon.length > before && o.player != null) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "the beasts of a hero's host answer a Wild Calling",
          heroName: o.name,
          provinceName: prov.name,
          lost: _wcWon.length - before,
        },
        audience: { actor: o.player, realms: [o.player] },
        province: prov.id,
        hero: o.id,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      if (typeof refreshMovePool === 'function') refreshMovePool(turnContext, o);
    }
  });
  if (_wcCalled === 0) {
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'nothing wild stands here to answer a Wild Calling', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    });
    return;
  }
  if (_wcWon.length === 0) {
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: 'not one wild creature breaks for a Wild Calling',
        heroName: c.name,
        called: _wcCalled,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player], seen: 'there' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    });
    trySkillGain(turnContext, c, 'druid', SKILLGAIN_STD);
    return;
  }
  c.armies = (asItsGuardReadsIt(c.armies) ?? []).concat(_wcWon);
  logSplit(
    turnContext,
    'explore',
    {
      kind: 'wild creatures answer a Wild Calling',
      heroName: c.name,
      provinceName: prov.name,
      won: _wcWon.length,
      called: _wcCalled,
      tornFrom: _wcHeard.slice(),
    },
    {
      kind: 'onlookers see wild creatures answer a Wild Calling',
      heroName: c.name,
      realmName: aRealmsNameOrNone(G.players, c.player),
      provinceName: prov.name,
      won: _wcWon.length,
    },
    {
      audience: { actor: c.player },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    },
  );
  if (typeof refreshMovePool === 'function') refreshMovePool(turnContext, c);
  resolveUnitGainInProvince(turnContext, c, prov, ph);
  trySkillGain(turnContext, c, 'druid', SKILLGAIN_STD);
  return;
}
// Grand Design (Sage 9, once a realm): the Wonder of the realm's alignment, raised in the province he stands in.
export function resolveGrandDesignOrder(turnContext: TurnContext, c: Character, prov: Province | undefined) {
  const { G } = turnContext;
  if (skillLevel(c, 'sage') < THE_MASTERY_ORDERS.grand_design.level) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero lacks the Sage mastery to realise a Grand Design', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  // Only a hero of a realm acts in a phase, and every realm's index names a realm of the state; for none, the TypeError
  // the read of his realm's discoveries throws.
  if (!servesARealm(c)) throw new TypeError("Cannot read properties of undefined (reading 'discoveries')");
  const player = G.players[c.player];
  if (!player) throw new TypeError("Cannot read properties of undefined (reading 'discoveries')");
  player.discoveries ??= [];
  if (player.discoveries.some((d) => d.id === 'gd')) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'the realm has already completed its Grand Design', realmName: player.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return;
  }
  const _GD_DEFS: Readonly<Partial<Record<string, { readonly name: string; readonly desc: string }>>> = {
    ...KC_GRAND_DESIGNS,
  };
  const _gdA = (G.players[c.player]?.alignment ?? '') || 'Neutral';
  const _gdD = _GD_DEFS[_gdA] ?? { name: 'The Great Work', desc: 'A unique realm-wide Wonder.' };
  // the Wonder now STANDS SOMEWHERE. Its province is recorded on the realm and on the
  // province itself; every benefit is gated on the builder still holding that ground
  // (gdActive), and is regained in full the moment the province is retaken. The Wonder itself is
  // never destroyed and never changes hands — a conqueror gains nothing but the view.
  theProvinceIsHanded(prov); // the province he stands in (processOrder's: there is one)
  player.gdProvinceId = prov.id;
  player.gdName = _gdD.name;
  prov.grandDesign = { owner: c.player, name: _gdD.name, alignment: _gdA, builtTurn: G.turn };
  player.discoveries.push({
    id: 'gd',
    name: 'Grand Design \u2014 ' + _gdD.name,
    category: 'Wonder',
    desc: _gdD.desc,
    turnDiscovered: G.turn,
    provinceId: prov.id,
    provinceName: prov.name,
  });
  TM(c).discoveries += 1;
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: "a hero completes the realm's Grand Design",
      heroName: c.name,
      realmName: player.name,
      wonderName: _gdD.name,
      wonderDescription: _gdD.desc,
      provinceName: prov.name,
    },
    audience: { actor: c.player, realms: [c.player], seen: 'there' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    province: prov.id,
  });
  trySkillGain(turnContext, c, 'sage', SKILLGAIN_STD);
  return;
}
