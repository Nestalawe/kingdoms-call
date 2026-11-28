// R-043 (B-17f): a bot plans from what a player in its seat could know, so one thing its realm can't see, changed,
// leaves its plan as it was. In whole all-bot games, at each turn from FIRST_TURN, for each bot realm: its diplomacy and
// its plan are run on a copy of the turn as it stands when each runs (the bot realm alone, every die pinned, the same
// dice for both), then again on a copy with one thing outside its realm's view changed (a variation); the realm's
// declarations, its heroes' orders and fight plans, its Reckoning call and its concession must come out the same.
// The game itself plays on as it would without the test (the copies are thrown away, their dice drawn apart).
// What the realm may see is playerView (src/views/what-each-realm-may-see-of-the-world.ts) on the world as its last
// report read it (each Invisibility stamped for the report's turn, as the turn's end stamps it). Out of sight: a
// province none of its sight rules shows and it holds no memory of, and a hero of another realm standing there whom it
// neither sees nor remembers.
// The passes covered: the bots' diplomacy (before the plan, in the turn), then every pass of the plan in its order
// (the concessions, the movement, the muster, the economy, the actions, Spring's orders, the order hygiene and the
// Reckoning's call), each realm planned alone so that no realm's orders of the same turn feed another's.
// The known list (THE_ROWS_WHOSE_VARIATIONS_STILL_CHANGE_A_PLAN): the variations that still change a plan today, each
// under the row that fixes it (B-17g to k). A listed row's variations must still change some plan (once its fix makes
// them hold, its row empties the entry); every other variation must change none. The list only shrinks: a static case
// below holds it to the five rows.
// Level 3 (simulation): whole bot games on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts's
// play()), the diplomacy and the plan stood in on their modules (vi.spyOn) to run the copies first. A lower level
// can't reach it: what the bots read is spread over every pass, on worlds a game makes, and a staged world holds none
// of the memory and history a realm's view and its plan read.
import { describe, expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules, type World } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';
import { THE_DIPLOMACY_LADDER } from '../../src/content/the-diplomacy-ladder-a-mutual-treats-step-a-wars-step-the-overtures-kind-and-the-small-games-alliance-limit.ts';

const GAMES = 2;
const TURNS = 12;
const FIRST_TURN = 3;
const REALMS = 5;
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** The rows that fix a read beyond a realm's view (the backlog's B-17 group: Run B). */
type AFixRow = 'B-17g' | 'B-17h' | 'B-17i' | 'B-17j' | 'B-17k';
const THE_FIX_ROWS: readonly AFixRow[] = ['B-17g', 'B-17h', 'B-17i', 'B-17j', 'B-17k'];

/** The known list: the rows whose variations still change a bot's plan today. Each fix row empties its own entry. */
const THE_ROWS_WHOSE_VARIATIONS_STILL_CHANGE_A_PLAN: readonly AFixRow[] = ['B-17g', 'B-17h', 'B-17i', 'B-17j', 'B-17k'];

type Raw = Record<string, unknown>;
interface Hero extends Raw {
  id: number;
  player: number | null;
  alive: boolean;
  location: number;
  armies?: Raw[];
  skills?: Record<string, number>;
  hp?: number;
  _invisTurn?: number;
  _unspottedTurn?: number;
}
interface Province extends Raw {
  id: number;
  owner: number | null;
  terrain: string;
  characters?: number[];
}
interface Realm extends Raw {
  gold: number;
  eliminated?: boolean;
  discoveries?: Raw[];
}
interface State extends Raw {
  turn: number;
  players: Realm[];
  characters: Hero[];
  relations: Record<string, string>;
  world: { provinces: Province[] };
  turnOrders: Record<string, unknown>;
}
interface Context extends Raw {
  G: State;
  _botPlayerIdx: Set<number>;
  diploDeclarations: Record<number, Record<number, string> | undefined>;
  reckoningCalls: Set<number>;
}

/** What a realm may see, as the variations read it. */
interface WhatTheRealmSees {
  realm: number;
  /** The provinces none of its sight rules shows and it holds no memory of. */
  dark: ReadonlySet<number>;
  /** The heroes it sees now (on its map, beside its own, by Clairvoyance). */
  heroesItSeesNow: ReadonlySet<number>;
  /** The heroes it sees or remembers. */
  heroesItKnows: ReadonlySet<number>;
}

