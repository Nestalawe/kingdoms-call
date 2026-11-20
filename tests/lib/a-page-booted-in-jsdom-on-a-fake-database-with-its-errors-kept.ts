// A page of the site booted in jsdom on a fake database (tests/lib/fake-db.ts), with every error it raises kept: an
// uncaught error, a rejected promise no one handles, and each console.error line. Its console.warn and console.log
// are silenced. The page tests of the Overlord page, the GM portal's master mode and its gate, the Game Master offer
// and the hidden emails use it (until plan P1-14z, each script had these lines of its own).
import type { Db } from '../../src/db/the-db-interface-and-its-areas.ts';
import { bootJsdom, readPage, type PageWindow } from './boot.ts';
import { itsStackOr } from './screens.ts';

/** A booted page: its window, its document, and the errors it raised so far (each a stack or a message). */
export interface APageBootedWithItsErrorsKept {
  readonly W: PageWindow;
  readonly doc: Document;
  readonly errs: string[];
}

/** Boots `page` (a file of site/) on `db` at `url` (by default https://example.org/), and waits `waitMs` for it to
 *  start and sign in. */
export async function bootThePageOnAFakeDatabaseKeepingItsErrors(
  page: string,
  db: Db,
  { url, waitMs }: { url?: string; waitMs: number },
): Promise<APageBootedWithItsErrorsKept> {
  const errs: string[] = [];
  const { window: W } = bootJsdom(readPage(page), {
    supabase: { createClient: () => ({}) },
    db,
    ...(url === undefined ? {} : { url }),
    setup(w) {
      w.addEventListener('error', (e) => errs.push(itsStackOr(e.error, e.message)));
      w.onunhandledrejection = (e) => errs.push(itsStackOr(e.reason, e.reason));
      w.console.error = (...a) => errs.push('console.error: ' + a.map(String).join(' '));
      w.console.warn = () => undefined;
      w.console.log = () => undefined;
    },
  });
  await new Promise((r) => setTimeout(r, waitMs));
  // `as`: the page's window has its document (PageWindow names only what most tests read)
  return { W, doc: W['document'] as Document, errs };
}
