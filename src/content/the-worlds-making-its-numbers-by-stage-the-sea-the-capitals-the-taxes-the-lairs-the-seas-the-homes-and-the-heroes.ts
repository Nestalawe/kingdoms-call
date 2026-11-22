// The world's making's numbers (B-06, T7, the rules pulled out: its world generation family, from B-06u), one row a
// stage, in the order the making reads them: the sea share the GM picks, the capitals' spacing, each home's ring, the
// provinces' taxes, peoples, unit pools, features and lairs, the seas by kind and their guardians, the homes, the kings
// and their heroes, the wild country, the tax floor, the neutral heroes, the province pools' chances and the bots'
// realms. The world's making (src/engine/world/generate.ts, src/engine/world/tables.ts and src/engine/bots/setup.ts)
// reads each from here. A chance is the share of the die (0 to 1) under which a thing happens; a range is the least and
// the most a die rolls, both included. Each value is what the making wrote before B-06u: a value changed makes other
// worlds from the same seed. Nothing here imports the engine.

/** S0. The share of the world that is sea, in per cent, as the GM picks it: held between the least and the most, and
 *  the default for a share not given or not a number. */
export const THE_SEA_SHARE_THE_GM_PICKS = { theLeast: 20, theMost: 80, theDefault: 35 } as const;

/** S0. The province names: a name already taken is drawn again, up to this many tries, before it takes a numeral. */
export const THE_PROVINCES_NAMES = { theTriesForANameNotYetTaken: 50 } as const;

/** S1. The capitals: the least hexes between two capitals; how many layouts are refined and how many sweeps refine
 *  each; and, when none keeps the spacing (a map too small for its realms), how many raw layouts are tried. */
export const THE_CAPITALS = {
  theLeastHexesBetweenTwoCapitals: 4,
  theLayoutsRefined: 10,
  theSweepsThatRefineALayout: 6,
  theRawLayoutsTriedWhenNoneKeepsTheSpacing: 400,
} as const;

/** S2. Each home's ring: the most sea provinces a home borders, rising with the sea share (from the lower cut, and more
 *  from the higher); the share from which a ring's free cell rolls sea at the cluster rate, not the base rate; and the
 *  two rates of the sea's fill, each a share of the sea share, never above its most. */
export const EACH_HOMES_RING_AND_THE_SEAS_FILL = {
  theMostSeaAHomeBorders: {
    fromTheHigherCut: { theSeaShareFrom: 70, theSeas: 4 },
    fromTheLowerCut: { theSeaShareFrom: 60, theSeas: 3 },
    belowBoth: 2,
  },
  theSeaShareFromWhichARingRollsAtTheClusterRate: 60,
  theBaseRate: { theMost: 0.9, theShareOfTheSeaShare: 0.7 },
  theClusterRate: { theMost: 0.95, theShareOfTheSeaShare: 1.375 },
} as const;

/** S3 and S9. The tax bands a home's ring promises (a Poor and a Prosperous land), and the tax each is rolled in. */
export const THE_TAX_BANDS = {
  thePoor: { theLeast: 2, theMost: 3 },
  theProsperous: { theLeast: 4, theMost: 6 },
} as const;

/** S3. Each province: the chance the first wild land is the Creatures' (they then alternate with the Monsters'); the
 *  tax each terrain is rolled in (all six rolled, in this order, for a province no band decides); a land province's
 *  people; the unit types a wild or a sea province offers; a land province's features, and the tries for a feature's
 *  name not yet taken there; a lair's treasure (a roll to its most, times a share from the least share to the least and
 *  what the die adds); and the chance a wild province's defenders are Veterans. */
export const EACH_PROVINCE = {
  theChanceTheFirstWildLandIsTheCreatures: 0.5,
  theTaxOfEachTerrain: {
    plain: { theLeast: 4, theMost: 9 },
    desert: { theLeast: 2, theMost: 4 },
    forest: { theLeast: 3, theMost: 7 },
    jungle: { theLeast: 2, theMost: 6 },
    mountain: { theLeast: 3, theMost: 7 },
    sea: { theLeast: 0, theMost: 2 },
  },
  thePeopleOfALandProvince: { theLeast: 1, theMost: 6 },
  theUnitTypesAWildOrSeaProvinceOffers: { theLeast: 2, theMost: 3 },
  theFeaturesOfALandProvince: { theLeast: 2, theMost: 4 },
  theTriesForAFeaturesNameNotYetTaken: 20,
  aLairsTreasure: { theLeastOfTheRoll: 1, theMostOfTheRoll: 10, theLeastShare: 0.4, theShareTheDieAdds: 0.6 },
  theChanceAWildProvincesDefendersAreVeterans: 0.5,
} as const;

/** S6. The seas by kind: a die under the first is a primal sea, under the second poor waters, else open water; a
 *  primal sea's tax and the chance its defenders are Veterans; poor waters' tax. */
