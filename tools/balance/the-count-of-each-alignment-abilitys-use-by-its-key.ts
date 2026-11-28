// The count of each alignment ability's use by its key (B-17c): how the balance matrix counts, per realm per game, the
// use of each of the 51 alignment abilities (ALIGNMENT_ABILITIES, src/content/alignment-abilities-their-keys-names-
// numbers-and-words.ts). Each key has one counting rule, and a key with none fails to compile (`satisfies
// Record<AlignmentAbilitySlug, …>`):
// - by a line's kind: each line of one of its kinds, for the realm the line names in a given place;
// - by an order: each phase a hero of the realm gives the order (the telemetry's orders, `orders[realm].chars[id].ph[].a`);
// - by a fact: what a line's fact records (a gold sum, the realm that declared, the heroes who fought);
// - from the state: the ability's effect as the saved world shows it at the turn's end, or how it moved over the turn;
// - a stand-in from the state: what the world holds where the ability could act (companies held, beasts led), not its
//   use: B-17e treats it as not used, by name;
// - at the set-up: once for each realm the world is made with it;
// - not countable yet: the events and the state don't show its use (the reason given).
// A use is an act or the ability's own effect taking place (the run's decision, 28 November). Only the realms of the
// ability's alignment count (the undead hero in a duel: his own alignment). The count reads the
// kinds, the facts, the orders and the state, never the words players read (BOT-S6), and it changes nothing: every-
// realm.ts gathers it beside each game's reports, outside the baselines (the statistics report is B-17d's).
import {
  ALIGNMENT_ABILITIES,
  THE_ALIGNMENT_ORDERS,
  THE_RACE_THE_RISEN_DEAD_ARE_MADE_AS,
  type AlignmentAbilitySlug,
} from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { THE_STATES_TWO_REALMS_STAND_IN } from '../../src/content/the-relations-between-two-realms-the-three-states-a-pair-stands-in-and-the-treat-declaration.ts';
import { getDruidLevel } from '../../src/engine/rules-on-plain-values/beasts-a-hero-may-lead-and-the-druid-each-unit-needs.ts';
import {
  CREATURE_ARMIES,
  MONSTER_ARMIES,
} from '../../src/engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts';
import type { LineFact } from '../../src/engine/turn/events-and-their-audiences.ts';

/** A company as the count reads it. */
interface ACompany {
  readonly type?: string;
  readonly race?: string;
}
/** A hero as the count reads him. */
interface AHero {
  readonly id: number;
  readonly name?: string;
  readonly player?: number | null;
  readonly alive?: boolean;
  readonly alignment?: string;
  readonly skills?: Readonly<Record<string, number>>;
  readonly armies?: readonly ACompany[];
}
/** The saved world as the count reads it. */
export interface TheWorldAsTheCountReadsIt {
  readonly players: readonly { readonly alignment?: string }[];
  readonly characters?: readonly AHero[];
  readonly relations?: Readonly<Record<string, string>>;
  readonly world?: {
    readonly provinces?: readonly { readonly owner?: number | null; readonly battleGraves?: readonly unknown[] }[];
  };
}
/** A line of the turn as the count reads it: its kind, its fact, and the realms and heroes it names. */
export interface ALineAsTheCountReadsIt {
  readonly kind: LineFact['kind'] | null;
  readonly fact?: LineFact;
  readonly actor: number | null;
  readonly targets: readonly (number | null)[];
  readonly charIds: readonly number[] | null;
}
/** The orders of each realm in a turn, as the telemetry keeps them. */
export type TheOrdersOfATurn = Readonly<
  Record<string, { readonly chars?: Readonly<Record<string, { readonly ph?: readonly { readonly a?: string }[] }>> }>
>;
/** What one turn gives the count: the world before and after it, its lines, and its orders. */
export interface ATurnAsTheCountReadsIt {
  readonly before: TheWorldAsTheCountReadsIt;
  readonly after: TheWorldAsTheCountReadsIt;
  readonly lines: readonly ALineAsTheCountReadsIt[];
  readonly orders: TheOrdersOfATurn;
}

/** Where a line names the realm whose use it is: its actor, its first or its second target (a battle's lines name the
 *  attacker's realm first and the defender's second), or each realm it names. */
