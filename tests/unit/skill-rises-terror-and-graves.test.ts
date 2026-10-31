// Helpers lifted out of resolveTurn in plan P1-08c, called directly in the bare vm (tests/lib/engine.ts):
// - qualityAdj (the balance matrix never runs it: nothing calls it): a unit's quality in words.
// - spreadTerror (property, fast-check): however many decisive Evil victories, the battle province and each neighbour
//   hold at most TERROR_MAX_STACKS stacks of Terror, one a victory up to that.
// - resolvePendingSkillGain (property): the phase's draw raises at most one skill, one of the candidates, by exactly one
//   level and never past 9, clears the hero's candidates, and closes that skill to experience for the rest of the turn.
// - recordBattleGraves (property): a fallen unit leaves a grave or, in an Elven kingdom, slips away home, never both;
//   skeletons and spectral doubles leave neither.
// - takeBestGrave, senseGravesUnderfoot and graveIntelFor, where no matrix game goes: a gap among a province's graves,
//   a necromancer handed no state, and a realm's lore of a province no map holds.
// Level 1 (unit): each function is called on a context made in the test; nothing else of the turn runs. The properties
// describe the game as it is: they pass on the code as it was before the move too.
import vm from 'node:vm';
import fc from 'fast-check';
import { afterAll, describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext, type TurnContext } from '../lib/engine.ts';

const engine = loadEngine({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const tc = turnContext(engine, botWorld(engine, 2, { cols: 10, rows: 6 }));
type Province = { id: number; name: string; terrain: string; [flag: string]: unknown };
type Hero = {
  id: number;
  alive: boolean;
  player: number | null;
  skills: Record<string, number>;
  [field: string]: unknown;
};
const G = tc.G as {
  turn: number;
  world: { cols: number; rows: number; provinces: Province[] };
  players: { race: string }[];
  characters: Hero[];
};

test('qualityAdj: a unit quality in words, and "seasoned" for anything else', () => {
  const qualityAdj = engineFn(engine, 'qualityAdj') as (quality: unknown) => string;
  expect(['Green', 'Average', 'Veteran', 'Elite', 'Crack'].map(qualityAdj)).toEqual([
    'inexperienced',
    'seasoned',
    'veteran',
    'elite',
    'crack',
  ]);
  expect(qualityAdj('Legendary')).toBe('seasoned');
  expect(qualityAdj(undefined)).toBe('seasoned');
});

describe('spreadTerror', () => {
  const spreadTerror = engineFn(engine, 'spreadTerror') as (
    t: TurnContext,
    battleProv: Province,
    byPlayer: number,
    narrative: string[] | null,
  ) => void;
  const max = vm.runInContext('TERROR_MAX_STACKS', engine) as number;
  const neighbours = (p: Province) =>
    (
      vm.runInContext('getNeighborsP', engine) as (
        p: Province,
        cols: number,
        rows: number,
        provinces: Province[],
      ) => (Province | null)[]
    )(p, G.world.cols, G.world.rows, G.world.provinces).filter((n): n is Province => n != null);

  test('the battle province and each neighbour hold one stack a victory, up to TERROR_MAX_STACKS', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: G.world.provinces.length - 1 }),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 0, max: 1 }),
        (at, victories, byPlayer) => {
          G.world.provinces.forEach((p) => {
            delete p['_terrorStacks'];
            delete p['_terrorTurn'];
            delete p['_terrorisedBy'];
            delete p['_terrorPct'];
          });
          const P = G.world.provinces[at];
          if (!P) throw new Error('no province ' + String(at));
          for (let i = 0; i < victories; i++) spreadTerror(tc, P, byPlayer, null);
          for (const q of [P, ...neighbours(P)]) {
            expect(q['_terrorStacks'] ?? 0).toBe(Math.min(max, victories));
            expect(q['_terrorisedBy'] ?? byPlayer).toBe(byPlayer);
          }
        },
      ),
      { examples: [[0, 5, 0]] },
    );
  });
});

describe('resolvePendingSkillGain', () => {
  const resolvePendingSkillGain = engineFn(engine, 'resolvePendingSkillGain') as (t: TurnContext, real: Hero) => void;
  const SKILLS = Object.keys(vm.runInContext('SKILL_LABELS', engine) as Record<string, string>);
  const hero = G.characters.find((c) => c.alive && c.player != null);
  if (!hero) throw new Error('the world has no living hero of a realm');
  const levels = fc.dictionary(fc.constantFrom(...SKILLS), fc.integer({ min: 0, max: 9 }));
  const candidates = fc.uniqueArray(fc.constantFrom(...SKILLS), { minLength: 1, maxLength: 4 });

  test('at most one skill rises, a candidate, by one level, never past 9, and is closed for the turn', () => {
    fc.assert(
      fc.property(levels, candidates, fc.integer({ min: 0, max: 4 }), (skills, list, phase) => {
        hero.skills = { ...skills };
        delete hero['_sgLog'];
        hero['_sgPending'] = { turn: G.turn, phase, list: list.map((skill) => ({ skill, phase })), done: false };
        resolvePendingSkillGain(tc, hero);
        const risen = SKILLS.filter((s) => (hero.skills[s] ?? 0) !== (skills[s] ?? 0));
        expect(risen.length).toBeLessThanOrEqual(1);
        expect(hero['_sgPending']).toBeNull();
        for (const s of risen) {
          expect(list).toContain(s);
          expect(hero.skills[s]).toBe((skills[s] ?? 0) + 1);
          expect(hero.skills[s]).toBeLessThanOrEqual(9);
          expect((hero['_sgLog'] as { turnSkills: Record<string, boolean> }).turnSkills[s]).toBe(true);
        }
      }),
      {
        examples: [
          [{ melee: 9 }, ['melee'], 0],
          [{ march: 2 }, ['march', 'naval'], 3],
        ],
      },
    );
  });
});

