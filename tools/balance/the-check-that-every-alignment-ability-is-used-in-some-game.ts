// The ability check (B-17e, BOT-S3): after a run of the balance matrix, every alignment ability is used in at least
// one of its games, or is on THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW: a missing one fails the run, naming the ability.
// It reads the bots' statistics (B-17d: the-bots-statistics-by-realm-summed-by-alignment-and-race.ts), each ability's
// uses for the bot realms of its alignment, from the count by key (B-17c). A set-up ability counts as used when the
// world is made with it (the count's 'the set-up').
//
// The list (A13, a maintainer's answer of 28 November), meant to empty (A2):
// - a stand-in: an ability the games don't show used yet, each with its backlog row and, where there is one, the named
//   scenario that shows it used (a required scenario: run.ts plays it with every run, and it fails the run if it
//   misses). An entry seen used in the games fails the run too, so it leaves the list: the list only shrinks;
// - "cannot act": an ability whose rule holds it back, with the maintainer's line as its reason, and the check that
//   it still does (a change to its number fails the run).
// It only reads: no game plays differently for it (BOT-S5).
import {
  ALIGNMENT_ABILITIES,
  type AlignmentAbilitySlug,
} from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { anAbilityInWords } from './labels.ts';
import { valueOf, type Stats } from './stats.ts';
import {
  ABILITY_USED,
  THE_ABILITY_KEYS,
  theBaseOfAnAbilitysFigure,
} from './the-bots-statistics-by-realm-summed-by-alignment-and-race.ts';
import { HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED } from './the-count-of-each-alignment-abilitys-use-by-its-key.ts';

/** The named scenarios a stand-in names (tests/balance/scenarios/), each a required one. */
export type AStandInsScenario = 'a-neutral-realm-hires-a-mercenary-band-at-its-discount';

/** Why the matrix's games need not show an ability used. */
export type WhyTheGamesNeedNotShowAnAbility =
  | {
      readonly why: 'a stand-in';
      /** The named scenario that shows it used, or none yet. */
      readonly scenario: AStandInsScenario | 'no scenario yet';
      /** Its backlog row, which empties its entry. */
      readonly row: `KD-${number}`;
      /** What the row does, in game terms. */
      readonly until: string;
    }
  | {
      readonly why: 'cannot act';
      /** The maintainer's line. */
      readonly reason: string;
      /** Whether its rule still holds it back. */
      readonly stillHolds: () => boolean;
    };

/** An Undead realm's chance of zeal, as content holds it (a number: a change to it is what the check is for). */
const theChanceOfAnUndeadRealmsZeal: number =
  ALIGNMENT_ABILITIES['zeal-of-an-undead-realm'].theNumbers.theChanceOfZeal.value;

/** The abilities the matrix's games need not show used, by key: the only list the check passes. */
export const THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW = {
  'the-neutral-mercenary-discount': {
    why: 'a stand-in',
    scenario: 'a-neutral-realm-hires-a-mercenary-band-at-its-discount',
    row: 'KD-528',
    until: 'the bots hire mercenary bands',
  },
  'the-risen-dead-follow-only-the-undead': {
    why: 'a stand-in',
    scenario: 'no scenario yet',
    row: 'KD-529',
    until: 'the count reads its use from its act, not the risen dead the heroes lead',
  },
  'creatures-follow-without-a-druid': {
    why: 'a stand-in',
    scenario: 'no scenario yet',
    row: 'KD-530',
    until: "the count reads its use from the battle, where the Druid's penalty is waived",
  },
  'monsters-follow-without-a-druid': {
    why: 'a stand-in',
    scenario: 'no scenario yet',
    row: 'KD-531',
    until: "the count reads its use from the battle, where the Druid's penalty is waived",
  },
  'righteous-defence': {
    why: 'a stand-in',
    scenario: 'no scenario yet',
    row: 'KD-532',
    until: "the count reads it from the battle's strength record",
  },
  'home-of-the-wild': {
    why: 'a stand-in',
    scenario: 'no scenario yet',
    row: 'KD-533',
    until: "the count reads it from the battle's strength record",
  },
  'zeal-of-an-undead-realm': {
    why: 'cannot act',
    reason:
      'an Undead realm\'s zeal is 0%, so it never rolls ("listed as cannot act", BOT-S3, a maintainer, 28 November)',
    stillHolds: () => theChanceOfAnUndeadRealmsZeal === 0,
  },
} as const satisfies Partial<Record<AlignmentAbilitySlug, WhyTheGamesNeedNotShowAnAbility>>;

/** A stand-in and the named scenario it names. */
export interface AStandInsScenarioByItsKey {
  readonly key: AlignmentAbilitySlug;
  readonly scenario: AStandInsScenario;
}
/** The named scenarios the list's stand-ins name, each with its ability: run.ts fails a run if one isn't a required
 *  scenario that requires the ability's own use. */
