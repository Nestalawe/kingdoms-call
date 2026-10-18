// The recruit, hire and realm's works orders' cases (plan P1-08j3): Recruit Armies, Hire Hero, the orders of a realm's
// creed (Consecrate, Call to Arms, Broker, Harvest the Field, and the removed Awaken the Wild and Call from the Pit) and
// three masteries (Awaken Grove, Wild Calling, Grand Design), staged on the middle of a bot world
// (lib/middle-of-a-bot-world.ts), each with what must be true after it in game terms.
// scenario/recruit-hire-and-realm-works-orders-in-a-whole-turn.test.ts plays each through a whole turn (resolveTurn);
// unit/recruit-hire-and-realm-works-orders-called-directly.test.ts calls each order's own function on them, one phase at
// a time. A case stages its world and the hero's five orders; after them, it reads what it needs from the world and the
// log (`got`) beside what must be so (`want`), and the test compares the two. Every outcome is certain: no case leans on
// the dice (a recruit's grade is Average unless a discovery or a Wonder says otherwise, and none is staged; a Wild
// Calling over thirty beasts for a druid with room for one more finds its one but for a chance in a billion).
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

export interface Staged {
  /** The hero whose orders are played. */
  hero: Character;
  orders: Order[];
  /** Where the hero stands. */
  here: Province;
  /** Another province the case needs (a comrade's, a province called to arms, one spied on). */
  there?: Province;
  /** Another hero the case needs (the one hired, a comrade, a rival commander). */
  other?: Character;
  /** Orders the realm wrote for the hero it means to hire (`other`), from the phase after the hire. */
  written?: Order[];
}
export interface Outcome {
  world: World;
  /** The hero's own lines in the log. */
  lines: Line[];
  /** Every line in the log. */
  all: Line[];
  /** The turn the orders were played in. */
  turn: number;
}
export interface RecruitHireAndWorksOrderCase {
  name: string;
  /** Plays only in a whole turn: processOrder refuses the order before the order's own function runs (a mastery once
   *  a turn), or the rule reaches to the turn's end. */
  wholeTurnOnly?: boolean;
  stage(b: Board): Staged;
  /** What the case found after the orders, and what it should have found: the same keys. */
  check(o: Outcome, s: Staged): { got: Record<string, unknown>; want: Record<string, unknown> };
}

/** `n` companies of `type` of `quality` (a real tier: Green, Average, Veteran, Crack, Elite). */
export const companies = (n: number, type = 'Men-at-Arms', quality = 'Average', race = 'Human'): Unit[] =>
  Array.from({ length: n }, (_, k) => ({ type, quality, race, unitName: `${type} c${String(k)}` }));

const text = (ls: Line[]) => ls.map((l) => l.text).join('\n');
/** Whether the hero's lines say `what` (a string, or a pattern). */
const says = (o: Outcome, what: string | RegExp) =>
  typeof what === 'string' ? text(o.lines).includes(what) : what.test(text(o.lines));
/** Whether `c`'s own lines say `what`. */
const saysOf = (o: Outcome, c: Character, what: string) => text(o.all.filter((l) => l.charId === c.id)).includes(what);
const province = (o: Outcome, p: Province) => must(o.world.world.provinces[p.id], 'province ' + p.name);
const char = (o: Outcome, c: Character) =>
  must(
    o.world.characters.find((x) => x.id === c.id),
    'hero ' + c.name,
  );
const realmOf = (o: Outcome, i: number) => must(o.world.players[i], 'realm ' + String(i));
const units = (us: Unit[] | undefined) => (us ?? []).map((u) => `${u.quality} ${u.type}`);
const led = (o: Outcome, c: Character) => units(char(o, c).armies);
/** The kinds of company in `p`'s garrison. Not their grades: a garrison may be drilled a grade up at the turn's end
 *  (a die decides), so the tests called directly check the grades. */
const garrison = (o: Outcome, p: Province) => province(o, p).garrisonArmies.map((u) => u.type);
const ring1 = (b: Board, i: number) => must(b.ring1[i], 'a neighbour of the middle');
const ring2 = (b: Board, i: number) => must(b.ring2[i], 'a province two away');
const realm = (b: Board, i = 0) => must(b.G.players[i], 'realm ' + String(i));
const skilled = (skills: Record<string, number>) => ({ melee: 2, tactical: 2, march: 1, spy: 0, ...skills });
/** A hero of realm 0 standing in the middle, at full health. His maximum HP is the turn's own reckoning of it (15 to
 *  start, and what he has earned), so the turn keeps it as staged. */
const at = (b: Board, extra: Partial<HeroSpec> = {}) => {
  const h = hero(b, { player: 0, at: b.X, ...extra });
  h['hpEarned'] = Math.max(0, h.maxHp - 15);
  return h;
};
/** The king of realm 0, in the middle. */
const king = (b: Board, extra: Partial<HeroSpec> = {}) => at(b, { king: true, ...extra });
/** Realm `i` of the creed `alignment`. */
const creed = (b: Board, alignment: string, i = 0) => {
  realm(b, i)['alignment'] = alignment;
};
/** Land of `race` folk, raising `armyTypes`. */
const settled = (
  p: Province,
  race = 'Human',
  armyTypes = ['Shieldwall Levies', 'Yeoman Longbows', 'Human Garrison'],
) => {
  p['race'] = race;
  p['armyTypes'] = armyTypes;
};
/** Realm 0 holds `p`, a settled province. */
const holds = (b: Board, p: Province, armyTypes?: string[]) => {
  settled(p, 'Human', armyTypes);
  b.own(p, 0);
};
/** A wandering hero of `alignment` (and `race`) in `where`, of the skills given: his wage is his creed's distance from
 *  the hirer's, and his skills' worth (melee 2, tactical 2, march 1: one gold more). */
const wanderer = (
  b: Board,
  where: Province,
  {
    alignment = 'Divine',
    race = 'Human',
    skills = skilled({}),
  }: { alignment?: string; race?: string; skills?: Record<string, number> } = {},
) => {
  const w = hero(b, { player: null, at: where, skills });
  w.name = `Wanderer ${String(w.id)} (wandering)`;
  w['alignment'] = alignment;
  w['race'] = race;
  w['hpEarned'] = Math.max(0, w.maxHp - 15);
  return w;
};
/** A mercenary band roaming `where`. */
const band = (b: Board, where: Province, type = 'Free Lances', quality = 'Veteran') => {
  const m = { id: 'merc_test', type, quality, race: 'Human', unitName: 'Test Company', location: where.id };
  must(b.G.mercenaries, 'the mercenaries').push(m);
  return m;
};
/** Nobody has seen `p`: the board leaves what the realms saw of the world as it was dealt. */
const unseen = (p: Province) => {
  p.visitedBy = [];
  p['exploredBy'] = {};
};
const treasury = (o: Outcome, gold: number) => says(o, `Treasury: ${String(gold)}g remaining.`);

