// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import {
  RECKONING_CALLER_MIN_FRAC,
  RECKONING_DECAY_FROM_TURN,
  RECKONING_DECAY_STEP_PCT,
  RECKONING_FLOOR_PCT,
  RECKONING_MIN_TURN,
  reckoningAllyStepPct,
  reckoningDecayOf,
  reckoningThresholdPct,
} from '../titles/perks.ts';
import {
  alliedBloc,
  reckoningBlocShare,
  reckoningCallEligibility,
  reckoningOwnShare,
  reckoningThresholdFor,
  reckoningWinner,
} from '../titles/reckoning.ts';
import { areAllied, realmHasMet, relKeyOf } from '../realms/relations-and-captures.ts';
import { warFrontThreats } from '../battle/war-fronts-and-enemy-stand-offs.ts';
import {
  emit,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from './events-and-their-audiences.ts';

// ── DIPLOMACY RESOLUTION AND VICTORY (plan P1-08k4: two stages taken out of resolveTurn's own body) ────────────────
// Once the turn has settled what its seasons left (after-the-phases-….js) and the bots have made any late declaration,
// two stages run, in this order:
//   1. diplomacy resolution: the declarations the realms sent with this turn's orders take effect, so the new relations
//      stand for next turn. A realm offered a Treat is told of the overture (and has now met the realm that sent it); a
//      mutual Treat moves the pair one step (enemy to neutral to allied; no alliance in a game of three realms or
//      fewer); any war declaration makes both enemies, but breaking an alliance leaves the pair neutral unless the
//      breaker is Evil or Undead; an overture not answered in kind changes nothing, and its sender is told so; a new war
//      warns the hosts on the foe's ground (or beside his host) of next Spring's war front;
//   2. victory: the Reckoning (a claim lodged by a king whose bloc clears the bar; a claim that collapses or is judged;
//      the bar eroding while no claim stands), then elimination (one realm left with land or a living hero), then
//      concession (one realm left that hasn't conceded, or one alliance), then the result announced once, with the
//      Legacy standings.
// Each takes the turn's context (src/engine/turn/context.ts) and nothing else: they read no value of the phase loop's.
// The realms' declarations and Reckoning calls are collected where the realms' orders are merged, in resolveTurn, and
// read here from the context (turnContext.diploDeclarations, turnContext.reckoningCalls). Each line is a fact (since
// P1-12d16: the-facts-diplomacy-and-victorys-lines-record.ts), its words written in the views. The bodies keep
// resolveTurn's indent (plan P1-08's Decisions).

export function diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings(turnContext) {
  const { G, diploDeclarations } = turnContext;
  // 6d. DIPLOMACY RESOLUTION (KC alliance system) — the declarations players submitted with THIS
  // turn's orders take effect now, so the new relations are already in force for next turn and the
  // change is announced in this turn's Chronicle ("at the start of the next turn" from the players'
  // point of view). Rules: mutual Treat improves one step (Enemy→Neutral→Allied); ANY war
  // declaration by either side makes both Enemies, overriding a Treat. A one-sided Treat does
  // nothing.
  {
    const np = (G.players || []).length;
    // 2026-10-08 (Toby item 3c): the overtures each realm received THIS turn, for its Diplomacy card
    // (buildTurnReport → diplomacy.known[].offeredUs). Rebuilt every turn, so it is always last turn's.
    (G.players || []).forEach((p) => {
      if (p) p._overturesIn = [];
    });
    const validDecl = (from, to) => {
      const d = diploDeclarations[from] && diploDeclarations[from][to];
      if (d !== 'treat' && d !== 'enemy') return null;
      if (!realmHasMet(turnContext, from, to)) return null; // must have met them
      // 2026-10-08 (Toby item 3b): in a game of three realms or fewer no alliance can be forged, so
      // a Treat between two NEUTRAL realms can achieve nothing. The portal never offers it; a bot's
      // is dropped here, so nobody is asked to answer an offer that cannot be accepted.
      if (d === 'treat' && np <= 3 && (G.relations[relKeyOf(from, to)] || 'neutral') === 'neutral') return null;
      return d;
    };
    for (let a = 0; a < np; a++) {
      for (let b = a + 1; b < np; b++) {
        const da = validDecl(a, b),
          db = validDecl(b, a);
        if (!da && !db) continue;
        const key = relKeyOf(a, b);
        const cur = G.relations[key] || 'neutral';
        // No ALLIANCES in small games (≤3 players): players still start Neutral and may make peace,
        // but the Neutral→Allied step cannot be taken.
        const noAlliances = G.players.length <= 3;
        let next = cur,
          blockedAlliance = false;
        // 2026-09-24 (Toby item 6): breaking an ALLIANCE drops the pair back to Neutral, not to
        // war — unless the crown that breaks it is Evil or Undead, who go straight to war.
        let _brokenPact = false;
        if (da === 'enemy' || db === 'enemy') {
          if (cur === 'allied') {
            const _dark = (pi) => ['Evil', 'Undead'].includes(G.players[pi]?.alignment);
            next = (da === 'enemy' && _dark(a)) || (db === 'enemy' && _dark(b)) ? 'enemy' : 'neutral';
            _brokenPact = next === 'neutral';
          } else next = 'enemy';
        } else if (da === 'treat' && db === 'treat') {
          const wouldBe = cur === 'enemy' ? 'neutral' : cur === 'neutral' ? 'allied' : 'allied';
          if (wouldBe === 'allied' && noAlliances) {
            blockedAlliance = true;
            next = cur;
          } else next = wouldBe;
        }
        // ── OVERTURES RECEIVED ── A realm that is offered peace or an alliance is TOLD SO, whether
        // or not it answered in kind. The word used matches what the offer would actually achieve
        // from the current relation (each line's fact holds a realm's name, or its seat where it has none).
        const _mutual = da === 'treat' && db === 'treat';
        const _tellOffered = (to, from) => {
          // 2026-10-08 (Toby item 3a/3c): being courted counts as MEETING the realm that sent it, so
          // the courted realm can answer (only met realms are on the Diplomacy card, and only met
          // realms may be treated with). The offer is also kept for the Diplomacy card.
          const _tp = G.players[to];
          if (_tp) {
            if (!Array.isArray(_tp._encountered)) _tp._encountered = [];
            if (!_tp._encountered.includes(from)) _tp._encountered.push(from);
          }
          // When both sides treated and the relation actually moved, the pact announcement below
          // says it all — no need to also report the overture that produced it.
          if (_mutual && next !== cur) return;
          if (_tp && !_mutual)
            (_tp._overturesIn = _tp._overturesIn || []).push({ from, kind: cur === 'enemy' ? 'peace' : 'alliance' }); // still awaiting an answer
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: 'a realm is sent an overture',
              from: { realmName: G.players[from]?.name || null, seat: from },
              ofPeace: cur === 'enemy',
              answeredInKind: _mutual,
            },
            audience: { actor: null, realms: [to] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            system: true,
          });
        };
        if (da === 'treat') _tellOffered(b, a);
        if (db === 'treat') _tellOffered(a, b);
        if (blockedAlliance) {
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: 'two realms both seek an alliance so few kings may not forge',
              realm: { realmName: G.players[a]?.name || null, seat: a },
              otherRealm: { realmName: G.players[b]?.name || null, seat: b },
            },
            audience: { actor: null, realms: [a] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            system: true,
          });
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: 'two realms both seek an alliance so few kings may not forge',
              realm: { realmName: G.players[b]?.name || null, seat: b },
              otherRealm: { realmName: G.players[a]?.name || null, seat: a },
            },
            audience: { actor: null, realms: [b] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            system: true,
          });
          continue;
        }
        if (next === cur) {
          // Unreciprocated overture: let the offerer(s) know nothing changed. (The party who was
          // courted has already been told of the overture itself, just above.)
          if (da === 'treat')
            emit(turnContext, {
              type: 'system',
              fact: {
                kind: "a realm's overture goes unanswered",
                realm: { realmName: G.players[a]?.name || null, seat: a },
                otherRealm: { realmName: G.players[b]?.name || null, seat: b },
                ofPeace: cur === 'enemy',
              },
              audience: { actor: null, realms: [a] },
              hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
              phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
              system: true,
            });
          if (db === 'treat')
            emit(turnContext, {
              type: 'system',
              fact: {
                kind: "a realm's overture goes unanswered",
                realm: { realmName: G.players[b]?.name || null, seat: b },
                otherRealm: { realmName: G.players[a]?.name || null, seat: a },
                ofPeace: cur === 'enemy',
              },
              audience: { actor: null, realms: [b] },
              hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
              phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
              system: true,
            });
          continue;
        }
        if (next === 'neutral') delete G.relations[key];
        else G.relations[key] = next;
        // the line each realm is told (a fact: both realms read the same one but for an alliance, which names the realm
        // told first)
        let mA, mB;
        if (next === 'enemy') {
          mA = mB = {
            kind: 'war now stands between two realms',
            first: { realmName: G.players[a]?.name || null, seat: a },
            second: { realmName: G.players[b]?.name || null, seat: b },
          };
        } else if (next === 'allied') {
          mA = {
            kind: 'two realms are now allied',
            first: { realmName: G.players[a]?.name || null, seat: a },
            second: { realmName: G.players[b]?.name || null, seat: b },
          };
          mB = {
            kind: 'two realms are now allied',
            first: { realmName: G.players[b]?.name || null, seat: b },
            second: { realmName: G.players[a]?.name || null, seat: a },
          };
        } else if (_brokenPact) {
          mA = mB = {
            kind: 'an alliance is broken and two realms are neutral once more',
            first: { realmName: G.players[a]?.name || null, seat: a },
            second: { realmName: G.players[b]?.name || null, seat: b },
            brokenByFirst: da === 'enemy',
            brokenBySecond: db === 'enemy',
          };
        } else {
          mA = mB = {
            kind: 'two realms make peace and are neutral',
            first: { realmName: G.players[a]?.name || null, seat: a },
            second: { realmName: G.players[b]?.name || null, seat: b },
          };
        }
        emit(turnContext, {
          type: 'system',
          fact: mA,
          audience: { actor: null, realms: [a] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          system: true,
        });
        emit(turnContext, {
          type: 'system',
          fact: mB,
          audience: { actor: null, realms: [b] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          system: true,
        });
        // WAR FRONTS: hosts already standing on the new enemy's ground (or beside his host) will turn
        // on that province at the END of next Spring unless they leave — both sides are told now,
        // while they can still write orders for it (see resolveWarFronts).
        if (next === 'enemy') {
          warFrontThreats(turnContext).forEach((t) => {
            const c = t.c,
              pv = t.prov;
            if (c.player !== a && c.player !== b) return;
            if (pv._battleUnresolved) return; // already a contest — it resumes at the top of Spring
            const foe = c.player === a ? b : a;
            const onFoeLand = pv.owner === foe;
            const besideFoe = (G.characters || []).some(
              (o) => o && o.alive && o.location === pv.id && o.player === foe && (o.armies || []).length > 0,
            );
            if (!onFoeLand && !besideFoe) return;
            const n = (c.armies || []).length;
            emit(turnContext, {
              type: 'system',
              fact: {
                kind: "a host stands on a new foe's war front",
                heroName: c.name,
                unitCount: n,
                provinceName: pv.name,
                onTheFoesLand: onFoeLand,
                foeRealmName: G.players[foe]?.name || null,
              },
              audience: { actor: null, realms: [c.player] },
              hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
              phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
              system: true,
              province: pv.id,
            });
            if (c._invisTurn !== G.turn)
              emit(turnContext, {
                type: 'system',
                fact: {
                  kind: "a new foe's host stands on the realm's war front",
                  heroName: c.name,
                  realmName: G.players[c.player]?.name || null,
                  unitCount: n,
                  provinceName: pv.name,
                  onTheRealmsLand: onFoeLand,
                },
                audience: { actor: null, realms: [foe] },
                hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
                phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
                system: true,
                province: pv.id,
              });
          });
        }
      }
    }
  }
}

