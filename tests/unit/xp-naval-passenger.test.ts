// 2026-10-14 (batch item 9): a hero learns Naval at sea only when leading ships or sea beasts. A passenger (a hero
// carried in another's hulls, or riding out by sea with no fleet of his own) learns nothing from the voyage.
// Level 1: every voyage roll (a sea move, a Defend ride-out by sea, a reinforcement or a pursuit step at sea) goes
// through rollNavalVoyage (src/engine/heroes/experience-skill-rises-and-earned-hp.ts, plan P1-08c), called directly on
// the engine's modules (since P1-14m; the bare vm before, where a wrapper around the top-level trySkillGain recorded
// each experience roll). rollNavalVoyage calls trySkillGain inside its own file, where no stand-in reaches
// (docs/traps.md), so each roll is made certain (every die 0) and read by what it leaves: a rise held back on the hero
// for the phase's end, naming its skill.
// Level 0: no voyage path calls trySkillGain for Naval directly any more (only battles, won or lost, and the Naval 7/9
// orders, which need a fleet, do): every such call, as the function it is in and its arguments, is one of a known list.
// This was tests/xp-naval-passenger.test.js, which ran one turn on the GM portal for the "  // 4. Run all 5 phases" hook
// to hand rollNavalVoyage back, and hooked the first line of trySkillGain; the checks are the same.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Item 9: `rollNavalVoyage` rolls Naval for a hero leading ships or a sea beast and not for one with none (each roll
// made certain by the dice and read by the rise it holds back on the hero); statically, no voyage path calls
// `trySkillGain` for Naval directly any more (only battle wins and the Naval 7/9 orders).
// `unit/xp-naval-passenger.test.ts`: `rollNavalVoyage` called directly on the engine's modules (P1-14m; the bare `vm`
// from P1-08c; before, a code-anchor test that ran a turn first) (batch 2026-10-14)
import '../lib/the-whole-engine.ts';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { SRC, callsTo, pageScripts } from '../lib/source.ts';
import {
  aFreshTurnsContextOnTheWorld,
  botWorld,
  loadTheEngineOnItsModules,
  must,
  quietEngineLog,
  withDice,
} from '../lib/the-middle-of-a-bot-world-in-a-turn-on-the-engines-modules.ts';
import { timeLimitGivenAsANumber } from '../lib/time-limits.ts';

// Every experience roll for Naval in the GM portal's code, read by its syntax tree (tests/lib/source.ts, plan P1-09a:
// the lines of the built page were matched until then), as the function it is made in and what it is handed: the
// battles' rolls (won or lost, at sea), the Naval 7/9 orders' (Blockade, Raid the Coast) and rollNavalVoyage's own.
// The battle against a province's defenders makes its rolls in its last stage's file (B-06bd), which the page's entry
// doesn't name (KD-457), so its stages' files are read beside the page's.
const THE_STAGES_OF_THE_BATTLE_AGAINST_THE_DEFENDERS = 'engine/battle/the-battle-against-the-defenders';
const THE_STAGES_FILES = fs
  .readdirSync(path.join(SRC, THE_STAGES_OF_THE_BATTLE_AGAINST_THE_DEFENDERS))
  .sort()
  .map((f) => `${THE_STAGES_OF_THE_BATTLE_AGAINST_THE_DEFENDERS}/${f}`);