type WhereALineNamesTheRealm = 'its actor' | 'its first target' | 'its second target' | 'each realm it names';
/** The order keys the count reads: the five alignment orders' own, and a Research. */
type AnOrderTheCountReads = (typeof THE_ALIGNMENT_ORDERS)[keyof typeof THE_ALIGNMENT_ORDERS]['key'] | 'research';

interface CountedByALinesKind {
  readonly by: "a line's kind";
  readonly lines: readonly { readonly kind: LineFact['kind']; readonly realm: WhereALineNamesTheRealm }[];
}
interface CountedByAnOrder {
  readonly by: 'an order';
  readonly order: AnOrderTheCountReads;
  /** Only an order given by a hero with at least a level of this skill (the scholars: Sage). */
  readonly byAHeroWithTheSkill?: 'sage';
}
interface CountedByAFact {
  readonly by: 'a fact';
  readonly kind: LineFact['kind'];
  /** The realms whose use the line records, one entry a use. */
  readonly uses: (line: ALineAsTheCountReadsIt, turn: ATurnAsTheCountReadsIt) => readonly number[];
  /** Counted by the hero's own alignment, not his realm's. */
  readonly byTheHerosOwnAlignment?: true;
}
interface CountedFromTheState {
  readonly by: 'the state';
  /** The realm's uses in the turn. */
  readonly uses: (turn: ATurnAsTheCountReadsIt, realm: number) => number;
}
interface AStandInFromTheState {
  readonly by: 'a stand-in from the state';
  /** What the world holds where the ability could act, in the turn. */
  readonly holds: (turn: ATurnAsTheCountReadsIt, realm: number) => number;
  /** Why it is a stand-in, and what its use would be. */
  readonly why: string;
}
interface CountedAtTheSetUp {
  readonly by: 'the set-up';
  /** What the world is made with. */
  readonly what: string;
}
interface NotCountableYet {
  readonly by: 'not countable yet';
  readonly why: string;
}
/** How an ability's use is counted. */
export type HowAnAbilitysUseIsCounted =
  | CountedByALinesKind
  | CountedByAnOrder
  | CountedByAFact
  | CountedFromTheState
  | AStandInFromTheState
  | CountedAtTheSetUp
  | NotCountableYet;

/** A fact rule over the lines of one kind, its fact typed as that kind's. */
function byAFact<K extends LineFact['kind']>(
  kind: K,
  uses: (
    fact: Extract<LineFact, { kind: K }>,
    line: ALineAsTheCountReadsIt,
    turn: ATurnAsTheCountReadsIt,
  ) => readonly number[],
  byTheHerosOwnAlignment?: true,
): CountedByAFact {
  const isOfTheKind = (fact: LineFact | undefined): fact is Extract<LineFact, { kind: K }> => fact?.kind === kind;
  return {
    by: 'a fact',
    kind,
    uses: (line, turn) => (isOfTheKind(line.fact) ? uses(line.fact, line, turn) : []),
    ...(byTheHerosOwnAlignment ? { byTheHerosOwnAlignment } : {}),
  };
}

const theRealmOfALinesActor = (line: ALineAsTheCountReadsIt): readonly number[] =>
  line.actor === null ? [] : [line.actor];

/** The seven zeal lines: the attacker's (a battle's, a lair's), the defender's. */
const THE_ZEAL_LINES: CountedByALinesKind = {
  by: "a line's kind",
  lines: [
    { kind: "the attacker's forces fight with fanatical zeal", realm: 'its first target' },
    { kind: "the attacker's troops fight with fanatical zeal", realm: 'its first target' },
    { kind: "the defender's forces fight with fanatical zeal", realm: 'its second target' },
    { kind: 'the defenders fight with fanatical zeal on consecrated ground', realm: 'its second target' },
  ],
};

/** The companies a realm's living heroes lead, with their leaders. */
const theCompaniesARealmLeads = (world: TheWorldAsTheCountReadsIt, realm: number) =>
  (world.characters ?? [])
    .filter((c) => c.player === realm && c.alive === true)
    .flatMap((hero) => (hero.armies ?? []).map((company) => ({ hero, company })));

