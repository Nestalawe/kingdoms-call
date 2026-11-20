// What a newly made world deals its lairs and its neutral provinces, read with the rules' own functions, written once
// for two kinds of test:
//   - the simulation tests run it on worlds the engine's modules made, with the modules' functions
//     (tests/simulation/no-two-lairs-near-each-other-hold-an-item-with-the-same-effect-on-any-map-size.test.ts and
//     tests/simulation/every-neutral-province-fields-the-most-effective-mix-of-its-own-units-on-any-map-size.test.ts);
//   - the GM page test runs it on one world the page made, with the page's own functions, the last calls a test makes
//     to those names (tests/page/the-gm-pages-own-lair-names-item-effects-province-units-and-neutral-armies-keep-their-rules.test.ts).
// Each function returns what it found; the test says what must hold. Until plan P1-14z these were the world checks of
// tests/lair-effects-spread.test.js and tests/neutral-best-mix.test.js, on the booted GM page; each is kept as it was.

/** An item as the checks read it. */
export interface AnItem {
  name: string;
  tier?: number;
  effect?: unknown;
}
/** A unit as the checks read it. */
export interface AUnit {
  type: string;
  quality?: string | undefined;
  race?: string | undefined;
}
/** A feature of a province: a lair (with a guardian), or a ritual site. */
export interface AFeature {
  name: string;
  ritualSite?: boolean;
  monster?: { name: string; power: string } | null;
  hoardItems?: AnItem[];
}
/** A province as the checks read it. */
export interface AProvince {
  id: number;
  name: string;
  row: number;
  col: number;
  terrain: string;
  race?: string;
  tax?: number;
  owner?: number | null;
  features?: (AFeature | null)[];
  armyTypes?: string[];
  neutralDefenders?: AUnit[];
}
/** A character as the checks read it. */
export interface ACharacter {
  player?: number | null;
  location?: number;
  armies?: AUnit[];
}
/** A newly made world as the checks read it. */
export interface ANewWorld {
  characters: (ACharacter | null)[];
  world: { provinces: (AProvince | null)[] };
}

/** The rules' functions the lair items' checks read. */
export interface TheLairItemRules {
  lairItemTier(power: string): number;
  hexDistP(a: { row: number; col: number }, b: { row: number; col: number }, cols: number): number;
}
/** The rules' functions the neutral armies' checks read, and the sea's units (KC_UNIT_CLASS.sea). */
export interface TheNeutralArmyRules {
  seaUnits: readonly string[];
  neutralDefBand(tax: number): readonly number[];
  botBattleForce(
    G: { players: never[]; turn: number },
    c: null,
    armies: readonly AUnit[],
    terrain: string,
    opts: { defending: boolean },
  ): number;
}

/** The test's own "same effect": the effect alone, whatever the slot or tier (an item with none, its name). */
const theEffectOf = (it: AnItem) => JSON.stringify(it.effect ?? { name: it.name });

/** Every lair's item on a `cols`-wide world: how many lairs hold exactly one, how many don't, how many hold one not of
 *  their guardian's tier, and each pair of lairs within `spread` provinces holding the same effect. */
export function theLairsItems(S: ANewWorld, cols: number, spread: number, rules: TheLairItemRules) {
  const lairs: { p: AProvince; it: AnItem }[] = [];
  let wrongTier = 0;
  let notOne = 0;
  for (const p of S.world.provinces) {
    if (!p) continue;
    for (const f of p.features ?? []) {
      if (!f || f.ritualSite === true || !f.monster) continue;
      const items = f.hoardItems ?? [];
      const it = items[0];
      if (items.length !== 1 || !it) {
        notOne++;
        continue;
      }
      if (it.tier !== rules.lairItemTier(f.monster.power)) wrongTier++;
      lairs.push({ p, it });
    }
  }
  const close: string[] = [];
  lairs.forEach((a, i) => {
    for (const b of lairs.slice(i + 1)) {
      if (theEffectOf(a.it) !== theEffectOf(b.it)) continue;
      const apart = rules.hexDistP(a.p, b.p, cols);
      if (apart <= spread) close.push(`${a.it.name} / ${b.it.name} (${String(apart)} apart)`);
    }
  });
  return { lairs: lairs.length, notOne, wrongTier, close };
}

/** Every neutral humanoid province: how many with a choice of two or more land units were scored, how many of those
 *  field more than one type, and each one that fields a weaker mix than its best, a number of units outside its wealth
 *  band, a unit it doesn't offer (a garrison or a ship among them), or a guard not leading exactly its units. "Best" is
 *  the test's own: every mix of the province's land units, of its defenders' qualities, scored by botBattleForce. */
export function theNeutralArmies(S: ANewWorld, rules: TheNeutralArmyRules) {
  const sea = new Set(rules.seaUnits);
  const landTypes = (p: AProvince) => [
    ...new Set((p.armyTypes ?? []).filter((t) => !/garrison/i.test(t) && !sea.has(t))),
  ];
  const force = (armies: readonly AUnit[], terrain: string) =>
    rules.botBattleForce({ players: [], turn: -2 }, null, armies, terrain, { defending: true });
  const bestScore = (types: readonly string[], quals: readonly string[], terrain: string, race: string | undefined) => {
    let best = -1;
    const pick: string[] = [];
    const walk = (from: number) => {
      if (pick.length === quals.length) {
        const armies = pick.map((type, i) => ({ type, quality: quals[i], race }));
        best = Math.max(best, force(armies, terrain));
        return;
      }
      for (let i = from; i < types.length; i++) {
        pick.push(types[i] ?? '');
        walk(i);
        pick.pop();
      }
    };
    walk(0);
    return best;
  };
  const sortedTypes = (units: readonly AUnit[]) => JSON.stringify(units.map((a) => a.type).sort());
  let checked = 0;
  let mixed = 0;
  const weak: string[] = [];
  const band: string[] = [];
  const foreign: string[] = [];
  const guard: string[] = [];
  for (const p of S.world.provinces) {
    if (!p || p.owner != null || p.terrain === 'sea' || (p.race ?? '').startsWith('Primal')) continue;
    const defs = p.neutralDefenders ?? [];
    const types = landTypes(p);
    const [lo = 0, hi = 0] = rules.neutralDefBand(p.tax ?? 0);
    if (defs.length < lo || defs.length > hi) band.push(`${p.name}: ${String(defs.length)} at tax ${String(p.tax)}`);
    if (defs.some((x) => !types.includes(x.type))) foreign.push(`${p.name}: ${defs.map((x) => x.type).join(', ')}`);
    const g = S.characters.find((c) => c?.player == null && c?.location === p.id && (c.armies ?? []).length > 0);
    if (!g || sortedTypes(g.armies ?? []) !== sortedTypes(defs)) guard.push(p.name);
    const first = defs[0];
    if (types.length < 2 || !first) continue;
    checked++;
    if (new Set(defs.map((x) => x.type)).size > 1) mixed++;
    const quals = defs.map((x) => (x.quality === undefined || x.quality === '' ? 'Average' : x.quality));
    const have = force(
      defs.map((x) => ({ type: x.type, quality: x.quality, race: x.race })),
      p.terrain,
    );
    const best = bestScore(types, quals, p.terrain, first.race);
    if (have < best - 1e-6)
      weak.push(
        `${p.name} (${p.terrain}): ${defs.map((x) => x.type).join(' + ')} scores ${have.toFixed(1)}, best ${best.toFixed(1)}`,
      );
  }
  return { checked, mixed, weak, band, foreign, guard };
}
