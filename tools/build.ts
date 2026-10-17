// npm run build (P1-05): puts the site together from src/ into site/. site/ is build output, not in git: it is what
// GitHub Pages publishes (deploy.yml), what staging publishes (staging.yml), and what every test opens. The test runs
// build it first (tests/setup/global.ts, tools/balance/run.ts), so they never open stale pages.
//
// src/manifest.ts says which files make each published file. A page is its template with each {{kc-build:<name>}} line
// replaced by that block's files, one after another, byte for byte; any other file is copied as it is. The build stops
// if a marker or a block has no partner, or a file under src/ is in no list (a forgotten file would never be published).
// It writes only the files that changed, each through a temporary file, and removes from site/ what it no longer makes.
//
// It runs in plain Node before npm ci (the deploy job installs nothing): keep it to erasable TypeScript (types only)
// and import nothing but Node's own modules and the manifest. P1-09 replaces it with Vite.
//
//   node tools/build.ts [out]     out: the folder to build into (default: site/ beside src/)
import fs from 'node:fs';
import path from 'node:path';
import { COPIES, PAGES } from '../src/manifest.ts';

export const ROOT = path.resolve(import.meta.dirname, '..');
const MARKER = /^\{\{kc-build:([\w-]+)\}\}$/;
const MARKER_TEXT = '{{kc-build:';

/** The files under `dir`, as paths relative to it with "/" between folders, sorted. */
export function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

/** The files under src/ that make one published file, in order (paths relative to src/): a page's template then its
 *  blocks' files, or the one file copied. */
export function sourcesOf(name: string): string[] {
  const page = PAGES[name];
  if (page) return [page.template, ...Object.values(page.blocks).flat()];
  const copy = COPIES[name];
  if (copy) return [copy];
  throw new Error(`${name}: not in src/manifest.ts`);
}

/** One page, put together: its template's marker lines replaced by their blocks. */
function page(src: string, name: string, p: (typeof PAGES)[string]): Buffer {
  const template = fs.readFileSync(path.join(src, p.template), 'utf8');
  const parts: Buffer[] = [];
  const used = new Set<string>();
  let pos = 0;
  for (const line of template.matchAll(/^.*$/gm)) {
    const block = MARKER.exec(line[0])?.[1];
    if (block === undefined) {
      if (line[0].includes(MARKER_TEXT)) throw new Error(`${p.template}: "${line[0]}" must be a line on its own`);
      continue;
    }
    const files = p.blocks[block];
    if (!files) throw new Error(`${p.template}: block "${block}" isn't in src/manifest.ts's entry for ${name}`);
    if (used.has(block)) throw new Error(`${p.template}: block "${block}" is placed twice`);
    used.add(block);
    // The marker line goes, with its line end; its block's files take its place.
    parts.push(Buffer.from(template.slice(pos, line.index), 'utf8'));
    for (const f of files) parts.push(fs.readFileSync(path.join(src, f)));
    pos = line.index + line[0].length + 1;
  }
  parts.push(Buffer.from(template.slice(pos), 'utf8'));
  const unplaced = Object.keys(p.blocks).filter((b) => !used.has(b));
  if (unplaced.length) throw new Error(`${p.template}: no {{kc-build:…}} line for ${unplaced.join(', ')}`);
  return Buffer.concat(parts);
}

/** Every published file, by its name in site/, put together from `src` (src/ by default). */
export function assemble(src = path.join(ROOT, 'src')): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  for (const [name, p] of Object.entries(PAGES)) out.set(name, page(src, name, p));
  for (const [name, f] of Object.entries(COPIES)) {
    if (out.has(name)) throw new Error(`${name}: both a page and a copy in src/manifest.ts`);
    out.set(name, fs.readFileSync(path.join(src, f)));
  }
  const listed = new Set([...out.keys()].flatMap(sourcesOf));
  const unlisted = filesUnder(src).filter((f) => f !== 'manifest.ts' && !listed.has(f));
  if (unlisted.length) {
    throw new Error(`in src/ but in no list in src/manifest.ts, so never published: ${unlisted.join(', ')}`);
  }
  return out;
}

/** Builds into `out`: writes what changed, removes what is no longer made. Returns the names written and removed. */
export function build(out = path.join(ROOT, 'site'), src = path.join(ROOT, 'src')) {
  const files = assemble(src);
  const written: string[] = [];
  for (const [name, bytes] of files) {
    const target = path.join(out, name);
    if (fs.existsSync(target) && fs.readFileSync(target).equals(bytes)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // Two runs at once (Vitest and Playwright, say) each write a whole file: a reader never sees half of one.
    const temp = `${target}.${String(process.pid)}.tmp`;
    fs.writeFileSync(temp, bytes);
    fs.renameSync(temp, target);
    written.push(name);
  }
  const removed = filesUnder(out).filter((f) => !files.has(f) && !f.endsWith('.tmp'));
  for (const f of removed) fs.rmSync(path.join(out, f));
  return { files: files.size, written, removed };
}

// Real paths: a folder reached through a link (macOS's /tmp, say) must still count as this script being run.
const entry = process.argv[1];
if (entry && fs.realpathSync(entry) === fs.realpathSync(import.meta.filename)) {
  const out = path.resolve(process.argv[2] ?? path.join(ROOT, 'site'));
  const r = build(out);
  const changed = [
    r.written.length ? `${String(r.written.length)} written` : '',
    r.removed.length ? `${String(r.removed.length)} removed (${r.removed.join(', ')})` : '',
  ].filter(Boolean);
  console.log(
    `Built ${path.relative(process.cwd(), out) || '.'}/ from src/: ${String(r.files)} files` +
      (changed.length ? `, ${changed.join(', ')}.` : ', none changed.'),
  );
}
