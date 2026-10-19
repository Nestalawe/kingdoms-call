// The titles at the turn's end (plan P1-08k6, the last two stages of resolveTurn's own body lifted out): once the new
// turn is done, the realm holding each Imperial Title is told what it shows of the realms it has met (the title intel),
// then each realm's titles won and lost since last turn are worked out for its report (the title changes). Staged on
// the middle of a bot world (lib/middle-of-a-bot-world.ts), from plain realms each holding only its seat with a living
// king there (P1-08k5a's `stageCase`), each case with what must be true after it in game terms.
// The intel is told only from turn 5 (or once the game is over): the Throne (each realm's share of the world tax base),
// the Vaultkeeper (each treasury), the Grand Marshal and the Sea Lord (each realm's strongest land army and fleet, its
// commander and where he stands), the Monster-Bane (each realm's foremost monster-slayer), the Loremaster (every
// discovery each realm holds; one made last turn the holder lacks is copied), the Archmage (the foremost mage of each
// school outside the holder's realm), the Hierophant (the skills of every fallen hero the realm can see), the
// Deathpriest (each province with crack or elite dead, filed under Graveyards Known), the Spymaster (every act of
// espionage against the realm's land this turn, and who worked it), the Cartographer (each realm's atlas), the
// Beastlord and the Wildwarden (each realm's monsters and creatures under arms). A realm the holder hasn't met is
// neither named nor measured; one line says how many there are. The title changes: the first turn titles are public,
// every title a realm holds is announced; after it, only a title that changed hands, to its new holder, and its loss
// to the realm that held it; then this turn's holders are kept for the next.
// scenario/titles-at-the-turns-end-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn);
// unit/titles-at-the-turns-end-called-directly.test.ts calls the two stages directly on the staged world. A case
// stages its world and the heroes' orders; after them, it reads what it needs from the world and the log (`got`)
// beside what must be so (`want`), and the test compares the two. Every outcome is certain: every case fixes the dice
// for the whole turn (default LANDS: every percentile roll lands, every other die at its highest), so the outcome holds
// however many dice the turn draws before it. By default each realm holds only its seat (tax 10, 30g) with a living
// king there, with no skill a title counts, realms 0 and 1 are at war, 0 and 2 allied, 1 and 2 at peace (the board's
// relations), no realm has met another, every realm is Divine and Human, and the turn is turn 1.
import vm from 'node:vm';
import {
  LANDS,
  NO_TITLE_SKILLS,
  at,
  char,
  companies,
  holdsOnly,
  kingOf,
  leads,
  lineTo,
  realmOf,
  ring1,
  ring2,
  seatOf,
  told,
  turnIs,
  wanderer,
  playCase as playNewTurnCase,
  stageCase as stageNewTurnCase,
  type NewTurnCase,
  type Outcome,
  type Staged,
} from './new-turn-succession-and-summons-cases.ts';
import { fallenHero } from './new-turn-war-academy-to-the-final-reconcile-cases.ts';
import { concededBefore, decidedBefore, taxes } from './diplomacy-and-victory-cases.ts';
import { bury, realm } from './cast-spell-order-cases.ts';
import { must, order, type Board, type Character, type Province, type Unit } from './middle-of-a-bot-world.ts';

export { LANDS };
export type { Outcome, Staged };
/** A case: k5a's, with what it found and should have found of any shape (a list of lines, often). */
export interface TitleCase extends Omit<NewTurnCase, 'check'> {
  check(o: Outcome, s: Staged): { got: unknown; want: unknown };
}
const asNewTurnCase = (c: TitleCase): NewTurnCase => ({ ...c, check: () => ({ got: {}, want: {} }) });
/** Plays `c`, staged as `s` on `b`, through a whole turn, with the case's dice (P1-08k5a's `playCase`). */
export const playCase = (b: Board, c: TitleCase, s: Staged) => playNewTurnCase(b, asNewTurnCase(c), s);
/** Stages `c` on `b` (P1-08k5a's `stageCase`): plain realms, each holding only its seat (tax 10) with a living king
 *  there. */
export const stageCase = (b: Board, c: TitleCase) => stageNewTurnCase(b, asNewTurnCase(c));
type Raw = Record<string, unknown>;
const raw = (b: Board) => b.G as unknown as Raw;
const rawOf = (o: Outcome) => o.world as unknown as Raw;
const nothing = (): Staged => ({ orders: [] });
const hero = (s: Staged) => must(s.hero, 'the hero');
const other = (s: Staged, i: number) => must(s.others?.[i], 'hero ' + String(i));
const place = (s: Staged, i: number) => must(s.places?.[i], 'place ' + String(i));
const board = (s: Staged) => must(s.board, 'the board');

// ── Staging ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** The turn played is turn 4: the stages see turn 5, the first turn titles are public. */
export const firstPublic = (b: Board) => {
  turnIs(b, 4);
};
/** Realm `pi` has met exactly the realms `others`. */
export const meets = (b: Board, pi: number, ...others: number[]) => {
  realm(b, pi)['_encountered'] = others;
};
/** Every realm has met every other. */
export const allMet = (b: Board) => {
  b.G.players.forEach((_, pi) => {
    meets(b, pi, ...b.G.players.map((__, i) => i).filter((i) => i !== pi));
  });
};
/** A hero of realm `pi` (or none) in `p`, of `skills` (and no other a title counts), leading `us`. */
export const titled = (b: Board, pi: number | null, p: Province, skills: Record<string, number>, us: Unit[] = []) =>
  leads(at(b, { ...NO_TITLE_SKILLS, ...skills }, { player: pi, at: p }), us);
/** A hero's record of deeds the titles count (`tm`). */
export const deeds = (c: Character, tm: Record<string, number>) => {
  c['tm'] = { ...(c['tm'] ?? {}), ...tm };
  return c;
};
/** Realm `pi`'s treasury, set after `taxes` (which gives each realm 20 and its tax). */
export const treasury = (b: Board, pi: number, g: number) => {
  realm(b, pi)['gold'] = g;
};
/** A discovery as a realm holds it, made on turn `turn` (the Loremaster copies one made on the turn just played). */
export const discovery = (id: string, name: string, turn: number) => ({
  id,
  name,
  category: 'Military',
  desc: `${name}'s description.`,
  turnDiscovered: turn,
});
/** Realm `pi` holds exactly `ds`. */
export const holdsDiscoveries = (b: Board, pi: number, ...ds: ReturnType<typeof discovery>[]) => {
  realm(b, pi)['discoveries'] = ds;
};
/** Last turn's title snapshot: who held each title then (`major`/`minor`: key → hero id or realm), and whether titles
 *  were public then. A title not given was vacant. */
export const lastTurn = (
  b: Board,
  wasPublic: boolean,
  major: Record<string, [number | null, number | null]> = {},
  minor: Record<string, [number | null, number | null]> = {},
) => {
  const kingdom = new Set(['throne', 'vault']);
  raw(b)['_titlesSnapshot'] = {
    major: Object.fromEntries(
      MAJOR_KEYS.map((k) => [
        k,
        { charId: major[k]?.[0] ?? null, playerIndex: major[k]?.[1] ?? null, kingdomLevel: kingdom.has(k) },
      ]),
    ),
    minor: Object.fromEntries(
      MINOR_KEYS.map((k) => [k, { charId: minor[k]?.[0] ?? null, playerIndex: minor[k]?.[1] ?? null }]),
    ),
    wasPublic,
  };
};
/** The keys of the Imperial Titles, in the game's order (TITLE_DEFS). */
export const MAJOR_KEYS = [
  'throne',
  'vault',
  'marshal',
  'sea',
  'monster',
  'lore',
  'arch',
  'hiero',
  'necro',
  'spy',
  'carto',
  'beast',
  'wild',
];
/** The keys of the minor titles, in the game's order (MINOR_TITLES). */
export const MINOR_KEYS = [
  'duelist',
  'marksman',
  'strategist',
  'swift',
  'seawolf',
  'shadow',
  'cutpurse',
  'naturalist',
  'loreseeker',
  'trailblazer',
  'colossus',
  'widowmaker',
  'champion',
  'hostleader',
  'cavalier',
  'beastmaster',
  'ironclad',
  'relichunter',
  'castellan',
  'warlock',
];
/** Realm `pi` has mapped every province to `share` (and `ps` each to the share given). */
export const atlasOf = (b: Board, pi: number, share: number, ...ps: [Province, number][]) => {
  b.G.world.provinces.forEach((p) => {
    const e = (p['exploredBy'] as Record<number, number> | undefined) ?? {};
    e[pi] = share;
    p['exploredBy'] = e;
  });
  ps.forEach(([p, s]) => {
    (p['exploredBy'] as Record<number, number>)[pi] = s;
  });
};
/** A Master Spy of realm `by` (Spy 6, certain) standing in `p`, spying it out in each of the first `times` phases. */
export const spyIn = (b: Board, by: number, p: Province, times = 1): [Character, ReturnType<typeof order>[]] => {
  const h = titled(b, by, p, { spy: 6 });
  return [h, Array.from({ length: 5 }, (_, k) => (k < times ? order('spy', p.id) : order('defend')))];
};

