// A deploy keeps the files a cached page still names (plan P1-06b, Decisions 3 and 4). Since P1-06b each page's bundle
// and stylesheet are named by their content (assets/<page>-<hash>.js), and GitHub Pages replaces the whole site on each
// deploy. Its cache hands out a page for up to 10 minutes after a deploy, and ignores a query string, so a page
// cached before a deploy can ask for a file the new site no longer has. This script, run by the build jobs
// (.github/workflows/deploy.yml, staging.yml) between `npm run build` and the upload, puts those files back:
// - every file the previous site's pages name (each `src="…"` and `href="…"` of a file beside them, and each `url(…)`
//   in a stylesheet they name) that the new site lacks;
// - every file the previous site's published-files.json lists as live within the last 24 hours, when the new site
//   lacks it (so a page cached two deploys back, 7 minutes apart, still finds its files).
// A file the new build makes is never overwritten, and a page is never kept. It then writes published-files.json
// beside the pages: every file the new site holds, with when it stopped being live (null while it is). That file's
// name is read back by the next deploy: never rename it (docs/traps.md).
//
// Where the previous site comes from: a folder (the previous deploy run's Pages artifact, unpacked; staging's
// repository, cloned), or the live site over HTTPS when there is no artifact (none yet, or expired after 30 days).
// Anything wrong stops it before it writes a file, with exit code 1, so the job fails and nothing is published: no
// previous site, a page none of whose files it can read, a file it names missing, a failed request.
//
//   node tools/deploy/keep-the-previous-deploys-files.ts <site> --previous <folder> [--now <ISO time>]
//   node tools/deploy/keep-the-previous-deploys-files.ts <site> --live <url> [--now <ISO time>]
//
// Plain Node runs it, with nothing installed: erasable TypeScript only, and only node: imports.
import fs from 'node:fs';
import path from 'node:path';

/** The list the site publishes of its own files (never renamed: the next deploy reads it back). */
export const PUBLISHED_FILES = 'published-files.json';
/** How long a file is kept after it stops being live (Decision 4: deploys can come minutes apart). */
export const KEPT_FOR_MS = 24 * 60 * 60 * 1000;

/** published-files.json: each file of the site, and when it stopped being live (an ISO time), or null while it is. */
export interface PublishedFiles {
  files: Record<string, string | null>;
}

export interface KeepResult {
  /** The files put back into the new site, sorted. */
  kept: string[];
  /** The files the previous site's pages name, sorted (each is in the new site once this has run). */
  named: string[];
  /** Files the previous published-files.json listed that are gone: stopped being live over 24 hours ago. */
  dropped: string[];
}

/** The files under `dir`, as paths relative to it with "/" between folders, sorted. */
function filesUnder(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

const isPage = (name: string): boolean => !name.includes('/') && name.endsWith('.html');

/** A name a page or a stylesheet gives, as a path inside the site; refuses one that leads outside it. */
function insideTheSite(name: string, from: string): string {
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(from), name));
  if (resolved === '.' || resolved.startsWith('../') || resolved === '..' || path.posix.isAbsolute(resolved)) {
    throw new Error(`${from} names ${name}, which is outside the site`);
  }
  return resolved;
}

/** The files beside it a page names: each `src="…"` and `href="…"` that isn't another site, an anchor or a page. */
export function namedByPage(html: string, page: string): string[] {
  const names = new Set<string>();
  for (const m of html.matchAll(/\b(?:src|href)="([^"]*)"/g)) {
    const value = (m[1] ?? '').replace(/[?#].*$/, '');
    if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) continue;
    const name = insideTheSite(value, page);
    if (!isPage(name)) names.add(name);
  }
  return [...names].sort();
}

/** The files beside it a stylesheet names: each `url(…)` that isn't another site or data. */
export function namedByStylesheet(css: string, stylesheet: string): string[] {
  const names = new Set<string>();
  for (const m of css.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*\)/g)) {
    const value = (m[2] ?? '').trim().replace(/[?#].*$/, '');
    if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) continue;
    names.add(insideTheSite(value, stylesheet));
  }
  return [...names].sort();
}

