// The Elemental action spells the Cast Spell order works (plan P1-19z).
// Each is its branch of resolveCastSpellOrder's chain, moved as it was: the names it read from the function it takes
// as one object (what-an-action-spell-of-the-cast-spell-order-is-handed.ts), a `return;` made `return false;` ("the
// cast ends here": no skill gain) and its end `return true;` ("the spell is worked"). The table in the-action-
// spells-the-cast-spell-order-works-by-slug.ts finds each by its slug.
import { kcRng } from '../../rng.ts';
import { shuffleP } from '../../battle/fortune.ts';
import { getNeighborsP } from '../../world/map-helpers.ts';
import {
  emit,
  logSplit,
  notifyProvinceOwner,
  notifyTarget,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../../turn/events-and-their-audiences.ts';
import { blessWardNegates } from '../../magic/plague-and-bless-ward.ts';
import { resolveUnitGainInProvince } from '../../battle/hosts-gained-in-a-province.ts';
import { asItsGuardReadsIt } from '../../personal-combat/to-hit-wounds-stuns-and-courage.ts';
import {
  aRealmsNameOrNone,
  theProvinceTheCasterStandsIn,
  theOneThePickFell,
} from './what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type { TheNamesAnActionSpellIsHanded } from './what-an-action-spell-of-the-cast-spell-order-is-handed.ts';

/** The work of earthquake (`elemental_earthquake`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workEarthquake({ turnContext, G, c, ph, targetProv }: TheNamesAnActionSpellIsHanded): boolean {
  const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
  const adjIds = new Set(
    getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
      .map((p2) => asItsGuardReadsIt(p2)?.id)
      .filter((x) => x != null),
  );
  if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Earthquake is cast beyond its reach', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  if (blessWardNegates(turnContext, targetProv, c, 'Earthquake')) return false;
  targetProv._earthquakeNoTax = G.turn;
  emit(turnContext, {
    type: 'combat',
    fact: { kind: 'an Earthquake rends a province', heroName: c.name, provinceName: targetProv.name },
    audience: {
      actor: c.player,
      realms: targetProv.owner != null && targetProv.owner !== c.player ? [targetProv.owner] : [],
      seen: 'battle',
    },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    province: targetProv.id,
    env: true,
  });
  notifyProvinceOwner(
    turnContext,
    targetProv,
    { kind: 'a realm learns an enemy Earthquake tore through its province', provinceName: targetProv.name },
    c.player,
    ph,
  );

  return true;
}
/** The work of flood (`elemental_flood`): its branch of resolveCastSpellOrder's chain, moved as it was (plan
 *  P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workFlood({ turnContext, G, c, ph, targetProv }: TheNamesAnActionSpellIsHanded): boolean {
  const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
  const adjIds = new Set(
    getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
      .map((p2) => asItsGuardReadsIt(p2)?.id)
      .filter((x) => x != null),
  );
  if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Flood is cast beyond its reach', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  if (targetProv.terrain === 'sea') {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Flood is cast on the sea', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  // Cancel Part Sea if present, then submerge the province for the rest of the turn.
  if (blessWardNegates(turnContext, targetProv, c, 'Flood')) return false;
  if (targetProv._partSea) {
    delete targetProv._partSea;
  }
  targetProv._flood = { orig: targetProv.terrain, turn: G.turn };
  targetProv.terrain = 'sea';
  emit(turnContext, {
    type: 'combat',
    fact: { kind: 'a Flood swallows a province', heroName: c.name, provinceName: targetProv.name },
    audience: {
      actor: c.player,
      realms: targetProv.owner != null && targetProv.owner !== c.player ? [targetProv.owner] : [],
      seen: 'battle',
    },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    province: targetProv.id,
    env: true,
  });
  notifyProvinceOwner(
    turnContext,
    targetProv,
    { kind: 'a realm learns an enemy Flood swallowed its province', provinceName: targetProv.name },
    c.player,
    ph,
  );

  return true;
}
/** The work of elemental-summon (`elemental_summon`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workElementalSummon({ turnContext, G, c, ph, prov }: TheNamesAnActionSpellIsHanded): boolean {
  if (c._elementalSummonedThisTurn) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero has already summoned an elemental this turn', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  const ELEMENTALS = [
    { type: 'Air Elemental', unitName: 'the Howling Gale' },
    { type: 'Fire Elemental', unitName: 'the Living Conflagration' },
    { type: 'Earth Elemental', unitName: 'the Walking Mountain' },
    { type: 'Water Elemental', unitName: 'the Surging Tide' },
    { type: 'Darkness Elemental', unitName: 'the Devouring Shade' },
  ];
  const pick = theOneThePickFell(ELEMENTALS[Math.floor(kcRng() * ELEMENTALS.length)]);
  const elemental = {
    type: pick.type,
    quality: 'Veteran',
    race: 'Elemental',
    unitName: pick.unitName,
    _temporary: true,
    _expiresAfterPhase: -1,
  };
  c.armies = asItsGuardReadsIt(c.armies) ?? [];
  c.armies.push(elemental);
  c._elementalSummonedThisTurn = true;
  logSplit(
    turnContext,
    'explore',
    {
      kind: 'an elemental surges forth from a rift',
      heroName: c.name,
      provinceName: prov.name,
      elementalName: pick.unitName,
      elementalType: pick.type,
    },
    {
      kind: 'onlookers see an elemental surge forth from a rift',
      heroName: c.name,
      realmName: aRealmsNameOrNone(G.players, c.player),
      provinceName: prov.name,
      elementalName: pick.unitName,
      elementalType: pick.type,
    },
    {
      audience: { actor: c.player },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    },
  );
  resolveUnitGainInProvince(turnContext, c, prov, ph);

  return true;
}
/** The work of chain-lightning (`elemental_chainlightning`): its branch of resolveCastSpellOrder's chain, moved as
 *  it was (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workChainLightning({ turnContext, c, ph, prov, targetChar }: TheNamesAnActionSpellIsHanded): boolean {
  if (targetChar?.location !== c.location) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Chain Lightning finds no enemy hero in the province', provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  if (targetChar.player === c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "Chain Lightning cannot be turned on the realm's own heroes" },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  const src = asItsGuardReadsIt(targetChar.armies) ?? [];
  if (src.length === 0) {
    emit(turnContext, {
      type: 'combat',
      fact: { kind: 'Chain Lightning finds no troops to strike', targetName: targetChar.name },
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      heroes: [c.id, targetChar.id].filter((v) => asItsGuardReadsIt(v) != null),
      province: prov.id,
    });
    return false;
  }
  const pool = Math.floor(src.length * 0.3);
  if (pool <= 0) {
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: 'Chain Lightning earths out among a handful of troops',
        heroName: c.name,
        targetName: targetChar.name,
      },
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      heroes: [c.id, targetChar.id].filter((v) => asItsGuardReadsIt(v) != null),
      province: prov.id,
    });
    return false;
  }
  const idxs = shuffleP(src.map((_, i) => i))
    .slice(0, pool)
    .sort((a, b) => b - a);
  let killed = 0;
  idxs.forEach((i) => {
    if (kcRng() < 0.5) {
      src.splice(i, 1);
      killed++;
    }
  });
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: "Chain Lightning arcs through a hero's ranks",
      heroName: c.name,
      targetName: targetChar.name,
      caught: pool,
      killed: killed,
    },
    audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    province: prov.id,
  });
  notifyTarget(
    turnContext,
    targetChar,
    {
      kind: 'a hero learns Chain Lightning tore through his ranks',
      heroName: c.name,
      targetName: targetChar.name,
      killed,
    },
    ph,
    'combat',
  );

  return true;
}
/** The work of cataclysm (`elemental_cataclysm`): its branch of resolveCastSpellOrder's chain, moved as it was (plan
 *  P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workCataclysm({
  turnContext,
  G,
  c,
  ph,
  spellLevelEff,
  targetProv,
}: TheNamesAnActionSpellIsHanded): boolean {
  const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
  const adjIds = new Set(
    getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
      .map((p2) => asItsGuardReadsIt(p2)?.id)
      .filter((x) => x != null),
  );
  if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Cataclysm is cast beyond its reach', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  targetProv._earthquakeNoTax = G.turn;
  targetProv.tax = 0;
  targetProv._taxDestroyed = true; // Cataclysm now ruins the tax base PERMANENTLY
  let totalDestroyed = 0;
  const _ccVictims = new Set<number>();
  (asItsGuardReadsIt(G.characters) ?? [])
    .filter(
      (ch) =>
        ch.alive &&
        ch.location === targetProv.id &&
        ch.player !== c.player &&
        (asItsGuardReadsIt(ch.armies) ?? []).length > 0,
    )
    .forEach((ch) => {
      const n = Math.min(ch.armies.length, 1 + Math.floor(spellLevelEff / 2));
      const idxs = shuffleP(ch.armies.map((_, i) => i))
        .slice(0, n)
        .sort((a, b) => b - a);
      idxs.forEach((i) => ch.armies.splice(i, 1));
      totalDestroyed += n;
      if (ch.player != null) _ccVictims.add(ch.player);
    });
  if (targetProv.owner != null && targetProv.owner !== c.player) _ccVictims.add(targetProv.owner);
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: 'a Cataclysm devastates a province',
      heroName: c.name,
      provinceName: targetProv.name,
      destroyed: totalDestroyed,
    },
    audience: { actor: c.player, realms: [..._ccVictims], seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    province: targetProv.id,
  });
  notifyProvinceOwner(
    turnContext,
    targetProv,
    {
      kind: 'a realm learns an enemy Cataclysm devastated its province',
      provinceName: targetProv.name,
      destroyed: totalDestroyed,
    },
    c.player,
    ph,
  );

  return true;
}
