// ── MERCENARY BAND IDS AND WHO FOUGHT (plan P1-08a: lifted out of resolveTurn) ────
// A new band's id, and the turn's records of who fought where: the commanders of each battle, the phase each hero last
// stood in a field battle, and the Defend watches a battle fulfils. Each takes the turn's context first
// (src/engine/turn/context.ts). A watch's end is a fact (since P1-12d15: the-facts-a-defend-watch-met-in-battle-lines-
// record.ts), its words written in the views.
import type { Character, Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from './context.ts';
import type { NarrativeLine } from './events-and-their-audiences.ts';
import { emit, narrate, THE_PHASE_THE_LINE_IS_WRITTEN_IN } from './events-and-their-audiences.ts';
export const newMercId = (turnContext: TurnContext) =>
  `merc_t${turnContext.expectedTurnToRun}_${++turnContext._mercIds.n}`;

export const recordBattleCmdrs = (
  turnContext: TurnContext,
  provId: number | null | undefined,
  ph: number | null | undefined,
  ids: (number | null | undefined)[],
) => {
  const { battleCommanders } = turnContext;
  if (provId == null || ph == null || ph < 0 || ph > 4) return;
  const k = provId + '@' + ph;
  const arr = battleCommanders[k] || (battleCommanders[k] = []);
  ids.forEach((id) => {
    if (id != null && !arr.includes(id)) arr.push(id);
  });
};

export function noteFieldBattle(
  turnContext: TurnContext,
  atk: Character | null | undefined,
  def: Character | null | undefined,
  prov: Province | null | undefined,
) {
  const { fieldBattlePhase, G } = turnContext;
  const ph = turnContext._currentPhase,
    ids: number[] = [];
  if (ph == null || !prov) return ids;
  const sides = new Set<number | null>([atk && atk.player, def && def.player].filter((x) => x != null));
  const add = (id: number | null | undefined) => {
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
export function completeDefendWatches(
  turnContext: TurnContext,
  ids: number[] | null | undefined,
  narrative: NarrativeLine[] | null | undefined,
) {
  const { G } = turnContext;
  const ph = turnContext._currentPhase;
  (ids || []).forEach((id) => {
    const real = (G.characters || []).find((x) => x && x.id === id);
    if (!real || !real._defend) return;
    const wasOn = !!real._defend.active;
    real._defend.active = false;
    real._defendSpent = { turn: G.turn, ph };
    if (wasOn && real.alive !== false) {
      if (narrative)
        narrate(narrative, {
          kind: "a defender's Defend order is fulfilled once the threat is met in battle",
          heroName: real.name,
        });
      else
        emit(turnContext, {
          type: 'move',
          fact: {
            kind: "a defender's Defend order is fulfilled once the threat is met in battle",
            heroName: real.name,
          },
          audience: { actor: real.player, realms: [real.player] },
          hero: real.id,
          phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
          province: real.location ?? null,
        });
    }
  });
}
export const defendSpentThisPhase = (turnContext: TurnContext, c: Character | null | undefined, ph: number) =>
  !!(c && c._defendSpent && c._defendSpent.turn === turnContext.G.turn && c._defendSpent.ph === ph);

// ── LIFTED OUT OF resolveTurn (plan P1-08c) ── a defeat breaks a general's Defend watch for the rest of the turn. It
// takes the turn's context first (src/engine/turn/context.ts).
export function noteBattleLoss(
  turnContext: TurnContext,
  charId: number,
  narrative: NarrativeLine[] | null | undefined,
) {
  const { G } = turnContext;
  const real = (G.characters || []).find((x) => x && x.id === charId);
  if (!real || !real._defend || !real._defend.active) return;
  real._defend.active = false;
  if (narrative) narrate(narrative, { kind: "a defender's watch is broken by a defeat", heroName: real.name });
  else
    emit(turnContext, {
      type: 'move',
      fact: { kind: "a defender's watch is broken by a defeat", heroName: real.name },
      audience: { actor: real.player, realms: [real.player] },
      hero: real.id,
      phase: THE_PHASE_THE_LINE_IS_WRITTEN_IN,
      province: real.location ?? null,
    }); // file under the beaten general, not whoever's order was resolving
}
