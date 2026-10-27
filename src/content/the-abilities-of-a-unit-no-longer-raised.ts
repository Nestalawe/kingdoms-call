// The abilities of a unit no longer raised (plan P1-19j; P1-19's second slice, Choice 4): the Corsair Fleet left the
// pools on 2026-10-15, and a company raised before still fights, with two abilities no book names (a question for
// Toby). Each is a row as the others are, read into UNIT_ABILITIES_THE_REGISTRY_HOLDS
// (unit-abilities-their-names-numbers-and-words.ts) and checked with them; the words test checks that neither book
// names the unit yet. Their rows are in this file, not beside the others, because that file is one of the player
// page's own files, and those name no retired unit (tests/corsairs-retired.test.js). Nothing on the player page reads
// them.

/** Cut the Line (fate: a force holds the sea lanes): between heroes, when at least half the winning force are Corsair
 *  Fleets, it closes the sea to the beaten (a corsair-heavy victor leaves no line of retreat by sea). */
export const CUT_THE_LINE = {
  unit: 'Corsair Fleet',
  name: 'Cut the Line',
  numbers: { theWinningForceAtLeast: { value: 0.5, theBooksWriteIt: 'half' } },
} as const;

/** Keep the Sea Lanes (fate: a force holds the sea lanes): against neutral guards, who never withdraw, a force at least
 *  half Corsair Fleets keeps its own way back to the ships when beaten. */
export const KEEP_THE_SEA_LANES = {
  unit: 'Corsair Fleet',
  name: 'Keep the Sea Lanes',
  numbers: { theForceAtLeast: { value: 0.5, theBooksWriteIt: 'half' } },
} as const;
