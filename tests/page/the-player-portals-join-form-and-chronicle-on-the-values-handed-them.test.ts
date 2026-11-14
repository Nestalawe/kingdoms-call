// The player portal's join form and its chronicle on the values handed them (plan P1-16n): the lines P1-16n changed in
// join-and-chronicle.ts that the screen tours don't reach, or reach only in part (npm run proof:tours), each run here on
// the value that reaches it, so a fault planted in one is red: the join form (its box, its skills, its checks before the
// realm is sent, the database's refusals), and the chronicle (the game's end, the heroes' sections by phase, the
// battles' sides, the tinted names, a name that starts another tinted whole (P1-21s), the intelligence and the
// dispatches).
// Level 4 (page): the file loads the page's start-up (its database client), so no lower level reaches it; the portal is
// booted in jsdom (tests/lib/boot.js) on a fake Db at an older database, so it stops at its notice with every module
// loaded, and each case stages the screen's state as the tours do.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { bootJsdom, readPage, type PageWindow } from '../lib/boot.js';
import { makeAFakeDb } from '../lib/fake-db.ts';
import type { ADatabaseAnswer, Db } from '../../src/db/the-db-interface-and-its-areas.ts';

const errs: string[] = [];
let P: PageWindow;
let doc: Document;
const call = (name: string, ...args: unknown[]): unknown => {
  const f: unknown = P[name];
  if (typeof f !== 'function') throw new Error(`the page has no function ${name}`);
  return Reflect.apply(f, undefined, args);
};
const stage = (code: string): unknown => P.eval(code);
const theElement = (id: string): HTMLElement => {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`no element ${id}`);
  return el;
};
const textOf = (id: string): string => theElement(id).textContent.replace(/\s+/g, ' ').trim();
const htmlOf = (id: string): string => theElement(id).innerHTML;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type AnAnswer = ADatabaseAnswer<unknown>;
const ok = (data: unknown): AnAnswer => ({ data, error: null, status: 200 });
const refused = (message: string, more: Record<string, unknown> = {}): AnAnswer => ({
  data: null,
  error: { message, ...more },
  status: 400,
});

/** What the fake answers this case. */
const answers: Record<string, () => AnAnswer> = {
  myRealms: () => ok([]),
  myFlags: () => ok([]),
  myGames: () => ok([]),
  cards: () => ok([]),
  everyColumn: () => ok([]),
  turnAndState: () => ok([]),
  setup: () => ok([]),
  slots: () => ok([]),
  names: () => ok([]),
  offer: () => ok(null),
  dispatches: () => ok([]),
  readMarks: () => ok([]),
  mine: () => ok([]),
  world: () => ok({ game_state: '{}', status: 'setup' }),
  join: () => ok({ id: 'R9' }),
};
const fresh = { ...answers };
const asked: { readonly what: string; readonly args: unknown[] }[] = [];
const theAsked = (what: string): unknown[][] => asked.filter((a) => a.what === what).map((a) => a.args);
const answering =
  (what: string) =>
  (...args: unknown[]): Promise<never> => {
    asked.push({ what, args });
    const answer = answers[what];
    if (!answer) throw new Error(`no answer for ${what}`);
    return Promise.resolve(answer() as never);
  };

function theFakeDb(): Db {
  const bare = makeAFakeDb(['20261010000000']).db;
  return {
    ...bare,
    thePlayersRealms: {
      ...bare.thePlayersRealms,
      everyRealmOfThisAccount: answering('myRealms'),
      thisAccountsRealmsAndTheirOrdersFlags: answering('myFlags'),
      theGamesOfThisAccountsRealms: answering('myGames'),
      theSlotsOfTheseGames: answering('slots'),
      thisAccountsRealmsInThisGame: answering('mine'),
      joinWithThisRealm: answering('join'),
    },
    thePlayersGames: {
      ...bare.thePlayersGames,
      theseGamesForTheirCards: answering('cards'),
      theseGamesEveryColumn: answering('everyColumn'),
      theTurnAndStateOfTheseGames: answering('turnAndState'),
      theGamesInSetup: answering('setup'),
      thisGamesWorldAndState: answering('world'),
    },
    theAccountsNames: { ...bare.theAccountsNames, theNamesOfTheseAccounts: answering('names') },
    theRoles: { ...bare.theRoles, theGameMasterOfferMadeToThisAccount: answering('offer') },
    theDispatches: {
      ...bare.theDispatches,
      theNewestDispatchesOfTheseGamesGamesAndRealms: answering('dispatches'),
      thisAccountsReadMarksInTheseGames: answering('readMarks'),
    },
  };
}

