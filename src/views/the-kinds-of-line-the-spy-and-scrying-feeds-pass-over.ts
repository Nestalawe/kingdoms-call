// ── THE KINDS OF LINE THE SPY AND SCRYING FEEDS PASS OVER (plan P1-12d36: P1-12d's Decisions of 2026-11-01,
// Decision 3) ────
// A spy's lingering sight and the Clairvoyance feed (playerEvents, every-realms-report-and-the-lines-each-realm-reads.ts)
// pass over some lines by their kind, which the words pass hands beside each stored line (theTurnsLinesInWords,
// prose/the-words-of-each-line.ts; the kind is never stored). Both pass over a force drawn up for battle (the header
// the pages read back as a record); the Clairvoyance feed passes over the roll lines too.
import type { LineFact } from '../engine/turn/events-and-their-audiences.ts';

type AKindOfLine = LineFact['kind'];

/** A battle's force drawn up: its words are the record the pages read back (⚑FORCE⚑ and the force as JSON), no line to
 *  read in a feed. */
export const THE_KIND_OF_A_FORCE_DRAWN_UP_FOR_BATTLE = 'a force drawn up for battle' satisfies AKindOfLine;

/** The roll lines: the kinds whose words show a roll or a battle's working, each opening with 📊 (a static test keeps
 *  this list and those words in step), by area. Too many for a scrying feed. */
export const THE_KINDS_OF_A_ROLL_LINE: ReadonlySet<AKindOfLine> = new Set<AKindOfLine>([
  // a battle's
  "the terrain's effect on each side",
  "the battle's statistics begin",
  "the battle's outcome and its margin",
  "the loser's force is destroyed to the last",
  "the loser's surviving forces",
  "the loser's forces are completely destroyed and he retreats alone",
  "the attacker's Tactical command does not apply at sea",
  "the attacker's archery volley's total",
  "the defenders' archery volley's total",
  "the terrain's effect on the attacker's units",
  'the ground allows a front of a width',
  "a side's front line in the battle grid",
  "a side's second line in the battle grid",
  'the scouting side chooses the front',
  'each side shifts its battle line',
  // the espionage orders'
  "a spy's roll to read a hero",
  "a hero's chance to notice a spy",
  "a spy's roll to spy out a province",
  "a spy's disguise is put to the test",
  "a thief's roll to rob a garrison's paymaster",
  "a thief's roll to rob a hero",
  "a thief's roll to crack the vaults",
  "an assassin's roll",
  // the Cast Spell order's
  'an enchanted hero may turn on his enchanter',
  "a spell's cast is rolled",
  "a mind's resistance to a Charm is rolled",
  // the move order's
  "a contingent joins a hero's assault on a guarded province",
  "a contingent joins a hero's assault on a rival's province",
  // a chase's
  'a chaser rolls to close on his quarry',
  "a lone challenger rolls to break the ranks of his quarry's camp",
  // the Research and Practice orders'
  "a Sage's discovery roll",
  // the Defend watch's
  "the odds of a lone defender's ambush",
]);
