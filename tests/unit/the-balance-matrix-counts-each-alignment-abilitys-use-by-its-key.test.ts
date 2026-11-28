// The count of each alignment ability's use by its key (tools/balance/the-count-of-each-alignment-abilitys-use-by-its-
// key.ts, B-17c): each of the 51 keys has one counting rule, and a map that leaves one out isn't the map's type. Each
// kind of rule counts for the realm it should and only for a realm of its ability's alignment: a line's kind, from the
// place the line names the realm; an order, from the telemetry's orders; a fact, from what the fact records; the state,
// from the world after the turn; the set-up, once a realm at the world's making. The battle factors with no line
// (righteous defence, the home of the wild) are the keys not countable yet. The count over the matrix's 60 games is in
// the pull request.
// What a played turn hands the count (every-realm.ts's theTurnAsTheCountReadsIt) is read as the count reads it.
// Level 1 (unit): pure functions on made-up turns; no game is played.
import { describe, expect, test } from 'vitest';
import type { AlignmentAbilitySlug } from '../../src/content/alignment-abilities-their-keys-names-numbers-and-words.ts';
import {
  countATurn,
  countTheSetUp,
  HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED,
  noUsesYet,
  theTurnAsTheCountReadsIt,
  THE_KEYS_COUNTED_BY_A_STAND_IN,
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

// Realm 0 Divine, 1 Evil, 2 Undead, 3 Neutral, 4 Good, 5 Pagan.
const WORLD: TheWorldAsTheCountReadsIt = {
  players: [
    { alignment: 'Divine' },
    { alignment: 'Evil' },
    { alignment: 'Undead' },
    { alignment: 'Neutral' },
    { alignment: 'Good' },
    { alignment: 'Pagan' },
  ],
  characters: [
    { id: 10, name: 'Aldric', player: 0, alive: true, alignment: 'Divine', skills: {}, armies: [] },
    { id: 11, name: 'Morvane', player: 1, alive: true, alignment: 'Undead', skills: { druid: 0 }, armies: [] },
    {
      id: 12,
      name: 'Sallow',
      player: 2,
      alive: true,
      alignment: 'Undead',
      skills: {},
      armies: [
        { type: 'Shieldwall Levies', race: 'Undead' },
        { type: 'Shieldwall Levies', race: 'Human' },
      ],
    },
    { id: 13, name: 'Quill', player: 3, alive: true, alignment: 'Neutral', skills: { sage: 2 }, armies: [] },
    { id: 14, name: 'Dunne', player: 3, alive: true, alignment: 'Neutral', skills: { sage: 0 }, armies: [] },
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
  test('two battle factors are not countable yet and three are stand-ins: 46 of the 51 keys count a use', () => {
    expect(Object.keys(HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED)).toHaveLength(51);
    expect(THE_KEYS_NOT_COUNTABLE_YET).toEqual(['righteous-defence', 'home-of-the-wild']);
    expect(THE_KEYS_COUNTED_BY_A_STAND_IN).toEqual([
      'creatures-follow-without-a-druid',
      'monsters-follow-without-a-druid',
      'the-risen-dead-follow-only-the-undead',
    ]);
  });
  test("where each line rule reads its realm: each kind's place, as the engine names the realm in it", () => {
    const places = Object.fromEntries(
      Object.entries(HOW_EACH_ALIGNMENT_ABILITYS_USE_IS_COUNTED).flatMap(
        ([key, rule]: [string, HowAnAbilitysUseIsCounted]) =>
          rule.by === "a line's kind" ? [[key, rule.lines.map((l) => `${l.kind}: ${l.realm}`)]] : [],
      ),
    );
    const zeal = [
      "the attacker's forces fight with fanatical zeal: its first target",
      "the attacker's troops fight with fanatical zeal: its first target",
      "the defender's forces fight with fanatical zeal: its second target",
      'the defenders fight with fanatical zeal on consecrated ground: its second target',
    ];
    expect(places).toEqual({
      'zeal-of-a-divine-realm': zeal,
      'zeal-of-a-good-realm': zeal,
      'zeal-of-a-druidic-realm': zeal,
      'zeal-of-a-neutral-realm': zeal,
      'zeal-of-a-pagan-realm': zeal,
      'zeal-of-an-evil-realm': zeal,
      'zeal-of-an-undead-realm': zeal,
      'consecrated-ground-doubles-a-defenders-zeal': [
        'the defenders fight with fanatical zeal on consecrated ground: its second target',
      ],
      'savage-fury': [
        "the attacker's monsters are driven to savage fury: its first target",
        "a side's monsters are driven to savage fury: each realm it names",
      ],
      'skeletal-fervour': [
        "a side's skeletal legions fight with fanaticism under their undead king: each realm it names",
        "a side's skeletal legions know no fear: each realm it names",
      ],
      'consecrated-ground-weakens-an-unholy-attacker': [
        "the consecrated ground of the province weakens the attacker's host: its second target",
      ],
      'banner-of-fellowship': [
        "a contingent joins a hero's assault on a guarded province: its actor",
        'a contingent cannot link up in time against a guarded province: its actor',
        "a contingent joins a hero's assault on a rival's province: its actor",
        "a contingent misses the timing against a rival's province: its actor",
      ],
      'reign-of-fear': ['the province still cowers under a reign of fear: each realm it names'],
      'the-deathless-march': ["the loser's skeletal host stands its ground in a deathless march: each realm it names"],
      'the-neutral-mercenary-discount': ['a hero hires a mercenary band: its actor'],
      'the-divine-blessing': ['a province is blessed and warded: its actor'],
      'divine-grace': ['a Divine hero returns to life on the nearest consecrated ground: its actor'],
      'a-pagan-victors-blood-harvest': [
        'the blood harvest claims offerings from the fallen enemy units: each realm it names',
      ],
      'plunder-or-enslave': [
        "an Evil conqueror's forces plunder a province: its actor",
        'an Evil conqueror presses the beaten folk into the garrison in chains: its actor',
      ],
    });
  });
});

describe('each kind of rule', () => {
  test("a line's kind: the defender's zeal for the realm named second, a realm of the alignment only", () => {
    const zeal = aLine({ kind: "the defender's forces fight with fanatical zeal", actor: 1, targets: [1, 0] });
    expect(theUsesOf('zeal-of-a-divine-realm', aTurn({ lines: [zeal, zeal] })), 'Divine zeal').toEqual({ 0: 2 });
    expect(theUsesOf('zeal-of-an-evil-realm', aTurn({ lines: [zeal] })), "the Evil attacker's not counted").toEqual({});
  });
  test("a line's kind, each place: the attacker's savage fury, the Banner's roll, a blood harvest on either side", () => {
    const fury = aLine({ kind: "the attacker's monsters are driven to savage fury", actor: 1, targets: [1, 0] });
    expect(theUsesOf('savage-fury', aTurn({ lines: [fury] })), 'the Evil attacker').toEqual({ 1: 1 });
    const roll = aLine({
      kind: 'a contingent cannot link up in time against a guarded province',
      actor: 4,
      targets: [4],
    });
    expect(theUsesOf('banner-of-fellowship', aTurn({ lines: [roll] })), "the Good hero's roll").toEqual({ 4: 1 });
    const kind = 'the blood harvest claims offerings from the fallen enemy units';
    const asTheAttacker = aLine({ kind, actor: 5, targets: [5, 1] });
    const asTheDefender = aLine({ kind, actor: 1, targets: [1, 5] });
    expect(theUsesOf('a-pagan-victors-blood-harvest', aTurn({ lines: [asTheAttacker] })), 'attacking').toEqual({
      5: 1,
    });
    expect(theUsesOf('a-pagan-victors-blood-harvest', aTurn({ lines: [asTheDefender] })), 'defending').toEqual({
      5: 1,
    });
  });
  test("divine grace at the return only, and the Divine rest by its fact's mark", () => {
    const death = aLine({ kind: 'a fallen Divine monarch will rise again on holy ground', actor: 0, targets: [0] });
    const back = aLine({
      kind: 'a Divine hero returns to life on the nearest consecrated ground',
      actor: 0,
      targets: [0],
    });
    expect(theUsesOf('divine-grace', aTurn({ lines: [death, back] })), 'a king, once').toEqual({ 0: 1 });
    const rest = (isDivine: boolean) =>
      aLine({
        kind: 'a hero rests and recovers',
        fact: { kind: 'a hero rests and recovers', heroName: 'Aldric', healed: 6, hp: 12, maxHp: 15, isDivine },
        actor: 0,
        targets: [0],
      });
    expect(theUsesOf('the-divine-rest', aTurn({ lines: [rest(true), rest(false)] })), 'the doubled rest').toEqual({
      0: 1,
    });
  });
  test('an order: each phase a hero of the realm gives it', () => {
    const orders = {
      0: { chars: { 10: { ph: [{ a: 'consecrate' }, { a: 'move' }, { a: 'consecrate' }] } } },
      1: { chars: { 11: { ph: [{ a: 'consecrate' }] } } },
    };
    expect(theUsesOf('consecrate', aTurn({ orders })), 'a Divine realm consecrates twice').toEqual({ 0: 2 });
  });
  test("an order by a hero with the skill: the scholars' Research by a Sage", () => {
    const orders = { 3: { chars: { 13: { ph: [{ a: 'research' }] }, 14: { ph: [{ a: 'research' }] } } } };
    expect(theUsesOf('neutral-scholars', aTurn({ orders })), 'Sage 2, not Sage 0').toEqual({ 3: 1 });
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
    expect(theUsesOf('war-without-warning-of-an-undead-realm', aTurn({ lines: [war] })), 'the declarer').toEqual({
      2: 1,
    });
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
      charIds: [11, 10, 12],
    });
    expect(theUsesOf('an-undead-hero-is-undead-in-personal-combat', aTurn({ lines: [duel] })), 'realm 1').toEqual({
      1: 1,
    });
  });
  test('the state: an alliance broken into war (not a war declared from neutral), and the graves kept on Undead land', () => {
    const before = { ...WORLD, relations: { '1-3': 'allied', '0-2': 'allied', '1-2': 'neutral' } };
    const after = {
      ...WORLD,
      relations: { '1-3': 'enemy', '0-2': 'neutral', '1-2': 'enemy' },
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
  test('a stand-in from the state: the companies of the risen dead an Undead realm leads', () => {
    expect(theUsesOf('the-risen-dead-follow-only-the-undead', aTurn({})), 'one of two companies').toEqual({ 2: 1 });
  });
  test('the set-up: once for each realm of its alignment at the making, and never in a turn', () => {
    const uses = noUsesYet();
    countTheSetUp(WORLD, uses);
    expect(uses.get('one-undead-realm-a-game'), 'the Undead realm').toEqual({ 2: 1 });
    expect(uses.get('a-druidic-king-starts-with-druid'), 'no Druidic realm').toEqual({});
    expect(uses.get('consecrate'), 'an order is not counted at the making').toEqual({});
    expect(theUsesOf('one-undead-realm-a-game', aTurn({})), 'not in a turn').toEqual({});
  });
});

describe('what a played turn hands the count (every-realm.ts)', () => {
  test("its worlds, each line's kind from its fact and the realms it names, and the statistics' orders", () => {
    const fact = {
      kind: 'an Evil or Undead realm declares war without warning',
      declarer: { realmName: 'Ashmarch', seat: 2 },
      foe: { realmName: 'Brightvale', seat: 0 },
      undead: true,
    } as const;
    const turn = theTurnAsTheCountReadsIt({
      before: JSON.stringify(WORLD),
      after: JSON.stringify({ ...WORLD, relations: { '0-2': 'enemy' } }),
      events: [
        { line: { actor: null, targets: [2, 0], charIds: null }, fact },
        { line: { actor: 1, targets: [1], charIds: [11] } },
      ],
      statistics: { orders: { 2: { chars: { 12: { ph: [{ a: 'harvest_field' }] } } } } },
    });
    expect(turn.before, 'the world before').toEqual(WORLD);
    expect(turn.after.relations, 'the world after').toEqual({ '0-2': 'enemy' });
    expect(turn.lines, 'the lines').toEqual([
      { kind: fact.kind, fact, actor: null, targets: [2, 0], charIds: null },
      { kind: null, actor: 1, targets: [1], charIds: [11] },
    ]);
    const uses = noUsesYet();
    countATurn(turn, uses);
    expect(uses.get('war-without-warning-of-an-undead-realm'), 'the fact counted').toEqual({ 2: 1 });
    expect(uses.get('harvest-the-field'), "the statistics' orders counted").toEqual({ 2: 1 });
  });
});
