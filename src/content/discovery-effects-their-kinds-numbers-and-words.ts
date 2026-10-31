// The discoveries' effects the rule registry holds (plan P1-19's discoveries family, Decision 2): one row per kind of
// effect, keyed by its slug, naming the kind as SAGE_DISCOVERIES_P writes it (an effect's `kind`), with the numbers the
// code writes for that kind, each with how a text would write it. The discoveries' registry (src/engine/rules/the-
// registry-of-discovery-effects.ts) has one entry for each row and no other: a row with no entry, or an entry with no
// row, fails to compile. A row exists only for a kind whose effect the registry holds, so no row waits for its code;
// the kinds not yet taken are listed by tests/unit/the-rule-registry-holds-each-effect-once-in-the-order-of-its-
// stage.test.ts.
//
// Each discovery's own numbers stay in its row of SAGE_DISCOVERIES_P (its effect's `pct`, `delta`, filters, …): a
// realm holds its discoveries by id, and every number is read from that row, so an old save's discoveries work as
// content says today. No text states a number of these rows: the rulebook keeps the discoveries secret by design, and
// a discovery's `desc` states its own numbers (tests/static/each-discoverys-numbers-are-in-its-text.test.ts). The
// player page doesn't import this file.

/** One effect of a discovery (its row's `effect` or `effect2`, SAGE_DISCOVERIES_P): its `kind`, then every field a
 *  row may set, each read by the effect of its kind. The compiler checks every row against it where the registry's
 *  DISC_BY_ID is filled. The lists are read, never written; `quality` is a list or a single name. */
export interface TheEffectOfADiscovery {
  // the kind its effect is found by (since plan P1-19aa every row names one: the fifteen read by their discovery's id
  // named a `type` before)
  readonly kind?: string;
  readonly amount?: number;
  readonly bonus?: number;
  readonly cap?: number;
  readonly charRace?: string;
  readonly cls?: string;
  readonly coastal?: boolean;
  readonly ctx?: string;
  readonly delta?: number;
  readonly extra?: number;
  readonly factor?: number;
  readonly field?: string;
  readonly foreign?: boolean;
  readonly garrisoned?: boolean;
  readonly gold?: number;
  readonly heroAlign?: readonly string[];
  readonly heroOnly?: boolean;
  readonly home?: boolean;
  readonly hp?: number;
  readonly king?: boolean;
  readonly led?: string;
  readonly lines?: readonly number[];
  readonly max?: number;
  readonly maxTax?: number;
  readonly minTax?: number;
  readonly minWhite?: number;
  readonly mult?: number;
  readonly ownRace?: boolean;
  readonly owned?: boolean;
  readonly pct?: number;
  // a list as written (not readonly: Array.isArray, which discUnitMatch asks, can't narrow a readonly list)
  readonly quality?: string | string[];
  readonly race?: string;
  readonly rate?: number;
  readonly school?: string;
  readonly side?: string;
  readonly skill?: string;
  readonly skills?: readonly string[];
  readonly terrain?: readonly string[];
  readonly terrains?: readonly string[];
  readonly turns?: number;
  readonly types?: readonly string[];
  readonly vs?: string;
  readonly withCls?: string;
  readonly withTypes?: readonly string[];
}

/** A discovery's row in SAGE_DISCOVERIES_P. */
export interface ADiscoverysRow {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly desc: string;
  readonly race?: string;
  readonly alignment?: string;
  readonly effect?: TheEffectOfADiscovery;
  readonly effect2?: TheEffectOfADiscovery;
}

/** How a text would write a number of a kind: a multiplier as a figure (1.3 as `×1.30`, 0.25 as `×0.25`, 2 as `×2`), a
 *  share added as a percentage (0.3 as `+30%`), or levels added to a skill as a figure (1 as `+1`). */
export type HowADiscoveryEffectsNumberIsWritten =
  'a multiplier, as a figure' | 'a share added, as a percentage' | 'levels added, as a figure';

/** One number the code writes for a kind of effect, and how a text would write it. */
export interface ANumberOfAKindOfDiscoveryEffect {
  readonly value: number;
  readonly aTextWouldWriteIt: HowADiscoveryEffectsNumberIsWritten;
}

/** A row: what the discoveries' registry reads of one kind of effect. */
export interface AKindOfDiscoveryEffect {
  /** The kind, as an effect of SAGE_DISCOVERIES_P names it (its `kind`). */
  readonly kind: string;
  /** The numbers the code writes for every effect of the kind, by name. */
  readonly numbers?: Readonly<Record<string, ANumberOfAKindOfDiscoveryEffect>>;
}

