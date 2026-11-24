// Properties of the battle between two heroes' hosts (combatVsChar, lifted out of resolveTurn in plan P1-08h),
// fast-check seeded from KC_SEED, over made-up battles: each host's companies (type and quality), the ground (the
// defender's home, or open ground beside the attacker's home, where the attacker has somewhere to fall back to), its
// terrain, both commanders' Tactical skill and duel stance, and whether the battle is a fresh clash or a carry-on round:
//   • no company is lost without being counted: each company a host brought still stands in it after the battle, is
//     counted among its losses, or is told as leaving ("…disbands for good"), and no company joins a host;
//   • the report is whole: every line is text with no "NaN" or "undefined", and the summary names the side that won;
//   • the turn's statistics get exactly one record of the battle, with its result, its losses and its carry-on round:
//     a fresh clash starts the count at 0, a resumed battle adds 1, and a war's opening clash starts it again;
//   • Raiders' Muster's flag (B-06ae: the race gifts' runner): the province is flagged with the turn exactly when the
//     winner's realm is Orcish and the province is Orcish, over each pair of the realms' races and the province's;
//   • a hero who serves no realm, attacking or defending, is named in his host's header and the "moves into" line
//     without a realm's brackets, and his foe with his realm's name (one staged battle each).
// Level 1 (unit): combatVsChar called directly on the engine's modules (since P1-14m; the bare vm before), on a fresh
// turn's context for each battle (a battle changes the world). The matrix runs it about 840 times a set; these say what
// holds for any battle staged here, not only the matrix's games.
import '../lib/the-whole-engine.ts';
import fc from 'fast-check';
import { expect, test } from 'vitest';
import {
  aFreshTurnsContextOnTheWorld,
  botWorld,
  loadTheEngineOnItsModules,
  quietEngineLog,
  type TurnContext,
} from '../lib/the-middle-of-a-bot-world-in-a-turn-on-the-engines-modules.ts';
import { timeLimitForPropertyRuns } from '../lib/time-limits.ts';

// fast-check's run count (tests/setup/fast-check.ts): 100, or 1,000 under KC_FULL. Each property's time limit is 50
// ms an input, so npm test's 100 keep Vitest's 5 s and KC_FULL's 1,000 get 50 s (tests/lib/time-limits.ts).
const RUNS = fc.readConfigureGlobal().numRuns ?? 100;

interface Unit {
  type: string;
  quality: string;
  race: string;
  unitName: string;
}
interface Character {
  id: number | string;
  name: string;
  player: number | null;
  isKing?: boolean;
  alive: boolean;
  location: number;
  armies: Unit[];
  skills: Record<string, number>;
  encounterPlan?: Record<string, unknown>;
  [key: string]: unknown;
}
interface Province {
  id: number;
  terrain: string;
  owner: number | null;
  characters: (number | string)[];
  _carryOnRounds?: number;
  [key: string]: unknown;
}
interface Battle {
  won: boolean;
  narrative: unknown[];
  summaryText: unknown;
  atkLost: number;
  defLost: number;
}
interface BattleRecord {
  kind: string;
  won: boolean;
  atkLost: number;
  defLost: number;
  carry: number;
}

