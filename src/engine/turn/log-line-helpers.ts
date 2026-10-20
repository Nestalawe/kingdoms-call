// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
// ── LINES IN THE GM'S LOG (plan P1-08a: lifted out of resolveTurn) ────
// The helpers that write a line other than log()'s own: a line from a shared narrative, a line to the hero or the
// province owner it happened to, a private line with a public twin, and the spell records. Each takes the turn's
// context first (src/engine/turn/context.ts), but narrText, which reads none.
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

// ── PRIVATE LINES INSIDE A SHARED NARRATIVE ────
// A battle or duel narrative is written once and then shown to EVERY participant — that is the
// whole point of a blow-by-blow. But a handful of lines in it belong to one realm alone: a hero's
// skill rising through experience, the mastery that crossing 6+ unlocks, and the wage rise that
// follows. An enemy commander has no way of knowing that the man across the field just got better
// at archery, and reading it told them his exact skill level for free.
//
// So a narrative array may now hold OBJECTS as well as strings:
// { text:'…', onlyPlayer:<realm index>, charId:<that realm's character> }
// Every consumer of a narrative array routes each entry through emitNarrLine(), which logs a
// private entry to that realm alone (targets:[owner], public:false, no charIds spill) and an
// ordinary shared entry for everything else. Because it is logged in sequence with the rest of
// the narrative, the owner still reads it exactly where it happened in the fight. narrText() is
// for the rare consumer that needs the raw string (splice-point searches, etc.).
export function narrText(line) {
  return line && typeof line === 'object' && line.text != null ? line.text : line;
}
export function emitNarrLine(turnContext, type, line, meta) {
  const { log } = turnContext;
  meta = meta || {};
  if (line && typeof line === 'object' && line.text != null) {
    if (line.onlyPlayer == null) {
      log(type, line.text, meta);
      return;
    }
    log(type, line.text, {
      ...meta,
      actor: null,
      public: false,
      summary: false,
      battleDetail: false,
      targets: [line.onlyPlayer],
      charIds: null,
      charId: line.charId != null ? line.charId : meta.charId,
    });
    return;
  }
  log(type, line, meta);
}

// ── TARGET NOTIFICATIONS ────
// When something happens TO a character that they'd know about — receiving items, armies mustered
// to them, a spell cast on them (friendly or hostile) — file a line in THAT character's own
// Chronicle section for the phase it happened. charId routes it into their section; targets makes
// sure their player sees it even when the actor was an enemy. This never leaks to anyone else.
export function notifyTarget(turnContext, targetChar, text, ph, type) {
  const { log } = turnContext;
  if (!targetChar) return;
  const _ph =
    ph != null ? ph : turnContext._logCtx.phase != null ? turnContext._logCtx.phase : turnContext._currentPhase;
  log(type || 'system', text, {
    actor: null,
    targets: targetChar.player != null ? [targetChar.player] : [],
    charId: targetChar.id,
    phase: _ph,
    provinceId: targetChar.location != null ? targetChar.location : null,
  });
}

// ── NO SILENT SEASON (2026-10-09, Toby item 1) ────
// Every hero of a realm has at least one line in every season of his Chronicle. A hero can still
// be moved or swept into a fight by code that files its lines under someone else (a veiled march,
// a pooled host, a stalled battle resumed by the strongest force); his season then read as if he
// did nothing. Run at the end of each phase: a living realm hero with no line of his own for the
// phase — by charId, by charIds, or as a commander of one of its battles (the same tests the report
// uses to file a line under him) — gets a plain line saying where the season leaves him.
export function noteSilentHeroes(turnContext, ph, startLoc) {
  const { turnLog, battleCommanders, G, log } = turnContext;
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
    log('move', text, {
      actor: c.player,
      targets: [c.player],
      charId: c.id,
      phase: ph,
      provinceId: c.location != null ? c.location : null,
    });
  });
}

// ── Task 9(b): PROVINCE / KINGDOM NOTIFICATIONS ────
// When something is done TO one of a player's PROVINCES that they'd learn of — an enemy Flood,
// Earthquake, Plague, Cataclysm, Part Sea, etc. — file a line in that owner's KINGDOM EVENTS feed
// (charId null so it is NOT a character section, and env:false so it is NOT diverted to the quieter
// Province Reports stream). No-op if the caster IS the owner (they already know) or the land is
// unowned. targets makes the owner see it even though the caster was an enemy.
// ── ONE EVENT, TWO AUDIENCES ────
// A cast that raises troops is written for the caster ("…to fight under your command") but is
// also public, so an onlooker — the owner of the province, a spy, a hero standing there — read
// the same second-person sentence with no province in it. `logSplit` writes the caster's line
// privately and a third-person line for everyone else who can see the province (notFor keeps the
// caster from reading it twice). Both carry the province so the report can place them.
export function logSplit(turnContext, type, privText, pubText, meta = {}) {
  const { log, turnLog } = turnContext;
  const actor = meta.actor ?? null;
  log(type, privText, {
    ...meta,
    public: false,
    targets: meta.targets && meta.targets.length ? meta.targets : [actor].filter((x) => x != null),
  });
  turnLog.push({
    type,
    text: pubText,
    actor: null,
    targets: [],
    provinceId: meta.provinceId ?? null,
    public: true,
    spy: false,
    system: false,
    armyEstimate: null,
    charId: null,
    charIds: null,
    phase:
      meta.phase ?? turnContext._logCtx.phase ?? turnContext._currentPhase ?? (turnContext._afterPhases ? 99 : null),
    pinNotice: false,
    env: false,
    notFor: [actor].concat(meta.alsoNotFor || []).filter((x) => x != null),
  });
}
export function realmTag(turnContext, pi) {
  const { G } = turnContext;
  return pi != null && G.players[pi] ? ` (${G.players[pi].name})` : '';
}
export function notifyProvinceOwner(turnContext, prov, text, casterPlayer, ph) {
  const { turnLog } = turnContext;
  if (!prov || prov.owner == null || prov.owner === casterPlayer) return;
  const _ph =
    ph != null ? ph : turnContext._logCtx.phase != null ? turnContext._logCtx.phase : turnContext._currentPhase;
  // Push directly (bypassing log()'s charId?? _logCtx fallback) so this files under the owner's
  // KINGDOM EVENTS — a real null charId, never inherited from the casting character's log
  // context.
  turnLog.push({
    type: 'system',
    text,
    actor: null,
    targets: [prov.owner],
    provinceId: prov.id,
    public: false,
    spy: false,
    system: false,
    armyEstimate: null,
    charId: null,
    charIds: null,
    phase: _ph,
    pinNotice: false,
    env: false,
  });
}
