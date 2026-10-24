// ── EVERY LINE OF THE TURN, AND WHO MAY READ IT (plan P1-12a, Decisions 2 to 6) ────
// The one door into the GM's log of the turn (turnContext.turnLog): emit(turnContext, event). An event says what
// happened (its type and, for now, its finished text), where and when (its province, its phase), whom it is about (its
// hero, its heroes, its battle), and who may read it (its audience). Nothing else writes to turnLog: the lint rule
// kc/narrative-lines-go-through-emit refuses a write anywhere but here (docs/traps.md, "A line goes through emit").
//
// The audience, as the reports read the line today (playerEvents, src/views/every-realms-report-and-the-lines-each-
// realm-reads.ts):
//   realms   these realms are told (a wage bill, a spell that hit them)
//   actor    the realm whose deed it is
//   seen     'world': every realm (a public line with no province); 'there': whoever has eyes in the province at that
//            phase; 'battle': a battle's line, read by those who fought in it (the onlookers' summary waits for Toby)
//   except   these realms never read it (the public half of logSplit: they read their own private half)
// and a line about a hero a realm owns (hero, heroes) reaches that realm. An event with no grant is the GM's alone.
//
// Nothing stored changes in P1-12a and P1-12b (Decision 2): emit writes today's line forms, key for key and in the
// same order: the 17 keys of the lines the old `log` helper wrote; the 14 of the lines that were pushed straight
// into turnLog (form: 'bare', with no battle fields); and notFor after them when an `except` is given. P1-12c changes
// the stored form once.
//
// The fallbacks are the old `log` helper's (docs/traps.md, "A hero left out is the hero whose order is resolving"):
//   hero   left out or null: the hero whose order is resolving (turnContext._logCtx.charId), but only when the line
//          already reaches his realm (it is told to it, is its deed, or is seen by the world or there; a battle's line
//          reaches those who fought in it by being told); otherwise no hero (P1-12c1). 'none': no hero
//   phase  left out or null: the phase of that order, else the phase resolving, else 99 once the phases are over;
//          'none': no phase (the lines that were pushed straight into turnLog, which never had the 99)
//
// It also holds the helpers that write lines: a fight's narrative (narrate, narrateTo, narrateAll, narrateAt,
// takeBackLinesFrom; emitNarrLine writes it out with the fight's event, FightLine), a line to the hero or the province
// owner it happened to (notifyTarget, notifyProvinceOwner), a private line with a public twin (logSplit), and the
// placement of the skill rises held back to the end of the phase (writeDeferredSkillLines).
import type { TurnContext } from './context.ts';

/** Who may read a line (each left out grants nothing). */
export interface LineAudience {
  /** These realms are told (callers pass `[c.player]`, which is null for a hero who serves no realm). */
  realms?: (number | null)[] | undefined;
  /** The realm whose deed it is (null: nobody's). */
  actor?: number | null | undefined;
  /** Seen by the world, by whoever has eyes in the province at that phase, or by those in the battle. */
  seen?: 'world' | 'there' | 'battle' | undefined;
  /** These realms never read it. */
  except?: number[] | undefined;
}

/** Something that happened this turn, with its finished text (P1-12c gives each area its typed facts). */
export interface TurnEvent {
  /** 'system', 'combat', 'move', 'hire', 'explore', 'message', … */
  type: string;
  text: string;
  audience: LineAudience;
  province?: number | null | undefined;
  /** 0 to 4, or 99 for the end of the turn; left out or null: the phase resolving; 'none': no phase. */
  phase?: number | null | 'none' | undefined;
  /** The hero whose deed it is; left out or null: the hero whose order is resolving, when the line already reaches his
   *  realm (else no hero); 'none': no hero. */
  hero?: number | null | 'none' | undefined;
  /** More heroes it is about: it is filed under whichever of them the reader owns. */
  heroes?: number[] | null | undefined;
  /** The battle it belongs to (emitBattle numbers them), and its place there: 'k' key, 'd' detail, 't' tally, 's' an
   *  onlooker's summary. */
  battle?: { id?: number | null | undefined; tier?: string | null | undefined } | undefined;
  /** Hoisted to the top of the hero's phase. */
  pinNotice?: boolean | undefined;
  /** A province's own event (an earthquake, a flood, …), for the province reports. */
  env?: boolean | undefined;
  /** The game's end and its standings, at the top of the report. */
  gameEnd?: boolean | undefined;
  spy?: boolean | undefined;
  system?: boolean | undefined;
  armyEstimate?: unknown;
  /** 'bare': the 14-key form of the lines that were pushed straight into turnLog (no battle fields). */
  form?: 'full' | 'bare' | undefined;
}

