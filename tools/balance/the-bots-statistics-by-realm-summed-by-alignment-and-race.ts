// The bots' statistics (B-17d, BOT-S1 and S2): what each bot realm did in a game of the balance matrix, summed by the
// realm's alignment and by its race. Each figure is a statistic in stats.ts's form, a [sum, count] pair a game, named
// 'base | slice' ('bots: ability used: consecrate | by alignment: Divine'), so paired.ts's noise rule judges it as any
// other slice. Only slices: none is a headline figure, so none reaches the overall answer (meaningfulChanges).
//
// The figures, each per bot realm in the game (the count: the realms of the slice), from:
// - the telemetry: the orders given, by kind (`orders.chars[id].ph[].a`, after the turn fills an empty phase with
//   Defend); the gold left unspent at each turn's end (`post.gold`: its count is the realm's turns, a mean per turn);
// - the bots' record of their choices (B-17b, play.ts's botChoices): the orders the hygiene dropped, by reason; the
//   phases with nothing else to do (every padding order by its kind, and the phases left empty); the casts left
//   unused (each hero's limit in a school as the hygiene applies it, less the casts he is given);
// - the count of each alignment ability's use by its key (B-17c, every-realm.ts's abilityUses): a use, or a typed
//   stand-in, each under a base of its own; an ability not countable yet has none. An ability counts only for the
//   realms of its alignment: its alignment slice is its own alignment's, and its race slices are of those realms.
// The page half (play.ts) gives the first two, the vm half (every-realm.ts) the third: run.ts joins them by the game's
// id and the realm's seat. Both halves seat realm i with the game's alignments[i] and races[i] (by index, mod their
// length: play.ts's setupGame, tests/lib/matrix-game.ts), and run.ts checks the vm's states are the page's.
// It only reads: no game plays differently for it (BOT-S5), and it reads no words players read (BOT-S6).
import {
  ALIGNMENT_ABILITIES,
  type AlignmentAbilitySlug,
} from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { THE_HERO_ORDERS } from '../../src/content/the-hero-orders-their-keys-the-names-the-turn-reads-them-by-and-their-tiers.ts';
import {
  THE_KINDS_OF_PADDING_ORDER,
  type TheBotsRecordOfARealmsTurn,
} from '../../src/engine/bots/the-bots-record-of-their-choices-per-realm-per-turn-kept-outside-the-save.ts';
import { setupsOf } from '../../tests/lib/matrix-game.ts';
import type { GameSpec } from './matrix.ts';
import type { Stats, TelemetryRow } from './stats.ts';
import {
  HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED,
  type HowAnAbilitysUseIsCounted,
} from './the-count-of-each-alignment-abilitys-use-by-its-key.ts';

/** The start of every base of the bots' statistics. */
export const THE_BOTS_STATISTICS = 'bots: ';
export const ORDERS_GIVEN = 'bots: orders given: ';
export const ORDERS_THE_HYGIENE_DROPPED = 'bots: orders the hygiene dropped';
export const PHASES_WITH_NOTHING_ELSE_TO_DO = 'bots: phases with nothing else to do';
export const CASTS_LEFT_UNUSED = 'bots: casts left unused';
export const ROOM_UNDER_THE_CAST_LIMITS = 'bots: room under the cast limits';
export const GOLD_UNSPENT = "bots: gold unspent at a turn's end";
export const ABILITY_USED = 'bots: ability used: ';
export const ABILITY_STAND_IN = "bots: an ability's stand-in: ";

/** The hygiene's outcomes that drop an order; the others (a hand-over trimmed, a lesson or a pairing added) change it. */
export const THE_HYGIENES_DROPS = [
  'summonTwice',
  'overLimit',
  'hireGone',
  'hireTwice',
  'hireElsewhere',
  'hireUnaffordable',
  'handoverAllSkeletal',
  'practiceCapped',
] as const satisfies readonly (keyof TheBotsRecordOfARealmsTurn['hygiene'])[];

/** A bot realm of a game: its seat, alignment and race. */
export interface ABotRealm {
  realm: number;
  alignment: string;
  race: string;
}

/** The bot realms of a game, as both halves seat them (tests/lib/matrix-game.ts's setupsOf: the scripted realm of a
 *  scripted game is no bot). */
