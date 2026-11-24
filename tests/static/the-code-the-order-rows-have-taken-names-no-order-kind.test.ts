// The code the order rows have taken names no order's kind (B-06, T7, the rules pulled out: Run 3b's hero orders):
// each function (or file's top level) the family's rows have taken holds no check of an order by its kind (a kind of
// OrderKind, the alignment orders' aside, or `'pursue'`): compared with an order's action, a `case` of a switch on
// one, a list of kinds, a default kind or an action assigned, or a value of the kinds' own table. It reads the order's
// row instead. Each row adds what it takes to TAKEN (B-06al the first; B-06ao processOrder, its switch gone for the
// registry). With them, the ratchet's two counts of those checks outside src/engine/rules/, in the engine and in the bots
// (tools/ratchet.ts's orderKindChecksInEngine and orderKindChecksInTheBots, by their helper
// orderKindChecksByFunction), so both only fall: the helper counts each check planted, and none of an order written
// (`action: 'move'`), a line's kind (`type: 'move'`), a skill handed to a call, a mixed list, or a comparison of another
// sense (a bot's role `'spy'`, a duel's stance `'challenge'`), a name being bound to an order's kind in its own
// function only.
//
// Level 0 (static): the files' syntax trees and the hero orders' rows as content writes them; nothing runs.
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { ROOT } from '../../tools/build.ts';
import {
  ALIGNMENT_ORDER_VOCABULARY,
  compare,
  ORDER_KIND_VOCABULARY,
  orderKindChecksByFunction,
  orderKindChecksInEngine,
  orderKindChecksInTheBots,
  readBaseline,
  THE_ORDER_KINDS_FILE,
  theCodeFiles,
} from '../../tools/ratchet.ts';
import { THE_HERO_ORDERS } from '../../src/content/the-hero-orders-their-keys-the-names-the-turn-reads-them-by-and-their-tiers.ts';

/** The top level of a file: what no function holds. */
const TOP = '(top)';
/** The phase's order (B-06am): the tiers and who must act first, the phase's intents, and the phase's stages. */
const THE_ORDER_TIERS_FILE =
  'src/engine/rules-on-plain-values/the-order-the-heroes-act-in-a-phase-and-who-must-act-first.ts';
const THE_PHASE_INTENTS_FILE = 'src/engine/turn/phase-intents-and-dependency-ordering.ts';
const THE_PHASE_STAGES_FILE = 'src/engine/turn/phase-stages-start-intents-and-reactions-orders-in-two-tiers-and-end.ts';
/** The dispatch (B-06an the checks before an order, B-06ao the registry it hands an order to). */
const THE_ORDER_DISPATCH_FILE = 'src/engine/orders/order-dispatch-the-checks-before-a-hero-order-and-the-switch.ts';
const THE_ORDER_RESOLVERS_REGISTRY_FILE =
  'src/engine/orders/the-registry-of-the-hero-orders-each-kinds-resolver-keyed-by-its-row.ts';

/** Each function (or a file's top level) the order rows have taken, by its file, from the row that took it: each row
 *  adds what it takes. */
const TAKEN: readonly (readonly [file: string, fn: string, row: string])[] = [
  [THE_ORDER_KINDS_FILE, TOP, "B-06al, the turn's names for the orders: PHASE_ACTION_MAP"],
  [THE_ORDER_KINDS_FILE, 'normaliseAction', "B-06al, a blank or unknown order's kind"],
  [THE_ORDER_TIERS_FILE, 'theTierAnOrderActsIn', "B-06am, the tier an order acts in: its row's"],
  [THE_ORDER_TIERS_FILE, 'theHeroesWhoMustActFirstInAPhase', "B-06am, who must act first: the rows' keys"],
  [THE_ORDER_TIERS_FILE, 'tgtArrivingHere', "B-06am, a comrade marching in: the Move row's key"],
  [THE_PHASE_INTENTS_FILE, 'buildPhaseIntents', "B-06am, a march's destination: the Move row's key"],
  [THE_PHASE_INTENTS_FILE, 'isHostileInvasion', "B-06am, an invasion is a Move: its row's key"],
  [THE_PHASE_INTENTS_FILE, 'phaseDependencies', "B-06am, the hero a hand-over goes to: the rows' keys"],
  [THE_PHASE_INTENTS_FILE, 'applyMoveInterlocks', "B-06am, a pinned march: the Move row's key"],
  [THE_PHASE_STAGES_FILE, 'pinAndReactToPhaseIntents', "B-06am, the battle lock and a Defend: the tier, the row's key"],
  [
    THE_PHASE_STAGES_FILE,
    'resolvePhaseOrdersInTwoTiersAroundTheDefendStep',
    "B-06am, the Defend step's flush: the tier",
  ],
  [THE_PHASE_STAGES_FILE, 'endPhaseSkillRisesFallenCommandersAndProvinceMemory', 'B-06am, a watch ended: the tier'],
  [
    THE_ORDER_DISPATCH_FILE,
    'processOrder',
    "B-06an, the checks before an order: its row's fields; B-06ao, the dispatch: the registry",
  ],
  [THE_ORDER_RESOLVERS_REGISTRY_FILE, TOP, "B-06ao, each kind's resolver: keyed by its row's key"],
];

test.for(TAKEN)('%s: %s checks no order by its kind (%s)', ([file, fn]) => {
  const counts = orderKindChecksByFunction(file, fs.readFileSync(path.join(ROOT, file), 'utf8'));
  expect(fn === TOP || counts.has(fn), `${file} declares ${fn}`).toBe(true);
  expect(counts.get(fn) ?? 0, `${fn}'s checks of an order's kind (the ratchet's helper)`).toBe(0);
});

