// The GM page's telemetry banner waits for the probe's answer (plan P1-21p, the mutation session over P1-13e6 to
// P1-16d): probeTelemetry (src/ui/gm/startup.ts, moved there by P1-17a) asks both telemetry tables and only then draws
// the game list's banner, so a database that has them never shows "Game telemetry not active"; one that answers an
// error for either does.
// Level 1 (unit): the page's file imports in Node once its config and the `supabase` global are stood in; the function
// is called on a jsdom document set as the page's own, its client a stand-in. A page test would boot the whole page and
// sign in to reach the game list.
import { beforeAll, describe, expect, test } from 'vitest';
import { bootJsdom } from '../lib/boot.js';

let page: Document;
let probeTelemetry: () => Promise<unknown>;
/** The error each table's read answers with (null: the table is there). */
const errors: Record<string, { message: string } | null> = { turn_events: null, game_results: null };

beforeAll(async () => {
  const { window } = bootJsdom('<!doctype html><html><body><div id="msg-telemetry"></div></body></html>');
  page = window['document'] as Document;
  const theClient = {
    from: (table: string) => ({
      select: () => ({ limit: () => Promise.resolve({ data: [], error: errors[table] ?? null }) }),
    }),
  };
  Object.assign(globalThis, {
    window,
    document: page,
    KC_CONFIG: { supabaseUrl: 'https://example.org', supabaseKey: 'a-made-up-key' },
    supabase: { createClient: () => theClient },
  });
  ({ probeTelemetry } = await import('../../src/ui/gm/startup.ts'));
});
const theBanner = (): string => page.getElementById('msg-telemetry')?.textContent ?? '';

describe("the GM page's telemetry probe", () => {
  test('both tables there: the probe says so, and the banner is empty', async () => {
    errors['turn_events'] = null;
    errors['game_results'] = null;
    page.getElementById('msg-telemetry')?.replaceChildren(page.createTextNode('stale'));
    expect(await probeTelemetry()).toBe(true);
    expect(theBanner()).not.toContain('Game telemetry not active');
    expect(theBanner()).toBe('');
  });
  test('a table missing: the banner says telemetry is not active', async () => {
    errors['turn_events'] = null;
    errors['game_results'] = { message: 'relation "game_results" does not exist' };
    const quiet = console.warn;
    console.warn = () => undefined;
    try {
      expect(await probeTelemetry()).toBe(false);
    } finally {
      console.warn = quiet;
    }
    expect(theBanner()).toContain('Game telemetry not active');
  });
});
