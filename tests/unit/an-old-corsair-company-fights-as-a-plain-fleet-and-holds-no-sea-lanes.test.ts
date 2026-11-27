// An old Corsair company fights as a plain fleet (R-147): a running game's save can still hold a Corsair Fleet raised
// before the unit was retired (R-109), and it has lost its two old abilities. Cut the Line (between heroes, a winner
// at least half Corsairs closed the sea to the beaten) and Keep the Sea Lanes (against neutral guards, a force at least
// half Corsairs kept its way back to the ships) are gone: no force of Corsairs holds the sea lanes in either battle,
// and no ability row names the unit. A staged battle between heroes plays it: the winner's host is half Corsair Fleets
// and half Men-at-Arms, all Elite, against one Green company, and the loser could fall back to a sea or a land
// province (the registry's retreatOptions stood in, as no world puts both beside a free plain on demand). The battle
// writes no line of corsairs closing the sea lanes. Before R-147 was built it did.
// Level 1 (unit): the registry's runner called directly, and combatVsChar on a world the engine makes from a fixed
// seed, its dice a fixed stream (kcRngStream(7)); no turn is played. Not lower: the line sits inside combatVsChar.
// Not higher: a whole turn adds dice and orders before the battle, and no realm raises a Corsair company any more.
import '../lib/the-whole-engine.ts';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { UNIT_ABILITIES_THE_REGISTRY_HOLDS } from '../../src/content/unit-abilities-their-names-numbers-and-words.ts';
import { kcRng, kcRngStream } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { combatVsChar } from '../../src/engine/battle/battles-between-heroes.ts';
import { aForceHoldsTheSeaLanes } from '../../src/engine/rules/the-registry-of-content-effects.ts';
import * as retreats from '../../src/engine/units/sea-lift-stranding-and-retreats.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';

// The GM's log echoes each line on the console: quiet while the battle writes lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});
afterEach(() => {
  vi.restoreAllMocks();
});

interface Character {
  id: number | string;
  name: string;
  player: number | null;
  isKing?: boolean;
  alive: boolean;
  location: number;
  armies: ArmyInABattle[];
  encounterPlan?: { tactics: string[]; duelStance: string };
  [key: string]: unknown;
}
interface Province {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters: (number | string)[];
  [key: string]: unknown;
}
interface World {
  relations: Record<string, string>;
  characters: Character[];
  world: { provinces: Province[] };
}

/** `n` Human companies of the type and quality given. */
const companies = (n: number, type: string, quality: string): ArmyInABattle[] =>
  Array.from({ length: n }, (_, i) => ({ type, quality, race: 'Human', unitName: `${type} ${String(i)}` }));

describe('an old Corsair company fights as a plain fleet (R-147)', () => {
  test('no force of Corsair Fleets holds the sea lanes, between heroes or against neutral guards', () => {
    const theForce = companies(4, 'Corsair Fleet', 'Elite');
    expect(aForceHoldsTheSeaLanes({ theForce, theBattle: 'between heroes' })).toBe(false);
    expect(aForceHoldsTheSeaLanes({ theForce, theBattle: 'a hero against neutral guards' })).toBe(false);
  });

  test('no ability row names the Corsair Fleet', () => {
    expect(Object.values(UNIT_ABILITIES_THE_REGISTRY_HOLDS).filter((row) => row.unit === 'Corsair Fleet')).toEqual([]);
  });

  test("a winning host half Corsairs leaves the beaten the sea: no line of the winner's corsairs closing it", () => {
    kcRng.seed(1);
    const G = JSON.parse(
      JSON.stringify(
        generateNewGame(
          generateBotSetups([], 2, 0).map((b) => ({ ...b, gamePlayerId: 'gp' + String(b.id), name: b.kingdomName })),
          { cols: 10, rows: 6 },
          999,
          { seaPct: 10 },
        ),
      ),
    ) as World;
    const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
    tc._currentPhase = 1;
    tc._logCtx.phase = 1;
    G.relations['0-1'] = 'enemy';
    const [atk, def] = [0, 1].map((p) => G.characters.find((c) => c.alive && c.player === p && c.isKing));
    const field = G.world.provinces.find((p) => p.terrain === 'plain' && p.owner === null);
    const sea = G.world.provinces.find((p) => p.terrain === 'sea');
    const land = G.world.provinces.find((p) => p.terrain !== 'sea' && p.id !== field?.id);
    if (!atk || !def || !field || !sea || !land) throw new Error('the world lacks a king, a free plain, a sea or land');
    Object.assign(field, { characters: [], features: [], garrisonArmies: [], npcArmies: 0 });
    for (const c of [atk, def]) {
      const from = G.world.provinces[c.location];
      if (from) from.characters = from.characters.filter((id) => id !== c.id);
      c.location = field.id;
      field.characters.push(c.id);
      c.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
    }
    atk.armies = [...companies(4, 'Corsair Fleet', 'Elite'), ...companies(4, 'Men-at-Arms', 'Elite')];
    def.armies = companies(1, 'Men-at-Arms', 'Green');
    vi.spyOn(retreats, 'retreatOptions').mockReturnValue([sea, land] as unknown as ReturnType<
      typeof retreats.retreatOptions
    >);
    const was = kcRng.use(kcRngStream(7));
    let narrative: NarrativeLine[];
    try {
      narrative = (
        combatVsChar(...([tc, atk, def, field] as unknown as Parameters<typeof combatVsChar>)) as {
          narrative: NarrativeLine[];
        }
      ).narrative;
    } finally {
      kcRng.use(was);
    }
    const words = narrative.map((l) => theWordsOf(l));
    expect(words.filter((w) => w.includes('corsairs close the sea lanes'))).toEqual([]);
  });
});