export const RECRUIT_ORDER_CASES: RecruitHireAndWorksOrderCase[] = [
  {
    name: 'Recruit Armies: companies the province raises are paid for and join the recruiter, Average',
    stage(b) {
      holds(b, b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'Shieldwall Levies|1,Yeoman Longbows|1')) };
    },
    check(o, { hero: h, here }) {
      return {
        got: {
          led: led(o, h),
          told: says(o, `recruits 1× Shieldwall Levies, 1× Yeoman Longbows in ${here.name}. Cost: 4g.`),
          paid: treasury(o, 16),
        },
        want: { led: ['Average Shieldwall Levies', 'Average Yeoman Longbows'], told: true, paid: true },
      };
    },
  },
  {
    name: 'Recruit Armies: an order naming nothing raises one company of Shieldwall Levies',
    stage(b) {
      holds(b, b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit')) };
    },
    check(o, { hero: h }) {
      return {
        got: { led: led(o, h), paid: treasury(o, 18) },
        want: { led: ['Average Shieldwall Levies'], paid: true },
      };
    },
  },
  {
    name: 'Recruit Armies: one company of a kind a season outside the founder’s home, and a second order is blocked',
    stage(b) {
      holds(b, b.X);
      return {
        hero: at(b),
        here: b.X,
        orders: plan(order('recruit', 'Shieldwall Levies|3'), order('recruit', 'Shieldwall Levies|1')),
      };
    },
    check(o, { hero: h, here }) {
      return {
        got: {
          led: led(o, h),
          paid: treasury(o, 18),
          blocked: says(
            o,
            `recruitment in ${here.name} was entirely blocked: Shieldwall Levies (already recruited this turn).`,
          ),
        },
        want: { led: ['Average Shieldwall Levies'], paid: true, blocked: true },
      };
    },
  },
  {
    name: 'Recruit Armies: two of a kind a season in the founder’s own home province',
    stage(b) {
      holds(b, b.X);
      realm(b)['homeProvinceId'] = b.X.id;
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'Shieldwall Levies|3')) };
    },
    check(o, { hero: h }) {
      return {
        got: { led: led(o, h), paid: treasury(o, 16) },
        want: { led: ['Average Shieldwall Levies', 'Average Shieldwall Levies'], paid: true },
      };
    },
  },
  {
    name: 'Recruit Armies: refused on ground the realm does not hold',
    stage(b) {
      settled(b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'Shieldwall Levies|1')) };
    },
    check(o, { hero: h, here }) {
      return {
        got: {
          led: led(o, h),
          refused: says(o, `cannot recruit in ${here.name} — you must control the province to raise troops there.`),
        },
        want: { led: [], refused: true },
      };
    },
  },
  {
    name: 'Recruit Armies: a company the province does not raise is blocked, the rest raised',
    stage(b) {
      holds(b, b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'Elven Bowmen|1,Shieldwall Levies|1')) };
    },
    check(o, { hero: h, here }) {
      return {
        got: {
          led: led(o, h),
          blocked: says(
            o,
            `Cost: 2g. Treasury: 18g remaining. (Blocked: Elven Bowmen (not raised in ${here.name} — that unit isn't available here).)`,
          ),
        },
        want: { led: ['Average Shieldwall Levies'], blocked: true },
      };
    },
  },
  {
    name: 'Recruit Armies: a treasury too poor for the companies raises none and pays nothing',
    stage(b) {
      holds(b, b.X);
      realm(b)['gold'] = 1;
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'Shieldwall Levies|1')) };
    },
    check(o, { hero: h, here }) {
      return {
        got: {
          led: led(o, h),
          blocked: says(
            o,
            `recruitment in ${here.name} was entirely blocked: Shieldwall Levies (insufficient gold: need 2g more).`,
          ),
        },
        want: { led: [], blocked: true },
      };
    },
  },
  {
    name: 'Recruit Armies: mustered into the garrison when the order says so',
    stage(b) {
      holds(b, b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'Shieldwall Levies|1,to:garrison')) };
    },
    check(o, { hero: h, here }) {
      return {
        got: {
          led: led(o, h),
          garrison: garrison(o, here),
          told: says(o, `(mustered directly into the garrison of ${here.name}). Cost: 2g.`),
        },
        want: { led: [], garrison: ['Shieldwall Levies'], told: true },
      };
    },
  },
  {
    name: 'Recruit Armies: garrison companies always muster into the garrison, two a season',
    stage(b) {
      holds(b, b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'Human Garrison|3')) };
    },
    check(o, { hero: h, here }) {
      return {
        got: {
          led: led(o, h),
          garrison: garrison(o, here),
          told: says(o, `; 2 garrison units muster straight into the garrison of ${here.name}. Cost: 2g.`),
        },
        want: { led: [], garrison: ['Human Garrison', 'Human Garrison'], told: true },
      };
    },
  },
  {
    name: 'Recruit Armies: mustered under a comrade’s banner, and the comrade is told',
    stage(b) {
      holds(b, b.X);
      const other = at(b);
      return {
        hero: at(b),
        other,
        here: b.X,
        orders: plan(order('recruit', `Shieldwall Levies|1,to:${String(other.id)}`)),
      };
    },
    check(o, { hero: h, other, here }) {
      const w = must(other, 'the comrade');
      return {
        got: {
          led: [led(o, h), led(o, w)],
          told: says(o, `(mustered under ${w.name}'s banner)`),
          comrade: saysOf(
            o,
            w,
            `⚔ 1× Shieldwall Levies muster to ${w.name}'s banner in ${here.name}, raised by ${h.name}.`,
          ),
        },
        want: { led: [[], ['Average Shieldwall Levies']], told: true, comrade: true },
      };
    },
  },
  {
    name: 'Recruit Armies: a comrade who is not here leaves the companies with the recruiter',
    stage(b) {
      holds(b, b.X);
      const other = hero(b, { player: 0, at: ring1(b, 0) });
      return {
        hero: at(b),
        other,
        here: b.X,
        orders: plan(order('recruit', `Shieldwall Levies|1,to:${String(other.id)}`)),
      };
    },
    check(o, { hero: h, other }) {
      return {
        got: {
          led: [led(o, h), led(o, must(other, 'the comrade'))],
          told: says(o, '(chosen recipient is not here — troops join the recruiter)'),
        },
        want: { led: [['Average Shieldwall Levies'], []], told: true },
      };
    },
  },
  {
    name: 'Recruit Armies: a beast raised for a column that leads all the beasts its Druid allows musters into the garrison',
    stage(b) {
      holds(b, b.X, ['Great Bears']);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'Great Bears|1')) };
    },
    check(o, { hero: h, here }) {
      return {
        got: {
          led: led(o, h),
          garrison: garrison(o, here),
          told:
            says(o, `🐾 ${h.name} can lead only 0 Creature or Monster units (Druid 0): `) &&
            says(o, `(Great Bears) musters into the garrison of ${here.name} instead.`),
        },
        want: { led: [], garrison: ['Great Bears'], told: true },
      };
    },
  },
  {
    name: 'Recruit Armies: a Druid of 6 or more raises beasts at half price',
    stage(b) {
      holds(b, b.X, ['Great Bears']);
      return {
        hero: at(b, { skills: skilled({ druid: 6 }) }),
        here: b.X,
        orders: plan(order('recruit', 'Great Bears|1')),
      };
    },
    check(o, { hero: h }) {
      return {
        got: { led: led(o, h), told: says(o, 'recruits 1× Great Bears'), paid: treasury(o, 18) },
        want: { led: ['Average Great Bears'], told: true, paid: true },
      };
    },
  },
  {
    name: 'Recruit Armies: a beast of the deep is called up only in a sea province',
    stage(b) {
      holds(b, b.X, ['Great Turtles', 'Shieldwall Levies']);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'Great Turtles|1')) };
    },
    check(o, { hero: h, here }) {
      return {
        got: {
          led: led(o, h),
          blocked: says(
            o,
            `recruitment in ${here.name} was entirely blocked: Great Turtles (can only be summoned in a sea province).`,
          ),
        },
        want: { led: [], blocked: true },
      };
    },
  },
  {
    name: 'Recruit Armies: a mercenary band roaming here is hired, even on ground the realm does not hold',
    stage(b) {
      settled(b.X);
      band(b, b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'merc:merc_test')) };
    },
    check(o, { hero: h }) {
      return {
        got: {
          led: led(o, h),
          gone: !(o.world.mercenaries ?? []).some((m) => m.id === 'merc_test'),
          told: says(o, `${h.name} hires mercenary band Test Company (Veteran) for 3g.`),
        },
        want: { led: ['Veteran Free Lances'], gone: true, told: true },
      };
    },
  },
  {
    name: 'Recruit Armies: a Neutral crown hires mercenaries 2g cheaper, and the companies named are raised besides',
    stage(b) {
      holds(b, b.X);
      creed(b, 'Neutral');
      band(b, b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'merc:merc_test,Yeoman Longbows|1')) };
    },
    check(o, { hero: h }) {
      return {
        got: {
          led: led(o, h),
          told: says(o, 'hires mercenary band Test Company (Veteran) for 1g (Neutral discount).'),
          paid: treasury(o, 17),
        },
        want: { led: ['Veteran Free Lances', 'Average Yeoman Longbows'], told: true, paid: true },
      };
    },
  },
  {
    name: 'Recruit Armies: a band the treasury cannot pay is not hired',
    stage(b) {
      settled(b.X);
      realm(b)['gold'] = 2;
      band(b, b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'merc:merc_test')) };
    },
    check(o, { hero: h }) {
      return {
        got: {
          led: led(o, h),
          told: says(o, `${h.name}: cannot afford Test Company mercenaries (3g).`),
        },
        want: { led: [], told: true },
      };
    },
  },
  {
    name: 'Recruit Armies: a mercenary beast is not hired into a column already leading all the beasts it may',
    stage(b) {
      settled(b.X);
      band(b, b.X, 'Great Bears');
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'merc:merc_test')) };
    },
    check(o, { hero: h }) {
      return {
        got: {
          led: led(o, h),
          told: says(
            o,
            `🐾 ${h.name} can lead only 0 Creature or Monster units (Druid 0) — the Test Company mercenaries are not hired.`,
          ),
        },
        want: { led: [], told: true },
      };
    },
  },
  {
    name: 'Recruit Armies: the garrison is not there to muster into on ground the realm does not hold',
    stage(b) {
      settled(b.X);
      band(b, b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'merc:merc_test,to:garrison')) };
    },
    check(o, { hero: h, here }) {
      return {
        got: { led: led(o, h), garrison: garrison(o, here) },
        want: { led: ['Veteran Free Lances'], garrison: [] },
      };
    },
  },
  {
    name: 'Recruit Armies: a company named without a count is one',
    stage(b) {
      holds(b, b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'Yeoman Longbows')) };
    },
    check(o, { hero: h }) {
      return { got: { led: led(o, h), paid: treasury(o, 18) }, want: { led: ['Average Yeoman Longbows'], paid: true } };
    },
  },
  {
    name: 'Recruit Armies: where the companies muster may come in the order’s second list, and is never read as a company',
    stage(b) {
      holds(b, b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'Shieldwall Levies|1', 'to:garrison')) };
    },
    check(o, { hero: h, here }) {
      return {
        got: { led: led(o, h), garrison: garrison(o, here), blocked: says(o, 'Blocked') },
        want: { led: [], garrison: ['Shieldwall Levies'], blocked: false },
      };
    },
  },
  {
    name: 'Recruit Armies: a mercenary band no longer here is never raised as a company of its own',
    stage(b) {
      holds(b, b.X);
      return {
        hero: at(b),
        here: b.X,
        orders: plan(order('recruit', '', 'merc:merc_gone,Shieldwall Levies|1')),
      };
    },
    check(o, { hero: h }) {
      return {
        got: { led: led(o, h), paid: treasury(o, 18), blocked: says(o, 'Blocked') },
        want: { led: ['Average Shieldwall Levies'], paid: true, blocked: false },
      };
    },
  },
  {
    name: 'Recruit Armies: a band hired on open ground nobody holds takes the province, with no one to stand against it',
    stage(b) {
      settled(b.X);
      band(b, b.X);
      return { hero: at(b), here: b.X, orders: plan(order('recruit', 'merc:merc_test')) };
    },
    check(o, { here }) {
      return { got: { owner: province(o, here).owner }, want: { owner: 0 } };
    },
  },
];

