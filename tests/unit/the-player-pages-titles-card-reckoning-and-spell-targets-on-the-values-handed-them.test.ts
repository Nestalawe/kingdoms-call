// The player page's Titles card, the Reckoning's control, the mastery card and the spells' target field on the values
// handed them (plan P1-16e): the lines P1-16e changed in titles.ts that the screen tours don't reach, or reach only in
// part (npm run proof:tours), each run here on the value that reaches it, so a fault planted in one is red.
// Level 1 (unit): titles.ts imports in Node (P1-13e8); its functions called on plain values, the cards written into a
// jsdom document set as the page's own. A page test would boot the whole page to reach each one.
import { beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom } from '../lib/boot.js';
import {
  renderMastery,
  renderMinorTitles,
  renderReckoningOrders,
  renderTitles,
  spellSecondaryHtml,
  titleRaceLine,
} from '../../src/ui/player/titles.ts';

let page: Document;
const g = globalThis as unknown as Record<string, unknown>;

beforeAll(() => {
  const { window } = bootJsdom(
    '<!doctype html><html><body><div id="mastery-card"><div id="report-mastery"></div></div><button id="rj-mastery"></button><div id="report-titles"></div><div id="reckoning-wrap"></div></body></html>',
  );
  page = window['document'] as Document;
  Object.assign(globalThis, { document: page });
});
const text = (id: string) => (page.getElementById(id)?.textContent ?? '').replace(/\s+/g, ' ');
const htmlOf = (id: string) => page.getElementById(id)?.innerHTML ?? '';
const words = (v: unknown) => {
  const box = page.createElement('template');
  box.innerHTML = String(v);
  return box.content.textContent.replace(/\s+/g, ' ');
};

describe('titles.ts: the mastery card', () => {
  test('a hero past level 6 lists each level he reached, by the skill’s name; none hides the card', () => {
    renderMastery({
      characters: [
        null,
        { name: 'Dead Ser', alive: false, skills: { melee: 9 } },
        { name: 'Ser Arlo', isKing: true, skills: { melee: 6, archery: 8, lore: 3, nonsense: 9 } },
      ],
    });
    const t = text('report-mastery');
    expect(t).toContain('👑 Ser Arlo');
    expect(t).not.toContain('Dead Ser');
    expect(t).toMatch(/Archery 8.*L6.*L7.*L8.*Melee 6 L6/);
    expect(t).not.toContain('nonsense');
    expect(t).not.toContain('L9');
    expect(page.getElementById('mastery-card')?.style.display).toBe('');
    renderMastery({ characters: [{ name: 'Ser Low', skills: { melee: 5 } }] });
    expect(page.getElementById('mastery-card')?.style.display).toBe('none');
    expect(page.getElementById('rj-mastery')?.style.display).toBe('none');
    renderMastery({});
    expect(htmlOf('report-mastery')).toBe('');
  });
});