/** The previous site, however it is read: its pages, its list of files, and any file's bytes (null when missing). */
interface PreviousSite {
  pages: string[];
  published: PublishedFiles | null;
  read(name: string): Buffer | null;
}

function parsePublished(text: string, where: string): PublishedFiles {
  const parsed: unknown = JSON.parse(text);
  const files: unknown = typeof parsed === 'object' && parsed !== null ? (parsed as { files?: unknown }).files : null;
  if (typeof files !== 'object' || files === null) throw new Error(`${where}: no "files" in ${PUBLISHED_FILES}`);
  const out: Record<string, string | null> = {};
  const entries: [string, unknown][] = Object.entries(files);
  for (const [name, until] of entries) {
    if (until !== null && (typeof until !== 'string' || Number.isNaN(Date.parse(until)))) {
      throw new Error(`${where}: ${PUBLISHED_FILES} gives ${name} the time ${JSON.stringify(until)}`);
    }
    out[insideTheSite(name, PUBLISHED_FILES)] = until;
  }
  return { files: out };
}

/** The previous site in a folder (an unpacked Pages artifact, a clone of staging's repository). */
export function previousSiteIn(dir: string): PreviousSite {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory())
    throw new Error(`no previous site: ${dir} isn't a folder`);
  const pages = fs.readdirSync(dir).filter(isPage).sort();
  if (!pages.length) throw new Error(`no previous site: ${dir} has no page`);
  const list = path.join(dir, PUBLISHED_FILES);
  return {
    pages,
    published: fs.existsSync(list) ? parsePublished(fs.readFileSync(list, 'utf8'), dir) : null,
    read: (name) => {
      const file = path.join(dir, name);
      return fs.existsSync(file) && fs.statSync(file).isFile() ? fs.readFileSync(file) : null;
    },
  };
}

