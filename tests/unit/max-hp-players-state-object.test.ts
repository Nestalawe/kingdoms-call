// The realms the max-HP helpers fall back on when they are given none (plan P1-09b): `maxHpPlayers`, one state object
// in src/engine/heroes/skills-and-hp.ts. It was a top-level `let`, _MAXHP_PLAYERS, that two other files assigned (world
// generation, and the turn's stage after the phases); once the engine is modules (P1-09d) no file may assign another's
// binding, so they set the object's one field instead. Here:
// - it is one object from the moment the engine loads, with no realms yet, and stays that object: only its field
//   changes;
// - a new world sets it to the world's realms (generateNewGame), and a turn's save upgrade to the turn's
//   (migrateMaxHpV2);
// - the helpers read it when they are given no realms: an Orc of an Orcish realm starts at 18 HP, another hero at 15,
//   and so does that Orc while it holds no realms.
// (The stage after the phases sets it too: tests/unit/after-the-phases-called-directly.test.ts.) Each check fails on a
// planted fault: world generation not setting the field, the save upgrade not setting it, a helper not reading it.
// Level 1 (unit): the engine alone, in the bare vm (tests/lib/engine.ts).
import vm from 'node:vm';
import { describe, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine } from '../lib/engine.ts';

interface Realm {
  race?: string;
}

describe('maxHpPlayers, the realms the max-HP helpers fall back on', () => {
  const engine = loadEngine({ seed: 1 });
  const holder = () => vm.runInContext('maxHpPlayers', engine) as { players: Realm[] | null };
  const first = holder();

  test('it is one object as the engine loads, holding no realms yet', () => {
    expect(first).toEqual({ players: null });
  });

  test("a new world sets it to the world's realms", () => {
    const world = JSON.parse(botWorld(engine, 3, { cols: 10, rows: 6 })) as { players: Realm[] };
    expect(holder()).toBe(first);
    expect(JSON.stringify(first.players)).toBe(JSON.stringify(world.players));
  });

  test("a turn's save upgrade sets it to the turn's realms", () => {
    const save = (vm.runInContext('(j)=>JSON.parse(j)', engine) as (j: string) => { players: Realm[] })(
      botWorld(engine, 2, { cols: 10, rows: 6 }),
    );
    (engineFn(engine, 'migrateMaxHpV2') as (gs: unknown) => void)(save);
    expect(holder()).toBe(first);
    expect(first.players).toBe(save.players);
  });

  test('the helpers read it when they are given no realms', () => {
    const computeMaxHp = engineFn(engine, 'computeMaxHp') as (ch: unknown, players?: unknown) => number;
    const orc = { race: 'Orcish', player: 0, hpEarned: 0, items: [] };
    const elf = { race: 'Elven', player: 0, hpEarned: 0, items: [] };
    first.players = [{ race: 'Orcish' }];
    expect([computeMaxHp(orc), computeMaxHp(elf)]).toEqual([18, 15]);
    first.players = null;
    expect(computeMaxHp(orc)).toBe(15);
    expect(computeMaxHp(orc, [{ race: 'Orcish' }]), 'given the realms, it reads those').toBe(18);
  });
});
