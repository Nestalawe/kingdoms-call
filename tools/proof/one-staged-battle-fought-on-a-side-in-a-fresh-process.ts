// One case of the battle proof, in a fresh process of its own (the-battles-compared-each-staged-battle-its-lines-its-
// world-and-its-dice-by-stage.ts starts one a case, so no case sees another's module state):
// `node one-staged-battle-fought-on-a-side-in-a-fresh-process.ts <root> <the case as JSON>`. It stages the case's battle
// with the copy of the repository at <root>: its own tests/lib/a-battle-called-directly.ts on its own src/ (imported as
// they are: Node strips the types, so a frame's line is the source's). The world is made once (seed 1), the battle
// staged on it once, and then fought from that staging with each of the dice streams, its dice a counting stream
// (kcRng.use; no change to src/). It prints one line of JSON: for each stream, the battle's lines in words, the sha256
// of the world after (with who won), the dice drawn, and the dice drawn by stage
// (the-stages-of-the-two-battles-and-the-lines-that-open-them.ts); or what it threw.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getCallSites } from 'node:util';
import {
  type ABattle,
  type AFrame,
  theBattlesStagesOfTheSideAt,
  theStageOfADraw,
} from './the-stages-of-the-two-battles-and-the-lines-that-open-them.ts';

/** The seed the world of every case is made from. */
export const THE_WORLDS_SEED = 1;
/** The dice streams each case's battle is fought with: fixed seeds, the same answer every time. */
export const THE_DICE_STREAMS: readonly number[] = [900, 901, 902, 903, 904, 905, 906, 907];

/** A company as the stager makes it. */
interface ACompany {
  type: string;
  quality: string;
  unitName: string;
  race?: string;
  [key: string]: unknown;
}
/** A set of armies: each side's companies, and the attacker's realm and skills where the set needs them. */
export interface ASetOfArmies {
  attackers: () => ACompany[];
  defenders: () => ACompany[];
  /** The attacker's realm's creed (Neutral unless given) and race (Human unless given). */
  alignment?: string;
  race?: string;
  /** The attacker's Druid (2 unless given): 0 leaves beasts short of a Druid. */
  druid?: number;
}

const companiesOf = (type: string, n: number, quality: string, race?: string): ACompany[] =>
  Array.from({ length: n }, (_, i) => ({
    type,
    quality,
    ...(race ? { race } : {}),
    unitName: `${type} ${String(i + 1)}`,
  }));

