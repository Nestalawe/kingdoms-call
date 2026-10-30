// The Cast Spell order's cases (plan P1-08j7): the casting itself (the spell named, the casting limits, a mastery spell
// once a turn, the cast chance and its roll, a spell item's cast) and every spell a hero can work as a phase order,
// school by school, staged on the middle of a bot world (lib/middle-of-a-bot-world.ts), from plain realms, each with
// what must be true after it in game terms. scenario/cast-spell-order-in-a-whole-turn.test.ts plays each through a
// whole turn (resolveTurn); unit/cast-spell-order-called-directly.test.ts calls the order's own function on them, one
// phase at a time. A case stages its world and the heroes' orders; after them, it reads what it needs from the world and
// the log (`got`) beside what must be so (`want`), and the test compares the two.
// Every outcome is certain. A cast rolls its chance, and some spells roll dice of their own, so every case fixes the
// dice for the whole turn (`dice`; LANDS unless it says otherwise): every percentile roll at one number and every other
// die at one value, so the outcome holds however many dice the turn draws before the order. Realms 0 and 1 are at war,
// 0 and 2 allied (the board's relations).
import {
  hero,
  must,
  order,
  plan,
  type Board,
  type Character,
  type HeroSpec,
  type Line,
  type Order,
  type Province,
  type Unit,
  type World,
} from './middle-of-a-bot-world.ts';
import { companies, item, skeletal, type Item } from './item-and-army-order-cases.ts';
import { oldCloakOfManyFaces, type Dice, type ExperienceRoll } from './espionage-order-cases.ts';
import { lair } from './explore-and-search-order-cases.ts';
import { plainRealms } from './recruit-hire-and-realm-works-order-cases.ts';

