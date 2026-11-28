// B-17b: in whole all-bot games, the bots' record of their choices marks each order a bot pads a hero's free phases
// with by the kind its words say, where the order is written: after each turn's order hygiene, each bot realm's
// padding by kind in the record equals the count of its heroes' Defend orders by their words ('Hold', 'Hold the
// post', 'Hold with the host', 'Lie in wait', 'Lie low', 'Lie in wait for …', 'Hold …'). A site that writes a padding
// order unmarked, marks it with another kind, or copies it without its kind, makes the two differ. The words are read
// here only, as the test's cross-check: the record itself never reads them (BOT-S6).
// Level 3 (simulation): whole bot games on the engine's modules (tests/lib/a-staged-turn-on-the-engines-modules.ts's
// play()), each turn's orders read as the hygiene leaves them (the hygiene called through, by a stand-in on its
// module). A lower level can't reach the padding sites: each is written by a bots' pass on a world a game makes.
// The games: GAMES all-bot games of REALMS realms from the run's seed (KC_SEED), each set up the same way.
import { expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules, type World } from '../lib/a-staged-turn-on-the-engines-modules.ts';
import { timeLimitForTheWork } from '../lib/time-limits.ts';
import type { GameState } from '../../src/schemas/saved-game-state.ts';
import type {
  AKindOfPaddingOrder,
  TheBotsRecordOfARealmsTurn,
} from '../../src/engine/bots/the-bots-record-of-their-choices-per-realm-per-turn-kept-outside-the-save.ts';

const GAMES = 6;
const TURNS = 25;
const REALMS = 6;
const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

/** An order as the hygiene leaves it. */
interface TheOrder {
  action: string;
  desc: string;
}

/** The kind a Defend order's words say it pads with, or none (the test's cross-check only). */
function theKindItsWordsSay(desc: string): AKindOfPaddingOrder | null {
  if (desc === 'Hold') return 'hold';
  if (desc === 'Hold the post') return 'hold-the-post';
  if (desc === 'Hold with the host') return 'hold-with-the-host';
  if (desc === 'Lie in wait') return 'lie-in-wait';
  if (desc === 'Lie low') return 'lie-low';
  if (desc.startsWith('Lie in wait for ')) return 'lie-in-wait-for-a-quarry';
  if (desc.startsWith('Hold ')) return 'hold-the-ground-won';
  return null;
}

test(
  'each padding order is recorded by the kind its words say, every bot realm every turn',
  async () => {
    const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
    const economy = await import('../../src/engine/bots/economy.ts');
    const { generateBotSetups } = await import('../../src/engine/bots/setup.ts');
    const { generateNewGame } = await import('../../src/engine/world/generate.ts');
    const kept: TheBotsRecordOfARealmsTurn[] = [];
    const differ: string[] = [];
    const seen = new Map<AKindOfPaddingOrder, number>();
    const theHygiene = economy.runBotOrderHygiene;
    vi.spyOn(economy, 'runBotOrderHygiene').mockImplementation((G: GameState, bots: ReadonlySet<number>) => {
      const before = kept.length;
      theHygiene(G, bots);
      for (const r of kept.slice(before)) {
        const byWords: Partial<Record<AKindOfPaddingOrder, number>> = {};
        for (const c of G.characters) {
          // `as`: a save holds no orders between turns (its schema: lists of null); the turn's are staged, as the
          // hygiene leaves them
          const plan = (G.turnOrders as unknown as Partial<Record<number, (TheOrder | null | undefined)[]>>)[c.id];
          if (!(c.alive && c.player === r.realm && !c._isHeir && Array.isArray(plan))) continue;
          for (const o of plan.slice(0, 5)) {
            const kind = o?.action === 'defend' ? theKindItsWordsSay(o.desc) : null;
            if (kind) byWords[kind] = (byWords[kind] ?? 0) + 1;
          }
        }
        for (const [k, n] of Object.entries(r.padding)) {
          const kind = k as AKindOfPaddingOrder;
          seen.set(kind, (seen.get(kind) ?? 0) + n);
        }
        const a = JSON.stringify(Object.entries(byWords).sort());
        const b = JSON.stringify(Object.entries(r.padding).sort());
        if (a !== b) differ.push(`turn ${String(r.turn)} realm ${String(r.realm)}: by words ${a}, recorded ${b}`);
      }
    });
    vi.stubGlobal('window', { __botChoices: kept });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      for (let g = 0; g < GAMES; g++) {
        const setup = generateBotSetups([], REALMS, 0).map((b) => ({
          ...b,
          gamePlayerId: 'gp' + String(b.id),
          name: b.kingdomName,
        }));
        const made = generateNewGame(setup, { cols: 12, rows: 7 }, 999, { seaPct: 35 + 10 * g }) as unknown as World;
        made['botDifficulty'] = 'hard';
        made['botDiplomacy'] = g % 2 ? 'hostile' : 'normal';
        made['turnMode'] = { mode: 'manual', time: '20:00', everyDays: 1, nextDeadlineAt: null, turnRanAt: null };
        const rows = setup.map((sp) => ({
          id: sp.gamePlayerId,
          user_id: null,
          player_index: sp.id,
          display_name: sp.name,
          orders: null,
          orders_submitted: false,
          turn_report: JSON.stringify({ isBot: true }),
        }));
        let state = JSON.stringify(made);
        for (let t = 1; t <= TURNS; t++) state = JSON.stringify(sc.play(state, rows).S2);
      }
    } finally {
      warn.mockRestore();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
    expect(kept.length, 'the record kept the bot realms’ turns').toBeGreaterThan(0);
    expect(differ, 'each realm-turn whose recorded padding differs from its orders’ words').toEqual([]);
    expect(seen.get('hold') ?? 0, 'plain holds met').toBeGreaterThan(0);
  },
  timeLimitForTheWork({ matrixGamesPlayed: GAMES }).timeout,
);
