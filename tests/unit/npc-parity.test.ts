// claude_npcparity_0927.js — proves the two 2026-09-27 PvP/NPC parity fixes actually fire inside combatVsNPC
// (battles against NEUTRAL province defenders), and that neither one leaks outside its conditions (R-063):
//   (A) ELF Ambush        — Forest Wardens in an ATTACKING force silence a neutral garrison's answering volley in
//                           forest and jungle, as they already did against a player. Nothing changes outside forest
//                           and jungle.
//   (B) DWARF Shield Fort — a Guard-heavy force beaten by a neutral garrison takes no Ride Them Down losses and falls
//                           back in good order instead of demoting; and a Guard-heavy neutral GARRISON that loses
//                           gives no broken backs to ride down and takes no pinned-against-their-own-ground losses.
// Level 1 (unit): combatVsNPC called directly in the bare vm (tests/lib/engine.ts), on a world staged for each battle,
// in the second phase. Plan P1-08g: this was tests/npc-parity.test.js, a scenario-level script that booted the GM
// portal, ran a turn and took combatVsNPC from the "  // 4. Run all 5 phases" hook. Same cases, same numbers of
// battles, same checks. The dice are the engine's, seeded from KC_SEED; every count a check needs above zero comes up
// in about a third of the battles or more, so 120 battles never miss it.
//
// In full, what it checks (tests/every-test-its-level-and-what-it-checks.md gives it one line):
// Elf Ambush and Shield Fort fire against neutral garrisons, and only where they should (R-063).
// `unit/npc-parity.test.ts`: `combatVsNPC` called directly in the bare `vm` on a world staged for each battle, the same
// 460 battles and 20 checks (P1-08g; it was a level-2 code-anchor test that ran a turn first); it reads the narrative's
// words (`theWordsOf` on a fact: a battle against a province's defenders records facts since P1-12c6)
import { expect, test } from 'vitest';
import { engineFn, loadEngine, quietEngineLog, turnContext, type TurnContext } from '../lib/engine.ts';

interface Unit {
  type: string;
  quality: string;
  race: string | null;
  unitName: string;
}
interface Province {
  neutralDefenders: Unit[];
  npcArmies: number;
  [key: string]: unknown;
}
interface Staged {
  world: { provinces: Province[] };
  characters: Record<string, unknown>[];
}
interface Battle {
  won?: boolean;
  narrative?: unknown[];
}

const engine = loadEngine({ seed: Number(process.env['KC_SEED']) >>> 0 || 1 });
quietEngineLog(engine);
/** A line's words: its words, or a fact's, which the views write (theWordsOf, src/views/prose/, P1-12c6). */
const theWordsOf = engineFn(engine, 'theWordsOf') as (fact: unknown) => string;
const wordsOf = (line: unknown): string => (typeof line === 'string' ? line : theWordsOf(line));
const combatVsNPC = engineFn(engine, 'combatVsNPC') as (
  t: TurnContext,
  c: unknown,
  prov: Province,
  guardHero: unknown,
) => Battle | undefined;

let unitCount = 0;
const U = (type: string, quality?: string, race?: string): Unit => ({
  type,
  quality: quality || 'Average',
  race: race || null,
  unitName: `${type} #${String(++unitCount)}`,
});

function world(terrain: string) {
  const provinces = [];
  for (let i = 0; i < 9; i++)
    provinces.push({
      id: i,
      name: `P${String(i)}`,
      terrain: terrain,
      owner: i === 3 ? 0 : null, // friendly ground to fall back onto
      tax: 4,
      characters: [] as string[],
      neutralDefenders: [] as Unit[],
      npcArmies: 0,
      garrison: [],
      battleGraves: [],
      armyTypes: [],
      features: [],
    });
  return { cols: 3, rows: 3, provinces };
}

/** One battle: a world on `terrain`, realm 0 of `race`, its commander with `armies` (and Tactical `tactical`) in
 *  province 4, attacking from 3, against `defenders`. Returns the battle and nothing else. */
