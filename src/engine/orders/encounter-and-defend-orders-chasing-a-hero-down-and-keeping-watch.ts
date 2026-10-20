import { defendSpentThisPhase } from '../turn/mercenary-ids-and-battle-records.ts';
import { isHiddenChar } from '../heroes/effective-skills-and-hidden-heroes.ts';
import { advancePursuit } from '../heroes/pursuits-and-the-catch-roll.ts';

// ── THE ENCOUNTER AND DEFEND ORDERS (plan P1-08j8: the eighth family taken out of processOrder in resolveTurn) ──
// Encounter Character sets a hero after a quarry he may hunt (never himself, a hero of the lord who holds him by a
// Charm, a rival king unless he is one, a hidden or vanished hero), then takes the first step of the chase; the chase,
// the catch and the meeting are advancePursuit's (src/engine/heroes/pursuits-and-the-catch-roll.js), in every phase
// that follows. Defend sets (or keeps) a watch over the province the hero stands in and the country about it, and says
// so once a phase; the watch's reactions, ride-outs and ambushes are the Defend family's
// (src/engine/units/defend-ride-outs-ambushes-and-reinforcements.js). Each takes the turn's context first
// (src/engine/turn/context.js), then the values processOrder worked out before it that it reads, in the order
// processOrder declares them. Each body keeps processOrder's indent (plan P1-08's Decisions); a case-level break became
// a return.
// Encounter Character: the quarry checked, then the chase set and its first step taken.
export function resolveEncounterCharacterOrder(turnContext, c, ph, target, prov) {
  const { G, log } = turnContext;
  // Encounter Character no longer requires the quarry to be standing in the same province.
  // The hero sets out and CHASES the target wherever they go — one province per phase, a
  // movement point each — and forces the meeting once he catches them. Targeting/visibility
  // is enforced on the order form
  // (you may name any enemy you can see: in a province you own, one you have a character in, or
  // one you spied). The chase + catch + duel is resolved in advancePursuit below.
  const targetId = parseInt(target);
  const quarry = (G.characters || []).find((x) => x.alive && x.id === targetId);
  if (!quarry) {
    log('system', `${c.name} casts about for a quarry to hunt down but finds no trail to follow.`, {
      actor: c.player,
      targets: [c.player],
      provinceId: prov.id,
    });
    return;
  }
  if (quarry.id === c.id) {
    log('system', `${c.name} cannot set out to encounter themself.`, {
      actor: c.player,
      targets: [c.player],
      provinceId: prov.id,
    });
    return;
  }
  // a seized ENEMY hero will not raise a hand against their own lord's people — no Encounter
  // against a character of the original owner. Any other realm's heroes are fair game as
  // usual.
  if (c._charmTempControl && c._charmOriginalPlayer != null && quarry.player === c._charmOriginalPlayer) {
    log(
      'system',
      `${c.name} will not hunt ${quarry.name} — the Charm bends their will, but not so far as to turn them on their own lord's people.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    return;
  }
  // only a king may run down an enemy king. A common hero can never force a meeting with a
  // rival monarch — a king answers only to another crown. (Once caught, a king is no harder
  // to run down than any hero: pursuitCatchChance treats them the same.)
  if (quarry.isKing && !c.isKing && quarry.player !== c.player) {
    log(
      'system',
      `${c.name} sets out after ${quarry.name}, but a rival king does not answer to a common hero — only a king may run down another king. The chase is abandoned.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    return;
  }
  if (quarry.player !== c.player && isHiddenChar(turnContext, quarry)) {
    log('system', `${c.name} sets out after ${quarry.name}, but they are cloaked and leave no trail to follow.`, {
      actor: c.player,
      targets: [c.player],
      provinceId: prov.id,
    });
    return;
  }
  // A mutual pair of Encounter orders (each hunting the other) resolves as ONE meeting.
  if (c._encounteredThisPhase === quarry.id || quarry._encounteredThisPhase === c.id) {
    return;
  }
  // THIEF L9 Vanish: no Encounter can be forced on someone who has melted into the shadows.
  if (quarry._vanishTurn === G.turn && quarry.player !== c.player) {
    log(
      'move',
      `${c.name} sets out after ${quarry.name}, but there is no trail to follow — the quarry has vanished into the shadows.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
    return;
  }
  c._pursuit = { targetId: quarry.id, active: true, setPhase: ph };
  delete c._defend; // a chase cancels a standing Defend (AK [3.15])
  log('move', `${c.name} sets out to run down ${quarry.name} and will not turn aside until the matter is settled.`, {
    actor: c.player,
    targets: [c.player],
    provinceId: prov.id,
  });
  advancePursuit(turnContext, c, ph);
  return;
}
// Defend: the watch set over the province the hero stands in, or kept, and told once a phase.
export function resolveDefendOrder(turnContext, c, o, ph, prov) {
  const { log } = turnContext;
  // A move that was cancelled by the invasion interlock is rewritten to a Defend order; the
  // interlock already logged a much better line, so don't tack a bland one on top of it.
  if (o._pinned) return;
  // item 15: this phase's Defend order has already been answered in battle (the watch was on
  // from the top of the phase) — it does not set the watch again.
  if (defendSpentThisPhase(turnContext, c, ph)) {
    log(
      'move',
      `🛡 ${c.name} has met this season's threat in battle — their Defend order is done, and they set no new watch until ordered to Defend in a later season.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
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
    log(
      'move',
      (c.armies || []).length === 0
        ? `🛡 ${c.name} still lies in wait about ${prov.name}.`
        : `🛡 ${c.name} keeps the watch in ${prov.name}.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
  } else if ((c.armies || []).length === 0) {
    log(
      'move',
      `${c.name} melts into the country around ${prov.name} and lies in wait — with no column at their back they cannot bar a road, but they will try to ambush any enemy who ventures into these lands (their Spy craft decides whether they can spring the trap).`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
  } else if (centreProv.id === prov.id) {
    log(
      'move',
      `${c.name} makes camp in ${prov.name} and sets a watch — their column will answer any incursion into the lands about them for the rest of the year.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
  } else {
    log(
      'move',
      `${c.name} sets a watch from ${prov.name} over the country around ${centreProv.name} — their column will ride to meet any incursion there for the rest of the year.`,
      { actor: c.player, targets: [c.player], provinceId: prov.id },
    );
  }
  return;
}
