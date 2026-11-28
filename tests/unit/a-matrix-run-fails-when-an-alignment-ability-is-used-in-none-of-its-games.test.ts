// The ability check (B-17e, BOT-S3: tools/balance/the-check-that-every-alignment-ability-is-used-in-some-game.ts):
// after a run, every alignment ability is used in some game, or is on the list (a stand-in with its row, or "cannot
// act" with its reason); a missing one fails the run, naming it; an entry seen used fails too, so the list only
// shrinks. The made-up games' figures go through B-17d's sums (theBotsStatisticsOfTheAbilities), as the run's do.
// Level 1 (unit): the check is a pure function of the run's statistics; the matrix plays it only as a whole (its proof
// is the planted run in the pull request), and can't show each case. Every input is pinned: no seed reaches it.
import { describe, expect, test } from 'vitest';
import {
  ALIGNMENT_ABILITIES,
  type AlignmentAbilitySlug,
} from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { scenarioFile, type Scenario } from '../../tools/balance/scenario.ts';
import type { Stats } from '../../tools/balance/stats.ts';
import {
  ABILITY_USED,
  THE_ABILITY_KEYS,
  theBaseOfAnAbilitysFigure,
  theBotsStatisticsOfTheAbilities,
  type ABotRealm,
} from '../../tools/balance/the-bots-statistics-by-realm-summed-by-alignment-and-race.ts';
import {
  THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW,
  THE_SCENARIOS_THE_STAND_INS_NAME,
  theAbilitiesTheGamesFailOn,
  whatIsNotMeasuredYet,
  type WhyTheGamesNeedNotShowAnAbility,
} from '../../tools/balance/the-check-that-every-alignment-ability-is-used-in-some-game.ts';

/** One bot realm of each alignment, seat by seat. */
const REALMS: ABotRealm[] = [...new Set(Object.values(ALIGNMENT_ABILITIES).map((a) => a.alignment))].map(
  (alignment, realm) => ({ realm, alignment, race: 'Human' }),
);
const seatOf = (key: AlignmentAbilitySlug) => REALMS.find((r) => r.alignment === ALIGNMENT_ABILITIES[key].alignment);

/** A made-up game in which the realm of each ability's alignment used each of `used` once. */
function aGameUsing(used: readonly AlignmentAbilitySlug[]): { stats: Stats } {
  const uses: Partial<Record<AlignmentAbilitySlug, Record<number, number>>> = {};
  for (const key of used) {
    const seat = seatOf(key);
    if (seat) uses[key] = { [seat.realm]: 1 };
  }
  return { stats: theBotsStatisticsOfTheAbilities(REALMS, uses) };
}

/** The abilities counted by their use. */
const COUNTED_BY_USE = THE_ABILITY_KEYS.filter((k) => theBaseOfAnAbilitysFigure(k)?.startsWith(ABILITY_USED));
const ON_THE_LIST: ReadonlySet<string> = new Set(Object.keys(THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW));
/** Every ability counted by its use, used, but those on the list. */
const EVERY_ONE_BUT_THE_LIST = COUNTED_BY_USE.filter((k) => !ON_THE_LIST.has(k));
const without = (key: AlignmentAbilitySlug) => EVERY_ONE_BUT_THE_LIST.filter((k) => k !== key);

