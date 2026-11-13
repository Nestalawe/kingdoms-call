import { kcDbGuard } from '../../db/kc-db-guard.ts';
import { theElementWithTheId } from '../shared/the-pages-element-with-the-id.ts';
import { KC_DB_MIN, thePagesDb } from './startup.ts';
import { init, theMessageOf } from './sign-in.ts';

// ── BOOT ────
void kcDbGuard(thePagesDb, KC_DB_MIN).then(() =>
  init().catch((err: unknown) => {
    console.error('Init error:', err);
    theElementWithTheId('spinner', HTMLElement).textContent =
      'Error loading — please refresh. (' + theMessageOf(err) + ')';
  }),
);
