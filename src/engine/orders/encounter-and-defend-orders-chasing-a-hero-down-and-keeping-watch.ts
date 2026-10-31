import { defendSpentThisPhase } from '../turn/mercenary-ids-and-battle-records.ts';
import { isHiddenByInvisibilityFrom, isHiddenChar } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { advancePursuit } from '../heroes/pursuits-and-the-catch-roll.ts';
import type { Character, Province } from '../../schemas/saved-game-state.ts';
import type { TurnContext, TurnOrder } from '../turn/context.ts';
import { emit, THE_HERO_WHOSE_ORDER_IS_RESOLVING } from '../turn/events-and-their-audiences.ts';

// ── THE ENCOUNTER AND DEFEND ORDERS (plan P1-08j8: the eighth family taken out of processOrder in resolveTurn) ──
// Encounter Character sets a hero after a quarry he may hunt (never himself, a hero of the lord who holds him by a
// Charm, a rival king unless he is one, a hidden or vanished hero), then takes the first step of the chase; the chase,
// the catch and the meeting are advancePursuit's (src/engine/heroes/pursuits-and-the-catch-roll.ts), in every phase
// that follows. Defend sets (or keeps) a watch over the province the hero stands in and the country about it, and says
// so once a phase; the watch's reactions, ride-outs and ambushes are the Defend family's
// (src/engine/units/defend-ride-outs-ambushes-and-reinforcements.ts). Each takes the turn's context first
// (src/engine/turn/context.ts), then the values processOrder worked out before it that it reads, in the order
// processOrder declares them. Each body keeps processOrder's indent (plan P1-08's Decisions); a case-level break became
// a return.
// Encounter Character: the quarry checked, then the chase set and its first step taken.
export function resolveEncounterCharacterOrder(
  turnContext: TurnContext,
  c: Character,
  ph: number,
  target: string,
  prov: Province,
) {
  const { G } = turnContext;
  // Encounter Character no longer requires the quarry to be standing in the same province.
  // The hero sets out and CHASES the target wherever they go — one province per phase, a
  // movement point each — and forces the meeting once he catches them. Targeting/visibility
  // is enforced on the order form
  // (you may name any enemy you can see: in a province you own, one you have a character in, or
  // one you spied). The chase + catch + duel is resolved in advancePursuit below.
  const targetId = parseInt(target);
  // R-119: a quarry whose Invisibility holds leaves this realm no trail at all (the same line as no quarry)
  const quarry = (G.characters || []).find(
    (x) => x.alive && x.id === targetId && !isHiddenByInvisibilityFrom(turnContext, x, c.player),
  );
  if (!quarry) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hunter finds no quarry to hunt down', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  if (quarry.id === c.id) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hero cannot set out to encounter himself', heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  // a seized ENEMY hero will not raise a hand against their own lord's people — no Encounter
  // against a character of the original owner. Any other realm's heroes are fair game as
  // usual.
  if (c._charmTempControl && c._charmOriginalPlayer != null && quarry.player === c._charmOriginalPlayer) {
    emit(turnContext, {
      type: 'system',
      fact: {
        kind: "a charmed hero will not hunt a hero of his true lord's realm",
        heroName: c.name,
        quarryName: quarry.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  // only a king may run down an enemy king. A common hero can never force a meeting with a
  // rival monarch — a king answers only to another crown. (Once caught, a king is no harder
  // to run down than any hero: pursuitCatchChance treats them the same.)
  if (quarry.isKing && !c.isKing && quarry.player !== c.player) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a common hero may not run down a rival king', heroName: c.name, quarryName: quarry.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  if (quarry.player !== c.player && isHiddenChar(turnContext, quarry)) {
    emit(turnContext, {
      type: 'system',
      fact: { kind: 'a hunter finds no trail of a cloaked quarry', heroName: c.name, quarryName: quarry.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  // A mutual pair of Encounter orders (each hunting the other) resolves as ONE meeting.
  if (c._encounteredThisPhase === quarry.id || quarry._encounteredThisPhase === c.id) {
    return;
  }
  // THIEF L9 Vanish: no Encounter can be forced on someone who has melted into the shadows.
  if (quarry._vanishTurn === G.turn && quarry.player !== c.player) {
    emit(turnContext, {
      type: 'move',
      fact: { kind: 'a hunter finds no trail of a quarry who has vanished', heroName: c.name, quarryName: quarry.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  c._pursuit = { targetId: quarry.id, active: true, setPhase: ph };
  delete c._defend; // a chase cancels a standing Defend (AK [3.15])
  emit(turnContext, {
    type: 'move',
    fact: { kind: 'a hunter sets out to run down his quarry', heroName: c.name, quarryName: quarry.name },
    audience: { actor: c.player, realms: [c.player] },
    hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
    province: prov.id,
  });
  advancePursuit(turnContext, c, ph);
  return;
}
// Defend: the watch set over the province the hero stands in, or kept, and told once a phase.
export function resolveDefendOrder(turnContext: TurnContext, c: Character, o: TurnOrder, ph: number, prov: Province) {
  // A move that was cancelled by the invasion interlock is rewritten to a Defend order; the
  // interlock already logged a much better line, so don't tack a bland one on top of it.
  if (o._pinned) return;
  // item 15: this phase's Defend order has already been answered in battle (the watch was on
  // from the top of the phase) — it does not set the watch again.
  if (defendSpentThisPhase(turnContext, c, ph)) {
    emit(turnContext, {
      type: 'move',
      fact: { kind: "a defender's watch is spent in this season's battle", heroName: c.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
    return;
  }
  // Defend needs no target — it always guards the province the character stands in. The watch
  // covers that province plus its immediate neighbours (see inDefendZone), and he rides out
  // to meet any incursion into an adjacent province. Any target still supplied by an older
  // saved order is ignored. Persists for the rest of the turn.
  const centreProv = prov;
  // if the watch was pre-activated at the top of this phase (and may already have ridden out
  // once), keep its one-reaction-per-phase marker.
  const _preSet = !!(c._defend && c._defend.active && c._defend.setPhase === ph && c._defend.preActivated);
  // a watch carried over unbroken from an earlier phase is not announced again every phase
  const _carried = !!(c._defend && c._defend.active && (c._defend.carried || c._defend.setPhase < ph));
  c._defend = { centre: centreProv.id, active: true, setPhase: ph, carried: _carried };
  if (!_preSet) delete c._defendReactedPhase;
  if (_preSet && c._defendReactedPhase === ph) {
    // the watch already acted this phase (rode out / held the gate) and said so; a "makes
    // camp" line after the ride-out would read backwards
  } else if (_carried) {
    // still on watch. 2026-09-23 (Toby item 10): this used to print NOTHING, so a character
    // who set a watch in Early Summer and held it through Fall and Early Winter showed only
    // the phases before it — Sorrek the Kinless's Chronicle stopped at Late Summer. One short
    // line per phase keeps every season accounted for.
    emit(turnContext, {
      type: 'move',
      fact: {
        kind: 'a defender keeps the watch he set in an earlier season',
        heroName: c.name,
        provinceName: prov.name,
        hasNoColumn: (c.armies || []).length === 0,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  } else if ((c.armies || []).length === 0) {
    emit(turnContext, {
      type: 'move',
      fact: { kind: 'a defender with no column lies in wait to ambush', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  } else if (centreProv.id === prov.id) {
    emit(turnContext, {
      type: 'move',
      fact: { kind: 'a defender makes camp and sets a watch', heroName: c.name, provinceName: prov.name },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  } else {
    emit(turnContext, {
      type: 'move',
      fact: {
        kind: 'a defender sets a watch over the country around another province',
        heroName: c.name,
        provinceName: prov.name,
        centreProvinceName: centreProv.name,
      },
      audience: { actor: c.player, realms: [c.player] },
      hero: THE_HERO_WHOSE_ORDER_IS_RESOLVING,
      province: prov.id,
    });
  }
  return;
}