// ── Reading the outcome ──────────────────────────────────────────────────────────────────────────────────────────
export const TITLE_NAMES = [
  'The Throne',
  'The Vaultkeeper',
  'The Grand Marshal',
  'The Sea Lord',
  'The Monster-Bane',
  'The Loremaster',
  'The Archmage',
  'The Hierophant',
  'The Deathpriest',
  'The Spymaster',
  'The Cartographer',
  'The Beastlord',
  'The Wildwarden',
];
const TAG = new RegExp(`^\\[(${TITLE_NAMES.join('|')})\\] `);
/** Every line of the title intel, in order: whom it is told to, and what it says. */
export const said = (o: Outcome) =>
  o.all.filter((l) => l.phase === 99 && TAG.test(l.text)).map((l) => [l.targets ?? null, l.text] as const);
/** The lines of one title's intel, in order. */
export const intel = (o: Outcome, title: string) => said(o).filter(([, t]) => t.startsWith(`[${title}] `));
/** The titles whose intel was told, in order, each once, with whom it was told to. */
export const titlesTold = (o: Outcome) => {
  const out: [string, unknown][] = [];
  said(o).forEach(([to, t]) => {
    const name = must(TAG.exec(t)?.[1], 'a title');
    if (!out.some(([n]) => n === name)) out.push([name, to]);
  });
  return out;
};
/** Realm `pi`'s name after the turn. */
export const nm = (o: Outcome, pi: number) => realmOf(o, pi).name;
/** The unmet line of `title`: `n` realms the holder hasn't met. */
export const unmetLine = (title: string, n: number) =>
  `[${title}] ${n === 1 ? 'One realm' : `${String(n)} realms`} your crown has not yet met — nothing may be gleaned of ${n === 1 ? 'it' : 'them'} until you do.`;
/** The title gains of each realm after the turn (realm → its gains). */
export const gains = (o: Outcome) => rawOf(o)['_titleGainsByPlayer'];
/** The title losses of each realm after the turn. */
export const losses = (o: Outcome) => rawOf(o)['_titleLossesByPlayer'];
/** This turn's snapshot, as the next turn reads it. */
export const snapshot = (o: Outcome) => rawOf(o)['_titlesSnapshot'] as Raw | undefined;
/** Who holds each title in the snapshot: key → [hero id, realm] for those held. */
export const holders = (o: Outcome) => {
  const s = snapshot(o) ?? {};
  const held = (x: unknown) =>
    Object.fromEntries(
      Object.entries((x as Record<string, { charId: number | null; playerIndex: number | null }> | undefined) ?? {})
        .filter(([, h]) => h.charId != null || h.playerIndex != null)
        .map(([k, h]) => [k, [h.charId, h.playerIndex]]),
    );
  return { major: held(s['major']), minor: held(s['minor']), wasPublic: s['wasPublic'] };
};
/** The game's own table of titles, as a case reads it (name, perk, requirement). */
export const titleDef = (s: Staged, key: string) => {
  const defs = vmJson(s, 'TITLE_DEFS') as Raw[];
  return must(
    defs.find((t) => t['key'] === key),
    'title ' + key,
  );
};
export const minorDef = (s: Staged, key: string) => {
  const defs = vmJson(s, 'MINOR_TITLES.map(t=>({key:t.key,name:t.name,perk:t.perk,req:t.req}))') as Raw[];
  return must(
    defs.find((t) => t['key'] === key),
    'minor title ' + key,
  );
};
/** `expr` read in the engine's vm (a top-level `const` is no property of its global object). */
export const vmJson = (s: Staged, expr: string) =>
  JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, board(s).engine) as string) as unknown;
/** A gain as the report reads it: an Imperial Title (`major`) or a minor one. */
export const majorGain = (
  s: Staged,
  key: string,
  { charName, kingdomName, initial }: { charName: string | null; kingdomName: string; initial: boolean },
) => {
  const t = titleDef(s, key);
  return {
    scope: 'major',
    key,
    name: t['name'],
    charName,
    kingdomName,
    kingdomLevel: !!t['kingdomLevel'],
    perk: t['perk'],
    req: t['req'],
    initial,
  };
};
export const minorGain = (
  s: Staged,
  key: string,
  { charName, kingdomName, initial }: { charName: string | null; kingdomName: string; initial: boolean },
) => {
  const t = minorDef(s, key);
  return { scope: 'minor', key, name: t['name'], charName, kingdomName, perk: t['perk'], req: t['req'], initial };
};
/** A loss as the report reads it. */
export const loss = (
  s: Staged,
  scope: 'major' | 'minor',
  key: string,
  to: { index: number | null; name: string | null; charName: string | null },
) => {
  const t = scope === 'major' ? titleDef(s, key) : minorDef(s, key);
  return {
    scope,
    key,
    name: t['name'],
    kingdomLevel: !!t['kingdomLevel'],
    vacant: to.index == null,
    newHolderIndex: to.index,
    newHolderName: to.name,
    newCharName: to.charName,
  };
};
/** The strength of a hero's companies after the turn, as the game reckons it. */
export const strengthOf = (o: Outcome, s: Staged, c: Character, naval: boolean) => {
  const f = board(s).engine['unitBaseStrength'] as (u: unknown) => number;
  const sea = new Set(vmJson(s, '[...SEA_TYPES]') as string[]);
  return char(o, c)
    .armies.filter((u) => sea.has(u.type) === naval)
    .reduce((n, u) => n + f(u), 0);
};

// ── When the intel is told ───────────────────────────────────────────────────────────────────────────────────────
export const GATE_CASES: TitleCase[] = [
  {
    name: 'before turn 5 no title tells its holder anything: the turn played is turn 3',
    stage(b) {
      turnIs(b, 3);
      allMet(b);
      return nothing();
    },
    check(o) {
      return { got: { said: said(o) }, want: { said: [] } };
    },
  },
  {
    name: 'from turn 5 each title held tells its holder, in the titles’ order: here the Throne and the Vaultkeeper, held by the first of three equal realms',
    stage(b) {
      firstPublic(b);
      return nothing();
    },
    check(o) {
      return {
        got: { told: titlesTold(o), lines: said(o).length },
        want: {
          told: [
            ['The Throne', [0]],
            ['The Vaultkeeper', [0]],
          ],
          lines: 4,
        },
      };
    },
  },
  {
    name: 'each line is the holder’s alone, after the phases, a system line of no hero or province',
    stage(b) {
      firstPublic(b);
      return nothing();
    },
    check(o) {
      return {
        got: { line: told(o, '[The Throne] Your realm: 33% of the world tax base.') },
        want: { line: lineTo(0) },
      };
    },
  },
  {
    name: 'once the game is over the titles are told even before turn 5',
    stage(b) {
      turnIs(b, 2);
      decidedBefore(b, { winner: 0, how: 'reckoning' });
      return nothing();
    },
    check(o) {
      return {
        got: { told: titlesTold(o) },
        want: {
          told: [
            ['The Throne', [0]],
            ['The Vaultkeeper', [0]],
          ],
        },
      };
    },
  },
];

