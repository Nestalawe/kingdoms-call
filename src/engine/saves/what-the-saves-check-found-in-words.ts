// ── What the save's check found, in words, for the GM (plan P1-15d) ────
// The check of a saved game at load (upgrade-a-saved-game-and-check-it.ts) names each place the save differs from this
// build's schema by its path and its kind. A save that differs still plays (Theo's Choice 1, "tell now, stop later"),
// and the GM is told twice, in these words: a line in the GM's log at the turn's end, which no realm reads
// (engine/turn/new-turn-war-academy-…-the-final-reconcile.ts), and the turn's message on the GM page
// (src/ui/gm/turn-shell.ts). A file that imports nothing, so neither reader brings the upgrade's files with it.

/** How many of the check's findings the GM is shown by name: the rest are counted. */
export const THE_CHECKS_FINDINGS_NAMED_AT_MOST = 10;

/** The check's findings in words: how many, that the turn ran on the save as it was, the first ten, and how many more. */
export function whatTheSavesCheckFoundInWords(findings: readonly string[]): string {
  const more = findings.length - THE_CHECKS_FINDINGS_NAMED_AT_MOST;
  const things = findings.length === 1 ? '1 thing' : `${String(findings.length)} things`;
  return (
    `The saved game holds ${things} this build of Kingdoms Call doesn't know, and the turn ran on it as it was. ` +
    `Please send this list to the Kingdoms Call team: ` +
    findings.slice(0, THE_CHECKS_FINDINGS_NAMED_AT_MOST).join('; ') +
    (more > 0 ? `; and ${String(more)} more.` : '.')
  );
}