export interface Staged {
  /** The caster whose orders the case is about. */
  hero: Character;
  /** Every hero given orders, with them (the caster's first). */
  orders: [Character, Order[]][];
  /** The hero the spell is aimed at. */
  mark?: Character;
  /** Another hero the case needs (a second caster, a king who steps down). */
  other?: Character;
  /** The province the spell is aimed at, or the case needs. */
  there?: Province;
  /** Other provinces the case needs (neighbours holding graves, where a column starts). */
  places?: Province[];
  /** Orders a realm writes under a key of its own (for a hero it means to raise or charm), by realm. */
  written?: Record<number, Record<string, Order[]>>;
}
export interface Outcome {
  world: World;
  /** The caster's own lines in the log. */
  lines: Line[];
  /** Every line in the log. */
  all: Line[];
  /** The turn the orders were played in. */
  turn: number;
  /** Every experience roll started in the turn. */
  xp: ExperienceRoll[];
}
export interface CastSpellOrderCase {
  name: string;
  /** Plays only in a whole turn: the turn refuses the order before the order's own function runs, or the turn's end
   *  shows it (a charmed hero going home, the realm's orders for a hero it raises). */
  wholeTurnOnly?: boolean;
  /** The dice for the whole turn (default LANDS). */
  dice?: Dice;
  stage(b: Board): Staged;
  /** What the case found after the orders, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

/** Every roll lands (a cast, a resisting mind, the backlash, Invisibility); every other die at its highest, so no skill
 *  rises mid-turn, no Bless ward holds and no grave rots at the turn's end. The dice of a case that names none. */
export const LANDS: Dice = { roll: 1, die: 0.99999 };
/** Every roll lands; every other die at its lowest (a skill rises at every lesson, a Bless ward holds, every grave rots
 *  at the turn's end). */
export const LUCKY: Dice = { roll: 1, die: 0 };
/** Every roll misses (a cast fizzles); every other die at its highest. */
export const UNLUCKY: Dice = { roll: 100, die: 0.99999 };
/** The roll a case fixes, with every other die at its highest. */
export const rollOf = (roll: number): Dice => ({ roll, die: 0.99999 });

const text = (ls: Line[]) => ls.map((l) => l.text).join('\n');
/** Whether the caster's lines say `what`. */
export const says = (o: Outcome, what: string) => text(o.lines).includes(what);
/** Whether any line of the turn says `what`. */
export const anySays = (o: Outcome, what: string) => o.all.some((l) => l.text.includes(what));
/** How many lines of the turn say `what`. */
export const countSaying = (o: Outcome, what: string) => o.all.filter((l) => l.text.includes(what)).length;
/** The realms the first line saying `what` goes to (null if no line says it). */
export const toldTo = (o: Outcome, what: string) => o.all.find((l) => l.text.includes(what))?.targets ?? null;
/** Whether the first line saying `what` is public (null if no line says it). */
export const publicLine = (o: Outcome, what: string) => {
  const l = o.all.find((x) => x.text.includes(what));
  return l ? !!l['public'] : null;
};
export const char = (o: Outcome, c: Character) =>
  must(
    o.world.characters.find((x) => x.id === c.id),
    'hero ' + c.name,
  );
export const province = (o: Outcome, p: Province) => must(o.world.world.provinces[p.id], 'province ' + p.name);
export const names = (us: { unitName?: unknown }[] | undefined) => (us ?? []).map((u) => String(u.unitName));
/** A hero's companies, as "<name> (<quality>)". */
export const ranks = (us: Unit[] | undefined) => (us ?? []).map((u) => `${u.unitName} (${u.quality})`);
export const realm = (b: Board, i = 0) => must(b.G.players[i], 'realm ' + String(i));
export const realmName = (o: Outcome, i: number) => must(o.world.players[i], 'realm ' + String(i)).name;
/** Experience rolls `c` started in `skill`, as their chances. */
export const xpIn = (o: Outcome, c: Character, skill: string) =>
  o.xp.filter((x) => x.id === c.id && x.skill === skill).map((x) => x.base);
/** A hero's title merit count (the Hierophant's holy casts, the Deathpriest's dark ones). */
export const merit = (o: Outcome, c: Character, what: string) =>
  (char(o, c)['tm'] as Record<string, number> | undefined)?.[what] ?? 0;
/** A hero of `player` (default realm 0) standing in the middle (or `at`), at full health, of `skills` (and no
 *  others). His maximum HP is the turn's own reckoning of it (15 to start, and what he has earned), so the turn keeps
 *  it. */
export const at = (b: Board, skills: Record<string, number> = {}, extra: Partial<HeroSpec> = {}) => {
  const h = hero(b, { player: 0, at: b.X, skills: { melee: 2, tactical: 2, march: 1, ...skills }, ...extra });
  h['hpEarned'] = Math.max(0, h.maxHp - 15);
  if (h.player != null) {
    const heroes = (realm(b, h.player)['heroes'] as number[] | undefined) ?? [];
    realm(b, h.player)['heroes'] = [...heroes, h.id];
  }
  return h;
};
/** A hero of realm 1 (the enemy; or `player`) standing in the middle, of `skills`. */
export const rival = (b: Board, extra: Partial<HeroSpec> = {}, skills: Record<string, number> = {}) =>
  at(b, skills, { player: 1, ...extra });
/** A wandering hero (no realm) standing in the middle, of `skills`. */
export const wanderer = (b: Board, skills: Record<string, number> = {}, extra: Partial<HeroSpec> = {}) => {
  const h = at(b, skills, { player: null, ...extra });
  h.name = `${h.name} (wandering)`;
  return h;
};
export const holding = (h: Character, ...items: Item[]) => {
  h.items = items;
  return h;
};
export const leads = (h: Character, us: Unit[]) => {
  h.armies = us;
  return h;
};
export const knows = (b: Board, i: number, ...ids: string[]) => {
  realm(b, i)['discoveries'] = ids.map((id) => ({ id }));
};
/** A hero who flees any fight (a failed Charm's backlash comes to nothing). */
export const flees = (c: Character) => {
  c['encounterPlan'] = { tactics: ['FL'], duelStance: 'refuse' };
  return c;
};
export const one = (c: Character, ...os: Order[]): [Character, Order[]] => [c, plan(...os)];
export const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
export const ring2 = (b: Board, i: number) => must(b.ring2[i], 'a province two away from the middle');
/** A Cast Spell order: the spell's name, and the province or hero it is aimed at. */
export const cast = (spell: string, extra: string | number = '') => order('cast_spell', spell, extra);
export const SMALL = 0.04; // SKILLGAIN_COMMON: a failed attempt's small chance to learn
export const STD = 0.1; // SKILLGAIN_STD
const LABEL: Record<string, string> = {
  white: 'White Magic',
  psychic: 'Psychic Magic',
  illusory: 'Illusory Magic',
  elemental: 'Elemental Magic',
  necromancy: 'Necromancy',
};
/** The cast's roll line: `📊 <caster> casts <spell> (<school> <level>[ — <n> trained, +<m> from …]): <chance>% chance
 *  [roll <roll> ✓|✗]`. */
export const castLine = (
  c: Character,
  spell: string,
  school: string,
  level: number,
  chance: number,
  roll: number,
  trained = '',
) =>
  `📊 ${c.name} casts ${spell} (${must(LABEL[school], school)} ${String(level)}${trained}): ${String(chance)}% chance [roll ${String(roll)}${roll <= chance ? ' ✓' : ' ✗'}]`;
/** Whether the caster's spell landed (its roll line says ✓ and it did not fizzle). */
export const landed = (o: Outcome, s: Staged, spell: string) =>
  says(o, `${s.hero.name} casts ${spell} (`) &&
  o.lines.some((l) => l.text.startsWith(`📊 ${s.hero.name} casts ${spell} (`) && l.text.endsWith(' ✓]')) &&
  !says(o, `${s.hero.name}'s ${spell} fizzles`);
/** A fallen hero of `player` (default realm 0), dead in `where` (default the middle) on turn `turn - 1`, as the turn
 *  records him: gone from the province, his grave in the graveyard. */
export const fallen = (
  b: Board,
  where: Province = b.X,
  extra: Partial<HeroSpec> & { served?: number[]; killedOnTurn?: number } = {},
) => {
  const d = at(b, { white: 1 }, { at: where, troops: 2, ...extra });
  d.items = [item(b, 'Phial of the Dawn')];
  d.alive = false;
  d.hp = 0;
  where.characters = where.characters.filter((id) => id !== d.id);
  const G = b.G as unknown as Record<string, unknown>;
  const graves = (G['heroGraveyard'] as Record<string, unknown>[] | undefined) ?? [];
  G['heroGraveyard'] = [
    ...graves,
    {
      id: d.id,
      name: d.name,
      player: d.player,
      race: d['race'],
      alignment: d['alignment'],
      temper: d['temper'],
      skills: { ...d.skills },
      maxHp: d.maxHp,
      isKing: d.isKing,
      killedOnTurn: extra.killedOnTurn ?? b.G.turn - 1,
      location: where.id,
      served: extra.served ?? (d.player == null ? [] : [d.player]),
      _releasedBy: null,
    },
  ];
  return d;
};
/** The graveyard as the turn left it: the fallen heroes' ids. */
export const graveyard = (o: Outcome) =>
  ((o.world as unknown as { heroGraveyard?: { id: number }[] }).heroGraveyard ?? []).map((g) => g.id);
/** `n` battlefield graves of `type` and `quality` in `p`, as a battle leaves them. */
export const bury = (p: Province, n: number, type = 'Men-at-Arms', quality = 'Average', label = type) => {
  const graves = (p['battleGraves'] as Unit[] | undefined) ?? [];
  p['battleGraves'] = [...graves, ...companies(n, type, quality, label)];
};
export const graves = (o: Outcome, p: Province) => names(province(o, p)['battleGraves'] as Unit[] | undefined);
/** A realm's graveyard lore: province id → what it knows lies there (null: only that graves lie there). */
export const graveLore = (o: Outcome, i: number) =>
  Object.fromEntries(
    Object.entries(
      (must(o.world.players[i], 'realm ' + String(i))['_graveIntel'] as
        Record<string, { detail: { k: string; n: number }[] | null }> | undefined) ?? {},
    ).map(([k, v]) => [k, v.detail ? v.detail.map((d) => `${String(d.n)}× ${d.k}`) : null]),
  );
/** A company of beasts (Phantom Host duplicates these; Phantasmal Armies doesn't). */
export const beasts = (n: number, type = 'Dire Wolves', quality = 'Average') =>
  companies(n, type, quality).map((u) => ({ ...u, race: 'Beast' }));
export { oldCloakOfManyFaces, skeletal };

// ── The casting itself ──────────────────────────────────────────────────────────────────────────────────────────
/** A mage of realm 0 in the middle, of `skills`, given `os` in turn. */
const mage = (b: Board, skills: Record<string, number>, ...os: Order[]): Staged => {
  const h = at(b, skills);
  return { hero: h, orders: [one(h, ...os)], there: b.X };
};
const NOTHING_TO_CLEANSE = (s: Staged) =>
  `✝ ${s.hero.name} raises the Holy Symbol over ${must(s.there, 'the province').name}, but no battlefield dead lie unquiet here — there is nothing to cleanse.`;
export const CASTING_CASES: CastSpellOrderCase[] = [
  {
    name: 'a spell the game does not know is refused, unrolled',
    stage: (b) => mage(b, { white: 2 }, cast('Fire Rain')),
    check(o, s) {
      return {
        got: { refused: says(o, `${s.hero.name}: unknown spell "Fire Rain".`), rolled: says(o, '📊') },
        want: { refused: true, rolled: false },
      };
    },
  },
  {
    name: 'a battle-only spell (Fireball) cannot be given as a phase order',
    stage: (b) => mage(b, { elemental: 3 }, cast('Fireball', b.X.id)),
    check(o, s) {
      return {
        got: { refused: says(o, `${s.hero.name}: Fireball cannot be used as a phase order.`), rolled: says(o, '📊') },
        want: { refused: true, rolled: false },
      };
    },
  },
  {
    name: 'the roll: 30% and 10% a level (White Magic 2: 50%), told in full; a spell that lands is a lesson in its school',
    stage: (b) => mage(b, { white: 2 }, cast('Holy Symbol')),
    check(o, s) {
      return {
        got: {
          roll: says(o, castLine(s.hero, 'Holy Symbol', 'white', 2, 50, 1)),
          worked: says(o, NOTHING_TO_CLEANSE(s)),
          lessons: xpIn(o, s.hero, 'white'),
          dark: merit(o, s.hero, 'darkCasts'),
        },
        want: { roll: true, worked: true, lessons: [STD], dark: 0 },
      };
    },
  },
  {
    name: 'the roll at the chance lands; one over it fizzles',
    dice: rollOf(70),
    stage(b) {
      const s = mage(b, { white: 4 }, cast('Holy Symbol'));
      const o2 = at(b, { white: 3 });
      return { ...s, other: o2, orders: [...s.orders, one(o2, cast('Holy Symbol'))] };
    },
    check(o, s) {
      const other = must(s.other, 'the second caster');
      return {
        got: {
          lands: says(o, castLine(s.hero, 'Holy Symbol', 'white', 4, 70, 70)),
          fizzles: anySays(o, castLine(other, 'Holy Symbol', 'white', 3, 60, 70)),
          fizzled: anySays(o, `${other.name}'s Holy Symbol fizzles — the spell dissipates without effect.`),
        },
        want: { lands: true, fizzles: true, fizzled: true },
      };
    },
  },
  {
    name: 'a cast that fizzles does nothing, and is a small chance to learn its school',
    dice: UNLUCKY,
    stage(b) {
      bury(b.X, 2);
      return mage(b, { white: 2 }, cast('Holy Symbol'));
    },
    check(o, s) {
      return {
        got: {
          roll: says(o, castLine(s.hero, 'Holy Symbol', 'white', 2, 50, 100)),
          fizzled: says(o, `${s.hero.name}'s Holy Symbol fizzles — the spell dissipates without effect.`),
          cleansed: says(o, 'are cleansed'),
          lessons: xpIn(o, s.hero, 'white'),
          holy: merit(o, s.hero, 'holyCasts'),
        },
        want: { roll: true, fizzled: true, cleansed: false, lessons: [SMALL], holy: 0 },
      };
    },
  },
  {
    name: 'the chance never passes 95%, whatever the level and the discoveries (White Magic 5 and Hymnals of War: 95%)',
    dice: rollOf(96),
    stage(b) {
      knows(b, 0, 'ad01');
      return mage(b, { white: 5 }, cast('Holy Symbol'));
    },
    check(o, s) {
      return {
        got: { roll: says(o, castLine(s.hero, 'Holy Symbol', 'white', 5, 95, 96)) },
        want: { roll: true },
      };
    },
  },
  {
    name: 'discoveries: Arcane Codex +6, Hedge Wizards +8 (the action spells), Hymnals of War +25 (White only), to 95% at most',
    dice: rollOf(95),
    stage(b) {
      knows(b, 0, 'sd27', 'an17', 'ad01', 'ae05');
      const s = mage(b, { white: 3, psychic: 1 }, cast('Holy Symbol'), cast('Oratory'));
      return s;
    },
    check(o, s) {
      return {
        got: {
          white: says(o, castLine(s.hero, 'Holy Symbol', 'white', 3, 95, 95)),
          psychic: says(o, castLine(s.hero, 'Oratory', 'psychic', 1, 54, 95)),
        },
        want: { white: true, psychic: true },
      };
    },
  },
  {
    name: 'the casting limit: one spell of a school a turn at level 1 or 2; the next is blocked, unrolled',
    stage: (b) => mage(b, { white: 2 }, cast('Holy Symbol'), cast('Holy Symbol')),
    check(o, s) {
      return {
        got: {
          rolls: o.lines.filter((l) => l.text.startsWith(`📊 ${s.hero.name} casts`)).length,
          blocked: says(o, `${s.hero.name}: White Magic level 2 casting limit (1/1 per turn). Holy Symbol blocked.`),
        },
        want: { rolls: 1, blocked: true },
      };
    },
  },
  {
    name: 'the casting limit counts each school apart: a White and a Psychic spell at level 1 both land',
    stage: (b) => mage(b, { white: 1, psychic: 1 }, cast('Holy Symbol'), cast('Oratory')),
    check(o, s) {
      return {
        got: {
          white: landed(o, s, 'Holy Symbol'),
          psychic: landed(o, s, 'Oratory'),
          blocked: says(o, 'casting limit'),
        },
        want: { white: true, psychic: true, blocked: false },
      };
    },
  },
  {
    name: 'the casting limit: two a turn at level 3',
    stage: (b) => mage(b, { white: 3 }, cast('Holy Symbol'), cast('Holy Symbol'), cast('Holy Symbol')),
    check(o, s) {
      return {
        got: {
          rolls: o.lines.filter((l) => l.text.startsWith(`📊 ${s.hero.name} casts`)).length,
          blocked: says(o, `${s.hero.name}: White Magic level 3 casting limit (2/2 per turn). Holy Symbol blocked.`),
        },
        want: { rolls: 2, blocked: true },
      };
    },
  },
  {
    name: 'the casting limit: three a turn at level 4 or 5',
    stage: (b) =>
      mage(b, { white: 5 }, cast('Holy Symbol'), cast('Holy Symbol'), cast('Holy Symbol'), cast('Holy Symbol')),
    check(o, s) {
      return {
        got: {
          rolls: o.lines.filter((l) => l.text.startsWith(`📊 ${s.hero.name} casts`)).length,
          blocked: says(o, `${s.hero.name}: White Magic level 5 casting limit (3/3 per turn). Holy Symbol blocked.`),
        },
        want: { rolls: 3, blocked: true },
      };
    },
  },
  {
    name: 'a blocked cast spends no slot of its own: at level 3, a third cast blocked, a fourth still blocked at 2/2',
    stage: (b) =>
      mage(b, { white: 3 }, cast('Holy Symbol'), cast('Holy Symbol'), cast('Holy Symbol'), cast('Holy Symbol')),
    check(o) {
      return {
        got: { blocked: o.lines.filter((l) => l.text.includes('casting limit (2/2 per turn)')).length },
        want: { blocked: 2 },
      };
    },
  },
  {
    name: 'a cast refused before it is worked (its mark already gone) spends no slot: the next cast of the school lands',
    stage(b) {
      const away = rival(b, { at: ring1(b, 0) }, { melee: 1 });
      const here = rival(b, {}, { melee: 1 });
      const s = mage(b, { psychic: 1 }, cast('Psychic Blast', away.id), cast('Psychic Blast', here.id));
      return { ...s, mark: here, other: away };
    },
    check(o, s) {
      const away = must(s.other, 'the hero away');
      return {
        got: {
          gone: says(
            o,
            `${s.hero.name} looks for ${away.name} to work Psychic Blast upon, and finds them gone — they had already moved on to ${ring1Name(o, away)} before the spell could be shaped. It is never worked, and costs ${s.hero.name} nothing.`,
          ),
          second: landed(o, s, 'Psychic Blast'),
          rolls: o.lines.filter((l) => l.text.startsWith(`📊 ${s.hero.name} casts`)).length,
        },
        want: { gone: true, second: true, rolls: 1 },
      };
    },
  },
  {
    name: 'an own hero gone before the spell is shaped "had already marched on"',
    stage(b) {
      const away = at(b, {}, { at: ring1(b, 0), troops: 1 });
      const s = mage(b, { psychic: 1 }, cast('Oratory', away.id));
      return { ...s, mark: away };
    },
    check(o, s) {
      const away = must(s.mark, 'the hero away');
      return {
        got: {
          gone: says(
            o,
            `${s.hero.name} looks for ${away.name} to work Oratory upon, and finds them gone — they had already marched on to ${ring1Name(o, away)} before the spell could be shaped. It is never worked, and costs ${s.hero.name} nothing.`,
          ),
          rolled: says(o, '📊'),
        },
        want: { gone: true, rolled: false },
      };
    },
  },
  {
    name: "a Divine realm's Grand Cathedral: Bless Province spends no slot, so a White 1 caster blesses and then works another",
    stage(b) {
      knows(b, 0, 'gd');
      realm(b)['gdProvinceId'] = null;
      return mage(b, { white: 1 }, cast('Bless Province', b.X.id), cast('Holy Symbol'));
    },
    check(o, s) {
      return {
        got: {
          bless: landed(o, s, 'Bless Province'),
          symbol: landed(o, s, 'Holy Symbol'),
          blocked: says(o, 'casting limit'),
        },
        want: { bless: true, symbol: true, blocked: false },
      };
    },
  },
  {
    name: "a Grand Cathedral's Bless is never blocked either, even after the slot is spent",
    stage(b) {
      knows(b, 0, 'gd');
      realm(b)['gdProvinceId'] = null;
      return mage(b, { white: 1 }, cast('Holy Symbol'), cast('Bless Province', b.X.id));
    },
    check(o, s) {
      return {
        got: {
          symbol: landed(o, s, 'Holy Symbol'),
          bless: landed(o, s, 'Bless Province'),
          blocked: says(o, 'casting limit'),
        },
        want: { symbol: true, bless: true, blocked: false },
      };
    },
  },
  {
    name: 'without the Wonder, Bless Province spends the slot like any spell',
    stage: (b) => mage(b, { white: 1 }, cast('Bless Province', b.X.id), cast('Holy Symbol')),
    check(o, s) {
      return {
        got: {
          bless: landed(o, s, 'Bless Province'),
          blocked: says(o, `${s.hero.name}: White Magic level 1 casting limit (1/1 per turn). Holy Symbol blocked.`),
        },
        want: { bless: true, blocked: true },
      };
    },
  },
  {
    name: 'a hero with no skill in the school cannot cast: told, unrolled, no slot spent',
    stage: (b) => mage(b, { psychic: 1 }, cast('Holy Symbol')),
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name} attempts to cast Holy Symbol but lacks the required White Magic skill — the practice order earlier this turn did not result in a skill gain. The spell fails.`,
          ),
          rolled: says(o, '📊'),
        },
        want: { refused: true, rolled: false },
      };
    },
  },
  {
    name: 'a mastery spell (Sanctuary, White 7) is refused below its level, unrolled',
    stage: (b) => mage(b, { white: 6 }, cast('Sanctuary', b.X.id)),
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name} cannot yet wield Sanctuary — it demands White Magic level 7, and they have reached only 6.`,
          ),
          rolled: says(o, '📊'),
        },
        want: { refused: true, rolled: false },
      };
    },
  },
  {
    name: 'a mastery spell is worked once a turn: a second is refused, unrolled',
    stage: (b) => mage(b, { white: 7 }, cast('Sanctuary', b.X.id), cast('Sanctuary', b.X.id)),
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name} has already invoked Sanctuary this turn — such mastery may be worked but once per turn.`,
          ),
          rolls: o.lines.filter((l) => l.text.startsWith(`📊 ${s.hero.name} casts`)).length,
        },
        want: { refused: true, rolls: 1 },
      };
    },
  },
  {
    name: "a spell item (Use Item): worked at 95% and at least level 3, told; a small chance at Sage and the school's lesson",
    stage(b) {
      const h = at(b, {});
      const censer = item(b, 'Censer of Plenty');
      holding(h, censer);
      return { hero: h, orders: [one(h, order('use_item', String(censer['id']), b.X.id))], there: b.X };
    },
    check(o, s) {
      return {
        got: {
          invoked: says(o, `🔮 ${s.hero.name} invokes the Censer of Plenty to work Bless Province.`),
          roll: says(o, castLine(s.hero, 'Bless Province', 'white', 3, 95, 1, ' — 0 trained, +3 from the item')),
          blessed: province(o, must(s.there, 'the province'))['_blessedTurn'],
          sage: xpIn(o, s.hero, 'sage'),
          white: xpIn(o, s.hero, 'white'),
          kept: char(o, s.hero).items.map((i) => i['name']),
        },
        want: { invoked: true, roll: true, blessed: o.turn, sage: [SMALL], white: [STD], kept: ['Censer of Plenty'] },
      };
    },
  },
  {
    name: "a spell item in a trained caster's hands works at his own level when that is higher",
    stage(b) {
      const h = at(b, { white: 4 });
      const censer = item(b, 'Censer of Plenty');
      holding(h, censer);
      return { hero: h, orders: [one(h, order('use_item', String(censer['id']), b.X.id))], there: b.X };
    },
    check(o, s) {
      return {
        got: { roll: says(o, castLine(s.hero, 'Bless Province', 'white', 4, 95, 1)) },
        want: { roll: true },
      };
    },
  },
  {
    name: "a spell item's cast that fizzles teaches nothing of its school (only the small chance at Sage)",
    dice: UNLUCKY,
    stage(b) {
      const h = at(b, {});
      const censer = item(b, 'Censer of Plenty');
      holding(h, censer);
      return { hero: h, orders: [one(h, order('use_item', String(censer['id']), b.X.id))], there: b.X };
    },
    check(o, s) {
      return {
        got: {
          fizzled: says(o, `${s.hero.name}'s Bless Province fizzles — the spell dissipates without effect.`),
          sage: xpIn(o, s.hero, 'sage'),
          white: xpIn(o, s.hero, 'white'),
        },
        want: { fizzled: true, sage: [SMALL], white: [] },
      };
    },
  },
  {
    name: 'a spell item cannot work a mastery spell: the item lies inert, unrolled',
    stage(b) {
      const h = at(b, {});
      const rod: Item = {
        ...item(b, 'Censer of Plenty'),
        name: 'Rod of the Last Word',
        effect: { stat: 'castSpell', spell: 'Divine Judgment', bonus: 0 },
      };
      holding(h, rod);
      return { hero: h, orders: [one(h, order('use_item', String(rod['id'])))], there: b.X };
    },
    check(o, s) {
      return {
        got: {
          inert: says(
            o,
            `${s.hero.name}: the Rod of the Last Word can no longer work Divine Judgment — such mastery must be earned, not carried. The item lies inert.`,
          ),
          rolled: says(o, '📊'),
        },
        want: { inert: true, rolled: false },
      };
    },
  },
  {
    name: "the Wailing Phylactery: the turn's first Necromancy spell cannot fail; the second rolls as ever",
    dice: UNLUCKY,
    stage(b) {
      const s = mage(b, { necromancy: 3 }, cast('Skeletal Armies'), cast('Skeletal Armies'));
      holding(s.hero, item(b, 'Wailing Phylactery'));
      return s;
    },
    check(o, s) {
      return {
        got: {
          first: says(o, castLine(s.hero, 'Skeletal Armies', 'necromancy', 3, 100, 100)),
          second: says(o, castLine(s.hero, 'Skeletal Armies', 'necromancy', 3, 60, 100)),
        },
        want: { first: true, second: true },
      };
    },
  },
  {
    name: 'a Necromancy spell that lands counts towards the Deathpriest; one that fizzles does not',
    stage: (b) => mage(b, { necromancy: 1 }, cast('Skeletal Armies')),
    check(o, s) {
      return { got: { dark: merit(o, s.hero, 'darkCasts') }, want: { dark: 1 } };
    },
  },
  {
    name: 'a hero who has Vanished cannot be reached by a hostile spell',
    stage(b) {
      const m = rival(b, {}, { thief: 9, melee: 1 });
      const s = mage(b, { psychic: 1 }, order('rest'), cast('Psychic Blast', m.id));
      return { ...s, mark: m, orders: [...s.orders, one(m, order('vanish'))] };
    },
    check(o, s) {
      const m = must(s.mark, 'the mark');
      return {
        got: {
          shadow: says(
            o,
            `${s.hero.name}'s Psychic Blast gropes after ${m.name} and finds only shadow — they have vanished, and nothing may touch them this season.`,
          ),
          skills: char(o, m).skills,
        },
        want: { shadow: true, skills: { melee: 1, tactical: 2, march: 1, thief: 9 } },
      };
    },
  },
  {
    name: 'a hero under a Veil cannot be reached by a hostile spell in that phase or the next',
    stage(b) {
      const m = rival(b, {}, { illusory: 9, melee: 1 });
      const s = mage(b, { psychic: 1 }, order('rest'), cast('Psychic Blast', m.id));
      return { ...s, mark: m, orders: [...s.orders, one(m, cast('Veil'))] };
    },
    check(o, s) {
      const m = must(s.mark, 'the mark');
      return {
        got: {
          veiled: says(
            o,
            `${s.hero.name}'s Psychic Blast cannot reach ${m.name} — they and their host are veiled from all hostile magic.`,
          ),
        },
        want: { veiled: true },
      };
    },
  },
  {
    name: 'the Cloak of Many Faces (as an older save holds it) hides its wearer from Psychic Blast and Curse',
    stage(b) {
      const m = holding(rival(b, {}, { melee: 1 }), oldCloakOfManyFaces(b));
      const s = mage(b, { psychic: 1, necromancy: 1 }, cast('Psychic Blast', m.id), cast('Curse', m.id));
      return { ...s, mark: m };
    },
    check(o, s) {
      const m = must(s.mark, 'the mark');
      return {
        got: {
          blast: says(o, `${s.hero.name}'s Psychic Blast cannot find ${m.name} — they are cloaked from hostile magic.`),
          curse: says(o, `${s.hero.name}'s Curse cannot find ${m.name} — they are cloaked from hostile magic.`),
          skills: char(o, m).skills,
        },
        want: { blast: true, curse: true, skills: { melee: 1, tactical: 2, march: 1 } },
      };
    },
  },
  {
    name: 'the Cloak of Many Faces does not turn aside other spells (a Telekinetic Storm)',
    stage(b) {
      const m = leads(holding(rival(b), oldCloakOfManyFaces(b)), companies(2, 'Men-at-Arms', 'Veteran'));
      const s = mage(b, { psychic: 1 }, cast('Telekinetic Storm', m.id));
      return { ...s, mark: m };
    },
    check(o, s) {
      const m = must(s.mark, 'the mark');
      return {
        got: {
          cloaked: says(o, 'cloaked from hostile magic'),
          hurled: says(o, `Telekinetic Storm hurls ${m.name}'s troops about`),
        },
        want: { cloaked: false, hurled: true },
      };
    },
  },
  {
    name: "a Cloak of Many Faces as a lair deals it today hides nobody (its power's name is read by nothing: Parked)",
    stage(b) {
      const m = holding(rival(b, {}, { melee: 1 }), item(b, 'Cloak of Many Faces'));
      const s = mage(b, { psychic: 1 }, cast('Psychic Blast', m.id));
      return { ...s, mark: m };
    },
    check(o) {
      return {
        got: { cloaked: says(o, 'cloaked from hostile magic'), blasted: says(o, 'unleashes Psychic Blast') },
        want: { cloaked: false, blasted: true },
      };
    },
  },
  {
    name: 'the casting limit counts the order as the realm\'s order form writes it ("Cast Spell") as well as a bot\'s',
    stage(b) {
      const asSent = { ...cast('Holy Symbol'), action: 'Cast Spell' };
      return mage(b, { white: 1 }, asSent, asSent);
    },
    check(o, s) {
      return {
        got: {
          blocked: says(o, `${s.hero.name}: White Magic level 1 casting limit (1/1 per turn). Holy Symbol blocked.`),
        },
        want: { blocked: true },
      };
    },
  },
  {
    name: "a Neutral realm's Wonder is no Grand Cathedral: its Bless spends the slot",
    stage(b) {
      realm(b)['alignment'] = 'Neutral';
      knows(b, 0, 'gd');
      realm(b)['gdProvinceId'] = null;
      return mage(b, { white: 1 }, cast('Bless Province', b.X.id), cast('Holy Symbol'));
    },
    check(o, s) {
      return {
        got: {
          blocked: says(o, `${s.hero.name}: White Magic level 1 casting limit (1/1 per turn). Holy Symbol blocked.`),
        },
        want: { blocked: true },
      };
    },
  },
  {
    name: "a spell item's cast is outside the casting limit: a White 1 caster works his spell and his item's",
    stage(b) {
      const h = at(b, { white: 1 });
      const censer = item(b, 'Censer of Plenty');
      holding(h, censer);
      return {
        hero: h,
        orders: [one(h, cast('Holy Symbol'), order('use_item', String(censer['id']), b.X.id))],
        there: b.X,
      };
    },
    check(o, s) {
      return {
        got: {
          symbol: landed(o, s, 'Holy Symbol'),
          bless: landed(o, s, 'Bless Province'),
          blocked: says(o, 'casting limit'),
        },
        want: { symbol: true, bless: true, blocked: false },
      };
    },
  },
  {
    name: 'a mastery spell refused below its level spends no slot: three White spells still land after it (White 6)',
    stage: (b) =>
      mage(b, { white: 6 }, cast('Sanctuary', b.X.id), cast('Holy Symbol'), cast('Holy Symbol'), cast('Holy Symbol')),
    check(o, s) {
      return {
        got: {
          refused: says(o, 'cannot yet wield Sanctuary'),
          rolls: o.lines.filter((l) => l.text.startsWith(`📊 ${s.hero.name} casts Holy Symbol`)).length,
          blocked: says(o, 'casting limit'),
        },
        want: { refused: true, rolls: 3, blocked: false },
      };
    },
  },
  {
    name: 'the Wailing Phylactery makes only Necromancy certain: a White spell still rolls',
    dice: UNLUCKY,
    stage(b) {
      const s = mage(b, { white: 2 }, cast('Holy Symbol'));
      holding(s.hero, item(b, 'Wailing Phylactery'));
      return s;
    },
    check(o, s) {
      return { got: { roll: says(o, castLine(s.hero, 'Holy Symbol', 'white', 2, 50, 100)) }, want: { roll: true } };
    },
  },
  {
    name: 'a hero fallen elsewhere is no mark that has moved on: the spell simply finds nobody here',
    stage(b) {
      const d = fallen(b, ring1(b, 0), { player: 1 });
      return { ...mage(b, { psychic: 1 }, cast('Psychic Blast', d.id)), mark: d };
    },
    check(o, s) {
      return {
        got: {
          nobody: says(o, `Psychic Blast: no valid target hero in ${must(s.there, 'the province').name} this phase.`),
          gone: says(o, 'finds them gone'),
        },
        want: { nobody: true, gone: false },
      };
    },
  },
  {
    name: 'a friendly spell still reaches a friend who has Vanished',
    stage(b) {
      const f = at(b, { thief: 9 }, { troops: 2 });
      const s = mage(b, { psychic: 1 }, order('rest'), cast('Oratory', f.id));
      return { ...s, mark: f, orders: [...s.orders, one(f, order('vanish'))] };
    },
    check(o, s) {
      return {
        got: {
          stirred: says(o, `lifts ${must(s.mark, 'the friend').name}'s troops`),
          shadow: says(o, 'finds only shadow'),
        },
        want: { stirred: true, shadow: false },
      };
    },
  },
  {
    name: "a charmed enemy hero will not turn hostile magic on his own lord's people: refused, unrolled",
    wholeTurnOnly: true,
    stage(b) {
      const m = rival(b, {}, { psychic: 2 });
      const lord = rival(b, {}, { melee: 1 });
      const s = mage(b, { psychic: 3 }, cast('Charm', m.id));
      return {
        ...s,
        mark: m,
        other: lord,
        written: {
          0: {
            [`charm_${String(m.id)}_via_${String(s.hero.id)}_ph0`]: plan(order('rest'), cast('Psychic Blast', lord.id)),
          },
        },
      };
    },
    check(o, s) {
      const m = must(s.mark, 'the charmed hero');
      const lord = must(s.other, 'his lord');
      return {
        got: {
          refused: anySays(
            o,
            `${m.name} lets the Psychic Blast die on their lips — the Charm bends their will, but not so far as to turn them on their own lord's people.`,
          ),
          rolled: anySays(o, `📊 ${m.name} casts`),
          lordSkills: char(o, lord).skills,
        },
        want: { refused: true, rolled: false, lordSkills: { melee: 1, tactical: 2, march: 1 } },
      };
    },
  },
];
/** The name of the province a hero stands in after the turn. */
const ring1Name = (o: Outcome, c: Character) => must(o.world.world.provinces[char(o, c).location], 'his province').name;

// ── White Magic ─────────────────────────────────────────────────────────────────────────────────────────────────
/** A White mage of realm 0 in the middle, of White `n`, casting `spell` at `extra`. */
const priest = (b: Board, n: number, spell: string, extra: string | number = '', skills: Record<string, number> = {}) =>
  mage(b, { white: n, ...skills }, cast(spell, extra));
const raised = (o: Outcome, s: Staged, d: Character) =>
  says(
    o,
    `✨ ${s.hero.name} calls upon divine power — ${d.name} rises from death at full health, stripped of all possessions, and now serves ${realmName(o, 0)}!`,
  );
