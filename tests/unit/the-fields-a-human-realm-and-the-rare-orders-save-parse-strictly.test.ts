// What a human realm's orders and the orders no bot gives write into the save, parsed strictly against the saved
// state's schema (plan P1-15b2; tests/lib/strict-schema.ts: a key the schema doesn't name fails, and so does a field it
// requires that the save lacks). The schema was written from the matrix's states, where every realm but the scripted
// one is a bot and the scripted one sends no encounter plans and only four kinds of order, so it didn't know these. On
// staging, two empty turns of a game with two human realms made P1-15d's check name every human hero's encounter plan
// (`characters.N.encounterPlan._botStance: missing`): the first cases are that turn, through the merge.
// - an encounter plan as the player portal sends it (src/ui/player/briefing-and-submit.ts, doSubmitOrders: tactics,
//   notes, a duel stance, and an Evil realm's conquest doctrine) and the merge keeps it (encounterPlanAsAPlanHasIt,
//   src/engine/turn/set-up-the-turns-start-repairs-and-the-merge-of-the-realms-orders.ts): one turn of the matrix's game
//   scripted-05 played by resolveTurn, its scripted realm sending the portal's untouched form; and a hired hero's plan
//   card, as applyPendingSynthPlan (src/engine/discoveries.ts) gives it to him;
// - every mastery order's once-a-turn stamp (the order dispatch stamps `_masteryOrderUsed` before the skill is
//   checked, so any hero who is given the order writes it), and a check that the schema names every key of
//   MASTERY_ORDER_KEYS, so a new mastery order can't slip past;
// - the rare orders' fields, each staged as its writer writes it (the writer's file named) on the matrix's own turn 1
//   of scripted-05, which parses strictly before anything is staged, so each case is red on its own field alone.
// Level 1 (unit): three turns by direct import and values parsed, about 2 s; a static test can't parse a save. Red on its
// base (P1-15c), where the schema names none of these.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// What a human realm's orders and the orders no bot gives write into the save, parsed strictly against the saved
// state's schema (`lib/strict-schema.ts`). The staging case first: one turn of `scripted-05` played by `resolveTurn`,
// its scripted realm sending the player portal's untouched form (every hero Defend, the default encounter plan), its
// realm Good and then Evil (the conquest doctrine, `evilMode`): every hero's plan as the merge keeps it, and the save
// parses strictly; a hero hired with a plan card (`applyPendingSynthPlan`). Then every key of `MASTERY_ORDER_KEYS`
// named by the schema, so a new mastery order can't slip past, and each one's once-a-turn stamp; and the rare orders'
// fields, each staged on the matrix's own turn (which parses strictly as it is) as its writer writes it: Release Hero's
// `_releasedBy` on the hero and his grave (`recordHeroGrave` called), a Moderate or Legendary lair cleared,
// Clairvoyance's and a wandering hero's spied entry, the Grand Design, a win by elimination, every realm conceded, a
// Wild Calling's beasts, a game without `botDiplomacy`. Red on its base (P1-15c: 27 of 35; the 7 mastery orders the
// bots give and the matrix's turn itself pass). Level 1: three turns by direct import and values parsed, about 2 s; a
// static test can't parse a save. TypeScript, in `unit/`
import { describe, expect, test } from 'vitest';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { resolveTurn } from '../../src/engine/run-turn.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { MASTERY_ORDER_KEYS } from '../../src/engine/army-tables.ts';
import { applyPendingSynthPlan } from '../../src/engine/discoveries.ts';
import { recordHeroGrave } from '../../src/engine/graves.ts';
import {
  CharacterSchema,
  GameStateSchema,
  type Character,
  type GameState,
} from '../../src/schemas/saved-game-state.ts';
import { MAP_SIZES, SCRIPTED_REALM } from '../../tools/balance/matrix.ts';
import { GAME, SETUPS, slotRowsJson } from '../lib/matrix-game.ts';
import { strictIssues } from '../lib/strict-schema.ts';

type Obj = Record<string, unknown>;
const copyOf = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const objectsIn = (o: Obj, key: string): Obj[] => {
  const v = o[key];
  return Array.isArray(v) ? v.filter((x): x is Obj => typeof x === 'object' && x !== null) : [];
};
const realmIndex = SCRIPTED_REALM;
const heroesOfTheRealm = (s: Obj): Obj[] =>
  objectsIn(s, 'characters').filter((c) => c['player'] === realmIndex && c['alive'] !== false);

