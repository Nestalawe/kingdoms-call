import { kcRng } from '../rng.ts';
import { demoteOrDisband } from '../army-tables.ts';
import { SEA_TYPES } from '../rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import { recordBattleGraves } from '../graves.ts';
import { markOrcAttackWin } from '../units/drill-and-spoils.ts';
import { theUnitsAsTheLineNamesThem } from './the-facts-a-battles-lines-record.ts';
import { theNameOfAPlayersRealm } from '../turn/log-line-helpers.ts';
import {
  narrateAt,
  emit,
  notifyProvinceOwner,
  notifyTarget,
  THE_HERO_WHOSE_ORDER_IS_RESOLVING,
  THE_PHASE_THE_LINE_IS_WRITTEN_IN,
} from '../turn/events-and-their-audiences.ts';
import { newMercId, noteBattleLoss } from '../turn/mercenary-ids-and-battle-records.ts';
import { applyEvilConquest, areAllied, areEnemies, setProvinceOwner } from '../realms/relations-and-captures.ts';
import { creditBattle } from '../titles/title-holders-and-battle-merit.ts';
import { clearNavalHold, navalHeldIn, navalHoldLine } from '../units/sea-lift-stranding-and-retreats.ts';
import { refreshMovePool } from '../units/movement-pools.ts';
import { commandHandoverLine, pickBattleCommander, syncLeaderCopy } from './best-commander.ts';
import { emitBattle } from './battle-report-lines-and-force-markers.ts';
import { combatVsNPC } from './battles-against-province-defenders.ts';
import { combatVsChar } from './battles-between-heroes.ts';
import { defendAnswerUnitGain } from '../units/defend-ride-outs-ambushes-and-reinforcements.ts';
import { asItsGuardReadsIt } from '../personal-combat/to-hit-wounds-stuns-and-courage.ts';
import type { ArmyInABattle, HeroInABattle, ProvinceInABattle } from '../army-tables.ts';
import type { Army, Character, Province, Realm } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';
import type { NarrativeLine } from '../turn/events-and-their-audiences.ts';
import type { ABeatenGuardsSurvivingUnitsFate, TheDefendersOfAProvince } from './the-facts-a-battles-lines-record.ts';

/** A hero whose host is settled where he stands: a hero in a battle and the turn's mark a war front writes on him
 *  (resolveWarFronts sets it for the assault and deletes it after; the lines a host gained writes read it). */
export type AHeroAsAHostGainedHasHim = HeroInABattle & { _warFront?: boolean };
/** A unit of a province's standing garrison that rallies to a defender of its realm: the mark it holds while it
 *  stands in his line (set as it rallies, deleted once the battle is over). */
type AUnitRalliedFromTheGarrison = ArmyInABattle & { _fromGarrison?: boolean };
/** The battle a host gained fights: the one between two heroes' hosts, or the one against a province's defenders. */
type TheBattleAHostGainedFights = ReturnType<typeof combatVsChar> | ReturnType<typeof combatVsNPC>;

/** Whether a hero serves a realm, as the guards read it (a realm's index, not none). */
export function aHeroOfARealm<Hero extends { readonly player: number | null }>(
  h: Hero,
): h is Hero & { readonly player: NonNullable<Hero['player']> } {
  return h.player != null;
}
/** The name of the season a phase falls in: a phase of the turn is one of its five seasons (0 to 4), so there is one;
 *  for none, a TypeError. */
export function theSeasonOfThePhase(seasons: readonly string[], ph: number): string {
  const theSeason = seasons[ph];
  if (theSeason === undefined) throw new TypeError(`no season for the phase ${String(ph)}`);
  return theSeason;
}
/** The realm of the hero whose host is settled, read where its fields are read: a hero of a realm serves one of the
 *  state's realms, so there is one; for none, the TypeError the read threw. */
function theHostsRealm(player: Realm | undefined): Realm {
  if (!player) throw new TypeError("Cannot read properties of undefined (reading 'name')");
  return player;
}
/** The commander pickBattleCommander picks for the defence: the defender it is handed or one of the heroes joining
 *  him, so there is one; for none, a TypeError. */
function theCommanderPicked(leader: HeroInABattle | null | undefined): HeroInABattle {
  if (!leader) throw new TypeError('pickBattleCommander picked no commander');
  return leader;
}
/** The guard whose survivors still hold the province: guardLeft counts his units only while he stands, so there is
 *  one; for none, the TypeError the read of his name threw. */
