// Before the first phase (plan P1-08k8, four stages of resolveTurn's own body lifted out): once the realms' orders are
// merged and the log is ready, (1) the relations made ready and last turn's research choices settled, each bot realm
// picking for itself; (2) war without warning, the titles held going into the turn, the Safe Start's and the stale
// orders' lines, the realms the GM removed told as conceding, and the realms' messages delivered; (3) every living
// realm hero's move pools, the seasons, the turn's trackers, last turn's deaths, espionage, watches, chases and attack
// routes cleared, and the save's sweeps (the Dwarves' mithril, the lairs' names, the guardians' HP, the retired
// Library, the Grand Cathedral's ward); (4) once the bots have planned, every empty phase of a living realm hero set to
// Defend, the orders recorded for the turn's statistics, and the hosts standing on a war front as the turn begins.
// Staged on the middle of a bot world (lib/middle-of-a-bot-world.ts), from plain realms each holding only its seat with
// a living king there (P1-08k5a's `stageCase`), every realm having met every other, each sending its heroes Resting for
// this turn (P1-08k7's slot rows), each case with what must be true after it in game terms.
// scenario/before-the-first-phase-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn) and reads the
// world, and the turn's context, as the first phase begins; unit/before-the-first-phase-called-directly.test.ts calls
// the four stages directly after the merge, as resolveTurn calls them (the bots' passes between them aside). A case's
// `check` reads the same outcome from either. Every outcome is certain: every case fixes the dice for the whole turn
// (default LANDS: every percentile roll lands, every other die at its highest).
import vm from 'node:vm';
import { engineFn } from './engine.ts';
import {
  must,
  order,
  plan,
  type Board,
  type Character,
  type Line,
  type Order,
  type Province,
  type World,
} from './middle-of-a-bot-world.ts';
import { withCaseDice, type Dice } from './espionage-order-cases.ts';
import { at, realm, wanderer } from './cast-spell-order-cases.ts';
import { LANDS } from './war-order-cases.ts';
import { companies } from './item-and-army-order-cases.ts';
import { kingOf } from './new-turn-succession-and-summons-cases.ts';
import { relate, seatOf, turnIs, unmet } from './diplomacy-and-victory-cases.ts';
import {
  SAFE_START_LINE,
  conceded,
  dispatch,
  mergeCase,
  ordersOf,
  rowsOf,
  safeStart,
  sentTo,
  stageCase as stageSetUpCase,
  stale,
  type Payload,
  type SetUpCase,
  type Staged as SetUpStaged,
} from './set-up-and-order-merge-cases.ts';

export { LANDS, kingOf, order, plan, realm, seatOf };
type Raw = Record<string, unknown>;
/** A case's staging: what P1-08k7's cases stage, and the realms that are bots'. */
export interface Staged extends SetUpStaged {
  /** Realms whose seat is a bot's (a slot row with no player and `isBot` in its report): they plan in the turn. */
  bots?: number[];
}
/** What the turn's context holds as the first phase begins, as JSON. */
export interface Ctx {
  /** The move pools by hero id: land and sea points left, their maxima, the sea's use and kind, light travel. */
  land: Record<string, number>;
  landMax: Record<string, number>;
  sea: Record<string, number>;
  seaMax: Record<string, number>;
  seaActive: Record<string, boolean>;
  seaCap: Record<string, unknown>;
  lightLand: Raw;
  lightSea: Raw;
  /** The seasons' names; whether they are a copy of the game's list, not the list itself. */
  seasons: string[];
  seasonsCopied: boolean;
  /** The turn's trackers: recruits, presence by phase, provinces entered, sightings and distances (counts). */
  recruited: Raw;
  presence: unknown[];
  entered: Raw;
  sightings: number;
  distances: number;
  /** The hosts on a war front as the turn began (hero id → province id), and those provinces. */
  warFrontAt: [number, number][];
  warFrontProvs: number[];
}
export interface Outcome {
  /** The world as the first phase of the turn began (after the four stages, the bots' plans between them). */
  first: World;
  /** Every line in the log (the whole turn's, or the stages' when called directly). */
  all: Line[];
  /** The turn played. */
  turn: number;
  /** The turn's record of every realm's orders, by realm (the statistics: `tel.collected.orders`). */
  record: Record<string, Raw>;
  /** The turn's context as the first phase began. */
  ctx: Ctx;
}
export interface BeforeCase {
  name: string;
  /** Plays only in a whole turn: what the case is about is the bots' (their passes run between the stages). */
  wholeTurnOnly?: boolean;
  /** The dice for the whole turn (default LANDS). */
  dice?: Dice;
  stage(b: Board): Staged;
  /** What the case found, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

// ── The slot rows ────────────────────────────────────────────────────────────────────────────────────────────────
/** The game's slot rows as the turn loads them (P1-08k7's `rowsOf`), a bot's seat a bot's. */
export const rows = (b: Board, s: Staged) => {
  const parsed = JSON.parse(rowsOf(b, s)) as Raw[];
  parsed.forEach((r) => {
    if ((s.bots ?? []).includes(r['player_index'] as number)) {
      r['user_id'] = null;
      r['turn_report'] = '{"isBot":true}';
    }
  });
  return JSON.stringify(parsed);
};

// ── Reading the context ──────────────────────────────────────────────────────────────────────────────────────────
const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v ?? null));
const entries = (m: unknown) => (m ? [...(m as Iterable<unknown>)] : []);
const size = (m: unknown) => (m ? ((m as { size?: number }).size ?? -1) : -1);
/** The turn's context as JSON (its maps and sets as lists), with whether the seasons are a copy of `seasons`. */
export const snapshot = (tc: Raw, seasons: unknown): Ctx => ({
  ...(json({
    land: tc['movePoints'],
    landMax: tc['moveMax'],
    sea: tc['seaMovePoints'],
    seaMax: tc['seaMoveMax'],
    seaActive: tc['seaMoveActive'],
    seaCap: tc['seaCap'],
    lightLand: tc['lightLandMoves'],
    lightSea: tc['lightSeaMoves'],
    seasons: tc['SEASONS'],
    recruited: tc['recruitedThisTurn'],
    presence: tc['presenceByPhase'],
    entered: tc['enteredThisPhase'],
  }) as Omit<Ctx, 'seasonsCopied' | 'sightings' | 'distances' | 'warFrontAt' | 'warFrontProvs'>),
  seasonsCopied: tc['SEASONS'] !== seasons,
  sightings: size(tc['_intrusionAcc']),
  distances: size(tc['_distCache']),
  warFrontAt: (entries(tc['_warFrontAtStart']) as [number, number][]).map(([k, v]) => [k, v]),
  warFrontProvs: entries(tc['_warFrontProvs']) as number[],
});

// ── Playing a case ───────────────────────────────────────────────────────────────────────────────────────────────
const FIRST_PHASE = 'startPhaseHealingSnapshotsAndStalledBattles';
/** Plays `c`, staged as `s` on `b`, through a whole turn, with the case's dice; the world and the context as the first
 *  phase began are read when the turn starts its first phase (P1-08k1's stage, wrapped in the vm for the turn's
 *  length), and the turn's record of orders from the reports built after it. `live` is handed the turn's context
 *  itself, for a test that reads it after the turn. */
export const playCase = (b: Board, c: BeforeCase, s: Staged, live?: (tc: Raw) => void): Outcome => {
  const g: Raw = b.engine;
  const was = g[FIRST_PHASE] as (tc: Raw, ph: number) => unknown;
  const seasons = vm.runInContext('KC_SEASONS', b.engine) as unknown;
  const seen: { first?: string; ctx?: Ctx } = {};
  g[FIRST_PHASE] = (tc: Raw, ph: number) => {
    if (!seen.first) {
      seen.first = JSON.stringify(tc['G']);
      seen.ctx = snapshot(tc, seasons);
      live?.(tc);
    }
    return was(tc, ph);
  };
  const resolveTurn = engineFn(b.engine, 'resolveTurn') as (
    state: string,
    rows: unknown,
    turn: number,
  ) => {
    state: string;
    log: Line[];
    spyStealthAndInvisibilityStampedForTheReports: () => void;
    whatTheReportsRead: () => unknown;
  };
  const buildReports = engineFn(b.engine, 'buildReports') as (whatTheReportsRead: unknown) => {
    tel: { collected: { orders: Record<string, Raw> } };
  };
  const inVm = vm.runInContext('(j)=>JSON.parse(j)', b.engine) as (j: string) => unknown;
  try {
    const turn = b.G.turn;
    const slotRows = rows(b, s);
    const state = JSON.stringify(b.G);
    const [result, record] = withCaseDice(b.engine, c.dice ?? LANDS, () => {
      const r = resolveTurn(state, inVm(slotRows), turn);
      r.spyStealthAndInvisibilityStampedForTheReports();
      return [r, json(buildReports(r.whatTheReportsRead()).tel.collected.orders) as Record<string, Raw>] as const;
    });
    return {
      first: JSON.parse(must(seen.first, 'the first phase')) as World,
      all: result.log,
      turn,
      record,
      ctx: must(seen.ctx, 'the context'),
    };
  } finally {
    g[FIRST_PHASE] = was;
  }
};
/** The four stages, in the order resolveTurn calls them. */
export const STAGES = [
  'relationsReadyAndLastTurnsResearchChoicesSettledWithTheBotsOwnPicks',
  'warWithoutWarningTitlesHeldSafeStartAndStaleOrderLinesGmRemovalsAndMessages',
  'movePoolsPerTurnTrackersEspionageResetsAndTheSaveSweepsBeforeTheBotsPlan',
  'missingOrdersDefaultToDefendTheOrdersRecordAndTheWarFrontsAtTheStart',
] as const;
/** What the stages before these leave in the context that the four make afresh: last turn's, as a stale context would
 *  hold them, so a stage that fails to make one anew shows. */
export const STALE_CONTEXT = `(tc)=>{ tc.movePoints={1:9}; tc.seaMovePoints={1:9}; tc.seaMoveActive={1:true}; tc.seaCap={1:'x'};
  tc.moveMax={1:9}; tc.seaMoveMax={1:9}; tc.lightLandMoves={1:1}; tc.lightSeaMoves={1:1}; tc.SEASONS=['Stale'];
  tc.recruitedThisTurn={1:{}}; tc.presenceByPhase=[{}]; tc.enteredThisPhase={1:[1]}; tc._intrusionAcc=new Map([[1,1]]);
  tc._distCache=new Map([[1,1]]); tc._warFrontAtStart=new Map([[1,1]]); tc._warFrontProvs=new Set([1]); }`;
/** Readies the context for the four stages on `b`, staged as `s`, as resolveTurn has it when it reaches them: P1-08k7's
 *  two stages run (the context given the slot rows and the turn run), the bot realms set, the context's values the four
 *  make afresh left stale (`STALE_CONTEXT`), the log's context clear and no phase. */