// The words are the hero orders' rows' keys (content): every kind of order but the five alignment orders' (their rows
// give them, and alignmentOrderChecksInEngine counts them), and Pursue's row, a saved name the turn still reads.
test("the vocabulary is the hero orders' rows' keys less the alignment orders' keys, Pursue's among them", () => {
  const keys = Object.values(THE_HERO_ORDERS).map((row): string => row.key);
  expect(keys.length, "the hero orders' rows: OrderKind's 48 kinds and Pursue's").toBe(49);
  expect(
    [...ALIGNMENT_ORDER_VOCABULARY].filter((k) => !keys.includes(k)),
    "the alignment orders' keys",
  ).toEqual([]);
  expect([...ORDER_KIND_VOCABULARY]).toEqual(keys.filter((k) => !ALIGNMENT_ORDER_VOCABULARY.has(k)));
  expect(ORDER_KIND_VOCABULARY.size).toBe(44);
  expect(ORDER_KIND_VOCABULARY.has('pursue'), "Pursue's row").toBe(true);
});

// The helper finds what it counts, and only that: each form planted in one function (an arrow given to a name counts
// for that name, as a named function does; one outside every function for the top level).
test("the ratchet's helper counts each check of an order's kind, and none of another sense", () => {
  const planted = `
    type Kind = 'move' | 'rest';
    export const BUSY = ['practice', 'research'];
    export const MAP = { 'explore province': 'explore' };
    export function planted(o: { action?: string }, it: { action: string }, skill: (s: string) => number) {
      const a = o.action;
      if (o.action === 'move' || a !== 'rest' || normaliseAction(o) == 'hire') it.action = 'defend';
      switch (o.action) { case 'spy': break; case 'steal': break; }
      const kind = (o.action || 'defend');
      const written = { action: 'move', type: 'move' };
      return [kind, written, skill('spy'), ['spy', 'scholar'], ['move'], 'move'];
    }
    export function theTierAnOrderActsIn(d: string) { return d === 'blockade'; }
    export function botRoleWork(role: string) { switch (role) { case 'spy': return 1; } return role === 'hire'; }
    export const inner = (o: { action?: string }) => \`move\` === o.action;`;
  expect(Object.fromEntries(orderKindChecksByFunction('src/engine/planted.ts', planted))).toEqual({
    [TOP]: 2,
    planted: 7,
    theTierAnOrderActsIn: 1,
    botRoleWork: 0,
    inner: 1,
  });
  // In the kinds' own file, a value of its table is a check (its key isn't); elsewhere it isn't.
  const table = "export const PHASE_ACTION_MAP = { move: 'move', 'search lair': 'search', x: { type: 'move' } };";
  expect(orderKindChecksByFunction(THE_ORDER_KINDS_FILE, table).get(TOP)).toBe(2);
  expect(orderKindChecksByFunction('src/engine/planted.ts', table).get(TOP) ?? 0).toBe(0);
});

// The counts on the tree are the ratchet's baselines; a check planted in an engine function raises the engine's count
// or the bots' by one, and the ratchet fails on it; one in src/engine/rules/ or a page's code, or of another sense,
// isn't counted.
test.for([
  ['src/engine/orders/move-order-marches-voyages-and-battles-on-arrival.ts', "o.action === 'move'", 1, 0],
  ['src/engine/bots/strategy.ts', "o.action === 'rest'", 0, 1],
  ['src/engine/bots/missions.ts', "{ action: 'move', type: 'move' }", 0, 0],
  ['src/engine/rules/the-registry-of-alignment-abilities.ts', "o.action === 'move'", 0, 0],
  ['src/ui/player/map-symbols.ts', "o.action === 'move'", 0, 0],
] as const)('%s: return %s raises the engine count by %i and the bots by %i', ([file, body, engine, bots]) => {
  const files = theCodeFiles();
  const asTheyAre = {
    ...readBaseline(),
    orderKindChecksInEngine: orderKindChecksInEngine(files),
    orderKindChecksInTheBots: orderKindChecksInTheBots(files),
  };
  expect(asTheyAre.orderKindChecksInEngine, 'orderKindChecksInEngine on the tree as it is').toBe(
    readBaseline()['orderKindChecksInEngine'],
  );
  expect(asTheyAre.orderKindChecksInTheBots, 'orderKindChecksInTheBots on the tree as it is').toBe(
    readBaseline()['orderKindChecksInTheBots'],
  );
  const withThePlant = files.map(([f, text]): [string, string] =>
    f === file ? [f, `${text}\nexport function aPlantedOrder(o: { action: string }) { return ${body}; }\n`] : [f, text],
  );
  const planted = {
    ...asTheyAre,
    orderKindChecksInEngine: orderKindChecksInEngine(withThePlant),
    orderKindChecksInTheBots: orderKindChecksInTheBots(withThePlant),
  };
  expect(planted.orderKindChecksInEngine, `the engine's count with ${body} planted in ${file}`).toBe(
    asTheyAre.orderKindChecksInEngine + engine,
  );
  expect(planted.orderKindChecksInTheBots, `the bots' count with ${body} planted in ${file}`).toBe(
    asTheyAre.orderKindChecksInTheBots + bots,
  );
  expect(compare(asTheyAre, planted).rose, 'the ratchet fails on a rise').toHaveLength(engine + bots);
});
