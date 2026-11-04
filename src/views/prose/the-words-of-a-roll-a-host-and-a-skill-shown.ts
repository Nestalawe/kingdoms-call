// ── THE WORDS OF A ROLL, A HOST AND A SKILL SHOWN (plan P1-13f: P1-13's Decisions of 2026-11-03, Decision 2) ──
// Words helpers the prose's move (P1-12d) left behind in the engine, with no engine caller: a percentage roll's mark
// (fmtRoll), a host named for a battle's line (describeArmy), a rival's skill shown (theWordsOfAStatShown), the odds
// shown (theWordsOfTheOddsShown) and a skill in play (theWordsOfASkillInPlay). The three last write the values the
// engine's heroes/effective-skills-and-hidden-heroes.ts records (their shapes stay there, where the facts read them).
import { KC_SKILL_LABELS as SKILL_LABELS } from '../../content/kingdoms-call-data.ts';
import { dispFloor } from '../../engine/rules-on-plain-values/a-number-shown-to-a-player-rounded-down.ts';
import type { AUnitAsDescribeArmyNamesIt } from '../../engine/dice-and-army-names.ts';
import type {
  AStatShownAsALineTellsIt,
  ASkillInPlayAsALineTellsIt,
  TheOddsShownAsALineTellsIt,
} from '../../engine/heroes/effective-skills-and-hidden-heroes.ts';

// ONE canonical way to show a percentage roll in the report — the success CHANCE and the actual
// d100 ROLL, with a ✓/✗. Success is roll<=chance (the d100 convention, engine/dice-and-army-names.ts). The displayed % is
// clamped to 0–100; the underlying test should use the raw chance. Roll-display contract (Sept
// 2026): callers MUST compare an integer d100 roll against Math.round(chance) — never the raw
// fractional chance — so the tick shown here always matches the outcome. fmtRoll rounds both the
// same way. 2026-09-12: every number a player is shown is ROUNDED DOWN (toward zero), never to
// nearest — a 41.6% share must not read "42% (need 42%)", and a 49.6% chance must not read 50% and
// then miss on a roll of 50. With integer d100 rolls, roll<=floor(chance) is exactly roll<=chance,
// so the shown figure is the true test. A float a hair under an integer (0.29*100 = 28.999…) snaps
// to that integer rather than dropping a point.
export function fmtRoll(chance: number, roll: number) {
  const c = Math.max(0, Math.min(100, dispFloor(chance)));
  const r = dispFloor(roll);
  return `${c}% [roll ${r} ${r <= c ? '✓' : '✗'}]`;
}
export function describeArmy(armies: readonly AUnitAsDescribeArmyNamesIt[] | null | undefined) {
  if (!armies || armies.length === 0) return 'no armies';
  const named: string[] = [];
  const unnamed: Record<string, number> = {};
  armies.forEach((a) => {
    const hasName = a.unitName && a.unitName !== a.type && !a.unitName.startsWith('undefined');
    if (a._phantom) {
      named.push(`✨ ${a.unitName} (${a.type}, ${a.quality})`);
    } else if (hasName) {
      named.push(`${a.unitName} (${a.type}, ${a.quality})`);
    } else {
      const key = `${a.quality} ${a.type}`;
      unnamed[key] = (unnamed[key] || 0) + 1;
    }
  });
  const unnamedStrs = Object.entries(unnamed).map(([k, n]) => (n > 1 ? `${n}× ${k}` : k));
  return [...named, ...unnamedStrs].join(', ') || 'no armies';
}
/** The words of a skill shown, " (Spy 3)", or none. */
export function theWordsOfAStatShown(shown: AStatShownAsALineTellsIt | null): string {
  if (!shown) return '';
  // the labels read by any skill's slug
  const labels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
  return ` (${(shown.label ?? '') || (labels[shown.stat] ?? '') || shown.stat} ${String(shown.level)})`;
}
/** The words of the odds shown: "40% [roll 23 ✓]" with the working, else "[✓]". */
export function theWordsOfTheOddsShown(odds: TheOddsShownAsALineTellsIt): string {
  const { chance, roll } = odds;
  if (odds.theRivalsSkillIsKnown) return fmtRoll(chance, roll);
  return `[${dispFloor(roll) <= Math.max(0, Math.min(100, dispFloor(chance))) ? '✓' : '✗'}]`;
}
/** The words of a skill in play, " (Melee 6 in play, with Sword of Ages +1)", or none. */
export function theWordsOfASkillInPlay(inPlay: ASkillInPlayAsALineTellsIt | null): string {
  if (!inPlay) return '';
  const { skill } = inPlay;
  const src = inPlay.sources.map((s) => `${s.label} +${String(s.delta)}`).join(', ');
  // the labels read by any skill's slug
  const labels: Readonly<Partial<Record<string, string>>> = SKILL_LABELS;
  return ` (${(labels[skill] ?? '') || skill} ${String(inPlay.total)} in play${src ? `, with ${src}` : ''})`;
}
