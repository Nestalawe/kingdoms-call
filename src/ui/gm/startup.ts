// @ts-nocheck: JavaScript not yet typed (strict TypeScript reports errors here); P1-10 and P1-16 type it.
import { thisPagesBuild } from '../shared/a-newer-version-of-this-page.ts';

// The oldest database this page works with (P0-34): a migration's version. kcDbGuard checks it before the
// first read. Raise it when this page needs a newer database change (docs/traps.md, "A site change that needs
// a database change"). Now P0-25's: the game screen's switch saves games.block_eliminated_msgs. (Since P0-32e,
// Master GM mode (P0-32g) has needed the Overlord's rights on every game.)
export const KC_DB_MIN = '20261015062128';
// This build: the commit the page was built from, 7 characters, from its kc-build meta (tools/build.ts, plan P1-06).
// Telemetry rows, Hall of Fame records and the Stats export carry it; "unknown" on a page built without git.
export const KC_BUILD_STAMP = thisPagesBuild() ?? 'unknown';