export const RESURRECT_CASES: CastSpellOrderCase[] = [
  {
    name: 'Resurrect: a fallen hero of his realm lying where he stands rises at full health, with nothing he carried, serving the realm',
    stage(b) {
      const d = fallen(b);
      d.hp = 0;
      d.maxHp = 24;
      d['hpEarned'] = 9;
      return { ...priest(b, 3, 'Resurrect'), mark: d };
    },
    check(o, s) {
      const d = must(s.mark, 'the fallen');
      const after = char(o, d);
      return {
        got: {
          raised: raised(o, s, d),
          private: publicLine(o, `${d.name} rises from death at full health`),
          alive: after.alive,
          hp: after.hp,
          where: after.location,
          inProvince: province(o, b0(s)).characters.includes(d.id),
          realm: after.player,
          king: after.isKing,
          items: after.items.length,
          armies: after.armies.length,
          graveyard: graveyard(o),
          holy: merit(o, s.hero, 'holyCasts'),
          lessons: xpIn(o, s.hero, 'white'),
        },
        want: {
          raised: true,
          private: false,
          alive: true,
          hp: 24,
          where: b0(s).id,
          inProvince: true,
          realm: 0,
          king: false,
          items: 0,
          armies: 0,
          graveyard: [],
          holy: 1,
          lessons: [STD],
        },
      };
    },
  },
  {
    name: 'Resurrect: the raised hero acts on the orders his realm wrote for him, from the phase after the cast',
    wholeTurnOnly: true,
    stage(b) {
      const d = fallen(b);
      const s = priest(b, 3, 'Resurrect');
      return {
        ...s,
        mark: d,
        there: ring1(b, 0),
        written: {
          0: {
            [`resurrect_${String(d.id)}_via_${String(s.hero.id)}_ph0`]: plan(
              order('rest'),
              order('move', ring1(b, 0).id),
            ),
          },
        },
      };
    },
    check(o, s) {
      const d = must(s.mark, 'the fallen');
      return {
        got: {
          takesUp: says(
            o,
            `${d.name} takes up the orders ${realmName(o, 0)} laid down for them — 4 phases of this turn remain to be acted on.`,
          ),
          moved: char(o, d).location,
        },
        want: { takesUp: true, moved: b0(s).id },
      };
    },
  },
  {
    name: "Resurrect: a rival realm's orders for the same body are never his",
    wholeTurnOnly: true,
    stage(b) {
      const d = fallen(b);
      const s = priest(b, 3, 'Resurrect');
      return {
        ...s,
        mark: d,
        written: {
          1: {
            [`resurrect_${String(d.id)}_via_${String(s.hero.id)}_ph0`]: plan(
              order('rest'),
              order('move', ring1(b, 0).id),
            ),
          },
        },
      };
    },
    check(o, s) {
      const d = must(s.mark, 'the fallen');
      return {
        got: { takesUp: says(o, 'takes up the orders'), where: char(o, d).location },
        want: { takesUp: false, where: b0(s).id },
      };
    },
  },
  {
    name: 'Resurrect: with two bodies here, the one named is raised, not the freshest',
    stage(b) {
      const older = fallen(b, b.X, { killedOnTurn: 0 });
      const newer = fallen(b, b.X, { killedOnTurn: 1 });
      return { ...priest(b, 3, 'Resurrect', older.id), mark: older, other: newer };
    },
    check(o, s) {
      return {
        got: { older: char(o, must(s.mark, 'older')).alive, newer: char(o, must(s.other, 'newer')).alive },
        want: { older: true, newer: false },
      };
    },
  },
  {
    name: 'Resurrect: with none named, the freshest body here is raised',
    stage(b) {
      const older = fallen(b, b.X, { killedOnTurn: 0 });
      const newer = fallen(b, b.X, { killedOnTurn: 1 });
      return { ...priest(b, 3, 'Resurrect'), mark: newer, other: older };
    },
    check(o, s) {
      return {
        got: { newer: char(o, must(s.mark, 'newer')).alive, older: char(o, must(s.other, 'older')).alive },
        want: { newer: true, older: false },
      };
    },
  },
  {
    name: 'Resurrect: a body lying elsewhere is out of reach, even one his realm knows of',
    stage(b) {
      const d = fallen(b, ring1(b, 0));
      realm(b)['knownDeadHeroIds'] = [d.id];
      return { ...priest(b, 3, 'Resurrect', d.id), mark: d };
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name} casts Resurrect, but no fallen hero you know of lies in ${b0(s).name} — perhaps another raised them first.`,
          ),
          alive: char(o, must(s.mark, 'the fallen')).alive,
        },
        want: { refused: true, alive: false },
      };
    },
  },
  {
    name: 'Resurrect: with none named, a body lying elsewhere is out of reach, even one his realm knows of',
    stage(b) {
      const d = fallen(b, ring1(b, 0));
      realm(b)['knownDeadHeroIds'] = [d.id];
      return { ...priest(b, 3, 'Resurrect'), mark: d };
    },
    check(o, s) {
      return {
        got: {
          refused: says(o, 'no fallen hero you know of lies in'),
          alive: char(o, must(s.mark, 'the fallen')).alive,
        },
        want: { refused: true, alive: false },
      };
    },
  },
  {
    name: 'Resurrect: a fallen king (not a monarch borne home) cannot be raised',
    stage(b) {
      const d = fallen(b, b.X, { king: true });
      return { ...priest(b, 3, 'Resurrect', d.id), mark: d };
    },
    check(o, s) {
      const d = must(s.mark, 'the fallen king');
      return {
        got: {
          refused: says(o, `${s.hero.name}: ${d.name} was a king — kings cannot be resurrected.`),
          alive: char(o, d).alive,
        },
        want: { refused: true, alive: false },
      };
    },
  },
  {
    name: 'Resurrect: a hero who served another crown will not answer',
    stage(b) {
      const d = fallen(b, b.X, { served: [1, 0] });
      return { ...priest(b, 3, 'Resurrect', d.id), mark: d };
    },
    check(o, s) {
      const d = must(s.mark, 'the fallen');
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name}: ${d.name} once swore to another crown — that oath holds even in death, and the spirit will not answer.`,
          ),
          alive: char(o, d).alive,
        },
        want: { refused: true, alive: false },
      };
    },
  },
  {
    name: "Resurrect: an enemy realm's fallen hero will not answer either",
    stage(b) {
      const d = fallen(b, b.X, { player: 1 });
      return { ...priest(b, 3, 'Resurrect', d.id), mark: d };
    },
    check(o, s) {
      const d = must(s.mark, 'the fallen');
      return {
        got: { refused: says(o, `${d.name} once swore to another crown`), alive: char(o, d).alive },
        want: { refused: true, alive: false },
      };
    },
  },
  {
    name: 'Resurrect: a fallen wanderer who served no crown rises to serve his realm, his wandering name put aside',
    stage(b) {
      const d = fallen(b, b.X, { player: null });
      d.name = `${d.name} (wandering)`;
      return { ...priest(b, 3, 'Resurrect', d.id), mark: d };
    },
    check(o, s) {
      const d = must(s.mark, 'the fallen');
      const after = char(o, d);
      return {
        got: { alive: after.alive, realm: after.player, name: after.name },
        want: { alive: true, realm: 0, name: d.name.replace(' (wandering)', '') },
      };
    },
  },
  {
    name: 'Resurrect: a grave whose hero cannot be found tells the caster so',
    stage(b) {
      const d = fallen(b);
      b.G.characters = b.G.characters.filter((c) => c.id !== d.id);
      return { ...priest(b, 3, 'Resurrect', d.id), mark: d };
    },
    check(o, s) {
      return {
        got: { told: says(o, `${s.hero.name}: the spirit of ${must(s.mark, 'the fallen').name} cannot be found.`) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Resurrect: a monarch borne home rises for his own realm and takes back the throne; the heir steps down',
    stage(b) {
      // as the turn leaves a fallen king: his crown passed to the heir, his body borne home (his grave here), he
      // himself where he fell
      const d = fallen(b, b.X, { king: true });
      d.isKing = false;
      d.location = ring2(b, 0).id;
      const g = (b.G as unknown as { heroGraveyard: Record<string, unknown>[] }).heroGraveyard.find(
        (x) => x['id'] === d.id,
      );
      must(g, 'the grave')['_monarch'] = true;
      realm(b)['_resurrectableMonarchId'] = d.id;
      const heir = at(b, {}, { at: ring1(b, 0), king: true });
      heir['_isHeir'] = true;
      return { ...priest(b, 3, 'Resurrect', d.id), mark: d, other: heir };
    },
    check(o, s) {
      const d = must(s.mark, 'the monarch');
      const heir = must(s.other, 'the heir');
      const stepsDown = `👑 ${heir.name} steps down from the throne as ${d.name} is restored to life — the former regent now serves the realm as a hero.`;
      return {
        got: {
          throne: says(
            o,
            `✨👑 ${s.hero.name} calls upon divine power — ${d.name} rises from death at full health and reclaims the throne of ${realmName(o, 0)}! The rightful king walks again, stripped of all possessions but restored in spirit and skill.`,
          ),
          stepsDown: anySays(o, stepsDown),
          private: [publicLine(o, stepsDown), publicLine(o, `${d.name} rises from death at full health and reclaims`)],
          king: char(o, d).isKing,
          where: char(o, d).location,
          heirKing: char(o, heir).isKing,
          slot: must(o.world.players[0], 'realm 0')['_resurrectableMonarchId'],
        },
        want: {
          throne: true,
          stepsDown: true,
          private: [false, false],
          king: true,
          where: b0(s).id,
          heirKing: false,
          slot: null,
        },
      };
    },
  },
  {
    name: "Resurrect: a monarch's crown answers only its own realm",
    stage(b) {
      const d = fallen(b, b.X, { king: true, player: 1 });
      const g = (b.G as unknown as { heroGraveyard: Record<string, unknown>[] }).heroGraveyard.find(
        (x) => x['id'] === d.id,
      );
      must(g, 'the grave')['_monarch'] = true;
      realm(b, 1)['_resurrectableMonarchId'] = d.id;
      return { ...priest(b, 3, 'Resurrect', d.id), mark: d };
    },
    check(o, s) {
      const d = must(s.mark, 'the monarch');
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name}: the fallen crown of ${d.name} answers only to its own realm — no rival's prayer will restore it.`,
          ),
          alive: char(o, d).alive,
        },
        want: { refused: true, alive: false },
      };
    },
  },
  {
    name: 'Resurrect: only the most recently fallen monarch may be restored',
    stage(b) {
      const d = fallen(b, b.X, { king: true });
      const g = (b.G as unknown as { heroGraveyard: Record<string, unknown>[] }).heroGraveyard.find(
        (x) => x['id'] === d.id,
      );
      must(g, 'the grave')['_monarch'] = true;
      realm(b)['_resurrectableMonarchId'] = d.id + 1000;
      return { ...priest(b, 3, 'Resurrect', d.id), mark: d };
    },
    check(o, s) {
      const d = must(s.mark, 'the monarch');
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name}: the spirit of ${d.name} has passed beyond recall — only your most recently fallen monarch may be restored.`,
          ),
          alive: char(o, d).alive,
        },
        want: { refused: true, alive: false },
      };
    },
  },
];
export const PART_SEA_CASES: CastSpellOrderCase[] = [
  {
    name: 'Part Sea: a sea beside him lies bare as dry ground for the rest of the turn, told to all; the sea returns at its end',
    wholeTurnOnly: true,
    stage(b) {
      const sea = ring1(b, 0);
      sea.terrain = 'sea';
      return { ...priest(b, 1, 'Part Sea', sea.id), there: sea };
    },
    check(o, s) {
      const sea = b0(s);
      const said = `✨ ${s.hero.name} raises their hands and the waters of ${sea.name} draw back — the seabed lies bare as dry plains for the rest of the turn. Land armies may cross freely, but no fleet can enter or leave from the next phase onward.`;
      return {
        got: {
          told: says(o, said),
          public: publicLine(o, said),
          after: province(o, sea).terrain,
          lessons: xpIn(o, s.hero, 'white'),
        },
        want: { told: true, public: true, after: 'sea', lessons: [STD] },
      };
    },
  },
  {
    name: 'Part Sea: the sea he stands in can be parted too',
    stage(b) {
      b.X.terrain = 'sea';
      return priest(b, 1, 'Part Sea', b.X.id);
    },
    check(o, s) {
      return { got: { parted: says(o, `the waters of ${b0(s).name} draw back`) }, want: { parted: true } };
    },
  },
  {
    name: 'Part Sea: a province two away is out of reach',
    stage(b) {
      const sea = ring2(b, 0);
      sea.terrain = 'sea';
      return { ...priest(b, 1, 'Part Sea', sea.id), there: sea };
    },
    check(o, s) {
      return {
        got: {
          refused: says(o, `${s.hero.name}: Part Sea can only target a province you are in or next to.`),
          parted: says(o, 'draw back'),
        },
        want: { refused: true, parted: false },
      };
    },
  },
  {
    name: 'Part Sea on dry land finds no sea to part',
    stage(b) {
      return { ...priest(b, 1, 'Part Sea', ring1(b, 0).id), there: ring1(b, 0) };
    },
    check(o, s) {
      return {
        got: {
          dry: says(
            o,
            `✨ ${s.hero.name} calls the waters back from ${b0(s).name}, but the ground already lies dry — the spell finds no sea to part.`,
          ),
          terrain: province(o, b0(s)).terrain,
        },
        want: { dry: true, terrain: 'plain' },
      };
    },
  },
  {
    name: 'Part Sea after a Flood: the waters draw back, and a land column marches in; the land is itself again when the turn ends',
    wholeTurnOnly: true,
    stage(b) {
      const p = ring1(b, 0);
      const s = mage(b, { white: 1, elemental: 1 }, cast('Flood', p.id), cast('Part Sea', p.id));
      const col = at(b, {}, { troops: 2, at: ring1(b, 1) });
      return {
        ...s,
        there: p,
        other: col,
        orders: [...s.orders, one(col, order('rest'), order('rest'), order('move', p.id))],
      };
    },
    check(o, s) {
      const col = must(s.other, 'the column');
      return {
        got: {
          parted: says(o, `the waters of ${b0(s).name} draw back`),
          barred: anySays(o, `${col.name} is turned back at ${b0(s).name}`),
          claims: anySays(o, `${col.name} claims ${b0(s).name} for ${realmName(o, 0)}!`),
          terrain: province(o, b0(s)).terrain,
        },
        want: { parted: true, barred: false, claims: true, terrain: 'plain' },
      };
    },
  },
  {
    name: 'Part Sea: the owner of a parted province is told',
    stage(b) {
      const sea = ring1(b, 0);
      sea.terrain = 'sea';
      b.own(sea, 1);
      return { ...priest(b, 1, 'Part Sea', sea.id), there: sea };
    },
    check(o, s) {
      return {
        got: {
          owner: toldTo(
            o,
            `🌊 ${s.hero.name} (${realmName(o, 0)}) has parted the sea at ${b0(s).name} — it lies as dry plains for the rest of the turn; land armies may cross it and no fleet may enter or leave from the next phase.`,
          ),
        },
        want: { owner: [1] },
      };
    },
  },
  {
    name: "Part Sea: an enemy's Bless ward may turn it aside (a low die)",
    dice: LUCKY,
    stage(b) {
      const sea = ring1(b, 0);
      sea.terrain = 'sea';
      Object.assign(sea, { _blessWardTurn: b.G.turn, _blessWardBy: 1, _blessWardPct: 50 });
      return { ...priest(b, 1, 'Part Sea', sea.id), there: sea };
    },
    check(o, s) {
      return {
        got: {
          warded: anySays(
            o,
            `✨ A blessing lies over ${b0(s).name} — ${s.hero.name}'s Part Sea washes over the sacred ground and does no harm.`,
          ),
          parted: says(o, 'draw back'),
        },
        want: { warded: true, parted: false },
      };
    },
  },
  {
    name: "Part Sea: his own realm's Bless ward never turns aside his own spell",
    dice: LUCKY,
    stage(b) {
      const sea = ring1(b, 0);
      sea.terrain = 'sea';
      Object.assign(sea, { _blessWardTurn: b.G.turn, _blessWardBy: 0, _blessWardPct: 100 });
      return { ...priest(b, 1, 'Part Sea', sea.id), there: sea };
    },
    check(o, s) {
      return { got: { parted: says(o, `the waters of ${b0(s).name} draw back`) }, want: { parted: true } };
    },
  },
];
export const HOLY_SYMBOL_CASES: CastSpellOrderCase[] = [
  {
    name: 'Holy Symbol: every battlefield grave where he stands is cleansed, and his realm knows the ground is clean',
    stage(b) {
      bury(b.X, 3);
      realm(b)['_graveIntel'] = { [String(b.X.id)]: { turn: 0, detail: [{ k: 'Average Men-at-Arms', n: 3 }] } };
      return priest(b, 1, 'Holy Symbol');
    },
    check(o, s) {
      const p = b0(s);
      return {
        got: {
          own: says(
            o,
            `✝ ${s.hero.name} raises the Holy Symbol over ${p.name} and the graves of its battlefield dead are cleansed — every fallen unit buried there is laid to rest, beyond the reach of any necromancer.`,
          ),
          public: anySays(
            o,
            `✝ ${s.hero.name} (${realmName(o, 0)}) raises a Holy Symbol over the battlefields of ${p.name}, and the dead buried there are laid to rest — the graves are cleansed and can no longer be raised.`,
          ),
          graves: graves(o, p),
          lore: graveLore(o, 0),
          holy: merit(o, s.hero, 'holyCasts'),
        },
        want: { own: true, public: true, graves: [], lore: {}, holy: 1 },
      };
    },
  },
  {
    name: 'Holy Symbol: where no dead lie there is nothing to cleanse (still a holy work)',
    stage: (b) => priest(b, 1, 'Holy Symbol'),
    check(o, s) {
      return {
        got: { told: says(o, NOTHING_TO_CLEANSE(s)), holy: merit(o, s.hero, 'holyCasts') },
        want: { told: true, holy: 1 },
      };
    },
  },
];
const blessed = (o: Outcome, s: Staged, pct: string, ward: number) =>
  says(
    o,
    `✨ ${s.hero.name} blesses ${b0(s).name} — its lands flourish, yielding ${pct} at collection this turn. The sacred ground is warded — a ${String(ward)}% chance to turn aside any enemy Flood, Earthquake, Plague or Part Sea cast here this turn.`,
  );