/** scripted-05's new world, as the matrix makes it; its scripted realm of `alignment` if one is given. */
function newWorld(alignment?: string): Obj {
  const setups = copyOf(SETUPS);
  const realm = setups[realmIndex];
  if (!realm) throw new Error('scripted-05 has no scripted realm');
  if (alignment) realm.alignment = alignment;
  kcRng.seed(GAME.seed);
  const g = generateNewGame(setups, copyOf(MAP_SIZES[GAME.realms]), 0, { seaPct: GAME.seaPct }) as Obj;
  g['turnMode'] = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
  g['botDifficulty'] = 'hard';
  g['botDiplomacy'] = GAME.diplomacy;
  return g;
}

/** What the player portal sends for a turn its player leaves untouched (doSubmitOrders): every hero holds (Defend) in
 *  each of the five phases, and his encounter plan is the form's default, tactics ME, no notes, duel stance "refuse";
 *  an Evil realm's form adds the conquest doctrine, "terror" by default (a field left empty is undefined, which the
 *  JSON drops). */
function theUntouchedForm(world: Obj, turn: number): Obj {
  const evil = objectsIn(world, 'players')[realmIndex]?.['alignment'] === 'Evil';
  const heroes = heroesOfTheRealm(world);
  const orders: Obj = {};
  const encounterPlans: Obj = {};
  for (const c of heroes) {
    const id = String(c['id']);
    orders[id] = Array.from({ length: 5 }, () => ({ action: 'Defend', target: '', extra: '', desc: 'Defend' }));
    encounterPlans[id] = { tactics: ['ME'], notes: '', duelStance: 'refuse', evilMode: evil ? 'terror' : undefined };
  }
  return {
    orders,
    encounterPlans,
    kingSkills: {},
    diplomacy: {},
    discoveryChoices: {},
    callReckoning: false,
    concede: false,
    messages: [],
    heroOrder: heroes.map((c) => String(c['id'])),
    forTurn: turn,
  };
}

/** Turn 1 of scripted-05, the save as resolveTurn gives it back: its scripted realm (of `alignment`) sending the
 *  untouched form, or, with no alignment, the matrix's own game (the scripted realm's orders, which send no plan). */
function turnOne(alignment?: string): Obj {
  const world = newWorld(alignment);
  const state = JSON.stringify(world);
  const rows = JSON.parse(slotRowsJson(state, 1)) as { player_index: number; orders: string | null }[];
  const row = rows.find((r) => r.player_index === realmIndex);
  if (!row) throw new Error('scripted-05 has no row for its scripted realm');
  if (alignment) row.orders = JSON.stringify(theUntouchedForm(world, 1));
  const result = resolveTurn(state, rows, 1, Math.floor(kcRng() * 2 ** 32) || 1) as { state: string };
  return JSON.parse(result.state) as Obj;
}

const savedGood = turnOne('Good');
const savedEvil = turnOne('Evil');
/** The matrix's own turn 1 of scripted-05, which parses strictly on the base too: each other case stages on it. */
const savedByTheMatrix = turnOne();

describe('an encounter plan as the player portal sends it and the merge keeps it (the staging case)', () => {
  test("a realm's untouched form for an empty turn: every hero's plan kept, and the save parses strictly", () => {
    const heroes = heroesOfTheRealm(savedGood);
    expect(heroes.length).toBeGreaterThan(0);
    for (const c of heroes) expect(c['encounterPlan']).toEqual({ tactics: ['ME'], notes: '', duelStance: 'refuse' });
    expect(strictIssues(GameStateSchema, savedGood)).toEqual([]);
  });

  test("an Evil realm's untouched form: its conquest doctrine kept on every plan, and the save parses strictly", () => {
    const heroes = heroesOfTheRealm(savedEvil);
    expect(heroes.length).toBeGreaterThan(0);
    for (const c of heroes)
      expect(c['encounterPlan']).toEqual({ tactics: ['ME'], notes: '', duelStance: 'refuse', evilMode: 'terror' });
    expect(strictIssues(GameStateSchema, savedEvil)).toEqual([]);
  });

  test("a hero hired with a plan card: the card's plan, as the merge kept it, given to him once he is hired", () => {
    const s = copyOf(savedByTheMatrix);
    const wanderer = objectsIn(s, 'characters').find((c) => c['player'] === null && c['alive'] !== false);
    if (!wanderer) throw new Error('the save has no wandering hero');
    // the merge holds a card's plan (`hired_<id>_via_<hirer>_ph<phase>`) until the hire lands, then the hire gives it
    s['_pendingSynthPlans'] = [
      {
        heroId: wanderer['id'],
        player: realmIndex,
        plan: { tactics: ['ME', 'AR'], notes: '', duelStance: 'accept' },
      },
    ];
    wanderer['player'] = realmIndex;
    expect(applyPendingSynthPlan(s, wanderer, realmIndex)).toBe(true);
    // the turn's end throws the held plans away (they are the turn's own)
    delete s['_pendingSynthPlans'];
    expect(wanderer['encounterPlan']).toEqual({ tactics: ['ME', 'AR'], notes: '', duelStance: 'accept' });
    expect(strictIssues(GameStateSchema, s)).toEqual([]);
  });
});

