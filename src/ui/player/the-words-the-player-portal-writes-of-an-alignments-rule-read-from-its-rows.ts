// The words the player portal writes of an alignment's rule, read from its rows (B-06bt): the creeds' names and the
// numbers of consecrated ground (the Consecrate order's hint and the consecrated province's tooltip), of war without
// warning and a broken alliance (the Diplomacy card), of a king's first skills (the join form's skill notes) and of
// the creeds only one realm a game may hold (the join form's warnings) come from the alignments' rows
// (src/content/alignment-abilities-their-keys-names-numbers-and-words.ts), which the turn reads too. Each phrase is
// here, not in the page's code, so that a test can read it as the page shows it: those files start the page as they
// load. A number written in words ("twice") stays in the words, and
// tests/static/the-portals-words-that-restate-an-alignment-rule-read-its-rows.test.ts holds it to its row.
import { kcHtml, type KcSafeHtml } from '../shared/kc-safe.ts';
import { ALIGNMENT_ABILITIES } from '../../content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import { theAlignmentsOnlyOneRealmAGameMayHold } from '../../shared/the-engines-rules-the-player-portal-shares.ts';

const THE_TAX = ALIGNMENT_ABILITIES['consecrated-ground-tax'].theNumbers.theShareMoreTax.value;
const THE_UNHOLY_ATTACKERS = ALIGNMENT_ABILITIES['consecrated-ground-weakens-an-unholy-attacker'];
const THE_SHARE_WEAKER = THE_UNHOLY_ATTACKERS.theNumbers.theShareWeaker.value;

/** Consecrated ground's rules in the Consecrate order's hint: its tax, its defenders' zeal, and the creeds of the
 *  invaders it weakens and by how much. */
export const CONSECRATED_GROUND_IN_THE_CONSECRATE_HINT = `+${String(THE_TAX)}% tax, defenders twice as likely to fight fanatically, ${THE_UNHOLY_ATTACKERS.theCreedsItActsAgainst.join('/')} invaders −${String(THE_SHARE_WEAKER)}%`;

/** Consecrated ground's rules in a consecrated province's tooltip on the map, in fewer words than the hint's. */
export const CONSECRATED_GROUND_IN_THE_MAPS_TOOLTIP = `+${String(THE_TAX)}% tax, defenders twice as fanatical, ${THE_UNHOLY_ATTACKERS.theCreedsItActsAgainst.join('/')} attackers −${String(THE_SHARE_WEAKER)}%`;

const WAR_WITHOUT_WARNING = [
  ALIGNMENT_ABILITIES['war-without-warning-of-an-evil-realm'].alignment,
  ALIGNMENT_ABILITIES['war-without-warning-of-an-undead-realm'].alignment,
] as const;
const A_BROKEN_ALLIANCE_MEANS_WAR = [
  ALIGNMENT_ABILITIES['a-broken-alliance-means-war-for-an-evil-realm'].alignment,
  ALIGNMENT_ABILITIES['a-broken-alliance-means-war-for-an-undead-realm'].alignment,
] as const;

/** The Diplomacy card's words on when its changes apply: an Evil or an Undead realm's declaration of war at once, and
 *  a broken alliance's war. */
export function whenTheDiplomacyCardsChangesApply(): KcSafeHtml {
  return kcHtml`Changes apply at the start of next turn — except that an <strong>${WAR_WITHOUT_WARNING[0]}</strong> or <strong>${WAR_WITHOUT_WARNING[1]}</strong> realm's declaration of war takes effect at the <strong>start of this very turn</strong>: its armies may attack the moment the orders run. <strong>Breaking an alliance</strong> returns the two realms to <strong>Neutral</strong> — only an ${A_BROKEN_ALLIANCE_MEANS_WAR[0]} or ${A_BROKEN_ALLIANCE_MEANS_WAR[1]} crown goes straight from alliance to war.`;
}

const A_DIVINE_KINGS_WHITE = ALIGNMENT_ABILITIES['a-divine-king-starts-with-white-magic'];
const AN_UNDEAD_KINGS_NECROMANCY = ALIGNMENT_ABILITIES['an-undead-king-starts-with-necromancy'];

/** The join form's note on White Magic: the realms whose king starts with it. */
export const THE_KINGS_FIRST_WHITE_MAGIC = `(${A_DIVINE_KINGS_WHITE.alignment} realms start with White ${String(A_DIVINE_KINGS_WHITE.theNumbers.theLevelsMore.value)})`;

/** The join form's note on Necromancy: the realms whose king starts with it. */
export const THE_KINGS_FIRST_NECROMANCY = `(${AN_UNDEAD_KINGS_NECROMANCY.alignment} realms start with Necromancy ${String(AN_UNDEAD_KINGS_NECROMANCY.theNumbers.theLevelsMore.value)})`;

/** The creeds only one realm a game may hold, as the join form's warnings name them: the one "or" the other. */
export const THE_CREEDS_ONLY_ONE_REALM_A_GAME_MAY_HOLD_IN_WORDS = theAlignmentsOnlyOneRealmAGameMayHold().join(' or ');
