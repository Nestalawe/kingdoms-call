// 2026-10-14 (batch item 9): a hero learns Naval at sea only when leading ships or sea beasts. A passenger (a hero
// carried in another's hulls, or riding out by sea with no fleet of his own) learns nothing from the voyage.
// Level 1: every voyage roll (a sea move, a Defend ride-out by sea, a reinforcement or a pursuit step at sea) goes
// through rollNavalVoyage (src/engine/heroes/experience-skill-rises-and-earned-hp.js, plan P1-08c), called directly in
// the bare vm (tests/lib/engine.ts); every experience roll is recorded by a wrapper around the top-level trySkillGain.
// Level 0: no voyage path calls trySkillGain for Naval directly any more (only battles, won or lost, and the Naval 7/9
// orders, which need a fleet, do).
// This was tests/xp-naval-passenger.test.js, which ran one turn on the GM portal for the "  // 4. Run all 5 phases" hook
// to hand rollNavalVoyage back, and hooked the first line of trySkillGain; the checks are the same.
import vm from 'node:vm';
import { afterAll, expect, test } from 'vitest';
import { readPage } from '../lib/boot.js';
import { botWorld, engineFn, loadEngine, quietEngineLog, turnContext } from '../lib/engine.ts';

test('no voyage rolls Naval outside rollNavalVoyage', () => {
  const direct = readPage('kingdoms-call-gm-portal.html')
    .split('\n')
    .filter((l) => /trySkillGain\([^)]*['"]naval['"]/.test(l) || /trySkillGain\([^)]*\?\s*'naval'/.test(l));
  // the Naval 7/9 orders' rolls and rollNavalVoyage's own, each with the turn's context first (plan P1-08c)
  const allowed = (l: string) =>
    /_rollNavalGain|neutralGuardHero|won\?atk:def|won\?def:atk|if\(!won\)/.test(l) ||
    /^\s*trySkillGain\(turnContext,c,'naval',(SKILLGAIN_STD|base)\);\s*$/.test(l);
  const stray = direct.filter((l) => !allowed(l));
  expect(stray.map((l) => l.trim().slice(0, 90))).toEqual([]);
});

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
