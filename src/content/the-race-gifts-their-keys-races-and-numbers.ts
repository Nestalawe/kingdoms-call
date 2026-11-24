// The race gifts (B-06, T7, the rules pulled out: the races' family, from row B-06ae). A race's gift is a rule a
// realm's own people bring it: it acts for a realm of its race (and, where the row says, for a company or a province of
// that race too). Each gift is one row here (its name, its race, and the numbers, the ground or the side the turn reads
// for it) and one entry in src/engine/rules/the-registry-of-the-race-gifts.ts, keyed by the same slug. These are the
// battles' gifts; the heroes' and the units' (Quick learners, Drillmasters, Iron constitution, Mithril, Homeward
// Flight) are not rows yet. How to add one: docs/architecture/the-race-gifts-registry-its-stages-and-how-to-add-a-gift.md.
import type { KC_HUMANOID_RACES } from './kingdoms-call-data.ts';

/** A race's gift: its name (as the books write it), the race whose realms hold it, and what its row adds: the factor a
 *  company of its race fights at, and the ground or the side it fights on to be given it. */
export interface ARaceGift {
  readonly name: string;
  readonly race: (typeof KC_HUMANOID_RACES)[number];
  readonly theStrength?: number;
  readonly theGround?: readonly string[];
  readonly theSide?: 'defending' | 'attacking';
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
} as const satisfies Record<string, ARaceGift>;

/** A race gift's slug. */
export type RaceGiftSlug = keyof typeof RACE_GIFTS;
