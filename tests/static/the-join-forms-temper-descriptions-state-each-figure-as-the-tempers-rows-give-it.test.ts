// The join form's temper descriptions state each figure as the tempers' rows give it (B-06, T7, the rules pulled out:
// Run 3a's portal row, B-06ak): the player portal's briefing (updateTemperDesc's DESCS in
// src/ui/player/briefing-and-submit.ts, the one string that opens on each temper in bold) restates the tempers' rows
// (TEMPER_TRAITS, src/content/kingdoms-call-data.ts) in words. Each figure those words state is built here from the
// row and must be in its description: Berserk's melee to-hit and damage, the share of each blow it shrugs off and the
// guard it gives up; Brave's melee, archery and damage, and its Second Wind of about a quarter of its health; Cautious's
// guard, the most an attacker can reach against it (the duel's hit ceiling, PC_HIT_MAX, less its guard), the damage
// each blow loses and its riposte; Cowardly's archery and Steal. And what the words say of the figures holds: Brave
// has no figure below nothing, Cautious no attack bonus, Cowardly the best withdraw and flee of the four and a blade
// below nothing; Second Wind is Brave's alone, the riposte Cautious's, mercy Cowardly's. So a figure changed in content
// and not in the words, or in the words and not in content, turns this red.
// Level 0 (static): content's rows imported (plain data), the briefing's strings read by its syntax tree
// (tests/lib/source.ts) and the duel's ceiling read from its row; nothing runs.
import { expect, test } from 'vitest';
import {
  KC_A_BLOWS_CHANCE_TO_HIT_IN_PERSONAL_COMBAT,
  KC_TEMPERS,
  TEMPER_TRAITS,
} from '../../src/content/kingdoms-call-data.ts';
import { stringsOf } from '../lib/source.ts';

type ATemper = 'Berserk' | 'Brave' | 'Cautious' | 'Cowardly';
const THE_FOUR: readonly ATemper[] = ['Berserk', 'Brave', 'Cautious', 'Cowardly'];

/** The most a blow in a duel can reach, before the defender's guard lowers it (PC_HIT_MAX, content's row since B-06bn). */
const THE_DUELS_HIT_CEILING: number = KC_A_BLOWS_CHANCE_TO_HIT_IN_PERSONAL_COMBAT.theMost;

/** The words a reader sees in a description: the bold marks (`**`) dropped, the spaces made one. */
const asAReaderSeesIt = (text: string): string => text.split('**').join('').replace(/\s+/g, ' ').trim();

/** A share (0 to 1) in whole percent. */
const percent = (share: number): number => Math.round(share * 100);

/** Each temper's description on the join form: the strings that open on the temper in bold. */
function theDescriptionsOf(temper: ATemper): string[] {
  return stringsOf('ui/player/briefing-and-submit.ts')
    .filter((s) => s.includes(`**${temper}:**`))
    .map(asAReaderSeesIt);
}

/** The words each temper's description must hold, built from its row. */
function thePhrasesOf(temper: ATemper): string[] {
  const t = TEMPER_TRAITS[temper];
  switch (temper) {
    case 'Berserk':
      return [
        `+${String(t.meleeHit)}% to hit and +${String(t.meleeDamage)} damage in melee`,
        `shrugs off ${String(percent(t.hitSoakPct))}% of every blow and arrow`,
        `enemies hit them ${String(-t.defence)}% more easily`,
      ];
    case 'Brave':
      return [
        `+${String(t.meleeHit)}% melee, +${String(t.archeryHit)}% archery, +${String(t.meleeDamage)} damage`,
        'Second Wind',
        'recover about a quarter of their health',
      ];
    case 'Cautious':
      return [
        `Enemies are ${String(t.defence)}% less likely to hit them`,
        `can never beat ${String(THE_DUELS_HIT_CEILING - t.defence)}% however skilled`,
        `does ${String(t.damageSoak)} less damage`,
        `${String(percent(t.riposte))}% riposte`,
        'No attack bonus',
      ];
    case 'Cowardly':
      return [
        `+${String(t.archeryHit)}% archery, +${String(t.stealMod)}% to Steal`,
        'best in the game at breaking off and fleeing',
        'beg for mercy',
        'Poor with a blade',
      ];
  }
}

test('the four tempers are content’s', () => {
  expect([...THE_FOUR]).toEqual(KC_TEMPERS);
});

test.for(THE_FOUR)("%s's description on the join form states each figure as its row gives it", (temper) => {
  const descriptions = theDescriptionsOf(temper);
  expect(descriptions.length, `the join form's descriptions of ${temper}`).toBe(1);
  const [description = ''] = descriptions;
  const missing = thePhrasesOf(temper).filter((phrase) => !description.includes(phrase));
  expect(missing, `the words of ${temper}'s row its description doesn't hold`).toEqual([]);
});

test('what the words say of the figures holds on the rows', () => {
  const rows = THE_FOUR.map((temper) => [temper, TEMPER_TRAITS[temper]] as const);
  const brave = TEMPER_TRAITS.Brave;
  const cautious = TEMPER_TRAITS.Cautious;
  const cowardly = TEMPER_TRAITS.Cowardly;
  // Brave: "No weakness"; its Second Wind "about a quarter of their health"
  expect(
    [brave.meleeHit, brave.archeryHit, brave.defence, brave.meleeDamage].every((n) => n >= 0),
    'Brave has no figure below nothing',
  ).toBe(true);
  expect(Math.abs(brave.secondWind - 0.25), 'Brave recovers about a quarter of his health').toBeLessThanOrEqual(0.025);
  // Cautious: "No attack bonus"
  expect([cautious.meleeHit, cautious.archeryHit], 'Cautious has no attack bonus').toEqual([0, 0]);
  // Cowardly: "best in the game at breaking off and fleeing", "Poor with a blade"
  for (const [temper, t] of rows) {
    if (temper === 'Cowardly') continue;
    expect(cowardly.withdrawMod, `Cowardly breaks off better than ${temper}`).toBeGreaterThan(t.withdrawMod);
    expect(cowardly.fleeMod, `Cowardly flees better than ${temper}`).toBeGreaterThan(t.fleeMod);
  }
  expect(cowardly.meleeHit, 'Cowardly is poor with a blade').toBeLessThan(0);
  // each named gift is its temper's alone
  expect(
    rows.filter(([, t]) => t.secondWind > 0).map(([temper]) => temper),
    'Second Wind',
  ).toEqual(['Brave']);
  expect(
    rows.filter(([, t]) => t.riposte > 0).map(([temper]) => temper),
    'the riposte',
  ).toEqual(['Cautious']);
  expect(
    rows.filter(([, t]) => t.mercy).map(([temper]) => temper),
    'mercy',
  ).toEqual(['Cowardly']);
});
