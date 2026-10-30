// The Illusory action spells the Cast Spell order works (plan P1-19z).
// Each is its branch of resolveCastSpellOrder's chain, moved as it was: the names it read from the function it takes
// as one object (what-an-action-spell-of-the-cast-spell-order-is-handed.ts), a `return;` made `return false;` ("the
// cast ends here": no skill gain) and its end `return true;` ("the spell is worked"). The table in the-action-
// spells-the-cast-spell-order-works-by-slug.ts finds each by its slug.
import { kcRng } from '../../rng.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { shuffleP } from '../../battle/fortune.ts';
import { d100 } from '../../dice-and-army-names.ts';
import { getNeighborsP } from '../../world/map-helpers.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../../turn/events-and-their-audiences.ts';
import { asItsGuardReadsIt } from '../../personal-combat/to-hit-wounds-stuns-and-courage.ts';
import type { ArmyInABattle } from '../../army-tables.ts';
import {
  theProvinceTheCasterStandsIn,
  theOneThePickFell,
} from './what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type { TheNamesAnActionSpellIsHanded } from './what-an-action-spell-of-the-cast-spell-order-is-handed.ts';

/** The work of illusory-terrain (`illusory_terrain`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workIllusoryTerrain({ turnContext, G, c, targetProv }: TheNamesAnActionSpellIsHanded): boolean {
  const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
  const adjIds = new Set(
    getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
      .map((p2) => asItsGuardReadsIt(p2)?.id)
      .filter((x) => x != null),
  );
  if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Illusory Terrain is cast beyond its reach', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  // Sea → 50% looks like random land; land → 50% looks like sea (else a different random land).
  const LANDS = ['plain', 'forest', 'mountain', 'desert'];
  let fake;
  if (targetProv.terrain === 'sea') {
    fake = kcRng() < 0.5 ? LANDS[Math.floor(kcRng() * LANDS.length)] : 'sea';
  } else {
    fake = kcRng() < 0.5 ? 'sea' : LANDS.filter((t) => t !== targetProv.terrain)[Math.floor(kcRng() * 3)];
  }
  fake = theOneThePickFell(fake); // three or four lands to pick from, so one is picked
  targetProv._illusoryTerrain = { caster: c.player, fake, appliedTurn: G.turn };
  emit(turnContext, {
    type: 'explore',
    fact: { kind: 'Illusory Terrain cloaks a province', heroName: c.name, provinceName: targetProv.name },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: targetProv.id,
  });

  return true;
}
/** The work of phantasmal-armies (`illusory_phantasmal`): its branch of resolveCastSpellOrder's chain, moved as it
 *  was (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workPhantasmalArmies({
  turnContext,
  G,
  c,
  spellLevel,
  targetChar,
}: TheNamesAnActionSpellIsHanded): boolean {
  // Target: the caster themselves, or any friendly hero in the SAME province. No longer
  // requires the target to be leading armies at cast time — the buff sits on the character
  // and is spent by the next battle they fight, so it still pays off if they pick up or
  // recruit armies in a later phase this turn.
  const t = targetChar?.player === c.player ? targetChar : c;
  if (t.id !== c.id && t.location !== c.location) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Phantasmal Armies is cast on a hero beyond its reach', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  const _realForce = (asItsGuardReadsIt<readonly (ArmyInABattle | null | undefined)[]>(t.armies) ?? []).filter(
    (a): a is ArmyInABattle => !!a && !a._phantom,
  );
  const _elig = _realForce.filter((a) => !CREATURE_ARMIES.has(a.type) && !MONSTER_ARMIES.has(a.type));
  if (_elig.length === 0) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'Phantasmal Armies finds no humanoid armies to duplicate',
        heroName: c.name,
        onTheCasterHimself: t === c,
        targetName: t.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  const _n = Math.min(_elig.length, Math.max(1, Math.floor(0.1 * Math.min(spellLevel, 5) * _realForce.length))); // 10% of the host per level, capped at level 5 (was 15%)
  t._phantoms = t._phantoms ?? [];
  const theTargetsPhantoms = t._phantoms;
  shuffleP(_elig)
    .slice(0, _n)
    .forEach((orig) => {
      if (orig._phTag === undefined || orig._phTag === '')
        orig._phTag = `ph${String((G._phSeq = (Number(G._phSeq) || 0) + 1))}`;
      theTargetsPhantoms.push({
        type: orig.type,
        quality: orig.quality,
        race: orig.race,
        unitName: orig.unitName,
        _phantomOf: orig._phTag,
      });
    }); // random selection
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: 'Phantasmal Armies conjures duplicates of humanoid armies',
      heroName: c.name,
      duplicates: _n,
      onTheCasterHimself: t === c,
      targetName: t.name,
    },
    audience: { actor: c.player, realms: [c.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: t.location,
  });

  return true;
}
/** The work of hide-lairs (`illusory_hide_feature`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workHideLairs({ turnContext, G, c, targetProv }: TheNamesAnActionSpellIsHanded): boolean {
  const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
  const adjIds = new Set(
    getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
      .map((p2) => asItsGuardReadsIt(p2)?.id)
      .filter((x) => x != null),
  );
  if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Hide Lairs is cast beyond its reach', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  const toHide = (asItsGuardReadsIt(targetProv.features) ?? []).filter((f) => !f._hidden);
  if (toHide.length === 0) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Hide Lairs finds no lairs left to hide', heroName: c.name, provinceName: targetProv.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  toHide.forEach((f) => {
    f._hidden = true;
    f._hiddenBy = c.player;
  });
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: "Hide Lairs veils a province's lairs",
      heroName: c.name,
      provinceName: targetProv.name,
      lairsHidden: toHide.length,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: targetProv.id,
  });

  return true;
}
/** The work of phantom-host (`illusory_phantomhost`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workPhantomHost({ turnContext, G, c, prov, spellLevel }: TheNamesAnActionSpellIsHanded): boolean {
  const _realForceH = (asItsGuardReadsIt<readonly (ArmyInABattle | null | undefined)[]>(c.armies) ?? []).filter(
    (a): a is ArmyInABattle => !!a && !a._phantom,
  );
  const _eligH = _realForceH.filter((a) => CREATURE_ARMIES.has(a.type) || MONSTER_ARMIES.has(a.type));
  if (_eligH.length === 0) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Phantom Host finds no beasts to duplicate', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  const _nH = Math.min(_eligH.length, Math.max(1, Math.floor(0.1 * Math.min(spellLevel, 5) * _realForceH.length))); // 10% of the host per level, capped at level 5 (was 15%)
  c._phantoms = c._phantoms ?? [];
  const theCastersPhantoms = c._phantoms;
  shuffleP(_eligH)
    .slice(0, _nH)
    .forEach((orig) => {
      if (orig._phTag === undefined || orig._phTag === '')
        orig._phTag = `ph${String((G._phSeq = (Number(G._phSeq) || 0) + 1))}`;
      theCastersPhantoms.push({
        type: orig.type,
        quality: orig.quality,
        race: orig.race,
        unitName: orig.unitName,
        _phantomOf: orig._phTag,
      });
    }); // random selection
  emit(turnContext, {
    type: 'explore',
    fact: { kind: 'Phantom Host conjures duplicates of beasts', heroName: c.name, duplicates: _nH },
    audience: { actor: c.player, realms: [c.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });

  return true;
}
/** The work of invisibility (`illusory_invisibility`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workInvisibility({ turnContext, G, c, prov }: TheNamesAnActionSpellIsHanded): boolean {
  // Invisibility as an ACTION spell — self only. 80% to slip from all enemy sight for the
  // rest of this turn (report sightings, spy reports, Encounter targeting and the map all
  // honour _invisTurn). Fails (20%): visible as normal.
  const _ivRoll = d100();
  if (_ivRoll <= 80) {
    c._invisTurn = G.turn;
    c._unspottedTurn = G.turn;
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'Invisibility holds', heroName: c.name, chance: 80, roll: _ivRoll },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  } else
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'Invisibility fails to hold', heroName: c.name, chance: 80, roll: _ivRoll },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });

  return true;
}
/** The work of veil (`illusory_veil`): its branch of resolveCastSpellOrder's chain, moved as it was (plan P1-19z);
 *  false where the cast ends here (no skill gain), true where the spell is worked. */
export function workVeil({ turnContext, G, c, ph, prov }: TheNamesAnActionSpellIsHanded): boolean {
  c._veilTurn = G.turn;
  c._veilCastPhase = ph; // ILLUSORY L9 Veil: active THIS phase and the next (two phases)
  emit(turnContext, {
    type: 'explore',
    fact: { kind: 'a Veil of illusion is drawn over a host', heroName: c.name },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });

  return true;
}