describe('recordBattleGraves', () => {
  const recordBattleGraves = engineFn(engine, 'recordBattleGraves') as (
    t: TurnContext,
    prov: Province,
    killedArmies: object[],
    ownerPlayer: number | null,
  ) => void;
  type Fallen = {
    type: string;
    quality: string;
    race: string;
    _isSkeletal: boolean;
    _phantom: boolean;
    _temporary: boolean;
    _elvenEscaped?: boolean;
  };
  const unit = fc.record({
    type: fc.constantFrom('Elven Archers', 'Shieldwall Levies', 'Orc Berserkers'),
    quality: fc.constantFrom('Green', 'Average', 'Elite'),
    race: fc.constantFrom('Elven', 'Human', 'Orc'),
    _isSkeletal: fc.boolean(),
    _phantom: fc.boolean(),
    _temporary: fc.boolean(),
  });

  test('each fallen unit leaves a grave or slips away home, never both; skeletons and doubles leave neither', () => {
    fc.assert(
      fc.property(
        fc.array(unit, { maxLength: 8 }),
        fc.constantFrom('Elven', 'Human'),
        fc.constantFrom('forest', 'plain', 'mountain'),
        (generated, ownerRace, terrain) => {
          const killed: Fallen[] = generated.map((a) => ({ ...a }));
          const owner = G.players[0];
          if (!owner) throw new Error('no realm 0');
          const was = owner.race;
          owner.race = ownerRace;
          const prov: Province = { id: 0, name: 'Testmere', terrain, battleGraves: [] };
          const queue = tc['_elvenEscapeQueue'] as unknown[];
          queue.length = 0;
          try {
            recordBattleGraves(tc, prov, killed, 0);
          } finally {
            owner.race = was;
          }
          const graves = prov['battleGraves'] as unknown[];
          const left = killed.filter((a) => !a._isSkeletal && !a._phantom);
          const fled = killed.filter((a) => a._elvenEscaped === true);
          expect(graves.length + queue.length).toBe(left.length);
          expect(queue.length).toBe(fled.length);
          for (const a of fled) {
            expect(ownerRace).toBe('Elven');
            expect(a.race).toBe('Elven');
            expect(a._temporary || a._isSkeletal || a._phantom).toBe(false);
          }
        },
      ),
    );
  });
});

// What no matrix game reaches in the graves' own functions (plan P1-10b19): a gap among a province's graves, a
// necromancer handed no state, and a realm's lore of a province no map holds.
describe('the graves where no game goes (takeBestGrave, senseGravesUnderfoot, graveIntelFor)', () => {
  test('a gap among the graves counts as an Average grave with no strength, so a real Average company rises first', () => {
    const takeBestGrave = engineFn(engine, 'takeBestGrave') as (prov: { battleGraves: unknown[] }) => unknown;
    const company = { type: 'Shieldwall Levies', quality: 'Average', race: 'Human', unitName: 'the Ashford Levy' };
    const prov = { battleGraves: [null, company] };
    expect(takeBestGrave(prov)).toBe(company);
    expect(prov.battleGraves).toEqual([null]);
  });

  test('a necromancer handed no state throws, as reading its realms did; a hero with no Necromancy senses nothing', () => {
    const senseGravesUnderfoot = engineFn(engine, 'senseGravesUnderfoot') as (
      state: null,
      c: object,
      pv: object,
      tell: null,
    ) => boolean;
    const pv = { id: 0, battleGraves: [{ type: 'Shieldwall Levies', quality: 'Average' }] };
    const necromancer = { alive: true, player: 0, skills: { necromancy: 1 }, items: [] };
    // (the engine's TypeError is the vm's own class: its name and words are compared)
    let thrown: unknown;
    try {
      senseGravesUnderfoot(null, necromancer, pv, null);
    } catch (e) {
      thrown = e;
    }
    expect(String(thrown)).toMatch(/^TypeError: Cannot read properties of .*\(reading 'players'\)$/);
    expect(senseGravesUnderfoot(null, { ...necromancer, skills: {} }, pv, null)).toBe(false);
  });

  test("a realm's lore of a province no map holds reads it as an unmapped province, latest first", () => {
    const graveIntelFor = engineFn(engine, 'graveIntelFor') as (gs: object, pl: object) => unknown;
    const rec = (turn: number) => ({ turn, detail: null, detailTurn: null, detailPartial: false });
    const lore = { _graveIntel: { '0': rec(2), '5': rec(6) } };
    expect(graveIntelFor({ world: { provinces: [{ name: 'Ashford' }] } }, lore)).toEqual([
      { provinceId: 5, name: 'an unmapped province', ...rec(6) },
      { provinceId: 0, name: 'Ashford', ...rec(2) },
    ]);
    expect(graveIntelFor({}, { _graveIntel: { '3': rec(4) } })).toEqual([
      { provinceId: 3, name: 'an unmapped province', ...rec(4) },
    ]);
  });
});
