// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
// ── LINES IN THE GM'S LOG (plan P1-08a: lifted out of resolveTurn) ────
// The spell records, a narrative line's raw text, the silent heroes' line and a realm's name tag. Each takes the turn's
// context first (src/engine/turn/context.ts), but narrText, which reads none. The helpers that write a line of a
// fight's narrative, to a hero or a province's owner, or a private line with a public twin are in
// events-and-their-audiences.ts (plan P1-12a2), beside emit, the one door into the GM's log.
import { emit } from './events-and-their-audiences.ts';
// A spell worked inside a battle or a duel (2026-10-09, Toby item 5): only the Cast order logged its
// casts, so pre-battle, defender and duel magic never reached the spell records. ctx says where.
export const telSpell = (turnContext, ch, spell, school, lvl, chance, roll, ctx) => {
  const { _tel } = turnContext;
  try {
    if (ch && ch.player != null)
      _tel.spells.push({
        ph: turnContext._logCtx.phase ?? turnContext._currentPhase,
        pi: ch.player,
        charId: ch.id,
        spell,
        school,
        lvl,
        chance,
        ok: roll <= chance,
        ctx,
      });
  } catch (_te) {}
};

// A fight's narrative may hold objects as well as strings ({ text, onlyPlayer, charId }: a line for one realm alone;
// events-and-their-audiences.ts, narrateTo). narrText() is for the rare consumer that needs the raw string
// (splice-point searches, etc.).
export function narrText(line) {
  return line && typeof line === 'object' && line.text != null ? line.text : line;
}
// ── NO SILENT SEASON (2026-10-09, Toby item 1) ────
// Every hero of a realm has at least one line in every season of his Chronicle. A hero can still
// be moved or swept into a fight by code that files its lines under someone else (a veiled march,
// a pooled host, a stalled battle resumed by the strongest force); his season then read as if he
// did nothing. Run at the end of each phase: a living realm hero with no line of his own for the
// phase — by charId, by charIds, or as a commander of one of its battles (the same tests the report
// uses to file a line under him) — gets a plain line saying where the season leaves him.
export function noteSilentHeroes(turnContext, ph, startLoc) {
  const { turnLog, battleCommanders, G } = turnContext;
  const heard = new Set();
  turnLog.forEach((e) => {
    if (e.phase !== ph) return;
    if (e.charId != null) heard.add(e.charId);
    if (Array.isArray(e.charIds)) e.charIds.forEach((id) => heard.add(id));
  });
  Object.keys(battleCommanders).forEach((k) => {
    if (k.endsWith('@' + ph)) (battleCommanders[k] || []).forEach((id) => heard.add(id));
  });
  const pname = (id) => {
    const p = id != null ? G.world.provinces[id] : null;
    return (p && p.name) || 'the field';
  };
  (G.characters || []).forEach((c) => {
    if (!c || !c.alive || c.player == null || heard.has(c.id)) return;
    const from = startLoc ? startLoc[c.id] : undefined;
    const text =
      from != null && from !== c.location
        ? `${c.name} leaves ${pname(from)} and ends the season in ${pname(c.location)}.`
        : `${c.name} remains in ${pname(c.location)} this season.`;
    emit(turnContext, {
      type: 'move',
      text,
      audience: { actor: c.player, realms: [c.player] },
      hero: c.id,
      phase: ph,
      province: c.location != null ? c.location : null,
    });
  });
}

export function realmTag(turnContext, pi) {
  const { G } = turnContext;
  return pi != null && G.players[pi] ? ` (${G.players[pi].name})` : '';
}
