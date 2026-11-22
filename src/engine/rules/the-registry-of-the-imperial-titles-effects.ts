// The rule registry of the Imperial Titles' effects (B-06, T7, the rules pulled out: its Reckoning and titles family,
// from row B-06o). An Imperial Title is one row of TITLE_DEFS in src/content/kingdoms-call-data.ts (its key, name,
// prize, requirement and perk as players read them, and how its holder is found) and one entry here, keyed by the same
// slug, naming its effect at each stage of a hook point. The hook points and their stages are the content effects'
// (one union, in the-registry-of-content-effects.ts); each stage's order is THE_ORDER_OF_EACH_STAGE_OF_THE_IMPERIAL_
// TITLES, and each stage's runner is here. The boards of the titles that read each rival realm as a whole act at
// turnEnd (B-06o): the Throne's and the Vaultkeeper's, the titles of the realm, before the heroes' titles' boards, and
// the Cartographer's, the Beastlord's and the Wildwarden's after the Spymaster's ledger, each in TITLE_DEFS' order (the
// title intelligence's). The other titles' entries act at no stage yet. Who holds a title is the runner's caller's to
// say, by the standings worked out at the turn's end. How to add one:
// docs/architecture/the-minor-titles-registry-its-hook-points-and-how-to-add-a-perk.md#the-imperial-titles-effects.
import type { AnImperialTitlesSlug } from '../../content/kingdoms-call-data.ts';
import type {
  AnImperialTitlesHolderAndTheWorldHisBoardReads,
  TheStagesOfEachHookPoint,
} from './the-registry-of-content-effects.ts';
import {
  THE_BOARD_A_HEROS_IMPERIAL_TITLE_SHOWS_HIS_REALM,
  THE_BOARD_AN_IMPERIAL_TITLE_OF_THE_REALM_SHOWS_ITS_HOLDER,
  type TheFactOfALineOfABoardOfRivalRealms,
} from './the-imperial-titles/the-boards-of-the-titles-that-read-each-rival-realm-and-the-facts-their-lines-record.ts';

/** The hook points an Imperial Title's effect acts at, each filled by a row of the family: `turnEnd` (B-06o: the
 *  boards of the titles that read each rival realm). */
export type TheHookPointsAnImperialTitlesEffectActsAt = 'turnEnd';

/** An entry: the title's effect at each stage it acts in. */
export type TheEffectsOfAnImperialTitleAtEachHookPoint = {
  readonly [H in TheHookPointsAnImperialTitlesEffectActsAt]?: Partial<TheStagesOfEachHookPoint[H]>;
};

/** One entry for each row of TITLE_DEFS, and no other (a slug with no entry fails to compile, TS1360, and at ENTRIES,
 *  TS2741; an entry with no slug, TS2353). */
export const THE_REGISTRY_OF_THE_IMPERIAL_TITLES_EFFECTS = {
  throne: {
    turnEnd: {
      'the board an Imperial Title of the realm shows its holder':
        THE_BOARD_AN_IMPERIAL_TITLE_OF_THE_REALM_SHOWS_ITS_HOLDER.throne,
    },
  },
  vault: {
    turnEnd: {
      'the board an Imperial Title of the realm shows its holder':
        THE_BOARD_AN_IMPERIAL_TITLE_OF_THE_REALM_SHOWS_ITS_HOLDER.vault,
    },
  },
  marshal: {},
  sea: {},
  monster: {},
  lore: {},
  arch: {},
  hiero: {},
  necro: {},
  spy: {},
  carto: {
    turnEnd: {
      "the board a hero's Imperial Title shows his realm": THE_BOARD_A_HEROS_IMPERIAL_TITLE_SHOWS_HIS_REALM.carto,
    },
  },
  beast: {
    turnEnd: {
      "the board a hero's Imperial Title shows his realm": THE_BOARD_A_HEROS_IMPERIAL_TITLE_SHOWS_HIS_REALM.beast,
    },
  },
  wild: {
    turnEnd: {
      "the board a hero's Imperial Title shows his realm": THE_BOARD_A_HEROS_IMPERIAL_TITLE_SHOWS_HIS_REALM.wild,
    },
  },
} satisfies Record<AnImperialTitlesSlug, TheEffectsOfAnImperialTitleAtEachHookPoint>;

/** Each stage's effects, in the order the turn runs them (TITLE_DEFS' order, the title intelligence's). */
export const THE_ORDER_OF_EACH_STAGE_OF_THE_IMPERIAL_TITLES = {
  turnEnd: {
    'the board an Imperial Title of the realm shows its holder': ['throne', 'vault'],
    "the board a hero's Imperial Title shows his realm": ['carto', 'beast', 'wild'],
  },
} as const satisfies {
  readonly [H in TheHookPointsAnImperialTitlesEffectActsAt]?: {
    readonly [S in keyof TheStagesOfEachHookPoint[H]]?: readonly AnImperialTitlesSlug[];
  };
};

const ENTRIES: Readonly<Record<AnImperialTitlesSlug, TheEffectsOfAnImperialTitleAtEachHookPoint>> =
  THE_REGISTRY_OF_THE_IMPERIAL_TITLES_EFFECTS;
const TURN_END = THE_ORDER_OF_EACH_STAGE_OF_THE_IMPERIAL_TITLES.turnEnd;

/** A stage of an Imperial Title's board. */
export type AStageOfAnImperialTitlesBoard = keyof typeof TURN_END;

/** A title whose board is told at a stage of `turnEnd`, by its slug. */
export type AnImperialTitleWithABoard = (typeof TURN_END)[AStageOfAnImperialTitlesBoard][number];

/** The runner of the stages of an Imperial Title's board (the title intelligence, at the turn's end): for each title
 *  of the stage, in the stage's order, the seat of the realm holding it is asked (none: vacant, and nothing is told);
 *  for a held title, its effect is handed the world its board reads, and its lines are handed to the caller, who
 *  writes them, before the next title is asked (as each title's block of the title intelligence ran in turn). */
export function theBoardsOfTheImperialTitlesAtAStage(
  theStage: AStageOfAnImperialTitlesBoard,
  theSeatHoldingTheTitle: (theTitle: AnImperialTitleWithABoard) => number | null,
  theWorldItsBoardReads: (theHoldersSeat: number) => AnImperialTitlesHolderAndTheWorldHisBoardReads,
  tellTheBoard: (
    theTitle: AnImperialTitleWithABoard,
    theHoldersSeat: number,
    theLines: readonly TheFactOfALineOfABoardOfRivalRealms[],
  ) => void,
): void {
  for (const theTitle of TURN_END[theStage]) {
    const theHoldersSeat = theSeatHoldingTheTitle(theTitle);
    if (theHoldersSeat == null) continue;
    const theEffect = ENTRIES[theTitle].turnEnd?.[theStage];
    if (!theEffect) continue;
    tellTheBoard(theTitle, theHoldersSeat, theEffect(theWorldItsBoardReads(theHoldersSeat)));
  }
}
