// tests/lib/a-finished-game-of-two-realms-each-holding-its-own-best.ts: one made-up finished game, as the GM page hands
// it to the Hall of Fame's builder (buildGameRecords in src/ui/gm/hall-of-fame.ts), for ruling R-087 (each realm's own
// best for each record). Two realms, three turns: Ashvale fights a 500-strong battle, Brindmoor a 200-strong one;
// Brindmoor's Sir Fallowmere (Melee 9, 88 maximum HP) falls in turn 2, the turn Brindmoor's Lady Earlwick holds The
// Throne (merit 30), which Ashvale holds at the end (merit 42: `theThroneHeldByAshvale` stands in for computeStandings).
// Until plan P1-14z the script leaderboard-realm-bests built it; now its unit test (tests/unit/the-hall-of-fame-builds-
// and-writes-each-record-on-the-values-handed-it.test.ts) checks the record the builder makes of it, and its page test
// (tests/page/the-hall-of-fames-page-renders-every-tab-from-records-the-builder-made.test.ts) the board it gives.
import type { computeStandings } from '../../src/engine/titles/reckoning.ts';

const realm = (pi: number): string => ['Realm Ashvale', 'Realm Brindmoor'][pi] ?? '';
const battle = (atkPi: number, defPi: number, atkStr: number, defStr: number) => ({
  prov: 1,
  terrain: 'plains',
  kind: 'pvp',
  atkPi,
  defPi,
  atkStr,
  defStr,
  atkLost: 1,
  defLost: 1,
  carry: 0,
  side: 'atk',
  win: true,
});
const aTurn = (turn: number, pi: number, post: object, outcomes?: object) => ({
  turn,
  player_index: pi,
  is_bot: false,
  realm: realm(pi),
  post: { provinces: 3, characters: [], ...post },
  outcomes: outcomes ?? {},
});

/** The game's row, its realms' slots, results and turns, its state and its players' names, in the builder's order. */
export const theGameOfTwoRealmsEachHoldingItsOwnBest = {
  gameRow: { id: 'g1', name: 'The Test War', gm_user_id: 'gm-1', created_at: '2026-09-20T00:00:00Z' },
  players: [0, 1].map((pi) => ({ player_index: pi, user_id: 'u' + String(pi), display_name: realm(pi) })),
  results: [0, 1].map((pi) => ({
    game_id: 'g1',
    game_name: 'The Test War',
    player_index: pi,
    is_bot: false,
    realm: realm(pi),
    race: 'Human',
    alignment: 'Good',
    rank: pi + 1,
    score: 100 - pi * 40,
    winner: pi === 0,
    victory: 'reckoning',
    turns: 3,
    setup: { realms: 2, humans: 2, bots: 0, cols: 9, rows: 7, seaPct: 30 },
    final: { provinces: 5, characters: [] },
    created_at: '2026-10-01T00:00:00Z',
  })),
  events: [
    aTurn(1, 0, {}, { battles: { fought: 1, won: 1, list: [battle(0, 1, 300, 200)] } }),
    aTurn(1, 1, {}, { battles: { fought: 1, won: 1, list: [battle(1, 0, 120, 80)] } }),
    aTurn(2, 1, {
      fallen: [
        { id: 7, name: 'Sir Fallowmere', fell: 1, hp: 0, maxHp: 88, skills: { melee: 9 }, units: [], items: [] },
      ],
      titles: [{ key: 'throne', merit: 30, who: 'Lady Earlwick' }],
    }),
    aTurn(3, 1, { characters: [{ id: 8, name: 'Squire Low', maxHp: 20, skills: { melee: 2 }, units: [], items: [] }] }),
  ],
  gs: { players: [{}, {}], characters: [{ id: 1, name: 'King Ash' }], world: { cols: 9, rows: 7 } },
  names: { u0: 'Player One', u1: 'Player Two' },
};

/** The standings at the game's end, stood in for computeStandings: Ashvale's King Ash holds The Throne, merit 42. */
export const theThroneHeldByAshvale = (): ReturnType<typeof computeStandings> => ({
  titles: { throne: { playerIndex: 0, merit: 42, charId: 1, prize: 0, name: 'The Throne' } },
  relics: [],
  standings: [],
  taxByPlayer: [],
  worldTax: 0,
  goldByPlayer: [],
  threshold: 0,
  perChar: {},
});
