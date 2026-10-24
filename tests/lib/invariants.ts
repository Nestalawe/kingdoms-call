// The invariants (plan P1-04b): what must be true after every turn, whatever the rules say. Each is a pure check on one
// turn as a harness sees it: the saved state before and after, the GM log's lines, the telemetry rows and the realms'
// game_players rows. They only read. turn-fuzz and the balance matrix (tools/balance/play.ts) run them after every
// turn; a breach fails that game. Each has a unit test with a made-up turn that breaks it (unit/invariants.test.ts).
//
// checkTurn also runs the report-leak check (report-leaks.ts, P1-04c) on the turn's reports, where the harness has them.
//
// Test code until P1-18's turn shell runs these checks; then it moves into src/. The balance code imports it, so it
// is an engine path (tools/balance/engine-paths.ts): a change to it plays the matrix.
import { LEAK_CHECKS, type Perception, type RealmReport } from './report-leaks.ts';

/** An item, held by a character or in a lair's hoard. */
export interface Item {
  id?: unknown;
  name?: unknown;
}
export interface Character {
  id?: unknown;
  name?: unknown;
  player?: unknown;
  alive?: unknown;
  hp?: unknown;
  maxHp?: unknown;
  location?: unknown;
  armies?: unknown[];
  items?: Item[];
  /** The turn the character cast Invisibility, and the turn a Charm seized them. */
  _invisTurn?: unknown;
  _charmedTurn?: unknown;
}
export interface Province {
  id?: unknown;
  features?: { hoardItems?: Item[] }[];
}
export interface Mercenary {
  id?: unknown;
  unitName?: unknown;
  location?: unknown;
}
/** A realm in the saved state. */
export interface Realm {
  name?: unknown;
  /** The realms this one has met. */
  _encountered?: unknown[];
  /** The character it watches by Clairvoyance this turn. */
  _clairCharThisTurn?: unknown;
  /** The provinces it owns. */
  provinces?: unknown[];
}
/** The saved game_state, as far as the checks read it. */
export interface SavedState {
  turn?: unknown;
  gameOver?: unknown;
  world: { provinces: Province[] };
  players?: Realm[];
  characters: Character[];
  mercenaries?: Mercenary[];
  _awardedItems?: unknown[];
}
/** A GM log line, as turn_logs keeps it (player_index -1). */
export interface LogEntry {
  type?: unknown;
  text?: unknown;
  charId?: unknown;
  phase?: unknown;
  /** The realm whose action it is, and the realms it is addressed to. */
  actor?: unknown;
  targets?: unknown;
  [key: string]: unknown;
}
/** A telemetry row (turn_events), as far as the checks read it: who died, and in which phase. */
export interface TelemetryRow {
  outcomes?: { deaths?: { list?: { ph?: unknown; charId?: unknown }[] } };
}
/** A realm's game_players row after the run. */
export interface PlayerRow {
  player_index?: unknown;
  user_id?: unknown;
  orders_submitted?: unknown;
}
export interface Turn {
  /** The saved state the turn started from. */
  before: SavedState;
  /** The saved state it left. */
  after: SavedState;
  /** The turn's GM log lines. */
  gmLog: LogEntry[];
  /** The turn's telemetry rows. */
  telemetry: TelemetryRow[];
  /** Every realm's game_players row, read after the run. */
  players: PlayerRow[];
  /** The realms' reports the turn wrote (none in an all-bot game). */
  reports?: RealmReport[];
  /** What perception read besides the world, where the harness records it (scenarioInTheVm's recordTheEvents). */
  perception?: Perception;
}
export interface Breach {
  check: string;
  /** What broke, one line each (at most MAX_LISTED, then a count). */
  what: string[];
}

/** Items that aren't on the ledger of found items (_awardedItems), because there are many of them: the dwarves' own
 *  suit, granted to every dwarven character of a dwarven realm and never found in a lair. */
