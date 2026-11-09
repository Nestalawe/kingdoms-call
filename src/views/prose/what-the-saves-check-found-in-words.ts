// ── What the save's check found, in words, for the GM (plan P1-15d) ────
// The check of a saved game at load (upgrade-a-saved-game-and-check-it.ts) names each place the save differs from this
// build's schema by its path and its kind. Since P1-15f8 a place not on the short known list stops the turn before it
// runs (engine/saves/the-saves-check-before-a-turn-and-the-known-leaks-it-lets-through.ts), and the GM page's message
// says why in the words of whyTheSavesCheckStoppedTheTurnInWords. A save holding only known places still plays, and the
// GM is told twice, in the words of whatTheSavesCheckFoundInWords: a line in the GM's log at the turn's end, which no
// realm reads (engine/turn/new-turn-war-academy-…-the-final-reconcile.ts), and the turn's message on the GM page
// (src/ui/gm/turn-shell.ts). A file that imports nothing, so neither reader brings the upgrade's files with it.

/** How many of the check's findings the GM is shown by name: the rest are counted. */
export const THE_CHECKS_FINDINGS_NAMED_AT_MOST = 10;

/** "1 thing", "2 things". */
const theCountOf = (findings: readonly string[]): string =>
  findings.length === 1 ? '1 thing' : `${String(findings.length)} things`;

/** The first ten of the findings, joined, and how many more. */
const theListOf = (findings: readonly string[]): string => {
  const more = findings.length - THE_CHECKS_FINDINGS_NAMED_AT_MOST;
  return (
    findings.slice(0, THE_CHECKS_FINDINGS_NAMED_AT_MOST).join('; ') + (more > 0 ? `; and ${String(more)} more.` : '.')
  );
};

/** The check's findings in words: how many, that the turn ran on the save as it was, the first ten, and how many more. */
export function whatTheSavesCheckFoundInWords(findings: readonly string[]): string {
  return (
    `The saved game holds ${theCountOf(findings)} this build of Kingdoms Call doesn't know, and the turn ran on it as it ` +
    `was. Please send this list to the Kingdoms Call team: ${theListOf(findings)}`
  );
}

/** Why the check stopped the turn, in words: how many places, that the turn didn't run, the first ten, how many more. */
export function whyTheSavesCheckStoppedTheTurnInWords(findings: readonly string[]): string {
  return (
    `The saved game holds ${theCountOf(findings)} this build of Kingdoms Call doesn't know, so the turn did not run. ` +
    `Please send this list to the Kingdoms Call team: ${theListOf(findings)}`
  );
}
