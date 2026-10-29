// The battles' items no matrix game carries keep their values (plan P1-19's items family, row P1-19n): a commander's
// Banner of the Realm makes the defenders' position fight ×1.25 when he defends his realm's home, and not in another
// province of his; a commander's Quiver of the Hawk makes each missile unit he leads loose two volleys instead of one,
// in a battle between heroes and against neutral guards. The 60 games of the balance matrix carry neither (a planted
// home defence ×1.2, or a Quiver of the Hawk that adds no volley, leaves all 60 identical), so these say what they do.
//
// The staging is certain on every world: two realms at war, neither Good (so no Righteous Defence), with no discoveries
// (so no siegecraft and no realm's own-ground bonus); the attacker marches into the province next door. The defender's
// position is read from his strength ladder ("× defender's position ×…"); the volleys are the shot lines of the one
// missile company the attacker leads (four companies stand against it, so no volley finds the pool empty).
//
// Level 2 (scenario): both sit inside combatVsChar and combatVsNPC, which no unit call stages cheaply (a battle's world
// and its turn's context), so each battle is played in a whole turn on the engine's modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts, plan P1-14a), on a world made from KC_SEED.
import { describe, expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan, type Line } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Unit {
  type: string;
  quality: string;
  unitName: string;
}
interface Character {
  id: number;
  name: string;
  player: number | null;
  alive?: boolean;
  isKing?: boolean;
  location?: number;
  locationName?: string;
  armies?: Unit[];
  items?: unknown[];
  encounterPlan?: { tactics: string[]; duelStance: string };
}
interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner?: number | null;
  characters?: number[];
  [key: string]: unknown;
}
interface Realm {
  provinces: number[];
  homeProvinceId?: number | null;
  discoveries?: unknown[];
  [key: string]: unknown;
}
interface Staged {
  relations?: Record<string, string>;
  players: Realm[];
  characters: Character[];
  world: { cols: number; rows: number; provinces: Province[] };
}

/** Where the battle is fought: the defender's home, another province of his realm's, or a free province of neutral
 *  guards. */
type TheGround = "the defender's home" | "another province of the defender's realm" | 'a province of neutral guards';

/** One turn in which realm 0's king marches into the province next door and fights there: against realm 1's king (the
 *  defender) at the ground given, or against four companies of neutral guards. The attacker leads three Men-at-Arms
 *  and one company of Yeoman Longbows, `the Hawkwatch`, and carries `attackersItem`; the defender leads three
 *  Men-at-Arms and carries `defendersItem`. */
async function aBattle(ground: TheGround, items: { attackersItem?: string; defendersItem?: string }) {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const { ALL_MAGIC_ITEMS_P } = await import('../../src/content/kingdoms-call-data.ts');
  const theItem = (name: string | undefined) => {
    if (!name) return [];
    const item = ALL_MAGIC_ITEMS_P.find((it) => it.name === name);
    if (!item) throw new Error(`the content holds the ${name}`);
    return [{ ...item, id: 1, equipped: true }];
  };
  const neighbours = (S: Staged, p: Province) =>
    (getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | undefined)[]).filter(
      (q): q is Province => q != null && q.terrain !== 'sea',
    );
  const own = (S: Staged, p: Province, realm: number | null) => {
    S.players.forEach((pl) => {
      pl.provinces = pl.provinces.filter((id) => id !== p.id);
    });
    p.owner = realm;
    if (realm != null) S.players[realm]?.provinces.push(p.id);
    Object.assign(p, { features: [], garrisonArmies: [], neutralDefenders: [], npcArmies: 0 });
  };
  const place = (S: Staged, c: Character, p: Province) => {
    S.world.provinces.forEach((q) => {
      q.characters = (q.characters ?? []).filter((id) => id !== c.id);
    });
    p.characters = [...(p.characters ?? []), c.id];
    c.location = p.id;
    c.locationName = p.name;
  };
  const companies = (type: string, names: string[]): Unit[] =>
    names.map((unitName) => ({ type, quality: 'Regular', unitName }));
  const r = sc.turn<Staged, { attacker: Character; battleground: Province }>({
    cols: 10,
    rows: 6,
    seaPct: 10,
    alignments: ['Neutral', 'Neutral'],
    prepare(S) {
      S.relations = { ...(S.relations ?? {}), '0-1': 'enemy' };
      S.players.forEach((pl) => {
        pl.discoveries = [];
      });
      const attacker = S.characters.find((c) => c.alive !== false && c.player === 0 && c.isKing);
      const defender = S.characters.find((c) => c.alive !== false && c.player === 1 && c.isKing);
      if (!attacker || !defender) throw new Error('a realm has no king');
      const homes = new Set(S.players.map((pl) => pl.homeProvinceId ?? pl.provinces[0]));
      const home = S.world.provinces.find((p) => p.id === (S.players[1]?.homeProvinceId ?? S.players[1]?.provinces[0]));
      // the battleground, and a province next door for the attacker to march from (no realm's home)
      const battleground =
        ground === "the defender's home"
          ? home
          : S.world.provinces.find(
              (p) => p.terrain !== 'sea' && !homes.has(p.id) && neighbours(S, p).some((q) => !homes.has(q.id)),
            );
      const from = battleground && neighbours(S, battleground).find((q) => !homes.has(q.id));
      if (!battleground || !from) throw new Error('could not stage: no battleground with a province next door');
      // everyone else leaves both provinces
      S.characters = S.characters.filter(
        (c) => c === attacker || c === defender || ![battleground.id, from.id].includes(c.location ?? -1),
      );
      [battleground, from].forEach((p) => {
        p.characters = (p.characters ?? []).filter((id) => S.characters.some((c) => c.id === id));
      });
      own(S, from, 0);
      place(S, attacker, from);
      attacker.armies = [
        ...companies('Men-at-Arms', ['the First Shields', 'the Second Shields', 'the Third Shields']),
        ...companies('Yeoman Longbows', ['the Hawkwatch']),
      ];
      attacker.items = theItem(items.attackersItem);
      attacker.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
      if (ground === 'a province of neutral guards') {
        own(S, battleground, null);
        battleground['neutralDefenders'] = companies('Men-at-Arms', [
          'the Old Guard',
          'the Mill Watch',
          'the Ford Watch',
          'the Hill Watch',
        ]);
        battleground['npcArmies'] = 4;
        battleground['_leaderlessDefenders'] = true; // a guard's companies whose commander has fallen: no duel
        const elsewhere = S.world.provinces.find(
          (p) => p.terrain !== 'sea' && p.owner === 1 && p.id !== battleground.id && p.id !== from.id,
        );
        if (elsewhere) place(S, defender, elsewhere);
      } else {
        if (ground === "another province of the defender's realm") own(S, battleground, 1);
        else Object.assign(battleground, { features: [], garrisonArmies: [] });
        place(S, defender, battleground);
        defender.armies = companies('Men-at-Arms', [
          'the Hearth Guard',
          'the Gate Watch',
          'the Wall Watch',
          'the Keep Watch',
        ]);
        defender.items = theItem(items.defendersItem);
        defender.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
      }
      return { attacker, battleground };
    },
    orders: (_S, x) => ({ [x.attacker.id]: plan(order('move', x.battleground.id)) }),
  });
  return r;
}

