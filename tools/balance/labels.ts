// One fixed plain-words label per statistic of the balance matrix (plan P1-03), so the balance report reads in game
// terms on its own: "Battles won by the attacker, against an enemy commander" for 'battles: attacker won | by kind:
// pvp'. A statistic's name is its base and, after ' | ', a slice (stats.ts). Every name in the committed baselines, and
// every figure of a named scenario, has a label (tests/unit/balance-report.test.ts, balance-scenario.test.ts): a new
// statistic needs its label here.
import { baseOf } from './stats.ts';
import {
  ABILITY_STAND_IN,
  ABILITY_USED,
  CASTS_LEFT_UNUSED,
  GOLD_UNSPENT,
  ORDERS_GIVEN,
  ORDERS_THE_HYGIENE_DROPPED,
  PHASES_WITH_NOTHING_ELSE_TO_DO,
  THE_HYGIENES_DROPS,
} from './the-bots-statistics-by-realm-summed-by-alignment-and-race.ts';

/** The label of each base, and whether a figure is per battle, per game, a share…: "Lair fights per game". */
export const BASE_LABELS: Readonly<Record<string, string>> = {
  'battles: attacker won': 'Battles won by the attacker',
  'battles: fought': 'Battles per game',
  'battles: units lost by the attacker': 'Units the attacker lost, per battle',
  'battles: units lost by the defender': 'Units the defender lost, per battle',
  'battles: provinces left unresolved': 'Battles left unresolved at the end of a turn, per game',
  'lairs: attempts': 'Lair fights per game',
  'lairs: cleared': 'Lair fights won by the hero',
  'lairs: hero fled': 'Lair fights the hero fled',
  'lairs: hero killed': 'Lair fights the hero died in',
  'heroes: deaths': 'Characters killed, per game',
  'spells: cast': 'Spells cast, per game',
  'spells: succeeded': 'Spells that worked',
  'realms: gold at turn 10': "A realm's gold at turn 10",
  'realms: gold at turn 20': "A realm's gold at turn 20",
  'realms: gold at the end': "A realm's gold at the end",
  'realms: provinces at turn 10': "A realm's provinces at turn 10",
  'realms: provinces at turn 20': "A realm's provinces at turn 20",
  'realms: provinces at the end': "A realm's provinces at the end",
  'realms: army strength at turn 10': "A realm's army strength at turn 10",
  'realms: army strength at turn 20': "A realm's army strength at turn 20",
  'realms: army strength at the end': "A realm's army strength at the end",
  'items: gained': 'Items found, per game',
  'titles: held at the end': 'Titles held at the end, per game',
  'game: ended': 'Games over within 30 turns',
  'game: length in turns': 'Game length, in turns',
  'chases: Encounter orders': 'Encounter orders, per game',
  'chases: Pursue orders': 'Pursue orders, per game',
  'chases: caught': 'Chases that caught their quarry',
  'chases: waited for a battle': 'Chases held up by a battle, per game',
};

/** Why the order hygiene drops a bot's order (economy.ts's runBotOrderHygiene), by its reason's key. */
export const THE_HYGIENES_DROPS_IN_WORDS: Readonly<Record<(typeof THE_HYGIENES_DROPS)[number], string>> = {
  summonTwice: 'a second summoning in a turn',
  overLimit: "a cast beyond the hero's limit in its school",
  hireGone: 'a hire of a hero no longer free',
  hireTwice: 'a second hire of one hero',
  hireElsewhere: 'a hire away from the hero',
  hireUnaffordable: 'a hire the realm could not pay for',
  handoverAllSkeletal: 'a hand-over of skeletal units only',
  practiceCapped: 'practice at the cap, with no one to teach',
};
const isADrop = (v: string): v is (typeof THE_HYGIENES_DROPS)[number] => v in THE_HYGIENES_DROPS_IN_WORDS;

/** An ability's key in words: 'the-neutral-mercenary-discount' as "the neutral mercenary discount". */
export const anAbilityInWords = (key: string): string => key.replaceAll('-', ' ');