export function theBotRealmsOfAGame(spec: GameSpec): ABotRealm[] {
  return setupsOf(spec)
    .filter((s) => s.isBot)
    .map((s) => ({ realm: s.id, alignment: s.alignment ?? '', race: s.race ?? '' }));
}

/** Every kind of order a hero can be given (the hero orders' keys, Pursue's among them): each is a base in every game,
 *  0 where none was given, so a game's figures never hang on which other games a run plays. */
export const THE_KINDS_OF_ORDER: readonly string[] = Object.values(THE_HERO_ORDERS).map((o) => o.key);

/** Every base of the page half, each in every game (0 where it didn't happen): a statistic a game lacks would leave
 *  the game out of the mean (stats.ts's valueOf). The gold's apart: its count is the realm's turns. */
export const THE_PAGE_HALFS_BASES: readonly string[] = [
  ...THE_KINDS_OF_ORDER.map((k) => ORDERS_GIVEN + k),
  ORDERS_THE_HYGIENE_DROPPED,
  ...THE_HYGIENES_DROPS.map((r) => `${ORDERS_THE_HYGIENE_DROPPED}: ${r}`),
  PHASES_WITH_NOTHING_ELSE_TO_DO,
  ...THE_KINDS_OF_PADDING_ORDER.map((k) => `${PHASES_WITH_NOTHING_ELSE_TO_DO}: ${k}`),
  `${PHASES_WITH_NOTHING_ELSE_TO_DO}: left empty`,
  CASTS_LEFT_UNUSED,
  ROOM_UNDER_THE_CAST_LIMITS,
];

/** A figure per realm: [sum, count] for each realm that has it. */
type PerRealm = Map<number, [number, number]>;

/** Each base's [sum, count] per realm, summed into its slices by alignment and by race, over `realms`. */
function sliced(into: Stats, base: string, perRealm: PerRealm, realms: readonly ABotRealm[]): void {
  for (const by of ['alignment', 'race'] as const) {
    for (const r of realms) {
      const key = `${base} | by ${by}: ${r[by]}`;
      const [sum, count] = perRealm.get(r.realm) ?? [0, 1];
      const v = into[key] ?? [0, 0];
      v[0] += sum;
      v[1] += count;
      into[key] = v;
    }
  }
}

/** The page half's figures of a game: the orders given, the gold unspent and the bots' record, by alignment and race. */
export function theBotsStatisticsOfThePageHalf(
  realms: readonly ABotRealm[],
  telemetry: readonly TelemetryRow[],
  botChoices: readonly TheBotsRecordOfARealmsTurn[],
): Stats {
  const bases = new Map<string, PerRealm>(THE_PAGE_HALFS_BASES.map((b) => [b, new Map()]));
  const add = (base: string, realm: number, sum: number, count = 0) => {
    const perRealm = bases.get(base) ?? new Map<number, [number, number]>();
    const v = perRealm.get(realm) ?? [0, 1];
    v[0] += sum;
    v[1] += count;
    perRealm.set(realm, v);
    bases.set(base, perRealm);
  };
  // only a bot realm's rows and records count: another seat's would add the bases of its own kinds of order
  const isABot = new Set(realms.map((r) => r.realm));
  const gold = new Map<number, [number, number]>();
  for (const row of telemetry) {
    if (!isABot.has(row.player_index)) continue;
    for (const hero of Object.values(row.orders?.chars ?? {}))
      for (const phase of hero.ph ?? []) if (phase?.a) add(ORDERS_GIVEN + phase.a, row.player_index, 1);
    const g = gold.get(row.player_index) ?? [0, 0];
    g[0] += row.post.gold;
    g[1] += 1;
    gold.set(row.player_index, g);
  }
  for (const turn of botChoices) {
    if (!isABot.has(turn.realm)) continue;
    for (const reason of THE_HYGIENES_DROPS) {
      const n = turn.hygiene[reason] ?? 0;
      add(`${ORDERS_THE_HYGIENE_DROPPED}: ${reason}`, turn.realm, n);
      add(ORDERS_THE_HYGIENE_DROPPED, turn.realm, n);
    }
    for (const kind of THE_KINDS_OF_PADDING_ORDER) {
      const n = turn.padding[kind] ?? 0;
      add(`${PHASES_WITH_NOTHING_ELSE_TO_DO}: ${kind}`, turn.realm, n);
      add(PHASES_WITH_NOTHING_ELSE_TO_DO, turn.realm, n);
    }
    add(`${PHASES_WITH_NOTHING_ELSE_TO_DO}: left empty`, turn.realm, turn.phasesLeftEmpty);
    add(PHASES_WITH_NOTHING_ELSE_TO_DO, turn.realm, turn.phasesLeftEmpty);
    // a hero's room under his cast limits, summed over his schools; the casts he could really have made: that room, no
    // more than his phases with nothing else to do
    const room = new Map<number, number>();
    for (const c of turn.casts) room.set(c.hero, (room.get(c.hero) ?? 0) + c.limitTheHygieneApplies - c.casts);
    for (const [hero, r] of room) {
      add(ROOM_UNDER_THE_CAST_LIMITS, turn.realm, r);
      const idle = turn.idle.find((h) => h.hero === hero)?.phases ?? 0;
      add(CASTS_LEFT_UNUSED, turn.realm, Math.min(r, idle));
    }
  }
  const s: Stats = {};
  for (const [base, perRealm] of bases) sliced(s, base, perRealm, realms);
  // every bot realm played a turn: a realm with no row has no turn to count
  sliced(
    s,
    GOLD_UNSPENT,
    gold,
    realms.filter((r) => gold.has(r.realm)),
  );
  return s;
}

