// The report-leak check (plan P1-04c): what a realm's turn report must never show it. Four pure checks on one turn,
// which checkTurn (invariants.ts) runs with the invariants wherever a harness has the realms' reports:
// - another realm's private line: a chronicle line that is one realm's own business (PRIVATE_LINES) reaches another;
// - an unmet realm: a report names a realm its reader hasn't met, before the game is over (ruling R-046);
// - an unseen hero: a hero under Invisibility is seen by another realm (only Clairvoyance pierces it);
// - a line its audience does not admit (P1-12b3, P1-12's Decision 12): a line a realm reads comes from no event of the
//   turn whose audience admits it, by the audience model stated here (linesTheirAudienceDoesNotAdmit), apart from the
//   views' own (playerEvents); where the harness records the turn's events (Turn.perception).
// The first three read the report's text and today's state and log metadata (an entry's actor and targets); what they
// can't see yet is in tests/README.md.
//
// Test code until P1-18's turn shell runs these checks; then it moves into src/. invariants.ts imports it, so it is
// an engine path (tools/balance/engine-paths.ts).
import type { Character, SavedState, Turn } from './invariants.ts';

/** A line that is one realm's own business. `line` names the hero whose realm it belongs to (group `hero`); a line
 *  that names none belongs to the one realm that reads it, so a second reader is a leak. */
export const PRIVATE_LINES: readonly { name: string; line: RegExp }[] = [
  { name: 'a hit-point rise', line: /💪 (?<hero>.+?) is hardened by the (?:wounds|victory)/ },
  { name: 'Invisibility', line: /✨ (?<hero>.+?) weaves Invisibility about themself/ },
  { name: 'moving unseen', line: /\[Intelligence\] 🕶 (?<hero>.+?) moved unseen this turn/ },
  { name: 'Call to Arms', line: /📯 Call to Arms!/ },
  { name: 'Resurrect', line: /✨(?:👑)? (?<hero>.+?) calls upon divine power — .+ rises from death at full health/ },
  {
    name: 'Divine Resurrection',
    line: /✨ \*\*Divine Resurrection\*\*: (?<hero>.+?)(?:, your monarch,)? returns to life/,
  },
  { name: 'Phantasmal Armies', line: /✨ (?<hero>.+?) conjures phantasmal duplicates/ },
  { name: 'Phantom Host', line: /✨ (?<hero>.+?) conjures a Phantom Host/ },
];

/** A chronicle line scried by Clairvoyance starts with this. The rulebook gives the caster everything that happens to
 *  the hero it watches, private lines included. */
export const CLAIRVOYANCE = '🔮 Clairvoyance — ';

/** The tables the player portal looks names up in, to colour them: not text it shows. Not read until P2-06 trims a
 *  report to what its reader may know (Theo, 2026-10-17). */
export const LOOKUP_TABLES: ReadonlySet<string> = new Set(['allKingdoms', 'nameColors']);

/** The lists of the heroes a realm sees now (the map, sightings, province intelligence, Encounter targets), as paths
 *  with [] for "each". Memory (everSeenChars) and the Titles card name heroes without seeing them. */
export const SIGHTINGS: readonly string[] = [
  'worldMeta.provinces[].characters[]',
  'ownedProvinces[].characters[]',
  'provinceCharIntel[].characters[]',
  'heroSightings[]',
  'visibleChars[]',
  'encounterTargets[]',
];

/** The report's lines that happen in a phase: the chronicle, province events and spy activity. */
const LINES: readonly string[] = ['lastTurnLog[]', 'provinceEvents[]', 'spyActivity[].lines[]'];

/** One realm's report, as the turn wrote it (turn_logs, player_index ≥ 0). */
export interface RealmReport {
  realm: number;
  report: Record<string, unknown>;
}
interface Found {
  at: string;
  value: unknown;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** `name` as a whole word or phrase: not inside a longer name ("Realm1" in "Realm12"). */
const named = (name: string) => new RegExp(`(?<![A-Za-z0-9])${escape(name)}(?![A-Za-z0-9])`);
const quote = (s: string) => `"${s.slice(0, 120)}"`;
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const textOf = (v: unknown) => record(v)['text'];

/** Every string in `v`, with where it is ("lastTurnLog[3].text"). */
function strings(v: unknown, at: string): { at: string; text: string }[] {
  if (typeof v === 'string') return [{ at, text: v }];
  if (Array.isArray(v)) return v.flatMap((x, i) => strings(x, `${at}[${String(i)}]`));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => strings(x, `${at}.${k}`));
  return [];
}

