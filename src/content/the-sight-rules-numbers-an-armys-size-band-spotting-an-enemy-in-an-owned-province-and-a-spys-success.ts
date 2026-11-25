// The sight rules' numbers (B-06bv: moved here from the engine's sight functions as they were, each named for the rule
// it is). Plain data: this file imports nothing. The engine reads each row where its function wrote the number, in the
// same arithmetic and the same order.

/** An army's size band (armySizeBand): the most units each band names. None is "no armies"; more than the last band's
 *  most is "a vast host". */
export const THE_MOST_UNITS_EACH_BAND_OF_AN_ARMYS_SIZE_NAMES = {
  aSmallEscort: 2,
  aModestBand: 5,
  aSizeableHost: 9,
  aLargeHost: 15,
} as const;

/** The chance in percent of spotEnemyInOwnedProvince's roll: the owner's share of his own ground; the enemy hero's Spy,
 *  counted up to the level named, takes this much off a level; the best friendly Spy there, counted up to the level
 *  named, adds this much a level; the realm's discoveries add theirs; then at least and at most these. The illusory
 *  perk's tier named or above leaves this share of it, at least this. The roll (a fraction of one) is read on this
 *  scale against the chance. */
export const THE_FIGURES_OF_THE_ROLL_TO_SPOT_AN_ENEMY_HERO_IN_AN_OWNED_PROVINCE = {
  theShareOfHisOwnGroundTheOwnerKnows: 100,
  theHighestLevelOfTheEnemysSpyCounted: 5,
  theFallEachLevelOfTheEnemysSpyGives: 20,
  theHighestLevelOfTheFriendlySpyCounted: 5,
  theRiseEachLevelOfTheBestFriendlySpyGives: 10,
  theLeast: 25,
  theMost: 95,
  theTierOfTheIllusoryPerkThatHalvesIt: 1,
  theShareOfItTheIllusoryPerkLeaves: 0.5,
  theLeastUnderTheIllusoryPerk: 5,
  theScaleTheRollIsReadOn: 100,
} as const;

/** A spy's success (applySpySuccess): on a king's home, the chance in percent he copies one of the realm's discoveries
 *  (this much before his Spy and this much more a level of it, then at least and at most these), and what a copied one
 *  adds to his title merit's count of discoveries; the merits each success earns him; and the chance of each feature's
 *  draw (discoverFeat). */
export const THE_FIGURES_OF_A_SPYS_SUCCESS = {
  theChanceToCopyADiscoveryBeforeHisSpy: 10,
  theRiseEachLevelOfHisSpyGivesToTheChanceToCopy: 10,
  theLeastChanceToCopyADiscovery: 5,
  theMostChanceToCopyADiscovery: 95,
  theTitleMeritsDiscoveriesACopiedOneAdds: 1,
  theMeritsASuccessEarns: 1,
  theChanceOfEachFeaturesDraw: 0.5,
} as const;
