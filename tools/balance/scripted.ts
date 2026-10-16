// The scripted realm (plan P1-02, Decisions): in 12 of the matrix's games one realm is held by the runner, which writes
// its orders each turn from the saved state, with no randomness of its own. It does what bots never do, so the matrix
// reaches those rules:
// - it is at war with its nearest neighbour (a chase between realms at peace passes without a fight);
// - one character alternates Encounter and Pursue against the nearest enemy: the king while it leads an army, or else
//   the first hero. An armed chaser is what meets a battle on the way: a hero without an army is never held by one;
// - any other armed hero pursues the nearest quarry standing in a province with an unresolved battle;
// - its other characters defend, and its king, when it isn't chasing, recruits one unit where it stands.
// It also gives the matrix a per-realm report to hash: all-bot games write none.

/** The parts of a saved game state the script reads. */
export interface State {
  world: { cols: number; provinces: Province[] };
  players: { provinces?: number[]; homeProvinceId?: number; _encountered?: number[] }[];
  characters: Character[];
  relations?: Record<string, string>;
}
export interface Province {
  id: number;
  row: number;
  col: number;
  owner: number | null;
  terrain: string;
  armyTypes?: string[];
  _battleUnresolved?: boolean;
}
export interface Character {
  id: number;
  player: number | null;
  alive: boolean;
  isKing?: boolean;
  location: number;
  armies?: unknown[];
}

export interface PhaseOrder {
  action: string;
  target: string;
  extra: string;
  desc: string;
}
/** What the player portal submits: one realm's orders for one turn. */
export interface Orders {
  orders: Record<string, PhaseOrder[]>;
  encounterPlans: Record<string, never>;
  forTurn: number;
  diplomacy: Record<string, 'enemy'>;
}
/** Which scripted orders were given this turn, by the hero that got them: for counting the scripted cases. */
export interface Plan {
  chaser: { heroId: number; quarryId: number; action: 'encounter' | 'pursue' } | null;
  battleChases: { heroId: number; quarryId: number; provinceId: number }[];
}

const PHASES = 5;
const order = (action: string, desc: string, target = ''): PhaseOrder => ({ action, target, extra: '', desc });
const defend = (): PhaseOrder => order('defend', 'Defend');

/** Hex distance with the map's east-west wrap (the GM portal's hexDistP). */
export function hexDistance(a: Province, b: Province, cols: number): number {
  let dc = Math.abs(a.col - b.col);
  dc = Math.min(dc, cols - dc);
  const dr = Math.abs(a.row - b.row);
  return Math.max(dc, dr, (dc + dr) >> 1);
}

const relKey = (a: number, b: number) => (a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`);
const armed = (c: Character) => (c.armies ?? []).length > 0;

/** The nearest of `items` to province `from`, ties to the lowest id; null if there are none. */
function nearest<T extends { id: number }>(S: State, from: number, items: T[], where: (x: T) => number): T | null {
  const p = S.world.provinces;
  const here = p[from];
  if (!here) return null;
  let best: T | null = null;
  let bestD = Infinity;
  for (const x of [...items].sort((a, b) => a.id - b.id)) {
    const there = p[where(x)];
    if (!there) continue;
    const d = hexDistance(here, there, S.world.cols);
    if (d < bestD) {
      best = x;
      bestD = d;
    }
  }
  return best;
}

/** The realm whose land is nearest the scripted king (or its home, once the king is gone); null if none is left. */
export function nearestNeighbour(S: State, me: number): number | null {
  const king = S.characters.find((c) => c.alive && c.player === me && c.isKing);
  const from = king ? king.location : S.players[me]?.homeProvinceId;
  if (from == null) return null;
  const land = S.world.provinces.filter((p) => p.owner != null && p.owner !== me && p.terrain !== 'sea');
  const hit = nearest(S, from, land, (p) => p.id);
  return hit ? hit.owner : null;
}

/** The scripted realm's orders for `turn`, the turn about to run (the game row's `turn`: orders for any other turn are
 *  dropped as stale), and which scripted orders it gave. */
export function scriptedOrders(S: State, me: number, turn: number): { orders: Orders; plan: Plan } {
  const mine = S.characters.filter((c) => c.alive && c.player === me).sort((a, b) => a.id - b.id);
  const atWar = (pi: number | null) => pi != null && pi !== me && S.relations?.[relKey(me, pi)] === 'enemy';
  const orders: Record<string, PhaseOrder[]> = {};
  const used = new Set<number>();
  const plan: Plan = { chaser: null, battleChases: [] };

  // The chaser hunts the nearest enemy: Encounter on odd turns, Pursue on even ones. Only a king may run down a king.
  const chaser = mine.find((c) => c.isKing && armed(c)) ?? mine.find((c) => !c.isKing);
  const enemies = S.characters.filter((q) => q.alive && (chaser?.isKing || !q.isKing) && atWar(q.player));
  const quarry = chaser ? nearest(S, chaser.location, enemies, (x) => x.location) : null;
  if (chaser && quarry) {
    const action = turn % 2 ? 'encounter' : 'pursue';
    orders[String(chaser.id)] = [
      order(action, action === 'encounter' ? 'Encounter' : 'Pursue', String(quarry.id)),
      ...Array.from({ length: PHASES - 1 }, defend),
    ];
    used.add(chaser.id);
    plan.chaser = { heroId: chaser.id, quarryId: quarry.id, action };
  }

  // Every other armed hero runs down the nearest armed quarry standing in a province whose battle is unresolved: an
  // enemy's, or a neutral one. Only a king may run down a king.
  const fields = new Set(S.world.provinces.filter((p) => p._battleUnresolved).map((p) => p.id));
  const quarries = S.characters.filter(
    (q) => q.alive && armed(q) && (q.player == null || atWar(q.player)) && fields.has(q.location),
  );
  for (const hero of mine.filter((c) => armed(c) && !used.has(c.id))) {
    const q = nearest(
      S,
      hero.location,
      quarries.filter((x) => hero.isKing || !x.isKing),
      (x) => x.location,
    );
    if (!q) continue;
    orders[String(hero.id)] = [order('pursue', 'Pursue', String(q.id)), ...Array.from({ length: PHASES - 1 }, defend)];
    used.add(hero.id);
    plan.battleChases.push({ heroId: hero.id, quarryId: q.id, provinceId: q.location });
  }

  // The king recruits one unit of the first kind its province offers, if it stands on its own land; then everyone
  // else defends.
  for (const c of mine) {
    if (used.has(c.id)) continue;
    const p = S.world.provinces[c.location];
    const kind = p?.owner === me ? p.armyTypes?.[0] : undefined;
    orders[String(c.id)] =
      c.isKing && kind
        ? [order('recruit', 'Recruit 1 unit', kind + '|1'), ...Array.from({ length: PHASES - 1 }, defend)]
        : Array.from({ length: PHASES }, defend);
  }

  const foe = nearestNeighbour(S, me);
  return {
    orders: {
      orders,
      encounterPlans: {},
      forTurn: turn,
      diplomacy: foe == null ? {} : { [String(foe)]: 'enemy' },
    },
    plan,
  };
}