export const BLESS_PROVINCE_CASES: CastSpellOrderCase[] = [
  {
    name: 'Bless Province: +60% tax this turn and a ward of 50% and 5% a White level (White 1: 55%)',
    stage(b) {
      realm(b)['alignment'] = 'Neutral';
      return priest(b, 1, 'Bless Province', b.X.id);
    },
    check(o, s) {
      const p = province(o, b0(s));
      return {
        got: {
          told: blessed(o, s, '+60% tax', 55),
          private: publicLine(o, `✨ ${s.hero.name} blesses`),
          turn: p['_blessedTurn'],
          mult: p['_blessedMult'],
          ward: [p['_blessWardTurn'], p['_blessWardBy'], p['_blessWardPct']],
          holy: merit(o, s.hero, 'holyCasts'),
        },
        want: { told: true, private: false, turn: o.turn, mult: 1.6, ward: [o.turn, 0, 55], holy: 1 },
      };
    },
  },
  {
    name: 'Bless Province: the ward counts White only to level 5 (75%)',
    stage(b) {
      realm(b)['alignment'] = 'Neutral';
      return priest(b, 7, 'Bless Province', b.X.id);
    },
    check(o, s) {
      return { got: { told: blessed(o, s, '+60% tax', 75) }, want: { told: true } };
    },
  },
  {
    name: "Bless Province: a Divine realm's caster blesses at +80%",
    stage: (b) => priest(b, 2, 'Bless Province', b.X.id),
    check(o, s) {
      return { got: { told: blessed(o, s, '+80% tax (Divine blessing)', 60) }, want: { told: true } };
    },
  },
  {
    name: "Bless Province: a Divine realm's king blesses at +100%",
    stage(b) {
      const s = priest(b, 2, 'Bless Province', b.X.id);
      s.hero.isKing = true;
      return s;
    },
    check(o, s) {
      return {
        got: {
          told: blessed(o, s, "+100% tax (a Divine king's blessing — the gods answer their anointed in full)", 60),
        },
        want: { told: true },
      };
    },
  },
  {
    name: "Bless Province: a Neutral realm's king blesses as any caster (+60%)",
    stage(b) {
      realm(b)['alignment'] = 'Neutral';
      const s = priest(b, 2, 'Bless Province', b.X.id);
      s.hero.isKing = true;
      return s;
    },
    check(o, s) {
      return { got: { told: blessed(o, s, '+60% tax', 60) }, want: { told: true } };
    },
  },
  {
    name: 'Bless Province: Rites of Plenty add 45 to the tax (+105% for a Neutral realm)',
    stage(b) {
      realm(b)['alignment'] = 'Neutral';
      knows(b, 0, 'ad09');
      return priest(b, 1, 'Bless Province', b.X.id);
    },
    check(o, s) {
      return { got: { told: blessed(o, s, '+105% tax', 55) }, want: { told: true } };
    },
  },
  {
    name: 'Bless Province: a province beside him can be blessed; one two away cannot',
    stage(b) {
      const s = mage(b, { white: 3 }, cast('Bless Province', ring1(b, 0).id), cast('Bless Province', ring2(b, 0).id));
      return { ...s, there: ring1(b, 0) };
    },
    check(o, s) {
      return {
        got: {
          near: province(o, b0(s))['_blessedTurn'],
          far: says(o, `${s.hero.name}: Bless Province can only target a province you are in or adjacent to.`),
        },
        want: { near: o.turn, far: true },
      };
    },
  },
  {
    name: 'Bless Province: blessings do not stack; a second this turn has no further effect',
    stage(b) {
      const s = priest(b, 1, 'Bless Province', b.X.id);
      const o2 = at(b, { white: 5 });
      return { ...s, other: o2, orders: [...s.orders, one(o2, order('rest'), cast('Bless Province', b.X.id))] };
    },
    check(o, s) {
      const o2 = must(s.other, 'the second priest');
      return {
        got: {
          second: anySays(
            o,
            `${o2.name}: ${b0(s).name} is already blessed this turn — a second Bless has no further effect (they do not stack).`,
          ),
          ward: province(o, b0(s))['_blessWardPct'],
        },
        want: { second: true, ward: 55 },
      };
    },
  },
];
export const SANCTUARY_CASES: CastSpellOrderCase[] = [
  {
    name: 'Sanctuary (White 7): hostile armies giving battle in the province fight at −25% this turn; told to all and to its owner',
    stage(b) {
      const p = ring1(b, 0);
      b.own(p, 1);
      return { ...priest(b, 7, 'Sanctuary', p.id), there: p };
    },
    check(o, s) {
      const p = b0(s);
      const said = `✨ ${s.hero.name} raises a Sanctuary over ${p.name} — hostile armies that give battle here fight at −25% strength this turn.`;
      return {
        got: {
          told: says(o, said),
          public: publicLine(o, said),
          owner: toldTo(
            o,
            `✨ ${s.hero.name} (${realmName(o, 0)}) has raised a Sanctuary over ${p.name} — armies hostile to that realm that give battle there fight at −25% strength this turn.`,
          ),
          marks: [province(o, p)['_sanctuaryTurn'], province(o, p)['_sanctuaryBy']],
        },
        want: { told: true, public: true, owner: [1], marks: [o.turn, 0] },
      };
    },
  },
  {
    name: 'Sanctuary: a province two away is out of reach',
    stage(b) {
      return { ...priest(b, 7, 'Sanctuary', ring2(b, 0).id), there: ring2(b, 0) };
    },
    check(o, s) {
      return {
        got: {
          refused: says(o, `${s.hero.name}: Sanctuary must ward your province or one adjacent.`),
          mark: province(o, b0(s))['_sanctuaryTurn'],
        },
        want: { refused: true, mark: undefined },
      };
    },
  },
];
export const DIVINE_JUDGMENT_CASES: CastSpellOrderCase[] = [
  {
    name: 'Divine Judgment (White 9): 10 and 3 a level of holy damage (to 5: 25) and 2 and one for each two levels of his companies (4) smitten',
    stage(b) {
      const m = leads(rival(b, { hp: 40 }), companies(6, 'Men-at-Arms', 'Veteran'));
      m.maxHp = 40;
      m['hpEarned'] = 25;
      const s = priest(b, 9, 'Divine Judgment', m.id);
      return { ...s, mark: m, orders: [...s.orders, standsWatch(m)] };
    },
    check(o, s) {
      const m = must(s.mark, 'the mark');
      return {
        got: {
          told: says(
            o,
            `⚡ ${s.hero.name} calls down Divine Judgment on ${m.name} — 25 holy damage, and 4 of their units are smitten to ash!`,
          ),
          victim: toldTo(
            o,
            `⚡ Divine Judgment falls on ${m.name} from ${s.hero.name} — 25 holy damage, 4 units smitten.`,
          ),
          hp: char(o, m).hp,
          companies: char(o, m).armies.length,
        },
        want: { told: true, victim: [1], hp: 15, companies: 2 },
      };
    },
  },
  {
    name: 'Divine Judgment never kills: a hero of little health is left at 1 HP',
    stage(b) {
      const m = rival(b, { hp: 10 });
      const s = priest(b, 9, 'Divine Judgment', m.id);
      return { ...s, mark: m, orders: [...s.orders, standsWatch(m)] };
    },
    check(o, s) {
      const m = must(s.mark, 'the mark');
      return {
        got: { told: says(o, `— 25 holy damage!`), alive: char(o, m).alive, hp: char(o, m).hp },
        want: { told: true, alive: true, hp: 1 },
      };
    },
  },
  {
    name: 'Divine Judgment: no hero to judge here is refused',
    stage: (b) => priest(b, 9, 'Divine Judgment', ''),
    check(o, s) {
      return {
        got: { refused: says(o, `Divine Judgment: no valid enemy hero in ${b0(s).name} this phase.`) },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Divine Judgment cannot be turned on his own heroes',
    stage(b) {
      const friend = at(b, {});
      return { ...priest(b, 9, 'Divine Judgment', friend.id), mark: friend };
    },
    check(o) {
      return {
        got: { refused: says(o, 'Divine Judgment cannot be turned on your own heroes.') },
        want: { refused: true },
      };
    },
  },
];
/** The province a case is about (the middle unless it names another). */
const b0 = (s: Staged) => must(s.there, 'the province');
/** A hero who stands watch all turn (Defend), so no Rest heals him. */
const standsWatch = (c: Character): [Character, Order[]] => [c, Array.from({ length: 5 }, () => order('defend'))];

// ── Psychic Magic ───────────────────────────────────────────────────────────────────────────────────────────────
/** A Psychic mage of realm 0 in the middle, of Psychic `n`, casting `spell` at `extra`. */
const psychic = (
  b: Board,
  n: number,
  spell: string,
  extra: string | number = '',
  skills: Record<string, number> = {},
) => mage(b, { psychic: n, ...skills }, cast(spell, extra));
const mark = (s: Staged) => must(s.mark, 'the hero aimed at');
/** The name of the hero aimed at, his wandering put aside (a swayed wanderer's lines name him so). */
const served = (s: Staged) => mark(s).name.replace(' (wandering)', '');
const swaysWanderer = (o: Outcome, s: Staged) =>
  says(
    o,
    `✨ ${s.hero.name}'s Charm sways ${served(s)} — the wandering hero joins ${realmName(o, 0)} at no cost (you must still pay their upkeep).`,
  );
const readsMind = (o: Outcome, s: Staged, skills: string, items: string) =>
  says(
    o,
    `🔍 ${s.hero.name} reads ${served(s)}'s mind as the Charm takes hold — Skills: ${skills}. Magic items: ${items}.`,
  );
const backlashRoll = (o: Outcome, s: Staged, why: string) =>
  says(o, `📊 Charm backlash — ${mark(s).name} may turn on ${s.hero.name} (${why}): `);
export const CHARM_CASES: CastSpellOrderCase[] = [
  {
    name: 'Charm: a wandering hero joins the realm for good, at no cost but his wage; the caster reads his mind',
    stage(b) {
      const w = wanderer(b, { melee: 3, spy: 1 });
      w['alignment'] = 'Neutral';
      return { ...psychic(b, 2, 'Charm', w.id), mark: w };
    },
    check(o, s) {
      const w = char(o, mark(s));
      return {
        got: {
          sways: swaysWanderer(o, s),
          mind: readsMind(o, s, 'Melee 3, Tactical 2, March 1, Spy 1', 'none'),
          realm: w.player,
          name: w.name,
          immune: w['_charmImmuneTurn'],
          resist: w['_charmResist'],
          lessons: xpIn(o, s.hero, 'psychic'),
        },
        want: {
          sways: true,
          mind: true,
          realm: 0,
          name: mark(s).name.replace(' (wandering)', ''),
          immune: o.turn + 1,
          resist: 30,
          lessons: [STD],
        },
      };
    },
  },
  {
    name: 'Charm: a wandering hero swayed acts on the orders the realm wrote for him, from the next phase',
    wholeTurnOnly: true,
    stage(b) {
      const w = wanderer(b, {});
      w['alignment'] = 'Neutral';
      const s = psychic(b, 2, 'Charm', w.id);
      return {
        ...s,
        mark: w,
        there: ring1(b, 0),
        written: {
          0: {
            [`charm_${String(w.id)}_via_${String(s.hero.id)}_ph0`]: plan(order('rest'), order('move', ring1(b, 0).id)),
          },
        },
      };
    },
    check(o, s) {
      const w = mark(s);
      return {
        got: {
          takesUp: says(
            o,
            `${served(s)} takes up the orders ${realmName(o, 0)} laid down for them — 4 phases of this turn remain to be acted on.`,
          ),
          moved: char(o, w).location,
        },
        want: { takesUp: true, moved: must(s.there, 'the destination').id },
      };
    },
  },
  {
    name: 'Charm: an enemy hero leading no troops falls under his command until the season turns, then goes home; his realm is warned',
    wholeTurnOnly: true,
    stage(b) {
      const m = rival(b, {}, { melee: 1 });
      return { ...psychic(b, 2, 'Charm', m.id), mark: m };
    },
    check(o, s) {
      const m = mark(s);
      const after = char(o, m);
      return {
        got: {
          grips: o.lines.some(
            (l) =>
              l.text ===
              `✨ ${s.hero.name}'s Charm grips ${m.name} — they fall under ${realmName(o, 0)}'s command until the season turns, when they return to their own lord (who still pays their wages).`,
          ),
          warned: toldTo(
            o,
            `⚠ ${m.name} is ensorcelled by an enemy Charm and slips your command until the season turns.`,
          ),
          mind: readsMind(o, s, 'Melee 1, Tactical 2, March 1', 'none'),
          home: after.player,
          immune: after['_charmImmuneTurn'],
          resist: after['_charmResist'],
        },
        want: { grips: true, warned: [1], mind: true, home: 1, immune: o.turn + 1, resist: 30 },
      };
    },
  },
  {
    name: 'Charm: the caster reads the magic items the swayed hero carries',
    stage(b) {
      const w = wanderer(b, {});
      w['alignment'] = 'Neutral';
      holding(w, item(b, 'Censer of Plenty'));
      return { ...psychic(b, 2, 'Charm', w.id), mark: w };
    },
    check(o, s) {
      return {
        got: {
          items: says(
            o,
            `${served(s)}'s mind as the Charm takes hold — Skills: Melee 2, Tactical 2, March 1. Magic items: the Censer of Plenty (Use Item: casts Bless Province (White Magic) as a phase order at 95%, whatever your skill.).`,
          ),
        },
        want: { items: true },
      };
    },
  },
  {
    name: 'Charm: no hero to sway here is refused',
    stage: (b) => psychic(b, 2, 'Charm', ''),
    check(o, s) {
      return {
        got: { refused: says(o, `Charm: no valid target hero stands in ${b0(s).name} this phase.`) },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Charm cannot be used on his own heroes',
    stage(b) {
      const f = at(b, {});
      return { ...psychic(b, 2, 'Charm', f.id), mark: f };
    },
    check(o) {
      return { got: { refused: says(o, 'Charm cannot be used on your own heroes.') }, want: { refused: true } };
    },
  },
  {
    name: 'Charm cannot sway a king',
    stage(b) {
      const k = rival(b, { king: true });
      return { ...psychic(b, 2, 'Charm', k.id), mark: k };
    },
    check(o, s) {
      return {
        got: { refused: says(o, 'Charm cannot sway a king.'), realm: char(o, mark(s)).player },
        want: { refused: true, realm: 1 },
      };
    },
  },
  {
    name: 'Charm cannot grip a hero leading troops',
    stage(b) {
      const m = leads(rival(b), companies(1));
      return { ...psychic(b, 2, 'Charm', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name}'s Charm cannot grip ${mark(s).name} — a hero leading troops is beyond its reach.`,
          ),
        },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Charm slides off a mind swayed last season (closed for a turn), and the hero may turn on the caster',
    stage(b) {
      const m = flees(rival(b));
      m['_charmImmuneTurn'] = b.G.turn;
      return { ...psychic(b, 2, 'Charm', m.id), mark: m };
    },
    check(o, s) {
      const m = mark(s);
      return {
        got: {
          slides: says(
            o,
            `${s.hero.name}'s Charm slides off ${m.name} — a mind so lately swayed is closed to enchantment for a season.`,
          ),
          backlash: backlashRoll(o, s, 'closed to enchantment this season'),
          realm: char(o, m).player,
        },
        want: { slides: true, backlash: true, realm: 1 },
      };
    },
  },
  {
    name: 'Charm: an immunity from an earlier turn has passed and is cleared',
    wholeTurnOnly: true,
    stage(b) {
      const m = wanderer(b, {});
      m['alignment'] = 'Neutral';
      m['_charmImmuneTurn'] = b.G.turn - 1;
      return { ...psychic(b, 2, 'Charm', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: { sways: swaysWanderer(o, s), immune: char(o, mark(s))['_charmImmuneTurn'] },
        want: { sways: true, immune: o.turn + 1 },
      };
    },
  },
  {
    name: 'Charm: a mind swayed before resists at 30% a time: a roll within it breaks the Charm, and his realm hears he threw it off',
    dice: rollOf(30),
    stage(b) {
      const m = flees(rival(b));
      m['_charmResist'] = 30;
      return { ...psychic(b, 2, 'Charm', m.id), mark: m };
    },
    check(o, s) {
      const m = mark(s);
      return {
        got: {
          roll: says(o, `📊 ${m.name} resists the Charm (30% — swayed 1 time before): `),
          breaks: says(
            o,
            `${s.hero.name}'s Charm breaks against ${m.name}'s will — a mind that has been swayed before knows the feel of it, and shuts.`,
          ),
          heard: toldTo(o, `${m.name} feels an enchantment reach for their mind — and throws it off.`),
          backlash: backlashRoll(o, s, 'the Charm was resisted'),
          realm: char(o, m).player,
        },
        want: { roll: true, breaks: true, heard: [1], backlash: true, realm: 1 },
      };
    },
  },
  {
    name: 'Charm: one over the resistance and it takes hold, and the resistance grows by 30',
    dice: rollOf(31),
    stage(b) {
      const m = wanderer(b, {});
      m['alignment'] = 'Neutral';
      m['_charmResist'] = 30;
      return { ...psychic(b, 2, 'Charm', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: { sways: swaysWanderer(o, s), resist: char(o, mark(s))['_charmResist'] },
        want: { sways: true, resist: 60 },
      };
    },
  },
  {
    name: 'Charm: the resistance tells how often he was swayed, and never passes 95%',
    dice: rollOf(40),
    stage(b) {
      const m = wanderer(b, {});
      m['alignment'] = 'Neutral';
      m['_charmResist'] = 90;
      return { ...psychic(b, 4, 'Charm', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: {
          roll: says(o, `📊 ${mark(s).name} resists the Charm (90% — swayed 3 times before): `),
          sways: swaysWanderer(o, s),
        },
        want: { roll: true, sways: false },
      };
    },
  },
  {
    name: 'Charm: a wanderer he just dismissed will not be drawn back the same season',
    stage(b) {
      const w = wanderer(b, {});
      w['_releasedTurn'] = b.G.turn;
      w['_releasedBy'] = 0;
      return { ...psychic(b, 2, 'Charm', w.id), mark: w };
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name}'s Charm finds ${mark(s).name} unmoved — a hero only just dismissed will not be drawn back the same season.`,
          ),
          realm: char(o, mark(s)).player,
        },
        want: { refused: true, realm: null },
      };
    },
  },
  {
    name: 'Charm: one dismissed by another realm can be swayed',
    stage(b) {
      const w = wanderer(b, {});
      w['alignment'] = 'Neutral';
      w['_releasedTurn'] = b.G.turn;
      w['_releasedBy'] = 1;
      return { ...psychic(b, 2, 'Charm', w.id), mark: w };
    },
    check(o, s) {
      return { got: { sways: swaysWanderer(o, s) }, want: { sways: true } };
    },
  },
  {
    name: 'Charm: an Undead soul cannot be swayed to a Divine crown',
    stage(b) {
      const w = wanderer(b, {});
      w['alignment'] = 'Undead';
      return { ...psychic(b, 2, 'Charm', w.id), mark: w };
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name}'s Charm washes over ${mark(s).name} and finds nothing to grip — Undead souls cannot be swayed to a Divine crown.`,
          ),
          realm: char(o, mark(s)).player,
        },
        want: { refused: true, realm: null },
      };
    },
  },
  {
    name: 'Charm: Diplomatic Protocols bridge even that gulf',
    stage(b) {
      knows(b, 0, 'sd31');
      const w = wanderer(b, {});
      w['alignment'] = 'Undead';
      return { ...psychic(b, 2, 'Charm', w.id), mark: w };
    },
    check(o, s) {
      return { got: { sways: swaysWanderer(o, s) }, want: { sways: true } };
    },
  },
  {
    name: 'Charm: a swayed wanderer is paid as the hire desk would pay him',
    stage(b) {
      const w = wanderer(b, { melee: 5, tactical: 5 });
      w['alignment'] = 'Neutral';
      return { ...psychic(b, 2, 'Charm', w.id), mark: w };
    },
    check(o, s) {
      return { got: { pay: char(o, mark(s))['pay'] }, want: { pay: 5 } };
    },
  },
  {
    name: 'Charm: a cast that fizzles may bring an enemy hero down on the caster (the backlash roll)',
    dice: UNLUCKY,
    stage(b) {
      const m = rival(b);
      return { ...psychic(b, 2, 'Charm', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: {
          fizzled: says(o, `${s.hero.name}'s Charm fizzles`),
          backlash: says(o, `📊 Charm backlash — ${mark(s).name} may turn on ${s.hero.name} (the spell fizzled): `),
        },
        want: { fizzled: true, backlash: true },
      };
    },
  },
  {
    name: 'Charm: a fizzle aimed at a king or his own hero brings no backlash',
    dice: UNLUCKY,
    stage(b) {
      const k = rival(b, { king: true });
      const f = at(b, {});
      const s = mage(b, { psychic: 3 }, cast('Charm', k.id), cast('Charm', f.id));
      return { ...s, mark: k, other: f };
    },
    check(o) {
      return { got: { backlash: says(o, 'Charm backlash') }, want: { backlash: false } };
    },
  },
  {
    name: 'Charm backlash: when the roll comes up, the hero rounds on the caster and blades are drawn; the field is marked',
    dice: rollOf(20),
    stage(b) {
      const m = rival(b, {}, { melee: 1 });
      m['_charmResist'] = 30;
      m['encounterPlan'] = { tactics: ['ME'], duelStance: 'accept' };
      return { ...psychic(b, 2, 'Charm', m.id), mark: m };
    },
    check(o, s) {
      const m = mark(s);
      return {
        got: {
          drawn: anySays(
            o,
            `⚔ ${m.name} feels the enchantment clawing at their mind and rounds on ${s.hero.name} — blades are drawn!`,
          ),
          marked: province(o, b0(s))['_combatPlayersThisTurn'] ?? [],
        },
        want: { drawn: true, marked: [0, 1] },
      };
    },
  },
  {
    name: 'Charm backlash: no fight if either leads his plan with Flee',
    dice: rollOf(20),
    stage(b) {
      const m = flees(rival(b));
      m['_charmResist'] = 30;
      return { ...psychic(b, 2, 'Charm', m.id), mark: m };
    },
    check(o, s) {
      const m = mark(s);
      return {
        got: {
          slips: anySays(
            o,
            `${m.name} rounds on ${s.hero.name} as the enchantment fails — but ${m.name} is already slipping away, and there is no encounter.`,
          ),
          drawn: anySays(o, 'blades are drawn'),
        },
        want: { slips: true, drawn: false },
      };
    },
  },
  {
    name: 'Charm backlash: over 50 and the hero lets it pass',
    dice: rollOf(51),
    stage(b) {
      const m = rival(b);
      m['_charmImmuneTurn'] = b.G.turn;
      return { ...psychic(b, 4, 'Charm', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: {
          roll: backlashRoll(o, s, 'closed to enchantment this season'),
          drawn: anySays(o, 'blades are drawn'),
          slips: anySays(o, 'slipping away'),
        },
        want: { roll: true, drawn: false, slips: false },
      };
    },
  },
];
export const ORATORY_CASES: CastSpellOrderCase[] = [
  {
    name: 'Oratory: his own troops fight one quality level higher this turn',
    stage: (b) => psychic(b, 1, 'Oratory'),
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `✨ ${s.hero.name}'s stirring Oratory lifts their own troops — every army travelling with ${s.hero.name} fights one quality level higher this turn.`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Oratory: a hero of his realm beside him can be stirred instead',
    stage(b) {
      const f = at(b, {}, { troops: 2 });
      return { ...psychic(b, 1, 'Oratory', f.id), mark: f };
    },
    check(o, s) {
      const f = mark(s);
      return {
        got: {
          told: says(
            o,
            `✨ ${s.hero.name}'s stirring Oratory lifts ${f.name}'s troops — every army travelling with ${f.name} fights one quality level higher this turn.`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Oratory: Words of Awe (Psychic 6) lift two quality levels',
    stage: (b) => psychic(b, 6, 'Oratory'),
    check(o, s) {
      return {
        got: { told: says(o, `every army travelling with ${s.hero.name} fights two quality levels higher this turn.`) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Oratory: Psychic 5 still lifts one level (Words of Awe needs 6)',
    stage: (b) => psychic(b, 5, 'Oratory'),
    check(o, s) {
      return {
        got: { one: says(o, `every army travelling with ${s.hero.name} fights one quality level higher this turn.`) },
        want: { one: true },
      };
    },
  },
  {
    name: "Oratory cannot stir another realm's hero",
    stage(b) {
      const a = at(b, {}, { player: 2 });
      return { ...psychic(b, 1, 'Oratory', a.id), mark: a };
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name}'s Oratory can only stir their own realm's troops — ${mark(s).name} serves another crown.`,
          ),
        },
        want: { refused: true },
      };
    },
  },
];
export const CLAIRVOYANCE_CASES: CastSpellOrderCase[] = [
  {
    name: 'Clairvoyance: a rival hero is watched for the rest of the turn, wherever he is, and his skills are known to the realm',
    stage(b) {
      const m = rival(b, { at: ring2(b, 0) }, { melee: 4 });
      return { ...psychic(b, 1, 'Clairvoyance', m.id), mark: m, there: ring2(b, 0) };
    },
    check(o, s) {
      const m = mark(s);
      const p0 = must(o.world.players[0], 'realm 0');
      const read = ((p0['_spiedHeroSkills'] as Record<string, Record<string, unknown>> | undefined) ?? {})[
        String(m.id)
      ];
      return {
        got: {
          told: says(
            o,
            `✨ ${s.hero.name} opens their mind's eye upon ${m.name} — all that befalls them is known to you for the rest of the turn. They are currently in ${b0(s).name}.`,
          ),
          skills: read?.['skills'],
          kingdom: read?.['kingdom'],
          isKing: read?.['isKing'],
          turn: read?.['turn'],
        },
        want: {
          told: true,
          skills: { melee: 4, tactical: 2, march: 1 },
          kingdom: realmName(o, 1),
          isKing: false,
          turn: o.turn,
        },
      };
    },
  },
  {
    name: 'Clairvoyance on a hero who has died reaches only silence, and tells where the body lies',
    stage(b) {
      const d = fallen(b, ring1(b, 0), { player: 1 });
      return { ...psychic(b, 1, 'Clairvoyance', d.id), mark: d, there: ring1(b, 0) };
    },
    check(o, s) {
      const d = mark(s);
      return {
        got: {
          silence: says(
            o,
            `✨ ${s.hero.name} casts Clairvoyance upon ${d.name}, but reaches only silence — ${d.name} is dead. Their body lies in ${b0(s).name}.`,
          ),
        },
        want: { silence: true },
      };
    },
  },
  {
    name: 'Clairvoyance with nobody named asks for a hero to watch',
    stage: (b) => psychic(b, 1, 'Clairvoyance', ''),
    check(o) {
      return {
        got: { asks: says(o, 'Clairvoyance: choose a character you have seen to watch.') },
        want: { asks: true },
      };
    },
  },
  {
    name: 'Clairvoyance cannot fix upon a wandering mind',
    stage(b) {
      const w = wanderer(b, {});
      return { ...psychic(b, 1, 'Clairvoyance', w.id), mark: w };
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name}'s Clairvoyance finds no thread to follow — ${mark(s).name} serves no crown, and the spell cannot fix upon a wandering or neutral mind.`,
          ),
        },
        want: { refused: true },
      };
    },
  },
];
export const PSYCHIC_BLAST_CASES: CastSpellOrderCase[] = [
  {
    name: 'Psychic Blast: the hero loses two skill levels (here both from Spy, the die at its highest), his realm is told, and his wage falls with them',
    stage(b) {
      const m = rival(b);
      m.skills = { melee: 4, tactical: 3, march: 3, spy: 3 };
      m['pay'] = 3;
      m['_hireAlignWage'] = 0;
      const s = psychic(b, 1, 'Psychic Blast', m.id);
      return { ...s, mark: m };
    },
    check(o, s) {
      const m = mark(s);
      return {
        got: {
          told: says(o, `✨ ${s.hero.name} unleashes Psychic Blast — ${m.name}'s mind buckles, losing Spy and Spy!`),
          public: publicLine(o, `unleashes Psychic Blast — ${m.name}'s mind buckles`),
          victim: toldTo(o, `🧠 ${m.name} reels — ${s.hero.name}'s Psychic Blast sears away Spy and Spy.`),
          wage: toldTo(o, `💰 ${m.name}'s lost skill lowers their wage to 2g/turn (was 3g/turn).`),
          skills: char(o, m).skills,
        },
        want: { told: true, public: true, victim: [1], wage: [1], skills: { melee: 4, tactical: 3, march: 3, spy: 1 } },
      };
    },
  },
  {
    name: 'Psychic Blast: the die picks which skills (at its lowest, the first)',
    dice: LUCKY,
    stage(b) {
      const m = rival(b);
      m.skills = { melee: 1, tactical: 3 };
      return { ...psychic(b, 1, 'Psychic Blast', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: {
          told: says(o, `${mark(s).name}'s mind buckles, losing Melee and Tactical!`),
          skills: char(o, mark(s)).skills,
        },
        want: { told: true, skills: { melee: 0, tactical: 2 } },
      };
    },
  },
  {
    name: 'Psychic Blast: a hero with no trained skill has nothing to lose',
    stage(b) {
      const m = rival(b);
      m.skills = {};
      return { ...psychic(b, 1, 'Psychic Blast', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `✨ ${s.hero.name}'s Psychic Blast rakes ${mark(s).name}'s mind, but they have no trained skills left to lose.`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Psychic Blast: a hero of a single level loses it and has nothing more',
    stage(b) {
      const m = rival(b);
      m.skills = { melee: 1 };
      return { ...psychic(b, 1, 'Psychic Blast', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: { told: says(o, `${mark(s).name}'s mind buckles, losing Melee!`), skills: char(o, mark(s)).skills },
        want: { told: true, skills: { melee: 0 } },
      };
    },
  },
  {
    name: 'Psychic Blast: no hero to strike here is refused',
    stage: (b) => psychic(b, 1, 'Psychic Blast', ''),
    check(o, s) {
      return {
        got: { refused: says(o, `Psychic Blast: no valid target hero in ${b0(s).name} this phase.`) },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Psychic Blast cannot be turned on his own heroes',
    stage(b) {
      const f = at(b, {});
      return { ...psychic(b, 1, 'Psychic Blast', f.id), mark: f };
    },
    check(o) {
      return {
        got: { refused: says(o, 'Psychic Blast cannot be turned on your own heroes.') },
        want: { refused: true },
      };
    },
  },
];
export const TELEKINETIC_STORM_CASES: CastSpellOrderCase[] = [
  {
    name: 'Telekinetic Storm: as many companies as his level drop a quality level for good (Psychic 3: three of six)',
    stage(b) {
      const m = leads(rival(b), companies(6, 'Men-at-Arms', 'Elite', 'Guard'));
      const s = psychic(b, 3, 'Telekinetic Storm', m.id);
      return { ...s, mark: m, orders: [...s.orders, standsWatch(m)] };
    },
    check(o, s) {
      const m = mark(s);
      const q = char(o, m).armies.map((u) => u.quality);
      return {
        got: {
          told: says(
            o,
            `✨ ${s.hero.name}'s Telekinetic Storm hurls ${m.name}'s troops about — 3 units caught: 0 shattered outright, 3 permanently reduced one experience level.`,
          ),
          victim: toldTo(
            o,
            `🌀 ${s.hero.name}'s Telekinetic Storm scatters ${m.name}'s formations — 0 destroyed, 3 permanently reduced one experience level.`,
          ),
          public: publicLine(o, `✨ ${s.hero.name}'s Telekinetic Storm hurls`),
          crack: q.filter((x) => x === 'Crack').length,
          elite: q.filter((x) => x === 'Elite').length,
        },
        want: { told: true, victim: [1], public: true, crack: 3, elite: 3 },
      };
    },
  },
  {
    name: 'Telekinetic Storm: its reach stops at level 5 (Psychic 7: five of six)',
    stage(b) {
      const m = leads(rival(b), companies(6, 'Men-at-Arms', 'Elite', 'Guard'));
      const s = psychic(b, 7, 'Telekinetic Storm', m.id);
      return { ...s, mark: m, orders: [...s.orders, standsWatch(m)] };
    },
    check(o) {
      return {
        got: { told: says(o, `— 5 units caught: 0 shattered outright, 5 permanently reduced one experience level.`) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Telekinetic Storm: a Green company scattered, a Veteran dropped to Average, the dead shattered (three caught of three)',
    stage(b) {
      const m = leads(rival(b), [
        ...companies(1, 'Men-at-Arms', 'Veteran', 'Vets'),
        ...companies(1, 'Men-at-Arms', 'Green', 'Greens'),
        skeletal('Bones'),
      ]);
      const s = psychic(b, 5, 'Telekinetic Storm', m.id);
      return { ...s, mark: m, orders: [...s.orders, standsWatch(m)] };
    },
    check(o, s) {
      const m = mark(s);
      const t = o.lines.find((l) => l.text.startsWith(`✨ ${s.hero.name}'s Telekinetic Storm`))?.text ?? '';
      return {
        got: {
          counts: t.includes('— 3 units caught: 2 shattered outright, 1 permanently reduced one experience level.'),
          vets: t.includes('Vets c0 Veteran→Average'),
          greens: t.includes('Greens c0 (Green) torn apart and scattered for good'),
          bones: t.includes('Bones shattered to dust — the storm scatters every bone'),
          left: ranks(char(o, m).armies),
        },
        want: { counts: true, vets: true, greens: true, bones: true, left: ['Vets c0 (Average)'] },
      };
    },
  },
  {
    name: 'Telekinetic Storm: a hero leading no troops has none to scatter',
    stage(b) {
      const m = rival(b);
      return { ...psychic(b, 1, 'Telekinetic Storm', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: { told: says(o, `✨ Telekinetic Storm buffets ${mark(s).name}, but they lead no armies to scatter.`) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Telekinetic Storm: no hero here is refused',
    stage: (b) => psychic(b, 1, 'Telekinetic Storm', ''),
    check(o, s) {
      return {
        got: { refused: says(o, `Telekinetic Storm: no valid target hero in ${b0(s).name} this phase.`) },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Telekinetic Storm cannot be turned on his own heroes',
    stage(b) {
      const f = leads(at(b, {}), companies(2));
      return { ...psychic(b, 1, 'Telekinetic Storm', f.id), mark: f };
    },
    check(o, s) {
      return {
        got: {
          refused: says(o, 'Telekinetic Storm cannot be turned on your own heroes.'),
          left: char(o, mark(s)).armies.length,
        },
        want: { refused: true, left: 2 },
      };
    },
  },
];
export const MASS_CONFUSION_CASES: CastSpellOrderCase[] = [
  {
    name: "Mass Confusion (Psychic 7): an enemy hero's Tactical genius deserts him in his next battle this turn; his realm is told",
    stage(b) {
      const m = rival(b);
      return { ...psychic(b, 7, 'Mass Confusion', m.id), mark: m };
    },
    check(o, s) {
      const m = mark(s);
      return {
        got: {
          told: says(
            o,
            `✨ ${s.hero.name} sows Mass Confusion through ${m.name}'s ranks — their commander's Tactical genius deserts them in their next battle this turn.`,
          ),
          victim: toldTo(
            o,
            `✨ Mass Confusion from ${s.hero.name} grips ${m.name} — their Tactical command deserts them in their next battle.`,
          ),
          marked: char(o, m)['_massConfusedTurn'],
        },
        want: { told: true, victim: [1], marked: o.turn },
      };
    },
  },
  {
    name: 'Mass Confusion cannot be turned on his own heroes',
    stage(b) {
      const f = at(b, {});
      const s = psychic(b, 7, 'Mass Confusion', f.id);
      return { ...s, mark: f };
    },
    check(o) {
      return {
        got: { refused: says(o, 'Mass Confusion cannot be turned on your own heroes.') },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Mass Confusion: no enemy hero here is refused',
    stage: (b) => psychic(b, 7, 'Mass Confusion', ''),
    check(o, s) {
      return {
        got: { refused: says(o, `Mass Confusion: no valid enemy hero in ${b0(s).name} this phase.`) },
        want: { refused: true },
      };
    },
  },
];
export const DOMINATE_CASES: CastSpellOrderCase[] = [
  {
    name: "Dominate (Psychic 9): a quarter of an enemy hero's companies (at least one) turn coat and march under the caster",
    stage(b) {
      const m = leads(rival(b), companies(8, 'Men-at-Arms', 'Veteran', 'Foe'));
      const s = psychic(b, 9, 'Dominate', m.id);
      leads(s.hero, companies(1, 'Men-at-Arms', 'Average', 'Own'));
      return { ...s, mark: m, orders: [...s.orders, standsWatch(m)] };
    },
    check(o, s) {
      const m = mark(s);
      return {
        got: {
          own: says(
            o,
            `✨ ${s.hero.name} Dominates ${m.name} in ${b0(s).name} — 2 of their units turn coat and march under your banner!`,
          ),
          victim: toldTo(
            o,
            `✨ ${s.hero.name} (${realmName(o, 0)}) Dominates ${m.name} in ${b0(s).name} — 2 of their units turn coat and desert to the enemy.`,
          ),
          others: anySays(
            o,
            `✨ ${s.hero.name} (${realmName(o, 0)}) Dominates ${m.name} (${realmName(o, 1)}) in ${b0(s).name} — 2 of their units turn coat and march under ${s.hero.name}'s banner.`,
          ),
        },
        want: { own: true, victim: [1], others: true },
      };
    },
  },
  {
    name: 'Dominate: a hero leading fewer than four companies still loses one',
    stage(b) {
      const m = leads(rival(b), companies(2, 'Men-at-Arms', 'Veteran', 'Foe'));
      const s = psychic(b, 9, 'Dominate', m.id);
      leads(s.hero, companies(1, 'Men-at-Arms', 'Average', 'Own'));
      return { ...s, mark: m, orders: [...s.orders, standsWatch(m)] };
    },
    check(o) {
      return {
        got: { own: says(o, `— 1 of their unit turn coat and march under your banner!`) },
        want: { own: true },
      };
    },
  },
  {
    name: 'Dominate: a hero leading no troops has none to turn',
    stage(b) {
      const m = rival(b);
      return { ...psychic(b, 9, 'Dominate', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: { told: says(o, `✨ ${s.hero.name}'s Dominate grips ${mark(s).name}, but they lead no troops to turn.`) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Dominate: no enemy hero here is refused',
    stage: (b) => psychic(b, 9, 'Dominate', ''),
    check(o, s) {
      return {
        got: { refused: says(o, `Dominate: no valid enemy hero in ${b0(s).name} this phase.`) },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Dominate cannot be turned on his own heroes',
    stage(b) {
      const f = leads(at(b, {}), companies(4));
      return { ...psychic(b, 9, 'Dominate', f.id), mark: f };
    },
    check(o) {
      return { got: { refused: says(o, 'Dominate cannot be turned on your own heroes.') }, want: { refused: true } };
    },
  },
];

// ── Illusory Magic ──────────────────────────────────────────────────────────────────────────────────────────────
/** An Illusory mage of realm 0 in the middle, of Illusory `n`, casting `spell` at `extra`. */
const illusionist = (b: Board, n: number, spell: string, extra: string | number = '') =>
  mage(b, { illusory: n }, cast(spell, extra));
const cloaked = (o: Outcome, s: Staged) =>
  says(
    o,
    `✨ ${s.hero.name} cloaks ${b0(s).name} in shifting illusion — to enemy eyes the ground blurs and rearranges into ever-changing, confusing terrain. Any enemy who gives battle here is disoriented, each of their units fighting as though caught in the worst possible ground for its kind (at least −15% strength).`,
  );
const illusion = (o: Outcome, s: Staged) =>
  province(o, b0(s))['_illusoryTerrain'] as { caster: number; fake: string; appliedTurn: number } | undefined;
export const ILLUSORY_TERRAIN_CASES: CastSpellOrderCase[] = [
  {
    name: 'Illusory Terrain: the ground he stands on is cloaked for his realm (dry land seems another land at a high die)',
    stage: (b) => illusionist(b, 1, 'Illusory Terrain', b.X.id),
    check(o, s) {
      return {
        got: { told: cloaked(o, s), illusion: illusion(o, s) },
        want: { told: true, illusion: { caster: 0, fake: 'desert', appliedTurn: o.turn } },
      };
    },
  },
  {
    name: 'Illusory Terrain: a sea beside him seems sea still at a high die',
    stage(b) {
      const sea = ring1(b, 0);
      sea.terrain = 'sea';
      return { ...illusionist(b, 1, 'Illusory Terrain', sea.id), there: sea };
    },
    check(o, s) {
      return { got: { told: cloaked(o, s), fake: illusion(o, s)?.fake }, want: { told: true, fake: 'sea' } };
    },
  },
  {
    name: 'Illusory Terrain: a province two away is out of reach',
    stage(b) {
      return { ...illusionist(b, 1, 'Illusory Terrain', ring2(b, 0).id), there: ring2(b, 0) };
    },
    check(o, s) {
      return {
        got: {
          refused: says(o, `${s.hero.name}: Illusory Terrain must target a province you are in or adjacent to.`),
          illusion: illusion(o, s),
        },
        want: { refused: true, illusion: undefined },
      };
    },
  },
];
const doubles = (o: Outcome, s: Staged, n: number, whose: string, plural: boolean) =>
  says(
    o,
    `✨ ${s.hero.name} conjures phantasmal duplicates of ${String(n)} of ${whose} humanoid ${plural ? 'armies' : 'army'} — spectral doubles that march and fight with the real host for the rest of the turn, melting away if their true selves fall or the force is beaten.`,
  );
export const PHANTASMAL_ARMIES_CASES: CastSpellOrderCase[] = [
  {
    name: 'Phantasmal Armies: a tenth of his host a level (Illusory 2, ten companies: two) is doubled by phantoms',
    stage(b) {
      const s = illusionist(b, 2, 'Phantasmal Armies');
      leads(s.hero, companies(10));
      return s;
    },
    check(o, s) {
      return {
        got: { told: doubles(o, s, 2, 'their', true), lessons: xpIn(o, s.hero, 'illusory') },
        want: { told: true, lessons: [STD] },
      };
    },
  },
  {
    name: 'Phantasmal Armies: at least one phantom, and the reach stops at level 5 (Illusory 7, ten companies: five)',
    stage(b) {
      const s = mage(b, { illusory: 7 }, cast('Phantasmal Armies'));
      leads(s.hero, companies(10));
      const lone = at(b, { illusory: 1 }, { troops: 2 });
      return { ...s, other: lone, orders: [...s.orders, one(lone, cast('Phantasmal Armies'))] };
    },
    check(o, s) {
      const lone = must(s.other, 'the second caster');
      return {
        got: {
          five: doubles(o, s, 5, 'their', true),
          one: anySays(o, `✨ ${lone.name} conjures phantasmal duplicates of 1 of their humanoid army — `),
        },
        want: { five: true, one: true },
      };
    },
  },
  {
    name: 'Phantasmal Armies: never more phantoms than humanoid companies (one among nine beasts, Illusory 5: one)',
    stage(b) {
      const s = illusionist(b, 5, 'Phantasmal Armies');
      leads(s.hero, [...companies(1), ...beasts(9, 'Great Bears')]);
      return s;
    },
    check(o, s) {
      return { got: { told: doubles(o, s, 1, 'their', false) }, want: { told: true } };
    },
  },
  {
    name: 'Phantasmal Armies: beasts are never doubled, so a host of beasts alone is refused',
    stage(b) {
      const s = illusionist(b, 2, 'Phantasmal Armies');
      leads(s.hero, beasts(4, 'Great Bears'));
      return s;
    },
    check(o, s) {
      return {
        got: { refused: says(o, `${s.hero.name}: you have no humanoid armies for Phantasmal Armies to duplicate.`) },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Phantasmal Armies: a hero of his realm beside him can be given the phantoms',
    stage(b) {
      const f = at(b, {}, { troops: 10 });
      return { ...illusionist(b, 2, 'Phantasmal Armies', f.id), mark: f };
    },
    check(o, s) {
      return { got: { told: doubles(o, s, 2, `${must(s.mark, 'the friend').name}'s`, true) }, want: { told: true } };
    },
  },
  {
    name: 'Phantasmal Armies: a friend with no humanoid companies is refused in his name',
    stage(b) {
      const f = at(b, {});
      return { ...illusionist(b, 2, 'Phantasmal Armies', f.id), mark: f };
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${s.hero.name}: ${must(s.mark, 'the friend').name} has no humanoid armies for Phantasmal Armies to duplicate.`,
          ),
        },
        want: { refused: true },
      };
    },
  },
  {
    name: "Phantasmal Armies aimed at another realm's hero falls on the caster himself",
    stage(b) {
      const m = rival(b, { troops: 10 });
      const s = illusionist(b, 2, 'Phantasmal Armies', m.id);
      leads(s.hero, companies(5));
      return { ...s, mark: m };
    },
    check(o, s) {
      return { got: { told: doubles(o, s, 1, 'their', false) }, want: { told: true } };
    },
  },
];
export const HIDE_LAIRS_CASES: CastSpellOrderCase[] = [
  {
    name: 'Hide Lairs: every lair in the province vanishes from other explorers, hidden by his realm',
    stage(b) {
      b.X['features'] = [lairHere('Den of Teeth'), lairHere('Bone Pit')];
      return illusionist(b, 1, 'Hide Lairs', b.X.id);
    },
    check(o, s) {
      const fs = (province(o, b0(s))['features'] as Record<string, unknown>[] | undefined) ?? [];
      return {
        got: {
          told: says(
            o,
            `✨ ${s.hero.name} veils ${b0(s).name} in confounding illusion — every lair within (2) vanishes from all other explorers' sight, and none can be freshly discovered here until the glamour fades.`,
          ),
          hidden: fs.map((f) => [f['_hidden'], f['_hiddenBy']]),
        },
        want: {
          told: true,
          hidden: [
            [true, 0],
            [true, 0],
          ],
        },
      };
    },
  },
  {
    name: 'Hide Lairs: lairs already hidden are not counted again; none left to hide is refused',
    stage(b) {
      const hid = { ...lairHere('Den of Teeth'), _hidden: true, _hiddenBy: 1 };
      b.X['features'] = [hid];
      return illusionist(b, 1, 'Hide Lairs', b.X.id);
    },
    check(o, s) {
      const fs = (province(o, b0(s))['features'] as Record<string, unknown>[] | undefined) ?? [];
      return {
        got: {
          refused: says(o, `${s.hero.name}: there are no lairs left to hide in ${b0(s).name}.`),
          by: fs.map((f) => f['_hiddenBy']),
        },
        want: { refused: true, by: [1] },
      };
    },
  },
  {
    name: 'Hide Lairs: a province beside him can be veiled; one two away cannot',
    stage(b) {
      ring1(b, 0)['features'] = [lairHere('Den of Teeth')];
      ring2(b, 0)['features'] = [lairHere('Bone Pit')];
      const s = mage(b, { illusory: 3 }, cast('Hide Lairs', ring1(b, 0).id), cast('Hide Lairs', ring2(b, 0).id));
      return { ...s, there: ring1(b, 0) };
    },
    check(o, s) {
      return {
        got: {
          near: says(o, `veils ${b0(s).name} in confounding illusion — every lair within (1)`),
          far: says(o, `${s.hero.name}: Hide Lairs must target a province you are in or adjacent to.`),
        },
        want: { near: true, far: true },
      };
    },
  },
];
export const INVISIBILITY_CASES: CastSpellOrderCase[] = [
  {
    name: 'Invisibility: at 80% or under he slips from every enemy eye for the rest of the turn',
    dice: rollOf(80),
    stage: (b) => illusionist(b, 5, 'Invisibility'),
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `✨ ${s.hero.name} weaves Invisibility about themself — no enemy eye will find them for the rest of this turn. 80% [roll 80 ✓]`,
          ),
          invisible: [char(o, s.hero)['_invisTurn'], char(o, s.hero)['_unspottedTurn']],
        },
        want: { told: true, invisible: [o.turn, o.turn] },
      };
    },
  },
  {
    name: 'Invisibility: over 80 it fails to hold (cast from a Ring of Vanishing at 95%)',
    dice: rollOf(81),
    stage(b) {
      const h = at(b, {});
      const ring = item(b, 'Ring of Vanishing');
      holding(h, ring);
      return { hero: h, orders: [one(h, order('use_item', String(ring['id'])))], there: b.X };
    },
    check(o, s) {
      return {
        got: {
          fails: says(
            o,
            `✨ ${s.hero.name}'s Invisibility shimmers and fails to hold — they remain in plain sight. 80% [roll 81 ✗]`,
          ),
          invisible: char(o, s.hero)['_invisTurn'],
        },
        want: { fails: true, invisible: undefined },
      };
    },
  },
];
export const PHANTOM_HOST_CASES: CastSpellOrderCase[] = [
  {
    name: 'Phantom Host (Illusory 7): his beasts are doubled, a tenth of his host a level to level 5 (four beasts: two)',
    stage(b) {
      const s = illusionist(b, 7, 'Phantom Host');
      leads(s.hero, [...beasts(4, 'Great Bears')]);
      return s;
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `✨ ${s.hero.name} conjures a Phantom Host — spectral doubles of 2 of their beasts that fight with the real host for the rest of the turn, melting away if their true selves fall or the force is beaten.`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Phantom Host: one beast in a host of men is still doubled once',
    stage(b) {
      const s = illusionist(b, 7, 'Phantom Host');
      leads(s.hero, [...beasts(1, 'Great Bears'), ...companies(1)]);
      return s;
    },
    check(o) {
      return { got: { told: says(o, `spectral doubles of 1 of their beast that fight`) }, want: { told: true } };
    },
  },
  {
    name: 'Phantom Host: a lone beast is still doubled once',
    stage(b) {
      const s = illusionist(b, 7, 'Phantom Host');
      leads(s.hero, beasts(1, 'Great Bears'));
      return s;
    },
    check(o) {
      return { got: { told: says(o, `spectral doubles of 1 of their beast that fight`) }, want: { told: true } };
    },
  },
  {
    name: 'Phantom Host: no beasts, nothing to double',
    stage(b) {
      const s = illusionist(b, 7, 'Phantom Host');
      leads(s.hero, companies(4));
      return s;
    },
    check(o, s) {
      return {
        got: { refused: says(o, `${s.hero.name}: you lead no monsters or creatures for Phantom Host to duplicate.`) },
        want: { refused: true },
      };
    },
  },
];
export const VEIL_CASES: CastSpellOrderCase[] = [
  {
    name: 'Veil (Illusory 9): he and his host vanish from sight and battle for this phase and the next',
    stage: (b) => mage(b, { illusory: 9 }, order('rest'), cast('Veil')),
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `✨ ${s.hero.name} draws a Veil of illusion over their host — for this phase and the next, they and the armies they lead vanish from all enemy sight, cannot be touched by hostile magic, and cannot be brought to battle. The illusion parts as the phase after next begins.`,
          ),
          veil: [char(o, s.hero)['_veilTurn'], char(o, s.hero)['_veilCastPhase']],
        },
        want: { told: true, veil: [o.turn, 1] },
      };
    },
  },
];
/** A Weak lair, undiscovered (lib/explore-and-search-order-cases.ts). */
const lairHere = (name: string) => lair(name, 'Weak');

// ── Elemental Magic ─────────────────────────────────────────────────────────────────────────────────────────────
/** An Elemental mage of realm 0 in the middle, of Elemental `n`, casting `spell` at `extra`. */
const elementalist = (b: Board, n: number, spell: string, extra: string | number = '') =>
  mage(b, { elemental: n }, cast(spell, extra));
/** Realm 1's province beside the middle. */
const theirs = (b: Board) => {
  const p = ring1(b, 0);
  b.own(p, 1);
  return p;
};
export const EARTHQUAKE_CASES: CastSpellOrderCase[] = [
  {
    name: 'Earthquake: an enemy province beside him yields no tax this turn; told to all, its owner warned',
    stage(b) {
      const p = theirs(b);
      return { ...elementalist(b, 1, 'Earthquake', p.id), there: p };
    },
    check(o, s) {
      const p = b0(s);
      const said = `✨ ${s.hero.name} rends the earth beneath ${p.name} — its fields and roads are ruined, and it will yield no tax at the end of this turn.`;
      return {
        got: {
          told: says(o, said),
          to: toldTo(o, said),
          public: publicLine(o, said),
          owner: toldTo(o, `🜃 An enemy Earthquake has torn through ${p.name} — it will yield no tax this turn.`),
          mark: province(o, p)['_earthquakeNoTax'],
        },
        want: { told: true, to: [1], public: true, owner: [1], mark: o.turn },
      };
    },
  },
  {
    name: 'Earthquake on his own ground warns nobody',
    stage(b) {
      b.own(b.X, 0);
      return elementalist(b, 1, 'Earthquake', b.X.id);
    },
    check(o, s) {
      const said = `✨ ${s.hero.name} rends the earth beneath ${b0(s).name}`;
      return {
        got: {
          to: toldTo(o, said),
          owner: anySays(o, 'An enemy Earthquake'),
          mark: province(o, b0(s))['_earthquakeNoTax'],
        },
        want: { to: [], owner: false, mark: o.turn },
      };
    },
  },
  {
    name: 'Earthquake: a province two away is out of reach',
    stage: (b) => ({ ...elementalist(b, 1, 'Earthquake', ring2(b, 0).id), there: ring2(b, 0) }),
    check(o, s) {
      return {
        got: {
          refused: says(o, `${s.hero.name}: Earthquake must target your province or one adjacent.`),
          mark: province(o, b0(s))['_earthquakeNoTax'],
        },
        want: { refused: true, mark: undefined },
      };
    },
  },
  {
    name: "Earthquake: an enemy's Bless ward may turn it aside (a low die)",
    dice: LUCKY,
    stage(b) {
      const p = theirs(b);
      Object.assign(p, { _blessWardTurn: b.G.turn, _blessWardBy: 1, _blessWardPct: 50 });
      return { ...elementalist(b, 1, 'Earthquake', p.id), there: p };
    },
    check(o, s) {
      return {
        got: {
          warded: toldTo(
            o,
            `✨ A blessing lies over ${b0(s).name} — ${s.hero.name}'s Earthquake washes over the sacred ground and does no harm.`,
          ),
          mark: province(o, b0(s))['_earthquakeNoTax'],
        },
        want: { warded: [1], mark: undefined },
      };
    },
  },
  {
    name: 'Earthquake: a Bless ward holds only on its own roll (a high die: it fails)',
    stage(b) {
      const p = theirs(b);
      Object.assign(p, { _blessWardTurn: b.G.turn, _blessWardBy: 1, _blessWardPct: 75 });
      return { ...elementalist(b, 1, 'Earthquake', p.id), there: p };
    },
    check(o, s) {
      return {
        got: { warded: anySays(o, 'A blessing lies over'), mark: province(o, b0(s))['_earthquakeNoTax'] },
        want: { warded: false, mark: o.turn },
      };
    },
  },
  {
    name: "Earthquake: last turn's ward is no ward",
    dice: LUCKY,
    stage(b) {
      const p = theirs(b);
      Object.assign(p, { _blessWardTurn: b.G.turn - 1, _blessWardBy: 1, _blessWardPct: 100 });
      return { ...elementalist(b, 1, 'Earthquake', p.id), there: p };
    },
    check(o, s) {
      return {
        got: { warded: anySays(o, 'A blessing lies over'), mark: province(o, b0(s))['_earthquakeNoTax'] },
        want: { warded: false, mark: o.turn },
      };
    },
  },
];
export const FLOOD_CASES: CastSpellOrderCase[] = [
  {
    name: 'Flood: a land province beside him lies under the sea for the rest of the turn; told to all, its owner warned; it recedes at the end',
    wholeTurnOnly: true,
    stage(b) {
      const p = theirs(b);
      return { ...elementalist(b, 1, 'Flood', p.id), there: p };
    },
    check(o, s) {
      const p = b0(s);
      const said = `✨ ${s.hero.name} calls up the deluge — ${p.name} vanishes beneath the waves and acts as a sea province for the rest of the turn. Land armies are stranded; only fleets and flyers may pass.`;
      return {
        got: {
          told: says(o, said),
          to: toldTo(o, said),
          owner: toldTo(
            o,
            `🌊 An enemy Flood has swallowed ${p.name} — it acts as sea for the rest of the turn, and any land army there is stranded.`,
          ),
          after: [province(o, p).terrain, province(o, p)['_flood']],
        },
        want: { told: true, to: [1], owner: [1], after: ['plain', undefined] },
      };
    },
  },
  {
    name: 'Flood: a land column cannot march into a flooded province',
    wholeTurnOnly: true,
    stage(b) {
      const p = ring1(b, 0);
      const s = elementalist(b, 1, 'Flood', p.id);
      const col = at(b, {}, { troops: 2, at: ring1(b, 1) });
      return {
        ...s,
        there: p,
        other: col,
        places: [ring1(b, 1)],
        orders: [...s.orders, one(col, order('rest'), order('move', p.id))],
      };
    },
    check(o, s) {
      const col = must(s.other, 'the column');
      return {
        got: {
          barred: anySays(
            o,
            `${col.name} is turned back at ${b0(s).name}: the province has been FLOODED and acts as open sea this turn.`,
          ),
          where: char(o, col).location,
        },
        want: { barred: true, where: must(s.places?.[0], 'where the column starts').id },
      };
    },
  },
  {
    name: 'Flood cannot be cast on the sea',
    stage(b) {
      const sea = ring1(b, 0);
      sea.terrain = 'sea';
      return { ...elementalist(b, 1, 'Flood', sea.id), there: sea };
    },
    check(o, s) {
      return {
        got: { refused: says(o, `${s.hero.name}: Flood can only be cast on a land province.`) },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Flood: a province two away is out of reach',
    stage: (b) => ({ ...elementalist(b, 1, 'Flood', ring2(b, 0).id), there: ring2(b, 0) }),
    check(o, s) {
      return {
        got: { refused: says(o, `${s.hero.name}: Flood must target a land province you are in or adjacent to.`) },
        want: { refused: true },
      };
    },
  },
  {
    name: "Flood: an enemy's Bless ward may turn it aside (a low die)",
    dice: LUCKY,
    stage(b) {
      const p = theirs(b);
      Object.assign(p, { _blessWardTurn: b.G.turn, _blessWardBy: 1, _blessWardPct: 50 });
      return { ...elementalist(b, 1, 'Flood', p.id), there: p };
    },
    check(o, s) {
      return {
        got: {
          warded: anySays(o, `${s.hero.name}'s Flood washes over the sacred ground and does no harm.`),
          flooded: says(o, 'calls up the deluge'),
        },
        want: { warded: true, flooded: false },
      };
    },
  },
  {
    name: 'Flood on a sea parted earlier this turn drowns it again, and the turn leaves it dry ground ("plains") for good (Parked)',
    wholeTurnOnly: true,
    stage(b) {
      const sea = ring1(b, 0);
      sea.terrain = 'sea';
      const s = mage(b, { white: 1, elemental: 1 }, cast('Part Sea', sea.id), cast('Flood', sea.id));
      return { ...s, there: sea };
    },
    check(o, s) {
      return {
        got: {
          parted: says(o, `the waters of ${b0(s).name} draw back`),
          flooded: says(o, `calls up the deluge — ${b0(s).name} vanishes`),
          after: province(o, b0(s)).terrain,
        },
        want: { parted: true, flooded: true, after: 'plains' },
      };
    },
  },
];
const summoned = (o: Outcome, s: Staged, name: string, type: string) =>
  says(
    o,
    `✨ ${s.hero.name} tears open a rift in ${b0(s).name} and ${name} — a ${type} — surges forth to fight under your command! It will dissolve at the end of the turn.`,
  );
export const ELEMENTAL_SUMMON_CASES: CastSpellOrderCase[] = [
  {
    name: 'Elemental Summon: an elemental (the die picks: at its highest, the Devouring Shade) fights under him until the turn ends; others see it',
    wholeTurnOnly: true,
    stage(b) {
      b.own(b.X, 0);
      return elementalist(b, 1, 'Elemental Summon');
    },
    check(o, s) {
      return {
        got: {
          own: summoned(o, s, 'the Devouring Shade', 'Darkness Elemental'),
          public: anySays(
            o,
            `✨ ${s.hero.name} (${realmName(o, 0)}) tears open a rift in ${b0(s).name} — the Devouring Shade, a Darkness Elemental, surges forth to fight under their banner.`,
          ),
          after: names(char(o, s.hero).armies),
        },
        want: { own: true, public: true, after: [] },
      };
    },
  },
  {
    name: 'Elemental Summon: at the lowest die, the Howling Gale (an Air Elemental)',
    dice: LUCKY,
    stage(b) {
      b.own(b.X, 0);
      return elementalist(b, 1, 'Elemental Summon');
    },
    check(o, s) {
      return { got: { own: summoned(o, s, 'the Howling Gale', 'Air Elemental') }, want: { own: true } };
    },
  },
  {
    name: 'Elemental Summon: one elemental a turn; a second summoning is refused',
    stage(b) {
      b.own(b.X, 0);
      return mage(b, { elemental: 3 }, cast('Elemental Summon'), cast('Elemental Summon'));
    },
    check(o, s) {
      return {
        got: {
          refused: says(o, `${s.hero.name} has already summoned an elemental this turn.`),
          summoned: o.lines.filter((l) => l.text.includes('tears open a rift')).length,
        },
        want: { refused: true, summoned: 1 },
      };
    },
  },
  {
    name: 'Elemental Summon in ground nobody holds: the new host takes it if nobody defends it',
    stage: (b) => elementalist(b, 1, 'Elemental Summon'),
    check(o, s) {
      return { got: { owner: province(o, b0(s)).owner }, want: { owner: 0 } };
    },
  },
];
export const CHAIN_LIGHTNING_CASES: CastSpellOrderCase[] = [
  {
    name: "Chain Lightning (Elemental 7): three tenths of an enemy hero's companies are caught; each is blasted at even odds (a low die: all)",
    dice: LUCKY,
    stage(b) {
      const m = leads(rival(b), companies(10, 'Men-at-Arms', 'Veteran', 'Foe'));
      const s = elementalist(b, 7, 'Chain Lightning', m.id);
      return { ...s, mark: m, orders: [...s.orders, standsWatch(m)] };
    },
    check(o, s) {
      const m = must(s.mark, 'the mark');
      return {
        got: {
          told: says(
            o,
            `⚡ ${s.hero.name}'s Chain Lightning arcs through ${m.name}'s ranks — of 3 units caught in the arc, 3 are blasted apart!`,
          ),
          victim: toldTo(
            o,
            `⚡ ${s.hero.name}'s Chain Lightning tears through ${m.name}'s ranks — 3 units blasted apart.`,
          ),
        },
        want: { told: true, victim: [1] },
      };
    },
  },
  {
    name: 'Chain Lightning: a high die blasts none of those caught',
    stage(b) {
      const m = leads(rival(b), companies(10, 'Men-at-Arms', 'Veteran', 'Foe'));
      const s = elementalist(b, 7, 'Chain Lightning', m.id);
      return { ...s, mark: m, orders: [...s.orders, standsWatch(m)] };
    },
    check(o) {
      return { got: { told: says(o, `— of 3 units caught in the arc, 0 are blasted apart!`) }, want: { told: true } };
    },
  },
  {
    name: 'Chain Lightning: a handful of troops (three) earths it out without a kill',
    stage(b) {
      const m = leads(rival(b), companies(3));
      const s = elementalist(b, 7, 'Chain Lightning', m.id);
      return { ...s, mark: m, orders: [...s.orders, standsWatch(m)] };
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `⚡ ${s.hero.name}'s Chain Lightning crackles around ${must(s.mark, 'the mark').name}'s handful of troops but earths out without a kill.`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Chain Lightning: a hero leading no troops has none to strike',
    stage(b) {
      const m = rival(b);
      return { ...elementalist(b, 7, 'Chain Lightning', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `✨ Chain Lightning crackles around ${must(s.mark, 'the mark').name}, but they lead no troops to strike.`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Chain Lightning: no enemy hero here is refused',
    stage: (b) => elementalist(b, 7, 'Chain Lightning', ''),
    check(o, s) {
      return {
        got: { refused: says(o, `Chain Lightning: no valid enemy hero in ${b0(s).name} this phase.`) },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Chain Lightning cannot be turned on his own heroes',
    stage(b) {
      const f = leads(at(b, {}), companies(10));
      return { ...elementalist(b, 7, 'Chain Lightning', f.id), mark: f };
    },
    check(o) {
      return {
        got: { refused: says(o, 'Chain Lightning cannot be turned on your own heroes.') },
        want: { refused: true },
      };
    },
  },
];
export const CATACLYSM_CASES: CastSpellOrderCase[] = [
  {
    name: "Cataclysm (Elemental 9): an enemy province's tax is ruined for good, and each enemy host there loses 1 and one for each two levels (3)",
    stage(b) {
      const p = theirs(b);
      p['tax'] = 6;
      const m = leads(rival(b, { at: p }), companies(5, 'Men-at-Arms', 'Veteran', 'Foe'));
      const f = leads(at(b, {}, { at: p }), companies(2, 'Men-at-Arms', 'Veteran', 'Own'));
      const s = elementalist(b, 9, 'Cataclysm', p.id);
      return { ...s, there: p, mark: m, other: f, orders: [...s.orders, standsWatch(m), standsWatch(f)] };
    },
    check(o, s) {
      const p = b0(s);
      const said = `☄ ${s.hero.name} calls down a Cataclysm upon ${p.name} — 3 enemy units destroyed, and the land is left permanently barren (tax base reduced to 0 for good).`;
      return {
        got: {
          told: says(o, said),
          to: toldTo(o, said),
          owner: toldTo(
            o,
            `☄ An enemy Cataclysm has devastated ${p.name} — its tax base is permanently ruined and 3 of your units were destroyed.`,
          ),
          tax: [province(o, p)['tax'], province(o, p)['_taxDestroyed'], province(o, p)['_earthquakeNoTax']],
        },
        want: { told: true, to: [1], owner: [1], tax: [0, true, o.turn] },
      };
    },
  },
  {
    name: 'Cataclysm on empty ground still ruins it; its owner is told, with no losses named',
    stage(b) {
      const p = theirs(b);
      p['tax'] = 6;
      return { ...elementalist(b, 9, 'Cataclysm', p.id), there: p };
    },
    check(o, s) {
      const p = b0(s);
      return {
        got: {
          told: says(o, `— 0 enemy units destroyed, and the land is left permanently barren`),
          owner: toldTo(o, `☄ An enemy Cataclysm has devastated ${p.name} — its tax base is permanently ruined.`),
          tax: province(o, p)['tax'],
        },
        want: { told: true, owner: [1], tax: 0 },
      };
    },
  },
  {
    name: 'Cataclysm: a province two away is out of reach',
    stage(b) {
      const p = ring2(b, 0);
      p['tax'] = 6;
      return { ...elementalist(b, 9, 'Cataclysm', p.id), there: p };
    },
    check(o, s) {
      return {
        got: {
          refused: says(o, `${s.hero.name}: Cataclysm must target your province or one adjacent.`),
          tax: province(o, b0(s))['tax'],
        },
        want: { refused: true, tax: 6 },
      };
    },
  },
];

// ── Necromancy ──────────────────────────────────────────────────────────────────────────────────────────────────
/** A necromancer of realm 0 in the middle, of Necromancy `n`, casting `spell` at `extra`. */
const necromancer = (b: Board, n: number, spell: string, extra: string | number = '') =>
  mage(b, { necromancy: n }, cast(spell, extra));
/** The middle's battlefield graves: two Average Men-at-Arms and a Veteran Free Lances. */
const battlefield = (b: Board) => {
  bury(b.X, 2, 'Men-at-Arms', 'Average', 'Fallen Foot');
  bury(b.X, 1, 'Free Lances', 'Veteran', 'Fallen Lances');
};
export const CONTROL_UNDEAD_CASES: CastSpellOrderCase[] = [
  {
    name: 'Control Undead with no hero named senses the dead where he stands, and which neighbours hold graves; his realm keeps both',
    stage(b) {
      battlefield(b);
      (b.X['battleGraves'] as Unit[]).push({
        type: 'Men-at-Arms',
        race: 'Human',
        unitName: 'Nameless',
      } as unknown as Unit);
      bury(ring1(b, 0), 1);
      bury(ring1(b, 2), 1);
      return { ...necromancer(b, 1, 'Control Undead'), places: [ring1(b, 0), ring1(b, 2)] };
    },
    check(o, s) {
      const p = b0(s);
      const near = must(s.places, 'the neighbours with graves');
      const nearNames = near.map((q) => q.name).sort();
      const lore = graveLore(o, 0);
      return {
        got: {
          here: says(
            o,
            `💀 ${s.hero.name}'s Control Undead senses the dead of ${p.name}: 3× Average Men-at-Arms, 1× Veteran Free Lances. (4 graves that could be raised as skeletal servants.)`,
          ),
          around: says(
            o,
            `💀 ${s.hero.name}'s sending spreads out from ${p.name} and the dead answer from beyond its borders — battlefield graves lie in ${nearNames.join(', ')}. How many, and what they hold, only a caster standing on that ground could say.`,
          ),
          loreHere: lore[String(p.id)],
          loreNear: near.map((q) => lore[String(q.id)]),
          lessons: xpIn(o, s.hero, 'necromancy'),
          refused: says(o, 'no valid target hero'),
        },
        want: {
          here: true,
          around: true,
          loreHere: ['3× Average Men-at-Arms', '1× Veteran Free Lances'],
          loreNear: [null, null],
          lessons: [STD],
          refused: false,
        },
      };
    },
  },
  {
    name: 'Control Undead: no dead here and none around: told so, and his realm forgets graves it thought lay here',
    stage(b) {
      realm(b)['_graveIntel'] = {
        [String(b.X.id)]: { turn: 0, detail: [{ k: 'Average Men-at-Arms', n: 3 }] },
        [String(ring1(b, 0).id)]: { turn: 0, detail: null },
      };
      return necromancer(b, 1, 'Control Undead', '__scan__');
    },
    check(o, s) {
      const p = b0(s);
      return {
        got: {
          here: says(
            o,
            `✨ ${s.hero.name}'s Control Undead searches ${p.name} for the dead — but no fallen army units lie here to sense.`,
          ),
          around: says(
            o,
            `✨ ${s.hero.name}'s sending spreads out from ${p.name}, but the lands around it are quiet — no battlefield dead lie in any neighbouring province.`,
          ),
          lore: graveLore(o, 0),
        },
        want: { here: true, around: true, lore: {} },
      };
    },
  },
  {
    name: 'Control Undead wrests an undead company from an enemy hero beside him (the die picks which)',
    stage(b) {
      const m = leads(rival(b), [
        ...companies(1, 'Men-at-Arms', 'Veteran', 'Living'),
        skeletal('Bone Levy'),
        skeletal('Rattling Guard'),
      ]);
      const s = necromancer(b, 1, 'Control Undead', m.id);
      return { ...s, mark: m, orders: [...s.orders, standsWatch(m)] };
    },
    check(o, s) {
      const m = must(s.mark, 'the mark');
      const p = b0(s);
      return {
        got: {
          own: says(
            o,
            `✨ ${s.hero.name}'s Control Undead wrests the Rattling Guard from ${m.name} in ${p.name} — it now marches under your banner!`,
          ),
          victim: toldTo(
            o,
            `✨ ${s.hero.name} (${realmName(o, 0)})'s Control Undead wrests the Rattling Guard from ${m.name} in ${p.name} — it now marches under the enemy's banner.`,
          ),
          others: anySays(
            o,
            `✨ ${s.hero.name} (${realmName(o, 0)})'s Control Undead wrests the Rattling Guard from ${m.name} (${realmName(o, 1)}) in ${p.name} — it now marches under ${s.hero.name}'s banner.`,
          ),
        },
        want: { own: true, victim: [1], others: true },
      };
    },
  },
  {
    name: "Control Undead wrests a wandering hero's undead company: onlookers are told of him with no realm",
    stage(b) {
      const m = leads(wanderer(b), [skeletal('Rattling Guard')]);
      const s = necromancer(b, 1, 'Control Undead', m.id);
      return { ...s, mark: m };
    },
    check(o, s) {
      const m = must(s.mark, 'the mark');
      return {
        got: {
          others: anySays(
            o,
            `✨ ${s.hero.name} (${realmName(o, 0)})'s Control Undead wrests the Rattling Guard from ${m.name} in ${b0(s).name} — it now marches under ${s.hero.name}'s banner.`,
          ),
        },
        want: { others: true },
      };
    },
  },
  {
    name: 'Control Undead: a company of the Undead race counts as undead too',
    stage(b) {
      const m = leads(rival(b), [
        { ...(companies(1, 'Men-at-Arms', 'Veteran', 'Grey Host')[0] as Unit), race: 'Undead' },
      ]);
      const s = necromancer(b, 1, 'Control Undead', m.id);
      return { ...s, mark: m, orders: [...s.orders, standsWatch(m)] };
    },
    check(o) {
      return { got: { own: says(o, `Control Undead wrests the Grey Host c0 from`) }, want: { own: true } };
    },
  },
  {
    name: 'Control Undead finds no undead among living troops',
    stage(b) {
      const m = leads(rival(b), companies(2));
      return { ...necromancer(b, 1, 'Control Undead', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `${s.hero.name}'s Control Undead finds no undead among ${must(s.mark, 'the mark').name}'s forces.`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Control Undead aimed at nobody here is refused',
    stage: (b) => necromancer(b, 1, 'Control Undead', 99999),
    check(o, s) {
      return {
        got: { refused: says(o, `Control Undead: no valid target hero stands in ${b0(s).name} this phase.`) },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Control Undead cannot be turned on his own heroes',
    stage(b) {
      const f = leads(at(b, {}), [skeletal()]);
      return { ...necromancer(b, 1, 'Control Undead', f.id), mark: f };
    },
    check(o) {
      return {
        got: { refused: says(o, 'Control Undead cannot be turned on your own heroes.') },
        want: { refused: true },
      };
    },
  },
];
const rises = (o: Outcome, s: Staged, unit: string, quality: string, type: string) =>
  says(
    o,
    `💀 ${s.hero.name} calls forth ${unit} — a ${quality} ${type} rises from the graves of ${b0(s).name} to serve! (Upkeep 1g/turn.)`,
  );
export const SKELETAL_ARMIES_CASES: CastSpellOrderCase[] = [
  {
    name: 'Skeletal Armies: at Necromancy 1 or 2, one company rises, the most experienced dead first; it serves him after the turn',
    stage(b) {
      b.own(b.X, 0);
      battlefield(b);
      return necromancer(b, 2, 'Skeletal Armies');
    },
    check(o, s) {
      return {
        got: {
          rises: rises(o, s, 'Fallen Lances c0 (Skeletal)', 'Veteran', 'Free Lances'),
          raised: o.lines.filter((l) => l.text.includes('calls forth')).length,
          after: char(o, s.hero).armies.map((u) => [u.unitName, u.race, u['_isSkeletal']]),
          graves: graves(o, b0(s)),
        },
        want: {
          rises: true,
          raised: 1,
          after: [['Fallen Lances c0 (Skeletal)', 'Undead', true]],
          graves: ['Fallen Foot c0', 'Fallen Foot c1'],
        },
      };
    },
  },
  {
    name: 'Skeletal Armies: two rise at Necromancy 3 or 4',
    stage(b) {
      b.own(b.X, 0);
      battlefield(b);
      return necromancer(b, 3, 'Skeletal Armies');
    },
    check(o) {
      return { got: { raised: o.lines.filter((l) => l.text.includes('calls forth')).length }, want: { raised: 2 } };
    },
  },
  {
    name: 'Skeletal Armies: three rise at Necromancy 5, but never more than the graves hold',
    stage(b) {
      b.own(b.X, 0);
      bury(b.X, 2);
      return necromancer(b, 5, 'Skeletal Armies');
    },
    check(o, s) {
      return {
        got: { raised: o.lines.filter((l) => l.text.includes('calls forth')).length, graves: graves(o, b0(s)) },
        want: { raised: 2, graves: [] },
      };
    },
  },
  {
    name: "Skeletal Armies: an Undead realm's Deathless Legion raises them one tier stronger",
    stage(b) {
      b.own(b.X, 0);
      realm(b)['alignment'] = 'Undead';
      knows(b, 0, 'gd');
      realm(b)['gdProvinceId'] = null;
      bury(b.X, 1, 'Men-at-Arms', 'Average', 'Fallen Foot');
      return necromancer(b, 1, 'Skeletal Armies');
    },
    check(o, s) {
      return {
        got: { rises: rises(o, s, 'Fallen Foot c0 (Skeletal)', 'Veteran', 'Men-at-Arms') },
        want: { rises: true },
      };
    },
  },
  {
    name: "Skeletal Armies: a Neutral realm's Wonder raises them no stronger",
    stage(b) {
      b.own(b.X, 0);
      realm(b)['alignment'] = 'Neutral';
      knows(b, 0, 'gd');
      realm(b)['gdProvinceId'] = null;
      bury(b.X, 1, 'Men-at-Arms', 'Average', 'Fallen Foot');
      return necromancer(b, 1, 'Skeletal Armies');
    },
    check(o, s) {
      return {
        got: { rises: rises(o, s, 'Fallen Foot c0 (Skeletal)', 'Average', 'Men-at-Arms') },
        want: { rises: true },
      };
    },
  },
  {
    name: 'Skeletal Armies in ground nobody holds: the risen take it if nobody defends it',
    stage(b) {
      bury(b.X, 1);
      return necromancer(b, 1, 'Skeletal Armies');
    },
    check(o, s) {
      return { got: { owner: province(o, b0(s)).owner }, want: { owner: 0 } };
    },
  },
  {
    name: "Skeletal Armies: a grave with no name rises under its kind's name",
    stage(b) {
      b.own(b.X, 0);
      b.X['battleGraves'] = [{ type: 'Men-at-Arms', quality: 'Average', race: 'Human' }];
      return necromancer(b, 1, 'Skeletal Armies');
    },
    check(o) {
      return {
        got: { rises: says(o, ` (Skeletal) — a Average Men-at-Arms rises from the graves of `) },
        want: { rises: true },
      };
    },
  },
  {
    name: 'Skeletal Armies: where no army ever fell, none answer',
    stage: (b) => necromancer(b, 1, 'Skeletal Armies'),
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `${s.hero.name} calls out to the fallen in ${b0(s).name}, but there are no battlefield dead here to answer. Seek a province where armies have previously perished.`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: "Skeletal Armies (Reaper's Bell, a hero of no Necromancy): one rises",
    stage(b) {
      b.own(b.X, 0);
      battlefield(b);
      const h = at(b, {});
      const bell = item(b, "Reaper's Bell");
      holding(h, bell);
      return { hero: h, orders: [one(h, order('use_item', String(bell['id'])))], there: b.X };
    },
    check(o) {
      return { got: { raised: o.lines.filter((l) => l.text.includes('calls forth')).length }, want: { raised: 1 } };
    },
  },
];
export const CURSE_CASES: CastSpellOrderCase[] = [
  {
    name: 'Curse: every skill of an enemy hero beside him is halved for the rest of the turn; his realm is told',
    stage(b) {
      const m = rival(b);
      m.skills = { melee: 5, tactical: 3, march: 1 };
      return { ...necromancer(b, 1, 'Curse', m.id), mark: m };
    },
    check(o, s) {
      const m = must(s.mark, 'the mark');
      const said = `✨ ${s.hero.name}'s Curse settles over ${m.name} — every skill is halved for the rest of the turn (Melee 5→2, Tactical 3→1, March 1→0)!`;
      return {
        got: {
          told: says(o, said),
          public: publicLine(o, said),
          victim: toldTo(
            o,
            `☠ A Curse from ${s.hero.name} settles over ${m.name} — every skill is halved for the rest of the turn (Melee 5→2, Tactical 3→1, March 1→0).`,
          ),
          after: char(o, m).skills,
        },
        want: { told: true, public: true, victim: [1], after: { melee: 5, tactical: 3, march: 1 } },
      };
    },
  },
  {
    name: 'Curse: a second Curse the same turn halves what is left',
    stage(b) {
      const m = rival(b);
      m.skills = { melee: 5, tactical: 3 };
      const s = mage(b, { necromancy: 3 }, cast('Curse', m.id), cast('Curse', m.id));
      return { ...s, mark: m };
    },
    check(o, s) {
      return {
        got: {
          second: says(
            o,
            `${must(s.mark, 'the mark').name} — every skill is halved for the rest of the turn (Melee 2→1, Tactical 1→0)!`,
          ),
        },
        want: { second: true },
      };
    },
  },
  {
    name: 'Curse: a skill at 0 is not named',
    stage(b) {
      const m = rival(b);
      m.skills = { melee: 4, march: 0 };
      return { ...necromancer(b, 1, 'Curse', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `${must(s.mark, 'the mark').name} — every skill is halved for the rest of the turn (Melee 4→2)!`,
          ),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Curse: a hero with no skills has none to curse',
    stage(b) {
      const m = rival(b);
      m.skills = {};
      return { ...necromancer(b, 1, 'Curse', m.id), mark: m };
    },
    check(o, s) {
      return {
        got: { told: says(o, `${must(s.mark, 'the mark').name} has no skills to curse.`) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Curse: no enemy hero here is refused',
    stage: (b) => necromancer(b, 1, 'Curse', ''),
    check(o, s) {
      return {
        got: { refused: says(o, `Curse: no valid target hero in ${b0(s).name} this phase.`) },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Curse cannot be turned on his own heroes',
    stage(b) {
      const f = at(b, {});
      return { ...necromancer(b, 1, 'Curse', f.id), mark: f };
    },
    check(o) {
      return { got: { refused: says(o, 'Curse cannot be turned on your own heroes.') }, want: { refused: true } };
    },
  },
];
export const PLAGUE_CASES: CastSpellOrderCase[] = [
  {
    name: 'Plague: each humanoid company in an enemy province beside him may sicken a level (a low die: all four); told to all, its owner warned',
    dice: LUCKY,
    stage(b) {
      const p = ring1(b, 0);
      b.own(p, 1);
      p.garrisonArmies = companies(4, 'Men-at-Arms', 'Veteran', 'Watch');
      return { ...necromancer(b, 2, 'Plague', p.id), there: p };
    },
    check(o, s) {
      const p = b0(s);
      const said = `☠ ${s.hero.name} calls down a Plague upon ${p.name} — of 4 humanoid units, 4 sicken and lose an experience level. It may spread to neighbouring lands in the phases to come.`;
      return {
        got: {
          told: says(o, said),
          to: toldTo(o, said),
          owner: toldTo(
            o,
            `☠ An enemy Plague has struck ${p.name} — 4 of your units there sicken and may spread to neighbouring lands.`,
          ),
          marks: [province(o, p)['_plaguedTurn'], province(o, p)['_plagueLevel'], province(o, p)['_plagueCaster']],
        },
        want: { told: true, to: [1], owner: [1], marks: [o.turn, 2, 0] },
      };
    },
  },
  {
    name: 'Plague: a high die and none sicken; the dead and beasts are never tested',
    stage(b) {
      const p = ring1(b, 0);
      b.own(p, 1);
      p.garrisonArmies = [
        ...companies(1, 'Men-at-Arms', 'Veteran', 'Watch'),
        skeletal('Bones'),
        ...beasts(1, 'Great Bears'),
      ];
      return { ...necromancer(b, 5, 'Plague', p.id), there: p };
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `☠ ${s.hero.name} calls down a Plague upon ${b0(s).name} — of 1 humanoid unit, 0 sicken and lose an experience level.`,
          ),
          level: province(o, b0(s))['_plagueLevel'],
        },
        want: { told: true, level: 5 },
      };
    },
  },
  {
    name: 'Plague: its strength stops at level 5 (Necromancy 7: 5)',
    stage(b) {
      const p = ring1(b, 0);
      return { ...necromancer(b, 7, 'Plague', p.id), there: p };
    },
    check(o, s) {
      return { got: { level: province(o, b0(s))['_plagueLevel'] }, want: { level: 5 } };
    },
  },
  {
    name: 'Plague: a province already stricken this turn takes no second',
    stage(b) {
      const p = ring1(b, 0);
      const s = mage(b, { necromancy: 3 }, cast('Plague', p.id), cast('Plague', p.id));
      return { ...s, there: p };
    },
    check(o, s) {
      return {
        got: {
          refused: says(
            o,
            `${b0(s).name} is already stricken with plague this turn — a second casting adds nothing (not cumulative).`,
          ),
        },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Plague: a province two away is out of reach',
    stage: (b) => ({ ...necromancer(b, 1, 'Plague', ring2(b, 0).id), there: ring2(b, 0) }),
    check(o, s) {
      return {
        got: {
          refused: says(o, `${s.hero.name}: Plague must target your province or one adjacent.`),
          mark: province(o, b0(s))['_plaguedTurn'],
        },
        want: { refused: true, mark: undefined },
      };
    },
  },
  {
    name: "Plague: an enemy's Bless ward may turn it aside (a low die), and the province is not marked stricken",
    dice: LUCKY,
    stage(b) {
      const p = ring1(b, 0);
      b.own(p, 1);
      Object.assign(p, { _blessWardTurn: b.G.turn, _blessWardBy: 1, _blessWardPct: 50 });
      return { ...necromancer(b, 1, 'Plague', p.id), there: p };
    },
    check(o, s) {
      return {
        got: {
          warded: anySays(o, `${s.hero.name}'s Plague washes over the sacred ground and does no harm.`),
          mark: province(o, b0(s))['_plaguedTurn'],
        },
        want: { warded: true, mark: undefined },
      };
    },
  },
];
export const RAISE_WRAITHS_CASES: CastSpellOrderCase[] = [
  {
    name: 'Raise Wraiths (Necromancy 7): the strongest of the dead here rise as Elite Wraiths; others see it',
    stage(b) {
      b.own(b.X, 0);
      battlefield(b);
      return necromancer(b, 7, 'Raise Wraiths');
    },
    check(o, s) {
      const p = b0(s);
      const raised = (char(o, s.hero).armies[0] ?? {}) as Partial<Unit>;
      const name = String(raised.unitName);
      return {
        got: {
          own: says(
            o,
            `💀 ${s.hero.name} binds the dead of ${p.name} into ${name} — Elite undead at your side! (Upkeep 1g/turn.)`,
          ),
          others: anySays(
            o,
            `💀 ${s.hero.name} (${realmName(o, 0)}) binds the dead of ${p.name} into ${name} — Elite undead now march at their side.`,
          ),
          wraith: [
            raised.type,
            raised.quality,
            raised.race,
            raised['_isSkeletal'],
            raised['_isWraith'],
            name.startsWith('Wraiths ('),
          ],
          graves: graves(o, p),
        },
        want: {
          own: true,
          others: true,
          wraith: ['Free Lances', 'Elite', 'Undead', true, true, true],
          graves: ['Fallen Foot c0', 'Fallen Foot c1'],
        },
      };
    },
  },
  {
    name: 'Raise Wraiths: no dead here, none answer',
    stage: (b) => necromancer(b, 7, 'Raise Wraiths'),
    check(o, s) {
      return {
        got: {
          told: says(o, `${s.hero.name}'s call for Wraiths finds no battlefield dead in ${b0(s).name} to answer.`),
        },
        want: { told: true },
      };
    },
  },
];
export const DEATHS_DOMINION_CASES: CastSpellOrderCase[] = [
  {
    name: "Death's Dominion (Necromancy 9): as many dead as his level (to 5) rise, each a tier stronger than it fell, the best first",
    stage(b) {
      b.own(b.X, 0);
      battlefield(b);
      return necromancer(b, 9, "Death's Dominion");
    },
    check(o, s) {
      return {
        got: {
          told: says(
            o,
            `💀 ${s.hero.name} unleashes Death's Dominion over ${b0(s).name} — 3 skeletal units claw up from the graves to serve!`,
          ),
          after: ranks(char(o, s.hero).armies),
        },
        want: {
          told: true,
          after: [
            'Fallen Lances c0 (Skeletal) (Crack)',
            'Fallen Foot c0 (Skeletal) (Veteran)',
            'Fallen Foot c1 (Skeletal) (Veteran)',
          ],
        },
      };
    },
  },
  {
    name: "Death's Dominion: never more than five, even from more graves",
    stage(b) {
      b.own(b.X, 0);
      bury(b.X, 7);
      return necromancer(b, 9, "Death's Dominion");
    },
    check(o, s) {
      return {
        got: { told: says(o, `— 5 skeletal units claw up`), graves: graves(o, b0(s)).length },
        want: { told: true, graves: 2 },
      };
    },
  },
  {
    name: "Death's Dominion: an Undead realm's Deathless Legion lifts them two tiers (Elite at most)",
    stage(b) {
      b.own(b.X, 0);
      realm(b)['alignment'] = 'Undead';
      knows(b, 0, 'gd');
      realm(b)['gdProvinceId'] = null;
      battlefield(b);
      return necromancer(b, 9, "Death's Dominion");
    },
    check(o, s) {
      return {
        got: { after: ranks(char(o, s.hero).armies) },
        want: {
          after: [
            'Fallen Lances c0 (Skeletal) (Elite)',
            'Fallen Foot c0 (Skeletal) (Crack)',
            'Fallen Foot c1 (Skeletal) (Crack)',
          ],
        },
      };
    },
  },
  {
    name: "Death's Dominion: no dead here, nothing to raise",
    stage: (b) => necromancer(b, 9, "Death's Dominion"),
    check(o, s) {
      return {
        got: { told: says(o, `${s.hero.name}'s Death's Dominion finds no fallen army in ${b0(s).name} to raise.`) },
        want: { told: true },
      };
    },
  },
];

// ── The casting limits, at each level (plan P1-11a1) ────────────────────────────────────────────────────────────
// Each limit at each level a hero can reach in a school, one spell past it: the action spells of a school a hero may
// cast in a turn (the Cast Spell order), and the combat spells of a school he may cast in one personal combat (here the
// fight a failed Charm brings on, the caster's Encounter Plan naming the spells). The last spell is refused; every one
// before it is worked. The levels run to 5, where a school's effective level stops (a White 9 casts as a White 5).
/** Action spells of one school a turn, by level (the rulebook's table: 1 at level 1 or 2, 2 at 3, 3 at 4 or 5). */
const ACTION_SPELLS_A_TURN: [level: number, allowed: number][] = [
  [1, 1],
  [2, 1],
  [3, 2],
  [4, 3],
  [5, 3],
];
/** Combat spells of one school a fight, by level (1 at level 1, 2 from level 2 to 5). */
const COMBAT_SPELLS_A_FIGHT: [level: number, allowed: number][] = [
  [1, 1],
  [2, 2],
  [3, 2],
  [4, 2],
  [5, 2],
];
/** The Necromancy combat spells, in the order the caster's plan names them. */
const NECROMANCY_COMBAT_SPELLS = ['Curse', 'Hand of Death', 'Control Undead'];
const plural = (n: number, what: string) => `${String(n)} ${what}${n === 1 ? '' : 's'}`;
export const CASTING_LIMIT_CASES: CastSpellOrderCase[] = [
  ...ACTION_SPELLS_A_TURN.map(([level, allowed]): CastSpellOrderCase => ({
    name: `at White ${String(level)}, ${plural(allowed, 'action spell')} of the school a turn: one more is blocked, unrolled`,
    stage: (b) => mage(b, { white: level }, ...Array.from({ length: allowed + 1 }, () => cast('Holy Symbol'))),
    check(o, s) {
      return {
        got: {
          rolls: o.lines.filter((l) => l.text.startsWith(`📊 ${s.hero.name} casts`)).length,
          blocked: o.lines.filter((l) => l.text.includes('casting limit')).map((l) => l.text),
        },
        want: {
          rolls: allowed,
          blocked: [
            `${s.hero.name}: White Magic level ${String(level)} casting limit (${String(allowed)}/${String(allowed)} per turn). Holy Symbol blocked.`,
          ],
        },
      };
    },
  })),
  ...COMBAT_SPELLS_A_FIGHT.map(([level, allowed]): CastSpellOrderCase => ({
    name: `at Necromancy ${String(level)}, ${plural(allowed, 'combat spell')} of the school a fight: one more is refused`,
    dice: rollOf(20),
    stage(b) {
      const m = rival(b, {}, { melee: 1 });
      m['_charmResist'] = 30;
      m['encounterPlan'] = { tactics: ['ME'], duelStance: 'accept' };
      const s = { ...psychic(b, 2, 'Charm', m.id, { necromancy: level }), mark: m };
      s.hero['encounterPlan'] = {
        tactics: NECROMANCY_COMBAT_SPELLS.slice(0, allowed + 1).map((spell) => 'CA:' + spell),
        duelStance: 'accept',
      };
      return s;
    },
    check(o, s) {
      const refused = must(NECROMANCY_COMBAT_SPELLS[allowed], 'the spell past the limit');
      return {
        got: {
          worked: o.all
            .filter((l) => l.text.includes(`${s.hero.name} calls on the necromantic arts, weaving `))
            .map((l) => /weaving (.+?) \(/.exec(l.text)?.[1]),
          refused: o.all
            .filter((l) => l.text.includes(`${s.hero.name}: Necromancy spell limit reached this combat.`))
            .map((l) => l.text.trim()),
          tried: anySays(o, `weaving ${refused} (`),
        },
        want: {
          worked: NECROMANCY_COMBAT_SPELLS.slice(0, allowed),
          refused: [`${s.hero.name}: Necromancy spell limit reached this combat.`],
          tried: false,
        },
      };
    },
  })),
];

/** Stages `c` on `b`, from plain realms. */
export const stageCase = (b: Board, c: CastSpellOrderCase): Staged => {
  plainRealms(b);
  b.G.players.forEach((pl) => {
    pl['heroes'] = [];
  });
  return c.stage(b);
};

/** Every case, by part of the order. */
export const CAST_SPELL_ORDER_CASES: [string, CastSpellOrderCase[]][] = [
  ['casting', CASTING_CASES],
  ['the casting limits, at each level', CASTING_LIMIT_CASES],
  ['Resurrect', RESURRECT_CASES],
  ['Part Sea', PART_SEA_CASES],
  ['Holy Symbol', HOLY_SYMBOL_CASES],
  ['Bless Province', BLESS_PROVINCE_CASES],
  ['Sanctuary', SANCTUARY_CASES],
  ['Divine Judgment', DIVINE_JUDGMENT_CASES],
  ['Charm', CHARM_CASES],
  ['Oratory', ORATORY_CASES],
  ['Clairvoyance', CLAIRVOYANCE_CASES],
  ['Psychic Blast', PSYCHIC_BLAST_CASES],
  ['Telekinetic Storm', TELEKINETIC_STORM_CASES],
  ['Mass Confusion', MASS_CONFUSION_CASES],
  ['Dominate', DOMINATE_CASES],
  ['Illusory Terrain', ILLUSORY_TERRAIN_CASES],
  ['Phantasmal Armies', PHANTASMAL_ARMIES_CASES],
  ['Hide Lairs', HIDE_LAIRS_CASES],
  ['Invisibility', INVISIBILITY_CASES],
  ['Phantom Host', PHANTOM_HOST_CASES],
  ['Veil', VEIL_CASES],
  ['Earthquake', EARTHQUAKE_CASES],
  ['Flood', FLOOD_CASES],
  ['Elemental Summon', ELEMENTAL_SUMMON_CASES],
  ['Chain Lightning', CHAIN_LIGHTNING_CASES],
  ['Cataclysm', CATACLYSM_CASES],
  ['Control Undead', CONTROL_UNDEAD_CASES],
  ['Skeletal Armies', SKELETAL_ARMIES_CASES],
  ['Curse', CURSE_CASES],
  ['Plague', PLAGUE_CASES],
  ['Raise Wraiths', RAISE_WRAITHS_CASES],
  ["Death's Dominion", DEATHS_DOMINION_CASES],
];
