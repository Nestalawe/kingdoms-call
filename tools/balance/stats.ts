// The statistics half of the balance matrix (plan P1-02, Decisions): per game, the figures a rule change moves, from
// the telemetry (turn_events: `outcomes`, `pre` and `post`), the GM log and the saved state. Until P1-12 gives the
// engine events, the chase figures come from the GM log's lines (LINES below): a rewording there shows as a scripted
// case that never happens, and the run fails.
//
// Every statistic is a pair [sum, count] for one game, so the figure for many games is sum of sums / sum of counts:
// "attacker won" is [battles won, battles fought], "battles fought" is [battles, 1] (a mean per game), a figure that
// doesn't apply to a game is [0, 0]. Resampling whole games (paired.ts) then needs nothing else. A statistic's name is
// its base, or its base and a slice: 'battles: attacker won | by terrain: hills'.

export type Stat = [sum: number, count: number];
export type Stats = Record<string, Stat>;

/** The bases that are counts per game: a game that lacks one of their slices had none, [0, 1]. Any other statistic a
 *  game lacks didn't apply to it, [0, 0]. */
export const PER_GAME = new Set([
  'battles: fought',
  'battles: provinces left unresolved',
  'lairs: attempts',
  'heroes: deaths',
  'spells: cast',
  'items: gained',
  'titles: held at the end',
  'chases: Encounter orders',
  'chases: Pursue orders',
  'chases: waited for a battle',
]);
export const baseOf = (key: string): string => key.split(' | ')[0] ?? key;
/** A game's value for `key`, with a missing one filled in (PER_GAME). */
export const valueOf = (s: Stats, key: string): Stat => s[key] ?? [0, PER_GAME.has(baseOf(key)) ? 1 : 0];

export interface Battle {
  ph: number;
  prov: number;
  terrain: string;
  kind: string;
  atkPi: number | null;
  atkChar: number;
  defPi: number | null;
  defChar: number;
  won: boolean;
  atkLost: number;
  defLost: number;
  side: 'atk' | 'def';
}
export interface LairFight {
  pi: number;
  power: string;
  won: boolean;
  fled: boolean;
  killed: boolean;
}
export interface Death {
  ph: number;
  charId: number;
  how: string;
}
export interface Spell {
  pi: number;
  school: string;
  ok: boolean;
}
export interface Snapshot {
  gold: number;
  provinces: number;
  str: number;
  titles?: unknown[];
  characters?: { id: number; units?: { t: string }[] }[];
}
/** One turn_events row: one realm, one turn. */
export interface TelemetryRow {
  turn: number;
  player_index: number;
  orders?: { chars?: Record<string, { ph?: ({ a?: string } | null)[] }> };
  pre: Snapshot;
  post: Snapshot;
  outcomes: {
    battles: { list: Battle[] };
    encounters: { list: LairFight[] };
    deaths: { list: Death[] };
    spells: { list: Spell[] };
    /** (ideas round 4) the companies recruited or hired that turn, by class; absent in older rows */
    recruits?: { count: number; creatures: number; monsters: number };
    delta: { items: number };
  };
}
export interface GameOver {
  turn: number;
  winner?: number | null;
  byReckoning?: boolean;
  byElimination?: boolean;
  byConcession?: boolean;
}
export interface GameRecord {
  telemetry: TelemetryRow[];
  /** Every GM log line of the game. */
  gmLog: { text?: unknown }[];
  /** Provinces with an unresolved battle in the saved state, after each turn. */
  unresolved: number[];
  gameOver: GameOver | null;
  /** Each realm's alignment, by player index (the alignment slices). */
  alignments?: string[];
}

/** GM log lines the chase figures are read from (the GM portal's advancePursuit). */
export const LINES = {
  chaseStart: / sets out to run down /,
  chaseRoll: /^📊 Pursuit — /,
  chaseMissed: / slips away through the country around /,
  chaseWaited: / the chase after .* must wait\.|the reckoning must wait\./,
};

/** The most common unit type in an army, ties to the one met first; 'none' for no army. */
export function leadingUnit(units: { t: string }[] | undefined): string {
  const counts = new Map<string, number>();
  for (const u of units ?? []) counts.set(u.t, (counts.get(u.t) ?? 0) + 1);
  let best = 'none';
  let n = 0;
  for (const [t, k] of counts) {
    if (k > n) {
      best = t;
      n = k;
    }
  }
  return best;
}

