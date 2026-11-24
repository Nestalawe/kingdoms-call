// The race gifts (B-06, T7, the rules pulled out: the races' family, from row B-06ae). A race's gift is a rule a
// realm's own people bring it: it acts for a realm of its race (and, where the row says, for a company or a province of
// that race too). Each gift is one row here (its name, its race, and the numbers, the ground or the side the turn reads
// for it) and one entry in src/engine/rules/the-registry-of-the-race-gifts.ts, keyed by the same slug: the battles'
// gifts (B-06ae), then the heroes' and the companies' (B-06af). How to add one:
// docs/architecture/the-race-gifts-registry-its-stages-and-how-to-add-a-gift.md.
import type { KC_HUMANOID_RACES } from './kingdoms-call-data.ts';

/** A fallen company's chance, in percent, to flee home: by the ground it fell on (the first entry that names it), or
 *  elsewhere. */
export interface TheChanceAFallenCompanyFleesHome {
  readonly onTheGround: readonly { readonly theGround: readonly string[]; readonly thePercent: number }[];
  readonly thePercentElsewhere: number;
}

/** A race's gift: its name (as the books write it), the race whose realms hold it, and what its row adds: the factor a
 *  company of its race fights at, and the ground or the side it fights on to be given it; the factor a hero of its race
 *  learns at, or a company of it drills at; a hero's hit points at the start and the shift of his hardening's bands; a
 *  fallen company's chance to flee home. */
export interface ARaceGift {
  readonly name: string;
  readonly race: (typeof KC_HUMANOID_RACES)[number];
  readonly theStrength?: number;
  readonly theGround?: readonly string[];
  readonly theSide?: 'defending' | 'attacking';
  readonly theLearning?: number;
  readonly theDrill?: number;
  readonly theHitPointsAtTheStart?: number;
  readonly theShiftOfTheHardeningsBands?: number;
  readonly theFlightHome?: TheChanceAFallenCompanyFleesHome;
}

/** The race gifts, by slug. */
export const RACE_GIFTS = {
  // the elves' home ground: an Elven company of an Elven realm fights at ×1.5 in forest and jungle (armStr: one
  // rounded step, after the ground's own factor)
  'woodland-mastery': { name: 'Woodland Mastery', race: 'Elven', theStrength: 1.5, theGround: ['forest', 'jungle'] },
  // a Dwarven company of a Dwarven realm defends at ×1.5 in any battle (armStr: one rounded step, after Woodland
  // Mastery's)
  bulwark: { name: 'Bulwark', race: 'Dwarven', theStrength: 1.5, theSide: 'defending' },
  // an Orcish realm's win in an Orcish province (against its defenders, as the attacker; between heroes, the winner)
  // flags the province; at the turn's end the Orc Garrison's unit ability (raiders-muster) musters a Goblin Horde
  // there if an orc realm still holds it
  'raiders-muster': { name: "Raiders' Muster", race: 'Orcish' },
  // an Orcish company of an Orcish realm that wins a battle attacking is stamped with the turn; at the turn's end
  // Early Winter halves its wage (the economy's row the-orcish-war-spoils-halve-a-companys-wage-this-turn)
  'war-spoils': { name: 'War-spoils', race: 'Orcish' },
  // a Human hero of a Human realm learns at ×1.5: every skill's rise by experience (trySkillGain) and by practice
  // (resolvePracticeSkillOrder, and the practice note's chance)
  'quick-learners': { name: 'Quick learners', race: 'Human', theLearning: 1.5 },
  // a Human company of a Human realm rises a quality at ×2 the chance: a commander's drill, the garrison's drill and
  // surviving a battle (humanXPMult)
  drillmasters: { name: 'Drillmasters', race: 'Human', theDrill: 2 },
  // an Orcish hero of an Orcish realm starts at 18 maximum HP (15 for any other), and each band of his hardening sits 5
  // higher (hpStartOf, hpGainBand)
  'iron-constitution': {
    name: 'Iron constitution',
    race: 'Orcish',
    theHitPointsAtTheStart: 18,
    theShiftOfTheHardeningsBands: 5,
  },
  // a Dwarven hero of a Dwarven realm wears a suit of mithril: at the game's start, each turn's check, and on a hire
  // (an order's or the Broker's)
  'mithril-armour': { name: 'Mithril Armour', race: 'Dwarven' },
  // an Elven company of an Elven realm killed in battle may flee home instead: 30% in desert or mountain, 60% in forest
  // or jungle, 45% elsewhere (recordBattleGraves; the realm's discoveries add theirs)
  'homeward-flight': {
    name: 'Homeward Flight',
    race: 'Elven',
    theFlightHome: {
      onTheGround: [
        { theGround: ['desert', 'mountain'], thePercent: 30 },
        { theGround: ['forest', 'jungle'], thePercent: 60 },
      ],
      thePercentElsewhere: 45,
    },
  },
} as const satisfies Record<string, ARaceGift>;

/** A race gift's slug. */
export type RaceGiftSlug = keyof typeof RACE_GIFTS;
