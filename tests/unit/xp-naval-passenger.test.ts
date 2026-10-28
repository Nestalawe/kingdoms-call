// 2026-10-14 (batch item 9): a hero learns Naval at sea only when leading ships or sea beasts. A passenger (a hero
// carried in another's hulls, or riding out by sea with no fleet of his own) learns nothing from the voyage.
// Level 1: every voyage roll (a sea move, a Defend ride-out by sea, a reinforcement or a pursuit step at sea) goes
// through rollNavalVoyage (src/engine/heroes/experience-skill-rises-and-earned-hp.ts, plan P1-08c), called directly in
// the bare vm (tests/lib/engine.ts); every experience roll is recorded by a wrapper around the top-level trySkillGain.
// Level 0: no voyage path calls trySkillGain for Naval directly any more (only battles, won or lost, and the Naval 7/9
// orders, which need a fleet, do): every such call, as the function it is in and its arguments, is one of a known list.
// This was tests/xp-naval-passenger.test.js, which ran one turn on the GM portal for the "  // 4. Run all 5 phases" hook
// to hand rollNavalVoyage back, and hooked the first line of trySkillGain; the checks are the same.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Item 9: `rollNavalVoyage` rolls Naval for a hero leading ships or a sea beast and not for one with none (rolls
// recorded by a wrapper around the top-level `trySkillGain`); statically, no voyage path calls `trySkillGain` for Naval
// directly any more (only battle wins and the Naval 7/9 orders). `unit/xp-naval-passenger.test.ts`: `rollNavalVoyage`
// called directly in the bare `vm` (P1-08c; it was a code-anchor test that ran a turn first) (batch 2026-10-14)
import vm from 'node:vm';
import { afterAll, expect, test } from 'vitest';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext } from '../lib/engine.ts';
import { callsTo, pageScripts } from '../lib/source.ts';

// Every experience roll for Naval in the GM portal's code, read by its syntax tree (tests/lib/source.ts, plan P1-09a:
// the lines of the built page were matched until then), as the function it is made in and what it is handed: the
// battles' rolls (won or lost, at sea), the Naval 7/9 orders' (Blockade, Raid the Coast) and rollNavalVoyage's own.
const NAVAL_ROLLS = [
  "combatVsChar(turnContext,won?atk:def,'naval',SKILLGAIN_STD,narrative)",
  "combatVsChar(turnContext,won?def:atk,prov.terrain==='sea'?'naval':'tactical',SKILLGAIN_COMMON,narrative)",
  "combatVsNPC(turnContext,c,'naval',SKILLGAIN_STD,narrative)",
  "combatVsNPC(turnContext,c,prov.terrain==='sea'?'naval':'tactical',SKILLGAIN_COMMON,narrative)",
  "combatVsNPC(turnContext,neutralGuardHero,'naval',SKILLGAIN_STD,narrative)",
  "combatVsNPC(turnContext,neutralGuardHero,prov.terrain==='sea'?'naval':'tactical',SKILLGAIN_COMMON,narrative)",
  "resolveBlockadeOrder(turnContext,c,'naval',SKILLGAIN_STD)",
  "resolveRaidTheCoastOrder(turnContext,c,'naval',SKILLGAIN_STD)",
  "rollNavalVoyage(turnContext,c,'naval',base)",
];
// It reads every file of the GM page by its syntax tree: under a second here, 3 to 5 s on a CI runner (2.2 s on #169's,
// 4.9 s on #171's), so it has time enough of its own, as the source test's every-file checks do (Vitest's default, 5 s,
// failed on a slow runner).
const EVERY_FILE_MS = 60_000;
test(
  'no voyage rolls Naval outside rollNavalVoyage',
  () => {
    const rolls = pageScripts('kingdoms-call-gm-portal.html')
      .flatMap((f) => callsTo(f, 'trySkillGain'))
      .filter((c) => c.args.slice(2, 3).some((a) => a.includes("'naval'")))
      .map((c) => `${String(c.within)}(${c.args.join(',')})`)
      .sort();
    expect(rolls).toEqual(NAVAL_ROLLS);
  },
  EVERY_FILE_MS,
);

const engine = loadEngine({ seed: 1 });
const restoreLog = quietEngineLog(engine);
afterAll(restoreLog);
const tc = turnContext(engine, botWorld(engine, 2, { cols: 10, rows: 6 }));
type Roll = { id: unknown; skill: string; base: unknown; mult: unknown };
type Hero = { id: unknown; alive: boolean; player: number | null; armies: object[] };
// Records every experience roll as it starts, as the hook on trySkillGain's first line did.
vm.runInContext(
  `{ const tryOne=trySkillGain;
     trySkillGain=function(turnContext, char, skill, base, narr, mult){
       if(globalThis.__xp) globalThis.__xp.push({id:char&&char.id,skill,base,mult});
       return tryOne.apply(this, arguments); }; }`,
  engine,
);
const rollNavalVoyage = engineFn(engine, 'rollNavalVoyage') as (t: typeof tc, c: Hero, base: number) => void;
const hero = (tc.G as { characters: Hero[] }).characters.find((c) => c.alive && c.player != null);
if (!hero) throw new Error('the world has no living hero of a realm');
const rollsOf = (armies: object[]): Roll[] => {
  const rolls: Roll[] = [];
  engine['__xp'] = rolls;
  try {
    rollNavalVoyage(tc, { ...hero, armies }, 0.1);
  } finally {
    engine['__xp'] = undefined;
  }
  return rolls;
};

test('a hero with no ships learns no Naval from a voyage', () => {
  expect(rollsOf([]).some((x) => x.skill === 'naval')).toBe(false);
});
test('a hero leading ships rolls Naval', () => {
  const fleet = vm.runInContext('[...SEA_TYPES][0]', engine) as string;
  expect(
    rollsOf([{ type: fleet, quality: 'Average' }]).some((x) => x.skill === 'naval'),
    fleet,
  ).toBe(true);
});
test('a hero leading a sea beast rolls Naval', () => {
  const beast = vm.runInContext('[...PRIMAL_SEA_TYPES][0]', engine) as string;
  expect(
    rollsOf([{ type: beast, quality: 'Average' }]).some((x) => x.skill === 'naval'),
    beast,
  ).toBe(true);
});