export const UNLEDGERED_ITEMS: ReadonlySet<string> = new Set(['Mithril Armour']);

const MAX_LISTED = 5;
const who = (c: Character) => `${String(c.name)} (id ${String(c.id)})`;
const living = (s: SavedState) => s.characters.filter((c) => c.alive !== false);
const dead = (s: SavedState) => s.characters.filter((c) => c.alive === false);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const BAD_WORD = /\bNaN\b|\bundefined\b/;

/** Every place an item can be: with a character (living or dead), or in a lair's hoard. */
function placedItems(s: SavedState): { item: Item; where: string }[] {
  return [
    ...s.characters.flatMap((c) => (c.items ?? []).map((item) => ({ item, where: 'with ' + who(c) }))),
    ...s.world.provinces.flatMap((p) =>
      (p.features ?? []).flatMap((f) =>
        (f.hoardItems ?? []).map((item) => ({ item, where: `in a hoard in province ${String(p.id)}` })),
      ),
    ),
  ];
}

/** The values that appear more than once in `values`, each once. null and undefined are left out. */
function repeated(values: unknown[]): unknown[] {
  const seen = new Set<unknown>();
  const twice = new Set<unknown>();
  for (const v of values) {
    if (v == null) continue;
    if (seen.has(v)) twice.add(v);
    seen.add(v);
  }
  return [...twice];
}

/** No NaN or undefined: not as a value in the state, and not as a word in any of its strings or in the GM log's lines
 *  (a sum that went wrong, written into prose). A saved state is JSON, where NaN is saved as null: the HP check catches
 *  that where it matters most. */
function noNaNOrUndefined(t: Turn): string[] {
  const out: string[] = [];
  const at: (string | number)[] = [];
  const place = () => at.map((k) => (typeof k === 'number' ? `[${String(k)}]` : '.' + k)).join('');
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      if (BAD_WORD.test(v)) out.push(`state${place()}: "${v.slice(0, 120)}"`);
    } else if (v === undefined || (typeof v === 'number' && Number.isNaN(v))) {
      out.push(`state${place()} is ${String(v)}`);
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        at.push(i);
        walk(v[i]);
        at.pop();
      }
    } else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        at.push(k);
        walk(x);
        at.pop();
      }
    }
  };
  walk(t.after);
  t.gmLog.forEach((e, i) => {
    if (typeof e.text !== 'string') out.push(`GM log line ${String(i)} has no text (${String(e.text)})`);
    else if (BAD_WORD.test(e.text)) out.push(`GM log line ${String(i)}: "${e.text.slice(0, 120)}"`);
  });
  return out;
}

/** Every character's hit points are a number from 0 to their maximum. */
function hpInRange(t: Turn): string[] {
  return t.after.characters.flatMap((c) =>
    isNumber(c.hp) && isNumber(c.maxHp) && c.hp >= 0 && c.hp <= c.maxHp
      ? []
      : [`${who(c)} has ${String(c.hp)} HP of ${String(c.maxHp)}`],
  );
}

/** No two characters, provinces, mercenary bands or items share an id. */
function uniqueIds(t: Turn): string[] {
  const s = t.after;
  const kinds: [string, unknown[]][] = [
    ['characters', s.characters.map((c) => c.id)],
    ['provinces', s.world.provinces.map((p) => p.id)],
    ['mercenary bands', (s.mercenaries ?? []).map((m) => m.id)],
    ['items', placedItems(s).map((x) => x.item.id)],
  ];
  return kinds.flatMap(([kind, ids]) => repeated(ids).map((id) => `two ${kind} have id ${String(id)}`));
}

/** Found items are unique: the ledger of found items (_awardedItems) names each once, every item in play (other than
 *  UNLEDGERED_ITEMS) is on it, and no name on it is in two places at once. */