// ── The Throne ───────────────────────────────────────────────────────────────────────────────────────────────────
export const THRONE_CASES: TitleCase[] = [
  {
    name: 'the Throne gives its holder its own share of the world tax base, rounded down, then each realm it has met, rounded, in realm order',
    stage(b) {
      firstPublic(b);
      taxes(b, 10, 5, 2);
      meets(b, 0, 2, 1);
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Throne'),
        want: [
          [[0], '[The Throne] Your realm: 58% of the world tax base.'],
          [[0], `[The Throne] ${nm(o, 1)}: 29% of the world tax base.`],
          [[0], `[The Throne] ${nm(o, 2)}: 12% of the world tax base.`],
        ],
      };
    },
  },
  {
    name: 'a realm the holder has not met is neither named nor measured: one line says how many (one)',
    stage(b) {
      firstPublic(b);
      taxes(b, 10, 5, 2);
      meets(b, 0, 2);
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Throne'),
        want: [
          [[0], '[The Throne] Your realm: 58% of the world tax base.'],
          [[0], `[The Throne] ${nm(o, 2)}: 12% of the world tax base.`],
          [[0], unmetLine('The Throne', 1)],
        ],
      };
    },
  },
  {
    name: 'the Throne is the realm with the largest tax base: realm 1’s, told to realm 1 alone, which met realm 0 only',
    stage(b) {
      firstPublic(b);
      taxes(b, 5, 10, 5);
      meets(b, 1, 0);
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Throne'),
        want: [
          [[1], '[The Throne] Your realm: 50% of the world tax base.'],
          [[1], `[The Throne] ${nm(o, 0)}: 25% of the world tax base.`],
          [[1], unmetLine('The Throne', 1)],
        ],
      };
    },
  },
  {
    name: 'a realm that has conceded is not counted among the unmet, but is named once met',
    stage(b) {
      firstPublic(b);
      concededBefore(b, 1);
      meets(b, 0, 2);
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Throne'),
        want: [
          [[0], '[The Throne] Your realm: 33% of the world tax base.'],
          [[0], `[The Throne] ${nm(o, 2)}: 33% of the world tax base.`],
        ],
      };
    },
  },
  {
    name: 'a realm eliminated is not counted among the unmet',
    stage(b) {
      firstPublic(b);
      realm(b, 2)['eliminated'] = true;
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Throne'),
        want: [
          [[0], '[The Throne] Your realm: 33% of the world tax base.'],
          [[0], unmetLine('The Throne', 1)],
        ],
      };
    },
  },
  {
    name: 'a world with no tax base at all: the realm with the largest treasury holds no Throne',
    stage(b) {
      firstPublic(b);
      taxes(b, 0, 0, 0);
      return nothing();
    },
    check(o) {
      return { got: { told: titlesTold(o) }, want: { told: [['The Vaultkeeper', [0]]] } };
    },
  },
];

// ── The Vaultkeeper ──────────────────────────────────────────────────────────────────────────────────────────────
export const VAULT_CASES: TitleCase[] = [
  {
    name: 'the Vaultkeeper gives its holder its own treasury after the turn’s taxes, then each realm it has met, in realm order',
    wholeTurnOnly: true,
    stage(b) {
      firstPublic(b);
      taxes(b, 10, 5, 2);
      meets(b, 0, 1, 2);
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Vaultkeeper'),
        want: [
          [[0], '[The Vaultkeeper] Your realm: 40g in treasury.'],
          [[0], `[The Vaultkeeper] ${nm(o, 1)}: 30g in treasury.`],
          [[0], `[The Vaultkeeper] ${nm(o, 2)}: 24g in treasury.`],
        ],
      };
    },
  },
  {
    name: 'the Vaultkeeper is the richest realm, whatever its tax: realm 2, which met realm 1 only',
    wholeTurnOnly: true,
    stage(b) {
      firstPublic(b);
      treasury(b, 2, 100);
      meets(b, 2, 1);
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Vaultkeeper'),
        want: [
          [[2], '[The Vaultkeeper] Your realm: 110g in treasury.'],
          [[2], `[The Vaultkeeper] ${nm(o, 1)}: 40g in treasury.`],
          [[2], unmetLine('The Vaultkeeper', 1)],
        ],
      };
    },
  },
  {
    name: 'a realm with an empty treasury is told as 0g',
    stage(b) {
      firstPublic(b);
      taxes(b, 10, 0, 0);
      treasury(b, 1, 0);
      meets(b, 0, 1, 2);
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Vaultkeeper').slice(1, 2),
        want: [[[0], `[The Vaultkeeper] ${nm(o, 1)}: 0g in treasury.`]],
      };
    },
  },
];

// ── The Grand Marshal and the Sea Lord ───────────────────────────────────────────────────────────────────────────
const MAA = (n: number, label: string) => companies(n, 'Men-at-Arms', 'Average', label);
const FLEET = (n: number, label: string) => companies(n, 'Galleon Fleet', 'Average', label);
/** A realm rich enough to pay its companies' wages all turn. */
const rich = (b: Board, ...pis: number[]) => {
  pis.forEach((pi) => {
    treasury(b, pi, 500);
  });
};
export const MARSHAL_CASES: TitleCase[] = [
  {
    name: 'the Grand Marshal names its holder’s strongest land army, its commander and where he stands, then each met realm’s; fleets don’t count',
    stage(b) {
      firstPublic(b);
      rich(b, 0, 1);
      meets(b, 0, 1);
      const m = titled(b, 0, seatOf(b, 0), { tactical: 1 }, [...MAA(2, 'Guard'), ...FLEET(3, 'Navy')]);
      leads(kingOf(b, 0), MAA(1, 'Royal'));
      const r = titled(b, 1, seatOf(b, 1), {}, MAA(3, 'Foe'));
      return { hero: m, others: [r], orders: [] };
    },
    check(o, s) {
      const [m, r] = [hero(s), other(s, 0)];
      return {
        got: intel(o, 'The Grand Marshal'),
        want: [
          [
            [0],
            `[The Grand Marshal] Your realm: strongest land army led by ${m.name} in ${seatOf(board(s), 0).name} (strength ${String(strengthOf(o, s, m, false))}).`,
          ],
          [
            [0],
            `[The Grand Marshal] ${nm(o, 1)}: strongest land army led by ${r.name} in ${seatOf(board(s), 1).name} (strength ${String(strengthOf(o, s, r, false))}).`,
          ],
          [[0], unmetLine('The Grand Marshal', 1)],
        ],
      };
    },
  },
  {
    name: 'the Grand Marshal with no land army of its own, and no rival with one: a fleet is no land army',
    stage(b) {
      firstPublic(b);
      rich(b, 0, 1, 2);
      allMet(b);
      titled(b, 0, seatOf(b, 0), { tactical: 1 }, FLEET(1, 'Navy'));
      titled(b, 1, seatOf(b, 1), {}, FLEET(2, 'Foe Navy'));
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Grand Marshal'),
        want: [
          [[0], '[The Grand Marshal] Your realm: no land army in the field.'],
          [[0], '[The Grand Marshal] No rival fields a land army this turn.'],
        ],
      };
    },
  },
  {
    name: 'of two equal land armies the first in the roll of heroes is named; a stronger one later is named over both',
    stage(b) {
      firstPublic(b);
      rich(b, 0, 1, 2);
      allMet(b);
      titled(b, 0, seatOf(b, 0), { tactical: 1 });
      const a = titled(b, 1, seatOf(b, 1), {}, MAA(2, 'A'));
      titled(b, 1, seatOf(b, 1), {}, MAA(2, 'B'));
      titled(b, 2, seatOf(b, 2), {}, MAA(1, 'C'));
      const d = titled(b, 2, seatOf(b, 2), {}, MAA(2, 'D'));
      return { others: [a, d], orders: [] };
    },
    check(o, s) {
      const named = (c: Character) => intel(o, 'The Grand Marshal').some(([, t]) => t.includes(`led by ${c.name} in`));
      return {
        got: { first: named(other(s, 0)), stronger: named(other(s, 1)), lines: intel(o, 'The Grand Marshal').length },
        want: { first: true, stronger: true, lines: 3 },
      };
    },
  },
  {
    name: 'a fallen commander’s army is not named, however strong',
    stage(b) {
      firstPublic(b);
      rich(b, 0, 1, 2);
      meets(b, 0, 1);
      titled(b, 0, seatOf(b, 0), { tactical: 1 });
      const d = titled(b, 1, ring2(b, 4), {}, MAA(5, 'Fallen'));
      d.alive = false;
      const r = titled(b, 1, seatOf(b, 1), {}, MAA(1, 'Living'));
      return { others: [r], orders: [] };
    },
    check(o, s) {
      return {
        got: intel(o, 'The Grand Marshal')[1]?.[1].includes(`led by ${other(s, 0).name} in`),
        want: true,
      };
    },
  },
  {
    name: 'the Grand Marshal is the hero of the highest Tactical: realm 1’s, told to realm 1',
    stage(b) {
      firstPublic(b);
      titled(b, 0, seatOf(b, 0), { tactical: 1 });
      titled(b, 1, seatOf(b, 1), { tactical: 2 });
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Grand Marshal'),
        want: [
          [[1], '[The Grand Marshal] Your realm: no land army in the field.'],
          [[1], '[The Grand Marshal] No rival fields a land army this turn.'],
          [[1], unmetLine('The Grand Marshal', 2)],
        ],
      };
    },
  },
  {
    name: 'an unmet realm’s army is not named, and leaves the rivals’ board empty',
    stage(b) {
      firstPublic(b);
      rich(b, 1);
      meets(b, 0, 2);
      titled(b, 0, seatOf(b, 0), { tactical: 1 });
      titled(b, 1, seatOf(b, 1), {}, MAA(3, 'Foe'));
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Grand Marshal').slice(1),
        want: [
          [[0], '[The Grand Marshal] No rival fields a land army this turn.'],
          [[0], unmetLine('The Grand Marshal', 1)],
        ],
      };
    },
  },
];
export const SEA_LORD_CASES: TitleCase[] = [
  {
    name: 'the Sea Lord names its holder’s strongest fleet, its commander and where he stands, then each met realm’s; land companies don’t count',
    stage(b) {
      firstPublic(b);
      rich(b, 0, 1);
      meets(b, 0, 1);
      const m = titled(b, 0, seatOf(b, 0), { naval: 1 }, [...FLEET(1, 'Navy'), ...MAA(1, 'Marines')]);
      leads(kingOf(b, 0), [...FLEET(2, 'Royal Navy'), ...MAA(1, 'Royal')]);
      const r = titled(b, 1, seatOf(b, 1), {}, [...FLEET(1, 'Foe Navy'), ...MAA(4, 'Foe')]);
      rich(b, 2);
      titled(b, 2, seatOf(b, 2), {}, FLEET(4, 'Unmet Navy'));
      return { hero: m, others: [r], orders: [] };
    },
    check(o, s) {
      const [k, r] = [kingOf(board(s), 0), other(s, 0)];
      return {
        got: intel(o, 'The Sea Lord'),
        want: [
          [
            [0],
            `[The Sea Lord] Your realm: strongest fleet led by ${k.name} in ${seatOf(board(s), 0).name} (strength ${String(strengthOf(o, s, k, true))}).`,
          ],
          [
            [0],
            `[The Sea Lord] ${nm(o, 1)}: strongest fleet led by ${r.name} in ${seatOf(board(s), 1).name} (strength ${String(strengthOf(o, s, r, true))}).`,
          ],
          [[0], unmetLine('The Sea Lord', 1)],
        ],
      };
    },
  },
  {
    name: 'the Sea Lord with no fleet of its own, and no rival with one',
    stage(b) {
      firstPublic(b);
      rich(b, 0, 1, 2);
      allMet(b);
      titled(b, 0, seatOf(b, 0), { naval: 1 }, MAA(1, 'Guard'));
      titled(b, 2, seatOf(b, 2), {}, MAA(2, 'Ally'));
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Sea Lord'),
        want: [
          [[0], '[The Sea Lord] Your realm: no fleet at sea.'],
          [[0], '[The Sea Lord] No rival fields a fleet this turn.'],
        ],
      };
    },
  },
];

