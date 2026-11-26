// R-140: Messenger Birds is retired for now. Its warnings need eyes in the province, so it does nothing; no realm is
// offered it again, and a realm that already holds it keeps it in its records (it did nothing before, and does nothing
// now). Its row in the discoveries' table is marked `retired`; every way a realm gains a discovery (Research and a
// Research Breakthrough through discAvailableFor, the Grand Library, a spy's theft) asks discEligible, which refuses a
// retired row. Here:
// - its row is the one retired, and no realm of any race or creed the table names is eligible for it;
// - for every such realm knowing nothing yet, the pool Research and a Breakthrough draw from holds every other
//   discovery open to it, and not Messenger Birds;
// - a running game's save: a realm that holds it, with a pair from last turn's Research offering it, keeps it through
//   the save's upgrade (retireDiscoveries strikes only the ids removed from the table), and the pair is left as found.
// A Research order that can't miss, in the field that holds only Cipher Scripts and Messenger Birds, is one of the
// research order's cases (tests/lib/research-and-practice-order-cases.ts), played called directly and in a whole turn.
// Level 1 (unit): plain functions of the engine's modules on staged values; no turn is played, no die is cast.
import '../lib/the-whole-engine.ts';
import { describe, expect, test } from 'vitest';
import { SAGE_DISCOVERIES_P } from '../../src/content/kingdoms-call-data.ts';
import { DISC_BY_ID, discAvailableFor, discEligible } from '../../src/engine/discoveries.ts';
import { retireDiscoveries } from '../../src/engine/heroes/skills-and-hp.ts';

const MESSENGER_BIRDS = SAGE_DISCOVERIES_P.find((d) => d.name === 'Messenger Birds');

/** A realm of every race and creed the table names a discovery for, and one of none. */
const realms: { race?: string; alignment?: string }[] = [
  {},
  ...SAGE_DISCOVERIES_P.flatMap((d) => [
    ...(d.race ? [{ race: d.race }] : []),
    ...(d.alignment ? [{ alignment: d.alignment }] : []),
  ]),
];

describe('Messenger Birds is retired (R-140)', () => {
  test('its row is the one retired, and no realm of any race or creed is eligible for it', () => {
    expect(SAGE_DISCOVERIES_P.filter((d) => 'retired' in d && d.retired).map((d) => d.name)).toEqual([
      'Messenger Birds',
    ]);
    expect(realms.filter((r) => discEligible(MESSENGER_BIRDS, r))).toEqual([]);
  });

  test('the pool Research and a Breakthrough draw from holds every other discovery a realm may study, and not it', () => {
    realms.forEach((realm) => {
      const pool = discAvailableFor({ G: { players: [realm] } } as never, 0, new Set()).map((d) => d.name);
      const open = SAGE_DISCOVERIES_P.filter(
        (d) =>
          d.name !== 'Messenger Birds' &&
          (!d.race || d.race === realm.race) &&
          (!d.alignment || d.alignment === realm.alignment),
      ).map((d) => d.name);
      expect(pool).toEqual(open);
    });
  });

  test("a running game's save: a realm that holds it, with a pair offering it, keeps both through the upgrade", () => {
    const birds = DISC_BY_ID['sd20'];
    expect(birds?.name).toBe('Messenger Birds');
    const realm = {
      discoveries: [
        { id: 'sd20', name: 'Messenger Birds', category: 'Espionage', desc: 'as found', turnDiscovered: 3 },
      ],
      pendingDiscoveryChoices: [
        {
          key: 'rc4_7_1',
          turn: 4,
          charId: 7,
          charName: 'Aldric of the Fens',
          category: 'Espionage',
          options: ['sd20', 'sd19'],
        },
      ],
    };
    const save = { players: [realm] };
    expect(retireDiscoveries(save)).toBe(0);
    expect(realm.discoveries.map((d) => d.id)).toEqual(['sd20']);
    expect(realm.pendingDiscoveryChoices[0]?.options).toEqual(['sd20', 'sd19']);
  });
});