/** The beasts of a class a realm's heroes lead at the turn's end with less Druid than the beast needs. */
const theBeastsLedWithoutTheDruid =
  (theClass: ReadonlySet<string>) =>
  (turn: ATurnAsTheCountReadsIt, realm: number): number =>
    theCompaniesARealmLeads(turn.after, realm).filter(
      ({ hero, company }) =>
        company.type !== undefined &&
        theClass.has(company.type) &&
        getDruidLevel(company.type) > (hero.skills?.['druid'] ?? 0),
    ).length;

/** The pairs allied before the turn and at war after it, the realm one of them (both realms Evil or Undead: both
 *  counted, whichever broke it). */
const theAlliancesBrokenIntoWar = (turn: ATurnAsTheCountReadsIt, realm: number): number =>
  Object.entries(turn.after.relations ?? {}).filter(
    ([pair, state]) =>
      state === THE_STATES_TWO_REALMS_STAND_IN.atWar &&
      turn.before.relations?.[pair] === THE_STATES_TWO_REALMS_STAND_IN.allied &&
      pair.split('-').map(Number).includes(realm),
  ).length;

/** A duel before a battle: each Undead hero of the two who fight it (the fact's challenger and challenged, found among
 *  the heroes the battle's line lists). Personal combat in a lair or an encounter (no duel before a battle) isn't
 *  counted. */
const theUndeadHeroesInADuel = (
  fact: Extract<LineFact, { kind: 'a personal duel before the battle begins' }>,
  line: ALineAsTheCountReadsIt,
  turn: ATurnAsTheCountReadsIt,
): readonly number[] =>
  (line.charIds ?? []).flatMap((id) => {
    const hero = (turn.before.characters ?? []).find((c) => c.id === id);
    const duels = hero?.name !== undefined && (hero.name === fact.challengerName || hero.name === fact.challengedName);
    return duels && hero.alignment === 'Undead' && typeof hero.player === 'number' ? [hero.player] : [];
  });

