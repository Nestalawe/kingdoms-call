// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { COMBAT_ONLY_TACTICS } from '../army-tables.ts';
import { _escapesTheEnd, _garrethEscapeLine } from '../names.ts';
import { d100, fmtRoll, rng } from '../dice-and-army-names.ts';
import { markProvinceCombat } from '../bots/intel.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { realmTag } from '../turn/log-line-helpers.ts';
import { emitNarrLine } from '../turn/events-and-their-audiences.ts';
import { completeDefendWatches } from '../turn/mercenary-ids-and-battle-records.ts';
import { applyEvilConquest, areEnemies, setProvinceOwner } from '../realms/relations-and-captures.ts';
import { creditBattle } from '../titles/title-holders-and-battle-merit.ts';
import { effStat, isHiddenChar, isVeiled } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { canStepBetween } from './movement-pools.ts';
import { armyTotalStr, commandHandoverLine, pickBattleCommander, syncLeaderCopy } from '../battle/best-commander.ts';
import {
  SKILLGAIN_COMMON,
  SKILLGAIN_STD,
  awardKillXP,
  rollNavalVoyage,
  trySkillGain,
} from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { emitBattle } from '../battle/battle-report-lines-and-force-markers.ts';
import { ensureEncounterPlan } from '../personal-combat/speed-encounter-plans-and-combatants.ts';
import { resolveCharVsChar } from '../personal-combat/duels-and-character-encounters.ts';
import { reportHeroFall } from '../heroes/hero-death-and-leaderless-hosts.ts';
import { combatVsChar } from '../battle/battles-between-heroes.ts';
import { isHostileInvasion, phaseInitCompare } from '../turn/phase-intents-and-dependency-ordering.ts';

// ── THE DEFEND WATCH: RIDE-OUTS, AMBUSHES AND REINFORCEMENTS (plan P1-08i2: lifted out of resolveTurn) ────
// What a hero on a Defend order does while he keeps watch, each phase: a general rides out to meet an enemy column
// marching into a neighbouring province of his realm (runDefendReactions, before the marches), or a host raised or
// summoned there (defendAnswerUnitGain, the moment it appears; runDefendMaterializedReactions, after every order), and
// is told when no battle came of it (reconcileDefendRideOuts); a hero with no troops lies in wait to ambush an enemy
// who marches in (runDefendAmbush); and a column already marching to its own invaded province is hurried in ahead of
// the invader (runReinforcementArrivals). resolveTurn's phase loop calls them, and resolveUnitGainInProvince calls
// defendAnswerUnitGain. They take the turn's context first (src/engine/turn/context.ts).
// ── DEFEND (AK [3.15]) ────
// A general ordered to Defend keeps watch for the REST OF THE TURN. He reacts to an enemy
// invasion of a province that is adjacent to both where he is standing and the centre of the
// 7-province area he was assigned, marching there to fight alongside the defenders. Reacting
// costs a movement point, and once his movement is spent he can no longer react.
//
// This runs as a pre-pass each phase, before any order resolves, so the reacting general is
// already standing in the province when the invader arrives and is picked up by defender-unify.

// Is province P inside this general's assigned reaction zone? AK: he only reacts to an invasion
// of a province adjacent to BOTH his current province and the province he was told to Defend.
export function inDefendZone(turnContext, c, P) {
  const { G } = turnContext;
  // the watch guards the province the character stands in plus its immediate neighbours — he
  // rides out to any incursion adjacent to where he is now. (The old 7-province
  // centre-up-to-two-away zone is gone; Defend no longer takes a target.)
  const d = c._defend;
  if (!d || !d.active || !P) return false;
  if (P.id === c.location) return true; // already standing on it — nothing to react to
  const here = G.world.provinces[c.location];
  if (!here) return false;
  return getNeighborsP(here, G.world.cols, G.world.rows, G.world.provinces).some((n) => n && n.id === P.id);
}

