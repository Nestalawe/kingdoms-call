import { recordBattleGraves } from '../graves.js';
import { markOrcAttackWin } from '../units/drill-and-spoils.js';
import { describeArmy } from '../dice-and-army-names.js';
import { narrText, notifyProvinceOwner, notifyTarget, realmTag } from '../turn/log-line-helpers.js';
import { noteBattleLoss } from '../turn/mercenary-ids-and-battle-records.js';
import { applyEvilConquest, areAllied, areEnemies, setProvinceOwner } from '../realms/relations-and-captures.js';
import { creditBattle } from '../titles/title-holders-and-battle-merit.js';
import { clearNavalHold, navalHeldIn, navalHoldLine } from '../units/sea-lift-stranding-and-retreats.js';
import { refreshMovePool } from '../units/movement-pools.js';
import { commandHandoverLine, pickBattleCommander, syncLeaderCopy } from './best-commander.js';
import { emitBattle } from './battle-report-lines-and-force-markers.js';
import { combatVsNPC } from './battles-against-province-defenders.js';
import { combatVsChar } from './battles-between-heroes.js';
import { defendAnswerUnitGain } from '../units/defend-ride-outs-ambushes-and-reinforcements.js';
import { erodeGuardSurvivors } from './stalled-battles-and-beaten-guards.js';