/** A line of the GM's log (turnLog), as emit writes it: today's stored form. */
export interface LogLine {
  type: string;
  text: string;
  actor: number | null;
  targets: (number | null)[];
  provinceId: number | null;
  public: boolean;
  spy: boolean;
  system: boolean;
  armyEstimate: unknown;
  charId: number | null;
  charIds: number[] | null;
  phase: number | null;
  pinNotice: boolean;
  env: boolean;
  /** The full form's three (not on a 'bare' line). */
  battleId?: number | null;
  bTier?: string | null;
  gameEnd?: boolean;
  /** The realms that never read it (audience.except). */
  notFor?: number[];
}

/** A line of a battle's or a duel's narrative: shown to everyone there (narrate), or (an object with onlyPlayer) to one
 *  realm alone (narrateTo). emitNarrLine writes each into the GM's log in order. */
export type NarrativeLine =
  string | { text: string; onlyPlayer?: number | null | undefined; charId?: number | null | undefined };

/** What every line of a fight is, but its text: its type, its audience (those who fought in it), its province, phase,
 *  heroes and battle. emitNarrLine files each line of the fight's narrative with it. */
export type FightLine = Omit<TurnEvent, 'text'>;

/** An event but its type and text: who may read a line, where and when, whom it is about. A caller that files several
 *  lines alike, or hands a helper the line's place (logSplit, reportHeroFall, the skill rises held back), builds it
 *  once: emit(turnContext, { type, text, ...place }). */
export type EventButItsWords = Omit<TurnEvent, 'type' | 'text'>;

/** The hero a line that names none is filed under: the hero whose order is resolving, but only when the line already
 *  reaches his realm by its audience (told to it, its deed, seen by the world or seen there; a battle's line reaches
 *  those who fought in it by being told). Otherwise no hero, so that filing it under him never shows his realm a line
 *  its audience keeps from it (playerEvents gives a realm every line filed under one of its heroes). A hero who serves
 *  no realm has no realm to reach: the line is filed under him as before. */
function theHeroWhoseOrderIsResolvingIfTheLineReachesHisRealm(
  turnContext: TurnContext,
  audience: LineAudience,
): number | null {
  const resolving = turnContext._logCtx.charId;
  if (resolving == null) return null;
  const hisRealm = turnContext.G.characters.find((c) => c.id === resolving)?.player;
  if (hisRealm == null) return resolving;
  const reachesHisRealm =
    audience.actor === hisRealm ||
    (audience.realms ?? []).includes(hisRealm) ||
    audience.seen === 'world' ||
    audience.seen === 'there';
  return reachesHisRealm ? resolving : null;
}

/** Files an event in the GM's log of the turn: the one way a line enters it. */
export function emit(turnContext: TurnContext, event: TurnEvent): void {
  const { audience } = event;
  const line: LogLine = {
    type: event.type,
    text: event.text,
    actor: audience.actor ?? null,
    targets: audience.realms ?? [],
    provinceId: event.province ?? null,
    public: audience.seen !== undefined,
    spy: event.spy ?? false,
    system: event.system ?? false,
    armyEstimate: event.armyEstimate ?? null,
    charId:
      event.hero === 'none'
        ? null
        : (event.hero ?? theHeroWhoseOrderIsResolvingIfTheLineReachesHisRealm(turnContext, audience)),
    charIds: event.heroes ?? null,
    // 2026-09-23 (Toby item 10): a line logged DURING a phase but outside any character's order (the lone-defender
    // ambush, Defend ride-outs, end-of-phase sweeps) had no phase at all, and the player's Chronicle files an unphased
    // line under SPRING. _currentPhase is the phase being resolved, so it is the fallback; 99 is the End of Turn.
    phase:
      event.phase === 'none'
        ? null
        : (event.phase ??
          turnContext._logCtx.phase ??
          turnContext._currentPhase ??
          (turnContext._afterPhases ? 99 : null)),
    pinNotice: event.pinNotice ?? false,
    env: event.env ?? false,
  };
  if (event.form !== 'bare') {
    line.battleId = event.battle?.id ?? null;
    line.bTier = event.battle?.tier ?? null;
    line.gameEnd = event.gameEnd ?? false;
  }
  if (audience.except !== undefined) line.notFor = audience.except;
  turnContext.turnLog.push(line);
  console.log(`[${event.type}] ${event.text}`);
}

