import { kcDbGuard } from '../../db/kc-db-guard.ts';
import { KC_DB_MIN } from './startup.ts';
import { sb } from './config.ts';
import { init } from './sign-in.ts';

kcDbGuard(sb, KC_DB_MIN).then(() => init());
