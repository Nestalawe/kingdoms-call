// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { kcDbGuard } from '../../db/kc-db-guard.ts';
import { KC_DB_MIN, sb } from './startup.ts';
import { init } from './init.ts';

// ── BOOT ────
kcDbGuard(sb, KC_DB_MIN).then(() =>
  init().catch((err) => {
    console.error('Init error:', err);
    document.getElementById('spinner').textContent = 'Error loading — please refresh. (' + err.message + ')';
  }),
);