function itemsMatchLedger(t: Turn): string[] {
  const s = t.after;
  const ledger = s._awardedItems ?? [];
  const onLedger = new Set(ledger);
  const out = repeated(ledger).map((n) => `the ledger names ${String(n)} twice`);
  const places = new Map<unknown, string[]>();
  for (const { item, where } of placedItems(s)) {
    if (typeof item.name === 'string' && UNLEDGERED_ITEMS.has(item.name)) continue;
    if (!onLedger.has(item.name)) out.push(`${String(item.name)} (${where}) isn't on the ledger`);
    places.set(item.name, [...(places.get(item.name) ?? []), where]);
  }
  for (const [name, where] of places)
    if (where.length > 1) out.push(`${String(name)} is in ${String(where.length)} places: ${where.join('; ')}`);
  return out;
}

/** Every living character, with any armies they lead, and every mercenary band stands in a province of the map. */
function armiesInRealProvinces(t: Turn): string[] {
  const s = t.after;
  const ids = new Set(s.world.provinces.map((p) => p.id));
  const armies = (c: Character) => (c.armies?.length ? ` with ${String(c.armies.length)} armies` : '');
  return [
    ...living(s)
      .filter((c) => !ids.has(c.location))
      .map((c) => `${who(c)}${armies(c)} is in province ${String(c.location)}, which isn't on the map`),
    ...(s.mercenaries ?? [])
      .filter((m) => !ids.has(m.location))
      .map((m) => `mercenary band ${String(m.unitName)} (id ${String(m.id)}) is in province ${String(m.location)}`),
  ];
}

/** A character dead at the end of the turn has no GM log line of their own (charId) after the phase they died in, and
 *  none at all if they were dead before it began, other than battle lines (type 'combat'): a fallen commander's
 *  leaderless host fights on, and its lines carry his id (ruling R-019; Theo, 2026-10-17). The phase comes from the
 *  telemetry's deaths; a character who died with no death recorded there isn't checked. One raised and killed again in
 *  the turn counts from the last death. */
function deadTakeNoActions(t: Turn): string[] {
  const diedIn = new Map<unknown, number>();
  for (const row of t.telemetry)
    for (const d of row.outcomes?.deaths?.list ?? [])
      if (isNumber(d.ph)) diedIn.set(d.charId, Math.max(diedIn.get(d.charId) ?? -Infinity, d.ph));
  const deadBefore = new Set(dead(t.before).map((c) => c.id));
  return dead(t.after).flatMap((c) => {
    const since = diedIn.get(c.id) ?? (deadBefore.has(c.id) ? -Infinity : null);
    if (since == null) return [];
    return t.gmLog
      .filter((e) => e.charId === c.id && e.type !== 'combat' && isNumber(e.phase) && e.phase > since)
      .map(
        (e) =>
          `${who(c)}, dead ${since === -Infinity ? 'since before the turn' : `in phase ${String(since)}`}, ` +
          `acts in phase ${String(e.phase)}: "${String(e.text).slice(0, 100)}"`,
      );
  });
}

/** After a run, no player's realm is still marked as having submitted its orders (the runaway-turn guard). */
function ordersSubmittedCleared(t: Turn): string[] {
  return t.players
    .filter((p) => p.user_id && p.orders_submitted)
    .map((p) => `realm ${String(p.player_index)} is still marked as having submitted its orders`);
}

/** The invariants, in the order they are checked. */
export const INVARIANTS: readonly { name: string; check: (t: Turn) => string[] }[] = [
  { name: 'no NaN or undefined', check: noNaNOrUndefined },
  { name: 'HP in range', check: hpInRange },
  { name: 'unique ids', check: uniqueIds },
  { name: 'items match the ledger', check: itemsMatchLedger },
  { name: 'armies in real provinces', check: armiesInRealProvinces },
  { name: 'the dead take no actions', check: deadTakeNoActions },
  { name: 'orders_submitted cleared', check: ordersSubmittedCleared },
];

