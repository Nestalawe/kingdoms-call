// The names the site's modules read without importing them (plan P1-09, Decisions 5 and 6), for TypeScript. Not a
// module (no import, no export): each `declare` here is a global.
//
// From the page's classic scripts (public/, loaded by a tag before the page's module): KC_CONFIG (kc-config.js, which
// staging overwrites), supabase (supabase-js, from npm: tools/build.ts; its type, TheSupabaseGlobal, is src/db/'s, the only folder that reads it). KC_RNG_SEED is set by the tests before a page's scripts
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
declare const supabase: TheSupabaseGlobal;
declare const KC_RNG_SEED: number | undefined;

/** A page variable's value, unknown to a typed file until P1-16 types it. */
type PageState = unknown;

// ui/gm/startup.ts
declare var _kcHasTel: PageState;
declare var _kcTelLastErr: PageState;
declare var _kcHasMsg: PageState;
// ui/gm/auto-turn.ts
/** The auto-turn watcher's timer, while it runs (setInterval's). */
declare var _autoWatcherTimer: ReturnType<typeof setInterval> | null;
declare var _autoRunBusy: PageState;
// ui/gm/config.ts (and ui/player/items-and-heroes.ts: each page declares its own)
/** The signed-in account (null before sign-in): its id, as the player page's dispatches read it, and its address and
 *  sign-up fields, as its sign-in reads them. */
declare var currentUser: {
  readonly id: string;
  readonly email?: string | undefined;
  readonly user_metadata?: Readonly<Record<string, unknown>> | undefined;
} | null;
// ui/gm/config.ts
/** The game the GM has opened (null before one is), as the game screen's read gives it. */
declare var currentGame: import('./ui/gm/startup.ts').TheGameTheGmHasOpen | null;
declare var currentGamePlayers: import('./ui/gm/startup.ts').TheRealmsOfTheGameTheGmHasOpen | null | undefined;
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
declare var GAMES: import('./ui/leaderboard/a-game-in-the-hall-of-fame-as-the-board-reads-it.ts').AGameAsTheBoardHoldsIt[];
// ui/player/dispatches.ts
declare var _msgGameId: string | null;
declare var _msgMyIndex: number | null;
declare var _msgRows: import('./ui/player/dispatches.ts').TheDispatchAsThePanelHoldsIt[];
declare var _msgMoreOlder: boolean;
declare var _msgLoadingOlder: boolean;
/** The realms the Dispatches panel knows, by index. */
declare var _msgRealms: Partial<Record<string, import('./ui/player/dispatches.ts').ARealmAsTheDispatchesKnowIt>>;
declare var _msgChannel: string;
/** Whether game_messages is there: null until it is probed. */
declare var _msgTableOk: boolean | null;
declare var _msgErr: string | null;
declare var _msgOut: 'conceded' | 'eliminated' | null;
declare var _msgBlockOut: boolean;
// ui/player/game-lists.ts
declare var _pollTimer: PageState;
// ui/player/init.ts
declare var currentGamePlayerId: PageState;
/** A past turn's report the page shows instead (the map reads it). */
declare var viewingReport: import('./ui/player/map.ts').TheReportAsTheMapDrawsIt | null | undefined;
declare var viewedTurn: PageState;
// ui/player/items-and-heroes.ts
/** The signed-in account's name, as profiles holds it (ui/player/sign-in.ts). */
declare var currentProfile: { readonly id: string; readonly name: string | null } | null;
/** The game the join form is for, as the open game's card hands it (ui/player/join-and-chronicle.ts). */
declare var joiningGame: {
  readonly id: string;
  readonly name: string;
  readonly maxP: number;
  readonly joined: number;
  readonly gmName: string | null | undefined;
  readonly worldSize: string | null | undefined;
} | null;
declare var joinSkills: Record<string, number>;
/** The realm's seat in the open game (the map writes its hero order into it). */
declare var currentGamePlayer: import('./ui/player/map.ts').TheRealmsSeatAsThePageHoldsIt | null | undefined;
/** The report the page shows: as the order form's forecasts, the page's lists, the map's popups, the Titles card, the map
 *  and the target fields read it (its typed readers, P1-16b to f), every part optional. */
declare var currentReport: import('./ui/player/orders-form.ts').TheReportAsTheOrderFormHoldsIt | null | undefined;
declare var diploChoices: Partial<Record<string, unknown>> | null;
declare var reckoningCall: PageState;
declare var _heroOrder: (string | null)[] | null | undefined;
declare var concedeGame: PageState;
/** The research's leads kept this turn, by the pair's key (items-and-heroes.ts). */
declare var discoveryChoices: Partial<Record<string, unknown>>;
// ui/player/layout.ts
declare var _msgEnabled: boolean;
declare var _deskLeftView: PageState;
// ui/player/order-targets.ts
/** This turn's saved draft, by hero: each phase's order as saved (the target fields read it before the form exists), as
 *  parsed from JSON: any value. */
declare var _draftOrdersSnapshot: unknown;
