// A line written for the GM alone reaches no realm (plan P1-23, entry 7). When a realm works the Philosopher's Stone,
// the turn strikes every copy still lying undiscovered in a lair's hoard from the world, and writes the GM a note of
// how many it struck. That note is the GM's alone: its audience grants no realm, and it is about no hero, so no realm's
// report holds it, the working realm's included. The realm still reads its own account of the working, and the GM's
// log still holds the note.
//
// Level 2 (scenario): who reads a line is decided twice, by the order that writes it (its audience and the hero it is
// filed under) and by the views that build each realm's report from the GM's log; only a whole turn, with its
// reports, joins the two. A lower level could check the line's audience alone, but not that no report shows it.
//
// The staging is certain on every world: realm 0's king carries the Stone as an older save holds it (the one a lair
// deals today is called a passive item) and leads one Green company (so the working has something to promote), one province's lair, already stocked, holds the world's one other Stone, and no other
// hoard holds one. Working the Stone rolls no die but a Sage lesson, which the test doesn't read.
import { describe, expect, test } from 'vitest';
import { aStagedTurnOnTheEnginesModules, order, plan } from '../lib/a-staged-turn-on-the-engines-modules.ts';

const SEED = Number(process.env['KC_SEED']) >>> 0 || 1;
const STONE = "Philosopher's Stone";

interface Item {
  name: string;
  [key: string]: unknown;
}
interface Character {
  id: number;
  player: number | null;
  alive?: boolean;
  isKing?: boolean;
  location?: number;
  items?: Item[];
  armies?: unknown[];
}
interface Feature {
  type?: string;
  hoardItems?: Item[];
  [key: string]: unknown;
}
interface Province {
  id: number;
  terrain: string;
  features?: Feature[];
}
interface Staged {
  characters: Character[];
  world: { provinces: Province[] };
  _awardedItems?: string[];
}

async function aTurnInWhichRealm0WorksTheStone() {
  const sc = await aStagedTurnOnTheEnginesModules({ seed: SEED });
  sc.reportEveryRealm();
  // the Stone as an older save holds it: the one a lair deals today can't be worked (STATUS, Parked), and the note is
  // written only once one is
  const stone = (id: number): Item => ({ name: STONE, id, tier: 3, effect: { stat: 'massPromote', bonus: 1 } });
  return sc.turn<Staged, { king: Character }>({
    realms: 2,
    prepare(S) {
      const king = S.characters.find((c) => c.alive && c.player === 0 && c.isKing);
      if (!king) throw new Error('realm 0 has no king');
      king.items = [stone(7101)];
      king.armies = [{ type: 'Men-at-Arms', quality: 'Green', race: 'Human', unitName: 'Test Company' }];
      // no other Stone in the world: none in any hoard, none on the ledger of items already won
      S.world.provinces.forEach((p) => {
        (p.features ?? []).forEach((f) => {
          if (f.hoardItems) f.hoardItems = f.hoardItems.filter((i) => i.name !== STONE);
        });
      });
      S._awardedItems = (S._awardedItems ?? []).filter((n) => n !== STONE);
      // one lair, already stocked (the turn's start deals a fresh hoard to one that isn't), holding the other Stone
      const barrow = S.world.provinces.find((p) => p.terrain !== 'sea' && p.id !== king.location);
      if (!barrow) throw new Error('no land province for the barrow');
      barrow.features = [
        { type: 'lair', name: 'Test Barrow', cleared: false, _hoardV2: true, hoardItems: [stone(7102)] },
      ];
      return { king };
    },
    orders: (_S, { king }) => ({ [king.id]: plan(order('use_item', STONE)) }),
  });
}

describe('a line for the GM alone reaches no realm', () => {
  test("the GM's note of the Stones struck from the hoards is in the GM's log and in no realm's report", async () => {
    const r = await aTurnInWhichRealm0WorksTheStone();
    const note = "undiscovered Philosopher's Stone was struck from the world's lair hoards";
    const reportOf = (realm: number) => JSON.stringify(r.reports[realm] ?? null);
    expect({
      // the turn got there: the GM's log has the note, and the working realm read its own account of the working
      inTheGmsLog: r.log.some((l) => (l.text ?? '').includes(note)),
      realm0ReadTheWorking: reportOf(0).includes(`invokes the ${STONE}`),
      realm1HasAReport: r.reports[1] != null,
      // and no realm read the note
      inRealm0sReport: reportOf(0).includes(note),
      inRealm1sReport: reportOf(1).includes(note),
    }).toEqual({
      inTheGmsLog: true,
      realm0ReadTheWorking: true,
      realm1HasAReport: true,
      inRealm0sReport: false,
      inRealm1sReport: false,
    });
  });
});
