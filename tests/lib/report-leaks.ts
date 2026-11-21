// The report-leak check (plan P1-04c): what a realm's turn report must never show it. Four pure checks on one turn,
// which checkTurn (invariants.ts) runs with the invariants wherever a harness has the realms' reports:
// - another realm's private line: a line that is one realm's own business (PRIVATE_LINES) reaches another;
// - an unmet realm: a report names a realm its reader hasn't met, before the game is over (ruling R-046);
// - an unseen hero: a hero under Invisibility is seen by another realm (only Clairvoyance pierces it);
// - a line its audience does not admit (P1-12b3; B-18g): a line a realm reads didn't come through the gate
//   (theLinesOfTheTurnTheRealmReads, src/views/) by the way its part of the report needs; the check asks the gate and
//   keeps no audience model of its own (linesTheirAudienceDoesNotAdmit); where the harness records the turn's events
//   (Turn.perception);
// - a line for one realm alone (P1-12c4, P1-12's Decision 6): a line of a kind whose audience, in the engine's table,
//   is one realm's alone (THE_KINDS_WHOSE_AUDIENCE_IS_ONE_REALMS_ALONE, B-19) is read by another realm, whatever
//   audience the engine gave it; where the harness records the turn's events.
// The first three read the report's text and today's state and log metadata (an entry's actor and targets); what they
// can't see yet is in docs/architecture/how-the-tests-reach-the-site.md.
//
// Test code until P1-18's turn shell runs these checks; then it moves into src/. invariants.ts imports it, so it is
// an engine path (tools/balance/engine-paths.ts).
import {
  THE_KINDS_WHOSE_AUDIENCE_IS_ONE_REALMS_ALONE,
  type LineAudience,
  type LogLine,
} from '../../src/engine/turn/events-and-their-audiences.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';
import {
  theLinesOfTheTurnTheRealmReads,
  type ALineAsTheGateReadsIt,
  type ALineTheRealmReads,
  type TheTurnsSight,
} from '../../src/views/the-gate-that-says-which-lines-of-the-turn-each-realm-reads-and-how-each-reaches-it.ts';
import type { Character, SavedState, Turn } from './invariants.ts';

/** A line that is one realm's own business. `line` names the hero whose realm it belongs to (group `hero`); a line
 *  that names none belongs to the one realm that reads it, so a second reader is a leak. A spy who stays in a province
 *  sees what rival heroes do there (R-118: their Call to Arms, their Resurrect), so in a spy's feed only the lines
 *  marked `inASpysFeedToo` are checked: news, not a deed. */
export const PRIVATE_LINES: readonly { name: string; line: RegExp; inASpysFeedToo?: true }[] = [
  { name: 'a hit-point rise', line: /💪 (?<hero>.+?) is hardened by the (?:wounds|victory)/, inASpysFeedToo: true },
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
 *  spy activity, where only the lines marked `inASpysFeedToo` count): a PRIVATE_LINES line naming a hero is read only
 *  by the realms he served this turn, and one naming none by one realm only. A name two heroes share isn't checked.
 *  Clairvoyance's lines are let through (CLAIRVOYANCE). */