/** What `path` (as in SIGHTINGS) reaches in `report`. */
function select(report: Record<string, unknown>, path: string): Found[] {
  let found: Found[] = [{ at: '', value: report }];
  for (const step of path.split('.')) {
    const key = step.replace('[]', '');
    found = found.map((f) => ({ at: f.at ? `${f.at}.${key}` : key, value: record(f.value)[key] }));
    if (step.endsWith('[]'))
      found = found.flatMap((f) =>
        Array.isArray(f.value)
          ? (f.value as unknown[]).map((value, i) => ({ at: `${f.at}[${String(i)}]`, value }))
          : [],
      );
  }
  return found;
}

/** The GM log's lines whose actor or targets include `realm`: lines it is a party to. */
function partyTo(t: Turn, realm: number): Set<unknown> {
  return new Set(
    t.gmLog
      .filter((e) => e.actor === realm || (Array.isArray(e.targets) && e.targets.includes(realm)))
      .map((e) => e.text),
  );
}

/** The realms a hero served this turn: his realm when it began and when it ended, and, if a Charm seized him this turn
 *  (_charmedTurn), the realm that acted through him: his GM lines (charId) logged for its own action (its actor among
 *  their targets). The Charm hands him to the caster until the turn ends; the state keeps no record of whose he was. */
function realmsServed(t: Turn, c: Character): Set<unknown> {
  const charmed = typeof t.after.turn === 'number' && c._charmedTurn === t.after.turn - 1;
  const acted = t.gmLog.filter((e) => e.charId === c.id && Array.isArray(e.targets) && e.targets.includes(e.actor));
  return new Set(
    [
      t.before.characters.find((b) => b.id === c.id)?.player,
      c.player,
      ...(charmed ? acted.map((e) => e.actor) : []),
    ].filter((p) => typeof p === 'number'),
  );
}

/** A hero's name without the " (wandering)" the engine adds when he leaves his realm. */
const baseName = (name: unknown) => String(name).replace(/ \(wandering\)$/, '');

/** Each hero by his name (baseName) before or after the turn; a name two heroes share is left out. */
function heroesByName(t: Turn): Map<string, Character> {
  const ids = new Map<string, Set<unknown>>();
  const hero = new Map<string, Character>();
  for (const c of [...t.after.characters, ...t.before.characters]) {
    if (typeof c.name !== 'string') continue;
    const n = baseName(c.name);
    ids.set(n, (ids.get(n) ?? new Set()).add(c.id));
    if (!hero.has(n)) hero.set(n, c);
  }
  for (const [n, set] of ids) if (set.size > 1) hero.delete(n);
  return hero;
}

/** No realm reads another realm's private line in any of its report's lines (LINES: the chronicle, province events and
 *  spy activity): a PRIVATE_LINES line naming a hero is read only by the realms he served this turn, and one naming none
 *  by one realm only. A name two heroes share isn't checked. Clairvoyance's lines are let through (CLAIRVOYANCE). */
function privateLines(t: Turn): string[] {
  const byName = heroesByName(t);
  const readers = new Map<string, Set<number>>();
  const out: string[] = [];
  for (const r of t.reports ?? [])
    for (const { at, value } of LINES.flatMap((path) => select(r.report, path))) {
      const text = textOf(value);
      if (typeof text !== 'string' || text.startsWith(CLAIRVOYANCE)) continue;
      for (const p of PRIVATE_LINES) {
        const m = p.line.exec(text);
        if (!m) continue;
        const hero = m.groups?.['hero'];
        if (hero == null) {
          readers.set(text, (readers.get(text) ?? new Set()).add(r.realm));
          continue;
        }
        const c = byName.get(hero);
        const served = c ? realmsServed(t, c) : new Set();
        if (served.size && !served.has(r.realm))
          out.push(
            `realm ${String(r.realm)} reads ${p.name} of realm ${[...served].join(', ')}'s ${hero} at ${at}: ${quote(text)}`,
          );
      }
    }
  for (const [text, realms] of readers)
    if (realms.size > 1) out.push(`realms ${[...realms].join(', ')} all read ${quote(text)}`);
  return out;
}

