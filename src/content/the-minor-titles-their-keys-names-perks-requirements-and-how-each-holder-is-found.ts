// The minor titles (B-06, T7, the rules pulled out: its Reckoning and titles family, from B-06i): 20 honorary titles
// that do NOT count toward victory but each grant the holding hero a small perk. Each is awarded every turn to the
// single best living hero of a realm by its measure (ties to the first found, in this list's order; a measure of 0
// leaves the title vacant): src/engine/titles/reckoning.ts's computeMinorTitles. A row gives the title's key (the
// saved holders' key, `_minorHolders`), its name, its perk and its requirement as players read them, and how its
// holder is found. The minor titles' registry (src/engine/rules/the-registry-of-the-minor-titles-perks.ts) has one
// entry for each row and no other: a row with no entry, or an entry with no row, fails to compile. How to add one:
// docs/architecture/the-minor-titles-registry-its-hook-points-and-how-to-add-a-perk.md.

/** A kind of company a minor title counts (its holder is found by them) or lifts (its holder's companies of it fight
 *  stronger): any, cavalry, Creatures and Monsters, or heavy units and fleets. */
export type AKindOfCompanyAMinorTitleCounts = 'any' | 'cavalry' | 'creatures and monsters' | 'heavy units and fleets';

/** A minor title's army perk, as the battle's ladder names it: two titles that give one perk (the Naturalist and the
 *  Beastmaster) lift a company once, however many of them its commander holds. */
export type AMinorTitlesArmyPerk = 'naturalist or beastmaster' | 'cavalier' | 'ironclad';

/** How the holder of a minor title is found: the measure each living hero of a realm is held to (the highest holds it). */
export type HowTheHolderOfAMinorTitleIsFound =
  /** his trained level of the skill (0 to 9) */
  | { readonly theMeasure: 'his level of a skill'; readonly theSkill: string }
  /** his maximum hit points, or these if none is written */
  | { readonly theMeasure: 'his maximum hit points'; readonly theHitPointsOfAHeroWithNoneWritten: number }
  /** the heroes of other realms he has killed (his `duelKills`) */
  | { readonly theMeasure: 'the heroes of other realms he has killed' }
  /** the merits he has earned in play */
  | { readonly theMeasure: 'the merits he has earned' }
  /** the companies he leads, of any kind or of one */
  | { readonly theMeasure: 'the companies he leads'; readonly ofWhichKind: AKindOfCompanyAMinorTitleCounts }
  /** the magic items he carries */
  | { readonly theMeasure: 'the magic items he carries' }
  /** the provinces his realm holds, if he is its king (else nothing) */
  | { readonly theMeasure: 'the provinces his realm holds, if he is its king' }
  /** his highest trained level in any magic school */
  | { readonly theMeasure: 'his highest level in a magic school' };

/** A minor title's row: its key, name, perk and requirement as players read them, and how its holder is found. */
export interface AMinorTitleAsItsRowWritesIt {
  readonly key: string;
  readonly name: string;
  readonly perk: string;
  readonly req: string;
  readonly howTheHolderIsFound: HowTheHolderOfAMinorTitleIsFound;
  /** For a title whose holder's companies fight stronger in a battle (the minor titles' registry, strength: the
   *  commander's minor titles): the kind of company, the factor its strength is multiplied by (rounded after each
   *  title's step, in the stage's order), and the perk. */
  readonly theCompaniesItsHolderLeadsFightStronger?: {
    readonly ofWhichKind: Exclude<AKindOfCompanyAMinorTitleCounts, 'any'>;
    readonly by: number;
    readonly thePerk: AMinorTitlesArmyPerk;
  };
}