/** One thing changed outside a realm's view: its neutral name, the fix row that would make it hold (if it is one of
 *  theirs), and the change on a copy of the turn (false: nothing out of sight to change). */
interface AVariation {
  name: string;
  row?: AFixRow;
  /** 'diplomacy': changed before the bots' diplomacy runs; 'plan': before the plan runs. */
  at: 'diplomacy' | 'plan';
  /** A change made to both copies first (false: nothing to stage), so the variation is the only difference. */
  stage?: (tc: Context, sees: WhatTheRealmSees) => boolean;
  apply: (tc: Context, sees: WhatTheRealmSees) => boolean;
}

/** The first hero of another realm, alive, out of sight in the dark (none: undefined). */
const aHeroOutOfSight = (G: State, s: WhatTheRealmSees, armed: boolean) =>
  G.characters.find(
    (c) =>
      c.alive &&
      c.player != null &&
      c.player !== s.realm &&
      s.dark.has(c.location) &&
      !s.heroesItKnows.has(c.id) &&
      (!armed || (c.armies ?? []).length > 0),
  );
/** A dark province other than `from`, the last in the world's order. */
const anotherDarkProvince = (G: State, s: WhatTheRealmSees, from: number) =>
  [...G.world.provinces].reverse().find((p) => p.id !== from && s.dark.has(p.id));
const moveTheHero = (G: State, c: Hero, to: Province) => {
  for (const p of G.world.provinces) if (p.characters) p.characters = p.characters.filter((id) => id !== c.id);
  c.location = to.id;
  to.characters = [...(to.characters ?? []), c.id];
};
/** Another realm at war with realm `r` (none: -1). */
const aRealmAtWarWith = (G: State, r: number) =>
  G.players.findIndex(
    (p, j) =>
      j !== r && !p.eliminated && G.relations[`${String(Math.min(r, j))}-${String(Math.max(r, j))}`] === 'enemy',
  );
/** Each other realm at war with realm `r` (atWar) or not at war with it declares `what` to it (none: false). */
const theDeclarationsOfTheOtherRealms = (tc: Context, s: WhatTheRealmSees, atWar: boolean, what: string) => {
  let any = false;
  tc.G.players.forEach((p, j) => {
    const key = `${String(Math.min(s.realm, j))}-${String(Math.max(s.realm, j))}`;
    if (j === s.realm || p.eliminated || (tc.G.relations[key] === 'enemy') !== atWar) return;
    tc.diploDeclarations[j] = { ...tc.diploDeclarations[j], [s.realm]: what };
    any = true;
  });
  return any;
};
/** A hero of another realm it remembers but doesn't see now (none: undefined). */
const aHeroItRemembers = (G: State, s: WhatTheRealmSees) =>
  G.characters.find(
    (h) =>
      h.alive && h.player != null && h.player !== s.realm && s.heroesItKnows.has(h.id) && !s.heroesItSeesNow.has(h.id),
  );
/** The relations of every two other realms, turned about (none: false). */
const theRelationsOfTwoOtherRealmsTurned = ({ G }: Context, s: WhatTheRealmSees) => {
  let any = false;
  for (const key of Object.keys(G.relations)) {
    const [a, b] = key.split('-').map(Number);
    if (a === s.realm || b === s.realm) continue;
    G.relations[key] = G.relations[key] === 'enemy' ? 'allied' : 'enemy';
    any = true;
  }
  return any;
};
/** The hero the B-17g variation moves, by realm (set by its stage). */
const theHeroStaged = new Map<number, number>();