export const prepare = (b: Board, s: Staged) => {
  const tc = b.tc as unknown as Raw;
  mergeCase(b, s);
  tc['freshPlayers'] = (vm.runInContext('(j)=>JSON.parse(j)', b.engine) as (j: string) => unknown)(rows(b, s));
  tc['_botPlayerIdx'] = (vm.runInContext('(a)=>new Set(JSON.parse(a))', b.engine) as (a: string) => unknown)(
    JSON.stringify(s.bots ?? []),
  );
  (vm.runInContext(STALE_CONTEXT, b.engine) as (t: Raw) => void)(tc);
  tc['_currentPhase'] = null;
  tc['_logCtx'] = { charId: null, phase: null };
  return tc;
};
/** What the stages left in `b`'s world and context, read as `playCase` reads a whole turn's first phase. */
export const outcomeOf = (b: Board): Outcome => {
  const tc = b.tc as unknown as Raw;
  return {
    first: json(b.G) as World,
    all: json(tc['turnLog']) as Line[],
    turn: b.G.turn,
    record: json((tc['_tel'] as Raw)['orders']) as Record<string, Raw>,
    ctx: snapshot(tc, vm.runInContext('KC_SEASONS', b.engine)),
  };
};
/** Calls the four stages directly on `b`, staged as `s` and readied as `prepare` readies it, in turn, with the case's
 *  dice. */
export const stagesCase = (b: Board, c: BeforeCase, s: Staged): Outcome =>
  withCaseDice(b.engine, c.dice ?? LANDS, () => {
    const tc = prepare(b, s);
    for (const f of STAGES) (engineFn(b.engine, f) as (t: Raw) => void)(tc);
    return outcomeOf(b);
  });

// ── Staging ──────────────────────────────────────────────────────────────────────────────────────────────────────
const raw = (b: Board) => b.G as unknown as Raw;
const hero = (s: Staged) => must(s.hero, 'the hero');
const other = (s: Staged, i: number) => must(s.others?.[i], 'hero ' + String(i));
const there = (s: Staged) => must(s.there, 'the province');
const board_ = (s: Staged) => must(s.board, 'the board');
/** Stages `c` on `b` as P1-08k7's cases are (plain realms, each holding only its seat with a living king there, every
 *  realm having met every other, realms 0 and 1 at war, 0 and 2 allied, Safe Start over), the lairs' names and the
 *  guardians' HP already brought up to date. */
export const stageCase = (b: Board, c: BeforeCase): Staged => {
  let staged: Staged = {};
  const asSetUp: SetUpCase = {
    name: c.name,
    stage: (bb) => {
      Object.assign(raw(bb), { _lairNamesV3: true, _guardianHpV2: true });
      staged = c.stage(bb);
      return staged;
    },
    check: () => ({ got: {}, want: {} }),
  };
  return { ...staged, ...stageSetUpCase(b, asSetUp) };
};
/** A hero of realm `pi` (default 0) in the middle, with `extra` over him. */
export const realmHero = (b: Board, pi = 0, extra: Raw = {}) => Object.assign(at(b, {}, { player: pi }), extra);
/** A hero of realm `pi` leading `n` companies of Men-at-Arms in `p`. */
export const host = (b: Board, pi: number, p: Province, n = 2) => {
  const h = at(b, {}, { player: pi, at: p });
  h.armies = companies(n, 'Men-at-Arms', 'Average', 'Host ' + String(h.id));
  return h;
};
/** Sage discovery `id` as the data file has it. */
export const disc = (b: Board, id: string) =>
  JSON.parse(vm.runInContext(`JSON.stringify(DISC_BY_ID[${JSON.stringify(id)}]||null)`, b.engine) as string) as {
    id: string;
    name: string;
    category: string;
    desc: string;
  } | null;
/** Realm `pi`'s pending research choices: each `[key, options, turn found (default last turn), by]`. */
export const choices = (b: Board, pi: number, ...list: [string, unknown, number?, string?][]) => {
  realm(b, pi)['pendingDiscoveryChoices'] = list.map(([key, options, turn = b.G.turn - 1, by]) => ({
    key,
    options,
    turn,
    ...(by === undefined ? { charName: 'Sage Orrin' } : by ? { charName: by } : {}),
  }));
};
/** Realm `pi` knows these discoveries (as the data file has them). */
export const knowsAll = (b: Board, pi: number, ...ids: string[]) => {
  realm(b, pi)['discoveries'] = ids.map((id) => disc(b, id) ?? { id });
};
/** Realm `pi`'s creed. */
export const creed = (b: Board, pi: number, alignment: string) => {
  realm(b, pi)['alignment'] = alignment;
};
/** The world's lairs, as the board deals them: every lair feature with a guardian, ritual sites aside. */
export const lairs = (b: Board) =>
  b.G.world.provinces.flatMap((p) =>
    ((p['features'] as (Raw | null)[] | undefined) ?? []).filter(
      (f): f is Raw => !!f && !f['ritualSite'] && !!f['monster'],
    ),
  );
/** A lair in `p` (default the middle) kept by a guardian of `hp` (and `full`, the undamaged HP). */
export const lair = (b: Board, hp: number | null, full: number | null = hp, p: Province = b.X) => {
  const f: Raw = {
    type: 'lair',
    name: 'The Test Den',
    monster: { name: 'Dire Wolf', hp, ...(full == null ? {} : { _hpFull: full }), attack: 3 },
  };
  p['features'] = [...((p['features'] as Raw[] | undefined) ?? []), f];
  return f;
};
/** Every lair in the world gone but `keep`. */
export const onlyLairs = (b: Board, ...keep: Raw[]) => {
  b.G.world.provinces.forEach((p) => {
    p['features'] = ((p['features'] as Raw[] | undefined) ?? []).filter(
      (f) => keep.includes(f) || !f || f['ritualSite'] || !f['monster'],
    );
  });
};
const sending = (sends: Record<number, Payload>): Staged => ({ sends });
/** Five Defend orders. */
const DEFENDS = ['defend: Defend', 'defend: Defend', 'defend: Defend', 'defend: Defend', 'defend: Defend'];
const RESTS = ['rest', 'rest', 'rest', 'rest', 'rest'];

// ── Reading the outcome ──────────────────────────────────────────────────────────────────────────────────────────
const rawOf = (w: World) => w as unknown as Raw;
const realmIn = (w: World, pi: number) => must(w.players[pi], 'realm ' + String(pi)) as unknown as Raw;
export const charIn = (w: World, c: Character) =>
  must(
    w.characters.find((x) => x.id === c.id),
    'hero ' + c.name,
  ) as Character & Raw;
const nameOf = (b: Board, pi: number) => realm(b, pi).name;
/** Every line saying `text`: its kind, who acts, whom it is told to, whether public or the system's, its phase and
 *  hero. */
export const told = (o: { all: Line[] }, text: string) =>
  o.all
    .filter((l) => l.text === text)
    .map((l) => ({
      type: l.type,
      actor: l.actor ?? null,
      targets: l.targets ?? null,
      public: l['public'] ?? false,
      system: l['system'] ?? false,
      phase: l.phase ?? null,
      charId: l.charId,
    }));
/** Every line that starts with `start`, in order. */
export const starting = (o: { all: Line[] }, start: string) =>
  o.all.filter((l) => l.text.startsWith(start)).map((l) => l.text);
/** The relation between realms `a` and `x` as the first phase began. */
export const relationAt = (o: Outcome, a: number, x: number) =>
  o.first.relations[a < x ? `${String(a)}-${String(x)}` : `${String(x)}-${String(a)}`] ?? 'neutral';
/** Realm `pi`'s record of orders. */
export const recordOf = (o: Outcome, pi: number) => must(o.record[String(pi)], 'the record of realm ' + String(pi));

// ── Lines ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The research line: realm `pi` pursues `id` (picked, or chosen by its scholars), found by `by`, the rest forgotten. */
export const pursuit = (b: Board, pi: number, id: string, picked: boolean, lost: string[], by = 'Sage Orrin') => {
  const d = must(disc(b, id), 'discovery ' + id);
  const lostNames = lost.map((x) => disc(b, x)?.name ?? x).join(', ');
  return `💡 ${picked ? `${nameOf(b, pi)} pursues` : `No choice was sent, so ${nameOf(b, pi)}'s scholars choose for themselves and pursue`} **${d.name}** (${d.category}), found by ${by} last turn. ${d.desc}${lostNames ? ` The other lead — ${lostNames} — is set aside and forgotten for good.` : ''}`;
};
/** War without warning: `a` (of `creed`) on `x`. */
export const warNow = (na: string, nb: string, undead = false) =>
  `⚔ ${na} declares war on ${nb} and marches without warning — ${undead ? 'the dead keep no truce' : 'the wicked keep no faith'}. War stands between the two realms from this very season.`;
export const withdrawn = (n: string) =>
  `\u{1F3F3} ${n} has withdrawn from the game and CONCEDES. Its heroes lay down their ambitions and will only defend what they hold from now on.`;
export const renamed = (n: number) =>
  `\u{1F5FA} The chronicles are corrected: ${String(n)} lair${n !== 1 ? 's are' : ' is'} now recorded under a name befitting what dwells there.`;
export const remeasured = (n: number) =>
  `\u{1F489} The world's guardians are re-measured: ${String(n)} lair-keeper${n !== 1 ? 's are' : ' is'} 5 hit points frailer than before.`;
const LEAD_FIELDS = (pi: number) => ({
  type: 'explore',
  actor: pi,
  targets: [pi],
  public: false,
  system: false,
  phase: 0,
  charId: null,
});

// ── 1. The relations and last turn's research choices ────────────────────────────────────────────────────────────
const CHOICE = ['sd03', 'sd04'];
/** A realm's discoveries as the first phase began: each id, and the turn it was found. */
const found = (o: Outcome, pi: number) =>
  ((realmIn(o.first, pi)['discoveries'] as Raw[] | undefined) ?? []).map((d) => [d['id'], d['turnDiscovered']]);
const forgotten = (o: Outcome, pi: number) => realmIn(o.first, pi)['forgottenDiscoveries'] ?? null;
const pending = (o: Outcome, pi: number) =>
  ((realmIn(o.first, pi)['pendingDiscoveryChoices'] as Raw[] | undefined) ?? []).map((p) => p['key']);