export const HIRE_ORDER_CASES: RecruitHireAndWorksOrderCase[] = [
  {
    name: 'Hire Hero: a wandering hero of the same creed serves for the base rate and his skills’ worth',
    stage(b) {
      const other = wanderer(b, b.X);
      return { hero: at(b), other, here: b.X, orders: plan(order('hire', other.id)) };
    },
    check(o, { other }) {
      const w = char(o, must(other, 'the wanderer'));
      return {
        got: {
          serves: [w.player, w['pay'], w.name.includes('(wandering)')],
          heroes: (realmOf(o, 0)['heroes'] as number[]).includes(w.id),
          told: says(
            o,
            `${w.name} (Human, Divine) agrees to serve ${realmOf(o, 0).name} for 3g/turn (kindred spirits — base rate). Skills: Melee 2, Tactical 2, March 1. They may act from Early Summer onwards.`,
          ),
          toldHim: saysOf(o, w, `${w.name} (Human, Divine) agrees to serve`),
        },
        want: { serves: [0, 3, false], heroes: true, told: true, toldHim: true },
      };
    },
  },
  {
    name: 'Hire Hero: one more gold for every two steps between the creeds',
    stage(b) {
      const other = wanderer(b, b.X, { alignment: 'Evil' });
      return { hero: at(b), other, here: b.X, orders: plan(order('rest'), order('hire', other.id)) };
    },
    check(o, { other }) {
      const w = char(o, must(other, 'the wanderer'));
      return {
        got: {
          serves: [w.player, w['pay']],
          told: says(o, 'for 5g/turn (5 steps across the alignment spectrum)'),
          from: says(o, 'They may act from Late Summer onwards.'),
        },
        want: { serves: [0, 5], told: true, from: true },
      };
    },
  },
  {
    name: 'Hire Hero: a hero of the grave will not serve a Divine crown',
    stage(b) {
      const other = wanderer(b, b.X, { alignment: 'Undead' });
      return { hero: at(b), other, here: b.X, orders: plan(order('hire', other.id)) };
    },
    check(o, { other }) {
      const w = char(o, must(other, 'the wanderer'));
      return {
        got: { player: w.player, told: says(o, `${w.name} (Undead) recoils from`) },
        want: { player: null, told: true },
      };
    },
  },
  {
    name: 'Hire Hero: Diplomatic Protocols bridge the gulf between Divine and Undead, at 5g',
    stage(b) {
      realm(b)['discoveries'] = [{ id: 'sd31' }];
      const other = wanderer(b, b.X, { alignment: 'Undead', skills: { melee: 1 } });
      return { hero: at(b), other, here: b.X, orders: plan(order('hire', other.id)) };
    },
    check(o, { other }) {
      const w = char(o, must(other, 'the wanderer'));
      return { got: { serves: [w.player, w['pay']] }, want: { serves: [0, 5] } };
    },
  },
  {
    name: 'Hire Hero: no hero of that name is here to hire',
    stage(b) {
      const other = wanderer(b, ring1(b, 0));
      return { hero: at(b), other, here: b.X, orders: plan(order('hire', other.id)) };
    },
    check(o, { other, here }) {
      return {
        got: {
          player: char(o, must(other, 'the wanderer')).player,
          told: says(o, `tries to hire a hero but none matching that description are available in ${here.name}.`),
        },
        want: { player: null, told: true },
      };
    },
  },
  {
    name: 'Hire Hero: the guardian of a neutral province will not leave his post',
    stage(b) {
      const other = wanderer(b, b.X);
      // a guard leads the province's own troops (one with none is only a wanderer)
      other._isNeutralGuard = true;
      other.armies = companies(2);
      return { hero: at(b), other, here: b.X, orders: plan(order('hire', other.id)) };
    },
    check(o, { other }) {
      return {
        got: {
          player: char(o, must(other, 'the guard')).player,
          told: says(o, 'the guardian of a neutral province cannot be hired away'),
        },
        want: { player: null, told: true },
      };
    },
  },
  {
    name: 'Hire Hero: a hero just driven from his home will not serve this turn',
    stage(b) {
      const other = wanderer(b, b.X);
      other['_justDefeated'] = true;
      return { hero: at(b), other, here: b.X, orders: plan(order('hire', other.id)) };
    },
    check(o, { other }) {
      return {
        got: {
          player: char(o, must(other, 'the wanderer')).player,
          told: says(o, 'is furious at being driven from their home'),
        },
        want: { player: null, told: true },
      };
    },
  },
  {
    name: 'Hire Hero: a hero released from service this turn hears no offers',
    stage(b) {
      const other = wanderer(b, b.X);
      other['_releasedTurn'] = b.G.turn;
      return { hero: at(b), other, here: b.X, orders: plan(order('hire', other.id)) };
    },
    check(o, { other }) {
      return {
        got: {
          player: char(o, must(other, 'the wanderer')).player,
          told: says(o, 'was only just released from service and will hear no offers this turn.'),
        },
        want: { player: null, told: true },
      };
    },
  },
  {
    name: 'Hire Hero: a treasury short of the first wage hires no one',
    stage(b) {
      realm(b)['gold'] = 2;
      const other = wanderer(b, b.X);
      return { hero: at(b), other, here: b.X, orders: plan(order('hire', other.id)) };
    },
    check(o, { other }) {
      const w = char(o, must(other, 'the wanderer'));
      return {
        got: {
          player: w.player,
          told: says(o, `cannot afford to hire ${w.name} — needs 3g/turn, treasury has only 2g.`),
        },
        want: { player: null, told: true },
      };
    },
  },
  {
    name: 'Hire Hero: a dwarf sworn to a Dwarven crown is given mithril',
    stage(b) {
      realm(b)['race'] = 'Dwarven';
      const other = wanderer(b, b.X, { race: 'Dwarven' });
      return { hero: at(b), other, here: b.X, orders: plan(order('hire', other.id)) };
    },
    check(o, { other }) {
      const w = char(o, must(other, 'the dwarf'));
      return {
        got: { player: w.player, mithril: w.items.some((i) => /mithril/i.test(String(i['name']))) },
        want: { player: 0, mithril: true },
      };
    },
  },
  {
    name: 'Hire Hero: the orders written for him land for the phases after he is sworn, and the rest are Defend',
    stage(b) {
      settled(b.X);
      const other = wanderer(b, b.X);
      return {
        hero: at(b),
        other,
        here: b.X,
        orders: plan(order('rest'), order('hire', other.id)),
        written: [order('explore'), order('explore'), order('explore'), order('defend'), order('rest')],
      };
    },
    check(o, { other }) {
      const w = char(o, must(other, 'the wanderer'));
      return {
        got: {
          player: w.player,
          told: saysOf(
            o,
            w,
            `${w.name} takes up the orders ${realmOf(o, 0).name} laid down for them — 2 phases of this turn remain to be acted on.`,
          ),
        },
        want: { player: 0, told: true },
      };
    },
  },
];