/** A copy of the matrix's save, to stage on. */
const save = (): Obj => copyOf(savedByTheMatrix);
/** The save's `key` list's first entry that `pick` takes, in `s`. */
function first(s: Obj, key: string, pick: (o: Obj) => boolean = () => true): Obj {
  const found = objectsIn(s, key).find(pick);
  if (!found) throw new Error(`the save has no ${key} to stage on`);
  return found;
}
const world = (s: Obj): Obj => (s['world'] ?? {}) as Obj;
const turn = (s: Obj): number => Number(s['turn']);
const aHeroOfTheRealm = (s: Obj): Obj =>
  first(s, 'characters', (c) => c['player'] === realmIndex && c['isKing'] !== true);
const theRealm = (s: Obj): Obj => first(s, 'players', (p) => objectsIn(s, 'players').indexOf(p) === realmIndex);

describe("every mastery order's once-a-turn stamp, as the order dispatch writes it", () => {
  test('the schema names every key of MASTERY_ORDER_KEYS (a new mastery order must be added to it)', () => {
    const stamp = CharacterSchema.shape._masteryOrderUsed.unwrap();
    expect([...MASTERY_ORDER_KEYS].filter((key) => !(key in stamp.shape))).toEqual([]);
  });

  // src/engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts: `c._masteryOrderUsed[action] =
  // G.turn`, before the hero's skill is checked
  test.for([...MASTERY_ORDER_KEYS])('%s', (key) => {
    const s = save();
    aHeroOfTheRealm(s)['_masteryOrderUsed'] = { [key]: turn(s) };
    expect(strictIssues(GameStateSchema, s)).toEqual([]);
  });
});

