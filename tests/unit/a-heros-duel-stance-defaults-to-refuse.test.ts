// 2026-10-13 (item 1): a hero's Duel Stance defaults to Refuse, not Accept. The engine treats a player's hero with no
// stance set as refusing; NPCs keep their Temper's stance, and a stance the player chose is kept. Every place the
// player portal's orders form writes a stance into the submitted plan falls back to Refuse when its select is missing,
// and every Duel stance select it builds opens on Refuse. That the form as booted opens each hero's select on Refuse is
// tests/page/the-orders-forms-duel-stance-selects-open-on-refuse.test.ts.
//
// Level 1 (unit): duelStanceOf (src/engine/personal-combat/, plan P1-08e) called directly on plain heroes. The form's
// fallbacks and its selects' markup are read from the player portal's source by its syntax tree (tests/lib/source.ts's
// compactPage, in one layout whatever the file's: level 0 reads), since the portal's modules can't be imported on
// their own (they call supabase.createClient as they load).
//
// Until plan P1-14c this was the first half of tests/duel-refuse-default.test.js, which called duelStanceOf in the
// engine's bare vm (tests/lib/engine.ts).
import '../lib/the-whole-engine.ts';
import { expect, test } from 'vitest';
import { duelStanceOf } from '../../src/engine/personal-combat/speed-encounter-plans-and-combatants.ts';
import { compactPage } from '../lib/source.ts';

/** A hero as duelStanceOf reads him: plain data, typed as the engine's Character. */
const hero = (h: Record<string, unknown>) => h as unknown as Parameters<typeof duelStanceOf>[0];

test("a player's hero with no stance set refuses a duel; a chosen stance is kept; an NPC follows his Temper", () => {
  expect(duelStanceOf(hero({ player: 0, name: 'Aldric' })), "a player's hero with no plan refuses a duel").toBe(
    'refuse',
  );
  expect(
    duelStanceOf(hero({ player: 0, encounterPlan: { tactics: ['ME'] } })),
    '…and so does one whose plan names no stance',
  ).toBe('refuse');
  expect(
    duelStanceOf(hero({ player: 0, encounterPlan: { duelStance: 'accept' } })),
    'a stance the player chose (Accept) is kept',
  ).toBe('accept');
  expect(duelStanceOf(hero({ player: 0, encounterPlan: { duelStance: 'challenge' } })), '…and Challenge').toBe(
    'challenge',
  );
  expect(
    duelStanceOf(hero({ player: null, temper: 'Brave' })),
    'a Brave NPC still challenges (Temper decides for NPCs)',
  ).toBe('challenge');
});

test('every place the orders form writes a stance falls back to Refuse, and every fresh select opens on it', () => {
  const src = compactPage('kingdoms-call-player-portal.html');
  const fallbacks = src.match(/duelStance:document\.getElementById\(`ep-duel-[^`]+`\)\?\.value\|\|'(\w+)'/g) ?? [];
  expect(fallbacks.length, 'the submitted plan writes a stance in at least 5 places').toBeGreaterThanOrEqual(5);
  expect(
    fallbacks.filter((f) => !f.endsWith("'refuse'")),
    `the submitted plan falls back to Refuse in all ${String(fallbacks.length)} places`,
  ).toEqual([]);
  const opens = src.match(/DUEL_STANCES\.map\(d=>kcHtml`<option value="\$\{d\.code\}"\$\{[^?]*\?' selected'/g) ?? [];
  expect(opens.length, 'the form builds at least 4 Duel stance selects').toBeGreaterThanOrEqual(4);
  expect(
    opens.filter((o) => !o.includes("'refuse'") || o.includes("'accept'")),
    `every Duel stance select opens on Refuse (${String(opens.length)})`,
  ).toEqual([]);
});