const VARIATIONS: readonly AVariation[] = [
  {
    name: 'a hero of another realm out of sight, moved elsewhere out of sight',
    at: 'plan',
    apply: ({ G }, s) => {
      const c = aHeroOutOfSight(G, s, false);
      const to = c && anotherDarkProvince(G, s, c.location);
      if (!c || !to) return false;
      moveTheHero(G, c, to);
      return true;
    },
  },
  {
    name: 'an army of another realm out of sight, its companies doubled',
    at: 'plan',
    apply: ({ G }, s) => {
      const c = aHeroOutOfSight(G, s, true);
      if (!c?.armies) return false;
      c.armies = [...c.armies, ...c.armies.map((a, i) => ({ ...a, id: `${String(a['id'])}-${String(i)}` }))];
      return true;
    },
  },
  {
    name: 'B-17g (1)',
    row: 'B-17g',
    at: 'plan',
    stage: ({ G }, s) => {
      const c = G.characters.find(
        (h) => h.alive && h.player != null && h.player !== s.realm && s.heroesItSeesNow.has(h.id),
      );
      if (!c) return false;
      c.armies = [];
      c._invisTurn = G.turn - 1;
      theHeroStaged.set(s.realm, c.id);
      return true;
    },
    apply: ({ G }, s) => {
      const c = G.characters.find((h) => h.id === theHeroStaged.get(s.realm));
      const to = c && anotherDarkProvince(G, s, c.location);
      if (!c || !to) return false;
      moveTheHero(G, c, to);
      return true;
    },
  },
  {
    name: 'B-17h (1)',
    row: 'B-17h',
    at: 'diplomacy',
    apply: (tc, s) => theDeclarationsOfTheOtherRealms(tc, s, true, 'treat'),
  },
  {
    name: 'B-17h (2)',
    row: 'B-17h',
    at: 'diplomacy',
    apply: (tc, s) => theDeclarationsOfTheOtherRealms(tc, s, false, THE_DIPLOMACY_LADDER.aWarIsDeclaredAs),
  },
  {
    name: 'B-17i (1)',
    row: 'B-17i',
    at: 'plan',
    apply: ({ G }, s) => {
      let any = false;
      G.players.forEach((p, j) => {
        if (j === s.realm) return;
        p.gold = p.gold * 10 + 500;
        any = true;
      });
      return any;
    },
  },
  {
    name: 'B-17i (2)',
    row: 'B-17i',
    at: 'plan',
    apply: ({ G }, s) => {
      let any = false;
      for (const c of G.characters)
        if (c.alive && c.player != null && c.player !== s.realm && c.skills) {
          c.skills = Object.fromEntries(Object.entries(c.skills).map(([k, v]) => [k, v + 4]));
          any = true;
        }
      return any;
    },
  },
  {
    name: 'B-17j (1)',
    row: 'B-17j',
    at: 'plan',
    apply: ({ G }, s) => {
      let any = false;
      for (const p of G.world.provinces)
        if (s.dark.has(p.id) && p.terrain !== 'sea') {
          p.terrain = 'mountains';
          any = true;
        }
      return any;
    },
  },
  {
    name: 'B-17j (2)',
    row: 'B-17j',
    at: 'plan',
    apply: ({ G }, s) => {
      const j = aRealmAtWarWith(G, s.realm);
      let any = false;
      for (const p of G.world.provinces)
        if (s.dark.has(p.id) && p.terrain !== 'sea') {
          p.owner = j < 0 ? null : j;
          any = true;
        }
      return any;
    },
  },
  { name: 'B-17k (1)', row: 'B-17k', at: 'diplomacy', apply: theRelationsOfTwoOtherRealmsTurned },
  { name: 'B-17k (2)', row: 'B-17k', at: 'plan', apply: theRelationsOfTwoOtherRealmsTurned },
  {
    name: 'B-17k (3)',
    row: 'B-17k',
    at: 'plan',
    apply: ({ G }, s) => {
      const c = aHeroItRemembers(G, s);
      if (!c) return false;
      c.armies = [];
      c.hp = 1;
      return true;
    },
  },
  {
    name: 'B-17k (4)',
    row: 'B-17k',
    at: 'plan',
    apply: ({ G }, s) => {
      const c = aHeroItRemembers(G, s);
      if (!c) return false;
      c.alive = false;
      return true;
    },
  },
];

/** What a realm's diplomacy and plan hand the turn: its declarations, its heroes' orders and fight plans, its call and
 *  its concession. */
const whatTheRealmPlanned = (tc: Context, r: number): string =>
  JSON.stringify({
    declarations: tc.diploDeclarations[r] ?? null,
    grudges: tc.G.players[r]?.['botGrudges'] ?? null,
    orders: tc.G.characters
      .filter((c) => c.player === r)
      .map((c) => [c.id, tc.G.turnOrders[c.id] ?? null, c['encounterPlan'] ?? null]),
    calls: tc.reckoningCalls.has(r),
    conceded: tc.G.players[r]?.['conceded'] ?? null,
  });