beforeAll(async () => {
  P = bootJsdom(readPage('kingdoms-call-player-portal.html'), {
    supabase: { createClient: () => ({}) },
    db: theFakeDb(),
    url: 'https://example.org/p',
    setup(w) {
      w.addEventListener('error', (e) => errs.push(e.error?.stack ?? e.message));
      w.console.error = () => undefined;
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
      w['scrollTo'] = () => undefined;
      w['ResizeObserver'] = class {
        observe() {
          return undefined;
        }
      };
    },
  }).window;
  doc = P['document'] as Document;
  await new Promise((resolve) => setTimeout(resolve, 600));
  const bootErrors = errs.map((e) => e.split(' (database')[0]).join('; ');
  if (bootErrors !== 'The game is being updated. Try again in a few minutes.')
    throw new Error(`the page booted with other errors: ${bootErrors}`);
  errs.length = 0;
});
beforeEach(() => {
  Object.assign(answers, fresh);
  asked.length = 0;
  stage('currentUser = { id: "U1" }; currentGamePlayer = null; currentReport = null; viewingReport = null;');
  stage('viewedTurn = null;');
});
afterAll(() => {
  P.close();
});

/** Opens the join form for the game G2 (4 places, 2 taken), with no slot taken but those the case gives. */
async function theJoinFormOpen(gm: unknown = 'Warden Pell', size: unknown = '4 realms', maxP = 4, joined = 2) {
  await call('showJoinGame', 'G2', 'Open Vale', maxP, joined, gm, size);
}
/** Fills the join form: a king, a realm, and the skills given. */
function theFormFilled(king: string, realm: string, skills: Record<string, number> = { melee: 2, archery: 2 }) {
  (theElement('join-king-name') as HTMLInputElement).value = king;
  (theElement('join-kingdom-name') as HTMLInputElement).value = realm;
  stage(`joinSkills = ${JSON.stringify(skills)};`);
}