/** The label of a base of the bots' statistics (B-17d), each a figure per bot realm of the slice; undefined if none. */
function theBotsBaseLabel(base: string): string | undefined {
  const after = (start: string) => (base.startsWith(start) ? base.slice(start.length) : null);
  const order = after(ORDERS_GIVEN);
  if (order) return `Orders given of the kind "${order}", per realm a game`;
  const used = after(ABILITY_USED);
  if (used) return `Uses of ${anAbilityInWords(used)}, per realm a game`;
  const standIn = after(ABILITY_STAND_IN);
  if (standIn)
    return `What the world holds where ${anAbilityInWords(standIn)} could act (a stand-in, not a use), per realm a game`;
  if (base === ORDERS_THE_HYGIENE_DROPPED) return 'Orders the hygiene dropped, per realm a game';
  const drop = after(ORDERS_THE_HYGIENE_DROPPED + ': ');
  if (drop)
    return isADrop(drop)
      ? `Orders the hygiene dropped as ${THE_HYGIENES_DROPS_IN_WORDS[drop]}, per realm a game`
      : undefined;
  if (base === PHASES_WITH_NOTHING_ELSE_TO_DO) return "Heroes' phases with nothing else to do, per realm a game";
  const kind = after(PHASES_WITH_NOTHING_ELSE_TO_DO + ': ');
  if (kind)
    return kind === 'left empty'
      ? "Heroes' phases left empty (the turn's Defend), per realm a game"
      : `Heroes' phases padded with "${kind.replaceAll('-', ' ')}", per realm a game`;
  if (base === CASTS_LEFT_UNUSED) return "Casts a hero's limit allowed and he wasn't given, per realm a game";
  if (base === GOLD_UNSPENT) return "Gold unspent at a turn's end, per realm a turn";
  return undefined;
}

/** Battle kinds in the GM portal's words (its statistics page, `kindLab`). */
const BATTLE_KINDS: Readonly<Record<string, string>> = {
  pvp: 'against an enemy commander',
  garrison: 'against an enemy garrison',
  guard: 'against a neutral chieftain',
  neutral: 'against neutral defenders',
};
const TERRAINS: Readonly<Record<string, string>> = {
  plain: 'on the plains',
  forest: 'in forests',
  jungle: 'in jungles',
  mountain: 'in the mountains',
  hills: 'in the hills',
  desert: 'in deserts',
  swamp: 'in swamps',
  tundra: 'on the tundra',
  sea: 'at sea',
};
const DEATHS: Readonly<Record<string, string>> = {
  character: 'by an enemy character',
  neutral: 'by neutrals',
  other: 'in other ways',
};

/** How each kind of slice reads after its base's label. */
const SLICES: Readonly<Record<string, (value: string) => string | undefined>> = {
  'by kind': (v) => BATTLE_KINDS[v],
  'by terrain': (v) => TERRAINS[v] ?? `on ${v} terrain`,
  "by the realm's leading unit": (v) =>
    v === 'none' ? "when the realm's side has no army" : `when the realm's army is mostly ${v}`,
  'by grade': (v) => `${v} lairs`,
  'by how': (v) => DEATHS[v],
  'by school': (v) => `${v} magic`,
  // A named scenario's slice (tests/balance/scenarios/encounter.ts): 'chases: caught | by Spy: 3 against 0'.
  'by Spy': (v) => {
    const m = /^(\d+) against (\d+)$/.exec(v);
    return m ? `a hunter of Spy ${String(m[1])} after a quarry of Spy ${String(m[2])}` : undefined;
  },
  // A named scenario's slice (tests/balance/scenarios/a-chase-held-by-an-unresolved-battle.ts):
  // 'chases: waited for a battle | when: in Early Summer'.
  when: (v) => (v === 'on the catch in Spring' || v === 'in Early Summer' ? v : undefined),
  // The bots' statistics (B-17d): 'bots: casts left unused | by alignment: Divine'.
  'by alignment': (v) => `of the ${v} realms`,
  'by race': (v) => `of the ${v} realms`,
  // 'game: ended | by: the Reckoning': the share of the games that ended, ended this way.
  by: (v) => `by ${v}`,
};

/** The plain-words label of a statistic, or undefined if it has none (the test makes that an error). */
export function labelOf(key: string): string | undefined {
  const base = BASE_LABELS[baseOf(key)] ?? theBotsBaseLabel(baseOf(key));
  const slice = key.split(' | ')[1];
  if (base == null || slice == null) return base;
  const [kind = '', value = ''] = slice.split(/: (.*)/);
  const words = SLICES[kind]?.(value);
  if (words == null) return undefined;
  return kind === 'by' && baseOf(key) === 'game: ended'
    ? `Games over ${words}, of those that ended`
    : `${base}, ${words}`;
}

/** The label, or the statistic's own name in quotes if it has none. */
export const label = (key: string): string => labelOf(key) ?? `"${key}"`;