/** The kinds of effect the discoveries' registry holds, by slug. */
export const DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS = {
  // a unit's strength in a battle (plan P1-19aa): however many of these effects a realm stacks, the multiplier they
  // give any one unit never exceeds ×1.30 (Toby, 2026-09-21)
  'unit-strength': {
    kind: 'unitStr',
    numbers: { theCeiling: { value: 1.3, aTextWouldWriteIt: 'a multiplier, as a figure' } },
  },
  // what the attacker's siegecraft takes off the defenders' bonus (P1-19aa)
  siegecraft: { kind: 'siege' },
  // a realm's own ground fortified when it defends: never more than +30% (Toby, 2026-09-21; P1-19aa)
  'own-ground': {
    kind: 'defOwn',
    numbers: { theCeiling: { value: 0.3, aTextWouldWriteIt: 'a share added, as a percentage' } },
  },
  // what a side's fanaticism gains in a battle (P1-19aa)
  fanaticism: { kind: 'fanatic' },
  // what a caster's chance gains (P1-19aa: in a battle)
  casting: { kind: 'cast' },
  // Dragon Taming (sd40): a winged beast follows its commander without his Druid (P1-19aa)
  'dragon-taming': { kind: 'flyingNoDruid' },
  // Flanking Tactics (sd09): the lines behind the front weighted as its row writes them (P1-19ab)
  'flanking-tactics': { kind: 'flankBonus' },
  // a beaten unit's chance of death cut: however many of these effects a realm stacks, the chance is never cut below a
  // quarter of itself (P1-19ab)
  'a-beaten-units-death-cut': {
    kind: 'deathRed',
    numbers: { theFloor: { value: 0.25, aTextWouldWriteIt: 'a multiplier, as a figure' } },
  },
  // what a unit's chance of promotion after a battle gains (P1-19ab)
  promotion: { kind: 'promo' },
  // Homeward Song (re10): what an Elven unit's chance to slip away home gains (P1-19ab)
  'homeward-flight': { kind: 'elvenEscape' },
  // Battlefield Surgery (sd36): a slain hero's chance to be dragged from the field alive (P1-19ab)
  'battlefield-surgery': { kind: 'nearDeathSurvival' },
  // what a fighter's chance to hit gains in a personal combat, against every foe or one kind of foe (P1-19ac)
  'a-fighters-aim': { kind: 'duelHit' },
  // Veteran Training (sd37): every hero of the realm fights in personal combat as if his Melee and his Archery were a
  // level higher (P1-19ac)
  'veteran-training': {
    kind: 'skillBonusCombat',
    numbers: { theLevelsAdded: { value: 1, aTextWouldWriteIt: 'levels added, as a figure' } },
  },
  // what a fighter's Mithril turns aside of a melee blow, more than the suit's own (P1-19ac)
  'mithril-craft': { kind: 'mithril' },
  // what a skill's chance to rise through experience gains, for every skill or a listed few (P1-19ac)
  'a-skills-rise': { kind: 'skillGain' },
  // Order of the Golden Shield (sd35): the king's hardening after a fight is doubled (P1-19ac)
  'golden-shield': {
    kind: 'kingKillHpX2',
    numbers: { theFactor: { value: 2, aTextWouldWriteIt: 'a multiplier, as a figure' } },
  },
  // what a spy's chance gains, wherever he spies or on the ground, coast or home its row names (P1-19ad)
  spying: { kind: 'spy' },
  // what a realm's ground takes off a rival spy's chance there (P1-19ad)
  'counter-spying': { kind: 'counterSpy' },
  // what a spy's chance to read a hero beside him gains (P1-19ad)
  'spying-on-a-hero': { kind: 'spyChar' },
  // what a hero's chance to catch a spy reading him gains (P1-19ad)
  'catching-a-spy': { kind: 'catchSpy' },
  // Disguise Techniques (sd23): the chance a spy's success raises no alarm (P1-19ad)
  'disguise-techniques': { kind: 'spyDisguise' },
  // what an explorer maps of a province, multiplied (P1-19ad)
  exploring: { kind: 'explore' },
  // the turns the Wild Hunt's bound beasts serve longer (P1-19ad)
  'the-long-hunt': { kind: 'wildHunt' },
  // what a cleared lair's gold gains (P1-19ad)
  'lair-gold': { kind: 'lairGold' },
  // the chance of an extra find in a cleared lair (P1-19ad)
  'lair-items': { kind: 'itemChance' },
  // what a scholar's chance to make a discovery gains (P1-19ad)
  research: { kind: 'research' },
  // what a hero's chance to raise a skill by practice gains (P1-19ad)
  practice: { kind: 'practice' },
  // the hit points a resting hero gains more (P1-19ad)
  resting: { kind: 'rest' },
  // Medical Arts (sd28): a single Rest restores every hit point (P1-19ad)
  'medical-arts': { kind: 'restFull' },
  // what a realm's chance to spot an enemy hero lurking in a province it holds gains (P1-19ad)
  'watching-for-lurkers': { kind: 'spotLurker' },
  // Ancient Lore (sd32): an Explore order also maps a share of each province around (P1-19ad)
  'ancient-lore': { kind: 'adjacentReveal' },
  // Diplomatic Protocols (sd31): the ban on hiring across the gulf between Divine and Undead waived (P1-19ae)
  'diplomatic-protocols': { kind: 'alignmentHire' },
  // the consecrated provinces a crown may hold more, for a consecrator of the White skill its row names (P1-19ae)
  consecrations: { kind: 'consecrate' },
  // the quality a Call to Arms may raise its company at, and its chance (P1-19ae)
  'muster-rolls': { kind: 'ctaQuality' },
  // what the corpse-carters of Harvest the Field cost more or less (P1-19ae)
  'corpse-carters': { kind: 'harvestCost' },
  // what a mercenary band costs more or less to hire (P1-19ae)
  mercenaries: { kind: 'merc' },
  // what a unit costs to recruit, its gold added, then multiplied (P1-19ae)
  'recruit-cost': { kind: 'recruitCost' },
  // the chance a unit recruited starts a grade higher (P1-19ae)
  'recruit-quality': { kind: 'recruitQ' },
  // what a Bless adds to the province's tax (P1-19ae)
  'rites-of-plenty': { kind: 'bless' },
  // the gold a Pagan victor's blood harvest takes more for each enemy unit destroyed (P1-19af)
  'blood-harvest': { kind: 'bloodHarvest' },
  // the share of strength each terror stack an Evil victory leaves costs the next defenders more (P1-19af)
  'lingering-terror': { kind: 'terror' },
  // the share of a conquered province's tax an Evil conqueror plunders more, anywhere or on the ground its row names
  // (P1-19af)
  plunder: { kind: 'plunder' },
  // the move points a land unit of Speed 1–2 the effect reaches gains a turn (P1-19af)
  marching: { kind: 'move' },
  // what the chance that columns converging on one battle unite gains (P1-19af)
  'converging-columns': { kind: 'unify' },
  // the gold a province pays more, on the provinces its row names; each effect capped at the realm's ceiling (5% of its
  // base tax: discoveries.ts' TAX_BONUS_CAP_PCT, shared with the items' tax gold) and its row's own `max` (P1-19ag)
  'province-tax': { kind: 'tax' },
  // Taxation Records (sd14): a share more of the provinces' income, under the same ceiling (P1-19ag)
  'taxation-records': { kind: 'taxPct' },
  // the interest a realm's treasury earns at the collection, each effect under the same ceiling (P1-19ag)
  interest: { kind: 'interest' },
  // what a unit's wage is cut by, for the units the row names, each effect under the same ceiling (P1-19ag)
  'a-units-wage-cut': { kind: 'upkeep' },
  // what a hero's wage is cut by, for heroes of the alignments the row names, under the same ceiling (P1-19ag)
  'a-heros-wage-cut': { kind: 'heroWage' },
  // the wage no hero of the realm is paid above, under the same ceiling (P1-19ag)
  'a-heros-wage-ceiling': { kind: 'heroWageCap' },
  // the hit points a hero's maximum gains, for the king, the heroes or a trained skill the row names (P1-19ag)
  'maximum-hp': { kind: 'maxHp' },
  // the hit points a wounded hero of the realm recovers at the turn's end (P1-19ag)
  'healing-the-wounded': { kind: 'regen' },
  // the rate the graves of the realm's provinces rot at, if lower than the ground's own (P1-19ag)
  'grave-keeping': { kind: 'graveDecay' },
  // War Academy (sd08): the chance each company at the realm's capital trains up a grade at the new turn (P1-19ag)
  'war-academy': { kind: 'homePromotion' },
  // Informant Network (sd22): an unseen enemy captain named at the new turn (P1-19ag)
  'informant-network': { kind: 'informants' },
  // Arcane Observatory (sd39): an uncharted province charted in full at the new turn (P1-19ag)
  'arcane-observatory': { kind: 'turnReveal' },
  // Herbal Lore (sd29): the share of last season's wounds dressed as a phase begins (P1-19ag)
  'herbal-lore': { kind: 'autoHeal' },
  // Messenger Birds (sd20): the provinces two steps from the realm's that its warnings reach (P1-19ah; the set they
  // widen is read by nothing: Parked)
  'messenger-birds': { kind: 'extendedIntel' },
} as const satisfies Record<string, AKindOfDiscoveryEffect>;

/** A kind of effect's slug (a key of DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS). */
export type DiscoveryEffectSlug = keyof typeof DISCOVERY_EFFECTS_THE_REGISTRY_HOLDS;