export const RESEARCH_CASES: BeforeCase[] = [
  {
    name: 'a save with no relations has them made: every realm at peace with every other as the first phase begins',
    stage: (b) => {
      delete (b.G as Partial<World>).relations;
      return {};
    },
    check: (o) => ({ got: { relations: o.first.relations }, want: { relations: {} } }),
  },
  {
    name: 'the relations a save has are kept as they are',
    stage: () => ({}),
    check: (o) => ({
      got: { relations: o.first.relations },
      want: { relations: { '0-1': 'enemy', '0-2': 'allied' } },
    }),
  },
  {
    name: 'a realm pursues the lead it picked: it is found as of last turn, the other is forgotten, and the realm alone is told',
    stage: (b) => {
      choices(b, 1, ['k1', CHOICE]);
      return { ...sending({ 1: { discoveryChoices: { k1: 'sd04' } } }), board: b };
    },
    check: (o, s) => {
      const b = board_(s);
      return {
        got: {
          found: found(o, 1),
          forgotten: forgotten(o, 1),
          pending: pending(o, 1),
          told: told(o, pursuit(b, 1, 'sd04', true, ['sd03'])),
        },
        want: { found: [['sd04', o.turn - 1]], forgotten: ['sd03'], pending: [], told: [LEAD_FIELDS(1)] },
      };
    },
  },
  {
    name: 'the discovery pursued is the data file’s: its name, kind and what it does',
    stage: (b) => {
      choices(b, 2, ['k', CHOICE]);
      return { ...sending({ 2: { discoveryChoices: { k: 'sd03' } } }), board: b };
    },
    check: (o, s) => {
      const d = must(disc(board_(s), 'sd03'), 'sd03');
      const got = ((realmIn(o.first, 2)['discoveries'] as Raw[] | undefined) ?? [])[0] ?? null;
      return {
        got: { found: got },
        want: {
          found: { id: d.id, name: d.name, category: d.category, desc: d.desc, turnDiscovered: o.turn - 1 },
        },
      };
    },
  },
  {
    name: 'with no choice sent, the scholars choose by the die: at its highest, the last lead',
    stage: (b) => {
      choices(b, 0, ['k0', CHOICE]);
      return { board: b };
    },
    check: (o, s) => ({
      got: {
        found: found(o, 0),
        forgotten: forgotten(o, 0),
        told: told(o, pursuit(board_(s), 0, 'sd04', false, ['sd03'])),
      },
      want: { found: [['sd04', o.turn - 1]], forgotten: ['sd03'], told: [LEAD_FIELDS(0)] },
    }),
  },
  {
    name: 'with no choice sent, the scholars choose by the die: at its lowest, the first lead',
    dice: { roll: 1, die: 0 },
    stage: (b) => {
      choices(b, 0, ['k0', CHOICE]);
      return { board: b };
    },
    check: (o, s) => ({
      got: { found: found(o, 0), told: told(o, pursuit(board_(s), 0, 'sd03', false, ['sd04'])).length },
      want: { found: [['sd03', o.turn - 1]], told: 1 },
    }),
  },
  {
    name: 'a pick that is not among the leads is no choice: the scholars choose',
    stage: (b) => {
      choices(b, 1, ['k1', CHOICE]);
      return { ...sending({ 1: { discoveryChoices: { k1: 'sd05' } } }), board: b };
    },
    check: (o, s) => ({
      got: { found: found(o, 1), told: told(o, pursuit(board_(s), 1, 'sd04', false, ['sd03'])).length },
      want: { found: [['sd04', o.turn - 1]], told: 1 },
    }),
  },
  {
    name: 'a pick for another choice’s key is no choice for this one',
    stage: (b) => {
      choices(b, 1, ['k1', CHOICE]);
      return { ...sending({ 1: { discoveryChoices: { k2: 'sd03' } } }), board: b };
    },
    check: (o) => ({ got: { found: found(o, 1) }, want: { found: [['sd04', o.turn - 1]] } }),
  },
  {
    name: 'a lead the realm already knows is passed over: it pursues the other, told as no choice sent',
    stage: (b) => {
      knowsAll(b, 1, 'sd04');
      choices(b, 1, ['k1', CHOICE]);
      return { ...sending({ 1: { discoveryChoices: { k1: 'sd04' } } }), board: b };
    },
    check: (o, s) => ({
      got: {
        found: found(o, 1).map(([id]) => id),
        forgotten: forgotten(o, 1),
        told: told(o, pursuit(board_(s), 1, 'sd03', false, ['sd04'])).length,
      },
      want: { found: ['sd04', 'sd03'], forgotten: ['sd04'], told: 1 },
    }),
  },
  {
    name: 'when the realm knows both leads, the choice is dropped: nothing found, forgotten or told',
    stage: (b) => {
      knowsAll(b, 1, 'sd03', 'sd04');
      choices(b, 1, ['k1', CHOICE]);
      return { board: b };
    },
    check: (o) => ({
      got: { found: found(o, 1).length, forgotten: forgotten(o, 1), pending: pending(o, 1), lines: starting(o, '💡 ') },
      want: { found: 2, forgotten: null, pending: [], lines: [] },
    }),
  },
  {
    name: 'a lead the game no longer has is never pursued, but is forgotten with the other by its id',
    stage: (b) => {
      choices(b, 0, ['k0', ['sd03', 'sd99']]);
      return { ...sending({ 0: { discoveryChoices: { k0: 'sd99' } } }), board: b };
    },
    check: (o, s) => ({
      got: {
        found: found(o, 0),
        forgotten: forgotten(o, 0),
        told: told(o, pursuit(board_(s), 0, 'sd03', false, ['sd99'])).length,
      },
      want: { found: [['sd03', o.turn - 1]], forgotten: ['sd99'], told: 1 },
    }),
  },
  {
    name: 'a choice of one lead is pursued with no other to forget',
    stage: (b) => {
      choices(b, 2, ['k', ['sd03']]);
      return { board: b };
    },
    check: (o, s) => ({
      got: { forgotten: forgotten(o, 2), told: told(o, pursuit(board_(s), 2, 'sd03', false, [])).length },
      want: { forgotten: [], told: 1 },
    }),
  },
  {
    name: 'a lead forgotten before is not forgotten twice',
    stage: (b) => {
      realm(b, 1)['forgottenDiscoveries'] = ['sd03'];
      choices(b, 1, ['k1', CHOICE]);
      return { ...sending({ 1: { discoveryChoices: { k1: 'sd04' } } }), board: b };
    },
    check: (o) => ({ got: { forgotten: forgotten(o, 1) }, want: { forgotten: ['sd03'] } }),
  },
  {
    name: 'leads are forgotten after those forgotten before',
    stage: (b) => {
      realm(b, 1)['forgottenDiscoveries'] = ['sd05'];
      choices(b, 1, ['k1', CHOICE]);
      return { ...sending({ 1: { discoveryChoices: { k1: 'sd04' } } }), board: b };
    },
    check: (o) => ({ got: { forgotten: forgotten(o, 1) }, want: { forgotten: ['sd05', 'sd03'] } }),
  },
  {
    name: 'a realm with no list of discoveries is given one',
    stage: (b) => {
      delete realm(b, 2)['discoveries'];
      choices(b, 2, ['k', CHOICE]);
      return { board: b };
    },
    check: (o) => ({ got: { found: found(o, 2) }, want: { found: [['sd04', o.turn - 1]] } }),
  },
  {
    name: 'a choice found by no-one named was found by “a scholar”',
    stage: (b) => {
      choices(b, 0, ['k0', CHOICE, b.G.turn - 1, '']);
      return { board: b };
    },
    check: (o, s) => ({
      got: { told: told(o, pursuit(board_(s), 0, 'sd04', false, ['sd03'], 'a scholar')).length },
      want: { told: 1 },
    }),
  },
  {
    name: 'a choice found this turn waits: not settled, still pending',
    stage: (b) => {
      choices(b, 0, ['k0', CHOICE, b.G.turn]);
      return { ...sending({ 0: { discoveryChoices: { k0: 'sd03' } } }), board: b };
    },
    check: (o) => ({
      got: { found: found(o, 0), pending: pending(o, 0), lines: starting(o, '💡 ') },
      want: { found: [], pending: ['k0'], lines: [] },
    }),
  },
  {
    name: 'a choice whose leads aren’t a list waits, still pending',
    stage: (b) => {
      choices(b, 0, ['k0', null]);
      return { board: b };
    },
    check: (o) => ({
      got: { found: found(o, 0), pending: pending(o, 0), lines: starting(o, '💡 ') },
      want: { found: [], pending: ['k0'], lines: [] },
    }),
  },
  {
    name: 'each of a realm’s choices is settled in turn, one of this turn left pending',
    stage: (b) => {
      choices(b, 1, ['a', ['sd03']], ['b', ['sd04'], b.G.turn], ['c', ['sd05']]);
      return { board: b };
    },
    check: (o) => ({
      got: { found: found(o, 1).map(([id]) => id), pending: pending(o, 1), lines: starting(o, '💡 ').length },
      want: { found: ['sd03', 'sd05'], pending: ['b'], lines: 2 },
    }),
  },
  {
    name: 'every realm’s choices are settled, in realm order',
    stage: (b) => {
      choices(b, 2, ['k', ['sd05']]);
      choices(b, 0, ['k', ['sd03']]);
      return { board: b };
    },
    check: (o, s) => ({
      got: { lines: starting(o, '💡 ') },
      want: { lines: [pursuit(board_(s), 0, 'sd03', false, []), pursuit(board_(s), 2, 'sd05', false, [])] },
    }),
  },
  {
    name: 'a realm with no pending choices finds nothing',
    stage: (b) => {
      realm(b, 0)['pendingDiscoveryChoices'] = [];
      return {};
    },
    check: (o) => ({ got: { found: found(o, 0), lines: starting(o, '💡 ') }, want: { found: [], lines: [] } }),
  },
  {
    name: 'a bot realm makes its own pick: the lead its scholars favour, told as pursued',
    wholeTurnOnly: true,
    stage: (b) => {
      choices(b, 2, ['k', ['sd04', 'sd03']]);
      return { bots: [2], board: b };
    },
    check: (o, s) => {
      const b = board_(s);
      const pick = vm.runInContext(`botResearchPick`, b.engine) as (g: unknown, pi: number, opts: string[]) => string;
      const want = pick(b.G, 2, ['sd04', 'sd03']);
      return {
        got: { pursued: starting(o, `💡 ${nameOf(b, 2)} pursues`).length, found: found(o, 2).map(([id]) => id) },
        want: { pursued: 1, found: [want] },
      };
    },
  },
  {
    name: 'a bot realm’s choice found this turn waits, as anyone’s',
    wholeTurnOnly: true,
    stage: (b) => {
      choices(b, 2, ['k', CHOICE, b.G.turn]);
      return { bots: [2], board: b };
    },
    check: (o) => ({ got: { found: found(o, 2), pending: pending(o, 2) }, want: { found: [], pending: ['k'] } }),
  },
];

