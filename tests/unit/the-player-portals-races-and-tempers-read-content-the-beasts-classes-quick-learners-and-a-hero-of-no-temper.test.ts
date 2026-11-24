// The player portal's races and tempers read content (B-06, T7, the rules pulled out: Run 3a's portal row, B-06ak):
// - each primal sub-race's class as players read it (PRIMAL_SUBRACE_CLASS, src/ui/player/skills-and-projections.ts)
//   comes from its unit's class in content (KC_UNIT_CLASS, through the engine's two sets of beasts), with the two names
//   an older report holds: the same table the portal wrote by hand before, entry for entry; formatRace and the army
//   label's class word give what they gave over every sub-race, a bare `Primal`, a sub-race no beast has, every unit
//   type and none;
// - the order form's practice note asks whether a hero is a quick learner (isAHeroAQuickLearnerByHisRaceAndHisRealms,
//   src/engine/rules-on-plain-values/), which gives the race gifts' runner's answer
//   (doesAGiftOfHisRealmsRaceQuickenAHerosLearning) and the note's old test's over every pair of races;
// - a fallen hero of no temper on the report (src/views/turn-report.ts) shows the temper a hero of no temper fights
//   with, Brave (THE_TEMPER_A_HERO_OF_NO_TEMPER_FIGHTS_WITH); one of a temper keeps his.
// The old table, the old functions and the old test are written here as they were, so each case holds the new code to
// the portal's words before B-06ak.
// Level 1 (unit): the portal's file imports in Node (P1-13e8), the engine's runner on its modules, and the report built
// by buildTurnReport on a world the engine makes on its modules (tests/lib/a-staged-turn-on-the-engines-modules.ts)
// from KC_SEED, the fallen hero staged by the test. No matrix game holds a hero of no temper.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import {
  KC_HUMANOID_RACES,
  KC_UNIT_TYPE,
  PRIMAL_ARMY_DEFS_P,
  THE_TEMPER_A_HERO_OF_NO_TEMPER_FIGHTS_WITH,
} from '../../src/content/kingdoms-call-data.ts';
import { doesAGiftOfHisRealmsRaceQuickenAHerosLearning } from '../../src/engine/rules/the-registry-of-the-race-gifts.ts';
import { isAHeroAQuickLearnerByHisRaceAndHisRealms } from '../../src/engine/rules-on-plain-values/the-chance-a-practice-alone-raises-a-skill-and-the-price-and-wage-a-druid-or-a-host-leader-cuts.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../../src/engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import {
  PRIMAL_SUBRACE_CLASS,
  THE_WORDS_PLAYERS_READ_FOR_THE_WILDS_TWO_CLASSES_OF_BEAST,
  armyLabel,
  formatRace,
  theClassWordOfAUnitType,
} from '../../src/ui/player/skills-and-projections.ts';
import { aStagedTurnOnTheEnginesModules } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** The portal's table before B-06ak, as it was written by hand. */
const THE_OLD_TABLE: Readonly<Record<string, string>> = {
  'Stone Giant': 'Creature',
  'Forest Ent': 'Creature',
  Thunderbird: 'Creature',
  'Giant Eagle': 'Creature',
  Roc: 'Creature',
  Whale: 'Creature',
  'Great Bear': 'Creature',
  Unicorn: 'Creature',
  Mammoth: 'Creature',
  'Great Turtle': 'Creature',
  'Cave Troll': 'Monster',
  Manticore: 'Monster',
  Basilisk: 'Monster',
  Dragon: 'Monster',
  Titan: 'Monster',
  'Sea Giant': 'Monster',
  Kraken: 'Monster',
  Hydra: 'Monster',
  Leviathan: 'Monster',
  Shark: 'Monster',
};

/** formatRace before B-06ak, as it was written. */
function theOldFormatRace(race: string | null | undefined, unitType?: string | null): string {
  if (!race) return 'Uninhabited';
  if (race.startsWith('Primal')) {
    const sub = race.slice(7).trim();
    if (sub) return (THE_OLD_TABLE[sub] ?? '') || 'Creature';
    if (unitType) return MONSTER_ARMIES.has(unitType) ? 'Monster' : 'Creature';
    return 'Creature';
  }
  return race;
}

/** The army label's class word before B-06ak, as it was written. */
const theOldClassWord = (type: string): string | null =>
  CREATURE_ARMIES.has(type) ? 'Creature' : MONSTER_ARMIES.has(type) ? 'Monster' : null;

const EVERY_UNIT_TYPE = [...Object.keys(KC_UNIT_TYPE), ...Object.keys(PRIMAL_ARMY_DEFS_P), 'Whale Cohort', 'Swordsmen'];

