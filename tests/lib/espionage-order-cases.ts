// The espionage orders' cases (plan P1-08j6): Spy (on a province or on a hero), Steal, Sabotage, Grand Heist,
// Assassinate and Vanish, staged on the middle of a bot world (lib/middle-of-a-bot-world.ts), from plain realms, each
// with what must be true after it in game terms. scenario/espionage-orders-in-a-whole-turn.test.ts plays each through a
// whole turn (resolveTurn); unit/espionage-orders-called-directly.test.ts calls each order's own function on them, one
// phase at a time. A case stages its world and the heroes' orders; after them, it reads what it needs from the world and
// the log (`got`) beside what must be so (`want`), and the test compares the two.
// Every outcome is certain. These orders roll dice, so a case that reaches a roll fixes the dice for the whole turn
// (`dice`): every percentile roll at one number and every other die at one value, so the outcome holds however many
// dice the turn draws before the order. Realms 0 and 1 are at war, 0 and 2 allied (the board's relations).
import vm from 'node:vm';
import {
  hero,
  must,
  order,
  plan,
  withDice,
  withRolls,
  type Board,
  type Character,
  type HeroSpec,
  type Line,
  type Order,
  type Province,
  type Unit,
  type World,
} from './middle-of-a-bot-world.ts';
import { companies, item, type Item } from './item-and-army-order-cases.ts';
import { plainRealms } from './recruit-hire-and-realm-works-order-cases.ts';

