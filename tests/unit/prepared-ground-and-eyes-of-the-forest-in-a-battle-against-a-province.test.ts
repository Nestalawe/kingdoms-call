// 2026-10-11 (Toby, the unit abilities; R-095): two abilities only a battle shows, because their hooks sit inside it:
//   Prepared Ground     defending Yeoman Longbows loose two pre-battle volleys (the attacker's loose one, with no
//                       Prepared Ground in the header);
//   Eyes of the Forest  Eagle Riders flying with the shooters spoil a Forest Wardens' Ambush in a forest, and the
//                       report says so (🦅); without them the Ambush holds and the archers find no target.
// Each is staged against a guard made by the test (no skill, no item) on a free province, one Elite company against
// one other, so the volleys are the rule's whatever the dice do. Raiders' Muster, the third ability the old script
// held, is tests/scenario/raiders-muster-draws-a-goblin-horde-to-an-orcish-provinces-garrison-at-turns-end.test.ts.
//
// Level 1 (unit): combatVsNPC called directly (tests/lib/a-battle-called-directly.ts) on a world the engine makes from
// KC_SEED; no turn is played. Not lower: the volleys are fired inside the battle, from the companies on the field.
//
// Until plan P1-14d this was the first half of tests/abilities-turn.test.js, turns on the GM page (lib/scenario.js)
// that searched the map for a guard the world had. Its checks are kept, and two are stricter: a battle fought once
// (no turn, so no stalled battle fought again next phase) shows exactly two defending volleys and exactly one
// attacking one, where the old counted them per battle over the phases the turn fought.
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import {
  aBattleAgainstTheProvince,
  aFieldAndTheGroundBesideIt,
  aGuardMadeByTheTest,
  attackFrom,
  aWorld,
  type Company,
  companies,
  MELEE_AND_NO_DUEL,
  own,
  theTurnsContext,
} from '../lib/a-battle-called-directly.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** Realm 0's first hero (not its king), with no Archery and no item, attacks a guard on `terrain`: his companies
 *  against the guard's. Returns the battle's words, one line after another. */
function aBattle(terrain: string, guards: Company[], heros: Company[]): string {
  const G = aWorld(SEED);
  const tc = theTurnsContext(G);
  const H = G.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
  if (!H) throw new Error('realm 0 has no hero but its king');
  const { field, from } = aFieldAndTheGroundBesideIt(G, { terrain });
  own(G, from, 0);
  const guard = aGuardMadeByTheTest(G, field, guards);
  attackFrom(G, H, from, field);
  H.armies = heros;
  H.skills = { ...H.skills, archery: 0 };
  H.items = [];
  H.encounterPlan = MELEE_AND_NO_DUEL();
  return aBattleAgainstTheProvince(tc, H, field, guard).text;
}

const count = (text: string, phrase: string) => text.split(phrase).length - 1;

test('Prepared Ground: a defending Longbow company looses two volleys a battle, and the header says why', () => {
  const txt = aBattle('plain', companies('Yeoman Longbows', 1, 'Elite'), companies('Shieldwall Levies', 1, 'Elite'));
  expect(txt, "the defenders' archery names Prepared Ground").toMatch(
    /Defender Archery Phase\*\* — 1 ranged unit \(Prepared Ground: the Longbows loose twice\)/,
  );
  expect(count(txt, '⚔ **Battle for '), 'one battle is fought').toBe(1);
  expect(count(txt, 'Yeoman Longbows 1 fires at Shieldwall Levies 1'), 'the Longbow company fires twice').toBe(2);
  expect(count(txt, 'Yeoman Longbows 1 fires at'), '…and at nothing else').toBe(2);
});

test('an attacking Longbow company looses one volley a battle, with no Prepared Ground', () => {
  const txt = aBattle('plain', companies('Shieldwall Levies', 1, 'Elite'), companies('Yeoman Longbows', 1, 'Elite'));
  expect(txt, 'the attacker fires in the pre-battle archery phase').toMatch(
    /Pre-battle Archery Phase\*\* — 1 ranged unit/,
  );
  expect(txt.includes('Prepared Ground'), 'with no Prepared Ground').toBe(false);
  expect(count(txt, '⚔ **Battle for '), 'one battle is fought').toBe(1);
  expect(count(txt, 'Yeoman Longbows 1 fires at'), 'the Longbow company fires once').toBe(1);
});

test("Eyes of the Forest: Eagle Riders flying with the shooters spoil the Forest Wardens' Ambush", () => {
  const txt = aBattle(
    'forest',
    companies('Forest Wardens', 1, 'Green'),
    companies('Yeoman Longbows', 2, 'Elite').concat(companies('Eagle Riders', 1, 'Elite')),
  );
  expect(txt, 'the report says the Eagles spoil the Ambush').toMatch(
    /🦅 .*Eagle Riders mark the Forest Wardens in the thickets — the Ambush is spoiled and the volley flies/,
  );
  expect(txt, '…and the volley flies').toMatch(/Pre-battle Archery Phase\*\* — 2 ranged units/);
  expect(txt.includes('can find no target'), '…at a target').toBe(false);
});

test('without Eagle Riders the Ambush holds as before', () => {
  const txt = aBattle('forest', companies('Forest Wardens', 1, 'Green'), companies('Yeoman Longbows', 2, 'Elite'));
  expect(txt, 'the archers can find no target').toMatch(
    /archers can find no target — Forest Wardens hold the thickets/,
  );
  expect(txt.includes('🦅'), 'and no Eagles line').toBe(false);
});
