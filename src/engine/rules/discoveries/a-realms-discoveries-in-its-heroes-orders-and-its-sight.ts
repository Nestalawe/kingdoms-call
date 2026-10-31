// A realm's discoveries in its heroes' orders and in what it sees (plan P1-19's discoveries family, row P1-19ad): the
// effects of the kinds that help or hinder a spy, add to exploring, the Wild Hunt, a cleared lair's gold and items,
// research, practice and a rest (the stages of "orderOutcome"), and that help a realm spot a lurking enemy hero and map
// the provinces around an explorer (the first stages of "visibility"). Each is handed one effect the realm holds (its
// row's numbers and filters, in SAGE_DISCOVERIES_P) and the facts of its stage; the runners (the-registry-of-discovery-
// effects.ts) find the realm's effects of the kind and add, multiply or ask them, as the resolvers' reads did. A fact
// that may fix a realm's home, or costs a look at the map, is a question only an effect that needs it asks. No effect
// draws a die: the resolver rolls where it rolled before.
import type {
  DiscoveryEffectSlug,
  TheEffectOfADiscovery,
} from '../../../content/discovery-effects-their-kinds-numbers-and-words.ts';
import type {
  AResearchARealmsDiscoveriesMayHelp,
  ASkillARealmsDiscoveriesMayDrill,
  TheStagesOfEachHookPoint,
  WhereASpyActsAsARealmsDiscoveriesReadIt,
} from '../the-registry-of-content-effects.ts';

type TheOrdersStages = TheStagesOfEachHookPoint['orderOutcome'];
type TheSightsStages = TheStagesOfEachHookPoint['visibility'];

/** Whether an effect for spies reaches where the spy acts: the ground, the coast and the home its row names, asked in
 *  that order (resolveSpyOrder's scope, moved as it was). */
function doesItReachWhereTheSpyActs(e: TheEffectOfADiscovery, facts: WhereASpyActsAsARealmsDiscoveriesReadIt): boolean {
  return (
    (!e.terrains || (facts.theGround != null && e.terrains.includes(facts.theGround))) &&
    (!e.coastal || facts.isItCoastal()) &&
    (!e.home || facts.isItTheRealmsHome())
  );
}

/** Whether an effect reaches the ground: every ground, or the ground its row lists. */
function doesItReachTheGround(e: TheEffectOfADiscovery, theGround: string): boolean {
  return !e.terrains || e.terrains.includes(theGround);
}

