// Types for the parts of tests/lib/boot.js that TypeScript tests use. Add to them as tests need more.
import type { Server } from 'node:http';
import type { BrowserContext, Page } from '@playwright/test';

/** A page's window as a test reaches it: run code in the page, read and set its globals. */
export interface PageWindow {
  eval(code: string): unknown;
  close(): void;
  addEventListener(type: 'error', listener: (e: { error?: { stack?: string }; message: string }) => void): void;
  onunhandledrejection: ((e: { reason: unknown }) => void) | null;
  console: Record<'log' | 'warn' | 'error', (...args: unknown[]) => void>;
  [global: string]: unknown;
}

/** The page's dice (src/engine/rng.js): the next number in [0, 1). `seed(n)` starts again from seed n; `use(fn)` draws
 *  from fn from now on and returns what it drew from before, to restore. */
export interface KcRng {
  (): number;
  seed(seed: number): void;
  use(fn: () => number): () => number;
}

export interface BootOptions {
  supabase?: unknown;
  setup?: (w: PageWindow) => void;
  url?: string;
  pretendToBeVisual?: boolean;
  dbVersion?: string | null | (string | null)[];
  dbCalls?: string[];
  /** The seed of the page's dice (kcRng, src/engine/rng.js; its Math.random gets the same seed). */
  seed?: number;
  /** Pins the page's clock: starts here (ms since 1970, or a date string), 1 ms on at each reading. */
  now?: number | string;
}

export function readPage(nameOrPath: string): string;
/** The files readPage reads for a page, as full paths: the page, then each local script it inlines. */
export function pageFiles(nameOrPath: string): string[];
export function bootJsdom(html: string, opts?: BootOptions): { window: PageWindow };
export function seededRandom(seed: number | string): () => number;
export function pinnedDate(RealDate: DateConstructor, now: number | string): DateConstructor;
export const SITE: string;
export const DB_VERSION: string;

/** A static file server for Chromium: the folder as deployed. `url` is where it listens (http://127.0.0.1:<port>). */
export function serve(dir?: string, port?: number): Promise<Server & { url: string }>;
/** Answers supabase-js with `stubBody` (a script) and Google Fonts with nothing, in a Playwright page or context. */
export function routeExternal(target: Page | BrowserContext, stubBody: string): Promise<void>;