// ── 2. War without warning, the titles held, the Safe Start's and stale orders' lines, the GM's removals, messages ─
const WAR_FIELDS = (a: number, x: number) => ({
  type: 'system',
  actor: null,
  targets: [a, x],
  public: false,
  system: true,
  phase: null,
  charId: null,
});
export const WAR_CASES: BeforeCase[] = [
  {
    name: 'an Evil realm’s war on a realm it has met stands from the first phase, told to both',
    stage: (b) => {
      creed(b, 1, 'Evil');
      return { ...sending({ 1: { diplomacy: { 2: 'enemy' } } }), board: b };
    },
    check: (o, s) => ({
      got: { relation: relationAt(o, 1, 2), told: told(o, warNow(nameOf(board_(s), 1), nameOf(board_(s), 2))) },
      want: { relation: 'enemy', told: [WAR_FIELDS(1, 2)] },
    }),
  },
  {
    name: 'an Undead realm’s war stands at once too: the dead keep no truce',
    stage: (b) => {
      creed(b, 2, 'Undead');
      return { ...sending({ 2: { diplomacy: { 1: 'enemy' } } }), board: b };
    },
    check: (o, s) => ({
      got: {
        relation: relationAt(o, 1, 2),
        told: told(o, warNow(nameOf(board_(s), 2), nameOf(board_(s), 1), true)).length,
      },
      want: { relation: 'enemy', told: 1 },
    }),
  },
  {
    name: 'an Evil realm’s war on its ally stands at once: the alliance is broken before the first phase',
    stage: (b) => {
      creed(b, 0, 'Evil');
      return { ...sending({ 0: { diplomacy: { 2: 'enemy' } } }), board: b };
    },
    check: (o, s) => ({
      got: { relation: relationAt(o, 0, 2), told: told(o, warNow(nameOf(board_(s), 0), nameOf(board_(s), 2))).length },
      want: { relation: 'enemy', told: 1 },
    }),
  },
  {
    name: 'an Evil realm’s war on a realm it hasn’t met waits: nothing at the first phase',
    stage: (b) => {
      creed(b, 1, 'Evil');
      unmet(b, 1, 2);
      return { ...sending({ 1: { diplomacy: { 2: 'enemy' } } }), board: b };
    },
    check: (o) => ({
      got: { relation: relationAt(o, 1, 2), lines: starting(o, '⚔ ').filter((t) => t.includes('without warning')) },
      want: { relation: 'neutral', lines: [] },
    }),
  },
  {
    name: 'an Evil realm already at war is not told again',
    stage: (b) => {
      creed(b, 1, 'Evil');
      return { ...sending({ 1: { diplomacy: { 0: 'enemy' } } }), board: b };
    },
    check: (o) => ({
      got: { relation: relationAt(o, 0, 1), lines: starting(o, '⚔ ').filter((t) => t.includes('without warning')) },
      want: { relation: 'enemy', lines: [] },
    }),
  },
  {
    name: 'a Divine realm’s war waits for the turn’s end: still at peace at the first phase',
    stage: () => sending({ 1: { diplomacy: { 2: 'enemy' } } }),
    check: (o) => ({
      got: { relation: relationAt(o, 1, 2), lines: starting(o, '⚔ ').filter((t) => t.includes('without warning')) },
      want: { relation: 'neutral', lines: [] },
    }),
  },
  {
    name: 'a Pagan realm’s war waits too (only the Evil and the Undead strike at once)',
    stage: (b) => {
      creed(b, 1, 'Pagan');
      return sending({ 1: { diplomacy: { 2: 'enemy' } } });
    },
    check: (o) => ({ got: { relation: relationAt(o, 1, 2) }, want: { relation: 'neutral' } }),
  },
  {
    name: 'an Evil realm’s Treat changes nothing before the first phase',
    stage: (b) => {
      creed(b, 1, 'Evil');
      return sending({ 1: { diplomacy: { 2: 'treat' } } });
    },
    check: (o) => ({
      got: { relation: relationAt(o, 1, 2), lines: starting(o, '⚔ ').filter((t) => t.includes('without warning')) },
      want: { relation: 'neutral', lines: [] },
    }),
  },
  {
    name: 'an Evil realm’s war on itself is nothing, even one its record says has met itself',
    stage: (b) => {
      creed(b, 1, 'Evil');
      realm(b, 1)['_encountered'] = [0, 1, 2];
      return sending({ 1: { diplomacy: { 1: 'enemy' } } });
    },
    check: (o) => ({
      got: { relations: o.first.relations, lines: starting(o, '⚔ ').filter((t) => t.includes('without warning')) },
      want: { relations: { '0-1': 'enemy', '0-2': 'allied' }, lines: [] },
    }),
  },
  {
    name: 'an Evil realm’s wars on two realms stand at once, told in realm order',
    stage: (b) => {
      creed(b, 2, 'Evil');
      relate(b, { '0-1': 'enemy' });
      return { ...sending({ 2: { diplomacy: { 1: 'enemy', 0: 'enemy' } } }), board: b };
    },
    check: (o, s) => {
      const b = board_(s);
      return {
        got: {
          relations: [relationAt(o, 0, 2), relationAt(o, 1, 2)],
          lines: starting(o, '⚔ ').filter((t) => t.includes('without warning')),
        },
        want: {
          relations: ['enemy', 'enemy'],
          lines: [warNow(nameOf(b, 2), nameOf(b, 0)), warNow(nameOf(b, 2), nameOf(b, 1))],
        },
      };
    },
  },
  {
    name: 'two Evil realms’ wars are told in realm order',
    stage: (b) => {
      creed(b, 1, 'Evil');
      creed(b, 2, 'Undead');
      relate(b, {});
      return { ...sending({ 2: { diplomacy: { 0: 'enemy' } }, 1: { diplomacy: { 0: 'enemy' } } }), board: b };
    },
    check: (o, s) => {
      const b = board_(s);
      return {
        got: { lines: starting(o, '⚔ ').filter((t) => t.includes('without warning')) },
        want: { lines: [warNow(nameOf(b, 1), nameOf(b, 0)), warNow(nameOf(b, 2), nameOf(b, 0), true)] },
      };
    },
  },
  {
    name: 'under Safe Start an Evil realm’s war is set aside: no war, and it alone is told',
    stage: (b) => {
      creed(b, 1, 'Evil');
      safeStart(b);
      return sending({ 1: { diplomacy: { 2: 'enemy' } } });
    },
    check: (o) => ({
      got: {
        relation: relationAt(o, 1, 2),
        refused: told(o, SAFE_START_LINE).map((l) => l.targets),
        war: starting(o, '⚔ ').filter((t) => t.includes('without warning')),
      },
      want: { relation: 'neutral', refused: [[1]], war: [] },
    }),
  },
  {
    name: 'an Evil bot realm declares war at once on a realm it has met that its creed abhors',
    wholeTurnOnly: true,
    stage: (b) => {
      creed(b, 1, 'Evil');
      return { bots: [1], board: b };
    },
    check: (o, s) => ({
      got: {
        relation: relationAt(o, 1, 2),
        told: told(o, warNow(nameOf(board_(s), 1), nameOf(board_(s), 2))).length,
      },
      want: { relation: 'enemy', told: 1 },
    }),
  },
];

const titlesOf = (o: Outcome) => {
  const r = rawOf(o.first);
  const t = (r['_titleHolders'] ?? null) as Record<string, Raw> | null;
  const m = (r['_minorHolders'] ?? null) as Record<string, Raw> | null;
  return {
    titles: t && Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v['playerIndex'] ?? null])),
    minor: m && Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v['charId'] ?? null])),
  };
};
export const TITLE_CASES: BeforeCase[] = [
  {
    name: 'before turn 5 no title is held going into the turn, whatever the save kept',
    stage: (b) => {
      turnIs(b, 4);
      Object.assign(raw(b), {
        _titleHolders: { throne: { playerIndex: 1 } },
        _minorHolders: { colossus: { charId: 1 } },
      });
      return {};
    },
    check: (o) => ({ got: titlesOf(o), want: { titles: {}, minor: {} } }),
  },
  {
    name: 'from turn 5 the titles held going into the turn are the standings’: realm 0 holds the Throne and the Vaultkeeper',
    stage: (b) => {
      turnIs(b, 5);
      return {};
    },
    check: (o) => {
      const t = titlesOf(o).titles ?? {};
      return {
        got: { throne: t['throne'], vault: t['vault'], marshal: t['marshal'], n: Object.keys(t).length },
        want: { throne: 0, vault: 0, marshal: null, n: 13 },
      };
    },
  },
  {
    name: 'from turn 5 the minor titles held going into the turn are worked out too: realm 0’s king holds the Colossus and the Castellan',
    stage: (b) => {
      turnIs(b, 5);
      return { hero: kingOf(b, 0) };
    },
    check: (o, s) => ({
      got: { minor: titlesOf(o).minor },
      want: { minor: { colossus: hero(s).id, castellan: hero(s).id } },
    }),
  },
  {
    name: 'from turn 5 the holders are worked out afresh: a stale holder in the save is not kept',
    stage: (b) => {
      turnIs(b, 6);
      Object.assign(raw(b), {
        _titleHolders: { throne: { playerIndex: 2 }, bogus: { playerIndex: 1 } },
        _minorHolders: { bogus: { charId: 3 } },
      });
      return {};
    },
    check: (o) => {
      const { titles, minor } = titlesOf(o);
      return {
        got: { throne: titles?.['throne'], bogus: titles?.['bogus'] ?? 'none', minorBogus: minor?.['bogus'] ?? 'none' },
        want: { throne: 0, bogus: 'none', minorBogus: 'none' },
      };
    },
  },
];

export const SAFE_START_AND_STALE_CASES: BeforeCase[] = [
  {
    name: 'a realm whose declarations Safe Start set aside is told, privately, by the system',
    stage: (b) => {
      safeStart(b);
      return sending({ 2: { diplomacy: { 1: 'treat' } } });
    },
    check: (o) => ({
      got: { told: told(o, SAFE_START_LINE) },
      want: {
        told: [{ type: 'system', actor: null, targets: [2], public: false, system: true, phase: null, charId: null }],
      },
    }),
  },
  {
    name: 'each realm Safe Start refused is told, in the rows’ order',
    stage: (b) => {
      safeStart(b);
      return {
        ...sending({ 0: { diplomacy: { 1: 'enemy' } }, 2: { diplomacy: { 1: 'treat' } } }),
        rowOrder: [2, 1, 0],
      };
    },
    check: (o) => ({ got: { told: told(o, SAFE_START_LINE).map((l) => l.targets) }, want: { told: [[2], [0]] } }),
  },
  {
    name: 'no Safe Start line for a realm that sent no declaration',
    stage: (b) => {
      safeStart(b);
      return {};
    },
    check: (o) => ({ got: { told: told(o, SAFE_START_LINE).length }, want: { told: 0 } }),
  },
  {
    name: 'stale orders are told to the GM: by the system, to nobody else, not public',
    stage: (b) => sending({ 1: { forTurn: b.G.turn + 1 } }),
    check: (o) => ({
      got: { told: told(o, stale(must(o.first.players[1], 'realm 1').name, o.turn + 1, o.turn)) },
      want: {
        told: [{ type: 'system', actor: -1, targets: [], public: false, system: true, phase: null, charId: null }],
      },
    }),
  },
  {
    name: 'a concession is told to the whole world: the system’s line, public',
    stage: () => sending({ 2: { concede: true } }),
    check: (o) => ({
      got: { told: told(o, conceded(must(o.first.players[2], 'realm 2').name)) },
      want: {
        told: [{ type: 'system', actor: -1, targets: [], public: true, system: true, phase: null, charId: null }],
      },
    }),
  },
  {
    name: 'stale orders and concessions are told in the order the merge met them, after the Safe Start’s lines',
    stage: (b) => {
      safeStart(b);
      return {
        ...sending({ 0: { concede: true }, 1: { forTurn: b.G.turn - 1 }, 2: { diplomacy: { 1: 'enemy' } } }),
        rowOrder: [1, 0, 2],
      };
    },
    check: (o) => {
      const n = (pi: number) => must(o.first.players[pi], 'realm').name;
      return {
        got: { lines: o.all.filter((l) => l.type === 'system' && l.phase === null).map((l) => l.text) },
        want: { lines: [SAFE_START_LINE, stale(n(1), o.turn - 1, o.turn), conceded(n(0))] },
      };
    },
  },
];