/** "orderOutcome: a realm's discoveries add to a spy's chance" (`spy`): its `pct`, where it reaches. */
export const A_REALMS_DISCOVERIES_ADD_TO_A_SPYS_CHANCE = {
  spying: (e, facts) => (doesItReachWhereTheSpyActs(e, facts) ? (e.pct ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries add to a spy's chance"]>>;

/** "orderOutcome: a realm's discoveries cut a rival spy's chance" (`counterSpy`): its `pct`, where it reaches. */
export const A_REALMS_DISCOVERIES_CUT_A_RIVAL_SPYS_CHANCE = {
  'counter-spying': (e, facts) => (doesItReachWhereTheSpyActs(e, facts) ? (e.pct ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries cut a rival spy's chance"]>>;

/** "orderOutcome: a realm's discoveries add to spying on a hero" (`spyChar`): its `pct`, where it reaches. */
export const A_REALMS_DISCOVERIES_ADD_TO_SPYING_ON_A_HERO = {
  'spying-on-a-hero': (e, facts) => (doesItReachWhereTheSpyActs(e, facts) ? (e.pct ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries add to spying on a hero"]>>;

/** "orderOutcome: a realm's discoveries add to catching a spy" (`catchSpy`): its `pct`, where it reaches. */
export const A_REALMS_DISCOVERIES_ADD_TO_CATCHING_A_SPY = {
  'catching-a-spy': (e, facts) => (doesItReachWhereTheSpyActs(e, facts) ? (e.pct ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries add to catching a spy"]>>;

/** "orderOutcome: a realm's discoveries keep a spy's success quiet" (Disguise Techniques, `spyDisguise`): its `pct`,
 *  0.5 for a row that writes none (discParam's fallback, which no row reads: Parked "discParam's fallbacks"). */
export const A_REALMS_DISCOVERIES_KEEP_A_SPYS_SUCCESS_QUIET = {
  'disguise-techniques': (e) => e.pct ?? 0.5,
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries keep a spy's success quiet"]>>;

/** "orderOutcome: a realm's discoveries add to exploring" (`explore`): its `mult` (1 for a row with none), on the ground
 *  it lists. */
export const A_REALMS_DISCOVERIES_ADD_TO_EXPLORING = {
  exploring: (e, facts) => (doesItReachTheGround(e, facts.theGround) ? (e.mult ?? 1) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries add to exploring"]>>;

/** "orderOutcome: a realm's discoveries lengthen the wild hunt" (The Long Hunt, `wildHunt`): its `turns`. */
export const A_REALMS_DISCOVERIES_LENGTHEN_THE_WILD_HUNT = {
  'the-long-hunt': (e) => e.turns ?? 0,
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries lengthen the wild hunt"]>>;

/** "orderOutcome: a realm's discoveries add to a lair's gold" (`lairGold`): its `pct`, on the ground it lists, for a
 *  hero of the race it names. */
export const A_REALMS_DISCOVERIES_ADD_TO_A_LAIRS_GOLD = {
  'lair-gold': (e, facts) =>
    doesItReachTheGround(e, facts.theGround) && (!e.charRace || facts.theHerosRace === e.charRace)
      ? (e.pct ?? 0)
      : null,
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries add to a lair's gold"]>>;

/** "orderOutcome: a realm's discoveries add to a lair's item" (`itemChance`): its `pct`, on the ground it lists. */
export const A_REALMS_DISCOVERIES_ADD_TO_A_LAIRS_ITEM = {
  'lair-items': (e, facts) => (doesItReachTheGround(e, facts.theGround) ? (e.pct ?? 0) : null),
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries add to a lair's item"]>>;

/** "orderOutcome: a realm's discoveries add to research" (`research`): its `pct`, for every field, or for the realm's
 *  own creed if its row names `own` (another field: nothing). */
export const A_REALMS_DISCOVERIES_ADD_TO_RESEARCH = {
  research: (e, facts) =>
    !e.field || (e.field === 'own' && facts.isTheFieldStudiedItsOwnCreed()) ? (e.pct ?? 0) : null,
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries add to research"]>>;

/** "orderOutcome: a realm's discoveries add to practice" (`practice`): its `pct`, for every skill or the skills it
 *  lists. */
export const A_REALMS_DISCOVERIES_ADD_TO_PRACTICE = {
  practice: (e, facts) =>
    !e.skills || (facts.theSkill != null && e.skills.includes(facts.theSkill)) ? (e.pct ?? 0) : null,
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries add to practice"]>>;

/** "orderOutcome: a realm's discoveries add to a rest's heal" (`rest`): its `hp`, on the realm's ground, its home or
 *  the ground it names, asked in that order. */
export const A_REALMS_DISCOVERIES_ADD_TO_A_RESTS_HEAL = {
  resting: (e, facts) =>
    (!e.owned || facts.isItHisRealmsGround) &&
    (!e.home || (facts.isItHisRealmsGround && facts.isItHisRealmsHome())) &&
    doesItReachTheGround(e, facts.theGround)
      ? (e.hp ?? 0)
      : null,
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries add to a rest's heal"]>>;

/** "orderOutcome: a realm's discoveries heal a resting hero in full" (Medical Arts, `restFull`). */
export const A_REALMS_DISCOVERIES_HEAL_A_RESTING_HERO_IN_FULL = {
  'medical-arts': () => true,
} satisfies Partial<Record<DiscoveryEffectSlug, TheOrdersStages["a realm's discoveries heal a resting hero in full"]>>;

/** "visibility: a realm's discoveries spot a hero lurking in its province" (`spotLurker`): its `pct`, on the ground,
 *  the home and the coast its row names, asked in that order. */
export const A_REALMS_DISCOVERIES_SPOT_A_HERO_LURKING_IN_ITS_PROVINCE = {
  'watching-for-lurkers': (e, facts) =>
    doesItReachTheGround(e, facts.theGround) &&
    (!e.home || facts.isItTheRealmsHome()) &&
    (!e.coastal || facts.isItCoastal())
      ? (e.pct ?? 0)
      : null,
} satisfies Partial<
  Record<DiscoveryEffectSlug, TheSightsStages["a realm's discoveries spot a hero lurking in its province"]>
>;

/** "visibility: a realm's discoveries map the provinces around an explorer" (Ancient Lore, `adjacentReveal`): its
 *  `pct`, 10 for a row that writes none (discParam's fallback, which no row reads: Parked "discParam's fallbacks"). */
export const A_REALMS_DISCOVERIES_MAP_THE_PROVINCES_AROUND_AN_EXPLORER = {
  'ancient-lore': (e) => e.pct ?? 10,
} satisfies Partial<
  Record<DiscoveryEffectSlug, TheSightsStages["a realm's discoveries map the provinces around an explorer"]>
>;

/** The facts the report's odds hand a spy's effects (buildTurnReport): no province, so an effect scoped by ground or
 *  coast doesn't count, and one scoped to a home does (the report's rule as it was; no `spy` row names a home). */
export const THE_REPORTS_ODDS_NAME_NO_PROVINCE: WhereASpyActsAsARealmsDiscoveriesReadIt = {
  theGround: undefined,
  isItCoastal: () => false,
  isItTheRealmsHome: () => true,
};

/** The facts the report's odds hand a Research order's effects (buildTurnReport): the field studied is not named, so
 *  an effect for the realm's own creed doesn't count. */
export const THE_REPORTS_RESEARCH_NAMES_NO_FIELD: AResearchARealmsDiscoveriesMayHelp = {
  isTheFieldStudiedItsOwnCreed: () => false,
};

/** The facts the report's odds hand a practice's effects for every skill (buildTurnReport): no skill named, so an
 *  effect that lists skills doesn't count. */
export const THE_REPORTS_PRACTICE_NAMES_NO_SKILL: ASkillARealmsDiscoveriesMayDrill = { theSkill: undefined };