const engine = await loadTheEngineOnItsModules({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
const WORLD = botWorld(engine, 2, { cols: 10, rows: 6 }, { seaPct: 20 });
// (the engine's own modules, fresh with it)
const { combatVsChar: theBattleAsItsModuleExportsIt } =
  await import('../../src/engine/battle/battles-between-heroes.ts');
const combatVsChar = theBattleAsItsModuleExportsIt as unknown as (
  t: TurnContext,
  atk: Character,
  def: Character,
  prov: Province,
) => Battle;
const getNeighbors = engine.getNeighborsP as unknown as (
  prov: Province,
  cols: number,
  rows: number,
  provinces: Province[],
) => Province[];
/** A report line's words: a line is its words, or a fact whose words the views write (theWordsOf, src/views/prose/,
 *  P1-12c3). */
const { theWordsOf: theWordsOfAsItsModuleExportsIt } = await import('../../src/views/prose/the-words-of-each-line.ts');
const theWordsOf = theWordsOfAsItsModuleExportsIt as unknown as (fact: unknown) => string;
/** The turn's statistics as the writer reads them, built by the views from the facts the turn filed (P1-12d33). */
const { theStatisticsOfTheTurn: theStatisticsAsItsModuleExportsIt } =
  await import('../../src/views/the-statistics-of-the-turn.ts');
const theStatisticsOfTheTurn = theStatisticsAsItsModuleExportsIt as unknown as (telemetry: unknown) => {
  battles: BattleRecord[];
};
const wordsOf = (line: unknown): unknown =>
  typeof line === 'object' && line !== null && 'kind' in line ? theWordsOf(line) : line;

// every land company a realm can raise on open plains, with its race (the garrisons stay home)
const { KC_QUALITY_TIERS, PROVINCE_ARMIES_P } = await import('../../src/content/kingdoms-call-data.ts');
const COMPANIES = Object.entries(PROVINCE_ARMIES_P.plain as Record<string, string[]>)
  .flatMap(([race, types]) => types.map((type) => ({ type, race })))
  .filter((c) => !c.type.includes('Garrison'));
const QUALITIES: readonly string[] = KC_QUALITY_TIERS;
const TERRAINS = ['plain', 'forest', 'jungle', 'mountain', 'desert'] as const;
const STANCES = ['challenge', 'accept', 'refuse'] as const;

// Half the companies are Green, the lowest grade: a Green company that would lose a grade leaves the field instead
// ("…disbands for good"), so the battles here show it often (15 to 25 times in 100 battles), not by luck.
const company = fc.record({
  kind: fc.nat(COMPANIES.length - 1),
  quality: fc.oneof(fc.constant(0), fc.nat(QUALITIES.length - 1)),
});
const host = fc.record({
  companies: fc.array(company, { minLength: 1, maxLength: 5 }),
  tactical: fc.nat(9),
  stance: fc.constantFrom(...STANCES),
});
const battleInput = fc.record({
  attacker: host,
  defender: host,
  ground: fc.constantFrom('defender home', 'open ground'),
  terrain: fc.constantFrom(...TERRAINS),
  round: fc.constantFrom('fresh clash', 'carry-on', 'opening clash'),
  roundsBefore: fc.nat(4),
});
type BattleInput = typeof battleInput extends fc.Arbitrary<infer T> ? T : never;

let companyCount = 0;
/** A fresh turn's context in the second phase, realms 0 and 1 at war, and their kings' hosts met on one province, staged
 *  from `input`. The attacker came from his home; the hosts are the pooled copies a battle fights with, as the stalled
 *  battles make them: `{...record, armies: [...record.armies]}`. */
function stage(input: BattleInput) {
  const tc = aFreshTurnsContextOnTheWorld(engine, WORLD);
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  const G = tc.G as {
    relations: Record<string, string>;
    characters: Character[];
    world: { cols: number; rows: number; provinces: Province[] };
  };
  G.relations['0-1'] = 'enemy';
  const [attacker, defender] = [0, 1].map((p) => G.characters.find((c) => c.alive && c.player === p && c.isKing));
  if (!attacker || !defender) throw new Error('the world has no king in realm 0 or 1');
  const provinces = G.world.provinces;
  const home = provinces[attacker.location];
  if (!home) throw new Error("the attacker's home is not on the map");
  const prov =
    input.ground === 'defender home'
      ? provinces[defender.location]
      : getNeighbors(home, G.world.cols, G.world.rows, provinces).find((p) => p.terrain !== 'sea' && p.owner == null);
  if (!prov) throw new Error('the world has no ground for the battle');
  prov.terrain = input.terrain;
  const moveTo = (c: Character) => {
    const from = provinces[c.location];
    if (from) from.characters = from.characters.filter((id) => id !== c.id);
    prov.characters.push(c.id);
    c.location = prov.id;
  };
  attacker['_attackedFrom'] = attacker.location;
  moveTo(attacker);
  if (defender.location !== prov.id) moveTo(defender);
  const shape = (c: Character, h: BattleInput['attacker']) => {
    c.armies = h.companies.map(({ kind, quality }) => {
      const { type, race } = COMPANIES[kind] ?? { type: 'Men-at-Arms', race: 'Human' };
      return { type, quality: QUALITIES[quality] ?? 'Average', race, unitName: `${type} #${String(++companyCount)}` };
    });
    c.skills = { ...c.skills, tactical: h.tactical };
    c.encounterPlan = { duelStance: h.stance };
  };
  shape(attacker, input.attacker);
  shape(defender, input.defender);
  prov._carryOnRounds = input.roundsBefore;
  const atk: Character = { ...attacker, armies: [...attacker.armies] };
  const def: Character = { ...defender, armies: [...defender.armies] };
  if (input.round !== 'fresh clash') atk['_resumeBattle'] = true;
  if (input.round === 'opening clash') atk['_openingClash'] = true;
  return { tc, atk, def, prov };
}

/** The companies of `brought` that a line of `narrative` tells as leaving the field for good. The line opens with the
 *  company that leaves, after its owner ("— Lord X's Men-at-Arms #3 (Men-at-Arms), facing …", or "Lord X's leaderless
 *  host's" once he has fallen); a company named later in the line is the one it fought. Every company's name is unique. */
const toldLeaving = (narrative: unknown[], brought: Unit[]) =>
  brought.filter((u) =>
    narrative.map(wordsOf).some((l) => {
      if (typeof l !== 'string' || !l.startsWith('— ') || !l.endsWith('disbands for good.')) return false;
      return l.slice(0, l.indexOf(' (')).endsWith(`'s ${u.unitName}`);
    }),
  );

test('no company is lost without being counted, and none joins a host', timeLimitForPropertyRuns(RUNS, 50), () => {
  const seen = { lost: 0, left: 0, stood: 0 };
  fc.assert(
    fc.property(battleInput, (input) => {
      const { tc, atk, def, prov } = stage(input);
      const brought = [[...atk.armies], [...def.armies]];
      const r = combatVsChar(tc, atk, def, prov);
      [atk, def].forEach((side, i) => {
        const before = brought[i] ?? [];
        const lost = i === 0 ? r.atkLost : r.defLost;
        expect(side.armies.every((u) => before.includes(u))).toBe(true);
        expect(Number.isInteger(lost) && lost >= 0).toBe(true);
        const left = toldLeaving(r.narrative, before).filter((u) => !side.armies.includes(u)).length;
        expect(side.armies.length + lost + left).toBe(before.length);
        seen.lost += lost;
        seen.left += left;
        seen.stood += side.armies.length;
      });
    }),
  );
  // the battles staged here lose companies, see some leave, and leave some standing
  expect(seen.lost).toBeGreaterThan(0);
  expect(seen.left).toBeGreaterThan(0);
  expect(seen.stood).toBeGreaterThan(0);
});

test('the report is whole, and its summary names the side that won', timeLimitForPropertyRuns(RUNS, 50), () => {
  const seen = { won: 0, held: 0 };
  fc.assert(
    fc.property(battleInput, (input) => {
      const { tc, atk, def, prov } = stage(input);
      const r = combatVsChar(tc, atk, def, prov);
      for (const line of [...r.narrative.map(wordsOf), wordsOf(r.summaryText)]) {
        expect(typeof line).toBe('string');
        expect(String(line)).not.toMatch(/NaN|undefined/);
      }
      expect(wordsOf(r.summaryText)).toMatch(r.won ? /'s forces defeat / : /'s forces hold against /);
      if (r.won) seen.won++;
      else seen.held++;
    }),
  );
  expect(seen.won).toBeGreaterThan(0);
  expect(seen.held).toBeGreaterThan(0);
});

// A hero who serves no realm (a wanderer holding his ground, say) is named in his host's header, and in the "moves
// into" line when he attacks, without a realm's brackets; a realm's hero keeps his realm's name there (P1-23a: the
// realmless side read "(undefined)"). No matrix game meets a realmless hero in this battle, so these stage one.
test.each(['defender', 'attacker'] as const)("a realmless %s's lines name no realm, and his foe's name his", (side) => {
  const oneHost: BattleInput['attacker'] = { companies: [{ kind: 0, quality: 1 }], tactical: 2, stance: 'accept' };
  const { tc, atk, def, prov } = stage({
    attacker: oneHost,
    defender: oneHost,
    ground: 'open ground',
    terrain: 'plain',
    round: 'fresh clash',
    roundsBefore: 0,
  });
  const realmOf = (c: Character) => (tc.G as { players: { name: string }[] }).players[c.player ?? -1]?.name;
  const [realmless, foe] = side === 'attacker' ? [atk, def] : [def, atk];
  realmless.player = null;
  const foesHeader = `${foe.name} (${String(realmOf(foe))})`;
  const words = combatVsChar(tc, atk, def, prov).narrative.map((l) => String(wordsOf(l)));
  const headers = words
    .filter((w) => w.startsWith('⚑FORCE⚑'))
    .map((w) => (JSON.parse(w.slice('⚑FORCE⚑'.length)) as { name: string }).name);
  expect(headers).toEqual(side === 'attacker' ? [atk.name, foesHeader] : [foesHeader, def.name]);
  const movesInto = words.find((w) => w.startsWith('➡️'));
  expect(movesInto).toMatch(
    side === 'attacker' ? `➡️ ${atk.name} moves into ${String(prov['name'])}` : `➡️ ${foesHeader} moves into`,
  );
  expect(words.join('\n')).not.toMatch(/undefined|NaN/);
});

test(
  "the turn's statistics record the battle once, with its result, its losses and its carry-on round",
  timeLimitForPropertyRuns(RUNS, 50),
  () => {
    fc.assert(
      fc.property(battleInput, (input) => {
        const { tc, atk, def, prov } = stage(input);
        const r = combatVsChar(tc, atk, def, prov);
        const { battles } = theStatisticsOfTheTurn(tc['_tel']);
        expect(battles).toHaveLength(1);
        const [record] = battles;
        const round = input.round === 'carry-on' ? input.roundsBefore + 1 : 0;
        expect(record && [record.kind, record.won, record.atkLost, record.defLost, record.carry]).toEqual([
          'pvp',
          r.won,
          r.atkLost,
          r.defLost,
          round,
        ]);
        expect(prov._carryOnRounds).toBe(round);
      }),
    );
  },
);

/** Five Elite companies with Tactical 9 against one Green with none, on open plain, a fresh clash: the attacker wins. */
const overwhelming = (
  attackersRace: string,
  defendersRace: string,
): [BattleInput, string, string, string | undefined] => [
  {
    attacker: {
      companies: Array.from({ length: 5 }, () => ({ kind: 0, quality: QUALITIES.length - 1 })),
      tactical: 9,
      stance: 'refuse',
    },
    defender: { companies: [{ kind: 0, quality: 0 }], tactical: 0, stance: 'refuse' },
    ground: 'open ground',
    terrain: 'plain',
    round: 'fresh clash',
    roundsBefore: 0,
  },
  attackersRace,
  defendersRace,
  'Orcish',
];
const { KC_HUMANOID_RACES: THE_PEOPLES } = await import('../../src/content/kingdoms-call-data.ts');
const PROVINCE_RACES = [...THE_PEOPLES, 'Primal:Wolf', undefined] as const;
test(
  "Raiders' Muster's flag: the province is flagged exactly when an Orcish realm wins in an Orcish province",
  timeLimitForPropertyRuns(RUNS, 50),
  () => {
    fc.assert(
      fc.property(
        battleInput,
        fc.constantFrom(...THE_PEOPLES),
        fc.constantFrom(...THE_PEOPLES),
        fc.constantFrom(...PROVINCE_RACES),
        (input, attackersRace, defendersRace, provincesRace) => {
          const { tc, atk, def, prov } = stage(input);
          const G = tc.G as { turn: number; players: { race: string }[] };
          const [attackersRealm, defendersRealm] = [G.players[0], G.players[1]];
          if (!attackersRealm || !defendersRealm) throw new Error('the world has no realm 0 or 1');
          attackersRealm.race = attackersRace;
          defendersRealm.race = defendersRace;
          if (provincesRace === undefined) delete prov['race'];
          else prov['race'] = provincesRace;
          delete prov['_raidersMuster'];
          const r = combatVsChar(tc, atk, def, prov);
          const theWinnersRace = r.won ? attackersRace : defendersRace;
          expect(
            prov['_raidersMuster'],
            `a ${theWinnersRace} realm wins in a ${String(provincesRace)} province (attacker won: ${String(r.won)})`,
          ).toBe(theWinnersRace === 'Orcish' && provincesRace === 'Orcish' ? G.turn : undefined);
        },
      ),
      // and, whatever the runs draw, an Orcish host that overwhelms a Human one in an Orcish province, and the other
      // way round: the winner is known, so the flag can't fall to the loser unseen
      { examples: [overwhelming('Orcish', 'Human'), overwhelming('Human', 'Orcish')] },
    );
  },
);
