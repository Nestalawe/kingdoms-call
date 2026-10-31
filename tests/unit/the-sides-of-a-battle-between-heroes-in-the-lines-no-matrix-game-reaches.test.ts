// The sides of a battle between heroes, in the lines no matrix game reaches, are named by their commanders (plan
// P1-12d22: P1-12d's battle slice, Decision 6). By the matrix's coverage of both sets (npm run proof:unreached on the
// row), no game reaches a defender's Grand Stratagem or Feigned Retreat, an attacker storming ashore in a Raid the
// Coast, the sanctuary wards of a province sapping either side, or a winner's corsairs closing the sea lanes to the
// loser, in a battle between two heroes' hosts. This plays each, with both commanders alive and with both slain before
// the battle (each side then fights on as "<name>'s leaderless host"), and reads each line's words: the side each line
// names is the one it names in play. The corsairs' lines need a Corsair company, which no realm raises any more
// (Parked: an old company still acts), so whether a force holds the sea lanes and where a beaten force can fall back to
// are stood in (vi.spyOn, the registry's aForceHoldsTheSeaLanes and retreatOptions): the winner holds them, and the
// loser could fall back to a sea or a land province. The realm discoveries' line can't be played: discoveryArmyBonus
// always returns 0 (Parked).
// Since the mutation session of 2026-10-31, also a line the matrix reaches but no test read: an Evil defender's monsters'
// savage fury names the defender's side (every die at 0.99, so neither side is seized by zeal, which takes its place).
// Since P1-12d31, the pursuits' lines (no game reaches a Shield Fort leaving the Manticore Pride or the Shark Shoals
// nothing, nor the Shark Shoals tearing into the beaten): each names the winner and the loser, with the War-Horn's and
// the no-room lines before them naming each side. Which pursuits each force makes and whether a Shield Fort holds are
// stood in (vi.spyOn, movement's pursuitsOfTheBeaten and shieldFortHolds): every pursuit, each adding a tenth.
// The battle keeps its name and signature, so this passes on the code before the row (P1-12d22's base), as after.
// Level 1 (unit): combatVsChar called directly on a world the engine makes from a fixed seed; no turn is played. Not
// lower: the lines sit inside combatVsChar, and their words in the views. Not higher: a whole turn adds dice and orders
// before the battle, and the flags these lines read are set by orders no bot gives.
import '../lib/the-whole-engine.ts';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { KC_SEASONS } from '../../src/content/kingdoms-call-data.ts';
import { kcRng, kcRngStream } from '../../src/engine/rng.ts';
import { generateBotSetups, isBotRow } from '../../src/engine/bots/setup.ts';
import { generateNewGame } from '../../src/engine/world/generate.ts';
import { createTurnContext } from '../../src/engine/turn/context.ts';
import { combatVsChar } from '../../src/engine/battle/battles-between-heroes.ts';
import * as theRegistry from '../../src/engine/rules/the-registry-of-content-effects.ts';
import * as retreats from '../../src/engine/units/sea-lift-stranding-and-retreats.ts';
import * as movement from '../../src/engine/units/movement.ts';
import type { ArmyInABattle } from '../../src/engine/army-tables.ts';
import type {
  HowTheGroundLetsAPursuitRun,
  ThePursuitsLine,
} from '../../src/engine/rules/the-registry-of-content-effects.ts';
import type { NarrativeLine } from '../../src/engine/turn/events-and-their-audiences.ts';
import { theWordsOf } from '../../src/views/prose/the-words-of-each-line.ts';
import { addTheFieldsResolveTurnAdds } from '../lib/the-fields-resolve-turn-adds-to-the-turns-context.ts';

// The GM's log echoes each line on the console: quiet while the battles write lines.
const consoleLog = console.log;
beforeAll(() => {
  console.log = () => undefined;
});
afterAll(() => {
  console.log = consoleLog;
});
afterEach(() => {
  vi.restoreAllMocks();
});

interface Character {
  id: number | string;
  name: string;
  player: number | null;
  isKing?: boolean;
  alive: boolean;
  location: number;
  armies: ArmyInABattle[];
  encounterPlan?: { tactics: string[]; duelStance: string };
  [key: string]: unknown;
}
interface Province {
  id: number;
  name: string;
  terrain: string;
  owner: number | null;
  characters: (number | string)[];
  [key: string]: unknown;
}
interface World {
  turn: number;
  relations: Record<string, string>;
  characters: Character[];
  world: { provinces: Province[] };
}

// A world of two bot realms, made by the engine from a fixed seed, kept as JSON: each battle stages a fresh copy.
kcRng.seed(1);
const THE_WORLD = JSON.stringify(
  generateNewGame(
    (generateBotSetups([], 2, 0) as Record<string, unknown>[]).map((b) => ({
      ...b,
      gamePlayerId: 'gp' + String(b['id']),
      name: b['kingdomName'],
    })),
    { cols: 10, rows: 6 },
    999,
    { seaPct: 10 },
  ),
);