// ── A FIGHT'S NARRATIVE ────
// A battle's or a duel's narrative is an ordered list of lines (it is spliced, searched and counted by index), written
// out in order once the fight is over (emitBattle, emitNarrLine). narrate adds a line for everyone in the fight;
// narrateTo a line for one realm alone (a hero's skill rising, his hit points: what the man across the field must not
// learn), filed under that realm's hero. Lines already written move only through narrateAll, narrateAt and
// takeBackLinesFrom, each line as it is, so a line for one realm stays that realm's.

/** Adds a line for everyone in the fight. */
export function narrate(narrative: NarrativeLine[], text: string): void {
  narrative.push(text);
}

/** Adds a line for one realm alone, filed under its hero. */
export function narrateTo(
  narrative: NarrativeLine[],
  realm: number,
  heroId: number | null | undefined,
  text: string,
): void {
  narrative.push({ text, onlyPlayer: realm, charId: heroId });
}

/** Adds lines already written for a fight, each as it is (for everyone, or for one realm alone): a duel's narrative
 *  inside a battle's, a battle's grid and ladder rows. */
export function narrateAll(narrative: NarrativeLine[], lines: readonly NarrativeLine[]): void {
  narrative.push(...lines);
}

/** Adds lines for everyone in the fight before the line at `index` (a host's forming-up before "Battle for …", a plea
 *  before the blow it begged against). */
export function narrateAt(narrative: NarrativeLine[], index: number, texts: readonly string[]): void {
  narrative.splice(index, 0, ...texts);
}

/** Takes the lines from `index` on out of a fight's narrative (a killing blow that never landed), and returns them. */
export function takeBackLinesFrom(narrative: NarrativeLine[], index: number): NarrativeLine[] {
  return narrative.splice(index);
}

// ── PRIVATE LINES INSIDE A SHARED NARRATIVE ────
// A battle or duel narrative is written once and then shown to EVERY participant — that is the
// whole point of a blow-by-blow. But a handful of lines in it belong to one realm alone: a hero's
// skill rising through experience, the mastery that crossing 6+ unlocks, and the wage rise that
// follows. An enemy commander has no way of knowing that the man across the field just got better
// at archery, and reading it told them his exact skill level for free.
//
// So a narrative array may now hold OBJECTS as well as strings (narrateTo makes them):
// { text:'…', onlyPlayer:<realm index>, charId:<that realm's character> }
// Every consumer of a narrative array routes each entry through emitNarrLine(), which files a
// private entry to that realm alone (told to it alone, seen by nobody else, no heroes spill) and
// every other line with the fight's own event (FightLine: its audience, province, phase, heroes,
// battle). Because it is filed in sequence with the rest of the narrative, the owner still reads
// it exactly where it happened in the fight. narrText() is for the rare consumer that needs the
// raw string (splice-point searches, etc.).
export function emitNarrLine(turnContext: TurnContext, line: NarrativeLine, fight: FightLine): void {
  if (typeof line === 'object') {
    if (line.onlyPlayer == null) {
      emit(turnContext, { ...fight, text: line.text });
      return;
    }
    emit(turnContext, {
      ...fight,
      text: line.text,
      audience: { realms: [line.onlyPlayer], actor: null },
      heroes: null,
      hero: line.charId ?? fight.hero,
    });
    return;
  }
  emit(turnContext, { ...fight, text: line });
}

