import { kcDbGuard } from '../../db/kc-db-guard.ts';
import { KC_DB_MIN } from './startup.ts';
import { thePagesDb } from './config.ts';
import { init } from './sign-in.ts';

void kcDbGuard(thePagesDb, KC_DB_MIN).then(() => init());
