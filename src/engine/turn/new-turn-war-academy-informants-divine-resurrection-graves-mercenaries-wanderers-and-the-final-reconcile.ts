// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcRng } from '../rng.ts';
import { QUALITY_TIERS } from '../army-tables.ts';
import { consecratedIds, nearestConsecratedProv, normaliseStrandedGuards } from '../heroes/fame-and-consecration.ts';
import { discEff, discParam, discSum, hasDisc } from '../discoveries.ts';
import { reconcileProvinceCharacters } from '../world/province-bookkeeping-and-rallied-garrisons.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from './events-and-their-audiences.ts';

// ── THE NEW TURN, SECOND PART (plan P1-08k5b: one stage taken out of resolveTurn's own body) ────────────────────────
// Once the new turn's first part is done (new-turn-counter-king-succession-summons-and-spells-end-and-the-grand-designs.ts:
// the counter moved on, heirs crowned, the turn's summons and spells ended), the rest of the new turn, in this order:
//   1. the War Academy (sd08) may drill each company a realm's heroes keep in its home province up a grade;
//   2. Physick Gardens and Royal Physicians (`regen` discoveries) mend the realm's wounded;
//   3. the Informant Network (sd22) names one captain of another realm the realm can't see; the Arcane Observatory
//      (sd39) charts in full one province the realm hasn't mapped;
//   4. a Divine realm's hero fallen a full turn ago rises on the nearest consecrated ground the realm holds, spending
//      it; with none, the grace is lost for good;
//   5. the battlefields' graves rot (less on an Undead realm's ground; never under the Embalmers);
//   6. each mercenary band may retire, or moves on to a province around it;
//   7. the clean-up: the "driven from home" mark cleared, wanderers made whole, the save's repairs told (names, retired
//      discoveries, graves of the living), each realm noting the graves it can see, the dead seen this turn forgotten;
//   8. wandering heroes may drift to a province around them;
//   9. the turn's orders and scratch lists cleared, every province's list of heroes rebuilt from where each stands, and
//      a neutral guard with no companies, or standing in a realm's land, made a wanderer.
// It takes the turn's context (src/engine/turn/context.ts) and nothing else: it reads no value of the phase loop's. The
// body keeps resolveTurn's indent (plan P1-08's Decisions). Each line it writes is a fact (since P1-12d15: the-facts-the-
// new-turns-lines-record.ts), its words written in the views (the save check's line among them: its words begin
// "[Save check] ", which the balance matrix reads).