/** The realms of the heroes `r` sees (its SIGHTINGS, less the parked list of its own provinces' heroes). */
function realmsSeen(s: SavedState, r: RealmReport): unknown[] {
  return SIGHTINGS.filter((path) => !path.startsWith('ownedProvinces'))
    .flatMap((path) => select(r.report, path))
    .map(({ value }) => {
      const v = record(value);
      return s.characters.find((c) => (v['id'] != null ? c.id === v['id'] : c.name === v['name']))?.player;
    })
    .filter((p) => p != null);
}

/** Before the game is over, no report names a realm its reader hasn't met, other than in a chronicle line the reader
 *  is a party to (R-046). Met: the state's _encountered after the turn, and the realms of the heroes the report shows
 *  it now (seeing a realm's hero meets that realm; the engine records it at its next look, a phase or a turn later).
 *  A name shared with a met realm, or inside one, is no secret. */
function unmetRealms(t: Turn): string[] {
  const s = t.after;
  if (s.gameOver) return [];
  const realms = s.players ?? [];
  return (t.reports ?? []).flatMap((r) => {
    const met = new Set<unknown>([r.realm, ...(realms[r.realm]?._encountered ?? []), ...realmsSeen(s, r)]);
    const metNames = realms.flatMap((p, i) => (met.has(i) && typeof p.name === 'string' && p.name ? [p.name] : []));
    const unmet = realms.flatMap((p, i) =>
      !met.has(i) && typeof p.name === 'string' && p.name && !metNames.includes(p.name)
        ? [{ i, re: named(p.name) }]
        : [],
    );
    if (!unmet.length) return [];
    // A met realm's name may hold an unmet one ("The Outriders of the Ford", "The Outriders"): the longest go first.
    const metRe = metNames.sort((a, b) => b.length - a.length).map((n) => new RegExp(named(n).source, 'g'));
    const withoutMet = (text: string) => metRe.reduce((x, re) => x.replace(re, ' '), text);
    const party = partyTo(t, r.realm);
    return Object.entries(r.report)
      .filter(([k]) => !LOOKUP_TABLES.has(k))
      .flatMap(([k, v]) => strings(v, k))
      .filter(({ at, text }) => !(at.startsWith('lastTurnLog[') && party.has(text)))
      .flatMap(({ at, text }) =>
        unmet
          .filter((u) => u.re.test(withoutMet(text)))
          .map(
            (u) =>
              `realm ${String(r.realm)} hasn't met realm ${String(u.i)}, but its report names it at ${at}: ${quote(text)}`,
          ),
      );
  });
}

/** Title intelligence (end of turn) names the heroes behind a title's figures, as the Titles card does: not a sighting. */
export const TITLE_INTEL = /^\[The [^\]]+\] /;

/** A hero who cast Invisibility this turn is seen by no realm but those he served this turn (realmsServed), unless it
 *  watches him by Clairvoyance: he is in none of its SIGHTINGS, and no line of its report names him from the
 *  moment he cast it (his "weaves Invisibility" line: its phase, and within it, its place in the GM log). Let through:
 *  title intelligence (TITLE_INTEL), and every line from the phase he first acts on the reader, his deeds being the
 *  lines that name him and were logged for the action of a realm he served or as a notice of what was done to the
 *  reader (no actor); after a deed come its consequences ("…'s possessions pass to him"). Whether acting on a realm
 *  reveals an invisible hero to it is for Toby to rule (Theo, 2026-10-17). One breach per realm, hero, phase and kind
 *  of line (one of the reader's own orders or reactions, its actor the reader; or any other): the first, and a count. A name two heroes share isn't checked. The state saves the turn he cast it, one before the
 *  state's. */