describe('the join form', () => {
  test('its box names the GM and the world, or says it has neither; one place left reads "is", "slot"', async () => {
    await theJoinFormOpen(null, '', 4, 3);
    const info = textOf('join-game-info');
    expect(info).toContain('Game Master: the Game Master');
    expect(info).toContain('World size: —');
    expect(info).toContain('3/4 players have already joined. There is 1 open slot.');
    await theJoinFormOpen('', null, 4, 3);
    expect(textOf('join-game-info')).toContain('Game Master: the Game Master');
    expect(textOf('join-game-info')).toContain('World size: —');
    await theJoinFormOpen('Warden Pell', '4 realms', 4, 2);
    expect(textOf('join-game-info')).toContain('Game Master: Warden Pell');
    expect(textOf('join-game-info')).toContain('World size: 4 realms');
    expect(textOf('join-game-info')).toContain('There are 2 open slots.');
  });
  test('the skills: one point left reads "point"; a skill taken back to 0 leaves the list; a skill of no name shows its key', async () => {
    await theJoinFormOpen();
    call('adjustSkill', 'melee', 1);
    call('adjustSkill', 'melee', 1);
    call('adjustSkill', 'archery', 1);
    expect(textOf('join-pts-remaining')).toBe('1 point remaining');
    call('adjustSkill', 'archery', -1);
    expect(stage('JSON.stringify(joinSkills)')).toBe('{"melee":2}');
    expect(stage('Object.keys(joinSkills).length')).toBe(1);
    expect(textOf('join-pts-remaining')).toBe('2 points remaining');
    call('showSkillTip', { clientX: 5, clientY: 5 }, 'nonsense');
    expect(htmlOf('skill-info-tip')).toBe('<strong>nonsense</strong><br>');
    call('showSkillTip', { clientX: 5, clientY: 5 }, 'sage');
    expect(htmlOf('skill-info-tip')).toContain('<strong>Sage</strong><br>Scholarship.');
  });
  test('no king, or no realm, says so; one point unspent asks, its button joining this game', async () => {
    await theJoinFormOpen();
    theFormFilled('', 'Thornmere');
    await call('joinGame');
    expect(textOf('join-msg')).toBe("Please enter your King's name.");
    theFormFilled('Aldric', '  ');
    await call('joinGame');
    expect(textOf('join-msg')).toBe('Please name your Realm.');
    theFormFilled('Aldric', 'Thornmere', { melee: 2, archery: 1 });
    await call('joinGame');
    expect(textOf('join-msg')).toContain('You still have 1 skill point to spend.');
    expect(htmlOf('join-msg')).toContain('onclick="doJoinGame(&quot;G2&quot;)"');
    expect(theAsked('mine')).toEqual([]);
  });
  test('every point spent joins: the realm sent with its king, its setup and the next free place; joined, the games again', async () => {
    await theJoinFormOpen();
    answers['slots'] = () =>
      ok([
        { game_id: 'G2', player_index: 0 },
        { game_id: 'G2', player_index: 1 },
      ]);
    theFormFilled('Aldric', 'Thornmere');
    await call('joinGame');
    expect(theAsked('mine')).toEqual([['G2', 'U1']]);
    const sent = theAsked('join')[0]?.[0] as Record<string, unknown>;
    expect(sent['user_id']).toBe('U1');
    expect(sent['player_index']).toBe(2);
    expect(sent['display_name']).toBe('Thornmere');
    theFormFilled('Aldric', '');
    await call('doJoinGame', 'G2');
    const named = theAsked('join')[1]?.[0] as Record<string, unknown>;
    expect(named['display_name']).toBe('Aldric');
    expect(JSON.parse(String(named['turn_report']))).toMatchObject({
      playerSetup: { kingName: 'Aldric', kingdomName: 'Aldric', skills: { melee: 2, archery: 2 } },
      status: 'joined',
    });
    expect(textOf('join-msg')).toBe('You have joined the game! Waiting for the GM to start Turn 0.');
    asked.length = 0;
    await wait(2100);
    expect(theAsked('myRealms').length).toBeGreaterThan(0);
  });
  test('a realm already in the game is told so and sent to its games', async () => {
    await theJoinFormOpen();
    answers['mine'] = () => ok([{ id: 'R1', player_index: 0 }]);
    theFormFilled('Aldric', 'Thornmere');
    await call('doJoinGame', 'G2');
    expect(textOf('join-msg')).toContain('You have already joined this game');
    expect(theAsked('join')).toEqual([]);
    asked.length = 0;
    await wait(2600);
    expect(theAsked('myRealms')).toEqual([['U1']]);
  });
  test('a private game: one not invited is refused; one invited joins; a state not JSON, or none, reads as public', async () => {
    await theJoinFormOpen();
    theFormFilled('Aldric', 'Thornmere');
    answers['join'] = () => refused('asked, and stopped here');
    answers['world'] = () =>
      ok({ game_state: JSON.stringify({ visibility: 'private', invited: ['U7'] }), status: 'setup' });
    await call('doJoinGame', 'G2');
    expect(textOf('join-msg')).toBe(
      'This is a private game and you are not on its invite list. Ask the GM to invite you.',
    );
    expect(theAsked('join')).toEqual([]);
    answers['world'] = () => ok({ game_state: { visibility: 'private', invited: 'U1' }, status: 'setup' });
    await call('doJoinGame', 'G2');
    expect(textOf('join-msg')).toContain('This is a private game');
    answers['world'] = () => ok({ game_state: { visibility: 'private', invited: ['U1'] }, status: 'setup' });
    await call('doJoinGame', 'G2');
    expect(theAsked('join')).toHaveLength(1);
    answers['world'] = () => ok({ game_state: '{not json', status: 'setup' });
    await call('doJoinGame', 'G2');
    expect(theAsked('join')).toHaveLength(2);
    answers['world'] = () => ok({ game_state: 0, status: 'setup' });
    await call('doJoinGame', 'G2');
    expect(theAsked('join')).toHaveLength(3);
    answers['world'] = () => ok({ game_state: { visibility: 'private', invited: [] }, status: 'active' });
    await call('doJoinGame', 'G2');
    expect(theAsked('join')).toHaveLength(4);
  });
  test("the slots unreadable say so in the database's words; a full game says so; a game of no size counts 4 places", async () => {
    await theJoinFormOpen();
    theFormFilled('Aldric', 'Thornmere');
    answers['slots'] = () => refused('the <slots> are not there');
    await call('doJoinGame', 'G2');
    expect(htmlOf('join-msg')).toBe('<div class="msg-error">the &lt;slots&gt; are not there</div>');
    answers['slots'] = () => ok([0, 1, 2, 3].map((i) => ({ game_id: 'G2', player_index: i })));
    await call('doJoinGame', 'G2');
    expect(textOf('join-msg')).toBe('This game is now full.');
    await theJoinFormOpen('Warden Pell', '4 realms', 0, 0);
    theFormFilled('Aldric', 'Thornmere');
    answers['join'] = () => refused('asked, and stopped here');
    answers['slots'] = () => ok([0, 1, 2].map((i) => ({ game_id: 'G2', player_index: i })));
    await call('doJoinGame', 'G2');
    expect((theAsked('join')[0]?.[0] as Record<string, unknown>)['player_index']).toBe(3);
  });
  test("the database's refusals: a place taken a moment ago, a second realm (by its code or its words), and any other", async () => {
    await theJoinFormOpen();
    theFormFilled('Aldric', 'Thornmere');
    answers['join'] = () => refused('the realm <is> refused', { code: '42501' });
    await call('doJoinGame', 'G2');
    expect(htmlOf('join-msg')).toContain('the realm &lt;is&gt; refused<br><small>If this keeps happening');
    asked.length = 0;
    await wait(2600);
    expect(theAsked('myRealms')).toEqual([]);
    answers['join'] = () => refused('duplicate key violates game_players_one_per_number');
    await call('doJoinGame', 'G2');
    expect(textOf('join-msg')).toBe('Another player joined this game at the same moment. Please press Join again.');
    answers['join'] = () => refused('conflict', { code: '23505' });
    await call('doJoinGame', 'G2');
    expect(textOf('join-msg')).toContain('You have already joined this game');
    asked.length = 0;
    await wait(2600);
    expect(theAsked('myRealms').length).toBeGreaterThan(0);
    answers['join'] = () => refused('violates unique constraint game_players_one_per_user');
    await call('doJoinGame', 'G2');
    expect(textOf('join-msg')).toContain('You have already joined this game');
  }, 15000); // two of the page's 2.5 s timers waited for
});

