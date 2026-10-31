// The Psychic action spells the Cast Spell order works (plan P1-19z).
// Each is its branch of resolveCastSpellOrder's chain, moved as it was: the names it read from the function it takes
// as one object (what-an-action-spell-of-the-cast-spell-order-is-handed.ts), a `return;` made `return false;` ("the
// cast ends here": no skill gain) and its end `return true;` ("the spell is worked"). The table in the-action-
// spells-the-cast-spell-order-works-by-slug.ts finds each by its slug.
import { kcRng } from '../../rng.ts';
import { COMBAT_ONLY_TACTICS, demoteOrDisband } from '../../army-tables.ts';
import { heroHireWage } from '../../rules-on-plain-values/alignments-and-a-wandering-heros-hire-wage.ts';
import { ABILITIES_P, shuffleP } from '../../battle/fortune.ts';
import { _escapesTheEnd, _garrethEscapeLine } from '../../names.ts';
import { claimWandererName } from '../../heroes/fame-and-consecration.ts';
import { d100, rng } from '../../dice-and-army-names.ts';
import { markProvinceCombat } from '../../bots/intel.ts';
import { perkTier, skillLevel } from '../../titles/perks.ts';
import { applyPendingSynthPlan } from '../../discoveries.ts';
import { doARealmsDiscoveriesWaiveTheHiringBan } from '../../rules/the-registry-of-discovery-effects.ts';
import {
  emit,
  emitNarrLine,
  logSplit,
  notifyTarget,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
} from '../../turn/events-and-their-audiences.ts';
import { effStat, recalcHeroPay } from '../../heroes/effective-skills-and-hidden-heroes.ts';
import { setMovePool } from '../../units/movement-pools.ts';
import { awardKillXP } from '../../heroes/experience-skill-rises-and-earned-hp.ts';
import { ensureEncounterPlan } from '../../personal-combat/speed-encounter-plans-and-combatants.ts';
import { resolveCharVsChar } from '../../personal-combat/duels-and-character-encounters.ts';
import { reportHeroFall } from '../../heroes/hero-death-and-leaderless-hosts.ts';
import { resolveUnitGainInProvince } from '../../battle/hosts-gained-in-a-province.ts';
import { theItemsAsTheLineNamesThem } from '../../personal-combat/the-facts-a-personal-combats-lines-record.ts';
import { asItsGuardReadsIt } from '../../personal-combat/to-hit-wounds-stuns-and-courage.ts';
import type {
  ACompanyTheStormStrikes,
  WhyAnEnchantedHeroMayTurnOnHisEnchanter,
} from '../the-facts-the-cast-spell-orders-lines-record.ts';
import type { Province } from '../../../schemas/saved-game-state.ts';
import type { TurnContext } from '../../turn/context.ts';
import {
  theCastersRealmsName,
  aRealmsNameOrNone,
  theOneThePickFell,
  theOneTakenOut,
} from './what-an-action-spell-of-the-cast-spell-order-is-handed.ts';
import type {
  AHeroAsTheCastMarksHim,
  TheNamesAnActionSpellIsHanded,
  TheNamesAFizzledCastIsHanded,
} from './what-an-action-spell-of-the-cast-spell-order-is-handed.ts';

