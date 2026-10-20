// npm run dev (plan P1-09d, its Decision 10): Vite's dev server for the site, talking to the local Supabase only. It
// serves src/ as tools/build.ts builds it (the same options), but for kc-config.js, which it takes from
// public/dev/kc-config.js (git-ignored, never published: tools/build.ts leaves public/dev/ out). It refuses to start
// without that file, or with one that names any database but this machine's, and it checks again on every request
// for kc-config.js: so a dev server can never reach the live database.
//
//   npm run dev               the dev server, at the address it prints
//   npm run dev -- config     writes public/dev/kc-config.js from the local Supabase (npx supabase status: it must be
//                             running, supabase/README.md)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createServer, type InlineConfig, type ViteDevServer } from 'vite';
import { ROOT, siteOptions } from './build.ts';

/** The dev server's config, served as /kc-config.js. */
export const DEV_CONFIG = path.join(ROOT, 'public', 'dev', 'kc-config.js');

/** A database on this machine: the local Supabase. */
const isLocal = (url: string) => {
  try {
    return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
};

/** The config file's KC_CONFIG, read by running it alone (it declares one constant and nothing else). */
function configIn(text: string): { supabaseUrl?: unknown } | null {
  try {
    return vm.runInNewContext(`${text}\n;KC_CONFIG`, {}, { timeout: 1000 }) as { supabaseUrl?: unknown };
  } catch {
    return null;
  }
}

/** Why the dev server won't serve `text` as kc-config.js (null: it will). `text` null: there's no such file. */
export function devConfigProblem(text: string | null, file = DEV_CONFIG): string | null {
  const name = path.relative(ROOT, file);
  if (text === null)
    return `npm run dev: no ${name}. Start the local Supabase (supabase/README.md), then run npm run dev -- config.`;
  const url = configIn(text)?.supabaseUrl;
  if (typeof url !== 'string') return `npm run dev: ${name} doesn't declare KC_CONFIG with a supabaseUrl.`;
  if (!isLocal(url))
    return `npm run dev: ${name} names ${url}, not this machine's Supabase: the dev server only talks to a local database.`;
  return null;
}

/** The text of a dev kc-config.js for the local Supabase at `url` with its public key `key`. */
export function devConfigText(url: string, key: string): string {
  if (!isLocal(url)) throw new Error(`npm run dev -- config: ${url} isn't this machine's Supabase`);
  return (
    "// Kingdoms Call: the dev server's database, the local Supabase (written by npm run dev -- config; never\n" +
    '// published or committed: tools/dev.ts).\n' +
    `const KC_CONFIG = Object.freeze({ env: 'local', supabaseUrl: ${JSON.stringify(url)}, supabaseKey: ${JSON.stringify(key)} });\n`
  );
}

const readOrNull = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);

/** Vite's options for the dev server: the site's, with /kc-config.js answered from `config`, checked each time. */
export function devServerOptions(config = DEV_CONFIG): InlineConfig {
  return {
    ...siteOptions(),
    plugins: [
      {
        name: 'kc-dev-config',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if ((req.url ?? '').split('?')[0] !== '/kc-config.js') {
              next();
              return;
            }
            const text = readOrNull(config);
            const problem = devConfigProblem(text, config);
            res.setHeader('Content-Type', 'application/javascript');
            if (problem || text === null) {
              res.statusCode = 500;
              res.end(`throw new Error(${JSON.stringify(problem)});\n`);
            } else res.end(text);
          });
        },
      },
    ],
  };
}

/** Starts the dev server, unless `config` is missing or names another database: then it throws with the reason. */
export async function startDevServer(config = DEV_CONFIG, port?: number): Promise<ViteDevServer> {
  const problem = devConfigProblem(readOrNull(config), config);
  if (problem) throw new Error(problem);
  const options = devServerOptions(config);
  const server = await createServer({
    ...options,
    server: port === undefined ? {} : { port, strictPort: true },
  });
  return server.listen();
}

// Real paths: a folder reached through a link (macOS's /tmp, say) must still count as this script being run.
const entry = process.argv[1];
if (entry && fs.realpathSync(entry) === fs.realpathSync(import.meta.filename)) {
  if (process.argv[2] === 'config') {
    const status = JSON.parse(
      execFileSync('npx', ['supabase@2.120.0', 'status', '-o', 'json'], { encoding: 'utf8', cwd: ROOT }),
    ) as Record<string, string | undefined>;
    const url = status['API_URL'];
    const key = status['PUBLISHABLE_KEY'] ?? status['ANON_KEY'];
    if (!url || !key) throw new Error('npm run dev -- config: supabase status gave no API_URL or key');
    fs.mkdirSync(path.dirname(DEV_CONFIG), { recursive: true });
    fs.writeFileSync(DEV_CONFIG, devConfigText(url, key));
    console.log(`Wrote ${path.relative(ROOT, DEV_CONFIG)} for the local Supabase at ${url}.`);
  } else {
    startDevServer().then(
      (server) => {
        server.printUrls();
      },
      (e: unknown) => {
        console.error(e instanceof Error ? e.message : String(e));
        process.exit(1);
      },
    );
  }
}