/** Breaches known on main, each let through, in exactly this form, until its fix lands (Theo, 2026-10-17: no engine
 *  fixes during the refactor; the leak check's three and the dead wanderer's hire, the same day). Each fix is parked in
 *  the plan's STATUS; its pull
 *  request removes the entry. `line` matches one line of what broke. */
export const KNOWN_BREACHES: readonly { check: string; line: RegExp; why: string }[] = [
  {
    check: 'no NaN or undefined',
    line: /^GM log line \d+: "⚑FORCE⚑\{"name":"[^"()]+ \(undefined\)","color":null,"neutral":true,"guard":false,"role":"defender",/,
    why: "A hero with no realm defends a province: the battle header's realm name is undefined (the GM portal's defender forceMarker)",
  },
  {
    check: 'the dead take no actions',
    line: /^(?<hero>[^"(),]+) \(id \d+\), dead in phase \d, acts in phase \d: "\k<hero> \((?:Human|Elven|Dwarven|Orcish), (?:Divine|Good|Druidic|Neutral|Pagan|Evil|Undead)\) agrees to serve [^"]+"$/,
    why: "A wanderer who died earlier in the turn can still be hired: the hire order checks that he serves no realm and stands in the province, not that he is alive (the GM portal's hire case)",
  },
  {
    check: 'an unseen hero',
    line: /^realm \d+ reads of [^"]+ \(id \d+, invisible from phase \d\) in phase \d+, in a line of its own order, at lastTurnLog\[\d+\]: "[^"]*"(?: \(and \d+ more lines like it that phase\))?$/,
    why: "Enemy orders and reactions still reach a hero after he turns invisible (the Defend ambush, Encounter and Pursue, a chase under way, Spy on a hero, Steal, Curse: they check cloaks and Vanish, not Invisibility), and the acting realm's report tells it so",
  },
  {
    check: "another realm's private line",
    line: /^realm \d+ reads [A-Za-z -]+ of realm \d+(?:, \d+)*'s [^"]+ at spyActivity\[\d+\]\.lines\[\d+\]: ".*"$/,
    why: "Another realm's private line in the report's spy activity section: waits for P1-23",
  },
  {
    check: 'a line its audience does not admit',
    line: /^realm \d+ reads, through its spy, a line its audience keeps from it at spyActivity\[\d+\]\.lines\[\d+\]: ".*"$/,
    why: "Another realm's private line in the report's spy activity section: waits for P1-23",
  },
  {
    check: 'a line for one realm alone',
    line: /^realm \d+ reads a line for realm \d+(?:, \d+)* alone at spyActivity\[\d+\]\.lines\[\d+\]: ".*"$/,
    why: "Another realm's private line in the report's spy activity section: waits for P1-23",
  },
];
const known = (check: string, line: string) => KNOWN_BREACHES.some((k) => k.check === check && k.line.test(line));

/** Every invariant and leak check `turn` breaks, less the KNOWN_BREACHES; [] when it keeps them all. */
export function checkTurn(turn: Turn): Breach[] {
  return run([...INVARIANTS, ...LEAK_CHECKS], turn);
}

/** The leak checks alone, for a harness without the turn's telemetry or game_players rows (report-privacy). */
export function checkLeaks(turn: Turn): Breach[] {
  return run(LEAK_CHECKS, turn);
}

function run(checks: readonly { name: string; check: (t: Turn) => string[] }[], turn: Turn): Breach[] {
  return checks.flatMap(({ name, check }) => {
    const what = check(turn).filter((line) => !known(name, line));
    if (!what.length) return [];
    const more = what.length - MAX_LISTED;
    return [{ check: name, what: more > 0 ? [...what.slice(0, MAX_LISTED), `…and ${String(more)} more`] : what }];
  });
}

/** The breaches as lines for a failure message, under `where` (e.g. "G3 turn 7"). */
export function describeBreaches(where: string, breaches: Breach[]): string {
  return breaches.map((b) => `${where}: ${b.check}: ${b.what.join(' | ')}`).join('\n');
}