export interface Staged {
  /** The hero whose orders the case is about. */
  hero: Character;
  /** Every hero given orders, with them (the hero's own first). */
  orders: [Character, Order[]][];
  /** The hero spied on, robbed or stalked. */
  mark?: Character;
  /** Another hero the case needs (a warden, a courier's addressee). */
  other?: Character;
  /** A province the case needs besides the middle. */
  there?: Province;
}
/** An experience roll, as trySkillGain starts it: whose, which skill, at what chance. */
export interface ExperienceRoll {
  id: unknown;
  skill: string;
  base: unknown;
}
export interface Outcome {
  world: World;
  /** The hero's own lines in the log. */
  lines: Line[];
  /** Every line in the log. */
  all: Line[];
  /** The turn the orders were played in. */
  turn: number;
  /** Every experience roll started in the turn. */
  xp: ExperienceRoll[];
}
/** The dice for the whole turn: every percentile roll (d100) at `roll` (1 to 100), every other die at `die` ([0, 1)). */
export interface Dice {
  roll: number;
  die: number;
}
export interface EspionageOrderCase {
  name: string;
  /** Plays only in a whole turn: processOrder refuses the order before the order's own function runs (a mastery order
   *  given twice in a turn), or the turn's end shows it (a courier's parcel arriving). */
  wholeTurnOnly?: boolean;
  /** The dice, when the case reaches a roll. */
  dice?: Dice;
  stage(b: Board): Staged;
  /** What the case found after the orders, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

/** Every roll lands; every other die at its lowest (a failed thief slips away). */
export const LUCKY: Dice = { roll: 1, die: 0 };
/** Every roll misses; every other die at its highest (a failed thief is caught, a guard's blow does 4). */
export const UNLUCKY: Dice = { roll: 100, die: 0.99999 };
/** Every roll misses, but every other die at its lowest: a failed thief slips away. */
export const MISSES_BUT_SLIPS_AWAY: Dice = { roll: 100, die: 0 };
/** Every roll lands, every other die at its highest. */
export const LANDS_WITH_HIGH_DICE: Dice = { roll: 1, die: 0.99999 };

/** Runs `body` with the case's dice, if it fixes them. */
export const withCaseDice = <T>(engine: vm.Context, dice: Dice | undefined, body: () => T): T =>
  dice ? withDice(engine, [dice.die], () => withRolls(engine, dice.roll, body)) : body();

/** Records every experience roll the engine starts, by wrapping the top-level trySkillGain (plan P1-08c), into the
 *  list `recordExperienceRolls` hands back for the length of `body`. Wrap once per engine. */
export const recordExperienceRolls = (engine: vm.Context) => {
  vm.runInContext(
    `{ const tryOne=trySkillGain;
       trySkillGain=function(turnContext, char, skill, base){
         if(globalThis.__xp) globalThis.__xp.push({id:char&&char.id,skill,base});
         return tryOne.apply(this, arguments); }; }`,
    engine,
  );
  return <T>(body: () => T): { result: T; xp: ExperienceRoll[] } => {
    const xp: ExperienceRoll[] = [];
    engine['__xp'] = xp;
    try {
      return { result: body(), xp };
    } finally {
      engine['__xp'] = undefined;
    }
  };
};

const text = (ls: Line[]) => ls.map((l) => l.text).join('\n');
/** Whether the hero's lines say `what`. */
const says = (o: Outcome, what: string) => text(o.lines).includes(what);
/** Whether any line of the turn says `what`. */
const anySays = (o: Outcome, what: string) => o.all.some((l) => l.text.includes(what));
/** The realms the first line saying `what` goes to (null if no line says it). */
const toldTo = (o: Outcome, what: string) => o.all.find((l) => l.text.includes(what))?.targets ?? null;
const char = (o: Outcome, c: Character) =>
  must(
    o.world.characters.find((x) => x.id === c.id),
    'hero ' + c.name,
  );
const province = (o: Outcome, p: Province) => must(o.world.world.provinces[p.id], 'province ' + p.name);
const pack = (o: Outcome, c: Character) => char(o, c).items.map((i) => String(i['name']));
const names = (us: { unitName?: unknown }[] | undefined) => (us ?? []).map((u) => String(u.unitName));
/** A hero's Spymaster count (spy actions that landed). */
const spyActions = (o: Outcome, c: Character) =>
  (char(o, c)['tm'] as { spyActions?: number } | undefined)?.spyActions ?? 0;
/** The kinds of espionage the turn put in the Spymaster's ledger against `c`. */
const ledger = (o: Outcome, c: Character) =>
  (
    (o.world as unknown as { _espionageLedger?: { charId: number; kind: string; provId: number }[] })
      ._espionageLedger ?? []
  )
    .filter((e) => e.charId === c.id)
    .map((e) => `${e.kind} @${String(e.provId)}`);
/** Experience rolls `c` started in `skill`, as their chances. */
const xpIn = (o: Outcome, c: Character, skill: string) =>
  o.xp.filter((x) => x.id === c.id && x.skill === skill).map((x) => x.base);
/** Whether `p` is marked as the scene of a personal combat this turn between the realms in `pis` (purple swords). */
const fightMarked = (o: Outcome, p: Province) =>
  (province(o, p)['_combatPlayersThisTurn'] as number[] | undefined) ?? [];
/** The gold realm `i` held once the phases were over: as the turn's end tells it ("<realm> has <n>g in the treasury.",
 *  before its taxes and wages), or, where no turn's end ran (an order's own function called directly), its treasury. */
const treasury = (o: Outcome, i: number) => {
  const said = `${realmName(o, i)} has `;
  const line = o.all.find((l) => l.text.startsWith(said) && l.text.endsWith('g in the treasury.'));
  return line
    ? Number(line.text.slice(said.length, -'g in the treasury.'.length))
    : Number(must(o.world.players[i], 'realm ' + String(i))['gold']);
};
const realm = (b: Board, i = 0) => must(b.G.players[i], 'realm ' + String(i));
const realmName = (o: Outcome, i: number) => must(o.world.players[i], 'realm ' + String(i)).name;
/** A hero of `player` (default realm 0) standing in the middle (or `at`), at full health, of Spy and Thief `skills`.
 *  His maximum HP is the turn's own reckoning of it (15 to start, and what he has earned), so the turn keeps it. */
const at = (b: Board, skills: Record<string, number> = {}, extra: Partial<HeroSpec> = {}) => {
  const h = hero(b, { player: 0, at: b.X, skills: { melee: 2, tactical: 2, march: 1, spy: 0, ...skills }, ...extra });
  h['hpEarned'] = Math.max(0, h.maxHp - 15);
  if (h.player != null) {
    const heroes = (realm(b, h.player)['heroes'] as number[] | undefined) ?? [];
    realm(b, h.player)['heroes'] = [...heroes, h.id];
  }
  return h;
};
/** A hero of realm 1 (the enemy; or `player`) standing in the middle, of no Spy or Thief unless `skills` says so. */
const rival = (b: Board, extra: Partial<HeroSpec> = {}, skills: Record<string, number> = {}) =>
  at(b, skills, { player: 1, ...extra });
/** A hero who answers a challenge (a thief he catches is brought to a duel). */
const accepts = (c: Character) => {
  c['encounterPlan'] = { tactics: ['ME'], duelStance: 'accept' };
  return c;
};
const holding = (h: Character, ...items: Item[]) => {
  h.items = items;
  return h;
};
const leads = (h: Character, us: Unit[]) => {
  h.armies = us;
  return h;
};
const knows = (b: Board, i: number, ...ids: string[]) => {
  realm(b, i)['discoveries'] = ids.map((id) => ({ id }));
};
/** The Crystal Orb as an older save holds it (`effect:{stat:'oracle'}`, the power the Spy order reads). The relic a
 *  lair deals today names its power `spyAuto`, which nothing reads (STATUS, Parked). */
export const oldCrystalOrb = (b: Board): Item => ({ ...item(b, 'Crystal Orb'), effect: { stat: 'oracle', bonus: 1 } });
/** The Cloak of Many Faces as an older save holds it (`effect:{stat:'hidden'}`, the power the Spy order reads). The
 *  relic a lair deals today names its power `untargetable`, which nothing reads (STATUS, Parked). */
export const oldCloakOfManyFaces = (b: Board): Item => ({
  ...item(b, 'Cloak of Many Faces'),
  effect: { stat: 'hidden', bonus: 1 },
});
const one = (c: Character, ...os: Order[]): [Character, Order[]] => [c, plan(...os)];
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
const SMALL = 0.04; // SKILLGAIN_COMMON: a failed attempt's small chance to learn
const STD = 0.1; // SKILLGAIN_STD

// ── Spy, on the province he stands in ───────────────────────────────────────────────────────────────────────────
/** A spy of realm 0 in the middle, of Spy `n` (and `skills`), sent to spy out the middle. */
const spyHere = (b: Board, n: number, skills: Record<string, number> = {}): Staged => {
  const h = at(b, { spy: n, ...skills });
  return { hero: h, orders: [one(h, order('spy', b.X.id))], there: b.X };
};
const there = (s: Staged) => must(s.there, 'the province');
/** The spy's roll line, as `📊 Spy — <hero> (Spy n) in <province>: <working>`. */
const spyRoll = (o: Outcome, s: Staged, level: number, working: string) =>
  says(o, `📊 Spy — ${s.hero.name} (Spy ${String(level)}) in ${there(s).name}: ${working}`);
/** Whether the spy learned what the province holds (`owner` its realm's name, or "no-one"). */
const learned = (o: Outcome, s: Staged, owner: string) =>
  says(
    o,
    `${s.hero.name} spies on ${there(s).name}: controlled by ${owner}, tax ${String(province(o, there(s))['tax'])}g, defenders: none.`,
  );
const missed = (o: Outcome, s: Staged) =>
  says(
    o,
    `${s.hero.name}'s espionage in ${there(s).name} yields little — the attempt went undetected but nothing useful was learned.`,
  );
/** The realms warned that realm 0's agents were prying in the province (null: none). */
const alarm = (o: Outcome, s: Staged) =>
  toldTo(
    o,
    `[Intelligence] 🕵 Counter-intelligence: your watch in ${there(s).name} caught ${realmName(o, 0)}'s agents prying this turn.`,
  );
export const SPY_ON_A_PROVINCE_ORDER_CASES: EspionageOrderCase[] = [
  {
    name: 'Spy: a Master Spy (Spy 6) needs no roll: he learns the province, and the realm holding it is warned',
    stage(b) {
      b.own(b.X, 1);
      return spyHere(b, 6);
    },
    check(o, s) {
      return {
        got: {
          roll: spyRoll(o, s, 5, 'automatic success (Master Spy)'),
          learned: learned(o, s, realmName(o, 1)),
          warned: alarm(o, s),
          spymaster: spyActions(o, s.hero),
          ledger: ledger(o, s.hero),
          spiedOut: must(o.world.players[0], 'realm 0')['_spiedProvincesThisTurn'],
        },
        want: {
          roll: true,
          learned: true,
          warned: [1],
          spymaster: 1,
          ledger: [`spied out the province @${String(there(s).id)}`],
          spiedOut: [there(s).id],
        },
      };
    },
  },
  {
    name: 'Spy: a Crystal Orb (as an older save holds it) makes it certain for a hero of no Spy',
    dice: UNLUCKY,
    stage(b) {
      b.own(b.X, 1);
      const s = spyHere(b, 0);
      holding(s.hero, oldCrystalOrb(b));
      return s;
    },
    check(o, s) {
      return {
        got: { roll: spyRoll(o, s, 0, 'automatic success (Crystal Orb)'), learned: learned(o, s, realmName(o, 1)) },
        want: { roll: true, learned: true },
      };
    },
  },
  {
    name: 'Spy: the Crystal Orb a lair deals today makes nothing certain (its power is read by nothing)',
    dice: UNLUCKY,
    stage(b) {
      b.own(b.X, 1);
      const s = spyHere(b, 0);
      holding(s.hero, item(b, 'Crystal Orb'));
      return s;
    },
    check(o, s) {
      return {
        got: { roll: spyRoll(o, s, 0, '20% [roll 100 ✗]'), missed: missed(o, s) },
        want: { roll: true, missed: true },
      };
    },
  },
  {
    name: 'Spy: a spy who misses learns nothing, raises no alarm, and has a small chance to learn Spy',
    dice: UNLUCKY,
    stage(b) {
      b.own(b.X, 1);
      return spyHere(b, 1);
    },
    check(o, s) {
      return {
        got: {
          roll: spyRoll(o, s, 1, '40% [roll 100 ✗]'),
          missed: missed(o, s),
          learned: learned(o, s, realmName(o, 1)),
          warned: alarm(o, s),
          lessons: xpIn(o, s.hero, 'spy'),
          spymaster: spyActions(o, s.hero),
          ledger: ledger(o, s.hero),
        },
        want: {
          roll: true,
          missed: true,
          learned: false,
          warned: null,
          lessons: [SMALL],
          spymaster: 0,
          ledger: [],
        },
      };
    },
  },
  {
    name: 'Spy: Spy 1 lands on a roll within 40%, and is a chance to learn Spy',
    dice: LUCKY,
    stage(b) {
      b.own(b.X, 1);
      return spyHere(b, 1);
    },
    check(o, s) {
      return {
        got: {
          roll: spyRoll(o, s, 1, '40% [roll 1 ✓]'),
          learned: learned(o, s, realmName(o, 1)),
          lessons: xpIn(o, s.hero, 'spy'),
        },
        want: { roll: true, learned: true, lessons: [STD] },
      };
    },
  },
  {
    name: 'Spy: each level of Spy adds 20 to the chance (Spy 3: 80%)',
    dice: LUCKY,
    stage(b) {
      return spyHere(b, 3);
    },
    check(o, s) {
      return { got: { roll: spyRoll(o, s, 3, '80% [roll 1 ✓]') }, want: { roll: true } };
    },
  },
  {
    name: 'Spy: Forgery Arts adds 40 (Spy 1: 80%)',
    dice: LUCKY,
    stage(b) {
      knows(b, 0, 'sd21');
      return spyHere(b, 1);
    },
    check(o, s) {
      return { got: { roll: spyRoll(o, s, 1, '80% [roll 1 ✓]') }, want: { roll: true } };
    },
  },
  {
    name: 'Spy: Cipher Scripts in the realm holding the province take 45 off: Spy 1 misses even on a roll of 1',
    dice: LUCKY,
    stage(b) {
      b.own(b.X, 1);
      knows(b, 1, 'sd19');
      return spyHere(b, 1);
    },
    check(o, s) {
      return {
        got: { roll: spyRoll(o, s, 1, '0% [roll 1 ✗]'), missed: missed(o, s) },
        want: { roll: true, missed: true },
      };
    },
  },
  {
    // the order form and the bots send no province for a Spy on the province he stands in (STATUS, Parked)
    name: 'Spy: as the order form sends it (no province named), Cipher Scripts in the realm holding the province take nothing off',
    dice: LUCKY,
    stage(b) {
      b.own(b.X, 1);
      knows(b, 1, 'sd19');
      const h = at(b, { spy: 1 });
      return { hero: h, orders: [one(h, order('spy'))], there: b.X };
    },
    check(o, s) {
      return {
        got: { roll: spyRoll(o, s, 1, '40% [roll 1 ✓]'), learned: learned(o, s, realmName(o, 1)), warned: alarm(o, s) },
        want: { roll: true, learned: true, warned: [1] },
      };
    },
  },
  {
    name: 'Spy: Cipher Scripts guard only their realm’s own ground: in a province nobody holds they take nothing off',
    dice: LUCKY,
    stage(b) {
      knows(b, 1, 'sd19');
      return spyHere(b, 1);
    },
    check(o, s) {
      return {
        got: { roll: spyRoll(o, s, 1, '40% [roll 1 ✓]'), learned: learned(o, s, 'no-one'), warned: alarm(o, s) },
        want: { roll: true, learned: true, warned: null },
      };
    },
  },
  {
    name: 'Spy: on his own realm’s ground no alarm is raised',
    stage(b) {
      b.own(b.X, 0);
      return spyHere(b, 6);
    },
    check(o, s) {
      return {
        got: { learned: learned(o, s, realmName(o, 0)), warned: alarm(o, s) },
        want: { learned: true, warned: null },
      };
    },
  },
  {
    name: 'Spy: with Disguise Techniques, a landed spy whose disguise roll lands raises no alarm',
    dice: LUCKY,
    stage(b) {
      b.own(b.X, 1);
      knows(b, 0, 'sd23');
      return spyHere(b, 1);
    },
    check(o, s) {
      return {
        got: {
          disguise: says(
            o,
            `📊 Disguise Techniques — ${s.hero.name} works under a false face in ${there(s).name}: 65% [roll 1 ✓] — the disguise holds; no alarm is raised.`,
          ),
          learned: learned(o, s, realmName(o, 1)),
          warned: alarm(o, s),
        },
        want: { disguise: true, learned: true, warned: null },
      };
    },
  },
  {
    name: 'Spy: with Disguise Techniques, a disguise roll that misses lets the alarm be raised',
    dice: UNLUCKY,
    stage(b) {
      b.own(b.X, 1);
      knows(b, 0, 'sd23');
      return spyHere(b, 6);
    },
    check(o, s) {
      return {
        got: {
          disguise: says(
            o,
            `📊 Disguise Techniques — ${s.hero.name} works under a false face in ${there(s).name}: 65% [roll 100 ✗] — the disguise slips; the province’s watch will report the intrusion.`,
          ),
          warned: alarm(o, s),
        },
        want: { disguise: true, warned: [1] },
      };
    },
  },
  {
    name: 'Spy: a spy who misses rolls for no disguise',
    dice: UNLUCKY,
    stage(b) {
      b.own(b.X, 1);
      knows(b, 0, 'sd23');
      return spyHere(b, 1);
    },
    check(o) {
      return { got: { disguise: says(o, 'Disguise Techniques') }, want: { disguise: false } };
    },
  },
  {
    name: 'Spy: a disguise left on the hero by an earlier order is put aside: the alarm is raised',
    stage(b) {
      b.own(b.X, 1);
      const s = spyHere(b, 6);
      s.hero['_spyDisguised'] = true;
      return s;
    },
    check(o, s) {
      return {
        got: { warned: alarm(o, s), disguised: char(o, s.hero)['_spyDisguised'] },
        want: { warned: [1], disguised: false },
      };
    },
  },
  {
    name: 'Spy: spying out a rival crown’s capital tells its income and how many heroes it commands',
    stage(b) {
      b.own(b.X, 1);
      realm(b, 1)['homeProvinceId'] = b.X.id;
      rival(b);
      return spyHere(b, 6);
    },
    check(o) {
      return {
        got: {
          capital: says(o, `[Intelligence] Home-capital intelligence on ${realmName(o, 1)}: the crown draws ~`),
          heroes: says(o, 'g in tax income each turn and commands 1 hero beyond the king.'),
        },
        want: { capital: true, heroes: true },
      };
    },
  },
  {
    name: 'Spy: the province the order names only decides which discoveries count: he spies out the one he stands in',
    stage(b) {
      const far = ring1(b, 0);
      b.own(far, 1);
      const h = at(b, { spy: 6 });
      return { hero: h, orders: [one(h, order('spy', far.id))], there: b.X };
    },
    check(o, s) {
      return { got: { learned: learned(o, s, 'no-one') }, want: { learned: true } };
    },
  },
];

// ── Spy, on a hero beside him ───────────────────────────────────────────────────────────────────────────────────
/** A spy of realm 0 of Spy `n` in the middle, sent to read `mark`. */
const spyOn = (b: Board, mark: Character, n: number, skills: Record<string, number> = {}): Staged => {
  const h = at(b, { spy: n, ...skills });
  return { hero: h, orders: [one(h, order('spy', `char:${String(mark.id)}`))], mark, there: b.X };
};
const markOf = (s: Staged) => must(s.mark, 'the hero spied on');
/** The read's roll line: `📊 Spy on <mark> — <hero> (Spy n) in <province>: <working>`. */
const readRoll = (o: Outcome, s: Staged, level: number, working: string) =>
  says(o, `📊 Spy on ${markOf(s).name} — ${s.hero.name} (Spy ${String(level)}) in ${there(s).name}: ${working}`);
/** Whether the spy wrote his report on the mark (`of` the mark's realm's words, e.g. " of <realm>"). */
const report = (o: Outcome, s: Staged, of: string, what: string) =>
  says(o, `[Intelligence] 🔍 ${s.hero.name}'s report on ${markOf(s).name}${of} (Human, Divine): ${what}`);
const notFound = (o: Outcome, s: Staged, who: string) =>
  says(
    o,
    `${s.hero.name} looks for ${who} in ${there(s).name}, but they are not to be found here — the spying comes to nothing.`,
  );
/** The detection roll's line: `📊 Detection — <mark><what his realm may know> noticing <hero><where>: <working>`. */
const detection = (o: Outcome, s: Staged, rest: string) => says(o, `📊 Detection — ${markOf(s).name}${rest}`);
const caughtSpying = (o: Outcome, s: Staged) =>
  toldTo(
    o,
    `[Intelligence] ${s.hero.name} (${realmName(o, 0)}) was caught spying on ${markOf(s).name} in ${there(s).name}.`,
  );
const drivenOff = (o: Outcome, s: Staged, catcher: Character, what: string) =>
  anySays(
    o,
    `${catcher.name} catches ${s.hero.name} ${what}, but wants no part in a brawl — the thief is driven off empty-handed.`,
  );
const bladesDrawn = (o: Outcome, s: Staged, catcher: Character, what: string) =>
  anySays(o, `⚔ ${catcher.name} catches ${s.hero.name} ${what} — blades are drawn!`);
const spiedHero = (o: Outcome, s: Staged) =>
  (must(o.world.players[0], 'realm 0')['_spiedHeroSkills'] as Record<string, Record<string, unknown>> | undefined)?.[
    String(markOf(s).id)
  ];
export const SPY_ON_A_HERO_ORDER_CASES: EspionageOrderCase[] = [
  {
    name: 'Spy on a hero: a hero who is elsewhere is not to be found, and nothing is rolled',
    stage(b) {
      return spyOn(b, rival(b, { at: ring1(b, 0) }), 3);
    },
    check(o, s) {
      return {
        got: { notFound: notFound(o, s, markOf(s).name), rolled: says(o, '📊') },
        want: { notFound: true, rolled: false },
      };
    },
  },
  {
    name: 'Spy on a hero: one of his own realm’s heroes is not spied on',
    stage(b) {
      return spyOn(b, at(b), 3);
    },
    check(o, s) {
      return { got: { notFound: notFound(o, s, markOf(s).name) }, want: { notFound: true } };
    },
  },
  {
    name: 'Spy on a hero: a fallen hero is “their quarry”, not to be found',
    stage(b) {
      const m = rival(b);
      m.alive = false;
      return spyOn(b, m, 3);
    },
    check(o, s) {
      return { got: { notFound: notFound(o, s, 'their quarry') }, want: { notFound: true } };
    },
  },
  {
    name: 'Spy on a hero: a Cloak of Many Faces (as an older save holds it) hides its wearer, and nothing is rolled',
    stage(b) {
      return spyOn(b, holding(rival(b), oldCloakOfManyFaces(b)), 6);
    },
    check(o, s) {
      return {
        got: {
          hidden: says(
            o,
            `${s.hero.name} shadows ${markOf(s).name} through ${there(s).name}, but can never quite fix on a face — nothing is learned. (Cloak of Many Faces)`,
          ),
          rolled: says(o, '📊'),
        },
        want: { hidden: true, rolled: false },
      };
    },
  },
  {
    name: 'Spy on a hero: the Cloak of Many Faces a lair deals today hides nobody (its power is read by nothing)',
    dice: UNLUCKY,
    stage(b) {
      return spyOn(b, holding(rival(b), item(b, 'Cloak of Many Faces')), 6);
    },
    check(o, s) {
      return {
        got: {
          roll: readRoll(o, s, 5, 'automatic success (Master Spy)'),
          report: report(
            o,
            s,
            ` of ${realmName(o, 1)}`,
            'skills — Melee 2, Tactical 2, March 1. Items — Cloak of Many Faces.',
          ),
        },
        want: { roll: true, report: true },
      };
    },
  },
  {
    name: 'Spy on a hero: a Master Spy reads every skill, item and company, and his realm keeps them',
    dice: UNLUCKY,
    stage(b) {
      const m = leads(holding(rival(b), item(b, 'Tome of Tactics')), companies(2, 'Men-at-Arms', 'Average', 'Guard'));
      return spyOn(b, m, 6);
    },
    check(o, s) {
      const kept = spiedHero(o, s);
      return {
        got: {
          roll: readRoll(o, s, 5, 'automatic success (Master Spy)'),
          report: report(
            o,
            s,
            ` of ${realmName(o, 1)}`,
            'skills — Melee 2, Tactical 2, March 1. Items — Tome of Tactics. Leads — ',
          ),
          kept: kept && {
            kingdom: kept['kingdom'],
            skills: kept['skills'],
            items: kept['items'],
            armies: kept['armies'],
          },
          companies: o.lines.some(
            (l) => l.text.startsWith('[Intelligence] 🔍') && l.text.includes('Guard c0') && l.text.includes('Guard c1'),
          ),
          spymaster: spyActions(o, s.hero),
          ledger: ledger(o, s.hero),
          caught: caughtSpying(o, s),
        },
        want: {
          roll: true,
          report: true,
          kept: {
            kingdom: realmName(o, 1),
            skills: { melee: 2, tactical: 2, march: 1, spy: 0 },
            items: ['Tome of Tactics'],
            armies: [
              { type: 'Men-at-Arms', quality: 'Average', unitName: 'Guard c0' },
              { type: 'Men-at-Arms', quality: 'Average', unitName: 'Guard c1' },
            ],
          },
          companies: true,
          spymaster: 1,
          ledger: [`read one of your heroes @${String(there(s).id)}`],
          caught: null,
        },
      };
    },
  },
  {
    name: 'Spy on a hero: a spy who misses learns nothing, has a small chance to learn Spy, and sees only whether he was noticed',
    dice: UNLUCKY,
    stage(b) {
      return spyOn(b, rival(b), 1);
    },
    check(o, s) {
      return {
        got: {
          roll: readRoll(o, s, 1, '35% [roll 100 ✗]'),
          missed: says(
            o,
            `${s.hero.name} watches ${markOf(s).name} closely in ${there(s).name}, but learns nothing of use.`,
          ),
          report: says(o, '🔍'),
          lessons: xpIn(o, s.hero, 'spy'),
          detection: detection(o, s, ` noticing ${s.hero.name}: [✗]`),
          caught: caughtSpying(o, s),
          spymaster: spyActions(o, s.hero),
        },
        want: {
          roll: true,
          missed: true,
          report: false,
          lessons: [SMALL],
          detection: true,
          caught: null,
          spymaster: 0,
        },
      };
    },
  },
  {
    name: 'Spy on a hero: a spy who lands may still be caught: the hero’s realm is told, and a hero who won’t brawl drives him off',
    dice: LUCKY,
    stage(b) {
      return spyOn(b, rival(b), 1);
    },
    check(o, s) {
      return {
        got: {
          roll: readRoll(o, s, 1, '35% [roll 1 ✓]'),
          report: report(
            o,
            s,
            ` of ${realmName(o, 1)}`,
            'skills — Melee 2, Tactical 2, March 1. Items — no magic items. Leads — no armies.',
          ),
          detection: detection(o, s, ` (Spy 0) noticing ${s.hero.name}: 10% [roll 1 ✓]`),
          caught: caughtSpying(o, s),
          drivenOff: drivenOff(o, s, markOf(s), 'spying on them'),
          lessons: xpIn(o, s.hero, 'spy'),
        },
        want: { roll: true, report: true, detection: true, caught: [1], drivenOff: true, lessons: [STD] },
      };
    },
  },
  {
    name: 'Spy on a hero: Shadow Couriers add 50 to reading a hero (Spy 1: 85%)',
    dice: LUCKY,
    stage(b) {
      knows(b, 0, 'sd62');
      return spyOn(b, rival(b), 1);
    },
    check(o, s) {
      return { got: { roll: readRoll(o, s, 1, '85% [roll 1 ✓]') }, want: { roll: true } };
    },
  },
  {
    name: 'Spy on a hero: each level of the hero’s Spy adds 10 to catching the spy, each of the spy’s takes 10 off',
    dice: LUCKY,
    stage(b) {
      return spyOn(b, rival(b, {}, { spy: 3 }), 2);
    },
    check(o, s) {
      return {
        got: { detection: detection(o, s, ` (Spy 3) noticing ${s.hero.name}: 30% [roll 1 ✓]`) },
        want: { detection: true },
      };
    },
  },
  {
    name: 'Spy on a hero: in the hero’s own realm’s land he is 15 likelier to catch the spy',
    dice: LUCKY,
    stage(b) {
      b.own(b.X, 1);
      return spyOn(b, rival(b), 1);
    },
    check(o, s) {
      return {
        got: { detection: detection(o, s, ` (Spy 0) noticing ${s.hero.name} in their own land: 25% [roll 1 ✓]`) },
        want: { detection: true },
      };
    },
  },
  {
    name: 'Spy on a hero: in the spy’s own realm’s land he is 15 less likely to be caught',
    dice: LUCKY,
    stage(b) {
      b.own(b.X, 0);
      return spyOn(b, rival(b, {}, { spy: 2 }), 1);
    },
    check(o, s) {
      return {
        got: { detection: detection(o, s, ` (Spy 2) noticing ${s.hero.name} in your land: 15% [roll 1 ✓]`) },
        want: { detection: true },
      };
    },
  },
  {
    name: 'Spy on a hero: Informer Rewards in the hero’s realm add 50 to catching the spy',
    dice: LUCKY,
    stage(b) {
      knows(b, 1, 'sd63');
      return spyOn(b, rival(b), 1);
    },
    check(o, s) {
      return {
        got: { detection: detection(o, s, ` (Spy 0) noticing ${s.hero.name}: 60% [roll 1 ✓]`) },
        want: { detection: true },
      };
    },
  },
  {
    // no game of the balance matrix meets a catch scoped to a realm's home (plan P1-19ad: its effect in the
    // discoveries' registry, handed the hero's realm)
    name: 'Spy on a hero: Bulwark of the Realm adds 50 to catching the spy at the hero’s realm’s home',
    dice: LUCKY,
    stage(b) {
      b.own(b.X, 1);
      realm(b, 1)['homeProvinceId'] = b.X.id;
      knows(b, 1, 'ag10');
      return spyOn(b, rival(b), 1);
    },
    check(o, s) {
      return {
        got: { detection: detection(o, s, ` (Spy 0) noticing ${s.hero.name} in their own land: 75% [roll 1 ✓]`) },
        want: { detection: true },
      };
    },
  },
  {
    name: 'Spy on a hero: Bulwark of the Realm adds nothing away from the hero’s realm’s home',
    dice: LUCKY,
    stage(b) {
      b.own(b.X, 1);
      knows(b, 1, 'ag10');
      return spyOn(b, rival(b), 1);
    },
    check(o, s) {
      return {
        got: { detection: detection(o, s, ` (Spy 0) noticing ${s.hero.name} in their own land: 25% [roll 1 ✓]`) },
        want: { detection: true },
      };
    },
  },
  {
    name: 'Spy on a hero: a caught spy is brought to a duel by a hero who answers challenges',
    dice: LUCKY,
    stage(b) {
      return spyOn(b, accepts(rival(b)), 1);
    },
    check(o, s) {
      return {
        got: { duel: bladesDrawn(o, s, markOf(s), 'spying on them'), swords: fightMarked(o, there(s)) },
        want: { duel: true, swords: [0, 1] },
      };
    },
  },
  {
    name: 'Spy on a hero: a wandering hero can be read, and no realm is told he was caught',
    dice: LUCKY,
    stage(b) {
      return spyOn(b, rival(b, { player: null }), 1);
    },
    check(o, s) {
      return {
        got: {
          report: report(o, s, '', 'skills — Melee 2, Tactical 2, March 1.'),
          kingdom: spiedHero(o, s)?.['kingdom'],
          caught: anySays(o, 'was caught spying'),
          detection: detection(o, s, ` (Spy 0) noticing ${s.hero.name}: 10% [roll 1 ✓]`),
        },
        want: { report: true, kingdom: null, caught: false, detection: true },
      };
    },
  },
  {
    name: 'Spy on a hero: a spy who vanished earlier in the turn has melted away when caught',
    dice: LUCKY,
    stage(b) {
      const m = rival(b);
      const h = at(b, { spy: 1, thief: 9 });
      return { hero: h, orders: [one(h, order('vanish'), order('spy', `char:${String(m.id)}`))], mark: m, there: b.X };
    },
    check(o, s) {
      return {
        got: {
          melted: anySays(
            o,
            `${markOf(s).name} raises the alarm, but ${s.hero.name} has already melted into the shadows. (Vanish)`,
          ),
          duel: anySays(o, 'blades are drawn'),
        },
        want: { melted: true, duel: false },
      };
    },
  },
];

// ── Steal ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** A thief of realm 0 of Thief `n` in the middle, sent to rob `mark`. */
const stealFrom = (b: Board, mark: Character, n: number): Staged => {
  const h = at(b, { thief: n });
  return { hero: h, orders: [one(h, order('steal', mark.id))], mark, there: b.X };
};
/** A thief of realm 0 of Thief `n` in the middle, sent to rob the garrison's paymaster. */
const robPaymaster = (b: Board, n: number): Staged => {
  const h = at(b, { thief: n });
  return { hero: h, orders: [one(h, order('steal', 'garrison'))], there: b.X };
};
/** The middle held by realm 1, with `n` companies in its garrison and `gold` in realm 1's treasury. */
const rivalGarrison = (b: Board, n: number, gold = 20) => {
  b.own(b.X, 1);
  b.X.garrisonArmies = companies(n, 'Men-at-Arms', 'Average', 'Pay Guard');
  realm(b, 1)['gold'] = gold;
};
const noPaymaster = (o: Outcome, s: Staged) =>
  says(
    o,
    `${s.hero.name} finds no enemy paymaster to rob in ${there(s).name} — it needs a rival's garrison standing here.`,
  );
/** The theft's roll line: `📊 Steal — <hero> (Thief n) targets <mark> (<prize>): <working>`. */
const stealRoll = (o: Outcome, s: Staged, level: number, prize: string, working: string) =>
  says(o, `📊 Steal — ${s.hero.name} (Thief ${String(level)}) targets ${markOf(s).name} (${prize}): ${working}`);
const lifted = (o: Outcome, s: Staged, what: string) =>
  says(o, `${s.hero.name} deftly lifts the ${what} from ${markOf(s).name}!`);
const stolenItemTold = (o: Outcome, s: Staged, what: string) =>
  toldTo(o, `[Intelligence] ${s.hero.name} (${realmName(o, 0)}) has stolen the ${what} from ${markOf(s).name}!`);
const purse = (o: Outcome, s: Staged, g: number) =>
  says(
    o,
    `💰 ${s.hero.name} deftly lifts ${String(g)}g from ${markOf(s).name}'s strongbox (5% of the realm's treasury).`,
  );
export const STEAL_ORDER_CASES: EspionageOrderCase[] = [
  {
    name: 'Steal: a hero with no Thief skill is told so, and nothing is rolled',
    stage(b) {
      return stealFrom(b, holding(rival(b), item(b, 'Tome of Tactics')), 0);
    },
    check(o, s) {
      return {
        got: {
          told: says(o, `${s.hero.name} has no Thief skill — light fingers take training.`),
          rolled: says(o, '📊'),
          pack: pack(o, markOf(s)),
        },
        want: { told: true, rolled: false, pack: ['Tome of Tactics'] },
      };
    },
  },
  {
    name: 'Steal from the garrison: in a province no realm holds there is no paymaster',
    stage(b) {
      return robPaymaster(b, 1);
    },
    check(o, s) {
      return { got: { told: noPaymaster(o, s) }, want: { told: true } };
    },
  },
  {
    name: 'Steal from the garrison: his own realm’s garrison is not robbed',
    stage(b) {
      b.own(b.X, 0);
      b.X.garrisonArmies = companies(2);
      return robPaymaster(b, 1);
    },
    check(o, s) {
      return { got: { told: noPaymaster(o, s) }, want: { told: true } };
    },
  },
  {
    name: 'Steal from the garrison: a rival’s province with no garrison has no paymaster',
    stage(b) {
      rivalGarrison(b, 0);
      return robPaymaster(b, 1);
    },
    check(o, s) {
      return { got: { told: noPaymaster(o, s) }, want: { told: true } };
    },
  },
  {
    name: 'Steal from the garrison: the paymaster is robbed of 1 gold a company, the chance halved for the guard, and his realm told',
    dice: LUCKY,
    stage(b) {
      rivalGarrison(b, 3);
      return robPaymaster(b, 1);
    },
    check(o, s) {
      const p = there(s);
      return {
        got: {
          roll: says(
            o,
            `📊 Steal — ${s.hero.name} (Thief 1) goes for the garrison paymaster of ${p.name} (3 units, guarded — halved): 30% [roll 1 ✓]`,
          ),
          lifted: says(o, `💰 ${s.hero.name} lifts 3g from the garrison paymaster's strongbox in ${p.name}.`),
          told: toldTo(
            o,
            `[Intelligence] The garrison paymaster of ${p.name} was robbed of 3g — ${s.hero.name} (${realmName(o, 0)}) is suspected.`,
          ),
          ledger: ledger(o, s.hero),
          lessons: xpIn(o, s.hero, 'thief'),
          treasuries: [treasury(o, 0), treasury(o, 1)],
          noTarget: says(o, 'finds no suitable target'),
        },
        want: {
          roll: true,
          lifted: true,
          told: [1],
          ledger: [`robbed the garrison paymaster @${String(p.id)}`],
          lessons: [STD],
          treasuries: [23, 17],
          noTarget: false,
        },
      };
    },
  },
  {
    name: 'Steal from the garrison: one company is “1 unit”, and an empty treasury yields nothing and tells no one',
    dice: LUCKY,
    stage(b) {
      rivalGarrison(b, 1, 0);
      return robPaymaster(b, 1);
    },
    check(o, s) {
      const p = there(s);
      return {
        got: {
          roll: says(o, `(1 unit, guarded — halved): 30% [roll 1 ✓]`),
          lifted: says(o, `💰 ${s.hero.name} lifts 0g from the garrison paymaster's strongbox in ${p.name}.`),
          told: anySays(o, 'was robbed of'),
        },
        want: { roll: true, lifted: true, told: false },
      };
    },
  },
  {
    name: 'Steal from the garrison: a thief who misses and is caught takes a beating (4 at most) and his realm is named',
    dice: UNLUCKY,
    stage(b) {
      rivalGarrison(b, 2);
      return robPaymaster(b, 2);
    },
    check(o, s) {
      const p = there(s);
      return {
        got: {
          roll: says(o, `(2 units, guarded — halved): 35% [roll 100 ✗]`),
          beaten: says(
            o,
            `${s.hero.name} is caught by the garrison guards of ${p.name} and beaten back — 4 damage taken.`,
          ),
          told: toldTo(
            o,
            `[Intelligence] ${s.hero.name} (${realmName(o, 0)}) was caught trying to rob the garrison paymaster of ${p.name}.`,
          ),
          lessons: xpIn(o, s.hero, 'thief'),
          ledger: ledger(o, s.hero),
        },
        want: { roll: true, beaten: true, told: [1], lessons: [SMALL], ledger: [] },
      };
    },
  },
  {
    name: 'Steal from the garrison: a thief who misses may slip away unnoticed',
    dice: MISSES_BUT_SLIPS_AWAY,
    stage(b) {
      rivalGarrison(b, 2);
      return robPaymaster(b, 2);
    },
    check(o, s) {
      return {
        got: {
          slipped: says(
            o,
            `${s.hero.name}'s attempt on the paymaster of ${there(s).name} fails, but the thief slips away unnoticed.`,
          ),
          told: anySays(o, 'was caught trying to rob'),
          lessons: xpIn(o, s.hero, 'thief'),
        },
        want: { slipped: true, told: false, lessons: [SMALL] },
      };
    },
  },
  {
    name: 'Steal: a hero who is elsewhere can’t be robbed',
    stage(b) {
      return stealFrom(b, rival(b, { at: ring1(b, 0) }), 2);
    },
    check(o, s) {
      return {
        got: { told: says(o, `${s.hero.name} finds no suitable target to steal from in ${there(s).name}.`) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Steal: a comrade is not robbed',
    stage(b) {
      return stealFrom(b, holding(at(b), item(b, 'Tome of Tactics')), 2);
    },
    check(o, s) {
      return {
        got: { told: says(o, `${s.hero.name} will not rob a comrade.`), pack: pack(o, markOf(s)) },
        want: { told: true, pack: ['Tome of Tactics'] },
      };
    },
  },
  {
    name: 'Steal: a fallen hero is not robbed',
    stage(b) {
      const m = holding(rival(b), item(b, 'Tome of Tactics'));
      m.alive = false;
      return stealFrom(b, m, 2);
    },
    check(o, s) {
      return {
        got: {
          told: says(o, `${s.hero.name} finds no suitable target to steal from in ${there(s).name}.`),
          thief: pack(o, s.hero),
        },
        want: { told: true, thief: [] },
      };
    },
  },
  {
    name: 'Steal: a hero who vanished earlier in the turn is not there to rob',
    stage(b) {
      const m = holding(rival(b, {}, { thief: 9 }), item(b, 'Tome of Tactics'));
      const h = at(b, { thief: 2 });
      return {
        hero: h,
        orders: [one(h, order('rest'), order('steal', m.id)), one(m, order('vanish'))],
        mark: m,
        there: b.X,
      };
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `${s.hero.name} reaches for ${markOf(s).name}'s purse and closes on nothing — the man has vanished.`,
          ),
          pack: pack(o, markOf(s)),
        },
        want: { told: true, pack: ['Tome of Tactics'] },
      };
    },
  },
  {
    name: 'Steal: a wandering hero with no magic to lift has no purse worth the risk',
    stage(b) {
      return stealFrom(b, rival(b, { player: null }), 2);
    },
    check(o, s) {
      return {
        got: {
          told: says(o, `${s.hero.name} finds ${markOf(s).name} carries no purse worth the risk and no magic to lift.`),
          rolled: says(o, '📊'),
        },
        want: { told: true, rolled: false },
      };
    },
  },
  {
    name: 'Steal: a magic item is lifted when the hero carries one, and his realm is told',
    dice: LUCKY,
    stage(b) {
      return stealFrom(b, holding(rival(b), item(b, 'Tome of Tactics')), 1);
    },
    check(o, s) {
      const loot = char(o, s.hero).items.find((i) => i['name'] === 'Tome of Tactics');
      return {
        got: {
          roll: stealRoll(o, s, 1, 'a magic item', '60% [roll 1 ✓]'),
          lifted: lifted(o, s, 'Tome of Tactics'),
          kept: says(o, `🎒 The Tome of Tactics needs no slot: it works for ${s.hero.name} at once.`),
          thief: pack(o, s.hero),
          robbed: pack(o, markOf(s)),
          stolenThisTurn: loot?.['_stolenTurn'],
          told: stolenItemTold(o, s, 'Tome of Tactics'),
          ledger: ledger(o, s.hero),
          lessons: xpIn(o, s.hero, 'thief'),
        },
        want: {
          roll: true,
          lifted: true,
          kept: true,
          thief: ['Tome of Tactics'],
          robbed: [],
          stolenThisTurn: o.turn,
          told: [1],
          ledger: [`lifted a magic item from a hero @${String(there(s).id)}`],
          lessons: [STD],
        },
      };
    },
  },
  {
    name: 'Steal: a wandering hero’s item is lifted, and no realm is told',
    dice: LUCKY,
    stage(b) {
      return stealFrom(b, holding(rival(b, { player: null }), item(b, 'Tome of Tactics')), 1);
    },
    check(o, s) {
      return {
        got: { thief: pack(o, s.hero), told: anySays(o, 'has stolen the') },
        want: { thief: ['Tome of Tactics'], told: false },
      };
    },
  },
  {
    name: 'Steal: a master thief (Thief 8) can’t be robbed of his own items',
    dice: LUCKY,
    stage(b) {
      return stealFrom(b, holding(rival(b, {}, { thief: 8 }), item(b, 'Tome of Tactics')), 2);
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `${s.hero.name}'s fingers find nothing — ${markOf(s).name} keeps every trinket sewn tight; a master thief cannot be robbed of their own.`,
          ),
          robbed: pack(o, markOf(s)),
          thief: pack(o, s.hero),
        },
        want: { told: true, robbed: ['Tome of Tactics'], thief: [] },
      };
    },
  },
  {
    // the turn's end strips Mithril Armour from any but a Dwarf of a Dwarven realm: the direct test sees him keep it
    name: 'Steal: Mithril Armour can’t be lifted, so he goes for gold: 5% of the realm’s treasury, and the realm is told',
    dice: LUCKY,
    stage(b) {
      realm(b, 1)['gold'] = 100;
      return stealFrom(b, holding(rival(b), item(b, 'Mithril Armour')), 1);
    },
    check(o, s) {
      return {
        got: {
          roll: stealRoll(o, s, 1, 'gold', '60% [roll 1 ✓]'),
          purse: purse(o, s, 5),
          told: toldTo(o, `[Intelligence] ${s.hero.name} (${realmName(o, 0)}) has stolen 5g from ${markOf(s).name}!`),
          thief: pack(o, s.hero),
          ledger: ledger(o, s.hero),
          treasuries: [treasury(o, 0), treasury(o, 1)],
        },
        want: {
          roll: true,
          purse: true,
          told: [1],
          thief: [],
          ledger: [`picked a hero’s purse @${String(there(s).id)}`],
          treasuries: [25, 95],
        },
      };
    },
  },
  {
    name: 'Steal: gold is at least 1 from a treasury that has any',
    dice: LUCKY,
    stage(b) {
      realm(b, 1)['gold'] = 10;
      return stealFrom(b, rival(b), 1);
    },
    check(o, s) {
      return { got: { purse: purse(o, s, 1) }, want: { purse: true } };
    },
  },
  {
    name: 'Steal: an empty treasury leaves an empty purse',
    dice: LUCKY,
    stage(b) {
      realm(b, 1)['gold'] = 0;
      return stealFrom(b, rival(b), 1);
    },
    check(o, s) {
      return {
        got: {
          empty: says(o, `${s.hero.name} picks ${markOf(s).name}'s purse — and finds it empty.`),
          told: anySays(o, 'has stolen'),
        },
        want: { empty: true, told: false },
      };
    },
  },
  {
    name: 'Steal: the chance is halved against a hero leading troops',
    dice: LUCKY,
    stage(b) {
      return stealFrom(b, leads(holding(rival(b), item(b, 'Tome of Tactics')), companies(1)), 1);
    },
    check(o, s) {
      return {
        got: { roll: stealRoll(o, s, 1, 'a magic item', '30% [roll 1 ✓] (halved — target leads armies)') },
        want: { roll: true },
      };
    },
  },
  {
    name: 'Steal: the chance stops at 95 (Thief 5)',
    dice: LUCKY,
    stage(b) {
      return stealFrom(b, holding(rival(b), item(b, 'Tome of Tactics')), 5);
    },
    check(o, s) {
      return { got: { roll: stealRoll(o, s, 5, 'a magic item', '95% [roll 1 ✓]') }, want: { roll: true } };
    },
  },
  {
    name: 'Steal: a thief who misses and is noticed is driven off by a hero who won’t brawl, and may learn a little',
    dice: UNLUCKY,
    stage(b) {
      return stealFrom(b, holding(rival(b), item(b, 'Tome of Tactics')), 1);
    },
    check(o, s) {
      return {
        got: {
          roll: stealRoll(o, s, 1, 'a magic item', '60% [roll 100 ✗]'),
          drivenOff: drivenOff(o, s, markOf(s), 'with a hand in their pack'),
          robbed: pack(o, markOf(s)),
          lessons: xpIn(o, s.hero, 'thief'),
        },
        want: { roll: true, drivenOff: true, robbed: ['Tome of Tactics'], lessons: [SMALL] },
      };
    },
  },
  {
    name: 'Steal: a thief after gold is caught “with a hand in their strongbox”',
    dice: UNLUCKY,
    stage(b) {
      return stealFrom(b, rival(b), 1);
    },
    check(o, s) {
      return {
        got: { drivenOff: drivenOff(o, s, markOf(s), 'with a hand in their strongbox') },
        want: { drivenOff: true },
      };
    },
  },
  {
    name: 'Steal: a thief who misses may slip away undetected',
    dice: MISSES_BUT_SLIPS_AWAY,
    stage(b) {
      return stealFrom(b, holding(rival(b), item(b, 'Tome of Tactics')), 1);
    },
    check(o, s) {
      return {
        got: {
          slipped: says(
            o,
            `${s.hero.name}'s theft attempt on ${markOf(s).name} fails but the thief slips away undetected.`,
          ),
          caught: anySays(o, 'catches'),
          lessons: xpIn(o, s.hero, 'thief'),
        },
        want: { slipped: true, caught: false, lessons: [SMALL] },
      };
    },
  },
  {
    name: 'Steal: a noticed thief is brought to a duel by a hero who answers challenges',
    dice: UNLUCKY,
    stage(b) {
      return stealFrom(b, accepts(holding(rival(b), item(b, 'Tome of Tactics'))), 1);
    },
    check(o, s) {
      return {
        got: { duel: bladesDrawn(o, s, markOf(s), 'with a hand in their pack'), swords: fightMarked(o, there(s)) },
        want: { duel: true, swords: [0, 1] },
      };
    },
  },
];

