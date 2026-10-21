// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
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
  _TITLE_LABEL,
  alliedBloc,
  reckoningBlocShare,
  reckoningCallEligibility,
  reckoningOwnShare,
  reckoningThresholdFor,
  reckoningWinner,
} from '../titles/reckoning.ts';
import { areAllied, relKeyOf } from '../realms/relations-and-captures.ts';
import { warFrontThreats } from '../battle/war-fronts-and-enemy-stand-offs.ts';

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
// read here from the context (turnContext.diploDeclarations, turnContext.reckoningCalls). The bodies keep resolveTurn's
// indent (plan P1-08's Decisions).

export function diplomacyResolutionOverturesPeaceAlliancesWarAndWarFrontWarnings(turnContext) {
  const { G, diploDeclarations, log } = turnContext;
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
      if (!((G.players[from] && G.players[from]._encountered) || []).includes(to)) return null; // must have met them
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
        const na = G.players[a]?.name || 'Realm ' + (a + 1),
          nb = G.players[b]?.name || 'Realm ' + (b + 1);
        // ── OVERTURES RECEIVED ── A realm that is offered peace or an alliance is TOLD SO, whether
        // or not it answered in kind. The word used matches what the offer would actually achieve
        // from the current relation.
        const _offerWord = cur === 'enemy' ? 'peace' : 'an alliance';
        const _mutual = da === 'treat' && db === 'treat';
        const _tellOffered = (to, from, fromName) => {
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
          log(
            'system',
            `🕊 ${fromName} has sent you an overture of ${_offerWord}.${_mutual ? ' You answered in kind.' : ` Declare a Treat toward ${fromName} with next turn's orders to answer it.`}`,
            { actor: null, targets: [to], system: true },
          );
        };
        if (da === 'treat') _tellOffered(b, a, na);
        if (db === 'treat') _tellOffered(a, b, nb);
        if (blockedAlliance) {
          log(
            'system',
            `${na} and ${nb} both sought an alliance, but no alliances may be forged in a realm of so few kings — the pact cannot be sealed.`,
            { actor: null, targets: [a], system: true },
          );
          log(
            'system',
            `${nb} and ${na} both sought an alliance, but no alliances may be forged in a realm of so few kings — the pact cannot be sealed.`,
            { actor: null, targets: [b], system: true },
          );
          continue;
        }
        if (next === cur) {
          // Unreciprocated overture: let the offerer(s) know nothing changed. (The party who was
          // courted has already been told of the overture itself, just above.)
          if (da === 'treat')
            log(
              'system',
              `${na}'s overture of ${cur === 'enemy' ? 'peace' : 'alliance'} to ${nb} went unanswered this year — relations are unchanged.`,
              { actor: null, targets: [a], system: true },
            );
          if (db === 'treat')
            log(
              'system',
              `${nb}'s overture of ${cur === 'enemy' ? 'peace' : 'alliance'} to ${na} went unanswered this year — relations are unchanged.`,
              { actor: null, targets: [b], system: true },
            );
          continue;
        }
        if (next === 'neutral') delete G.relations[key];
        else G.relations[key] = next;
        let mA, mB;
        if (next === 'enemy') {
          mA = mB = `⚔ War now stands between ${na} and ${nb}. Their armies may cross the frontier and give battle.`;
        } else if (next === 'allied') {
          mA = `🤝 ${na} and ${nb} are now ALLIED — your armies may pass freely through one another's lands and will never come to blows.`;
          mB = `🤝 ${nb} and ${na} are now ALLIED — your armies may pass freely through one another's lands and will never come to blows.`;
        } else if (_brokenPact) {
          const _breaker = da === 'enemy' && db === 'enemy' ? `${na} and ${nb}` : da === 'enemy' ? na : nb;
          mA =
            mB = `💔 ${_breaker} ${da === 'enemy' && db === 'enemy' ? 'have' : 'has'} broken the alliance between ${na} and ${nb} — the two realms are NEUTRAL once more. Neither may march an army across the other's border; a further declaration of war would open hostilities.`;
        } else {
          mA =
            mB = `🕊 ${na} and ${nb} have made peace and are now NEUTRAL — neither may march an army across the other's border.`;
        }
        log('system', mA, { actor: null, targets: [a], system: true });
        log('system', mB, { actor: null, targets: [b], system: true });
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
            const n = (c.armies || []).length,
              foeNm = G.players[foe]?.name || 'the enemy',
              ownNm = G.players[c.player]?.name || 'the enemy';
            log(
              'system',
              `⚠ War front: ${c.name}'s host (${n} unit${n !== 1 ? 's' : ''}) stands in ${pv.name}, ${onFoeLand ? `land of ${foeNm}` : `face to face with a host of ${foeNm}`}. If it is still there at the end of next Spring it will give battle for the province — march it out in Spring to avoid the fight, or reinforce it.`,
              { actor: null, targets: [c.player], system: true, provinceId: pv.id },
            );
            if (c._invisTurn !== G.turn)
              log(
                'system',
                `⚠ War front: ${c.name} (${ownNm}) holds a host of ${n} unit${n !== 1 ? 's' : ''} ${onFoeLand ? `inside your province of ${pv.name}` : `beside your host in ${pv.name}`}. Unless it withdraws, it will attack at the end of next Spring — reinforce ${pv.name}, or keep a general on Defend next door to ride in.`,
                { actor: null, targets: [foe], system: true, provinceId: pv.id },
              );
          });
        }
      }
    }
  }
}

