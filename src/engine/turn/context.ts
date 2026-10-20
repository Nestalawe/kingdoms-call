// ── THE TURN'S CONTEXT (plan P1-08a, 2026-10-18) ────
// What the helpers lifted out of resolveTurn (src/engine/run-turn.ts) used to reach through its closure: the state
// being changed, the GM's log and its collectors, and the phase being resolved. resolveTurn makes one each turn, just
// after it parses the save, and passes it first to every lifted helper that needs it; a helper that needs none keeps
// its arguments. An object (the state, a collector) joins it by reference. A value resolveTurn changes as the turn goes
// on (_logCtx, _currentPhase, _afterPhases) is read and written as turnContext.<name> everywhere, so every reader sees
// the value as it is now. No dice and no clock: the dice are still kcRng's (plan P1-08m).
//   G                  the game's state, parsed: the working copy the turn changes
//   freshPlayers       the game's slot rows, as loaded
//   expectedTurnToRun  the turn being run
//   turnLog            the GM's log of the turn, which log() fills
//   log(type, text, meta)  files one line in turnLog
// resolveTurn adds the rest as it reaches them: _mercIds, _tel, battleCommanders, fieldBattlePhase, _logCtx,
// _currentPhase, _afterPhases, and more as each lifted area needs them (docs/ARCHITECTURE.md lists them). The lifted code keeps resolveTurn's two-space indent (plan P1-08's Decisions).
export function createTurnContext(G, freshPlayers, expectedTurnToRun) {
  const turnContext = { G, freshPlayers, expectedTurnToRun, turnLog: [] };
  const log = (type, text, meta = {}) => {
    const { turnLog } = turnContext;
    turnLog.push({
      type,
      text,
      actor: meta.actor ?? null,
      targets: meta.targets || [],
      provinceId: meta.provinceId ?? null,
      public: meta.public ?? false,
      spy: meta.spy ?? false,
      system: meta.system ?? false,
      armyEstimate: meta.armyEstimate ?? null,
      charId: meta.charId ?? turnContext._logCtx.charId, // which character's action this is
      charIds: meta.charIds || null, // extra characters this entry pertains to — the
      // report files it into WHICHEVER of the viewer's own
      // characters it names (e.g. a duel shows in BOTH
      // combatants' sections, each for its own owner).
      // 2026-09-23 (Toby item 10): a line logged DURING a phase but outside any character's order
      // (the lone-defender ambush, Defend ride-outs, end-of-phase sweeps) had no phase at all, and
      // the player's Chronicle files an unphased line under SPRING. Perrin the Halved, ambushed and
      // killed at the end of LATE SUMMER, therefore read as struck down in Spring and then marching
      // on through both summers. _currentPhase is the phase being resolved, so it is the fallback.
      phase:
        meta.phase ?? turnContext._logCtx.phase ?? turnContext._currentPhase ?? (turnContext._afterPhases ? 99 : null), // which phase (0–4, or 99 = End of Turn)
      pinNotice: meta.pinNotice ?? false, // hoist to the top of the char's phase report
      env: meta.env ?? false, // environmental province event (earthquake,
      // flood, plague, blessing, part-sea …) → Province Reports
      battleId: meta.battleId ?? null, // 2026-09-23d: which battle this line belongs to (emitBattle)
      bTier: meta.bTier ?? null, // 'k' key · 'd' detail · 't' tally · 's' onlooker summary
      gameEnd: meta.gameEnd ?? false, // 2026-09-28 (Toby item 6): end-of-game announcement / standings → top of the player report
    });
    console.log(`[${type}] ${text}`);
  };
  turnContext.log = log;
  return turnContext;
}