// ── TARGET NOTIFICATIONS ────
// When something happens TO a character that they'd know about — receiving items, armies mustered
// to them, a spell cast on them (friendly or hostile) — file a line in THAT character's own
// Chronicle section for the phase it happened. charId routes it into their section; targets makes
// sure their player sees it even when the actor was an enemy. This never leaks to anyone else.
export function notifyTarget(
  turnContext: TurnContext,
  targetChar: { id: number; player: number | null; location: number | null } | null | undefined,
  text: string,
  ph?: number | null,
  type?: string,
): void {
  if (!targetChar) return;
  const _ph = ph ?? turnContext._logCtx.phase ?? turnContext._currentPhase;
  emit(turnContext, {
    type: type ?? 'system',
    text,
    audience: { actor: null, realms: targetChar.player != null ? [targetChar.player] : [] },
    hero: targetChar.id,
    phase: _ph,
    province: targetChar.location ?? null,
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
export function logSplit(
  turnContext: TurnContext,
  type: string,
  privText: string,
  pubText: string,
  place: EventButItsWords & { alsoNotFor?: (number | null)[] | undefined },
): void {
  const { alsoNotFor, ...line } = place;
  const actor = line.audience.actor ?? null;
  // The private half: told to the realms named, else to the actor's own; seen by nobody else.
  emit(turnContext, {
    ...line,
    type,
    text: privText,
    audience: {
      realms: line.audience.realms?.length ? line.audience.realms : [actor].filter((x) => x != null),
      actor: line.audience.actor,
    },
  });
  // The public half: no hero (a real null, not the hero whose order is resolving), in the bare form.
  emit(turnContext, {
    type,
    text: pubText,
    audience: {
      actor: null,
      realms: [],
      seen: 'there',
      except: [actor].concat(alsoNotFor ?? []).filter((x) => x != null),
    },
    province: line.province,
    hero: 'none',
    phase: line.phase,
    form: 'bare',
  });
}
export function notifyProvinceOwner(
  turnContext: TurnContext,
  prov: { id: number; owner: number | null } | null | undefined,
  text: string,
  casterPlayer: number | null | undefined,
  ph?: number | null,
): void {
  if (prov?.owner == null || prov.owner === casterPlayer) return;
  const _ph = ph ?? turnContext._logCtx.phase ?? turnContext._currentPhase;
  // No hero (a real null charId, never inherited from the casting character's log context), so it files under the
  // owner's KINGDOM EVENTS; and no phase but the one worked out here (the bare form never had the End of Turn's 99).
  emit(turnContext, {
    type: 'system',
    text,
    audience: { actor: null, realms: [prov.owner] },
    province: prov.id,
    hero: 'none',
    phase: _ph ?? 'none',
    form: 'bare',
  });
}

// ── THE SKILL RISES HELD BACK TO THE END OF THE PHASE ────
// a character who dies later in the phase must not have a skill rise reported AFTER the fight
// that killed them ("📈 … March rises to level 1" trailing a duel death). The rise was real —
// earned on the march that carried them INTO the battle — so at the moment of death every
// deferred line of theirs is written out at once, i.e. before the battle narrative is emitted,
// exactly where the march sits in the sequence of events.
// Write out deferred skill lines. 2026-10-13 (item 6, Toby): a line earned in a battle
// (meta.afterBattleIn = that province) is placed straight after the last line of the most recent
// battle report there in the same phase, rather than after everything else the phase brought —
// the lines of one rise stay together and in order. With `inPlace` (a hero falling, whose battle
// is not yet written) every line is simply logged where it stands.
export function writeDeferredSkillLines(
  turnContext: TurnContext,
  list: TurnContext['_deferredSkillLogs'] | null | undefined,
  inPlace?: boolean,
): void {
  const { turnLog } = turnContext;
  const blocks = new Map<string, { p: number; ph: TurnEvent['phase']; ents: LogLine[] }>();
  (list ?? []).forEach(([msg, place]) => {
    const { afterBattleIn: p, ...line } = place;
    emit(turnContext, { ...line, type: 'system', text: msg });
    if (p == null || inPlace) return;
    const k = String(p) + '|' + String(line.phase);
    let block = blocks.get(k);
    if (!block) {
      block = { p, ph: line.phase, ents: [] };
      blocks.set(k, block);
    }
    const held = turnLog.pop();
    if (held) block.ents.push(held);
  });
  blocks.forEach(({ p, ph, ents }) => {
    let at = -1;
    for (let i = turnLog.length - 1; i >= 0; i--) {
      const x = turnLog[i];
      if (x?.battleId != null && x.provinceId === p && x.phase === ph) {
        at = i;
        break;
      }
    }
    if (at < 0) turnLog.push(...ents);
    else turnLog.splice(at + 1, 0, ...ents);
  });
}