export function gameStats(g: GameRecord): Stats {
  const s: Stats = {};
  const add = (key: string, sum: number, count: number) => {
    const v = s[key] ?? [0, 0];
    v[0] += sum;
    v[1] += count;
    s[key] = v;
  };
  // A count per game (PER_GAME): the game counts once, whatever the figure.
  const perGame = (key: string, n: number) => {
    if (!PER_GAME.has(baseOf(key))) throw new Error(`${key}: not a count per game (PER_GAME)`);
    add(key, n, 0);
  };
  const share = (key: string, yes: boolean) => {
    add(key, yes ? 1 : 0, 1);
  };

  // Battles, each counted once: from the attacker's row, or the defender's when the attacker is neutral (each realm's
  // row lists the battles it fought, from its side).
  let fought = 0;
  for (const row of g.telemetry) {
    for (const b of row.outcomes.battles.list) {
      if (b.side === 'def' && b.atkPi != null) continue;
      fought++;
      const realmChar = b.side === 'atk' ? b.atkChar : b.defChar;
      const unit = leadingUnit(row.pre.characters?.find((c) => c.id === realmChar)?.units);
      share('battles: attacker won', b.won);
      share(`battles: attacker won | by kind: ${b.kind}`, b.won);
      share(`battles: attacker won | by terrain: ${b.terrain}`, b.won);
      share(`battles: attacker won | by the realm's leading unit: ${unit}`, b.won);
      add('battles: units lost by the attacker', b.atkLost, 1);
      add('battles: units lost by the defender', b.defLost, 1);
    }
  }
  perGame('battles: fought', fought);

  // Lairs: each realm's row lists its own heroes' fights.
  let lairs = 0;
  for (const row of g.telemetry) {
    for (const e of row.outcomes.encounters.list) {
      if (e.pi !== row.player_index) continue;
      lairs++;
      share('lairs: cleared', e.won);
      share(`lairs: cleared | by grade: ${e.power}`, e.won);
      share('lairs: hero fled', e.fled);
      share('lairs: hero killed', e.killed);
      perGame(`lairs: attempts | by grade: ${e.power}`, 1);
    }
  }
  perGame('lairs: attempts', lairs);

  // Heroes' deaths: a death can be in two rows (the dead's and the killer's).
  const deaths = new Map<string, Death>();
  for (const row of g.telemetry) {
    for (const d of row.outcomes.deaths.list) deaths.set(`${String(row.turn)}:${String(d.ph)}:${String(d.charId)}`, d);
  }
  perGame('heroes: deaths', deaths.size);
  for (const d of deaths.values()) perGame(`heroes: deaths | by how: ${d.how}`, 1);

  // Spells, each from its caster's row.
  let cast = 0;
  for (const row of g.telemetry) {
    for (const sp of row.outcomes.spells.list) {
      if (sp.pi !== row.player_index) continue;
      cast++;
      share('spells: succeeded', sp.ok);
      share(`spells: succeeded | by school: ${sp.school}`, sp.ok);
    }
  }
  perGame('spells: cast', cast);

  // Realms at turns 10 and 20 and at the end (the game's last turn): a mean per realm. A game over sooner counts with
  // its last turn, so every game counts in each: two seed sets would otherwise compare different games (only the
  // longer ones reach turn 20).
  const lastTurn = Math.max(0, ...g.telemetry.map((r) => r.turn));
  for (const [when, turn] of [
    ['turn 10', Math.min(10, lastTurn)],
    ['turn 20', Math.min(20, lastTurn)],
    ['the end', lastTurn],
  ] as const) {
    for (const row of g.telemetry.filter((r) => r.turn === turn)) {
      add(`realms: gold at ${when}`, row.post.gold, 1);
      add(`realms: provinces at ${when}`, row.post.provinces, 1);
      add(`realms: army strength at ${when}`, row.post.str, 1);
      // By alignment (ideas round 1): the same figures, one slice per alignment, so a kit's effect on its own realms
      // shows apart from its effect on the others.
      const al = g.alignments?.[row.player_index];
      if (al) {
        add(`realms: gold at ${when} | by alignment: ${al}`, row.post.gold, 1);
        add(`realms: provinces at ${when} | by alignment: ${al}`, row.post.provinces, 1);
        add(`realms: army strength at ${when} | by alignment: ${al}`, row.post.str, 1);
      }
    }
  }
  // By alignment (ideas round 4): what each realm recruited over the game (creature and monster companies), and the
  // lairs its heroes cleared (in all, and a turn from turn 3, the pace Toby sees in human players).
  if (g.alignments) {
    g.alignments.forEach((al, pi) => {
      if (!al) return;
      const rows = g.telemetry.filter((r) => r.player_index === pi);
      if (!rows.length) return;
      let creatures = 0,
        monsters = 0,
        cleared = 0;
      for (const r of rows) {
        creatures += r.outcomes.recruits?.creatures ?? 0;
        monsters += r.outcomes.recruits?.monsters ?? 0;
        cleared += r.outcomes.encounters.list.filter((e) => e.pi === pi && e.won).length;
      }
      add(`realms: creature companies recruited | by alignment: ${al}`, creatures, 1);
      add(`realms: monster companies recruited | by alignment: ${al}`, monsters, 1);
      add(`realms: lairs cleared | by alignment: ${al}`, cleared, 1);
      add(`realms: lairs cleared a turn from turn 3 | by alignment: ${al}`, cleared / Math.max(1, lastTurn - 2), 1);
      add('realms: lairs cleared a turn from turn 3', cleared / Math.max(1, lastTurn - 2), 1);
    });
  }
  // Which alignment wins (ideas round 1): of the realms of each alignment in games that ended, the share that won; and
  // of the realms of each alignment, the share still holding land at the end.
  if (g.alignments) {
    const endRows = g.telemetry.filter((r) => r.turn === lastTurn);
    g.alignments.forEach((al, pi) => {
      if (!al) return;
      if (g.gameOver) share(`game: won | by alignment: ${al}`, g.gameOver.winner === pi);
      const row = endRows.find((r) => r.player_index === pi);
      share(`game: realm alive at the end | by alignment: ${al}`, !!row && row.post.provinces > 0);
    });
  }
  perGame(
    'items: gained',
    g.telemetry.reduce((n, r) => n + Math.max(0, r.outcomes.delta.items), 0),
  );
  perGame(
    'titles: held at the end',
    g.telemetry.filter((r) => r.turn === lastTurn).reduce((n, r) => n + (r.post.titles ?? []).length, 0),
  );

  // How the game ended.
  share('game: ended', g.gameOver != null);
  if (g.gameOver) {
    add('game: length in turns', g.gameOver.turn, 1);
    const how = g.gameOver.byElimination ? 'elimination' : g.gameOver.byConcession ? 'concession' : 'the Reckoning';
    for (const way of ['the Reckoning', 'elimination', 'concession']) share(`game: ended | by: ${way}`, way === how);
  }

  // Chases.
  const actions = g.telemetry.flatMap((r) =>
    Object.values(r.orders?.chars ?? {}).flatMap((c) => (c.ph ?? []).map((p) => p?.a)),
  );
  perGame('chases: Encounter orders', actions.filter((a) => a === 'encounter').length);
  perGame('chases: Pursue orders', actions.filter((a) => a === 'pursue').length);
  const texts = g.gmLog.map((e) => (typeof e.text === 'string' ? e.text : ''));
  const rolls = texts.filter((t) => LINES.chaseRoll.test(t)).length;
  const missed = texts.filter((t) => LINES.chaseMissed.test(t)).length;
  add('chases: caught', rolls - missed, rolls);
  perGame('chases: waited for a battle', texts.filter((t) => LINES.chaseWaited.test(t)).length);
  perGame(
    'battles: provinces left unresolved',
    g.unresolved.reduce((a, b) => a + b, 0),
  );

  // A count per game is the mean over the games: its count is the number of games.
  for (const v of Object.values(s)) if (v[1] === 0) v[1] = 1;
  return s;
}

/** A share (shown as a percentage), rather than a count per game or a mean. */
export const isShare = (key: string): boolean =>
  !PER_GAME.has(baseOf(key)) && !/^(realms: |battles: units lost |game: length )/.test(baseOf(key));