export const CONSECRATE_ORDER_CASES: RecruitHireAndWorksOrderCase[] = [
  {
    name: 'Consecrate: a Divine king with White magic hallows a province of his own',
    stage(b) {
      holds(b, b.X);
      return { hero: king(b, { skills: skilled({ white: 1 }) }), here: b.X, orders: plan(order('consecrate')) };
    },
    check(o, { here }) {
      return {
        got: {
          holy: realmOf(o, 0)['consecratedProvIds'],
          told: says(o, `✨`) && says(o, `consecrates ${here.name}! Holy ground: +50% tax`),
        },
        want: { holy: [here.id], told: true },
      };
    },
  },
  {
    name: 'Consecrate: only the king may consecrate',
    stage(b) {
      holds(b, b.X);
      return { hero: at(b, { skills: skilled({ white: 1 }) }), here: b.X, orders: plan(order('consecrate')) };
    },
    check(o) {
      return {
        got: {
          holy: realmOf(o, 0)['consecratedProvIds'] ?? [],
          refused: says(o, 'only the anointed King can consecrate ground'),
        },
        want: { holy: [], refused: true },
      };
    },
  },
  {
    name: 'Consecrate: only a Divine crown',
    stage(b) {
      holds(b, b.X);
      creed(b, 'Good');
      return { hero: king(b, { skills: skilled({ white: 1 }) }), here: b.X, orders: plan(order('consecrate')) };
    },
    check(o) {
      return {
        got: {
          holy: realmOf(o, 0)['consecratedProvIds'] ?? [],
          refused: says(o, 'the gods answer only Divine crowns'),
        },
        want: { holy: [], refused: true },
      };
    },
  },
  {
    name: 'Consecrate: only a province of the realm’s own',
    stage(b) {
      settled(b.X);
      return { hero: king(b, { skills: skilled({ white: 1 }) }), here: b.X, orders: plan(order('consecrate')) };
    },
    check(o) {
      return {
        got: {
          holy: realmOf(o, 0)['consecratedProvIds'] ?? [],
          refused: says(o, 'only a province of your own realm can be consecrated'),
        },
        want: { holy: [], refused: true },
      };
    },
  },
  {
    name: 'Consecrate: not the crown’s home, nor the lands beside it',
    stage(b) {
      holds(b, b.X);
      const home = ring1(b, 0);
      holds(b, home);
      realm(b)['homeProvinceId'] = home.id;
      return { hero: king(b, { skills: skilled({ white: 1 }) }), here: b.X, orders: plan(order('consecrate')) };
    },
    check(o) {
      return {
        got: {
          holy: realmOf(o, 0)['consecratedProvIds'] ?? [],
          refused: says(o, "the crown's own hearth was anointed at the coronation"),
        },
        want: { holy: [], refused: true },
      };
    },
  },
  {
    name: 'Consecrate: ground already holy needs no second blessing',
    stage(b) {
      holds(b, b.X);
      realm(b)['consecratedProvIds'] = [b.X.id];
      return { hero: king(b, { skills: skilled({ white: 2 }) }), here: b.X, orders: plan(order('consecrate')) };
    },
    check(o, { here }) {
      return {
        got: { holy: realmOf(o, 0)['consecratedProvIds'], refused: says(o, `${here.name} is already consecrated`) },
        want: { holy: [here.id], refused: true },
      };
    },
  },
  {
    name: 'Consecrate: two holy provinces may not lie side by side',
    stage(b) {
      holds(b, b.X);
      const there = ring1(b, 1);
      holds(b, there);
      realm(b)['consecratedProvIds'] = [there.id];
      return { hero: king(b, { skills: skilled({ white: 2 }) }), here: b.X, there, orders: plan(order('consecrate')) };
    },
    check(o, { here, there }) {
      const t = must(there, 'there');
      return {
        got: {
          holy: realmOf(o, 0)['consecratedProvIds'],
          refused: says(o, `${here.name} borders ${t.name} — two consecrated provinces may not lie side by side.`),
        },
        want: { holy: [t.id], refused: true },
      };
    },
  },
  {
    name: 'Consecrate: no White magic, no holy ground',
    stage(b) {
      holds(b, b.X);
      return { hero: king(b), here: b.X, orders: plan(order('consecrate')) };
    },
    check(o) {
      return {
        got: {
          holy: realmOf(o, 0)['consecratedProvIds'] ?? [],
          refused: says(o, 'consecration flows from the White arts'),
        },
        want: { holy: [], refused: true },
      };
    },
  },
  {
    name: 'Consecrate: as many holy provinces at once as the king’s White skill',
    stage(b) {
      holds(b, b.X);
      const there = ring2(b, 0);
      holds(b, there);
      realm(b)['consecratedProvIds'] = [there.id];
      return { hero: king(b, { skills: skilled({ white: 1 }) }), here: b.X, there, orders: plan(order('consecrate')) };
    },
    check(o, { there }) {
      const t = must(there, 'there');
      return {
        got: {
          holy: realmOf(o, 0)['consecratedProvIds'],
          refused: says(o, `your White faith can sustain only 1 consecrated province at once (${t.name}).`),
        },
        want: { holy: [t.id], refused: true },
      };
    },
  },
];

