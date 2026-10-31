// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { KC_UNIT_CLASS } from '../../content/kingdoms-call-data.ts';
import { kcRng } from '../rng.ts';
import { monarchRestProvId } from '../grand-design.ts';
import { _escapesTheEnd, _garrethEscapeLine } from '../names.ts';
import { recordBattleGraves, recordHeroGrave } from '../graves.ts';
import { ownedConsecratedProvs } from './fame-and-consecration.ts';
import { settleTheItemsAHeroGained } from '../items/equipment.ts';
import { _KC_LOOT_GAINED, applyItemMaxHp, transferableItems } from '../personal-combat/helpers.ts';
import { d100 } from '../dice-and-army-names.ts';
import { theUnitsAsTheLineNamesThem } from '../battle/the-facts-a-battles-lines-record.ts';
import { theNamesAsTheLineTellsThem } from '../personal-combat/the-facts-a-personal-combats-lines-record.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { TM } from '../titles/perks.ts';
import { theChanceARealmsDiscoveriesDragAHeroFromTheField } from '../rules/the-registry-of-discovery-effects.ts';
import { newMercId } from '../turn/mercenary-ids-and-battle-records.ts';
import { setProvinceOwner } from '../realms/relations-and-captures.ts';
import { effStat, isVanished } from './effective-skills-and-hidden-heroes.ts';
import { isOpenSea } from '../units/sea-lift-stranding-and-retreats.ts';
import { flushDeferredSkillLogsFor } from './experience-skill-rises-and-earned-hp.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';
import type { AHeroIsSlainOutsideABattle } from './the-facts-a-heros-death-lines-record.ts';