describe('titles.ts: the race line and the Titles card', () => {
  test('the race line: none, held unchallenged and by points, vacant, no standing, a best', () => {
    expect(titleRaceLine(null)).toBe('');
    expect(words(titleRaceLine({ mine: true, unchallenged: true }))).toBe(
      'Your realm holds this title unchallenged — no rival has any standing.',
    );
    expect(words(titleRaceLine({ mine: true, charName: 'Ann', leadPct: 1 }))).toContain(
      'Ann holds this title, 1 percentage point ahead',
    );
    expect(words(titleRaceLine({ mine: true, leadPct: 0 }))).toContain(
      '0 percentage points ahead of the closest rival — level with them',
    );
    expect(titleRaceLine({ vacant: true })).toMatch(/^Vacant/);
    expect(titleRaceLine({ charName: 'Ann', pct: 0 })).toMatch(/^None of your characters/);
    expect(titleRaceLine({ charName: 'Ann', pct: null })).toMatch(/^None of your characters/);
    expect(words(titleRaceLine({ charName: 'Ann', pct: 40 }))).toBe(
      "Your best: Ann — at 40% of the holder's standing.",
    );
  });

  test('the game over: the board by score, the winner bold, titles and relics', () => {
    renderTitles({
      titles: {
        gameOver: {
          winner: 1,
          winnerName: '',
          byConcession: true,
          standings: [
            { index: 0, name: 'Low Realm', score: 3, relics: 1 },
            { index: 1, name: 'High Realm', score: 9, titleNames: ['The Throne'], relics: 2 },
            { index: 2, name: 'Mid Realm', score: 5, titleNames: [] },
          ],
        },
      },
    });
    const t = text('report-titles');
    expect(t).toContain('🏆 No-one holds the field — every rival has conceded!');
    expect(t).toContain('1High Realm9The Throne · 2 relics2Mid Realm53Low Realm31 relic');
    expect(htmlOf('report-titles')).toContain('font-weight:700;background:#fdf3d8');
    renderTitles({ titles: { gameOver: { winnerName: 'Ann Realm', byElimination: true } } });
    expect(text('report-titles')).toContain('🏆 Ann Realm is the last realm standing!');
    renderTitles({ titles: { gameOver: { winnerName: 'Ann Realm' } } });
    expect(text('report-titles')).toContain('is judged supreme at the Reckoning');
  });

  test('before the titles go public: the turn they do, 5 when none is given', () => {
    renderTitles({ titles: { publicFromTurn: 7 } });
    expect(text('report-titles')).toContain('until Turn 7.');
    renderTitles(null);
    expect(text('report-titles')).toContain('until Turn 5.');
    renderTitles({ titles: { publicFromTurn: 0 } });
    expect(text('report-titles')).toContain('until Turn 5.');
  });

  test('a public race: shares, gains, losses, the Reckoning called, the board and the titles in order', () => {
    g['currentReport'] = { playerIndex: 0 };
    g['reckoningCall'] = false;
    renderTitles({
      engineStamp: 'b123',
      titles: {
        public: true,
        myShare: 0.3,
        threshold: 0.416,
        myOwnShare: 0.25,
        callerMin: 0.21,
        soloThreshold: 0.35,
        allyStep: 0.05,
        blocSize: 3,
        reckoningMinTurn: 0,
        gains: [
          { initial: true, scope: 'minor', name: 'The Scout', charName: 'Ann', kingdomName: '', req: 'r1', perk: 'p1' },
          { name: 'The Sage' },
        ],
        losses: [
          { scope: 'minor', name: 'The Lost', vacant: true },
          { name: 'The Taken', newCharName: 'Bo', newHolderName: '' },
        ],
        reckoning: { byName: 'Red Realm', resolveAtTurn: 12, mine: true },
        standings: [
          { index: 1, name: 'An unknown realm', score: 2, unmet: true },
          { index: 0, name: 'Our Realm', score: 8 },
        ],
        holders: {
          throne: { mine: true, holderName: 'Our Realm', kingdomLevel: true, charName: 'Ann' },
          vault: { race: { vacant: true } },
          marshal: { race: { pct: 60 }, holderName: 'Red Realm', unmet: true, charName: 'Cy' },
          sea: { race: { pct: 80 }, holderName: 'Red Realm', charName: '' },
          spymaster: { name: '', prize: 0, race: { pct: 'x' as unknown as number } },
          cartographer: { name: 'The Cartographer', prize: 4 },
        },
        minor: { mine: [{ name: 'The Scout', holderName: 'Ann', req: 'see far', perk: '+1' }] },
      },
    });
    const t = text('report-titles');
    expect(t).toContain('🏅 The Imperial Titles are now public — titles you hold');
    expect(t).toContain('🎖 The Scout — Ann of your realm. Earned by: r1 Effect: p1');
    expect(t).toContain('🏆 The Sage — your realm. Earned by: Effect:');
    expect(t).toContain('🎖 The Lost — now stands vacant.');
    expect(t).toContain('🏆 The Taken — claimed by Bo of a rival.');
    expect(t).toContain('The Reckoning has been called by Red Realm. The world is judged at the end of Turn 12');
    expect(t).toContain('This is your claim');
    expect(t).toContain('👑 You hold The Throne');
    expect(t).toContain('Your bloc commands 30% of the world');
    expect(t).toContain('can be called at 42%. (12 more percentage points to go.)');
    expect(t).toContain('1Our Realm82An unknown realm (not yet encountered)2');
    expect(htmlOf('report-titles')).toMatch(/<tr style="font-weight:700"><td style="padding:2px 8px">1<\/td>/);
    // the order: held first, then vacant, then by percentage, a row with no race last
    expect(t).toMatch(
      /The Throne.*The Vaultkeeper.*The Sea Lord.*The Grand Marshal.*spymaster.*The Cartographer 4 pts/,
    );
    expect(t).toContain('Held by: Ann — Our Realm');
    expect(t).toContain('Held by: Cy of Red Realm — a realm you have not yet encountered');
    expect(t).toContain('Held by: — (Red Realm)');
    expect(t).toContain("resolved by the GM portal's build b123, which predates them");
    expect(t).toContain('spymaster 0 pts');
    expect(t).toContain('Turn 10 or later');
    expect(t).toContain('needs 35% in a 2-realm game; each ally in your bloc adds 5 points');
    expect(t).toContain('you have 2 allies, so your bar is 42%');
    expect(t).toContain('personally hold at least 21%');
    expect(t).toContain('🎖 The Scout — Ann Earn: see farPerk: +1');
  });

  test('the call: to be called, callable, too early, the caller short, short of the bar, met', () => {
    const base = { public: true, myShare: 0.5, threshold: 0.4, myOwnShare: 0.1, callerMin: 0.2 };
    g['reckoningCall'] = true;
    renderTitles({ titles: { ...base, canCallReckoning: true } });
    expect(text('report-titles')).toContain('You will Call the Reckoning this turn. If your bloc still holds 40%+');
    g['reckoningCall'] = false;
    renderTitles({ titles: { ...base, canCallReckoning: true } });
    expect(text('report-titles')).toContain('Your bloc commands 50% of the world (need 40%)');
    renderTitles({ titles: { ...base, callBlockedReason: 'tooEarly' } });
    expect(text('report-titles')).toContain('before Turn 10. Your bloc commands 50% of the world; 40% will be needed');
    renderTitles({ titles: { ...base, callBlockedReason: 'callerShort' } });
    expect(text('report-titles')).toContain(
      'your own realm holds just 10% of it, and a claimant must personally hold 20%',
    );
    expect(text('report-titles')).toContain('Your bloc meets the threshold, but your own realm holds 10%');
    renderTitles({ titles: { ...base, myShare: 0.39 } });
    expect(text('report-titles')).toContain('39% of the world; 40% is needed to Call the Reckoning.');
    expect(text('report-titles')).toContain('(1 more percentage point to go.)');
    renderTitles({ titles: { ...base, myOwnShare: null } });
    expect(text('report-titles')).toContain('You meet the threshold.');
    renderTitles({ titles: { public: true, standings: [] } });
    expect(text('report-titles')).toContain('0% is needed to Call the Reckoning.');
    expect(text('report-titles')).toContain('in a 2-realm game');
  });

  test("a bar the engine hands as a fraction shows its own whole percentage: 55% after a 2-realm game's first eroding turn", () => {
    // reckoningThreshold hands 55 / 100 (0.55), which times 100 is 55.00000000000001; likewise 56 / 100 (4 realms,
    // three eroding turns, a bloc of three).
    g['reckoningCall'] = false;
    for (const bar of [55, 56]) {
      renderTitles({ titles: { public: true, myShare: 0.5, threshold: bar / 100, myOwnShare: 0.5, callerMin: 0.2 } });
      expect(text('report-titles')).toContain(`50% of the world; ${String(bar)}% is needed to Call the Reckoning.`);
    }
  });

  test('the minor titles: none, none held, held', () => {
    expect(renderMinorTitles(null)).toBe('');
    expect(words(renderMinorTitles({ minor: {} }))).toContain('Your characters hold no minor titles yet.');
    expect(words(renderMinorTitles({ minor: { mine: [{ name: 'The Scout' }] } }))).toContain(
      '🎖 The Scout — Earn: Perk:',
    );
  });
});