// ── The Monster-Bane ─────────────────────────────────────────────────────────────────────────────────────────────
export const MONSTER_BANE_CASES: TitleCase[] = [
  {
    name: 'the Monster-Bane names its holder’s champion, then the foremost monster-slayer of each met realm, each with where he stands and his tally',
    stage(b) {
      firstPublic(b);
      meets(b, 0, 1);
      const c = deeds(titled(b, 0, seatOf(b, 0), {}), { monster: 5 });
      deeds(titled(b, 0, seatOf(b, 0), {}), { monster: 3 });
      deeds(titled(b, 1, seatOf(b, 1), {}), { monster: 1 });
      const r = deeds(titled(b, 1, seatOf(b, 1), {}), { monster: 2 });
      deeds(titled(b, 2, seatOf(b, 2), {}), { monster: 3 });
      return { hero: c, others: [r], orders: [] };
    },
    check(o, s) {
      const [c, r] = [hero(s), other(s, 0)];
      return {
        got: intel(o, 'The Monster-Bane'),
        want: [
          [
            [0],
            `[The Monster-Bane] Your champion: ${c.name} in ${seatOf(board(s), 0).name} with 5 monster-blood to their name.`,
          ],
          [[0], `[The Monster-Bane] ${nm(o, 1)}: ${r.name} in ${seatOf(board(s), 1).name} — 2 monster-blood.`],
          [[0], unmetLine('The Monster-Bane', 1)],
        ],
      };
    },
  },
  {
    name: 'of two equal slayers the first in the roll is named; a fallen slayer and a met realm with none are not',
    stage(b) {
      firstPublic(b);
      allMet(b);
      const c = deeds(titled(b, 0, seatOf(b, 0), {}), { monster: 4 });
      deeds(titled(b, 0, seatOf(b, 0), {}), { monster: 4 });
      deeds(fallenHero(b, 1, seatOf(b, 1), { killedOnTurn: b.G.turn }), { monster: 9 });
      return { hero: c, orders: [] };
    },
    check(o, s) {
      return {
        got: intel(o, 'The Monster-Bane'),
        want: [
          [
            [0],
            `[The Monster-Bane] Your champion: ${hero(s).name} in ${seatOf(board(s), 0).name} with 4 monster-blood to their name.`,
          ],
          [[0], '[The Monster-Bane] No rival realm has a hero who has drawn monster-blood worth noting.'],
        ],
      };
    },
  },
];

// ── The Loremaster ───────────────────────────────────────────────────────────────────────────────────────────────
/** Discovery `id` as the game's table has it, as a realm holds it, made on turn `turn`. */
const found = (s: Staged | Board, id: string, turn: number) => {
  const b = 'engine' in s ? s : board(s);
  const d = JSON.parse(
    vm.runInContext(`JSON.stringify((SAGE_DISCOVERIES_P.find(d=>d.id===${JSON.stringify(id)})))`, b.engine) as string,
  ) as { id: string; name: string; category: string; desc: string };
  return { id: d.id, name: d.name, category: d.category, desc: d.desc, turnDiscovered: turn };
};
const discoveriesOf = (o: Outcome, pi: number) => (realmOf(o, pi)['discoveries'] as Raw[] | undefined) ?? [];
const sage = (b: Board) => titled(b, 0, seatOf(b, 0), { sage: 1 });
export const LOREMASTER_CASES: TitleCase[] = [
  {
    name: 'the Loremaster lists every discovery each met realm holds, or that it holds none, and copies the one made on the turn just played that the holder lacks',
    stage(b) {
      firstPublic(b);
      allMet(b);
      sage(b);
      realm(b, 0)['discoveries'] = [found(b, 'sd03', 2)];
      realm(b, 1)['discoveries'] = [found(b, 'sd04', 1), found(b, 'sd05', 4)];
      return { board: b, orders: [] };
    },
    check(o, s) {
      const [d4, d5] = [found(s, 'sd04', 1), found(s, 'sd05', 4)];
      return {
        got: { lines: intel(o, 'The Loremaster'), held: discoveriesOf(o, 0) },
        want: {
          lines: [
            [[0], `[The Loremaster] ${nm(o, 1)} holds 2 discoveries: ${d4.name}, ${d5.name}.`],
            [[0], `[The Loremaster] ${nm(o, 2)} holds no discoveries at all.`],
            [
              [0],
              `[The Loremaster] Your scholars copy ${d5.name} from a rival's fresh notes — you now hold this discovery.`,
            ],
          ],
          held: [found(s, 'sd03', 2), found(s, 'sd05', 5)],
        },
      };
    },
  },
  {
    name: 'one discovery is “1 discovery”; one the holder already knows is not copied, nor one made on an earlier turn',
    stage(b) {
      firstPublic(b);
      meets(b, 0, 1, 2);
      sage(b);
      realm(b, 0)['discoveries'] = [found(b, 'sd04', 2)];
      realm(b, 1)['discoveries'] = [found(b, 'sd04', 4)];
      realm(b, 2)['discoveries'] = [found(b, 'sd05', 3)];
      return { board: b, orders: [] };
    },
    check(o, s) {
      return {
        got: { lines: intel(o, 'The Loremaster'), held: discoveriesOf(o, 0).length },
        want: {
          lines: [
            [[0], `[The Loremaster] ${nm(o, 1)} holds 1 discovery: ${found(s, 'sd04', 4).name}.`],
            [[0], `[The Loremaster] ${nm(o, 2)} holds 1 discovery: ${found(s, 'sd05', 3).name}.`],
          ],
          held: 1,
        },
      };
    },
  },
  {
    name: 'of the fresh discoveries the holder lacks, across the realms in order, the die picks one: at its highest the last',
    stage(b) {
      firstPublic(b);
      allMet(b);
      sage(b);
      realm(b, 1)['discoveries'] = [found(b, 'sd04', 4), found(b, 'sd05', 4)];
      realm(b, 2)['discoveries'] = [found(b, 'sd06', 4)];
      return { board: b, orders: [] };
    },
    check(o, s) {
      return {
        got: { copied: intel(o, 'The Loremaster').at(-1)?.[1], held: discoveriesOf(o, 0) },
        want: {
          copied: `[The Loremaster] Your scholars copy ${found(s, 'sd06', 4).name} from a rival's fresh notes — you now hold this discovery.`,
          held: [found(s, 'sd06', 5)],
        },
      };
    },
  },
  {
    name: 'with no met realm holding anything: each holds none, and none has anything worth copying',
    stage(b) {
      firstPublic(b);
      allMet(b);
      sage(b);
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Loremaster'),
        want: [
          [[0], `[The Loremaster] ${nm(o, 1)} holds no discoveries at all.`],
          [[0], `[The Loremaster] ${nm(o, 2)} holds no discoveries at all.`],
          [[0], '[The Loremaster] No rival realm has yet learned anything worth copying.'],
        ],
      };
    },
  },
  {
    name: 'an unmet realm’s discoveries are neither listed nor copied',
    stage(b) {
      firstPublic(b);
      meets(b, 0, 2);
      sage(b);
      realm(b, 1)['discoveries'] = [found(b, 'sd05', 4)];
      return nothing();
    },
    check(o) {
      return {
        got: { lines: intel(o, 'The Loremaster'), held: discoveriesOf(o, 0).length },
        want: {
          lines: [
            [[0], `[The Loremaster] ${nm(o, 2)} holds no discoveries at all.`],
            [[0], '[The Loremaster] No rival realm has yet learned anything worth copying.'],
            [[0], unmetLine('The Loremaster', 1)],
          ],
          held: 0,
        },
      };
    },
  },
];