/** A report the chronicle draws from: its log and its heroes, and the rest the report screen reads, empty. */
const aReport = (log: unknown[], more: Record<string, unknown> = {}) => ({
  lastTurnLog: log,
  characters: [
    { id: 1, name: 'Aldric', isKing: true, player: 0 },
    { id: 2, name: 'Brand', player: 0 },
  ],
  kingdom: { name: 'Thornmere', color: '#3366aa' },
  ...more,
});
/** Draws the report's chronicle (and what the report screen draws after it, whose errors this case doesn't read). */
function theChronicleOf(report: unknown, current: unknown = report): string {
  P['__kcReport'] = report;
  P['__kcCurrent'] = current;
  stage('currentReport = __kcCurrent; viewingReport = __kcReport;');
  try {
    call('renderReportView', report);
  } catch {
    // the screen's other cards read parts this report leaves out
  }
  return htmlOf('report-log');
}

describe('the chronicle', () => {
  test('no line says no events yet, with the intelligence host on the current turn', () => {
    const html = theChronicleOf(aReport([]));
    expect(html).toContain('No events yet.');
    expect(html).toContain('id="report-intel"');
    stage('viewedTurn = 3;');
    const past = theChronicleOf(aReport([]));
    expect(past).toContain('No events yet.');
    expect(past).not.toContain('id="report-intel"');
  });
  test("the game's end: its lines lifted under the banner, the standings apart, each realm's name tinted, no-one named", () => {
    const report = aReport(
      [
        { text: '👑 THE RECKONING IS CALLED — Thornmere claims the world', gameEnd: true },
        { text: '   1. Thornmere — 40 Legacy', charId: null },
        { text: '   2. Vale — 12 Legacy' },
        { text: 'Aldric rests.', charId: 1, phase: 0 },
      ],
      {
        titles: { gameOver: { winnerName: '' } },
        allKingdoms: [
          null,
          { name: '' },
          { name: 'Thornmere', color: '#3366aa' },
          { name: 'Vale' },
          { color: '#aa0000' },
        ],
      },
    );
    const html = theChronicleOf(report);
    expect(html).toContain('The Reckoning is complete — No-one is judged supreme!');
    expect(html).toContain('Final Legacy standings');
    const banner = html.slice(0, html.indexOf('Final Legacy standings'));
    expect(banner).toContain('THE RECKONING IS CALLED');
    expect(html).toMatch(/<strong style="color:#[0-9a-f]+">Thornmere<\/strong> claims the world/);
    expect(html).toContain('font-weight:600;">1. <strong');
    expect(textOf('report-log').split('40 Legacy')).toHaveLength(2);
    expect(html).toContain('line-height:1.55;">2. Vale — 12 Legacy</div>');
    const decided = theChronicleOf(aReport([{ text: '🏆 THE GAME IS DECIDED — Vale concedes', gameEnd: true }]));
    expect(decided).toContain('🏆 The game is decided</div>');
    expect(decided).toContain('THE GAME IS DECIDED — Vale concedes');
  });
  test("the heroes' sections: a phase's lines, an end-of-turn line, a hero named among others; the realm's events and an env line", () => {
    const report = aReport([
      { text: 'Aldric marches.', charId: 1, phase: 1 },
      { text: 'A courier reaches Aldric.', charId: 1, phase: 99 },
      { text: 'Brand is named.', charIds: [7, 2], phase: 2 },
      { text: 'The ground shakes far away.', env: true, charId: 9, phase: 2 },
      { text: 'Taxes are paid.' },
      { text: 'A storm in spring.', phase: 0, type: null },
      { text: 'A realm stirs.', phase: 7 },
      { text: ' [Intelligence] An indented whisper.', phase: 0 },
      { text: 'Brand fights.', charId: 2, phase: 3 },
      { text: 'Brand pins.', charId: 2, phase: 3, pinNotice: true },
    ]);
    const html = theChronicleOf(report);
    const text = textOf('report-log');
    const aldric = text.slice(text.indexOf('👑 Aldric'), text.indexOf('⚔ Brand'));
    const brand = text.slice(text.indexOf('⚔ Brand'), text.indexOf('Realm Events'));
    expect(aldric).toMatch(/Early Summer Aldric marches\. End of Turn A courier reaches Aldric\./);
    expect(brand).toMatch(/Late Summer Brand is named\. Fall Brand pins\.Brand fights\./);
    expect(text).not.toContain('The ground shakes far away.');
    expect(html).toContain('<div class="log-entry " style="">A storm in spring.</div>');
    const events = text.slice(text.indexOf('Realm Events'));
    expect(html).toMatch(/A courier reaches <span style="color:#[0-9a-f]+">Aldric<\/span>\./);
    expect(events).toMatch(
      /Spring A storm in spring\.\s*\[Intelligence\] An indented whisper\. End of Turn Taxes are paid\.A realm stirs\./,
    );
  });
  test("a battle's sides: the short view counts each kind, a side of no armies says so; a marker that can't be read is a line", () => {
    const side = (o: Record<string, unknown>) => `⚑FORCE⚑${JSON.stringify(o)}`;
    const report = aReport([
      { text: '⚔ The clash at the ford', battleId: 'b1', bTier: 'k', charId: 1, phase: 1 },
      {
        text: side({
          name: 'Aldric',
          color: '#3366aa',
          verb: 'attacks, leading',
          armies: [{ type: 'Spearmen' }, { type: 'Spearmen' }, {}, { type: 'Knights', unitName: 'The Red Lances' }],
        }),
        battleId: 'b1',
        bTier: 'k',
        charId: 1,
        phase: 1,
      },
      {
        text: side({ name: 'Vale Guard', neutral: true, verb: 'holds — 3 defending units' }),
        battleId: 'b1',
        bTier: 'k',
        charId: 1,
        phase: 1,
      },
      {
        text: side({ name: 'Lone Scout', armies: [{ type: 'Scouts' }] }),
        battleId: 'b1',
        bTier: 'k',
        charId: 1,
        phase: 1,
      },
      {
        text: side({ name: 'Orc Chief', guard: true, armies: [{ type: 'Orcs' }] }),
        battleId: 'b1',
        bTier: 'd',
        charId: 1,
        phase: 1,
      },
      { text: '⚑FORCE⚑null', charId: 1, phase: 2 },
      { text: '⚑FORCE⚑{"name":"Odd","armies":5}', charId: 1, phase: 2 },
      { text: '⚑FORCE⚑{"name":"Odd","armies":5}', battleId: 'b2', bTier: 'k', charId: 1, phase: 3 },
      { text: '⚔ **Battle for the Mill**', battleId: 'b2', bTier: 'k', charId: 1, phase: 3 },
      { text: 'A detail', battleId: 'b2', bTier: 'd', charId: 1, phase: 3 },
      { text: 'The Red Lances charge.', charId: 1, phase: 2 },
    ]);
    const html = theChronicleOf(report);
    const short = html.slice(html.indexOf('bf-short'), html.indexOf('bf-full'));
    expect(short).toContain('attacks — 4 units: ');
    expect(short).toContain('2× Spearmen');
    expect(short).toContain(' unit, ');
    expect(short).toContain(' Knights</div>');
    expect(short).toContain('>Vale Guard</span> holds — no armies');
    expect(short).toContain('>Lone Scout</span>  — 1 unit: ');
    expect(short).toContain('The clash at the ford</span><span style="flex:1"></span><button');
    expect(short).toContain('<span style="color:#555;font-weight:700">Vale Guard</span>');
    expect(short).not.toContain('Orc Chief');
    expect(textOf('report-log')).toContain('⚑FORCE⚑null');
    expect(textOf('report-log')).toContain('⚔ Odd :— no armies —');
    const mill = html.slice(html.lastIndexOf('bf-short'));
    const millShort = mill.slice(0, mill.indexOf('bf-full'));
    expect(millShort).toContain('<div class="log-entry " style="">⚑FORCE⚑{"name":"Odd","armies":5}</div>');
    expect(millShort).toContain('Battle for the Mill</strong></span><span style="flex:1"></span><button');
    expect(html).toMatch(/<span style="color:#[0-9a-f]+">The Red Lances<\/span> charge\./);
    expect(html).toContain('▸ full report');
  });
  test("names tinted from the report's lairs, sightings, map heroes and names; the realm's own colour none where it has none", () => {
    const report = aReport(
      [
        {
          text: 'Aldric meets Grimjaw, the Wyrm, Sly Tom, Red Wat, Bors, Old Mag, Ser Kay, Iron Vale and the Hollow Crown near Fenwatch.',
          charId: 1,
          phase: 0,
        },
      ],
      {
        kingdom: { name: 'Thornmere', color: '' },
        knownFeatures: [
          null,
          { monster: 'Grimjaw', name: 'Fenwatch', monsterPower: 'Legendary' },
          { monster: 'unknown guardian', monsterPower: 'Weak' },
          { monster: 'the Wyrm', monsterPower: 'Nonesuch' },
        ],
        heroSightings: [
          { type: 'enemy', name: 'Sly Tom', kingdomColor: '#aa3333' },
          { type: 'enemy', name: 'Red Wat', kingdomColor: '' },
          { type: 'neutral_guard', name: 'Bors' },
        ],
        worldMeta: {
          provinces: [
            {
              characters: [
                { name: 'Aldric', isOwn: true },
                { name: 'Old Mag', isWanderer: true, ownerColor: '#aa3333' },
              ],
            },
            {},
          ],
        },
        allKingdoms: [{ name: 'Hollow Crown', color: '#22aa22' }, null, { name: 'Iron Vale' }],
        nameColors: [null, { name: 'Ser Kay', color: '', neutral: false }, {}, { name: 'Iron Vale', color: '#2244aa' }],
      },
    );
    const html = theChronicleOf(report, aReport([]));
    expect(html).toContain('<span style="color:#5a0a9a">Grimjaw</span>');
    expect(html).toContain('<span style="color:#5a0a9a">Fenwatch</span>');
    expect(html).not.toMatch(/<span style="color:[^"]*">the Wyrm<\/span>/);
    expect(html).toMatch(/<span style="color:#[0-9a-f]+">Sly Tom<\/span>, Red Wat, /);
    expect(html).toContain('<span style="color:#8f6a38">Bors</span>');
    expect(html).toContain('<span style="color:#555">Old Mag</span>, Ser Kay, <span');
    expect(html).toMatch(/<span style="color:#[0-9a-f]+">Hollow Crown<\/span>/);
    expect(html).toMatch(/<span style="color:#[0-9a-f]+">Iron Vale<\/span>/);
    expect(html).not.toMatch(/<span style="color:[^"]*">Aldric<\/span> meets/);
  });
  test('a name that starts another: the longer is tinted whole, in its own colour', () => {
    const report = aReport(
      [
        { text: 'Aldric rides to Ashen Reach.', charId: 1, phase: 0 },
        { text: 'Ashen holds the ford.', charId: 1, phase: 0 },
      ],
      {
        allKingdoms: [
          { name: 'Ashen', color: '#aa2222' },
          { name: 'Ashen Reach', color: '#2222aa' },
        ],
      },
    );
    theChronicleOf(report, aReport([]));
    const tinted = (colour: string) =>
      [...theElement('report-log').querySelectorAll('span')]
        .filter((span) => span.getAttribute('style') === 'color:' + colour)
        .map((span) => span.textContent);
    expect(tinted('#2222aa')).toEqual(['Ashen Reach']);
    expect(tinted('#aa2222')).toContain('Ashen');
  });
  test('the intelligence: each title its block, a tag of no name, lines by phase and none; the dispatches their own section', () => {
    const report = aReport([
      { text: '[The Throne] Vale holds 40 gold.' },
      { text: '[The Throne] Vale has 3 armies.' },
      { text: '[Intelligence] Spies saw Vale.', phase: 2 },
      { text: 'Rumour: [Intelligence] a fleet.' },
      { text: '[Intelligence] A fleet sighted.' },
      { text: 'From Vale: hail.', type: 'message' },
    ]);
    const html = theChronicleOf(report);
    expect(html.split('[The Throne]</span>')).toHaveLength(2);
    expect(html).toContain('Vale holds 40 gold.</div><div class="ti-line">Vale has 3 armies.');
    expect(html).toContain('[Intel]</span> Spies saw Vale.');
    expect(textOf('report-log')).toMatch(/General\s*\[Intel\] A fleet sighted\./);
    expect(html).toContain('Dispatches');
    expect(html).toContain('From Vale: hail.');
  });
});