describe("the beasts' classes as players read them", () => {
  test("each primal sub-race's class comes from its unit's, with an older report's two names: the old table, entry for entry", () => {
    expect(PRIMAL_SUBRACE_CLASS).toEqual(THE_OLD_TABLE);
    expect(THE_WORDS_PLAYERS_READ_FOR_THE_WILDS_TWO_CLASSES_OF_BEAST).toEqual({
      creature: 'Creature',
      monster: 'Monster',
    });
  });

  test('formatRace gives what it gave: every sub-race, a bare Primal by its unit, a sub-race no beast has, a people, none', () => {
    const races = [
      ...Object.keys(THE_OLD_TABLE).flatMap((sub) => [`Primal:${sub}`, `Primal: ${sub} `]),
      'Primal',
      'Primal:',
      'Primal:Wolf',
      'Primalish',
      ...KC_HUMANOID_RACES,
      'Elf',
      '',
      null,
      undefined,
    ];
    const types = [undefined, null, '', ...EVERY_UNIT_TYPE];
    const differ = races.flatMap((race) =>
      types.flatMap((type) => {
        const now = formatRace(race, type);
        const then = theOldFormatRace(race, type);
        return now === then ? [] : [`${String(race)} / ${String(type)}: ${now}, was ${then}`];
      }),
    );
    expect(differ, 'each race and unit type formatRace reads otherwise').toEqual([]);
  });

  test("the army label's class word, and its lead, give what they gave for every unit type", () => {
    const differ = EVERY_UNIT_TYPE.flatMap((type) => {
      const now = theClassWordOfAUnitType(type);
      const then = theOldClassWord(type);
      return now === then ? [] : [`${type}: ${String(now)}, was ${String(then)}`];
    });
    expect(differ, 'each unit type whose class word differs').toEqual([]);
    expect(String(armyLabel({ type: 'Cave Trolls', quality: 'Elite' }))).toContain('Monster, Cave Trolls, Elite');
    expect(String(armyLabel({ type: 'Great Bears', quality: 'Elite', race: 'Primal:Great Bear' }))).toContain(
      'Creature, Great Bears, Elite',
    );
    expect(String(armyLabel({ type: 'Wyvern Riders', quality: 'Elite', race: 'Orcish' }))).toContain(
      'Orcish, Wyvern Riders, Elite',
    );
  });
});

describe('a quick learner, as the practice note asks it', () => {
  test("the shared test gives the race gifts' runner's answer and the note's old test's, over every pair of races", () => {
    const races = [...KC_HUMANOID_RACES, 'Primal', 'Primal:Wolf', 'Elf', '', null, undefined];
    const differ = races.flatMap((hero) =>
      races.flatMap((realm) => {
        const now = isAHeroAQuickLearnerByHisRaceAndHisRealms(hero, realm);
        const theRunners = doesAGiftOfHisRealmsRaceQuickenAHerosLearning(realm, { theHerosRace: hero });
        const theOld = hero === 'Human' && realm === 'Human';
        return now === theRunners && now === theOld
          ? []
          : [`a ${String(hero)} hero of a ${String(realm)} realm: ${String(now)}, the runner ${String(theRunners)}`];
      }),
    );
    expect(differ, 'each pair the three answers differ on').toEqual([]);
    expect(isAHeroAQuickLearnerByHisRaceAndHisRealms('Human', 'Human')).toBe(true);
  });
});

interface AWorld {
  turn: number;
  players: Record<string, unknown>[];
  characters: { id: number; name: string; player: number | null; isKing?: boolean; location: number }[];
  heroGraveyard?: Record<string, unknown>[];
}

describe('a fallen hero of no temper on the report', () => {
  test('shows the temper a hero of no temper fights with (Brave); one of a temper keeps his', async () => {
    const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
    const { playerView } = await import('../../src/views/what-each-realm-may-see-of-the-world.ts');
    const { buildTurnReport } = await import('../../src/views/turn-report.ts');
    const { S } = sc.world({ realms: 2, cols: 10, rows: 6, seaPct: 30 });
    const G = S as unknown as AWorld;
    const [realm0] = G.players;
    const king = G.characters.find((c) => c.player === 0 && c.isKing);
    if (!realm0 || !king) throw new Error('could not stage: a realm and its king');
    const aGrave = (id: number, more: Record<string, unknown>) => ({
      id,
      name: `Fallen ${String(id)}`,
      player: 0,
      killedOnTurn: G.turn,
      location: king.location,
      skills: {},
      ...more,
    });
    G.heroGraveyard = [aGrave(9001, {}), aGrave(9002, { temper: '' }), aGrave(9003, { temper: 'Cowardly' })];
    realm0['knownDeadHeroIds'] = [9001, 9002, 9003];
    const rep = buildTurnReport(playerView(S as never, 0)) as {
      knownDeadHeroes?: { id: number; temper?: string }[];
    };
    const temperOf = (id: number) => (rep.knownDeadHeroes ?? []).find((g) => g.id === id)?.temper;
    expect([temperOf(9001), temperOf(9002), temperOf(9003)]).toEqual(['Brave', 'Brave', 'Cowardly']);
    expect(THE_TEMPER_A_HERO_OF_NO_TEMPER_FIGHTS_WITH).toBe('Brave');
  });
});
