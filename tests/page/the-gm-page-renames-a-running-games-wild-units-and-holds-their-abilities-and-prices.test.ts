// 2026-10-13 (the maintainer, Creatures and Monsters II): Giant Eagles became Thunderbirds, Kraken Tentacles Eldritch
// Kraken, and Leviathan Pods Dread Hydras. On the booted GM page:
// - unitAbilityMult: Thunderbirds carry no Stoop on the Archers against ranged (Storm Wings comes with the beast
//   abilities), the Eldritch Kraken keep Deepwater Grasp (×1.35 at sea), the Dread Hydras carry no always-on
//   multiplier (Many Heads comes with the beast abilities);
// - the master tables hold each new name's cost and move;
// - migrateLegacyUnitNames, as the turn runs it at the top of every turn, on a staged running game: a hero's companies
//   renamed (Leviathan Pods become Eldritch Kraken, a land beast being unable to swim), keeping their names and
//   quality; an eagle eyrie becomes a Thunderbird province (race, recruit pool, defenders, graves); Leviathan waters
//   become Kraken waters; Kraken waters keep their race; a humanoid province is untouched; a second run changes
//   nothing; and LEGACY_UNIT_RENAMES maps each old name to its new one.
//
// Level 4 (page): the GM page booted in jsdom (tests/lib/boot.ts) on the fake database (tests/lib/fake-db.ts). The rules
// are the engine's modules, and a unit test could call them there; but these calls are the last a test makes to four
// names the GM page keeps for its tests (src/ui/gm/globals.ts: ARMY_SPEED_MASTER, LEGACY_UNIT_RENAMES,
// migrateLegacyUnitNames, unitAbilityMult). Without them tests/static/page-globals.test.ts fails, and taking the names
// off is a change to src/, which plan P1-14z makes none of. When they leave the list, these checks move down beside the
// tables'. The page's dice are seeded from KC_SEED, and nothing here reads them.
//
// Until plan P1-14z these were the booted page's checks of tests/primal-renames.test.js, each kept as it was. Its checks
// on the tables are tests/unit/the-three-renamed-wild-units-carry-their-new-names-in-every-table-and-none-of-the-old.test.ts.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom, DB_VERSION, readPage, type PageWindow } from '../lib/boot.ts';
import { makeAFakeDb } from '../lib/fake-db.ts';
import { MIGRATED, RENAMED, ROSTER } from '../lib/primal-decided.ts';

const NEW = [...new Set(Object.values(RENAMED))];

/** A running game, as small as the migration reads it: a hero's companies, and four provinces. */
const aRunningGame = () => ({
  characters: [
    {
      id: 1,
      armies: [
        { type: 'Giant Eagles', quality: 'Veteran', race: 'Primal', unitName: 'the Stormcrest Wing' },
        { type: 'Kraken Tentacles', quality: 'Average', race: 'Primal' },
        { type: 'Leviathan Pods', quality: 'Elite', race: 'Primal' },
        { type: 'Shieldwall Levies', quality: 'Average', race: 'Human' },
      ],
    },
  ],
  world: {
    provinces: [
      {
        id: 0,
        terrain: 'mountain',
        race: 'Primal:Giant Eagle',
        armyTypes: ['Giant Eagles'],
        neutralDefenders: [{ type: 'Giant Eagles', quality: 'Average', race: 'Primal:Giant Eagle' }],
        garrisonArmies: [],
        battleGraves: [{ type: 'Giant Eagles', quality: 'Average' }],
      },
      {
        id: 1,
        terrain: 'sea',
        race: 'Primal:Leviathan',
        armyTypes: ['Leviathan Pods'],
        neutralDefenders: [{ type: 'Leviathan Pods', quality: 'Veteran', race: 'Primal' }],
        garrisonArmies: [{ type: 'Leviathan Pods', quality: 'Average', race: 'Primal' }],
        battleGraves: [],
      },
      {
        id: 2,
        terrain: 'sea',
        race: 'Primal:Kraken',
        armyTypes: ['Kraken Tentacles'],
        neutralDefenders: [],
        garrisonArmies: [],
        battleGraves: [],
      },
      {
        id: 3,
        terrain: 'forest',
        race: 'Elven',
        armyTypes: ['Forest Wardens', 'Elven Garrison'],
        neutralDefenders: [],
        garrisonArmies: [],
        battleGraves: [],
      },
    ],
  },
});
type ARunningGame = ReturnType<typeof aRunningGame>;

let GM: PageWindow;
const errors: string[] = [];
/** The page's code evaluated, or the words of what it threw. */
const onThePage = (code: string): unknown => {
  try {
    return GM.eval(code);
  } catch (e) {
    return 'THREW: ' + (e instanceof Error ? e.message : String(e));
  }
};