function unseenHeroes(t: Turn): string[] {
  const { turn, players: realms = [], characters } = t.after;
  if (typeof turn !== 'number') return [];
  /** Where he cast it: its phase, and its place in the GM log (a line before it in the same phase came first). */
  const castAt = (c: Character) => {
    const i = t.gmLog.findIndex((e) => e.charId === c.id && /weaves Invisibility/.test(String(e.text)));
    const phase = t.gmLog[i]?.phase;
    return { from: typeof phase === 'number' ? phase : 0, index: i };
  };
  /** A report line's place in the GM log: the first GM line with its text in its phase (-1 if none). */
  const gmIndex = (text: string, phase: number) =>
    t.gmLog.findIndex((e) => e.text === text && (typeof e.phase === 'number' ? e.phase : 99) === phase);
  const byName = heroesByName(t);
  const invisible = characters
    .filter((c) => c._invisTurn === turn - 1 && typeof c.name === 'string' && byName.get(baseName(c.name)) != null)
    .map((c) => ({ c, served: realmsServed(t, c), ...castAt(c), re: named(String(c.name)) }));
  if (!invisible.length) return [];
  return (t.reports ?? []).flatMap((r) => {
    const seen = SIGHTINGS.flatMap((path) => select(r.report, path));
    const lines = LINES.flatMap((path) => select(r.report, path));
    return invisible
      .filter(({ c, served }) => !served.has(r.realm) && realms[r.realm]?._clairCharThisTurn !== c.id)
      .flatMap(({ c, served, from, index, re }) => {
        const who = `${String(c.name)} (id ${String(c.id)}, invisible from phase ${String(from)})`;
        const deeds = new Set(t.gmLog.filter((e) => e.actor == null || served.has(e.actor)).map((e) => e.text));
        const sightings = seen
          .filter(({ value }) => {
            const v = record(value);
            return v['id'] === c.id || (v['id'] == null && v['name'] === c.name);
          })
          .map(({ at }) => `realm ${String(r.realm)} sees ${who} at ${at}`);
        const naming = lines.flatMap(({ at, value }) => {
          const text = textOf(value);
          const ph = record(value)['phase'];
          const phase = typeof ph === 'number' ? ph : 99;
          if (typeof text !== 'string' || phase < from || !re.test(text)) return [];
          const i = gmIndex(text, phase);
          if (phase === from && i >= 0 && i < index) return [];
          return [{ at, text, phase, own: t.gmLog[i]?.actor === r.realm }];
        });
        const actsFrom = Math.min(...naming.filter((l) => deeds.has(l.text)).map((l) => l.phase));
        const byPhase = new Map<string, { at: string; text: string; phase: number; own: boolean; more: number }>();
        for (const l of naming) {
          if (l.phase >= actsFrom || TITLE_INTEL.test(l.text)) continue;
          const key = `${String(l.phase)} ${String(l.own)}`;
          const first = byPhase.get(key);
          if (first) first.more++;
          else byPhase.set(key, { ...l, more: 0 });
        }
        return [
          ...sightings,
          ...[...byPhase.values()].map(
            ({ at, text, phase, own, more }) =>
              `realm ${String(r.realm)} reads of ${who} in phase ${String(phase)}` +
              `${own ? ', in a line of its own order,' : ''} at ${at}: ${quote(text)}` +
              (more ? ` (and ${String(more)} more lines like it that phase)` : ''),
          ),
        ];
      });
  });
}

/** An event as the turn emitted it (TurnEvent, src/engine/turn/events-and-their-audiences.ts), as scenarioInTheVm's
 *  recordTheEvents notes it: its audience as given, and the phase and the hero its line was filed under. */
export interface EventAsEmitted {
  type?: unknown;
  text?: unknown;
  audience: {
    realms?: unknown[] | undefined;
    actor?: unknown;
    seen?: 'world' | 'there' | 'battle' | undefined;
    except?: unknown[] | undefined;
  };
  province: unknown;
  phase: unknown;
  hero: unknown;
  heroes: unknown[] | null;
  spy: boolean;
}
/** What perception read besides the world: the turn's events, and its sight (resolveTurn's whatTheReportsRead). */
export interface Perception {
  events: EventAsEmitted[];
  /** Whose heroes stood in each province at the start of each phase. */
  presence: { phase: unknown; province: unknown; realms: unknown[] }[];
  /** Each realm's Clairvoyance watch, by realm: the hero, and the phase it began. */
  clairvoyance: Record<string, { charId?: unknown; fromPhase?: unknown } | undefined>;
}