export const CALL_TO_ARMS_ORDER_CASES: RecruitHireAndWorksOrderCase[] = [
  {
    name: 'Call to Arms: the folk of a province the Good king names raise a Green garrison company, free',
    stage(b) {
      creed(b, 'Good');
      const there = ring1(b, 0);
      holds(b, there, ['Shieldwall Levies', 'Human Garrison']);
      return { hero: king(b), here: b.X, there, orders: plan(order('call_to_arms', there.id)) };
    },
    check(o, { there }) {
      const t = must(there, 'there');
      return {
        got: {
          garrison: garrison(o, t),
          told: says(
            o,
            `📯 Call to Arms! The folk of ${t.name} answer their king — a Green Human Garrison joins the province garrison`,
          ),
        },
        want: { garrison: ['Human Garrison'], told: true },
      };
    },
  },
  {
    name: 'Call to Arms: once a turn for the realm',
    stage(b) {
      creed(b, 'Good');
      const there = ring1(b, 0);
      holds(b, there, ['Human Garrison']);
      return {
        hero: king(b),
        here: b.X,
        there,
        orders: plan(order('call_to_arms', there.id), order('call_to_arms', there.id)),
      };
    },
    check(o, { there }) {
      return {
        got: {
          garrison: garrison(o, must(there, 'there')),
          refused: says(o, 'the realm has already answered one Call to Arms this turn'),
        },
        want: { garrison: ['Human Garrison'], refused: true },
      };
    },
  },
  {
    name: 'Call to Arms: a province raising no garrison company of its own raises its folk’s',
    stage(b) {
      creed(b, 'Good');
      const there = ring1(b, 0);
      holds(b, there, ['Elven Bowmen']);
      there['race'] = 'Elven';
      return { hero: king(b), here: b.X, there, orders: plan(order('call_to_arms', there.id)) };
    },
    check(o, { there }) {
      return { got: { garrison: garrison(o, must(there, 'there')) }, want: { garrison: ['Elven Garrison'] } };
    },
  },
  {
    name: 'Call to Arms: only a Good crown',
    stage(b) {
      const there = ring1(b, 0);
      holds(b, there);
      return { hero: king(b), here: b.X, there, orders: plan(order('call_to_arms', there.id)) };
    },
    check(o, { there }) {
      return {
        got: { garrison: garrison(o, must(there, 'there')), refused: says(o, 'only the folk of a Good realm rise') },
        want: { garrison: [], refused: true },
      };
    },
  },
  {
    name: 'Call to Arms: only the king’s voice carries it',
    stage(b) {
      creed(b, 'Good');
      const there = ring1(b, 0);
      holds(b, there);
      return { hero: at(b), here: b.X, there, orders: plan(order('call_to_arms', there.id)) };
    },
    check(o, { there }) {
      return {
        got: {
          garrison: garrison(o, must(there, 'there')),
          refused: says(o, "only the KING's voice carries the Call to Arms."),
        },
        want: { garrison: [], refused: true },
      };
    },
  },
  {
    name: 'Call to Arms: only in a province the realm holds',
    stage(b) {
      creed(b, 'Good');
      const there = ring1(b, 0);
      settled(there);
      return { hero: king(b), here: b.X, there, orders: plan(order('call_to_arms', there.id)) };
    },
    check(o, { there }) {
      return {
        got: {
          garrison: garrison(o, must(there, 'there')),
          refused: says(o, 'Call to Arms must name a province you control this phase.'),
        },
        want: { garrison: [], refused: true },
      };
    },
  },
  {
    name: 'Call to Arms: no villages to raise in the wild',
    stage(b) {
      creed(b, 'Good');
      const there = ring1(b, 0);
      holds(b, there);
      there['race'] = 'Primal:Bear';
      return { hero: king(b), here: b.X, there, orders: plan(order('call_to_arms', there.id)) };
    },
    check(o, { there }) {
      const t = must(there, 'there');
      return {
        got: { garrison: garrison(o, t), refused: says(o, `${t.name} has no villages to raise.`) },
        want: { garrison: [], refused: true },
      };
    },
  },
];

