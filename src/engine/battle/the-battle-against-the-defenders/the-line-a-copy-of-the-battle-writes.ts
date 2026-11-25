// A check the stages of the battle against a province's defenders share (combatVsNPC and its stage files beside this
// one), moved here as it was from combatVsNPC's file (B-06ba) once a stage file read it too: the line a registry names,
// read as one this copy of the battle writes. It draws no die; this file holds no stage's anchor
// (tools/proof/README.md, section 8).

/** The line the registry names for what a battle spell or a unit's strike does, read as one of the kinds this copy of
 *  the battle writes there with the facts it hands: the registry's tables name one line for each copy and each outcome,
 *  so it is always one of them; for any other, a TypeError. */
export function theLineThisCopyOfTheBattleWrites<Line extends string>(line: string, ...lines: readonly Line[]): Line {
  const theLine = lines.find((l) => l === line);
  if (theLine === undefined) throw new TypeError(`a line this copy of the battle doesn't write: ${line}`);
  return theLine;
}
