import { kcRng } from '../rng.ts';
import { QUALITY_TIERS } from '../army-tables.ts';
import { consecCaptureXpPct, consecratedIds } from '../heroes/fame-and-consecration.ts';
import { armyUnitName } from '../dice-and-army-names.ts';
import { whatARealmsDiscoveriesAddToAConquestsPlunder } from '../rules/the-registry-of-discovery-effects.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';
import type { TurnContext } from '../turn/context.ts';
import type { AUnitThatRoseAsTheLineNamesIt } from './the-facts-relations-and-captures-lines-record.ts';
import type { ArmyInABattle } from '../army-tables.ts';
import type { UnitType } from '../../content/kingdoms-call-data.ts';
import type { Army, Character, Province } from '../../schemas/saved-game-state.ts';

// Its types (plan P1-10b9): each parameter typed as wide as the body's guards (plan P1-10b's Decision 3), so each guard
// stays. Ids are plain numbers (the schema brands them). A unit's type is a UnitType where its name is drawn
// (armyUnitName takes one), though the schema's is any string.
/** A unit of a conquering column: its battle marks guarded, its quality raised in place. */
type AUnitOfTheColumn = Pick<
  ArmyInABattle,
  'quality' | 'unitName' | '_isSkeletal' | '_died' | '_disbanded' | '_phantom'
> & {
  readonly type: UnitType;
};
/** The hero who took a province: his name, and his column guarded. */
interface TheConqueror {
  readonly id: number;
  readonly name: string;
  readonly armies?: readonly (AUnitOfTheColumn | null | undefined)[] | null | undefined;
}
/** A province as a capture reads it (its ground and tax only for the turn's telemetry). */
interface AProvinceTaken {
  readonly id: number;
  readonly name: string;
  owner: number | null;
  readonly terrain?: string | undefined;
  readonly tax?: number | null | undefined;
}
/** A province an Evil hero conquers: its folk and garrison guarded, its marks written. */
type AProvinceConquered = Pick<Province, 'name' | 'terrain' | '_evilConqTurn' | '_enslavedUntil'> & {
  readonly id: number;
  readonly tax?: number | null | undefined;
  readonly race?: string | null | undefined;
  readonly armyTypes?: readonly UnitType[] | null | undefined;
  // a unit pressed into the garrison takes armyUnitName's name, which may be undefined (its pool never is empty)
  garrisonArmies?:
    (Pick<Army, 'type' | 'quality' | 'race'> & { readonly unitName: string | undefined })[] | null | undefined;
};
/** A hero who conquers: his realm and his conquest doctrine. */
type AnEvilConqueror = Pick<Character, 'name' | 'encounterPlan'> & { readonly player: number };

