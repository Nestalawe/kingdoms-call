import { kcDbGuard } from '../../db/kc-db-guard.js';
import { KC_DB_MIN } from './startup.js';
import { sb } from './config.js';
import { init } from './sign-in.js';

kcDbGuard(sb, KC_DB_MIN).then(() => init());
