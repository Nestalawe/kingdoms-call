// The three marks a realm's alignment leaves on a province (consecrated ground, Terror, Enslave), each read, laid,
// lifted and faded as the turn does it, and each with its own wipe: consecration wiped at capture, Terror spent at the
// next battle there, Enslave faded with the turns. Since plan P1-19ay2 the marks' module
// (src/engine/world/the-marks-on-a-province-consecrated-ground-terror-and-enslave.ts) holds every read and write; these
// cases call the callers the turn calls (spreadTerror, consumeTerror, breakConsecrationOnCapture, applyEvilConquest)
// and the reads, so each passes on the base before the move and on the row.
// Level 1 (unit): each case stages a province and a realm and calls one function; a static test can't run one, and no
// matrix game reaches a realm lifting its own Terror. Pinned elsewhere, and not repeated: Consecrate's lay
// (`recruit-hire-and-realm-works-orders-called-directly`), its fade as the season closes (`after-the-phases-called-directly`),
// its spend at a Divine return (`new-turn-war-academy-to-the-final-reconcile-called-directly`), Enslave's read and fade
// (`lib/early-winter-cases.ts`), Terror's three stacks (`terror-three-stacks`).
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { kcRng } from '../../src/engine/rng.ts';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import { consumeTerror, spreadTerror } from '../../src/engine/battle/evil-terror.ts';
import { applyEvilConquest, breakConsecrationOnCapture } from '../../src/engine/realms/relations-and-captures.ts';
import {
  consecratedIds,
  isConsecrated,
  provinceConsecrated,
  reignOfFearHere,
} from '../../src/engine/world/the-marks-on-a-province-consecrated-ground-terror-and-enslave.ts';

type Obj = Record<string, unknown>;

// The GM's log echoes each line on the console: quiet while the test writes lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

/** A turn's context on a staged state, with what emit reads. */
function aTurn(G: Obj): TurnContext {
  const tc = createTurnContext(G, [], 3) as unknown as TurnContext;
  Object.assign(tc, {
    _logCtx: { charId: null, phase: null },
    _currentPhase: null,
    _afterPhases: false,
    _tel: { pre: {}, orders: {}, factsInTheTurnsOrder: [] },
    SEASONS: ['Spring', 'Summer', 'Autumn', 'Late Autumn', 'Winter'],
    _intrusionAcc: new Map(),
  });
  return tc;
}
/** A 3 by 3 map of plains, each province its own realm's or no one's. */
function aMap(owners: (number | null)[]): Obj[] {
  return owners.map((owner, id) => ({
    id,
    name: `Field ${String(id)}`,
    row: Math.floor(id / 3),
    col: id % 3,
    terrain: 'plain',
    owner,
    tax: 3,
    characters: [],
  }));
}
/** Runs `fn` with the dice fixed at `value`. */
function withDice<T>(value: number, fn: () => T): T {
  const was = kcRng.use(() => value);
  try {
    return fn();
  } finally {
    kcRng.use(was);
  }
}

describe('consecrated ground', () => {
  test('read: a realm with no list is handed an empty one, kept on it; a province is consecrated by its owner only', () => {
    const realm: Obj = { name: 'Esterhold', alignment: 'Divine' };
    expect(isConsecrated(realm, 4)).toBe(false);
    expect(realm['consecratedProvIds']).toEqual([]);
    expect(consecratedIds(realm)).toBe(realm['consecratedProvIds']);
    expect(consecratedIds(null)).toEqual([]);
    const players = [{ consecratedProvIds: [4] }, { consecratedProvIds: [] }];
    expect(provinceConsecrated({ players }, { id: 4, owner: 0 })).toBe(true);
    expect(provinceConsecrated({ players }, { id: 4, owner: 1 })).toBe(false);
    expect(provinceConsecrated({ players }, { id: 4, owner: null })).toBe(false);
  });
  test("wiped at capture: the province leaves its old realm's list, the others stay in order, one line to that realm", () => {
    const realm = { name: 'Esterhold', alignment: 'Divine', consecratedProvIds: [2, 5, 7] };
    const tc = aTurn({ turn: 4, players: [realm, { name: 'Varn', alignment: 'Evil' }], characters: [] });
    breakConsecrationOnCapture(tc, { id: 5, name: 'Wendmeadow' }, 0, 1, null, 2);
    expect(realm.consecratedProvIds).toEqual([2, 7]);
    expect(tc.turnLog).toHaveLength(1);
    // a province not on the list: nothing lifted, nothing told
    breakConsecrationOnCapture(tc, { id: 9, name: 'Thornfield' }, 0, 1, null, 2);
    expect(realm.consecratedProvIds).toEqual([2, 7]);
    expect(tc.turnLog).toHaveLength(1);
  });
});

