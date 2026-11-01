// A battle's losses tally is written from the facts of its lines (plan P1-12d35: P1-12d's Decisions of 2026-11-01,
// Decision 2): the views put "⚰ Losses — **<side>**: …" where the battle's casualty lists begin
// (theWordsOfABattlesLossesTally, src/views/prose/the-words-of-a-battles-losses-tally.ts, called by theTurnsLinesInWords).
// Each case is a staged battle filed by emitBattle and written by the words pass, so it reads the tally line the GM's
// log stores; the expected tallies are the ones the tally gave before (tests/battle-faced-lines.test.js and
// tests/unit/the-battle-fate-and-tally-lines-no-matrix-game-reaches-keep-their-values.test.ts held them), and each case
// but the last passes on the code before this row too.
// - each company credited to the side whose casualty list's header names its owner (not the side of the company its
//   clause names), else to the side whose list it follows; a fate before the first list not counted;
// - each side's units from its force drawn up for battle, phantoms left out; a force with no units gives no total;
// - each company's type found on its side's force: its own where its line names its type and the force lists it, else
//   that of the force's company of its name (a company named by its name alone), else "unit"; an empty type "unit";
// - a whale cohort's breach counted against the side whose hull sinks, with the hull's type;
// - a beaten guard's companies: one that loses heart demoted, one that disbands disbanded, the others not counted;
// - question 37's two forms as they are today: a company that rises again by its Regenerating Hide counted lost, and a
//   company cut down with no escape, its line naming no owner, credited to the list it follows (and its type looked
//   for by its name on that side's force);
// - a battle with no casualty list and no breach has no tally; a line with no fact is read as nothing (the tally
//   called directly: no battle files one).
// Level 1 (unit): emitBattle and the words pass on a context made in the test, with the facts staged; nothing else of
// the turn runs. Not lower: the tally is a value the code works out from records, which a syntax tree can't evaluate.
// Whole games (the balance matrix and every realm's report, both sets) prove the same tallies in play.
import '../lib/the-whole-engine.ts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTurnContext, type TurnContext } from '../../src/engine/turn/context.ts';
import { emitBattle } from '../../src/engine/battle/battle-report-lines-and-force-markers.ts';
import type {
  AForceDrawnUpForBattle,
  ASideOfABattle,
  AUnitAsALineNamesIt,
  TheDefendersOfAProvince,
  TheFactOfABattlesLine,
  TheOwnerOfABattlesUnits,
  WhomAUnitFaced,
} from '../../src/engine/battle/the-facts-a-battles-lines-record.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { theTurnsLinesInWords } from '../../src/views/prose/the-words-of-each-line.ts';
import { theWordsOfABattlesLossesTally } from '../../src/views/prose/the-words-of-a-battles-losses-tally.ts';
import type { Province } from '../../src/schemas/saved-game-state.ts';

// emit echoes each line on the console: quiet while the tests write lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});

/** Two realms (0 Red, 1 Blue) and their heroes Aldric (7) and Gorbash (8), in the middle of Summer (phase 1). */
function newContext(): TurnContext {
  const tc = createTurnContext(
    {
      turn: 3,
      players: [
        { name: 'Red', color: '#c33' },
        { name: 'Blue', color: '#33c' },
      ],
      characters: [
        { id: 7, name: 'Aldric', player: 0, alive: true },
        { id: 8, name: 'Gorbash', player: 1, alive: true },
      ],
      world: { provinces: [] },
    },
    [],
    3,
  ) as unknown as TurnContext;
  tc._logCtx = { charId: 7, phase: 1 };
  tc._currentPhase = 1;
  tc._afterPhases = false;
  tc._battleSeq = 0;
  return tc;
}
const THORNFIELD = { id: 4, name: 'Thornfield' } as unknown as Province;
const THE_SUMMARY = { kind: 'the battle for a province begins', provName: 'Thornfield' } as const;