function battle(terrain: string, race: string, armies: Unit[], defenders: Unit[], charRace?: string, tactical = 0) {
  const w = world(terrain);
  const at = w.provinces[4];
  if (!at) throw new Error('the staged world has no province 4');
  at.characters.push('c1');
  at.neutralDefenders = defenders;
  at.npcArmies = defenders.length;
  const state = {
    turn: 3,
    season: 0,
    world: w,
    logs: [],
    heroGraveyard: [],
    relations: {},
    players: [
      {
        name: 'Player',
        race,
        alignment: 'Neutral',
        gold: 50,
        homeProvince: 3,
        diplomacy: { known: [] },
        discoveries: [],
      },
      {
        name: 'Rival',
        race: 'Human',
        alignment: 'Neutral',
        gold: 50,
        homeProvince: 8,
        diplomacy: { known: [] },
        discoveries: [],
      },
    ],
    characters: [
      {
        id: 'c1',
        name: 'Lord Test',
        player: 0,
        isKing: true,
        alive: true,
        race: charRace || 'Dwarven',
        alignment: 'Neutral',
        temper: 'Brave',
        hp: 20,
        maxHp: 20,
        items: [],
        location: 4,
        armies,
        _attackedFrom: 3,
        skills: {
          melee: 2,
          archery: 0,
          tactical,
          march: 1,
          naval: 0,
          sage: 0,
          spy: 0,
          thief: 0,
          druid: 5,
          explorer: 0,
          white: 0,
          psychic: 0,
          illusory: 0,
          elemental: 0,
          necromancy: 0,
        },
      },
    ],
  };
  const tc = turnContext(engine, state);
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  const G = tc.G as unknown as Staged;
  const prov = G.world.provinces[4];
  if (!prov) throw new Error('the staged world has no province 4');
  return combatVsNPC(tc, G.characters[0], prov, null) || {};
}
const has = (narr: string[], re: RegExp) => narr.some((l) => re.test(l));

// ── CASE A: Ambush ──
function caseA(terrain: string, runs: number) {
  let volley = 0,
    blockLine = 0;
  for (let i = 0; i < runs; i++) {
    const out = battle(
      terrain,
      'Elven',
      [
        U('Forest Wardens', 'Elite', 'Elven'),
        U('Forest Wardens', 'Elite', 'Elven'),
        U('Elven Bowmen', 'Elite', 'Elven'),
      ],
      [U('Yeoman Longbows', 'Veteran', 'Human'), U('Yeoman Longbows', 'Veteran', 'Human')],
      'Elven',
    );
    const narr = (out.narrative || []).map(wordsOf);
    if (has(narr, /Defender Archery Phase/)) volley++;
    if (has(narr, /answering volley never comes/)) blockLine++;
  }
  return { volley, blockLine };
}

for (const terrain of ['forest', 'jungle']) {
  test(`${terrain}: the neutral garrison never gets a volley through Wardens, and the Ambush line is printed every time`, () => {
    const { volley, blockLine } = caseA(terrain, 50);
    expect(volley).toBe(0);
    expect(blockLine).toBe(50);
  });
}

test('plain: outside forest and jungle the garrison still shoots, and no Ambush line is printed', () => {
  const { volley, blockLine } = caseA('plain', 50);
  expect(volley).toBeGreaterThan(0);
  expect(blockLine).toBe(0);
});