/** A realm's name, made nameless as a reader who hasn't met it reads it, in a line it is no party to (R-046). */
const UNKNOWN_REALM = /\b[Aa]n unknown realm\b/;
/** Where a report shows the turn's lines: the chronicle and the province events (the spy feed, read apart). */
const LINES_READ: readonly string[] = ['lastTurnLog[]', 'provinceEvents[]'];
const isNumber = (v: unknown): v is number => typeof v === 'number';
const phaseOf = (v: unknown): number | null => (isNumber(v) ? v : null);

/** Every line a realm reads (the chronicle, its province events, its spy feed) comes from an event of the turn whose
 *  audience admits it, by the audience model (P1-12's Decision 7: eight grants, and perception's two), stated here apart
 *  from the views' playerEvents, so a fault in either shows. A realm reads a line only if an event of the turn with its text, in its
 *  phase, admits it. Not if the event excepts the realm (except); otherwise:
 *  - told: the realm is among the event's realms;
 *  - its own deed: the realm is its actor;
 *  - about its hero: its hero, or one of its heroes, is one the realm owns as the report is built;
 *  - the world: seen by the world;
 *  - eyes there: seen there, in a province the realm owns, or where a hero of its own stood that phase, or that it spied
 *    that phase or before (any phase, for a line with none);
 *  - a battle's lines: read by those who fought in it, who are told (realms); seen in the battle grants no one else;
 *  - nobody else (the GM's own lines);
 *  and through perception:
 *  - a spy's lingering sight (its report's spyActivity): in a province the realm spied, from the next phase on, what
 *    anyone there might see: an event seen by the world, there or in the battle, that doesn't except it;
 *  - Clairvoyance (a chronicle line starting CLAIRVOYANCE): every event about the hero the realm watches (his, or among
 *    its heroes), from the phase the watch began; and, with no phase, where he stands as the turn ends.
 *  In a line the realm reads, an unmet realm's name may be "an unknown realm" (R-046). Each breach says which line
 *  and where; a line of a province the realm spied, after its spy, that its audience keeps from it is told apart
 *  ("through its spy"). Runs where the harness records the turn's events (Turn.perception). */
