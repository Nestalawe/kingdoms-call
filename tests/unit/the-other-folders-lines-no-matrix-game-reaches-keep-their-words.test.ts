// The lines of the engine's other folders that plan P1-12d17 made facts (espionage/, realms/, magic/, world/, bots/
// and run-turn.ts: their words now written by the views, src/views/prose/), where no game of the balance matrix
// reaches the line or one of its fallbacks: a spy who serves no realm, or a realm of no name, caught prying; a province
// with no list of defenders; a Bless ward against a caster not named; the Plague on a unit of no name; a capture with
// no conqueror and no realm named; and an Evil conqueror's enslavement of the folk, and of a province with no humanoid
// folk. The matrix proves the rest (the GM's log byte-identical in all 120 games); each of these is proved here on the
// words the engine wrote before, whole, as the GM's log stores them (theTurnsLinesInWords).
// Level 1 (unit): each is a plain function on a staged world, called directly on the engine's modules (plan P1-14a);
// a static check can't run them, and no game reaches these lines. The staged values carry only the fields each reads,
// so their type is given by assertion (`as never`) where the function's own type asks for more. The dice are fixed with kcRng.use where a line draws them.
import '../lib/the-whole-engine.ts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { kcRng } from '../../src/engine/rng.ts';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import { theTurnsLinesInWords } from '../../src/views/prose/the-words-of-each-line.ts';
import { applySpySuccess } from '../../src/engine/espionage/what-a-spy-learns.ts';
import { applyEvilConquest, setProvinceOwner } from '../../src/engine/realms/relations-and-captures.ts';
import { applyPlague, blessWardNegates } from '../../src/engine/magic/plague-and-bless-ward.ts';

type Obj = Record<string, unknown>;

// The GM's log echoes each line on the console: quiet while the test writes lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

/** A turn's context on a staged state, with what emit reads. */
function aTurn(G: Obj): TurnContext {
  const tc = createTurnContext(G, [], 3) as unknown as TurnContext;
  Object.assign(tc, {
    _logCtx: { charId: null, phase: null },
    _currentPhase: 1,
    _afterPhases: false,
    _tel: { pre: {}, orders: {}, factsInTheTurnsOrder: [] },
  });
  return tc;
}
/** The words of the turn's lines, as the GM's log stores them. */
function wordsOf(tc: TurnContext): (string | null | undefined)[] {
  return theTurnsLinesInWords(tc.turnLog).gmLog.map((l) => l.text);
}
/** Runs `fn` with the dice fixed at `value`. */
function withDice<T>(value: number, fn: () => T): T {
  const was = kcRng.use(() => value);
  try {
    return fn();
  } finally {
    kcRng.use(was);
  }
}

describe("the other folders' lines no matrix game reaches keep their words", () => {
  describe('what a spy learns', () => {
    // Esterhold holds Wendmeadow, which keeps no list of defenders; the spy is a master (Spy 9: he learns nothing
    // more), and no realm's home is there.
    const spy = (player: number | null, players: Obj[]) => {
      const G = {
        turn: 4,
        players,
        characters: [],
        world: { provinces: [] },
      };
      const tc = aTurn(G);
      const sprov = { id: 2, name: 'Wendmeadow', owner: 0, tax: 3, features: [] };
      withDice(0.99, () => {
        applySpySuccess(tc, { id: 7, name: 'Thorn', player, alive: true, skills: { spy: 9 } }, sprov);
      });
      return wordsOf(tc);
    };
    test('a spy who serves no realm: no defenders listed, and "unknown agents" caught prying', () => {
      expect(spy(null, [{ name: 'Esterhold', homeProvinceId: 99 }])).toEqual([
        'Thorn spies on Wendmeadow: controlled by Esterhold, tax 3g, defenders: none.',
        "[Intelligence] 🕵 Counter-intelligence: your watch in Wendmeadow caught unknown agents's agents prying this turn.",
      ]);
    });
    test('a spy of a realm with no name: "an unknown power" caught prying', () => {
      const words = spy(1, [
        { name: 'Esterhold', homeProvinceId: 99 },
        { name: '', homeProvinceId: 98 },
      ]);
      expect(words[1]).toBe(
        "[Intelligence] 🕵 Counter-intelligence: your watch in Wendmeadow caught an unknown power's agents prying this turn.",
      );
    });
  });

  describe('the Plague and the Bless ward', () => {
    test('a Bless ward against a caster not named: "a hostile mage"', () => {
      const tc = aTurn({ turn: 4, players: [], characters: [] });
      const prov = { id: 2, name: 'Wendmeadow', _blessWardTurn: 4, _blessWardBy: 0, _blessWardPct: 100 };
      expect(withDice(0, () => blessWardNegates(tc, prov, null, 'Flood'))).toBe(true);
      expect(wordsOf(tc)).toEqual([
        "✨ A blessing lies over Wendmeadow — a hostile mage's Flood washes over the sacred ground and does no harm.",
      ]);
    });
    test('the Plague on a garrison unit of no name: its type names it', () => {
      const tc = aTurn({ turn: 4, players: [{ name: 'Esterhold' }], characters: [] });
      const prov = {
        id: 2,
        name: 'Wendmeadow',
        owner: 0,
        garrisonArmies: [{ type: 'Shieldwall Levies', quality: 'Veteran', race: 'Human' }],
      };
      expect(withDice(0, () => applyPlague(tc, prov, 1, 2))).toEqual({ tested: 1, affected: 1 });
      expect(wordsOf(tc)).toEqual([
        '☠ Plague sickens the garrison of Wendmeadow: Shieldwall Levies (now Average) lose an experience level.',
      ]);
    });
  });

  describe('a province taken', () => {
    test('no conqueror and no realm named: "an unknown commander", "an enemy realm", and no units', () => {
      const G = {
        turn: 3,
        players: [{ name: 'Esterhold' }],
        world: { provinces: [{ id: 0, name: 'Wendmeadow', owner: 0, terrain: 'plain' }] },
        characters: [],
      };
      const tc = aTurn(G);
      setProvinceOwner(tc, G.world.provinces[0], 5, null);
      expect(wordsOf(tc)).toEqual([
        '🏴 Wendmeadow has been captured from you by an unknown commander (an enemy realm).',
      ]);
    });
  });

  describe("an Evil hero's conquest", () => {
    const conquer = (prov: Obj) => {
      const realm = { name: 'Varn', alignment: 'Evil', gold: 10 };
      const tc = aTurn({ turn: 6, players: [realm], characters: [] });
      const p: Obj = { id: 2, name: 'Wendmeadow', terrain: 'plain', tax: 4, ...prov };
      withDice(0, () => {
        applyEvilConquest(tc, { name: 'Thorn', player: 0, encounterPlan: { evilMode: 'enslave' } }, p as never, realm);
      });
      return wordsOf(tc);
    };
    test('the beaten folk pressed into the garrison in chains', () => {
      expect(conquer({ race: 'Human', armyTypes: ['Free Lances'] })).toEqual([
        '⛓ Enslavement: Thorn presses the beaten folk of Wendmeadow into service — a Green Free Lances joins the garrison in chains, but the province seethes (−1 tax for 3 turns).',
      ]);
    });
    test('no humanoid folk to press: the forces plunder instead', () => {
      expect(conquer({ race: 'Primal Beasts' })).toEqual([
        '⛓ Thorn would enslave Wendmeadow, but there are no humanoid folk here to press — the forces plunder instead.',
        "⚔ Evil looting: Thorn's forces plunder Wendmeadow — 2g seized immediately!",
      ]);
    });
  });
});