const NAVAL_ROLLS = [
  "combatVsChar(turnContext,won?atk:def,'naval',SKILLGAIN_STD,narrative)",
  "combatVsChar(turnContext,won?def:atk,prov.terrain==='sea'?'naval':'tactical',SKILLGAIN_COMMON,narrative)",
  "resolveBlockadeOrder(turnContext,c,'naval',SKILLGAIN_STD)",
  "resolveRaidTheCoastOrder(turnContext,c,'naval',SKILLGAIN_STD)",
  "rollNavalVoyage(turnContext,c,'naval',base)",
  "theCasualtiesTheRoutAndTheEndOfTheBattleAgainstTheDefenders(turnContext,c,'naval',SKILLGAIN_STD,narrative)",
  "theCasualtiesTheRoutAndTheEndOfTheBattleAgainstTheDefenders(turnContext,c,prov.terrain==='sea'?'naval':'tactical',SKILLGAIN_COMMON,narrative)",
  "theCasualtiesTheRoutAndTheEndOfTheBattleAgainstTheDefenders(turnContext,neutralGuardHero,'naval',SKILLGAIN_STD,narrative)",
  "theCasualtiesTheRoutAndTheEndOfTheBattleAgainstTheDefenders(turnContext,neutralGuardHero,prov.terrain==='sea'?'naval':'tactical',SKILLGAIN_COMMON,narrative)",
];
// It reads every file of the GM page by its syntax tree: under a second here, 3 to 5 s on a CI runner (2.2 s on #169's,
// 4.9 s on #171's), so it has time enough of its own, as the source test's every-file checks do (Vitest's default, 5 s,
// failed on a slow runner).
const EVERY_FILE_MS = timeLimitGivenAsANumber(60_000).timeout;
test(
  'no voyage rolls Naval outside rollNavalVoyage',
  () => {
    const rolls = [...pageScripts('kingdoms-call-gm-portal.html'), ...THE_STAGES_FILES]
      .flatMap((f) => callsTo(f, 'trySkillGain'))
      .filter((c) => c.args.slice(2, 3).some((a) => a.includes("'naval'")))
      .map((c) => `${String(c.within)}(${c.args.join(',')})`)
      .sort();
    expect(rolls).toEqual(NAVAL_ROLLS);
  },
  EVERY_FILE_MS,
);

const engine = await loadTheEngineOnItsModules({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const WORLD = botWorld(engine, 2, { cols: 10, rows: 6 });
const tc = aFreshTurnsContextOnTheWorld(engine, WORLD);
// (the engine's own modules, fresh with it)
const { rollNavalVoyage: rollNavalVoyageAsItsModuleExportsIt } =
  await import('../../src/engine/heroes/experience-skill-rises-and-earned-hp.ts');
const { SEA_TYPES, PRIMAL_SEA_TYPES } =
  await import('../../src/engine/rules-on-plain-values/units-that-fly-sail-or-can-be-carried-through-the-air.ts');
/** A rise an experience roll holds back for the phase's end (trySkillGain's candidate), by the skill it names. */
interface Roll {
  skill: string;
}
interface Hero {
  id: unknown;
  alive: boolean;
  player: number | null;
  armies: object[];
  _sgPending?: { list: Roll[] } | null;
}
const rollNavalVoyage = rollNavalVoyageAsItsModuleExportsIt as unknown as (t: typeof tc, c: Hero, base: number) => void;
const heroesOf = (t: typeof tc) => (t.G as { characters: Hero[] }).characters;
const hero = heroesOf(tc).find((c) => c.alive && c.player != null);
if (!hero) throw new Error('the world has no living hero of a realm');
/** The experience rolls a voyage starts for the hero leading `armies`, each read by the rise it holds back: every die
 *  is 0, so each roll it starts rises. Each voyage sets out on a fresh context of the same world, so a rise one holds back
 *  can't stop the next one's roll (a skill already among the rises held back isn't rolled again). */
const rollsOf = (armies: object[]): Roll[] => {
  const t = aFreshTurnsContextOnTheWorld(engine, WORLD);
  const real = must(
    heroesOf(t).find((c) => c.id === hero.id),
    'the hero',
  );
  withDice(engine, [0], () => {
    rollNavalVoyage(t, { ...real, armies }, 0.1);
  });
  return real._sgPending?.list ?? [];
};

test('a hero with no ships learns no Naval from a voyage', () => {
  expect(rollsOf([]).some((x) => x.skill === 'naval')).toBe(false);
});
test('a hero leading ships rolls Naval', () => {
  const fleet = must([...SEA_TYPES][0], 'a fleet');
  expect(
    rollsOf([{ type: fleet, quality: 'Average' }]).some((x) => x.skill === 'naval'),
    fleet,
  ).toBe(true);
});
test('a hero leading a sea beast rolls Naval', () => {
  const beast = must([...PRIMAL_SEA_TYPES][0], 'a sea beast');
  expect(
    rollsOf([{ type: beast, quality: 'Average' }]).some((x) => x.skill === 'naval'),
    beast,
  ).toBe(true);
});
