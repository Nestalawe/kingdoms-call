// ── THE BOTS' PLAN: CONCESSIONS, MOVEMENT, MUSTER, ECONOMY, ACTIONS, SPRING ORDERS, HYGIENE, THE RECKONING, AND THE
// DUEL FORECAST (plan P1-08l2: lifted out of resolveTurn) ─────────────────────────────────────────────────────────────
// Bot realms send no orders, so this is where their turn is decided. resolveTurn calls the plan once a turn, before
// the first phase: after the move pools, the turn's trackers and the save's sweeps, and before every hero still
// without orders is set to Defend. The passes, in this order (each a top-level function in src/engine/bots/): a bot
// with no province left concedes; movement (with the duel forecast for its hunters, and each company's strength on
// each terrain); the muster (hosts in contact take the war chest first, outmatched ones withdraw); the economy; the
// idle heroes' actions; the Spring orders; the order hygiene; and a dominant bot king's call of the Reckoning, added
// to the realms' calls (turnContext.reckoningCalls) that victory reads after the phases.
// The duel forecast fights copies of the hunter and his quarry (ids -1 and -2) `n` times (20 by default) with the
// engine's own personal combat and gives the share won and the share in which the hunter fell; while it runs no skill
// can rise (turnContext._pcSimulating). The plan hands it to the movement pass with the turn's context.
// Each takes the turn's context (src/engine/turn/context.js) first; their lines keep resolveTurn's indent (plan
// P1-08's Decisions).
function botHuntersDuelForecastFoughtOnCopiesOfBothHeroes(turnContext, hunter, quarry, n) {
  // 2026-09-28: a forecast, not a fight — experience is muted exactly as in simulateLairOdds (the copies carry
  // ids −1/−2, so no real hero ever gained from it, but every simulated win still rolled a wasted check).
  const _prevSim = turnContext._pcSimulating;
  turnContext._pcSimulating = true;
  try {
    let win = 0,
      felled = 0;
    n = n || 20;
    for (let i = 0; i < n; i++) {
      const a = JSON.parse(JSON.stringify(hunter)),
        b = JSON.parse(JSON.stringify(quarry));
      a.id = -1;
      b.id = -2;
      delete a._sgLog;
      delete b._sgLog;
      a.encounterPlan = { tactics: autoEncounterPlan(turnContext, a), notes: '', _auto: true };
      if (!(b.encounterPlan && Array.isArray(b.encounterPlan.tactics) && b.encounterPlan.tactics.length))
        b.encounterPlan = { tactics: autoEncounterPlan(turnContext, b), notes: '', _auto: true };
      const COMBAT_ONLY = COMBAT_ONLY_TACTICS;
      const filt = (pl) => (pl || ['ME']).filter((t) => COMBAT_ONLY.has(String(t).split(':')[0].toUpperCase()));
      const A = pcCharCombatant(turnContext, a),
        B = pcCharCombatant(turnContext, b);
      A.tactics = filt(a.encounterPlan.tactics);
      B.tactics = filt(b.encounterPlan.tactics);
      if (!A.tactics.length) A.tactics = ['ME'];
      if (!B.tactics.length) B.tactics = ['ME'];
      const res = resolvePersonalCombat(turnContext, A, B, { maxRounds: 20 });
      if (res.winner === A) win++;
      if (res.aHp <= 0 && res.winner !== A) felled++;
    }
    return { win: win / n, felled: felled / n };
  } catch (e) {
    return null;
  } finally {
    turnContext._pcSimulating = _prevSim;
  }
}

function botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning(turnContext) {
  const { G, _botPlayerIdx, log, reckoningCalls } = turnContext;
  // Phase 3 (pre) — item 2: any bot realm that has lost its last province concedes before it plans
  // a turn.
  runBotConcessions(G, _botPlayerIdx, log);
  runBotMovement(G, _botPlayerIdx, {
    duelSim: (...a) => botHuntersDuelForecastFoughtOnCopiesOfBothHeroes(turnContext, ...a),
    terrainMult: (t, tr) => terrainMod(t, tr) * seaPenalty(t, tr),
  });
  // Phase 3b — economy: holders (characters not moving) in owned provinces spend the treasury on
  // sustainable reinforcements (and opportunistic hires). Must run AFTER movement so movers are
  // skipped.
  runBotPhaseOne(G, _botPlayerIdx, 'muster'); // 2026-09-29: hosts in contact claim the chest first (and outmatched war-front hosts withdraw)
  runBotEconomy(G, _botPlayerIdx);
  // Phase 3c — character actions: any bot character still idle (didn't move or recruit) trains,
  // heals, or explores instead of sitting on Defend. Must run AFTER movement + economy.
  runBotActions(G, _botPlayerIdx);
  // Phase 3d — PHASE-ONE PASS (2026-09-29): what must happen in Spring, before any enemy can move, goes first.
  runBotPhaseOne(G, _botPlayerIdx, 'order');
  // Phase 3e — ORDER HYGIENE (2026-09-29): drop bot orders that cannot work (capped practice, casts past the limit,
  // dead hires, skeletons handed to the living) and refill those phases, training together where possible.
  runBotOrderHygiene(G, _botPlayerIdx);

  // Phase 5 — a dominant bot king Calls the Reckoning (adds itself to the calls processed below).
  runBotReckoning(G, _botPlayerIdx, reckoningCalls);
}
