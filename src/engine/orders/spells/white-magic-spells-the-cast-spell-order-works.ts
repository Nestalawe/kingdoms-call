// The White Magic action spells the Cast Spell order works (plan P1-19z).
// Each is its branch of resolveCastSpellOrder's chain, moved as it was: the names it read from the function it takes
// as one object (what-an-action-spell-of-the-cast-spell-order-is-handed.ts), a `return;` made `return false;` ("the
// cast ends here": no skill gain) and its end `return true;` ("the spell is worked"). The table in the-action-
// spells-the-cast-spell-order-works-by-slug.ts finds each by its slug.
import { shuffleP } from '../../battle/fortune.ts';
import { noteGraveIntel } from '../../graves.ts';
import { claimWandererName } from '../../heroes/fame-and-consecration.ts';
import { getNeighborsP } from '../../world/map-helpers.ts';
import { TM } from '../../titles/perks.ts';
import { graveServedOther } from '../../heroes/charms-and-neutrals.ts';
import { applyPendingSynthPlan } from '../../discoveries.ts';
import { whatARealmsDiscoveriesAddToABless } from '../../rules/the-registry-of-discovery-effects.ts';
import {
  emit,
  logSplit,
  notifyProvinceOwner,
  notifyTarget,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../../turn/events-and-their-audiences.ts';
import { effStat } from '../../heroes/effective-skills-and-hidden-heroes.ts';
import { blessWardNegates } from '../../magic/plague-and-bless-ward.ts';
import { asItsGuardReadsIt } from '../../personal-combat/to-hit-wounds-stuns-and-courage.ts';
import type { Grave } from '../../../schemas/saved-game-state.ts';
import {
  theCastersRealmsName,
  aRealmsNameOrNone,
  theProvinceTheCasterStandsIn,
} from './what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type { TheNamesAnActionSpellIsHanded } from './what-an-action-spell-of-the-cast-spell-order-is-handed.ts';

/** The work of resurrect (`white_resurrect`): its branch of resolveCastSpellOrder's chain, moved as it was (plan
 *  P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workResurrect({ turnContext, G, c, ph, extra, prov, player }: TheNamesAnActionSpellIsHanded): boolean {
  // Bring a slain (non-king) hero back to life, WITHOUT their possessions. The body must
  // lie in the caster's province, the player must know of the death, and no-one may have
  // raised them earlier this turn. (We use the caster's current province as the resting
  // place.)
  G.heroGraveyard ??= [];
  G._resurrectedThisTurn ??= [];
  // A fallen MONARCH's body was borne home when he died and stays there, even if that
  // province has since been captured (2026-10-08, Toby item 1) — never move it here.
  const knownIds = new Set(G.players[c.player]?.knownDeadHeroIds ?? []);
  // the body must lie in the CASTER'S OWN province for any of this to resolve — and a
  // caster standing over a corpse can plainly see it. Requiring a remembered death as well
  // meant a visible body could never be raised. (Monarch graves keep their own separate
  // guards below: only the fallen king's own realm, only the most recent monarch.)
  const _graveKnown = (g: Grave | null | undefined) => !!g && (knownIds.has(g.id) || g.location === c.location);
  // Resolve which grave: honour the EXPLICITLY chosen body (needed so a player can name
  // their fallen king rather than whatever corpse is freshest), else the most recent known
  // body here.
  // (targetChar only matches LIVE characters, so a dead target never bound here before — the
  // selection silently fell through to "most recent". Match the graveyard by id directly.)
  const _explicitGraveId = extra != null && extra.trim() !== '' ? parseInt(extra) : NaN;
  const grave = Number.isInteger(_explicitGraveId)
    ? G.heroGraveyard.find((g) => g.id === _explicitGraveId && g.location === c.location && _graveKnown(g))
    : G.heroGraveyard
        .filter((g) => g.location === c.location && _graveKnown(g))
        .sort((a, b) => b.killedOnTurn - a.killedOnTurn)[0];
  if (!grave) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'Resurrect finds no fallen hero known to lie in the province',
        heroName: c.name,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  // MONARCH grave: only the realm that the king ruled may recall him, and only the MOST
  // RECENTLY fallen monarch of that line — earlier kings have passed beyond recall.
  if (grave._monarch) {
    if (grave.player !== c.player) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a fallen monarch's crown answers only to its own realm",
          heroName: c.name,
          fallenName: grave.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      return false;
    }
    if (G.players[c.player]?._resurrectableMonarchId !== grave.id) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a fallen monarch's spirit has passed beyond recall",
          heroName: c.name,
          fallenName: grave.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      });
      return false;
    }
  } else if (grave.isKing) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a fallen king cannot be resurrected', heroName: c.name, fallenName: grave.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  } else if (graveServedOther(grave, c.player)) {
    // 2026-09-23 (Toby): a hero who ever served ANOTHER realm cannot be raised into yours.
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'a fallen hero sworn to another crown will not answer',
        heroName: c.name,
        fallenName: grave.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  if (G._resurrectedThisTurn.includes(grave.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a fallen hero has already been raised this turn', heroName: c.name, fallenName: grave.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  const deadHero = G.characters.find((ch) => ch.id === grave.id);
  if (!deadHero) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "a fallen hero's spirit cannot be found", heroName: c.name, fallenName: grave.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  if (!grave._monarch && deadHero.isKing) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'kings cannot be resurrected', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  // Revive — at full health, WITHOUT any possessions carried in life.
  deadHero.alive = true;
  TM(c).holyCasts += 1; // TITLE MERIT: Hierophant
  deadHero.hp = deadHero.maxHp || 20;
  deadHero.location = c.location;
  deadHero.killedThisTurn = false;
  deadHero._justDefeated = false;
  deadHero.items = [];
  deadHero.armies = []; // raised without possessions
  if (grave._monarch) {
    // The rightful king returns to his own throne. The body was borne home, so he is raised
    // ONLY by his own realm (guarded above) and reclaims the crown. Any reigning king or
    // freshly-crowned heir steps down to serve as a normal hero of the realm.
    deadHero.player = grave.player;
    const curMonarch = G.characters.find(
      (k) => k.isKing && k.player === grave.player && k.alive && k.id !== deadHero.id,
    );
    if (curMonarch) {
      curMonarch.isKing = false;
      curMonarch._isHeir = false;
      curMonarch._pendingSkillAllocation = 0;
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'a reigning monarch steps down as the fallen monarch is restored',
          regentName: curMonarch.name,
          restoredName: deadHero.name,
        },
        audience: { actor: grave.player, realms: [grave.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: prov.id,
      });
    }
    deadHero.isKing = true;
    deadHero._isHeir = false;
    deadHero._pendingSkillAllocation = 0;
    const theFallenMonarchsRealm = grave.player === null ? undefined : G.players[grave.player];
    if (theFallenMonarchsRealm) theFallenMonarchsRealm._resurrectableMonarchId = null; // slot spent — he lives again
  } else {
    deadHero.player = c.player; // an ordinary raised hero serves the caster's realm
    deadHero.isKing = false;
    claimWandererName(deadHero); // a raised wanderer now serves this crown
  }
  if (!prov.characters.includes(deadHero.id)) prov.characters.push(deadHero.id);
  G.heroGraveyard = (asItsGuardReadsIt(G.heroGraveyard) ?? []).filter((g) => g.id !== grave.id);
  G._resurrectedThisTurn.push(grave.id);
  const wasEnemy = grave.player != null && grave.player !== c.player;
  if (grave._monarch) {
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: 'a fallen monarch rises and reclaims the throne',
        heroName: c.name,
        restoredName: deadHero.name,
        realmName: theCastersRealmsName(player),
      },
      audience: { actor: c.player, realms: [c.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    });
  } else {
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: 'a fallen hero rises to serve the realm',
        heroName: c.name,
        restoredName: deadHero.name,
        realmName: theCastersRealmsName(player),
        wasAFoe: wasEnemy,
      },
      audience: { actor: c.player, realms: [c.player] }, // 2026-09-27 (Toby item 6): realm-private — never public
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    });
  }
  // The raise succeeded — now, and only now, honour any orders this player pre-wrote for
  // this hero. Matched on caster AND hero so a rival's pre-orders for the same corpse are
  // ignored; applied only to phases after the cast, since actingThisPhase() will skip the
  // hero in every earlier phase anyway (they were dead).
  {
    // the player portal now shows ONE order card per fallen hero, whichever of the realm's
    // casters targets them — so the orders apply if ANY of this realm's casters raises the
    // hero
    // (an exact caster match still wins if two cards were somehow submitted). A rival's orders never apply.
    const _pendAll = G._pendingResurrectOrders ?? [];
    const pend =
      _pendAll.find((x) => x.heroId === deadHero.id && x.casterId === c.id && x.player === c.player) ??
      _pendAll.find((x) => x.heroId === deadHero.id && x.player === c.player);
    if (pend && Array.isArray(pend.orders)) {
      const slots = G.turnOrders[deadHero.id] ?? [null, null, null, null, null];
      let applied = 0;
      pend.orders.forEach((o, pi2) => {
        if (pi2 > ph && o?.action && o.action !== 'Defend' && o.action !== 'defend') {
          slots[pi2] = o;
          applied++;
        }
      });
      G.turnOrders[deadHero.id] = slots;
      if (applied > 0)
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: 'a hero takes up the orders his realm laid down for him',
            heroName: deadHero.name,
            realmName: theCastersRealmsName(player),
            phasesLeft: applied,
          },
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        });
    }
    // Step 3 of order ingestion only defaults LIVING characters to Defend, and this hero
    // was a corpse when it ran. Fill the rest of the turn in now so they behave like anyone
    // else.
    const fin = G.turnOrders[deadHero.id] ?? [null, null, null, null, null];
    for (let pz = 0; pz < 5; pz++) {
      if (pz > ph && !fin[pz]) fin[pz] = { action: 'defend', target: '', extra: '', desc: 'Defend' };
    }
    G.turnOrders[deadHero.id] = fin;
    applyPendingSynthPlan(G, deadHero, c.player); // 2026-09-21: the card's encounter plan lands only now
  }

  return true;
}
/** The work of part-sea (`white_part_sea`): its branch of resolveCastSpellOrder's chain, moved as it was (plan
 *  P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workPartSea({ turnContext, G, c, ph, targetProv }: TheNamesAnActionSpellIsHanded): boolean {
  // A sea province the caster is in or adjacent to becomes plains for the rest of the turn.
  // the target may be a sea OR a land province in reach — a land province that has been
  // FLOODED into sea earlier this turn reads as terrain 'sea' at resolution, so Part Sea
  // reverts it (the intended Flood counter); a still-dry land target simply finds no sea to
  // part.
  const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
  const adjIds = new Set(
    getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
      .map((p2) => asItsGuardReadsIt(p2)?.id)
      .filter((x) => x != null),
  );
  if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Part Sea is cast beyond its reach', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  if (blessWardNegates(turnContext, targetProv, c, 'Part Sea')) return false; // Q2: a warded province can turn aside an enemy Part Sea too
  if (targetProv.terrain === 'sea') {
    // Part the waters: open sea OR a flooded land province becomes dry plains for the rest
    // of the turn.
    delete targetProv._flooded; // cancel any Flood on this province
    targetProv._partSea = { orig: targetProv.terrain, turn: G.turn, blockFleetsFromPhase: ph + 1 };
    targetProv.terrain = 'plains';
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'the waters of a province draw back', heroName: c.name, provinceName: targetProv.name },
      audience: { actor: c.player, realms: [c.player], seen: 'there' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: targetProv.id,
      env: true,
    });
    notifyProvinceOwner(
      turnContext,
      targetProv,
      {
        kind: 'a realm learns the sea was parted at its province',
        heroName: c.name,
        castersRealmName: (G.players[c.player]?.name ?? '') || null,
        provinceName: targetProv.name,
      },
      c.player,
      ph,
    ); // the owner is told
  } else {
    // Cast on dry land — the anticipated Flood never came (or was already parted). There is
    // no sea to part; clear any lingering flood marker and note it. The cast is spent but
    // harmless.
    delete targetProv._flooded;
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'Part Sea finds no sea to part', heroName: c.name, provinceName: targetProv.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: targetProv.id,
      env: true,
    });
  }

  return true;
}
/** The work of holy-symbol (`white_holy_symbol`): its branch of resolveCastSpellOrder's chain, moved as it was (plan
 *  P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workHolySymbol({ turnContext, G, c, ph, prov }: TheNamesAnActionSpellIsHanded): boolean {
  // ACTION FORM (Toby 2026-09-19): the Holy Symbol raised over the caster's own province lays
  // its battlefield dead to rest — every grave there is cleansed, so no necromancer can raise
  // them (Skeletal Armies, Harvest the Field, Raise Wraiths, Death's Dominion, Bind Wraith all
  // draw on prov.battleGraves). Always the province the caster stands in; no target.
  // The combat and battle-magic forms are unchanged.
  const _hsProv = G.world.provinces[c.location] ?? prov;
  const _dead = (_hsProv.battleGraves ?? []).length;
  TM(c).holyCasts += 1; // TITLE MERIT: Hierophant
  if (_dead === 0) {
    emit(turnContext, {
      type: 'explore',
      fact: { kind: 'the Holy Symbol finds no dead to cleanse', heroName: c.name, provinceName: _hsProv.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: _hsProv.id,
    });
  } else {
    _hsProv.battleGraves = [];
    logSplit(
      turnContext,
      'explore',
      { kind: 'the Holy Symbol cleanses the graves of a province', heroName: c.name, provinceName: _hsProv.name },
      {
        kind: 'onlookers see a Holy Symbol cleanse the graves of a province',
        heroName: c.name,
        realmName: aRealmsNameOrNone(G.players, c.player),
        provinceName: _hsProv.name,
      },
      { audience: { actor: c.player }, province: _hsProv.id, hero: c.id, phase: ph },
    );
  }
  noteGraveIntel(G.players[c.player], _hsProv.id, G.turn, []); // the caster's realm now knows the ground is clean

  return true;
}
/** The work of bless-province (`white_bless_province`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workBlessProvince({ turnContext, G, c, targetProv }: TheNamesAnActionSpellIsHanded): boolean {
  const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
  const adjIds = new Set(
    getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
      .map((p2) => asItsGuardReadsIt(p2)?.id)
      .filter((x) => x != null),
  );
  if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Bless Province is cast beyond its reach', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  if (targetProv._blessedTurn === G.turn) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a province is already blessed this turn', heroName: c.name, provinceName: targetProv.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  targetProv._blessedTurn = G.turn;
  // Item: the blessing also WARDS the province — a chance to turn aside a later enemy Flood
  // / Earthquake / Plague / Part Sea. 2026-09-14: base 50% + 5% per point of the caster's
  // White skill, counted to level 5 — so 50% from an untrained blesser up to 75% from a
  // master. (Was 10% + 15%/level, i.e. 25% at White 1 rising to 85% at White 5: the ward is
  // now dependable at every level and much flatter across the ladder.)
  targetProv._blessWardTurn = G.turn;
  targetProv._blessWardBy = c.player;
  targetProv._blessWardPct = Math.min(100, 50 + 5 * Math.min(5, effStat(turnContext, c, 'white'))); // 50% + 5% per White skill level (cap level 5)
  TM(c).holyCasts += 1; // TITLE MERIT: Hierophant
  // DIVINE: a Divine realm's casters bless at +80% (the long-advertised alignment bonus,
  // previously described but never implemented — engine now honours it), and the Divine
  // KING himself blesses at +100% — the gods answer their anointed in full.
  const _divineKingdom = G.players[c.player]?.alignment === 'Divine';
  const _divineKingBless = c.isKing && _divineKingdom;
  // ad09 Rites of Plenty (+0.2; the discoveries' registry's since plan P1-19ae: "orderOutcome: a realm's discoveries add
  // to a Bless")
  targetProv._blessedMult =
    (_divineKingBless ? 2.0 : _divineKingdom ? 1.8 : 1.6) + whatARealmsDiscoveriesAddToABless(G.players[c.player]);
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: 'a province is blessed and warded',
      heroName: c.name,
      provinceName: targetProv.name,
      blessedMultiplier: targetProv._blessedMult,
      byADivineKing: _divineKingBless,
      byADivineRealm: _divineKingdom,
      wardChance: targetProv._blessWardPct,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    province: targetProv.id,
    env: true,
  });

  return true;
}
/** The work of sanctuary (`white_sanctuary`): its branch of resolveCastSpellOrder's chain, moved as it was (plan
 *  P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workSanctuary({ turnContext, G, c, ph, targetProv }: TheNamesAnActionSpellIsHanded): boolean {
  const casterProv = theProvinceTheCasterStandsIn(G.world.provinces[c.location]);
  const adjIds = new Set(
    getNeighborsP(casterProv, G.world.cols, G.world.rows, G.world.provinces)
      .map((p2) => asItsGuardReadsIt(p2)?.id)
      .filter((x) => x != null),
  );
  if (targetProv.id !== c.location && !adjIds.has(targetProv.id)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Sanctuary is cast beyond its reach', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  targetProv._sanctuaryTurn = G.turn;
  targetProv._sanctuaryBy = c.player;
  emit(turnContext, {
    type: 'explore',
    fact: { kind: 'a Sanctuary is raised over a province', heroName: c.name, provinceName: targetProv.name },
    audience: { actor: c.player, realms: [c.player], seen: 'there' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    province: targetProv.id,
  });
  notifyProvinceOwner(
    turnContext,
    targetProv,
    {
      kind: 'a realm learns a Sanctuary was raised over its province',
      heroName: c.name,
      castersRealmName: (G.players[c.player]?.name ?? '') || null,
      provinceName: targetProv.name,
    },
    c.player,
    ph,
  ); // the owner is told

  return true;
}
/** The work of divine-judgment (`white_judgment`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workDivineJudgment({
  turnContext,
  c,
  ph,
  prov,
  spellLevelEff,
  targetChar,
}: TheNamesAnActionSpellIsHanded): boolean {
  if (targetChar?.location !== c.location) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Divine Judgment finds no enemy hero in the province', provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  if (targetChar.player === c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "Divine Judgment cannot be turned on the realm's own heroes" },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
    });
    return false;
  }
  const dmg = 10 + spellLevelEff * 3;
  targetChar.hp = Math.max(1, (targetChar.hp || 20) - dmg);
  const src = asItsGuardReadsIt(targetChar.armies) ?? [];
  const kills = Math.min(src.length, 2 + Math.floor(spellLevelEff / 2));
  const idxs = shuffleP(src.map((_, i) => i))
    .slice(0, kills)
    .sort((a, b) => b - a);
  idxs.forEach((i) => src.splice(i, 1));
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: 'Divine Judgment falls on a hero',
      heroName: c.name,
      targetName: targetChar.name,
      damage: dmg,
      unitsSmitten: kills,
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
      kind: 'a hero learns Divine Judgment fell on him',
      targetName: targetChar.name,
      heroName: c.name,
      damage: dmg,
      unitsSmitten: kills,
    },
    ph,
    'combat',
  );

  return true;
}
