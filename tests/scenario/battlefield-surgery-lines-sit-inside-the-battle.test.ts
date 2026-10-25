// 2026-10-13 (item 19): Battlefield Surgery's lines sit where they belong and say what happened. A hero who loses the
// single combat before a battle and is saved by the surgeons reads "falls in the duel — at death's door, but not
// slain", with the surgery line straight after it, both inside that battle's report (before, the surgery line came
// ahead of the whole battle report and the duel still said "is slain"). A hero the surgeons cannot save reads "is slain
// in the duel!", then "too late", in his own realm's report only.
//
// Level 2 (scenario): the duel and the death happen only inside a turn, played on the engine's modules
// (tests/lib/a-staged-turn-on-the-engines-modules.ts, plan P1-14a), on a world made from KC_SEED. The call sites of the
// other deaths are read without a turn: tests/static/every-hero-death-is-resolved-before-slain-is-written.test.ts.
//
// The staging is certain on every world: the hero (1 HP, no skill, no items) has the temper with no second wind and
// no urge to break off ('None'), and the chieftain is chosen and set by the staging: a neutral guard standing alone in
// a free land province beside a land province, where the hero is put; strong (60 HP, Melee 5, no items) and Brave,
// with five melee tactics. So the hero loses the duel and dies. The surgery roll is the chosen one: a stand-in on
// handleHeroDeath (called from pre-battle-duels.ts) makes the next percentile roll (d100, called from handleHeroDeath's
// file) the chosen one, and the surgery roll is the first it makes. Each stand-in is on the module that exports the
// function, and reaches calls from other files only (docs/traps.md); the two tests need opposite rolls on the same
// world, so both pass only when the stand-in decides it.
//
// Until plan P1-14a this was tests/surgery-lines.test.js, played in the engine's vm on seed 1 only. On seeds 1 to 40
// it failed on 22 and 28: its hero (Brave) didn't die in the duel (on seed 22 he found his second wind, then broke it
// off).
import { describe, expect, test, vi } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan, type Line } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;

interface Character {
  id: number;
  name: string;
  player: number | null;
  alive?: boolean;
  isKing?: boolean;
  location?: number;
  locationName?: string;
  _isNeutralGuard?: boolean;
  armies?: unknown[];
  items?: unknown[];
  temper?: string;
  skills?: Record<string, number>;
  hp?: number;
  maxHp?: number;
  encounterPlan?: { tactics: string[]; duelStance: string };
}
interface Province {
  id: number;
  row: number;
  col: number;
  name: string;
  terrain: string;
  owner?: number | null;
  characters?: number[];
}
interface Staged {
  turn: number;
  characters: Character[];
  players: { discoveries?: unknown[] }[];
  world: { cols: number; rows: number; provinces: Province[] };
}
interface Discovery {
  id: string;
  name: string;
  category: string;
  desc: string;
}

