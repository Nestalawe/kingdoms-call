// The GM page's first games list after sign-in reads the light columns (plan P1-21r, the mutation session over P1-16i
// to P1-16m): onSignedIn (src/ui/gm/auto-turn.ts) asks whether the light `games.meta` column is there before it loads
// the games list, so a database that has it never sends the first list with every game's whole world and reports
// (`*, game_players(*)`); one whose probe is refused still reads the heavy list, as before.
// Level 4 (page): onSignedIn ties the sign-in's probes to the list's read across five of the GM page's files, on the
// page's own elements; the GM portal is booted in jsdom on a stand-in client that records each read's table and columns,
// with a Game Master's session kept in the browser, so it signs in as it loads.
import { describe, expect, test } from 'vitest';
import { bootJsdom, readPage } from '../lib/boot.js';

/** A Supabase client with a Game Master signed in, whose reads answer nothing but the `games.meta` probe, which answers
 *  `theProbesError`; each read's table and columns are kept in `reads`, in order. */
function aRecordingClient(reads: string[], theProbesError: { message: string } | null): unknown {
  const user = { id: 'gm-1', email: 'gm@example.test' };
  return {
    from: (table: string) => {
      let columns = '';
      const query: Record<string, unknown> = {};
      for (const m of ['eq', 'in', 'is', 'order', 'limit', 'range', 'update', 'insert', 'upsert', 'delete'])
        query[m] = () => query;
      query['select'] = (s: string) => {
        columns = s;
        reads.push(`${table}:${s}`);
        return query;
      };
      query['then'] = (resolve: (r: unknown) => unknown) =>
        Promise.resolve({
          data: [],
          error: table === 'games' && columns === 'id,meta' ? theProbesError : null,
        }).then(resolve);
      return query;
    },
    rpc: (fn: string) => Promise.resolve({ data: fn === 'is_game_master', error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user } }, error: null }),
      getUser: () => Promise.resolve({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
    channel: () => ({ on: () => ({ subscribe: () => undefined }) }),
    removeChannel: () => undefined,
  };
}

/** The GM portal booted with a Game Master's session kept in the browser (so it signs in as it loads): the columns of
 *  its first games list, and the reads before it. */
async function theFirstGamesListAfterSignIn(
  theProbesError: { message: string } | null,
): Promise<{ list: string | undefined; before: string[] }> {
  const reads: string[] = [];
  const W = bootJsdom(readPage('kingdoms-call-gm-portal.html'), {
    supabase: { createClient: () => aRecordingClient(reads, theProbesError) },
    url: 'https://example.org/kingdoms-call/kingdoms-call-gm-portal.html',
    setup(w) {
      w.console.error = () => undefined;
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  }).window;
  await new Promise((r) => setTimeout(r, 900));
  W.close(); // the watcher a Game Master's sign-in starts goes with the window
  const at = reads.findIndex((r) => r.startsWith('games:') && r !== 'games:id,meta');
  return { list: reads[at], before: reads.slice(0, Math.max(at, 0)) };
}

describe("the GM page's first games list after sign-in", () => {
  test('the meta column there: the list asks for the light columns, never every game whole', async () => {
    const { list, before } = await theFirstGamesListAfterSignIn(null);
    expect(before).toContain('games:id,meta');
    expect(list).toBe(
      'games:id,name,gm_user_id,status,turn,max_players,max_turns,created_at,meta, game_players(id,game_id,user_id,player_index,display_name,orders_submitted)',
    );
  });
  test('the probe refused: the list reads every game whole, as before', async () => {
    const { list, before } = await theFirstGamesListAfterSignIn({ message: 'column games.meta does not exist' });
    expect(before).toContain('games:id,meta');
    expect(list).toBe('games:*, game_players(*)');
  });
});
