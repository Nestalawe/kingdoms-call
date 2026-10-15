// Types for the parts of tests/lib/stub-db.js that TypeScript tests use. Add to them as tests need more.
// No new stand-ins: from P1-17 tests use the access layer's typed fake, and the users of this file only go down.

export type Row = Record<string, unknown>;

export interface Stub {
  /** Installed as the page's window.supabase. */
  supabase: unknown;
  /** The stand-in database's tables. */
  DB: Record<string, Row[]>;
}

export function makeStub(): Stub;
