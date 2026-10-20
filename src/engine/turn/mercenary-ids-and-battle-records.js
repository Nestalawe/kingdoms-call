// ── MERCENARY BAND IDS AND WHO FOUGHT (plan P1-08a: lifted out of resolveTurn) ────
// A new band's id, and the turn's records of who fought where: the commanders of each battle, the phase each hero last
// stood in a field battle, and the Defend watches a battle fulfils. Each takes the turn's context first
// (src/engine/turn/context.js).
const newMercId = (turnContext) => `merc_t${turnContext.expectedTurnToRun}_${++turnContext._mercIds.n}`;

const recordBattleCmdrs = (turnContext, provId, ph, ids) => {
  const { battleCommanders } = turnContext;
  if (provId == null || ph == null || ph < 0 || ph > 4) return;
  const k = provId + '@' + ph;
  const arr = battleCommanders[k] || (battleCommanders[k] = []);
  ids.forEach((id) => {
    if (id != null && !arr.includes(id)) arr.push(id);
  });
};

function noteFieldBattle(turnContext, atk, def, prov) {
  const { fieldBattlePhase, G } = turnContext;
  const ph = turnContext._currentPhase,
    ids = [];
  if (ph == null || !prov) return ids;
  const sides = new Set([atk && atk.player, def && def.player].filter((x) => x != null));
  const add = (id) => {
    if (id == null) return;
    fieldBattlePhase[id] = ph;
    if (!ids.includes(id)) ids.push(id);
  };
  [atk, def].forEach((x) => {
    if (x) add(x.id);
  });
  (G.characters || []).forEach((ch) => {
    if (ch && ch.alive && ch.location === prov.id && sides.has(ch.player) && (ch.armies || []).length > 0) add(ch.id);
  });
  return ids;
}
// 2026-10-08 (Toby item 15): A DEFEND ORDER IS DONE ONCE IT HAS BROUGHT ITS GENERAL TO BATTLE. Every
// character who stood in the battle with a watch set — the general who rode out, one whose own
// province was attacked, or one pooled in alongside — keeps no further watch, win or lose (a loss
// already broke it: noteBattleLoss). Only a Defend order given for a LATER phase sets a new one; the
// same phase's own Defend order, which resolves after the battle, must not re-arm it.
function completeDefendWatches(turnContext, ids, narrative) {
  const { G, log } = turnContext;
  const ph = turnContext._currentPhase;
  (ids || []).forEach((id) => {
    const real = (G.characters || []).find((x) => x && x.id === id);
    if (!real || !real._defend) return;
    const wasOn = !!real._defend.active;
    real._defend.active = false;
    real._defendSpent = { turn: G.turn, ph };
    if (wasOn && real.alive !== false) {
      const msg = `🛡 ${real.name}'s Defend order is fulfilled — the threat has been met in battle, and they keep no further watch unless ordered to Defend again.`;
      if (narrative) narrative.push(msg);
      else
        log('move', msg, {
          actor: real.player,
          targets: [real.player],
          charId: real.id,
          provinceId: real.location ?? null,
        });
    }
  });
}
const defendSpentThisPhase = (turnContext, c, ph) =>
  !!(c && c._defendSpent && c._defendSpent.turn === turnContext.G.turn && c._defendSpent.ph === ph);

// ── LIFTED OUT OF resolveTurn (plan P1-08c) ── a defeat breaks a general's Defend watch for the rest of the turn. It
// takes the turn's context first (src/engine/turn/context.js).
function noteBattleLoss(turnContext, charId, narrative) {
  const { G, log } = turnContext;
  const real = (G.characters || []).find((x) => x && x.id === charId);
  if (!real || !real._defend || !real._defend.active) return;
  real._defend.active = false;
  const msg = `${real.name}'s defensive watch is broken by this defeat — they will hold no further ground this turn.`;
  if (narrative) narrative.push(msg);
  else
    log('move', msg, {
      actor: real.player,
      targets: [real.player],
      charId: real.id,
      provinceId: real.location ?? null,
    }); // file under the beaten general, not whoever's order was resolving
}