/** One turn in which the hero loses the duel before a battle and dies, the surgery roll being `surgeryRoll`. */
async function aDuelLostToAChieftain(surgeryRoll: number) {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  const dice = await import('../../src/engine/dice-and-army-names.ts');
  const deaths = await import('../../src/engine/heroes/hero-death-and-leaderless-hosts.ts');
  const { getNeighborsP } = await import('../../src/engine/world/map-helpers.ts');
  const { SAGE_DISCOVERIES_P } = await import('../../src/content/kingdoms-call-data.ts');

  // The surgery roll: handleHeroDeath makes no other roll before it, and a roll it doesn't make is not kept.
  let next: number | null = null;
  const d100 = dice.d100;
  vi.spyOn(dice, 'd100').mockImplementation(() => {
    if (next == null) return d100();
    const roll = next;
    next = null;
    return roll;
  });
  const handleHeroDeath = deaths.handleHeroDeath;
  vi.spyOn(deaths, 'handleHeroDeath').mockImplementation((...args: Parameters<typeof handleHeroDeath>) => {
    next = surgeryRoll;
    try {
      return handleHeroDeath(...args) as boolean;
    } finally {
      next = null;
    }
  });

  const surgery = (SAGE_DISCOVERIES_P as Discovery[]).find((d) => d.id === 'sd36');
  const neighbours = (S: Staged, p: Province) =>
    (getNeighborsP(p, S.world.cols, S.world.rows, S.world.provinces) as (Province | undefined)[]).filter(
      (q): q is Province => q != null,
    );
  const place = (S: Staged, c: Character, p: Province) => {
    S.world.provinces.forEach((q) => {
      q.characters = (q.characters ?? []).filter((id) => id !== c.id);
    });
    p.characters = [...(p.characters ?? []), c.id];
    c.location = p.id;
    c.locationName = p.name;
  };
  const r = sc.turn<Staged, { H: Character; N: Province; chieftain: Character }>({
    cols: 10,
    rows: 6,
    seaPct: 10,
    prepare(S) {
      if (!surgery) throw new Error('Battlefield Surgery is not in the discovery table');
      const H = S.characters.find((c) => c.alive && c.player === 0 && !c.isKing);
      // The chieftain: a neutral guard alone in a free land province, beside a land province, where the hero is put.
      let chieftain: Character | undefined, N: Province | undefined, P: Province | undefined;
      for (const g of S.characters.filter(
        (c) => c.player == null && c.alive && c._isNeutralGuard && c.armies?.length,
      )) {
        const q = g.location == null ? undefined : S.world.provinces[g.location];
        if (!q || q.terrain === 'sea' || q.owner != null || (q.characters ?? []).some((id) => id !== g.id)) continue;
        const p = neighbours(S, q).find((y) => y.terrain !== 'sea' && y.id !== q.id);
        if (!p) continue;
        chieftain = g;
        N = q;
        P = p;
        break;
      }
      if (!H || !chieftain || !N || !P) throw new Error('could not stage: no hero, or no chieftain to stage');
      S.players[0] = {
        ...S.players[0],
        discoveries: [
          ...(S.players[0]?.discoveries ?? []),
          { id: surgery.id, name: surgery.name, category: surgery.category, desc: surgery.desc, turnDiscovered: 0 },
        ],
      };
      place(S, H, P);
      H.items = [];
      H.temper = 'None'; // no second wind, and no urge to break off the duel
      H.skills = { ...H.skills, melee: 0, archery: 0 };
      H.hp = 1;
      H.maxHp = 20;
      H.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'challenge' };
      chieftain.temper = 'Brave';
      chieftain.items = [];
      chieftain.skills = { melee: 5, archery: 0 };
      chieftain.hp = chieftain.maxHp = 60;
      chieftain.encounterPlan = { tactics: ['ME', 'ME', 'ME', 'ME', 'ME'], duelStance: 'challenge' };
      H.armies = ['the Red Hand', 'the Grey Company', 'the Oak Shields'].map((unitName) => ({
        type: 'Men-at-Arms',
        quality: 'Elite',
        unitName,
      }));
      return { H, N, chieftain };
    },
    orders: (_S, x) => ({ [x.H.id]: plan(order('move', x.N.id)) }),
  });
  return { ...r, H: r.extra.H, chieftain: r.extra.chieftain };
}

const textOf = (e: Line) => e.text ?? '';
/** The lines of a realm's built report. */
const reportLines = (report: Record<string, unknown> | undefined) =>
  ((report?.['lastTurnLog'] ?? []) as Line[]).map(textOf);