// ── The Archmage ─────────────────────────────────────────────────────────────────────────────────────────────────
export const ARCHMAGE_CASES: TitleCase[] = [
  {
    name: 'the Archmage names the foremost mage of each school outside the holder’s realm, of the realms it has met or of none, with his level and where he stands',
    stage(b) {
      firstPublic(b);
      meets(b, 0, 1);
      titled(b, 0, seatOf(b, 0), { psychic: 2, illusory: 4 });
      titled(b, 1, seatOf(b, 1), { white: 3 });
      const r = titled(b, 1, seatOf(b, 1), { white: 3, melee: 2 });
      titled(b, 1, seatOf(b, 1), { white: 2, melee: 5 });
      const w = leads(wanderer(b, { ...NO_TITLE_SKILLS, elemental: 1 }), []);
      titled(b, 2, seatOf(b, 2), { necromancy: 2 });
      return { others: [r, w], orders: [] };
    },
    check(o, s) {
      const [r, w] = [other(s, 0), other(s, 1)];
      return {
        got: intel(o, 'The Archmage'),
        want: [
          [[0], `[The Archmage] White: ${r.name} (Level 3) of ${nm(o, 1)} in ${seatOf(board(s), 1).name}.`],
          [[0], '[The Archmage] Psychic: no mage of note outside your own realm.'],
          [[0], '[The Archmage] Illusory: no mage of note outside your own realm.'],
          [[0], `[The Archmage] Elemental: ${w.name} (Level 1), an independent hero guarding ${board(s).X.name}.`],
          [[0], '[The Archmage] Necromancy: no mage of note outside your own realm.'],
          [[0], unmetLine('The Archmage', 1)],
        ],
      };
    },
  },
  {
    name: 'of two mages of one level and one total, the first in the roll; a fallen mage is not named',
    stage(b) {
      firstPublic(b);
      allMet(b);
      titled(b, 0, seatOf(b, 0), { psychic: 3 });
      const a = titled(b, 1, seatOf(b, 1), { psychic: 2, melee: 1 });
      titled(b, 2, seatOf(b, 2), { psychic: 2, sage: 1 });
      fallenHero(b, 1, seatOf(b, 1), { killedOnTurn: b.G.turn }).skills['psychic'] = 5;
      return { hero: a, orders: [] };
    },
    check(o, s) {
      return {
        got: intel(o, 'The Archmage')[1],
        want: [[0], `[The Archmage] Psychic: ${hero(s).name} (Level 2) of ${nm(o, 1)} in ${seatOf(board(s), 1).name}.`],
      };
    },
  },
];

// ── The Hierophant ───────────────────────────────────────────────────────────────────────────────────────────────
/** The graveyard's record of `d`, given `skills`. */
const remembers = (b: Board, d: Character, skills: Record<string, number>) => {
  const g = must(
    ((raw(b)['heroGraveyard'] as Raw[] | undefined) ?? []).find((x) => x['id'] === d.id),
    'the grave',
  );
  g['skills'] = skills;
  return d;
};
const label = (s: Staged, k: string) => (vmJson(s, 'SKILL_LABELS') as Record<string, string>)[k];
export const HIEROPHANT_CASES: TitleCase[] = [
  {
    name: 'the Hierophant reads every fallen hero its realm can see: its own dead anywhere, and the dead in its land or where its heroes stand, each with the skills he carried, highest first',
    stage(b) {
      firstPublic(b);
      const t = b.G.turn;
      holdsOnly(b, 0, [seatOf(b, 0), 10], [ring1(b, 0), 0]);
      const watch = titled(b, 0, b.X, { white: 1 });
      const own = remembers(b, fallenHero(b, 0, ring2(b, 7), { killedOnTurn: t }), { melee: 3, white: 2, sage: 0 });
      const inLand = remembers(b, fallenHero(b, 1, ring1(b, 0), { killedOnTurn: t }), {});
      const unseen = remembers(b, fallenHero(b, 1, seatOf(b, 1), { killedOnTurn: t }), { spy: 4 });
      const wild = remembers(b, fallenHero(b, null, b.X, { killedOnTurn: t }), { druid: 1 });
      return { hero: watch, others: [own, inLand, unseen, wild], orders: [] };
    },
    check(o, s) {
      const [own, inLand, , wild] = [other(s, 0), other(s, 1), other(s, 2), other(s, 3)];
      const B = board(s);
      return {
        got: intel(o, 'The Hierophant'),
        want: [
          [
            [0],
            `[The Hierophant] The dead speak: ${own.name} of ${nm(o, 0)} lying in ${ring2(B, 7).name} — ${String(label(s, 'melee'))} 3, ${String(label(s, 'white'))} 2.`,
          ],
          [
            [0],
            `[The Hierophant] The dead speak: ${inLand.name} of ${nm(o, 1)} lying in ${ring1(B, 0).name} — no skills the grave remembers.`,
          ],
          [[0], `[The Hierophant] The dead speak: ${wild.name} lying in ${B.X.name} — ${String(label(s, 'druid'))} 1.`],
        ],
      };
    },
  },
  {
    name: 'a fallen king is read as a king',
    stage(b) {
      firstPublic(b);
      titled(b, 0, seatOf(b, 0), { white: 1 });
      const k = kingOf(b, 0);
      k.alive = false;
      k.hp = 0;
      seatOf(b, 0).characters = seatOf(b, 0).characters.filter((id) => id !== k.id);
      raw(b)['heroGraveyard'] = [
        {
          id: k.id,
          name: k.name,
          player: 0,
          isKing: true,
          killedOnTurn: b.G.turn,
          location: seatOf(b, 0).id,
          skills: {},
        },
      ];
      return { hero: k, orders: [] };
    },
    check(o, s) {
      return {
        got: intel(o, 'The Hierophant'),
        want: [
          [
            [0],
            `[The Hierophant] The dead speak: ${hero(s).name} of ${nm(o, 0)}, a king, lying in ${seatOf(board(s), 0).name} — no skills the grave remembers.`,
          ],
        ],
      };
    },
  },
  {
    name: 'with no fallen hero in sight the priests read nothing; the Hierophant says nothing of the realms unmet',
    stage(b) {
      firstPublic(b);
      titled(b, 0, seatOf(b, 0), { white: 1 });
      fallenHero(b, 1, seatOf(b, 1), { killedOnTurn: b.G.turn });
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Hierophant'),
        want: [[[0], '[The Hierophant] No fallen hero lies where your priests can read them this turn.']],
      };
    },
  },
];