export const GM_REMOVAL_CASES: BeforeCase[] = [
  {
    name: 'a realm the GM removed is told to the world as withdrawn and conceding, and the list is gone',
    stage: (b) => {
      raw(b)['_gmRemovedRealms'] = [1];
      return { board: b };
    },
    check: (o, s) => ({
      got: { told: told(o, withdrawn(nameOf(board_(s), 1))), list: rawOf(o.first)['_gmRemovedRealms'] ?? 'gone' },
      want: {
        told: [{ type: 'system', actor: -1, targets: [], public: true, system: true, phase: null, charId: null }],
        list: 'gone',
      },
    }),
  },
  {
    name: 'two realms the GM removed are told in the list’s order',
    stage: (b) => {
      raw(b)['_gmRemovedRealms'] = [2, 0];
      return { board: b };
    },
    check: (o, s) => ({
      got: { lines: starting(o, '\u{1F3F3} ').filter((t) => t.includes('withdrawn')) },
      want: { lines: [withdrawn(nameOf(board_(s), 2)), withdrawn(nameOf(board_(s), 0))] },
    }),
  },
  {
    name: 'a removed realm the save no longer has is passed over; the list is gone all the same',
    stage: (b) => {
      raw(b)['_gmRemovedRealms'] = [7, 1];
      return { board: b };
    },
    check: (o, s) => ({
      got: {
        lines: starting(o, '\u{1F3F3} ').filter((t) => t.includes('withdrawn')),
        list: rawOf(o.first)['_gmRemovedRealms'] ?? 'gone',
      },
      want: { lines: [withdrawn(nameOf(board_(s), 1))], list: 'gone' },
    }),
  },
  {
    name: 'an empty list of removals is left as it is, and nobody is told',
    stage: (b) => {
      raw(b)['_gmRemovedRealms'] = [];
      return {};
    },
    check: (o) => ({
      got: {
        lines: starting(o, '\u{1F3F3} ').filter((t) => t.includes('withdrawn')),
        list: rawOf(o.first)['_gmRemovedRealms'] ?? 'gone',
      },
      want: { lines: [], list: [] },
    }),
  },
  {
    name: 'removals written as text are left as they are, and nobody is told',
    stage: (b) => {
      raw(b)['_gmRemovedRealms'] = '1';
      return {};
    },
    check: (o) => ({
      got: {
        lines: starting(o, '\u{1F3F3} ').filter((t) => t.includes('withdrawn')),
        list: rawOf(o.first)['_gmRemovedRealms'] ?? 'gone',
      },
      want: { lines: [], list: '1' },
    }),
  },
  {
    name: 'removals that aren’t a list are left as they are, and nobody is told',
    stage: (b) => {
      raw(b)['_gmRemovedRealms'] = { 0: 1 };
      return {};
    },
    check: (o) => ({
      got: {
        lines: starting(o, '\u{1F3F3} ').filter((t) => t.includes('withdrawn')),
        list: rawOf(o.first)['_gmRemovedRealms'] ?? 'gone',
      },
      want: { lines: [], list: { 0: 1 } },
    }),
  },
];

const DISPATCH = (to: number) => ({
  type: 'message',
  actor: null,
  targets: [to],
  public: false,
  system: false,
  phase: 99,
  charId: null,
});
const COPY = (from: number) => ({
  type: 'message',
  actor: from,
  targets: [from],
  public: false,
  system: false,
  phase: 99,
  charId: null,
});
const dispatches = (o: Outcome) => o.all.filter((l) => l.type === 'message').map((l) => [l.targets, l.text]);
export const MESSAGE_CASES: BeforeCase[] = [
  {
    name: 'a message is delivered to the realm it is for, unsigned by its sender’s hand, with a copy to the sender',
    stage: (b) => ({ ...sending({ 1: { messages: [{ to: [2], text: 'Meet at the ford.' }] } }), board: b }),
    check: (o, s) => {
      const b = board_(s);
      return {
        got: {
          to: told(o, dispatch(nameOf(b, 1), 'Meet at the ford.')),
          copy: told(o, sentTo([nameOf(b, 2)], 'Meet at the ford.')),
        },
        want: { to: [DISPATCH(2)], copy: [COPY(1)] },
      };
    },
  },
  {
    name: 'a message to all goes to every other realm a player holds, the copy naming them in realm order',
    stage: (b) => ({ ...sending({ 1: { messages: [{ to: 'all', text: 'Hear me.' }] } }), board: b }),
    check: (o, s) => {
      const b = board_(s);
      return {
        got: { lines: dispatches(o) },
        want: {
          lines: [
            [[0], dispatch(nameOf(b, 1), 'Hear me.')],
            [[2], dispatch(nameOf(b, 1), 'Hear me.')],
            [[1], sentTo([nameOf(b, 0), nameOf(b, 2)], 'Hear me.')],
          ],
        },
      };
    },
  },
  {
    name: 'a message to all goes to the realms in realm order, whatever order the slot rows come in',
    stage: (b) => ({
      ...sending({ 1: { messages: [{ to: 'all', text: 'Hear me.' }] } }),
      rowOrder: [2, 1, 0],
      board: b,
    }),
    check: (o) => ({ got: { to: dispatches(o).map(([t]) => t) }, want: { to: [[0], [2], [1]] } }),
  },
  {
    name: 'a message to a list naming “all” goes to all too',
    stage: (b) => ({ ...sending({ 0: { messages: [{ to: [2, 'all'], text: 'Hear me.' }] } }), board: b }),
    check: (o) => ({ got: { to: dispatches(o).map(([t]) => t) }, want: { to: [[1], [2], [0]] } }),
  },
  {
    name: 'a message to all passes over a seat nobody holds',
    stage: (b) => ({
      ...sending({ 0: { messages: [{ to: 'all', text: 'Hear me.' }] } }),
      slots: { 1: { user: null } },
      board: b,
    }),
    check: (o, s) => {
      const b = board_(s);
      return {
        got: { lines: dispatches(o) },
        want: {
          lines: [
            [[2], dispatch(nameOf(b, 0), 'Hear me.')],
            [[0], sentTo([nameOf(b, 2)], 'Hear me.')],
          ],
        },
      };
    },
  },
  {
    name: 'a message to a seat nobody holds, named, is delivered all the same',
    stage: (b) => ({
      ...sending({ 0: { messages: [{ to: [1], text: 'Anyone?' }] } }),
      slots: { 1: { user: null } },
      board: b,
    }),
    check: (o) => ({ got: { to: dispatches(o).map(([t]) => t) }, want: { to: [[1], [0]] } }),
  },
  {
    name: 'a realm named twice is sent the message once, the copy naming it once',
    stage: (b) => ({ ...sending({ 0: { messages: [{ to: [2, 2], text: 'Twice?' }] } }), board: b }),
    check: (o, s) => {
      const b = board_(s);
      return {
        got: { lines: dispatches(o) },
        want: {
          lines: [
            [[2], dispatch(nameOf(b, 0), 'Twice?')],
            [[0], sentTo([nameOf(b, 2)], 'Twice?')],
          ],
        },
      };
    },
  },
  {
    name: 'the realms named are sent the message, and named in the copy, in the order the sender named them',
    stage: (b) => ({ ...sending({ 0: { messages: [{ to: [2, 1], text: 'Both of you.' }] } }), board: b }),
    check: (o, s) => {
      const b = board_(s);
      return {
        got: { lines: dispatches(o) },
        want: {
          lines: [
            [[2], dispatch(nameOf(b, 0), 'Both of you.')],
            [[1], dispatch(nameOf(b, 0), 'Both of you.')],
            [[0], sentTo([nameOf(b, 2), nameOf(b, 1)], 'Both of you.')],
          ],
        },
      };
    },
  },
  {
    name: 'realms named as text are read as numbers',
    stage: (b) => ({ ...sending({ 0: { messages: [{ to: ['2'], text: 'By number.' }] } }), board: b }),
    check: (o) => ({ got: { to: dispatches(o).map(([t]) => t) }, want: { to: [[2], [0]] } }),
  },
  {
    name: 'a message the sender sends himself alone is not sent at all, not even the copy',
    stage: () => sending({ 1: { messages: [{ to: [1], text: 'Note to self.' }] } }),
    check: (o) => ({ got: { lines: dispatches(o) }, want: { lines: [] } }),
  },
  {
    name: 'a realm the sender names among others, himself too, is not sent his own message',
    stage: (b) => ({ ...sending({ 1: { messages: [{ to: [1, 0], text: 'Us.' }] } }), board: b }),
    check: (o) => ({ got: { to: dispatches(o).map(([t]) => t) }, want: { to: [[0], [1]] } }),
  },
  {
    name: 'a message to realms the game doesn’t have (out of range, below 0, not a number) is not sent',
    stage: () => sending({ 1: { messages: [{ to: [3, -1, 'x', 9], text: 'Anyone?' }] } }),
    check: (o) => ({ got: { lines: dispatches(o) }, want: { lines: [] } }),
  },
  {
    name: 'a message to nobody in a form the game doesn’t know (a number, not a list) is not sent',
    stage: () => sending({ 1: { messages: [{ to: 2, text: 'Psst.' }] } }),
    check: (o) => ({ got: { lines: dispatches(o) }, want: { lines: [] } }),
  },
  {
    name: 'a message’s text is trimmed',
    stage: (b) => ({ ...sending({ 2: { messages: [{ to: [0], text: '   Hold the pass.  ' }] } }), board: b }),
    check: (o, s) => ({
      got: { n: told(o, dispatch(nameOf(board_(s), 2), 'Hold the pass.')).length },
      want: { n: 1 },
    }),
  },
  {
    name: 'a message’s text is cut to 1,000 characters',
    stage: (b) => ({ ...sending({ 2: { messages: [{ to: [0], text: 'a'.repeat(1003) }] } }), board: b }),
    check: (o, s) => ({
      got: {
        to: told(o, dispatch(nameOf(board_(s), 2), 'a'.repeat(1000))).length,
        copy: told(o, sentTo([nameOf(board_(s), 0)], 'a'.repeat(1000))).length,
      },
      want: { to: 1, copy: 1 },
    }),
  },
  {
    name: 'a message is trimmed before it is cut: spaces before 1,000 characters leave all 1,000',
    stage: (b) => ({ ...sending({ 2: { messages: [{ to: [0], text: '   ' + 'b'.repeat(1000) }] } }), board: b }),
    check: (o, s) => ({
      got: { to: told(o, dispatch(nameOf(board_(s), 2), 'b'.repeat(1000))).length },
      want: { to: 1 },
    }),
  },
  {
    name: 'a message of only spaces, of no text, of a number, or no message at all, is not sent',
    stage: () =>
      sending({
        0: { messages: [{ to: [1], text: '   ' }, { to: [1] }, { to: [1], text: 5 }, null, { to: [2], text: '' }] },
      }),
    check: (o) => ({ got: { lines: dispatches(o) }, want: { lines: [] } }),
  },
  {
    name: 'every message of every realm is delivered: realm by realm in realm order, each realm’s in its order',
    stage: (b) => ({
      ...sending({
        2: { messages: [{ to: [0], text: 'Third.' }] },
        0: {
          messages: [
            { to: [1], text: 'First.' },
            { to: [2], text: 'Second.' },
          ],
        },
      }),
      rowOrder: [2, 1, 0],
      board: b,
    }),
    check: (o) => ({
      got: { lines: dispatches(o).map(([, t]) => String(t).replace(/^📨 (Dispatch from|You sent to) .*: /, '')) },
      want: { lines: ['“First.”', '“First.”', '“Second.”', '“Second.”', '“Third.”', '“Third.”'] },
    }),
  },
];