export const BROKER_ORDER_CASES: RecruitHireAndWorksOrderCase[] = [
  {
    name: 'Broker: a Neutral king hires a hero by courier in a province the realm has seen, where he stands',
    stage(b) {
      creed(b, 'Neutral');
      const there = ring1(b, 2);
      settled(there);
      there.visitedBy = [0];
      const h = king(b);
      const other = wanderer(b, there);
      // the Broker names a hero by his place in the list of characters (his id, in a real game)
      return {
        hero: h,
        other,
        here: b.X,
        there,
        orders: plan(order('broker', `hire:${String(b.G.characters.indexOf(other))}`)),
      };
    },
    check(o, { other, there }) {
      const w = char(o, must(other, 'the wanderer'));
      const t = must(there, 'there');
      return {
        got: {
          serves: [w.player, w['pay'], w.location],
          heroes: (realmOf(o, 0)['heroes'] as number[]).includes(w.id),
          told: says(
            o,
            `🤝 Brokered: ${w.name} (Human, Divine) in ${t.name} accepts ${realmOf(o, 0).name}'s terms by courier — 4g/turn. They may act from Early Summer onwards, from where they stand.`,
          ),
          toldHim: saysOf(o, w, '🤝 Brokered:'),
        },
        want: { serves: [0, 4, t.id], heroes: true, told: true, toldHim: true },
      };
    },
  },
  {
    name: 'Broker: a hero in a province the realm has never seen is out of the agents’ reach',
    stage(b) {
      creed(b, 'Neutral');
      const there = ring1(b, 2);
      unseen(there);
      const h = king(b);
      const other = wanderer(b, there);
      return {
        hero: h,
        other,
        here: b.X,
        there,
        orders: plan(order('broker', `hire:${String(b.G.characters.indexOf(other))}`)),
      };
    },
    check(o, { other }) {
      return {
        got: {
          player: char(o, must(other, 'the wanderer')).player,
          told: says(o, "brokers find no such hero within reach of the realm's agents."),
        },
        want: { player: null, told: true },
      };
    },
  },
  {
    name: 'Broker: a hero released from service this turn hears no offers by courier either',
    stage(b) {
      creed(b, 'Neutral');
      b.own(b.X, 0);
      const h = king(b);
      const other = wanderer(b, b.X);
      other['_releasedTurn'] = b.G.turn;
      return {
        hero: h,
        other,
        here: b.X,
        orders: plan(order('broker', `hire:${String(b.G.characters.indexOf(other))}`)),
      };
    },
    check(o, { other }) {
      return {
        got: {
          player: char(o, must(other, 'the wanderer')).player,
          told: says(o, 'was only just released from service and will hear no offers this turn.'),
        },
        want: { player: null, told: true },
      };
    },
  },
  {
    name: 'Broker: a treasury short of the wage hires no one',
    stage(b) {
      creed(b, 'Neutral');
      realm(b)['gold'] = 3;
      b.own(b.X, 0);
      const h = king(b);
      const other = wanderer(b, b.X);
      return {
        hero: h,
        other,
        here: b.X,
        orders: plan(order('broker', `hire:${String(b.G.characters.indexOf(other))}`)),
      };
    },
    check(o, { other }) {
      const w = char(o, must(other, 'the wanderer'));
      return {
        got: { player: w.player, told: says(o, `cannot afford ${w.name} — needs 4g/turn.`) },
        want: { player: null, told: true },
      };
    },
  },
  {
    name: 'Broker: word bought from a province the realm has seen, for 2g',
    stage(b) {
      creed(b, 'Neutral');
      const there = ring1(b, 3);
      there['exploredBy'] = { 0: 10 };
      return { hero: king(b), here: b.X, there, orders: plan(order('broker', `spy:${String(there.id)}`)) };
    },
    check(o, { hero: h, there }) {
      const t = must(there, 'there');
      return {
        got: {
          bought: says(o, `🤝 ${h.name}'s brokers buy word from ${t.name} (2g).`),
          spied: says(o, `spies on ${t.name}: controlled by no-one`),
        },
        want: { bought: true, spied: true },
      };
    },
  },
  {
    name: 'Broker: word only from a province the realm has seen',
    stage(b) {
      creed(b, 'Neutral');
      const there = ring1(b, 3);
      unseen(there);
      return { hero: king(b), here: b.X, there, orders: plan(order('broker', `spy:${String(there.id)}`)) };
    },
    check(o) {
      return {
        got: {
          refused: says(o, 'your brokers can only reach provinces the realm has seen.'),
          spied: says(o, 'spies on'),
        },
        want: { refused: true, spied: false },
      };
    },
  },
  {
    name: 'Broker: word costs 2g the treasury must have',
    stage(b) {
      creed(b, 'Neutral');
      realm(b)['gold'] = 1;
      b.own(b.X, 0);
      return { hero: king(b), here: b.X, orders: plan(order('broker', `spy:${String(b.X.id)}`)) };
    },
    check(o) {
      return {
        got: {
          refused: says(o, 'brokered intelligence costs 2g — the treasury cannot cover it.'),
          spied: says(o, 'spies on'),
        },
        want: { refused: true, spied: false },
      };
    },
  },
  {
    name: 'Broker: an order naming neither a hero nor a province does nothing',
    stage(b) {
      creed(b, 'Neutral');
      return { hero: king(b), here: b.X, orders: plan(order('broker')) };
    },
    check(o) {
      return {
        got: { told: says(o, 'Broker requires a target — a hero to hire or a province to buy word from.') },
        want: { told: true },
      };
    },
  },
  {
    name: 'Broker: only a Neutral crown keeps brokers',
    stage(b) {
      return { hero: king(b), here: b.X, orders: plan(order('broker', `spy:${String(b.X.id)}`)) };
    },
    check(o) {
      return {
        got: { refused: says(o, 'only a Neutral crown keeps the web of factors'), spied: says(o, 'spies on') },
        want: { refused: true, spied: false },
      };
    },
  },
  {
    name: 'Broker: only the king commands them',
    stage(b) {
      creed(b, 'Neutral');
      return { hero: at(b), here: b.X, orders: plan(order('broker', `spy:${String(b.X.id)}`)) };
    },
    check(o) {
      return {
        got: { refused: says(o, "only the KING commands the realm's brokers."), spied: says(o, 'spies on') },
        want: { refused: true, spied: false },
      };
    },
  },
];

export const REMOVED_WILD_AND_PIT_ORDER_CASES: RecruitHireAndWorksOrderCase[] = [
  {
    name: 'Awaken the Wild is no more, and is refused in plain words',
    stage(b) {
      return { hero: at(b, { skills: skilled({ druid: 5 }) }), here: b.X, orders: plan(order('awaken_wild')) };
    },
    check(o, { hero: h }) {
      return {
        got: {
          led: led(o, h),
          told: says(
            o,
            `${h.name}: Awaken the Wild is no more — Creatures and Monsters now come only by recruiting them where they live.`,
          ),
        },
        want: { led: [], told: true },
      };
    },
  },
  {
    name: 'Call from the Pit is no more, and is refused in plain words',
    stage(b) {
      creed(b, 'Evil');
      return { hero: at(b), here: b.X, orders: plan(order('call_pit')) };
    },
    check(o, { hero: h }) {
      return {
        got: { led: led(o, h), told: says(o, `${h.name}: Call from the Pit is no more`) },
        want: { led: [], told: true },
      };
    },
  },
];

