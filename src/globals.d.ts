// The names the site's modules read without importing them (plan P1-09, Decisions 5 and 6), for TypeScript. Not a
// module (no import, no export): each `declare` here is a global.
//
// From the page's classic scripts (public/, loaded by a tag before the page's module): KC_CONFIG (kc-config.js, which
// staging overwrites), supabase (supabase-js, public/vendor/). KC_RNG_SEED is set by the tests before a page's scripts
// run (tests/lib/boot.js) and read by src/engine/rng.ts behind typeof; the live site has none.
//
// Then each page's declared globals (P1-09b): the variables its files and its tests share, each declared once as
// `globalThis.<name> = <value>;` in the file named above it, and read and written by its bare name. eslint.config.js
// finds them in the code; tests/static/globals-d-ts.test.ts checks this file names exactly those. Their types come
// with P1-16, which moves each page's to a typed state object.

declare const KC_CONFIG: Readonly<{
  env: string;
  supabaseUrl: string;
  supabaseKey: string;
  deployed?: Readonly<{ pr: number; sha: string }>;
}>;
declare const supabase: { createClient(url: string, key: string, options?: object): PageState };
declare const KC_RNG_SEED: number | undefined;

/** A page variable's value, untyped until P1-16. */
type PageState = any;

// db/game-meta.ts
declare var _kcHasTel: PageState;
declare var _kcTelLastErr: PageState;
declare var _kcHasMsg: PageState;
// ui/gm/auto-turn.ts
declare var _autoWatcherTimer: PageState;
declare var _autoRunBusy: PageState;
// ui/gm/config.ts (and ui/player/items-and-heroes.ts: each page declares its own)
declare var currentUser: PageState;
// ui/gm/config.ts
declare var currentGame: PageState;
declare var currentGamePlayers: PageState;
// ui/gm/game-list.ts
declare var _invitablePlayers: PageState;
declare var _inviteSelected: PageState;
declare var _editInviteSelected: PageState;
// ui/gm/hall-of-fame.ts
declare var _kcHasLb: PageState;
declare var _kcLbLastErr: PageState;
// ui/gm/turn-zero.ts
declare var _pendingTurn0: PageState;
// ui/leaderboard/main.ts
declare var GAMES: PageState;
// ui/player/dispatches.ts
declare var _msgGameId: PageState;
declare var _msgMyIndex: PageState;
declare var _msgRows: PageState;
declare var _msgMoreOlder: PageState;
declare var _msgLoadingOlder: PageState;
declare var _msgRealms: PageState;
declare var _msgChannel: PageState;
declare var _msgTableOk: PageState;
declare var _msgErr: PageState;
declare var _msgOut: PageState;
declare var _msgBlockOut: PageState;
// ui/player/game-lists.ts
declare var _pollTimer: PageState;
// ui/player/init.ts
declare var currentGamePlayerId: PageState;
declare var viewingReport: PageState;
declare var viewedTurn: PageState;
// ui/player/items-and-heroes.ts
declare var currentProfile: PageState;
declare var joiningGame: PageState;
declare var joinSkills: PageState;
declare var currentGamePlayer: PageState;
declare var currentReport: PageState;
declare var diploChoices: PageState;
declare var reckoningCall: PageState;
declare var _heroOrder: PageState;
declare var concedeGame: PageState;
declare var discoveryChoices: PageState;
// ui/player/layout.ts
declare var _msgEnabled: PageState;
declare var _deskLeftView: PageState;
// ui/player/order-targets.ts
declare var _draftOrdersSnapshot: PageState;