// ── 3. The move pools, the turn's trackers and the save's sweeps ─────────────────────────────────────────────────
const poolOf = (o: Outcome, c: Character) => ({
  land: o.ctx.land[String(c.id)] ?? null,
  landMax: o.ctx.landMax[String(c.id)] ?? null,
  sea: o.ctx.sea[String(c.id)] ?? null,
  seaMax: o.ctx.seaMax[String(c.id)] ?? null,
  seaActive: o.ctx.seaActive[String(c.id)] ?? null,
  seaCap: o.ctx.seaCap[String(c.id)] ?? null,
});
const NO_POOL = { land: null, landMax: null, sea: null, seaMax: null, seaActive: null, seaCap: null };
export const POOL_CASES: BeforeCase[] = [
  {
    name: 'a living hero of a realm leading no companies has a flat 5 to march, and 5 at sea, taking passage on any water',
    stage: (b) => ({ hero: realmHero(b, 1) }),
    check: (o, s) => ({
      got: poolOf(o, hero(s)),
      want: { land: 5, landMax: 5, sea: 5, seaMax: 5, seaActive: true, seaCap: 'all' },
    }),
  },
  {
    name: 'a hero leading Men-at-Arms marches at their pace',
    stage: (b) => ({ hero: host(b, 0, b.X, 2) }),
    check: (o, s) => ({ got: { land: poolOf(o, hero(s)).land }, want: { land: 2 } }),
  },
  {
    name: 'a hero leading companies with March 4 marches further',
    stage: (b) => {
      const h = host(b, 0, b.X, 2);
      h.skills = { ...h.skills, march: 4 };
      return { hero: h };
    },
    check: (o, s) => ({ got: { land: poolOf(o, hero(s)).land }, want: { land: 4 } }),
  },
  {
    name: 'every king has his pool',
    stage: (b) => ({ others: [0, 1, 2].map((pi) => kingOf(b, pi)) }),
    check: (o, s) => ({
      got: { land: [0, 1, 2].map((i) => poolOf(o, other(s, i)).land) },
      want: { land: [5, 5, 5] },
    }),
  },
  {
    name: 'a wandering hero and a fallen hero of a realm have no pool',
    stage: (b) => ({ hero: wanderer(b), others: [realmHero(b, 0, { alive: false })] }),
    check: (o, s) => ({
      got: { wanderer: poolOf(o, hero(s)), fallen: poolOf(o, other(s, 0)) },
      want: { wanderer: NO_POOL, fallen: NO_POOL },
    }),
  },
  {
    name: 'the pools are the turn’s own: no hero has travelled light yet, and only the living realm heroes have one',
    stage: (b) => ({ hero: realmHero(b, 2), others: [wanderer(b)] }),
    check: (o) => ({
      got: { lightLand: o.ctx.lightLand, lightSea: o.ctx.lightSea, heroes: Object.keys(o.ctx.landMax).length },
      want: {
        lightLand: {},
        lightSea: {},
        heroes: o.first.characters.filter((c) => c.alive && c.player != null).length,
      },
    }),
  },
];

export const TRACKER_CASES: BeforeCase[] = [
  {
    name: 'the seasons are the game’s five, a copy of its list for the turn',
    stage: () => ({}),
    check: (o) => ({
      got: { seasons: o.ctx.seasons, copied: o.ctx.seasonsCopied },
      want: { seasons: ['Spring', 'Early Summer', 'Late Summer', 'Fall', 'Early Winter'], copied: true },
    }),
  },
  {
    name: 'the turn’s trackers start empty: no recruits, nobody seen in a phase, nowhere entered, no sightings, no distances',
    stage: () => ({}),
    check: (o) => ({
      got: {
        recruited: o.ctx.recruited,
        presence: o.ctx.presence,
        entered: o.ctx.entered,
        sightings: o.ctx.sightings,
        distances: o.ctx.distances,
      },
      want: { recruited: {}, presence: [], entered: {}, sightings: 0, distances: 0 },
    }),
  },
  {
    name: 'last turn’s deaths are cleared: no hero, living or fallen, is marked as killed this turn',
    stage: (b) => {
      const a = realmHero(b, 1, { killedThisTurn: true });
      const f = realmHero(b, 0, { alive: false, killedThisTurn: true });
      const w = wanderer(b);
      w['killedThisTurn'] = 3;
      return { others: [a, f, w] };
    },
    check: (o, s) => ({
      got: { marked: [0, 1, 2].map((i) => 'killedThisTurn' in charIn(o.first, other(s, i))) },
      want: { marked: [false, false, false] },
    }),
  },
  {
    name: 'espionage starts afresh: the ledger empty; each realm’s provinces spied become last turn’s, none this turn, no Clairvoyance',
    stage: (b) => {
      raw(b)['_espionageLedger'] = [{ byPi: 0, provId: 3, kind: 'spy' }];
      Object.assign(realm(b, 1), {
        _spiedProvincesThisTurn: [4, 5],
        _spiedProvincesLastTurn: [9],
        _clairCharThisTurn: 7,
      });
      return {};
    },
    check: (o) => {
      const r = realmIn(o.first, 1);
      return {
        got: {
          ledger: rawOf(o.first)['_espionageLedger'],
          last: r['_spiedProvincesLastTurn'],
          now: r['_spiedProvincesThisTurn'],
          clair: '_clairCharThisTurn' in r ? r['_clairCharThisTurn'] : 'unset',
        },
        want: { ledger: [], last: [4, 5], now: [], clair: null },
      };
    },
  },
  {
    name: 'a realm that spied nowhere last turn has none as last turn’s',
    stage: (b) => {
      delete realm(b, 2)['_spiedProvincesThisTurn'];
      realm(b, 2)['_spiedProvincesLastTurn'] = [1];
      return {};
    },
    check: (o) => ({
      got: {
        last: realmIn(o.first, 2)['_spiedProvincesLastTurn'],
        now: realmIn(o.first, 2)['_spiedProvincesThisTurn'],
      },
      want: { last: [], now: [] },
    }),
  },
  {
    name: 'what a realm learned of heroes’ skills by spying is kept; a realm with no record starts one',
    stage: (b) => {
      realm(b, 0)['_spiedHeroSkills'] = { 9: { melee: 3 } };
      delete realm(b, 1)['_spiedHeroSkills'];
      return {};
    },
    check: (o) => ({
      got: { kept: realmIn(o.first, 0)['_spiedHeroSkills'], started: realmIn(o.first, 1)['_spiedHeroSkills'] },
      want: { kept: { 9: { melee: 3 } }, started: {} },
    }),
  },
  {
    name: 'watches, chases and their marks last a turn: every hero’s are gone, the fallen’s and the wanderer’s too',
    stage: (b) => {
      const marks = { _defend: { active: true }, _pursuit: { active: true, targetId: 1 }, _defendReactedPhase: 2 };
      const a = realmHero(b, 0, { ...marks });
      const f = realmHero(b, 1, { ...marks, alive: false });
      const w = Object.assign(wanderer(b), marks);
      return { others: [a, f, w] };
    },
    check: (o, s) => ({
      got: {
        left: [0, 1, 2].map((i) =>
          ['_defend', '_pursuit', '_defendReactedPhase'].filter((k) => k in charIn(o.first, other(s, i))),
        ),
      },
      want: { left: [[], [], []] },
    }),
  },
  {
    name: 'the province a hero attacked from is a fact of one turn: gone from every hero',
    stage: (b) => {
      const a = realmHero(b, 0, { _attackedFrom: 3 });
      const f = realmHero(b, 2, { _attackedFrom: 4, alive: false });
      return { others: [a, f] };
    },
    check: (o, s) => ({
      got: { left: [0, 1].map((i) => '_attackedFrom' in charIn(o.first, other(s, i))) },
      want: { left: [false, false] },
    }),
  },
];

const mithril = (o: Outcome, c: Character) =>
  ((charIn(o.first, c).items as Raw[] | undefined) ?? []).filter(
    (it) => (it['effect'] as Raw | undefined)?.['stat'] === 'mithrilArmour',
  ).length;
const wardOf = (o: Outcome, p: Province) => {
  const q = must(o.first.world.provinces[p.id], 'province') as Raw;
  return { turn: q['_blessWardTurn'] ?? null, by: q['_blessWardBy'] ?? null, pct: q['_blessWardPct'] ?? null };
};
const NO_WARD = { turn: null, by: null, pct: null };
const featuresIn = (o: Outcome, p: Province) =>
  ((must(o.first.world.provinces[p.id], 'province')['features'] as Raw[] | undefined) ?? []).map(
    (f) => f['monster'] as Raw | undefined,
  );
