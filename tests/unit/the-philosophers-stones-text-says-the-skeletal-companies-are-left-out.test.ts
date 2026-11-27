// R-191: the Philosopher's Stone's text says the undead are left out, as the turn does. Used, the Stone raises every
// company of the realm a quality tier but a skeletal one (the Use Item order, src/engine/orders/
// item-orders-equip-use-and-send-magic-items.ts, skips a company marked `_isSkeletal`; the case "Use Item: the
// Philosopher's Stone leaves the dead as they were", tests/lib/item-and-army-order-cases.ts, pins that). So every row
// of the content that deals a Stone (the lair table's and the legendary relics') says, in its desc and in its lore,
// that skeletal companies are not promoted: the word the turn's own test reads, "skeletal", with a "not" or a "never"
// in the same sentence. And the line a realm with only the risen dead reads, when the Stone finds nothing to raise,
// says it has no living armies (the turn counts the skeletal companies out), not none at all.
import { describe, expect, it } from 'vitest';
import { ALL_MAGIC_ITEMS_P, LEGENDARY_ITEMS_P } from '../../src/content/kingdoms-call-data.ts';
import { theWordsOfTheItemOrdersLine } from '../../src/views/prose/the-words-of-the-item-orders-lines.ts';

const STONE = "Philosopher's Stone";
const theStonesRows = [...ALL_MAGIC_ITEMS_P, ...LEGENDARY_ITEMS_P].filter((it) => it.name === STONE);
/** Whether one sentence of `text` names the skeletal companies and says they are not (or never) raised. */
const aSentenceLeavesTheSkeletalOut = (text: string) =>
  text.split(/(?<=[.:;])\s+/).some((s) => /skeletal/i.test(s) && /\b(not|never)\b/i.test(s));

describe("the Philosopher's Stone's text says the skeletal companies are left out (R-191)", () => {
  it('every row that deals a Stone is read (the lair table and the legendary relics)', () => {
    expect(theStonesRows.length).toBeGreaterThanOrEqual(1);
  });
  it.each(theStonesRows.map((row, i) => [i, row] as const))("row %i's desc and lore say so", (_i, row) => {
    expect({ desc: aSentenceLeavesTheSkeletalOut(row.desc), lore: aSentenceLeavesTheSkeletalOut(row.lore) }).toEqual({
      desc: true,
      lore: true,
    });
  });
  it('a realm with only skeletal companies reads that it has no living armies for the Stone', () => {
    const line = theWordsOfTheItemOrdersLine({
      kind: "the Philosopher's Stone finds nothing to work on and is not spent",
      heroName: 'Aldric',
      stoneName: STONE,
      theRealmHasNoUnits: true,
    });
    expect(line).toContain('your realm has no living armies in the field or in garrison');
  });
});
