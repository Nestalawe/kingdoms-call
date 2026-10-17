// Types for the parts of tests/lib/stub-db.js that TypeScript tests use. Add to them as tests need more.
// No new stand-ins: from P1-17 tests use the access layer's typed fake, and the users of this file only go down.

export type Row = Record<string, unknown>;

export interface Stub {
  /** Installed as the page's window.supabase. */
  supabase: unknown;
  /** The stand-in database's tables. */
  DB: Record<string, Row[]>;
  /** "table.op" (select, insert, upsert, update, delete) or "rpc.name": the error every such call answers with. */
  ERRORS: Record<string, { message: string }>;
}

export function makeStub(): Stub;

/** Each stand-in as a script for Chromium (addInitScript, or routeExternal's supabase-js answer). `messaging` also
 *  gives the page window.__DB, to stage rows and inject dispatches. */
export const browserSource: { messaging: string; null: string };

/** The browser stand-in's handle (browserSource.messaging): window.__DB. */
export interface BrowserDB {
  db: Record<string, Row[]>;
  reset(): void;
  hide(table: string): void;
  show(table: string): void;
  /** A dispatch written by somebody else, straight into the table. Gives its id. */
  inject(message: Row): number;
}
