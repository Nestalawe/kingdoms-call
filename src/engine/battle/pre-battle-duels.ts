import { _escapesTheEnd, _garrethEscapeLine } from '../names.ts';
import { isVanished } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { awardKillXP, awardWinHp } from '../heroes/experience-skill-rises-and-earned-hp.ts';
import { pushBattlecry } from './battle-report-lines-and-force-markers.ts';
import { duelStanceOf, ensureEncounterPlan } from '../personal-combat/speed-encounter-plans-and-combatants.ts';
import { resolveDuel } from '../personal-combat/duels-and-character-encounters.ts';
import { handleHeroDeath } from '../heroes/hero-death-and-leaderless-hosts.ts';
import type { Character } from '../../schemas/saved-game-state.ts';
import type { TurnContext } from '../turn/context.ts';
import type { EventButItsWords, NarrativeLine } from '../turn/events-and-their-audiences.ts';
import { narrate } from '../turn/events-and-their-audiences.ts';

// ── THE DUEL BEFORE A BATTLE (plan P1-08g: lifted out of resolveTurn) ────
// The single combat between the two commanders before an army battle, and the morale each host carries into the battle
// proper (preBattleDuel), for both battle paths: combatVsNPC (battle/battles-against-province-defenders.ts) and
// combatVsChar (battle/battles-between-heroes.ts). It takes the turn's context first (src/engine/turn/context.ts).
// Resolve a personal duel between two commanders. Returns {winner, loser} or {} if inconclusive.
// Runs on the unified personal-combat engine, so duels, character encounters and monster
// encounters all obey exactly the same rounds, ranges and action alternation. ── PRE-BATTLE DUEL
// ── Shared by combatVsChar (player-vs-player) and combatVsNPC (vs a neutral guard / chieftain).
// It previously lived inline in combatVsChar ONLY, which is why duels never fired in the far more
// common battles against province guardians. Returns the morale multiplier each side carries into
// the battle proper; callers must apply both to their strength totals or the duel has no effect.
export function preBattleDuel(
  turnContext: TurnContext,
  atk: Character | null | undefined,
  def: Character | null | undefined,
  narrative: NarrativeLine[],
) {
  const { _botPlayerIdx, G } = turnContext;
  const DUEL_MORALE_PENALTY = 0.8;
  let atkMorale = 1,
    defMorale = 1;
  if (!atk || !def) return { atkMorale, defMorale };
  // A commander who is ALREADY dead entering this battle (slain last phase and leading a
  // leaderless host that fought on) cannot ride out, and nobody is shamed for not answering a
  // challenge from a corpse.
  if (atk.alive === false || def.alive === false) return { atkMorale, defMorale };
  // THIEF L9 Vanish: no one rides out against a commander who is not there, and none may call him
  // out.
  if (isVanished(turnContext, atk) || isVanished(turnContext, def)) return { atkMorale, defMorale };
  const demoralise = (who: Character, why: string) => {
    if (who === atk) atkMorale = DUEL_MORALE_PENALTY;
    else defMorale = DUEL_MORALE_PENALTY;
    narrate(narrative, { kind: "a commander's force is demoralised", commanderName: who.name, why });
  };
  ensureEncounterPlan(turnContext, atk);
  ensureEncounterPlan(turnContext, def); // NPC commanders fall back on Temper
  let atkStance = duelStanceOf(atk),
    defStance = duelStanceOf(def);
  // 2026-09-28 (Toby): a BOT commander never duels a LOCAL CHIEFTAIN (a neutral province guard). He issues
  // no challenge and refuses one (his host takes the usual −20% for it), so the chieftain lives on as a
  // wanderer after the battle — more heroes left in the world to hire. Human players choose for themselves.
  const _botVsChief = (me: Character, foe: Character) =>
    !!(
      me &&
      me.player != null &&
      _botPlayerIdx &&
      _botPlayerIdx.has(me.player) &&
      foe &&
      foe.player === null &&
      foe._isNeutralGuard
    );
  if (_botVsChief(atk, def)) atkStance = 'refuse';
  if (_botVsChief(def, atk)) defStance = 'refuse';
  if (atkStance !== 'challenge' && defStance !== 'challenge') return { atkMorale, defMorale };
  // If both sides mean to challenge, the attacker issues it.
  const challenger = atkStance === 'challenge' ? atk : def;
  const challenged = challenger === atk ? def : atk;
  const challengedStance = challenged === atk ? atkStance : defStance;
  narrate(narrative, {
    kind: 'a commander rides out and challenges the other to single combat',
    challengerName: challenger.name,
    challengedName: challenged.name,
  });
  if (challengedStance === 'refuse') {
    narrate(narrative, { kind: 'the challenged commander will not answer the call', challengedName: challenged.name });
    demoralise(challenged, `their commander refused the challenge`);
    return { atkMorale, defMorale };
  }
  narrate(narrative, {
    kind: 'a personal duel before the battle begins',
    challengerName: challenger.name,
    challengedName: challenged.name,
  });
  pushBattlecry(narrative, challenger, challenged.name);
  pushBattlecry(narrative, challenged, challenger.name);
  const duelResult = resolveDuel(turnContext, challenger, challenged, narrative);
  let atkSlain = false,
    defSlain = false;
  if (duelResult.loser) {
    const loser = duelResult.loser,
      winner = duelResult.winner;
    // Battles are often fought on pooled COPIES ({...char}) — resolve on the REAL characters.
    const _real = (x: Character) => (x && x.id != null && (G.characters || []).find((r) => r && r.id === x.id)) || x;
    const realLoser = _real(loser),
      realWinner = _real(winner);
    // SECRET: the unkillable wanderer is beaten but escapes the killing blow — he lives, so
    // his host is NOT left leaderless; being driven from the field still shakes his troops.
    if (_escapesTheEnd(realLoser)) {
      narrate(narrative, _garrethEscapeLine(realLoser));
      // this path left him at 0 HP (every other escape path clamps it), so his NEXT encounter
      // ended before round 1 on the hp<=0 check and printed the escape line without a fight.
      const _gHp = Math.max(1, realLoser.maxHp ? Math.round(realLoser.maxHp / 2) : 1);
      if (realLoser.hp == null || realLoser.hp <= 0) realLoser.hp = _gHp;
      if (loser !== realLoser && (loser.hp == null || loser.hp <= 0)) loser.hp = realLoser.hp;
      realLoser.alive = true;
      realLoser.killedThisTurn = false;
      demoralise(loser, `their commander was driven from the field`);
      return { atkMorale, defMorale };
    }
    // alive===true, so its "saved victim" guard bailed and a pre-battle duel kill never paid out.
    // It now runs after the death is confirmed, below.) keepArmies: the fallen commander's host
    // does NOT scatter before the battle — it fights on leaderless (demoralised, without the
    // commander's skills). The battle code disperses whatever survives afterwards.
    // Items/grave/death flags are handled here as normal.
    // 2026-10-13 (Toby, item 19): the death is resolved FIRST and its lines go into this battle's
    // own narrative, in order: "slain" only if the commander really died (then the surgeons'
    // "too late", to his own realm); if Battlefield Surgery saves him, "at death's door, but not
    // slain" and the surgery line. Before, "slain" was written regardless and the surgery line
    // was logged at once, so it came before the whole battle report.
    const _dOpts: {
      keepArmies: boolean;
      lines: { type: string; text: string; place?: EventButItsWords; priv?: number | null }[];
      outcome?: string;
    } = { keepArmies: true, lines: [] };
    const _duelDied = handleHeroDeath(turnContext, realLoser, realWinner, _dOpts);
    const _saved = _duelDied === false && _dOpts.outcome === 'surgery';
    narrate(
      narrative,
      _saved
        ? { kind: "the duel's loser falls at death's door but is not slain", loserName: String(loser.name) }
        : { kind: "the duel's loser is slain", loserName: String(loser.name) },
    );
    _dOpts.lines.forEach((l) => {
      if (l.priv != null)
        narrate(narrative, {
          kind: 'the surgeons reach a fallen duellist too late, for his realm alone',
          realm: l.priv,
          words: l.text,
        });
      else narrate(narrative, l.text);
    });
    demoralise(loser, `their commander fell in single combat`);
    if (_duelDied === false) {
      // saved (Battlefield Surgery) — the REAL record lives; keep the copy in step with it so no
      // half-dead doppelganger fights on. Beaten, so the host is still shaken.
      if (loser !== realLoser) {
        loser.alive = true;
        loser.killedThisTurn = false;
        loser.hp = realLoser.hp;
      }
      return { atkMorale, defMorale };
    }
    awardKillXP(turnContext, realWinner, realLoser, narrative); // the kill is confirmed — experience roll + earned HP
    // Mirror the death onto the battle copy so the rest of this battle sees it.
    if (loser !== realLoser) {
      loser.alive = false;
      loser.killedThisTurn = true;
      loser.items = [];
    }
    if (loser === atk) atkSlain = true;
    else defSlain = true;
    return { atkMorale, defMorale, atkSlain, defSlain };
  } else if (duelResult.fled) {
    // Breaking off the duel is losing it — the runner's own troops saw them go.
    demoralise(duelResult.fled, `their commander broke off the duel`);
    if (duelResult.heldField) awardWinHp(turnContext, duelResult.heldField, narrative, 'duel'); // holding the field in a pre-battle duel is a win
  } else {
    narrate(narrative, { kind: 'the duel ends inconclusively' });
  }
  return { atkMorale, defMorale, atkSlain, defSlain };
}
