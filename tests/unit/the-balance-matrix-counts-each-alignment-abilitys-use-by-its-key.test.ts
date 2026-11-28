// The count of each alignment ability's use by its key (tools/balance/the-count-of-each-alignment-abilitys-use-by-its-
// key.ts, B-17c): each of the 51 keys has one counting rule, and a map that leaves one out isn't the map's type. Each
// kind of rule counts for the realm it should and only for a realm of its ability's alignment: a line's kind, from the
// place the line names the realm; an order, from the telemetry's orders; a fact, from what the fact records; the state,
// from the world after the turn; the set-up, once a realm at the world's making. The battle factors with no line
// (righteous defence, the home of the wild) are the keys not countable yet. The count over the matrix's 60 games is in
// the pull request.
// Level 1 (unit): pure functions on made-up turns; no game is played.
import { describe, expect, test } from 'vitest';
import type { AlignmentAbilitySlug } from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import {
  countATurn,
  countTheSetUp,
  HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED,
  noUsesYet,
  THE_KEYS_NOT_COUNTABLE_YET,
  type ALineAsTheCountReadsIt,
  type ATurnAsTheCountReadsIt,
  type HowAnAbilitysUseIsCounted,
  type TheWorldAsTheCountReadsIt,
} from '../../tools/balance/the-count-of-each-alignment-abilitys-use-by-its-key.ts';

// A map that leaves a key out is not the map's type: this compiles only while that holds.
type TheMapLessOneKey = Omit<typeof HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED, 'consecrate'>;
type IsTheMapsType<M> = M extends Record<AlignmentAbilitySlug, HowAnAbilitysUseIsCounted> ? true : false;
const aMapLessOneKeyIsNotTheMapsType: IsTheMapsType<TheMapLessOneKey> = false;
const theWholeMapIsTheMapsType: IsTheMapsType<typeof HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED> = true;

// Realm 0 Divine, 1 Evil, 2 Undead, 3 Neutral.
const WORLD: TheWorldAsTheCountReadsIt = {
  players: [{ alignment: 'Divine' }, { alignment: 'Evil' }, { alignment: 'Undead' }, { alignment: 'Neutral' }],
  characters: [
    { id: 10, player: 0, alive: true, alignment: 'Divine', skills: {}, armies: [] },
    { id: 11, player: 1, alive: true, alignment: 'Undead', skills: { druid: 0 }, armies: [] },
    { id: 12, player: 2, alive: true, alignment: 'Undead', skills: {}, armies: [] },
  ],
  relations: {},
  world: { provinces: [] },
};
const aLine = (line: Partial<ALineAsTheCountReadsIt>): ALineAsTheCountReadsIt => ({
  kind: null,
  actor: null,
  targets: [],
  charIds: null,
  ...line,
});
const aTurn = (turn: Partial<ATurnAsTheCountReadsIt>): ATurnAsTheCountReadsIt => ({
  before: WORLD,
  after: WORLD,
  lines: [],
  orders: {},
  ...turn,
});
const theUsesOf = (key: AlignmentAbilitySlug, turn: ATurnAsTheCountReadsIt) => {
  const uses = noUsesYet();
  countATurn(turn, uses);
  return uses.get(key);
};

describe('the map', () => {
  test('a key left out is not the map type; the whole map is', () => {
    expect(aMapLessOneKeyIsNotTheMapsType).toBe(false);
    expect(theWholeMapIsTheMapsType).toBe(true);
  });
  test('only the battle factors with no line are not countable yet: 49 of the 51 keys are counted', () => {
    expect(Object.keys(HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED)).toHaveLength(51);
    expect(THE_KEYS_NOT_COUNTABLE_YET).toEqual(['righteous-defence', 'home-of-the-wild']);
  });
});