// ── RELATIONS AND CAPTURES (plan P1-08a: lifted out of resolveTurn) ────
// Who is at war or allied with whom (G.relations, keyed "minIdx-maxIdx": see "DIPLOMACY" in resolveTurn), and what
// happens when a province changes hands: its consecration breaks, its old owner is told, and an Evil conqueror loots
// or enslaves. Each takes the turn's context first (src/engine/turn/context.ts), but relKeyOf, which reads none.
// ── PROVINCE CAPTURE ────
// Every path that hands a province to a new realm goes through here. When the ground was another
// player's, that player gets a line in their REALM EVENTS for the phase — who took it (hero and
// realm) and how many units the conqueror was leading. A capture from neutral/unowned ground
// notifies nobody. Filed with no hero (hero: null, as notifyProvinceOwner does) so the line is never the
// conqueror's and never lands in a character section.
export function breakConsecrationOnCapture(
  turnContext: TurnContext,
  prov: Pick<AProvinceTaken, 'id' | 'name'>,
  prev: number,
  newOwner: number | null | undefined,
  byChar: TheConqueror | null | undefined,
  _ph: number | null | undefined,
) {
  const { G } = turnContext;
  const pl = G.players[prev];
  if (!pl) return;
  const list = consecratedIds(pl);
  const at = list.indexOf(prov.id);
  if (at < 0) return;
  list.splice(at, 1);
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: 'a consecration is broken as its province is captured',
      provinceName: prov.name,
      realmName: pl.name,
    },
    audience: { actor: null, realms: [prev] },
    province: prov.id,
    hero: null,
    phase: _ph ?? 'none',
    form: 'bare',
  });
  if (!byChar || newOwner == null) return;
  const units = (byChar.armies ?? []).filter(
    (a): a is AUnitOfTheColumn => !!a && !a._died && !a._disbanded && !a._phantom,
  );
  if (!units.length) return;
  const _pct = consecCaptureXpPct(G.players[newOwner]); // Undead 100 · Evil 50 · others 0
  const rose: AUnitThatRoseAsTheLineNamesIt[] = [];
  units.forEach((a) => {
    const qi = QUALITY_TIERS.indexOf(a.quality);
    if (a._isSkeletal) return; // skeletons never change quality by any means
    if (qi < 0 || qi >= QUALITY_TIERS.length - 1) return; // Elite (or unknown) cannot rise
    if (_pct > 0 && kcRng() * 100 < _pct) {
      a.quality = QUALITY_TIERS[qi + 1] ?? a.quality; // qi + 1 is a tier: Elite returned above
      rose.push({ unitName: String(a.unitName || armyUnitName(a.type)), quality: a.quality });
    }
  });
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: "a conquering column casts down a province's altars",
      heroName: byChar.name,
      provinceName: prov.name,
      unitsThatRose: rose,
      theTroopsMayRise: _pct > 0,
    },
    audience: { actor: newOwner, realms: [newOwner] },
    province: prov.id,
    hero: byChar.id,
    phase: _ph,
  });
}
export function setProvinceOwner(
  turnContext: TurnContext,
  prov: AProvinceTaken | null | undefined,
  newOwner: number | null,
  byChar: TheConqueror | null | undefined,
  ph?: number | null,
) {
  const { _tel, G } = turnContext;
  if (!prov) return;
  const prev = prov.owner;
  prov.owner = newOwner;
  if (prev !== newOwner) {
    try {
      _tel.captures.push({
        ph: ph ?? turnContext._logCtx.phase ?? turnContext._currentPhase,
        prov: prov.id,
        terrain: prov.terrain,
        tax: Number(prov.tax) || 0,
        from: prev,
        to: newOwner,
        charId: byChar ? byChar.id : null,
      });
    } catch (_te) {}
  }
  // HOLY GROUND FALLS. A consecrated province that changes hands loses its consecration at once
  // (not at the end-of-turn sweep, which remains as the safety net), and every real unit of the
  // conquering column has a consecCaptureXpPct() chance (Undead 100 · Evil 50 · else 0) to gain an experience level.
  if (prev != null && prev !== newOwner)
    breakConsecrationOnCapture(
      turnContext,
      prov,
      prev,
      newOwner,
      byChar,
      ph ?? turnContext._logCtx.phase ?? turnContext._currentPhase,
    );
  if (prev == null || prev === newOwner || newOwner == null) return;
  const _ph = ph ?? turnContext._logCtx.phase ?? turnContext._currentPhase;
  const n = byChar ? (byChar.armies ?? []).filter((a) => a && !a._died && !a._disbanded && !a._phantom).length : 0;
  // type 'system', NOT 'combat': the report re-files combat lines under the viewer's commander
  // who fought in that province that phase (battleCommanders), which would pull this out of Realm
  // Events.
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: 'a realm is told a province has been captured from it',
      provinceName: prov.name,
      conquerorName: byChar ? byChar.name : null,
      realmName: G.players[newOwner] ? G.players[newOwner].name : null, // newOwner is set: returned above
      unitsLed: byChar ? n : null,
    },
    audience: { actor: null, realms: [prev] },
    province: prov.id,
    hero: null,
    phase: _ph ?? 'none',
    form: 'bare',
  });
}