function theGuardStillStanding(guard: Character | undefined): Character {
  if (!guard) throw new TypeError("Cannot read properties of undefined (reading 'name')");
  return guard;
}

// ── A HOST GAINED IN A PROVINCE (plan P1-08i3: lifted out of resolveTurn) ────
// When a character gains units in a province he doesn't own (raised, summoned, hired, taken over), the new host is
// settled the same phase: a battle against any enemy or neutral armies there, or the province taken if none stand in
// the way (resolveUnitGainInProvince). While the phase's non-moving orders are still resolving, a host a Defend general
// would answer waits in the queue (the context's _tier0Open and _unitGainQueue, read and written as
// turnContext.<name>, as resolveTurn reads them). Each time a neutral guard loses a battle, its survivors flee as
// mercenaries, lose heart and drop a grade, or hold their ground (erodeGuardSurvivors, GUARD_FLIGHT_CHANCE,
// GUARD_DEMOTE_CHANCE; plan P1-13e1 moved them here from stalled-battles-and-beaten-guards.ts). Both take the turn's
// context first (src/engine/turn/context.ts).
// when a character GAINS units in a province they don't own (Skeletal Armies, Elemental Summon,
// action-phase Control Undead, mercenary hire, …), the new force is resolved the same
// phase: enemy OR neutral armies present → a battle is fought; none present → the character takes
// control. Enemy and neutral armies are treated the same. Returns true if a battle was fought.
export function resolveUnitGainInProvince(
  turnContext: TurnContext,
  c: AHeroAsAHostGainedHasHim | null | undefined,
  prov: ProvinceInABattle | null | undefined,
  ph: number,
): boolean {
  const { G } = turnContext;
  if (!c || !prov || !aHeroOfARealm(c)) return false;
  if (prov.owner === c.player) return false; // already ours — nothing to contest
  if ((asItsGuardReadsIt(c.armies) ?? []).length === 0) return false; // no force present to fight or hold
  // DIPLOMACY: a force raised inside an ally's or a neutral's province cannot seize it or start a
  // war — it simply stands there. Only enemy-owned (or unowned) ground can be contested this way.
  if (prov.owner != null && prov.owner !== c.player && !areEnemies(turnContext, c.player, prov.owner)) {
    // The owner saw the troops appear (public cast line) — tell them what it means: nothing, yet.
    const _allied = areAllied(turnContext, c.player, prov.owner);
    notifyProvinceOwner(
      turnContext,
      prov,
      {
        kind: "a hero not at war with the province's realm gains a host inside it",
        cName: c.name,
        realmTag: theNameOfAPlayersRealm(turnContext, c.player),
        unitCount: (asItsGuardReadsIt(c.armies) ?? []).length,
        provName: prov.name,
        theRealmsAreAllied: _allied,
        provName2: prov.name,
      },
      c.player,
      ph,
    );
    return false;
  }
  // ── DEFEND, DEFERRED ── While the phase's NON-MOVING orders are still resolving (_tier0Open),
  // a host raised where a Defend general would answer is not settled on the spot: it is queued,
  // and settled at the Defend step (flushDefendStep in the phase loop) — after every order aimed
  // AT that general this phase (a spell, a column handed over, an item) has taken effect, and
  // before any army marches. He still arrives before the new host can take the ground; the
  // battle is simply fought a moment later in the same phase. With no general to answer, nothing
  // is deferred and the old immediate resolution stands.
  if (turnContext._tier0Open && defendAnswerUnitGain(turnContext, c, prov, ph, true).length > 0) {
    if (!turnContext._unitGainQueue.some((q) => q.c === c && q.prov === prov))
      turnContext._unitGainQueue.push({ c, prov });
    emit(turnContext, {
      type: 'system',
      fact: { kind: "a hero's new host is still forming up in a province", cName: c.name, provName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    });
    return false;
  }
  const player = G.players[c.player];
  // DEFEND: a general of the owning realm keeping watch next door reaches the province BEFORE the
  // new host can form up and seize it — he is then found below as an ordinary defender, so he
  // fights on his own ground (defender's edge, garrison at his side) instead of retaking it.
  const _defRiders = defendAnswerUnitGain(turnContext, c, prov, ph);
  const _armedFoesHere = G.characters.filter(
    (d) =>
      d.alive &&
      d.id !== c.id &&
      d.location === prov.id &&
      d.player != null &&
      d.player !== c.player &&
      areEnemies(turnContext, c.player, d.player) &&
      (asItsGuardReadsIt(d.armies) ?? []).length > 0,
  );
  // the owner's own commanders lead the defence of their ground ahead of any third party
  const enemyChar = _armedFoesHere.find((d) => d.player === prov.owner) ?? _armedFoesHere[0];
  const neutralGuard = G.characters.find(
    (d) =>
      d.alive &&
      d.player === null &&
      d.location === prov.id &&
      (asItsGuardReadsIt(d.armies) ?? []).length > 0 &&
      !d._justDefeated,
  );
  const garrison = prov.owner != null && prov.owner !== c.player ? (asItsGuardReadsIt(prov.garrisonArmies) ?? []) : [];
  // A guard slain in an earlier pre-battle duel leaves his surviving troops as a LEADERLESS
  // neutral garrison (prov._leaderlessDefenders) — they contest the province like anyone else.
  const llDefs =
    prov.owner === null && prov._leaderlessDefenders ? (asItsGuardReadsIt(prov.neutralDefenders) ?? []) : [];
  const hasDefenders =
    !!enemyChar ||
    (neutralGuard !== undefined && (asItsGuardReadsIt(neutralGuard.armies) ?? []).length > 0) ||
    garrison.length > 0 ||
    llDefs.length > 0;

  const claim = () => {
    // remember who lost this province to a force that materialised here this phase, so a
    // neighbouring general on Defend may still ride out to contest it (see
    // runDefendMaterializedReactions).
    if (prov.owner != null && prov.owner !== c.player)
      prov._takenByUnitGain = { turn: G.turn, ph: ph, from: prov.owner };
    G.players.forEach((p, pi) => {
      if (pi !== c.player) {
        const i = (asItsGuardReadsIt(p.provinces) ?? []).indexOf(prov.id);
        if (i > -1) p.provinces.splice(i, 1);
      }
    });
    setProvinceOwner(turnContext, prov, c.player, c, ph);
    prov.neutralDefenders = [];
    prov.npcArmies = 0;
    delete prov._leaderlessDefenders;
    const theRealm = theHostsRealm(player);
    if (!theRealm.provinces.includes(prov.id)) theRealm.provinces.push(prov.id);
    applyEvilConquest(turnContext, c, prov, theRealm); // Evil doctrine on this capture path (was skipped)
    prov.visitedBy = asItsGuardReadsIt(prov.visitedBy) ?? [];
    if (!prov.visitedBy.includes(c.player)) prov.visitedBy.push(c.player);
  };

  if (!hasDefenders) {
    claim();
    emit(turnContext, {
      type: 'combat',
      fact: {
        kind: 'a contest for a province is decided',
        contest: 'a host gathered in the province',
        whatBecomesOfTheProvince: 'taken with no one to defend it',
        onAWarFront: !!c._warFront,
        cName: c.name,
        provName: prov.name,
        playerName: theHostsRealm(player).name,
      },
      audience: { actor: c.player, realms: [], seen: 'battle' },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: prov.id,
    });
    return false;
  }

  // the character is ALREADY standing in this province (they raised/received troops here — they
  // did not march in), so any battle that breaks out must NOT print the "➡ … moves into … a
  // battle is initiated" line. combatVsNPC/combatVsChar honour _resumeBattle to suppress it; set
  // it for the duration of this battle and clear it immediately after.
  c._resumeBattle = true;
  // …but a force that has only just appeared is fighting its OPENING clash, not a carry-on round
  // (unless the province was already contested) — so the carry-on casualty multiplier stays off.
  if (!prov._battleUnresolved) c._openingClash = true;
  let battle: TheBattleAHostGainedFights,
    targets: (number | null)[] = [c.player];
  let _garrisonUnfought = false;
  if (enemyChar) {
    targets = [c.player, enemyChar.player];
    const defReinf = G.characters.filter(
      (d) =>
        d.alive &&
        d.id !== enemyChar.id &&
        d.player === enemyChar.player &&
        d.location === prov.id &&
        (asItsGuardReadsIt(d.armies) ?? []).length > 0,
    );
    // The standing garrison rallies to a commander of its own realm, as it does when an invader
    // marches in (move handler) — it shares the line, the casualties and the retreat.
    const _garHere: AUnitRalliedFromTheGarrison[] =
      prov.owner != null && prov.owner === enemyChar.player ? [...(asItsGuardReadsIt(prov.garrisonArmies) ?? [])] : [];
    _garHere.forEach((a) => {
      a._fromGarrison = true;
    });
    _garrisonUnfought = _garHere.length === 0 && garrison.length > 0; // a third party fought; the owner's garrison did not
    const _rbPooled = [
      ...(asItsGuardReadsIt(enemyChar.armies) ?? []),
      ...defReinf.flatMap((d) => asItsGuardReadsIt(d.armies) ?? []),
      ..._garHere,
    ];
    const _rbP = pickBattleCommander(turnContext, enemyChar, defReinf, _rbPooled, prov, false); // best defender commands
    const theLeader = theCommanderPicked(_rbP.leader);
    const combinedDef = { ...theLeader, armies: _rbPooled };
    const theBattleFought = combatVsChar(turnContext, c, combinedDef, prov);
    battle = theBattleFought;
    syncLeaderCopy(turnContext, theLeader, combinedDef);
    creditBattle(turnContext, c, theLeader, theBattleFought, prov);
    if (Array.isArray(theBattleFought.narrative)) {
      const _form: NarrativeLine[] = [];
      const theOwnersRealm = prov.owner != null ? G.players[prov.owner] : undefined;
      if (c._openingClash && !c._warFront)
        _form.push({
          kind: 'the hero turns a newly gathered host on a province and a battle is initiated',
          cName: c.name,
          realmTag: theNameOfAPlayersRealm(turnContext, c.player),
          provName: prov.name,
          heldByName: theOwnersRealm
            ? theOwnersRealm.name
            : ((enemyChar.player === null ? undefined : G.players[enemyChar.player])?.name ?? '') || enemyChar.name,
        });
      if (_defRiders.length > 0)
        _form.push({
          kind: 'the defenders riding in were keeping watch and are already in the line',
          ridersNames: _defRiders.map((d) => d.name),
          provName: prov.name,
          cName: c.name,
          onAWarFront: c._warFront,
          provName2: prov.name,
        });
      if (defReinf.length > 0)
        _form.push({
          kind: 'the defender is reinforced by other heroes in the defence of a province',
          defenderName: enemyChar.name,
          reinforcementsNames: defReinf.map((d) => d.name),
          provName: prov.name,
        });
      if (_garHere.length > 0)
        _form.push({
          kind: "the province's standing troops rally to the defender",
          provName: prov.name,
          leaderName: theLeader.name,
          garrisonUnitCount: _garHere.length,
          garrison: theUnitsAsTheLineNamesThem(_garHere),
        });
      if (_rbP.changed) _form.push(commandHandoverLine(theLeader, enemyChar, prov.name));
      if (_form.length) {
        // The "Battle for …" header: a fact (P1-12c5), found by its kind.
        const _bi = theBattleFought.narrative.findIndex(
          (l) => asItsGuardReadsIt(l)?.kind === 'the battle for a province begins',
        );
        narrateAt(theBattleFought.narrative, _bi >= 0 ? _bi : 0, _form);
      }
    }
    emitBattle(turnContext, theBattleFought, prov, ph, targets, {
      actor: c.player,
      charIds: [c.id, enemyChar.id, ...defReinf.map((d) => d.id)],
    }); // item 5; 2026-09-09 item 1
    [enemyChar, ...defReinf]
      .filter((d) => d.id !== theLeader.id)
      .forEach((d) => {
        notifyTarget(
          turnContext,
          d,
          asItsGuardReadsIt(d.alive) === false
            ? {
                kind: 'a hero fell in the battle line beside the commander of the defence',
                heroName: d.name,
                leaderName: theLeader.name,
                provName: prov.name,
                leaderName2: theLeader.name,
              }
            : {
                kind: 'a hero stands in the battle line beside the commander of the defence',
                heroName: d.name,
                leaderName: theLeader.name,
                provName: prov.name,
                leaderName2: theLeader.name,
              },
          ph,
          'combat',
        );
      });
    c.armies = (asItsGuardReadsIt(c.armies) ?? []).filter((a: ArmyInABattle) => !a._died && !a._disbanded);
    [enemyChar, ...defReinf].forEach((d) => {
      d.armies = (asItsGuardReadsIt(d.armies) ?? []).filter((a: ArmyInABattle) => !a._died && !a._disbanded);
    });
    if (theBattleFought.won)
      [enemyChar, ...defReinf].forEach((d) => {
        noteBattleLoss(turnContext, d.id, undefined);
      }); // every beaten defender's watch is broken
    // 2026-09-27 (Toby): hulls the beaten defender left ashore (navalSplitRetreat) are sitting in
    // prov.garrisonArmies but are not the standing garrison — keep them out of the sweep below.
    const _navalHeldUG = navalHeldIn(prov);
    if (_navalHeldUG.length) {
      // same pooled-copy split as the move handler: hulls left ashore come off the real
      // commanders' lists, or they would march away and hold the ground at the same time.
      [c, enemyChar, ...defReinf].forEach((d: Character | null | undefined) => {
        if (!d || !Array.isArray(d.armies)) return;
        const _n = d.armies.length;
        d.armies = d.armies.filter((a) => !_navalHeldUG.includes(a));
        if (d.armies.length !== _n && typeof refreshMovePool === 'function') refreshMovePool(turnContext, d);
      });
    }
    const _garSurv = _garHere.filter((a) => !a._died && !a._disbanded && !_navalHeldUG.includes(a));
    _garSurv.forEach((a) => {
      delete a._fromGarrison;
    });
    if (_garHere.length > 0) prov.garrisonArmies = _navalHeldUG.concat(_garSurv);
    // Same pooled-copy sync as the move handler: combatVsChar retreats the COPY, so the real
    // defenders must follow it or they are left as ghosts in a province they have fled.
    if (combinedDef.location !== enemyChar.location) {
      const _defFellBackTo = G.world.provinces[combinedDef.location];
      if (_defFellBackTo) {
        _defFellBackTo.characters = asItsGuardReadsIt(_defFellBackTo.characters) ?? [];
        [enemyChar, ...defReinf].forEach((d) => {
          if (!d.alive) {
            return;
          } // a commander slain in the pre-battle duel stays where they fell
          prov.characters = (asItsGuardReadsIt(prov.characters) ?? []).filter((id) => id !== d.id);
          if (!_defFellBackTo.characters.includes(d.id)) _defFellBackTo.characters.push(d.id);
          d.location = _defFellBackTo.id;
          d.locationName = _defFellBackTo.name;
          // forced retreat/fall-back does NOT consume move points.
        });
        // the rallied garrison has no commander of its own — it falls back with the beaten heroes
        if (_garSurv.length > 0) {
          _defFellBackTo.garrisonArmies = (asItsGuardReadsIt(_defFellBackTo.garrisonArmies) ?? []).concat(_garSurv);
          prov.garrisonArmies = _navalHeldUG.slice(); // stranded hulls cannot take to the road
          emit(turnContext, {
            type: 'combat',
            fact: {
              kind: "the province's standing troops fall back with the defender",
              provName: prov.name,
              fellBackToName: _defFellBackTo.name,
              defenderName: enemyChar.name,
            },
            audience: { actor: enemyChar.player, realms: targets, seen: 'battle' },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            province: _defFellBackTo.id,
          });
        }
      }
    }
    // Contest left hanging with the defending hero still here: the garrison fights on at his side
    // through every resume, and settleRalliedGarrisons() returns it to its post afterwards.
    if (
      prov._battleUnresolved &&
      enemyChar.alive &&
      enemyChar.location === prov.id &&
      (asItsGuardReadsIt(prov.garrisonArmies) ?? []).length > 0 &&
      prov.owner === enemyChar.player
    ) {
      const _join = prov.garrisonArmies;
      _join.forEach((a: AUnitRalliedFromTheGarrison) => {
        delete a._fromGarrison;
        a._garrisonOf = prov.id;
      });
      enemyChar.armies = (asItsGuardReadsIt(enemyChar.armies) ?? []).concat(_join);
      prov.garrisonArmies = [];
      if (typeof refreshMovePool === 'function') refreshMovePool(turnContext, enemyChar);
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: "the province's standing troops fall in with the defender as the battle continues",
          provName: prov.name,
          defenderName: enemyChar.name,
        },
        audience: { actor: enemyChar.player, realms: targets, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: prov.id,
      });
    }
  } else if (neutralGuard) {
    // Fight the guard's OWN armies, then sync survivors back to him — the same swap the move case
    // uses. Without it this path fought prov.neutralDefenders (stale intel) instead.
    const _savedDefs = prov.neutralDefenders;
    prov.neutralDefenders = [...(asItsGuardReadsIt(neutralGuard.armies) ?? [])];
    battle = combatVsNPC(turnContext, c, prov, neutralGuard);
    creditBattle(turnContext, c, null, battle, prov); // a neutral chieftain's guard pays merit here too
    if (neutralGuard.alive) {
      neutralGuard.armies = [...(asItsGuardReadsIt(prov.neutralDefenders) ?? [])];
      prov.neutralDefenders = _savedDefs;
    } else {
      // Slain in this battle's pre-battle duel — survivors stay on the province as a leaderless
      // garrison; the corpse leads nothing.
      neutralGuard.armies = [];
      neutralGuard._isNeutralGuard = false;
      prov.npcArmies = (asItsGuardReadsIt(prov.neutralDefenders) ?? []).length;
      prov._leaderlessDefenders = (asItsGuardReadsIt(prov.neutralDefenders) ?? []).length > 0;
    }
    emitBattle(turnContext, battle, prov, ph, [c.player], { actor: c.player }); // item 5
  } else if (llDefs.length > 0) {
    // Leaderless neutral garrison — fights without commander skills, straight off the province.
    battle = combatVsNPC(turnContext, c, prov, null);
    creditBattle(turnContext, c, null, battle, prov); // a leaderless neutral guard still pays merit
    prov._leaderlessDefenders = (asItsGuardReadsIt(prov.neutralDefenders) ?? []).length > 0;
    if (battle.won) markOrcAttackWin(c, G, battle); // 2026-09-27 (Toby item 8): war-spoils on the resumed leaderless fight
    emitBattle(turnContext, battle, prov, ph, [c.player], { actor: c.player }); // item 5
  } else {
    const _savedDefs = prov.neutralDefenders;
    prov.neutralDefenders = [...garrison];
    battle = combatVsNPC(turnContext, c, prov, null);
    creditBattle(turnContext, c, null, battle, prov); // breaking an enemy realm's garrison pays merit
    prov.neutralDefenders = _savedDefs;
    if (battle.won) markOrcAttackWin(c, G, battle); // 2026-09-27 (Toby item 8): storming a rival's garrison is an attacking win and pays war-spoils
    emitBattle(
      turnContext,
      battle,
      prov,
      ph,
      [c.player, prov.owner].filter((x) => x != null),
      { actor: c.player },
    ); // item 5
    if (battle.won) {
      // combatVsNPC set._died (and narrated + graved) on the garrison units that fell IN the
      // fighting. Announce the overrun and grave only those not already recorded.
      const _overrun = garrison.filter((a) => !a._died);
      if (_overrun.length > 0) {
        emit(turnContext, {
          type: 'combat',
          fact: {
            kind: "the province's garrison is overwhelmed as the province falls",
            provName: prov.name,
            overrunUnits: theUnitsAsTheLineNamesThem(_overrun),
          },
          audience: { actor: c.player, realms: [c.player, prov.owner].filter((x) => x != null), seen: 'battle' },
          hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          province: prov.id,
        });
        _overrun.forEach((a) => {
          recordBattleGraves(turnContext, prov, [a]);
        });
      }
      prov.garrisonArmies = [];
    }
  }
  delete c._resumeBattle; // clear the already-here flag — a genuine march later still prints its moves-into line
  delete c._openingClash;
  prov._hadBattleThisTurn = true;
  if (battle.won) {
    // Neutral defenders are no longer annihilated on a loss — survivors hold the ground and the
    // province stays contested, exactly as a trapped player defender would.
    let llLeft = 0;
    if (neutralGuard?.alive) {
      neutralGuard.armies = erodeGuardSurvivors(
        turnContext,
        neutralGuard,
        prov,
        asItsGuardReadsIt(neutralGuard.armies) ?? [],
        (line) => {
          emit(turnContext, {
            type: 'combat',
            fact: line,
            audience: { actor: c.player, realms: targets },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            province: prov.id,
          });
        },
        c.name,
      );
    } else if ((neutralGuard && !neutralGuard.alive) || llDefs.length > 0) {
      // Leaderless survivors (guard slain in the duel, or already leaderless) erode the same way.
      const _surv = erodeGuardSurvivors(
        turnContext,
        null,
        prov,
        asItsGuardReadsIt(prov.neutralDefenders) ?? [],
        (line) => {
          emit(turnContext, {
            type: 'combat',
            fact: line,
            audience: { actor: c.player, realms: targets },
            hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
            phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
            province: prov.id,
          });
        },
        c.name,
      );
      prov.neutralDefenders = _surv;
      prov.npcArmies = _surv.length;
      prov._leaderlessDefenders = _surv.length > 0;
      llLeft = _surv.length;
    }
    const guardLeft = neutralGuard?.alive ? (asItsGuardReadsIt(neutralGuard.armies) ?? []).length : 0;
    // A beaten PLAYER defender can also still be standing here — trapped (incl. a trapped Dwarven
    // Shield Fort) or trapped with nowhere to retreat. Winning the fighting does not give you
    // ground someone else's army is still occupying, so treat that exactly like surviving neutral
    // guards.
    const _hostileLeft = (asItsGuardReadsIt(G.characters) ?? []).some(
      (d) =>
        d.alive &&
        d.location === prov.id &&
        (asItsGuardReadsIt(d.armies) ?? []).length > 0 &&
        d.player != null &&
        d.player !== c.player,
    );
    // …as do hulls a beaten defender left ashore: an armed enemy force on the ground with no
    // commander over it is still an armed enemy force (2026-09-27, Toby).
    const _navalBlockUG = navalHeldIn(prov, c.player);
    if (guardLeft > 0) {
      prov._battleUnresolved = true;
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: 'a contest for a province is decided',
          contest: 'a host gathered in the province',
          whatBecomesOfTheProvince: 'still held',
          heldBy: 'its guard',
          theHost: { heroName: c.name, leaderless: asItsGuardReadsIt(c.alive) === false },
          provName: prov.name,
          guardName: theGuardStillStanding(neutralGuard).name.replace(' (wandering)', ''),
          guardUnitCount: guardLeft,
        },
        audience: { actor: c.player, realms: targets, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: prov.id,
      });
    } else if (llLeft > 0) {
      prov._battleUnresolved = true;
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: 'a contest for a province is decided',
          contest: 'a host gathered in the province',
          whatBecomesOfTheProvince: 'still held',
          heldBy: 'leaderless defenders',
          theHost: { heroName: c.name, leaderless: asItsGuardReadsIt(c.alive) === false },
          provName: prov.name,
          leaderlessUnitCount: llLeft,
        },
        audience: { actor: c.player, realms: targets, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: prov.id,
      });
    } else if (_hostileLeft) {
      prov._battleUnresolved = true;
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: 'a contest for a province is decided',
          contest: 'a host gathered in the province',
          whatBecomesOfTheProvince: 'still held',
          heldBy: 'enemy forces',
          theHost: { heroName: c.name, leaderless: asItsGuardReadsIt(c.alive) === false },
          provName: prov.name,
        },
        audience: { actor: c.player, realms: targets, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: prov.id,
      });
    } else if (_navalBlockUG.length > 0) {
      prov._battleUnresolved = true;
      emit(turnContext, {
        type: 'combat',
        fact: navalHoldLine(turnContext, prov, _navalBlockUG, theHostsRealm(player).name),
        audience: { actor: c.player, realms: targets, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: prov.id,
      });
    } else if (_garrisonUnfought && (asItsGuardReadsIt(prov.garrisonArmies) ?? []).length > 0) {
      // a third party's column was beaten, but the owner's garrison never fought — the walls still stand
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: 'a contest for a province is decided',
          contest: 'a host gathered in the province',
          whatBecomesOfTheProvince: 'still held',
          heldBy: 'its garrison',
          theHost: { heroName: c.name, leaderless: asItsGuardReadsIt(c.alive) === false },
          provName: prov.name,
          atSea: prov.terrain === 'sea',
        },
        audience: { actor: c.player, realms: targets, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: prov.id,
      });
    } else {
      claim();
      // 2026-09-21: the commander can have fallen in this battle's pre-battle duel while his
      // leaderless host fought on and won — name the host, not the corpse (same idiom as the
      // move case's PvP branch and resolveStalledBattles' theSideOfAForce).
      emit(turnContext, {
        type: 'combat',
        fact: {
          kind: 'a contest for a province is decided',
          contest: 'a host gathered in the province',
          whatBecomesOfTheProvince: 'claimed',
          theHost: { heroName: c.name, leaderless: asItsGuardReadsIt(c.alive) === false },
          provName: prov.name,
          playerName: theHostsRealm(player).name,
        },
        audience: { actor: c.player, realms: targets, seen: 'battle' },
        hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
        phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
        province: prov.id,
      });
    }
  }
  clearNavalHold(prov); // within-phase marker only — see navalHeldIn
  // OUTCOME FOR THE OWNER. A capture already reaches the dispossessed realm through
  // setProvinceOwner; the other two endings — the province held, or the fight left hanging —
  // did not, so a player who watched an enemy raise troops on their land could not tell whether
  // it had fallen. One line in their Realm Events settles it.
  if (prov.owner != null && prov.owner !== c.player) {
    const _n = (asItsGuardReadsIt(c.armies) ?? []).filter(
      (a: ArmyInABattle | null | undefined) => a && !a._died && !a._disbanded,
    ).length;
    if (battle.won)
      notifyProvinceOwner(
        turnContext,
        prov,
        {
          kind: "the province's owner learns his defenders still hold against the hero",
          cName: c.name,
          realmTag: theNameOfAPlayersRealm(turnContext, c.player),
          provName: prov.name,
          provName2: prov.name,
          heroFell: asItsGuardReadsIt(c.alive) === false,
          unitCount: _n,
        },
        c.player,
        ph,
      );
    else
      notifyProvinceOwner(
        turnContext,
        prov,
        {
          kind: "the province's owner learns the hero was beaten back",
          cName: c.name,
          realmTag: theNameOfAPlayersRealm(turnContext, c.player),
          provName: prov.name,
          provName2: prov.name,
        },
        c.player,
        ph,
      );
  }
  return true;
}