/** How each alignment ability's use is counted, by its key. */
export const HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED = {
  'neutral-trade': byAFact('a realm collects its taxes', (fact, line) =>
    fact.neutralTrade > 0 ? theRealmOfALinesActor(line) : [],
  ),
  'consecrated-ground-tax': byAFact('a realm collects its taxes', (fact, line) =>
    fact.consecratedGround > 0 ? theRealmOfALinesActor(line) : [],
  ),
  'zeal-of-a-divine-realm': THE_ZEAL_LINES,
  'zeal-of-a-good-realm': THE_ZEAL_LINES,
  'zeal-of-a-druidic-realm': THE_ZEAL_LINES,
  'zeal-of-a-neutral-realm': THE_ZEAL_LINES,
  'zeal-of-a-pagan-realm': THE_ZEAL_LINES,
  'zeal-of-an-evil-realm': THE_ZEAL_LINES,
  'zeal-of-an-undead-realm': THE_ZEAL_LINES,
  'consecrated-ground-doubles-a-defenders-zeal': {
    by: "a line's kind",
    lines: [{ kind: 'the defenders fight with fanatical zeal on consecrated ground', realm: 'its second target' }],
  },
  // a side's lines name both realms of the battle: an Evil realm against an Evil realm, both counted
  'savage-fury': {
    by: "a line's kind",
    lines: [
      { kind: "the attacker's monsters are driven to savage fury", realm: 'its first target' },
      { kind: "a side's monsters are driven to savage fury", realm: 'each realm it names' },
    ],
  },
  'skeletal-fervour': {
    by: "a line's kind",
    lines: [
      { kind: "a side's skeletal legions fight with fanaticism under their undead king", realm: 'each realm it names' },
      { kind: "a side's skeletal legions know no fear", realm: 'each realm it names' },
    ],
  },
  'consecrated-ground-weakens-an-unholy-attacker': {
    by: "a line's kind",
    lines: [{ kind: "the consecrated ground of the province weakens the attacker's host", realm: 'its second target' }],
  },
  'righteous-defence': {
    by: 'not countable yet',
    why: "a battle factor with no line of its own: it shows only in the battle's strength record, which no event keeps",
  },
  'banner-of-fellowship': {
    by: "a line's kind",
    // each roll of converging columns to unite, which the Banner raises: joined or missed
    lines: [
      { kind: "a contingent joins a hero's assault on a guarded province", realm: 'its actor' },
      { kind: 'a contingent cannot link up in time against a guarded province', realm: 'its actor' },
      { kind: "a contingent joins a hero's assault on a rival's province", realm: 'its actor' },
      { kind: "a contingent misses the timing against a rival's province", realm: 'its actor' },
    ],
  },
  'home-of-the-wild': {
    by: 'not countable yet',
    why: "a battle factor with no line of its own: it shows only in the battle's strength record, which no event keeps",
  },
  // as savage fury's: an Evil realm against an Evil realm, both counted
  'reign-of-fear': {
    by: "a line's kind",
    lines: [{ kind: 'the province still cowers under a reign of fear', realm: 'each realm it names' }],
  },
  'the-deathless-march': {
    by: "a line's kind",
    lines: [{ kind: "the loser's skeletal host stands its ground in a deathless march", realm: 'each realm it names' }],
  },
  'the-neutral-mercenary-discount': {
    by: "a line's kind",
    lines: [{ kind: 'a hero hires a mercenary band', realm: 'its actor' }],
  },
  'the-divine-blessing': {
    by: "a line's kind",
    lines: [{ kind: 'a province is blessed and warded', realm: 'its actor' }],
  },
  'creatures-follow-without-a-druid': {
    by: 'a stand-in from the state',
    holds: theBeastsLedWithoutTheDruid(CREATURE_ARMIES),
    why: "the Creatures its heroes lead with less Druid than they need; its use is the Druid's penalty waived in a battle, which no event keeps",
  },
  'monsters-follow-without-a-druid': {
    by: 'a stand-in from the state',
    holds: theBeastsLedWithoutTheDruid(MONSTER_ARMIES),
    why: "the Monsters its heroes lead with less Druid than they need; its use is the Druid's penalty waived in a battle, which no event keeps",
  },
  'neutral-scholars': { by: 'an order', order: 'research', byAHeroWithTheSkill: 'sage' },
  'divine-grace': {
    by: "a line's kind",
    lines: [
      // at the return, a king's too (his death's line, "will rise again", is no use)
      { kind: 'a Divine hero returns to life on the nearest consecrated ground', realm: 'its actor' },
    ],
  },
  'the-divine-rest': byAFact('a hero rests and recovers', (fact, line) =>
    fact.isDivine ? theRealmOfALinesActor(line) : [],
  ),
  'a-pagan-victors-blood-harvest': {
    by: "a line's kind",
    // the attacker's harvest and the defender's: the line, in the battle's narrative, names both realms (a Pagan against
    // a Pagan: both counted, whichever harvests)
    lines: [{ kind: 'the blood harvest claims offerings from the fallen enemy units', realm: 'each realm it names' }],
  },
  'plunder-or-enslave': {
    by: "a line's kind",
    lines: [
      { kind: "an Evil conqueror's forces plunder a province", realm: 'its actor' },
      { kind: 'an Evil conqueror presses the beaten folk into the garrison in chains', realm: 'its actor' },
    ],
  },
  'graves-keep-on-undead-land': {
    by: 'the state',
    uses: (turn, realm) =>
      (turn.after.world?.provinces ?? []).filter((p) => p.owner === realm && (p.battleGraves?.length ?? 0) > 0).length,
  },
  'war-without-warning-of-an-evil-realm': byAFact('an Evil or Undead realm declares war without warning', (fact) => [
    fact.declarer.seat,
  ]),
  'war-without-warning-of-an-undead-realm': byAFact('an Evil or Undead realm declares war without warning', (fact) => [
    fact.declarer.seat,
  ]),
  'a-broken-alliance-means-war-for-an-evil-realm': { by: 'the state', uses: theAlliancesBrokenIntoWar },
  'a-broken-alliance-means-war-for-an-undead-realm': { by: 'the state', uses: theAlliancesBrokenIntoWar },
  'the-risen-dead-follow-only-the-undead': {
    by: 'a stand-in from the state',
    holds: (turn, realm) =>
      theCompaniesARealmLeads(turn.after, realm).filter(
        ({ company }) => company.race === THE_RACE_THE_RISEN_DEAD_ARE_MADE_AS,
      ).length,
    why: 'the companies of the risen dead its heroes lead; its use is a hand-over of them, which no line names (the bots record the ones their check strikes out)',
  },
  'an-undead-hero-is-undead-in-personal-combat': byAFact(
    'a personal duel before the battle begins',
    theUndeadHeroesInADuel,
    true,
  ),
  'a-divine-king-starts-with-white-magic': { by: 'the set-up', what: "the king's White magic" },
  'a-druidic-king-starts-with-druid': { by: 'the set-up', what: "the king's Druid skill" },
  'an-evil-king-starts-with-druid': { by: 'the set-up', what: "the king's Druid skill" },
  'a-pagan-king-starts-with-explorer': { by: 'the set-up', what: "the king's Explorer skill" },
  'an-undead-king-starts-with-necromancy': { by: 'the set-up', what: "the king's Necromancy" },
  'an-undead-king-starts-with-a-skeletal-company': { by: 'the set-up', what: "the king's skeletal company" },
  'a-pagan-capital-opens-beside-the-ritual-stones': { by: 'the set-up', what: 'the capital beside the ritual stones' },
  'a-druidic-capital-opens-beside-creatures': { by: 'the set-up', what: 'the capital beside creatures' },
  'an-evil-capital-opens-beside-monsters': { by: 'the set-up', what: 'the capital beside monsters' },
  'a-druidic-wanderer-knows-the-druids-craft': { by: 'the set-up', what: "the Druidic wanderers' Druid skill" },
  'one-divine-realm-a-game': { by: 'the set-up', what: 'one Divine realm in the game' },
  'one-undead-realm-a-game': { by: 'the set-up', what: 'one Undead realm in the game' },
  consecrate: { by: 'an order', order: THE_ALIGNMENT_ORDERS.consecrate.key },
  'call-to-arms': { by: 'an order', order: THE_ALIGNMENT_ORDERS['call-to-arms'].key },
  broker: { by: 'an order', order: THE_ALIGNMENT_ORDERS.broker.key },
  'harvest-the-field': { by: 'an order', order: THE_ALIGNMENT_ORDERS['harvest-the-field'].key },
  'perform-rite': { by: 'an order', order: THE_ALIGNMENT_ORDERS['perform-rite'].key },
} as const satisfies Record<AlignmentAbilitySlug, HowAnAbilitysUseIsCounted>;