export function runDefendReactions(turnContext, ph, intents) {
  const { G, movePoints, seaMovePoints, seaMoveActive, log, seaCap } = turnContext;
  // Runs at the DEFEND STEP — after the phase's non-moving orders, before any march — so an
  // invader who was killed, stripped of his column or thrown out of his province by one of those
  // orders is no longer a threat to ride out against.
  const invasions = [...intents.values()]
    .filter((...a) => isHostileInvasion(turnContext, ...a))
    .filter((inv) => inv.c && inv.c.alive && (inv.c.armies || []).length > 0 && inv.c.location === inv.fromId);
  if (!invasions.length) return;
  // Group incoming strength by target province.
  const threat = new Map();
  invasions.forEach((inv) => {
    const cur = threat.get(inv.toId) || { prov: inv.dest, str: 0, names: [], players: new Set() };
    cur.str += armyTotalStr(turnContext, inv.c, inv.dest);
    cur.names.push(inv.c.name);
    cur.players.add(inv.player);
    threat.set(inv.toId, cur);
  });

  (G.characters || []).forEach((c) => {
    if (!c.alive || c.player == null || !c._defend || !c._defend.active) return;
    if ((c.armies || []).length === 0) return; // only generals react
    if (c._defendReactedPhase === ph) return; // one reaction per phase
    if ((movePoints[c.id] ?? 0) <= 0 && (seaMovePoints[c.id] ?? 0) <= 0) return; // AK: reacting costs movement (land OR sea)
    const here = G.world.provinces[c.location];
    if (!here) return;
    // a defender FLOODED into a sea province is stranded — he can only ride out to a neighbour if
    // he can move by sea (a fleet, or an all-flying force). A land host on drowned ground stays
    // put; the Defend order must not let it march out over water it cannot cross.
    if (here.terrain === 'sea' && !(seaMoveActive[c.id] && (seaMovePoints[c.id] ?? 0) > 0)) {
      log(
        'move',
        `${c.name} is stranded by the waters covering ${here.name} — without a fleet their troops cannot march out, and hold what ground remains.`,
        { actor: c.player, targets: [c.player], provinceId: here.id, public: false, charId: c.id, phase: ph },
      );
      return;
    }

    // If his OWN province is under attack he stays and holds it — splitting a single stack
    // between two fronts isn't representable, so the garrison of the spot he stands on wins.
    if (threat.has(c.location)) {
      log(
        'move',
        `${c.name} holds ${here.name} rather than march to its neighbours — the enemy is already at this gate.`,
        { actor: c.player, targets: [c.player], provinceId: here.id, charId: c.id, phase: ph },
      );
      c._defendReactedPhase = ph; // holding his own gate IS his reaction — he will not also ride out to a host raised next door this phase
      return;
    }

    // Candidate provinces: invaded, his realm's, inside his reaction zone, terrain he can cross.
    const sc = seaCap[c.id] || 'land';
    const myStr = armyTotalStr(turnContext, c, here);
    const cands = [...threat.values()].filter((t) => {
      const P = t.prov;
      if (!P || P.owner !== c.player) return false;
      if (t.players.has(c.player)) return false; // not our own troops moving about
      if (!inDefendZone(turnContext, c, P)) return false;
      if (!canStepBetween(c, here, P, sc)) return false; // AK: a fleet can't march inland; ships never cross land (item 14)
      return true;
    });
    if (!cands.length) return;
    if (defendBattleLocked(turnContext, c, here)) {
      log(
        'move',
        `${c.name} is still locked in the unresolved battle for ${here.name} and cannot ride out to ${cands[0].prov.name} — the fight here must be seen through first.`,
        { actor: c.player, targets: [c.player], provinceId: here.id, public: false, charId: c.id, phase: ph },
      );
      return;
    }

    // a general on Defend rides out to meet ANY incursion in his watch, however heavy — a player
    // may want to force a battle purely to slow an opponent down. He answers the heaviest threat
    // within reach; myStr is no longer a gate (kept only for the sort tie-break flavour where
    // several threats are equal).
    cands.sort((a, b) => b.str - a.str);
    const target = cands[0];
    if (!target) return;

    // March to the aid of the invaded province.
    const P = target.prov;
    // Use the correct movement pool: leaving OR entering a sea province is a sea move (needs a
    // fleet); otherwise it's a land march. (The stranded guard above already blocked a fleetless
    // land host on drowned ground.)
    const _bySea = here.terrain === 'sea' || P.terrain === 'sea';
    if (_bySea) {
      if ((seaMovePoints[c.id] ?? 0) <= 0) return;
    } else {
      if ((movePoints[c.id] ?? 0) <= 0) return;
    }
    here.characters = (here.characters || []).filter((id) => id !== c.id);
    P.characters = P.characters || [];
    if (!P.characters.includes(c.id)) P.characters.push(c.id);
    c.location = P.id;
    c.locationName = P.name;
    if (_bySea) {
      seaMovePoints[c.id] = Math.max(0, (seaMovePoints[c.id] ?? 0) - 1);
    } else {
      movePoints[c.id] = Math.max(0, (movePoints[c.id] ?? 0) - 1);
    }
    c._defendReactedPhase = ph;
    c._attackedFrom = here.id;
    c._defendRideOut = { ph, provId: P.id, fromId: here.id, names: target.names.slice() }; // reconciled at the end of the phase
    log(
      'move',
      `🛡 ${c.name} is standing watch — word reaches them that ${target.names.join(' and ')} ${target.names.length > 1 ? 'are' : 'is'} crossing into ${P.name}. They break camp at once and march to meet the threat.`,
      { actor: c.player, targets: [c.player], provinceId: P.id, public: true, charId: c.id, phase: ph },
    ); // 2026-09-09 item 1: runs OUTSIDE any order context, so file it explicitly
    // Reacting is a march: the same skill gain a normal move would give (a sea crossing trains Naval).
    if (_bySea) rollNavalVoyage(turnContext, c, SKILLGAIN_COMMON);
    else trySkillGain(turnContext, c, 'march', SKILLGAIN_COMMON);
  });
}