/** The minor titles, in the order their holders are found (it decides a tie, and the order their lines print). */
export const MINOR_TITLES = [
  {
    key: 'duelist',
    name: 'The Duelist',
    perk: '+1 melee in personal combat',
    req: 'Highest Melee skill of any living character.',
    howTheHolderIsFound: { theMeasure: 'his level of a skill', theSkill: 'melee' },
  },
  {
    key: 'marksman',
    name: 'The Marksman',
    perk: '+1 archery in personal combat',
    req: 'Highest Archery skill.',
    howTheHolderIsFound: { theMeasure: 'his level of a skill', theSkill: 'archery' },
  },
  {
    key: 'strategist',
    name: 'The Strategist',
    perk: '+1 Tactical command in battle',
    req: 'Highest Tactical skill.',
    howTheHolderIsFound: { theMeasure: 'his level of a skill', theSkill: 'tactical' },
  },
  {
    key: 'swift',
    name: 'The Swift',
    perk: '+1 land movement point',
    req: 'Highest March skill.',
    howTheHolderIsFound: { theMeasure: 'his level of a skill', theSkill: 'march' },
  },
  {
    key: 'seawolf',
    name: 'The Sea-Wolf',
    perk: '+1 sea movement point',
    req: 'Highest Naval skill.',
    howTheHolderIsFound: { theMeasure: 'his level of a skill', theSkill: 'naval' },
  },
  {
    key: 'shadow',
    name: 'The Shadow',
    perk: 'your spies are never detected',
    req: 'Highest Spy skill.',
    howTheHolderIsFound: { theMeasure: 'his level of a skill', theSkill: 'spy' },
  },
  {
    key: 'cutpurse',
    name: 'The Cutpurse',
    perk: '+2g personal stipend each turn',
    req: 'Highest Thief skill.',
    howTheHolderIsFound: { theMeasure: 'his level of a skill', theSkill: 'thief' },
  },
  {
    key: 'naturalist',
    name: 'The Naturalist',
    perk: 'Creature & Monster armies you lead +5%',
    req: 'Highest Druid skill.',
    howTheHolderIsFound: { theMeasure: 'his level of a skill', theSkill: 'druid' },
    theCompaniesItsHolderLeadsFightStronger: {
      ofWhichKind: 'creatures and monsters',
      by: 1.05,
      thePerk: 'naturalist or beastmaster',
    },
  },
  {
    key: 'loreseeker',
    name: 'The Loreseeker',
    perk: '+5% Sage discovery chance',
    req: 'Highest Sage skill.',
    howTheHolderIsFound: { theMeasure: 'his level of a skill', theSkill: 'sage' },
  },
  {
    key: 'trailblazer',
    name: 'The Trailblazer',
    perk: '+5% exploration',
    req: 'Highest Explorer skill.',
    howTheHolderIsFound: { theMeasure: 'his level of a skill', theSkill: 'explorer' },
  },
  {
    key: 'colossus',
    name: 'The Colossus',
    perk: '+2 HP recovered when resting',
    req: 'Highest maximum HP.',
    howTheHolderIsFound: { theMeasure: 'his maximum hit points', theHitPointsOfAHeroWithNoneWritten: 20 },
  },
  {
    key: 'widowmaker',
    name: 'The Widowmaker',
    perk: '+1 melee & +1 archery in combat',
    req: 'Most enemy characters slain in personal combat.',
    howTheHolderIsFound: { theMeasure: 'the heroes of other realms he has killed' },
  },
  {
    key: 'champion',
    name: 'Champion of the People',
    perk: '+2g personal stipend each turn',
    req: 'Most merits earned in play.',
    howTheHolderIsFound: { theMeasure: 'the merits he has earned' },
  },
  {
    key: 'hostleader',
    name: 'The Host-Leader',
    perk: 'army wages −1 per unit (min 1)',
    req: 'Leads the largest number of army units.',
    howTheHolderIsFound: { theMeasure: 'the companies he leads', ofWhichKind: 'any' },
  },
  {
    key: 'cavalier',
    name: 'The Cavalier',
    perk: 'cavalry you lead +5%',
    req: 'Leads the most cavalry units.',
    howTheHolderIsFound: { theMeasure: 'the companies he leads', ofWhichKind: 'cavalry' },
    theCompaniesItsHolderLeadsFightStronger: { ofWhichKind: 'cavalry', by: 1.05, thePerk: 'cavalier' },
  },
  {
    key: 'beastmaster',
    name: 'The Beastmaster',
    perk: 'Creature & Monster armies you lead +5%',
    req: 'Leads the most Creature and Monster units.',
    howTheHolderIsFound: { theMeasure: 'the companies he leads', ofWhichKind: 'creatures and monsters' },
    theCompaniesItsHolderLeadsFightStronger: {
      ofWhichKind: 'creatures and monsters',
      by: 1.05,
      thePerk: 'naturalist or beastmaster',
    },
  },
  {
    key: 'ironclad',
    name: 'The Ironclad',
    perk: 'heavy & fleet units you lead +5%',
    req: 'Leads the most heavy and fleet units.',
    howTheHolderIsFound: { theMeasure: 'the companies he leads', ofWhichKind: 'heavy units and fleets' },
    theCompaniesItsHolderLeadsFightStronger: { ofWhichKind: 'heavy units and fleets', by: 1.05, thePerk: 'ironclad' },
  },
  {
    key: 'relichunter',
    name: 'The Relic-Hunter',
    perk: '+1 melee & +1 archery in combat',
    req: 'Carries the most magic items.',
    howTheHolderIsFound: { theMeasure: 'the magic items he carries' },
  },
  {
    key: 'castellan',
    name: 'The Castellan',
    perk: '+1g per turn for every 5 provinces held',
    req: 'The king holding the most provinces.',
    howTheHolderIsFound: { theMeasure: 'the provinces his realm holds, if he is its king' },
  },
  {
    key: 'warlock',
    name: 'The Warlock',
    perk: '+1 spell of your best school/turn',
    req: 'Highest single magic-school level.',
    howTheHolderIsFound: { theMeasure: 'his highest level in a magic school' },
  },
] as const satisfies readonly AMinorTitleAsItsRowWritesIt[];