export function victoryTheReckoningEliminationConcessionAndTheAnnouncement(turnContext) {
  const { G, reckoningCalls, log } = turnContext;
  // 6e. VICTORY — THE RECKONING (KC end-game). Process new claims, grace-period lapse, resolution.
  {
    // the earliest turn a claim may be lodged is RECKONING_MIN_TURN, not the turn titles go public.
    // A realm that lodges one earlier is told when the throne opens.
    if (!G.reckoning && reckoningCalls.size > 0 && G.turn < RECKONING_MIN_TURN) {
      for (const pi of reckoningCalls) {
        log(
          'system',
          `${G.players[pi]?.name || 'A king'} calls for the Reckoning, but the throne cannot be claimed before Turn ${RECKONING_MIN_TURN} — the realms are barely settled and the world will not yet be judged. The claim may be lodged again from that turn.`,
          { actor: null, targets: [pi], system: true },
        );
      }
    }
    if (!G.reckoning && reckoningCalls.size > 0 && G.turn >= RECKONING_MIN_TURN) {
      for (const pi of reckoningCalls) {
        const kingAlive = (G.characters || []).some((c) => c.alive && c.isKing && c.player === pi);
        if (!kingAlive) {
          log('system', `Only a king may call the Reckoning.`, { actor: null, targets: [pi], system: true });
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
          const nm = G.players[pi]?.name || 'Realm ' + (pi + 1);
          const allies = bloc
            .filter((b) => b !== pi)
            .map((b) => G.players[b]?.name)
            .filter(Boolean);
          const blocNm = allies.length ? ` and their allies (${allies.join(', ')})` : '';
          log(
            'system',
            `👑 THE RECKONING IS CALLED. ${nm}${blocNm} lay claim to the vacant Imperial throne, commanding ${dispFloor(share * 100)}% of the world${allies.length ? ` — a bar of ${dispFloor(thr * 100)}%, raised by ${allies.length} all${allies.length === 1 ? 'y' : 'ies'} standing with the claim` : ''}. The realms have TWO turns to contest it — drive ${nm}'s bloc below ${dispFloor(thr * 100)}% and the claim collapses. Otherwise the world is judged at the end of Turn ${G.reckoning.resolveAtTurn}.`,
            { actor: null, targets: [], system: true, public: true },
          );
          break;
        } else if (_el.reason === 'callerShort') {
          // the BLOC clears the bar, but this realm is a passenger in it — an ally who holds a
          // sliver of the world cannot be the one to claim the throne on the bloc's strength.
          log(
            'system',
            `${G.players[pi]?.name || 'A king'} calls for the Reckoning on the strength of their alliance, but their OWN realm commands only ${dispFloor(_el.ownShare * 100)}% of the world — a claimant must personally hold at least ${dispFloor(_el.callerMin * 100)}% (half the ${dispFloor(thr * 100)}% bar) to press the claim. The throne is not won by riding a stronger ally's coat-tails; let the bloc's greatest realm lodge it.`,
            { actor: null, targets: [pi], system: true },
          );
        } else {
          log(
            'system',
            `${G.players[pi]?.name || 'A king'} calls for the Reckoning, but commands only ${dispFloor(share * 100)}% of the world — short of the ${dispFloor(thr * 100)}% needed to press the claim.`,
            { actor: null, targets: [pi], system: true },
          );
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
        log(
          'system',
          `The claim to the throne collapses — ${G.players[G.reckoning.by]?.name || 'the claimant'}'s bloc no longer commands the world (${dispFloor(share * 100)}% < ${dispFloor(thr * 100)}%). The Reckoning is called off; the war goes on.`,
          { actor: null, targets: [], system: true, public: true },
        );
        delete G.reckoning;
      } else if (_ownNow < _minNow) {
        log(
          'system',
          `The claim to the throne collapses — ${G.players[G.reckoning.by]?.name || 'the claimant'} has been cut down to ${dispFloor(_ownNow * 100)}% of the world in their own right, beneath the ${dispFloor(_minNow * 100)}% a claimant must personally hold. Their allies still stand, but the claim was theirs to carry and they can no longer carry it. The Reckoning is called off; the war goes on.`,
          { actor: null, targets: [], system: true, public: true },
        );
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
        log(
          'system',
          `⏳ The world grows weary of the long war. No throne has been claimed, and the crown's price falls: a realm standing alone now needs only ${after}% of the world's tax base to Call the Reckoning — down from ${before}%. (A claim carried by allies still costs ${reckoningAllyStepPct(nP)} points more for every ally standing with it.)${after <= RECKONING_FLOOR_PCT ? ' It will fall no further.' : ` It will fall another ${RECKONING_DECAY_STEP_PCT}% at the end of next turn.`}`,
          { actor: null, targets: [], system: true, public: true },
        );
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
      log(
        'system',
        `👑 THE RECKONING IS CALLED — ${_nOut} realm${_nOut !== 1 ? 's have' : ' has'} conceded and ${live.length <= 1 ? 'only one crown still contests the world' : 'the last crowns standing are sworn to one another'}. The throne is settled here and now; the Legacy of every realm, titles and relics counted, is set down below.`,
        { actor: null, targets: [], system: true, public: true, gameEnd: true },
      );
      G.gameOver = { winner, byConcession: true, byReckoning: true, turn: G.turn, standings: stand };
    }
  }

  // 6g. VICTORY — announce the result once.
  if (G.gameOver && !G.gameOver._announced) {
    G.gameOver._announced = true;
    const wi = G.gameOver.winner;
    const wn = wi != null ? G.players[wi]?.name || 'Realm ' + (wi + 1) : 'No-one';
    const how = G.gameOver.byElimination
      ? 'the last realm standing in a world of ruins'
      : G.gameOver.byConcession
        ? 'the last crown still contesting the world — every rival has conceded'
        : 'judged supreme at the Reckoning';
    log('system', `🏆 THE GAME IS DECIDED — ${wn} is ${how}!`, {
      actor: null,
      targets: [],
      system: true,
      public: true,
      gameEnd: true,
    });
    (G.gameOver.standings || [])
      .slice()
      .sort((a, b) => b.score - a.score)
      .forEach((st, i) => {
        const tHeld = (st.titles || []).map((k) => _TITLE_LABEL[k] || k).join(', ');
        const relicTxt = st.relics
          ? `${st.titles && st.titles.length ? ', ' : ''}${st.relics} relic${st.relics !== 1 ? 's' : ''}`
          : '';
        log(
          'system',
          `   ${i + 1}. ${st.name} — ${st.score} Legacy${tHeld || relicTxt ? ` (${tHeld}${relicTxt})` : ''}`,
          { actor: null, targets: [], system: true, public: true, gameEnd: true },
        );
      });
  }
}