/** A battle of these lines, filed and written in words: its lines' words and its tally (null: none). */
function aBattleOf(lines: readonly TheFactOfABattlesLine[]): { words: (string | null)[]; tally: string | null } {
  const tc = newContext();
  const narrative: NarrativeLine[] = [...lines];
  emitBattle(tc, { narrative, summaryText: THE_SUMMARY }, THORNFIELD, 1, [0, 1], { actor: 0, charIds: [7, 8] });
  const { gmLog } = theTurnsLinesInWords(tc.turnLog);
  return {
    words: gmLog.filter((l) => l.bTier === 'k' || l.bTier === 'd').map((l) => l.text),
    tally: gmLog.find((l) => l.bTier === 't')?.text ?? null,
  };
}
const theTallyOf = (lines: readonly TheFactOfABattlesLine[]) => aBattleOf(lines).tally;

const side = (heroName: string): ASideOfABattle => ({ heroName, leaderless: false });
/** A side's force drawn up for battle: its hero, its role, and its units (type, name, and whether a phantom). */
function aForce(
  heroName: string,
  role: string,
  units: readonly (readonly [type: string, unitName: string, phantom?: boolean])[],
): AForceDrawnUpForBattle {
  return {
    kind: 'a force drawn up for battle',
    theForce: { kind: 'a hero, with the realm he serves', heroName, servesARealm: false, realmName: undefined },
    fallenCommandersName: null,
    color: null,
    neutral: false,
    guard: false,
    role,
    howItComesOn: null,
    armies: units.map(([type, unitName, phantom]) => ({
      type,
      quality: 'Average',
      unitName,
      race: null,
      phantom: phantom ?? false,
      skeletal: false,
      wildHunt: false,
      wildHuntUntil: null,
    })),
  };
}
const theAttackersList = (heroName: string): TheFactOfABattlesLine => ({
  kind: "the attacker's casualties begin",
  atkName: side(heroName),
});
const theDefendersList = (defName: ASideOfABattle | TheDefendersOfAProvince): TheFactOfABattlesLine => ({
  kind: "the defender's casualties begin",
  defName,
});
/** A unit as its line names it: with its quality, its owner (none: null), its name and type. */
const aUnit = (
  owner: TheOwnerOfABattlesUnits | null,
  unitName: string,
  type: string,
  kind: AUnitAsALineNamesIt['kind'] = 'a unit named with its quality',
): AUnitAsALineNamesIt => ({ kind, owner, unitName, type, quality: 'Average' });
const facing = (theEnemyUnit: AUnitAsALineNamesIt): WhomAUnitFaced => ({
  kind: 'an enemy unit',
  how: 'faces',
  theEnemyUnit,
});
const dies = (theUnit: AUnitAsALineNamesIt, whomItFaced: WhomAUnitFaced | null = null): TheFactOfABattlesLine => ({
  kind: "a unit's fate in the battle",
  itsSideWon: false,
  fate: 'dies',
  theUnit,
  whomItFaced,
  inTheRout: false,
  itsBonesCrumble: false,
});
const isCutDownWithNoEscape = (theUnit: AUnitAsALineNamesIt): TheFactOfABattlesLine => ({
  kind: "a unit's fate in the battle",
  itsSideWon: false,
  fate: 'is cut down with no escape',
  inTheRout: false,
  theUnit,
});
const ofAldric = (unitName: string, type: string) => aUnit(side('Aldric'), unitName, type);

