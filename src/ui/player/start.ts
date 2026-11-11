import { kcDbGuard } from '../../db/kc-db-guard.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import { KC_DB_MIN, thePagesDb } from './startup.ts';
import { init } from './sign-in.ts';

// ── BOOT ────
void kcDbGuard(thePagesDb, KC_DB_MIN).then(() =>
  init().catch((err: unknown) => {
    console.error('Init error:', err);
    theElementWithTheId('spinner', HTMLElement).textContent =
      'Error loading — please refresh. (' + theMessageOf(err) + ')';
  }),
);

/** What was thrown's message, in words, as `'…' + err.message` wrote it: an error's message; `undefined` for a value
 *  with none; nothing thrown (`null`, `undefined`) throws the TypeError reading its message threw. */
function theMessageOf(err: unknown): string {
  if (err === null || err === undefined) throw new TypeError(`reading the message of ${String(err)}`);
  return String(Reflect.get(Object(err), 'message'));
}