describe('titles.ts: the Reckoning in the orders', () => {
  const orders = (titles: Record<string, unknown>) => {
    g['currentReport'] = { titles };
    renderReckoningOrders();
    return text('reckoning-wrap');
  };
  test('each reason it cannot be called, and the call', () => {
    expect(orders({ gameOver: {} })).toContain('The game is over');
    expect(orders({ reckoning: { byName: 'Red Realm', resolveAtTurn: 9 } })).toContain(
      'already been called by Red Realm. The world is judged at the end of Turn 9',
    );
    g['reckoningCall'] = true;
    expect(orders({ canCallReckoning: true, threshold: 0.4 })).toContain(
      'You will Call the Reckoning with these orders. If your bloc still holds 40%+',
    );
    g['reckoningCall'] = false;
    expect(orders({ canCallReckoning: true, myShare: 0.5, threshold: 0.4 })).toContain(
      "commands 50% of the world's tax base (need 40%)",
    );
    expect(orders({ callBlockedReason: 'tooEarly', reckoningMinTurn: 14 })).toContain('before Turn 14 —');
    expect(orders({ callBlockedReason: 'tooEarly' })).toContain('before Turn 10 —');
    expect(orders({ public: false, publicFromTurn: 6 })).toContain('until Turn 6 — the Reckoning');
    expect(orders({ public: false })).toContain('until Turn 5 — the Reckoning');
    expect(orders({ kingAlive: false })).toContain('your king is dead');
    expect(
      orders({ callBlockedReason: 'callerShort', myShare: 0.5, myOwnShare: 0.1, callerMin: 0.2, threshold: 0.4 }),
    ).toContain('holds only 10%. A claimant must personally hold 20% (half the 40% bar)');
    expect(orders({ callBlockedReason: 'callerShort', myShare: 0.3 })).toContain('holds only 30%');
    expect(orders({ myShare: 0.3, threshold: 0.4, blocSize: 3, soloThreshold: 0.3, allyStep: 0.05 })).toContain(
      '(10 more percentage points to go). Standing alone the bar would be 30% — each of your 2 allies raises it by 5 points.',
    );
    expect(orders({ myShare: 0.39, threshold: 0.4, blocSize: 2 })).toContain(
      '(1 more percentage point to go). Standing alone the bar would be 40% — each of your 1 ally raises it by 0 points.',
    );
    expect(orders({ myShare: 0.3, threshold: 0.4 })).not.toContain('Standing alone');
    expect(orders({ myShare: 0.5, threshold: 0.4 })).toContain(
      "commands 50% of the world's tax base (need 40%). The 👑 Call",
    );
    g['currentReport'] = null;
    renderReckoningOrders();
    expect(text('reckoning-wrap')).toContain("commands 0% of the world's tax base (need 0%)");
  });
});