describe("a battle's losses tally is written from the facts of its lines", () => {
  test('each company is credited to its own side, not to the side of the company its clause names', () => {
    const aldric = side('Aldric Ironhand'),
      gorbash = side('Gorbash');
    const { words, tally } = aBattleOf([
      aForce('Aldric Ironhand', 'attacker', [
        ['Shieldwall Levies', 'Levy A1'],
        ['Gnomish Gyrocopters', 'the Red Hand'],
        ['Yeoman Longbows', 'Bow A1'],
      ]),
      aForce('Gorbash', 'defender', [
        ['Shieldwall Levies', 'Levy B1'],
        ['Goblin Horde', 'Gob B1'],
        ['Gnomish Gyrocopters', 'Gyro B1'],
      ]),
      theAttackersList('Aldric Ironhand'),
      {
        kind: "a unit's fate in the battle",
        itsSideWon: true,
        fate: 'dies',
        theUnit: aUnit(aldric, 'Levy A1', 'Shieldwall Levies'),
        whomItFaced: facing(aUnit(gorbash, 'Levy B1', 'Shieldwall Levies', 'a unit named without its quality')),
        inTheRout: false,
        itsBonesCrumble: false,
      },
      {
        kind: "a unit's fate in the battle",
        itsSideWon: true,
        fate: 'rises a tier',
        theUnit: aUnit(aldric, 'the Red Hand', 'Gnomish Gyrocopters'),
        whomItFaced: { kind: 'it fought from the air' },
        hardenedByVictory: false,
        itsQualityAfter: 'Veteran',
      },
      { kind: "a side's other forces survive the engagement", someUnitsFateIsToldAbove: true },
      theDefendersList(gorbash),
      {
        kind: "a unit's fate in the battle",
        itsSideWon: false,
        fate: 'dies',
        theUnit: aUnit(gorbash, 'Gob B1', 'Goblin Horde'),
        whomItFaced: facing(aUnit(aldric, 'the Red Hand', 'Gnomish Gyrocopters', 'a unit named without its quality')),
        inTheRout: true,
        itsBonesCrumble: false,
      },
      {
        kind: "a unit's fate in the battle",
        itsSideWon: false,
        fate: 'has had enough and disbands',
        theUnitsOwner: gorbash,
        unitName: 'Levy B1',
        unitType: 'Shieldwall Levies',
        whomItFaced: facing(aUnit(aldric, 'Levy A1', 'Shieldwall Levies', 'a unit named without its quality')),
      },
      {
        kind: "a unit's fate in the battle",
        itsSideWon: false,
        fate: 'rises a tier',
        theUnit: aUnit(gorbash, 'Gyro B1', 'Gnomish Gyrocopters'),
        whomItFaced: { kind: 'it fought from the air' },
        hardenedByVictory: false,
        itsQualityAfter: 'Veteran',
      },
    ]);
    // the lines the tally was read from before (tests/battle-faced-lines.test.js), word for word
    expect(words.slice(2)).toEqual([
      "⚔ **Aldric Ironhand's forces** (attacker):",
      "— Aldric Ironhand's Levy A1 (Shieldwall Levies, Average), facing Gorbash's Levy B1, were destroyed in the fighting.",
      "— the Red Hand (Aldric Ironhand's Gnomish Gyrocopters, Average), fighting from the air, earn promotion to Veteran!",
      '— All other forces survive the engagement.',
      "🛡 **Gorbash's forces** (defender):",
      "— Gorbash's Gob B1 (Goblin Horde, Average), facing the Red Hand (Aldric Ironhand's Gnomish Gyrocopters), were annihilated in the rout!",
      "— Gorbash's Levy B1 (Shieldwall Levies), facing Aldric Ironhand's Levy A1, have had enough — the survivors slip away to their villages and the unit disbands for good.",
      "— Despite defeat, Gorbash's Gyro B1 (Gnomish Gyrocopters, Average), fighting from the air, improved to Veteran!",
    ]);
    expect(tally).toBe(
      '⚰ Losses — **Aldric Ironhand**: 1 of 3 units lost (Shieldwall Levies), 1 promoted · **Gorbash**: 1 of 3 units lost (Goblin Horde), 1 disbanded (Shieldwall Levies), 1 promoted.',
    );
  });

  test('a fate before the first casualty list is not counted; after one, it goes to the list it follows when no header names its owner', () => {
    const aHordeDies = dies(ofAldric('Goblin Horde', 'Goblin Horde'));
    expect(theTallyOf([aHordeDies, theDefendersList(side('Gorbash')), aHordeDies])).toBe(
      '⚰ Losses — **Gorbash**: 1 unit lost (unit).',
    );
  });

  test('two sides whose names share a beginning: each company goes to the side whose header names its owner', () => {
    expect(
      theTallyOf([
        aForce('Al', 'attacker', [['Shieldwall Levies', 'Levy A']]),
        aForce('Alan', 'defender', [['Goblin Horde', 'Gob B']]),
        theAttackersList('Al'),
        dies(aUnit(side('Alan'), 'Gob B', 'Goblin Horde')),
        theDefendersList(side('Alan')),
        dies(aUnit(side('Al'), 'Levy A', 'Shieldwall Levies')),
      ]),
    ).toBe('⚰ Losses — **Al**: 1 of 1 unit lost (Shieldwall Levies) · **Alan**: 1 of 1 unit lost (Goblin Horde).');
  });

  test("a company named with its name first is credited by its owner; the defenders' label must be the header's to the letter", () => {
    const theDefenders = (capitalised: boolean): TheDefendersOfAProvince => ({
      kind: 'the defenders of a province with no guard to lead them',
      provName: 'Thornfield',
      capitalised,
    });
    expect(
      theTallyOf([
        aForce('Aldric', 'attacker', [['Free Lances', 'the Red Hand']]),
        theAttackersList('Aldric'),
        theDefendersList(theDefenders(false)),
        dies(aUnit(side('Aldric'), 'the Red Hand', 'Free Lances')),
        dies(aUnit(theDefenders(true), 'Ford Watch', 'Men-at-Arms')),
      ]),
    ).toBe(
      '⚰ Losses — **Aldric**: 1 of 1 unit lost (Free Lances) · **the defenders of Thornfield**: 1 unit lost (unit).',
    );
  });

  test('a company named by its name alone goes to the list it follows, whatever owner its record holds', () => {
    expect(
      theTallyOf([
        aForce('Aldric', 'attacker', [['Shieldwall Levies', 'the Grey Legion']]),
        theAttackersList('Aldric'),
        theDefendersList(side('Gorbash')),
        isCutDownWithNoEscape(
          aUnit(side('Aldric'), 'the Grey Legion', 'Shieldwall Levies', 'a unit named by its name or type alone'),
        ),
      ]),
    ).toBe('⚰ Losses — **Aldric**: no units lost · **Gorbash**: 1 unit lost (unit).');
  });

  test('a company whose line names no owner goes to the list it follows, as one disbanding with none named', () => {
    expect(
      theTallyOf([
        aForce('Gorbash', 'defender', [['Goblin Horde', 'Gob']]),
        theAttackersList('Aldric'),
        theDefendersList(side('Gorbash')),
        dies(aUnit(null, 'Gob', 'Goblin Horde')),
        {
          kind: "a unit's fate in the battle",
          itsSideWon: false,
          fate: 'has had enough and disbands',
          theUnitsOwner: null,
          unitName: 'Gob',
          unitType: 'Goblin Horde',
          whomItFaced: null,
        },
      ]),
    ).toBe(
      '⚰ Losses — **Aldric**: no units lost · **Gorbash**: 1 of 1 unit lost (Goblin Horde), 1 disbanded (Goblin Horde).',
    );
  });

  test('a force with no units gives no total, and one whose role is neither side is not counted', () => {
    const aLevyDies = dies(ofAldric('Shieldwall Levies', 'Shieldwall Levies'));
    expect(theTallyOf([aForce('Aldric', 'attacker', []), theAttackersList('Aldric'), aLevyDies])).toBe(
      '⚰ Losses — **Aldric**: 1 unit lost (unit).',
    );
    expect(
      theTallyOf([aForce('Aldric', '', [['Shieldwall Levies', 'Levy']]), theAttackersList('Aldric'), aLevyDies]),
    ).toBe('⚰ Losses — **Aldric**: 1 unit lost (unit).');
  });

  test("a phantom is left out of its side's force", () => {
    expect(
      theTallyOf([
        aForce('Aldric', 'attacker', [
          ['Eagle Riders', 'Sky Host', true],
          ['Shieldwall Levies', 'Levy'],
        ]),
        theAttackersList('Aldric'),
        dies(ofAldric('Levy', 'Shieldwall Levies')),
        {
          kind: "a unit's fate in the battle",
          itsSideWon: false,
          fate: 'has had enough and disbands',
          theUnitsOwner: side('Aldric'),
          unitName: 'Levy',
          unitType: 'Shieldwall Levies',
          whomItFaced: null,
        },
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 1 unit lost (Shieldwall Levies), 1 disbanded (Shieldwall Levies).');
  });

  test('a company counts its own type when its side\'s force lists it, else "unit"; an empty type is "unit"', () => {
    expect(
      theTallyOf([
        aForce('Aldric', 'attacker', [
          ['Eagle', 'Talon'],
          ['Eagle Riders', 'Sky Host'],
        ]),
        theAttackersList('Aldric'),
        dies(ofAldric('Sky Host', 'Eagle Riders')),
        dies(ofAldric('Bone Host', 'Skeletal Legion')),
      ]),
    ).toBe('⚰ Losses — **Aldric**: 2 of 2 units lost (Eagle Riders, unit).');
    // named by its name alone, as a company cut down with no escape is
    const byItsNameAlone = (unitName: string, type: string) =>
      isCutDownWithNoEscape(aUnit(side('Aldric'), unitName, type, 'a unit named by its name or type alone'));
    expect(
      theTallyOf([
        aForce('Aldric', 'attacker', [
          ['Eagle Riders', 'the Red Hand'],
          ['Warg Riders', 'the Red'],
          ['Free Lances', 'Free Lances'],
        ]),
        theAttackersList('Aldric'),
        byItsNameAlone('the Red Hand', 'Eagle Riders'),
        byItsNameAlone('the Red', 'Warg Riders'),
        byItsNameAlone('nobody we know', 'Sky Galleons'),
      ]),
    ).toBe('⚰ Losses — **Aldric**: 3 of 3 units lost (Eagle Riders, Warg Riders, unit).');
    expect(
      theTallyOf([
        aForce('Aldric', 'attacker', [['', 'Levy']]),
        theAttackersList('Aldric'),
        dies(ofAldric('Levy', '')),
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 1 unit lost (unit).');
    // a company with no name, of a type its side's force doesn't list
    expect(
      theTallyOf([
        aForce('Aldric', 'attacker', [['Shieldwall Levies', 'Levy']]),
        theAttackersList('Aldric'),
        isCutDownWithNoEscape(aUnit(side('Aldric'), '', 'Skeletal Legion', 'a unit named by its name or type alone')),
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 1 unit lost (unit).');
  });

  test("a whale cohort's breach is counted against the side whose hull it sinks, with the hull's type", () => {
    const theForces = [
      aForce('Aldric', 'attacker', [['Galleon Fleet', 'the Swan']]),
      aForce('Gorbash', 'defender', [['Leviathan Pods', 'Pod']]),
    ];
    const aBreach = (sideName: string, theSideWhoseShipSinks: 'attacker' | 'defender'): TheFactOfABattlesLine => ({
      kind: "a side's whale cohort sinks an enemy ship",
      sideName,
      targetUnitName: 'the Swan',
      targetUnitType: 'Galleon Fleet',
      theSideWhoseShipSinks,
    });
    expect(theTallyOf([...theForces, aBreach('Gorbash', 'attacker'), theAttackersList('Aldric')])).toBe(
      '⚰ Losses — **Aldric**: 1 of 1 unit lost (Galleon Fleet).',
    );
    expect(theTallyOf([...theForces, aBreach('Aldric', 'defender'), theAttackersList('Aldric')])).toBe(
      '⚰ Losses — **Aldric**: no units lost · **defender**: 1 of 1 unit lost (unit).',
    );
    // against a province's defenders: the defender's hull, its type on the defenders' force
    expect(
      theTallyOf([
        aForce('Aldric', 'attacker', [['Whale Cohort', 'Pod']]),
        aForce('Gorbash', 'defender', [['Galleon Fleet', 'the Swan']]),
        {
          kind: 'a whale cohort sinks a defending ship before a shot is fired',
          targetUnitName: 'the Swan',
          targetUnitType: 'Galleon Fleet',
        },
        theAttackersList('Aldric'),
      ]),
    ).toBe('⚰ Losses — **Aldric**: no units lost · **defender**: 1 of 1 unit lost (Galleon Fleet).');
  });

  test("a beaten guard's companies: one that loses heart is demoted, one that disbands disbanded, the others not counted", () => {
    const ulric: TheDefendersOfAProvince = { kind: 'the defenders led by their guard', guardName: 'Ulric' };
    const hisLevy = aUnit(ulric, 'Levy', 'Shieldwall Levies');
    expect(
      theTallyOf([
        aForce('Ulric', 'defender', [['Shieldwall Levies', 'Levy']]),
        theDefendersList(ulric),
        {
          kind: "a beaten guard's surviving unit's fate",
          fate: 'loses heart and falls a tier',
          theUnit: hisLevy,
          itsQualityAfter: 'Green',
          victorsHost: 'Aldric',
          theGuard: ulric,
        },
        {
          kind: "a beaten guard's surviving unit's fate",
          fate: 'has had enough and disbands',
          theGuard: ulric,
          unitName: 'Levy',
          unitType: 'Shieldwall Levies',
        },
        {
          kind: "a beaten guard's surviving unit's fate",
          fate: 'holds its ground unbroken',
          theUnit: hisLevy,
          victorsHost: null,
          theGuard: ulric,
        },
        {
          kind: "a beaten guard's surviving unit's fate",
          fate: 'breaks ranks and flees as mercenaries',
          theUnit: hisLevy,
          victorsHost: 'Aldric',
          provName: 'Thornfield',
        },
      ]),
    ).toBe('⚰ Losses — **Ulric**: no units lost, 1 disbanded (Shieldwall Levies), 1 demoted.');
  });

  test('question 37, as it is today: the Regenerating Hide counted lost, and a company its line names no owner of counted on the list it follows', () => {
    expect(
      theTallyOf([
        aForce('Aldric', 'attacker', [['Troll Brutes', 'Grak']]),
        theAttackersList('Aldric'),
        {
          kind: "a unit's fate in the battle",
          itsSideWon: false,
          fate: 'is cut down and rises again by its regenerating hide',
          theUnit: ofAldric('Grak', 'Troll Brutes'),
          whomItFaced: null,
        },
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 1 unit lost (Troll Brutes).');
    expect(
      theTallyOf([
        aForce('Aldric', 'attacker', [['Shieldwall Levies', 'the Grey Legion']]),
        aForce('Gorbash', 'defender', [['Shieldwall Levies', 'Levy B']]),
        theAttackersList('Aldric'),
        theDefendersList(side('Gorbash')),
        isCutDownWithNoEscape(
          aUnit(null, 'the Grey Legion', 'Shieldwall Levies', 'a unit named by its name or type alone'),
        ),
      ]),
    ).toBe('⚰ Losses — **Aldric**: no units lost · **Gorbash**: 1 of 1 unit lost (unit).');
  });

  test('a battle with no casualty list and no breach has no tally; a line with no fact is read as nothing', () => {
    expect(
      theTallyOf([aForce('Aldric', 'attacker', [['Goblin Horde', 'Gob']]), dies(ofAldric('Gob', 'Goblin Horde'))]),
    ).toBeNull();
    expect(theWordsOfABattlesLossesTally([])).toBeNull();
    expect(
      theWordsOfABattlesLossesTally([
        undefined,
        aForce('Aldric', 'attacker', [['Goblin Horde', 'Gob']]),
        theAttackersList('Aldric'),
        undefined,
        dies(ofAldric('Gob', 'Goblin Horde')),
      ]),
    ).toBe('⚰ Losses — **Aldric**: 1 of 1 unit lost (Goblin Horde).');
  });
});