/** `n` companies of Men-at-Arms of the quality given. */
const companies = (n: number, quality: string): ArmyInABattle[] =>
  Array.from({ length: n }, (_, i) => ({
    type: 'Men-at-Arms',
    quality,
    race: 'Human',
    unitName: `Company ${String(i)}`,
  }));

/** What a battle shows: its lines' words, and the names of its two commanders and of its province. */
interface WhatTheBattleShows {
  readonly words: readonly string[];
  readonly atk: string;
  readonly def: string;
  readonly province: string;
}

/** A battle on a free plain between realm 0's king (attacking) and realm 1's, each at the head of the host given, both
 *  alive or both slain before the battle; `stage` sets what the battle reads (on the world, the two kings and the
 *  plain) before it is fought, the dice a seeded stream's (or the dice given). */
function aBattle(
  hosts: { readonly atk: ArmyInABattle[]; readonly def: ArmyInABattle[] },
  bothSlain: boolean,
  stage: (G: World, atk: Character, def: Character, field: Province) => void,
  dice: () => number = kcRngStream(7),
): WhatTheBattleShows {
  const G = JSON.parse(THE_WORLD) as World;
  const tc = addTheFieldsResolveTurnAdds(createTurnContext(G, [], 3), { KC_SEASONS, isBotRow });
  tc._currentPhase = 1;
  tc._logCtx.phase = 1;
  G.relations['0-1'] = 'enemy';
  const [atk, def] = [0, 1].map((p) => G.characters.find((c) => c.alive && c.player === p && c.isKing));
  const field = G.world.provinces.find((p) => p.terrain === 'plain' && p.owner === null);
  if (!atk || !def || !field) throw new Error('the world has no king in realm 0 or 1, or no free plain');
  Object.assign(field, { characters: [], features: [], garrisonArmies: [], npcArmies: 0 });
  for (const c of [atk, def]) {
    const from = G.world.provinces[c.location];
    if (from) from.characters = from.characters.filter((id) => id !== c.id);
    c.location = field.id;
    field.characters.push(c.id);
    c.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'refuse' };
    if (bothSlain) c.alive = false;
  }
  atk.armies = hosts.atk;
  def.armies = hosts.def;
  stage(G, atk, def, field);
  const was = kcRng.use(dice);
  let narrative: NarrativeLine[];
  try {
    narrative = (combatVsChar(tc, atk, def, field) as { narrative: NarrativeLine[] }).narrative;
  } finally {
    kcRng.use(was);
  }
  return { words: narrative.map((l) => theWordsOf(l)), atk: atk.name, def: def.name, province: field.name };
}

/** A side's name in a line: its commander's, or his host's once he fell before the battle. */
const sideOf = (name: string, slain: boolean) => (slain ? `${name}'s leaderless host` : name);

