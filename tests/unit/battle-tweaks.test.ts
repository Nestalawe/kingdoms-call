// Small battle rulings of 2026-10-12 (Toby's batch), one block each:
//   • Reign of Fear fires only when attacking: an Evil realm's Monsters fight ×1.5 on ground its own Terror grips when
//     they ATTACK there, and at ×1 when they defend it.
//   • Purity breaks a Spear Hedge or a Boulder Wall: the Unicorn Herd facing Shieldwall Levies or Stone Giants keeps
//     cavalry's matchup (×0.85 facing foot, ×1.25 more facing skeletons) instead of the ×0.75 cap other horse meets.
//   • Item 19 (ruling R-100): every flyer (the winged riders and the flying beasts) fights at ×0.75 in forest and
//     jungle, and still at ×1 on open ground, in the mountains and over the sea.
// Level 1 (unit): armStr and terrainMod (src/engine/battle/terrain-and-unit-strength.ts, plan P1-08b) and the battle
// grid and facing (module level) are called directly in the bare vm (tests/lib/engine.ts), on a world the engine
// makes. They were three blocks of tests/battle-tweaks.test.js, which ran one turn on the GM portal for the anchor
// hook to hand armStr back; the checks are the same. Its fourth block, Terror's three stacks, needs spreadTerror,
// still nested in resolveTurn: it is tests/terror-three-stacks.test.js until it moves (plan P1-08c).
import vm from 'node:vm';
import { afterAll, describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext } from '../lib/engine.ts';