// ── Sabotage ────────────────────────────────────────────────────────────────────────────────────────────────────
/** A saboteur of realm 0 of Spy `n` in the middle, sent against `p` (a neighbour of the middle, by default). */
const sabotage = (b: Board, n: number, p: Province | string = ring1(b, 0)): Staged => {
  const h = at(b, { spy: n });
  const target = typeof p === 'string' ? p : p.id;
  return { hero: h, orders: [one(h, order('sabotage', target))], ...(typeof p === 'string' ? {} : { there: p }) };
};
export const SABOTAGE_ORDER_CASES: EspionageOrderCase[] = [
  {
    name: 'Sabotage: a hero below Spy 7 lacks the mastery',
    stage(b) {
      b.own(ring1(b, 0), 1);
      return sabotage(b, 6);
    },
    check(o, s) {
      return {
        got: {
          told: says(o, `${s.hero.name} lacks the Spy mastery (7) to attempt Sabotage.`),
          sabotaged: province(o, there(s))['_sabotagedForTurn'],
        },
        want: { told: true, sabotaged: undefined },
      };
    },
  },
  {
    name: 'Sabotage: a province nobody holds is refused',
    stage(b) {
      return sabotage(b, 7);
    },
    check(o, s) {
      return {
        got: { told: says(o, `${s.hero.name}: Sabotage needs a valid enemy province you have seen.`) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Sabotage: his own realm’s province is refused',
    stage(b) {
      b.own(ring1(b, 0), 0);
      return sabotage(b, 7);
    },
    check(o, s) {
      return {
        got: { told: says(o, `${s.hero.name}: Sabotage needs a valid enemy province you have seen.`) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Sabotage: a target that names no province is refused',
    stage(b) {
      return sabotage(b, 7, 'nowhere');
    },
    check(o, s) {
      return {
        got: { told: says(o, `${s.hero.name}: Sabotage needs a valid enemy province you have seen.`) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Sabotage: an ally’s province is refused: it would be an act of war',
    stage(b) {
      b.own(ring1(b, 0), 2);
      return sabotage(b, 7);
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `${s.hero.name}: you are not at war with the owner of ${there(s).name} — Sabotage would be an act of war. Declare war first.`,
          ),
          sabotaged: province(o, there(s))['_sabotagedForTurn'],
        },
        want: { told: true, sabotaged: undefined },
      };
    },
  },
  {
    name: 'Sabotage: an enemy province, from afar: its coffers yield nothing this turn, both realms told',
    stage(b) {
      b.own(ring1(b, 0), 1);
      return sabotage(b, 7);
    },
    check(o, s) {
      return {
        got: {
          told: toldTo(
            o,
            `🕵 ${s.hero.name}'s agents sabotage ${there(s).name} — its coffers yield nothing this turn.`,
          ),
          torched: anySays(o, 'put to the torch'),
          sabotaged: province(o, there(s))['_sabotagedForTurn'],
          spymaster: spyActions(o, s.hero),
          ledger: ledger(o, s.hero),
          lessons: xpIn(o, s.hero, 'spy'),
        },
        want: {
          told: [0, 1],
          torched: false,
          sabotaged: o.turn,
          spymaster: 1,
          ledger: [`worked sabotage @${String(there(s).id)}`],
          lessons: [STD],
        },
      };
    },
  },
  {
    name: 'Sabotage: one company of the garrison is put to the torch',
    stage(b) {
      const p = ring1(b, 0);
      b.own(p, 1);
      p.garrisonArmies = companies(1, 'Men-at-Arms', 'Average', 'Torch');
      return sabotage(b, 7);
    },
    check(o, s) {
      return {
        got: {
          torched: says(
            o,
            `🕵 ${s.hero.name}'s agents sabotage ${there(s).name} — its coffers yield nothing this turn. A Average Men-at-Arms of its garrison is put to the torch.`,
          ),
          garrison: names(province(o, there(s)).garrisonArmies),
        },
        want: { torched: true, garrison: [] },
      };
    },
  },
  {
    name: 'Sabotage: a mastery, given once a turn: a second Sabotage is refused',
    wholeTurnOnly: true,
    stage(b) {
      const p = ring1(b, 0);
      b.own(p, 1);
      const h = at(b, { spy: 7 });
      return { hero: h, orders: [one(h, order('sabotage', p.id), order('sabotage', p.id))], there: p };
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name} has already used their Sabotage mastery this turn — it may be commanded but once per turn.`,
          ),
          spymaster: spyActions(o, s.hero),
        },
        want: { refused: true, spymaster: 1 },
      };
    },
  },
];

// ── Grand Heist ─────────────────────────────────────────────────────────────────────────────────────────────────
/** A thief of realm 0 of Thief `n` in the middle, sent to crack its vaults; the middle held by `owner` (realm 1, the
 *  enemy, by default) and rich (tax 7) unless `tax` says otherwise, with `gold` in its realm's treasury. */
const heist = (
  b: Board,
  n: number,
  { owner = 1, tax = 7, gold = 100 }: { owner?: number | null; tax?: number; gold?: number } = {},
): Staged => {
  b.own(b.X, owner);
  b.X['tax'] = tax;
  if (owner != null) realm(b, owner)['gold'] = gold;
  const h = at(b, { thief: n });
  return { hero: h, orders: [one(h, order('grand_heist'))], there: b.X };
};
const heistRoll = (o: Outcome, s: Staged, level: number, where: string, working: string) =>
  says(
    o,
    `📊 Grand Heist — ${s.hero.name} (Thief ${String(level)}) cracks the vaults of ${where}${there(s).name} (${realmName(o, 1)}): ${working}`,
  );
const pulledOff = (o: Outcome, s: Staged, what: string) =>
  says(o, `💰 ${s.hero.name} pulls off a Grand Heist in ${there(s).name} — ${what}!`);
const NO_COURIER = 'though no courier of theirs was on the road to waylay';
export const GRAND_HEIST_ORDER_CASES: EspionageOrderCase[] = [
  {
    name: 'Grand Heist: a hero below Thief 7 lacks the mastery',
    stage(b) {
      return heist(b, 6);
    },
    check(o, s) {
      return {
        got: {
          told: says(o, `${s.hero.name} lacks the Thief mastery (7) for a Grand Heist.`),
          spent: char(o, s.hero)['_grandHeistTurn'],
        },
        want: { told: true, spent: undefined },
      };
    },
  },
  {
    name: 'Grand Heist: in a province no realm holds there are no vaults to crack',
    stage(b) {
      return heist(b, 7, { owner: null });
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `${s.hero.name} looks for vaults to crack in ${there(s).name}, but no rival crown holds this ground — a Grand Heist is staged in an enemy's own country.`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Grand Heist: his own realm’s vaults are not cracked',
    stage(b) {
      return heist(b, 7, { owner: 0 });
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `${s.hero.name} looks for vaults to crack in ${there(s).name}, but no rival crown holds this ground`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Grand Heist: an ally’s vaults are refused: it would be an act of war',
    stage(b) {
      return heist(b, 7, { owner: 2 });
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `${s.hero.name}: you are not at war with ${realmName(o, 2)} — a Grand Heist would be an act of war. Declare war first.`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Grand Heist: a province that is neither the enemy’s capital nor rich (tax 6) isn’t worth the risk',
    stage(b) {
      return heist(b, 7, { tax: 6 });
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `${s.hero.name} casts an eye over ${there(s).name} and finds nothing worth the risk — a Grand Heist is staged in an enemy's home capital or in rich country (tax 7+; this province: 6).`,
          ),
          spent: char(o, s.hero)['_grandHeistTurn'],
        },
        want: { told: true, spent: undefined },
      };
    },
  },
  {
    name: 'Grand Heist: in rich country (tax 7), Thief 7 lands on 70%: a quarter of the treasury, and the realm is told',
    dice: LUCKY,
    stage(b) {
      return heist(b, 7);
    },
    check(o, s) {
      return {
        got: {
          roll: heistRoll(o, s, 7, 'the rich province of ', '70% [roll 1 ✓]'),
          pulledOff: pulledOff(o, s, `25g lifted from the vaults — and ${NO_COURIER}`),
          told: toldTo(
            o,
            `[Intelligence] ${s.hero.name} (${realmName(o, 0)}) staged a Grand Heist in ${there(s).name}: 25g lifted from the vaults — and ${NO_COURIER}.`,
          ),
          spent: char(o, s.hero)['_grandHeistTurn'],
          ledger: ledger(o, s.hero),
          lessons: xpIn(o, s.hero, 'thief'),
        },
        want: {
          roll: true,
          pulledOff: true,
          told: [1],
          spent: o.turn,
          ledger: [`cracked the vaults @${String(there(s).id)}`],
          lessons: [STD],
        },
      };
    },
  },
  {
    name: 'Grand Heist: the enemy’s capital is worth it, however poor',
    dice: LUCKY,
    stage(b) {
      const s = heist(b, 7, { tax: 3 });
      realm(b, 1)['homeProvinceId'] = b.X.id;
      return s;
    },
    check(o, s) {
      return { got: { roll: heistRoll(o, s, 7, 'the enemy capital of ', '70% [roll 1 ✓]') }, want: { roll: true } };
    },
  },
  {
    name: 'Grand Heist: a master thief (Thief 8) has 75% and takes twice as much',
    dice: LUCKY,
    stage(b) {
      return heist(b, 8);
    },
    check(o, s) {
      return {
        got: {
          roll: heistRoll(o, s, 8, 'the rich province of ', '75% [roll 1 ✓]'),
          pulledOff: pulledOff(o, s, `50g lifted from the vaults — and ${NO_COURIER}`),
        },
        want: { roll: true, pulledOff: true },
      };
    },
  },
  {
    name: 'Grand Heist: an empty treasury yields no gold',
    dice: LUCKY,
    stage(b) {
      return heist(b, 7, { gold: 0 });
    },
    check(o, s) {
      return {
        got: { pulledOff: pulledOff(o, s, NO_COURIER), gold: says(o, 'lifted from the vaults') },
        want: { pulledOff: true, gold: false },
      };
    },
  },
  {
    name: 'Grand Heist: a garrison guards the vaults: the chance is halved',
    dice: LUCKY,
    stage(b) {
      const s = heist(b, 7);
      b.X.garrisonArmies = companies(1);
      return s;
    },
    check(o, s) {
      return {
        got: { roll: heistRoll(o, s, 7, 'the rich province of ', '35% [roll 1 ✓] (halved — the vaults are guarded)') },
        want: { roll: true },
      };
    },
  },
  {
    name: 'Grand Heist: a hero of the realm leading troops there guards the vaults; one leading none doesn’t',
    dice: LUCKY,
    stage(b) {
      const s = heist(b, 7);
      leads(rival(b), companies(1));
      return s;
    },
    check(o, s) {
      return {
        got: { roll: heistRoll(o, s, 7, 'the rich province of ', '35% [roll 1 ✓] (halved — the vaults are guarded)') },
        want: { roll: true },
      };
    },
  },
  {
    name: 'Grand Heist: a hero of the realm there leading no troops doesn’t guard the vaults',
    dice: LUCKY,
    stage(b) {
      const s = heist(b, 7);
      rival(b);
      return s;
    },
    check(o, s) {
      return { got: { roll: heistRoll(o, s, 7, 'the rich province of ', '70% [roll 1 ✓]') }, want: { roll: true } };
    },
  },
  {
    name: 'Grand Heist: a parcel on the robbed realm’s roads is cut from the courier, and never arrives',
    dice: LUCKY,
    stage(b) {
      const s = heist(b, 7, { gold: 0 });
      const sender = holding(rival(b, { at: ring1(b, 0) }), item(b, 'Tome of Tactics'));
      const addressee = rival(b, { at: ring1(b, 1) });
      s.orders = [
        one(s.hero, order('rest'), order('grand_heist')),
        one(sender, order('give_item', 'Tome of Tactics', addressee.id)),
      ];
      return { ...s, mark: sender, other: addressee };
    },
    check(o, s) {
      const addressee = must(s.other, 'the addressee');
      return {
        got: {
          pulledOff: pulledOff(o, s, `the Tome of Tactics cut from a courier's satchel on the road`),
          waylaid: toldTo(
            o,
            `📦 A courier of ${realmName(o, 1)} is waylaid on the road — Tome of Tactics, sent by ${markOf(s).name} and bound for ${addressee.name}, never arrives.`,
          ),
          phase: o.all.find((l) => l.text.startsWith(`📦 A courier of`))?.phase,
          kept: says(o, `🎒 The Tome of Tactics needs no slot: it works for ${s.hero.name} at once.`),
          thief: pack(o, s.hero),
          addressee: pack(o, addressee),
        },
        want: { pulledOff: true, waylaid: [1], phase: 1, kept: true, thief: ['Tome of Tactics'], addressee: [] },
      };
    },
  },
  {
    name: 'Grand Heist: a parcel bound for another realm’s hero is not touched',
    wholeTurnOnly: true,
    dice: LUCKY,
    stage(b) {
      const s = heist(b, 7, { gold: 0 });
      const sender = holding(rival(b, { at: ring1(b, 0), player: 2 }), item(b, 'Tome of Tactics'));
      const addressee = rival(b, { at: ring1(b, 1), player: 2 });
      s.orders = [
        one(s.hero, order('rest'), order('grand_heist')),
        one(sender, order('give_item', 'Tome of Tactics', addressee.id)),
      ];
      return { ...s, other: addressee };
    },
    check(o, s) {
      return {
        got: { pulledOff: pulledOff(o, s, NO_COURIER), addressee: pack(o, must(s.other, 'the addressee')) },
        want: { pulledOff: true, addressee: ['Tome of Tactics'] },
      };
    },
  },
  {
    name: 'Grand Heist: a thief who misses may slip away; the attempt is spent all the same',
    dice: MISSES_BUT_SLIPS_AWAY,
    stage(b) {
      return heist(b, 7);
    },
    check(o, s) {
      return {
        got: {
          roll: heistRoll(o, s, 7, 'the rich province of ', '70% [roll 100 ✗]'),
          slipped: says(
            o,
            `${s.hero.name}'s Grand Heist in ${there(s).name} comes to nothing, but the thief slips away undetected.`,
          ),
          spent: char(o, s.hero)['_grandHeistTurn'],
          lessons: xpIn(o, s.hero, 'thief'),
        },
        want: { roll: true, slipped: true, spent: o.turn, lessons: [SMALL] },
      };
    },
  },
  {
    name: 'Grand Heist: a caught thief with no hero of the realm there is beaten off by the guards (4 at most)',
    dice: UNLUCKY,
    stage(b) {
      return heist(b, 7);
    },
    check(o, s) {
      return {
        got: {
          beaten: says(
            o,
            `${s.hero.name} is caught at the vaults of ${there(s).name} and beaten back by the guards — 4 damage taken.`,
          ),
          told: toldTo(
            o,
            `[Intelligence] A thief — ${s.hero.name} (${realmName(o, 0)}) — was driven off the vaults of ${there(s).name}.`,
          ),
        },
        want: { beaten: true, told: [1] },
      };
    },
  },
  {
    name: 'Grand Heist: a caught thief is run down by a hero of the realm there, not its king if another stands by',
    dice: UNLUCKY,
    stage(b) {
      const s = heist(b, 7);
      rival(b, { king: true });
      const warden = rival(b);
      return { ...s, other: warden };
    },
    check(o, s) {
      const warden = must(s.other, 'the warden');
      return {
        got: {
          drivenOff: drivenOff(o, s, warden, `breaking into the vaults of ${there(s).name}`),
          guards: anySays(o, 'beaten back by the guards'),
        },
        want: { drivenOff: true, guards: false },
      };
    },
  },
  {
    name: 'Grand Heist: the realm’s king gives chase when he is the only one there',
    dice: UNLUCKY,
    stage(b) {
      const s = heist(b, 7);
      return { ...s, other: accepts(rival(b, { king: true })) };
    },
    check(o, s) {
      const king = must(s.other, 'the king');
      return {
        got: { duel: bladesDrawn(o, s, king, `breaking into the vaults of ${there(s).name}`) },
        want: { duel: true },
      };
    },
  },
  {
    name: 'Grand Heist: a mastery, given once a turn: a second heist is refused',
    wholeTurnOnly: true,
    dice: MISSES_BUT_SLIPS_AWAY,
    stage(b) {
      const s = heist(b, 7);
      s.orders = [one(s.hero, order('grand_heist'), order('grand_heist'))];
      return s;
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name} has already used their Grand Heist mastery this turn — it may be commanded but once per turn.`,
          ),
        },
        want: { refused: true },
      };
    },
  },
];

// ── Assassinate ─────────────────────────────────────────────────────────────────────────────────────────────────
/** An assassin of realm 0 of Spy `n` in the middle, sent against `mark`. */
const assassinate = (b: Board, mark: Character, n = 9): Staged => {
  const h = at(b, { spy: n });
  return { hero: h, orders: [one(h, order('assassinate', mark.id))], mark, there: b.X };
};
const stalks = (o: Outcome, s: Staged, level: number, working: string) =>
  says(o, `📊 Assassination — ${s.hero.name} (Spy ${String(level)}) stalks ${markOf(s).name}: ${working}`);
const noMark = (o: Outcome, s: Staged) =>
  says(o, `${s.hero.name} finds no enemy hero to assassinate in ${there(s).name} this phase.`);
export const ASSASSINATE_ORDER_CASES: EspionageOrderCase[] = [
  {
    name: 'Assassinate: a hero below Spy 9 lacks the mastery',
    stage(b) {
      return assassinate(b, rival(b), 8);
    },
    check(o, s) {
      return {
        got: {
          told: says(o, `${s.hero.name} lacks the Spy mastery (9) to Assassinate.`),
          alive: char(o, markOf(s)).alive,
        },
        want: { told: true, alive: true },
      };
    },
  },
  {
    name: 'Assassinate: a hero who is elsewhere can’t be reached',
    stage(b) {
      return assassinate(b, rival(b, { at: ring1(b, 0) }));
    },
    check(o, s) {
      return { got: { told: noMark(o, s) }, want: { told: true } };
    },
  },
  {
    name: 'Assassinate: a comrade is no mark',
    stage(b) {
      return assassinate(b, at(b));
    },
    check(o, s) {
      return { got: { told: noMark(o, s), alive: char(o, markOf(s)).alive }, want: { told: true, alive: true } };
    },
  },
  {
    name: 'Assassinate: a fallen hero is no mark',
    stage(b) {
      const m = rival(b);
      m.alive = false;
      return assassinate(b, m);
    },
    check(o, s) {
      return { got: { told: noMark(o, s), rolled: says(o, '📊') }, want: { told: true, rolled: false } };
    },
  },
  {
    name: 'Assassinate: a mark who vanished earlier in the turn is never seen',
    dice: LUCKY,
    stage(b) {
      const m = rival(b, {}, { thief: 9 });
      const h = at(b, { spy: 9 });
      return {
        hero: h,
        orders: [one(h, order('rest'), order('assassinate', m.id)), one(m, order('vanish'))],
        mark: m,
        there: b.X,
      };
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `${s.hero.name} stalks ${markOf(s).name} through ${there(s).name} and never once catches sight of them — the mark has vanished.`,
          ),
          alive: char(o, markOf(s)).alive,
        },
        want: { told: true, alive: true },
      };
    },
  },
  {
    name: 'Assassinate: an ally’s hero is refused: it would be an act of war',
    stage(b) {
      return assassinate(b, rival(b, { player: 2 }));
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `${s.hero.name}: you are not at war with ${markOf(s).name}'s crown — an assassination would be an act of war. Declare war first.`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Assassinate: Spy 9 lands on 79%: the mark is slain, his realm told of the attempt, the field marked',
    dice: LUCKY,
    stage(b) {
      return assassinate(b, rival(b));
    },
    check(o, s) {
      return {
        got: {
          roll: stalks(o, s, 9, '79% (roll 1 ✓)'),
          attempt: toldTo(o, `🗡 An attempt is made on ${markOf(s).name}'s life.`),
          slain: toldTo(o, `🗡 ${s.hero.name}'s blade finds ${markOf(s).name} in the dark — the hero is slain!`),
          alive: char(o, markOf(s)).alive,
          spymaster: spyActions(o, s.hero),
          ledger: ledger(o, s.hero),
          swords: fightMarked(o, there(s)),
          lessons: xpIn(o, s.hero, 'spy'),
          hardened: says(o, `💪 ${s.hero.name} is hardened by the victory`),
        },
        want: {
          roll: true,
          attempt: [1],
          slain: [0, 1],
          alive: false,
          spymaster: 1,
          ledger: [`put a blade in one of your heroes @${String(there(s).id)}`],
          swords: [0, 1],
          lessons: [STD],
          hardened: true,
        },
      };
    },
  },
  {
    name: 'Assassinate: a king is heavily guarded: 25 off the chance, and his realm is told the guard closed ranks',
    dice: LUCKY,
    stage(b) {
      return assassinate(b, rival(b, { king: true }));
    },
    check(o, s) {
      return {
        got: {
          roll: stalks(o, s, 9, '54% (roll 1 ✓) (king — heavily guarded)'),
          attempt: toldTo(o, `🗡 An attempt is made on ${markOf(s).name}'s life — the royal guard close ranks.`),
        },
        want: { roll: true, attempt: [1] },
      };
    },
  },
  {
    name: 'Assassinate: a miss leaves the mark alive, and no Spymaster credit',
    dice: UNLUCKY,
    stage(b) {
      return assassinate(b, rival(b));
    },
    check(o, s) {
      return {
        got: {
          roll: stalks(o, s, 9, '79% (roll 100 ✗)'),
          missed: toldTo(o, `${s.hero.name}'s attempt on ${markOf(s).name} fails — the mark slips the knife.`),
          alive: char(o, markOf(s)).alive,
          spymaster: spyActions(o, s.hero),
          ledger: ledger(o, s.hero),
          lessons: xpIn(o, s.hero, 'spy'),
        },
        want: { roll: true, missed: [0, 1], alive: true, spymaster: 0, ledger: [], lessons: [STD] },
      };
    },
  },
  {
    name: 'Assassinate: a wandering hero needs no war, and no realm is told of the attempt',
    dice: LUCKY,
    stage(b) {
      return assassinate(b, rival(b, { player: null }));
    },
    check(o, s) {
      return {
        got: { alive: char(o, markOf(s)).alive, attempt: anySays(o, 'An attempt is made on') },
        want: { alive: false, attempt: false },
      };
    },
  },
  {
    name: 'Assassinate: a mark who can’t be killed escapes the blade',
    dice: LUCKY,
    stage(b) {
      const m = rival(b);
      m['_unkillable'] = true;
      return assassinate(b, m);
    },
    check(o, s) {
      return {
        got: {
          escaped: anySays(o, `🍀 ${markOf(s).name}`),
          alive: char(o, markOf(s)).alive,
          spymaster: spyActions(o, s.hero),
        },
        want: { escaped: true, alive: true, spymaster: 0 },
      };
    },
  },
  {
    name: 'Assassinate: a mastery, given once a turn: a second attempt is refused',
    wholeTurnOnly: true,
    dice: UNLUCKY,
    stage(b) {
      const s = assassinate(b, rival(b));
      s.orders = [one(s.hero, order('assassinate', markOf(s).id), order('assassinate', markOf(s).id))];
      return s;
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name} has already used their Assassinate mastery this turn — it may be commanded but once per turn.`,
          ),
        },
        want: { refused: true },
      };
    },
  },
];

// ── Vanish ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const VANISH_ORDER_CASES: EspionageOrderCase[] = [
  {
    name: 'Vanish: a hero below Thief 9 lacks the mastery',
    stage(b) {
      const h = at(b, { thief: 8 });
      return { hero: h, orders: [one(h, order('vanish'))], there: b.X };
    },
    check(o, s) {
      return {
        got: {
          told: says(o, `${s.hero.name} lacks the Thief mastery (9) to Vanish.`),
          vanished: char(o, s.hero)['_vanishTurn'],
        },
        want: { told: true, vanished: undefined },
      };
    },
  },
  {
    name: 'Vanish: Thief 9 melts into the shadows for the rest of the turn',
    stage(b) {
      const h = at(b, { thief: 9 });
      return { hero: h, orders: [one(h, order('vanish'))], there: b.X };
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `🌫 ${s.hero.name} melts into the shadows — for the rest of the turn nothing can bring them to bay and nothing can harm them: no pursuit, Encounter or ambush, no hostile spell, no blade, no assassin's knife.`,
          ),
          vanished: char(o, s.hero)['_vanishTurn'],
          lessons: xpIn(o, s.hero, 'thief'),
        },
        want: { told: true, vanished: o.turn, lessons: [STD] },
      };
    },
  },
  {
    name: 'Vanish: a mastery, given once a turn: a second Vanish is refused',
    wholeTurnOnly: true,
    stage(b) {
      const h = at(b, { thief: 9 });
      return { hero: h, orders: [one(h, order('vanish'), order('vanish'))], there: b.X };
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name} has already used their Vanish mastery this turn — it may be commanded but once per turn.`,
          ),
        },
        want: { refused: true },
      };
    },
  },
];

/** Stages `c` on `b`, from plain realms. */
export const stageCase = (b: Board, c: EspionageOrderCase): Staged => {
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return c.stage(b);
};

/** Every case, by order. */
export const ESPIONAGE_ORDER_CASES: [string, EspionageOrderCase[]][] = [
  ['spy (a province)', SPY_ON_A_PROVINCE_ORDER_CASES],
  ['spy (a hero)', SPY_ON_A_HERO_ORDER_CASES],
  ['steal', STEAL_ORDER_CASES],
  ['sabotage', SABOTAGE_ORDER_CASES],
  ['grand_heist', GRAND_HEIST_ORDER_CASES],
  ['assassinate', ASSASSINATE_ORDER_CASES],
  ['vanish', VANISH_ORDER_CASES],
];