// Booted as the old script did: the errors its scripts throw are kept, its console is silenced, and it is given 1.2 s.
beforeAll(async () => {
  ({ window: GM } = bootJsdom(readPage('kingdoms-call-gm-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: makeAFakeDb([DB_VERSION]).db,
    url: 'https://example.org/gm',
    setup(w) {
      w.addEventListener('error', (e) => errors.push(e.error?.stack ?? e.message));
      w.console.error = () => undefined;
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }));
  await new Promise((resolve) => setTimeout(resolve, 1200));
});
afterAll(() => {
  GM.close();
});

test('the GM page boots', () => {
  expect(errors.map((error) => error.split('\n')[0])).toEqual([]);
});

describe('unitAbilityMult', () => {
  const mult = (type: string, terrain: string) =>
    onThePage(
      `unitAbilityMult({type:${JSON.stringify(type)},quality:'Average'},Object.assign({force:[],enemyForce:[{type:'Yeoman Longbows'}]},{}),${JSON.stringify(terrain)})`,
    );

  test('Thunderbirds carry no Stoop on the Archers multiplier against ranged (Storm Wings comes with the beast abilities)', () => {
    expect(mult('Thunderbirds', 'plain')).toBe(1);
  });

  test('Eldritch Kraken keep Deepwater Grasp ×1.35 at sea', () => {
    const atSea = mult('Eldritch Kraken', 'sea');
    expect(typeof atSea === 'number' && Math.abs(atSea - 1.35) < 1e-9, `got ${String(atSea)}`).toBe(true);
    expect(mult('Eldritch Kraken', 'plain')).toBe(1);
  });

  test('Dread Hydras carry no always-on multiplier (Many Heads comes with the beast abilities)', () => {
    expect(mult('Dread Hydras', 'jungle')).toBe(1);
    expect(mult('Dread Hydras', 'sea')).toBe(1);
  });
});

test.each(NEW)('%s: cost and speed in the master tables', (unit) => {
  expect(onThePage(`ARMY_COST_MASTER[${JSON.stringify(unit)}]`)).toBe(ROSTER[unit]?.cost);
  expect(onThePage(`ARMY_SPEED_MASTER[${JSON.stringify(unit)}]`)).toBe(ROSTER[unit]?.speed);
});

describe('migrateLegacyUnitNames on a staged running game, as the turn runs it at the top of every turn', () => {
  let game: ARunningGame;
  let threw: unknown;
  beforeAll(() => {
    game = aRunningGame();
    GM['__renameFixture'] = game;
    threw = onThePage(
      `(()=>{ const s=window.__renameFixture; try{ migrateLegacyUnitNames(s); }catch(e){ return e.message; } return null; })()`,
    );
  });
  const theProvince = (id: number) => {
    const province = game.world.provinces[id];
    if (!province) throw new Error(`no province ${String(id)} in the staged game`);
    return province;
  };
  const theArmies = () => game.characters[0]?.armies ?? [];

  test('runs on the staged game', () => {
    expect(threw).toBeNull();
  });

  test("a hero's companies: Giant Eagles → Thunderbirds, Kraken Tentacles and Leviathan Pods → Eldritch Kraken, humanoids untouched", () => {
    expect(theArmies().map((a) => a.type)).toEqual([
      'Thunderbirds',
      'Eldritch Kraken',
      'Eldritch Kraken',
      'Shieldwall Levies',
    ]);
  });

  test('a renamed company keeps its name and quality', () => {
    expect(theArmies()[0]?.unitName).toBe('the Stormcrest Wing');
    expect(theArmies()[0]?.quality).toBe('Veteran');
  });

  test('an eagle eyrie becomes a Thunderbird province: race, recruit pool, defenders, graves', () => {
    const eyrie = theProvince(0);
    expect(eyrie.race).toBe('Primal:Thunderbird');
    expect(eyrie.armyTypes).toEqual(['Thunderbirds']);
    expect(eyrie.neutralDefenders[0]).toMatchObject({ type: 'Thunderbirds', race: 'Primal:Thunderbird' });
    expect(eyrie.battleGraves[0]?.type).toBe('Thunderbirds');
  });

  test('Leviathan waters become Kraken waters, their pods Eldritch Kraken', () => {
    const waters = theProvince(1);
    expect(waters.race).toBe('Primal:Kraken');
    expect(waters.armyTypes).toEqual(['Eldritch Kraken']);
    expect(waters.neutralDefenders[0]?.type).toBe('Eldritch Kraken');
    expect(waters.garrisonArmies[0]?.type).toBe('Eldritch Kraken');
  });

  test('Kraken waters keep their race and recruit Eldritch Kraken', () => {
    expect(theProvince(2).race).toBe('Primal:Kraken');
    expect(theProvince(2).armyTypes).toEqual(['Eldritch Kraken']);
  });

  test('a humanoid province is untouched', () => {
    expect(theProvince(3).race).toBe('Elven');
    expect(theProvince(3).armyTypes).toEqual(['Forest Wardens', 'Elven Garrison']);
  });

  test('running the migration again changes nothing (it runs every turn)', () => {
    const again = onThePage(
      `(()=>{ const s=window.__renameFixture; migrateLegacyUnitNames(s); return s.characters[0].armies.map(a=>a.type).join(); })()`,
    );
    expect(again).toBe('Thunderbirds,Eldritch Kraken,Eldritch Kraken,Shieldwall Levies');
  });
});

test.each(Object.entries(MIGRATED))('LEGACY_UNIT_RENAMES maps %s → %s', (old, renamed) => {
  expect(onThePage(`LEGACY_UNIT_RENAMES[${JSON.stringify(old)}]`)).toBe(renamed);
});