describe('Terror', () => {
  const aWorldOfTerror = () => {
    const provinces = aMap([0, 1, 1, 1, 1, 1, 1, 1, 1]);
    const G = { turn: 6, players: [{ name: 'Varn', alignment: 'Evil' }, { name: 'Esterhold' }], characters: [] };
    const tc = aTurn({ ...G, world: { cols: 3, rows: 3, provinces } });
    return { tc, provinces };
  };
  test("laid: the battle's province and each beside it take a stack, this turn's, by the victor, at a tenth a stack", () => {
    const { tc, provinces } = aWorldOfTerror();
    const field = provinces[4] ?? {};
    spreadTerror(tc, field as never, 0, null);
    const marked = provinces.filter((p) => p['_terrorStacks'] === 1);
    expect(marked.length).toBeGreaterThan(1);
    expect(marked).toContain(field);
    for (const p of marked) expect(p).toMatchObject({ _terrorTurn: 6, _terrorisedBy: 0, _terrorPct: 0.1 });
  });
  test('read: Terror grips a province for the realm that laid it only, while a stack is there', () => {
    const prov = { _terrorStacks: 2, _terrorisedBy: 0 };
    expect(reignOfFearHere(prov as never, 0)).toBe(true);
    expect(reignOfFearHere(prov as never, 1)).toBe(false);
    expect(reignOfFearHere(prov as never, null)).toBe(false);
    expect(reignOfFearHere({ _terrorStacks: 0, _terrorisedBy: 0 } as never, 0)).toBe(false);
    expect(reignOfFearHere(null, 0)).toBe(false);
  });
  test('spent at the next battle there: the defenders fight at 1 less its share, and every field of it goes', () => {
    const prov: Obj = {
      name: 'Wendmeadow',
      owner: 1,
      _terrorStacks: 2,
      _terrorTurn: 5,
      _terrorisedBy: 0,
      _terrorPct: 0.1,
    };
    const defenders: Obj[] = [{ type: 'Shieldwall Levies', quality: 'Average' }];
    expect(consumeTerror(prov as never, defenders as never, [])).toBe(true);
    expect(defenders[0]?.['_terrorMult']).toBe(0.8);
    expect(Object.keys(prov).sort()).toEqual(['name', 'owner']);
  });
  test('lifted unspent where its own realm now holds the province: no defender shaken, its share a stack left', () => {
    const prov: Obj = {
      name: 'Wendmeadow',
      owner: 0,
      _terrorStacks: 2,
      _terrorTurn: 5,
      _terrorisedBy: 0,
      _terrorPct: 0.1,
    };
    const defenders: Obj[] = [{ type: 'Shieldwall Levies', quality: 'Average' }];
    expect(consumeTerror(prov as never, defenders as never, [])).toBe(false);
    expect(defenders[0]).not.toHaveProperty('_terrorMult');
    expect(prov).toEqual({ name: 'Wendmeadow', owner: 0, _terrorPct: 0.1 });
  });
  test('no Terror, or a stack with no turn: nothing spent', () => {
    const prov: Obj = { name: 'Wendmeadow', owner: 1, _terrorStacks: 2 };
    expect(consumeTerror(prov as never, [], [])).toBe(false);
    expect(prov['_terrorStacks']).toBe(2);
  });
});

describe('Enslave', () => {
  const conquer = (evilMode: string) => {
    const realm = { name: 'Varn', alignment: 'Evil', gold: 10 };
    const tc = aTurn({ turn: 6, players: [realm], characters: [] });
    const p: Obj = { id: 2, name: 'Wendmeadow', terrain: 'plain', tax: 4 };
    withDice(0, () => {
      applyEvilConquest(tc, { name: 'Thorn', player: 0, encounterPlan: { evilMode } }, p as never, realm);
    });
    return p;
  };
  test('laid by an enslaving conquest: the province pays less to three turns on; a Terror conquest lays none', () => {
    expect(conquer('enslave')['_enslavedUntil']).toBe(9);
    expect(conquer('terror')).not.toHaveProperty('_enslavedUntil');
  });
});