// ── CHARM BACKLASH ────
// A Charm that FAILS to take hold (fizzle, resisted, or sliding off a mind swayed last season)
// may bring the enchanter and their intended victim to blows: CHARM_BACKLASH_PCT chance of a
// personal encounter on both encounter plans. If EITHER hero leads their plan with Flee there
// is no encounter at all — one of them wants no part of it and the other cannot force it.
export const CHARM_BACKLASH_PCT = 50;
export function charmBacklash(
  turnContext: TurnContext,
  prov: Province,
  caster: AHeroAsTheCastMarksHim,
  t: AHeroAsTheCastMarksHim | null | undefined,
  why: WhyAnEnchantedHeroMayTurnOnHisEnchanter,
) {
  const { G } = turnContext;
  if (!t || asItsGuardReadsIt(t.alive) === false || t.location !== caster.location) return;
  const targetsPi = [caster.player, t.player].filter((x) => x != null);
  const roll = d100();
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: 'an enchanted hero may turn on his enchanter',
      targetName: t.name,
      casterName: caster.name,
      why: why,
      chance: CHARM_BACKLASH_PCT,
      roll: roll,
    },
    audience: { actor: caster.player, realms: [caster.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  if (roll > CHARM_BACKLASH_PCT) return;
  ensureEncounterPlan(turnContext, caster);
  ensureEncounterPlan(turnContext, t);
  const leadsFlee = (ch: Pick<AHeroAsTheCastMarksHim, 'encounterPlan'>) => {
    // split gives at least one piece: `?? ''` never holds
    const first = (((ch.encounterPlan?.tactics ?? ['ME'])[0] ?? '').split(':')[0] ?? '').toUpperCase();
    return first === 'FL' || first === 'FLEE';
  };
  if (leadsFlee(caster) || leadsFlee(t)) {
    const who = leadsFlee(caster) ? caster : t;
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'an enchanted hero rounds on his enchanter but one of them slips away',
        targetName: t.name,
        casterName: caster.name,
        slipsAwayName: who.name,
      },
      audience: { actor: caster.player, realms: targetsPi },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      heroes: [caster.id, t.id],
    });
    return;
  }
  const COMBAT_ONLY = COMBAT_ONLY_TACTICS;
  const filterPlan = (plan: AHeroAsTheCastMarksHim['encounterPlan']) =>
    (plan?.tactics ?? ['ME']).filter(
      // split gives at least one piece: `?? ''` never holds
      (x) => COMBAT_ONLY.has((x.split(':')[0] ?? '').toUpperCase()) || x.toUpperCase().startsWith('CA:'),
    );
  const atkPlan = filterPlan(t.encounterPlan);
  if (!atkPlan.length) atkPlan.push('ME');
  const defPlan = filterPlan(caster.encounterPlan);
  if (!defPlan.length) defPlan.push('ME');
  const _duelChars = [t.id, caster.id];
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: 'an enchanted hero rounds on his enchanter and blades are drawn',
      targetName: t.name,
      casterName: caster.name,
    },
    audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
    heroes: _duelChars,
  });
  markProvinceCombat(prov, [caster.player, t.player]);
  const enc = resolveCharVsChar(
    turnContext,
    t,
    caster,
    atkPlan,
    defPlan,
    prov,
    (...a: [hero: unknown, stat: unknown]) => effStat(turnContext, ...a),
    rng,
    G,
  );
  enc.narrative.forEach((line) => {
    emitNarrLine(turnContext, line, {
      type: 'combat',
      audience: { actor: caster.player, realms: targetsPi },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      heroes: _duelChars,
    });
  });
  if (t.player !== null) t.hp = Math.max(1, enc.atkHp);
  caster.hp = Math.max(1, enc.defHp);
  if (enc.atkKilled || enc.atkHp <= 0) {
    if (_escapesTheEnd(t)) {
      const theTargetsHp = asItsGuardReadsIt(t.hp);
      if (theTargetsHp != null && theTargetsHp <= 0) t.hp = 1;
      emit(turnContext, {
        type: 'combat',
        fact: _garrethEscapeLine(t),
        audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        heroes: _duelChars,
      });
    } else {
      reportHeroFall(
        turnContext,
        t,
        caster,
        {
          kind: 'a hero is slain outside a battle',
          heroName: t.name,
          how: 'by the enchanter he turned on',
          killerName: null,
        },
        {
          audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
          heroes: _duelChars,
        },
      );
      awardKillXP(turnContext, caster, t);
    }
  }
  if (enc.defKilled || enc.defHp <= 0) {
    if (_escapesTheEnd(caster)) {
      const theCastersHp = asItsGuardReadsIt(caster.hp);
      if (theCastersHp != null && theCastersHp <= 0) caster.hp = 1;
      emit(turnContext, {
        type: 'combat',
        fact: _garrethEscapeLine(caster),
        audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        heroes: _duelChars,
      });
    } else {
      reportHeroFall(
        turnContext,
        caster,
        t,
        {
          kind: 'a hero is slain outside a battle',
          heroName: caster.name,
          how: 'by his failed Charm',
          killerName: null,
        },
        {
          audience: { actor: caster.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
          heroes: _duelChars,
        },
      );
      awardKillXP(turnContext, t, caster);
    }
  }
}
/** The work of charm (`psychic_charm`): its branch of resolveCastSpellOrder's chain, moved as it was (plan P1-19z);
 *  false where the cast ends here (no skill gain), true where the spell is worked. */