/** The sets of armies the grid stages, each reaching its stages' branches. */
export const THE_SETS_OF_ARMIES: Readonly<Record<string, ASetOfArmies>> = {
  foot: {
    attackers: () => [...companiesOf('Men-at-Arms', 3, 'Veteran'), ...companiesOf('Free Lances', 1, 'Average')],
    defenders: () => [...companiesOf('Shieldwall Levies', 2, 'Green'), ...companiesOf('Men-at-Arms', 1, 'Green')],
  },
  missiles: {
    attackers: () => [...companiesOf('Yeoman Longbows', 2, 'Average'), ...companiesOf('Men-at-Arms', 1, 'Veteran')],
    defenders: () => [
      ...companiesOf('Ironwood Crossbows', 2, 'Average', 'Dwarven'),
      ...companiesOf('Shieldwall Levies', 1, 'Green'),
    ],
  },
  flyers: {
    race: 'Elven',
    attackers: () => [
      ...companiesOf('Eagle Riders', 2, 'Veteran', 'Elven'),
      ...companiesOf('Noble Griffons', 1, 'Average', 'Human'),
    ],
    defenders: () => [
      ...companiesOf('Wyvern Riders', 1, 'Average', 'Orcish'),
      ...companiesOf('Men-at-Arms', 2, 'Average'),
    ],
  },
  'beasts under a Druid short': {
    alignment: 'Druidic',
    druid: 0,
    attackers: () => [
      ...companiesOf('Manticore Pride', 2, 'Elite', 'Primal'),
      ...companiesOf('Cave Trolls', 1, 'Veteran', 'Primal'),
      ...companiesOf('Great Bears', 1, 'Average', 'Primal'),
    ],
    defenders: () => companiesOf('Men-at-Arms', 3, 'Average'),
  },
  'skeletal companies': {
    alignment: 'Undead',
    attackers: () => [
      ...companiesOf('Men-at-Arms', 3, 'Average').map((a) => ({ ...a, skeletal: true })),
      ...companiesOf('Shieldwall Levies', 1, 'Average'),
    ],
    defenders: () => companiesOf('Shieldwall Levies', 3, 'Green'),
  },
  'Monsters under Evil': {
    alignment: 'Evil',
    attackers: () => [
      ...companiesOf('Cave Trolls', 2, 'Veteran', 'Primal'),
      ...companiesOf('Dread Hydras', 1, 'Average', 'Primal'),
    ],
    defenders: () => companiesOf('Shieldwall Levies', 3, 'Average'),
  },
  'Dwarven Guard': {
    race: 'Dwarven',
    attackers: () => companiesOf('Dwarven Guard', 3, 'Veteran', 'Dwarven'),
    defenders: () => [
      ...companiesOf('Orc Berserkers', 2, 'Average', 'Orcish'),
      ...companiesOf('Goblin Horde', 2, 'Green', 'Orcish'),
    ],
  },
  corsairs: {
    attackers: () => [
      ...companiesOf('Corsair Fleet', 2, 'Veteran'),
      ...companiesOf('Galleon Fleet', 1, 'Average'),
      ...companiesOf('Shieldwall Levies', 1, 'Average'),
    ],
    defenders: () => [...companiesOf('Galleon Fleet', 1, 'Average'), ...companiesOf('Shieldwall Levies', 1, 'Green')],
  },
  whales: {
    alignment: 'Druidic',
    attackers: () => [
      ...companiesOf('Whale Cohort', 2, 'Veteran', 'Primal'),
      ...companiesOf('Shark Shoals', 1, 'Average', 'Primal'),
    ],
    defenders: () => [
      ...companiesOf('Galleon Fleet', 2, 'Average'),
      ...companiesOf('Orcish Longships', 1, 'Average', 'Orcish'),
    ],
  },
  fleets: {
    attackers: () => [
      ...companiesOf('Galleon Fleet', 2, 'Veteran'),
      ...companiesOf('Elven Galleys', 1, 'Average', 'Elven'),
    ],
    defenders: () => companiesOf('Dwarf Ironclads', 2, 'Average', 'Dwarven'),
  },
  'an outmatched attacker': {
    attackers: () => companiesOf('Shieldwall Levies', 1, 'Green'),
    defenders: () => companiesOf('Men-at-Arms', 4, 'Elite'),
  },
};

/** One case of the grid: the battle, the ground, the defender led or not, where the attacker comes from, the armies. */
export interface ABattleCase {
  key: string;
  battle: ABattle;
  terrain: string;
  /** Against the defenders: a guard leads them, or none does. Between heroes: the defending hero has the skills, or none. */
  defender: 'led' | 'leaderless';
  /** The ground beside the field the attacker comes from: land, or sea (a landing on a land field). */
  from: 'land' | 'sea';
  armies: string;
}

/** One battle fought on a side: its lines in words, the world after (with who won) as a hash, its dice. */
export type ABattleFought =
  { lines: string[]; hash: string; draws: number; byStage: Record<string, number> } | { threw: string };
/** What one side made of a case: each stream's battle, or what the staging threw. */
export type ACaseFought = { byStream: Record<string, ABattleFought> } | { threw: string };

