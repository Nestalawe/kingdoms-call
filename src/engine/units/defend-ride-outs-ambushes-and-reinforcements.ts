import { COMBAT_ONLY_TACTICS } from '../army-tables.ts';
import { _escapesTheEnd, _garrethEscapeLine } from '../names.ts';
import { d100, rng } from '../dice-and-army-names.ts';
import { markProvinceCombat } from '../bots/intel.ts';
import { getNeighborsP } from '../world/map-helpers.ts';
import { theNameOfAPlayersRealm } from '../turn/log-line-helpers.ts';
import {
  emit,
  emitNarrLine,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../turn/events-and-their-audiences.ts';
import { completeDefendWatches } from '../turn/mercenary-ids-and-battle-records.ts';
import { applyEvilConquest, areEnemies, setProvinceOwner } from '../realms/relations-and-captures.ts';
import { creditBattle } from '../titles/title-holders-and-battle-merit.ts';
import {
  effStat,
  isHiddenByInvisibilityFrom,
  isHiddenChar,
  isVeiled,
} from '../heroes/effective-skills-and-hidden-heroes.ts';
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
import { asItsGuardReadsIt } from '../rules-on-plain-values/a-guarded-value-read-as-it-is-and-a-skill-held-above-nothing.ts';
import type { AHeroAsAHostGainedHasHim } from '../battle/hosts-gained-in-a-province.ts';
import type { APhaseIntent, ThePhasesIntents } from '../turn/phase-intents-and-dependency-ordering.ts';
import type { ArmyInABattle, HeroInABattle } from '../army-tables.ts';
import type { Character, Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';

/** A ride-out a general made this phase, reconciled once every order has resolved: its phase, the province he rode
 *  to and the one he rode from, and the invaders' names. */
interface ARideOut {
  readonly ph: number;
  readonly provId: number;
  readonly fromId: number;
  readonly names: readonly string[];
}
/** A hero on the watch as its passes read and mark him: a hero of a battle, his ride-out this phase (the turn's mark,
 *  which the reconciliation deletes) and a war front's mark. */
type AHeroOnTheWatch = AHeroAsAHostGainedHasHim & { _defendRideOut?: ARideOut };
/** The province an invasion marches into: isHostileInvasion holds only for a march that has one; for none, a
 *  TypeError, as reading its terrain threw. */
function theProvinceInvaded(inv: APhaseIntent): Province {
  if (!inv.dest) throw new TypeError("Cannot read properties of null (reading 'terrain')");
  return inv.dest;
}
/** The province a hero stands in, as the ambush's sort reads it for a foe it found there: for none, the TypeError
 *  reading its terrain threw. */
function theProvinceHeStandsIn(G: TurnContext['G'], hero: Pick<Character, 'location'>): Province {
  const prov = G.world.provinces[hero.location];
  if (!prov) throw new TypeError("Cannot read properties of undefined (reading 'terrain')");
  return prov;
}
/** A hero on the watch who serves a realm (`c.player != null`), as the realm's conquest reads him (applyEvilConquest).
 *  Written here, not taken from the hosts gained, whose file reads this one. */
function aHeroOfAWatchingRealm(h: HeroInABattle): h is HeroInABattle & { readonly player: number } {
  return h.player != null;
}
/** The commander pickBattleCommander picks for the host in the watch: the heaviest foe it is handed or one of the foes
 *  beside him, so there is one; for none, a TypeError. */
function theHostsCommander(leader: HeroInABattle | null | undefined): HeroInABattle {
  if (!leader) throw new TypeError('pickBattleCommander picked no commander');
  return leader;
}
/** Whether a hero lives, read again after the calls since the test that narrowed it (a battle or a fight may slay
 *  him): the compiler keeps a test's narrowing across a call. */
function whetherHeLivesNow(hero: Pick<Character, 'alive'>): boolean {
  return hero.alive;
}
/** The columns marching on one province: the province, their strength, their heroes' names and their realms. */
interface TheThreatToAProvince {
  readonly prov: Province | null | undefined;
  str: number;
  readonly names: string[];
  readonly players: Set<number | null>;
}

// ── THE DEFEND WATCH: RIDE-OUTS, AMBUSHES AND REINFORCEMENTS (plan P1-08i2: lifted out of resolveTurn) ────
// What a hero on a Defend order does while he keeps watch, each phase: a general rides out to meet an enemy column
// marching into a neighbouring province of his realm (runDefendReactions, before the marches), or a host raised or
// summoned there (defendAnswerUnitGain, the moment it appears; runDefendMaterializedReactions, after every order), and
// is told when no battle came of it (reconcileDefendRideOuts); a hero with no troops lies in wait to ambush an enemy
// who marches in (runDefendAmbush); and a column already marching to its own invaded province is hurried in ahead of
// the invader (runReinforcementArrivals). resolveTurn's phase loop calls them, and resolveUnitGainInProvince calls
// defendAnswerUnitGain. They take the turn's context first (src/engine/turn/context.ts). Each line they write is a fact
// (since P1-12d14: the-facts-the-defend-watchs-lines-record.ts), its words written in the views.
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
export function inDefendZone(
  turnContext: Pick<TurnContext, 'G'>,
  c: Pick<Character, '_defend' | 'location'>,
  P: Pick<Province, 'id'> | null | undefined,
): boolean {
  const { G } = turnContext;
  // the watch guards the province the character stands in plus its immediate neighbours — he
  // rides out to any incursion adjacent to where he is now. (The old 7-province
  // centre-up-to-two-away zone is gone; Defend no longer takes a target.)
  const d = c._defend;
  if (!d?.active || !P) return false;
  if (P.id === c.location) return true; // already standing on it — nothing to react to
  const here = G.world.provinces[c.location];
  if (!here) return false;
  return getNeighborsP(here, G.world.cols, G.world.rows, G.world.provinces).some((n) => n.id === P.id);
}

export function runDefendReactions(turnContext: TurnContext, ph: number, intents: ThePhasesIntents): void {
  const { G, movePoints, seaMovePoints, seaMoveActive, seaCap } = turnContext;
  // Runs at the DEFEND STEP — after the phase's non-moving orders, before any march — so an
  // invader who was killed, stripped of his column or thrown out of his province by one of those
  // orders is no longer a threat to ride out against.
  const invasions = [...intents.values()]
    .filter((it) => isHostileInvasion(turnContext, it))
    .filter((inv) => {
      const invader = asItsGuardReadsIt(inv.c);
      return invader?.alive && (asItsGuardReadsIt(invader.armies) ?? []).length > 0 && invader.location === inv.fromId;
    });
  if (!invasions.length) return;
  // Group incoming strength by target province.
  const threat = new Map<number | null, TheThreatToAProvince>();
  invasions.forEach((inv) => {
    const cur = threat.get(inv.toId) ?? { prov: inv.dest, str: 0, names: [], players: new Set<number | null>() };
    cur.str += armyTotalStr(turnContext, inv.c, theProvinceInvaded(inv));
    cur.names.push(inv.c.name);
    cur.players.add(inv.player);
    threat.set(inv.toId, cur);
  });

  (asItsGuardReadsIt(G.characters) ?? []).forEach((c: AHeroOnTheWatch) => {
    if (!c.alive || c.player == null || !c._defend?.active) return;
    if ((asItsGuardReadsIt(c.armies) ?? []).length === 0) return; // only generals react
    if (c._defendReactedPhase === ph) return; // one reaction per phase
    if ((movePoints[c.id] ?? 0) <= 0 && (seaMovePoints[c.id] ?? 0) <= 0) return; // AK: reacting costs movement (land OR sea)
    const here = G.world.provinces[c.location];
    if (!here) return;
    // a defender FLOODED into a sea province is stranded — he can only ride out to a neighbour if
    // he can move by sea (a fleet, or an all-flying force). A land host on drowned ground stays
    // put; the Defend order must not let it march out over water it cannot cross.
    if (here.terrain === 'sea' && !(seaMoveActive[c.id] && (seaMovePoints[c.id] ?? 0) > 0)) {
      emit(turnContext, {
        type: 'move',
        fact: {
          kind: 'a defender on drowned ground is stranded and cannot ride out',
          heroName: c.name,
          provinceName: here.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        province: here.id,
        hero: c.id,
        phase: ph,
      });
      return;
    }

    // If his OWN province is under attack he stays and holds it — splitting a single stack
    // between two fronts isn't representable, so the garrison of the spot he stands on wins.
    if (threat.has(c.location)) {
      emit(turnContext, {
        type: 'move',
        fact: {
          kind: 'a defender holds his own province with the enemy at its gate',
          heroName: c.name,
          provinceName: here.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        province: here.id,
        hero: c.id,
        phase: ph,
      });
      c._defendReactedPhase = ph; // holding his own gate IS his reaction — he will not also ride out to a host raised next door this phase
      return;
    }

    // Candidate provinces: invaded, his realm's, inside his reaction zone, terrain he can cross.
    const sc = (seaCap[c.id] ?? '') || 'land';
    armyTotalStr(turnContext, c, here); // his own strength, worked out and read by nothing (below)
    const cands = [...threat.values()].filter((t): t is TheThreatToAProvince & { readonly prov: Province } => {
      const P = t.prov;
      if (P?.owner !== c.player) return false;
      if (t.players.has(c.player)) return false; // not our own troops moving about
      if (!inDefendZone(turnContext, c, P)) return false;
      if (!canStepBetween(c, here, P, sc)) return false; // AK: a fleet can't march inland; ships never cross land (item 14)
      return true;
    });
    const firstThreat = cands[0];
    if (firstThreat === undefined) return; // none: the list holds threats alone
    if (defendBattleLocked(turnContext, c, here)) {
      emit(turnContext, {
        type: 'move',
        fact: {
          kind: 'a defender held by an unresolved battle cannot ride out',
          heroName: c.name,
          provinceName: here.name,
          threatenedProvinceName: firstThreat.prov.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        province: here.id,
        hero: c.id,
        phase: ph,
      });
      return;
    }

    // a general on Defend rides out to meet ANY incursion in his watch, however heavy — a player
    // may want to force a battle purely to slow an opponent down. He answers the heaviest threat
    // within reach; his own strength is no longer a gate (still worked out above, for the sort
    // tie-break flavour where several threats are equal).
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
    here.characters = (asItsGuardReadsIt(here.characters) ?? []).filter((id) => id !== c.id);
    P.characters = asItsGuardReadsIt(P.characters) ?? [];
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
    emit(turnContext, {
      type: 'move',
      fact: {
        kind: 'a defender rides out to meet a column crossing into a province of his realm',
        heroName: c.name,
        invaderNames: [...target.names],
        provinceName: P.name,
      },
      audience: { actor: c.player, realms: [c.player], seen: 'there' },
      province: P.id,
      hero: c.id,
      phase: ph,
    }); // 2026-09-09 item 1: runs OUTSIDE any order context, so file it explicitly
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
export function reconcileDefendRideOuts(turnContext: TurnContext, ph: number): void {
  const { G, battleCommanders } = turnContext;
  (asItsGuardReadsIt(G.characters) ?? []).forEach((c: AHeroOnTheWatch) => {
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
    const fought = (battleCommanders[`${String(r.provId)}@${String(ph)}`] ?? []).length > 0;
    if (fought) return;
    const P = G.world.provinces[r.provId];
    if (!P) return;
    const enemyHere = (asItsGuardReadsIt(G.characters) ?? []).some(
      (e: Character | null | undefined) =>
        e?.alive &&
        e.player != null &&
        e.player !== c.player &&
        areEnemies(turnContext, c.player, e.player) &&
        e.location === P.id &&
        (asItsGuardReadsIt(e.armies) ?? []).length > 0 &&
        !isVeiled(turnContext, e),
    );
    if (c.location === P.id && !enemyHere) {
      emit(turnContext, {
        type: 'move',
        fact: {
          kind: 'a defender rides out but the column never crosses the border',
          heroName: c.name,
          provinceName: P.name,
          invaderNames: [...r.names],
        },
        audience: { actor: c.player, realms: [c.player] },
        province: P.id,
        hero: c.id,
        phase: ph,
      });
    } else if (c.location === P.id && enemyHere) {
      emit(turnContext, {
        type: 'move',
        fact: {
          kind: 'a defender rides out and faces a column but no battle is joined',
          heroName: c.name,
          provinceName: P.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        province: P.id,
        hero: c.id,
        phase: ph,
      });
    }
  });
}

// A general whose own province holds an unresolved battle (an armed hostile still stands there) is
// pinned exactly as a Move would be — the Defend watch is not a way out of a fight.
export function defendBattleLocked(
  turnContext: Pick<TurnContext, 'G'>,
  c: Pick<Character, 'id' | 'player'>,
  here: Pick<Province, 'id' | '_battleUnresolved'> | null | undefined,
): boolean {
  const { G } = turnContext;
  if (!here?._battleUnresolved) return false;
  return (asItsGuardReadsIt(G.characters) ?? []).some(
    (e: Character | null | undefined) =>
      !!e &&
      e.id !== c.id &&
      (e.alive || e._leaderlessHost) &&
      e.location === here.id &&
      (asItsGuardReadsIt(e.armies) ?? []).length > 0 &&
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
export function defendAnswerUnitGain(
  turnContext: TurnContext,
  raiser: AHeroAsAHostGainedHasHim | null | undefined,
  prov: Province | null | undefined,
  ph: number,
  dryRun?: boolean,
): Character[] {
  const { G, seaCap, seaMoveActive, seaMovePoints, movePoints } = turnContext;
  const riders: Character[] = [];
  if (!raiser || prov?.owner == null || prov.owner === raiser.player) return riders;
  if (!areEnemies(turnContext, raiser.player, prov.owner)) return riders;
  if (isVeiled(turnContext, raiser)) return riders; // a veiled host cannot be found to be fought
  const theOwner = prov.owner;
  (asItsGuardReadsIt(G.characters) ?? []).forEach((d: Character | null | undefined) => {
    if (!d?.alive || d.player !== theOwner || !d._defend?.active) return;
    if ((asItsGuardReadsIt(d.armies) ?? []).length === 0) return; // only generals ride out
    if (d.location === prov.id || asItsGuardReadsIt(d.location) == null) return; // already here — he is a defender anyway
    if (d._defendReactedPhase === ph) return; // one reaction per phase
    if (d._mercyFledTurn === G.turn) return;
    const here = G.world.provinces[d.location];
    if (!here) return;
    if (!getNeighborsP(here, G.world.cols, G.world.rows, G.world.provinces).some((n) => n.id === prov.id)) return;
    if (defendBattleLocked(turnContext, d, here)) return;
    const sc = (seaCap[d.id] ?? '') || 'land';
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
    if (bySea) seaMovePoints[d.id] = Number(seaMovePoints[d.id]) - 1;
    else movePoints[d.id] = Number(movePoints[d.id]) - 1;
    here.characters = (asItsGuardReadsIt(here.characters) ?? []).filter((id) => id !== d.id);
    prov.characters = asItsGuardReadsIt(prov.characters) ?? [];
    if (!prov.characters.includes(d.id)) prov.characters.push(d.id);
    d.location = prov.id;
    d.locationName = prov.name;
    d._attackedFrom = here.id;
    d._defendReactedPhase = ph;
    prov.visitedBy = asItsGuardReadsIt(prov.visitedBy) ?? [];
    if (!prov.visitedBy.includes(d.player)) prov.visitedBy.push(d.player);
    emit(turnContext, {
      type: 'move',
      fact: {
        kind: 'a defender rides in to meet a host raised in a province of his realm',
        heroName: d.name,
        raiserName: raiser.name,
        realmTag: theNameOfAPlayersRealm(turnContext, raiser.player),
        turningAWarFront: !!raiser._warFront,
        provinceName: prov.name,
      },
      audience: { actor: d.player, realms: [d.player], seen: 'there' },
      province: prov.id,
      hero: d.id,
      phase: ph,
    });
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
export function runDefendMaterializedReactions(turnContext: TurnContext, ph: number): void {
  const { G, movePoints, seaMovePoints, seaMoveActive, seaCap } = turnContext;
  (asItsGuardReadsIt(G.characters) ?? []).forEach((c: HeroInABattle) => {
    if (!c.alive || !aHeroOfAWatchingRealm(c) || !c._defend?.active) return;
    if ((asItsGuardReadsIt(c.armies) ?? []).length === 0) return; // only generals ride out
    if (c._defendReactedPhase === ph) return; // one reaction per phase
    if ((movePoints[c.id] ?? 0) <= 0 && (seaMovePoints[c.id] ?? 0) <= 0) return;
    const here = G.world.provinces[c.location];
    if (!here) return;
    // a defender flooded into a sea province cannot ride out unless he can move by sea.
    if (here.terrain === 'sea' && !(seaMoveActive[c.id] && (seaMovePoints[c.id] ?? 0) > 0)) {
      emit(turnContext, {
        type: 'move',
        fact: {
          kind: 'a defender on drowned ground is stranded and cannot ride out',
          heroName: c.name,
          provinceName: here.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        province: here.id,
        hero: c.id,
        phase: ph,
      });
      return;
    }
    const sc = (seaCap[c.id] ?? '') || 'land';
    if (defendBattleLocked(turnContext, c, here)) return; // pinned by an unresolved battle where he stands
    // Watch zone: the province he stands on plus its immediate neighbours.
    const zone = [here, ...getNeighborsP(here, G.world.cols, G.world.rows, G.world.provinces)].filter(Boolean);
    // Find the heaviest enemy force (a character leading armies) standing anywhere in the zone.
    let best: { P: Province; foes: Character[]; str: number } | null = null;
    for (const P of zone) {
      if (P._battleUnresolved) continue; // already contested — that battle series is tracked and resumes next phase
      // a general on Defend only rides out to fight in ADJACENT provinces HE CONTROLS — never
      // into a neutral province or one another player holds. (A force that materialises in the
      // very province he stands on is still met where he stands.) Item 4: …or one that was HIS
      // until an enemy force materialised in it this very phase (Skeletal Armies, Summon
      // Elemental, …) and took it unopposed — he rides out to win it back.
      const _justTaken =
        P._takenByUnitGain?.turn === G.turn && P._takenByUnitGain.ph === ph && P._takenByUnitGain.from === c.player;
      if (P.id !== c.location && P.owner !== c.player && !_justTaken) continue;
      const foes = (asItsGuardReadsIt(G.characters) ?? []).filter(
        (e: Character | null | undefined): e is Character =>
          !!e?.alive &&
          e.player != null &&
          areEnemies(turnContext, c.player, e.player) &&
          e.location === P.id &&
          (asItsGuardReadsIt(e.armies) ?? []).length > 0,
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
        seaMovePoints[c.id] = Number(seaMovePoints[c.id]) - 1;
      } else {
        if ((movePoints[c.id] ?? 0) <= 0) return;
        movePoints[c.id] = Number(movePoints[c.id]) - 1;
      }
      here.characters = (asItsGuardReadsIt(here.characters) ?? []).filter((id) => id !== c.id);
      prov.characters = asItsGuardReadsIt(prov.characters) ?? [];
      if (!prov.characters.includes(c.id)) prov.characters.push(c.id);
      c.location = prov.id;
      c.locationName = prov.name;
      c._attackedFrom = here.id;
      prov.visitedBy = asItsGuardReadsIt(prov.visitedBy) ?? [];
      if (!prov.visitedBy.includes(c.player)) prov.visitedBy.push(c.player);
      emit(turnContext, {
        type: 'move',
        fact: {
          kind: 'a defender rides out to meet a host risen in his watch',
          heroName: c.name,
          provinceName: prov.name,
        },
        audience: { actor: c.player, realms: [c.player], seen: 'there' },
        province: prov.id,
        hero: c.id,
        phase: ph,
      });
      if (toSea) rollNavalVoyage(turnContext, c, SKILLGAIN_COMMON);
      else trySkillGain(turnContext, c, 'march', SKILLGAIN_COMMON);
    } else {
      emit(turnContext, {
        type: 'move',
        fact: {
          kind: 'a defender forms his line against a host taking shape where he stands',
          heroName: c.name,
          provinceName: prov.name,
        },
        audience: { actor: c.player, realms: [c.player], seen: 'there' },
        province: prov.id,
        hero: c.id,
        phase: ph,
      });
    }
    c._defendReactedPhase = ph;
    // Force the battle: c attacks the heaviest enemy force here; the rest unify behind it (as in
    // any battle / the both-armed pursuit). Fight on pooled copies, then write casualties + routs
    // back.
    const quarry = best.foes
      .slice()
      .sort((a, b) => armyTotalStr(turnContext, b, prov) - armyTotalStr(turnContext, a, prov))[0];
    if (quarry === undefined) throw new TypeError("Cannot read properties of undefined (reading 'armies')"); // the foes are never none
    const defReinf = best.foes.filter((d) => d.id !== quarry.id);
    const combinedAtk = { ...c, armies: [...(asItsGuardReadsIt(c.armies) ?? [])] };
    if (_metWhereHeStood) {
      combinedAtk._resumeBattle = true;
      combinedAtk._openingClash = true;
    } // already there: no move-in line, and not a carry-on round
    const _hPooled = [
      ...(asItsGuardReadsIt(quarry.armies) ?? []),
      ...defReinf.flatMap((d) => asItsGuardReadsIt(d.armies) ?? []),
    ];
    const _hP = pickBattleCommander(turnContext, quarry, defReinf, _hPooled, prov, false); // best defender commands
    const theLeader = theHostsCommander(_hP.leader); // quarry, or one joining him: never none
    const combinedDef = { ...theLeader, armies: _hPooled };
    const targetsPi = [c.player, quarry.player].filter((x) => x != null);
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: 'a defender falls upon a host in his watch',
        heroName: c.name,
        quarryName: quarry.name,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
      heroes: [c.id, quarry.id, ...defReinf.map((d) => d.id)],
      phase: ph,
    });
    if (_hP.changed)
      emit(turnContext, {
        type: 'combat',
        fact: commandHandoverLine(theLeader, quarry, prov.name),
        audience: { actor: quarry.player, realms: targetsPi, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: prov.id,
      });
    const battle = combatVsChar(turnContext, combinedAtk, combinedDef, prov);
    syncLeaderCopy(turnContext, theLeader, combinedDef);
    creditBattle(turnContext, c, theLeader, battle, prov);
    emitBattle(turnContext, battle, prov, ph, targetsPi, {
      actor: c.player,
      charIds: [c.id, quarry.id, ...defReinf.map((d) => d.id)],
    }); // item 5; 2026-09-09 item 1
    c.armies = (asItsGuardReadsIt(c.armies) ?? []).filter((a: ArmyInABattle) => !a._died && !a._disbanded);
    [quarry, ...defReinf].forEach((d) => {
      d.armies = (asItsGuardReadsIt(d.armies) ?? []).filter((a: ArmyInABattle) => !a._died && !a._disbanded);
    });
    if (combinedAtk.location !== c.location) {
      c.location = combinedAtk.location;
      const np = G.world.provinces[c.location];
      if (np) c.locationName = np.name;
    }
    if (combinedDef.location !== theLeader.location || combinedDef.location !== quarry.location) {
      const np = G.world.provinces[combinedDef.location];
      if (quarry.alive) {
        quarry.location = combinedDef.location;
        if (np) quarry.locationName = np.name;
      } // a slain commander stays where they fell
      if (np) {
        np.characters = asItsGuardReadsIt(np.characters) ?? [];
        defReinf.forEach((d) => {
          if (!d.alive) {
            return;
          } // dead reinforcements do not rout
          prov.characters = (asItsGuardReadsIt(prov.characters) ?? []).filter((id) => id !== d.id);
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
      battle.won &&
      whetherHeLivesNow(c) &&
      c.location === prov.id &&
      prov.owner !== c.player &&
      !prov._battleUnresolved
    ) {
      const _enemyLeft = (asItsGuardReadsIt(G.characters) ?? []).some(
        (e: Character | null | undefined) =>
          !!e &&
          (e.alive || e._leaderlessHost) &&
          e.location === prov.id &&
          (asItsGuardReadsIt(e.armies) ?? []).length > 0 &&
          e.player != null &&
          e.player !== c.player &&
          areEnemies(turnContext, c.player, e.player),
      );
      if (!_enemyLeft) {
        G.players.forEach((p, pi) => {
          if (pi !== c.player) {
            const i = (asItsGuardReadsIt(p.provinces) ?? []).indexOf(prov.id);
            if (i > -1) p.provinces.splice(i, 1);
          }
        });
        setProvinceOwner(turnContext, prov, c.player, c, ph);
        const wp = G.players[c.player];
        if (wp && !wp.provinces.includes(prov.id)) wp.provinces.push(prov.id);
        if (wp) applyEvilConquest(turnContext, c, prov, wp); // Evil doctrine on this capture path (was skipped)
        delete prov._takenByUnitGain;
        emit(turnContext, {
          type: 'combat',
          fact: {
            kind: 'a defender drives the interlopers out and secures the province',
            heroName: c.name,
            provinceName: prov.name,
            realmName: wp ? wp.name : null,
          },
          audience: { actor: c.player, realms: [], seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          province: prov.id,
        });
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
export function runDefendAmbush(turnContext: TurnContext, ph: number): void {
  const { G } = turnContext;
  (asItsGuardReadsIt(G.characters) ?? []).forEach((c) => {
    if (!c.alive || c.player == null || !c._defend?.active) return;
    if ((asItsGuardReadsIt(c.armies) ?? []).length > 0) return; // ONLY lone characters ambush (armed ones ride out above)
    if (c._defendReactedPhase === ph) return; // one reaction per phase
    if (c._encounteredThisPhase != null) return; // already in a personal fight this phase
    const here = G.world.provinces[c.location];
    if (!here) return;
    // Watch zone: the province he stands on plus its immediate neighbours.
    const zoneIds = new Set<number>([
      here.id,
      ...getNeighborsP(here, G.world.cols, G.world.rows, G.world.provinces)
        .filter(Boolean)
        .map((p) => p.id),
    ]);
    // Candidate quarry: an ENEMY character who entered the zone THIS phase (an incursion), is not
    // cloaked, and has not already fought a personal action this phase. A wandering/neutral hero
    // (player==null) is never an "enemy character" and is left alone.
    const foes = (asItsGuardReadsIt(G.characters) ?? []).filter((e: Character | null | undefined): e is Character => {
      if (!e?.alive || e.player == null || e.id === c.id) return false;
      if (!areEnemies(turnContext, c.player, e.player)) return false;
      if (asItsGuardReadsIt(e.location) == null || !zoneIds.has(e.location)) return false;
      if (e._enteredProvThisPhase !== e.location) return false; // must have MARCHED IN this phase (a real incursion)
      if (e._encounteredThisPhase != null) return false;
      if (e._vanishTurn === G.turn) return false; // THIEF L9 Vanish: no ambush lands on a vanished quarry
      if (isHiddenByInvisibilityFrom(turnContext, e, c.player)) return false; // R-119: Invisibility passes him by
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
        armyTotalStr(turnContext, b, theProvinceHeStandsIn(G, b)) -
          armyTotalStr(turnContext, a, theProvinceHeStandsIn(G, a)) ||
        effStat(turnContext, b, 'melee') - effStat(turnContext, a, 'melee'),
    );
    const quarry = foes[0];
    if (quarry === undefined) throw new TypeError("Cannot read properties of undefined (reading 'location')"); // the foes are never none
    const quarryProv = G.world.provinces[quarry.location];
    if (!quarryProv) return;
    // Spy-scaled ambush chance. Base 10% + 9%/Spy level (a master scout ~90%). Halved against a
    // commander leading an army — his guards make a lone strike far harder to land.
    const spy = effStat(turnContext, c, 'spy');
    let chance = Math.min(90, 10 + spy * 9);
    const guarded = (asItsGuardReadsIt(quarry.armies) ?? []).length > 0;
    if (guarded) chance = Math.floor(chance / 2);
    const roll = d100();
    const targetsPi = [c.player, quarry.player].filter((x) => x != null);
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "the odds of a lone defender's ambush",
        heroName: c.name,
        spy,
        quarryName: quarry.name,
        guarded,
        chance,
        roll,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: quarryProv.id,
    });
    if (roll > chance) {
      emit(turnContext, {
        type: 'move',
        fact: {
          kind: 'a lone defender finds no opening to strike',
          heroName: c.name,
          quarryName: quarry.name,
          provinceName: quarryProv.name,
        },
        audience: { actor: c.player, realms: [c.player] },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: quarryProv.id,
      });
      c._defendReactedPhase = ph; // the attempt spends his watch for this phase
      return;
    }
    // Sprung. Close on the quarry (into a neighbour if need be — a lone scout crosses freely) and
    // force the personal battle. A forced ambush overrides the "a king won't stoop to a
    // challenge" and "a commander won't break ranks" refusals of a chosen duel: he is set upon,
    // not challenged.
    if (quarry.location !== c.location) {
      here.characters = (asItsGuardReadsIt(here.characters) ?? []).filter((id) => id !== c.id);
      quarryProv.characters = asItsGuardReadsIt(quarryProv.characters) ?? [];
      if (!quarryProv.characters.includes(c.id)) quarryProv.characters.push(c.id);
      c.location = quarryProv.id;
      c.locationName = quarryProv.name;
      quarryProv.visitedBy = asItsGuardReadsIt(quarryProv.visitedBy) ?? [];
      if (!quarryProv.visitedBy.includes(c.player)) quarryProv.visitedBy.push(c.player);
    }
    const prov = quarryProv;
    const COMBAT_ONLY = COMBAT_ONLY_TACTICS;
    const filterPlan = (plan: Character['encounterPlan']) =>
      (plan?.tactics ?? ['ME']).filter(
        // split gives at least one piece: `?? ''` never holds
        (t) => COMBAT_ONLY.has((t.split(':')[0] ?? '').toUpperCase()) || t.toUpperCase().startsWith('CA:'),
      );
    ensureEncounterPlan(turnContext, c);
    ensureEncounterPlan(turnContext, quarry);
    const atkPlan = filterPlan(c.encounterPlan);
    if (!atkPlan.length) atkPlan.push('ME');
    const defPlan = filterPlan(quarry.encounterPlan);
    if (!defPlan.length) defPlan.push('ME');
    const _duelChars = [c.id, quarry.id];
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: 'a lone defender springs his ambush',
        heroName: c.name,
        quarryName: quarry.name,
        provinceName: prov.name,
      },
      audience: { actor: c.player, realms: targetsPi, seen: prov.owner !== null ? 'battle' : undefined },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
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
      (...a: [hero: Parameters<typeof effStat>[1], stat: string]) => effStat(turnContext, ...a),
      rng,
      G,
    );
    enc.narrative.forEach((line) => {
      emitNarrLine(turnContext, line, {
        type: 'combat',
        audience: { actor: c.player, realms: targetsPi },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: prov.id,
        heroes: _duelChars,
      });
    });
    c.hp = Math.max(1, enc.atkHp);
    if (quarry.player !== null) quarry.hp = Math.max(1, enc.defHp);
    if (enc.atkKilled || enc.atkHp <= 0) {
      if (_escapesTheEnd(c)) {
        const theDefendersHp = asItsGuardReadsIt(c.hp);
        if (theDefendersHp != null && theDefendersHp <= 0) c.hp = 1;
        emit(turnContext, {
          type: 'combat',
          fact: _garrethEscapeLine(c),
          audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          province: prov.id,
          heroes: _duelChars,
        });
      } else {
        reportHeroFall(
          turnContext,
          c,
          quarry,
          {
            kind: 'a hero is slain outside a battle',
            heroName: c.name,
            how: 'in the ambush he laid',
            killerName: null,
          },
          {
            audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            province: prov.id,
            heroes: _duelChars,
          },
        );
        awardKillXP(turnContext, quarry, c);
      }
    }
    if (enc.defKilled || enc.defHp <= 0) {
      if (_escapesTheEnd(quarry)) {
        const theQuarrysHp = asItsGuardReadsIt(quarry.hp);
        if (theQuarrysHp != null && theQuarrysHp <= 0) quarry.hp = 1;
        emit(turnContext, {
          type: 'combat',
          fact: _garrethEscapeLine(quarry),
          audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          province: prov.id,
          heroes: _duelChars,
        });
      } else {
        reportHeroFall(
          turnContext,
          quarry,
          c,
          { kind: 'a hero is slain outside a battle', heroName: quarry.name, how: 'in the ambush', killerName: null },
          {
            audience: { actor: c.player, realms: targetsPi, seen: 'battle' },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            province: prov.id,
            heroes: _duelChars,
          },
        );
        awardKillXP(turnContext, c, quarry);
      }
    }
    trySkillGain(turnContext, c, 'spy', SKILLGAIN_STD); // a sprung ambush hones the scout's craft
    c._encounteredThisPhase = quarry.id;
    quarry._encounteredThisPhase = c.id;
    c._defendReactedPhase = ph;
    if (whetherHeLivesNow(c)) completeDefendWatches(turnContext, [c.id], undefined); // item 15: the ambush was this watch's fight
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
export function runReinforcementArrivals(turnContext: TurnContext, ph: number, intents: ThePhasesIntents): void {
  const { seaCap, G, seaMovePoints, movePoints } = turnContext;
  const invasions = [...intents.values()].filter((it) => isHostileInvasion(turnContext, it));
  if (!invasions.length) return;
  const cmp = phaseInitCompare(turnContext, ph);
  const invadedProvIds = new Set(invasions.map((i) => i.toId));

  [...intents.values()].forEach((it) => {
    if (!asItsGuardReadsIt(it.c) || asItsGuardReadsIt(it.c.alive) === false) return; // 2026-09-21: `intents` is the STAGE-1 snapshot — never march a commander who has since fallen
    if (it.cancelled || it.action !== 'move' || !it.leadsArmy || !it.dest) return;
    const P = it.dest;
    if (!invadedProvIds.has(P.id)) return;
    if (P.owner !== it.player) return; // only reinforcing your OWN ground
    // Is he already going to beat the invader there under plain initiative? Then leave him be.
    const racers = invasions.filter((inv) => inv.toId === P.id && inv.player !== it.player);
    if (!racers.length) return;
    if (racers.every((inv) => cmp(it.c, inv.c) < 0)) return; // he's faster than all of them anyway
    // Terrain and movement must still allow the march.
    const sc = (seaCap[it.id] ?? '') || 'land';
    if (!canStepBetween(it.c, G.world.provinces[it.fromId], P, sc)) return; // item 14: ships never cross land
    const toSea = P.terrain === 'sea';
    const pool = toSea ? seaMovePoints : movePoints;
    if ((pool[it.id] ?? 0) <= 0) return;

    const from = G.world.provinces[it.fromId];
    pool[it.id] = Math.max(0, (pool[it.id] ?? 0) - 1);
    if (from) from.characters = (asItsGuardReadsIt(from.characters) ?? []).filter((id) => id !== it.id);
    P.characters = asItsGuardReadsIt(P.characters) ?? [];
    if (!P.characters.includes(it.id)) P.characters.push(it.id);
    it.c.location = P.id;
    it.c.locationName = P.name;
    it.c._attackedFrom = it.fromId;
    P.visitedBy = asItsGuardReadsIt(P.visitedBy) ?? [];
    const theRealmsThatVisited: (number | null)[] = P.visitedBy; // the intent's realm, as its type allows none
    if (!theRealmsThatVisited.includes(it.player)) theRealmsThatVisited.push(it.player);
    if (!toSea) trySkillGain(turnContext, it.c, 'march', SKILLGAIN_COMMON);
    else rollNavalVoyage(turnContext, it.c, SKILLGAIN_STD);
    it.cancelled = true;
    it.cancelReason = 'reinforced';
    emit(turnContext, {
      type: 'move',
      fact: { kind: 'a column is hurried in ahead of the enemy', heroName: it.c.name, provinceName: P.name },
      audience: { actor: it.player, realms: [it.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: P.id,
    });
  });
}