// ── The Deathpriest ──────────────────────────────────────────────────────────────────────────────────────────────
/** Realm `pi`'s graveyard lore of `p` after the turn: its turn, what it records, and whether it saw only some. */
export const loreOf = (o: Outcome, pi: number, p: Province) => {
  const r = ((realmOf(o, pi)['_graveIntel'] as Record<string, Raw> | undefined) ?? {})[p.id];
  return r ? { turn: r['turn'], detail: r['detail'], partial: r['detailPartial'] } : null;
};
export const DEATHPRIEST_CASES: TitleCase[] = [
  {
    name: 'the Deathpriest’s Grave-sight names each province holding crack or elite dead, in the map’s order, and files each under Graveyards Known as a partial reading',
    stage(b) {
      firstPublic(b);
      titled(b, 0, seatOf(b, 0), { necromancy: 1 });
      const [p, q, r] = [ring2(b, 7), ring1(b, 2), ring1(b, 4)];
      bury(p, 2, 'Men-at-Arms', 'Crack');
      bury(p, 1, 'Men-at-Arms', 'Average');
      bury(q, 1, 'Free Lances', 'Elite');
      bury(r, 3, 'Men-at-Arms', 'Veteran');
      return { places: [p, q, r], orders: [] };
    },
    check(o, s) {
      const [p, q, r] = [place(s, 0), place(s, 1), place(s, 2)];
      const inOrder = [p, q].sort((x, y) => x.id - y.id);
      const n = (x: Province) => (x === p ? 2 : 1);
      return {
        got: { lines: intel(o, 'The Deathpriest'), p: loreOf(o, 0, p), q: loreOf(o, 0, q), r: loreOf(o, 0, r) },
        want: {
          lines: inOrder.map((x) => [
            [0],
            `[The Deathpriest] Grave-sight: ${x.name} holds ${String(n(x))} crack/elite dead. (Filed under Graveyards Known.)`,
          ]),
          p: { turn: 5, detail: [{ k: 'Crack Men-at-Arms', n: 2 }], partial: true },
          q: { turn: 5, detail: [{ k: 'Elite Free Lances', n: 1 }], partial: true },
          r: null,
        },
      };
    },
  },
  {
    name: 'Grave-sight files its finds with the realm holding the Deathpriest, not another',
    stage(b) {
      firstPublic(b);
      titled(b, 1, seatOf(b, 1), { necromancy: 1 });
      const p = ring1(b, 2);
      bury(p, 1, 'Men-at-Arms', 'Elite');
      return { places: [p], orders: [] };
    },
    check(o, s) {
      const p = place(s, 0);
      return {
        got: { told: intel(o, 'The Deathpriest').map(([to]) => to), mine: loreOf(o, 0, p), theirs: loreOf(o, 1, p) },
        want: {
          told: [[1]],
          mine: null,
          theirs: { turn: 5, detail: [{ k: 'Elite Men-at-Arms', n: 1 }], partial: true },
        },
      };
    },
  },
  {
    name: 'with no crack or elite dead anywhere, Grave-sight finds none',
    stage(b) {
      firstPublic(b);
      titled(b, 0, seatOf(b, 0), { necromancy: 1 });
      bury(ring1(b, 2), 2, 'Men-at-Arms', 'Veteran');
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Deathpriest'),
        want: [[[0], '[The Deathpriest] Grave-sight finds no crack or elite dead lying unclaimed this turn.']],
      };
    },
  },
];

// ── The Spymaster ────────────────────────────────────────────────────────────────────────────────────────────────
export const SPYMASTER_CASES: TitleCase[] = [
  {
    name: 'the Spymaster names each act of espionage worked against its land this turn, by the agent and where, then the roll of agents with a count',
    wholeTurnOnly: true,
    stage(b) {
      firstPublic(b);
      holdsOnly(b, 0, [seatOf(b, 0), 10], [b.X, 0]);
      deeds(titled(b, 0, seatOf(b, 0), { spy: 9 }), { spyActions: 5 });
      const [a, os] = spyIn(b, 1, b.X, 2);
      return { hero: a, orders: [[a, os]] };
    },
    check(o, s) {
      const a = hero(s);
      const act = `[The Spymaster] ${a.name} of ${nm(o, 1)} spied out the province in ${board(s).X.name}.`;
      return {
        got: intel(o, 'The Spymaster'),
        want: [
          [[0], act],
          [[0], act],
          [[0], `[The Spymaster] 2 intrusions into your lands this turn by 1 hero: ${a.name} (${nm(o, 1)}) ×2.`],
        ],
      };
    },
  },
  {
    name: 'espionage against ground the realm doesn’t hold is not its business: a quiet turn',
    wholeTurnOnly: true,
    stage(b) {
      firstPublic(b);
      deeds(titled(b, 0, seatOf(b, 0), { spy: 9 }), { spyActions: 5 });
      const [a, os] = spyIn(b, 1, b.X, 1);
      return { hero: a, orders: [[a, os]] };
    },
    check(o) {
      return {
        got: intel(o, 'The Spymaster'),
        want: [
          [
            [0],
            '[The Spymaster] Your counter-intelligence reports a quiet turn — no hand was raised against your lands.',
          ],
        ],
      };
    },
  },
];

// ── The Cartographer ─────────────────────────────────────────────────────────────────────────────────────────────
export const CARTOGRAPHER_CASES: TitleCase[] = [
  {
    name: 'the Cartographer gives its holder’s atlas (provinces fully charted, the world’s share mapped, rounded), then each met realm’s',
    stage(b) {
      firstPublic(b);
      meets(b, 0, 1);
      titled(b, 0, seatOf(b, 0), { explorer: 1 });
      atlasOf(b, 0, 100);
      atlasOf(b, 1, 0, [seatOf(b, 1), 100], [ring1(b, 0), 50], [ring1(b, 1), 70]);
      atlasOf(b, 2, 0);
      return nothing();
    },
    check(o) {
      const n = o.world.world.provinces.length;
      return {
        got: intel(o, 'The Cartographer'),
        want: [
          [[0], `[The Cartographer] Your atlas: ${String(n)} provinces fully charted, 100% of the world mapped.`],
          [
            [0],
            `[The Cartographer] ${nm(o, 1)}: 1 province fully charted, ${String(Math.round(220 / n))}% of the world mapped.`,
          ],
          [[0], unmetLine('The Cartographer', 1)],
        ],
      };
    },
  },
  {
    name: 'with no realm met, no rival remains to survey',
    stage(b) {
      firstPublic(b);
      titled(b, 0, seatOf(b, 0), { explorer: 1 });
      atlasOf(b, 0, 0);
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Cartographer'),
        want: [
          [[0], '[The Cartographer] Your atlas: 0 provinces fully charted, 0% of the world mapped.'],
          [[0], '[The Cartographer] No rival realm remains to survey.'],
          [[0], unmetLine('The Cartographer', 2)],
        ],
      };
    },
  },
];