/** The stager's ways in, as a side's tests/lib/a-battle-called-directly.ts gives them. */
interface TheSidesStager {
  aWorld(seed: number): AWorld;
  theTurnsContext(G: AWorld): unknown;
  aFieldAndTheGroundBesideIt(
    G: AWorld,
    o: { terrain?: string; atSea?: boolean },
  ): { field: AProvince; from: AProvince };
  own(G: AWorld, p: AProvince, pi: number | null): void;
  place(G: AWorld, c: AHero, p: AProvince): void;
  attackFrom(G: AWorld, c: AHero, from: AProvince, field: AProvince): void;
  aGuardMadeByTheTest(G: AWorld, field: AProvince, armies: ACompany[], more?: Partial<AHero>): AHero;
  aBattleAgainstTheProvince(
    tc: unknown,
    atk: AHero,
    field: AProvince,
    guard: AHero | null,
  ): { words: readonly string[]; won: boolean };
  aBattleBetweenHeroes(
    tc: unknown,
    atk: AHero,
    def: AHero,
    field: AProvince,
  ): { words: readonly string[]; won: boolean };
}
interface AHero {
  id: number;
  player: number | null;
  isKing?: boolean;
  alive: boolean;
  armies?: ACompany[];
  skills?: Record<string, number>;
  items?: unknown[];
  [key: string]: unknown;
}
interface AProvince {
  id: number;
  terrain: string;
  [key: string]: unknown;
}
interface AWorld {
  relations: Record<string, string>;
  characters: AHero[];
  players: { race?: string; alignment?: string; [key: string]: unknown }[];
  world: { provinces: AProvince[] };
}

/** A commander's skills: Tactical, Archery, Naval and Druid at 2 (Druid as the set says), Elemental 3 and Necromancy 2
 *  (a battle spell to pick), or none of them. */
const skilled = (druid = 2) => ({ tactical: 2, archery: 2, naval: 2, druid, elemental: 3, necromancy: 2 });
const unskilled = { tactical: 0, archery: 0, naval: 0, druid: 0, elemental: 0, necromancy: 0 };
/** A plan that fights in melee every round, with the duel stance given. */
const inMelee = (duelStance: string) => ({ tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance });

/** The case staged on a world made from THE_WORLDS_SEED: the world, and who fights where (ids). */
function theCaseStaged(stager: TheSidesStager, c: ABattleCase) {
  const set = THE_SETS_OF_ARMIES[c.armies];
  if (!set) throw new Error(`no set of armies "${c.armies}"`);
  const G = stager.aWorld(THE_WORLDS_SEED);
  const atSea = c.terrain === 'sea';
  const { field, from } = stager.aFieldAndTheGroundBesideIt(G, atSea ? { atSea } : { terrain: c.terrain });
  if (c.from === 'sea') from.terrain = 'sea';
  const realm0 = G.players[0];
  if (!realm0) throw new Error('the world has no realm 0');
  realm0.alignment = set.alignment ?? 'Neutral';
  realm0.race = set.race ?? 'Human';
  const king = (pi: number) => G.characters.find((h) => h.alive && h.isKing && h.player === pi);
  const A = king(0);
  if (!A) throw new Error('the world has no king in realm 0');
  Object.assign(A, { armies: set.attackers(), skills: { ...A.skills, ...skilled(set.druid) }, items: [] });
  if (c.from === 'sea' && !atSea) A['_amphibiousAssault'] = true;
  // a led defender is challenged to a duel (and a hero accepts); a leaderless one isn't, and the attacker keeps his own
  // plan (none: the engine's, from his temper)
  if (c.defender === 'led') A['encounterPlan'] = inMelee('challenge');
  let guardId: number | null = null;
  let defId: number | null = null;
  if (c.battle === 'against the defenders') {
    if (c.defender === 'led') guardId = stager.aGuardMadeByTheTest(G, field, set.defenders(), { skills: skilled() }).id;
    else {
      const defenders = set.defenders();
      Object.assign(field, { neutralDefenders: defenders, npcArmies: defenders.length });
    }
  } else {
    const D = king(1);
    if (!D) throw new Error('the world has no king in realm 1');
    G.relations['0-1'] = 'enemy';
    stager.own(G, field, 1);
    const skills = c.defender === 'led' ? skilled() : unskilled;
    Object.assign(D, { armies: set.defenders(), skills: { ...D.skills, ...skills }, items: [] });
    if (c.defender === 'led') D['encounterPlan'] = inMelee('accept');
    stager.place(G, D, field);
    defId = D.id;
  }
  stager.attackFrom(G, A, from, field);
  return { G, atkId: A.id, fieldId: field.id, guardId, defId };
}