describe("R-043: a bot plans the same orders whatever its realm can't see", () => {
  test('the known list holds only the rows that fix a read beyond the view, each once (it only shrinks)', () => {
    expect(
      THE_ROWS_WHOSE_VARIATIONS_STILL_CHANGE_A_PLAN.length,
      'the known list has at most the five rows',
    ).toBeLessThanOrEqual(5);
    expect(
      THE_ROWS_WHOSE_VARIATIONS_STILL_CHANGE_A_PLAN.filter((r) => !THE_FIX_ROWS.includes(r)),
      'entries that are not a fix row',
    ).toEqual([]);
    expect(new Set(THE_ROWS_WHOSE_VARIATIONS_STILL_CHANGE_A_PLAN).size, 'each row once').toBe(
      THE_ROWS_WHOSE_VARIATIONS_STILL_CHANGE_A_PLAN.length,
    );
    expect(
      THE_FIX_ROWS.filter((r) => !VARIATIONS.some((v) => v.row === r)),
      'each fix row has a variation',
    ).toEqual([]);
  });

  test(
    "in whole bot games, one thing a bot realm can't see, changed, changes none of its plan (but the known list's)",
    async () => {
      const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
      const { kcRng, kcRngStream } = await import('../../src/engine/rng.ts');
      const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
      const { theHerosInvisibilityHidesHimNow } =
        await import('../../src/engine/rules-on-plain-values/whether-a-heros-invisibility-hides-him-now.ts');
      const thePlan =
        await import('../../src/engine/bots/bot-realms-plan-the-turn-concessions-movement-muster-economy-actions-hygiene-the-reckoning-and-the-duel-forecast.ts');
      const theDiplomacy =
        await import('../../src/engine/bots/bot-diplomacy-treats-and-wars-by-alignment-the-grudge-and-a-reckoning-claim.ts');
      const { generateBotSetups } = await import('../../src/engine/bots/setup.ts');
      const { generateNewGame } = await import('../../src/engine/world/generate.ts');
      const plan =
        thePlan.botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning;
      const diplomacy = theDiplomacy.botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim;
      type Pass = (tc: Context) => void;
      const run = (pass: Pass, tc: Context, r: number, ...changes: ((copy: Context) => boolean)[]): string | null => {
        const copy = structuredClone(tc);
        copy._botPlayerIdx = new Set([r]);
        for (const change of changes) if (!change(copy)) return null;
        const was = kcRng.use(kcRngStream(SEED * 7919 + tc.G.turn * 31 + r));
        try {
          pass(copy);
        } finally {
          kcRng.use(was);
        }
        return whatTheRealmPlanned(copy, r);
      };
      /** What realm `r` may see of `G`: its view of the world as its last report read it. */
      const whatItSees = (G: State, r: number): WhatTheRealmSees => {
        const theView = (state: State) => playerView(structuredClone(state) as never, r);
        const asItsReportRead = structuredClone(G);
        for (const c of asItsReportRead.characters)
          if (c.alive && c._invisTurn === G.turn - 1) {
            c._invisTurn = G.turn;
            if (theHerosInvisibilityHidesHimNow(c, G.turn)) c._unspottedTurn = G.turn;
          }
        const seen = (v: ReturnType<typeof playerView>) =>
          new Set<number>(
            [
              ...v.heroesItSees.map((h) => h.id),
              ...v.heroesBesideItsOwn.map((h) => h.id),
              ...(v.watchedByClairvoyance ? [v.watchedByClairvoyance.hero.id] : []),
            ].map(Number),
          );
        const v = theView(asItsReportRead);
        const now = seen(v);
        const known = new Set<number>([...now, ...[...v.heroesItHasSeenAliveAndServingARealm].map(Number)]);
        const dark = new Set(
          v.provinces.filter((p) => p.remembered == null && !Object.values(p.seen).some(Boolean)).map((p) => p.id),
        );
        return {
          realm: r,
          dark,
          heroesItSeesNow: now,
          heroesItKnows: known,
        };
      };
      const changed = new Map<string, string[]>();
      const tried = new Map<string, number>();
      const compare = (pass: Pass, at: AVariation['at'], tc: Context) => {
        if (tc.G.turn < FIRST_TURN) return;
        for (const r of [...tc._botPlayerIdx].sort((a, b) => a - b)) {
          const first = run(pass, tc, r);
          const sees = whatItSees(tc.G, r);
          for (const v of VARIATIONS) {
            if (v.at !== at) continue;
            const stage = v.stage;
            const before = stage ? run(pass, tc, r, (copy) => stage(copy, sees)) : first;
            const again = stage
              ? run(
                  pass,
                  tc,
                  r,
                  (copy) => stage(copy, sees),
                  (copy) => v.apply(copy, sees),
                )
              : run(pass, tc, r, (copy) => v.apply(copy, sees));
            if (again == null || before == null) continue;
            tried.set(v.name, (tried.get(v.name) ?? 0) + 1);
            if (again !== before)
              changed.set(v.name, [...(changed.get(v.name) ?? []), `turn ${String(tc.G.turn)} realm ${String(r)}`]);
          }
        }
      };
      let diplomacyRanOn = -1;
      vi.spyOn(theDiplomacy, 'botDiplomacyTreatsAndWarsByAlignmentTheGrudgeAndAReckoningClaim').mockImplementation(
        (tc) => {
          const c = tc as unknown as Context;
          if (diplomacyRanOn !== c.G.turn) compare(diplomacy as unknown as Pass, 'diplomacy', c);
          diplomacyRanOn = c.G.turn;
          diplomacy(tc);
        },
      );
      vi.spyOn(
        thePlan,
        'botRealmsPlanTheTurnConcessionsMovementMusterEconomyActionsSpringOrdersHygieneAndTheReckoning',
      ).mockImplementation((tc) => {
        compare(plan as unknown as Pass, 'plan', tc as unknown as Context);
        plan(tc);
      });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        for (let g = 0; g < GAMES; g++) {
          const setup = generateBotSetups([], REALMS, 0).map((b) => ({
            ...b,
            gamePlayerId: 'gp' + String(b.id),
            name: b.kingdomName,
          }));
          const made = generateNewGame(setup, { cols: 14, rows: 9 }, 999, { seaPct: 30 + 10 * g }) as unknown as World;
          made['botDifficulty'] = 'hard';
          made['botDiplomacy'] = g % 2 ? 'hostile' : 'normal';
          made['turnMode'] = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
          const rows = setup.map((sp) => ({
            id: sp.gamePlayerId,
            user_id: null,
            player_index: sp.id,
            display_name: sp.name,
            orders: null,
            orders_submitted: false,
            turn_report: JSON.stringify({ isBot: true }),
          }));
          let state = JSON.stringify(made);
          for (let t = 1; t <= TURNS; t++) state = JSON.stringify(sc.play(state, rows).S2);
        }
      } finally {
        warn.mockRestore();
        vi.restoreAllMocks();
      }
      const summary = VARIATIONS.map((v) => ({
        variation: v.name,
        tried: tried.get(v.name) ?? 0,
        changed: (changed.get(v.name) ?? []).length,
        first: (changed.get(v.name) ?? [])[0] ?? null,
      }));
      const listed = (v: AVariation) => v.row != null && THE_ROWS_WHOSE_VARIATIONS_STILL_CHANGE_A_PLAN.includes(v.row);
      expect(
        summary.filter((s) => s.tried === 0).map((s) => s.variation),
        `the variations never tried (nothing out of sight to change): ${JSON.stringify(summary)}`,
      ).toEqual([]);
      expect(
        summary.filter((s, i) => s.changed > 0 && !listed(VARIATIONS[i] as AVariation)),
        "the variations that changed a bot's plan, outside the known list",
      ).toEqual([]);
      expect(
        THE_ROWS_WHOSE_VARIATIONS_STILL_CHANGE_A_PLAN.filter(
          (row) => !summary.some((s, i) => VARIATIONS[i]?.row === row && s.changed > 0),
        ),
        `the known list's rows none of whose variations changes a plan now (the row empties its entry): ${JSON.stringify(summary)}`,
      ).toEqual([]);
    },
    timeLimitForTheWork({ matrixGamesPlayed: GAMES * 4 }).timeout,
  );
});