export function newTurnWarAcademyInformantsDivineResurrectionGravesMercenariesWanderersAndTheFinalReconcile(
  turnContext,
) {
  const { G } = turnContext;
  // 7d. sd08 War Academy: promote one random army in each player's home province
  G.players.forEach((p, pi) => {
    if (!hasDisc(turnContext, pi, 'sd08')) return;
    const homeProv = G.world.provinces.find((pv) => pv.owner === pi && pv.tax >= 10);
    if (!homeProv) return;
    const charsAtHome = (G.characters || []).filter((c) => c.alive && c.player === pi && c.location === homeProv.id);
    const allArmies = charsAtHome.flatMap((c) => c.armies || []);
    if (allArmies.length === 0) return;
    const tiers = QUALITY_TIERS.slice();
    // Skeletal armies never gain experience/quality tiers — the dead don't learn.
    const eligible = allArmies.filter((a) => !a._isSkeletal && tiers.indexOf(a.quality) < 4);
    if (eligible.length === 0) return;
    // Each eligible army independently has a chance (sd08 row, pct) to train up one tier this turn.
    let _waPromoted = 0;
    const _waPct = discParam('sd08', 'pct', 0.5);
    eligible.forEach((army) => {
      if (kcRng() < _waPct) {
        const idx = tiers.indexOf(army.quality);
        army.quality = tiers[idx + 1];
        _waPromoted++;
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: 'the War Academy drills a company up a grade',
            unitName: army.unitName || null,
            unitType: army.type,
            provinceName: homeProv.name,
            quality: army.quality,
          },
          audience: { actor: pi, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
      }
    });
    if (_waPromoted === 0)
      emit(turnContext, {
        type: 'system',
        fact: { kind: "the War Academy's drills produce no promotion", provinceName: homeProv.name },
        audience: { actor: pi, realms: [pi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
  });

  // 7d-bis. `regen` discoveries (sd65 Physick Gardens): every wounded living character of the realm
  // recovers a few HP at the end of the turn.
  G.players.forEach((p, pi) => {
    if (!discEff(turnContext, pi, 'regen').length) return;
    (G.characters || []).forEach((c) => {
      if (!c || !c.alive || c.player !== pi || c.hp == null) return;
      const mx = c.maxHp || 20;
      if (c.hp >= mx) return;
      const _rg = discSum(turnContext, pi, 'regen', 'hp', (e) => !e.king || !!c.isKing);
      if (_rg <= 0) return;
      const h = Math.min(_rg, mx - c.hp);
      c.hp += h;
      emit(turnContext, {
        type: 'system',
        fact: { kind: "a hero's wounds knit in the physick gardens", heroName: c.name, healed: h, hp: c.hp, maxHp: mx },
        audience: { actor: pi, realms: [pi] },
        hero: c.id,
        phase: 99,
      });
    });
  });

  // 7e. sd22 Informant Network: reveal one random enemy character location
  G.players.forEach((p, pi) => {
    if (!hasDisc(turnContext, pi, 'sd22')) return;
    // Provinces the player can already see this turn: those they own, or that hold one of their
    // characters.
    const _seen = new Set();
    (G.world.provinces || []).forEach((pv, idx) => {
      if (pv.owner === pi) _seen.add(idx);
    });
    (G.characters || []).forEach((c) => {
      if (c.alive && c.player === pi) _seen.add(c.location);
    });
    const enemyChars = (G.characters || []).filter(
      (c) => c.alive && c.player !== null && c.player !== pi && !c.isKing && !_seen.has(c.location),
    );
    if (enemyChars.length === 0) {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'the informants surface no enemy captain unseen' },
        audience: { actor: pi, realms: [pi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      return;
    }
    const target = enemyChars[Math.floor(kcRng() * enemyChars.length)];
    const tProv = G.world.provinces[target.location];
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'the Informant Network names where an unseen enemy captain was last',
        heroName: target.name,
        realmName: G.players[target.player]?.name,
        provinceName: tProv?.name || null,
      },
      audience: { actor: pi, realms: [pi] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
  });
  // `return`s — so it only ever fired for a player who ALSO held sd22 and had an unseen enemy. It is
  // now its own pass. The line is filed (no charId) so it lands in the player's Realm Events.
  G.players.forEach((p, pi) => {
    if (!hasDisc(turnContext, pi, 'sd39')) return;
    const _unseen = (G.world.provinces || []).filter((pv) => ((pv.exploredBy && pv.exploredBy[pi]) || 0) < 100);
    if (_unseen.length === 0) {
      emit(turnContext, {
        type: 'explore',
        fact: { kind: 'the Arcane Observatory finds no uncharted province left' },
        audience: { actor: pi, realms: [pi] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: 99,
      });
      return;
    }
    const _pk = _unseen[Math.floor(kcRng() * _unseen.length)];
    if (!_pk.exploredBy) _pk.exploredBy = {};
    _pk.exploredBy[pi] = 100;
    _pk.explored = 100;
    if (!Array.isArray(_pk.visitedBy)) _pk.visitedBy = [];
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: 'the Arcane Observatory charts a province in full',
        provinceName: _pk.name,
        terrain: _pk.terrain || null,
      },
      audience: { actor: pi, realms: [pi] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: _pk.id,
      phase: 99,
    });
  });

  // 7d. Divine realm resurrection — a fallen hero spends one full turn in death, then returns. This
  // step runs AFTER the turn counter advanced (§7 above), so when a hero dies during turn N's
  // resolution their grave carries killedOnTurn=N and G.turn is now N+1. Requiring G.turn >=
  // killedOnTurn+2 means the hero is skipped on the N->N+1 pass (out of action for turn N+1) and
  // only rises on the N+1->N+2 pass — i.e. they return at the START of the second turn after death.
  if (!G.heroGraveyard) G.heroGraveyard = [];
  G.heroGraveyard
    .filter(
      (g) =>
        g.player !== null &&
        G.players[g.player]?.alignment === 'Divine' &&
        (!g._monarch || G.characters.some((h) => h.id === g.id && h._divineReturn)),
    )
    .forEach((grave) => {
      if (G.turn < (grave.killedOnTurn || 0) + 2) return; // still serving their turn in death
      const hero = G.characters.find((h) => h.id === grave.id);
      if (!hero) return;
      const _wasKing = !!grave._monarch; // Divine kings return the same way
      // The fallen return ONLY to consecrated ground — the nearest consecrated province the realm
      // still owns, measured from where the body lies — and the return SPENDS that consecration.
      // With no holy ground the grace is lost for good: the body stays an ordinary grave (the
      // Resurrect spell can still reach it) and is never tried again.
      const playerP = G.players[grave.player];
      if (grave._divineLost) return;
      const homeProv = nearestConsecratedProv(G, grave.player, grave.location != null ? grave.location : hero.location);
      if (!homeProv) {
        grave._divineLost = true;
        if (_wasKing) delete hero._divineReturn;
        emit(turnContext, {
          type: 'explore',
          fact: { kind: 'a Divine hero does not return with no consecrated ground held', heroName: hero.name },
          audience: { actor: grave.player, realms: [grave.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
        return;
      }
      if (_wasKing) {
        hero.isKing = true;
        delete hero._divineReturn;
        if (playerP) delete playerP._resurrectableMonarchId;
      }
      {
        const _cl = consecratedIds(playerP);
        const _ci = _cl.indexOf(homeProv.id);
        if (_ci >= 0) _cl.splice(_ci, 1);
      }
      // Resurrect — strip armies and items (divine gift, not a free ride)
      hero.alive = true;
      hero.hp = Math.floor(hero.maxHp * 0.5) || 8;
      hero.killedThisTurn = false;
      hero.armies = [];
      hero.items = [];
      hero.location = homeProv.id;
      if (!homeProv.characters.includes(hero.id)) homeProv.characters.push(hero.id);
      G.heroGraveyard = G.heroGraveyard.filter((g) => g.id !== grave.id);
      // Log to turn report
      const turnLog = G.turnLog || [];
      emit(turnContext, {
        type: 'explore',
        fact: {
          kind: 'a Divine hero returns to life on the nearest consecrated ground',
          heroName: hero.name,
          wasKing: _wasKing,
          provinceName: homeProv.name,
          hp: hero.hp,
        },
        audience: {
          actor: grave.player,
          realms: [grave.player],
        }, // 2026-09-27 (Toby item 6): realm-private — never public
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: homeProv.id,
      });
    });

  // 7e. Battlefield grave pool decay — ~10% of remaining graves rot each turn, halved to 5% in
  // provinces owned by an UNDEAD realm (necromantic preservation — the advertised perk, now real).
  G.world.provinces.forEach((p) => {
    if (!p.battleGraves || p.battleGraves.length === 0) return;
    let decay = p.owner != null && G.players[p.owner]?.alignment === 'Undead' ? 0.05 : 0.1;
    if (p.owner != null) {
      const _gd = discEff(turnContext, p.owner, 'graveDecay');
      if (_gd.length) decay = Math.min(decay, Math.min(..._gd.map((e) => (e.rate != null ? e.rate : decay))));
    } // az08 Embalmers
    p.battleGraves = p.battleGraves.filter(() => kcRng() > decay);
  });

  // 7f. Mercenary army movement and retirement
  if (G.mercenaries && G.mercenaries.length > 0) {
    const { cols, rows, provinces } = G.world;
    const offEven = [
      [-1, -1],
      [-1, 0],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
    ];
    const offOdd = [
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, 0],
      [1, 1],
    ];
    G.mercenaries = G.mercenaries.filter((merc) => {
      // 25% chance to retire (remove from game)
      if (kcRng() < 0.25) {
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: 'a mercenary band retires and disperses',
            bandName: merc.unitName || merc.type,
            provinceName: G.world.provinces[merc.location]?.name || null,
          },
          audience: { actor: null, realms: [] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
        return false; // remove
      }
      // 100% chance to move to a random valid neighbouring province
      const p = provinces[merc.location];
      if (!p) return true;
      const offs = p.row % 2 === 0 ? offEven : offOdd;
      const neighbors = offs
        .map(([dr, dc]) => {
          const nr = p.row + dr;
          if (nr < 0 || nr >= rows) return null;
          const nc = (((p.col + dc) % cols) + cols) % cols;
          return provinces[nr * cols + nc];
        })
        .filter((n) => n && (merc.isSea ? n.terrain === 'sea' : n.terrain !== 'sea'));
      if (!neighbors.length) return true; // stuck, don't move
      const dest = neighbors[Math.floor(kcRng() * neighbors.length)];
      merc.location = dest.id;
      return true; // keep
    });
  }

  // Clear _justDefeated flag now that the turn is over
  (G.characters || [])
    .filter((c) => c._justDefeated)
    .forEach((c) => {
      delete c._justDefeated;
    });
  // a neutral hero who is now wandering (no longer a home-guarding _isNeutralGuard) recovers to
  // full HP. A guard driven from home limps away bloodied from the battle; by the time they take up
  // the wanderer's life again they are hale, and hire as a fresh, fully-healed commander.
  (G.characters || [])
    .filter((c) => c.player === null && c.alive && !c._isNeutralGuard)
    .forEach((c) => {
      c.hp = c.maxHp || c.hp;
    });
  // (Per-turn battle flags are cleared AFTER the report loop — see below — so buildTurnReport and the
  // hadBattle map-marker derivation can still read which provinces saw fighting this turn.)
  // 2026-09-12: report the turn-start ' (wandering)' name repair here, where `log` exists.
  if (G._nameRepairs > 0) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "the heroes' wandering tags are corrected", heroes: G._nameRepairs },
      audience: { actor: null, realms: [] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
  }
  G._nameRepairs = 0;
  // the retired Sage discoveries the save's upgrade took (engine/saves/)
  const retiredSageDiscoveriesRemoved = turnContext.whatTheSavesUpgradeFound.retiredSageDiscoveriesRemoved;
  if (retiredSageDiscoveriesRemoved > 0) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'retired Sage discoveries are removed from the realms',
        discoveries: retiredSageDiscoveriesRemoved,
      },
      audience: { actor: null, realms: [] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
  }
  // where the save differs from this build's schema (the save's check, engine/saves/, plan P1-15d): the turn ran on it
  // as it was, and the GM alone is told, with each place's path and kind, never a value (Theo's Choice 1, tell now)
  const whereTheSaveDiffers = turnContext.whatTheSavesUpgradeFound.whereTheSaveDiffersFromThisBuildsSchema;
  if (whereTheSaveDiffers.length > 0) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: "the save the turn loaded differs from this build's schema", places: [...whereTheSaveDiffers] },
      audience: { actor: null, realms: [] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    });
  }
  // graveyard sweep — a grave whose character record is ALIVE is a doppelganger (dead in the
  // graveyard, alive in the realm). Purge it and say so in the GM log.
  if (Array.isArray(G.heroGraveyard) && G.heroGraveyard.length) {
    const _ghosts = G.heroGraveyard.filter((g) => {
      const ch = (G.characters || []).find((x) => x && x.id === g.id);
      return ch && ch.alive === true;
    });
    if (_ghosts.length) {
      G.heroGraveyard = G.heroGraveyard.filter((g) => !_ghosts.includes(g));
      _ghosts.forEach((g) => {
        emit(turnContext, {
          type: 'system',
          fact: { kind: 'a stale grave of a living hero is removed', heroName: g.name },
          audience: { actor: null, realms: [] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        });
        (G.players || []).forEach((p) => {
          if (p && p._resurrectableMonarchId === g.id) p._resurrectableMonarchId = null;
        });
      });
    }
  }
  // eyes on the ground count as knowledge. Any grave lying in a province a realm OWNS, or holds a
  // living character in, is added to that realm's permanent knownDeadHeroIds — so a corpse you can
  // see on your map stays a legal Resurrect target after you march on. Monarch graves are excluded:
  // they are borne home and gated separately (_resurrectableMonarchId).
  (G.players || []).forEach((p, pi) => {
    if (!p) return;
    const seeProv = new Set(
      ((G.world && G.world.provinces) || []).filter((pv) => pv && pv.owner === pi).map((pv) => pv.id),
    );
    (G.characters || []).forEach((c) => {
      if (c && c.alive && c.player === pi && c.location != null) seeProv.add(c.location);
    });
    if (!Array.isArray(p.knownDeadHeroIds)) p.knownDeadHeroIds = [];
    (G.heroGraveyard || []).forEach((g) => {
      if (!g || g._monarch || g.location == null) return;
      if (seeProv.has(g.location) && !p.knownDeadHeroIds.includes(g.id)) p.knownDeadHeroIds.push(g.id);
    });
  });
  // Clear per-turn seen-dead-heroes tracking (knownDeadHeroIds persists across turns)
  G.players.forEach((p) => {
    p.seenDeadHeroIds = [];
  });
  (G.characters || [])
    .filter((c) => c.player === null && c.alive && !c._isNeutralGuard)
    .forEach((c) => {
      if (kcRng() > 0.35) return;
      const p = G.world.provinces[c.location];
      if (!p) return;
      const { cols, rows, provinces } = G.world;
      const offsets =
        p.row % 2 === 0
          ? [
              [-1, -1],
              [-1, 0],
              [0, -1],
              [0, 1],
              [1, -1],
              [1, 0],
            ]
          : [
              [-1, 0],
              [-1, 1],
              [0, -1],
              [0, 1],
              [1, 0],
              [1, 1],
            ];
      const neighbors = offsets
        .map(([dr, dc]) => {
          const nr = p.row + dr;
          if (nr < 0 || nr >= rows) return null;
          const nc = (((p.col + dc) % cols) + cols) % cols;
          return provinces[nr * cols + nc];
        })
        .filter((n) => n && n.terrain !== 'sea');
      if (!neighbors.length) return;
      const dest = neighbors[Math.floor(kcRng() * neighbors.length)];
      p.characters = (p.characters || []).filter((id) => id !== c.id);
      c.location = dest.id;
      c.locationName = dest.name;
      dest.characters = dest.characters || [];
      dest.characters.push(c.id);
    });

  // Clear resolved orders from the saved state so they can never be re-applied next turn. Next
  // turn's runTurn rebuilds turnOrders from fresh submissions. Per-character encounter plans are
  // intentionally KEPT so a player's chosen combat plan carries over turn to turn until they change
  // it.
  G.turnOrders = {};
  delete G._resurrectedThisTurn;
  delete G._pendingResurrectOrders;
  delete G._pendingCharmOrders;
  delete G._pendingHireOrders;
  delete G._pendingSynthPlans; // per-turn scratch — never persist
  // Final reconcile before the state is persisted AND before reports are built. Steps 7-9 (Raise
  // Hero, Divine resurrection, wandering-hero drift) all relocate characters, and the turn report
  // reads province.characters for the map. Rebuilding here means what is saved, what is rendered
  // and where characters actually are can never disagree.
  reconcileProvinceCharacters(turnContext);
  normaliseStrandedGuards(G); // a guard whose last unit fell this turn, or whose land changed hands, reports as a wanderer
}
