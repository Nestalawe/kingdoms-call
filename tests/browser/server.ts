// The static server the browser specs open the pages from (playwright.config.ts starts it, on the port it's given):
// one folder, as the pages are deployed. It serves site/, or the copy in $KC_SITE (tests/lib/boot.js).
import { serve, SITE } from '../lib/boot.js';

void serve(SITE, Number(process.argv[2])).then((server) => {
  console.log(`Serving ${SITE} at ${server.url}`);
});
