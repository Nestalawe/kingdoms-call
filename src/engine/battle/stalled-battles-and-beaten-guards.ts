// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { markOrcAttackWin } from '../units/drill-and-spoils.ts';
import { realmTag } from '../turn/log-line-helpers.ts';
import { applyEvilConquest, areEnemies, setProvinceOwner } from '../realms/relations-and-captures.ts';
import { creditBattle } from '../titles/title-holders-and-battle-merit.ts';
import { isVeiled } from '../heroes/effective-skills-and-hidden-heroes.ts';
import {
  bestRetreat,
  clearNavalHold,
  navalHeldIn,
  navalHoldLine,
  navalSplitRetreat,
  retreatOptions,
  seaTrapLine,
} from '../units/sea-lift-stranding-and-retreats.ts';
import { armyTotalStr } from './best-commander.ts';
import { emitBattle } from './battle-report-lines-and-force-markers.ts';
import { combatVsNPC } from './battles-against-province-defenders.ts';
import { combatVsChar } from './battles-between-heroes.ts';
import { erodeGuardSurvivors, resolveUnitGainInProvince } from './hosts-gained-in-a-province.ts';
import { emit, theWordsOrTheFactOfALine } from '../turn/events-and-their-audiences.ts';

// ── STALLED BATTLES AND A BEATEN GUARD'S SURVIVORS (plan P1-08i3: lifted out of resolveTurn) ────
// A province where a battle was left unresolved (the loser could not retreat) is fought over again at the start of
// each phase until one side is gone or breaks away (resolveStalledBattles, which resolveTurn's phase loop and
// resolveWarFronts call). A beaten guard's survivors (erodeGuardSurvivors) are in hosts-gained-in-a-province.ts. It
// takes the turn's context first (src/engine/turn/context.ts).
// ── STALLED-BATTLE RESOLVER ────
// If a battle's loser could not retreat to an adjacent province, the opposing forces stay
// co-located. At the start of the next phase they fight again — repeatedly, each phase, until one
// side is destroyed or manages to break away. Covers neutral-guard and player-vs-player battles
// alike. Provinces are flagged with _battleUnresolved by the combat code above.