// ── The Beastlord and the Wildwarden ─────────────────────────────────────────────────────────────────────────────
const garrison = (p: Province, us: Unit[]) => {
  p.garrisonArmies = us;
};
export const BEASTLORD_CASES: TitleCase[] = [
  {
    name: 'the Beastlord counts each realm’s monsters, led and garrisoned in its land, and names its largest host led: its own, then each met realm’s',
    stage(b) {
      firstPublic(b);
      rich(b, 0, 1, 2);
      allMet(b);
      const c = deeds(titled(b, 0, seatOf(b, 0), {}, [...companies(2, 'Cave Trolls'), ...MAA(1, 'Guard')]), {
        monsterHost: 3,
      });
      deeds(titled(b, 0, seatOf(b, 0), {}, companies(2, 'Cave Trolls', 'Average', 'Equal')), {});
      titled(b, 0, seatOf(b, 0), {}, companies(1, 'Cave Trolls', 'Average', 'Small'));
      garrison(seatOf(b, 0), [...companies(1, 'Cave Trolls', 'Average', 'Held'), ...MAA(1, 'Gate')]);
      garrison(seatOf(b, 1), companies(1, 'Manticore Pride'));
      return { hero: c, orders: [] };
    },
    check(o, s) {
      return {
        got: intel(o, 'The Beastlord'),
        want: [
          [
            [0],
            `[The Beastlord] Your realm: 6 monster units under arms, the largest host — 2 — with ${hero(s).name} in ${seatOf(board(s), 0).name}.`,
          ],
          [[0], `[The Beastlord] ${nm(o, 1)}: 1 monster unit under arms (all of them garrisoned).`],
          [[0], `[The Beastlord] ${nm(o, 2)}: no monsters under arms.`],
        ],
      };
    },
  },
  {
    name: 'the Beastlord with no monster left under arms, a creature is no monster, and no rival met',
    stage(b) {
      firstPublic(b);
      rich(b, 0);
      deeds(titled(b, 0, seatOf(b, 0), {}, companies(1, 'Great Bears')), { monsterHost: 1 });
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Beastlord'),
        want: [
          [[0], '[The Beastlord] Your realm: no monsters under arms.'],
          [[0], '[The Beastlord] No rival realm remains to reckon.'],
          [[0], unmetLine('The Beastlord', 2)],
        ],
      };
    },
  },
];
export const WILDWARDEN_CASES: TitleCase[] = [
  {
    name: 'the Wildwarden counts each realm’s creatures, led and garrisoned in its land, and names its greatest host led: its own, then each met realm’s',
    stage(b) {
      firstPublic(b);
      rich(b, 0, 1, 2);
      meets(b, 0, 1);
      const c = deeds(
        titled(b, 0, seatOf(b, 0), {}, [...companies(1, 'Great Bears'), ...companies(1, 'Cave Trolls')]),
        {
          wildHost: 3,
        },
      );
      const r = titled(b, 1, seatOf(b, 1), {}, companies(2, 'Forest Ents'));
      titled(b, 1, seatOf(b, 1), {}, companies(1, 'Forest Ents', 'Average', 'Other'));
      titled(b, 1, seatOf(b, 1), {}, companies(2, 'Forest Ents', 'Average', 'Equal'));
      garrison(seatOf(b, 1), [...companies(2, 'Great Bears'), ...MAA(1, 'Gate')]);
      return { hero: c, others: [r], orders: [] };
    },
    check(o, s) {
      return {
        got: intel(o, 'The Wildwarden'),
        want: [
          [
            [0],
            `[The Wildwarden] Your realm: 1 creature unit in the field, the greatest host — 1 — with ${hero(s).name} in ${seatOf(board(s), 0).name}.`,
          ],
          [
            [0],
            `[The Wildwarden] ${nm(o, 1)}: 7 creature units in the field, the greatest host — 2 — with ${other(s, 0).name} in ${seatOf(board(s), 1).name}.`,
          ],
          [[0], unmetLine('The Wildwarden', 1)],
        ],
      };
    },
  },
  {
    name: 'the Wildwarden: creatures only garrisoned, a rival with none, and no unmet realm',
    stage(b) {
      firstPublic(b);
      rich(b, 0, 1, 2);
      allMet(b);
      deeds(titled(b, 0, seatOf(b, 0), {}), { wildHost: 1 });
      garrison(seatOf(b, 0), companies(1, 'Great Bears'));
      return nothing();
    },
    check(o) {
      return {
        got: intel(o, 'The Wildwarden'),
        want: [
          [[0], '[The Wildwarden] Your realm: 1 creature unit in the field (all of them garrisoned).'],
          [[0], `[The Wildwarden] ${nm(o, 1)}: the wild answers to no one here.`],
          [[0], `[The Wildwarden] ${nm(o, 2)}: the wild answers to no one here.`],
        ],
      };
    },
  },
];

// ── The title changes ────────────────────────────────────────────────────────────────────────────────────────────
/** What each realm's king holds by default: the Throne and the Vaultkeeper (realm 0, the first of equal realms), the
 *  Colossus (the first of equal maximum HP) and the Castellan (the first king of the most provinces). */
