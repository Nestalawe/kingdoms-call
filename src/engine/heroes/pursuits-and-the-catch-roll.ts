// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { COMBAT_ONLY_TACTICS } from '../army-tables.ts';
import { _escapesTheEnd, _garrethEscapeLine } from '../names.ts';
import { d100, rng } from '../dice-and-army-names.ts';
import { dispFloor } from '../rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import { markProvinceCombat } from '../bots/intel.ts';
import { realmTag } from '../turn/log-line-helpers.ts';
import {
  emit,
  emitNarrLine,
  notifyTarget,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
} from '../turn/events-and-their-audiences.ts';
import { applyEvilConquest, areEnemies, setProvinceOwner } from '../realms/relations-and-captures.ts';
import { creditBattle } from '../titles/title-holders-and-battle-merit.ts';
import { effStat, isHiddenChar, oddsNote, statNote } from './effective-skills-and-hidden-heroes.ts';
import { clearNavalHold, navalHeldIn, navalHoldLine } from '../units/sea-lift-stranding-and-retreats.ts';
import {
  SKILLGAIN_COMMON,
  SKILLGAIN_STD,
  awardKillXP,
  rollNavalVoyage,
  trySkillGain,
} from './experience-skill-rises-and-earned-hp.ts';
import { emitBattle } from '../battle/battle-report-lines-and-force-markers.ts';
import { ensureEncounterPlan } from '../personal-combat/speed-encounter-plans-and-combatants.ts';
import { resolveCharVsChar } from '../personal-combat/duels-and-character-encounters.ts';
import { reportHeroFall } from './hero-death-and-leaderless-hosts.ts';
import { combatVsChar } from '../battle/battles-between-heroes.ts';
import { normaliseAction } from '../turn/phase-intents-and-dependency-ordering.ts';
import { stepToward } from '../world/routes-and-distances.ts';

// ── PURSUITS AND THE CATCH ROLL (plan P1-08i3: lifted out of resolveTurn) ────
// A hero on a Pursue or Encounter Character order chases his quarry from province to province for the rest of the
// turn (advancePursuit, called from processOrder and the phase loop), rolls to corner him once they stand together
// (pursuitCatchChance), and fights or meets him when he does; endPursuit ends the chase. An unarmed challenger
// reaching an armed quarry slips past the sentries on the ENC_BREAK_RANKS_* chance. pursuitCatchChance and
// advancePursuit take the turn's context first (src/engine/turn/context.ts); endPursuit takes none.
// Encounter Character: an UNARMED challenger reaching an ARMED quarry (see advancePursuit).
export const ENC_BREAK_RANKS_BASE = 60,
  ENC_BREAK_RANKS_PER_UNIT = 8,
  ENC_BREAK_RANKS_SPY = 5,
  ENC_BREAK_RANKS_TAC = 5,
  ENC_BREAK_RANKS_MIN = 5,
  ENC_BREAK_RANKS_MAX = 95;

// ── PURSUE (AK [3.16]) ────
// "A character can be ordered to chase after another character for the rest of the turn… he will
// keep moving from province to province until he arrives in the province occupied by the
// targeted character." Chance of running the quarry down comes from the Spy Table: doubled if
// the quarry leads an army (a column is easy to follow), divided by the distance between them,
// and automatic if the quarry belongs to the pursuer's own realm.
// the old AK Spy-table (50/100/150/200/250%) is retired. The catch roll is now a Spy CONTEST: 70%
// base (50% until 2026-10-13, Toby item 11), +5% per Spy level of the pursuer, −5% per Spy level of the quarry. (2026-09-24, Toby: the
// old doubling when the quarry leads an army is gone — leading troops no longer makes a character
// twice as easy to corner.) The roll is only ever made once the two
// stand in the same province (advancePursuit), so the old divide-by-distance was dead code.
// Clamped 5–100. A friendly quarry is always caught (a rendezvous, not a hunt).
export function pursuitCatchChance(turnContext, c, quarry) {
  if (quarry.player != null && quarry.player === c.player) return 100;
  const spy = effStat(turnContext, c, 'spy'),
    qSpy = effStat(turnContext, quarry, 'spy');
  const pct = 70 + 5 * spy - 5 * qSpy; // 2026-09-24: no ×2 for a quarry leading an army · 2026-10-13 (item 11): base 70%
  return Math.max(5, Math.min(100, dispFloor(pct)));
}