export function resolveStalledBattles(turnContext, ph, onlyProvId, freshWar) {
  const { G, seaMovePoints, movePoints, SEASONS } = turnContext;
  (G.world.provinces || []).forEach((prov) => {
    if (onlyProvId != null && (!prov || prov.id !== onlyProvId)) return; // resolveWarFronts settles one province
    turnContext._combatSkillProv = null; // reset before each province; combatVs* re-sets it to this prov
    if (!prov || !prov._battleUnresolved) return;
    // ILLUSORY L9 VEIL: while any armed force here is veiled, the contest is SUSPENDED — keep the
    // flag and do not resolve until the veil parts (battles trigger when the veil ends).
    if (
      (G.characters || []).some(
        (ch) =>
          (ch.alive || ch._leaderlessHost) &&
          ch.location === prov.id &&
          (ch.armies || []).length > 0 &&
          isVeiled(turnContext, ch),
      )
    )
      return;
    prov._battleUnresolved = false; // clear — a fresh stall this phase will set it again
    // `ch.alive||ch._leaderlessHost` — a commander killed while pinned here keeps his host for
    // the duration of the battle. Filtering on `alive` alone made that host invisible, so the
    // contest looked one-sided and the province was handed over unopposed.
    const armedHere = (G.characters || []).filter(
      (ch) => (ch.alive || ch._leaderlessHost) && ch.location === prov.id && (ch.armies || []).length > 0,
    );
    const guard = armedHere.find((ch) => ch.player === null && ch._isNeutralGuard);
    const playerForces = armedHere.filter((ch) => ch.player !== null);
    if (playerForces.length === 0) return; // nobody left to press the fight
    // A resumed battle belongs to the character leading it, in the phase it happens — exactly
    // like a first-contact battle. resolveStalledBattles runs outside the per-character loop that
    // normally sets _logCtx, so without this every resumed battle was filed with no character and
    // no phase, which is what pushed them into the end-of-turn Realm Events block.
    // NOTE: _logCtx alone is NOT enough here. Resolving a stalled battle calls into combatVsNPC /
    // combatVsChar, which can reach processOrder (via resolveUnitGainInProvince) and that
    // CLOBBERS _logCtx — so any line logged after the fighting inherited a null context and fell
    // back into
    // end-of-turn Realm Events. Every log call in this function therefore states its charId and
    // phase EXPLICITLY (see _ctxCharId below); the _logCtx assignment only covers anything
    // nested. A leaderless host is sorted LAST for every "who leads this" decision: it holds
    // ground, it does not choose to press an attack.
    const _rankForce = (a, b) =>
      (a._leaderlessHost ? 1 : 0) - (b._leaderlessHost ? 1 : 0) ||
      armyTotalStr(turnContext, b, prov) - armyTotalStr(turnContext, a, prov);
    const _ctxCharId = [...playerForces].sort(_rankForce)[0].id;
    turnContext._logCtx = { charId: _ctxCharId, phase: ph };
    // a commander (king or hero) who fell in an earlier-phase battle duel keeps his host on the
    // field for the rest of the battle (_leaderlessHost) — but he is DEAD. The resume/secure
    // narration must never speak of him as if he still rides; name the host that carries his
    // banner instead, matching the "stand-in captain" wording combatVsChar already uses below the
    // duel. combatVsNPC/combatVsChar handle the fine-grained battle text; this covers the
    // top-level lines resolveStalledBattles writes itself.
    const forceLabel = (f) =>
      f && (f._leaderlessHost || f.alive === false) ? `${f.name}'s leaderless host` : f ? f.name : 'the host';

    // CASE A — neutral defenders still hold an unowned province with an enemy force present. Two
    // forms: a live guard commander (fights with skills, may duel), or a LEADERLESS garrison
    // (guard slain in an earlier pre-battle duel — flagged _leaderlessDefenders) which fights on
    // without commander skills.
    const _leaderless =
      !guard && prov.owner === null && prov._leaderlessDefenders && (prov.neutralDefenders || []).length > 0;
    if ((guard || _leaderless) && prov.owner === null) {
      const attacker = [...playerForces].sort(_rankForce)[0];
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: "an unfinished battle against a province's defenders resumes",
          provName: prov.name,
          attackersHostName: forceLabel(attacker),
          defendersName: guard ? guard.name.replace(' (wandering)', '') : 'the leaderless garrison',
        },
        audience: { actor: attacker.player, realms: [attacker.player], seen: 'battle' },
        hero: _ctxCharId,
        phase: ph,
        province: prov.id,
      });
      // 2026-10-08 (Toby item 6): pressing on against neutral defenders spends a movement point when
      // one is left, exactly as a carry-on battle against another realm does (below); with none
      // left it is fought anyway.
      {
        const _pool = prov.terrain === 'sea' ? seaMovePoints : movePoints;
        if ((_pool[attacker.id] ?? 0) > 0) _pool[attacker.id] = Math.max(0, (_pool[attacker.id] ?? 0) - 1);
      }
      const atkCopy = { ...attacker, armies: [...(attacker.armies || [])] };
      let savedIntel = null;
      if (guard) {
        savedIntel = prov.neutralDefenders;
        prov.neutralDefenders = [...(guard.armies || [])];
      }
      atkCopy._resumeBattle = true; // already in the province — suppress the "moves into" line
      const battle = combatVsNPC(turnContext, atkCopy, prov, guard || null);
      // the resumed fight for a neutral province pays merit like the first one. Credited to the
      // REAL attacker, never `atkCopy` — TM(c) creates the accumulator on whatever object it is
      // handed, so crediting a shallow copy writes the merit somewhere nobody reads.
      creditBattle(turnContext, attacker, null, battle, prov);
      // this character has now had their one battle for the phase. Pin them (STAGE 1b) so a
      // Move/Pursue order later this phase can't march them on to START A SECOND BATTLE — even if
      // this follow-up battle RESOLVED and the province is no longer flagged _battleUnresolved.
      attacker._foughtStalledBattlePhase = ph;
      // The guard can die in THIS re-fight's pre-battle duel — from that moment their troops are
      // a leaderless garrison living on prov.neutralDefenders, not on the corpse.
      const _guardDiedNow = !!guard && !guard.alive;
      if (guard && !_guardDiedNow) {
        guard.armies = [...(prov.neutralDefenders || [])];
        prov.neutralDefenders = savedIntel;
      } else if (guard) {
        guard.armies = [];
        guard._isNeutralGuard = false;
      }
      attacker.armies = (attacker.armies || []).filter((a) => atkCopy.armies.includes(a));
      if (atkCopy.location !== attacker.location) {
        attacker.location = atkCopy.location;
        const np = G.world.provinces[attacker.location];
        if (np) attacker.locationName = np.name;
      }
      if (battle.won) markOrcAttackWin(attacker, G, battle); // 2026-09-27 (Toby item 8): war-spoils on the stalled-battle re-fight too
      emitBattle(turnContext, battle, prov, ph, [attacker.player], { actor: attacker.player, charId: _ctxCharId }); // item 5 (NPC/guard defender)
      const liveGuard = !!guard && !_guardDiedNow;
      if (battle.won) {
        // Erode the survivors exactly as the first battle does — flee, demote, or disband.
        const _survPool = liveGuard ? guard.armies || [] : prov.neutralDefenders || [];
        const surv = erodeGuardSurvivors(
          turnContext,
          liveGuard ? guard : null,
          prov,
          _survPool,
          (line) =>
            emit(turnContext, {
              type: 'combat',
              ...theWordsOrTheFactOfALine(line),
              audience: { actor: attacker.player, realms: [], seen: 'battle' },
              hero: _ctxCharId,
              phase: ph,
              province: prov.id,
            }),
          attacker.name,
        );
        if (liveGuard) guard.armies = surv;
        if (surv.length > 0) {
          prov._battleUnresolved = true;
          prov.neutralDefenders = [...surv];
          prov.npcArmies = surv.length; // keep intel display in sync with survivors
          if (!liveGuard) prov._leaderlessDefenders = true;
          emit(turnContext, {
            type: 'combat',
            fact: liveGuard
              ? {
                  kind: 'the guard still holds a contested province with survivors',
                  guardName: guard.name.replace(' (wandering)', ''),
                  provName: prov.name,
                }
              : {
                  kind: 'commanderless survivors still contest a province',
                  survivingUnitCount: surv.length,
                  survivingUnitsPlural: surv.length !== 1 ? 's' : '',
                  provName: prov.name,
                },
            audience: { actor: attacker.player, realms: [], seen: 'battle' },
            hero: _ctxCharId,
            phase: ph,
            province: prov.id,
          });
        } else {
          if (liveGuard) {
            guard._isNeutralGuard = false;
            guard._justDefeated = true;
            if (!guard.name.includes('(wandering)')) guard.name = guard.name + ' (wandering)';
          }
          setProvinceOwner(turnContext, prov, attacker.player, attacker, ph);
          prov.neutralDefenders = [];
          prov.npcArmies = 0;
          delete prov._leaderlessDefenders;
          const pl = G.players[attacker.player];
          if (pl) {
            pl.merits = (pl.merits || 0) + (prov.tax || 0);
            if (!pl.provinces.includes(prov.id)) pl.provinces.push(prov.id);
            applyEvilConquest(turnContext, attacker, prov, pl);
          } // Evil doctrine now fires on this capture path too
          if (attacker.alive !== false) attacker.merits = (attacker.merits || 0) + (prov.tax || 0); // 2026-09-21: no personal merit for a fallen commander
          emit(turnContext, {
            type: 'combat',
            fact: {
              kind: 'the attacker finally overcomes the defenders and claims a province',
              attackersHostName: forceLabel(attacker),
              provName: prov.name,
            },
            audience: { actor: attacker.player, realms: [], seen: 'battle' },
            hero: _ctxCharId,
            phase: ph,
            province: prov.id,
          });
        }
      } else {
        if (!liveGuard) prov._leaderlessDefenders = (prov.neutralDefenders || []).length > 0;
        if ((attacker.armies || []).length > 0 && attacker.location === prov.id) {
          // Attacker repelled and still here: try to retreat, else stay pinned and fight again
          const adj = retreatOptions(turnContext, attacker, prov, attacker.armies || []); // 2026-09-23c: the one retreat rule (was own LAND only)
          // 2026-09-27 (Toby item 3): a pinned column with ships tries the naval split first — the
          // fleet sails for friendly water with what it can lift and the rest falls back or holds.
          const _nrLines = [];
          const _nrRes = navalSplitRetreat(
            turnContext,
            attacker,
            prov,
            attacker.armies || [],
            _nrLines,
            forceLabel(attacker),
          );
          _nrLines.forEach((l) =>
            emit(turnContext, {
              type: 'combat',
              text: l,
              audience: { actor: attacker.player, realms: [attacker.player] },
              hero: _ctxCharId,
              phase: ph,
              province: prov.id,
            }),
          );
          if (_nrRes) {
            /* handled by the naval split */
          } else if (adj.length > 0) {
            const _fromS = G.world.provinces[attacker._attackedFrom];
            const dest =
              _fromS && adj.some((p2) => p2.id === _fromS.id)
                ? _fromS
                : bestRetreat(turnContext, attacker, adj) || adj[0]; // with a choice, the most valuable ground wins
            prov.characters = (prov.characters || []).filter((id) => id !== attacker.id);
            dest.characters = dest.characters || [];
            if (!dest.characters.includes(attacker.id)) dest.characters.push(attacker.id);
            attacker.location = dest.id;
            attacker.locationName = dest.name;
            emit(turnContext, {
              type: 'combat',
              fact: {
                kind: 'the attacker breaks off a stalled battle and retreats',
                attackersHostName: forceLabel(attacker),
                retreatToName: dest.name,
              },
              audience: { actor: attacker.player, realms: [attacker.player] },
              hero: _ctxCharId,
              phase: ph,
              province: dest.id,
            });
          } else {
            prov._battleUnresolved = true;
            {
              const _st = seaTrapLine(forceLabel(attacker), attacker, prov, attacker.armies);
              if (_st)
                emit(turnContext, {
                  type: 'combat',
                  text: _st,
                  audience: { actor: attacker.player, realms: [attacker.player] },
                  hero: _ctxCharId,
                  phase: ph,
                  province: prov.id,
                });
            }
            emit(turnContext, {
              type: 'combat',
              fact: {
                kind: 'the attacker is pinned in a province with no way out',
                attackersHostName: forceLabel(attacker),
                provName: prov.name,
              },
              audience: { actor: attacker.player, realms: [attacker.player] },
              hero: _ctxCharId,
              phase: ph,
              province: prov.id,
            });
          }
        }
      }
      clearNavalHold(prov); // within-phase marker only — see navalHeldIn
      return;
    }

    // CASE B — two or more players' forces trapped together (PvP)
    const players = [...new Set(playerForces.map((f) => f.player))];
    if (players.length >= 2) {
      const ranked = [...playerForces].sort(_rankForce);
      // AK [7.6]: the province still belongs to the defender, and only the INVADER can force the
      // next battle — so the attacker is whoever doesn't own the ground, not simply whoever is
      // strongest.
      let defender = ranked.find((f) => f.player === prov.owner),
        attacker;
      if (defender) {
        attacker = ranked.find(
          (f) =>
            f.player !== prov.owner &&
            f.player !== defender.player &&
            f.player != null &&
            defender.player != null &&
            areEnemies(turnContext, f.player, defender.player),
        );
      }
      if (!attacker) {
        // the owner's own forces (if any) are not party to the war — the contest is between two
        // guests on the ground: the strongest force with an enemy present attacks that enemy
        defender = null;
        for (const a of ranked) {
          const d = ranked.find(
            (f) =>
              f.player !== a.player &&
              a.player != null &&
              f.player != null &&
              areEnemies(turnContext, a.player, f.player),
          );
          if (d) {
            attacker = a;
            defender = d;
            break;
          }
        }
      }
      if (!attacker) {
        // no warring pair at all — the old pairing, which lapses just below
        defender = ranked.find((f) => f.player === prov.owner);
        if (defender) {
          attacker = ranked.find((f) => f.player !== prov.owner && f.player !== defender.player);
        } else {
          attacker = ranked[0];
          defender = ranked.find((f) => f.player !== attacker.player);
        }
      }
      if (!attacker || !defender) return;
      // DIPLOMACY: a contested battle only persists between players still at WAR. If the two sides
      // made peace at the turn boundary (mutual Treat, Enemy→Neutral), the contest lapses and they
      // disengage rather than fighting on. (NPC contests — player==null on a side — are
      // unaffected.)
      if (
        attacker.player != null &&
        defender.player != null &&
        !areEnemies(turnContext, attacker.player, defender.player)
      ) {
        delete prov._battleUnresolved;
        emit(turnContext, {
          type: 'combat',
          fact: {
            kind: 'a contest for a province lapses as the realms are no longer at war',
            provName: prov.name,
            attackersRealmName: G.players[attacker.player]?.name || 'one side',
            defendersRealmName: G.players[defender.player]?.name || 'the other',
          },
          audience: { actor: attacker.player, realms: [attacker.player, defender.player], seen: 'battle' },
          hero: _ctxCharId,
          phase: ph,
          province: prov.id,
        });
        return;
      }
      // AK [7.6] once read: "If the attackers still have a movement point for each army, they
      // force another battle next phase; if not, both armies encamp." Item 4 RETIRES the encamp
      // rule outright. Any province reaching here is already flagged _battleUnresolved — a fight
      // that was joined and did NOT end. Encamping stalled it: with the attacker out of movement
      // it simply paused, and because movement pools REFILL at the top of every turn, a single
      // contest could drag across three or more turns. Now the fight grinds on EVERY phase until
      // it resolves — combatVsChar retreats a beaten side to a friendly-adjacent province
      //, and a trapped side
      // is worn down phase by phase within the turn. A movement point is still spent when one is
      // available; a zero-movement carry-on fights regardless.
      const atkSea = prov.terrain === 'sea';
      const atkPool = atkSea ? seaMovePoints : movePoints;
      if ((atkPool[attacker.id] ?? 0) > 0) atkPool[attacker.id] = Math.max(0, (atkPool[attacker.id] ?? 0) - 1);
      emit(turnContext, {
        type: 'combat',
        fact: freshWar
          ? {
              kind: "war comes to a province two realms' hosts share",
              provName: prov.name,
              attackersHostName: forceLabel(attacker),
              attackersRealmTag: realmTag(turnContext, attacker.player),
              defendersHostName: forceLabel(defender),
              defendersRealmTag: realmTag(turnContext, defender.player),
              seasonName: SEASONS[ph],
            }
          : {
              kind: 'an unfinished battle between two hosts resumes',
              provName: prov.name,
              attackersHostName: forceLabel(attacker),
              defendersHostName: forceLabel(defender),
            },
        audience: { actor: attacker.player, realms: [attacker.player, defender.player], seen: 'battle' },
        hero: _ctxCharId,
        phase: ph,
        province: prov.id,
      });
      const atkCopy = { ...attacker, armies: [...(attacker.armies || [])] };
      const defCopy = { ...defender, armies: [...(defender.armies || [])] };
      atkCopy._attackedFrom = attacker._attackedFrom;
      defCopy._attackedFrom = defender._attackedFrom;
      atkCopy._resumeBattle = true; // already in the province — suppress the "moves into" line
      if (freshWar) atkCopy._openingClash = true; // a war front's first clash is not a carry-on round
      const battle = combatVsChar(turnContext, atkCopy, defCopy, prov);
      creditBattle(turnContext, attacker, defender, battle, prov);
      // both sides have now had their battle for the phase — pin them (STAGE 1b) so neither can
      // march on to start a second battle later this phase, even if this one resolved.
      attacker._foughtStalledBattlePhase = ph;
      defender._foughtStalledBattlePhase = ph;
      attacker.armies = (attacker.armies || []).filter((a) => atkCopy.armies.includes(a));
      defender.armies = (defender.armies || []).filter((a) => defCopy.armies.includes(a));
      // combatVsChar moves the retreating COPY and updates prov.characters via the shared id;
      // sync the real characters' locations from the copies.
      if (atkCopy.location !== attacker.location) {
        attacker.location = atkCopy.location;
        const np = G.world.provinces[attacker.location];
        if (np) attacker.locationName = np.name;
      }
      if (defCopy.location !== defender.location) {
        defender.location = defCopy.location;
        const np = G.world.provinces[defender.location];
        if (np) defender.locationName = np.name;
      }
      emitBattle(turnContext, battle, prov, ph, [attacker.player, defender.player], {
        actor: attacker.player,
        charId: _ctxCharId,
        charIds: [attacker.id, defender.id],
      }); // item 5; 2026-09-09 item 1: both sections
      const winner = battle.won ? attacker : defender;
      const enemyStillHere = (G.characters || []).some(
        (ch) => ch.alive && ch.location === prov.id && (ch.armies || []).length > 0 && ch.player !== winner.player,
      );
      // 2026-09-27 (Toby): hulls the beaten side left ashore hold the ground too — the winner does
      // not take a province their ships are still sitting in (see navalHeldIn).
      const _navalBlockSB = navalHeldIn(prov, winner.player);
      if (!enemyStillHere && _navalBlockSB.length > 0) {
        prov._battleUnresolved = true;
        emit(turnContext, {
          type: 'combat',
          text: navalHoldLine(
            turnContext,
            prov,
            _navalBlockSB,
            (G.players[winner.player] || {}).name || forceLabel(winner),
          ),
          audience: { actor: winner.player, realms: [], seen: 'battle' },
          hero: _ctxCharId,
          phase: ph,
          province: prov.id,
        });
      } else if (!enemyStillHere && prov.owner !== winner.player) {
        G.players.forEach((p, pi) => {
          if (pi !== winner.player) {
            const i = p.provinces.indexOf(prov.id);
            if (i > -1) p.provinces.splice(i, 1);
          }
        });
        setProvinceOwner(turnContext, prov, winner.player, winner, ph);
        const wp = G.players[winner.player];
        if (wp && !wp.provinces.includes(prov.id)) wp.provinces.push(prov.id);
        if (wp) applyEvilConquest(turnContext, winner, prov, wp); // Evil doctrine on stand-off capture (was skipped)
        emit(turnContext, {
          type: 'combat',
          fact: {
            kind: 'the winner of a stalled battle secures a province',
            winnersHostName: forceLabel(winner),
            provName: prov.name,
          },
          audience: { actor: winner.player, realms: [], seen: 'battle' },
          hero: _ctxCharId,
          phase: ph,
          province: prov.id,
        });
      }
      // Safety net: the flag was cleared at the top of this function and combatVsChar only re-sets
      // it for its own stalemate cases (dug in / trapped). If two players' armed forces are STILL
      // standing in this province after the re-fight, the province is by definition still
      // contested — re-flag it so the battle resumes next phase (including phase 0 of next turn)
      // instead of the contest silently lapsing.
      const _sidesLeft = new Set(
        (G.characters || [])
          .filter(
            (ch) =>
              (ch.alive || ch._leaderlessHost) &&
              ch.location === prov.id &&
              (ch.armies || []).length > 0 &&
              ch.player !== null,
          )
          .map((ch) => ch.player),
      );
      if (_sidesLeft.size >= 2) prov._battleUnresolved = true;
      clearNavalHold(prov); // within-phase marker only — see navalHeldIn
      return;
    }

    // Only one player's force remains (the other broke away or was destroyed) — secure it
    const lone = playerForces[0];
    // a lone survivor may only take ground from an ENEMY (or no one): an ally's or a neutral
    // realm's province is not his to seize, and an enemy's standing garrison must still be beaten
    if (prov.owner != null && prov.owner !== lone.player && !areEnemies(turnContext, lone.player, prov.owner)) return;
    if (
      prov.owner != null &&
      prov.owner !== lone.player &&
      !guard &&
      (prov.garrisonArmies || []).length > 0 &&
      lone.alive
    ) {
      resolveUnitGainInProvince(turnContext, lone, prov, ph);
      turnContext._logCtx = { charId: _ctxCharId, phase: ph };
      return;
    }
    if (prov.owner !== lone.player && !guard) {
      G.players.forEach((p, pi) => {
        if (pi !== lone.player) {
          const i = p.provinces.indexOf(prov.id);
          if (i > -1) p.provinces.splice(i, 1);
        }
      });
      setProvinceOwner(turnContext, prov, lone.player, lone, ph);
      prov.neutralDefenders = [];
      prov.npcArmies = 0;
      const lp = G.players[lone.player];
      if (lp && !lp.provinces.includes(prov.id)) lp.provinces.push(prov.id);
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: 'a host holds a province unopposed and secures it',
          hostName: forceLabel(lone),
          provName: prov.name,
        },
        audience: { actor: lone.player, realms: [], seen: 'battle' },
        hero: _ctxCharId,
        phase: ph,
        province: prov.id,
      });
    }
  });
}