function privateLines(t: Turn): string[] {
  const byName = heroesByName(t);
  const readers = new Map<string, Set<number>>();
  const out: string[] = [];
  for (const r of t.reports ?? [])
    for (const { at, value } of LINES.flatMap((path) => select(r.report, path))) {
      const text = textOf(value);
      if (typeof text !== 'string' || text.startsWith(CLAIRVOYANCE)) continue;
      for (const p of PRIVATE_LINES) {
        if (at.startsWith('spyActivity[') && !p.inASpysFeedToo) continue;
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

/** The realms of the heroes `r` sees (its SIGHTINGS, less the list of its own provinces' heroes, which the map's
 *  repeats: a realm is met through the map). */
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
 *  reader (no actor); after a deed come its consequences ("…'s possessions pass to him"). Acting on a realm reveals an
 *  invisible hero to it (R-119, part 2); every other order and reaction of the reader's aimed at him finds no one
 *  (R-119), so a line of its own order naming him is a breach like any other. One breach per realm, hero, phase and kind
 *  of line (one of the reader's own orders or reactions, its actor the reader; or any other): the first, and a count. A name two heroes share isn't checked. The state saves the turn he cast it, one before the
 *  state's. */
function unseenHeroes(t: Turn): string[] {
  const { turn, players: realms = [], characters } = t.after;
  if (typeof turn !== 'number') return [];
  /** Where he cast it: its phase, and its place in the GM log (a line before it in the same phase came first). */
  const castAt = (c: Character) => {
    const i = t.gmLog.findIndex((e) => e.charId === c.id && String(e.text).includes('weaves Invisibility'));
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

/** An event as the turn emitted it (TurnEvent, src/engine/turn/events-and-their-audiences.ts), as its line in the
 *  engine's log keeps it until the reports are built (perceptionOfTheTurn): the line, with its words, as the gate reads
 *  it, its audience as given, and the kind of fact it records with the realm the fact names. */
export interface EventAsEmitted {
  /** Its line, with its words, less what is never stored (its audience and its fact): what the gate reads of it. */
  line: ALineAsTheGateReadsIt;
  audience: LineAudience;
  /** The kind of fact its line records (null: a line written with its words). */
  kind: unknown;
  /** The realm its fact names (a line for one realm alone: THE_KINDS_WHOSE_AUDIENCE_IS_ONE_REALMS_ALONE), else null. */
  factsRealm: unknown;
}
/** What perception read besides the world: the turn's events, and its sight (resolveTurn's whatTheReportsRead). */
export interface Perception {
  events: EventAsEmitted[];
  /** Whose heroes stood in each province at the start of each phase. */
  presence: { phase: number; province: number; realms: number[] }[];
  /** The heroes of each realm in each battle, by `province@phase`. */
  battleCommanders: TheTurnsSight['battleCommanders'];
  /** Each realm's Clairvoyance watch, by realm: the hero, and the phase it began. */
  clairvoyance: TheTurnsSight['clairWatch'];
}

/** What perception read besides the world, from what the turn hands over for the reports (whatTheReportsRead): each
 *  line of the engine's log as emit filed it, with its whole audience and its fact (kept on the line until the reports
 *  are built, never stored: B-18a, B-18b), and the turn's sight; with each line's words as the views wrote them
 *  (theTurnsLinesInWords' wordsOfEachLine: a battle's tally place left empty is no line, P1-12c3). A line with no
 *  audience didn't come through emit: it throws. Values made in the engine's vm read the same, but they are its own:
 *  copy the result as JSON. */
export function perceptionOfTheTurn(
  turnLog: readonly LogLine[],
  wordsOfEachLine: readonly (string | null)[],
  sight: TheTurnsSight,
): Perception {
  const events = turnLog.flatMap((inMemory, at): EventAsEmitted[] => {
    const { audience, fact } = inMemory;
    if (audience === undefined) throw new Error(`line ${String(at)} of the turn's log didn't come through emit`);
    const text = wordsOfEachLine[at] ?? null;
    if (text === null) return [];
    const line: ALineAsTheGateReadsIt = { ...inMemory, text };
    delete line.audience;
    delete line.fact;
    return [
      {
        line,
        audience: { ...audience },
        kind: fact?.kind ?? null,
        factsRealm: (fact !== undefined && 'realm' in fact ? fact.realm : null) ?? null,
      },
    ];
  });
  const presence = sight.presenceByPhase.flatMap((byProvince, phase) =>
    [...byProvince].map(([province, who]) => ({ phase, province, realms: [...who] })),
  );
  return { events, presence, battleCommanders: sight.battleCommanders, clairvoyance: sight.clairWatch };
}

/** The turn's sight, as the gate reads it, from perception's (its presence back into a map for each phase). */
function theSightOf(p: Perception): TheTurnsSight {
  const presenceByPhase: Map<number, Set<number>>[] = [];
  for (const { phase, province, realms } of p.presence) {
    const byProvince = presenceByPhase[phase] ?? new Map<number, Set<number>>();
    byProvince.set(province, new Set(realms));
    presenceByPhase[phase] = byProvince;
  }
  return { presenceByPhase, battleCommanders: p.battleCommanders, clairWatch: p.clairvoyance };
}

/** A realm's name, made nameless as a reader who hasn't met it reads it, in a line it is no party to (R-046). */
const UNKNOWN_REALM = /\b[Aa]n unknown realm\b/;
/** Where a report shows the turn's lines: the chronicle and the province events (the spy feed, read apart). */
const LINES_READ: readonly string[] = ['lastTurnLog[]', 'provinceEvents[]'];
const isNumber = (v: unknown): v is number => typeof v === 'number';
const phaseOf = (v: unknown): number | null => (isNumber(v) ? v : null);

/** The ways a line reaches a realm's chronicle and its province events (the gate's): all but a spy's and
 *  Clairvoyance's. */
const THE_CHRONICLES_WAYS: ReadonlySet<ALineTheRealmReads['reachesItBy']> = new Set([
  'told',
  'its deed',
  'its hero',
  'the world',
  'eyes there',
  'the battle',
]);

/** Every line a realm reads came through the gate (theLinesOfTheTurnTheRealmReads, src/views/, the one place that
 *  says which lines of the turn each realm reads and how each reaches it; its case table states each way and each
 *  edge), with the way its part of the report needs (answer 84, B-18g): the check asks the gate, on the turn's events
 *  as perception recorded them, the world after the turn and the turn's sight, what each realm reads, and keeps no
 *  model of its own. A line of the chronicle or the province events comes through the chronicle's ways (told, its
 *  deed, its hero, the world, eyes there, the battle); a line of a spy's feed through a spy's lingering sight in that
 *  province; a Clairvoyance line (a chronicle line starting CLAIRVOYANCE) through Clairvoyance, but the one with no
 *  phase, where the watched hero stands as the turn ends (the views write it from the world). A line matches one the
 *  gate gives by its words and its phase, an unmet realm's name in it read as "an unknown realm" (R-046). A line the
 *  gate gives the realm no way is a breach, and so is one it gives only another way, which the breach names ("the gate
 *  gives it only by …"). Runs where the harness records the turn's events (Turn.perception). */
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
  /** Whether the gate's line has a report line's words, in its phase. */
  const sameLine = (line: ALineAsTheGateReadsIt, text: string, phase: number | null) =>
    phaseOf(line.phase) === phase &&
    typeof line.text === 'string' &&
    (line.text === text || (UNKNOWN_REALM.test(text) && nameless(line.text) === nameless(unknownRealms(text))));
  const lines = p.events.map((e) => e.line);
  const audiences = p.events.map((e) => e.audience);
  const sight = theSightOf(p);
  // The world after the turn, as saved: of it the gate reads each realm's provinces and its heroes.
  const world = s as unknown as GameState;
  const heroName = new Map(s.characters.map((c) => [c.id, c.name]));
  return (t.reports ?? []).flatMap((r) => {
    const realm = r.realm;
    const read = theLinesOfTheTurnTheRealmReads(lines, world, realm, sight, audiences);
    /** Every line the gate gives the realm, with its way and, for a spy's, the province it spied. */
    const given: { line: ALineAsTheGateReadsIt; way: ALineTheRealmReads['reachesItBy']; province: number | null }[] = [
      ...read.chronicle.map((l) => ({ line: l.line, way: l.reachesItBy, province: null })),
      ...read.spysLingeringSight.flatMap(({ province, lines: seen }) =>
        seen.map((l) => ({ line: l.line, way: l.reachesItBy, province })),
      ),
      ...read.clairvoyance.map((l) => ({ line: l.line, way: l.reachesItBy, province: null })),
    ];
    const out: string[] = [];
    /** A report line at `at`, its words matched by `words` (a Clairvoyance line's without its mark): through a way
     *  `needed` allows, else a breach. */
    const check = (
      at: string,
      text: string,
      phase: number | null,
      words: string,
      needed: (g: (typeof given)[number]) => boolean,
    ) => {
      const matches = given.filter((g) => sameLine(g.line, words, phase));
      if (matches.some(needed)) return;
      const ways = [
        ...new Set(matches.map((g) => (g.province === null ? g.way : `${g.way} in province ${String(g.province)}`))),
      ];
      out.push(
        `realm ${String(realm)} reads a line its audience does not admit at ${at}: ${quote(text)}` +
          (ways.length ? ` (the gate gives it only by ${ways.join(', ')})` : ''),
      );
    };
    const watched = p.clairvoyance[realm]?.charId;
    for (const { at, value } of LINES_READ.flatMap((path) => select(r.report, path))) {
      const text = textOf(value);
      if (typeof text !== 'string') continue;
      const phase = phaseOf(record(value)['phase']);
      if (at.startsWith('lastTurnLog[') && text.startsWith(CLAIRVOYANCE)) {
        const scried = text.slice(CLAIRVOYANCE.length);
        // where the watched hero stands as the turn ends: the views' own line, from the world
        if (
          phase === null &&
          watched != null &&
          scried.startsWith(`as the turn ends, ${String(heroName.get(watched))} stands in `)
        )
          continue;
        check(at, text, phase, scried, (g) => g.way === 'Clairvoyance');
        continue;
      }
      check(at, text, phase, text, (g) => THE_CHRONICLES_WAYS.has(g.way));
    }
    for (const { at, value } of select(r.report, 'spyActivity[]')) {
      const province = record(value)['provId'];
      for (const line of select(record(value), 'lines[]')) {
        const text = textOf(line.value);
        if (typeof text !== 'string') continue;
        const phase = phaseOf(record(line.value)['phase']);
        check(
          `${at}.${line.at}`,
          text,
          phase,
          text,
          (g) => g.way === "a spy's lingering sight" && g.province === province,
        );
      }
    }
    return out;
  });
}

/** No realm reads a line of a kind that is another realm's alone (its audience in the engine's table:
 *  THE_KINDS_WHOSE_AUDIENCE_IS_ONE_REALMS_ALONE): such a line is read by the realm its fact names, or one the hero it
 *  is filed under served this turn (realmsServed: he joined it, or a Charm lent him to it), and by no other, whatever
 *  audience the engine gave it, so a line of one given the fight's audience shows (which the audience check, taking
 *  the audience as given, lets through). A line a realm reads (the chronicle, province events, spy activity: LINES)
 *  whose every event of the turn with its words and phase is of such a kind for other realms is a breach. Clairvoyance's lines are let through (CLAIRVOYANCE). Runs where the harness records the
 *  turn's events (Turn.perception). */
function linesForOneRealmAloneReadByAnother(t: Turn): string[] {
  const p = t.perception;
  if (!p) return [];
  const key = (phase: number | null, text: string) => `${String(phase)}|${text}`;
  const byLine = new Map<string, EventAsEmitted[]>();
  for (const e of p.events) {
    if (typeof e.line.text !== 'string') continue;
    const k = key(phaseOf(e.line.phase), e.line.text);
    byLine.set(k, [...(byLine.get(k) ?? []), e]);
  }
  const forOneRealm = (e: EventAsEmitted) => THE_KINDS_WHOSE_AUDIENCE_IS_ONE_REALMS_ALONE.includes(String(e.kind));
  /** Whether `realm` may read the line of `e`: the realm its fact names, or one its hero served this turn. */
  const itsOwn = (e: EventAsEmitted, realm: number) => {
    if (e.factsRealm === realm) return true;
    const hero =
      t.after.characters.find((c) => c.id === e.line.charId) ?? t.before.characters.find((c) => c.id === e.line.charId);
    return hero !== undefined && realmsServed(t, hero).has(realm);
  };
  return (t.reports ?? []).flatMap((r) =>
    LINES.flatMap((path) => select(r.report, path)).flatMap(({ at, value }) => {
      const text = textOf(value);
      if (typeof text !== 'string' || text.startsWith(CLAIRVOYANCE)) return [];
      const sources = byLine.get(key(phaseOf(record(value)['phase']), text)) ?? [];
      if (!sources.length || !sources.every(forOneRealm) || sources.some((e) => itsOwn(e, r.realm))) return [];
      const realms = [...new Set(sources.map((e) => String(e.factsRealm)))].join(', ');
      return [`realm ${String(r.realm)} reads a line for realm ${realms} alone at ${at}: ${quote(text)}`];
    }),
  );
}

/** The leak checks, in the order they are checked. */
export const LEAK_CHECKS: readonly { name: string; check: (t: Turn) => string[] }[] = [
  { name: "another realm's private line", check: privateLines },
  { name: 'an unmet realm', check: unmetRealms },
  { name: 'an unseen hero', check: unseenHeroes },
  { name: 'a line its audience does not admit', check: linesTheirAudienceDoesNotAdmit },
  { name: 'a line for one realm alone', check: linesForOneRealmAloneReadByAnother },
];