/** Each key's uses in a game, by realm. */
export type TheUsesOfEachAlignmentAbility = Map<AlignmentAbilitySlug, Record<number, number>>;

const THE_KEYS = Object.keys(ALIGNMENT_ABILITIES).filter((k): k is AlignmentAbilitySlug => k in ALIGNMENT_ABILITIES);

/** No use yet, for every key. */
export const noUsesYet = (): TheUsesOfEachAlignmentAbility => new Map(THE_KEYS.map((key) => [key, {}]));

/** Adds `n` uses of `key` for `realm`. */
function add(into: TheUsesOfEachAlignmentAbility, key: AlignmentAbilitySlug, realm: number, n = 1): void {
  if (n <= 0) return;
  const uses = into.get(key) ?? {};
  uses[realm] = (uses[realm] ?? 0) + n;
  into.set(key, uses);
}

/** The realms of the world, by seat. */
const theRealms = (world: TheWorldAsTheCountReadsIt) => world.players.map((_, seat) => seat);

/** The realms a line names in the given place. */
function theRealmsALineNames(line: ALineAsTheCountReadsIt, where: WhereALineNamesTheRealm): readonly number[] {
  const seat = (v: number | null | undefined): readonly number[] => (typeof v === 'number' ? [v] : []);
  switch (where) {
    case 'its actor':
      return seat(line.actor);
    case 'its first target':
      return seat(line.targets[0]);
    case 'its second target':
      return seat(line.targets[1]);
    case 'each realm it names':
      return [...new Set([...seat(line.actor), ...line.targets.flatMap(seat)])];
  }
}

/** The saved world as the count reads it, from its JSON. */
export const theWorldAsTheCountReadsIt = (json: string): TheWorldAsTheCountReadsIt =>
  JSON.parse(json) as TheWorldAsTheCountReadsIt;

/** What a played turn hands the count (every-realm.ts): the saved world before and after it, as JSON; perception's
 *  events, each line with its fact; and the turn's statistics, its orders among them. */
