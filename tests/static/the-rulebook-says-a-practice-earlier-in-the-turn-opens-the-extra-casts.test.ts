// 2026-10-13 (item 16): casts assume every earlier practice succeeds. The rulebook says so: a Practice Skill on the
// school earlier in the turn that succeeds opens the extra spells, and a cast refused for want of the level is never
// worked and spends none of the hero's casts. The rule itself: the bots' side is
// tests/unit/the-bots-order-check-counts-each-earlier-practice-as-a-level-before-a-cast.test.ts, the order form's
// tests/page/the-player-portals-order-form-on-the-values-handed-them.test.ts.
//
// Level 0 (static): the rulebook as built (site/), read as text; nothing runs. Until plan P1-14z this was the last
// check of tests/cast-practice-assumed.test.js, kept as it was.
import { expect, test } from 'vitest';
import { readPage } from '../lib/boot.ts';

test('the rulebook says practice opens the extra casts and a refused cast spends none', () => {
  const rules = readPage('kingdoms-call-rules.html');
  expect(rules).toMatch(
    /a <em>Practice Skill<\/em> on the school earlier in the turn that succeeds opens the extra spells/,
  );
  expect(rules).toMatch(/is never worked and spends none of your casts/);
});