export function victoryTheReckoningEliminationConcessionAndTheAnnouncement(turnContext) {
  const { G, reckoningCalls } = turnContext;
  // 6e. VICTORY — THE RECKONING (KC end-game). Process new claims, grace-period lapse, resolution.
  {
    // the earliest turn a claim may be lodged is RECKONING_MIN_TURN, not the turn titles go public.
    // A realm that lodges one earlier is told when the throne opens.
    if (!G.reckoning && reckoningCalls.size > 0 && G.turn < RECKONING_MIN_TURN) {
      for (const pi of reckoningCalls) {
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: 'a realm calls the Reckoning before the throne may be claimed',
            realmName: G.players[pi]?.name || null,
            firstTurn: RECKONING_MIN_TURN,
          },
          audience: { actor: null, realms: [pi] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          system: true,
        });
      }
    }
    if (!G.reckoning && reckoningCalls.size > 0 && G.turn >= RECKONING_MIN_TURN) {
      for (const pi of reckoningCalls) {
        const kingAlive = (G.characters || []).some((c) => c.alive && c.isKing && c.player === pi);
        if (!kingAlive) {
          emit(turnContext, {
            type: 'system',
            fact: { kind: 'a realm with no living king calls the Reckoning' },
            audience: { actor: null, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            system: true,
          });
          continue;
        }
        const _el = reckoningCallEligibility(G, pi); // bloc bar AND the caller's own floor; item 3: bloc-sized bar
        const thr = _el.threshold; // THIS claimant's bar — raised by every ally in their bloc
        const share = _el.blocShare;
        if (_el.ok) {
          const bloc = alliedBloc(G, pi);
          // the bar is FIXED at the moment the claim is lodged (`thrPct`), while the share is
          // recomputed live. Without this a claimant could break off a small alliance mid-claim to
          // drop their own bar by reckoningAllyStepPct and save a failing claim. The price of the
          // throne is set when you reach for it; desert an ally now and you lose their tax base
          // without getting the bar back.
          G.reckoning = {
            by: pi,
            bloc,
            calledTurn: G.turn,
            resolveAtTurn: G.turn + 2,
            thrPct: reckoningThresholdPct(G.players.length, reckoningDecayOf(G), bloc.length),
          };
          const allies = bloc
            .filter((b) => b !== pi)
            .map((b) => G.players[b]?.name)
            .filter(Boolean);
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: 'the Reckoning is called',
              claimant: { realmName: G.players[pi]?.name || null, seat: pi },
              allyNames: allies,
              share,
              bar: thr,
              judgedAtTurn: G.reckoning.resolveAtTurn,
            },
            audience: { actor: null, realms: [], seen: 'world' },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            system: true,
          });
          break;
        } else if (_el.reason === 'callerShort') {
          // the BLOC clears the bar, but this realm is a passenger in it — an ally who holds a
          // sliver of the world cannot be the one to claim the throne on the bloc's strength.
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: "a realm calls the Reckoning on its alliance's strength but holds too little itself",
              realmName: G.players[pi]?.name || null,
              ownShare: _el.ownShare,
              callerMinimum: _el.callerMin,
              bar: thr,
            },
            audience: { actor: null, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            system: true,
          });
        } else {
          emit(turnContext, {
            type: 'system',
            fact: {
              kind: 'a realm calls the Reckoning but commands too little of the world',
              realmName: G.players[pi]?.name || null,
              share,
              bar: thr,
            },
            audience: { actor: null, realms: [pi] },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            system: true,
          });
        }
      }
    }
    if (G.reckoning) {
      // the bar recorded when the claim was lodged. Older saves carrying a live claim with no
      // `thrPct` fall back to the claimant's bar as it stands now, so nothing breaks on load.
      const thr = G.reckoning.thrPct != null ? G.reckoning.thrPct / 100 : reckoningThresholdFor(G, G.reckoning.by);
      const share = reckoningBlocShare(G, G.reckoning.by);
      const claimantAlive =
        (G.players[G.reckoning.by]?.provinces || []).length > 0 ||
        (G.characters || []).some((c) => c.alive && c.player === G.reckoning.by);
      // the claimant's PERSONAL floor is held for the life of the claim too, so rivals can break a
      // bloc's claim by striking the claimant himself, not only by shrinking the whole bloc.
      const _ownNow = reckoningOwnShare(G, G.reckoning.by),
        _minNow = thr * RECKONING_CALLER_MIN_FRAC;
      if (!claimantAlive || share < thr) {
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "the claim to the throne collapses as the claimant's bloc falls below the bar",
            claimantName: G.players[G.reckoning.by]?.name || null,
            share,
            bar: thr,
          },
          audience: { actor: null, realms: [], seen: 'world' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          system: true,
        });
        delete G.reckoning;
      } else if (_ownNow < _minNow) {
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: 'the claim to the throne collapses as the claimant falls below his own floor',
            claimantName: G.players[G.reckoning.by]?.name || null,
            ownShare: _ownNow,
            ownMinimum: _minNow,
          },
          audience: { actor: null, realms: [], seen: 'world' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          system: true,
        });
        delete G.reckoning;
      } else if (G.turn >= G.reckoning.resolveAtTurn) {
        const rw = reckoningWinner(G);
        G.gameOver = {
          winner: rw.winner ? rw.winner.index : null,
          byReckoning: true,
          turn: G.turn,
          standings: rw.standings.standings,
        };
        delete G.reckoning;
      }
    }
    // THE BAR ERODES. Run LAST in this block, so a claim called this very turn is judged against
    // the threshold as it stood when the orders were written, and so a claim that resolved or
    // collapsed above has already cleared `G.reckoning`. While a claim stands the clock is frozen:
    // no step is taken, and the bar the contesting realms must drive the claimant below stays
    // exactly where it was when the throne was claimed.
    if (!G.gameOver && !G.reckoning && G.turn >= RECKONING_DECAY_FROM_TURN) {
      const nP = (G.players || []).length;
      const before = reckoningThresholdPct(nP, reckoningDecayOf(G));
      if (before > RECKONING_FLOOR_PCT) {
        G.reckoningDecaySteps = reckoningDecayOf(G) + 1;
        const after = reckoningThresholdPct(nP, reckoningDecayOf(G));
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "the Reckoning's bar falls as the world grows weary",
            barBefore: before,
            barNow: after,
            allyStep: reckoningAllyStepPct(nP),
            fallsNoFurther: after <= RECKONING_FLOOR_PCT,
            nextFall: RECKONING_DECAY_STEP_PCT,
          },
          audience: { actor: null, realms: [], seen: 'world' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          system: true,
        });
      }
    }
  }

  // 6f. VICTORY — elimination. If only one realm still holds land or a living character, they win.
  if (!G.gameOver && G.players.length > 1) {
    const live = G.players
      .map((p, pi) => ({
        pi,
        alive: (p.provinces || []).length > 0 || (G.characters || []).some((c) => c.alive && c.player === pi),
      }))
      .filter((x) => x.alive);
    if (live.length === 1) {
      const rw = reckoningWinner(G);
      G.gameOver = { winner: live[0].pi, byElimination: true, turn: G.turn, standings: rw.standings.standings };
    }
  }

  // 6f-ii. VICTORY — concession. Realms that conceded no longer count. If only one un-conceded,
  // still-living realm remains — or every such realm is in ONE mutual alliance — the game ends at
  // once: the sole survivor wins, or, for an allied bloc, the bloc member with the highest Legacy
  // score takes the crown and the standings are shown.
  if (!G.gameOver && G.players.length > 1 && (G.players || []).some((p) => p && p.conceded)) {
    const live = G.players
      .map((p, pi) => ({
        pi,
        alive:
          !p.conceded &&
          ((p.provinces || []).length > 0 || (G.characters || []).some((c) => c.alive && c.player === pi)),
      }))
      .filter((x) => x.alive)
      .map((x) => x.pi);
    // BUG (found 2026-09-27): this tested relationBetween(a,b)==='ally'. The engine's relation
    // value is 'allied' — areAllied is the one reader — so the allied-bloc ending could never fire.
    const allAllied = live.length >= 2 && live.every((a) => live.every((b) => a === b || areAllied(turnContext, a, b)));
    if (live.length <= 1 || allAllied) {
      // 2026-09-27 (Toby item 8): when everyone but one realm has conceded, the RECKONING IS CALLED
      // AT ONCE — no grace period, no waiting for a claim. The survivor takes the crown, but the
      // Legacy standings (titles and relics included) are still counted up and published exactly as
      // they would be at a contested Reckoning, so the game ends with a proper final table.
      delete G.reckoning; // any claim in its grace period is overtaken by this
      const rw = reckoningWinner(G);
      const stand = (rw.standings && rw.standings.standings) || [];
      let winner = live.length === 1 ? live[0] : null;
      if (winner == null && live.length > 1) {
        const best = stand.filter((s) => live.includes(s.index ?? s.pi ?? -1)).sort((a, b) => b.score - a.score)[0];
        winner = best ? (best.index ?? best.pi) : live[0];
      }
      const _nOut = (G.players || []).filter((p) => p && p.conceded).length;
      emit(turnContext, {
        type: 'system',
        fact: {
          kind: 'the Reckoning is called at once as the rivals concede',
          concededCount: _nOut,
          oneCrownLeft: live.length <= 1,
        },
        audience: { actor: null, realms: [], seen: 'world' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        system: true,
        gameEnd: true,
      });
      G.gameOver = { winner, byConcession: true, byReckoning: true, turn: G.turn, standings: stand };
    }
  }

  // 6g. VICTORY — announce the result once.
  if (G.gameOver && !G.gameOver._announced) {
    G.gameOver._announced = true;
    const wi = G.gameOver.winner;
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: 'the game is decided',
        winner: wi != null ? { realmName: G.players[wi]?.name || null, seat: wi } : null,
        byElimination: Boolean(G.gameOver.byElimination),
        byConcession: Boolean(G.gameOver.byConcession),
      },
      audience: { actor: null, realms: [], seen: 'world' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      system: true,
      gameEnd: true,
    });
    (G.gameOver.standings || [])
      .slice()
      .sort((a, b) => b.score - a.score)
      .forEach((st, i) => {
        emit(turnContext, {
          type: 'system',
          fact: {
            kind: "a realm's place in the final Legacy standings",
            place: i + 1,
            realmName: st.name,
            score: st.score,
            titleKeys: [...(st.titles || [])],
            relics: st.relics,
          },
          audience: { actor: null, realms: [], seen: 'world' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          system: true,
          gameEnd: true,
        });
      });
  }
}