export const SWEEP_CASES: BeforeCase[] = [
  {
    name: 'a Dwarf serving a Dwarven realm is suited in mithril before any battle',
    stage: (b) => {
      realm(b, 1)['race'] = 'Dwarven';
      return { hero: realmHero(b, 1, { race: 'Dwarven' }) };
    },
    check: (o, s) => ({ got: { mithril: mithril(o, hero(s)) }, want: { mithril: 1 } }),
  },
  {
    name: 'a Dwarf of a realm of men, and a man of a Dwarven realm, are not; a mithril suit the Dwarf carried is taken',
    stage: (b) => {
      realm(b, 1)['race'] = 'Dwarven';
      const d = realmHero(b, 0, { race: 'Dwarven' });
      d.items = [{ name: 'Mithril Armour', effect: { stat: 'mithrilArmour', val: 3 }, id: 77 }];
      return { hero: d, others: [realmHero(b, 1, { race: 'Human' })] };
    },
    check: (o, s) => ({
      got: { dwarf: mithril(o, hero(s)), man: mithril(o, other(s, 0)) },
      want: { dwarf: 0, man: 0 },
    }),
  },
  {
    name: 'an old world’s lairs are renamed once, the world told how many',
    stage: (b) => {
      delete raw(b)['_lairNamesV3'];
      return { board: b };
    },
    check: (o, s) => ({
      got: {
        told: told(o, renamed(lairs(board_(s)).length)),
        flag: rawOf(o.first)['_lairNamesV3'] ?? false,
      },
      want: {
        told: [{ type: 'system', actor: null, targets: [], public: false, system: false, phase: null, charId: null }],
        flag: true,
      },
    }),
  },
  {
    name: 'one lair renamed is told as one',
    stage: (b) => {
      delete raw(b)['_lairNamesV3'];
      onlyLairs(b, lair(b, 10));
      return {};
    },
    check: (o) => ({ got: { told: told(o, renamed(1)).length }, want: { told: 1 } }),
  },
  {
    name: 'an old world with no lair to rename is not told of it',
    stage: (b) => {
      delete raw(b)['_lairNamesV3'];
      onlyLairs(b);
      return {};
    },
    check: (o) => ({
      got: { lines: starting(o, '\u{1F5FA} '), flag: rawOf(o.first)['_lairNamesV3'] ?? false },
      want: { lines: [], flag: true },
    }),
  },
  {
    name: 'a world whose lairs were renamed is not renamed again',
    stage: (b) => {
      const f = lair(b, 10);
      f['name'] = 'Kept Name';
      return { there: b.X };
    },
    check: (o, s) => ({
      got: {
        lines: starting(o, '\u{1F5FA} '),
        names: ((must(o.first.world.provinces[there(s).id], 'province')['features'] as Raw[] | undefined) ?? []).map(
          (f) => f['name'],
        ),
      },
      want: { lines: [], names: ['Kept Name'] },
    }),
  },
  {
    name: 'an old world’s guardians are made 5 HP frailer once, their undamaged HP too, the world told how many',
    stage: (b) => {
      delete raw(b)['_guardianHpV2'];
      lair(b, 12, 14);
      return { there: b.X, board: b };
    },
    check: (o, s) => {
      const n = lairs(board_(s)).filter((f) => (f['monster'] as Raw)['hp'] != null).length;
      const m = featuresIn(o, there(s))[0] ?? {};
      return {
        got: {
          hp: [m['hp'], m['_hpFull']],
          told: told(o, remeasured(n)),
          flag: rawOf(o.first)['_guardianHpV2'] ?? false,
        },
        want: {
          hp: [7, 9],
          told: [{ type: 'system', actor: null, targets: [], public: false, system: false, phase: null, charId: null }],
          flag: true,
        },
      };
    },
  },
  {
    name: 'a guardian is never made frailer than 5 HP',
    stage: (b) => {
      delete raw(b)['_guardianHpV2'];
      onlyLairs(b, lair(b, 7, 8));
      return { there: b.X };
    },
    check: (o, s) => {
      const m = featuresIn(o, there(s))[0] ?? {};
      return {
        got: { hp: [m['hp'], m['_hpFull']], told: told(o, remeasured(1)).length },
        want: { hp: [5, 5], told: 1 },
      };
    },
  },
  {
    name: 'a guardian of no recorded HP is not counted, but its undamaged HP is still made frailer',
    stage: (b) => {
      delete raw(b)['_guardianHpV2'];
      onlyLairs(b, lair(b, null, 20), lair(b, 15, null));
      return { there: b.X };
    },
    check: (o, s) => {
      const [a, c] = featuresIn(o, there(s));
      return {
        got: {
          first: [a?.['hp'] ?? null, a?.['_hpFull'] ?? null],
          second: [c?.['hp'], c?.['_hpFull'] ?? null],
          told: told(o, remeasured(1)).length,
        },
        want: { first: [null, 15], second: [10, null], told: 1 },
      };
    },
  },
  {
    name: 'a ritual site’s keeper is left as it is',
    stage: (b) => {
      delete raw(b)['_guardianHpV2'];
      onlyLairs(b);
      b.X['features'] = [{ ritualSite: true, name: 'Old Stones', monster: { name: 'Warden', hp: 20, _hpFull: 20 } }];
      return { there: b.X };
    },
    check: (o, s) => {
      const m = featuresIn(o, there(s))[0] ?? {};
      return {
        got: {
          hp: [m['hp'], m['_hpFull']],
          lines: starting(o, '\u{1F489} '),
          flag: rawOf(o.first)['_guardianHpV2'] ?? false,
        },
        want: { hp: [20, 20], lines: [], flag: true },
      };
    },
  },
  {
    name: 'a world whose guardians were re-measured is not re-measured again',
    stage: (b) => {
      lair(b, 12, 12);
      return { there: b.X };
    },
    check: (o, s) => {
      const m = featuresIn(o, there(s))[0] ?? {};
      return {
        got: { hp: [m['hp'], m['_hpFull']], lines: starting(o, '\u{1F489} ') },
        want: { hp: [12, 12], lines: [] },
      };
    },
  },
  {
    name: 'the Library, retired from the game, is struck from a realm that found it; its other discoveries kept',
    stage: (b) => {
      realm(b, 2)['discoveries'] = [
        { id: 'sd30', name: 'The Library' },
        { id: 'sd03' },
        null,
        { id: 'sd30' },
        { id: 'sd04' },
      ];
      return {};
    },
    check: (o) => ({
      got: { found: ((realmIn(o.first, 2)['discoveries'] as Raw[] | undefined) ?? []).map((d) => d['id']) },
      want: { found: ['sd03', 'sd04'] },
    }),
  },
  {
    name: 'a Divine realm with its Grand Cathedral standing in ground it holds wards that province for the turn',
    stage: (b) => {
      realm(b, 0)['discoveries'] = [{ id: 'gd' }];
      realm(b, 0)['gdProvinceId'] = seatOf(b, 0).id;
      return { there: seatOf(b, 0) };
    },
    check: (o, s) => ({ got: wardOf(o, there(s)), want: { turn: o.turn, by: 0, pct: 100 } }),
  },
  {
    name: 'a Cathedral raised before Wonders were sited wards the realm’s home',
    stage: (b) => {
      realm(b, 1)['discoveries'] = [{ id: 'gd' }];
      delete realm(b, 1)['gdProvinceId'];
      return { there: seatOf(b, 1) };
    },
    check: (o, s) => ({ got: wardOf(o, there(s)), want: { turn: o.turn, by: 1, pct: 100 } }),
  },
  {
    name: 'a Cathedral in ground the realm has lost wards nothing',
    stage: (b) => {
      realm(b, 0)['discoveries'] = [{ id: 'gd' }];
      realm(b, 0)['gdProvinceId'] = seatOf(b, 1).id;
      return { there: seatOf(b, 1), places: [seatOf(b, 0)] };
    },
    check: (o, s) => ({
      got: { lost: wardOf(o, there(s)), home: wardOf(o, must(s.places?.[0], 'home')) },
      want: { lost: NO_WARD, home: NO_WARD },
    }),
  },
  {
    name: 'a realm not of the Divine creed raises no Cathedral’s ward',
    stage: (b) => {
      creed(b, 2, 'Good');
      realm(b, 2)['discoveries'] = [{ id: 'gd' }];
      realm(b, 2)['gdProvinceId'] = seatOf(b, 2).id;
      return { there: seatOf(b, 2) };
    },
    check: (o, s) => ({ got: wardOf(o, there(s)), want: NO_WARD }),
  },
  {
    name: 'a Divine realm without the Grand Design raises no ward',
    stage: (b) => ({ there: seatOf(b, 0) }),
    check: (o, s) => ({ got: wardOf(o, there(s)), want: NO_WARD }),
  },
];

// ── 4. The default to Defend, the record of orders, the war fronts at the start ──────────────────────────────────
const STAND = ['ME', 'ME', 'DE', 'ME', 'FL', 'ME', 'ME', 'DE', 'ME', 'ME', 'ME', 'ME', 'DE', 'FL'];
export const DEFEND_CASES: BeforeCase[] = [
  {
    name: 'a living hero of a realm that sent no orders Defends in every phase',
    stage: (b) => ({ hero: realmHero(b, 1), slots: { 1: { orders: null } } }),
    check: (o, s) => ({ got: { orders: ordersOf(o.first, hero(s)) }, want: { orders: DEFENDS } }),
  },
  {
    name: 'a phase sent empty is Defend; the phases sent are kept',
    stage: (b) => {
      const h = realmHero(b, 0);
      return { hero: h, sends: { 0: { orders: { [h.id]: [null, order('rest'), null, order('rest'), null] } } } };
    },
    check: (o, s) => ({
      got: { orders: ordersOf(o.first, hero(s)) },
      want: { orders: ['defend: Defend', 'rest', 'defend: Defend', 'rest', 'defend: Defend'] },
    }),
  },
  {
    name: 'a Defend filled in has no target or detail, and says Defend',
    stage: (b) => ({ hero: realmHero(b, 2), slots: { 2: { orders: null } } }),
    check: (o, s) => {
      const os = (o.first.turnOrders as unknown as Record<string, Raw[]>)[String(hero(s).id)] ?? [];
      return {
        got: { first: os[0] ?? null },
        want: { first: { action: 'defend', target: '', extra: '', desc: 'Defend' } },
      };
    },
  },
  {
    name: 'a hero sent his orders keeps them all',
    stage: (b) => ({ hero: realmHero(b, 0) }),
    check: (o, s) => ({ got: { orders: ordersOf(o.first, hero(s)) }, want: { orders: RESTS } }),
  },
  {
    name: 'a wandering hero and a fallen hero of a realm are given no orders',
    stage: (b) => ({ hero: wanderer(b), others: [realmHero(b, 1, { alive: false })], slots: { 1: { orders: null } } }),
    check: (o, s) => ({
      got: { wanderer: ordersOf(o.first, hero(s)), fallen: ordersOf(o.first, other(s, 0)) },
      want: { wanderer: null, fallen: null },
    }),
  },
  {
    name: 'every living realm hero has five orders as the first phase begins, whether his realm sent them or not',
    stage: (b) => ({ others: [realmHero(b, 0), realmHero(b, 2)], slots: { 2: { orders: null } } }),
    check: (o) => ({
      got: {
        lengths: o.first.characters
          .filter((c) => c.alive && c.player != null)
          .map((c) => (ordersOf(o.first, c) ?? []).filter((x) => x !== null).length),
      },
      want: { lengths: o.first.characters.filter((c) => c.alive && c.player != null).map(() => 5) },
    }),
  },
  {
    name: 'a hero sent fewer than five orders keeps only those: no Defend is added for the phases not sent',
    stage: (b) => {
      const h = realmHero(b, 0);
      return { hero: h, sends: { 0: { orders: { [h.id]: [order('rest'), null] } } } };
    },
    check: (o, s) => ({ got: { orders: ordersOf(o.first, hero(s)) }, want: { orders: ['rest', 'defend: Defend'] } }),
  },
  {
    name: 'a bot realm’s heroes have five orders each as the first phase begins: what the bots planned, Defend for the rest',
    wholeTurnOnly: true,
    stage: (b) => ({ hero: realmHero(b, 2), bots: [2] }),
    check: (o, s) => ({
      got: { n: (ordersOf(o.first, hero(s)) ?? []).filter((x) => x !== null).length },
      want: { n: 5 },
    }),
  },
];