const textOf = (e: Line) => e.text ?? '';
/** The lines of the turn's first battle (a battle not decided may go on in a later season, as another). */
function theFirstBattlesLines(log: Line[]): string[] {
  const id = log.find((e) => e['battleId'] != null && textOf(e).startsWith('⚔ **Battle for '))?.['battleId'];
  if (id == null) throw new Error('could not stage: no battle was fought');
  return log.filter((e) => e['battleId'] === id).map(textOf);
}
/** The defender's position on his strength ladder in the first battle, as the ladder prints it (×…). */
const theDefendersPosition = (log: Line[]): number[] =>
  theFirstBattlesLines(log).flatMap((t) =>
    [...t.matchAll(/× defender's position ×([0-9.]+)/g)].map((m) => Number(m[1])),
  );
/** The shot lines of the attacker's missile company in the first battle: between heroes "the Hawkwatch → …", against
 *  neutral guards "the Hawkwatch fires at …". */
const theHawkwatchsShots = (log: Line[]) =>
  theFirstBattlesLines(log).filter((t) => /^ {2}the Hawkwatch (→|fires at) /.test(t)).length;

describe("the Banner of the Realm: the defenders' position ×1.25 at the defender's home, not elsewhere", () => {
  test("at the defender's home: ×1.25 (the province's ×1.25, home ground's ×1.2) without it, and ×1.25 more with it", async () => {
    const without = await aBattle("the defender's home", {});
    expect(theDefendersPosition(without.log), 'a battle at the home, no banner').toEqual([1.5]);
    const withIt = await aBattle("the defender's home", { defendersItem: 'Banner of the Realm' });
    expect(theDefendersPosition(withIt.log), 'a battle at the home, the defender carries the banner').toEqual([1.875]);
    expect(
      theFirstBattlesLines(withIt.log).some((t) => t.includes('Banner of the Realm rallies the home defense')),
    ).toBe(true);
  });

  test("in another province of the defender's realm: nothing", async () => {
    const withIt = await aBattle("another province of the defender's realm", { defendersItem: 'Banner of the Realm' });
    expect(theDefendersPosition(withIt.log), 'a battle away from the home, the defender carries the banner').toEqual([
      1.25,
    ]);
    expect(theFirstBattlesLines(withIt.log).some((t) => t.includes('Banner of the Realm rallies'))).toBe(false);
  });
});

describe('the Quiver of the Hawk: each missile unit the commander leads looses two volleys instead of one', () => {
  test.for(["another province of the defender's realm", 'a province of neutral guards'] as const)(
    'in a battle in %s',
    async (ground) => {
      const without = await aBattle(ground, {});
      expect(theHawkwatchsShots(without.log), 'the Hawkwatch, no quiver: one volley').toBe(1);
      const withIt = await aBattle(ground, { attackersItem: 'Quiver of the Hawk' });
      expect(theHawkwatchsShots(withIt.log), 'the Hawkwatch, its commander carries the quiver: two volleys').toBe(2);
    },
  );
});