// ── 2026-09-18: DEFEND RIDE-OUT RECONCILIATION ────
// A general who rode out this phase to meet an invasion is checked once every order has resolved.
// If no battle was fought in the province he rode to (the invader's march was refused — no
// movement, a blocked crossing, a border turned back — or the column slipped past, or was
// veiled), the player is told so in the general's own section, instead of a "march to meet the
// threat" line followed by silence. battleCommanders is keyed prov@phase and records both sides
// of every PvP battle, so it is the authoritative "did a battle happen here with him in it" test.
export function reconcileDefendRideOuts(turnContext, ph) {
  const { G, battleCommanders, log } = turnContext;
  (G.characters || []).forEach((c) => {
    const r = c._defendRideOut;
    if (!r) return;
    if (r.ph !== ph) {
      delete c._defendRideOut;
      return;
    }
    delete c._defendRideOut;
    if (!c.alive || c.player == null) return;
    // Any PvP battle in that province this phase counts — a defender there with troops fights in
    // it whether as the recorded commander or as a pooled reinforcement (only the leader's id is
    // recorded).
    const fought = (battleCommanders[r.provId + '@' + ph] || []).length > 0;
    if (fought) return;
    const P = G.world.provinces[r.provId];
    if (!P) return;
    const enemyHere = (G.characters || []).some(
      (e) =>
        e &&
        e.alive &&
        e.player != null &&
        e.player !== c.player &&
        areEnemies(turnContext, c.player, e.player) &&
        e.location === P.id &&
        (e.armies || []).length > 0 &&
        !isVeiled(turnContext, e),
    );
    if (c.location === P.id && !enemyHere) {
      log(
        'move',
        `🛡 ${c.name} reaches ${P.name} in battle order, but ${r.names.join(' and ')} never crossed the border — no battle is fought, and they hold ${P.name} for the rest of the season.`,
        { actor: c.player, targets: [c.player], provinceId: P.id, public: false, charId: c.id, phase: ph },
      );
    } else if (c.location === P.id && enemyHere) {
      log(
        'move',
        `🛡 ${c.name} stands in ${P.name} facing an enemy column, but no battle was joined this season — the contest will be settled next phase.`,
        { actor: c.player, targets: [c.player], provinceId: P.id, public: false, charId: c.id, phase: ph },
      );
    }
  });
}

// A general whose own province holds an unresolved battle (an armed hostile still stands there) is
// pinned exactly as a Move would be — the Defend watch is not a way out of a fight.
export function defendBattleLocked(turnContext, c, here) {
  const { G } = turnContext;
  if (!here || !here._battleUnresolved) return false;
  return (G.characters || []).some(
    (e) =>
      e &&
      e.id !== c.id &&
      (e.alive || e._leaderlessHost) &&
      e.location === here.id &&
      (e.armies || []).length > 0 &&
      (e.player === null || (e.player !== c.player && areEnemies(turnContext, c.player, e.player))),
  );
}