export function endPursuit(c) {
  if (c._pursuit) c._pursuit.active = false;
}

export function advancePursuit(turnContext, c, ph) {
  const { G, fieldBattlePhase, seaMovePoints, movePoints } = turnContext;
  const p = c._pursuit;
  if (!p || !p.active) return;
  const quarry = (G.characters || []).find((x) => x && x.id === p.targetId);
  const here = G.world.provinces[c.location];
  if (!quarry || !quarry.alive) {
    emit(turnContext, {
      type: 'move',
      text: `${c.name}'s quarry is beyond catching now — the chase is called off.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: here ? here.id : null,
    });
    endPursuit(c);
    return;
  }
  // the old arms-matching rule (which ended a chase the moment one side was armed and the other
  // was not) is retired — an Encounter can now run down a quarry whoever is travelling light. How
  // the meeting resolves depends on arms at the moment of the catch (below): both leading columns
  // fight a battle; otherwise it is a personal duel, and a quarry still at the head of a column
  // refuses to break ranks for it.
  const meArmed = (c.armies || []).length > 0,
    themArmed = (quarry.armies || []).length > 0;
  if (isHiddenChar(turnContext, quarry) && quarry.player !== c.player) {
    emit(turnContext, {
      type: 'move',
      text: `${c.name} follows the trail of ${quarry.name} into ${here ? here.name : 'the wilds'} and loses it utterly — the man seems to leave no track at all.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: here ? here.id : null,
    });
    endPursuit(c);
    return;
  }
  // THIEF L9 Vanish: a Vanished character cannot be run down NOR brought to an Encounter — the
  // chase simply ends, wherever in it we are.
  if (quarry._vanishTurn === G.turn && quarry.player !== c.player) {
    emit(turnContext, {
      type: 'move',
      text: `${c.name} presses the chase after ${quarry.name}, but the quarry melts into the shadows and is gone. (Vanish)`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: here ? here.id : null,
    });
    endPursuit(c);
    return;
  }
  // 2026-09-29 (Toby): ONE BATTLE PER PHASE applies to a chase already under way. Stage 1b only
  // cancels a Pursue/Encounter ORDER given this phase; a pursuit set in an EARLIER phase runs here
  // and bypassed that check, so a pursuer who had just fought the resumed battle for a province at
  // the top of the phase could "run his quarry to ground" and fight a second battle in the same
  // phase. An army-leading pursuer who has already fought this phase, or who is still locked in an
  // unresolved battle where he stands, holds the chase over to the next phase (it stays live).
  // 2026-10-08 (Toby item 7): …or who has fought ANY battle this phase. A chaser whose quarry turned
  // and attacked him first (the quarry acts before his hunter) had defended a province, won, and
  // then rode straight after the beaten foe into a second battle in the same phase.
  if (
    meArmed &&
    (c._foughtStalledBattlePhase === ph || fieldBattlePhase[c.id] === ph || (here && here._battleUnresolved))
  ) {
    emit(turnContext, {
      type: 'move',
      text: `${c.name} has a battle on their hands in ${here ? here.name : 'the field'} this season — the chase after ${quarry.name} must wait.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: here ? here.id : null,
    });
    return;
  }

  // Not yet co-located: close one province along a legal route.
  if (c.location !== quarry.location) {
    const usingSea = (G.world.provinces[c.location] || {}).terrain === 'sea';
    const pool = usingSea ? seaMovePoints : movePoints;
    if ((pool[c.id] ?? 0) <= 0 && (movePoints[c.id] ?? 0) <= 0 && (seaMovePoints[c.id] ?? 0) <= 0) {
      emit(turnContext, {
        type: 'move',
        text: `${c.name} can drive their horses no further this year — the chase after ${quarry.name} stalls.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: here ? here.id : null,
      });
      endPursuit(c);
      return;
    }
    const step = stepToward(turnContext, c, quarry.location);
    if (!step) {
      emit(turnContext, {
        type: 'move',
        text: `${c.name} can find no road that brings them closer to ${quarry.name} — the trail goes cold.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: here ? here.id : null,
      });
      endPursuit(c);
      return;
    }
    const toSea = step.terrain === 'sea';
    if (toSea) {
      if ((seaMovePoints[c.id] ?? 0) <= 0) {
        emit(turnContext, {
          type: 'move',
          text: `${c.name} has no ships left to follow ${quarry.name} out onto the water.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: here ? here.id : null,
        });
        endPursuit(c);
        return;
      }
      seaMovePoints[c.id]--;
    } else {
      if ((movePoints[c.id] ?? 0) <= 0) {
        emit(turnContext, {
          type: 'move',
          text: `${c.name}'s column is spent and can march no further after ${quarry.name}.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: here ? here.id : null,
        });
        endPursuit(c);
        return;
      }
      movePoints[c.id]--;
    }
    if (here) here.characters = (here.characters || []).filter((id) => id !== c.id);
    step.characters = step.characters || [];
    if (!step.characters.includes(c.id)) step.characters.push(c.id);
    c.location = step.id;
    c.locationName = step.name;
    if (!step.visitedBy) step.visitedBy = [];
    if (!step.visitedBy.includes(c.player)) step.visitedBy.push(c.player);
    if ((c.armies || []).length > 0 && !toSea) trySkillGain(turnContext, c, 'march', SKILLGAIN_COMMON);
    if (toSea) rollNavalVoyage(turnContext, c, SKILLGAIN_COMMON); // a voyage trains Naval only for a hero leading ships (batch item 9)
    trySkillGain(turnContext, c, 'spy', SKILLGAIN_STD); // AK [3.19]: Spy/Trail/Pursue trains Spy
    if (c.location !== quarry.location) {
      emit(turnContext, {
        type: 'move',
        text: `${c.name} presses on into ${step.name}, hard on the trail of ${quarry.name}.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: step.id,
      });
      return; // still chasing — try again next phase
    }
    emit(turnContext, {
      type: 'move',
      text: `${c.name} rides into ${step.name} and finds ${quarry.name} there.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: step.id,
    });
  }

  // Co-located — try to actually run him down.
  const prov = G.world.provinces[c.location];
  // A mutual pair (each set out after the other) resolves as ONE meeting this phase, not two.
  if (c._encounteredThisPhase === quarry.id || quarry._encounteredThisPhase === c.id) {
    endPursuit(c);
    return;
  }
  const chance = pursuitCatchChance(turnContext, c, quarry);
  const roll = d100();
  emit(turnContext, {
    type: 'system',
    text: `📊 Pursuit — ${c.name} (Spy ${effStat(turnContext, c, 'spy')}) closing on ${quarry.name}${statNote(turnContext, c.player, quarry, 'spy')}: ${oddsNote(turnContext, c.player, quarry, chance, roll)}`,
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  });
  if (roll > chance) {
    emit(turnContext, {
      type: 'move',
      text: `${quarry.name} slips away through the country around ${prov.name} — ${c.name} keeps the trail but cannot close.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return; // pursuit stays live into the next phase
  }

  // Caught. Friendly quarry: a rendezvous, not a fight.
  if (quarry.player != null && quarry.player === c.player) {
    emit(turnContext, {
      type: 'move',
      text: `${c.name} catches up with ${quarry.name} in ${prov.name} and the two columns join company.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    endPursuit(c);
    return;
  }
  // DIPLOMACY: a quarry belonging to a player we are NOT at war with (allied or neutral) is not
  // run down — the pursuit ends in a meeting, not a battle. Only enemy (or NPC) quarry are
  // fought.
  if (quarry.player != null && !areEnemies(turnContext, c.player, quarry.player)) {
    emit(turnContext, {
      type: 'move',
      text: `${c.name} overtakes ${quarry.name} in ${prov.name}, but ${G.players[quarry.player]?.name || 'their realm'} is not at war with ${G.players[c.player]?.name || 'us'} — the two columns pass without bloodshed.`,
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    endPursuit(c);
    return;
  }

  if (meArmed && themArmed) {
    // 2026-09-29: nor may the chase force a battle on a quarry who has already fought this phase,
    // or in a province whose own battle is still being fought — the pursuit carries on next phase.
    if (quarry._foughtStalledBattlePhase === ph || prov._battleUnresolved) {
      emit(turnContext, {
        type: 'move',
        text: `${c.name} closes on ${quarry.name} in ${prov.name}, but the ground is already a battlefield this season — the reckoning must wait.`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      return;
    }
    // Both lead armies: "the pursuing character will attempt to run him down and defeat him in
    // battle." Defenders in the province unify behind the quarry as in any other battle.
    const defReinf = (G.characters || []).filter(
      (d) =>
        d.alive &&
        d.id !== quarry.id &&
        d.player === quarry.player &&
        d.location === prov.id &&
        (d.armies || []).length > 0,
    );
    const combinedAtk = { ...c, armies: [...(c.armies || [])] };
    const combinedDef = { ...quarry, armies: [...(quarry.armies || []), ...defReinf.flatMap((d) => d.armies || [])] };
    const targetsPi = [c.player, quarry.player].filter((x) => x != null);
    emit(turnContext, {
      type: 'combat',
      text: `⚔ ${c.name} runs ${quarry.name} to ground in ${prov.name} and forces battle!`,
      audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      heroes: [c.id, quarry.id],
    });
    const battle = combatVsChar(turnContext, combinedAtk, combinedDef, prov);
    creditBattle(turnContext, c, quarry, battle, prov);
    c._foughtStalledBattlePhase = ph;
    quarry._foughtStalledBattlePhase = ph;
    defReinf.forEach((d) => {
      d._foughtStalledBattlePhase = ph;
    }); // their one battle for the phase
    emitBattle(turnContext, battle, prov, ph, targetsPi, { actor: c.player, charIds: [c.id, quarry.id] }); // into both combatants' sections
    // Write casualties back from the pooled copies to the real characters.
    c.armies = (c.armies || []).filter((a) => !a._died && !a._disbanded);
    [quarry, ...defReinf].forEach((d) => {
      d.armies = (d.armies || []).filter((a) => !a._died && !a._disbanded);
    });
    if (c.alive && combinedAtk.location !== c.location) {
      c.location = combinedAtk.location;
      const np = G.world.provinces[c.location];
      if (np) c.locationName = np.name;
    } // a slain pursuer stays where they fell
    if (combinedDef.location !== quarry.location) {
      const np = G.world.provinces[combinedDef.location];
      if (quarry.alive) {
        quarry.location = combinedDef.location;
        if (np) quarry.locationName = np.name;
      } // a slain quarry stays where they fell
      // The quarry's unified defenders rout with them rather than being left behind alone.
      if (np) {
        if (!np.characters) np.characters = [];
        defReinf.forEach((d) => {
          if (!d.alive) {
            return;
          } // dead reinforcements do not rout
          prov.characters = (prov.characters || []).filter((id) => id !== d.id);
          if (!np.characters.includes(d.id)) np.characters.push(d.id);
          d.location = np.id;
          d.locationName = np.name;
          // forced retreat/fall-back does NOT consume move points.
        });
      }
    }
    prov._hadBattleThisTurn = true;
    // 2026-10-08 (Toby item 7): A CHASE BATTLE WON IS GROUND TAKEN. The battle report already said the
    // hunter "seized" the province, but nothing here ever changed its owner — the hunter won and the
    // province stayed the enemy's. Now it is taken exactly as after a Move: only when nothing armed
    // and hostile is left standing in it. Survivors who held on, hulls left ashore, or the
    // province's own garrison (which did not fight in the chase) keep it contested, and the fight
    // for it resumes next phase.
    if (
      battle &&
      battle.won &&
      c.alive &&
      c.location === prov.id &&
      !prov._battleUnresolved &&
      prov.owner !== c.player &&
      (prov.owner == null || areEnemies(turnContext, c.player, prov.owner)) &&
      !(prov.owner == null && (prov.neutralDefenders || []).length)
    ) {
      const _hostileLeft = (G.characters || []).some(
        (ch) =>
          ch &&
          (ch.alive || ch._leaderlessHost) &&
          ch.location === prov.id &&
          (ch.armies || []).length > 0 &&
          ch.player != null &&
          ch.player !== c.player &&
          areEnemies(turnContext, c.player, ch.player),
      );
      const _hulls = navalHeldIn(prov, c.player);
      const _garrison =
        prov.owner != null &&
        (prov.garrisonArmies || []).some((a) => a && !a._died && !a._disbanded && a._navalHold == null);
      if (_hostileLeft || _hulls.length || _garrison) {
        prov._battleUnresolved = true;
        emit(turnContext, {
          type: 'combat',
          text:
            _garrison && !_hostileLeft && !_hulls.length
              ? `${c.name} carries the field at ${prov.name}, but its garrison still holds the province — the fight for it resumes next season.`
              : `${c.name} carries the field at ${prov.name}, but enemy forces still hold their ground — the province remains contested.`,
          audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
        if (!_hostileLeft && _hulls.length)
          emit(turnContext, {
            type: 'combat',
            fact: navalHoldLine(turnContext, prov, _hulls, G.players[c.player]?.name || null),
            audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            province: prov.id,
          });
      } else {
        const _wp = G.players[c.player];
        G.players.forEach((p, pi) => {
          if (pi !== c.player) {
            const i = (p.provinces || []).indexOf(prov.id);
            if (i > -1) p.provinces.splice(i, 1);
          }
        });
        setProvinceOwner(turnContext, prov, c.player, c, ph);
        if (_wp && !_wp.provinces.includes(prov.id)) _wp.provinces.push(prov.id);
        emit(turnContext, {
          type: 'combat',
          text: `${c.name} claims ${prov.name} for ${_wp ? _wp.name : 'their realm'}!`,
          audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
        });
        if (_wp) applyEvilConquest(turnContext, c, prov, _wp);
      }
    }
    clearNavalHold(prov);
  } else {
    // at least one side is travelling light — this is a PERSONAL duel, not a battle
    // (only the both-armed case above becomes a battle). A King answers a challenge only if he set
    // out after the same man himself.
    //
    // BREAKING RANKS. A quarry at the head of a column used to refuse the duel outright. Now the
    // unarmed challenger must get through the pickets to the commander's tent: one roll at
    // ENC_BREAK_RANKS_BASE, less ENC_BREAK_RANKS_PER_UNIT for every unit the quarry leads (a
    // bigger camp is a better-watched camp), plus ENC_BREAK_RANKS_SPY per level of the challenger's
    // Spy (slipping the sentries), less ENC_BREAK_RANKS_TAC per level of the quarry's Tactical (a
    // well-ordered camp), clamped 5–95. Success → the ordinary duel below. Failure → the sentries
    // turn the challenger away, the chase ends (no free re-roll next phase) and the quarry's realm
    // is told who came for him. Kings are unchanged — the crown-only rules still apply after this.
    if (themArmed) {
      const _units = (quarry.armies || []).filter((a) => a && !a._died && !a._disbanded && !a._phantom).length;
      const _spy = effStat(turnContext, c, 'spy'),
        _tac = effStat(turnContext, quarry, 'tactical');
      const _pct = Math.max(
        ENC_BREAK_RANKS_MIN,
        Math.min(
          ENC_BREAK_RANKS_MAX,
          ENC_BREAK_RANKS_BASE -
            ENC_BREAK_RANKS_PER_UNIT * _units +
            ENC_BREAK_RANKS_SPY * _spy -
            ENC_BREAK_RANKS_TAC * _tac,
        ),
      );
      const _roll = d100();
      emit(turnContext, {
        type: 'system',
        text: `📊 Breaking ranks — ${c.name} (Spy ${_spy}) slips toward ${quarry.name}'s tent through a camp of ${_units} unit${_units !== 1 ? 's' : ''}${statNote(turnContext, c.player, quarry, 'tactical')}: ${oddsNote(turnContext, c.player, quarry, _pct, _roll)}`,
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
      });
      if (_roll > _pct) {
        emit(turnContext, {
          type: 'system',
          text: `${c.name} runs ${quarry.name} to ground in ${prov.name}, but the sentries of their column are awake — the challenger is turned away from the lines before reaching the commander, and the chase is abandoned.`,
          audience: { actor: c.player, realms: [c.player] },
          hero: c.id,
          province: prov.id,
        });
        notifyTarget(
          turnContext,
          quarry,
          `👁 ${c.name}${realmTag(turnContext, c.player)} came for ${quarry.name} in ${prov.name} — a lone challenger, turned away by the sentries before reaching the tent.`,
          ph,
          'system',
        );
        endPursuit(c);
        return;
      }
      emit(turnContext, {
        type: 'system',
        text: `${c.name} slips through the picket lines of ${quarry.name}'s column in ${prov.name} and forces the matter before the commander can rally the guard.`,
        audience: { actor: c.player, realms: [c.player, quarry.player].filter((x) => x != null) },
        hero: c.id,
        heroes: [c.id, quarry.id],
        province: prov.id,
      });
    }
    // A crowned head does not answer a challenge from a commoner. It DOES answer another crown:
    // the order form already refuses a non-king who names a king, and the order-time gate above
    // (`quarry.isKing && !c.isKing`) says the same — but this catch-time gate had no `!c.isKing`
    // of its own, so a KING who ran a rival king to ground was turned away here too unless the
    // rival happened to be hunting him back that same phase. That is the "my king cannot get at
    // his king" report: the chase resolved, then silently ended in "the King rides on".
    // 2026-09-21: king-on-king now goes to the duel; only a commoner is refused.
    if (quarry.isKing && !c.isKing) {
      const _their = (G.turnOrders[quarry.id] || [])[ph];
      const _mutual = normaliseAction(_their) === 'encounter' && parseInt(_their && _their.target) === c.id;
      if (!_mutual) {
        emit(turnContext, {
          type: 'system',
          text: `${c.name} corners ${quarry.name} in ${prov.name}, but a crowned head does not stoop to answer every challenge — the King rides on.`,
          audience: { actor: c.player, realms: [c.player, quarry.player].filter((x) => x != null) },
          hero: c.id,
          heroes: [c.id, quarry.id],
          province: prov.id,
        });
        endPursuit(c);
        return;
      }
    }
    const COMBAT_ONLY = COMBAT_ONLY_TACTICS;
    const filterPlan = (plan) =>
      ((plan && plan.tactics) || ['ME']).filter(
        (t) => COMBAT_ONLY.has(String(t).split(':')[0].toUpperCase()) || String(t).toUpperCase().startsWith('CA:'),
      );
    ensureEncounterPlan(turnContext, quarry);
    const atkPlan = filterPlan(c.encounterPlan);
    if (!atkPlan.length) atkPlan.push('ME');
    const defPlan = filterPlan(quarry.encounterPlan);
    if (!defPlan.length) defPlan.push('ME');
    const targetsPi = [c.player, quarry.player].filter((x) => x != null);
    const _duelChars = [c.id, quarry.id]; // the duel belongs in BOTH duellists' report sections
    emit(turnContext, {
      type: 'combat',
      text: `⚔ ${c.name} finally corners ${quarry.name} in ${prov.name}.`,
      audience: { actor: c.player, realms: targetsPi, seen: prov.owner !== null ? 'battle' : undefined },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      heroes: _duelChars,
    });
    markProvinceCombat(prov, [c.player, quarry.player]); // purple swords: a personal combat, not a field battle
    const enc = resolveCharVsChar(
      turnContext,
      c,
      quarry,
      atkPlan,
      defPlan,
      prov,
      (...a) => effStat(turnContext, ...a),
      rng,
      G,
    );
    enc.narrative.forEach((line) =>
      emitNarrLine(turnContext, line, {
        type: 'combat',
        audience: { actor: c.player, realms: targetsPi },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        province: prov.id,
        heroes: _duelChars,
      }),
    );
    // a hero beaten to 0 HP in the duel DIES outright — the old "capitulates and survives at 1
    // HP" reprieve is gone. atkKilled/defKilled still cover the explicit-slaying path; the hp<=0
    // checks catch every other felling.
    c.hp = Math.max(1, enc.atkHp);
    if (quarry.player !== null) quarry.hp = Math.max(1, enc.defHp);
    if (enc.atkKilled || enc.atkHp <= 0) {
      if (_escapesTheEnd(c)) {
        if (c.hp != null && c.hp <= 0) c.hp = 1;
        emit(turnContext, {
          type: 'combat',
          fact: _garrethEscapeLine(c),
          audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
          heroes: _duelChars,
        });
      } else {
        reportHeroFall(turnContext, c, quarry, `${c.name} has been slain at the end of the chase!`, {
          audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
          heroes: _duelChars,
        });
        awardKillXP(turnContext, quarry, c);
      }
    }
    if (enc.defKilled || enc.defHp <= 0) {
      if (_escapesTheEnd(quarry)) {
        if (quarry.hp != null && quarry.hp <= 0) quarry.hp = 1;
        emit(turnContext, {
          type: 'combat',
          fact: _garrethEscapeLine(quarry),
          audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
          heroes: _duelChars,
        });
      } else {
        reportHeroFall(turnContext, quarry, c, `${quarry.name} is run down and slain!`, {
          audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          province: prov.id,
          heroes: _duelChars,
        });
        awardKillXP(turnContext, c, quarry);
      }
    }
  }
  // Mark the pair so a mutual Encounter (each hunting the other) can't resolve a second time this
  // phase.
  c._encounteredThisPhase = quarry.id;
  quarry._encounteredThisPhase = c.id;
  endPursuit(c);
}