export function workCharm({ turnContext, G, c, ph, prov, player, targetChar }: TheNamesAnActionSpellIsHanded): boolean {
  const t = targetChar;
  if (t?.location !== c.location) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Charm finds no hero to sway in the province', provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  if (t.player === c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "Charm cannot be used on the realm's own heroes" },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  if (t.isKing) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Charm cannot sway a king' },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  // A mind that has been swayed shuts against the next enchanter: a hero charmed on one
  // turn is IMMUNE to Charm for the whole of the following turn. `_charmImmuneTurn` is the
  // turn on which the immunity holds; it deliberately survives the end-of-turn flag sweep,
  // and is cleared lazily once it has passed.
  if (t._charmImmuneTurn != null && t._charmImmuneTurn < G.turn) delete t._charmImmuneTurn;
  if (t._charmImmuneTurn === G.turn) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Charm slides off a mind lately swayed', heroName: c.name, targetName: t.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    charmBacklash(turnContext, prov, c, t, { kind: 'the mind is closed to enchantment this season' });
    return false;
  }
  // every Charm that has ever taken hold leaves the mind 30% harder to sway —
  // `_charmResist` is cumulative and permanent (it survives the turn-end flag sweep like
  // _charmImmuneTurn does). Rolled here, after the cast itself has succeeded.
  if (t._charmResist !== undefined && t._charmResist > 0) {
    const _rr = d100();
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "a mind's resistance to a Charm is rolled",
        targetName: t.name,
        resistance: t._charmResist,
        roll: _rr,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    if (_rr <= t._charmResist) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a Charm breaks against a mind swayed before', heroName: c.name, targetName: t.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      if (t.player != null)
        emit(turnContext, {
          type: 'system',
          fact: { kind: 'a hero throws off an enchantment', targetName: t.name },
          audience: { actor: t.player, realms: [t.player] },
          hero: t.id,
          province: prov.id,
        });
      charmBacklash(turnContext, prov, c, t, { kind: 'the Charm was resisted' });
      return false;
    }
  }
  // the enchanter learns exactly what they have taken — the charmed hero's skills and every
  // magic item they carry, reported to the CASTER only.
  const _charmIntel = (hero: AHeroAsTheCastMarksHim) => {
    const sk = ABILITIES_P.filter((k) => skillLevel(hero, k) > 0).map((k): [skill: string, level: number] => [
      k,
      skillLevel(hero, k),
    ]);
    const its = (asItsGuardReadsIt(hero.items) ?? []).filter(Boolean);
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "an enchanter reads a charmed hero's mind",
        heroName: c.name,
        targetName: hero.name,
        skills: sk,
        items: theItemsAsTheLineNamesThem(its),
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  };
  // Charm cannot reach the dead. (targetChar is already alive-filtered at resolution, so a
  // hero who fell earlier this turn never arrives here — this makes the rule explicit and
  // guards any future path that might resolve a target without the alive check.)
  if (asItsGuardReadsIt(t.alive) === false) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Charm finds no living mind to sway', heroName: c.name, targetName: t.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  // Charm sways only a LONE hero — one leading no armies (wandering OR enemy alike). A hero
  // at the head of a column is beyond a single enchanter's reach.
  if ((asItsGuardReadsIt(t.armies) ?? []).length > 0) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a Charm cannot grip a hero leading troops', heroName: c.name, targetName: t.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  // Apply this player's pre-written orders for the swayed hero to phases AFTER the cast,
  // then default any remaining post-cast phase to Defend. Matched on caster+hero+player so
  // a rival's pre-orders for the same hero are ignored. Shared by both charm outcomes.
  const _applyCharmOrders = (hero: AHeroAsTheCastMarksHim) => {
    const pend = (G._pendingCharmOrders ?? []).find(
      (x) => x.heroId === hero.id && x.casterId === c.id && x.player === c.player,
    );
    const slots = G.turnOrders[hero.id] ?? [null, null, null, null, null];
    let applied = 0;
    if (pend && Array.isArray(pend.orders)) {
      pend.orders.forEach((o, pi2) => {
        if (pi2 > ph && o?.action && o.action !== 'Defend' && o.action !== 'defend') {
          slots[pi2] = o;
          applied++;
        }
      });
    }
    for (let pz = 0; pz < 5; pz++) {
      if (pz > ph && !slots[pz]) slots[pz] = { action: 'defend', target: '', extra: '', desc: 'Defend' };
    }
    G.turnOrders[hero.id] = slots;
    applyPendingSynthPlan(G, hero, c.player); // 2026-09-21: the card's encounter plan lands only now
    return applied;
  };
  if (t.player === null) {
    // Wandering hero — enters your service permanently for free (you still pay upkeep). A
    // hero released from service this turn cannot be charmed straight back by the same
    // realm.
    if (t._releasedTurn === G.turn && t._releasedBy === c.player) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a Charm finds a hero just dismissed unmoved', heroName: c.name, targetName: t.name },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return false;
    }
    // The Divine/Undead gulf binds even magic: no charm sways a soul across distance 6.
    const _chWage = heroHireWage(
      (G.players[c.player]?.alignment ?? '') || 'Neutral',
      t.alignment,
      doARealmsDiscoveriesWaiveTheHiringBan(G.players[c.player]), // sd31 Diplomatic Protocols (the registry's, P1-19ae)
      t,
    );
    if (_chWage == null) {
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a Charm cannot sway a soul across the alignments' gulf",
          heroName: c.name,
          targetName: t.name,
          targetsAlignment: t.alignment,
          realmsAlignment: G.players[c.player]?.alignment,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return false;
    }
    t.pay = _chWage;
    t.player = c.player;
    t.hiredInPhase = ph; // hiredInPhase gates acting to ph+1 (permanent join)
    claimWandererName(t); // they serve a crown now — drop the ' (wandering)' tag
    t._charmedTurn = G.turn; // a charmed mind will not send its possessions away this turn
    delete t._defend;
    delete t._pursuit;
    delete t._defendReactedPhase;
    if (typeof setMovePool === 'function') setMovePool(turnContext, t);
    t._charmImmuneTurn = G.turn + 1; // closed to any further Charm for the whole of next turn
    t._charmResist = Math.min(95, (Number(t._charmResist) || 0) + 30); // +30% resistance to every later Charm, cumulative (capped 95%)
    emit(turnContext, {
      type: 'hire',
      fact: {
        kind: 'a Charm sways a wandering hero into service',
        heroName: c.name,
        targetName: t.name,
        realmName: theCastersRealmsName(player),
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    _charmIntel(t); // 2026-09-18
    const applied = _applyCharmOrders(t);
    if (applied > 0)
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'a hero takes up the orders his realm laid down for him',
          heroName: t.name,
          realmName: theCastersRealmsName(player),
          phasesLeft: applied,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
  } else {
    // Enemy hero leading no armies — command seized for the REST OF THE TURN. Implemented
    // as a temporary player-swap: they act on YOUR orders and fight under your banner from
    // the next phase (actingThisPhase() gates them via _charmControlFrom). At Early
    // Winter's turn-end economy they revert to their own lord, who pays their wages — see
    // the charm-revert pass in the ph===4 block. A charmable enemy hero leads no armies
    // (checked above), so this never transfers a column or triggers an invasion by itself.
    const _origOwner = t.player;
    t._charmOriginalPlayer = _origOwner;
    t._charmedByPlayer = c.player;
    t._charmedForPhase = ph;
    t._charmTempControl = true;
    t._charmedTurn = G.turn; // 2026-09-12
    t._charmControlFrom = ph;
    t._charmImmuneTurn = G.turn + 1; // closed to any further Charm for the whole of next turn
    t._charmResist = Math.min(95, (Number(t._charmResist) || 0) + 30); // +30% resistance to every later Charm, cumulative (capped 95%)
    t.player = c.player;
    delete t._defend;
    delete t._pursuit;
    delete t._defendReactedPhase; // drop any watch/chase set under their old lord
    if (typeof setMovePool === 'function') setMovePool(turnContext, t);
    const applied = _applyCharmOrders(t);
    emit(turnContext, {
      type: 'hire',
      fact: {
        kind: 'a Charm seizes an enemy hero until the season turns',
        heroName: c.name,
        targetName: t.name,
        realmName: theCastersRealmsName(player),
        phasesOfOrders: applied,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    _charmIntel(t); // 2026-09-18
    // file this under the CHARMED HERO (charId) — without it the entry inherited the
    // caster's charId from _logCtx, and the report's own-character rule handed the victim's
    // warning to the caster. After the ph-4 revert the hero belongs to _origOwner again, so
    // it lands in THEIR section only.
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a realm learns its hero is ensorcelled by an enemy Charm', targetName: t.name },
      // told to his realm, with no deed: its own news, which a spy in the province doesn't read (R-118)
      audience: { realms: [_origOwner] },
      hero: t.id,
      province: prov.id,
    });
  }

  return true;
}
/** The work of oratory (`psychic_oratory`): its branch of resolveCastSpellOrder's chain, moved as it was (plan
 *  P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workOratory({ turnContext, c, prov, targetChar }: TheNamesAnActionSpellIsHanded): boolean {
  // Self or an allied character in the same province — their travelling armies gain +1
  // quality this turn.
  // A NAMED ally who is not here is caught above (free refusal). What is left is a named
  // ally of another realm, or no target at all — self. Never silently swap a named target.
  if (targetChar && targetChar.player !== c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "Oratory cannot stir another realm's troops", heroName: c.name, targetName: targetChar.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return false;
  }
  const oratoryTarget = targetChar?.player === c.player && targetChar.location === c.location ? targetChar : c;
  const _oTiers = perkTier(c, 'psychic') >= 1 ? 2 : 1; // PSYCHIC L6 (Words of Awe): +2 quality tiers instead of +1
  oratoryTarget._oratoryBoost = _oTiers; // read by armStr: +N effective quality tiers (not cumulative)
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: 'Oratory lifts the troops a hero leads',
      heroName: c.name,
      onTheCasterHimself: oratoryTarget === c,
      targetName: oratoryTarget.name,
      qualityLevels: _oTiers,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: c.location,
  });

  return true;
}
/** The work of clairvoyance (`psychic_clairvoyance`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workClairvoyance({
  turnContext,
  G,
  c,
  ph,
  clairWatch,
  extraId,
  targetChar,
}: TheNamesAnActionSpellIsHanded): boolean {
  if (!targetChar) {
    // The intended target may have died (targetChar only resolves living characters). If
    // so, tell the caster their quarry is dead and where the body lies.
    const deadT = (asItsGuardReadsIt(G.characters) ?? []).find((ch) => ch.id === extraId);
    if (deadT && !deadT.alive) {
      const grave = (G.heroGraveyard ?? []).find((g) => g.id === extraId);
      const theGravesPlace = asItsGuardReadsIt(grave?.location);
      const bodyLoc = theGravesPlace ?? asItsGuardReadsIt(deadT.location);
      const bp = bodyLoc != null ? G.world.provinces[bodyLoc] : null;
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'Clairvoyance finds its mark dead',
          heroName: c.name,
          targetName: deadT.name,
          bodyProvinceName: bp ? bp.name : null,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        spy: true,
        province: bodyLoc,
      });
      return false;
    }
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Clairvoyance needs a hero to watch' },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  // Clairvoyance reaches a mind bound to a crown — it cannot be turned on a neutral or
  // wandering hero (a hero guarding a neutral province, or one roaming unaligned).
  if (targetChar.player == null) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'Clairvoyance cannot fix on a mind that serves no crown',
        heroName: c.name,
        targetName: targetChar.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: c.location,
    });
    return false;
  }
  // Only one Clairvoyance at a time — a new casting replaces the old.
  (asItsGuardReadsIt(G.characters) ?? []).forEach((ch) => {
    if (Array.isArray(ch._clairvoyantBy)) ch._clairvoyantBy = ch._clairvoyantBy.filter((pl) => pl !== c.player);
  });
  targetChar._clairvoyantBy = targetChar._clairvoyantBy ?? [];
  if (!targetChar._clairvoyantBy.includes(c.player)) targetChar._clairvoyantBy.push(c.player);
  // remember this watch so the report can surface everything that befalls the target FROM
  // THIS PHASE ONWARD, filed into the caster's Realm Events. One watch per player.
  clairWatch[c.player] = { charId: targetChar.id, fromPhase: ph };
  // the watched character is SEEN wherever they end the turn — on the map, in hero
  // sightings and the Encounter list — as if spied on, and the mind-link pierces
  // Invisibility.
  const theCastersRealm = G.players[c.player];
  if (theCastersRealm) theCastersRealm._clairCharThisTurn = targetChar.id;
  const tp = G.world.provinces[targetChar.location];
  // watching a character with Clairvoyance also reveals their full skills.
  {
    const actingP = G.players[c.player];
    const theMarksRealm = asItsGuardReadsIt(targetChar.player);
    if (actingP) {
      actingP._spiedHeroSkills = actingP._spiedHeroSkills ?? {};
      actingP._spiedHeroSkills[targetChar.id] = {
        name: targetChar.name,
        isKing: targetChar.isKing,
        alignment: targetChar.alignment || null,
        race: targetChar.race || null,
        kingdom: theMarksRealm != null ? (G.players[theMarksRealm]?.name ?? '') || null : null,
        skills: { ...targetChar.skills },
        turn: G.turn,
      };
    }
  }
  emit(turnContext, {
    type: 'explore',
    fact: {
      kind: "Clairvoyance opens the mind's eye upon a hero",
      heroName: c.name,
      targetName: targetChar.name,
      provinceName: tp ? tp.name : null,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    spy: true,
    province: targetChar.location,
  });

  return true;
}
/** The work of psychic-blast (`psychic_blast`): its branch of resolveCastSpellOrder's chain, moved as it was (plan
 *  P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workPsychicBlast({ turnContext, c, ph, prov, targetChar }: TheNamesAnActionSpellIsHanded): boolean {
  if (targetChar?.location !== c.location) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Psychic Blast finds no hero in the province', provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  if (targetChar.player === c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "Psychic Blast cannot be turned on the realm's own heroes" },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  // The target loses 2 skill levels, each drawn from a random owned skill (the two picks
  // may land on the same skill, in which case it drops by 2).
  const _pbDrops: string[] = [];
  for (let _k = 0; _k < 2; _k++) {
    // his skills by any name: the same object, so a level lost is lost from him
    const theSkills: Partial<Record<string, number>> = targetChar.skills;
    const owned = Object.keys(asItsGuardReadsIt(targetChar.skills) ?? {}).filter(
      (s) => (Number(theSkills[s]) || 0) > 0,
    );
    if (owned.length === 0) break;
    const sk = theOneThePickFell(owned[Math.floor(kcRng() * owned.length)]);
    theSkills[sk] = Math.max(0, (Number(theSkills[sk]) || 0) - 1);
    _pbDrops.push(sk);
  }
  if (_pbDrops.length === 0) {
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: 'a Psychic Blast finds no trained skills left to lose',
        heroName: c.name,
        targetName: targetChar.name,
      },
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      heroes: [c.id, targetChar.id].filter((v) => asItsGuardReadsIt(v) != null),
      province: prov.id,
    });
    return false;
  }
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: "a Psychic Blast takes a hero's skills",
      heroName: c.name,
      targetName: targetChar.name,
      skillsLost: [..._pbDrops],
    },
    audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  notifyTarget(
    turnContext,
    targetChar,
    {
      kind: 'a hero reels from a Psychic Blast',
      targetName: targetChar.name,
      heroName: c.name,
      skillsLost: [..._pbDrops],
    },
    ph,
    'combat',
  );
  // 2026-09-21 (Toby): a hero stripped of skill levels commands a lower wage — re-evaluate it,
  // exactly as a skill rise does, and tell the hero's own realm.
  {
    const _pbPay0 = targetChar.pay || 0;
    recalcHeroPay(targetChar);
    const _pbPay1 = targetChar.pay || 0;
    if (targetChar.player != null && _pbPay1 !== _pbPay0)
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a hero's lost skill lowers his wage",
          targetName: targetChar.name,
          wage: _pbPay1,
          wageBefore: _pbPay0,
        },
        audience: { actor: targetChar.player, realms: [targetChar.player] },
        hero: targetChar.id,
        phase: ph,
      });
  }

  return true;
}
/** The work of telekinetic-storm (`psychic_storm`): its branch of resolveCastSpellOrder's chain, moved as it was
 *  (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workTelekineticStorm({
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
      fact: { kind: 'Telekinetic Storm finds no hero in the province', provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  if (targetChar.player === c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "Telekinetic Storm cannot be turned on the realm's own heroes" },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  const armies = asItsGuardReadsIt(targetChar.armies) ?? [];
  if (armies.length === 0) {
    emit(turnContext, {
      type: 'combat',
      fact: { kind: 'a Telekinetic Storm finds no armies to scatter', targetName: targetChar.name },
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      heroes: [c.id, targetChar.id].filter((v) => asItsGuardReadsIt(v) != null),
      province: prov.id,
    });
    return false;
  }
  const n = Math.min(spellLevelEff, armies.length);
  const picks = shuffleP(armies).slice(0, n);
  let demoted = 0,
    destroyed = 0;
  const _lines: ACompanyTheStormStrikes[] = [];
  // the loss is PERMANENT — every struck unit drops one experience level for
  // good (Elite→Crack→Veteran→Average→Green), and a Green unit disbands outright, exactly as a battle
  // demotion does (demoteOrDisband). Skeletal units never change quality by any means, so
  // the storm rattles their bones and leaves them as they were. (Was: a strength penalty
  // for the rest of the turn.)
  picks.forEach((a) => {
    if (a._isSkeletal) {
      a._disbanded = true;
      destroyed++;
      _lines.push({ kind: 'a skeletal company the storm shatters to dust', unitName: a.unitName || a.type });
      return;
    } // skeletons shatter outright
    const _q0 = a.quality;
    if (demoteOrDisband(a)) {
      destroyed++;
      _lines.push({
        kind: 'a company the storm tears apart for good',
        unitName: a.unitName || a.type,
        qualityBefore: _q0,
      });
      return;
    }
    demoted++;
    _lines.push({
      kind: 'a company the storm reduces one experience level',
      unitName: a.unitName || a.type,
      qualityBefore: _q0,
      qualityAfter: a.quality,
    });
  });
  targetChar.armies = armies.filter((a) => !a._disbanded);
  emit(turnContext, {
    type: 'combat',
    fact: {
      kind: "a Telekinetic Storm hurls a hero's troops about",
      heroName: c.name,
      targetName: targetChar.name,
      caught: n,
      destroyed: destroyed,
      demoted: demoted,
      units: [..._lines],
    },
    audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  notifyTarget(
    turnContext,
    targetChar,
    {
      kind: "a hero's formations are scattered by a Telekinetic Storm",
      heroName: c.name,
      targetName: targetChar.name,
      destroyed,
      demoted,
      units: [..._lines],
    },
    ph,
    'combat',
  );

  return true;
}
/** The work of mass-confusion (`psychic_massconfusion`): its branch of resolveCastSpellOrder's chain, moved as it
 *  was (plan P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workMassConfusion({ turnContext, G, c, ph, prov, targetChar }: TheNamesAnActionSpellIsHanded): boolean {
  if (targetChar?.location !== c.location) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Mass Confusion finds no enemy hero in the province', provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  if (targetChar.player === c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "Mass Confusion cannot be turned on the realm's own heroes" },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  targetChar._massConfusedTurn = G.turn;
  emit(turnContext, {
    type: 'combat',
    fact: { kind: "Mass Confusion is sown through a hero's ranks", heroName: c.name, targetName: targetChar.name },
    audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null), seen: 'battle' },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  notifyTarget(
    turnContext,
    targetChar,
    { kind: 'a hero learns Mass Confusion grips him', heroName: c.name, targetName: targetChar.name },
    ph,
    'combat',
  );

  return true;
}
/** The work of dominate (`psychic_dominate`): its branch of resolveCastSpellOrder's chain, moved as it was (plan
 *  P1-19z); false where the cast ends here (no skill gain), true where the spell is worked. */
export function workDominate({ turnContext, G, c, ph, prov, targetChar }: TheNamesAnActionSpellIsHanded): boolean {
  if (targetChar?.location !== c.location) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'Dominate finds no enemy hero in the province', provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  if (targetChar.player === c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "Dominate cannot be turned on the realm's own heroes" },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
    return false;
  }
  const src = asItsGuardReadsIt(targetChar.armies) ?? [];
  if (src.length === 0) {
    emit(turnContext, {
      type: 'combat',
      fact: { kind: 'Dominate finds no troops to turn', heroName: c.name, targetName: targetChar.name },
      audience: { actor: c.player, realms: [c.player, targetChar.player].filter((x) => x != null) },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      heroes: [c.id, targetChar.id].filter((v) => asItsGuardReadsIt(v) != null),
      province: prov.id,
    });
    return false;
  }
  const take = Math.max(1, Math.floor(src.length * 0.25));
  const idxs = shuffleP(src.map((_, i) => i))
    .slice(0, take)
    .sort((a, b) => b - a);
  const seized = idxs.map((i) => theOneTakenOut(src, i));
  c.armies = (asItsGuardReadsIt(c.armies) ?? []).concat(seized);
  logSplit(
    turnContext,
    'hire',
    {
      kind: "Dominate turns a hero's companies",
      heroName: c.name,
      targetName: targetChar.name,
      provinceName: prov.name,
      seized: seized.length,
    },
    {
      kind: "onlookers see Dominate turn a hero's companies",
      heroName: c.name,
      realmName: aRealmsNameOrNone(G.players, c.player),
      targetName: targetChar.name,
      targetsRealmName: aRealmsNameOrNone(G.players, targetChar.player),
      provinceName: prov.name,
      seized: seized.length,
    },
    {
      audience: { actor: c.player },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      alsoNotFor: [targetChar.player],
    },
  );
  notifyTarget(
    turnContext,
    targetChar,
    {
      kind: 'a hero learns Dominate turned his companies',
      heroName: c.name,
      realmName: aRealmsNameOrNone(G.players, c.player),
      targetName: targetChar.name,
      provinceName: prov.name,
      seized: seized.length,
    },
    ph,
    'hire',
  );
  resolveUnitGainInProvince(turnContext, c, prov, ph);

  return true;
}
/** What a fizzled Charm does (the Charm's row of the table): it may bring its intended victim down on the caster;
 *  moved as it was from resolveCastSpellOrder (plan P1-19z). */
export function whenCharmFizzles({ turnContext, c, extra, G, prov }: TheNamesAFizzledCastIsHanded): void {
  const _ct = G.characters.find((ch) => ch.alive && ch.id === (parseInt(String(extra)) || -1));
  if (_ct && _ct.player !== c.player && !_ct.isKing)
    charmBacklash(turnContext, prov, c, _ct, { kind: 'the Charm fizzled' });
}