/** Stages the case with the copy at `root` (resolved: a draw's frames name the files by their real path), and fights
 *  it with each stream. */
export async function theCaseFought(root: string, c: ABattleCase, streams = THE_DICE_STREAMS): Promise<ACaseFought> {
  const real = fs.realpathSync(root);
  const src = path.join(real, 'src');
  const stager = (await import(
    pathToFileURL(path.join(real, 'tests/lib/a-battle-called-directly.ts')).href
  )) as TheSidesStager;
  const { kcRng, kcRngStream } = (await import(pathToFileURL(path.join(src, 'engine/rng.ts')).href)) as {
    kcRng: { use: (fn: () => number) => () => number };
    kcRngStream: (seed: number) => () => number;
  };
  const stages = theBattlesStagesOfTheSideAt(src);
  let staged;
  try {
    staged = theCaseStaged(stager, c);
  } catch (e: unknown) {
    return { threw: `the staging: ${(e instanceof Error ? e.message : String(e)).slice(0, 300)}` };
  }
  const snapshot = JSON.stringify(staged.G);
  const byStream: Record<string, ABattleFought> = {};
  for (const seed of streams) {
    const G = JSON.parse(snapshot) as AWorld;
    const who = (id: number | null) => (id === null ? null : (G.characters.find((h) => h.id === id) ?? null));
    const field = G.world.provinces.find((p) => p.id === staged.fieldId);
    const atk = who(staged.atkId);
    const def = who(staged.defId);
    if (!field || !atk) throw new Error('the staging lost its field or its attacker');
    const tc = stager.theTurnsContext(G);
    const byStage: Record<string, number> = {};
    let draws = 0;
    const dice = kcRngStream(seed);
    const was = kcRng.use(() => {
      draws++;
      const stage = theStageOfADraw(
        getCallSites(200).map((f): AFrame => ({
          functionName: f.functionName,
          scriptName: f.scriptName.startsWith('file:') ? fileURLToPath(f.scriptName) : f.scriptName,
          lineNumber: f.lineNumber,
        })),
        stages,
        src,
      );
      byStage[stage] = (byStage[stage] ?? 0) + 1;
      return dice();
    });
    try {
      const fought =
        c.battle === 'against the defenders'
          ? stager.aBattleAgainstTheProvince(tc, atk, field, who(staged.guardId))
          : def
            ? stager.aBattleBetweenHeroes(tc, atk, def, field)
            : null;
      if (!fought) throw new Error('the staging lost its defender');
      const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify({ world: G, won: fought.won }))
        .digest('hex');
      byStream[String(seed)] = { lines: [...fought.words], hash, draws, byStage };
    } catch (e: unknown) {
      byStream[String(seed)] = { threw: (e instanceof Error ? e.message : String(e)).slice(0, 300) };
    } finally {
      kcRng.use(was);
    }
  }
  return { byStream };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(import.meta.filename)) {
  const [root = '', job = '{}', streams] = process.argv.slice(2);
  const write = process.stdout.write.bind(process.stdout);
  const theStreams = streams ? streams.split(',').map(Number) : THE_DICE_STREAMS;
  theCaseFought(root, JSON.parse(job) as ABattleCase, theStreams).then(
    (made) => write(JSON.stringify(made) + '\n'),
    (e: unknown) => {
      write(JSON.stringify({ threw: `the worker: ${String(e)}` }) + '\n');
      process.exitCode = 1;
    },
  );
}