const engine = loadEngine({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const tc = turnContext(engine, botWorld(engine, 2, { cols: 10, rows: 6 }));
type Trace = { reason: unknown }[];
/** The words the prose writes of a modifier armStr records on the strength ladder. */
const modifierWords = engineFn(engine, 'theWordsOfAUnitsModifier') as (reason: unknown) => string;
/** The words the prose writes of why a unit fights as it does (battleFaceSide's why). */
const facingWords = engineFn(engine, 'theWordsOfWhyAUnitFacesAsItDoes') as (why: unknown) => string;
type StrengthContext = {
  force: unknown[];
  enemyForce: unknown[];
  isAttacker?: boolean;
  reignOfFear?: boolean;
  trace?: Trace;
};
const armStr = engineFn(engine, 'armStr') as (
  t: typeof tc,
  army: object,
  heroChar: null,
  playerAlignment: string,
  terrain: string,
  ctx: StrengthContext,
) => number;
const terrainMod = engineFn(engine, 'terrainMod') as (armyType: string, terrain: string) => number;
const unit = (type: string, extra: object = {}) =>
  Object.assign({ type, quality: 'Average', race: 'Primal', unitName: 'the Test ' + type }, extra);
const str = (type: string, align: string, terrain: string, ctx: Partial<StrengthContext> = {}) =>
  armStr(tc, unit(type), null, align, terrain, Object.assign({ force: [], enemyForce: [] }, ctx));
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe('Reign of Fear: only when attacking', () => {
  const RF = vm.runInContext('REIGN_OF_FEAR_MULT', engine) as number;
  test(`attacking on its own terrorised ground, an Evil host's Cave Trolls fight ×${String(RF)}`, () => {
    const base = str('Cave Trolls', 'Evil', 'plain', { isAttacker: true });
    const atk = str('Cave Trolls', 'Evil', 'plain', { isAttacker: true, reignOfFear: true });
    expect(base).toBeGreaterThan(0);
    expect(atk).toBe(Math.round(base * RF));
  });
  test('defending that ground, they fight with no Reign of Fear, and the ladder does not name it', () => {
    const def = str('Cave Trolls', 'Evil', 'plain', { isAttacker: false, reignOfFear: true });
    const defBase = str('Cave Trolls', 'Evil', 'plain', { isAttacker: false });
    expect(near(def, defBase), `got ${String(def)}, without it ${String(defBase)}`).toBe(true);
    const trace: Trace = [];
    str('Cave Trolls', 'Evil', 'plain', { isAttacker: false, reignOfFear: true, trace });
    expect(trace.map((t) => modifierWords(t.reason)).join('; ')).not.toMatch(/Reign of Fear/);
  });
});

describe('Purity breaks a Spear Hedge or a Boulder Wall', () => {
  type Row = { a: Record<string, unknown>; base: number };
  type Grid = { face: { units: { row: Row; m: number; why: unknown }[] } };
  const grid = engineFn(engine, 'battleGrid') as (rows: Row[], width: number, terrain: string, opts: object) => Grid;
  const facing = engineFn(engine, 'battleFacing') as (me: Grid, them: Grid, terrain: string) => void;
  const BASE: Record<string, number> = {
    'Shieldwall Levies': 8,
    'Stone Giants': 26,
    'Unicorn Herd': 26,
    'Free Lances': 10,
  };
  type Spec = [string, number, object?][];
  const rows = (spec: Spec): Row[] =>
    spec.flatMap(([t, n, x]) =>
      Array.from({ length: n }, () => ({
        a: Object.assign({ type: t, quality: 'Average', unitName: t }, x ?? {}),
        base: BASE[t] ?? 8,
      })),
    );
  const fight = (mine: Spec, theirs: Spec) => {
    const me = grid(rows(mine), 2, 'forest', { tac: 0, enemy: rows(theirs), enemyTac: 0 });
    const them = grid(rows(theirs), 2, 'forest', { tac: 0, enemy: rows(mine), enemyTac: 0 });
    facing(me, them, 'forest');
    return me;
  };
  const faced = (g: Grid, type: string) => g.face.units.filter((u) => u.row.a['type'] === type);

  test("unicorns facing Levies keep cavalry's ×0.85: Purity breaks the Spear Hedge", () => {
    const u = faced(fight([['Unicorn Herd', 2]], [['Shieldwall Levies', 2]]), 'Unicorn Herd');
    expect(u).toHaveLength(2);
    for (const x of u)
      expect(near(x.m, 0.85) && /Purity breaks the Spear Hedge/.test(facingWords(x.why)), facingWords(x.why)).toBe(
        true,
      );
  });
  test("unicorns facing Stone Giants keep cavalry's ×0.85: Purity breaks the Boulder Wall", () => {
    const u = faced(fight([['Unicorn Herd', 2]], [['Stone Giants', 2]]), 'Unicorn Herd');
    expect(u).toHaveLength(2);
    for (const x of u)
      expect(near(x.m, 0.85) && /Purity breaks the Boulder Wall/.test(facingWords(x.why)), facingWords(x.why)).toBe(
        true,
      );
  });
  test('facing skeletal Levies the pure charge is not capped: ×0.85 × ×1.25', () => {
    const u = faced(fight([['Unicorn Herd', 2]], [['Shieldwall Levies', 2, { _isSkeletal: true }]]), 'Unicorn Herd');
    for (const x of u)
      expect(
        near(x.m, 0.85 * 1.25) && /Purity breaks the Spear Hedge/.test(facingWords(x.why)),
        facingWords(x.why),
      ).toBe(true);
  });
  test('other horse still meets the Spear Hedge and the Boulder Wall at ×0.75', () => {
    for (const x of faced(fight([['Free Lances', 2]], [['Shieldwall Levies', 2]]), 'Free Lances'))
      expect(
        near(x.m, 0.75) && /Spear Hedge/.test(facingWords(x.why)) && !/Purity/.test(facingWords(x.why)),
        facingWords(x.why),
      ).toBe(true);
    for (const x of faced(fight([['Free Lances', 2]], [['Stone Giants', 2]]), 'Free Lances'))
      expect(near(x.m, 0.75) && /Boulder Wall/.test(facingWords(x.why)), facingWords(x.why)).toBe(true);
  });
});

describe('Item 19: flyers fight ×0.75 in forest and jungle', () => {
  const AER = vm.runInContext('KC_UNIT_CLASS.aerial', engine) as string[];
  test('the flyers are read', () => {
    expect(AER.length).toBeGreaterThanOrEqual(8);
  });
  test.each(AER)(
    '%s fight at ×0.75 in forest and jungle, and at ×1 on the plain, in the desert, the mountains and at sea',
    (t) => {
      expect(near(terrainMod(t, 'forest'), 0.75) && near(terrainMod(t, 'jungle'), 0.75)).toBe(true);
      for (const tr of ['plain', 'desert', 'mountain', 'sea']) expect(near(terrainMod(t, tr), 1), tr).toBe(true);
    },
  );
  test("an Eagle Riders company's strength in the jungle is three quarters of its strength on the plain", () => {
    const open = armStr(tc, unit('Eagle Riders', { race: 'Elven' }), null, 'Neutral', 'plain', {
      force: [],
      enemyForce: [],
      isAttacker: true,
    });
    const wood = armStr(tc, unit('Eagle Riders', { race: 'Elven' }), null, 'Neutral', 'jungle', {
      force: [],
      enemyForce: [],
      isAttacker: true,
    });
    expect(open).toBeGreaterThan(0);
    expect(wood).toBe(Math.floor(open * 0.75));
  });
  test("the strength ladder names the forest's ×0.75 on a dragon", () => {
    const trace: Trace = [];
    armStr(tc, unit('Elder Dragons'), null, 'Evil', 'forest', { force: [], enemyForce: [], isAttacker: true, trace });
    expect(trace.map((t) => modifierWords(t.reason)).join('; ')).toMatch(/forest terrain ×0\.75/);
  });
});