// ── DEFEND answers a host RAISED or SUMMONED in the watch — before it can take the ground ────
// Called from resolveUnitGainInProvince the moment an enemy character gains units (Skeletal
// Armies, Elemental Summon, Control Undead, Dominate, Bind Wraith, Wild Calling, mercenaries, a
// rite, …) inside a province owned by a realm they are at war with. Every general of the OWNING
// realm who is on Defend in an adjacent province, has not yet reacted this phase, has a movement
// point of the right kind and can cross the terrain marches in AT ONCE. He is then standing in
// the province when resolveUnitGainInProvince counts the defenders, so the new host must beat
// him (with the garrison at his side and the defender's edge) to take the ground. This replaces
// the old sequence — province falls unopposed, general rides out after every order to retake it
// as the ATTACKER. runDefendMaterializedReactions remains as the end-of-phase safety net.
// Returns the generals who rode in.
export function defendAnswerUnitGain(turnContext, raiser, prov, ph, dryRun) {
  const { G, seaCap, seaMoveActive, seaMovePoints, movePoints, log } = turnContext;
  const riders = [];
  if (!raiser || !prov || prov.owner == null || prov.owner === raiser.player) return riders;
  if (!areEnemies(turnContext, raiser.player, prov.owner)) return riders;
  if (isVeiled(turnContext, raiser)) return riders; // a veiled host cannot be found to be fought
  (G.characters || []).forEach((d) => {
    if (!d || !d.alive || d.player !== prov.owner || !d._defend || !d._defend.active) return;
    if ((d.armies || []).length === 0) return; // only generals ride out
    if (d.location === prov.id || d.location == null) return; // already here — he is a defender anyway
    if (d._defendReactedPhase === ph) return; // one reaction per phase
    if (d._mercyFledTurn === G.turn) return;
    const here = G.world.provinces[d.location];
    if (!here) return;
    if (!getNeighborsP(here, G.world.cols, G.world.rows, G.world.provinces).some((n) => n && n.id === prov.id)) return;
    if (defendBattleLocked(turnContext, d, here)) return;
    const sc = seaCap[d.id] || 'land';
    if (!canStepBetween(d, here, prov, sc)) return; // item 14: ships never cross land
    const bySea = here.terrain === 'sea' || prov.terrain === 'sea';
    if (here.terrain === 'sea' && !(seaMoveActive[d.id] && (seaMovePoints[d.id] ?? 0) > 0)) return; // stranded on drowned ground
    if (bySea) {
      if ((seaMovePoints[d.id] ?? 0) <= 0) return;
    } else {
      if ((movePoints[d.id] ?? 0) <= 0) return;
    }
    if (dryRun) {
      riders.push(d);
      return;
    } // "would he answer?" — nothing is moved or spent
    if (bySea) seaMovePoints[d.id]--;
    else movePoints[d.id]--;
    here.characters = (here.characters || []).filter((id) => id !== d.id);
    prov.characters = prov.characters || [];
    if (!prov.characters.includes(d.id)) prov.characters.push(d.id);
    d.location = prov.id;
    d.locationName = prov.name;
    d._attackedFrom = here.id;
    d._defendReactedPhase = ph;
    if (!prov.visitedBy) prov.visitedBy = [];
    if (!prov.visitedBy.includes(d.player)) prov.visitedBy.push(d.player);
    log(
      'move',
      `🛡 ${d.name} is standing watch — word reaches them that ${raiser.name}${realmTag(turnContext, raiser.player)} ${raiser._warFront ? 'is turning the host camped inside ' + prov.name + ' on the province' : 'is gathering a host inside ' + prov.name}. They break camp at once and reach ${prov.name} before it can be seized, drawing up to defend it.`,
      { actor: d.player, targets: [d.player], provinceId: prov.id, public: true, charId: d.id, phase: ph },
    );
    if (bySea) rollNavalVoyage(turnContext, d, SKILLGAIN_STD);
    else trySkillGain(turnContext, d, 'march', SKILLGAIN_COMMON);
    riders.push(d);
  });
  return riders;
}