/** The base an ability's figure goes under: its use, its stand-in, or none (not countable yet). */
export function theBaseOfAnAbilitysFigure(key: AlignmentAbilitySlug): string | null {
  const how: HowAnAbilitysUseIsCounted = HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED[key];
  if (how.by === 'not countable yet') return null;
  return (how.by === 'a stand-in from the state' ? ABILITY_STAND_IN : ABILITY_USED) + key;
}

/** Every ability key, in the registry's order. */
export const THE_ABILITY_KEYS: readonly AlignmentAbilitySlug[] = Object.keys(ALIGNMENT_ABILITIES).filter(
  (k): k is AlignmentAbilitySlug => k in ALIGNMENT_ABILITIES,
);

/** The vm half's figures of a game: each ability's uses (or its stand-in), for the bot realms of its alignment. */
export function theBotsStatisticsOfTheAbilities(
  realms: readonly ABotRealm[],
  abilityUses: Partial<Record<AlignmentAbilitySlug, Record<number, number>>>,
): Stats {
  const s: Stats = {};
  for (const key of THE_ABILITY_KEYS) {
    const base = theBaseOfAnAbilitysFigure(key);
    if (!base) continue;
    const ofItsAlignment = realms.filter((r) => r.alignment === ALIGNMENT_ABILITIES[key].alignment);
    const uses = abilityUses[key] ?? {};
    const perRealm: PerRealm = new Map(ofItsAlignment.map((r) => [r.realm, [uses[r.realm] ?? 0, 1]]));
    sliced(s, base, perRealm, ofItsAlignment);
  }
  return s;
}

/** Each game's statistics with its abilities' figures joined from the vm half's game of the same id (none for a game
 *  the vm half didn't play). */
export function withTheAbilitiesJoined<TheGame extends { id: string; stats: Stats }>(
  games: readonly TheGame[],
  vm: readonly { id: string; abilityUses?: Partial<Record<AlignmentAbilitySlug, Record<number, number>>> }[],
  specs: readonly GameSpec[],
): TheGame[] {
  const uses = new Map(vm.map((g) => [g.id, g.abilityUses]));
  const spec = new Map(specs.map((g) => [g.id, g]));
  return games.map((g) => {
    const theSpec = spec.get(g.id);
    const theUses = uses.get(g.id);
    if (!theSpec || !theUses) return g;
    return { ...g, stats: { ...g.stats, ...theBotsStatisticsOfTheAbilities(theBotRealmsOfAGame(theSpec), theUses) } };
  });
}

/** A statistic of the abilities (the vm half's): left out of a comparison when the vm half isn't played. */
export const isAnAbilitysFigure = (key: string): boolean =>
  key.startsWith(ABILITY_USED) || key.startsWith(ABILITY_STAND_IN);