const KINGS_HOLD = (s: Staged) => {
  const k = kingOf(board(s), 0).id;
  return {
    major: { throne: [k, 0], vault: [k, 0] },
    minor: { colossus: [k, 0], castellan: [k, 0] },
  };
};
export const CHANGES_CASES: TitleCase[] = [
  {
    name: 'before turn 5 no title is won or lost, and this turn’s holders are kept, as not yet public',
    stage(b) {
      lastTurn(b, false, { throne: [null, 1] });
      return { board: b, orders: [] };
    },
    check(o, s) {
      const major = snapshot(o)?.['major'] as Record<string, Raw> | undefined;
      const k = kingOf(board(s), 0).id;
      return {
        got: {
          gains: gains(o),
          losses: losses(o),
          holders: holders(o),
          throne: major?.['throne'],
          marshal: major?.['marshal'],
        },
        want: {
          gains: {},
          losses: {},
          holders: { ...KINGS_HOLD(s), wasPublic: false },
          throne: { charId: k, playerIndex: 0, kingdomLevel: true },
          marshal: { charId: null, playerIndex: null, kingdomLevel: false },
        },
      };
    },
  },
  {
    name: 'the first turn titles are public, every title a realm holds is announced to it as its first standing, in the titles’ order, Imperial then minor; nothing is lost',
    stage(b) {
      firstPublic(b);
      lastTurn(b, false, { throne: [null, 1], marshal: [kingOf(b, 1).id, 1] });
      const m = titled(b, 2, seatOf(b, 2), { tactical: 1 });
      return { hero: m, orders: [] };
    },
    check(o, s) {
      const [k, m] = [kingOf(board(s), 0), hero(s)];
      const [n0, n2] = [nm(o, 0), nm(o, 2)];
      return {
        got: { gains: gains(o), losses: losses(o), holders: holders(o) },
        want: {
          gains: {
            0: [
              majorGain(s, 'throne', { charName: null, kingdomName: n0, initial: true }),
              majorGain(s, 'vault', { charName: null, kingdomName: n0, initial: true }),
              minorGain(s, 'colossus', { charName: k.name, kingdomName: n0, initial: true }),
              minorGain(s, 'castellan', { charName: k.name, kingdomName: n0, initial: true }),
            ],
            2: [
              majorGain(s, 'marshal', { charName: m.name, kingdomName: n2, initial: true }),
              minorGain(s, 'strategist', { charName: m.name, kingdomName: n2, initial: true }),
            ],
          },
          losses: {},
          holders: {
            major: { ...KINGS_HOLD(s).major, marshal: [m.id, 2] },
            minor: { strategist: [m.id, 2], ...KINGS_HOLD(s).minor },
            wasPublic: true,
          },
        },
      };
    },
  },
  {
    name: 'with no snapshot of last turn, the first public turn announces every title held',
    stage(b) {
      firstPublic(b);
      return { board: b, orders: [] };
    },
    check(o, s) {
      const k = kingOf(board(s), 0);
      const n0 = nm(o, 0);
      return {
        got: { gains: gains(o), losses: losses(o) },
        want: {
          gains: {
            0: [
              majorGain(s, 'throne', { charName: null, kingdomName: n0, initial: true }),
              majorGain(s, 'vault', { charName: null, kingdomName: n0, initial: true }),
              minorGain(s, 'colossus', { charName: k.name, kingdomName: n0, initial: true }),
              minorGain(s, 'castellan', { charName: k.name, kingdomName: n0, initial: true }),
            ],
          },
          losses: {},
        },
      };
    },
  },
  {
    name: 'after the first public turn, a realm’s title taken by another realm: won by the new holder, lost by the old with who took it',
    stage(b) {
      turnIs(b, 6);
      const k0 = kingOf(b, 0).id;
      lastTurn(b, true, { throne: [kingOf(b, 1).id, 1], vault: [k0, 0] }, { colossus: [k0, 0], castellan: [k0, 0] });
      return { board: b, orders: [] };
    },
    check(o, s) {
      return {
        got: { gains: gains(o), losses: losses(o) },
        want: {
          gains: { 0: [majorGain(s, 'throne', { charName: null, kingdomName: nm(o, 0), initial: false })] },
          losses: { 1: [loss(s, 'major', 'throne', { index: 0, name: nm(o, 0), charName: null })] },
        },
      };
    },
  },
  {
    name: 'a hero’s title taken by another realm’s hero: won with the new holder’s name, lost with his name and realm',
    stage(b) {
      turnIs(b, 6);
      const k0 = kingOf(b, 0).id;
      rich(b, 0);
      const was = titled(b, 1, seatOf(b, 1), {});
      const m = titled(b, 0, seatOf(b, 0), { tactical: 1 });
      lastTurn(
        b,
        true,
        { throne: [k0, 0], vault: [k0, 0], marshal: [was.id, 1] },
        { colossus: [k0, 0], castellan: [k0, 0], strategist: [m.id, 0] },
      );
      return { hero: m, orders: [] };
    },
    check(o, s) {
      const m = hero(s);
      return {
        got: { gains: gains(o), losses: losses(o) },
        want: {
          gains: { 0: [majorGain(s, 'marshal', { charName: m.name, kingdomName: nm(o, 0), initial: false })] },
          losses: { 1: [loss(s, 'major', 'marshal', { index: 0, name: nm(o, 0), charName: m.name })] },
        },
      };
    },
  },
  {
    name: 'a title fallen vacant is lost by the realm that held it, to nobody; nobody wins it',
    stage(b) {
      turnIs(b, 6);
      const k0 = kingOf(b, 0).id;
      lastTurn(
        b,
        true,
        { throne: [k0, 0], vault: [k0, 0], marshal: [kingOf(b, 2).id, 2] },
        { colossus: [k0, 0], castellan: [k0, 0], strategist: [kingOf(b, 2).id, 2] },
      );
      return { board: b, orders: [] };
    },
    check(o, s) {
      return {
        got: { gains: gains(o), losses: losses(o) },
        want: {
          gains: {},
          losses: {
            2: [
              loss(s, 'major', 'marshal', { index: null, name: null, charName: null }),
              loss(s, 'minor', 'strategist', { index: null, name: null, charName: null }),
            ],
          },
        },
      };
    },
  },
  {
    name: 'a hero’s title passing to another hero of the same realm is won again by the realm, and lost by nobody',
    stage(b) {
      turnIs(b, 6);
      const k0 = kingOf(b, 0).id;
      rich(b, 0);
      const was = titled(b, 0, seatOf(b, 0), {});
      const m = titled(b, 0, seatOf(b, 0), { tactical: 1 });
      lastTurn(
        b,
        true,
        { throne: [k0, 0], vault: [k0, 0], marshal: [was.id, 0] },
        { colossus: [k0, 0], castellan: [k0, 0], strategist: [m.id, 0] },
      );
      return { hero: m, orders: [] };
    },
    check(o, s) {
      return {
        got: { gains: gains(o), losses: losses(o) },
        want: {
          gains: { 0: [majorGain(s, 'marshal', { charName: hero(s).name, kingdomName: nm(o, 0), initial: false })] },
          losses: {},
        },
      };
    },
  },
  {
    name: 'a realm’s title kept by the realm under another king is neither won nor lost; titles kept are not told again',
    stage(b) {
      turnIs(b, 6);
      const k0 = kingOf(b, 0).id;
      lastTurn(b, true, { throne: [k0 + 1000, 0], vault: [k0, 0] }, { colossus: [k0, 0], castellan: [k0, 0] });
      return { board: b, orders: [] };
    },
    check(o, s) {
      return {
        got: { gains: gains(o), losses: losses(o), holders: holders(o) },
        want: { gains: {}, losses: {}, holders: { ...KINGS_HOLD(s), wasPublic: true } },
      };
    },
  },
  {
    name: 'a minor title taken by another realm’s hero: won as a minor title, lost with the new holder’s name',
    stage(b) {
      turnIs(b, 6);
      const k0 = kingOf(b, 0).id;
      lastTurn(b, true, { throne: [k0, 0], vault: [k0, 0] }, { colossus: [kingOf(b, 1).id, 1], castellan: [k0, 0] });
      return { board: b, orders: [] };
    },
    check(o, s) {
      const k = kingOf(board(s), 0);
      return {
        got: { gains: gains(o), losses: losses(o) },
        want: {
          gains: { 0: [minorGain(s, 'colossus', { charName: k.name, kingdomName: nm(o, 0), initial: false })] },
          losses: { 1: [loss(s, 'minor', 'colossus', { index: 0, name: nm(o, 0), charName: k.name })] },
        },
      };
    },
  },
  {
    name: 'an old snapshot that was public but lists no holders: every title held is won (not as a first standing), none lost',
    stage(b) {
      turnIs(b, 6);
      raw(b)['_titlesSnapshot'] = { wasPublic: true };
      return { board: b, orders: [] };
    },
    check(o, s) {
      const k = kingOf(board(s), 0);
      const n0 = nm(o, 0);
      return {
        got: { gains: gains(o), losses: losses(o) },
        want: {
          gains: {
            0: [
              majorGain(s, 'throne', { charName: null, kingdomName: n0, initial: false }),
              majorGain(s, 'vault', { charName: null, kingdomName: n0, initial: false }),
              minorGain(s, 'colossus', { charName: k.name, kingdomName: n0, initial: false }),
              minorGain(s, 'castellan', { charName: k.name, kingdomName: n0, initial: false }),
            ],
          },
          losses: {},
        },
      };
    },
  },
  {
    name: 'once the game is over the titles are public before turn 5: the first standing is announced',
    stage(b) {
      turnIs(b, 2);
      decidedBefore(b, { winner: 0, how: 'reckoning' });
      lastTurn(b, false);
      return { board: b, orders: [] };
    },
    check(o) {
      return {
        got: {
          won: Object.fromEntries(
            Object.entries((gains(o) as Record<string, Raw[]> | undefined) ?? {}).map(([pi, gs]) => [
              pi,
              gs.map((g) => [g['key'], g['initial']]),
            ]),
          ),
          wasPublic: holders(o).wasPublic,
        },
        want: {
          won: {
            0: [
              ['throne', true],
              ['vault', true],
              ['colossus', true],
              ['castellan', true],
            ],
          },
          wasPublic: true,
        },
      };
    },
  },
];

// ── The order of it all ──────────────────────────────────────────────────────────────────────────────────────────
export const ORDER_CASES: TitleCase[] = [
  {
    name: 'the intel comes after the new turn is done: the Vaultkeeper reads the treasuries after the taxes and the wages, the Throne the land as the turn leaves it',
    wholeTurnOnly: true,
    stage(b) {
      firstPublic(b);
      taxes(b, 10, 20, 0);
      treasury(b, 0, 100);
      treasury(b, 1, 90);
      titled(b, 1, seatOf(b, 1), {});
      meets(b, 0, 1);
      meets(b, 1, 0);
      return nothing();
    },
    check(o) {
      const paid = 90 + 20 - Number(realmOf(o, 1)['gold']);
      return {
        got: { vault: intel(o, 'The Vaultkeeper').slice(0, 2), throne: intel(o, 'The Throne')[0], paid: paid > 0 },
        want: {
          vault: [
            [[0], '[The Vaultkeeper] Your realm: 110g in treasury.'],
            [[0], `[The Vaultkeeper] ${nm(o, 1)}: ${String(110 - paid)}g in treasury.`],
          ],
          throne: [[1], '[The Throne] Your realm: 66% of the world tax base.'],
          paid: true,
        },
      };
    },
  },
  {
    name: 'a discovery the Loremaster copies is in the realm’s hands before the title changes are worked out, and both stages run once, intel first',
    stage(b) {
      firstPublic(b);
      allMet(b);
      sage(b);
      realm(b, 1)['discoveries'] = [found(b, 'sd05', 4)];
      return { board: b, orders: [] };
    },
    check(o, s) {
      const lore = o.all.findIndex((l) => l.text.startsWith('[The Loremaster] Your scholars copy'));
      return {
        got: {
          copied: lore >= 0,
          last: said(o).at(-1)?.[1].startsWith('[The Loremaster] Your scholars copy'),
          held: discoveriesOf(o, 0).map((d) => d['id']),
          snapshot: holders(o).wasPublic,
        },
        want: { copied: true, last: true, held: [found(s, 'sd05', 4).id], snapshot: true },
      };
    },
  },
];

// ── Every case ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Every case, by part of the stages. */
export const TITLE_CASES: [string, TitleCase[]][] = [
  ['when the intel is told', GATE_CASES],
  ['the Throne', THRONE_CASES],
  ['the Vaultkeeper', VAULT_CASES],
  ['the Grand Marshal', MARSHAL_CASES],
  ['the Sea Lord', SEA_LORD_CASES],
  ['the Monster-Bane', MONSTER_BANE_CASES],
  ['the Loremaster', LOREMASTER_CASES],
  ['the Archmage', ARCHMAGE_CASES],
  ['the Hierophant', HIEROPHANT_CASES],
  ['the Deathpriest', DEATHPRIEST_CASES],
  ['the Spymaster', SPYMASTER_CASES],
  ['the Cartographer', CARTOGRAPHER_CASES],
  ['the Beastlord', BEASTLORD_CASES],
  ['the Wildwarden', WILDWARDEN_CASES],
  ['the title changes', CHANGES_CASES],
  ['the order of it all', ORDER_CASES],
];