export const THE_SEAS_BY_KIND = {
  theDieUnderWhichASeaIsPrimal: 0.2,
  theDieUnderWhichASeaIsPoorWaters: 0.4,
  thePrimalSeasTax: { theLeast: 4, theMost: 6 },
  theChanceAPrimalSeasDefendersAreVeterans: 0.4,
  thePoorWatersTax: { theLeast: 2, theMost: 3 },
} as const;

/** S7. The sea features: the chance of a second feature (a sea has one or two); the tries for a feature's name not yet
 *  taken there; and its guardian's tier by the sea's tax, a die under each figure giving that tier (rich seas from their
 *  tax: Powerful, then Moderate, else Weak; middling seas from theirs: Weak, then Moderate, else Powerful; the rest:
 *  Weak, else Moderate). */
export const THE_SEA_FEATURES_AND_THEIR_GUARDIANS = {
  theChanceOfASecondFeature: 0.5,
  theTriesForAFeaturesNameNotYetTaken: 20,
  theRichSeas: { theTaxFrom: 5, theDieUnderWhichPowerful: 0.35, theDieUnderWhichModerate: 0.85 },
  theMiddlingSeas: { theTaxFrom: 3, theDieUnderWhichWeak: 0.35, theDieUnderWhichModerate: 0.9 },
  theOtherSeas: { theDieUnderWhichWeak: 0.75 },
} as const;

/** S9. The homes: how well a realm knows its home (per cent) and the home's tax; the creed's neighbour beside the
 *  standing stones (the chance a land re-terrained there is forest, not jungle), its bank (the chance of the
 *  Creatures', not the Monsters', where either may be dealt) and the chance its defenders are Veterans; the most of a
 *  home's weak lair's treasure. */
export const THE_HOMES = {
  howWellARealmKnowsItsHome: 100,
  theTaxOfAHome: 10,
  theChanceTheStonesNeighbourIsForest: 0.5,
  theChanceTheCreedsNeighbourHoldsCreatures: 0.5,
  theChanceTheCreedsNeighboursDefendersAreVeterans: 0.5,
  theMostTreasureOfAHomesWeakLair: 6,
} as const;

/** S9. A king and his heroes: the king's skills before his creed's and his own; the HP a king and a starting hero are
 *  made with (the last pass sets every character's HP again: KD-455); each aptitude's roll; a realm's starting
 *  heroes, each one's skill points, the tempers a hero is dealt from (the first of the list); a realm's gold. */
export const A_KING_AND_HIS_HEROES = {
  theKingsSkills: { melee: 2, archery: 1, sage: 1 },
  theHpTheyAreMadeWith: 15,
  eachAptitude: { theLeast: 1, theMost: 4 },
  theHeroesARealmStartsWith: 2,
  theSkillPointsOfAStartingHero: 3,
  theTempersAHeroIsDealtFrom: 4,
  theGoldARealmStartsWith: 20,
} as const;

/** S10. The wild country near the two crowns: the chance its defenders are Veterans. */
export const THE_WILD_COUNTRY_NEAR_THE_TWO_CROWNS = { theChanceItsDefendersAreVeterans: 0.5 } as const;

/** S12. The tax floor: the least tax of a land province (every land tax is already rolled at least this: KD-454). */
export const THE_TAX_FLOOR = { theLeastTaxOfALandProvince: 2 } as const;

/** S15. The strongest neutral mix: the weight a defender's grade sorts by when the grades' table gives it none. */
export const THE_STRONGEST_NEUTRAL_MIX = { theWeightOfAGradeTheTableGivesNone: 2 } as const;

/** S16. The neutral heroes: the tempers one is dealt from (the first of the list), the level of the first skill
 *  dealt, the HP one is made with (set again by the last pass: KD-455), each aptitude's roll. */
export const THE_NEUTRAL_HEROES = {
  theTempersOneIsDealtFrom: 4,
  theLevelOfTheFirstSkill: 2,
  theHpOneIsMadeWith: 15,
  eachAptitude: { theLeast: 1, theMost: 4 },
} as const;

/** The province pools and their chances (src/engine/world/tables.ts): the share of land provinces that are wild; how
 *  much more likely a race is to be placed in its heartland; a humanoid province's unit types (the chance of the
 *  fewer, else the more); the share of would-be flyer offers that survive; the share of coastal humanoid provinces that
 *  also offer their race's fleet. */
export const THE_PROVINCE_POOLS_AND_THEIR_CHANCES = {
  theShareOfLandThatIsWild: 0.3,
  theWeightOfARacesHeartland: 6,
  theUnitTypesAHumanoidProvinceOffers: { theChanceOfTheFewer: 0.75, theFewer: 2, theMore: 3 },
  theShareOfFlyerOffersThatSurvive: 0.5,
  theShareOfCoastsThatOfferAFleet: 0.8,
} as const;

/** The bots' realms (src/engine/bots/setup.ts): the tries for a realm's name not yet taken before it takes a numeral;
 *  the cost an alignment already in play adds for each realm that holds it. */
export const THE_BOTS_REALMS = {
  theTriesForANameNotYetTaken: 400,
  theCostOfEachRealmOfAnAlignmentInPlay: 0.25,
} as const;
