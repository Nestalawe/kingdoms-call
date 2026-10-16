// The exact half of the balance matrix (plan P1-02): short hashes of what a turn saved, split so a change of wording
// shows apart from a change of play. Hashed per turn: the saved state without its prose, the prose on its own, the GM
// log's structure (every field but `text`) and its text, the telemetry rows (turn_events), and the scripted realm's
// report, structure and text apart.
//
// Left out, because they carry no play and would make two equal games differ:
// - the stand-in database's own ids and stamps on each row (`id`, `created_at`, `updated_at`): rowPlay below;
// - the build stamp (`build` on telemetry and results rows, `engineStamp` in a report): it changes with every edit of
//   the GM portal;
// - clock readings (any ISO date-time string): the page's pinned clock moves on 1 ms at each reading, so code that
//   reads the clock once more shifts every later time without changing a thing in play.
import { createHash } from 'node:crypto';

/** Keys whose values are words, not play. `text` is a log line's; the others are descriptions in the state. */
export const PROSE_KEYS = new Set(['text', 'desc', 'lore', 'flavour']);
/** Keys the stand-in database or the build adds to a row or a report, at its top level only (a character's `id`
 *  inside the state is play). */
export const STAMP_KEYS = new Set(['id', 'created_at', 'updated_at', 'build', 'engineStamp']);
const ISO_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:?\d\d)?$/;

/** The first 12 hex characters of the SHA-256 of `text`. */
export function h(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `value` as JSON with the prose keys and clock readings left out. */
export function playJson(value: unknown): string {
  return JSON.stringify(value, (key, v: unknown) => {
    if (PROSE_KEYS.has(key)) return undefined;
    if (typeof v === 'string' && ISO_TIME.test(v)) return 'T';
    return v;
  });
}

/** A database row or a report without its top-level stamp keys. */
export function withoutStamps(row: unknown): unknown {
  if (!isRecord(row)) return row;
  return Object.fromEntries(Object.entries(row).filter(([k]) => !STAMP_KEYS.has(k)));
}

/** Every prose value in `value`, in the order met, as JSON: a list of [key, words]. */
export function proseJson(value: unknown): string {
  const out: [string, unknown][] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (isRecord(v)) {
      for (const [k, x] of Object.entries(v)) {
        if (PROSE_KEYS.has(k)) out.push([k, x]);
        else walk(x);
      }
    }
  };
  walk(value);
  return JSON.stringify(out);
}

/** Hash of the play in `value` (prose and clock readings left out). */
export const playHash = (value: unknown): string => h(playJson(value));
/** Hash of the words in `value`. */
export const proseHash = (value: unknown): string => h(proseJson(value));

/** One turn's hashes, in this order. A bot game has no report: its two report columns are ''. */
export const TURN_COLUMNS = ['state', 'prose', 'log', 'logText', 'telemetry', 'report', 'reportText'] as const;
export type TurnColumn = (typeof TURN_COLUMNS)[number];
/** The columns that are words; the rest are play. */
export const WORD_COLUMNS: ReadonlySet<TurnColumn> = new Set(['prose', 'logText', 'reportText']);

export interface TurnInput {
  /** The saved game_state, parsed. */
  state: unknown;
  /** The GM log entries this turn wrote (turn_logs rows with player_index -1). */
  gmLog: unknown[];
  /** The telemetry rows this turn wrote (turn_events). */
  telemetry: unknown[];
  /** The scripted realm's report (its game_players.turn_report, parsed), or null in a bot game. */
  report: Record<string, unknown> | null;
}

/** One turn's hashes, joined with spaces in TURN_COLUMNS order (the form kept in the baseline). */
export function turnHashes(t: TurnInput): string {
  const cols: Record<TurnColumn, string> = {
    state: playHash(t.state),
    prose: proseHash(t.state),
    log: playHash(t.gmLog),
    logText: proseHash(t.gmLog),
    telemetry: playHash(t.telemetry.map(withoutStamps)),
    report: t.report ? playHash(withoutStamps(t.report)) : '',
    reportText: t.report ? proseHash(withoutStamps(t.report)) : '',
  };
  return TURN_COLUMNS.map((c) => cols[c]).join(' ');
}

/** The scripted realm's report, one entry per top-level section: [play hash, words hash]. */
export function reportSectionHashes(report: Record<string, unknown>): Record<string, [string, string]> {
  const out: Record<string, [string, string]> = {};
  for (const [k, v] of Object.entries(report)) {
    if (STAMP_KEYS.has(k)) continue;
    out[k] = [playHash(v), proseHash(v)];
  }
  return out;
}