// ── A HOST GAINED IN A PROVINCE (plan P1-08i3: lifted out of resolveTurn) ────
// When a character gains units in a province he doesn't own (raised, summoned, hired, taken over), the new host is
// settled the same phase: a battle against any enemy or neutral armies there, or the province taken if none stand in
// the way (resolveUnitGainInProvince). While the phase's non-moving orders are still resolving, a host a Defend general
// would answer waits in the queue (the context's _tier0Open and _unitGainQueue, read and written as
// turnContext.<name>, as resolveTurn reads them). It takes the turn's context first (src/engine/turn/context.js).
// when a character GAINS units in a province they don't own (Skeletal Armies, Elemental Summon,
// action-phase Control Undead, mercenary hire, …), the new force is resolved the same
// phase: enemy OR neutral armies present → a battle is fought; none present → the character takes
// control. Enemy and neutral armies are treated the same. Returns true if a battle was fought.
export function resolveUnitGainInProvince(turnContext, c, prov, ph) {
  const { log, G } = turnContext;
  if (!c || !prov || c.player == null) return false;
  if (prov.owner === c.player) return false; // already ours — nothing to contest
  if ((c.armies || []).length === 0) return false; // no force present to fight or hold
  // DIPLOMACY: a force raised inside an ally's or a neutral's province cannot seize it or start a
  // war — it simply stands there. Only enemy-owned (or unowned) ground can be contested this way.
  if (prov.owner != null && prov.owner !== c.player && !areEnemies(turnContext, c.player, prov.owner)) {
    // The owner saw the troops appear (public cast line) — tell them what it means: nothing, yet.
    const _rel = areAllied(turnContext, c.player, prov.owner) ? 'your realms are allied' : 'your realms are not at war';
    notifyProvinceOwner(
      turnContext,
      prov,
      `👁 ${c.name}${realmTag(turnContext, c.player)} now leads ${(c.armies || []).length} unit${(c.armies || []).length !== 1 ? 's' : ''} inside your province of ${prov.name}, but makes no move against it — ${_rel}. ${prov.name} remains yours.`,
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
    log(
      'system',
      `${c.name}'s new host is still forming up in ${prov.name} — whether the province can be taken will be settled before the season's marches begin.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
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
      (d.armies || []).length > 0,
  );
  // the owner's own commanders lead the defence of their ground ahead of any third party
  const enemyChar = _armedFoesHere.find((d) => d.player === prov.owner) || _armedFoesHere[0];
  const neutralGuard = G.characters.find(
    (d) => d.alive && d.player === null && d.location === prov.id && (d.armies || []).length > 0 && !d._justDefeated,
  );
  const garrison = prov.owner != null && prov.owner !== c.player ? prov.garrisonArmies || [] : [];
  // A guard slain in an earlier pre-battle duel leaves his surviving troops as a LEADERLESS
  // neutral garrison (prov._leaderlessDefenders) — they contest the province like anyone else.
  const llDefs = prov.owner === null && prov._leaderlessDefenders ? prov.neutralDefenders || [] : [];
  const hasDefenders =
    !!enemyChar || (neutralGuard && (neutralGuard.armies || []).length > 0) || garrison.length > 0 || llDefs.length > 0;

  const claim = () => {
    // remember who lost this province to a force that materialised here this phase, so a
    // neighbouring general on Defend may still ride out to contest it (see
    // runDefendMaterializedReactions).
    if (prov.owner != null && prov.owner !== c.player)
      prov._takenByUnitGain = { turn: G.turn, ph: ph, from: prov.owner };
    G.players.forEach((p, pi) => {
      if (pi !== c.player) {
        const i = (p.provinces || []).indexOf(prov.id);
        if (i > -1) p.provinces.splice(i, 1);
      }
    });
    setProvinceOwner(turnContext, prov, c.player, c, ph);
    prov.neutralDefenders = [];
    prov.npcArmies = 0;
    delete prov._leaderlessDefenders;
    if (!player.provinces.includes(prov.id)) player.provinces.push(prov.id);
    applyEvilConquest(turnContext, c, prov, player); // Evil doctrine on this capture path (was skipped)
    if (!prov.visitedBy) prov.visitedBy = [];
    if (!prov.visitedBy.includes(c.player)) prov.visitedBy.push(c.player);
  };

  if (!hasDefenders) {
    claim();
    log(
      'combat',
      c._warFront
        ? `No one stands to defend ${prov.name} — ${c.name} takes control of it for ${player.name}!`
        : `With fresh troops now at their back, ${c.name} takes control of ${prov.name} for ${player.name}!`,
      { actor: c.player, targets: [], provinceId: prov.id, public: true },
    );
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
  let battle = null,
    targets = [c.player];
  let _garrisonUnfought = false;
  if (enemyChar) {
    targets = [c.player, enemyChar.player];
    const defReinf = G.characters.filter(
      (d) =>
        d.alive &&
        d.id !== enemyChar.id &&
        d.player === enemyChar.player &&
        d.location === prov.id &&
        (d.armies || []).length > 0,
    );
    // The standing garrison rallies to a commander of its own realm, as it does when an invader
    // marches in (move handler) — it shares the line, the casualties and the retreat.
    const _garHere = prov.owner != null && prov.owner === enemyChar.player ? [...(prov.garrisonArmies || [])] : [];
    _garHere.forEach((a) => {
      a._fromGarrison = true;
    });
    _garrisonUnfought = _garHere.length === 0 && garrison.length > 0; // a third party fought; the owner's garrison did not
    const _rbPooled = [...(enemyChar.armies || []), ...defReinf.flatMap((d) => d.armies || []), ..._garHere];
    const _rbP = pickBattleCommander(turnContext, enemyChar, defReinf, _rbPooled, prov, false); // best defender commands
    const combinedDef = { ..._rbP.leader, armies: _rbPooled };
    battle = combatVsChar(turnContext, c, combinedDef, prov);
    syncLeaderCopy(turnContext, _rbP.leader, combinedDef);
    creditBattle(turnContext, c, _rbP.leader, battle, prov);
    if (battle && Array.isArray(battle.narrative)) {
      const _form = [];
      if (c._openingClash && !c._warFront)
        _form.push(
          `➡️ ${c.name}${realmTag(turnContext, c.player)} turns a newly-gathered host on ${prov.name}, held by ${prov.owner != null && G.players[prov.owner] ? G.players[prov.owner].name : G.players[enemyChar.player]?.name || enemyChar.name} — a battle is initiated.`,
        );
      if (_defRiders.length > 0)
        _form.push(
          `🛡 ${_defRiders.map((d) => d.name).join(' and ')} ${_defRiders.length > 1 ? 'were' : 'was'} keeping watch over ${prov.name} and ${_defRiders.length > 1 ? 'are' : 'is'} already in the line when ${c.name}'s ${c._warFront ? 'host turns on the province' : 'new host forms up'} — ${prov.name} is defended, not retaken.`,
        );
      if (defReinf.length > 0)
        _form.push(
          `${enemyChar.name} is reinforced by ${defReinf.map((d) => d.name).join(', ')} in the defence of ${prov.name}!`,
        );
      if (_garHere.length > 0)
        _form.push(
          `🛡 The standing troops of ${prov.name} rally to ${_rbP.leader.name}: the garrison (${_garHere.length} unit${_garHere.length !== 1 ? 's' : ''} — ${describeArmy(_garHere)}) joins the defence.`,
        );
      if (_rbP.changed) _form.push(commandHandoverLine(_rbP.leader, enemyChar, prov.name));
      if (_form.length) {
        const _bi = battle.narrative.findIndex(
          (l) => typeof narrText(l) === 'string' && String(narrText(l)).includes('Battle for '),
        );
        battle.narrative.splice(_bi >= 0 ? _bi : 0, 0, ..._form);
      }
    }
    emitBattle(turnContext, battle, prov, ph, targets, {
      actor: c.player,
      charIds: [c.id, enemyChar.id, ...defReinf.map((d) => d.id)],
    }); // item 5; 2026-09-09 item 1
    [enemyChar, ...defReinf]
      .filter((d) => d.id !== _rbP.leader.id)
      .forEach((d) =>
        notifyTarget(
          turnContext,
          d,
          d.alive === false
            ? `⚔ ${d.name} stood in the battle line beside ${_rbP.leader.name} in the defence of ${prov.name}, and fell there — the full account is under ${_rbP.leader.name}.`
            : `⚔ ${d.name} stands in the battle line beside ${_rbP.leader.name} in the defence of ${prov.name} — the full account is under ${_rbP.leader.name}.`,
          ph,
          'combat',
        ),
      );
    c.armies = (c.armies || []).filter((a) => !a._died && !a._disbanded);
    [enemyChar, ...defReinf].forEach((d) => {
      d.armies = (d.armies || []).filter((a) => !a._died && !a._disbanded);
    });
    if (battle && battle.won) [enemyChar, ...defReinf].forEach((d) => noteBattleLoss(turnContext, d.id)); // every beaten defender's watch is broken
    // 2026-09-27 (Toby): hulls the beaten defender left ashore (navalSplitRetreat) are sitting in
    // prov.garrisonArmies but are not the standing garrison — keep them out of the sweep below.
    const _navalHeldUG = navalHeldIn(prov);
    if (_navalHeldUG.length) {
      // same pooled-copy split as the move handler: hulls left ashore come off the real
      // commanders' lists, or they would march away and hold the ground at the same time.
      [c, enemyChar, ...defReinf].forEach((d) => {
        if (!d || !Array.isArray(d.armies)) return;
        const _n = d.armies.length;
        d.armies = d.armies.filter((a) => _navalHeldUG.indexOf(a) < 0);
        if (d.armies.length !== _n && typeof refreshMovePool === 'function') refreshMovePool(turnContext, d);
      });
    }
    const _garSurv = _garHere.filter((a) => !a._died && !a._disbanded && _navalHeldUG.indexOf(a) < 0);
    _garSurv.forEach((a) => {
      delete a._fromGarrison;
    });
    if (_garHere.length > 0) prov.garrisonArmies = _navalHeldUG.concat(_garSurv);
    // Same pooled-copy sync as the move handler: combatVsChar retreats the COPY, so the real
    // defenders must follow it or they are left as ghosts in a province they have fled.
    if (combinedDef.location !== enemyChar.location) {
      const _defFellBackTo = G.world.provinces[combinedDef.location];
      if (_defFellBackTo) {
        if (!_defFellBackTo.characters) _defFellBackTo.characters = [];
        [enemyChar, ...defReinf].forEach((d) => {
          if (!d.alive) {
            return;
          } // a commander slain in the pre-battle duel stays where they fell
          prov.characters = (prov.characters || []).filter((id) => id !== d.id);
          if (!_defFellBackTo.characters.includes(d.id)) _defFellBackTo.characters.push(d.id);
          d.location = _defFellBackTo.id;
          d.locationName = _defFellBackTo.name;
          // forced retreat/fall-back does NOT consume move points.
        });
        // the rallied garrison has no commander of its own — it falls back with the beaten heroes
        if (_garSurv.length > 0) {
          _defFellBackTo.garrisonArmies = (_defFellBackTo.garrisonArmies || []).concat(_garSurv);
          prov.garrisonArmies = _navalHeldUG.slice(); // stranded hulls cannot take to the road
          log(
            'combat',
            `The standing troops of ${prov.name} fall back to ${_defFellBackTo.name} with ${enemyChar.name} rather than be left to the enemy.`,
            { actor: enemyChar.player, targets, provinceId: _defFellBackTo.id, public: true },
          );
        }
      }
    }
    // Contest left hanging with the defending hero still here: the garrison fights on at his side
    // through every resume, and settleRalliedGarrisons() returns it to its post afterwards.
    if (
      prov._battleUnresolved &&
      enemyChar.alive &&
      enemyChar.location === prov.id &&
      (prov.garrisonArmies || []).length > 0 &&
      prov.owner === enemyChar.player
    ) {
      const _join = prov.garrisonArmies;
      _join.forEach((a) => {
        delete a._fromGarrison;
        a._garrisonOf = prov.id;
      });
      enemyChar.armies = (enemyChar.armies || []).concat(_join);
      prov.garrisonArmies = [];
      if (typeof refreshMovePool === 'function') refreshMovePool(turnContext, enemyChar);
      log(
        'combat',
        `🛡 The standing troops of ${prov.name} fall in with ${enemyChar.name} and fight on at their side as the battle continues.`,
        { actor: enemyChar.player, targets, provinceId: prov.id, public: true },
      );
    }
  } else if (neutralGuard) {
    // Fight the guard's OWN armies, then sync survivors back to him — the same swap the move case
    // uses. Without it this path fought prov.neutralDefenders (stale intel) instead.
    const _savedDefs = prov.neutralDefenders;
    prov.neutralDefenders = [...(neutralGuard.armies || [])];
    battle = combatVsNPC(turnContext, c, prov, neutralGuard);
    creditBattle(turnContext, c, null, battle, prov); // a neutral chieftain's guard pays merit here too
    if (neutralGuard.alive) {
      neutralGuard.armies = [...(prov.neutralDefenders || [])];
      prov.neutralDefenders = _savedDefs;
    } else {
      // Slain in this battle's pre-battle duel — survivors stay on the province as a leaderless
      // garrison; the corpse leads nothing.
      neutralGuard.armies = [];
      neutralGuard._isNeutralGuard = false;
      prov.npcArmies = (prov.neutralDefenders || []).length;
      prov._leaderlessDefenders = (prov.neutralDefenders || []).length > 0;
    }
    emitBattle(turnContext, battle, prov, ph, [c.player], { actor: c.player }); // item 5
  } else if (llDefs.length > 0) {
    // Leaderless neutral garrison — fights without commander skills, straight off the province.
    battle = combatVsNPC(turnContext, c, prov, null);
    creditBattle(turnContext, c, null, battle, prov); // a leaderless neutral guard still pays merit
    prov._leaderlessDefenders = (prov.neutralDefenders || []).length > 0;
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
        log(
          'combat',
          `🛡 The garrison of ${prov.name} is overwhelmed as the province falls — ${_overrun.map((a) => (a.unitName ? a.unitName + ' (' + a.type + ', ' + a.quality + ')' : a.quality + ' ' + a.type)).join(', ')} ${_overrun.length === 1 ? 'is' : 'are'} cut down defending the walls.`,
          {
            actor: c.player,
            targets: [c.player, prov.owner].filter((x) => x != null),
            provinceId: prov.id,
            public: true,
          },
        );
        _overrun.forEach((a) => recordBattleGraves(turnContext, prov, [a]));
      }
      prov.garrisonArmies = [];
    }
  }
  delete c._resumeBattle; // clear the already-here flag — a genuine march later still prints its moves-into line
  delete c._openingClash;
  prov._hadBattleThisTurn = true;
  if (battle && battle.won) {
    // Neutral defenders are no longer annihilated on a loss — survivors hold the ground and the
    // province stays contested, exactly as a trapped player defender would.
    let llLeft = 0;
    if (neutralGuard && neutralGuard.alive) {
      neutralGuard.armies = erodeGuardSurvivors(
        turnContext,
        neutralGuard,
        prov,
        neutralGuard.armies || [],
        (line) => log('combat', line, { actor: c.player, targets, provinceId: prov.id }),
        c.name,
      );
    } else if ((neutralGuard && !neutralGuard.alive) || llDefs.length > 0) {
      // Leaderless survivors (guard slain in the duel, or already leaderless) erode the same way.
      const _surv = erodeGuardSurvivors(
        turnContext,
        null,
        prov,
        prov.neutralDefenders || [],
        (line) => log('combat', line, { actor: c.player, targets, provinceId: prov.id }),
        c.name,
      );
      prov.neutralDefenders = _surv;
      prov.npcArmies = _surv.length;
      prov._leaderlessDefenders = _surv.length > 0;
      llLeft = _surv.length;
    }
    const guardLeft = neutralGuard && neutralGuard.alive ? (neutralGuard.armies || []).length : 0;
    // A beaten PLAYER defender can also still be standing here — trapped (incl. a trapped Dwarven
    // Shield Fort) or trapped with nowhere to retreat. Winning the fighting does not give you
    // ground someone else's army is still occupying, so treat that exactly like surviving neutral
    // guards.
    const _hostileLeft = (G.characters || []).some(
      (d) =>
        d.alive && d.location === prov.id && (d.armies || []).length > 0 && d.player != null && d.player !== c.player,
    );
    // …as do hulls a beaten defender left ashore: an armed enemy force on the ground with no
    // commander over it is still an armed enemy force (2026-09-27, Toby).
    const _navalBlockUG = navalHeldIn(prov, c.player);
    if (guardLeft > 0) {
      prov._battleUnresolved = true;
      log(
        'combat',
        `⚔ ${c.alive === false ? `${c.name}'s leaderless host` : c.name} has the better of the fighting in ${prov.name}, but ${neutralGuard.name.replace(' (wandering)', '')} still holds the field with ${guardLeft} unit${guardLeft !== 1 ? 's' : ''} — the province is not yet taken.`,
        { actor: c.player, targets, provinceId: prov.id, public: true },
      );
    } else if (llLeft > 0) {
      prov._battleUnresolved = true;
      log(
        'combat',
        `⚔ ${c.alive === false ? `${c.name}'s leaderless host` : c.name} has the better of the fighting in ${prov.name}, but ${llLeft} leaderless defending unit${llLeft !== 1 ? 's' : ''} still hold the field — the province is not yet taken.`,
        { actor: c.player, targets, provinceId: prov.id, public: true },
      );
    } else if (_hostileLeft) {
      prov._battleUnresolved = true;
      log(
        'combat',
        `⚔ ${c.alive === false ? `${c.name}'s leaderless host` : c.name} has the better of the fighting in ${prov.name}, but enemy forces still hold their ground — the province is not yet taken.`,
        { actor: c.player, targets, provinceId: prov.id, public: true },
      );
    } else if (_navalBlockUG.length > 0) {
      prov._battleUnresolved = true;
      log('combat', navalHoldLine(turnContext, prov, _navalBlockUG, player.name), {
        actor: c.player,
        targets,
        provinceId: prov.id,
        public: true,
      });
    } else if (_garrisonUnfought && (prov.garrisonArmies || []).length > 0) {
      // a third party's column was beaten, but the owner's garrison never fought — the walls still stand
      log(
        'combat',
        `⚔ ${c.alive === false ? `${c.name}'s leaderless host` : c.name} has the better of the fighting in ${prov.name}, but its garrison still ${prov.terrain === 'sea' ? 'holds these waters' : 'mans the walls'} — the province is not yet taken.`,
        { actor: c.player, targets, provinceId: prov.id, public: true },
      );
    } else {
      claim();
      // 2026-09-21: the commander can have fallen in this battle's pre-battle duel while his
      // leaderless host fought on and won — name the host, not the corpse (same idiom as the
      // move case's PvP branch and resolveStalledBattles' forceLabel).
      log(
        'combat',
        `${c.alive === false ? `${c.name}'s leaderless host` : c.name} overcomes the defenders and claims ${prov.name} for ${player.name}!`,
        { actor: c.player, targets, provinceId: prov.id, public: true },
      );
    }
  }
  clearNavalHold(prov); // within-phase marker only — see navalHeldIn
  // OUTCOME FOR THE OWNER. A capture already reaches the dispossessed realm through
  // setProvinceOwner; the other two endings — the province held, or the fight left hanging —
  // did not, so a player who watched an enemy raise troops on their land could not tell whether
  // it had fallen. One line in their Realm Events settles it.
  if (prov.owner != null && prov.owner !== c.player && battle) {
    const _n = (c.armies || []).filter((a) => a && !a._died && !a._disbanded).length;
    if (battle.won)
      notifyProvinceOwner(
        turnContext,
        prov,
        `⚔ ${c.name}${realmTag(turnContext, c.player)} fought for ${prov.name} this phase and had the better of it, but your defenders still hold the ground — ${prov.name} is not yet taken. ${c.alive === false ? `${c.name} fell in the fighting; his leaderless host` : c.name} stands there with ${_n} unit${_n !== 1 ? 's' : ''}.`,
        c.player,
        ph,
      );
    else
      notifyProvinceOwner(
        turnContext,
        prov,
        `🛡 ${c.name}${realmTag(turnContext, c.player)} fought for ${prov.name} this phase and was beaten back — ${prov.name} remains yours.`,
        c.player,
        ph,
      );
  }
  return true;
}
