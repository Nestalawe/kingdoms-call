// R-145: a new game's guardians have the hit points the guardian table gives them, and a game already running keeps
// its guardians as they are, even where they stand 5 HP below the table. Until P1-23l, world generation left a new
// world unmarked, so the save's upgrade (upgradeGameState, src/engine/saves/upgrade-a-saved-game-and-check-it.ts) cut
// every guardian of it by 5 HP on its first turn: a cut meant once for the games running on 15 September.
// - A new world, as world generation makes it, holds each guardian at its table row's HP, and is marked as needing no
//   cut; through the upgrade its first turn runs (a world of 2 realms and one of 4), every guardian keeps the table's
//   HP, and the upgrade cuts none.
// - A running game's save (one that has played its turns: marked so by its first turn's upgrade), its first lair's
//   guardian staged as a Dracolich cut to 49 of the table's 54, its HP and undamaged HP both: through the upgrade,
//   every guardian of the world reads the same, the Dracolich at 49, and the upgrade cuts none.
// The worlds are made by world generation from KC_SEED; each case reads every guardian the world holds (a world always
// has its 22 Legendary lairs), so no seed can miss it. Level 1 (unit): world generation and the upgrade, called
// directly on the engine's modules; no turn is played, since the cut is the upgrade's alone. Not static: it runs them.
import { describe, expect, test } from 'vitest';
import '../lib/the-whole-engine.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { generateBotSetups } from '../../src/engine/bots/setup.ts';
import { kcRng } from '../../src/engine/rng.ts';
import { MONSTERS_P } from '../../src/content/kingdoms-call-data.ts';
import { upgradeGameState } from '../../src/engine/saves/upgrade-a-saved-game-and-check-it.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** A save as the upgrade takes it. */
type Save = Parameters<typeof upgradeGameState>[0];

/** A new world of `realms` bot realms on a map of `cols` by `rows`, from the seed, as a save holds it. */
function newWorld(realms: number, cols: number, rows: number): Save {
  kcRng.seed(SEED);
  const setups = generateBotSetups([], realms, 0).map((b) => ({
    ...b,
    gamePlayerId: 'gp' + String(b.id),
    name: b.kingdomName,
  }));
  return JSON.parse(JSON.stringify(generateNewGame(setups, { cols, rows }, 0, {}))) as Save;
}
/** Every lair's guardian of the world (a ritual site's keeper aside), in the map's order. */
const guardiansOf = (s: Save) =>
  s.world.provinces
    .flatMap((p) => p.features)
    .filter((f) => f.monster && !f.ritualSite)
    .map((f) => f.monster);
/** Each guardian's name, HP and undamaged HP, in the map's order. */
const hpOf = (s: Save) => guardiansOf(s).map((m) => [m?.name, m?.hp, m?._hpFull]);
/** The HP the guardian table gives the guardian of that name. */
const tableHp = (name: string | undefined) => MONSTERS_P.find((m) => m.name === name)?.hp;
/** Each guardian's name and its table row's HP, in the map's order, undamaged (no undamaged total held yet). */
const tableHpOf = (s: Save) => guardiansOf(s).map((m) => [m?.name, tableHp(m?.name), undefined]);

describe("R-145: a new game's guardians have the guardian table's HP", () => {
  test.each([
    [2, 8, 5],
    [4, 12, 8],
  ])('%i realms on %i by %i: every guardian at its table row HP, before its first turn and after', (r, c, w) => {
    const world = newWorld(r, c, w);
    expect(guardiansOf(world).length).toBeGreaterThanOrEqual(22);
    expect(hpOf(world)).toEqual(tableHpOf(world));
    const marked = world._guardianHpV2;
    const found = upgradeGameState(world);
    expect(hpOf(world)).toEqual(tableHpOf(world));
    expect(found.guardiansCut).toBe(0);
    expect(marked).toBe(true);
  });
});

describe('R-145: a running game keeps its guardians as they are', () => {
  test('a Dracolich cut to 49 of 54 keeps 49, and every other guardian its HP', () => {
    const running = newWorld(3, 10, 8);
    running._guardianHpV2 = true; // its first turn's upgrade marked it
    running.turn = 6;
    const dracolich = MONSTERS_P.find((m) => m.name === 'Dracolich');
    expect(dracolich?.hp).toBe(54);
    const lair = running.world.provinces.flatMap((p) => p.features).find((f) => f.monster && !f.ritualSite);
    if (!lair) throw new Error('the world has no lair');
    lair.monster = { ...structuredClone(dracolich), hp: 49, _hpFull: 49 } as typeof lair.monster;
    const before = hpOf(running);
    const found = upgradeGameState(running);
    expect(found.guardiansCut).toBe(0);
    expect(hpOf(running)).toEqual(before);
    expect(hpOf(running)[0]).toEqual(['Dracolich', 49, 49]);
  });
});