/** A grave in `p` of a company of `type` and `quality`. */
const graves = (p: Province, ...gs: [string, string, string][]) => {
  p['battleGraves'] = gs.map(([type, quality, unitName]) => ({ type, quality, race: 'Human', unitName, turn: 1 }));
};
export const HARVEST_FIELD_ORDER_CASES: RecruitHireAndWorksOrderCase[] = [
  {
    name: 'Harvest the Field: an Undead realm’s carters raise the best of the dead, for 2g, no magic needed',
    stage(b) {
      creed(b, 'Undead');
      holds(b, b.X);
      graves(b.X, ['Men-at-Arms', 'Veteran', 'the Old Guard']);
      return { hero: at(b, { skills: skilled({ necromancy: 1 }) }), here: b.X, orders: plan(order('harvest_field')) };
    },
    check(o, { hero: h, here }) {
      const raised = char(o, h).armies.map((a) => [a.unitName, a.quality, a.race, a['_isSkeletal']]);
      return {
        got: {
          raised,
          graves: (province(o, here)['battleGraves'] as unknown[]).length,
          told: says(
            o,
            `💀 Harvest the Field — ${h.name}'s carters work the graves of ${here.name}: the Old Guard (Skeletal) (Veteran) rises to serve, no magic required. (2g; upkeep 1g/turn.)`,
          ),
          warned: says(o, 'will crumble to dust'),
        },
        want: {
          raised: [['the Old Guard (Skeletal)', 'Veteran', 'Undead', true]],
          graves: 0,
          told: true,
          warned: false,
        },
      };
    },
  },
  {
    name: 'Harvest the Field: a raiser with no Necromancy is warned at once',
    stage(b) {
      creed(b, 'Undead');
      holds(b, b.X);
      graves(b.X, ['Men-at-Arms', 'Average', 'the Old Guard']);
      return { hero: at(b), here: b.X, orders: plan(order('harvest_field')) };
    },
    check(o, { here }) {
      return {
        got: {
          graves: (province(o, here)['battleGraves'] as unknown[]).length,
          warned: says(
            o,
            'has no Necromancy of their own — the Old Guard (Skeletal) will crumble to dust at the end of this turn',
          ),
        },
        want: { graves: 0, warned: true },
      };
    },
  },
  {
    name: 'Harvest the Field: only an Undead realm keeps corpse-carters',
    stage(b) {
      holds(b, b.X);
      graves(b.X, ['Men-at-Arms', 'Average', 'the Old Guard']);
      return { hero: at(b, { skills: skilled({ necromancy: 1 }) }), here: b.X, orders: plan(order('harvest_field')) };
    },
    check(o, { hero: h }) {
      return {
        got: { led: led(o, h), refused: says(o, 'only Undead realms keep corpse-carters') },
        want: { led: [], refused: true },
      };
    },
  },
  {
    name: 'Harvest the Field: no battlefield dead, nothing to raise',
    stage(b) {
      creed(b, 'Undead');
      holds(b, b.X);
      return { hero: at(b, { skills: skilled({ necromancy: 1 }) }), here: b.X, orders: plan(order('harvest_field')) };
    },
    check(o, { hero: h, here }) {
      return {
        got: {
          led: led(o, h),
          told: says(o, `walks the field of ${here.name}, but there are no battlefield dead here to raise.`),
        },
        want: { led: [], told: true },
      };
    },
  },
  {
    name: 'Harvest the Field: the carters want their 2g first',
    stage(b) {
      creed(b, 'Undead');
      holds(b, b.X);
      realm(b)['gold'] = 1;
      graves(b.X, ['Men-at-Arms', 'Average', 'the Old Guard']);
      return { hero: at(b, { skills: skilled({ necromancy: 1 }) }), here: b.X, orders: plan(order('harvest_field')) };
    },
    check(o, { hero: h }) {
      return {
        got: { led: led(o, h), refused: says(o, 'want their 2g — the treasury cannot pay.') },
        want: { led: [], refused: true },
      };
    },
  },
];

export const AWAKEN_GROVE_ORDER_CASES: RecruitHireAndWorksOrderCase[] = [
  {
    name: 'Awaken Grove: in a forest of the realm’s own, Forest Ents march with the druid',
    stage(b) {
      holds(b, b.X);
      b.X.terrain = 'forest';
      return { hero: at(b, { skills: skilled({ druid: 7 }) }), here: b.X, orders: plan(order('awaken_grove')) };
    },
    check(o, { here }) {
      return {
        got: {
          told:
            says(o, `🌳`) && says(o, `awakens the grove of ${here.name} — Forest Ents tear their roots from the earth`),
        },
        want: { told: true },
      };
    },
  },
  {
    name: 'Awaken Grove: the Ents go back to their roots at the turn’s end',
    wholeTurnOnly: true,
    stage(b) {
      holds(b, b.X);
      b.X.terrain = 'forest';
      return { hero: at(b, { skills: skilled({ druid: 7 }) }), here: b.X, orders: plan(order('awaken_grove')) };
    },
    check(o, { hero: h }) {
      return { got: { led: led(o, h) }, want: { led: [] } };
    },
  },
  {
    name: 'Awaken Grove: wild land of the realm’s own wakes as well as forest',
    stage(b) {
      holds(b, b.X);
      b.X['race'] = 'Primal:Bear';
      return { hero: at(b, { skills: skilled({ druid: 7 }) }), here: b.X, orders: plan(order('awaken_grove')) };
    },
    check(o, { here }) {
      return { got: { told: says(o, `awakens the grove of ${here.name}`) }, want: { told: true } };
    },
  },
  {
    name: 'Awaken Grove: refused without the Druid mastery (7)',
    stage(b) {
      holds(b, b.X);
      b.X.terrain = 'forest';
      return { hero: at(b, { skills: skilled({ druid: 6 }) }), here: b.X, orders: plan(order('awaken_grove')) };
    },
    check(o) {
      return {
        got: { refused: says(o, 'lacks the Druid mastery (7) to Awaken a Grove.'), woke: says(o, 'awakens the grove') },
        want: { refused: true, woke: false },
      };
    },
  },
  {
    name: 'Awaken Grove: refused on open plain of the realm’s own',
    stage(b) {
      holds(b, b.X);
      return { hero: at(b, { skills: skilled({ druid: 7 }) }), here: b.X, orders: plan(order('awaken_grove')) };
    },
    check(o, { hero: h }) {
      return {
        got: {
          led: led(o, h),
          refused: says(
            o,
            'Awaken Grove works only while standing in an OWNED forest, jungle or wild (Creature or Monster) province.',
          ),
        },
        want: { led: [], refused: true },
      };
    },
  },
  {
    name: 'Awaken Grove: refused in a forest the realm does not hold',
    stage(b) {
      settled(b.X);
      b.X.terrain = 'forest';
      return { hero: at(b, { skills: skilled({ druid: 7 }) }), here: b.X, orders: plan(order('awaken_grove')) };
    },
    check(o, { hero: h }) {
      return {
        got: { led: led(o, h), refused: says(o, 'Awaken Grove works only while standing in an OWNED forest') },
        want: { led: [], refused: true },
      };
    },
  },
  {
    name: 'Awaken Grove is a mastery: once a turn, and a second is refused',
    wholeTurnOnly: true,
    stage(b) {
      holds(b, b.X);
      b.X.terrain = 'forest';
      return {
        hero: at(b, { skills: skilled({ druid: 7 }) }),
        here: b.X,
        orders: plan(order('awaken_grove'), order('awaken_grove')),
      };
    },
    check(o) {
      return {
        got: {
          woke: o.lines.filter((l) => l.text.includes('awakens the grove')).length,
          refused: says(o, 'mastery this turn'),
        },
        want: { woke: 1, refused: true },
      };
    },
  },
];

