// 2026-10-13 (Toby, Creatures and Monsters VI; R-106): Island Back, the Great Turtles carry two units a hull. The
// decided table's last ability, left out of the beast-abilities PR because it is a sea-lift rule, not a battle-line
// one.
// - The data file: the Great Turtles are a carrier (KC_UNIT_CLASS.carrier), and still a primal sea beast;
//   KC_CARRIER_BERTHS gives them two berths, and every unit it gives berths to is a carrier; the turtle's description
//   (PRIMAL_ARMY_DEFS_P) names Island Back and no longer says they carry nothing.
// - The engine's lift (getSeaCapability and seaLiftShortfall): a turtle carries two heavy units or four light foot where
//   a galleon or a whale cohort carries one heavy unit; a third heavy unit is a shortfall; a turtle and a galleon
//   together carry three; a Sea Giant carries nothing. The rule the engine shares with the player portal
//   (seaLiftOfAColumn) counts two berths on a turtle, names the unit left ashore, and doubles the berths under a leader
//   of Naval 8.
// - The player portal's turtle blurb (UNIT_ABILITIES) names Island Back and no longer says they carry nothing.
// The rest is elsewhere: a turn's sea move with a turtle (two cases of tests/lib/move-order-cases.ts), the player
// portal's Move notice (tests/page/the-player-portals-move-notice-counts-the-great-turtles-two-berths.test.ts), and the
// rulebook's rows (tests/static/the-rulebook-says-the-great-turtles-carry-two-units-a-hull.test.ts).
//
// Level 1 (unit): the content tables imported, and the three functions called on hand-made columns. Not lower: the
// lift is a computed value.
//
// Until plan P1-14e this was part of tests/island-back.test.js, which read the tables and called the functions in the
// engine's bare vm, and read the blurb from src/ by its syntax tree (tests/lib/source.ts). Its checks are kept as they
// were; "KC_CARRIER_BERTHS is defined" is the import, and the blurb is the content's own value, not its source text.
import { expect, test } from 'vitest';
import { KC_CARRIER_BERTHS, KC_UNIT_CLASS, PRIMAL_ARMY_DEFS_P } from '../../src/content/kingdoms-call-data.ts';
import { UNIT_ABILITIES } from '../../src/content/unit-abilities-their-names-numbers-and-words.ts';
import { getSeaCapability } from '../../src/engine/units/movement-pools.ts';
import { seaLiftShortfall } from '../../src/engine/units/sea-lift-stranding-and-retreats.ts';
import { seaLiftOfAColumn } from '../../src/engine/rules-on-plain-values/ships-and-flyers-that-carry-a-column-across-the-sea.ts';

const u = (type: string, n = 1) =>
  Array.from({ length: n }, (_, i) => ({ type, quality: 'Average', unitName: `${type} ${String(i + 1)}` }));
const cap = (...groups: ReturnType<typeof u>[]) => getSeaCapability(groups.flat(), null) as string;
const short = (...groups: ReturnType<typeof u>[]) => seaLiftShortfall(groups.flat(), null);
const lift = (naval8: boolean, ...groups: ReturnType<typeof u>[]) => seaLiftOfAColumn(groups.flat(), naval8);
const carriers: readonly string[] = KC_UNIT_CLASS.carrier;
const primalSea: readonly string[] = KC_UNIT_CLASS.primalSea;
const sea: readonly string[] = KC_UNIT_CLASS.sea;

test('the data file: the Great Turtles are a carrier of two berths, and still a primal sea beast', () => {
  expect(
    carriers.includes('Great Turtles') && primalSea.includes('Great Turtles') && sea.includes('Great Turtles'),
    'the Great Turtles are a carrier, and still a primal sea beast',
  ).toBe(true);
  expect(KC_CARRIER_BERTHS['Great Turtles'], 'KC_CARRIER_BERTHS gives the Great Turtles two berths (Island Back)').toBe(
    2,
  );
  expect(
    Object.keys(KC_CARRIER_BERTHS).filter((t) => !carriers.includes(t)),
    'every unit with a berth count is a carrier',
  ).toEqual([]);
  const turtle = JSON.stringify(PRIMAL_ARMY_DEFS_P['Great Turtles']);
  expect(
    turtle.includes('Island Back') && !turtle.includes('carry nothing'),
    "the data file's turtle description names Island Back and no longer says they carry nothing",
  ).toBe(true);
});

test("the engine's lift: a turtle carries two heavy units or four light foot, where a galleon or a whale carries one", () => {
  expect(cap(u('Great Turtles'), u('Gilded Lances', 2)), 'a turtle carries two Gilded Lances').toBe('sea');
  expect(
    {
      cap: cap(u('Great Turtles'), u('Gilded Lances', 3)),
      short: short(u('Great Turtles'), u('Gilded Lances', 3)) > 0,
    },
    '…but not three',
  ).toEqual({ cap: 'land', short: true });
  expect(cap(u('Great Turtles'), u('Shieldwall Levies', 4)), '…or four companies of light foot').toBe('sea');
  expect(cap(u('Galleon Fleet'), u('Gilded Lances', 2)), 'a galleon still carries one heavy unit, not two').toBe(
    'land',
  );
  expect(cap(u('Whale Cohort'), u('Gilded Lances', 2)), 'a whale cohort still carries one').toBe('land');
  expect(
    cap(u('Great Turtles'), u('Galleon Fleet'), u('Gilded Lances', 3)),
    'a turtle and a galleon together carry three',
  ).toBe('sea');
  expect(
    { short: short(u('Great Turtles'), u('Gilded Lances', 2)), giant: cap(u('Sea Giants'), u('Gilded Lances')) },
    'no shortfall for two aboard a turtle; a Sea Giant still carries nothing',
  ).toEqual({ short: 0, giant: 'land' });
});

test('the shared rule (seaLiftOfAColumn) counts two berths on a turtle, names the unit left ashore, and doubles under Naval 8', () => {
  const two = lift(false, u('Great Turtles'), u('Gilded Lances', 2));
  expect(
    { answer: two.answer, berths: two.berths, ashore: two.unitsLeftAshore.length },
    'it counts two berths on a turtle and leaves no one ashore',
  ).toEqual({ answer: 'sea', berths: 2, ashore: 0 });
  const three = lift(false, u('Great Turtles'), u('Gilded Lances', 3));
  expect(
    { answer: three.answer, ashore: three.unitsLeftAshore.map((a) => a.type) },
    '…and with three Gilded Lances names the one left ashore',
  ).toEqual({ answer: 'land', ashore: ['Gilded Lances'] });
  const mastered = lift(true, u('Great Turtles'), u('Gilded Lances', 4));
  expect(
    { answer: mastered.answer, berths: mastered.berthsUnderItsLeader },
    "…and under a leader of Naval 8 the turtle's two berths carry four",
  ).toEqual({ answer: 'sea', berths: 4 });
});

test("the player portal's turtle blurb names Island Back and no longer says they carry nothing", () => {
  const blurb = UNIT_ABILITIES['Great Turtles'];
  expect(
    blurb.includes('Island Back') && blurb.includes('two') && !blurb.includes('carry nothing'),
    `the player portal's turtle blurb names Island Back — "${blurb.slice(0, 140)}…"`,
  ).toBe(true);
});