export const THE_SCENARIOS_THE_STAND_INS_NAME: readonly AStandInsScenarioByItsKey[] = THE_ABILITY_KEYS.flatMap(
  (key) => {
    const e: WhyTheGamesNeedNotShowAnAbility | undefined = (
      THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW as Partial<Record<AlignmentAbilitySlug, WhyTheGamesNeedNotShowAnAbility>>
    )[key];
    return e?.why === 'a stand-in' && e.scenario !== 'no scenario yet' ? [{ key, scenario: e.scenario }] : [];
  },
);

/** What a stand-in's scenario lacks, or null: it must be there and require the ability's own figure (its use, under
 *  the bots' statistics' base) in every run. `found`: the scenario, if it is there. */
export function whatAStandInsScenarioLacks(
  standIn: AStandInsScenarioByItsKey,
  found: { readonly requires?: readonly { readonly figure: string; readonly in: string }[] } | undefined,
): string | null {
  const figure = ABILITY_USED + standIn.key;
  if (!found)
    return `The scenario "${standIn.scenario}" is to show ${anAbilityInWords(standIn.key)} used, but it isn't there.`;
  return found.requires?.some((r) => r.figure === figure && r.in === 'every run')
    ? null
    : `The scenario "${standIn.scenario}" is to show ${anAbilityInWords(standIn.key)} used, but doesn't require "${figure}" in every run.`;
}

/** An ability in game terms: its name and its alignment's realms. */
const named = (key: AlignmentAbilitySlug): string =>
  `${anAbilityInWords(key)} (of the ${ALIGNMENT_ABILITIES[key].alignment} realms)`;

/** In how many of `games` the bot realms of the ability's alignment played, and used it (0 for an ability counted by
 *  no use: a stand-in from the state, or not countable yet). */
function theGamesItWasUsedIn(
  games: readonly { stats: Stats }[],
  key: AlignmentAbilitySlug,
): { played: number; used: number } {
  const base = theBaseOfAnAbilitysFigure(key);
  const slice = `${base ?? ''} | by alignment: ${ALIGNMENT_ABILITIES[key].alignment}`;
  let [played, used] = [0, 0];
  for (const g of games) {
    const [sum, count] = valueOf(g.stats, slice);
    if (count > 0) played++;
    if (sum > 0 && base?.startsWith(ABILITY_USED)) used++;
  }
  return { played, used };
}

/** What fails the run, one line an ability: [] if every ability is used in some game of `games`, or is on `list` as
 *  it says. */
export function theAbilitiesTheGamesFailOn(
  games: readonly { stats: Stats }[],
  list: Partial<Record<AlignmentAbilitySlug, WhyTheGamesNeedNotShowAnAbility>> = THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW,
): string[] {
  return THE_ABILITY_KEYS.flatMap((key) => {
    const { played, used } = theGamesItWasUsedIn(games, key);
    const ofAll = `(of all ${String(games.length)}, bot and scripted)`;
    const inGames = `in ${String(used)} of the ${String(played)} games ${ofAll} its realms played`;
    const entry = list[key];
    if (entry?.why === 'cannot act') {
      if (!entry.stillHolds())
        return [`${named(key)} is listed as "cannot act" (${entry.reason}), but its rule no longer holds it back`];
      return used ? [`${named(key)} is listed as "cannot act", but was used ${inGames}: it leaves the list`] : [];
    }
    if (entry) return used ? [`${named(key)} was used ${inGames}: it leaves the stand-in list (${entry.row})`] : [];
    const how = HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED[key].by;
    if (how === 'a stand-in from the state' || how === 'not countable yet')
      return [`${named(key)} is counted by no use (${how}), and is not on the stand-in list`];
    return used ? [] : [`${named(key)} was used in none of the ${String(played)} games ${ofAll} its realms played`];
  });
}

/** What isn't measured yet, in game terms: each entry of `list`, the stand-ins first. */
export function whatIsNotMeasuredYet(
  list: Partial<Record<AlignmentAbilitySlug, WhyTheGamesNeedNotShowAnAbility>> = THE_ABILITIES_THE_GAMES_NEED_NOT_SHOW,
): string[] {
  const entries = THE_ABILITY_KEYS.flatMap((key) => {
    const e = list[key];
    return e ? [{ key, e }] : [];
  });
  return [
    ...entries.flatMap(({ key, e }) =>
      e.why === 'a stand-in'
        ? [
            `${anAbilityInWords(key)}: ${e.scenario === 'no scenario yet' ? 'no scenario yet' : `shown by the scenario "${e.scenario}"`}, until ${e.until} (${e.row})`,
          ]
        : [],
    ),
    ...entries.flatMap(({ key, e }) =>
      e.why === 'cannot act' ? [`${anAbilityInWords(key)}: cannot act, ${e.reason}`] : [],
    ),
  ];
}