describe('the ability check', () => {
  test('passes a run whose games use every ability but those on the list, in any of its games', () => {
    expect(theAbilitiesTheGamesFailOn([aGameUsing(EVERY_ONE_BUT_THE_LIST)])).toEqual([]);
    // each used in one game of two is enough
    const half = Math.floor(EVERY_ONE_BUT_THE_LIST.length / 2);
    const games = [aGameUsing(EVERY_ONE_BUT_THE_LIST.slice(0, half)), aGameUsing(EVERY_ONE_BUT_THE_LIST.slice(half))];
    expect(theAbilitiesTheGamesFailOn(games)).toEqual([]);
  });

  test('fails a run whose games never use an ability, naming it and its realms', () => {
    const games = [aGameUsing(without('consecrate')), aGameUsing(without('consecrate'))];
    expect(theAbilitiesTheGamesFailOn(games)).toEqual([
      'consecrate (of the Divine realms) was used in none of the 2 games its realms played',
    ]);
  });

  test('a set-up ability counts as used when the world is made with it, and fails when no game is', () => {
    expect(theAbilitiesTheGamesFailOn([aGameUsing(without('a-divine-king-starts-with-white-magic'))])).toEqual([
      'a divine king starts with white magic (of the Divine realms) was used in none of the 1 games its realms played',
    ]);
  });

  test('a stand-in passes unused, and fails once a game shows it used: it leaves the list', () => {
    expect(theAbilitiesTheGamesFailOn([aGameUsing(EVERY_ONE_BUT_THE_LIST)])).toEqual([]);
    const used = aGameUsing([...EVERY_ONE_BUT_THE_LIST, 'the-neutral-mercenary-discount']);
    expect(theAbilitiesTheGamesFailOn([used, aGameUsing(EVERY_ONE_BUT_THE_LIST)])).toEqual([
      'the neutral mercenary discount (of the Neutral realms) was used in 1 of the 2 games its realms played: it leaves the stand-in list (KD-528)',
    ]);
  });

  test('"cannot act" passes unused; it fails if a game shows it used, or if its rule no longer holds it back', () => {
    const used = aGameUsing([...EVERY_ONE_BUT_THE_LIST, 'zeal-of-an-undead-realm']);
    expect(theAbilitiesTheGamesFailOn([used])).toEqual([
      'zeal of an undead realm (of the Undead realms) is listed as "cannot act", but was used in 1 of the 1 games its realms played: it leaves the list',
    ]);
    const itActsNow: Partial<Record<AlignmentAbilitySlug, WhyTheGamesNeedNotShowAnAbility>> = {
      ...THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW,
      'zeal-of-an-undead-realm': { why: 'cannot act', reason: 'a made-up reason', stillHolds: () => false },
    };
    expect(theAbilitiesTheGamesFailOn([aGameUsing(EVERY_ONE_BUT_THE_LIST)], itActsNow)).toEqual([
      'zeal of an undead realm (of the Undead realms) is listed as "cannot act" (a made-up reason), but its rule no longer holds it back',
    ]);
    // today's rule holds it back: an Undead realm's zeal is 0%
    expect(THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW['zeal-of-an-undead-realm'].stillHolds()).toBe(true);
  });

  test('an ability counted by no use, or unused, and not on the list, fails', () => {
    const shorter = Object.fromEntries(
      Object.entries(THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW).filter(
        ([k]) => k !== 'righteous-defence' && k !== 'the-neutral-mercenary-discount',
      ),
    );
    expect(theAbilitiesTheGamesFailOn([aGameUsing(EVERY_ONE_BUT_THE_LIST)], shorter)).toEqual([
      'righteous defence (of the Good realms) is counted by no use (not countable yet), and is not on the stand-in list',
      'the neutral mercenary discount (of the Neutral realms) was used in none of the 1 games its realms played',
    ]);
  });

  test('a game where no realm of an alignment plays shows none of its abilities used', () => {
    const noUndead = theBotsStatisticsOfTheAbilities(
      REALMS.filter((r) => r.alignment !== 'Undead'),
      {},
    );
    const fails = theAbilitiesTheGamesFailOn([{ stats: noUndead }]);
    expect(fails).toContain(
      'harvest the field (of the Undead realms) was used in none of the 0 games its realms played',
    );
  });
});

describe("the check's list", () => {
  test('only shrinks: it holds no more than the seven entries of 28 November', () => {
    const THE_SEVEN = [
      'the-neutral-mercenary-discount',
      'the-risen-dead-follow-only-the-undead',
      'creatures-follow-without-a-druid',
      'monsters-follow-without-a-druid',
      'righteous-defence',
      'home-of-the-wild',
      'zeal-of-an-undead-realm',
    ];
    const extra = Object.keys(THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW).filter((k) => !THE_SEVEN.includes(k));
    expect(extra, `entries added to the list: ${extra.join(', ')}`).toEqual([]);
  });

  test('each named scenario it names is there and requires figures, so every run plays it', async () => {
    expect(THE_SCENARIOS_THE_STAND_INS_NAME).toEqual(['a-neutral-realm-hires-a-mercenary-band-at-its-discount']);
    for (const name of THE_SCENARIOS_THE_STAND_INS_NAME) {
      const s = ((await import(scenarioFile(name))) as { default: Scenario }).default;
      expect(s.requires?.length, name).toBeGreaterThan(0);
    }
  });

  test("the report's 'what isn't measured yet' names every entry, the stand-ins first, each with its row", () => {
    const lines = whatIsNotMeasuredYet();
    expect(lines).toHaveLength(Object.keys(THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW).length);
    expect(lines[0]).toBe(
      "righteous defence: no scenario yet, until the count reads it from the battle's strength record (KD-532)",
    );
    expect(lines).toContain(
      'the neutral mercenary discount: shown by the scenario "a-neutral-realm-hires-a-mercenary-band-at-its-discount", until the bots hire mercenary bands (KD-528)',
    );
    expect(lines.at(-1)).toMatch(/^zeal of an undead realm: cannot act, an Undead realm's zeal is 0%/);
  });
});
