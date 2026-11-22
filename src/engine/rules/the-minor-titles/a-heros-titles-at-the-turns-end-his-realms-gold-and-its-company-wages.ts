// A hero's minor titles at the turn's end (B-06, T7, the rules pulled out: its Reckoning and titles family, row
// B-06m): the effects of two stages of `turnEnd`, each naming the rule of the economy whose gold or cut its title
// gives. The numbers are those rules' rows (src/content/the-economys-rules-their-keys-names-and-numbers.ts), and the
// economy's registry runs them (the-registry-of-the-economys-rules.ts, B-06c and B-06d).
// - "turnEnd: a hero's titles give his realm gold beyond its tax" (Early Winter's collection and the report's
//   forecast): the Cutpurse's gold, the Champion of the People's and the Castellan's.
// - "turnEnd: a hero's titles cut his realm's company wages" (Early Winter's wages and the report's forecast): the
//   Host-Leader's cut.
// The runners are in the-registry-of-the-minor-titles-perks.ts. Who holds a title is the runner's caller's to say, as
// before. No effect draws a die.
import type { AMinorTitlesSlug } from '../../../content/the-minor-titles-their-keys-names-perks-requirements-and-how-each-holder-is-found.ts';
import type { TheStagesOfEachHookPoint } from '../the-registry-of-content-effects.ts';

type TheTurnsEndsStages = TheStagesOfEachHookPoint['turnEnd'];

/** "turnEnd: a hero's titles give his realm gold beyond its tax": the rule of the economy whose gold each title
 *  gives. */
export const A_HEROS_TITLES_GIVE_HIS_REALM_GOLD_BEYOND_ITS_TAX = {
  cutpurse: () => 'the-cutpurses-gold',
  champion: () => 'the-champion-of-the-peoples-gold',
  castellan: () => 'the-castellans-gold',
} satisfies Partial<Record<AMinorTitlesSlug, TheTurnsEndsStages["a hero's titles give his realm gold beyond its tax"]>>;

/** "turnEnd: a hero's titles cut his realm's company wages": the rule of the economy by which each title cuts them. */
export const A_HEROS_TITLES_CUT_HIS_REALMS_COMPANY_WAGES = {
  hostleader: () => 'the-host-leaders-cut-of-his-companies-wages',
} satisfies Partial<Record<AMinorTitlesSlug, TheTurnsEndsStages["a hero's titles cut his realm's company wages"]>>;