const phasesOf = (r: Raw, c: Character) =>
  (((r['chars'] as Record<string, Raw> | undefined)?.[String(c.id)]?.['ph'] as Raw[] | undefined) ?? []).map(
    (x) => x['a'],
  );
export const RECORD_CASES: BeforeCase[] = [
  {
    name: 'the record of a realm’s orders shows each living hero’s five orders, empty phases as Defend',
    stage: (b) => {
      const h = realmHero(b, 1);
      return { hero: h, sends: { 1: { orders: { [h.id]: [order('move', 3), null, order('rest')] } } } };
    },
    check: (o, s) => ({
      got: { ph: phasesOf(recordOf(o, 1), hero(s)) },
      want: { ph: ['move', 'defend', 'rest', 'defend', 'defend'] },
    }),
  },
  {
    name: 'the record shows a realm’s declarations and its call for the Reckoning',
    stage: () => sending({ 2: { diplomacy: { 1: 'enemy' }, callReckoning: true } }),
    check: (o) => {
      const r = recordOf(o, 2);
      return {
        got: { diplomacy: r['diplomacy'] ?? null, call: r['callReckoning'] ?? null },
        want: { diplomacy: { 1: 'enemy' }, call: true },
      };
    },
  },
  {
    name: 'a realm that declared nothing and called nothing has neither in the record',
    stage: () => sending({ 1: { diplomacy: {} } }),
    check: (o) => {
      const r = recordOf(o, 1);
      return {
        got: { diplomacy: r['diplomacy'] ?? null, call: r['callReckoning'] ?? null, concede: r['concede'] ?? null },
        want: { diplomacy: null, call: null, concede: null },
      };
    },
  },
  {
    name: 'a realm that conceded this turn is recorded so; one that conceded before is not',
    stage: (b) => {
      Object.assign(realm(b, 2), { conceded: true, concededTurn: b.G.turn - 1 });
      return sending({ 1: { concede: true } });
    },
    check: (o) => ({
      got: { now: recordOf(o, 1)['concede'] ?? null, before: recordOf(o, 2)['concede'] ?? null },
      want: { now: true, before: null },
    }),
  },
  {
    name: 'the record keeps each living hero’s encounter plan, its first twelve tactics',
    stage: (b) => {
      const h = realmHero(b, 0);
      h['encounterPlan'] = { tactics: STAND, notes: '' };
      return { hero: h };
    },
    check: (o, s) => ({
      got: { plan: (recordOf(o, 0)['plans'] as Raw | undefined)?.[String(hero(s).id)] ?? null },
      want: { plan: STAND.slice(0, 12) },
    }),
  },
  {
    name: 'no plan is recorded for a fallen hero, a hero of another realm, or a plan with no tactics list',
    stage: (b) => {
      const f = realmHero(b, 0, { alive: false, encounterPlan: { tactics: ['ME'] } });
      const n = realmHero(b, 0, { encounterPlan: { tactics: 'ME' } });
      const x = realmHero(b, 1, { encounterPlan: { tactics: ['DE'] } });
      return { others: [f, n, x] };
    },
    check: (o, s) => ({
      got: {
        zero: recordOf(o, 0)['plans'] ?? null,
        one: Object.keys((recordOf(o, 1)['plans'] as Raw | undefined) ?? {}),
      },
      want: { zero: null, one: [String(other(s, 2).id)] },
    }),
  },
  {
    name: 'the record is made once, before the first phase: a hero who leaves his realm in Spring is still in its record, with his orders',
    stage: (b) => {
      const h = realmHero(b, 1);
      return { hero: h, orders: [[h, plan(order('release'))]] };
    },
    check: (o, s) => ({
      got: { ph: phasesOf(recordOf(o, 1), hero(s)) },
      want: { ph: ['release', 'rest', 'rest', 'rest', 'rest'] },
    }),
  },
  {
    name: 'every realm has its record',
    stage: () => ({}),
    check: (o) => ({ got: { realms: Object.keys(o.record).sort() }, want: { realms: ['0', '1', '2'] } }),
  },
];

export const WAR_FRONT_CASES: BeforeCase[] = [
  {
    name: 'two hosts of realms at war on the same ground as the turn begins both stand on a war front',
    stage: (b) => ({ hero: host(b, 0, b.X), others: [host(b, 1, b.X)], there: b.X }),
    check: (o, s) => ({
      got: { at: o.ctx.warFrontAt.sort(), provs: o.ctx.warFrontProvs },
      want: {
        at: [
          [hero(s).id, there(s).id],
          [other(s, 0).id, there(s).id],
        ].sort(),
        provs: [there(s).id],
      },
    }),
  },
  {
    name: 'a host on the land of a realm it is at war with stands on a war front, alone',
    stage: (b) => ({ hero: host(b, 0, seatOf(b, 1)), there: seatOf(b, 1) }),
    check: (o, s) => ({
      got: { at: o.ctx.warFrontAt, provs: o.ctx.warFrontProvs },
      want: { at: [[hero(s).id, there(s).id]], provs: [there(s).id] },
    }),
  },
  {
    name: 'ground fought over and still unresolved from last turn is no war front',
    stage: (b) => {
      b.X._battleUnresolved = true;
      return { hero: host(b, 0, b.X), others: [host(b, 1, b.X)] };
    },
    check: (o) => ({ got: { at: o.ctx.warFrontAt, provs: o.ctx.warFrontProvs }, want: { at: [], provs: [] } }),
  },
  {
    name: 'allies’ hosts side by side, and a lone hero with no companies, stand on no war front',
    stage: (b) => ({ others: [host(b, 0, b.X), host(b, 2, b.X), realmHero(b, 1)] }),
    check: (o) => ({ got: { at: o.ctx.warFrontAt, provs: o.ctx.warFrontProvs }, want: { at: [], provs: [] } }),
  },
  {
    name: 'hosts on two fronts: each province listed once',
    stage: (b) => {
      const p = must(b.ring1[0], 'a neighbour');
      return {
        others: [host(b, 0, b.X), host(b, 1, b.X), host(b, 1, p), host(b, 0, p)],
        places: [b.X, p],
      };
    },
    check: (o, s) => ({
      got: { provs: [...o.ctx.warFrontProvs].sort((x, y) => x - y), hosts: o.ctx.warFrontAt.length },
      want: { provs: (s.places ?? []).map((p) => p.id).sort((x, y) => x - y), hosts: 4 },
    }),
  },
  {
    name: 'nobody on a war front: none listed',
    stage: () => ({}),
    check: (o) => ({ got: { at: o.ctx.warFrontAt, provs: o.ctx.warFrontProvs }, want: { at: [], provs: [] } }),
  },
];

// ── The order of it all ──────────────────────────────────────────────────────────────────────────────────────────
export const ORDER_CASES: BeforeCase[] = [
  {
    name: 'the research lines come before war without warning, which comes before the Safe Start’s, the stale orders’, the GM’s removals and the messages',
    stage: (b) => {
      creed(b, 1, 'Evil');
      safeStart(b);
      relate(b, { '0-1': 'enemy', '0-2': 'allied' });
      choices(b, 0, ['k', ['sd03']]);
      raw(b)['_gmRemovedRealms'] = [2];
      return {
        ...sending({
          0: { diplomacy: { 1: 'treat' }, messages: [{ to: [2], text: 'Last.' }] },
          2: { forTurn: b.G.turn + 1 },
        }),
        board: b,
      };
    },
    check: (o) => {
      const kinds = o.all
        .map((l) =>
          l.text.startsWith('💡 ')
            ? 'research'
            : l.text === SAFE_START_LINE
              ? 'safe start'
              : l.text.startsWith('⚠ Ignoring stale')
                ? 'stale'
                : l.text.includes('has withdrawn')
                  ? 'removed'
                  : l.type === 'message'
                    ? 'message'
                    : null,
        )
        .filter((k) => k);
      return {
        got: { kinds: kinds.filter((k, i) => k !== kinds[i - 1]) },
        want: { kinds: ['research', 'safe start', 'stale', 'removed', 'message'] },
      };
    },
  },
  {
    name: 'an Evil realm’s war without warning is told before its messages',
    stage: (b) => {
      creed(b, 2, 'Evil');
      return sending({ 2: { diplomacy: { 1: 'enemy' }, messages: [{ to: [1], text: 'Kneel.' }] } });
    },
    check: (o) => {
      const at_ = (p: (l: Line) => boolean) => o.all.findIndex(p);
      const war = at_((l) => l.text.includes('without warning'));
      const msg = at_((l) => l.type === 'message');
      return { got: { order: war >= 0 && msg > war }, want: { order: true } };
    },
  },
  {
    name: 'a lead settled is the realm’s before the bots plan and before the first phase',
    stage: (b) => {
      choices(b, 0, ['k', ['sd05']]);
      return {};
    },
    check: (o) => ({ got: { found: found(o, 0).map(([id]) => id) }, want: { found: ['sd05'] } }),
  },
];

/** Every case, by part of the four stages. */
export const BEFORE_CASES: [string, BeforeCase[]][] = [
  ['the relations and last turn’s research choices', RESEARCH_CASES],
  ['war without warning', WAR_CASES],
  ['the titles held going into the turn', TITLE_CASES],
  ['the Safe Start’s and the stale orders’ lines', SAFE_START_AND_STALE_CASES],
  ['the realms the GM removed', GM_REMOVAL_CASES],
  ['messages', MESSAGE_CASES],
  ['the move pools', POOL_CASES],
  ['the turn’s trackers and what lasts a turn', TRACKER_CASES],
  ['the save’s sweeps', SWEEP_CASES],
  ['the default to Defend', DEFEND_CASES],
  ['the turn’s record of orders', RECORD_CASES],
  ['the war fronts at the start', WAR_FRONT_CASES],
  ['the order of it all', ORDER_CASES],
];
export type { Order };