describe("Battlefield Surgery's lines sit inside the battle", () => {
  test('a hero the surgeons save falls in the duel at death’s door, and the surgery line follows inside the battle', async () => {
    const { H, chieftain, log: L, S2 } = await aDuelLostToAChieftain(1);
    expect(
      L.some(
        (e) => textOf(e).includes('Personal duel:') && textOf(e).includes(H.name) && textOf(e).includes(chieftain.name),
      ),
      'the hero fights the chieftain in single combat before the battle',
    ).toBe(true);
    const after = (S2['characters'] as Character[]).find((c) => c.id === H.id);
    expect(after?.alive, 'Battlefield Surgery keeps the hero alive').not.toBe(false);
    expect(after, 'the hero is still in the world').toBeDefined();
    const fall = L.findIndex((e) =>
      textOf(e).includes(`${H.name} falls in the duel — at death's door, but not slain.`),
    );
    const surgery = L.findIndex(
      (e) =>
        /Battlefield Surgery: .* is dragged from the field at death's door/.test(textOf(e)) &&
        textOf(e).includes(H.name),
    );
    expect(fall, "the duel says the hero fell at death's door, not slain").toBeGreaterThanOrEqual(0);
    expect(
      L.some((e) => textOf(e).includes(`${H.name} is slain in the duel`)),
      'no line says the hero was slain',
    ).toBe(false);
    expect(surgery, 'the surgery line comes straight after it').toBe(fall + 1);
    const battleId = L[fall]?.['battleId'];
    expect(battleId, 'the fall is part of a battle').not.toBeUndefined();
    expect(battleId, 'the fall is part of a battle').not.toBeNull();
    expect(L[surgery]?.['battleId'], "both lines are part of that battle's report").toBe(battleId);
    const first = L.findIndex((e) => e['battleId'] != null && e['battleId'] === battleId);
    expect(first, 'the battle report starts somewhere').toBeGreaterThanOrEqual(0);
    expect(surgery, 'the surgery line no longer comes before the battle report').toBeGreaterThan(first);
    expect(
      L.some((e) => textOf(e).includes('borne from the field alive')),
      'the old "borne from the field alive — barely" line is gone (the surgery line says it)',
    ).toBe(false);
  });

  test('a hero the surgeons cannot save is slain in the duel, and "too late" follows, in his own realm’s report only', async () => {
    const { H, log: L, reports } = await aDuelLostToAChieftain(100);
    const slain = L.findIndex((e) => textOf(e).includes(`${H.name} is slain in the duel!`));
    const tooLate = L.findIndex(
      (e) => /Battlefield Surgery: the surgeons reach .* too late/.test(textOf(e)) && textOf(e).includes(H.name),
    );
    expect(slain, 'a hero the surgeons cannot save is slain in the duel').toBeGreaterThanOrEqual(0);
    expect(tooLate, '"too late" comes straight after').toBe(slain + 1);
    expect(L[tooLate]?.['battleId'], "…inside the battle's report").not.toBeUndefined();
    expect(L[tooLate]?.['battleId'], "…inside the battle's report").not.toBeNull();
    expect(L[tooLate]?.['battleId'], "…inside the battle's report").toBe(L[slain]?.['battleId']);
    // …and only the hero's own realm reads it: in each realm's report as built.
    const line = textOf(L[tooLate] ?? {});
    const realms = Object.keys(reports).map(Number);
    expect(realms, 'every realm has a report').toEqual([0, 1]);
    expect(reportLines(reports[0]), "the hero's own realm reads it").toContain(line);
    for (const realm of realms.filter((x) => x !== 0)) {
      expect(reportLines(reports[realm]).length, `realm ${String(realm)}'s report has lines`).toBeGreaterThan(0);
      expect(reportLines(reports[realm]), `realm ${String(realm)} doesn't read it`).not.toContain(line);
    }
    // No other realm fights in this battle, so the reports can't show the line left shared with the battle's other
    // side: the line itself says it is the hero's realm's alone (as the old script checked), until a case with another
    // realm in the battle replaces this.
    expect(L[tooLate]?.['targets'], "…its line is for the hero's realm alone").toEqual([0]);
    expect(L[tooLate]?.['public'], '…and not public').toBeFalsy();
  });
});