describe.each([false, true])('a battle between heroes, both commanders slain before it: %s', (slain) => {
  test("the defender's Grand Stratagem and Feigned Retreat, the attacker's Raid the Coast, the sanctuary wards on each side", () => {
    const shown = aBattle(
      { atk: companies(2, 'Average'), def: companies(2, 'Average') },
      slain,
      (G, atk, def, field) => {
        def['_grandStratagemTurn'] = G.turn;
        def['_feignedRetreatTurn'] = G.turn;
        atk['_raidCarriedAt'] = { turn: G.turn, prov: field.id };
        // warded by a realm that is neither side's: both sides are its enemies
        Object.assign(field, { _sanctuaryTurn: G.turn, _sanctuaryBy: 2 });
      },
    );
    const [atk, def] = [sideOf(shown.atk, slain), sideOf(shown.def, slain)];
    expect(shown.words).toEqual(
      expect.arrayContaining([
        `  📜 ${def} unfolds a Grand Stratagem — the defence holds at +20% strength.`,
        `  🏳 ${def}'s Feigned Retreat springs shut — the counter-attack strikes at +25% strength.`,
        `  ⚓ ${atk} storms ashore in a Raid the Coast — the amphibious assault hits at +25% strength.`,
        `  ✨ The sanctuary wards of ${shown.province} sap ${atk}'s attackers (−25% strength).`,
        `  ✨ The sanctuary wards of ${shown.province} sap ${def}'s attackers (−25% strength).`,
      ]),
    );
  });

  test.each([
    ['the attacker wins', 'atk', 'def'],
    ['the defender wins', 'def', 'atk'],
  ] as const)("%s: the winner's corsairs close the sea lanes to the loser", (_, winner, loser) => {
    vi.spyOn(theRegistry, 'aForceHoldsTheSeaLanes').mockReturnValue(true);
    const shown = aBattle(
      winner === 'atk'
        ? { atk: companies(8, 'Elite'), def: companies(1, 'Green') }
        : { atk: companies(1, 'Green'), def: companies(8, 'Elite') },
      slain,
      (G, _atk, _def, field) => {
        const sea = G.world.provinces.find((p) => p.terrain === 'sea');
        const land = G.world.provinces.find((p) => p.terrain !== 'sea' && p.id !== field.id);
        if (!sea || !land) throw new Error('the world has no sea, or one province of land only');
        vi.spyOn(retreats, 'retreatOptions').mockReturnValue([sea, land]);
      },
    );
    const name = { atk: sideOf(shown.atk, slain), def: sideOf(shown.def, slain) };
    expect(shown.words).toContain(
      `⛵ ${name[winner]}'s corsairs close the sea lanes — ${name[loser]} cannot slip away by water.`,
    );
  });

  test.each([
    ['the attacker wins', 'atk', 'def', false],
    ['the defender wins', 'def', 'atk', false],
    ['the attacker wins, the beaten hold a Shield Fort', 'atk', 'def', true],
    ['the defender wins, the beaten hold a Shield Fort', 'def', 'atk', true],
  ] as const)("%s: each pursuit's line names the winner and the loser", (_, winner, loser, fort) => {
    const aPursuit = (line: ThePursuitsLine, onTheGround: HowTheGroundLetsAPursuitRun) => ({
      line,
      theFractionAddedToEachBeatenUnitsDeathRoll: 0.1,
      theFactorOnTheWinnersOwnDeathRolls: 1,
      onTheGround,
    });
    vi.spyOn(movement, 'pursuitsOfTheBeaten').mockReturnValue([
      aPursuit('the free lances ride the beaten down', 'by the war-horn of the plains'),
      aPursuit('the warg riders run the beaten down', 'it finds no room'),
      aPursuit('the manticore pride hunts the beaten', 'it runs'),
      aPursuit('the shark shoals tear into the beaten crews', 'it runs'),
    ]);
    vi.spyOn(movement, 'shieldFortHolds').mockReturnValue(fort);
    const shown = aBattle(
      winner === 'atk'
        ? { atk: companies(8, 'Elite'), def: companies(1, 'Green') }
        : { atk: companies(1, 'Green'), def: companies(8, 'Elite') },
      slain,
      () => undefined,
    );
    const name = { atk: sideOf(shown.atk, slain), def: sideOf(shown.def, slain) };
    const [w, l] = [name[winner], name[loser]];
    expect(shown.words).toEqual(
      expect.arrayContaining([
        `📯 ${name.atk}'s War-Horn of the Plains sounds — the Free Lances ride the broken enemy down even in plain country.`,
        `📯 ${name.def}'s War-Horn of the Plains sounds — the Free Lances ride the broken enemy down even in plain country.`,
        `🐎 ${name.atk}'s Free Lances find no room to ride in plain country — the broken enemy scatters into cover.`,
        `🐎 ${name.def}'s Free Lances find no room to ride in plain country — the broken enemy scatters into cover.`,
        ...(fort
          ? [
              `🛡 ${l}'s Dwarven Guard lock shields as they give ground — ${w}'s Free Lances find no broken backs to ride down.`,
              `🛡 ${l}'s Dwarven Guard lock shields as they give ground — ${w}'s Warg Riders find no broken backs to run down.`,
              `🛡 ${l}'s Dwarven Guard lock shields as they give ground — ${w}'s Manticore Pride find no broken backs to hunt.`,
              `🛡 ${l}'s Dwarven Guard lock shields as they give ground — ${w}'s Shark Shoals find nothing in the water.`,
            ]
          : [
              `🐎 ${w}'s Free Lances ride down the broken companies (+10% losses to ${l}).`,
              `🐺 ${w}'s Warg Riders run down the broken companies before they can get clear (+10% losses to ${l}).`,
              `🦂 ${w}'s Manticore Pride hunt the broken companies down before they can get clear (+10% losses to ${l}).`,
              `🦈 Feeding Frenzy — ${w}'s Shark Shoals tear into ${l}'s beaten crews as they founder (+10% losses to ${l}).`,
            ]),
      ]),
    );
  });

  test("an Evil defender's monsters: their savage fury names the defender's side, never the attacker's", () => {
    // every die at 0.99: neither side is seized by fanatical zeal (Evil's 25%), which would take the fury's place
    const shown = aBattle(
      {
        atk: companies(2, 'Average'),
        def: [
          ...companies(1, 'Average'),
          { type: 'Cave Trolls', quality: 'Average', race: 'Troll', unitName: 'Troll Band' },
        ],
      },
      slain,
      (G) => {
        const realms = (G as unknown as { players: { alignment?: string }[] }).players;
        realms.forEach((realm, i) => {
          realm.alignment = i === 1 ? 'Evil' : 'Neutral';
        });
      },
      () => 0.99,
    );
    const fury = shown.words.filter((w) => w.includes('driven to savage fury'));
    expect(fury).toEqual([`${sideOf(shown.def, slain)}'s monsters are driven to savage fury! (+25% strength)`]);
  });
});