export function relKeyOf(a: number, b: number) {
  return a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`;
}
export function relationBetween(
  turnContext: Pick<TurnContext, 'G'>,
  a: number | null | undefined,
  b: number | null | undefined,
) {
  const { G } = turnContext;
  if (a == null || b == null) return 'neutral';
  if (a === b) return 'self';
  const rel = G.relations[relKeyOf(a, b)] ?? '';
  return rel || 'neutral';
}
export function areEnemies(
  turnContext: Pick<TurnContext, 'G'>,
  a: number | null | undefined,
  b: number | null | undefined,
) {
  return relationBetween(turnContext, a, b) === 'enemy';
}
export function areAllied(
  turnContext: Pick<TurnContext, 'G'>,
  a: number | null | undefined,
  b: number | null | undefined,
) {
  return relationBetween(turnContext, a, b) === 'allied';
}
// A realm may declare a Treat or war only on a realm it has met (its record of meetings): diplomacy's resolution reads
// no other declaration, and the bots' grudge is recorded only from a war it would read.
export function realmHasMet(
  turnContext: {
    readonly G: {
      readonly players?:
        | readonly ({ readonly _encountered?: readonly number[] | null | undefined } | null | undefined)[]
        | null
        | undefined;
    };
  },
  from: number,
  to: number,
) {
  return ((turnContext.G.players ?? [])[from]?._encountered ?? []).includes(to);
}
// a valid RETREAT destination is a FRIENDLY province — one the player owns, or one held by an
// ally. Never a neutral or enemy province (a beaten force cannot fall back onto ground it does
// not hold).
export function isFriendlyProvFor(
  turnContext: Pick<TurnContext, 'G'>,
  prov: Pick<AProvinceTaken, 'owner'> | null | undefined,
  pi: number | null | undefined,
) {
  return !!prov && pi != null && (prov.owner === pi || (prov.owner != null && areAllied(turnContext, pi, prov.owner)));
}

// ── EVIL conquest doctrine (loot OR enslave) ── applied whenever an Evil character CONQUERS a
// province by force. Now every conquest site calls this. Runs once per province per turn.
export function applyEvilConquest(
  turnContext: TurnContext,
  cc: AnEvilConqueror | null | undefined,
  prov: AProvinceConquered | null | undefined,
  pl: { gold: number } | null | undefined,
) {
  const { G } = turnContext;
  if (!cc || !prov || !pl) return;
  if (G.players[cc.player]?.alignment !== 'Evil') return;
  if (prov._evilConqTurn === G.turn) return;
  prov._evilConqTurn = G.turn;
  const mode = (cc.encounterPlan?.evilMode ?? '') || 'terror';
  const humanoid = prov.terrain !== 'sea' && !(prov.race ?? '').startsWith('Primal');
  if (mode === 'enslave' && humanoid) {
    const enType = (prov.armyTypes?.[0] ?? '') || 'Shieldwall Levies';
    prov.garrisonArmies ??= [];
    prov.garrisonArmies.push({
      type: enType,
      quality: 'Green',
      race: (prov.race ?? '') || 'Human',
      unitName: armyUnitName(enType),
    });
    prov._enslavedUntil = G.turn + 3;
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: 'an Evil conqueror presses the beaten folk into the garrison in chains',
        heroName: cc.name,
        provinceName: prov.name,
        unitType: enType,
      },
      audience: { actor: cc.player, realms: [cc.player], seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  } else {
    if (mode === 'enslave' && !humanoid)
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: 'an Evil conqueror finds no humanoid folk to enslave',
          heroName: cc.name,
          provinceName: prov.name,
        },
        audience: { actor: cc.player, realms: [cc.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    const loot = Math.floor(
      (Number(prov.tax) || 0) *
        (0.5 + whatARealmsDiscoveriesAddToAConquestsPlunder(G.players[cc.player], { theGround: prov.terrain })),
    ); // + plunder discoveries (the discoveries' registry's since plan P1-19af: "fate: a realm's discoveries add to a
    // conquest's plunder")
    if (loot > 0) {
      pl.gold = (pl.gold || 0) + loot;
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: "an Evil conqueror's forces plunder a province",
          heroName: cc.name,
          provinceName: prov.name,
          loot,
        },
        audience: { actor: cc.player, realms: [cc.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    }
  }
}