describe('each kind of rule', () => {
  test("a line's kind: the defender's zeal for the realm named second, a realm of the alignment only", () => {
    const zeal = aLine({ kind: "the defender's forces fight with fanatical zeal", actor: 1, targets: [1, 0] });
    expect(theUsesOf('zeal-of-a-divine-realm', aTurn({ lines: [zeal, zeal] })), 'Divine zeal').toEqual({ 0: 2 });
    expect(theUsesOf('zeal-of-an-evil-realm', aTurn({ lines: [zeal] })), 'the attacker is not the defender').toEqual({});
  });
  test('an order: each phase a hero of the realm gives it', () => {
    const orders = {
      0: { chars: { 10: { ph: [{ a: 'consecrate' }, { a: 'move' }, { a: 'consecrate' }] } } },
      1: { chars: { 11: { ph: [{ a: 'consecrate' }] } } },
    };
    expect(theUsesOf('consecrate', aTurn({ orders })), 'a Divine realm consecrates twice').toEqual({ 0: 2 });
  });
  test('a fact: the realm that declares war without warning, and the gold a tax line names', () => {
    const war = aLine({
      kind: 'an Evil or Undead realm declares war without warning',
      fact: {
        kind: 'an Evil or Undead realm declares war without warning',
        declarer: { realmName: 'Ashmarch', seat: 2 },
        foe: { realmName: 'Brightvale', seat: 0 },
        undead: true,
      },
      targets: [2, 0],
    });
    expect(theUsesOf('war-without-warning-of-an-undead-realm', aTurn({ lines: [war] })), 'the declarer').toEqual({ 2: 1 });
    expect(theUsesOf('war-without-warning-of-an-evil-realm', aTurn({ lines: [war] })), 'not Evil').toEqual({});
    const tax = (neutralTrade: number) =>
      aLine({
        kind: 'a realm collects its taxes',
        fact: {
          kind: 'a realm collects its taxes',
          realmName: 'Greywater',
          collected: 12,
          taxationRecords: 0,
          merchantsLedger: 0,
          neutralTrade,
          guildsInterest: 0,
          consecratedGround: 0,
          titlePerks: [],
          thiefNetwork: 0,
        },
        actor: 3,
        targets: [3],
      });
    expect(theUsesOf('neutral-trade', aTurn({ lines: [tax(2), tax(0)] })), 'a turn with trade').toEqual({ 3: 1 });
  });
  test("a fact by the hero's own alignment: an Undead hero of an Evil realm in a duel", () => {
    const duel = aLine({
      kind: 'a personal duel before the battle begins',
      fact: { kind: 'a personal duel before the battle begins', challengerName: 'Morvane', challengedName: 'Aldric' },
      actor: 1,
      targets: [1, 0],
      charIds: [11, 10],
    });
    expect(theUsesOf('an-undead-hero-is-undead-in-personal-combat', aTurn({ lines: [duel] })), 'realm 1').toEqual({
      1: 1,
    });
  });
  test('the state: an alliance broken into war, and the graves kept on Undead land', () => {
    const before = { ...WORLD, relations: { '1-3': 'allied', '0-2': 'allied' } };
    const after = {
      ...WORLD,
      relations: { '1-3': 'enemy', '0-2': 'neutral' },
      world: { provinces: [{ owner: 2, battleGraves: [{}] }, { owner: 2, battleGraves: [] }, { owner: 1 }] },
    };
    expect(theUsesOf('a-broken-alliance-means-war-for-an-evil-realm', aTurn({ before, after })), 'Evil').toEqual({
      1: 1,
    });
    expect(theUsesOf('a-broken-alliance-means-war-for-an-undead-realm', aTurn({ before, after })), 'Undead').toEqual(
      {},
    );
    expect(theUsesOf('graves-keep-on-undead-land', aTurn({ before, after })), 'one province').toEqual({ 2: 1 });
  });
  test('the set-up: once for each realm of its alignment at the making, and never in a turn', () => {
    const uses = noUsesYet();
    countTheSetUp(WORLD, uses);
    expect(uses.get('one-undead-realm-a-game'), 'the Undead realm').toEqual({ 2: 1 });
    expect(uses.get('a-pagan-king-starts-with-explorer'), 'no Pagan realm').toEqual({});
    expect(theUsesOf('one-undead-realm-a-game', aTurn({})), 'not in a turn').toEqual({});
  });
});