function linesTheirAudienceDoesNotAdmit(t: Turn): string[] {
  const p = t.perception;
  if (!p) return [];
  const s = t.after;
  // A line, as a reader who has met no realm reads it: every realm's name made nameless, longest first.
  const names = (s.players ?? [])
    .map((r) => r.name)
    .filter((n): n is string => typeof n === 'string' && n !== '')
    .sort((a, b) => b.length - a.length)
    .map((n) => new RegExp(named(n).source, 'g'));
  const nameless = (text: string) => names.reduce((x, re) => x.replace(re, '\0'), text);
  const unknownRealms = (text: string) => text.replace(new RegExp(UNKNOWN_REALM.source, 'g'), '\0');
  const key = (phase: number | null, text: string) => `${String(phase)}|${text}`;
  const byLine = new Map<string, EventAsEmitted[]>();
  const byPhase = new Map<number | null, EventAsEmitted[]>();
  for (const e of p.events) {
    if (typeof e.text !== 'string') continue;
    const phase = phaseOf(e.phase);
    const k = key(phase, e.text);
    byLine.set(k, [...(byLine.get(k) ?? []), e]);
    byPhase.set(phase, [...(byPhase.get(phase) ?? []), e]);
  }
  /** The events a line of `text` in `phase` may come from: those with its text, or with a realm's name where it reads
   *  "an unknown realm". */
  const sources = (text: string, phase: number | null): EventAsEmitted[] => {
    const exact = byLine.get(key(phase, text));
    if (exact) return exact;
    if (!UNKNOWN_REALM.test(text)) return [];
    const masked = nameless(unknownRealms(text));
    return (byPhase.get(phase) ?? []).filter((e) => typeof e.text === 'string' && nameless(e.text) === masked);
  };
  const present = new Set(
    p.presence.flatMap((x) => x.realms.map((r) => `${String(x.phase)}|${String(x.province)}|${String(r)}`)),
  );
  const heroName = new Map(s.characters.map((c) => [c.id, c.name]));
  return (t.reports ?? []).flatMap((r) => {
    const realm = r.realm;
    const owned = new Set(s.players?.[realm]?.provinces ?? []);
    const ownHeroes = new Set(s.characters.filter((c) => c.player === realm).map((c) => c.id));
    // The provinces it spied, each from the first phase it did (a spy's line: its actor the realm, its province).
    const spied = new Map<unknown, number>();
    for (const e of p.events)
      if (e.spy && e.audience.actor === realm && e.province != null) {
        const phase = phaseOf(e.phase) ?? 0;
        const was = spied.get(e.province);
        if (was === undefined || phase < was) spied.set(e.province, phase);
      }
    const eyesThere = (province: unknown, phase: number | null) => {
      if (owned.has(province)) return true;
      if (phase != null && present.has(`${String(phase)}|${String(province)}|${String(realm)}`)) return true;
      const from = spied.get(province);
      return from !== undefined && (phase == null || from <= phase);
    };
    const excepted = (e: EventAsEmitted) => (e.audience.except ?? []).includes(realm);
    const admits = (e: EventAsEmitted) => {
      const a = e.audience;
      if (excepted(e)) return false;
      return (
        (a.realms ?? []).includes(realm) ||
        a.actor === realm ||
        (e.hero != null && ownHeroes.has(e.hero)) ||
        (e.heroes ?? []).some((h) => ownHeroes.has(h)) ||
        a.seen === 'world' ||
        (a.seen === 'there' && e.province != null && eyesThere(e.province, phaseOf(e.phase)))
      );
    };
    const watch = p.clairvoyance[String(realm)];
    const watched = watch?.charId;
    /** A Clairvoyance line: an event about the watched hero, from the watch's phase; or, with no phase, where he stands
     *  as the turn ends. */
    const scried = (text: string, phase: number | null) => {
      if (watched == null) return false;
      if (phase == null) return text.startsWith(`as the turn ends, ${String(heroName.get(watched))} stands in `);
      const from = phaseOf(watch?.fromPhase) ?? 0;
      return (
        phase >= from && sources(text, phase).some((e) => e.hero === watched || (e.heroes ?? []).includes(watched))
      );
    };
    const out: string[] = [];
    const notAdmitted = (at: string, text: string) =>
      `realm ${String(realm)} reads a line its audience does not admit at ${at}: ${quote(text)}`;
    for (const { at, value } of LINES_READ.flatMap((path) => select(r.report, path))) {
      const text = textOf(value);
      if (typeof text !== 'string') continue;
      const phase = phaseOf(record(value)['phase']);
      if (at.startsWith('lastTurnLog[') && text.startsWith(CLAIRVOYANCE)) {
        if (!scried(text.slice(CLAIRVOYANCE.length), phase)) out.push(notAdmitted(at, text));
        continue;
      }
      if (!sources(text, phase).some(admits)) out.push(notAdmitted(at, text));
    }
    for (const { at, value } of select(r.report, 'spyActivity[]')) {
      const province = record(value)['provId'];
      const from = spied.get(province);
      for (const line of select(record(value), 'lines[]')) {
        const text = textOf(line.value);
        if (typeof text !== 'string') continue;
        const phase = phaseOf(record(line.value)['phase']);
        const where = `${at}.${line.at}`;
        const events = sources(text, phase);
        if (events.some(admits)) continue;
        // its spy's lingering sight: the province it spied, from the next phase on
        const lingering = events.filter(
          (e) => e.province === province && from !== undefined && phase != null && phase > from,
        );
        if (lingering.some((e) => e.audience.seen !== undefined && !excepted(e))) continue;
        out.push(
          lingering.length
            ? `realm ${String(realm)} reads, through its spy, a line its audience keeps from it at ${where}: ${quote(text)}`
            : notAdmitted(where, text),
        );
      }
    }
    return out;
  });
}

/** The leak checks, in the order they are checked. */
export const LEAK_CHECKS: readonly { name: string; check: (t: Turn) => string[] }[] = [
  { name: "another realm's private line", check: privateLines },
  { name: 'an unmet realm', check: unmetRealms },
  { name: 'an unseen hero', check: unseenHeroes },
  { name: 'a line its audience does not admit', check: linesTheirAudienceDoesNotAdmit },
];