// ── Erosion of a beaten neutral guard's SURVIVORS ────
// Applied every time a guard loses a battle, not just the first. Each survivor either breaks away
// as mercenaries, drops a quality tier, or — if already Green — disbands entirely (no graves:
// nobody died, the unit simply ceased to exist).
export const GUARD_FLIGHT_CHANCE = 0.35;
// Of the survivors who hold their ground (don't flee), only SOME are bloodied down a quality
// tier; the rest fight on unbowed.
export const GUARD_DEMOTE_CHANCE = 0.5;
// victor (2026-10-12, Toby: who beat whom): the name of the commander whose host beat them; each line says so.
// Since P1-12d27 each survivor's line is one kind, a beaten guard's surviving unit's fate (its event's), its fate a
// slug, the disbanding among them.
export function erodeGuardSurvivors(
  turnContext: TurnContext,
  guard: { readonly name: string } | null | undefined,
  prov: Province,
  survivors: readonly Army[] | null | undefined,
  tellASurvivingUnitsFate: (line: ABeatenGuardsSurvivingUnitsFate) => void,
  victor: string | null | undefined,
): Army[] {
  const { G } = turnContext;
  const kept: Army[] = [];
  // The victor's name, " (wandering)" cut; the prose writes "<name>'s host" (plan P1-12d24).
  const _vh = victor ? victor.replace(' (wandering)', '') : null;
  (survivors ?? []).forEach((a) => {
    // The same guard as the lines' facts hold him (plan P1-12d24): by his name, or the defenders with none to give.
    const theGuard: TheDefendersOfAProvince = guard?.name
      ? { kind: 'the defenders led by their guard', guardName: guard.name.replace(' (wandering)', '') }
      : { kind: 'defenders with no guard to name them' };
    if (kcRng() < GUARD_FLIGHT_CHANCE) {
      G.mercenaries = asItsGuardReadsIt(G.mercenaries) ?? [];
      G.mercenaries.push({
        type: a.type,
        quality: a.quality,
        race: a.race || 'Unknown',
        unitName: a.unitName,
        location: prov.id,
        isSea: SEA_TYPES.has(a.type),
        id: newMercId(turnContext),
      });
      tellASurvivingUnitsFate({
        kind: "a beaten guard's surviving unit's fate",
        fate: 'breaks ranks and flees as mercenaries',
        theUnit: {
          kind: 'a unit named with its quality',
          owner: theGuard,
          unitName: a.unitName,
          type: a.type,
          quality: a.quality,
        },
        victorsHost: _vh,
        provName: prov.name,
      }); // unified unit naming
      return;
    }
    // Only some of those who stay are worn down a tier; the rest hold at their current quality.
    if (kcRng() < GUARD_DEMOTE_CHANCE) {
      const _q0 = a.quality;
      if (demoteOrDisband(a)) {
        tellASurvivingUnitsFate({
          kind: "a beaten guard's surviving unit's fate",
          fate: 'has had enough and disbands',
          theGuard,
          unitName: a.unitName,
          unitType: a.type,
        });
        return;
      }
      tellASurvivingUnitsFate({
        kind: "a beaten guard's surviving unit's fate",
        fate: 'loses heart and falls a tier',
        theUnit: {
          kind: 'a unit named with its quality',
          owner: theGuard,
          unitName: a.unitName,
          type: a.type,
          quality: _q0,
        },
        itsQualityAfter: a.quality,
        victorsHost: _vh,
        theGuard,
      });
      kept.push(a);
      return;
    }
    tellASurvivingUnitsFate({
      kind: "a beaten guard's surviving unit's fate",
      fate: 'holds its ground unbroken',
      theUnit: {
        kind: 'a unit named with its quality',
        owner: theGuard,
        unitName: a.unitName,
        type: a.type,
        quality: a.quality,
      },
      victorsHost: _vh,
      theGuard,
    });
    kept.push(a);
  });
  return kept;
}