// ── CASE B1 and B1b: a beaten player force ──
// Ten Elite Free Lances beat four Green base-6 units. In B1 all four are Dwarven Guard (Shield Fort's half-the-force
// gate met); in B1b one is (below the gate), with Orc Berserkers, also base 6, so only the gate differs. (An earlier
// version used Goblin Hordes at base 3; that force was so outmatched that every unit died on the death roll and none
// reached the demotion roll.) Green is the lowest quality, so a unit that fails the demotion roll disbands rather
// than dropping a tier: both outcomes count as "the demotion branch fired".
function caseB1(guards: number, runs: number) {
  let losses = 0,
    ride = 0,
    shield = 0,
    demote = 0,
    orderly = 0;
  for (let i = 0; i < runs; i++) {
    const armies = [U('Dwarven Guard', 'Green', 'Dwarven')];
    for (let k = 1; k < 4; k++)
      armies.push(k < guards ? U('Dwarven Guard', 'Green', 'Dwarven') : U('Orc Berserkers', 'Green', 'Orcish'));
    const defenders = [];
    for (let k = 0; k < 10; k++) defenders.push(U('Free Lances', 'Elite', 'Human'));
    const out = battle('plain', 'Dwarven', armies, defenders);
    if (out.won !== false) continue;
    const narr = (out.narrative || []).map(wordsOf);
    losses++;
    if (has(narr, /Free Lances range across the open ground/)) ride++;
    if (has(narr, /lock shields as they give ground/)) shield++;
    if (has(narr, /lost heart in defeat, reduced to|the unit disbands for good/)) demote++;
    if (has(narr, /fall back behind the shield wall in good order/)) orderly++;
  }
  return { losses, ride, shield, demote, orderly };
}

test('Shield Fort: a Guard-heavy force beaten by neutrals locks shields, never demotes, and falls back in good order', () => {
  const r = caseB1(4, 120);
  expect(r.losses).toBeGreaterThanOrEqual(20); // enough defeats to judge
  expect(r.ride).toBe(0); // no Ride Them Down line against locked shields
  expect(r.shield).toBe(r.losses); // the shield-wall line replaces it every time
  expect(r.demote).toBe(0); // never demotes or disbands
  expect(r.orderly).toBeGreaterThan(0); // the orderly fall-back is reported instead
});

test('control: with one Guard in four (below the gate), Shield Fort does not fire and Ride Them Down still bites', () => {
  const r = caseB1(1, 120);
  expect(r.losses).toBeGreaterThanOrEqual(20);
  expect(r.shield).toBe(0);
  expect(r.ride).toBe(r.losses);
  expect(r.demote).toBeGreaterThan(0); // units still demote or disband without the gate
});

// ── CASE B2: Shield Fort, a beaten neutral garrison ──
test('Shield Fort: a beaten Guard garrison locks shields, is not ridden down or pinned, and Shield Fort is announced', () => {
  let wins = 0,
    ride = 0,
    shield = 0,
    pinned = 0,
    sf = 0;
  for (let i = 0; i < 120; i++) {
    const armies = [];
    for (let k = 0; k < 4; k++) armies.push(U('Free Lances', 'Elite', 'Human'));
    for (let k = 0; k < 8; k++) armies.push(U('Gilded Lances', 'Elite', 'Human'));
    const out = battle(
      'plain',
      'Human',
      armies,
      [U('Dwarven Guard', 'Green', 'Dwarven'), U('Dwarven Guard', 'Green', 'Dwarven')],
      'Human',
      5,
    );
    if (out.won !== true) continue;
    const narr = (out.narrative || []).map(wordsOf);
    wins++;
    if (has(narr, /Free Lances ride down the broken companies across open ground/)) ride++;
    if (has(narr, /Dwarven Guard lock shields where they stand/)) shield++;
    if (has(narr, /pinned against their own ground/)) pinned++;
    if (has(narr, /Shield Fort — the defenders of/)) sf++;
  }
  expect(wins).toBeGreaterThanOrEqual(20); // enough wins to judge
  expect(ride).toBe(0); // no Ride Them Down line against a Guard garrison
  expect(shield).toBe(wins); // the locked-shields line replaces it every time
  expect(pinned).toBe(0); // the Guard garrison is never pinned for further losses
  expect(sf).toBeGreaterThan(0); // Shield Fort is announced for the trapped garrison
});