/** A minor title, by its key (the slug its registry's entry has). */
export type AMinorTitlesSlug = (typeof MINOR_TITLES)[number]['key'];

// ── The skills a minor title adds to at their point of use ──
// skillBonusBreakdown covers everything that changes the skill ITSELF — equipped items, the Crown
// of Command aura and the Curse spell. It does NOT cover the bonuses the engine adds at the point
// of use: the minor titles and the Veteran Training discovery. Those were invisible on the
// character card (only the four personal-combat ones were shipped, and nothing said where they came
// from), so a player holding The Strategist saw no sign of the +1 Tactical every one of his battles
// is fought with. This is the single module-level place those are enumerated; both the report card
// and the orders column render from it (extraSkillBonuses, src/engine/titles/reckoning.ts), and every
// entry carries a `kind` (for colour) and a `scope` (for when it applies), so the display can never
// claim a personal-combat bonus applies to a battle. The order is the character card's.
//
// SCOPES: 'always' — folded into the skill itself (handled by skillBonusBreakdown)
// 'combat' — personal combat only (duels, encounters, lair fights) — pcCharCombatant
// 'battle' — army battles only — combatVsChar / combatVsNPC command bonus
// 'move' — movement points only — computeMovePoolMax
// 'order' — the order's own success roll only (e.g. Sage research)
// Every entry here must correspond to a REAL engine site; the harness asserts each one.
export const SKILL_EXTRA_MINORS: readonly (readonly [
  key: AMinorTitlesSlug,
  skills: readonly string[],
  delta: number,
  kind: string,
  scope: string,
])[] = [
  // key skills delta kind scope
  ['duelist', ['melee'], 1, 'title', 'combat'],
  ['marksman', ['archery'], 1, 'title', 'combat'],
  ['widowmaker', ['melee', 'archery'], 1, 'title', 'combat'],
  ['relichunter', ['melee', 'archery'], 1, 'title', 'combat'],
  ['strategist', ['tactical'], 1, 'title', 'battle'],
  ['swift', ['march'], 1, 'title', 'move'],
  ['seawolf', ['naval'], 1, 'title', 'move'],
  ['loreseeker', ['sage'], 1, 'title', 'order'],
];