// ── HERO DEATH AND LEADERLESS HOSTS (plan P1-08f: lifted out of resolveTurn) ────
// What becomes of a dead commander's armies (disperseDeadCharArmies) and of the host a spared coward leaves behind
// (abandonHostOnFlight), the one way a personal-combat death outside a battle is reported (reportHeroFall), and a
// hero's death (handleHeroDeath). All four take the turn's context first (src/engine/turn/context.ts).
// ── Dispersal of a dead character's armies ── Extracted from handleHeroDeath so battle code can
// defer it: a commander slain in a PRE-BATTLE DUEL keeps their army on the field (a junior
// officer takes over) and the survivors are dispersed only AFTER the battle resolves.
export function disperseDeadCharArmies(turnContext, deadChar) {
  const { G } = turnContext;
  if (!deadChar) return;
  const prov = G.world.provinces[deadChar.location];
  // a summoned elemental / phantom / awakened grove is magic BOUND TO THE SUMMONER. When the
  // summoner dies it dissolves at once — it must NOT be handed off to a garrison, a neighbour, or
  // the mercenary pool (where the end-of-turn expiry sweep, which only scans living characters'
  // armies, would never find it and it would linger forever).
  const tempArmies = (deadChar.armies || []).filter((a) => a._temporary);
  if (tempArmies.length > 0) {
    emit(turnContext, {
      type: 'explore',
      fact: {
        kind: "the binding of a fallen hero's summoned units fails",
        heroName: deadChar.name,
        units: theUnitsAsTheLineNamesThem(tempArmies),
      },
      audience: {
        actor: deadChar.player,
        realms: deadChar.player != null ? [deadChar.player] : [],
        seen: prov?.id != null ? 'there' : 'world',
      },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov?.id,
    });
  }
  const deadArmies = (deadChar.armies || []).filter((a) => !a._isSkeletal && !a._temporary);
  const skelArmies = (deadChar.armies || []).filter((a) => a._isSkeletal && !a._temporary);
  // Who slew the commander (handleHeroDeath stamps it; 2026-10-12, Toby): the host's line says so.
  const _by = deadChar._slainBy || null;
  // Skeletal armies crumble — record to graves
  if (skelArmies.length > 0 && prov) recordBattleGraves(turnContext, prov, skelArmies);
  if (deadArmies.length > 0 && prov) {
    const scatterAsMercs = () => {
      if (!G.mercenaries) G.mercenaries = [];
      const SEA_SET = new Set(KC_UNIT_CLASS.sea);
      deadArmies.forEach((army) => {
        G.mercenaries.push({
          type: army.type,
          quality: army.quality,
          race: army.race || 'Unknown',
          unitName: army.unitName,
          location: deadChar.location,
          isSea: SEA_SET.has(army.type),
          id: newMercId(turnContext),
        });
      });
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a fallen hero's armies scatter as mercenaries",
          heroName: deadChar.name,
          slainBy: _by,
          provinceName: prov?.name,
        },
        audience: { actor: deadChar.player, realms: deadChar.player != null ? [deadChar.player] : [] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
    };
    if (deadChar.player === null) {
      // A NEUTRAL character's leaderless troops always turn mercenary.
      scatterAsMercs();
    } else if (prov.owner === deadChar.player) {
      // Friendly province — armies garrison
      prov.garrisonArmies = (prov.garrisonArmies || []).concat(deadArmies);
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a fallen hero's armies garrison his realm's province",
          heroName: deadChar.name,
          provinceName: prov.name,
          slainBy: _by,
        },
        audience: { actor: deadChar.player, realms: [deadChar.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else if (isOpenSea(prov) && prov.owner == null && !(prov.neutralDefenders || []).length) {
      // 2026-09-23c (Toby): a commander who falls at SEA leaves his host garrisoning the sea province
      // itself. Own waters are the branch above; unowned, undefended water is claimed for the realm.
      // (Another realm's or defended waters keep the old rule below.)
      setProvinceOwner(turnContext, prov, deadChar.player, null, turnContext._currentPhase);
      const _pl = G.players[deadChar.player];
      if (_pl) {
        _pl.provinces = _pl.provinces || [];
        if (!_pl.provinces.includes(prov.id)) _pl.provinces.push(prov.id);
      }
      prov.garrisonArmies = (prov.garrisonArmies || []).concat(deadArmies);
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a fallen hero's armies hold the open sea and claim it for his realm",
          heroName: deadChar.name,
          provinceName: prov.name,
          slainBy: _by,
          realmName: _pl ? _pl.name : null,
        },
        audience: { actor: deadChar.player, realms: [deadChar.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
    } else {
      // Enemy/neutral province — armies flee to adjacent friendly province or become mercenaries
      const neighbors = (prov ? getNeighborsP(prov, G.world.cols, G.world.rows, G.world.provinces) : []).filter(
        (n) => n.terrain !== 'sea',
      );
      // Prefer the ground they actually came from — that is "the province they retreated to".
      const _cameFrom = G.world.provinces[deadChar._attackedFrom];
      const safeProv =
        (_cameFrom &&
        _cameFrom.owner === deadChar.player &&
        _cameFrom.terrain !== 'sea' &&
        neighbors.some((n) => n.id === _cameFrom.id)
          ? _cameFrom
          : null) ||
        neighbors.find((n) => n.owner === deadChar.player) ||
        null;
      if (safeProv) {
        safeProv.garrisonArmies = (safeProv.garrisonArmies || []).concat(deadArmies);
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "a fallen hero's leaderless armies retreat to his realm's ground",
            heroName: deadChar.name,
            provinceName: safeProv.name,
            slainBy: _by,
          },
          audience: { actor: deadChar.player, realms: [deadChar.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: safeProv.id,
        });
      } else {
        scatterAsMercs();
      }
    }
  }
  deadChar.armies = [];
  delete deadChar._slainBy;
}

// ── A SPARED COWARD LEAVES HIS HOST BEHIND (2026-09-26, Toby item 7) ────
// A commander who throws down his sword and begs for his life does not then march his army home
// in good order. Everything he was leading STAYS on the ground he fled from, in this order of
// preference:
//   1. another commander of his own realm still standing there takes up the colours (the host
//      keeps fighting, under a leader who did not run);
//   2. failing that, if the realm holds the province, they take their place in its garrison;
//   3. failing that — leaderless on ground the realm does not hold — exactly the fate a fallen
//      commander's host meets: fall back to adjacent friendly land, else scatter as mercenaries.
// Summoned/bound creatures are the caster's own magic and leave with him (they expire on their
// own schedule; handing them to a garrison would strand them there for ever — the same trap
// disperseDeadCharArmies guards against).
// Returns how many units were left behind.
export function abandonHostOnFlight(turnContext, c) {
  const { G } = turnContext;
  if (!c) return 0;
  const prov = G.world.provinces[c.location];
  const all = (c.armies || []).filter(Boolean);
  if (!prov || all.length === 0) return 0;
  const bound = all.filter((a) => a._temporary),
    left = all.filter((a) => !a._temporary);
  c.armies = bound;
  if (left.length === 0) return 0;
  const _who = c.name.replace(' (wandering)', '');
  const heir = (G.characters || [])
    .filter(
      (o) =>
        o &&
        o.alive &&
        o.id !== c.id &&
        o.player != null &&
        o.player === c.player &&
        o.location === prov.id &&
        o._mercyFledTurn !== G.turn,
    )
    .sort((a, b) => (effStat(turnContext, b, 'tactical') || 0) - (effStat(turnContext, a, 'tactical') || 0))[0];
  if (heir) {
    heir.armies = (heir.armies || []).concat(left);
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "a spared coward's host falls in under another commander",
        heroName: _who,
        unitCount: left.length,
        provinceName: prov.name,
        heirName: heir.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: heir.id,
      province: prov.id,
    });
    return left.length;
  }
  if (prov.owner === c.player) {
    prov.garrisonArmies = (prov.garrisonArmies || []).concat(left);
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "a spared coward's host takes its place in the province's garrison",
        heroName: _who,
        unitCount: left.length,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return left.length;
  }
  emit(turnContext, {
    type: 'system',
    fact: {
      kind: 'a spared coward slips away and leaves his host leaderless',
      heroName: _who,
      unitCount: left.length,
      provinceName: prov.name,
    },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  disperseDeadCharArmies(turnContext, {
    id: c.id,
    name: _who,
    player: c.player,
    location: c.location,
    armies: left,
    _attackedFrom: c._attackedFrom,
  });
  return left.length;
}

// 2026-10-13 (Toby, item 19): the one way a personal-combat death outside a battle is reported.
// It resolves the death FIRST, then writes the line: "slain" only when the hero really died; "at
// death's door, but not slain" when Battlefield Surgery saves them, with the surgery line
// straight after it; nothing of its own when they vanished or escaped (those write their own
// line). Returns what handleHeroDeath returns (false = they live). The caller hands the line's fact ("a hero is slain
// outside a battle", the way he fell a value: P1-12d11) and its place (audience, hero, province), as notifyTarget does.
export function reportHeroFall(turnContext, dead, killer, slain: AHeroIsSlainOutsideABattle, place, hopts?) {
  const o = { ...(hopts || {}), lines: [] };
  const res = handleHeroDeath(turnContext, dead, killer, o);
  if (o.outcome === 'surgery')
    emit(turnContext, {
      type: 'combat',
      fact: { kind: "a hero is struck down at death's door but not slain", heroName: dead.name },
      ...place,
    });
  else if (o.outcome === 'died' || o.outcome == null) emit(turnContext, { type: 'combat', fact: slain, ...place });
  o.lines.forEach((l) => emit(turnContext, { type: l.type, fact: l.fact, ...l.place }));
  return res;
}
export function handleHeroDeath(turnContext, deadChar, killerChar, opts) {
  const { G, _tel } = turnContext;
  if (!deadChar) return;
  // DOPPELGANGER GUARD. Battles are fought on shallow COPIES ({...char}); if any caller hands a
  // copy in here, the grave/items/flags were written on the copy while the REAL record in
  // G.characters stayed alive — one name dead in the graveyard and alive in the realm. Always
  // resolve to the real record, then mirror the outcome back onto the copy that was passed.
  {
    const _realRec = deadChar.id != null ? (G.characters || []).find((r) => r && r.id === deadChar.id) : null;
    if (_realRec && _realRec !== deadChar) {
      const _copy = deadChar;
      if (_copy.hp != null) _realRec.hp = _copy.hp;
      const _res = handleHeroDeath(turnContext, _realRec, killerChar, opts);
      _copy.alive = _realRec.alive;
      _copy.killedThisTurn = _realRec.killedThisTurn;
      _copy.items = _realRec.items;
      _copy.hp = _realRec.hp;
      if (_realRec._leaderlessHost) _copy._leaderlessHost = true;
      return _res;
    }
  }
  // SECRET Easter egg: the unkillable wanderer never actually dies — no graveyard, no lost items,
  // no crown succession. Safety net for any death path not intercepted at its call site. THIEF L9
  // Vanish: no killing blow lands on a man who is not there. Catches every death path — battle,
  // duel, assassination, execution — for the rest of the turn he vanished.
  if (isVanished(turnContext, deadChar)) {
    if (opts) opts.outcome = 'vanished';
    if (deadChar.hp != null && deadChar.hp <= 0)
      deadChar.hp = Math.max(1, deadChar.maxHp ? Math.round(deadChar.maxHp / 2) : 1);
    deadChar.alive = true;
    deadChar.killedThisTurn = false;
    emit(turnContext, {
      type: 'combat',
      fact: { kind: 'the blow meant for a vanished hero passes through shadow', heroName: deadChar.name },
      audience: {
        actor: killerChar && killerChar.player != null ? killerChar.player : null,
        realms: deadChar.player != null ? [deadChar.player] : [],
        seen: deadChar.location != null ? 'battle' : 'world',
      },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: deadChar.location != null ? deadChar.location : undefined,
    });
    return false;
  }
  if (_escapesTheEnd(deadChar)) {
    if (opts) opts.outcome = 'escaped';
    if (deadChar.hp != null && deadChar.hp <= 0)
      deadChar.hp = Math.max(1, deadChar.maxHp ? Math.round(deadChar.maxHp / 2) : 1);
    deadChar.alive = true;
    deadChar.killedThisTurn = false;
    emit(turnContext, {
      type: 'combat',
      fact: _garrethEscapeLine(deadChar),
      audience: {
        actor: killerChar && killerChar.player != null ? killerChar.player : null,
        realms: [],
        seen: deadChar.location != null ? 'battle' : 'world',
      },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: deadChar.location != null ? deadChar.location : undefined,
    });
    return false;
  }
  opts = opts || {};
  // BATTLEFIELD SURGERY (sd36) — previously defined but never wired. A character of a realm
  // holding it (kings included) has a 20% chance to survive any killing blow with 1 HP. Resolved
  // HERE, on the one real character record, so no copy can be left "dead" while
  // the real one lives: every caller that mirrors a death onto a battle copy checks the return
  // value (false = survived). Never fires for a corpse already dead this turn (no double saves).
  // 2026-10-13 (Toby, item 19): a caller that writes its own "slain" line passes `opts.lines` (an
  // array): the surgery lines are handed back there, as {type,text,place,priv}, instead of being
  // logged at once, so the caller can say "at death's door, but not slain" instead of "slain" and
  // put the surgery line straight after it (reportHeroFall; preBattleDuel's battle narrative).
  // `opts.outcome` tells the caller what happened: 'vanished', 'escaped', 'surgery' or 'died'.
  const _surgLog = (fact, place, priv) => {
    if (Array.isArray(opts.lines)) opts.lines.push({ type: 'combat', fact, place, priv });
    else emit(turnContext, { type: 'combat', fact, ...place });
  };
  // (the discoveries' registry's since plan P1-19ab: "fate: a realm's discoveries drag a hero from the field", its
  // chance, or nothing if his realm holds none)
  const _bsChance =
    !opts.noSave && deadChar.player != null && deadChar.alive !== false
      ? theChanceARealmsDiscoveriesDragAHeroFromTheField(G.players[deadChar.player])
      : null;
  if (_bsChance !== null) {
    const _sRoll = d100();
    const _bsPct = Math.round(_bsChance * 100);
    if (_sRoll <= _bsPct) {
      deadChar.hp = 1;
      deadChar.alive = true;
      deadChar.killedThisTurn = false;
      opts.outcome = 'surgery';
      _surgLog(
        {
          kind: 'Battlefield Surgery saves a fallen hero',
          heroName: deadChar.name,
          isKing: !!deadChar.isKing,
          chance: _bsPct,
          roll: _sRoll,
        },
        {
          audience: {
            actor: deadChar.player,
            realms: [deadChar.player, killerChar && killerChar.player != null ? killerChar.player : null].filter(
              (x) => x != null,
            ),
            seen: deadChar.location != null ? 'battle' : 'world',
          },
          hero: deadChar.id,
          heroes: [deadChar.id, killerChar && killerChar.id != null ? killerChar.id : null].filter((x) => x != null),
          phase: turnContext._logCtx.phase != null ? turnContext._logCtx.phase : turnContext._currentPhase,
          province: deadChar.location != null ? deadChar.location : undefined,
        },
      );
      return false;
    } else {
      _surgLog(
        { kind: 'the surgeons reach a fallen hero too late', heroName: deadChar.name, chance: _bsPct, roll: _sRoll },
        {
          audience: { actor: deadChar.player, realms: [deadChar.player] },
          hero: deadChar.id,
          heroes: [deadChar.id, killerChar && killerChar.id != null ? killerChar.id : null].filter((x) => x != null),
          phase: turnContext._logCtx.phase != null ? turnContext._logCtx.phase : turnContext._currentPhase,
          province: deadChar.location != null ? deadChar.location : undefined,
        },
        deadChar.player,
      );
    }
  }
  opts.outcome = 'died';
  if (killerChar && killerChar.player != null && deadChar.player != null && deadChar.player !== killerChar.player) {
    const _tm = TM(killerChar);
    _tm.duelKills = (_tm.duelKills || 0) + 1;
  } // MINOR TITLE — The Widowmaker
  // VICTORY (#3): a fallen character loses 25% of accumulated Title merit — killing a rival's
  // champion late can knock them out of a Title race. (Applies to Kings and Heroes alike.)
  if (deadChar.tm) {
    for (const k in deadChar.tm) {
      deadChar.tm[k] = Math.round((deadChar.tm[k] || 0) * 0.75);
    }
  }
  const prov = G.world.provinces[deadChar.location];
  // Who slew them (2026-10-12, Toby: the battle reports say who beat whom): a record of the killer's name, or the one
  // a caller gives (opts.slainBy: a lair's guardian and its province), TheOneWhoSlewAHero (P1-12d11). Read by
  // disperseDeadCharArmies, which clears it.
  {
    const _by =
      killerChar && killerChar.name
        ? { killerName: String(killerChar.name).replace(' (wandering)', '') }
        : (opts && opts.slainBy) || null;
    if (_by) deadChar._slainBy = _by;
    else delete deadChar._slainBy;
  }

  // 1. Armies. Normally dispersed at once; a pre-battle-duel death defers this (keepArmies)
  // so the leaderless force can fight the battle first — the caller disperses the survivors.
  //
  // The same must hold however the commander died. If the ground under him is contested, the host
  // stays with the colours and fights on under its senior captain; the end-of-phase sweep only
  // disperses it once the fighting there is actually over.
  const _fellInBattle = !!(prov && prov._battleUnresolved && (deadChar.armies || []).length > 0);
  if (_fellInBattle) {
    deadChar._leaderlessHost = true;
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: "a fallen commander's host fights on under its senior captain",
        heroName: deadChar.name,
        provinceName: prov.name,
      },
      audience: { actor: deadChar.player, realms: deadChar.player != null ? [deadChar.player] : [], seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  }
  if (!opts.keepArmies && !_fellInBattle) disperseDeadCharArmies(turnContext, deadChar);

  // 2. Items: go to killer if there is one, else to the player's king
  // A Mithril suit is buried with its wearer — it is a granted relic, not spoils (see
  // grantMithrilToDwarves). Passing it on was the route by which a second suit reached a king.
  const deadItems = transferableItems(deadChar.items || []);
  if (deadItems.length > 0) {
    let recipient =
      (killerChar && killerChar.id != null && (G.characters || []).find((r) => r && r.id === killerChar.id)) ||
      killerChar; // the REAL killer, never a battle copy
    if (!recipient && deadChar.player !== null) {
      recipient = G.characters.find((c) => c.isKing && c.player === deadChar.player && c.alive && c.id !== deadChar.id);
    }
    if (!recipient && deadChar.player !== null) {
      // King died or no king — give to random alive hero of the player
      const aliveHeroes = G.characters.filter((c) => c.alive && c.player === deadChar.player && c.id !== deadChar.id);
      if (aliveHeroes.length > 0) recipient = aliveHeroes[Math.floor(kcRng() * aliveHeroes.length)];
    }
    if (recipient) {
      // 2026-09-23c — ROOT CAUSE of "the report says he took the king's items but they are not in
      // his pack": this was `recipient.items=(recipient.items||[]).concat(deadItems)`, a NEW array
      // on the real killer. Pooled battles are fought on shallow copies that still hold the OLD
      // array, and syncLeaderCopy then wrote the copy's `items` back over the real record — the loot
      // was wiped the moment the battle ended. Now: loot goes to the REAL character, is pushed IN
      // PLACE (a copy sharing the array sees it too), is mirrored onto a copy with its own array, and
      // is marked so syncLeaderCopy keeps it whatever the copy holds.
      recipient.items = Array.isArray(recipient.items) ? recipient.items : [];
      deadItems.forEach((it) => {
        recipient.items.push(it);
        _KC_LOOT_GAINED.add(it);
        applyItemMaxHp(recipient, it);
      });
      if (
        killerChar &&
        killerChar !== recipient &&
        Array.isArray(killerChar.items) &&
        killerChar.items !== recipient.items
      )
        deadItems.forEach((it) => {
          if (!killerChar.items.includes(it)) killerChar.items.push(it);
        });
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: "a fallen hero's possessions pass on",
          heroName: deadChar.name,
          itemNames: theNamesAsTheLineTellsThem(deadItems),
          recipientName: recipient.name,
        },
        audience: { actor: deadChar.player, realms: [deadChar.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
      if (recipient.player != null && recipient.player !== deadChar.player)
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "a hero takes a fallen foe's possessions",
            recipientName: recipient.name,
            heroName: deadChar.name,
            itemNames: theNamesAsTheLineTellsThem(deadItems),
          },
          audience: { actor: recipient.player, realms: [recipient.player] },
          hero: recipient.id,
          phase: turnContext._logCtx.phase != null ? turnContext._logCtx.phase : turnContext._currentPhase,
          province: recipient.location != null ? recipient.location : undefined,
        });
      if (recipient.player != null) {
        const _gn = settleTheItemsAHeroGained(recipient, deadItems);
        if (_gn)
          emit(turnContext, {
            type: 'system',
            fact: { kind: "a hero notes how he carries a fallen foe's possessions", theItemsHeGained: _gn },
            audience: { actor: recipient.player, realms: [recipient.player] },
            hero: recipient.id,
            phase: turnContext._logCtx.phase != null ? turnContext._logCtx.phase : turnContext._currentPhase,
            province: recipient.location != null ? recipient.location : undefined,
          });
      } // item 10
    } else {
      emit(turnContext, {
        type: 'system',
        fact: { kind: "a fallen hero's possessions are lost with no heir", heroName: deadChar.name },
        audience: { actor: deadChar.player, realms: [deadChar.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      });
    }
  }
  deadChar.items = [];

  // 3. Record to graveyard (non-kings only — kings use heir system)
  if (!deadChar.isKing) {
    recordHeroGrave(turnContext, deadChar);
    // Record which players can currently see this death (have a character in same province) These
    // players will see the dead hero in their turn report
    G.players.forEach((p, pi) => {
      const canSee = G.characters.some((ch) => ch.alive && ch.player === pi && ch.location === deadChar.location);
      if (canSee) {
        if (!Array.isArray(p.seenDeadHeroIds)) p.seenDeadHeroIds = [];
        if (!p.seenDeadHeroIds.includes(deadChar.id)) p.seenDeadHeroIds.push(deadChar.id);
        // Also add to persistent known set so they can target with Resurrect in future turns
        if (!Array.isArray(p.knownDeadHeroIds)) p.knownDeadHeroIds = [];
        if (!p.knownDeadHeroIds.includes(deadChar.id)) p.knownDeadHeroIds.push(deadChar.id);
      }
    });
  } else {
    // MONARCH death (item: dead kings resurrectable). Record the fallen king to the graveyard so
    // the player who controlled them — and ONLY that player — may recall them with Resurrect. The
    // body is borne home (home province, or wealthiest owned if home has been lost). Only the
    // MOST RECENTLY fallen monarch of a dynasty is resurrectable: when a new monarch falls, the
    // one they replaced is lost forever (its grave is purged), and so on down the line of
    // succession.
    const pKing = deadChar.player != null ? G.players[deadChar.player] : null;
    //a DIVINE king is not succeeded — the divine return them, exactly as their heroes
    // (one full turn in death, then back at half HP on consecrated/wealthiest ground, without armies or items).
    // The return needs CONSECRATED ground: with none, the king is succeeded like any other.
    if (
      pKing &&
      pKing.alignment === 'Divine' &&
      (pKing.provinces || []).length > 0 &&
      ownedConsecratedProvs(G, deadChar.player).length > 0
    ) {
      deadChar._divineReturn = true;
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a fallen Divine monarch will rise again on holy ground', heroName: deadChar.name },
        audience: {
          actor: deadChar.player,
          realms: [deadChar.player],
          seen: deadChar.location != null ? 'there' : 'world',
        },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: deadChar.location != null ? deadChar.location : undefined,
      });
    } else if (pKing && pKing.alignment === 'Divine') {
      emit(turnContext, {
        type: 'system',
        fact: { kind: 'a fallen Divine monarch has no holy ground to return to', heroName: deadChar.name },
        audience: { actor: deadChar.player, realms: [deadChar.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: deadChar.location != null ? deadChar.location : undefined,
      });
    }
    if (pKing) {
      // The previously-resurrectable monarch (whom this king's line replaced) passes beyond
      // recall.
      if (pKing._resurrectableMonarchId != null && pKing._resurrectableMonarchId !== deadChar.id) {
        G.heroGraveyard = (G.heroGraveyard || []).filter((g) => g.id !== pKing._resurrectableMonarchId);
      }
      recordHeroGrave(turnContext, deadChar);
      const grec = (G.heroGraveyard || []).find((g) => g.id === deadChar.id);
      if (grec) {
        grec.isKing = true;
        grec._monarch = true;
        grec.skills = { ...(deadChar.skills || {}) };
        grec.maxHp = deadChar.maxHp || 15;
        const restId = monarchRestProvId(G, deadChar.player);
        grec.location = restId != null ? restId : deadChar.location;
      }
      pKing._resurrectableMonarchId = deadChar.id;
      // The controlling player always knows their own monarch has fallen and where the body lies.
      if (!Array.isArray(pKing.seenDeadHeroIds)) pKing.seenDeadHeroIds = [];
      if (!pKing.seenDeadHeroIds.includes(deadChar.id)) pKing.seenDeadHeroIds.push(deadChar.id);
      if (!Array.isArray(pKing.knownDeadHeroIds)) pKing.knownDeadHeroIds = [];
      if (!pKing.knownDeadHeroIds.includes(deadChar.id)) pKing.knownDeadHeroIds.push(deadChar.id);
    }
  }
  deadChar.alive = false;
  deadChar.killedThisTurn = true;
  try {
    _tel.deaths.push({
      ph: turnContext._logCtx.phase ?? turnContext._currentPhase,
      charId: deadChar.id,
      name: deadChar.name,
      pi: deadChar.player,
      king: !!deadChar.isKing,
      prov: deadChar.location,
      killerPi: killerChar && killerChar.player != null ? killerChar.player : null,
      killerId: killerChar ? killerChar.id : null,
      how: (opts && opts.cause) || (killerChar ? (killerChar.player != null ? 'character' : 'neutral') : 'other'),
    });
  } catch (_te) {}
  flushDeferredSkillLogsFor(turnContext, deadChar.id); // rises earned before death are reported now, not after the fight
  delete deadChar._defend;
  delete deadChar._pursuit; // the dead keep no watch and chase nobody
  return true;
}