// ── DEFEND vs a force that MATERIALISES in the watch zone ────
// runDefendReactions (above) only answers MOVE invasions, resolved in the pre-phase pass. But an
// enemy force can APPEAR inside a defender's watch this phase without marching in — raised
// skeletons, a summoned elemental, Dominated-in-place troops, an Awakened grove, a Phantom Host.
// This pass runs AFTER every order in the phase has resolved (so every such force now exists) and
// lets a general on Defend ride out to give battle, exactly as if the enemy had invaded. A
// defender who already reacted this phase, or who has no move left, holds. Mirrors the both-armed
// pursuit battle so casualties, routs and conquest all resolve through the one combat path.
export function runDefendMaterializedReactions(turnContext, ph) {
  const { G, movePoints, seaMovePoints, seaMoveActive, log, seaCap } = turnContext;
  (G.characters || []).forEach((c) => {
    if (!c.alive || c.player == null || !c._defend || !c._defend.active) return;
    if ((c.armies || []).length === 0) return; // only generals ride out
    if (c._defendReactedPhase === ph) return; // one reaction per phase
    if ((movePoints[c.id] ?? 0) <= 0 && (seaMovePoints[c.id] ?? 0) <= 0) return;
    const here = G.world.provinces[c.location];
    if (!here) return;
    // a defender flooded into a sea province cannot ride out unless he can move by sea.
    if (here.terrain === 'sea' && !(seaMoveActive[c.id] && (seaMovePoints[c.id] ?? 0) > 0)) {
      log(
        'move',
        `${c.name} is stranded by the waters covering ${here.name} — without a fleet their troops cannot march out, and hold what ground remains.`,
        { actor: c.player, targets: [c.player], provinceId: here.id, public: false, charId: c.id, phase: ph },
      );
      return;
    }
    const sc = seaCap[c.id] || 'land';
    if (defendBattleLocked(turnContext, c, here)) return; // pinned by an unresolved battle where he stands
    // Watch zone: the province he stands on plus its immediate neighbours.
    const zone = [here, ...getNeighborsP(here, G.world.cols, G.world.rows, G.world.provinces)].filter(Boolean);
    // Find the heaviest enemy force (a character leading armies) standing anywhere in the zone.
    let best = null;
    for (const P of zone) {
      if (P._battleUnresolved) continue; // already contested — that battle series is tracked and resumes next phase
      // a general on Defend only rides out to fight in ADJACENT provinces HE CONTROLS — never
      // into a neutral province or one another player holds. (A force that materialises in the
      // very province he stands on is still met where he stands.) Item 4: …or one that was HIS
      // until an enemy force materialised in it this very phase (Skeletal Armies, Summon
      // Elemental, …) and took it unopposed — he rides out to win it back.
      const _justTaken = !!(
        P._takenByUnitGain &&
        P._takenByUnitGain.turn === G.turn &&
        P._takenByUnitGain.ph === ph &&
        P._takenByUnitGain.from === c.player
      );
      if (P.id !== c.location && P.owner !== c.player && !_justTaken) continue;
      const foes = (G.characters || []).filter(
        (e) =>
          e &&
          e.alive &&
          e.player != null &&
          areEnemies(turnContext, c.player, e.player) &&
          e.location === P.id &&
          (e.armies || []).length > 0,
      );
      if (!foes.length) continue;
      if (P.id !== c.location && !canStepBetween(c, here, P, sc)) continue; // a fleet can't march inland; ships never cross land (item 14)
      const str = foes.reduce((s, e) => s + armyTotalStr(turnContext, e, P), 0);
      if (!best || str > best.str) best = { P, foes, str };
    }
    if (!best) return;
    const prov = best.P;
    const _metWhereHeStood = prov.id === c.location; // no march — the "moves into" battle line would be false
    // March to meet them if they are in a neighbour (costs one movement point of the right kind).
    if (prov.id !== c.location) {
      const toSea = prov.terrain === 'sea' || here.terrain === 'sea'; // leaving OR entering water = a sea move
      if (toSea) {
        if ((seaMovePoints[c.id] ?? 0) <= 0) return;
        seaMovePoints[c.id]--;
      } else {
        if ((movePoints[c.id] ?? 0) <= 0) return;
        movePoints[c.id]--;
      }
      here.characters = (here.characters || []).filter((id) => id !== c.id);
      prov.characters = prov.characters || [];
      if (!prov.characters.includes(c.id)) prov.characters.push(c.id);
      c.location = prov.id;
      c.locationName = prov.name;
      c._attackedFrom = here.id;
      if (!prov.visitedBy) prov.visitedBy = [];
      if (!prov.visitedBy.includes(c.player)) prov.visitedBy.push(c.player);
      log(
        'move',
        `🛡 ${c.name} stands watch — word comes that an enemy host has risen in ${prov.name}. They break camp and march to meet it.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id, public: true, charId: c.id, phase: ph },
      );
      if (toSea) rollNavalVoyage(turnContext, c, SKILLGAIN_COMMON);
      else trySkillGain(turnContext, c, 'march', SKILLGAIN_COMMON);
    } else {
      log(
        'move',
        `🛡 ${c.name} stands watch as an enemy host takes shape in ${prov.name} — they form their line to give battle.`,
        { actor: c.player, targets: [c.player], provinceId: prov.id, public: true, charId: c.id, phase: ph },
      );
    }
    c._defendReactedPhase = ph;
    // Force the battle: c attacks the heaviest enemy force here; the rest unify behind it (as in
    // any battle / the both-armed pursuit). Fight on pooled copies, then write casualties + routs
    // back.
    const quarry = best.foes
      .slice()
      .sort((a, b) => armyTotalStr(turnContext, b, prov) - armyTotalStr(turnContext, a, prov))[0];
    const defReinf = best.foes.filter((d) => d.id !== quarry.id);
    const combinedAtk = { ...c, armies: [...(c.armies || [])] };
    if (_metWhereHeStood) {
      combinedAtk._resumeBattle = true;
      combinedAtk._openingClash = true;
    } // already there: no move-in line, and not a carry-on round
    const _hPooled = [...(quarry.armies || []), ...defReinf.flatMap((d) => d.armies || [])];
    const _hP = pickBattleCommander(turnContext, quarry, defReinf, _hPooled, prov, false); // best defender commands
    const combinedDef = { ..._hP.leader, armies: _hPooled };
    const targetsPi = [c.player, quarry.player].filter((x) => x != null);
    log('combat', `⚔ ${c.name} falls upon ${quarry.name}'s host in ${prov.name}!`, {
      actor: c.player,
      targets: targetsPi,
      provinceId: prov.id,
      public: true,
      charIds: [c.id, quarry.id, ...defReinf.map((d) => d.id)],
      phase: ph,
    });
    if (_hP.changed)
      log('combat', commandHandoverLine(_hP.leader, quarry, prov.name), {
        actor: quarry.player,
        targets: targetsPi,
        provinceId: prov.id,
        public: true,
      });
    const battle = combatVsChar(turnContext, combinedAtk, combinedDef, prov);
    syncLeaderCopy(turnContext, _hP.leader, combinedDef);
    creditBattle(turnContext, c, _hP.leader, battle, prov);
    emitBattle(turnContext, battle, prov, ph, targetsPi, {
      actor: c.player,
      charIds: [c.id, quarry.id, ...defReinf.map((d) => d.id)],
    }); // item 5; 2026-09-09 item 1
    c.armies = (c.armies || []).filter((a) => !a._died && !a._disbanded);
    [quarry, ...defReinf].forEach((d) => {
      d.armies = (d.armies || []).filter((a) => !a._died && !a._disbanded);
    });
    if (combinedAtk.location !== c.location) {
      c.location = combinedAtk.location;
      const np = G.world.provinces[c.location];
      if (np) c.locationName = np.name;
    }
    if (combinedDef.location !== _hP.leader.location || combinedDef.location !== quarry.location) {
      const np = G.world.provinces[combinedDef.location];
      if (quarry.alive) {
        quarry.location = combinedDef.location;
        if (np) quarry.locationName = np.name;
      } // a slain commander stays where they fell
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
    // if the defender won and no armed enemy remains, the province is his again (a spell-conquest
    // is undone the same phase it was made).
    if (
      battle &&
      battle.won &&
      c.alive &&
      c.location === prov.id &&
      prov.owner !== c.player &&
      !prov._battleUnresolved
    ) {
      const _enemyLeft = (G.characters || []).some(
        (e) =>
          e &&
          (e.alive || e._leaderlessHost) &&
          e.location === prov.id &&
          (e.armies || []).length > 0 &&
          e.player != null &&
          e.player !== c.player &&
          areEnemies(turnContext, c.player, e.player),
      );
      if (!_enemyLeft) {
        G.players.forEach((p, pi) => {
          if (pi !== c.player) {
            const i = (p.provinces || []).indexOf(prov.id);
            if (i > -1) p.provinces.splice(i, 1);
          }
        });
        setProvinceOwner(turnContext, prov, c.player, c, ph);
        const wp = G.players[c.player];
        if (wp && !wp.provinces.includes(prov.id)) wp.provinces.push(prov.id);
        if (wp) applyEvilConquest(turnContext, c, prov, wp); // Evil doctrine on this capture path (was skipped)
        delete prov._takenByUnitGain;
        log(
          'combat',
          `${c.name} drives the interlopers out and secures ${prov.name} for ${wp ? wp.name : 'their realm'}!`,
          { actor: c.player, targets: [], provinceId: prov.id, public: true },
        );
      }
    }
    turnContext._combatSkillProv = null; // this reaction's battle series is closed
  });
}

// ── LONE DEFENDER AMBUSH ────
// A character on Defend who leads NO armies cannot ride out to fight a battle (the two passes
// above require a column). Instead he lies in wait: any enemy character who MARCHES into the
// province he holds — or one immediately adjacent — may be intercepted and forced into a personal
// battle. The chance of springing the ambush scales with his Spy skill (a scout's craft), and is
// halved against a target at the head of an army (harder to catch a well-guarded commander
// alone). Runs after every order and after the armed Defend reactions, so all of this phase's
// movers are already in place.
export function runDefendAmbush(turnContext, ph) {
  const { G, log } = turnContext;
  (G.characters || []).forEach((c) => {
    if (!c.alive || c.player == null || !c._defend || !c._defend.active) return;
    if ((c.armies || []).length > 0) return; // ONLY lone characters ambush (armed ones ride out above)
    if (c._defendReactedPhase === ph) return; // one reaction per phase
    if (c._encounteredThisPhase != null) return; // already in a personal fight this phase
    const here = G.world.provinces[c.location];
    if (!here) return;
    // Watch zone: the province he stands on plus its immediate neighbours.
    const zoneIds = new Set([
      here.id,
      ...getNeighborsP(here, G.world.cols, G.world.rows, G.world.provinces)
        .filter(Boolean)
        .map((p) => p.id),
    ]);
    // Candidate quarry: an ENEMY character who entered the zone THIS phase (an incursion), is not
    // cloaked, and has not already fought a personal action this phase. A wandering/neutral hero
    // (player==null) is never an "enemy character" and is left alone.
    const foes = (G.characters || []).filter((e) => {
      if (!e || !e.alive || e.player == null || e.id === c.id) return false;
      if (!areEnemies(turnContext, c.player, e.player)) return false;
      if (e.location == null || !zoneIds.has(e.location)) return false;
      if (e._enteredProvThisPhase !== e.location) return false; // must have MARCHED IN this phase (a real incursion)
      if (e._encounteredThisPhase != null) return false;
      if (e._vanishTurn === G.turn) return false; // THIEF L9 Vanish: no ambush lands on a vanished quarry
      if (e.isKing && !c.isKing) return false; // a crowned head is not waylaid by a lone hero — only a king may ambush a king
      if (isHiddenChar(turnContext, e)) return false; // Cloak of Many Faces & the like leave no trail
      return true;
    });
    if (!foes.length) return;
    // Prefer the highest-value quarry: a king first, then the heaviest column, then the strongest
    // man.
    foes.sort(
      (a, b) =>
        (b.isKing ? 1 : 0) - (a.isKing ? 1 : 0) ||
        armyTotalStr(turnContext, b, G.world.provinces[b.location]) -
          armyTotalStr(turnContext, a, G.world.provinces[a.location]) ||
        effStat(turnContext, b, 'melee') - effStat(turnContext, a, 'melee'),
    );
    const quarry = foes[0];
    const quarryProv = G.world.provinces[quarry.location];
    if (!quarryProv) return;
    // Spy-scaled ambush chance. Base 10% + 9%/Spy level (a master scout ~90%). Halved against a
    // commander leading an army — his guards make a lone strike far harder to land.
    const spy = effStat(turnContext, c, 'spy');
    let chance = Math.min(90, 10 + spy * 9);
    const guarded = (quarry.armies || []).length > 0;
    if (guarded) chance = Math.floor(chance / 2);
    const roll = d100();
    const targetsPi = [c.player, quarry.player].filter((x) => x != null);
    log(
      'system',
      `📊 Ambush — ${c.name} (Spy ${spy}) lies in wait for ${quarry.name}${guarded ? ' (guarded — halved)' : ''}: ${fmtRoll(chance, roll)}`,
      { actor: c.player, targets: [c.player], provinceId: quarryProv.id },
    );
    if (roll > chance) {
      log(
        'move',
        `${c.name} watches ${quarry.name} pass through ${quarryProv.name} but cannot find the opening to strike.`,
        { actor: c.player, targets: [c.player], provinceId: quarryProv.id },
      );
      c._defendReactedPhase = ph; // the attempt spends his watch for this phase
      return;
    }
    // Sprung. Close on the quarry (into a neighbour if need be — a lone scout crosses freely) and
    // force the personal battle. A forced ambush overrides the "a king won't stoop to a
    // challenge" and "a commander won't break ranks" refusals of a chosen duel: he is set upon,
    // not challenged.
    if (quarry.location !== c.location) {
      here.characters = (here.characters || []).filter((id) => id !== c.id);
      quarryProv.characters = quarryProv.characters || [];
      if (!quarryProv.characters.includes(c.id)) quarryProv.characters.push(c.id);
      c.location = quarryProv.id;
      c.locationName = quarryProv.name;
      if (!quarryProv.visitedBy) quarryProv.visitedBy = [];
      if (!quarryProv.visitedBy.includes(c.player)) quarryProv.visitedBy.push(c.player);
    }
    const prov = quarryProv;
    const COMBAT_ONLY = COMBAT_ONLY_TACTICS;
    const filterPlan = (plan) =>
      ((plan && plan.tactics) || ['ME']).filter(
        (t) => COMBAT_ONLY.has(String(t).split(':')[0].toUpperCase()) || String(t).toUpperCase().startsWith('CA:'),
      );
    ensureEncounterPlan(turnContext, c);
    ensureEncounterPlan(turnContext, quarry);
    const atkPlan = filterPlan(c.encounterPlan);
    if (!atkPlan.length) atkPlan.push('ME');
    const defPlan = filterPlan(quarry.encounterPlan);
    if (!defPlan.length) defPlan.push('ME');
    const _duelChars = [c.id, quarry.id];
    log('combat', `⚔ ${c.name} springs from cover and sets upon ${quarry.name} in ${prov.name}!`, {
      actor: c.player,
      targets: targetsPi,
      provinceId: prov.id,
      public: prov.owner !== null,
      charIds: _duelChars,
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
      emitNarrLine(turnContext, 'combat', line, {
        actor: c.player,
        targets: targetsPi,
        provinceId: prov.id,
        charIds: _duelChars,
      }),
    );
    c.hp = Math.max(1, enc.atkHp);
    if (quarry.player !== null) quarry.hp = Math.max(1, enc.defHp);
    if (enc.atkKilled || enc.atkHp <= 0) {
      if (_escapesTheEnd(c)) {
        if (c.hp != null && c.hp <= 0) c.hp = 1;
        log('combat', _garrethEscapeLine(c), {
          actor: c.player,
          targets: targetsPi,
          provinceId: prov.id,
          public: true,
          charIds: _duelChars,
        });
      } else {
        reportHeroFall(turnContext, c, quarry, `${c.name} is cut down in the ambush they laid!`, {
          actor: c.player,
          targets: targetsPi,
          provinceId: prov.id,
          public: true,
          charIds: _duelChars,
        });
        awardKillXP(turnContext, quarry, c);
      }
    }
    if (enc.defKilled || enc.defHp <= 0) {
      if (_escapesTheEnd(quarry)) {
        if (quarry.hp != null && quarry.hp <= 0) quarry.hp = 1;
        log('combat', _garrethEscapeLine(quarry), {
          actor: c.player,
          targets: targetsPi,
          provinceId: prov.id,
          public: true,
          charIds: _duelChars,
        });
      } else {
        reportHeroFall(turnContext, quarry, c, `${quarry.name} is struck down in the ambush!`, {
          actor: c.player,
          targets: targetsPi,
          provinceId: prov.id,
          public: true,
          charIds: _duelChars,
        });
        awardKillXP(turnContext, c, quarry);
      }
    }
    trySkillGain(turnContext, c, 'spy', SKILLGAIN_STD); // a sprung ambush hones the scout's craft
    c._encounteredThisPhase = quarry.id;
    quarry._encounteredThisPhase = c.id;
    c._defendReactedPhase = ph;
    if (c.alive) completeDefendWatches(turnContext, [c.id]); // item 15: the ambush was this watch's fight
    // NOTE: an ambush is a PERSONAL duel (no armies), not a field battle — it must NOT set
    // _hadBattleThisTurn. That flag drives the map's crossed-swords marker, which is for ARMY
    // battles only; a duel here was painting swords on provinces where no battle was fought.
    turnContext._combatSkillProv = null;
  });
}
// Since he was ordered there before anyone knew what the enemy would do, he is walked in during
// this pre-pass and is standing in the line when the invader arrives.
//
// NOTE: this covers defenders arriving in time. Full end-of-phase battle resolution (one battle
// per province, after every order in the phase) is NOT implemented — see DEV_LOG "flagged /
// open".
export function runReinforcementArrivals(turnContext, ph, intents) {
  const { seaCap, G, seaMovePoints, movePoints, log } = turnContext;
  const invasions = [...intents.values()].filter((...a) => isHostileInvasion(turnContext, ...a));
  if (!invasions.length) return;
  const cmp = phaseInitCompare(turnContext, ph);
  const invadedProvIds = new Set(invasions.map((i) => i.toId));

  [...intents.values()].forEach((it) => {
    if (!it.c || it.c.alive === false) return; // 2026-09-21: `intents` is the STAGE-1 snapshot — never march a commander who has since fallen
    if (it.cancelled || it.action !== 'move' || !it.leadsArmy || !it.dest) return;
    const P = it.dest;
    if (!invadedProvIds.has(P.id)) return;
    if (P.owner !== it.player) return; // only reinforcing your OWN ground
    // Is he already going to beat the invader there under plain initiative? Then leave him be.
    const racers = invasions.filter((inv) => inv.toId === P.id && inv.player !== it.player);
    if (!racers.length) return;
    if (racers.every((inv) => cmp(it.c, inv.c) < 0)) return; // he's faster than all of them anyway
    // Terrain and movement must still allow the march.
    const sc = seaCap[it.id] || 'land';
    if (!canStepBetween(it.c, G.world.provinces[it.fromId], P, sc)) return; // item 14: ships never cross land
    const toSea = P.terrain === 'sea';
    const pool = toSea ? seaMovePoints : movePoints;
    if ((pool[it.id] ?? 0) <= 0) return;

    const from = G.world.provinces[it.fromId];
    pool[it.id] = Math.max(0, (pool[it.id] ?? 0) - 1);
    if (from) from.characters = (from.characters || []).filter((id) => id !== it.id);
    P.characters = P.characters || [];
    if (!P.characters.includes(it.id)) P.characters.push(it.id);
    it.c.location = P.id;
    it.c.locationName = P.name;
    it.c._attackedFrom = it.fromId;
    if (!P.visitedBy) P.visitedBy = [];
    if (!P.visitedBy.includes(it.player)) P.visitedBy.push(it.player);
    if (!toSea) trySkillGain(turnContext, it.c, 'march', SKILLGAIN_COMMON);
    else rollNavalVoyage(turnContext, it.c, SKILLGAIN_STD);
    it.cancelled = true;
    it.cancelReason = 'reinforced';
    log(
      'move',
      `${it.c.name} force-marches into ${P.name} ahead of the enemy — their troops are in the line before the first banners appear over the ridge.`,
      { actor: it.player, targets: [it.player], provinceId: P.id },
    );
  });
}