/** One file of the live site: its bytes, or null when the site answers 404. Any other answer, or none, throws. */
async function fetchFile(base: URL, name: string): Promise<Buffer | null> {
  const url = new URL(name, base);
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    throw new Error(`couldn't read ${url.href}: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }
  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error(`${url.href} answered ${String(res.status)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The live site at `base`, read into memory: its published-files.json (404: none, as before P1-06b), the pages that
 *  list or the new site names (404: not live), and every file those pages name or that list keeps. */
export async function previousSiteAt(base: string, pagesToTry: string[], now: Date): Promise<PreviousSite> {
  const root = new URL(base.endsWith('/') ? base : base + '/');
  const read = new Map<string, Buffer | null>();
  const get = async (name: string): Promise<Buffer | null> => {
    if (!read.has(name)) read.set(name, await fetchFile(root, name));
    return read.get(name) ?? null;
  };
  const list = await get(PUBLISHED_FILES);
  const published = list ? parsePublished(list.toString('utf8'), root.href) : null;
  const tried = [...new Set([...pagesToTry, ...Object.keys(published?.files ?? {}).filter(isPage)])].sort();
  const pages: string[] = [];
  for (const page of tried) if (await get(page)) pages.push(page);
  if (!pages.length) throw new Error(`no previous site: ${root.href} served none of ${tried.join(', ')}`);
  const site: PreviousSite = { pages, published, read: (name) => read.get(name) ?? null };
  // Every file it may keep, fetched now, so that keep() below reads only what is in memory.
  for (const name of wanted(site, now).keys()) await get(name);
  for (const css of namedByPages(site).filter((n) => n.endsWith('.css'))) {
    const text = read.get(css);
    if (text) for (const name of namedByStylesheet(text.toString('utf8'), css)) await get(name);
  }
  return site;
}

/** Every file the previous site's pages name, and every file their stylesheets name, sorted. */
function namedByPages(site: PreviousSite): string[] {
  const names = new Set<string>();
  for (const page of site.pages) {
    const html = site.read(page);
    if (!html) throw new Error(`the previous site's ${page} can't be read`);
    for (const name of namedByPage(html.toString('utf8'), page)) names.add(name);
  }
  for (const css of [...names].filter((n) => n.endsWith('.css'))) {
    const text = site.read(css);
    if (text) for (const name of namedByStylesheet(text.toString('utf8'), css)) names.add(name);
  }
  return [...names].sort();
}

/** Each file the previous site may hand on, with when it stopped being live: `now` for one its pages name or its list
 *  says is live; the list's own time for one that stopped within 24 hours. Pages are never handed on. */
function wanted(site: PreviousSite, now: Date): Map<string, string> {
  const at = now.toISOString();
  const out = new Map<string, string>();
  for (const [name, until] of Object.entries(site.published?.files ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (isPage(name)) continue;
    if (until === null) out.set(name, at);
    else if (now.getTime() - Date.parse(until) < KEPT_FOR_MS) out.set(name, until);
  }
  for (const name of namedByPages(site)) out.set(name, at);
  return out;
}

/** Puts into the new site in `dir` the files the previous site hands on that it lacks, and writes its
 *  published-files.json. Checks everything before it writes: a file to keep that the previous site lacks throws, and
 *  the new site is left as it was. */
export function keep(dir: string, previous: PreviousSite, now: Date): KeepResult {
  const made = filesUnder(dir).filter((f) => f !== PUBLISHED_FILES);
  if (!made.some(isPage)) throw new Error(`${dir} has no page: build the site first`);
  const mine = new Set(made);
  const toKeep = [...wanted(previous, now)].filter(([name]) => !mine.has(name));
  const bytes = new Map<string, Buffer>();
  const missing: string[] = [];
  for (const [name] of toKeep) {
    const b = previous.read(name);
    if (b) bytes.set(name, b);
    else missing.push(name);
  }
  if (missing.length) throw new Error(`the previous site lacks files it must hand on: ${missing.join(', ')}`);
  const published: PublishedFiles = { files: {} };
  for (const name of made) published.files[name] = null;
  for (const [name, until] of toKeep) {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes.get(name) ?? Buffer.alloc(0));
    published.files[name] = until;
  }
  const sorted: PublishedFiles = {
    files: Object.fromEntries(Object.entries(published.files).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  fs.writeFileSync(path.join(dir, PUBLISHED_FILES), JSON.stringify(sorted, null, 1) + '\n');
  const kept = toKeep.map(([name]) => name).sort();
  const dropped = Object.keys(previous.published?.files ?? {})
    .filter((name) => !isPage(name) && !mine.has(name) && !kept.includes(name))
    .sort();
  return { kept, named: namedByPages(previous), dropped };
}

/** The command line: `<site> --previous <folder>` or `<site> --live <url>`, and `--now <ISO time>`. */
export async function main(args: string[]): Promise<KeepResult> {
  const rest = [...args];
  const option = (name: string): string | undefined => {
    const i = rest.indexOf(name);
    return i < 0 ? undefined : rest.splice(i, 2)[1];
  };
  const from = option('--previous');
  const live = option('--live');
  const nowText = option('--now');
  const site = rest[0];
  if (!site || rest.length !== 1 || (from === undefined) === (live === undefined)) {
    throw new Error(
      'usage: keep-the-previous-deploys-files.ts <site> (--previous <folder> | --live <url>) [--now <ISO time>]',
    );
  }
  const now = nowText === undefined ? new Date() : new Date(nowText);
  if (Number.isNaN(now.getTime())) throw new Error(`--now ${String(nowText)} isn't a time`);
  const dir = path.resolve(site);
  if (!fs.existsSync(dir)) throw new Error(`${dir}: no site (build it first)`);
  const pages = fs.readdirSync(dir).filter(isPage);
  const previous =
    from !== undefined ? previousSiteIn(path.resolve(from)) : await previousSiteAt(live ?? '', pages, now);
  return keep(dir, previous, now);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(import.meta.filename)) {
  main(process.argv.slice(2)).then(
    (r) => {
      console.log(
        `Kept ${String(r.kept.length)} files of the previous deploy` +
          (r.kept.length ? ` (${r.kept.join(', ')})` : '') +
          `; its pages name ${String(r.named.length)}, all in the new site` +
          (r.dropped.length ? `; ${String(r.dropped.length)} no longer kept (${r.dropped.join(', ')}).` : '.'),
      );
    },
    (e: unknown) => {
      console.error(`::error title=keep the previous deploy's files::${e instanceof Error ? e.message : String(e)}`);
      process.exitCode = 1;
    },
  );
}