// Each field a rare order or a game's end writes: what it is, the file that writes it, and the write, staged on a copy
// of the save.
const fieldsTheRareOrdersSave: [string, string, (s: Obj) => void][] = [
  [
    'Release Hero: the realm that released the hero, on the hero and on his grave once he falls',
    'src/engine/orders/army-orders-hand-over-garrison-disband-and-pick-up-companies-and-release-a-hero.ts, src/engine/graves.ts',
    (s) => {
      const hero = aHeroOfTheRealm(s);
      hero['player'] = null;
      hero['_releasedTurn'] = turn(s);
      hero['_releasedBy'] = realmIndex;
      const fallen = copyOf(hero);
      fallen['alive'] = false;
      // the save's copy and its hero, given the types the engine meets them as (the staged save is one the schema
      // parses, and the hero one of its heroes)
      recordHeroGrave({ G: s as unknown as GameState }, fallen as unknown as Character);
    },
  ],
  [
    "Search Lair: a realm's hero's first lair cleared is a Moderate one",
    'src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts',
    (s) => {
      aHeroOfTheRealm(s)['_botLairKills'] = { Moderate: 1 };
    },
  ],
  [
    'Search Lair: a Legendary lair cleared',
    'src/engine/orders/explore-and-search-orders-maps-lairs-rites-and-rumours.ts',
    (s) => {
      aHeroOfTheRealm(s)['_botLairKills'] = { Weak: 2, Legendary: 1 };
    },
  ],
  [
    "Clairvoyance: the watched hero's entry, his skills without his items or companies",
    'src/engine/orders/cast-spell-order-white-psychic-illusory-elemental-and-necromancy-spells.ts',
    (s) => {
      const target = first(s, 'characters', (c) => c['player'] !== realmIndex && c['player'] !== null);
      const of = objectsIn(s, 'players')[Number(target['player'])] ?? {};
      theRealm(s)['_spiedHeroSkills'] = {
        [String(target['id'])]: {
          name: target['name'],
          isKing: target['isKing'] === true,
          alignment: target['alignment'],
          race: target['race'],
          kingdom: of['name'],
          skills: target['skills'],
          turn: turn(s),
        },
      };
    },
  ],
  [
    'Spy on a wandering hero: his entry has no realm',
    'src/engine/orders/espionage-orders-spy-steal-sabotage-grand-heist-assassinate-and-vanish.ts',
    (s) => {
      const target = first(s, 'characters', (c) => c['player'] === null);
      theRealm(s)['_spiedHeroSkills'] = {
        [String(target['id'])]: {
          name: target['name'],
          isKing: target['isKing'] === true,
          alignment: target['alignment'],
          race: target['race'],
          kingdom: null,
          skills: target['skills'],
          items: [],
          armies: objectsIn(target, 'armies').map((a) => ({
            type: a['type'],
            quality: a['quality'],
            unitName: a['unitName'] ?? '',
          })),
          turn: turn(s),
        },
      };
    },
  ],
  [
    "the Grand Design: the Wonder's province and name on the realm, and on its discovery",
    'src/engine/orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts (resolveGrandDesignOrder)',
    (s) => {
      const realm = theRealm(s);
      const prov = first(world(s), 'provinces', (p) => p['owner'] === realmIndex);
      realm['gdProvinceId'] = prov['id'];
      realm['gdName'] = 'The Great Work';
      prov['grandDesign'] = { owner: realmIndex, name: 'The Great Work', alignment: 'Good', builtTurn: turn(s) };
      realm['discoveries'] = [
        ...objectsIn(realm, 'discoveries'),
        {
          id: 'gd',
          name: 'Grand Design — The Great Work',
          category: 'Wonder',
          desc: 'A unique realm-wide Wonder.',
          turnDiscovered: turn(s),
          provinceId: prov['id'],
          provinceName: prov['name'],
        },
      ];
    },
  ],
  [
    'a win by elimination: the last realm with land or a living hero, announced',
    'src/engine/turn/diplomacy-resolution-and-victory-the-reckoning-elimination-concession-and-the-announcement.ts',
    (s) => {
      s['gameOver'] = {
        winner: realmIndex,
        byElimination: true,
        turn: turn(s),
        standings: standings(s),
        _announced: true,
      };
    },
  ],
  [
    'every realm conceded: the Reckoning called at once, with no realm left to win it',
    'src/engine/turn/diplomacy-resolution-and-victory-the-reckoning-elimination-concession-and-the-announcement.ts',
    (s) => {
      for (const p of objectsIn(s, 'players')) p['conceded'] = true;
      s['gameOver'] = {
        winner: null,
        byConcession: true,
        byReckoning: true,
        turn: turn(s),
        standings: standings(s),
        _announced: true,
      };
    },
  ],
  [
    "Wild Calling: a primal province's beasts answer and fall in behind the caller, each company marked",
    'src/engine/orders/realm-works-orders-consecration-muster-broker-the-wild-and-grand-design.ts',
    (s) => {
      const hero = aHeroOfTheRealm(s);
      const company = objectsIn(s, 'characters').flatMap((c) => objectsIn(c, 'armies'))[0];
      if (!company) throw new Error('the save has no company');
      hero['armies'] = [...objectsIn(hero, 'armies'), { ...copyOf(company), _pacified: true }];
    },
  ],
  [
    'a game begun before 26 September: Turn 0 wrote no bot diplomacy then (every reader takes "normal")',
    'src/ui/gm/turn-zero.ts',
    (s) => {
      delete s['botDiplomacy'];
    },
  ],
];

/** The standings a game's end writes, one row a realm (reckoningWinner's). */
function standings(s: Obj): Obj[] {
  return objectsIn(s, 'players').map((p, index) => ({
    index,
    name: p['name'],
    color: p['color'],
    alignment: p['alignment'],
    score: 0,
    titles: [],
    relics: 0,
  }));
}

describe('the fields the rare orders and a game’s end save, as their writers write them', () => {
  test("the matrix's turn they are staged on parses strictly as it is", () => {
    expect(strictIssues(GameStateSchema, savedByTheMatrix)).toEqual([]);
  });

  test.for(fieldsTheRareOrdersSave)('%s', ([, , stage]) => {
    const s = save();
    stage(s);
    expect(strictIssues(GameStateSchema, s)).toEqual([]);
  });
});