export const WILD_CALLING_ORDER_CASES: RecruitHireAndWorksOrderCase[] = [
  {
    name: 'Wild Calling: refused without the Druid mastery (9)',
    stage(b) {
      holds(b, b.X);
      return { hero: at(b, { skills: skilled({ druid: 8 }) }), here: b.X, orders: plan(order('wild_calling')) };
    },
    check(o) {
      return {
        got: { refused: says(o, 'lacks the Druid mastery (9) to sound a Wild Calling.') },
        want: { refused: true },
      };
    },
  },
  {
    name: 'Wild Calling: nothing wild stands here to answer',
    stage(b) {
      holds(b, b.X);
      const other = hero(b, { player: 1, at: b.X, troops: 3 });
      return { hero: at(b, { skills: skilled({ druid: 9 }) }), other, here: b.X, orders: plan(order('wild_calling')) };
    },
    check(o, { here }) {
      return {
        got: { told: says(o, `sounds a Wild Calling, but nothing wild stands in ${here.name} to answer it.`) },
        want: { told: true },
      };
    },
  },
  {
    name: 'Wild Calling: a wandering commander’s beasts break and follow a druid with room for one more',
    stage(b) {
      holds(b, b.X);
      const h = at(b, { skills: skilled({ druid: 9 }) });
      h.armies = companies(8, 'Great Bears');
      const other = hero(b, { player: null, at: b.X });
      other.armies = companies(30, 'Great Bears', 'Average', 'Primal');
      return { hero: h, other, here: b.X, orders: plan(order('wild_calling')) };
    },
    check(o, { hero: h, other, here }) {
      const w = must(other, 'the enemy');
      return {
        got: {
          led: [char(o, h).armies.length, char(o, w).armies.length],
          pacified: char(o, h).armies.filter((a) => a['_pacified']).length,
          told:
            says(o, `🐾`) &&
            says(
              o,
              `sounds a Wild Calling in ${here.name} — 1 of 30 wild creatures answer and fall in behind your banner (torn from ${w.name})!`,
            ),
        },
        want: { led: [9, 29], pacified: 1, told: true },
      };
    },
  },
  {
    name: 'Wild Calling: never from the realm’s own commanders, nor from a realm it is not at war with; and men are deaf to it',
    stage(b) {
      holds(b, b.X);
      const own = hero(b, { player: 0, at: b.X });
      own.armies = companies(3, 'Great Bears');
      const ally = hero(b, { player: 2, at: b.X });
      ally.armies = companies(3, 'Great Bears');
      const foe = hero(b, { player: 1, at: b.X, troops: 3 });
      return {
        hero: at(b, { skills: skilled({ druid: 9 }) }),
        other: foe,
        here: b.X,
        orders: plan(order('wild_calling')),
      };
    },
    check(o, { here }) {
      return {
        got: { told: says(o, `nothing wild stands in ${here.name} to answer it.`) },
        want: { told: true },
      };
    },
  },
];

export const GRAND_DESIGN_ORDER_CASES: RecruitHireAndWorksOrderCase[] = [
  {
    name: 'Grand Design: a Sage of 9 raises his realm’s Wonder where he stands',
    stage(b) {
      holds(b, b.X);
      return { hero: at(b, { skills: skilled({ sage: 9 }) }), here: b.X, orders: plan(order('grand_design')) };
    },
    check(o, { here }) {
      const r = realmOf(o, 0);
      const gd = (province(o, here)['grandDesign'] ?? {}) as Record<string, unknown>;
      return {
        got: {
          wonder: [gd['owner'], gd['name'], gd['alignment'], gd['builtTurn']],
          realm: [r['gdProvinceId'], r['gdName'], ((r['discoveries'] ?? []) as { id: string }[]).map((d) => d.id)],
          told:
            says(o, `🏗`) &&
            says(
              o,
              `completes ${r.name}'s Grand Design — the Grand Cathedral, a Wonder of the age, raised in ${here.name}!`,
            ),
        },
        want: {
          wonder: [0, 'Grand Cathedral', 'Divine', o.turn],
          realm: [here.id, 'Grand Cathedral', ['gd']],
          told: true,
        },
      };
    },
  },
  {
    name: 'Grand Design: refused without the Sage mastery (9)',
    stage(b) {
      holds(b, b.X);
      return { hero: at(b, { skills: skilled({ sage: 8 }) }), here: b.X, orders: plan(order('grand_design')) };
    },
    check(o, { here }) {
      return {
        got: {
          wonder: province(o, here)['grandDesign'] ?? null,
          refused: says(o, 'lacks the Sage mastery (9) to realise a Grand Design.'),
        },
        want: { wonder: null, refused: true },
      };
    },
  },
  {
    name: 'Grand Design: there can be only one',
    stage(b) {
      holds(b, b.X);
      realm(b)['discoveries'] = [{ id: 'gd' }];
      return { hero: at(b, { skills: skilled({ sage: 9 }) }), here: b.X, orders: plan(order('grand_design')) };
    },
    check(o, { here }) {
      return {
        got: {
          wonder: province(o, here)['grandDesign'] ?? null,
          refused: says(o, 'has already completed its Grand Design — there can be only one.'),
        },
        want: { wonder: null, refused: true },
      };
    },
  },
];

/** Makes the realms plain: the bot world's realms differ from seed to seed (creed, folk, discoveries, treasury, home),
 *  so each becomes Divine, Human, with no discoveries and 20g, and its home is away from the middle (a province of its
 *  own there, or, if the board took them all, the first province beyond the middle). A case then stages what it needs. */
export const plainRealms = (b: Board) => {
  const beyond = must(
    b.G.world.provinces.find((p) => !b.near.includes(p)),
    'a province beyond the middle',
  );
  b.G.players.forEach((pl) => {
    Object.assign(pl, { alignment: 'Divine', race: 'Human', discoveries: [], gold: 20 });
    pl['homeProvinceId'] = pl.provinces[0] ?? beyond.id;
  });
};
/** Stages `c` on `b`, from plain realms. */
export const stageCase = (b: Board, c: RecruitHireAndWorksOrderCase): Staged => {
  plainRealms(b);
  return c.stage(b);
};

/** Every case, by order. */
export const RECRUIT_HIRE_AND_WORKS_ORDER_CASES: [string, RecruitHireAndWorksOrderCase[]][] = [
  ['recruit', RECRUIT_ORDER_CASES],
  ['hire', HIRE_ORDER_CASES],
  ['consecrate', CONSECRATE_ORDER_CASES],
  ['call_to_arms', CALL_TO_ARMS_ORDER_CASES],
  ['broker', BROKER_ORDER_CASES],
  ['awaken_wild and call_pit', REMOVED_WILD_AND_PIT_ORDER_CASES],
  ['harvest_field', HARVEST_FIELD_ORDER_CASES],
  ['awaken_grove', AWAKEN_GROVE_ORDER_CASES],
  ['wild_calling', WILD_CALLING_ORDER_CASES],
  ['grand_design', GRAND_DESIGN_ORDER_CASES],
];