export interface APlayedTurnAsTheCountTakesIt {
  readonly before: string;
  readonly after: string;
  readonly events: readonly {
    readonly line: {
      readonly actor: number | null;
      readonly targets: readonly (number | null)[];
      readonly charIds: readonly number[] | null;
    };
    readonly fact?: LineFact;
  }[];
  readonly statistics: { readonly orders?: TheOrdersOfATurn };
}

/** A played turn as the count reads it: each line's kind from its fact (a line written with its words has none). */
export const theTurnAsTheCountReadsIt = (played: APlayedTurnAsTheCountTakesIt): ATurnAsTheCountReadsIt => ({
  before: theWorldAsTheCountReadsIt(played.before),
  after: theWorldAsTheCountReadsIt(played.after),
  lines: played.events.map(({ line, fact }) => ({
    kind: fact?.kind ?? null,
    ...(fact ? { fact } : {}),
    actor: line.actor,
    targets: line.targets,
    charIds: line.charIds,
  })),
  orders: played.statistics.orders ?? {},
});

/** Counts the uses at the world's making: each set-up ability, once for each realm of its alignment. */
export function countTheSetUp(world: TheWorldAsTheCountReadsIt, into: TheUsesOfEachAlignmentAbility): void {
  for (const key of THE_KEYS) {
    if (HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED[key].by !== 'the set-up') continue;
    for (const realm of theRealms(world))
      if (world.players[realm]?.alignment === ALIGNMENT_ABILITIES[key].alignment) add(into, key, realm);
  }
}

/** A hero's level in a skill as the turn begins (0: none, or no such hero). */
const theSkillOf = (turn: ATurnAsTheCountReadsIt, id: number, skill: string): number =>
  (turn.before.characters ?? []).find((c) => c.id === id)?.skills?.[skill] ?? 0;

/** Counts one turn's uses of every ability, by realm (a stand-in's figure too). */
export function countATurn(turn: ATurnAsTheCountReadsIt, into: TheUsesOfEachAlignmentAbility): void {
  for (const key of THE_KEYS) {
    const rule: HowAnAbilitysUseIsCounted = HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED[key];
    const ofTheAlignment = (realm: number) =>
      turn.before.players[realm]?.alignment === ALIGNMENT_ABILITIES[key].alignment;
    switch (rule.by) {
      case "a line's kind":
        for (const line of turn.lines)
          for (const { kind, realm: where } of rule.lines)
            if (line.kind === kind)
              for (const realm of theRealmsALineNames(line, where)) if (ofTheAlignment(realm)) add(into, key, realm);
        break;
      case 'an order':
        for (const [realm, theirs] of Object.entries(turn.orders))
          if (ofTheAlignment(Number(realm)))
            for (const [id, hero] of Object.entries(theirs.chars ?? {}))
              if (rule.byAHeroWithTheSkill === undefined || theSkillOf(turn, Number(id), rule.byAHeroWithTheSkill) > 0)
                add(into, key, Number(realm), (hero.ph ?? []).filter((p) => p.a === rule.order).length);
        break;
      case 'a fact':
        for (const line of turn.lines)
          if (line.kind === rule.kind)
            for (const realm of rule.uses(line, turn))
              if (rule.byTheHerosOwnAlignment || ofTheAlignment(realm)) add(into, key, realm);
        break;
      case 'the state':
        for (const realm of theRealms(turn.before))
          if (ofTheAlignment(realm)) add(into, key, realm, rule.uses(turn, realm));
        break;
      case 'a stand-in from the state':
        for (const realm of theRealms(turn.before))
          if (ofTheAlignment(realm)) add(into, key, realm, rule.holds(turn, realm));
        break;
      case 'the set-up':
      case 'not countable yet':
        break;
    }
  }
}

/** The keys not countable yet. */
export const THE_KEYS_NOT_COUNTABLE_YET = THE_KEYS.filter(
  (key) => HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED[key].by === 'not countable yet',
);

/** The keys counted by a stand-in from the state: not a use (B-17e treats them as not used). */
export const THE_KEYS_COUNTED_BY_A_STAND_IN = THE_KEYS.filter(
  (key) => HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED[key].by === 'a stand-in from the state',
);