describe("titles.ts: the spells' target field", () => {
  const provinces = [
    { id: 1, row: 0, col: 0, terrain: 'plain', name: 'Home Vale', neighbors: [2, 3, 4, 5, 6], tax: 7, features: [] },
    { id: 2, row: 0, col: 1, terrain: 'sea', name: 'Grey Sea', neighbors: [1] },
    { id: 3, row: 1, col: 0, terrain: 'forest', name: '', neighbors: [1], features: [{}] },
    { id: 4, row: 1, col: 1, terrain: 'hill', name: 'Lair Hill', neighbors: [1] },
    { id: 6, row: 0, col: 1, terrain: 'plain', neighbors: [1] },
  ];
  const report = {
    worldMeta: { provinces, cols: 2, rows: 2 },
    knownFeatures: [{ province: 'Lair Hill' }, { province: 'Grey Sea', cleared: true }],
    characters: [
      { id: 10, name: 'Caster', player: 0, locationId: 1, alive: true },
      { id: 11, name: 'Friend', player: 0, locationId: 1, locationName: 'Home Vale', alive: true },
      { id: 12, name: 'Far Friend', player: 0, locationId: 4, locationName: '', alive: true },
    ],
    allKingdoms: [
      { index: 0, name: 'Our Realm' },
      { index: 1, name: 'Red Realm', color: '#a03030' },
    ],
    playerIndex: 0,
    visibleChars: [
      { id: 20, name: 'Lone Foe', player: 1, locationId: 1, locationName: '' },
      { id: 21, name: 'Wanderer', player: null, locationId: 1, locationName: 'Home Vale' },
      { id: 22, name: 'Host Foe', player: 1, locationId: 1, armies: 2, locationName: 'Home Vale' },
      { id: 23, name: 'Banded Foe', player: 1, locationId: 1, leadsArmies: true, armyBand: 'a host' },
      { id: 24, name: 'King Foe', player: 1, locationId: 1, isKing: true },
      { id: 25, name: 'Far Foe', player: 1, locationId: 4 },
      { id: 26, name: 'One Foe', player: 1, locationId: 1, armies: 1 },
    ],
    everSeenChars: [
      null,
      { id: 30, name: '', player: 1, lastLocName: '', locationName: 'Grey Sea', lastSeenTurn: 3 },
      { id: 31, name: 'Seen Foe', player: 1, isWandering: true },
      { id: 32, name: 'Abe', player: 0 },
      { id: 33, name: 'Old Foe', player: 1, lastLocName: 'Lair Hill' },
    ],
    knownDeadHeroes: [
      { id: 40, name: 'Fallen', locationId: 1, wasOwnHero: true, killedOnTurn: 0 },
      { id: 41, name: 'Old King', locationId: '1', isKing: true },
      { id: 42, name: 'Monarch', locationId: 1, isKing: true, isMonarch: true, killedOnTurn: 4 },
      { id: 43, name: 'Foreign', locationId: 1, player: 1, raisable: 0, whyNot: '' },
      { id: 44, name: 'Stray', locationId: 1, player: null, raisable: 1 },
      { id: 45, name: 'Elsewhere', locationId: 4 },
      { id: 46, name: 'Old Report', locationName: 'Home Vale' },
    ],
  };
  const caster = { id: 10, player: 0, name: 'Caster', locationId: 1 };
  const field = (spell: string, extra: unknown = '', rep: Record<string, unknown> = report) =>
    String(spellSecondaryHtml(rep, caster, 0, spell, extra));
  const optionsOf = (html: string) => {
    const box = page.createElement('template');
    box.innerHTML = html;
    return [...box.content.querySelectorAll('option')].map((o) => (o.selected ? '* ' : '') + o.textContent);
  };

  test('a province spell lists the caster’s province and its neighbours, by the spell’s own rule', () => {
    expect(optionsOf(field('Bless Province', 3))).toEqual([
      '— Target province —',
      'Home Vale (here) — plain · tax base 7g',
      'Grey Sea — sea',
      '* Unknown province (Southeast) — forest',
      'Lair Hill — hill',
      'Unknown province (East) — plain',
    ]);
    expect(optionsOf(field('Flood'))).toEqual([
      '* — Target province —',
      'Home Vale (here) — plain',
      'Unknown province (Southeast) — forest',
      'Lair Hill — hill',
      'Unknown province (East) — plain',
    ]);
    expect(optionsOf(field('Hide Lairs'))).toEqual([
      '* — Target province —',
      'Unknown province (Southeast) — forest',
      'Lair Hill — hill',
    ]);
    const none = { ...report, worldMeta: { provinces: [{ id: 1, row: 0, col: 0, terrain: 'sea' }], cols: 1, rows: 1 } };
    expect(field('Flood', '', none)).toContain('placeholder="No land province here or adjacent"');
    expect(field('Hide Lairs', '', none)).toContain('placeholder="No discovered lairs here or adjacent"');
    expect(field('Part Sea', '', { ...report, worldMeta: null })).toContain(
      'placeholder="No province here or adjacent"',
    );
    expect(field('Bless Province', '', { ...report, worldMeta: null })).toContain(
      'placeholder="No valid target province in reach"',
    );
  });

  test('Resurrect lists the bodies in the caster’s province, raisable first, each with its reason', () => {
    expect(optionsOf(field('Resurrect', 44))).toEqual([
      '— Target character —',
      'Fallen — died turn ?',
      '👑 Monarch 👑 (your fallen monarch — reclaims the throne) — died turn 4',
      '* Stray ⚔ (wandering hero) — died turn ?',
      'Old King — cannot be raised: kings cannot be resurrected',
      'Foreign — cannot be raised: not a legal target',
    ]);
    const old = {
      ...report,
      knownDeadHeroes: undefined,
      deadHeroes: [{ id: 46, name: 'Old Report', locationId: 1 }],
    };
    g['currentReport'] = null;
    expect(optionsOf(field('Resurrect', '', old))).toContain('Old Report ⚔ (wandering hero) — died turn ?');
    expect(optionsOf(field('Resurrect', '', { ...report, knownDeadHeroes: [] }))[1]).toMatch(
      /^No fallen hero lies in /,
    );
  });

  test('Charm, Oratory, Phantasmal Armies, Clairvoyance, Control Undead, Telekinetic Storm and the rest', () => {
    expect(optionsOf(field('Charm', 21))).toEqual([
      '— Target character —',
      'Lone Foe ⚔ (Red Realm, no armies — yours for the turn) — ?',
      '* Wanderer (wandering — joins you free) — Home Vale',
    ]);
    expect(optionsOf(field('Charm', '', { ...report, visibleChars: [] }))[1]).toMatch(
      /^No valid target — needs a lone hero/,
    );
    expect(optionsOf(field('Oratory', 11))).toEqual(['— Target character —', 'Caster (self)', '* Friend — Home Vale']);
    expect(optionsOf(field('Phantasmal Armies', 10))).toEqual([
      '— Target character —',
      '* Caster (self)',
      'Friend — Home Vale',
    ]);
    expect(optionsOf(field('Clairvoyance', 33))).toEqual([
      '— Target character —',
      ' ⚔ (Red Realm) — last seen: Grey Sea (turn 3)',
      'Abe (yours) — last seen: ?',
      '* Old Foe ⚔ (Red Realm) — last seen: Lair Hill',
    ]);
    expect(optionsOf(field('Clairvoyance', '', { ...report, everSeenChars: [] }))).toHaveLength(7);
    expect(optionsOf(field('Clairvoyance', '', { ...report, everSeenChars: [], visibleChars: [] }))[1]).toBe(
      'You have not seen any enemy characters yet',
    );
    expect(optionsOf(field('Control Undead'))[0]).toBe('— Choose what to cast it on —');
    expect(optionsOf(field('Control Undead'))[1]).toMatch(/^\* 🔍 Cast on THIS province/);
    expect(optionsOf(field('Control Undead', 20))[2]).toBe(
      '* Lone Foe ⚔ (Red Realm) — seize one undead unit from them',
    );
    expect(optionsOf(field('Control Undead', 21))[3]).toBe('* Wanderer (wandering) — seize one undead unit from them');
    expect(optionsOf(field('Telekinetic Storm', 23))).toEqual([
      '— Target character —',
      'Host Foe ⚔ (Red Realm) — 2 units — Home Vale',
      '* Banded Foe ⚔ (Red Realm) — a host — ?',
      'One Foe ⚔ (Red Realm) — 1 unit — ?',
    ]);
    expect(optionsOf(field('Telekinetic Storm', '', { ...report, visibleChars: [] }))[1]).toBe(
      'No enemy/neutral hero leading armies in this province',
    );
    expect(optionsOf(field('Psychic Blast', 21))).toContain('* Wanderer (wandering) — Home Vale');
    expect(optionsOf(field('Psychic Blast', '', { ...report, visibleChars: [] }))[1]).toBe(
      'No enemy/neutral heroes in this province',
    );
    expect(field('Fireball')).toContain('type="hidden"');
  });
});
